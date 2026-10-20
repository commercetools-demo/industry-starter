// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RecordedImage } from './data/catalog';
import { DATA_DIR, assertSafeProject, fail, isMainModule, loadDotenvFiles, parseArgs } from './lib';

/**
 * Records free stock photos for products and categories. No browser, no cookie, no block bypass.
 *
 * Request: `GET ${IMAGE_SOURCE_URL}` (the owner provides the URL, OA-03). Response shape (`sample-data/image.json`,
 * `src/fixtures/image-source.json` is a complete invented fixture of it):
 *   { pageProps: { initialData: { data: [ { attributes: { width, height, description,
 *       image: { small, medium, large, download, download_link } } } ] } } }
 * The script takes `image.download_link` and falls back to `image.large`, STRIPS the query and the fragment (stores
 * scheme, host and path only, D-010), and records url, width, height and description to `src/data/images.json`.
 *
 * Blocked? On HTTP 403, or an answer that is not JSON (for example a challenge page), the script stops with a message
 * that points to OA-03 in plans/TODO-MANUAL-TESTING.md. It never retries, never bypasses.
 *
 *   npm run seed:images -- --dry-run      print the request, no network, nothing written
 *   npm run seed:images
 *
 * `npm run seed` uses the recorded file when present and otherwise seeds without images; running `seed` again after the
 * file exists adds the images to existing products and categories.
 */
export const OA03_MESSAGE =
  'The image source refused the request or did not answer with JSON (HTTP 403 or not JSON). The script does not try to get around it. ' +
  'See OA-03 in plans/TODO-MANUAL-TESTING.md: the owner provides an IMAGE_SOURCE_URL that answers, or the recorded file src/data/images.json.';

export class ImageSourceBlockedError extends Error {
  constructor(detail?: string) {
    super(detail ? `${detail}. ${OA03_MESSAGE}` : OA03_MESSAGE);
    this.name = 'ImageSourceBlockedError';
  }
}

export const FALLBACK_SIZE = { width: 1280, height: 853 };

/** `https://host/p/1.jpeg?auto=compress&w=1440#x` becomes `https://host/p/1.jpeg`. */
export function cleanUrl(raw: string): string {
  const url = new URL(raw);
  url.search = '';
  url.hash = '';
  return url.toString();
}

const asNumber = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : undefined);
const isHttpUrl = (x: unknown): x is string => {
  if (typeof x !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(x).protocol);
  } catch {
    return false;
  }
};

/** Reads `pageProps.initialData.data[]`: download_link first, large as the fallback; clean URLs, deduplicated, in the source's order. */
export function extractImages(response: unknown): RecordedImage[] {
  const data = (response as { pageProps?: { initialData?: { data?: unknown } } } | null)?.pageProps?.initialData?.data;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: RecordedImage[] = [];
  for (const item of data) {
    const attrs = (item as { attributes?: { width?: unknown; height?: unknown; description?: unknown; image?: Record<string, unknown> } } | null)?.attributes;
    const image = attrs?.image;
    const raw = [image?.download_link, image?.large].find(isHttpUrl);
    if (!raw) continue;
    const url = cleanUrl(raw);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      url, width: asNumber(attrs?.width) ?? FALLBACK_SIZE.width, height: asNumber(attrs?.height) ?? FALLBACK_SIZE.height,
      description: typeof attrs?.description === 'string' ? attrs.description : '',
    });
  }
  return out;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

/** One GET. Throws ImageSourceBlockedError on 403 or a non-JSON body; never retries or bypasses. */
export async function fetchImages(url: string, fetcher: FetchLike = fetch as unknown as FetchLike): Promise<RecordedImage[]> {
  const res = await fetcher(url, { headers: { accept: 'application/json', 'user-agent': 'malva-coffee-seed-images' } });
  const body = await res.text();
  if (res.status === 403) throw new ImageSourceBlockedError('HTTP 403');
  if (!res.ok) throw new Error(`The image source answered HTTP ${res.status}`);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ImageSourceBlockedError('The answer is not JSON');
  }
  const images = extractImages(json);
  if (images.length === 0) throw new Error('The image source answered JSON but no pageProps.initialData.data[].attributes.image.download_link was found (did the shape change?)');
  return images;
}

export interface RunOptions { url?: string; dryRun: boolean; fetcher?: FetchLike; dir?: string; log?: (line: string) => void }

export async function runImages(o: RunOptions): Promise<{ recorded: number; written: boolean }> {
  const log = o.log ?? console.log;
  if (!o.url) throw new Error('IMAGE_SOURCE_URL is not set. The owner provides it later, see OA-03 in plans/TODO-MANUAL-TESTING.md.');
  if (o.dryRun) {
    log(`would GET ${o.url} -> src/data/images.json`);
    log('dry run: no network, nothing written');
    return { recorded: 0, written: false };
  }
  const images = await fetchImages(o.url, o.fetcher);
  writeFileSync(path.join(o.dir ?? DATA_DIR, 'images.json'), `${JSON.stringify(images, null, 2)}\n`);
  for (const i of images) log(`recorded ${i.url} (${i.width}x${i.height})`);
  return { recorded: images.length, written: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // The images script needs no commercetools access; it only reads IMAGE_SOURCE_URL.
  loadDotenvFiles();
  // No commercetools access here, but if a project is configured the same guard applies.
  if (process.env.SEED_CTP_PROJECT_KEY) assertSafeProject(process.env.SEED_CTP_PROJECT_KEY, process.env.EXPECTED_PROJECT_KEY);
  const url = process.env.IMAGE_SOURCE_URL?.trim();
  const r = await runImages({ url, dryRun: args.dryRun });
  console.log(`${args.dryRun ? 'dry run: ' : ''}${r.recorded} image(s) recorded`);
}

if (isMainModule(import.meta.url)) main().catch(fail);
