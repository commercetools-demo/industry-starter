// Seeded imagery (D-055): the lock file, host checks, picking from a search response and the refresh loop.
// `seed` never calls the network for images: it only reads the lock. `update-images.ts` refreshes the lock.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { assertAllowedImageHost, imageLabel } from '../../lib/config/images';
import type { LocalizedString } from './types';

export const LOCK_FILE = path.join(__dirname, 'data', 'product-images.json');
export const FALLBACK_SIZE = { w: 612, h: 408 };
export const DEFAULT_COUNT = 2;
export const DEFAULT_MAX_LOOKUPS = 40;
export const LOOKUP_PAUSE_MS = 400;
/** Stop looking up when the (optional) remaining-requests header drops below this. */
export const LOW_REMAINING = 5;
/** HTTP statuses that end the run of lookups (rate limited, forbidden, or the endpoint changed). */
const STOP_STATUSES = [401, 403, 429];

export interface LockImage {
  url: string;
  dimensions: { w: number; h: number };
  photographer: string | null;
  /** Page of the photo at its provider (read from the response; informational). */
  page?: string;
}
export interface LockEntry {
  term: string;
  images: LockImage[];
}
export type Lock = Record<string, LockEntry>;

export function readLock(file: string = LOCK_FILE): Lock {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8')) as Lock;
}

let cached: Lock | undefined;
/** The committed lock (read once per process). */
export function getLock(): Lock {
  cached ??= readLock();
  return cached;
}

/** `https://host/a/b.jpg?s=612&k=20` becomes `https://host/a/b.jpg`. */
export function cleanUrl(raw: string): string {
  const url = new URL(raw);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export interface ImageDraft {
  url: string;
  label: string;
  dimensions: { w: number; h: number };
}

/** Images of an offer or category from the lock; every URL passes the host allow-list. Empty when the key has no entry. */
export function lockImages(lock: Lock, key: string): ImageDraft[] {
  const entry = lock[key];
  if (!entry) return [];
  return entry.images.map((image) => {
    assertAllowedImageHost(image.url);
    return { url: image.url, label: imageLabel(image.photographer), dimensions: image.dimensions };
  });
}

/** Category asset (one per image), keyed `<category key>-image-<n>`. */
export function categoryAssets(
  lock: Lock,
  key: string,
  name: LocalizedString,
): { key: string; name: LocalizedString; sources: { uri: string; dimensions: { w: number; h: number } }[] }[] {
  return lockImages(lock, key).map((image, index) => ({
    key: `${key}-image-${index + 1}`,
    name,
    sources: [{ uri: image.url, dimensions: image.dimensions }],
  }));
}

export interface Picked {
  url: string;
  photographer: string | null;
  page?: string;
}

type Hit = { attributes?: { image?: unknown; url?: unknown; photographer?: unknown; user?: unknown; author?: unknown } };

function photographerOf(attributes: NonNullable<Hit['attributes']>): string | null {
  for (const candidate of [attributes.photographer, attributes.author, (attributes.user as { name?: unknown } | undefined)?.name, attributes.user]) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim();
  }
  return null;
}

/** The first `count` distinct clean https URLs of a search response, in response order (never random). */
export function pickResults(response: unknown, count: number): Picked[] {
  const data = (response as { data?: Hit[] } | null)?.data ?? [];
  const picked: Picked[] = [];
  for (const item of data) {
    const attributes = item.attributes;
    if (!attributes || typeof attributes.image !== 'string') continue;
    const url = cleanUrl(attributes.image);
    if (picked.some((p) => p.url === url)) continue;
    picked.push({ url, photographer: photographerOf(attributes), ...(typeof attributes.url === 'string' ? { page: attributes.url } : {}) });
    if (picked.length === count) break;
  }
  return picked;
}

/** Width and height from the first JPEG start-of-frame marker; null when the bytes are not a readable JPEG. */
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

export interface SearchResult {
  status: number;
  /** Value of an `x-ratelimit-remaining` header when the endpoint sends one. */
  remaining?: number;
  body?: unknown;
}

export interface RefreshDeps {
  search(term: string, count: number): Promise<SearchResult>;
  measure(url: string): Promise<{ w: number; h: number }>;
  sleep(ms: number): Promise<void>;
}

export interface Target {
  key: string;
  term: string;
}

export interface RefreshOptions {
  count?: number;
  maxLookups?: number;
  only?: string;
}

export interface RefreshReport {
  lock: Lock;
  /** Keys that were looked up (one network call each, unless the term was already looked up in this run). */
  looked: string[];
  /** Targets without images after the run. */
  missing: string[];
  stopped?: string;
  errors: string[];
}

/**
 * Looks up only the targets that have no lock entry, or whose search term changed ("Photo replaced deliberately").
 * Stops on HTTP 401/403/429, on a low remaining-requests header, or after `maxLookups`; never retries in a loop.
 */
export async function refreshLock(lock: Lock, targets: Target[], deps: RefreshDeps, options: RefreshOptions = {}): Promise<RefreshReport> {
  const count = options.count ?? DEFAULT_COUNT;
  const maxLookups = options.maxLookups ?? DEFAULT_MAX_LOOKUPS;
  const next: Lock = { ...lock };
  const looked: string[] = [];
  const errors: string[] = [];
  const byTerm = new Map<string, Picked[]>();
  let stopped: string | undefined;
  let calls = 0;
  let remaining: number | undefined;
  for (const target of targets) {
    if (options.only && target.key !== options.only) continue;
    const entry = next[target.key];
    if (entry && entry.term === target.term && entry.images.length > 0) continue;
    if (stopped) continue;
    let picked = byTerm.get(target.term);
    if (!picked) {
      if (calls >= maxLookups) {
        stopped = `reached --max-lookups ${maxLookups}`;
        continue;
      }
      if (remaining !== undefined && remaining < LOW_REMAINING) {
        stopped = `rate limit nearly used up (${remaining} left)`;
        continue;
      }
      if (calls > 0) await deps.sleep(LOOKUP_PAUSE_MS);
      calls += 1;
      const result = await deps.search(target.term, count + 2);
      looked.push(target.key);
      remaining = result.remaining ?? remaining;
      if (STOP_STATUSES.includes(result.status)) {
        stopped = `HTTP ${result.status} from the image search`;
        continue;
      }
      if (result.status < 200 || result.status >= 300) {
        errors.push(`${target.key}: HTTP ${result.status}`);
        continue;
      }
      picked = pickResults(result.body, count);
      byTerm.set(target.term, picked);
    }
    if (picked.length === 0) {
      errors.push(`${target.key}: no results for "${target.term}"`);
      continue;
    }
    const images: LockImage[] = [];
    for (const p of picked) {
      assertAllowedImageHost(p.url);
      images.push({ url: p.url, dimensions: await deps.measure(p.url).catch(() => FALLBACK_SIZE), photographer: p.photographer, ...(p.page ? { page: p.page } : {}) });
    }
    next[target.key] = { term: target.term, images };
  }
  const missing = targets.filter((t) => (next[t.key]?.images.length ?? 0) === 0).map((t) => t.key);
  return { lock: next, looked, missing, ...(stopped ? { stopped } : {}), errors };
}

/** Keys of `targets` whose lock entry is absent or stale (the keys a run would look up). */
export function pendingTargets(lock: Lock, targets: Target[]): Target[] {
  return targets.filter((t) => {
    const entry = lock[t.key];
    return !(entry && entry.term === t.term && entry.images.length > 0);
  });
}
