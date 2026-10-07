import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ImageCredit {
  photographer: string;
  url: string;
}

/** The lock file written by the image seeder (D-055). */
export const IMAGE_LOCK_FILE = path.join('scripts', 'seed', 'data', 'product-images.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collect(node: unknown, out: ImageCredit[], depth = 0): void {
  if (depth > 6) return;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out, depth + 1);
    return;
  }
  if (!isRecord(node)) return;
  const name = typeof node.photographer === 'string' ? node.photographer.trim() : '';
  if (name) {
    const url = [node.photoUrl, node.page, node.url].find((v): v is string => typeof v === 'string' && v.startsWith('https://'));
    if (url) out.push({ photographer: name, url });
  }
  for (const value of Object.values(node)) collect(value, out, depth + 1);
}

/**
 * Photographers named in the seeded-image lock file, de-duplicated by name and sorted alphabetically.
 * Tolerant by design: a missing, unreadable or unexpected file gives an empty list (the page then shows only the generic text).
 */
export function getImageCredits(opts?: { file?: string }): ImageCredit[] {
  const file = opts?.file ?? path.join(process.cwd(), IMAGE_LOCK_FILE);
  try {
    if (!existsSync(file)) return [];
    const found: ImageCredit[] = [];
    collect(JSON.parse(readFileSync(file, 'utf8')) as unknown, found);
    const byName = new Map<string, ImageCredit>();
    for (const credit of found) if (!byName.has(credit.photographer)) byName.set(credit.photographer, credit);
    return [...byName.values()].sort((a, b) => a.photographer.localeCompare(b.photographer, 'en'));
  } catch {
    return [];
  }
}
