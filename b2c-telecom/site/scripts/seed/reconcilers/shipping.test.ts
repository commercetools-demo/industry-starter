import { describe, expect, it } from 'vitest';
import { customerGroups } from '../data/customer-groups';
import { shippingMethods } from '../data/shipping';
import { taxCategories } from '../data/tax';
import { zoneCoverage } from '../data/zones';
import { applyPlan, newCtx, planAll } from '../reconcile';
import { FakeCt, type Resource } from '../test/fake-ct';
import type { CartDiscountDraft, DiscountCodeDraft, SeedManifest, ShippingMethodDraft } from '../types';
import { reconcilers } from './registry';

function baseline(): FakeCt {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }, { country: 'GB' }] });
  return api;
}

function manifest(methods: ShippingMethodDraft[] = shippingMethods): SeedManifest {
  return { taxCategory: taxCategories, zoneCoverage, customerGroup: customerGroups, shippingMethod: methods };
}

async function run(api: FakeCt, m: SeedManifest) {
  const ctx = newCtx();
  const plan = await planAll(api, m, reconcilers, ctx);
  return applyPlan(api, m, plan, reconcilers, ctx);
}

type Cart = { country: string; kinds: string[] };

/** A tiny evaluator of the two predicate shapes used by the Malva methods. */
function predicateMatches(predicate: string, kinds: string[]): boolean {
  const exists = /^lineItemExists\(attributes\.`offer-kind` in \(([^)]*)\)\) = true$/.exec(predicate);
  if (exists) {
    const allowed = exists[1].split(',').map((s) => s.trim().replace(/"/g, ''));
    return kinds.some((k) => allowed.includes(k));
  }
  const forAll = /^forAllLineItems\(attributes\.`offer-kind` = "([^"]+)"\) = true$/.exec(predicate);
  if (forAll) return kinds.length > 0 && kinds.every((k) => k === forAll[1]);
  throw new Error(`unsupported predicate ${predicate}`);
}

function matchingCart(api: FakeCt, cart: Cart): string[] {
  const zoneIds = api
    .list('zones')
    .filter((z) => (z.locations as { country: string }[]).some((l) => l.country === cart.country))
    .map((z) => z.id);
  return api
    .list('shipping-methods')
    .filter((m: Resource) => m.active === true)
    .filter((m) => (m.zoneRates as { zone: { id: string } }[]).some((z) => zoneIds.includes(z.zone.id)))
    .filter((m) => !m.predicate || predicateMatches(String(m.predicate), cart.kinds))
    .map((m) => String(m.key));
}

describe('Malva shipping methods', () => {
  it('Shipping option is free: every USD and EUR rate is zero and matches a US cart', async () => {
    const api = baseline();
    await run(api, manifest());
    for (const method of api.list('shipping-methods')) {
      expect(method.isDefault).toBe(false);
      expect(method.active).toBe(true);
      const rates = (method.zoneRates as { shippingRates: { price: { currencyCode: string; centAmount: number } }[] }[]).flatMap((z) => z.shippingRates.map((r) => r.price));
      expect(rates.map((r) => r.currencyCode).sort()).toEqual(['EUR', 'USD']);
      expect(rates.every((r) => r.centAmount === 0)).toBe(true);
    }
    expect(matchingCart(api, { country: 'US', kinds: ['device'] })).toEqual(['malva-shipping-standard']);
    expect(matchingCart(api, { country: 'DE', kinds: ['base-package', 'addon'] })).toEqual(['malva-shipping-standard']);
  });

  it('Digital-only cart: only the digital method matches an add-on-only cart', async () => {
    const api = baseline();
    await run(api, manifest());
    expect(matchingCart(api, { country: 'US', kinds: ['addon'] })).toEqual(['malva-delivery-digital']);
    expect(matchingCart(api, { country: 'US', kinds: ['addon', 'equipment'] })).toEqual(['malva-shipping-standard']);
  });

  it('Shipping rate changed later: the method is updated in place', async () => {
    const api = baseline();
    await run(api, manifest());
    const before = api.list('shipping-methods').length;
    const edited = shippingMethods.map((m) =>
      m.key === 'malva-shipping-standard' ? { ...m, zoneRates: m.zoneRates.map((z) => (z.zone === 'US' ? { ...z, shippingRates: [{ price: { currencyCode: 'USD', centAmount: 499 } }] } : z)) } : m,
    );
    const results = await run(api, manifest(edited));
    expect(results.find((r) => r.key === 'malva-shipping-standard')?.outcome).toMatchObject({ status: 'updated' });
    expect(api.log.at(-1)).toBe('update shipping-methods malva-shipping-standard removeShippingRate,addShippingRate');
    expect(api.list('shipping-methods')).toHaveLength(before);
    const usa = api.byKey('zones', 'usa');
    const method = api.byKey('shipping-methods', 'malva-shipping-standard');
    const zoneRate = (method?.zoneRates as { zone: { id: string }; shippingRates: { price: { centAmount: number } }[] }[]).find((z) => z.zone.id === usa?.id);
    expect(zoneRate?.shippingRates.map((r) => r.price.centAmount)).toEqual([499]);
  });

  it('a second run changes nothing', async () => {
    const api = baseline();
    await run(api, manifest());
    api.writes = 0;
    await run(api, manifest());
    expect(api.writes).toBe(0);
  });
});

describe('discounts', () => {
  const discount: CartDiscountDraft = {
    key: 'malva-disc',
    name: { 'en-US': 'D', 'de-DE': 'D' },
    value: { type: 'relative', permyriad: 1000 },
    cartPredicate: 'true',
    target: { type: 'lineItems', predicate: 'true' },
    sortOrder: '0.5',
    isActive: true,
    requiresDiscountCode: true,
  };
  const code: DiscountCodeDraft = { key: 'malva-code', code: 'MALVA10', cartDiscounts: ['malva-disc'], isActive: true };

  it('creates a discount and a code that references it and is idempotent', async () => {
    const api = baseline();
    const m: SeedManifest = { cartDiscount: [discount], discountCode: [code] };
    await run(api, m);
    api.writes = 0;
    const results = await run(api, m);
    expect(api.writes).toBe(0);
    expect(results.map((r) => r.outcome.status)).toEqual(['unchanged', 'unchanged']);
  });

  it('changes a value with changeValue and refuses a changed code string', async () => {
    const api = baseline();
    await run(api, { cartDiscount: [discount], discountCode: [code] });
    const bigger: CartDiscountDraft = { ...discount, value: { type: 'relative', permyriad: 2000 } };
    await run(api, { cartDiscount: [bigger], discountCode: [code] });
    expect(api.log.at(-1)).toBe('update cart-discounts malva-disc changeValue');
    const renamed: DiscountCodeDraft = { ...code, code: 'OTHER' };
    const results = await run(api, { cartDiscount: [discount], discountCode: [renamed] });
    expect(results.find((r) => r.key === 'malva-code')?.outcome).toMatchObject({ status: 'skipped' });
  });
});
