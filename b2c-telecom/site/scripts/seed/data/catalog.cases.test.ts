import { describe, expect, it } from 'vitest';
import { MANIFEST } from '.';
import type { CategoryDraft } from '../types';
import { attr, masterAttr, nameEn, OFFERS, PRODUCTS, priceOf, product, variantsOf } from './manifest-access';
import { PLAN_PRICES } from './prices';
import { conflictsOf } from './relations';

const categories = MANIFEST.category as CategoryDraft[];
const planOffers = OFFERS.filter((o) => masterAttr(o, 'offer-kind') === 'base-package');

describe('seed-catalog-data scenarios', () => {
  it('Every category has offers: each leaf and top-level category lists at least two', () => {
    expect(categories).toHaveLength(8);
    for (const category of categories) {
      const listed = OFFERS.filter((o) => o.categories.includes(category.key));
      expect(listed.length, category.key).toBeGreaterThanOrEqual(2);
    }
  });

  it('Router unable to carry the top tier: AC1200 max speed is below Cable Gig downstream', () => {
    const router = masterAttr(product('malva-router-ac1200'), 'max-downstream-mbps') as number;
    const gig = masterAttr(product('malva-cable-gig'), 'downstream-mbps') as number;
    expect(router).toBeLessThan(gig);
    expect(masterAttr(product('malva-router-ac1200'), 'supported-technologies')).toContain('cable');
  });

  it('Add-on that applies to one family only: one internet-only and one phone-only add-on', () => {
    const families = PRODUCTS.filter((p) => p.productType === 'malva-addon').map((p) => masterAttr(p, 'applies-to-families') as string[]);
    expect(families.filter((f) => f.length === 1 && f[0] === 'internet').length).toBeGreaterThanOrEqual(1);
    expect(families.filter((f) => f.length === 1 && f[0] === 'phone')).toHaveLength(1);
  });

  it('Extra included at no charge: Cable Gig includes Apple TV+ which is also sold', () => {
    const gig = product('malva-offer-cable-gig');
    expect(masterAttr(gig, 'included-offers')).toContain('malva-offer-appletv');
    const appletv = product('malva-offer-appletv');
    expect(priceOf(appletv.masterVariant, 'USD', 'malva-monthly')?.value.centAmount).toBe(1000);
    expect(masterAttr(product('malva-cable-gig'), 'included-addons')).toEqual(['malva-appletv']);
  });

  it('Two home internet services that cannot coexist: cable and wireless offers name each other', () => {
    const cable = product('malva-offer-cable-500');
    const wireless = product('malva-offer-wireless-5g');
    expect(masterAttr(cable, 'conflicts-with')).toContain('malva-offer-wireless-5g');
    expect(masterAttr(wireless, 'conflicts-with')).toContain('malva-offer-cable-500');
    expect(conflictsOf('malva-offer-wireless-5g')).toContain('malva-offer-cable-500');
  });

  it('Term changes the price: committed terms are cheaper per month than month-to-month', () => {
    for (const offer of planOffers) {
      const variants = variantsOf(offer);
      if (variants.length < 2) continue;
      const price = (term: string): number | undefined => {
        const v = variants.find((x) => attr(x, 'contract-term') === term);
        return v ? priceOf(v, 'USD', 'malva-monthly')?.value.centAmount : undefined;
      };
      const m2m = price('month-to-month') as number;
      for (const term of ['12-months', '24-months']) {
        const committed = price(term);
        if (committed !== undefined) expect(committed, `${offer.key} ${term}`).toBeLessThan(m2m);
      }
    }
    expect(Object.keys(PLAN_PRICES).length).toBe(12);
  });

  it('Prices exist for the seeded market: USD/US and EUR/DE on every variant, none zero', () => {
    for (const offer of OFFERS) {
      for (const v of variantsOf(offer)) {
        expect(v.prices.some((p) => p.value.currencyCode === 'USD' && p.country === 'US'), v.sku).toBe(true);
        expect(v.prices.some((p) => p.value.currencyCode === 'EUR' && p.country === 'DE'), v.sku).toBe(true);
        for (const p of v.prices) expect(p.value.centAmount).toBeGreaterThan(0);
        // every recurring price is tied to a recurrence policy; one-time prices have none
        for (const p of v.prices) expect(p.key.endsWith(`_${p.recurrencePolicy ?? 'once'}`)).toBe(true);
      }
    }
  });

  it('Offers wrap what is sold: every sellable item has an offer, one existing-customer, one channel offer, all keys resolve', () => {
    expect(OFFERS).toHaveLength(27);
    const anchors = new Set(OFFERS.flatMap((o) => masterAttr(o, 'anchors') as string[]));
    const sellable = PRODUCTS.filter((p) => p.productType !== 'malva-offer');
    expect(sellable).toHaveLength(25);
    for (const p of sellable) expect(anchors.has(p.key), p.key).toBe(true);
    expect(OFFERS.filter((o) => masterAttr(o, 'existing-customer') === 'existing').map((o) => o.key)).toEqual(['malva-offer-cable-existing-customer']);
    expect(OFFERS.filter((o) => ((masterAttr(o, 'channels') as string[] | undefined) ?? []).length > 0).map((o) => o.key)).toEqual(['malva-offer-phone-online-only']);
    const keys = new Set(PRODUCTS.map((p) => p.key));
    for (const o of OFFERS) {
      for (const name of ['anchors', 'included-offers', 'conflicts-with', 'compatible-addons']) {
        for (const k of (masterAttr(o, name) as string[] | undefined) ?? []) expect(keys.has(k), `${o.key}.${name} -> ${k}`).toBe(true);
      }
    }
    expect(masterAttr(product('malva-offer-cable-existing-customer'), 'audience')).toEqual(['consumer', 'small-business']);
  });

  it('Handsets seeded: two handsets with several color and memory variants in the devices category', () => {
    const handsets = OFFERS.filter((o) => masterAttr(o, 'offer-kind') === 'device');
    expect(handsets.map(nameEn)).toEqual(['Nova 5G', 'Nova Pro']);
    for (const h of handsets) {
      expect(h.categories).toEqual(['malva-cat-devices']);
      expect(variantsOf(h).length).toBeGreaterThan(2);
    }
    expect(new Set(variantsOf(product('malva-offer-phone-nova-pro')).map((v) => attr(v, 'color'))).size).toBe(3);
  });

  it('Design prototype fully demonstrable: names, prices, tags and every filter chip match the prototype data', () => {
    const master = (key: string): number => priceOf(product(key).masterVariant, 'USD', 'malva-monthly')?.value.centAmount as number;
    expect(['phone-essential', 'phone-plus', 'phone-unlimited', 'phone-unlimited-max'].map((k) => master(`malva-offer-${k}`) / 100)).toEqual([25, 35, 50, 65]);
    expect(['wireless-lite', 'wireless-5g', 'wireless-5g-plus'].map((k) => master(`malva-offer-${k}`) / 100)).toEqual([45, 55, 75]);
    expect(['cable-100', 'cable-500', 'cable-gig'].map((k) => master(`malva-offer-${k}`) / 100)).toEqual([39.99, 59.99, 79.99]);
    // most popular badges: Unlimited, Air 5G, Cable 500
    expect(OFFERS.filter((o) => masterAttr(o, 'badge') === 'most-popular').map(nameEn).sort()).toEqual(['Air 5G', 'Cable 500', 'Cable 500, existing customers', 'Unlimited', 'Unlimited, online only'].sort());
    // filter chips (D-017): speed bands, data, network generation
    const cableOffers = ['malva-offer-cable-100', 'malva-offer-cable-500', 'malva-offer-cable-gig'].map(product);
    expect(cableOffers.filter((o) => (masterAttr(o, 'downstream-mbps') as number) <= 500).map(nameEn)).toEqual(['Cable 100', 'Cable 500']);
    expect(cableOffers.filter((o) => (masterAttr(o, 'downstream-mbps') as number) > 500).map(nameEn)).toEqual(['Cable Gig']);
    const phones = ['malva-offer-phone-essential', 'malva-offer-phone-plus', 'malva-offer-phone-unlimited', 'malva-offer-phone-unlimited-max'].map(product);
    expect(phones.filter((o) => masterAttr(o, 'data-gb') === -1).map(nameEn)).toEqual(['Unlimited', 'Unlimited Max']);
    expect(phones.filter((o) => (masterAttr(o, 'data-gb') as number) !== -1)).toHaveLength(2);
    const wireless = ['malva-offer-wireless-lite', 'malva-offer-wireless-5g', 'malva-offer-wireless-5g-plus'].map(product);
    expect(wireless.filter((o) => masterAttr(o, 'network-generation') === '5g').map(nameEn)).toEqual(['Air 5G', 'Air 5G Plus']);
    expect(wireless.filter((o) => masterAttr(o, 'network-generation') === '4g').map(nameEn)).toEqual(['Air Lite']);
    // add-on tag filter
    const tags = (tag: string): number => OFFERS.filter((o) => masterAttr(o, 'addon-tag') === tag).length;
    expect([tags('music'), tags('video'), tags('extras')]).toEqual([2, 3, 3]);
  });

  it('Broadband Facts label data present: label inputs complete on every plan, cable fee 25, others 0', () => {
    const plans = PRODUCTS.filter((p) => ['malva-internet-plan', 'malva-phone-plan'].includes(p.productType));
    expect(plans).toHaveLength(10);
    const required = ['typical-download-mbps', 'typical-upload-mbps', 'typical-latency-ms', 'data-gb', 'price-lock-months', 'activation-fee', 'early-termination-fee', 'label-plan-id', 'bundle-discount-text', 'contract-term'];
    for (const plan of plans) {
      for (const name of required) expect(masterAttr(plan, name), `${plan.key}.${name}`).toBeDefined();
      expect(masterAttr(plan, 'activation-fee')).toBe(plan.productType === 'malva-internet-plan' && masterAttr(plan, 'technology') === 'cable' ? 25 : 0);
    }
  });
});
