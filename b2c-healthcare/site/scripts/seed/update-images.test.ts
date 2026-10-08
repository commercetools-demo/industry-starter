import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCTORS, doctorDraft, doctorKey } from './data/doctors';
import { MEDICATIONS } from './data/medications';
import { SITE_SLOTS } from './data/site-slots';
import { createFakeRoot } from './fake-root';
import { makeCtx, runSteps } from './lib';
import { foundationSteps, doctorSteps } from './steps';
import { cleanUrl, jpegSize, parseArgs, pickPhotos, pickUrls, productTargets, searchTerm, updateImages, type Photo } from './update-images';

beforeEach(() => {
  // no test in this file may reach the network
  vi.stubGlobal('fetch', () => { throw new Error('network is forbidden in unit tests'); });
});
afterEach(() => vi.unstubAllGlobals());

describe('update-images pure helpers', () => {
  it('cleanUrl drops the query and fragment', () => {
    expect(cleanUrl('https://media.istockphoto.com/id/1/photo/a.jpg?b=1&s=612x612&w=0&k=20&c=x=#f')).toBe('https://media.istockphoto.com/id/1/photo/a.jpg');
    expect(cleanUrl('https://h/a.jpg')).toBe('https://h/a.jpg');
  });

  it('searchTerm drops strength, form and pack size', () => {
    expect(searchTerm('Amoxicillin 500 mg capsules')).toBe('Amoxicillin');
    expect(searchTerm('Amoxicillin-clavulanate 875/125 mg tablets')).toBe('Amoxicillin-clavulanate');
    expect(searchTerm('Alprazolam 0.5 mg tablets')).toBe('Alprazolam');
    expect(searchTerm('Whole milk 1 L')).toBe('Whole milk');
    expect(searchTerm('Vitamin D 30')).toBe('Vitamin D');
    expect(searchTerm('Dr. Amara Okafor')).toBe('Dr. Amara Okafor');
  });

  it('pickUrls takes the first distinct clean URLs (deduped after cleaning) and skips items without an image', () => {
    const item = (image?: string) => ({ attributes: { image } });
    const response = { data: [item(), item('https://h/a.jpg?s=1'), item('https://h/a.jpg?s=2'), item('https://h/b.jpg?s=1'), item('https://h/c.jpg')] };
    expect(pickUrls(response, 2)).toEqual(['https://h/a.jpg', 'https://h/b.jpg']);
    expect(pickUrls(response, 5)).toEqual(['https://h/a.jpg', 'https://h/b.jpg', 'https://h/c.jpg']);
    expect(pickUrls({}, 2)).toEqual([]);
    expect(pickUrls(null, 2)).toEqual([]);
    expect(pickUrls({ data: [item('not a url'), item('https://h/ok.jpg?x=1')] }, 2)).toEqual(['https://h/ok.jpg']);
  });

  it('pickPhotos records the photographer when the response provides one', () => {
    const response = { data: [{ attributes: { image: 'https://h/a.jpg?q=1', photographer: 'Ana' } }, { attributes: { image: 'https://h/b.jpg', user: { username: 'bo' } } }, { attributes: { image: 'https://h/c.jpg' } }] };
    expect(pickPhotos(response, 3)).toEqual([{ url: 'https://h/a.jpg', photographer: 'Ana' }, { url: 'https://h/b.jpg', photographer: 'bo' }, { url: 'https://h/c.jpg' }]);
  });

  it('jpegSize reads the start-of-frame marker', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, 0x01, 0x98, 0x02, 0x64, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(jpegSize(bytes)).toEqual({ w: 612, h: 408 });
    expect(jpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('parseArgs bounds the count to 1..6', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, only: undefined, count: 2 });
    expect(parseArgs(['--dry-run', '--only', 'mlv-doc-x', '--count', '3'])).toEqual({ dryRun: true, only: 'mlv-doc-x', count: 3 });
    expect(() => parseArgs(['--count', '0'])).toThrow();
    expect(() => parseArgs(['--count', '7'])).toThrow();
    expect(() => parseArgs(['--count', '1.5'])).toThrow();
  });

  it('targets cover every doctor and medication; slots are the banner slots of the plan', () => {
    const keys = productTargets().map((t) => t.key);
    expect(keys).toHaveLength(DOCTORS.length + MEDICATIONS.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SITE_SLOTS.map((s) => s.slot)).toEqual(['home-hero', 'home-cta', 'home-rx-delivery', 'journal-1', 'journal-2', 'journal-3']);
    expect(productTargets().find((t) => t.key === 'mlv-doc-amara-okafor')?.query).toMatch(/portrait/);
  });
});

describe('updateImages (mocked search, fake root)', () => {
  const search = (term: string, count: number): Promise<Photo[]> =>
    Promise.resolve(Array.from({ length: count }, (_, i) => ({ url: `https://images.example/${encodeURIComponent(term)}-${i}.jpg`, photographer: 'P' })));
  const measure = () => Promise.resolve({ w: 800, h: 600 });
  const base = { count: 2, search, measure, sleep: async () => {}, log: () => {}, pauseMs: 0 };

  it('replaces the images of a product, publishes it, and saves clean entries without touching the network', async () => {
    const fake = createFakeRoot();
    const ctx = { ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 };
    await runSteps(foundationSteps(ctx), () => {});
    await runSteps(doctorSteps(ctx, { images: { 'mlv-doc-amara-okafor': [{ url: 'https://old/x.jpg', dimensions: { w: 1, h: 1 } }] } }), () => {});
    const saved: Record<string, unknown> = {};
    const result = await updateImages({ ...base, root: fake.root, dryRun: false, only: 'mlv-doc-amara-okafor', save: (f, d) => { saved[f.split('/').pop() as string] = d; } });
    expect(result.failed).toBe(0);
    const product = fake.store.products.find((p) => p.key === 'mlv-doc-amara-okafor');
    const staged = (product?.masterData as { published: boolean; staged: { masterVariant: { images: { url: string }[] } } });
    expect(staged.staged.masterVariant.images.map((i) => i.url)).toEqual([
      'https://images.example/female%20doctor%20portrait-0.jpg',
      'https://images.example/female%20doctor%20portrait-1.jpg',
    ]);
    expect(staged.published).toBe(true);
    const stored = (saved['product-images.json'] as Record<string, { url: string }[]>)['mlv-doc-amara-okafor'];
    expect(stored.every((i) => !i.url.includes('?') && !i.url.includes('#'))).toBe(true);
    expect(Object.keys(saved)).toEqual(['product-images.json']);
  });

  it('dry run searches but writes nothing to commercetools or to disk', async () => {
    const saved: string[] = [];
    const result = await updateImages({ ...base, root: null, dryRun: true, save: (f) => saved.push(f) });
    expect(Object.keys(result.products)).toHaveLength(DOCTORS.length + MEDICATIONS.length);
    expect(Object.keys(result.slots)).toHaveLength(SITE_SLOTS.length);
    expect(saved).toEqual([]);
  });

  it('banner slots are saved one photo each, with the photographer', async () => {
    const saved: Record<string, Record<string, { url: string; photographer?: string }>> = {};
    await updateImages({ ...base, root: null, dryRun: false, only: 'home-hero', save: (f, d) => { saved[f.split('/').pop() as string] = d as never; } });
    expect(saved['site-images.json']['home-hero']).toEqual({ url: expect.stringContaining('https://images.example/'), photographer: 'P', dimensions: { w: 800, h: 600 } });
    expect(saved['product-images.json']).toBeUndefined();
  });

  it('merges with previous entries and counts failures', async () => {
    const saved: Record<string, Record<string, unknown>> = {};
    const failing = (term: string, count: number) => (term === 'home-cta' ? Promise.resolve([]) : search(term, count));
    const result = await updateImages({
      ...base, root: null, dryRun: false, only: 'home-cta', search: failing, load: () => ({ 'journal-1': { url: 'https://kept/a.jpg' } }),
      save: (f, d) => { saved[f] = d as never; },
    });
    expect(result.failed).toBe(0); // 'home-cta' is a slot key; its query is not "home-cta", so the mock succeeds
    const slotFile = Object.entries(saved).find(([f]) => f.endsWith('site-images.json'))?.[1];
    expect(Object.keys(slotFile ?? {})).toEqual(['home-cta', 'journal-1']);
    const failAll = await updateImages({ ...base, root: null, dryRun: true, only: 'home-cta', search: () => Promise.resolve([]), save: () => {} });
    expect(failAll.failed).toBe(1);
  });

  it('rejects an unknown --only key', async () => {
    await expect(updateImages({ ...base, root: null, dryRun: true, only: 'nope', save: () => {} })).rejects.toThrow(/No product or slot/);
  });

  it('the seeded draft carries the stored images', () => {
    const d = doctorDraft(DOCTORS[0], [{ url: 'https://h/a.jpg', dimensions: { w: 1, h: 1 } }]);
    expect(d.masterVariant.images[0].url).toBe('https://h/a.jpg');
    expect(doctorKey(DOCTORS[0])).toBe(d.key);
  });
});
