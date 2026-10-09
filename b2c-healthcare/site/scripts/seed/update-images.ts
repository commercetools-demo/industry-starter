import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DOCTORS, doctorKey } from './data/doctors';
import { loadProductImages, loadSiteImages } from './data/images';
import { PRODUCT_IMAGES_FILE, SITE_IMAGES_FILE } from './data/images';
import { MEDICATIONS, medKey } from './data/medications';
import { SITE_SLOTS } from './data/site-slots';
import { getAdminRoot, isMain, type Root } from './lib';

/**
 * Picks photos for every doctor, every medication and every site banner slot by searching pexels.com.
 *
 *   npx tsx scripts/seed/update-images.ts [--dry-run | --json-only] [--only <product-key|slot>] [--count 2]
 *
 * - `--dry-run` searches and prints; it writes nothing (neither commercetools nor the JSON files).
 * - `--json-only` searches Pexels and writes `data/product-images.json` and `data/site-images.json` WITHOUT touching commercetools:
 *   no credentials needed. Commit the result; `seed.ts` and `seed:full` then put exactly these photos on the products (D-040).
 * - Each product's old images (all variants) are removed and the new ones added to every variant, then it is published.
 * - Picks are saved to `data/product-images.json` (products) and `data/site-images.json` (banners, keyed by slot,
 *   one photo each), which a fresh seed and `site/content/images.ts` read, so the same photos are reproduced.
 * - Stored URLs are CLEAN: no query string, no fragment (the host answers a clean URL with a redirect to the sized image).
 * - Doctors use portrait queries (Q-035); medicines use the generic `imageQuery` (brand names return noise).
 *
 * Without a key the search is the Next.js data route behind pexels.com/search (owner decision 2026-10-09: fine for the one-off seeding run):
 *   GET https://www.pexels.com/_next/data/<buildId>/en-US/search/<query>.json?query=<query>   (<buildId> is read from the search page)
 * Multi-word queries have no data route (404), so those read the same JSON embedded in the search page (`__NEXT_DATA__`).
 * Every photo it returns has `license: "Pexels"`. No cookie or login is needed, a browser-like user agent is. It is undocumented and
 * may change: set `PEXELS_API_KEY` to use the official Pexels API instead.
 */
const WEB = 'https://www.pexels.com';
const WEB_HEADERS = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
const FALLBACK_SIZE = { w: 612, h: 612 };

export interface PickedImage { url: string; dimensions: { w: number; h: number } }
/** `name` is the photo's descriptive slug/title, which the avoid/require filters read (the clean URL itself only carries the numeric id). */
export interface Photo { url: string; photographer?: string; name?: string }

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

/** Photos of a pexels.com search data (`initialData.data[].attributes`): `image.large` without its query string, distinct, Pexels licence only. */
export function pickPexelsWeb(data: unknown, count: number): Photo[] {
  type Item = { attributes?: { image?: { large?: unknown }; slug?: unknown; title?: unknown; license?: unknown } };
  const items = (data as { data?: Item[] } | null)?.data ?? [];
  const out: Photo[] = [];
  for (const item of items) {
    const a = item.attributes;
    if (typeof a?.image?.large !== 'string' || (a.license !== undefined && a.license !== 'Pexels')) continue;
    let url: string;
    try {
      url = cleanUrl(a.image.large);
    } catch {
      continue;
    }
    if (out.some((o) => o.url === url)) continue;
    const name = [a.slug, a.title].filter((x): x is string => typeof x === 'string').join(' ').toLowerCase().replace(/\s+/g, '-');
    out.push({ url, ...(name ? { name } : {}) });
    if (out.length === count) break;
  }
  return out;
}

export function parseArgs(argv: string[]): { dryRun: boolean; jsonOnly: boolean; only?: string; count: number } {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const count = Number(get('--count') ?? 2);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('--count must be an integer from 1 to 6');
  const jsonOnly = argv.includes('--json-only');
  if (jsonOnly && argv.includes('--dry-run')) throw new Error('--json-only writes the JSON files; --dry-run writes nothing. Use one of them.');
  return { dryRun: argv.includes('--dry-run'), jsonOnly, only: get('--only'), count };
}

// ---------------------------------------------------------------- network (replaced by mocks in tests)

export type SearchFn = (term: string, count: number) => Promise<Photo[]>;
/** `null` when the URL does not load (any status but 200): such a photo is skipped. */
export type MeasureFn = (url: string) => Promise<{ w: number; h: number } | null>;

/** Photos of an official Pexels API response (`photos[].src.large`), clean URLs, distinct. */
export function pickPexelsApi(response: unknown, count: number): Photo[] {
  const photos = (response as { photos?: { src?: { large?: unknown } }[] } | null)?.photos ?? [];
  const out: Photo[] = [];
  for (const p of photos) {
    if (typeof p.src?.large !== 'string') continue;
    const url = cleanUrl(p.src.large);
    if (!out.some((o) => o.url === url)) out.push({ url });
    if (out.length === count) break;
  }
  return out;
}

/**
 * With `PEXELS_API_KEY` in the shell the OFFICIAL Pexels API is used (free key from pexels.com/api; every photo is under the Pexels licence).
 * Without it the pexels.com search data route is used (see the header comment).
 */
export const searchPexels: SearchFn = async (term, count) => {
  const key = process.env.PEXELS_API_KEY;
  if (key) {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=${Math.min(count + 2, 80)}`, { headers: { authorization: key } });
    if (!res.ok) throw new Error(`pexels api search "${term}" failed: ${res.status}`);
    return pickPexelsApi(await res.json(), count);
  }
  return searchPublicEndpoint(term, count);
};

let buildId: string | undefined;

async function pexelsGet(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, { headers: { ...WEB_HEADERS, ...headers } });
}

/** The page's embedded JSON (`<script id="__NEXT_DATA__">`) holds the build id and, on a search page, the first results. */
function nextData(html: string): { buildId?: string; props?: { pageProps?: { initialData?: unknown } } } | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  return m ? (JSON.parse(m[1]) as ReturnType<typeof nextData>) : null;
}

const searchPublicEndpoint: SearchFn = async (term, count) => {
  const photos: Photo[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 6 && photos.length < count; page += 1) {
    const slug = encodeURIComponent(term);
    const pageQuery = page > 1 ? `&page=${page}` : '';
    let initialData: unknown;
    if (/^[A-Za-z0-9]+$/.test(term)) {
      // single word: the data route the owner pointed at
      for (let attempt = 0; attempt < 2 && initialData === undefined; attempt += 1) {
        if (!buildId) buildId = nextData(await (await pexelsGet(`${WEB}/search/${slug}/`)).text())?.buildId;
        if (!buildId) break;
        const res = await pexelsGet(`${WEB}/_next/data/${buildId}/en-US/search/${slug}.json?query=${slug}${pageQuery}`, { 'x-nextjs-data': '1' });
        if (res.ok) initialData = ((await res.json()) as { pageProps?: { initialData?: unknown } }).pageProps?.initialData;
        else buildId = undefined; // stale build id after a Pexels deploy: read it again
      }
    }
    if (initialData === undefined) {
      const res = await pexelsGet(`${WEB}/search/${slug}/${page > 1 ? `?page=${page}` : ''}`);
      if (!res.ok) throw new Error(`pexels search "${term}" failed: ${res.status}`);
      initialData = nextData(await res.text())?.props?.pageProps?.initialData;
    }
    const batch = pickPexelsWeb(initialData, 100);
    if (batch.length === 0) break;
    for (const p of batch) if (!seen.has(p.url)) { seen.add(p.url); photos.push(p); }
  }
  return photos.slice(0, count);
};

export const measureImage: MeasureFn = async (url) => {
  try {
    const res = await fetch(url); // follows the redirect to the sized image
    return res.ok ? (jpegSize(new Uint8Array(await res.arrayBuffer())) ?? FALLBACK_SIZE) : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------- core

export interface ImageTarget {
  key: string;
  query: string;
  /** Last-resort wide queries (in order) when the specific ones return too few photos. */
  fallbacks?: string[];
  /** Photos whose file name (the descriptive slug of the URL) matches are skipped: people on a pill photo, a nurse for a doctor. */
  avoid?: RegExp;
  /** When set, the file name must also match this. */
  require?: RegExp;
}

/** Medicine photos should show the product, not people, factories or renderings. */
export const AVOID_FOR_MEDICINE = /(wom[ae]n|\bman\b|men\b|person|people|worker|senior|patient|doctor|nurse|pharmacist|factory|conveyor|manufactur|rendering|hands?|holding|smartphone|phone|child|girl|boy|elderly|taking|production|suppositor|shopping|cart\b|trolley|toy\b|teddy|concept|legislation|bogota|machine|industrial|paying|vaginal|ecg|stethoscope|solo|research|laptop|shelves|bottle|pharmaceutical|customer|housewife|female|male|molecular|abstract|model-of|kit\b|first-aid|syringe|thermometer|vial|vaccine|mockup|placebo|empty|waste|remaining)/i;
/** ... and should be about pills, tablets, capsules or blister packs. */
export const REQUIRE_FOR_MEDICINE = /(pill|tablet|capsule|blister|medic|drug)/i;
/** A doctor's portrait is a doctor, not a nurse or an empty hospital. */
export const REQUIRE_FOR_DOCTOR = /(doctor|physician|medical-professional|\bgp\b)/i;
export const AVOID_FOR_DOCTOR = /(nurse|isolated|surgeon|surgery|team|group|child|patient\b)/i;

/**
 * The queries to try in order: the given one, then the same with trailing words removed one at a time (never below one word),
 * then the fallback. "pharmacy medicine blister pack" -> "pharmacy medicine blister" -> "pharmacy medicine" -> "pharmacy".
 */
export function queryLadder(query: string, ...fallbacks: (string | undefined)[]): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let n = words.length; n >= 1; n -= 1) out.push(words.slice(0, n).join(' '));
  for (const f of fallbacks) if (f && !out.includes(f)) out.push(f);
  return out;
}

/** Doctors and medications with the term to search for. */
export function productTargets(): ImageTarget[] {
  return [
    ...DOCTORS.map((d) => ({ key: doctorKey(d), query: d.imageQuery, fallbacks: ['doctor portrait', 'physician'], avoid: AVOID_FOR_DOCTOR, require: REQUIRE_FOR_DOCTOR })),
    ...MEDICATIONS.map((d) => ({ key: medKey(d), query: d.imageQuery || searchTerm(d.name), fallbacks: ['pharmacy medicine', 'medicine tablets', 'pills', 'capsules'], avoid: AVOID_FOR_MEDICINE, require: REQUIRE_FOR_MEDICINE })),
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

export interface UpdateResult {
  products: Record<string, PickedImage[]>;
  slots: Record<string, PickedImage>;
  failed: number;
  /** Targets whose first query returned too few photos and a wider one was used (recorded so the choice can be reviewed). */
  widened: { key: string; from: string; to: string }[];
}

export async function updateImages(o: UpdateOptions): Promise<UpdateResult> {
  const log = o.log ?? console.log;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const targets = productTargets().filter((t) => !o.only || t.key === o.only);
  const slots = SITE_SLOTS.filter((s) => !o.only || s.slot === o.only);
  if (targets.length + slots.length === 0) throw new Error(`No product or slot with key "${String(o.only)}"`);
  const result: UpdateResult = { products: {}, slots: {}, failed: 0, widened: [] };

  // Every product and slot gets its own photos: a photo chosen for one is skipped for the next (several doctors share one query).
  const used = new Set<string>();
  const loadStored = o.load ?? ((file: string) => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : {}));
  if (o.only) {
    // a single re-pick must not reuse a photo another product already shows
    for (const file of [PRODUCT_IMAGES_FILE, SITE_IMAGES_FILE]) {
      for (const [k, v] of Object.entries(loadStored(file))) {
        if (k === o.only) continue;
        for (const img of Array.isArray(v) ? v : [v]) if (img && typeof (img as { url?: unknown }).url === 'string') used.add((img as { url: string }).url);
      }
    }
  }
  const pick = async (key: string, term: string, count: number, fallbacks: string[] = [], avoid?: RegExp, require?: RegExp): Promise<PickedImage[]> => {
    const tried: string[] = [];
    for (const query of queryLadder(term, ...fallbacks)) {
      const all = await o.search(query, count + used.size + (avoid ? 40 : 0));
      const label = (p: Photo) => p.name ?? p.url.split('/').pop() ?? '';
      const candidates = all.filter((p) => !used.has(p.url) && !(avoid && avoid.test(label(p))) && (!require || require.test(label(p))));
      const photos: PickedImage[] = [];
      for (const p of candidates) {
        if (photos.length === count) break;
        const dimensions = await o.measure(p.url);
        if (dimensions) photos.push({ url: p.url, dimensions }); // a URL that does not load (status other than 200) is skipped
      }
      if (photos.length >= count) {
        for (const p of photos) used.add(p.url);
        if (query !== term) {
          result.widened.push({ key, from: term, to: query });
          log(`WIDENED  ${key}: "${term}" gave too few photos, used "${query}"`);
        }
        // credits are not shown (royalty-free, D-040): only the URL and its size are stored
        return photos;
      }
      tried.push(`"${query}" ${photos.length}`);
    }
    throw new Error(`too few results; tried ${tried.join(', ')}`);
  };

  for (const t of targets) {
    try {
      const images = await pick(t.key, t.query, o.count, t.fallbacks, t.avoid, t.require);
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
      const [photo] = await pick(s.slot, s.query, 1);
      result.slots[s.slot] = photo;
      log(`${o.dryRun ? 'would set' : 'picked'}   ${s.slot}  ("${s.query}")  ${photo.url}`);
    } catch (e) {
      result.failed += 1;
      log(`FAILED   ${s.slot}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(o.pauseMs ?? 400);
  }

  if (!o.dryRun) {
    const load = loadStored;
    if (Object.keys(result.products).length > 0) {
      o.save(PRODUCT_IMAGES_FILE, sortKeys({ ...load(PRODUCT_IMAGES_FILE), ...result.products }));
      log(`saved ${Object.keys(result.products).length} product(s) to scripts/seed/data/product-images.json`);
    }
    if (Object.keys(result.slots).length > 0) {
      o.save(SITE_IMAGES_FILE, sortKeys({ ...load(SITE_IMAGES_FILE), ...result.slots }));
      log(`saved ${Object.keys(result.slots).length} slot(s) to scripts/seed/data/site-images.json`);
    }
  }
  log(`${o.dryRun ? 'dry run: ' : ''}${Object.keys(result.products).length} product(s), ${Object.keys(result.slots).length} slot(s) ok, ${result.widened.length} widened, ${result.failed} failed`);
  return result;
}

/**
 * Puts the stored photos (data/product-images.json) on the products that differ (the seed already creates products with them, so this is
 * normally a no-op) and checks every doctor, medication and slot has one: the deterministic "images" stage of `seed:full`.
 */
export function missingStoredImages(): string[] {
  const stored = loadProductImages();
  const slots = loadSiteImages();
  return [...productTargets().map((t) => t.key).filter((k) => !(stored[k]?.length)), ...SITE_SLOTS.map((s) => s.slot).filter((k) => !slots[k])];
}

export async function applyStoredImages(root: Root, dryRun: boolean, log: (line: string) => void = console.log): Promise<{ applied: number; missing: string[] }> {
  const stored = loadProductImages();
  const missing = missingStoredImages();
  if (missing.length > 0) throw new Error(`No stored photo for ${missing.join(', ')}. Run \`npm run seed:images -- --json-only\` (no credentials needed), commit the JSON and run again.`);
  let applied = 0;
  for (const t of productTargets()) {
    const wanted = stored[t.key].map((i) => i.url);
    const product = (await root.products().withKey({ key: t.key }).get().execute()).body;
    const staged = product.masterData.staged;
    const have = (staged.masterVariant.images ?? []).map((i) => i.url);
    if (JSON.stringify(have) === JSON.stringify(wanted)) continue;
    log(`${dryRun ? 'would set' : 'set'}      images of ${t.key}`);
    if (!dryRun) await replaceImages(root, t.key, stored[t.key]);
    applied += 1;
  }
  log(`${applied} product(s) had images that differ from data/product-images.json; ${SITE_SLOTS.length} banner slots are read from data/site-images.json`);
  return { applied, missing };
}

const sortKeys = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

async function main() {
  const { dryRun, jsonOnly, only, count } = parseArgs(process.argv.slice(2));
  const root = dryRun || jsonOnly ? null : (await getAdminRoot()).root;
  const result = await updateImages({
    root, dryRun, only, count, search: searchPexels, measure: measureImage,
    save: (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`),
  });
  if (result.failed > 0) process.exit(1);
}

if (isMain(__filename)) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
