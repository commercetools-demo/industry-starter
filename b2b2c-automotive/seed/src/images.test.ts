// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadImages } from './data/catalog';
import { DEFAULT_BUILD_ID, PexelsBlockedError, buildJobs, cleanUrl, pickImages, queryFor, runImages, search, searchUrl, selectJobs } from './images';
import { parseArgs } from './lib';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/pexels-search.json', import.meta.url), 'utf8')) as unknown;
const reply = (status: number, body: string) => async () => ({ status, ok: status >= 200 && status < 300, text: async () => body });
const tmp = () => mkdtempSync(path.join(tmpdir(), 'seed-images-'));
const quiet = () => undefined;

describe('request', () => {
  it('is exactly GET https://www.pexels.com/_next/data/<buildId>/en-US/search/<query>.json?query=<query>', () => {
    expect(searchUrl('BUILD123', 'brake pad')).toBe('https://www.pexels.com/_next/data/BUILD123/en-US/search/brake%20pad.json?query=brake%20pad');
    expect(DEFAULT_BUILD_ID).toBe('TSxLVMk9Ys4d-PNTCVPu-');
  });

  it('sends no cookie or browser headers', async () => {
    let seen: { url?: string; headers?: Record<string, string> } = {};
    await search('brake pad', 'B', 2, async (url, init) => { seen = { url, headers: init?.headers }; return { status: 200, ok: true, text: async () => JSON.stringify(fixture) }; });
    expect(seen.url).toBe(searchUrl('B', 'brake pad'));
    expect(Object.keys(seen.headers ?? {}).map((h) => h.toLowerCase()).sort()).toEqual(['accept', 'user-agent']);
  });

  it('takes the build id from --build-id', () => {
    expect(parseArgs(['--build-id', 'abc', '--count', '3', '--only', 'x', '--dry-run'])).toMatchObject({ buildId: 'abc', count: 3, only: 'x', dryRun: true });
    expect(() => parseArgs(['--count', '9'])).toThrow(/--count/);
  });
});

describe('pickImages (documented shape, fixture)', () => {
  it('prefers large over medium over small, strips query and fragment, dedupes and ignores non-pexels hosts', () => {
    const picked = pickImages(fixture, 5);
    expect(picked.map((p) => p.url)).toEqual([
      'https://images.pexels.com/photos/1001/pexels-photo-1001.jpeg',
      'https://images.pexels.com/photos/1002/pexels-photo-1002.jpeg',
      'https://images.pexels.com/photos/1003/pexels-photo-1003.jpeg',
    ]);
    expect(picked[0]?.dimensions).toEqual({ w: 4000, h: 2667 });
    expect(picked[2]?.dimensions).toEqual({ w: 1280, h: 853 }); // no width/height in the response: fallback
  });

  it('honours count', () => {
    expect(pickImages(fixture, 2)).toHaveLength(2);
  });

  it('falls back to a deep search when the shape differs', () => {
    const other = { a: { b: [{ src: { large: 'https://images.pexels.com/photos/77/pexels-photo-77.jpeg?w=1#x' } }, 'https://example.com/x.jpg'] } };
    expect(pickImages(other, 3).map((p) => p.url)).toEqual(['https://images.pexels.com/photos/77/pexels-photo-77.jpeg']);
    expect(pickImages({ nothing: true }, 3)).toEqual([]);
  });

  it('cleanUrl removes query and hash', () => {
    expect(cleanUrl('https://h/a.jpg?x=1#y')).toBe('https://h/a.jpg');
  });
});

describe('blocked or broken answers', () => {
  it('HTTP 403 fails with a message that names OA-03', async () => {
    await expect(search('q', 'B', 2, reply(403, '<html>Forbidden</html>'))).rejects.toThrow(/OA-03 in plans\/TODO-MANUAL-TESTING\.md/);
    await expect(search('q', 'B', 2, reply(403, ''))).rejects.toBeInstanceOf(PexelsBlockedError);
  });

  it('a "Just a moment" Cloudflare page is a block even with HTTP 200', async () => {
    await expect(search('q', 'B', 2, reply(200, '<!DOCTYPE html><title>Just a moment...</title>'))).rejects.toThrow(/OA-03/);
  });

  it('404 hints at the build id; an unknown shape fails instead of recording junk', async () => {
    await expect(search('q', 'B', 2, reply(404, 'nope'))).rejects.toThrow(/build id/);
    await expect(search('q', 'B', 2, reply(200, '{"pageProps":{}}'))).rejects.toThrow(/no image URLs/);
    await expect(search('q', 'B', 2, reply(200, 'not json'))).rejects.toThrow(/did not return JSON/);
  });
});

describe('runImages', () => {
  it('--dry-run prints the plan, uses no network and writes nothing', async () => {
    const dir = tmp();
    const lines: string[] = [];
    const r = await runImages({ dryRun: true, count: 2, buildId: 'B', dir, log: (l) => lines.push(l), fetcher: async () => { throw new Error('network used'); } });
    expect(r).toEqual({ ok: 0, failed: 0, blocked: false });
    expect(lines.length).toBe(buildJobs().length + 1);
    expect(lines[0]).toContain('would GET https://www.pexels.com/_next/data/B/en-US/search/');
    expect(loadImages('product-images.json', dir)).toEqual({});
  });

  it('--only limits to one key and rejects an unknown one', () => {
    expect(selectJobs(buildJobs(), 'mau-part-mlv-bp-41001')).toHaveLength(1);
    expect(() => selectJobs(buildJobs(), 'nope')).toThrow(/No image slot/);
  });

  it('records clean URLs into product, category and banner files, merging with what exists', async () => {
    const dir = tmp();
    writeFileSync(path.join(dir, 'product-images.json'), JSON.stringify({ 'mau-part-old': [{ url: 'https://images.pexels.com/photos/5/pexels-photo-5.jpeg', dimensions: { w: 1, h: 1 } }] }));
    const r = await runImages({ dryRun: false, count: 2, buildId: 'B', dir, delayMs: 0, log: quiet, fetcher: reply(200, JSON.stringify(fixture)) });
    expect(r.failed).toBe(0);
    const products = loadImages('product-images.json', dir);
    expect(Object.keys(products)).toContain('mau-part-old');
    expect(products['mau-part-mlv-bp-41001']).toHaveLength(2);
    expect(Object.keys(loadImages('category-images.json', dir))).toContain('mau-cat-brakes');
    expect(Object.keys(loadImages('banner-images.json', dir))).toContain('home-hero');
    const all = ['product-images.json', 'category-images.json', 'banner-images.json'].flatMap((f) => [...readFileSync(path.join(dir, f), 'utf8').matchAll(/"url":\s*"([^"]+)"/g)].map((m) => m[1]!));
    expect(all.length).toBeGreaterThan(50);
    expect(all.every((u) => !u.includes('?') && !u.includes('#'))).toBe(true);
  });

  it('stops at the first block, reports it, and keeps what was already found', async () => {
    const dir = tmp();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return calls <= 2 ? { status: 200, ok: true, text: async () => JSON.stringify(fixture) } : { status: 403, ok: false, text: async () => 'blocked' };
    };
    const lines: string[] = [];
    const r = await runImages({ dryRun: false, count: 1, buildId: 'B', dir, delayMs: 0, log: (l) => lines.push(l), fetcher });
    expect(r.blocked).toBe(true);
    expect(calls).toBe(3);
    expect(Object.keys(loadImages('product-images.json', dir))).toHaveLength(2);
    expect(lines.join('\n')).toMatch(/OA-03/);
  });

  it('builds queries without pack sizes and with a car-part hint', () => {
    expect(queryFor('Engine oil 5W-30, 5 l')).toBe('Engine oil 5W-30 car part');
    expect(queryFor('Front brake pad set, ceramic')).toBe('Front brake pad set car part');
  });

  it('seed reads no images when the file is missing', () => {
    expect(loadImages('product-images.json', tmp())).toEqual({});
  });
});
