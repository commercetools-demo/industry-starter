import { describe, expect, it } from 'vitest';
import { MANIFEST } from '../data';
import { buildManifest } from '../manifest';
import { main as seedMain } from '../seed';
import { FakeCt } from '../test/fake-ct';
import { main as verify } from '../verify';
import { catalogChecks, catalogCounts, demoData, imageCoverage, offerPrices, offerReferences, searchFindsOffers, yearOneDiscounts } from './catalog';
import { platformChecks } from './platform';
import type { ProductDraft } from '../types';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };
const OFFER_KEYS = (MANIFEST.product as ProductDraft[]).filter((p) => p.productType === 'malva-offer').map((p) => p.key);

async function seeded(): Promise<FakeCt> {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
  const code = await seedMain(['--confirm-project', 'spec-test-b2c-telecom', '--no-wait'], { api, source: SOURCE, manifest: buildManifest(), log: () => undefined });
  expect(code).toBe(0);
  api.indexedKeys = OFFER_KEYS;
  return api;
}

describe('seed:verify catalog checks', () => {
  it('all catalog checks pass on the seeded fake and the demo check says nothing was seeded', async () => {
    const api = await seeded();
    for (const check of catalogChecks) {
      const result = await check.run(api, { projectKey: 'spec-test-b2c-telecom' });
      expect(result.ok, `${check.name}: ${result.detail ?? ''}`).toBe(true);
    }
    expect((await demoData.run(api, { projectKey: 'x' })).detail).toBe('demo data not seeded');
  });

  it('seed:verify runs the platform and catalog checks together and never writes', async () => {
    const api = await seeded();
    api.writes = 0;
    const lines: string[] = [];
    const code = await verify([], { api, source: SOURCE, log: (l) => lines.push(l) });
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('All checks passed.');
    expect(lines.length).toBe(platformChecks.length + catalogChecks.length + 1);
    expect(api.writes).toBe(0);
  });

  it('counts fail when a product is missing or unpublished', async () => {
    const api = await seeded();
    const first = api.list('products')[0] as { masterData: { published: boolean } };
    first.masterData.published = false;
    const unpublished = await catalogCounts.run(api, { projectKey: 'x' });
    expect(unpublished.ok).toBe(false);
    expect(unpublished.detail).toMatch(/unpublished products/);
    api.collections.set('products', api.list('products').slice(1));
    expect((await catalogCounts.run(api, { projectKey: 'x' })).detail).toMatch(/products: 51 \(expected 52\)/);
  });

  it('offer prices fail when a market price is missing or a recurring price lost its policy', async () => {
    const api = await seeded();
    const offer = api.byKey('products', 'malva-offer-cable-500') as unknown as { masterData: { staged: { masterVariant: { prices: { value: { currencyCode: string }; recurrencePolicy?: unknown }[] } } } };
    const prices = offer.masterData.staged.masterVariant.prices;
    delete prices.find((p) => p.value.currencyCode === 'USD' && p.recurrencePolicy)?.recurrencePolicy;
    const lostPolicy = await offerPrices.run(api, { projectKey: 'x' });
    expect(lostPolicy.ok).toBe(false);
    expect(lostPolicy.detail).toMatch(/has no recurrence policy/);
    offer.masterData.staged.masterVariant.prices = prices.filter((p) => p.value.currencyCode !== 'EUR');
    expect((await offerPrices.run(api, { projectKey: 'x' })).detail).toMatch(/no EUR\/DE price/);
  });

  it('references fail when a related offer is gone', async () => {
    const api = await seeded();
    api.collections.set(
      'products',
      api.list('products').filter((p) => p.key !== 'malva-offer-modem-docsis31'),
    );
    const result = await offerReferences.run(api, { projectKey: 'x' });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/included-offers -> malva-offer-modem-docsis31/);
  });

  it('year-1 discounts must equal the first price step', async () => {
    const api = await seeded();
    expect((await yearOneDiscounts.run(api, { projectKey: 'x' })).ok).toBe(true);
    const discount = api.byKey('cart-discounts', 'malva-cd-tier-year1-20') as unknown as { value: { permyriad: number } };
    discount.value.permyriad = 1000;
    expect((await yearOneDiscounts.run(api, { projectKey: 'x' })).detail).toMatch(/first step is 20 %/);
  });

  it('image coverage reports missing images and never fails', async () => {
    const api = await seeded();
    const result = await imageCoverage.run(api, { projectKey: 'x' });
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/\d+ without images|every offer and category has images/);
  });

  it('search check fails while the index is incomplete', async () => {
    const api = await seeded();
    api.indexedKeys = OFFER_KEYS.slice(0, 20);
    const result = await searchFindsOffers.run(api, { projectKey: 'x' });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/found 20 of 27/);
  });
});
