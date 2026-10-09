import { describe, expect, it } from 'vitest';
import { buildOffer } from './data/offers/helpers';
import { categoryAssets, getLock, lockImages, type Lock } from './images';
import { buildManifest } from './manifest';
import { FakeCt } from './test/fake-ct';
import { main as seed } from './seed';

const LOCK: Lock = { 'malva-offer-spotify': { images: [{ url: 'https://media.istockphoto.com/id/1/photo/a.jpg', dimensions: { w: 612, h: 408 } }] } };
const SPEC = { key: 'malva-offer-spotify', variants: [{ sku: 'MLV-ADD-SPOTIFY-MTH', values: {}, prices: [] }] };

describe('seeded images', () => {
  it('attaches the recorded images, identically on every build', () => {
    const a = buildOffer(SPEC, LOCK);
    expect(a).toEqual(buildOffer(SPEC, LOCK));
    expect(a.masterVariant.images?.map((i) => i.url)).toEqual(LOCK['malva-offer-spotify'].images.map((i) => i.url));
  });

  it('no lock entry: the product is seeded without an image, and the seed completes', async () => {
    expect(buildOffer(SPEC, {}).masterVariant.images).toBeUndefined();
    const api = new FakeCt();
    api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
    api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
    const code = await seed(['--confirm-project', 'spec-test-b2c-telecom', '--no-wait'], { api, source: { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' }, manifest: buildManifest(), log: () => undefined });
    expect(code).toBe(0);
    expect(api.list('products')).toHaveLength(52);
  });

  it('a lock entry on a foreign host is rejected before it reaches commercetools', () => {
    const lock: Lock = { k: { images: [{ url: 'https://evil.example/a.jpg', dimensions: { w: 1, h: 1 } }] } };
    expect(() => lockImages(lock, 'k')).toThrow(/rejected/);
    expect(() => categoryAssets(lock, 'k', { 'en-US': 'x', 'de-DE': 'y' })).toThrow(/rejected/);
  });

  it('the committed lock only holds allowed hosts and has an entry per offer and category', () => {
    const lock = getLock();
    expect(Object.keys(lock)).toHaveLength(35);
    for (const key of Object.keys(lock)) expect(() => lockImages(lock, key)).not.toThrow();
  });
});
