import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DOCTORS, doctorKey } from './data/doctors';
import { PRODUCT_IMAGES_FILE, SITE_IMAGES_FILE } from './data/images';
import { MEDICATIONS, medKey } from './data/medications';
import { SITE_SLOTS } from './data/site-slots';
import { getAdminRoot, isMain, type Root } from './lib';

/**
 * Picks photos for every doctor, every medication and every site banner slot by searching pexels.com.
 *
 *   npx tsx scripts/seed/update-images.ts [--dry-run] [--only <product-key|slot>] [--count 2]
 *
 * - `--dry-run` searches and prints; it writes nothing (neither commercetools nor the JSON files).
 * - Each product's old images (all variants) are removed and the new ones added to every variant, then it is published.
 * - Picks are saved to `data/product-images.json` (products) and `data/site-images.json` (banners, keyed by slot,
 *   one photo each), which a fresh seed and `site/content/images.ts` read, so the same photos are reproduced.
 * - Stored URLs are CLEAN: no query string, no fragment (the host answers a clean URL with a redirect to the sized image).
 * - Doctors use portrait queries (Q-035); medicines use the generic `imageQuery` (brand names return noise).
 *
 * The search is the public JSON endpoint behind pexels.com/search; no cookie or login is needed, so nothing secret is sent.
 * It is undocumented and may change: fall back to the official Pexels API with a key (see README).
 */
const ENDPOINT = 'https://www.pexels.com/en-us/api/v3/getty-media/photos';
/** Public client id the pexels.com web app itself sends; without it the endpoint answers 401. */
const CLIENT_ID = process.env.PEXELS_CLIENT_ID ?? '4faffa81915014bbd90c420f22898950';
const FALLBACK_SIZE = { w: 612, h: 612 };

export interface PickedImage { url: string; dimensions: { w: number; h: number } }
export interface Photo { url: string; photographer?: string }
export interface SiteImage extends PickedImage { photographer?: string }

/** `https://host/a/b.jpg?s=612&k=20#x` becomes `https://host/a/b.jpg`. */
export function cleanUrl(raw: string): string {
  const url = new URL(raw);
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * The product name without strength, form and pack size, which only hurts photo search:
 * "Amoxicillin 500 mg capsules" becomes "Amoxicillin", "Whole milk 1 L" becomes "Whole milk".
 */
export function searchTerm(name: string): string {
  const stripped = name
    .replace(/\s+\d+([.,]\d+)?(\/\d+([.,]\d+)?)?\s*(mg|mcg|g|kg|ml|l|oz|iu|%)\b/gi, '')
    .replace(/\s+(tablets?|capsules?|caplets?|pack|packs)\b/gi, '')
    .replace(/(\s+\d+([.,]\d+)?)+$/, '')
    .trim();
  return stripped || name;
}

/** The first `count` distinct clean photos of a search response (photographer when the response carries one). */
export function pickPhotos(response: unknown, count: number): Photo[] {
  type Item = { attributes?: { image?: unknown; photographer?: unknown; user?: { username?: unknown } } };
  const data = (response as { data?: Item[] } | null)?.data ?? [];
  const photos: Photo[] = [];
  for (const item of data) {
    const image = item.attributes?.image;
    if (typeof image !== 'string') continue;
    let url: string;
    try {
      url = cleanUrl(image);
    } catch {
      continue;
    }
    if (photos.some((p) => p.url === url)) continue;
    const who = item.attributes?.photographer ?? item.attributes?.user?.username;
    photos.push({ url, ...(typeof who === 'string' && who ? { photographer: who } : {}) });
    if (photos.length === count) break;
  }
  return photos;
}

/** The first `count` distinct clean image URLs of a search response. */
export const pickUrls = (response: unknown, count: number): string[] => pickPhotos(response, count).map((p) => p.url);

/** Width and height from the first JPEG start-of-frame marker; `null` when the bytes are not a readable JPEG. */
export function jpegSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return null;
}

export function parseArgs(argv: string[]): { dryRun: boolean; only?: string; count: number } {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const count = Number(get('--count') ?? 2);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('--count must be an integer from 1 to 6');
  return { dryRun: argv.includes('--dry-run'), only: get('--only'), count };
}

// ---------------------------------------------------------------- network (replaced by mocks in tests)

export type SearchFn = (term: string, count: number) => Promise<Photo[]>;
export type MeasureFn = (url: string) => Promise<{ w: number; h: number }>;

export const searchPexels: SearchFn = async (term, count) => {
  // Ask for a few more than needed so duplicates after cleaning do not leave us short.
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(term)}?number=${count + 2}&page=1`, {
    headers: { accept: '*/*', 'content-type': 'application/json', 'x-client-type': 'react', 'pexels-client-id': CLIENT_ID, 'user-agent': 'malva-seed' },
  });
  if (!res.ok) throw new Error(`pexels search "${term}" failed: ${res.status}`);
  return pickPhotos(await res.json(), count);
};

export const measureImage: MeasureFn = async (url) => {
  try {
    const res = await fetch(url); // follows the redirect to the sized image
    return res.ok ? (jpegSize(new Uint8Array(await res.arrayBuffer())) ?? FALLBACK_SIZE) : FALLBACK_SIZE;
  } catch {
    return FALLBACK_SIZE;
  }
};

// ---------------------------------------------------------------- core

export interface ImageTarget { key: string; query: string }

/** Doctors and medications with the term to search for. */
export function productTargets(): ImageTarget[] {
  return [
    ...DOCTORS.map((d) => ({ key: doctorKey(d), query: d.imageQuery })),
    ...MEDICATIONS.map((d) => ({ key: medKey(d), query: d.imageQuery || searchTerm(d.name) })),
  ];
}

interface Variant { id: number; images?: { url: string }[] }

export async function replaceImages(root: Root, key: string, images: PickedImage[]): Promise<void> {
  const product = (await root.products().withKey({ key }).get().execute()).body;
  const variants: Variant[] = [product.masterData.staged.masterVariant, ...product.masterData.staged.variants];
  const actions = [
    ...variants.flatMap((v) => (v.images ?? []).map((i) => ({ action: 'removeImage' as const, variantId: v.id, imageUrl: i.url }))),
    ...variants.flatMap((v) => images.map((image) => ({ action: 'addExternalImage' as const, variantId: v.id, image }))),
    { action: 'publish' as const },
  ];
  await root.products().withKey({ key }).post({ body: { version: product.version, actions } }).execute();
}

export interface UpdateOptions {
  root: Root | null;
  dryRun: boolean;
  only?: string;
  count: number;
  search: SearchFn;
  measure: MeasureFn;
  /** Persists a JSON file; tests record instead of writing. */
  save: (file: string, data: unknown) => void;
  load?: (file: string) => Record<string, unknown>;
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}

export interface UpdateResult { products: Record<string, PickedImage[]>; slots: Record<string, SiteImage>; failed: number }

export async function updateImages(o: UpdateOptions): Promise<UpdateResult> {
  const log = o.log ?? console.log;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const targets = productTargets().filter((t) => !o.only || t.key === o.only);
  const slots = SITE_SLOTS.filter((s) => !o.only || s.slot === o.only);
  if (targets.length + slots.length === 0) throw new Error(`No product or slot with key "${String(o.only)}"`);
  const result: UpdateResult = { products: {}, slots: {}, failed: 0 };

  const pick = async (term: string, count: number) => {
    const photos = await o.search(term, count);
    if (photos.length < count) throw new Error(`only ${photos.length} result(s) for "${term}"`);
    return Promise.all(photos.map(async (p) => ({ ...p, dimensions: await o.measure(p.url) })));
  };

  for (const t of targets) {
    try {
      const picked = await pick(t.query, o.count);
      const images: PickedImage[] = picked.map(({ url, dimensions }) => ({ url, dimensions }));
      if (o.root) await replaceImages(o.root, t.key, images);
      result.products[t.key] = images;
      log(`${o.dryRun ? 'would set' : 'updated'}  ${t.key}  ("${t.query}")\n  ${images.map((i) => i.url).join('\n  ')}`);
    } catch (e) {
      result.failed += 1;
      log(`FAILED   ${t.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(o.pauseMs ?? 400);
  }
  for (const s of slots) {
    try {
      const [photo] = await pick(s.query, 1);
      result.slots[s.slot] = photo;
      log(`${o.dryRun ? 'would set' : 'picked'}   ${s.slot}  ("${s.query}")  ${photo.url}`);
    } catch (e) {
      result.failed += 1;
      log(`FAILED   ${s.slot}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(o.pauseMs ?? 400);
  }

  if (!o.dryRun) {
    const load = o.load ?? ((file: string) => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : {}));
    if (Object.keys(result.products).length > 0) {
      o.save(PRODUCT_IMAGES_FILE, sortKeys({ ...load(PRODUCT_IMAGES_FILE), ...result.products }));
      log(`saved ${Object.keys(result.products).length} product(s) to scripts/seed/data/product-images.json`);
    }
    if (Object.keys(result.slots).length > 0) {
      o.save(SITE_IMAGES_FILE, sortKeys({ ...load(SITE_IMAGES_FILE), ...result.slots }));
      log(`saved ${Object.keys(result.slots).length} slot(s) to scripts/seed/data/site-images.json`);
    }
  }
  log(`${o.dryRun ? 'dry run: ' : ''}${Object.keys(result.products).length} product(s), ${Object.keys(result.slots).length} slot(s) ok, ${result.failed} failed`);
  return result;
}

const sortKeys = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

async function main() {
  const { dryRun, only, count } = parseArgs(process.argv.slice(2));
  const root = dryRun ? null : (await getAdminRoot()).root;
  const result = await updateImages({
    root, dryRun, only, count, search: searchPexels, measure: measureImage,
    save: (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`),
  });
  if (result.failed > 0) process.exit(1);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
