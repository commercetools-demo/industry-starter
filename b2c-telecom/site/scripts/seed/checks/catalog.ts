// seed:verify checks owned by G: the catalog as it is in the project (counts, prices, references, steps, images, search, demo data).
import type { CtApi } from '../lib';
import { getAll, type Obj } from '../reconcilers/util';
import { MANIFEST } from '../data';
import { SERVICEABILITY_CONTAINER } from '../data/serviceability';
import { demoCustomers } from '../data/demo/customers';
import { demoOrders } from '../data/demo/orders';
import { getLock } from '../images';
import { IMAGE_TARGETS } from '../data/image-terms';
import type { ProductDraft, VariantDraft } from '../types';
import type { Check, CheckResult } from './platform';

const ok = (detail?: string): CheckResult => ({ ok: true, ...(detail ? { detail } : {}) });
const fail = (detail: string): CheckResult => ({ ok: false, detail });

export const EXPECTED = {
  productTypes: 6,
  customTypes: 4,
  categories: 8,
  products: 52,
  offers: 27,
  inventory: 19,
  cartDiscounts: 6,
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
  name: 'catalog counts (6 product types, 4 custom types, 8 categories, 52 products, 19 inventory entries, at least 6 discounts, at least 1 code, 5 policies, 11 serviceability objects)',
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
  name: 'every key an offer references exists and price-steps parse',
  async run(api) {
    const live = await liveProducts(api);
    const problems: string[] = [];
    for (const offer of manifestOffers) {
      const product = live.get(offer.key);
      if (!product) continue;
      for (const variant of liveVariants(product)) {
        for (const attribute of variant.attributes ?? []) {
          if (['anchors', 'included-offers', 'conflicts-with', 'compatible-addons', 'compatible-equipment'].includes(attribute.name) && Array.isArray(attribute.value)) {
            for (const key of attribute.value as string[]) if (!live.has(key)) problems.push(`${offer.key}.${attribute.name} -> ${key}`);
          }
          if (attribute.name === 'price-steps') {
            try {
              const steps = JSON.parse(String(attribute.value)) as { fromMonth: number; percentOff: number }[];
              if (!Array.isArray(steps) || steps.some((s) => typeof s.fromMonth !== 'number' || typeof s.percentOff !== 'number')) problems.push(`${offer.key}.price-steps has the wrong shape`);
            } catch {
              problems.push(`${offer.key}.price-steps is not JSON`);
            }
          }
        }
      }
    }
    return problems.length === 0 ? ok() : fail(problems.slice(0, 8).join('; '));
  },
};

export const yearOneDiscounts: Check = {
  name: 'year-1 discounts equal the first price step of their offer',
  async run(api) {
    const live = await liveProducts(api);
    const pairs: [string, string][] = [['malva-cd-tier-year1-20', 'malva-offer-cable-gig'], ['malva-cd-tier-year1-15', 'malva-offer-phone-unlimited-max']];
    const problems: string[] = [];
    for (const [discountKey, offerKey] of pairs) {
      const discount = (await api.get(`cart-discounts/key=${discountKey}`)) as { value?: { permyriad?: number } } | null;
      const product = live.get(offerKey);
      const steps = product ? ((liveVariants(product)[0].attributes ?? []).find((a) => a.name === 'price-steps')?.value as string | undefined) : undefined;
      if (!discount || !steps) {
        problems.push(`${discountKey} or ${offerKey}.price-steps is missing`);
        continue;
      }
      const first = (JSON.parse(steps) as { percentOff: number }[])[0];
      if (discount.value?.permyriad !== first.percentOff * 100) problems.push(`${discountKey} is ${String(discount.value?.permyriad)} permyriad, first step is ${first.percentOff} %`);
    }
    return problems.length === 0 ? ok() : fail(problems.join('; '));
  },
};

export const imageCoverage: Check = {
  name: 'image coverage (reports missing images, never fails)',
  async run(api) {
    const live = await liveProducts(api);
    const lock = getLock();
    const missing = IMAGE_TARGETS.filter((t) => {
      if (t.key.startsWith('malva-cat-')) return !lock[t.key];
      const product = live.get(t.key);
      return !product || liveVariants(product).every((v) => ((v as { images?: unknown[] }).images ?? []).length === 0);
    }).map((t) => t.key);
    return ok(missing.length === 0 ? 'every offer and category has images' : `${missing.length} without images: ${missing.join(', ')}`);
  },
};

export const searchFindsOffers: Check = {
  name: 'product search finds all 27 offers',
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

export const catalogChecks: Check[] = [catalogCounts, offerPrices, offerReferences, yearOneDiscounts, imageCoverage, searchFindsOffers, demoData];
