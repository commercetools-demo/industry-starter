import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ProductUpdateAction } from '@commercetools/platform-sdk';
import { DEFS } from './data/catalog';
import { getAdminRoot, type Root } from './lib';

/**
 * Replaces the images of every seeded product with 2 photos found by searching pexels.com for the product name.
 *
 *   npx tsx scripts/seed/update-images.ts [--dry-run] [--only <product-key>] [--count 2]
 *
 * - `--dry-run` searches and prints, writes nothing (neither commercetools nor the JSON file).
 * - Each product's old images (all variants) are removed and the new ones added to every variant, then the product is published.
 * - The picked images are saved to `data/product-images.json`, which `data/catalog.ts` uses, so a fresh seed gets the same photos.
 * - Stored URLs are clean: no query string (the host answers a clean URL with a redirect to the sized image).
 *
 * The search is the public JSON endpoint behind pexels.com/search (see scripts/pexels/test.request); no cookie or login
 * is needed, so nothing secret is sent. It is undocumented and may change.
 */
const ENDPOINT = 'https://www.pexels.com/en-us/api/v3/getty-media/photos';
/** Public client id the pexels.com web app itself sends (from the captured request); without it the endpoint answers 401. */
const CLIENT_ID = process.env.PEXELS_CLIENT_ID ?? '4faffa81915014bbd90c420f22898950';
const FALLBACK_SIZE = { w: 612, h: 612 };
export const IMAGES_FILE = path.join(__dirname, 'data', 'product-images.json');

export interface PickedImage { url: string; dimensions: { w: number; h: number } }

/** `https://host/a/b.jpg?s=612&k=20` becomes `https://host/a/b.jpg`. */
export function cleanUrl(raw: string): string {
  const url = new URL(raw);
  url.search = '';
  url.hash = '';
  return url.toString();
}

/** The product name without a trailing pack size ("Whole milk 1 L" becomes "Whole milk", "Paper towels 4 rolls" becomes "Paper towels"), which only hurts photo search. */
export function searchTerm(name: string): string {
  return name.replace(/(\s+\d+([.,]\d+)?(\s*[×x]\s*\d+([.,]\d+)?)?(\s*(g|kg|ml|l|oz|lb|bags?|rolls?|pack))?)+$/i, '').trim() || name;
}

/** The first `count` distinct clean image URLs of a search response. */
export function pickUrls(response: unknown, count: number): string[] {
  const data = (response as { data?: { attributes?: { image?: unknown } }[] } | null)?.data ?? [];
  const urls: string[] = [];
  for (const item of data) {
    const image = item.attributes?.image;
    if (typeof image !== 'string') continue;
    const url = cleanUrl(image);
    if (!urls.includes(url)) urls.push(url);
    if (urls.length === count) break;
  }
  return urls;
}

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

async function search(term: string, count: number): Promise<string[]> {
  // Ask for a few more than needed so duplicates after cleaning do not leave us short.
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(term)}?number=${count + 2}&page=1`, {
    headers: { accept: '*/*', 'content-type': 'application/json', 'x-client-type': 'react', 'pexels-client-id': CLIENT_ID, 'user-agent': 'malva-seed' },
  });
  if (!res.ok) throw new Error(`pexels search "${term}" failed: ${res.status}`);
  return pickUrls(await res.json(), count);
}

async function measure(url: string): Promise<{ w: number; h: number }> {
  try {
    const res = await fetch(url); // follows the redirect to the sized image
    return res.ok ? (jpegSize(new Uint8Array(await res.arrayBuffer())) ?? FALLBACK_SIZE) : FALLBACK_SIZE;
  } catch {
    return FALLBACK_SIZE;
  }
}

interface Variant { id: number; images?: { url: string }[] }

async function replaceImages(root: Root, key: string, images: PickedImage[]): Promise<void> {
  const product = (await root.products().withKey({ key }).get().execute()).body;
  const variants: Variant[] = [product.masterData.staged.masterVariant, ...product.masterData.staged.variants];
  const actions: ProductUpdateAction[] = [
    ...variants.flatMap((v) => (v.images ?? []).map((i) => ({ action: 'removeImage' as const, variantId: v.id, imageUrl: i.url }))),
    ...variants.flatMap((v) => images.map((image) => ({ action: 'addExternalImage' as const, variantId: v.id, image }))),
    { action: 'publish' as const },
  ];
  await root.products().withKey({ key }).post({ body: { version: product.version, actions } }).execute();
}

export function parseArgs(argv: string[]): { dryRun: boolean; only?: string; count: number } {
  const get = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const count = Number(get('--count') ?? 2);
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('--count must be an integer from 1 to 6');
  return { dryRun: argv.includes('--dry-run'), only: get('--only'), count };
}

async function main() {
  const { dryRun, only, count } = parseArgs(process.argv.slice(2));
  const defs = DEFS.filter((d) => !only || d.key === only);
  if (defs.length === 0) throw new Error(`No product with key "${only}"`);
  const root = dryRun ? null : getAdminRoot().root;
  const saved: Record<string, PickedImage[]> = {};
  let failed = 0;
  for (const d of defs) {
    const term = searchTerm(d.en);
    try {
      const urls = await search(term, count);
      if (urls.length < count) throw new Error(`only ${urls.length} result(s) for "${term}"`);
      const images: PickedImage[] = [];
      for (const url of urls) images.push({ url, dimensions: await measure(url) });
      if (root) await replaceImages(root, d.key, images);
      saved[d.key] = images;
      console.log(`${dryRun ? 'would set' : 'updated'}  ${d.key}  ("${term}")\n  ${images.map((i) => i.url).join('\n  ')}`);
    } catch (e) {
      failed += 1;
      console.error(`FAILED   ${d.key}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!dryRun && Object.keys(saved).length > 0) {
    const previous = existsSync(IMAGES_FILE) ? JSON.parse(readFileSync(IMAGES_FILE, 'utf8')) : {};
    writeFileSync(IMAGES_FILE, `${JSON.stringify({ ...previous, ...saved }, null, 2)}\n`);
    console.log(`saved ${Object.keys(saved).length} product(s) to scripts/seed/data/product-images.json`);
  }
  console.log(`${dryRun ? 'dry run: ' : ''}${Object.keys(saved).length} ok, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1]?.endsWith('update-images.ts')) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
