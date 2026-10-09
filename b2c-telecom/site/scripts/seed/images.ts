// Seeded imagery: the recorded image URLs (data/product-images.json), host checks and the drafts the manifest builders attach.
// `seed` never calls the network for images: it only reads the recorded file.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { assertAllowedImageHost } from '../../lib/config/images';
import type { LocalizedString } from './types';

export const LOCK_FILE = path.join(__dirname, 'data', 'product-images.json');
/** Alternative text of a seeded image. */
export const IMAGE_LABEL = 'Photo';

export interface LockImage {
  url: string;
  dimensions: { w: number; h: number };
}
export interface LockEntry {
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
    return { url: image.url, label: IMAGE_LABEL, dimensions: image.dimensions };
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
