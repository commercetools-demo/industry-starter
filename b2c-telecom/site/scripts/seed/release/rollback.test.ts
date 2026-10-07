// @vitest-environment node
import { applyRelease } from './apply';
import { buildCatalogIndex } from './catalogIndex';
import { NOW, exampleManifest, makeProject } from './fixture';
import { testDeps as deps } from './testDeps';
import { discountEffectiveAt } from './model';
import { buildRollbackManifest } from './plan';
import { purchasableAt } from './preview';
import { takeSnapshot } from './snapshot';
import { getRecord } from './store';
import type { ReleaseManifest } from './types';

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

describe('generated rollback', () => {
  it('the rollback manifest restores the snapshot when it is applied to the fake', async () => {
    const fake = await makeProject();
    const initialIndex = await buildCatalogIndex(fake);
    const rollbackAt = '2026-10-07T11:00:00Z';
    for (const manifest of [exampleManifest(), patchManifest()]) {
      const f = await makeProject();
      const snapshot = takeSnapshot(manifest, initialIndex);
      await applyRelease(manifest, deps(f));
      const rollback = buildRollbackManifest(manifest, snapshot, { releaseAt: rollbackAt });
      expect(rollback.rollbackOf).toBe(manifest.key);
      const outcome = await applyRelease(rollback, deps(f, { now: () => new Date(Date.parse(manifest.releaseAt) + 60 * 1000) }));
      expect(outcome.status).toBe('scheduled');
      const index = await buildCatalogIndex(f);
      const when = new Date(Date.parse(rollbackAt) + 1000);
      expect(purchasableAt(index, when)).toEqual(purchasableAt(initialIndex, NOW));
      expect(index.discounts.filter((d) => discountEffectiveAt(d, when)).map((d) => d.key)).toEqual(initialIndex.discounts.filter((d) => discountEffectiveAt(d, NOW)).map((d) => d.key));
      expect((await getRecord(f, rollback.key))?.rollbackOf).toBe(manifest.key);
    }
  });
});
