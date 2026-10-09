import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isCleanUrl } from './lib';

const urls = (file: string): string[] => [...readFileSync(new URL(`./data/${file}`, import.meta.url), 'utf8').matchAll(/"url":\s*"([^"]+)"/g)].map((m) => m[1]!);

describe('isCleanUrl', () => {
  it('accepts clean absolute URLs and rejects queries, fragments and relative paths', () => {
    expect(isCleanUrl('https://host/a/b.jpg')).toBe(true);
    expect(isCleanUrl('https://host/a/b.jpg?w=1')).toBe(false);
    expect(isCleanUrl('https://host/a/b.jpg#x')).toBe(false);
    expect(isCleanUrl('/a/b.jpg')).toBe(false);
    expect(isCleanUrl('https://host/a/b.jpg?')).toBe(false);
  });
});

describe('stored image data', () => {
  it.each(['product-images.json', 'site-images.json'])('%s holds only clean image URLs', (file) => {
    const list = urls(file);
    expect(list.length).toBeGreaterThan(0);
    expect(list.filter((u) => !isCleanUrl(u))).toEqual([]);
  });
});
