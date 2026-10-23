// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assignImages, loadRecordedImages, productImagesFor, tagOfDescription, type RecordedImage } from './data/catalog';
import { PRODUCTS } from './data/products';
import { FakeApi } from './fake-api';
import { ImageSourceBlockedError, OA03_MESSAGE, SEARCH_QUERIES, buildSearchUrl, cleanUrl, extractImages, fetchImages, runImages } from './images';
import { Runner, isCleanUrl } from './lib';
import { runSeed } from './seed';
import { verifySeed } from './verify';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/image-source.json', import.meta.url), 'utf8')) as unknown;
const reply = (status: number, body: string) => async () => ({ status, ok: status >= 200 && status < 300, text: async () => body });
const tmp = () => mkdtempSync(path.join(tmpdir(), 'seed-images-'));
const quiet = () => undefined;

describe('Images', () => {
  it('URL with query', () => {
    // An item whose image.large has a query and which has no download_link: the stored URL is clean.
    const item = { pageProps: { initialData: { data: [{ attributes: { width: 100, height: 50, description: 'x', image: { large: 'https://host/p/1.jpeg?auto=compress&w=1440' } } }] } } };
    expect(extractImages(item)[0]?.url).toBe('https://host/p/1.jpeg');
    expect(cleanUrl('https://host/p/1.jpeg?auto=compress&w=1440#frag')).toBe('https://host/p/1.jpeg');
    // and in the fixture: nothing recorded has a query or fragment
    for (const i of extractImages(fixture)) expect(isCleanUrl(i.url), i.url).toBe(true);
  });

  it('Blocked source', async () => {
    await expect(fetchImages('https://images.example.com/x.json', reply(403, 'Just a moment...'))).rejects.toThrow(ImageSourceBlockedError);
    await expect(fetchImages('https://images.example.com/x.json', reply(403, ''))).rejects.toThrow(/OA-03/);
    // a non-JSON answer (a challenge page) stops the same way
    await expect(fetchImages('https://images.example.com/x.json', reply(200, '<html>challenge</html>'))).rejects.toThrow(/OA-03/);
    expect(OA03_MESSAGE).toContain('plans/TODO-MANUAL-TESTING.md');
    // the script never retries: one request, nothing written
    let calls = 0;
    const dir = tmp();
    await expect(runImages({ url: 'https://images.example.com/x.json', dryRun: false, dir, fetcher: async () => { calls += 1; return { status: 403, ok: false, text: async () => '' }; }, log: quiet })).rejects.toThrow(/OA-03/);
    expect(calls).toBe(1);
    expect(loadRecordedImages(dir)).toEqual([]);
  });

  it('Later images', async () => {
    const api = new FakeApi();
    const base = { api, demoPassword: 'dummy-long-demo-password' };
    await runSeed({ ...base, run: new Runner(false, quiet) }); // seeded without images
    expect(JSON.stringify(api.all('products'))).not.toContain('images.example.com');
    expect(await runSeed({ ...base, run: new Runner(false, quiet) }).then((r) => r.changes)).toBe(0);

    // the image file is added and seed runs again
    const dir = tmp();
    await runImages({ url: 'https://images.example.com/x.json', dryRun: false, dir, fetcher: reply(200, JSON.stringify(fixture)), log: quiet });
    const recorded = loadRecordedImages(dir);
    expect(recorded.length).toBe(12); // 13 items, one duplicate
    const run = new Runner(false, quiet);
    const r = await runSeed({ ...base, run, recordedImages: recorded });
    expect(r.changes).toBeGreaterThan(0);
    // nothing else changes: every update line is a product with images or a category with assets
    expect(run.lines.every((l) => /^update (product mcf-p-[^ ]+ \(addExternalImage, publish\)|category mcf-cat-[^ ]+ \(addAsset\))$/.test(l)), run.lines.find((l) => !/addExternalImage|addAsset/.test(l))).toBe(true);
    expect(run.lines.filter((l) => l.startsWith('update product')).length).toBe(PRODUCTS.length);
    expect(run.lines.filter((l) => l.startsWith('update category')).length).toBe(20);
    expect(JSON.stringify(api.all('products'))).toContain('https://images.example.com/photos/');
    expect(JSON.stringify(api.all('products'))).not.toContain('?auto=compress');
    expect(await verifySeed(api)).toEqual([]);
    // and a third run changes nothing
    expect(await runSeed({ ...base, run: new Runner(false, quiet), recordedImages: recorded }).then((x) => x.changes)).toBe(0);
  });

  it('extracts download_link first, falls back to large, records width, height and description, drops duplicates', () => {
    const images = extractImages(fixture);
    expect(images).toHaveLength(12);
    expect(images[0]).toMatchObject({ url: 'https://images.example.com/photos/27860000/photo-27860000.jpeg', width: 2763, height: 3683 });
    expect(images[0]?.description).toContain('cappuccino');
    // item 11 has no download_link: large, query stripped
    expect(images[10]?.url).toBe('https://images.example.com/photos/27860010/photo-27860010.jpeg');
    expect(extractImages({})).toEqual([]);
    expect(extractImages({ pageProps: { initialData: { data: [{ attributes: { image: { download_link: 'javascript:alert(1)' } } }] } } })).toEqual([]);
  });

  it('a dry run sends no request and writes nothing', async () => {
    const dir = tmp();
    const lines: string[] = [];
    let calls = 0;
    await runImages({ url: 'https://images.example.com/x.json', dryRun: true, dir, fetcher: async () => { calls += 1; throw new Error('no'); }, log: (l) => lines.push(l) });
    expect(calls).toBe(0);
    expect(lines.join('\n')).toContain('would GET https://images.example.com/x.json');
    expect(loadRecordedImages(dir)).toEqual([]);
  });

  it('needs IMAGE_SOURCE_URL and sends no cookie or browser headers', async () => {
    await expect(runImages({ dryRun: false, log: quiet })).rejects.toThrow(/IMAGE_SOURCE_URL/);
    let headers: Record<string, string> = {};
    await fetchImages('https://images.example.com/x.json', async (_u, init) => { headers = init?.headers ?? {}; return { status: 200, ok: true, text: async () => JSON.stringify(fixture) }; });
    expect(Object.keys(headers).map((h) => h.toLowerCase()).sort()).toEqual(['accept', 'user-agent']);
  });

  it('assigns photos round-robin by tag and falls back to all photos for a tag without any', () => {
    expect(tagOfDescription('Colourful coffee capsules in a drawer')).toBe('capsule');
    expect(tagOfDescription('A silver espresso machine')).toBe('machine');
    expect(tagOfDescription('A white ceramic mug')).toBe('cup');
    expect(tagOfDescription('Roasted beans')).toBe('coffee');
    const recorded: RecordedImage[] = [
      { url: 'https://h/a.jpeg', width: 10, height: 10, description: 'capsule one' }, { url: 'https://h/b.jpeg', width: 10, height: 10, description: 'capsules two' },
    ];
    const map = assignImages(recorded, [{ key: 'p1', tag: 'capsule' }, { key: 'p2', tag: 'capsule' }, { key: 'p3', tag: 'capsule' }, { key: 'p4', tag: 'machine' }]);
    expect(map.p1?.[0]?.url).toBe('https://h/a.jpeg');
    expect(map.p2?.[0]?.url).toBe('https://h/b.jpeg');
    expect(map.p3?.[0]?.url).toBe('https://h/a.jpeg'); // wraps
    expect(map.p4?.[0]?.url).toBe('https://h/a.jpeg'); // no machine photo: all photos
    expect(assignImages([], [{ key: 'p', tag: 'coffee' }])).toEqual({});
    const all = productImagesFor(extractImages(fixture));
    expect(Object.keys(all)).toHaveLength(PRODUCTS.length);
  });

  it('fills every {query} of the template, one GET per tag, and keeps the tag of the search', async () => {
    const template = 'https://my-app-domain.com/search/{query}.json?query={query}';
    expect(buildSearchUrl(template, 'coffee capsules')).toBe('https://my-app-domain.com/search/coffee%20capsules.json?query=coffee%20capsules');
    const asked: string[] = [];
    const dir = tmp();
    const r = await runImages({ url: template, dryRun: false, dir, log: quiet, fetcher: async (u) => { asked.push(u); return { status: 200, ok: true, text: async () => JSON.stringify(fixture) }; } });
    expect(asked).toEqual(Object.values(SEARCH_QUERIES).map((t) => buildSearchUrl(template, t)));
    expect(r.recorded).toBe(12); // the same photos in every answer are recorded once, under the first tag
    expect(loadRecordedImages(dir).every((i) => i.tag === 'coffee')).toBe(true);
    // a recorded tag wins over the description
    const map = assignImages([{ url: 'https://h/a.jpeg', width: 1, height: 1, description: 'nothing', tag: 'cup' }, { url: 'https://h/b.jpeg', width: 1, height: 1, description: 'mug' }], [{ key: 'p', tag: 'cup' }]);
    expect(map.p?.[0]?.url).toBe('https://h/a.jpeg');
    const lines: string[] = [];
    await runImages({ url: template, dryRun: true, log: (l) => lines.push(l) });
    expect(lines.filter((l) => l.startsWith('would GET'))).toHaveLength(4);
  });
});
