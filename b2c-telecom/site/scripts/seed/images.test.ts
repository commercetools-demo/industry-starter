import { describe, expect, it, vi } from 'vitest';
import { IMAGE_TARGETS, OFFER_TERMS } from './data/image-terms';
import { buildOffer } from './data/offers/helpers';
import { addonOffers } from './data/offers/addons';
import { buildCategories } from './data/categories';
import { categoryAssets, cleanUrl, jpegSize, lockImages, pendingTargets, pickResults, refreshLock, type Lock, type RefreshDeps, type SearchResult } from './images';
import { main as updateImages } from './update-images';
import { buildManifest } from './manifest';
import { FakeCt } from './test/fake-ct';
import { main as seed } from './seed';

const hit = (id: string, host = 'media.istockphoto.com', extra: Record<string, unknown> = {}) => ({
  id,
  type: 'ad_medium',
  attributes: { id, url: `https://www.istockphoto.com/photo/${id}`, image: `https://${host}/id/${id}/photo/x.jpg?b=1&s=612x612&w=0&k=20&c=abc=`, ...extra },
});
const response = (n: number, extra: Record<string, unknown> = {}) => ({ data: Array.from({ length: n }, (_, i) => hit(String(100 + i), 'media.istockphoto.com', extra)) });

function deps(overrides: Partial<RefreshDeps> = {}): RefreshDeps & { search: ReturnType<typeof vi.fn> } {
  const search = vi.fn(async (): Promise<SearchResult> => ({ status: 200, body: response(6) }));
  return { search, measure: async () => ({ w: 612, h: 408 }), sleep: async () => undefined, ...overrides } as RefreshDeps & { search: ReturnType<typeof vi.fn> };
}

const TARGETS = [
  { key: 'malva-offer-a', term: 'term a' },
  { key: 'malva-offer-b', term: 'term b' },
  { key: 'malva-offer-c', term: 'term c' },
];

describe('seeded images', () => {
  it('First seed selects and records: one lookup per entry, first results in order, recorded in the lock file', async () => {
    const d = deps();
    const report = await refreshLock({}, TARGETS, d, { count: 2 });
    expect(d.search).toHaveBeenCalledTimes(3);
    expect(report.looked).toEqual(['malva-offer-a', 'malva-offer-b', 'malva-offer-c']);
    expect(report.lock['malva-offer-a']).toEqual({
      term: 'term a',
      images: [
        { url: 'https://media.istockphoto.com/id/100/photo/x.jpg', dimensions: { w: 612, h: 408 }, photographer: null, page: 'https://www.istockphoto.com/photo/100' },
        { url: 'https://media.istockphoto.com/id/101/photo/x.jpg', dimensions: { w: 612, h: 408 }, photographer: null, page: 'https://www.istockphoto.com/photo/101' },
      ],
    });
    expect(report.missing).toEqual([]);
    // the same response picks the same images again (never random)
    const again = await refreshLock({}, TARGETS, deps(), { count: 2 });
    expect(again.lock).toEqual(report.lock);
  });

  it('first results are distinct clean https URLs without the query string', () => {
    const picked = pickResults({ data: [hit('1'), hit('1'), hit('2')] }, 2);
    expect(picked.map((p) => p.url)).toEqual(['https://media.istockphoto.com/id/1/photo/x.jpg', 'https://media.istockphoto.com/id/2/photo/x.jpg']);
    expect(cleanUrl('https://a.example/b.jpg?s=1#x')).toBe('https://a.example/b.jpg');
    expect(pickResults({ data: [hit('9', 'images.pexels.com', { photographer: 'Ada Lovelace' })] }, 1)[0].photographer).toBe('Ada Lovelace');
    expect(pickResults(null, 2)).toEqual([]);
  });

  it('Re-seed uses the lock file: no network call and identical images', async () => {
    const first = await refreshLock({}, TARGETS, deps(), { count: 2 });
    const d = deps();
    const second = await refreshLock(first.lock, TARGETS, d, { count: 2 });
    expect(d.search).not.toHaveBeenCalled();
    expect(second.lock).toEqual(first.lock);
    // the manifest builders read only the lock: same images, with labels, on every variant
    const a = buildOffer({ key: 'malva-offer-spotify', variants: [{ sku: 'MLV-ADD-SPOTIFY-MTH', values: {}, prices: [] }] }, { 'malva-offer-spotify': first.lock['malva-offer-a'] });
    const b = buildOffer({ key: 'malva-offer-spotify', variants: [{ sku: 'MLV-ADD-SPOTIFY-MTH', values: {}, prices: [] }] }, { 'malva-offer-spotify': first.lock['malva-offer-a'] });
    expect(a).toEqual(b);
    expect(a.masterVariant.images?.map((i) => i.url)).toEqual(first.lock['malva-offer-a'].images.map((i) => i.url));
  });

  it('Photo replaced deliberately: changing the term or removing the entry re-selects only that entry', async () => {
    const first = await refreshLock({}, TARGETS, deps(), { count: 2 });
    // change one term
    const d1 = deps();
    const changed = await refreshLock(first.lock, [TARGETS[0], { key: 'malva-offer-b', term: 'other term' }, TARGETS[2]], d1, { count: 2 });
    expect(changed.looked).toEqual(['malva-offer-b']);
    expect(changed.lock['malva-offer-b'].term).toBe('other term');
    expect(changed.lock['malva-offer-a']).toEqual(first.lock['malva-offer-a']);
    // remove one entry
    const { 'malva-offer-c': _removed, ...rest } = first.lock;
    void _removed;
    const d2 = deps();
    const removed = await refreshLock(rest, TARGETS, d2, { count: 2 });
    expect(removed.looked).toEqual(['malva-offer-c']);
    expect(pendingTargets(rest, TARGETS).map((t) => t.key)).toEqual(['malva-offer-c']);
    // --only limits the run
    const only = await refreshLock({}, TARGETS, deps(), { only: 'malva-offer-b' });
    expect(only.looked).toEqual(['malva-offer-b']);
  });

  it('Rate limit approached: stops looking up, completes with the lock, reports entries without images, no retry loop', async () => {
    // HTTP 429 on the second lookup
    const search = vi.fn(async (term: string): Promise<SearchResult> => (term === 'term b' ? { status: 429 } : { status: 200, body: response(4) }));
    const limited = await refreshLock({}, TARGETS, { ...deps(), search }, { count: 2 });
    expect(search).toHaveBeenCalledTimes(2);
    expect(limited.stopped).toMatch(/HTTP 429/);
    expect(limited.missing).toEqual(['malva-offer-b', 'malva-offer-c']);
    expect(Object.keys(limited.lock)).toEqual(['malva-offer-a']);
    // a low remaining-requests header stops before the next lookup
    const lowHeader = vi.fn(async (): Promise<SearchResult> => ({ status: 200, remaining: 3, body: response(4) }));
    const low = await refreshLock({}, TARGETS, { ...deps(), search: lowHeader }, { count: 2 });
    expect(lowHeader).toHaveBeenCalledTimes(1);
    expect(low.stopped).toMatch(/rate limit/);
    expect(low.missing).toEqual(['malva-offer-b', 'malva-offer-c']);
    // --max-lookups
    const capped = await refreshLock({}, TARGETS, deps(), { maxLookups: 2 });
    expect(capped.looked).toHaveLength(2);
    expect(capped.stopped).toMatch(/max-lookups/);
    expect(capped.missing).toEqual(['malva-offer-c']);
  });

  it('No key and no lock entry: the product is seeded without an image and listed as missing', async () => {
    const offer = buildOffer({ key: 'malva-offer-spotify', variants: [{ sku: 'MLV-ADD-SPOTIFY-MTH', values: {}, prices: [] }] }, {});
    expect(offer.masterVariant.images).toBeUndefined();
    const report = await refreshLock({}, TARGETS, deps({ search: vi.fn(async () => ({ status: 401 })) }), { count: 2 });
    expect(report.missing).toEqual(['malva-offer-a', 'malva-offer-b', 'malva-offer-c']);
    // the seed itself completes without images
    const api = new FakeCt();
    api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
    api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
    const code = await seed(['--confirm-project', 'spec-test-b2c-telecom', '--no-wait'], { api, source: { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' }, manifest: buildManifest(), log: () => undefined });
    expect(code).toBe(0);
    expect(api.list('products')).toHaveLength(52);
  });

  it('a lock entry on a foreign host is rejected before it reaches commercetools', () => {
    const lock: Lock = { k: { term: 't', images: [{ url: 'https://evil.example/a.jpg', dimensions: { w: 1, h: 1 }, photographer: null }] } };
    expect(() => lockImages(lock, 'k')).toThrow(/rejected/);
    expect(() => categoryAssets(lock, 'k', { 'en-US': 'x', 'de-DE': 'y' })).toThrow(/rejected/);
    const foreign = { data: [{ attributes: { image: 'https://evil.example/a.jpg' } }] };
    return expect(refreshLock({}, [{ key: 'k', term: 't' }], deps({ search: vi.fn(async () => ({ status: 200, body: foreign })) }))).rejects.toThrow(/rejected/);
  });

  it('every offer and category has a term, the terms are generic and the lookups stay under the cap', () => {
    expect(Object.keys(OFFER_TERMS)).toHaveLength(27);
    expect(IMAGE_TARGETS).toHaveLength(35);
    expect(OFFER_TERMS['malva-offer-spotify']).toBe('music headphones');
    expect(OFFER_TERMS['malva-offer-cable-500']).toBe('cable internet router home');
    expect(new Set(IMAGE_TARGETS.map((t) => t.term)).size).toBeLessThan(40);
    const allCategoryKeys = buildCategories({}).map((c) => c.key);
    for (const key of allCategoryKeys) expect(IMAGE_TARGETS.some((t) => t.key === key)).toBe(true);
    expect(addonOffers.map((o) => o.key).every((k) => k in OFFER_TERMS)).toBe(true);
  });

  it('reads JPEG dimensions from the start-of-frame marker', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x98, 0x02, 0x64, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(jpegSize(jpeg)).toEqual({ h: 408, w: 612 });
    expect(jpegSize(Uint8Array.from([1, 2, 3]))).toBeNull();
  });

  it('seed:images --dry-run writes nothing and reports the hosts; a complete lock prints nothing to look up', async () => {
    const lines: string[] = [];
    const writes: string[] = [];
    const code = await updateImages(['--dry-run', '--only', 'malva-offer-spotify'], { deps: deps(), log: (l) => lines.push(l), file: '/nonexistent/lock.json', write: (f) => writes.push(f) });
    expect(code).toBe(0);
    expect(writes).toEqual([]);
    expect(lines.join('\n')).toMatch(/would set\s+malva-offer-spotify/);
    expect(lines.join('\n')).toMatch(/media\.istockphoto\.com \(2\)/);
    const written: string[] = [];
    await updateImages(['--only', 'malva-offer-spotify'], { deps: deps(), log: () => undefined, file: '/nonexistent/lock.json', write: (f, t) => written.push(`${f}:${t.length}`) });
    expect(written).toHaveLength(1);
    const complete = await refreshLock({}, IMAGE_TARGETS, deps(), { maxLookups: 100 });
    expect(pendingTargets(complete.lock, IMAGE_TARGETS)).toEqual([]);
  });
});
