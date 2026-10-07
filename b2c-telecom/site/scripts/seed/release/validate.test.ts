// @vitest-environment node
import { buildCatalogIndex } from './catalogIndex';
import { NOW, RELEASE_AT, exampleManifest, makeProject } from './fixture';
import { applyToIndex, endTimeOf, startTimeOf } from './model';
import type { CatalogIndex, ReleaseManifest } from './types';
import { errorsOf, validateRelease } from './validate';

let index: CatalogIndex;

beforeAll(async () => {
  index = await buildCatalogIndex(await makeProject());
});

const codes = (manifest: ReleaseManifest, opts: { scheduled?: boolean } = {}): string[] => validateRelease(manifest, index, { now: NOW, ...opts }).filter((i) => i.severity === 'error').map((i) => `${i.code} ${i.key}`);

function clone(): ReleaseManifest {
  return JSON.parse(JSON.stringify(exampleManifest())) as ReleaseManifest;
}

describe('validateRelease', () => {
  it('accepts the summer example on the fixture project', () => {
    expect(validateRelease(exampleManifest(), index, { now: NOW })).toEqual([]);
  });

  it('DANGLING_KEY names the missing key (offer, discount, anchor, category, tax, recurrence policy, relation)', () => {
    const m = clone();
    m.withdrawOffers.push('malva-offer-nope');
    m.withdrawCartDiscounts.push('malva-cd-nope');
    const offer = m.createOffers[0];
    offer.categories = ['malva-cat-nope'];
    offer.taxCategory = 'malva-tax-nope';
    offer.masterVariant.attributes = offer.masterVariant.attributes.filter((a) => a.name !== 'anchors');
    offer.masterVariant.attributes.push({ name: 'anchors', value: ['malva-phone-nope'] }, { name: 'conflicts-with', value: ['malva-offer-ghost'] });
    offer.masterVariant.prices[0].recurrencePolicy = 'malva-policy-nope';
    const found = codes(m);
    for (const expected of ['malva-offer-nope', 'malva-cd-nope', 'malva-cat-nope', 'malva-tax-nope', 'malva-phone-nope', 'malva-offer-ghost', 'malva-policy-nope']) {
      expect(found).toContain(`DANGLING_KEY ${expected}`);
    }
  });

  it('CONFLICT: a conflicts-with that is not symmetric fails', () => {
    const m = clone();
    m.createOffers[0].masterVariant.attributes.push({ name: 'conflicts-with', value: ['malva-offer-phone-essential'] });
    expect(codes(m)).toContain('CONFLICT malva-offer-phone-unlimited-summer');
  });

  it('CONFLICT: an offer may not list the same key as included and conflicting', () => {
    const m = clone();
    m.createOffers[0].masterVariant.attributes.push({ name: 'conflicts-with', value: ['malva-offer-spotify'] });
    expect(codes(m)).toContain('CONFLICT malva-offer-phone-unlimited-summer');
  });

  it('CONFLICT: an included extra may not vanish (withdrawn offer listed by another offer, no replacement)', () => {
    const m = clone();
    m.withdrawOffers = ['malva-offer-spotify'];
    m.replaces = [];
    expect(codes(m)).toContain('CONFLICT malva-offer-phone-online-only');
    expect(codes(m)).toContain('CONFLICT malva-offer-phone-unlimited-summer');
  });

  it('Replaced offer withdrawn in step: the old offer ends at the instant its successor starts', () => {
    const m = exampleManifest();
    expect(codes(m)).toEqual([]);
    const after = applyToIndex(index, m);
    const old = after.offers.find((o) => o.key === 'malva-offer-phone-online-only');
    const next = after.offers.find((o) => o.key === 'malva-offer-phone-unlimited-summer');
    expect(old && endTimeOf(old)).toBe(RELEASE_AT);
    expect(next && startTimeOf(next)).toBe(RELEASE_AT);

    const different = clone();
    different.createOffers[0].masterVariant.attributes.push({ name: 'start-time', value: '2026-10-07T11:00:00Z' });
    expect(codes(different)).toContain('REPLACES_MISMATCH malva-offer-phone-unlimited-summer');

    const unpaired = clone();
    unpaired.withdrawOffers = [];
    expect(codes(unpaired)).toContain('REPLACES_MISMATCH malva-offer-phone-online-only');
  });

  it('duplicates: SKU, price key and product key', () => {
    const m = clone();
    m.createOffers[0].masterVariant.sku = 'MLV-PHN-ESS-M2M';
    m.createOffers[0].masterVariant.prices[1].key = m.createOffers[0].masterVariant.prices[0].key;
    const found = codes(m);
    expect(found).toContain('DUPLICATE_SKU MLV-PHN-ESS-M2M');
    expect(found).toContain('DUPLICATE_PRICE_KEY mlv-phn-unl-summer-m2m_usd_malva-monthly');
    const again = clone();
    again.createOffers[0].key = 'malva-offer-phone-essential';
    expect(codes(again)).toContain('DUPLICATE_KEY malva-offer-phone-essential');
  });

  it('MISSING_LOCALE and MISSING_PRICE', () => {
    const m = clone();
    delete m.createOffers[0].name['de-DE'];
    m.createOffers[0].masterVariant.prices = m.createOffers[0].masterVariant.prices.slice(0, 1);
    const found = codes(m);
    expect(found).toContain('MISSING_LOCALE malva-offer-phone-unlimited-summer');
    expect(found).toContain('MISSING_PRICE MLV-PHN-UNL-SUMMER-M2M');
  });

  it('a recurring variant needs a price tied to a recurrence policy', () => {
    const m = clone();
    for (const p of m.createOffers[0].masterVariant.prices) delete p.recurrencePolicy;
    expect(codes(m)).toContain('MISSING_PRICE MLV-PHN-UNL-SUMMER-M2M');
  });

  it('PRICE_NOT_POSITIVE', () => {
    const m = clone();
    m.createOffers[0].masterVariant.prices[0].value.centAmount = 0;
    expect(codes(m)).toContain('PRICE_NOT_POSITIVE MLV-PHN-UNL-SUMMER-M2M');
  });

  it('SORT_ORDER_USED names the discount that holds it', () => {
    const m = clone();
    m.createCartDiscounts[0].sortOrder = '0.1';
    const issue = validateRelease(m, index, { now: NOW }).find((i) => i.code === 'SORT_ORDER_USED');
    expect(issue?.message).toContain('malva-cd-second-line-10');
  });

  it('TIME: past instant, more than 90 days ahead, endsAt not after releaseAt', () => {
    const past = clone();
    past.releaseAt = '2026-10-07T09:00:00Z';
    expect(codes(past)).toContain('TIME malva-rel-example-summer-unlimited');
    const far = clone();
    far.releaseAt = '2027-02-01T09:00:00Z';
    expect(validateRelease(far, index, { now: NOW }).some((i) => i.code === 'TIME' && i.message.includes('90 days'))).toBe(true);
    const ends = clone();
    ends.endsAt = ends.releaseAt;
    expect(validateRelease(ends, index, { now: NOW }).some((i) => i.code === 'TIME' && i.message.includes('endsAt'))).toBe(true);
  });

  it('TIME: an offer that starts after the release cannot be changed by it', async () => {
    const fake = await makeProject();
    const later = new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString();
    await fake.post('products/key=malva-offer-phone-essential', { version: (fake.byKey('products', 'malva-offer-phone-essential') as { version: number }).version, actions: [{ action: 'setAttributeInAllVariants', name: 'start-time', value: later }, { action: 'publish' }] });
    const withStart = await buildCatalogIndex(fake);
    const m = clone();
    m.withdrawOffers.push('malva-offer-phone-essential');
    expect(validateRelease(m, withStart, { now: NOW }).some((i) => i.code === 'TIME' && i.key === 'malva-offer-phone-essential')).toBe(true);
  });

  it('FORBIDDEN_RESOURCE: a release creates offers only', () => {
    const m = clone();
    m.createOffers[0].productType = 'malva-phone-plan';
    expect(codes(m)).toContain('FORBIDDEN_RESOURCE malva-offer-phone-unlimited-summer');
  });

  it('PREDICATE_ATTRIBUTE: a discount predicate may read line item attributes only', () => {
    const m = clone();
    m.createCartDiscounts[0].target = { type: 'lineItems', predicate: 'attributes.`data-gb` = -1 and attributes.`offer-family` = "phone"' };
    expect(codes(m)).toContain('PREDICATE_ATTRIBUTE malva-cd-rel-example-5-off');
    const ok = clone();
    ok.createCartDiscounts[0].cartPredicate = 'lineItemExists(attributes.`offer-kind` = "base-package") = true';
    expect(codes(ok)).toEqual([]);
  });

  it('a patch warns EARLY_VISIBLE_PATCH and checks the prices it leaves in effect', () => {
    const m = clone();
    m.patchOffers = [{ key: 'malva-offer-phone-essential', name: { 'en-US': 'Essential', 'de-DE': 'Essential' }, prices: [{ sku: 'MLV-PHN-ESS-M2M', prices: [{ currency: 'USD', country: 'US', centAmount: 2300, recurrencePolicy: 'malva-monthly' }] }] }];
    const issues = validateRelease(m, index, { now: NOW });
    expect(issues.some((i) => i.code === 'EARLY_VISIBLE_PATCH')).toBe(true);
    expect(errorsOf(issues)).toEqual([]);
    m.patchOffers[0].prices = [{ sku: 'MLV-NOPE', prices: [] }];
    expect(codes(m)).toContain('DANGLING_KEY MLV-NOPE');
  });

  it('an already applied (scheduled) release revalidates against a catalog that contains it', async () => {
    const m = exampleManifest();
    const applied = applyToIndex(index, m);
    expect(errorsOf(validateRelease(m, applied, { now: NOW, scheduled: true }))).toEqual([]);
    expect(codes(m, { scheduled: true })).toEqual([]);
    expect(errorsOf(validateRelease(m, applied, { now: NOW })).length).toBeGreaterThan(0);
  });
});
