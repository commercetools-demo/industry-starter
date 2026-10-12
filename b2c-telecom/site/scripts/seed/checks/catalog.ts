// seed:verify checks owned by G: the catalog as it is in the project (counts, prices, references, steps, images, search, demo data).
import type { CtApi } from '../lib';
import { getAll, type Obj } from '../reconcilers/util';
import { MANIFEST } from '../data';
import { SERVICEABILITY_CONTAINER } from '../data/serviceability';
import { demoCustomers } from '../data/demo/customers';
import { demoOrders } from '../data/demo/orders';
import { getLock } from '../images';
import type { ProductDraft, VariantDraft } from '../types';
import type { Check, CheckResult } from './platform';

const ok = (detail?: string): CheckResult => ({ ok: true, ...(detail ? { detail } : {}) });
const fail = (detail: string): CheckResult => ({ ok: false, detail });

export const EXPECTED = {
  productTypes: 6,
  customTypes: 6,
  categories: 8,
  products: 59,
  offers: 31,
  inventory: 19,
  cartDiscounts: 2,
  discountCodes: 1,
  policies: 5,
  serviceability: 11,
} as const;

const manifestProducts = MANIFEST.product as ProductDraft[];
const manifestOffers = manifestProducts.filter((p) => p.productType === 'malva-offer');

type LiveVariant = { sku: string; prices?: { key?: string; value: { currencyCode: string; centAmount: number }; country?: string; recurrencePolicy?: { id: string } }[]; attributes?: { name: string; value: unknown }[] };
type LiveProduct = { key?: string; masterData: { published: boolean; current?: { masterVariant: LiveVariant; variants: LiveVariant[] }; staged: { masterVariant: LiveVariant; variants: LiveVariant[] } } };

async function liveProducts(api: CtApi): Promise<Map<string, LiveProduct>> {
  const all = (await getAll(api, 'products')) as unknown as LiveProduct[];
  return new Map(all.filter((p) => p.key).map((p) => [p.key as string, p]));
}

function liveVariants(p: LiveProduct): LiveVariant[] {
  return [p.masterData.staged.masterVariant, ...p.masterData.staged.variants];
}

const keysWithPrefix = (items: Obj[], prefix: string): string[] => items.map((i) => String(i.key ?? i.sku ?? '')).filter((k) => k.startsWith(prefix));

export const catalogCounts: Check = {
  name: 'catalog counts (6 product types, 6 custom types, 8 categories, 59 products, 19 inventory entries, at least 2 discounts, at least 1 code, 5 policies, 11 serviceability objects)',
  async run(api) {
    const problems: string[] = [];
    const expect = (label: string, actual: number, wanted: number): void => {
      if (actual !== wanted) problems.push(`${label}: ${actual} (expected ${wanted})`);
    };
    expect('product types', keysWithPrefix(await getAll(api, 'product-types'), 'malva-').length, EXPECTED.productTypes);
    expect('custom types', keysWithPrefix(await getAll(api, 'types'), 'malva-').length, EXPECTED.customTypes);
    expect('categories', keysWithPrefix(await getAll(api, 'categories'), 'malva-cat-').length, EXPECTED.categories);
    const products = await getAll(api, 'products');
    expect('products', keysWithPrefix(products, 'malva-').length, EXPECTED.products);
    const unpublished = products.filter((p) => (p.masterData as { published?: boolean }).published !== true).map((p) => String(p.key));
    if (unpublished.length > 0) problems.push(`unpublished products: ${unpublished.join(', ')}`);
    expect('inventory entries', (await getAll(api, 'inventory')).filter((i) => String(i.sku).startsWith('MLV-')).length, EXPECTED.inventory);
    // At least: workstreams L and M seed further discounts and codes with their own scripts (seed:discounts), outside this manifest.
    const atLeast = (label: string, actual: number, wanted: number): void => {
      if (actual < wanted) problems.push(`${label}: ${actual} (expected at least ${wanted})`);
    };
    atLeast('cart discounts', keysWithPrefix(await getAll(api, 'cart-discounts'), 'malva-cd-').length, EXPECTED.cartDiscounts);
    atLeast('discount codes', keysWithPrefix(await getAll(api, 'discount-codes'), 'malva-dc-').length, EXPECTED.discountCodes);
    expect('recurrence policies', keysWithPrefix(await getAll(api, 'recurrence-policies'), 'malva-').length, EXPECTED.policies);
    expect('serviceability objects', (await getAll(api, 'custom-objects', { where: `container="${SERVICEABILITY_CONTAINER}"` })).length, EXPECTED.serviceability);
    return problems.length === 0 ? ok() : fail(problems.join('; '));
  },
};

export const offerPrices: Check = {
  name: 'every offer variant has its USD/US and EUR/DE prices, and every recurring variant has a price for each policy it is sold with',
  async run(api) {
    const live = await liveProducts(api);
    const problems: string[] = [];
    for (const offer of manifestOffers) {
      const product = live.get(offer.key);
      if (!product) {
        problems.push(`${offer.key} is missing`);
        continue;
      }
      const variants = liveVariants(product);
      for (const wanted of [offer.masterVariant, ...offer.variants] as VariantDraft[]) {
        const have = variants.find((v) => v.sku === wanted.sku);
        if (!have) {
          problems.push(`${offer.key} has no variant ${wanted.sku}`);
          continue;
        }
        for (const [currency, country] of [['USD', 'US'], ['EUR', 'DE']] as const) {
          if (!(have.prices ?? []).some((p) => p.value.currencyCode === currency && p.country === country)) problems.push(`${wanted.sku} has no ${currency}/${country} price`);
        }
        for (const price of wanted.prices) {
          const found = (have.prices ?? []).find((p) => p.key === price.key);
          if (!found) problems.push(`${wanted.sku} lacks price ${price.key}`);
          else if (price.recurrencePolicy && !found.recurrencePolicy) problems.push(`${wanted.sku} price ${price.key} has no recurrence policy (the platform would fall back to the one-time price)`);
          else if (found.value.centAmount !== price.value.centAmount) problems.push(`${wanted.sku} price ${price.key} is ${found.value.centAmount}, expected ${price.value.centAmount}`);
        }
      }
    }
    return problems.length === 0 ? ok() : fail(problems.slice(0, 8).join('; ') + (problems.length > 8 ? ` (+${problems.length - 8} more)` : ''));
  },
};

export const offerReferences: Check = {
  name: 'every key an offer references exists',
  async run(api) {
    const live = await liveProducts(api);
    const problems: string[] = [];
    for (const offer of manifestOffers) {
      const product = live.get(offer.key);
      if (!product) continue;
      for (const variant of liveVariants(product)) {
        for (const attribute of variant.attributes ?? []) {
          if (['anchors', 'included-offers', 'conflicts-with', 'compatible-addons', 'compatible-equipment', 'requires-offers', 'negates-offers'].includes(attribute.name) && Array.isArray(attribute.value)) {
            for (const key of attribute.value as string[]) if (!live.has(key)) problems.push(`${offer.key}.${attribute.name} -> ${key}`);
          }
        }
      }
    }
    return problems.length === 0 ? ok() : fail(problems.slice(0, 8).join('; '));
  },
};

export const imageCoverage: Check = {
  name: 'image coverage (reports missing images, never fails)',
  async run(api) {
    const live = await liveProducts(api);
    const lock = getLock();
    const missing = Object.keys(lock).map((key) => ({ key })).filter((t) => {
      if (t.key.startsWith('malva-cat-')) return !lock[t.key];
      const product = live.get(t.key);
      return !product || liveVariants(product).every((v) => ((v as { images?: unknown[] }).images ?? []).length === 0);
    }).map((t) => t.key);
    return ok(missing.length === 0 ? 'every offer and category has images' : `${missing.length} without images: ${missing.join(', ')}`);
  },
};

export const searchFindsOffers: Check = {
  name: 'product search finds all 31 offers',
  async run(api) {
    const keys = manifestOffers.map((o) => o.key);
    try {
      const res = (await api.post('products/search', { query: { or: keys.map((value) => ({ exact: { field: 'key', value } })) }, limit: 1 })) as { total?: number };
      return res.total === keys.length ? ok() : fail(`found ${String(res.total)} of ${keys.length} (the index may still be building: wait a few minutes)`);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

export const demoData: Check = {
  name: 'demo data (when seeded: 5 customers with their group and demoMarker, 3 orders with serviceStartDate and a Recurring Order)',
  async run(api) {
    const first = (await getAll(api, 'customers', { where: `key="${demoCustomers[0].key}"` })) as Obj[];
    if (first.length === 0) return ok('demo data not seeded');
    const problems: string[] = [];
    for (const wanted of demoCustomers) {
      const found = ((await getAll(api, 'customers', { where: `key="${wanted.key}"`, expand: 'customerGroup' })) as (Obj & { customerGroup?: { obj?: { key?: string } }; custom?: { fields?: Record<string, unknown> } })[])[0];
      if (!found) problems.push(`customer ${wanted.key} missing`);
      else {
        if (found.customerGroup?.obj?.key !== wanted.customerGroup) problems.push(`${wanted.key} is not in group ${wanted.customerGroup}`);
        if (found.custom?.fields?.demoMarker !== 'malva-demo') problems.push(`${wanted.key} has no demoMarker`);
      }
    }
    for (const wanted of demoOrders) {
      const found = ((await getAll(api, 'orders', { where: `orderNumber="${wanted.orderNumber}"` })) as (Obj & { custom?: { fields?: Record<string, unknown> } })[])[0];
      if (!found) problems.push(`order ${wanted.orderNumber} missing`);
      else {
        if (found.custom?.fields?.serviceStartDate !== wanted.serviceStartDate) problems.push(`${wanted.orderNumber} serviceStartDate is ${String(found.custom?.fields?.serviceStartDate)}`);
        const recurring = await getAll(api, 'recurring-orders', { where: `originOrder(id="${String(found.id)}")` });
        if (recurring.length === 0) problems.push(`${wanted.orderNumber} has no Recurring Order`);
      }
    }
    return problems.length === 0 ? ok() : fail(problems.join('; '));
  },
};

/**
 * Promotions apply to the first order only: every Cart Discount in the project must be `NonRecurringOrdersOnly`, or the standing
 * price shown for recurring orders ("Then monthly") would be wrong. Owned discounts that are not fail; a discount made in the Merchant
 * Center is reported as a warning (never fails), and so is an owned discount the manifest no longer has (the retired ones).
 */
export const discountScope: Check = {
  name: 'cart discounts apply to the first order only (recurringOrderScope NonRecurringOrdersOnly)',
  async run(api) {
    const live = (await getAll(api, 'cart-discounts')) as (Obj & { key?: string; recurringOrderScope?: { type?: string } })[];
    const wanted = new Set((MANIFEST.cartDiscount ?? []).map((draft) => draft.key));
    const scoped = (discount: { recurringOrderScope?: { type?: string } }): boolean => discount.recurringOrderScope?.type === 'NonRecurringOrdersOnly';
    const owned = live.filter((discount) => discount.key?.startsWith('malva-'));
    const bad = owned.filter((discount) => wanted.has(String(discount.key)) && !scoped(discount)).map((discount) => String(discount.key));
    if (bad.length > 0) return fail(`apply to recurring orders: ${bad.join(', ')} (re-run the seed)`);
    const warnings = [
      ...live.filter((discount) => !discount.key?.startsWith('malva-') && !scoped(discount)).map((discount) => `${String(discount.key ?? '(no key)')} is not first-order-only (Merchant Center discount)`),
      ...owned.filter((discount) => !wanted.has(String(discount.key))).map((discount) => `${String(discount.key)} is no longer in the manifest (retired: remove it with the cleanup script)`),
    ];
    return ok(warnings.length === 0 ? undefined : `warning: ${warnings.join('; ')}`);
  },
};

export const catalogChecks: Check[] = [catalogCounts, offerPrices, offerReferences, discountScope, imageCoverage, searchFindsOffers, demoData];
