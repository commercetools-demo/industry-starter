// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BANNER_SLOTS, CATEGORY_IMAGE_QUERIES, TAILORINGS, tailoringImageKey } from './data/content';
import { systemKey } from './data/categories';
import { PARTS, partBySku, partKey } from './data/parts';
import { BUNDLES, LOCAL_PARTS, keyOfSku } from './data/items';
import { DATA_DIR, fail, isMainModule, parseArgs, sleep } from './lib';

/**
 * Records free stock photos for products, categories and banners. No browser, no cookie, no Cloudflare bypass.
 *
 * The request, exactly as the owner specified:
 *   GET https://www.pexels.com/_next/data/<buildId>/en-US/search/<query>.json?query=<query>
 * `<buildId>` is the Next.js build id of pexels.com (default below; override with PEXELS_BUILD_ID or --build-id, it
 * changes whenever pexels.com deploys, and a wrong one answers 404).
 *
 * Assumed (documented, NOT yet verified live) response shape, which the unit test fixture mirrors:
 *   { pageProps: { initialData: { data: [ { attributes: { width, height, image: { large, medium, small, download_link } } } ] } } }
 * `pickImages` reads exactly that, preferring large > medium > small > download_link; when it finds nothing it falls
 * back to a deep search for any string that looks like an images.pexels.com photo URL. Stored URLs are CLEAN (query and
 * fragment stripped). If the shape changed and nothing is found, the job fails loudly instead of recording junk.
 *
 * Blocked? From the build environment the live check answered HTTP 403 (Cloudflare). We do not work around it: the
 * script fails with a message that points to OA-03 in plans/TODO-MANUAL-TESTING.md (run it once from a machine that
 * can reach pexels.com, or have the owner supply the files).
 *
 *   npm run seed:images -- --dry-run                     print the requests, no network, nothing written
 *   npm run seed:images -- --only mau-part-mlv-bp-41001  one product, category or banner key
 *   npm run seed:images -- --count 3 --build-id <id>
 *
 * Output (merged into the existing files): src/data/product-images.json, category-images.json, banner-images.json.
 * `npm run seed` uses them when present and leaves images empty otherwise.
 */
export const DEFAULT_BUILD_ID = 'TSxLVMk9Ys4d-PNTCVPu-';
export const OA03_MESSAGE =
  'pexels.com refused the request (HTTP 403 / "Just a moment" challenge). This is the Cloudflare check; the script does not bypass it. ' +
  'See OA-03 in plans/TODO-MANUAL-TESTING.md: run `npm run seed:images` once from a machine that can reach pexels.com, or supply the recorded JSON files.';

export class PexelsBlockedError extends Error {
  constructor() {
    super(OA03_MESSAGE);
    this.name = 'PexelsBlockedError';
  }
}

export interface PickedImage { url: string; dimensions: { w: number; h: number } }
export const FALLBACK_SIZE = { w: 1280, h: 853 };

export function searchUrl(buildId: string, query: string): string {
  const q = encodeURIComponent(query);
  return `https://www.pexels.com/_next/data/${buildId}/en-US/search/${q}.json?query=${q}`;
}

/** `https://host/a/b.jpg?s=612&k=20` becomes `https://host/a/b.jpg`. */
export function cleanUrl(raw: string): string {
  const url = new URL(raw);
  url.search = '';
  url.hash = '';
  return url.toString();
}

const PHOTO_URL = /^https:\/\/images\.pexels\.com\/photos\/\d+\/[^?#\s]*\.(jpe?g|png|webp)(\?.*)?$/i;
const asNumber = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : undefined);

function documentedPicks(response: unknown): PickedImage[] {
  const data = ((response as { pageProps?: { initialData?: { data?: unknown } } } | null)?.pageProps?.initialData?.data ?? []) as unknown;
  if (!Array.isArray(data)) return [];
  const out: PickedImage[] = [];
  for (const item of data) {
    const attrs = (item as { attributes?: { width?: unknown; height?: unknown; image?: Record<string, unknown> } } | null)?.attributes;
    const img = attrs?.image;
    if (!img) continue;
    const url = (['large', 'medium', 'small', 'download_link'] as const).map((k) => img[k]).find((x): x is string => typeof x === 'string' && PHOTO_URL.test(x));
    if (!url) continue;
    out.push({ url: cleanUrl(url), dimensions: { w: asNumber(attrs?.width) ?? FALLBACK_SIZE.w, h: asNumber(attrs?.height) ?? FALLBACK_SIZE.h } });
  }
  return out;
}

function deepPicks(node: unknown, out: PickedImage[] = [], depth = 0): PickedImage[] {
  if (depth > 12) return out;
  if (typeof node === 'string') {
    if (PHOTO_URL.test(node)) out.push({ url: cleanUrl(node), dimensions: FALLBACK_SIZE });
  } else if (Array.isArray(node)) {
    for (const x of node) deepPicks(x, out, depth + 1);
  } else if (node && typeof node === 'object') {
    for (const x of Object.values(node as Record<string, unknown>)) deepPicks(x, out, depth + 1);
  }
  return out;
}

/** The first `count` distinct clean images of a search response (documented shape first, deep search as fallback). */
export function pickImages(response: unknown, count: number): PickedImage[] {
  const all = documentedPicks(response);
  const found = all.length > 0 ? all : deepPicks(response);
  const seen = new Set<string>();
  const out: PickedImage[] = [];
  for (const img of found) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);
    out.push(img);
    if (out.length === count) break;
  }
  return out;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

/** One search. Throws PexelsBlockedError on 403 or a Cloudflare challenge page; never retries or bypasses. */
export async function search(query: string, buildId: string, count: number, fetcher: FetchLike = fetch as unknown as FetchLike): Promise<PickedImage[]> {
  const res = await fetcher(searchUrl(buildId, query), { headers: { accept: 'application/json', 'user-agent': 'malva-seed-images' } });
  const body = await res.text();
  if (res.status === 403 || /just a moment/i.test(body.slice(0, 4000))) throw new PexelsBlockedError();
  if (!res.ok) throw new Error(`pexels search "${query}" failed with HTTP ${res.status}${res.status === 404 ? ' (is the build id current? set PEXELS_BUILD_ID or --build-id)' : ''}`);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`pexels search "${query}" did not return JSON`);
  }
  const picked = pickImages(json, count);
  if (picked.length === 0) throw new Error(`pexels search "${query}" returned no image URLs; the response shape may have changed (see the documented shape in src/images.ts)`);
  return picked;
}

export interface Job { file: string; key: string; query: string }

/** Search words: the English name before the first comma, without pack sizes, plus a hint that steers to car parts. */
export function queryFor(en: string): string {
  const base = (en.split(',')[0] ?? en).replace(/\b\d+([.,]\d+)?\s*(l|ml|ah|mm|v)\b/gi, '').replace(/\s+/g, ' ').trim();
  return `${base} car part`;
}

export function buildJobs(): Job[] {
  const jobs: Job[] = [
    ...PARTS.map((p) => ({ file: 'product-images.json', key: partKey(p.sku), query: queryFor(p.en) })),
    ...BUNDLES.map((b) => ({ file: 'product-images.json', key: keyOfSku(b.sku), query: queryFor(b.en) })),
    ...LOCAL_PARTS.map((l) => ({ file: 'product-images.json', key: keyOfSku(l.sku), query: queryFor(l.en) })),
    ...Object.entries(CATEGORY_IMAGE_QUERIES).map(([system, query]) => ({ file: 'category-images.json', key: systemKey(system), query })),
    ...TAILORINGS.filter((t) => (t.images ?? []).length > 0).map((t) => ({ file: 'tailoring-images.json', key: tailoringImageKey(t.store, t.sku), query: queryFor(partBySku(t.sku).en) })),
    ...BANNER_SLOTS.map((b) => ({ file: 'banner-images.json', key: b.key, query: b.query })),
  ];
  return jobs;
}

export function selectJobs(jobs: Job[], only?: string): Job[] {
  if (!only) return jobs;
  const wanted = only.split(',').map((x) => x.trim());
  const out = jobs.filter((j) => wanted.includes(j.key));
  if (out.length === 0) throw new Error(`No image slot with key "${only}"`);
  return out;
}

export interface RunOptions { dryRun: boolean; only?: string; count: number; buildId: string; fetcher?: FetchLike; dir?: string; delayMs?: number; log?: (line: string) => void }

export async function runImages(o: RunOptions): Promise<{ ok: number; failed: number; blocked: boolean }> {
  const log = o.log ?? console.log;
  const dir = o.dir ?? DATA_DIR;
  const jobs = selectJobs(buildJobs(), o.only);
  if (o.dryRun) {
    for (const j of jobs) log(`would GET ${searchUrl(o.buildId, j.query)}  -> ${j.file} [${j.key}] (${o.count} image(s))`);
    log(`dry run: ${jobs.length} request(s), no network, nothing written`);
    return { ok: 0, failed: 0, blocked: false };
  }
  const results: Record<string, Record<string, PickedImage[]>> = {};
  let ok = 0;
  let failed = 0;
  for (const j of jobs) {
    try {
      const images = await search(j.query, o.buildId, o.count, o.fetcher);
      (results[j.file] ??= {})[j.key] = images;
      ok += 1;
      log(`ok      ${j.key}  ("${j.query}")\n  ${images.map((i) => i.url).join('\n  ')}`);
    } catch (e) {
      if (e instanceof PexelsBlockedError) {
        // Stop at the first block: every further request would get the same answer. Keep what was already found.
        log(`BLOCKED ${j.key}: ${e.message}`);
        writeResults(dir, results);
        return { ok, failed: failed + 1, blocked: true };
      }
      failed += 1;
      log(`FAILED  ${j.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await sleep(o.delayMs ?? 400);
  }
  writeResults(dir, results);
  return { ok, failed, blocked: false };
}

function writeResults(dir: string, results: Record<string, Record<string, PickedImage[]>>): void {
  for (const [file, found] of Object.entries(results)) {
    if (Object.keys(found).length === 0) continue;
    const p = path.join(dir, file);
    const previous = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Record<string, PickedImage[]>) : {};
    writeFileSync(p, `${JSON.stringify({ ...previous, ...found }, null, 2)}\n`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const buildId = args.buildId ?? process.env.PEXELS_BUILD_ID ?? DEFAULT_BUILD_ID;
  const r = await runImages({ dryRun: args.dryRun, only: args.only, count: args.count, buildId });
  console.log(`${args.dryRun ? 'dry run: ' : ''}${r.ok} ok, ${r.failed} failed${r.blocked ? ' (blocked by pexels.com, see OA-03)' : ''}`);
  if (r.failed > 0) process.exit(1);
}

if (isMainModule(import.meta.url)) main().catch(fail);
