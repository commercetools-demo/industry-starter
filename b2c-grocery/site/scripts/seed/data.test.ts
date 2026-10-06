// @vitest-environment node
import categories from './data/categories.json';
import productType from './data/product-type.json';
import recurrence from './data/recurrence.json';
import shippingTax from './data/shipping-tax.json';
import types from './data/types.json';
import { DEFS, buildProductDrafts, eurCents, skuQuantities, substituteMap } from './data/catalog';

const locales = ['en-US', 'de-DE'];

describe('custom types (F-05)', () => {
  const byKey = Object.fromEntries(types.map((t) => [t.key, t]));
  it('has the four types with the specified resources and fields', () => {
    expect(Object.keys(byKey).sort()).toEqual(['cart-delivery', 'line-substitution', 'order-final', 'substitution-proposal']);
    // commercetools uses the resource type id 'order' for both carts and orders
    expect(byKey['cart-delivery'].resourceTypeIds).toEqual(['order']);
    expect(byKey['cart-delivery'].fieldDefinitions.map((f) => f.name)).toEqual(['slotId', 'slotStart', 'slotEnd', 'slotHoldExpires', 'finalTotal']);
    expect(byKey['order-final'].fieldDefinitions[0]).toMatchObject({ name: 'finalTotal', type: { name: 'Money' } });
    expect(byKey['line-substitution'].resourceTypeIds).toEqual(['line-item']);
    const pref = byKey['line-substitution'].fieldDefinitions[0].type as { values: { key: string }[] };
    expect(pref.values.map((v) => v.key)).toEqual(['allow-similar', 'none']);
    expect(byKey['substitution-proposal'].resourceTypeIds).toEqual(['order-edit']);
    expect(byKey['substitution-proposal'].fieldDefinitions.map((f) => f.name)).toEqual(['originalLineItemId', 'substituteSku', 'status', 'note']);
    const status = byKey['substitution-proposal'].fieldDefinitions[2].type as { values: { key: string }[] };
    expect(status.values.map((v) => v.key)).toEqual(['pending', 'declined', 'applied']);
  });
});

describe('product type (F-06)', () => {
  const attrs = Object.fromEntries(productType.attributes.map((a) => [a.name, a]));
  it('has the specified attributes and types', () => {
    expect(productType.key).toBe('grocery-product');
    expect(attrs.brand.type.name).toBe('text');
    expect(attrs.origin.type.name).toBe('text');
    expect(attrs.allergens.type).toEqual({ name: 'set', elementType: { name: 'text' } });
    expect(attrs.recurringEligible.type.name).toBe('boolean');
    expect(attrs.incrementValue.type.name).toBe('number');
    expect(attrs.approximateWeight.type.name).toBe('boolean');
    expect((attrs.incrementUnit.type as { values: { key: string }[] }).values.map((v) => v.key)).toEqual(['g', 'kg', 'ml', 'l', 'each']);
    expect((attrs.dietary.type as { elementType: { values: { key: string }[] } }).elementType.values.map((v) => v.key)).toEqual(['vegan', 'vegetarian', 'gluten-free', 'organic']);
  });
  it('localizes only packLabel', () => {
    expect(productType.attributes.filter((a) => a.type.name === 'ltext').map((a) => a.name)).toEqual(['packLabel']);
  });
  it('variant-level attributes are not SameForAll', () => {
    for (const n of ['incrementValue', 'incrementUnit', 'approximateWeight', 'packLabel']) expect(attrs[n].attributeConstraint).toBe('None');
  });
});

describe('categories (F-07)', () => {
  it('has six unique keys with both locales', () => {
    expect(new Set(categories.map((c) => c.key)).size).toBe(6);
    for (const c of categories) for (const l of locales) {
      expect(c.name[l as 'en-US']).toBeTruthy();
      expect(c.slug[l as 'en-US']).toBeTruthy();
    }
  });
});

describe('shipping and tax (F-08)', () => {
  it('food 7% / non-food 19% for DE; US 0', () => {
    const rate = (k: string, c: string) => shippingTax.taxCategories.find((t) => t.key === k)!.rates.find((r) => r.country === c)!.amount;
    expect(rate('food', 'DE')).toBe(0.07);
    expect(rate('non-food', 'DE')).toBe(0.19);
    expect(rate('food', 'US')).toBe(0);
  });
  it('standard method: US $5.00 free above $50, DE €4.90 free above €45, not default (D-049)', () => {
    const m = shippingTax.shippingMethod;
    expect(m.key).toBe('standard');
    expect(m.isDefault).toBe(false);
    expect(m.rates).toEqual([
      { zoneKey: 'usa', currency: 'USD', centAmount: 500, freeAboveCentAmount: 5000 },
      { zoneKey: 'europe', currency: 'EUR', centAmount: 490, freeAboveCentAmount: 4500 },
    ]);
  });
});

describe('recurrence (F-09)', () => {
  it('Policy lookup: three keys with schedules and both locales', () => {
    expect(recurrence.map((p) => p.key)).toEqual(['weekly', 'every-2-weeks', 'monthly']);
    expect(recurrence.map((p) => [p.schedule.value, p.schedule.intervalUnit])).toEqual([[1, 'Weeks'], [2, 'Weeks'], [1, 'Months']]);
    for (const p of recurrence) for (const l of locales) expect(p.name[l as 'en-US']).toBeTruthy();
  });
});

describe('products (F-10 validator)', () => {
  const drafts = buildProductDrafts() as unknown as {
    key: string; categories: { key: string }[]; name: Record<string, string>; slug: Record<string, string>; description: Record<string, string>;
    masterVariant: { sku: string; prices: { value: { currencyCode: string }; country: string }[]; attributes: { name: string; value: unknown }[] };
    variants: { sku: string; prices: { value: { currencyCode: string }; country: string }[]; attributes: { name: string; value: unknown }[] }[];
  }[];
  const all = (d: (typeof drafts)[number]) => [d.masterVariant, ...d.variants];
  const val = (v: { attributes: { name: string; value: unknown }[] }, n: string) => v.attributes.find((a) => a.name === n)?.value;

  it('36 products, 6 per category (enough for two pages at 24)', () => {
    expect(drafts).toHaveLength(36);
    for (const c of categories) expect(drafts.filter((d) => d.categories[0].key === c.key)).toHaveLength(6);
  });
  it('unique keys, slugs and skus', () => {
    expect(new Set(drafts.map((d) => d.key)).size).toBe(36);
    expect(new Set(drafts.flatMap((d) => Object.values(d.slug))).size).toBe(72);
    const skus = drafts.flatMap((d) => all(d).map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
  });
  it('both locales on name, description and slug', () => {
    for (const d of drafts) for (const l of locales) {
      expect(d.name[l]).toBeTruthy(); expect(d.description[l]).toBeTruthy(); expect(d.slug[l]).toBeTruthy();
    }
  });
  it('German visitor: every variant has USD/US and EUR/DE prices', () => {
    for (const d of drafts) for (const v of all(d)) {
      expect(v.prices.map((p) => `${p.value.currencyCode}/${p.country}`).sort()).toEqual(['EUR/DE', 'USD/US']);
    }
    expect(eurCents(349)).toBe(314);
  });
  it('Weighed product: ≥8 weighed, each increment is a variant with a non-each unit', () => {
    const weighed = drafts.filter((d) => all(d).some((v) => val(v, 'incrementUnit') !== 'each'));
    expect(weighed.length).toBeGreaterThanOrEqual(8);
    for (const d of weighed) {
      expect(all(d).length).toBeGreaterThanOrEqual(2);
      expect(all(d).length).toBeLessThanOrEqual(3);
    }
  });
  it('Fixed item: one variant, each, 1, not approximate', () => {
    for (const d of drafts.filter((x) => all(x).length === 1)) {
      expect(val(d.masterVariant, 'incrementUnit')).toBe('each');
      expect(val(d.masterVariant, 'incrementValue')).toBe(1);
      expect(val(d.masterVariant, 'approximateWeight')).toBe(false);
    }
  });
  it('counts: 6 approximate, ≥3 out of stock, ≥6 substitutes, ≥6 recurring', () => {
    expect(drafts.filter((d) => val(d.masterVariant, 'approximateWeight') === true)).toHaveLength(6);
    expect(DEFS.filter((d) => d.flags.includes('OOS')).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(substituteMap()).length).toBeGreaterThanOrEqual(6);
    expect(drafts.filter((d) => val(d.masterVariant, 'recurringEligible') === true).length).toBeGreaterThanOrEqual(6);
  });
  it('Out of stock variant: quantity 0 for OOS products, 50 otherwise; substitutes exist', () => {
    const q = Object.fromEntries(skuQuantities().map((x) => [x.sku, x.quantity]));
    expect(q['CHEDDAR-200G']).toBe(0);
    expect(q['BANANAS-500G']).toBe(50);
    const keys = new Set(drafts.map((d) => d.key));
    for (const sub of Object.values(substituteMap())) expect(keys.has(sub)).toBe(true);
  });
});
