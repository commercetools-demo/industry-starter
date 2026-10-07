// @vitest-environment node
import { buildCatalogIndex } from './catalogIndex';
import { RELEASE_AT, exampleManifest, makeProject } from './fixture';
import { applyToIndex, endTimeOf, startTimeOf } from './model';
import { buildRollbackManifest, describeChanges, planRelease } from './plan';
import { takeSnapshot } from './snapshot';
import type { ReleaseManifest, ReleaseSnapshot } from './types';

const patchManifest = (): ReleaseManifest => ({
  ...exampleManifest(),
  key: 'malva-rel-example-price-patch',
  createOffers: [],
  withdrawOffers: [],
  replaces: [],
  createCartDiscounts: [],
  externalChecklist: [],
  patchOffers: [{ key: 'malva-offer-phone-essential', prices: [{ sku: 'MLV-PHN-ESS-M2M', prices: [{ currency: 'USD', country: 'US', centAmount: 2300, recurrencePolicy: 'malva-monthly' }, { currency: 'EUR', country: 'DE', centAmount: 2300, recurrencePolicy: 'malva-monthly' }] }] }],
});

describe('planRelease', () => {
  it('orders the writes: cart discounts, created offers, patched, withdrawn, reinstated', () => {
    const m = { ...exampleManifest(), reinstateOffers: ['malva-offer-phone-essential'], withdrawCartDiscounts: ['malva-cd-second-line-10'] };
    expect(planRelease(m).map((s) => `${s.kind} ${s.key}`)).toEqual([
      'createDiscount malva-cd-rel-example-5-off',
      'withdrawDiscount malva-cd-second-line-10',
      'createOffer malva-offer-phone-unlimited-summer',
      'withdrawOffer malva-offer-phone-online-only',
      'reinstateOffer malva-offer-phone-essential',
    ]);
  });

  it('puts the release instant on every created or changed element', async () => {
    const index = await buildCatalogIndex(await makeProject());
    const m = { ...exampleManifest(), endsAt: '2026-10-08T10:30:00Z' };
    const after = applyToIndex(index, m);
    const created = after.offers.find((o) => o.key === 'malva-offer-phone-unlimited-summer');
    expect(created && startTimeOf(created)).toBe(RELEASE_AT);
    expect(created && endTimeOf(created)).toBe('2026-10-08T10:30:00Z');
    expect(created?.variants.flatMap((v) => v.prices).every((p) => p.validFrom === RELEASE_AT && p.validUntil === '2026-10-08T10:30:00Z')).toBe(true);
    const old = after.offers.find((o) => o.key === 'malva-offer-phone-online-only');
    expect(old && endTimeOf(old)).toBe(RELEASE_AT);
    expect(old?.variants.flatMap((v) => v.prices).every((p) => p.validUntil === RELEASE_AT)).toBe(true);
    const discount = after.discounts.find((d) => d.key === 'malva-cd-rel-example-5-off');
    expect(discount?.validFrom).toBe(RELEASE_AT);
  });

  it('a price patch closes the current price at releaseAt and opens the new one at releaseAt', async () => {
    const index = await buildCatalogIndex(await makeProject());
    const after = applyToIndex(index, patchManifest());
    const prices = after.offers.find((o) => o.key === 'malva-offer-phone-essential')?.variants[0].prices ?? [];
    expect(prices).toHaveLength(4);
    expect(prices.filter((p) => p.validUntil === RELEASE_AT).map((p) => p.centAmount)).toEqual([2500, 2500]);
    expect(prices.filter((p) => p.validFrom === RELEASE_AT).map((p) => p.centAmount)).toEqual([2300, 2300]);
    expect(new Set(prices.map((p) => p.key)).size).toBe(4);
    const changes = describeChanges(patchManifest(), index);
    expect(changes.filter((c) => c.resource === 'price').map((c) => [c.before, c.after])).toEqual([
      [2500, 2300],
      [2500, 2300],
    ]);
  });

  it('the snapshot holds the prices and times of what the release touches, and the keys it creates', async () => {
    const index = await buildCatalogIndex(await makeProject());
    const snapshot: ReleaseSnapshot = takeSnapshot(exampleManifest(), index);
    expect(snapshot.createdOffers).toEqual(['malva-offer-phone-unlimited-summer']);
    expect(snapshot.createdDiscounts).toEqual(['malva-cd-rel-example-5-off']);
    expect(Object.keys(snapshot.offers)).toEqual(['malva-offer-phone-online-only']);
    expect(snapshot.offers['malva-offer-phone-online-only'].variants[0].prices).toHaveLength(2);
  });

  it('a generated rollback inverts the manifest and revert the checklist', () => {
    const rollback = buildRollbackManifest(exampleManifest(), takeSnapshotStub(), { releaseAt: '2026-10-07T11:00:00Z', expediteReason: 'Wrong price published for the summer plan' });
    expect(rollback.withdrawOffers).toEqual(['malva-offer-phone-unlimited-summer']);
    expect(rollback.reinstateOffers).toEqual(['malva-offer-phone-online-only']);
    expect(rollback.withdrawCartDiscounts).toEqual(['malva-cd-rel-example-5-off']);
    expect(rollback.externalChecklist[0]).toMatch(/^Revert: /);
    expect(rollback.expedite?.reason).toContain('Wrong price');
    expect(rollback.key).toBe('malva-rel-example-summer-unlimited-rollback');
  });
});

function takeSnapshotStub(): ReleaseSnapshot {
  return { offers: {}, discounts: {}, createdOffers: [], createdDiscounts: [] };
}
