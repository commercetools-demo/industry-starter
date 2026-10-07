// @vitest-environment node
import { buildCatalogIndex } from './catalogIndex';
import { NOW, RELEASE_AT, exampleManifest, makeProject } from './fixture';
import { previewRelease, purchasableAt, renderPreview } from './preview';

describe('previewRelease', () => {
  it('Preview before approval: shows the campaign as customers would see it with zero writes', async () => {
    const fake = await makeProject();
    const index = await buildCatalogIndex(fake);
    fake.writes = 0;
    fake.log.length = 0;

    const preview = previewRelease(exampleManifest(), index, { now: NOW });
    const text = renderPreview(preview).join('\n');

    // at releaseAt the campaign is there, today's catalog still lacks it
    expect(preview.rows.map((r) => r.key)).toContain('malva-offer-phone-unlimited-summer');
    expect(preview.rows.find((r) => r.key === 'malva-offer-phone-unlimited-summer')).toMatchObject({ usd: 4000, eur: 4000, start: RELEASE_AT });
    expect(purchasableAt(index, NOW).map((r) => r.key)).not.toContain('malva-offer-phone-unlimited-summer');
    expect(preview.added).toEqual(['malva-offer-phone-unlimited-summer']);
    expect(preview.withdrawn).toEqual(['malva-offer-phone-online-only']);
    expect(preview.discountsAdded).toEqual(['malva-cd-rel-example-5-off']);
    expect(text).toContain('Summer campaign banner approved and deployed on Netlify');

    // preview rebuilt from a fresh read: still nothing in the project, and no write was made
    expect((await buildCatalogIndex(fake)).offers.map((o) => o.key)).not.toContain('malva-offer-phone-unlimited-summer');
    expect(fake.writes).toBe(0);
    expect(fake.log).toEqual([]);
  });

  it('shows the catalog at another instant (--at) and lists price changes and early-visible patches', async () => {
    const index = await buildCatalogIndex(await makeProject());
    const m = {
      ...exampleManifest(),
      createOffers: [],
      withdrawOffers: [],
      replaces: [],
      createCartDiscounts: [],
      patchOffers: [{ key: 'malva-offer-phone-essential', name: { 'en-US': 'Essential 2', 'de-DE': 'Essential 2' }, prices: [{ sku: 'MLV-PHN-ESS-M2M', prices: [{ currency: 'USD' as const, country: 'US', centAmount: 2300, recurrencePolicy: 'malva-monthly' }] }] }],
    };
    const before = previewRelease(m, index, { now: NOW, at: new Date(Date.parse(RELEASE_AT) - 1000) });
    expect(before.rows.find((r) => r.key === 'malva-offer-phone-essential')?.usd).toBe(2500);
    const after = previewRelease(m, index, { now: NOW });
    expect(after.rows.find((r) => r.key === 'malva-offer-phone-essential')?.usd).toBe(2300);
    expect(after.priceChanges).toEqual([{ key: 'malva-offer-phone-essential', field: 'usd', from: 2500, to: 2300 }]);
    expect(after.earlyVisible).toEqual(['malva-offer-phone-essential']);
  });
});
