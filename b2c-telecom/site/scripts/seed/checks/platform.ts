// seed:verify checks owned by F (market, shipping, tax, customer groups, search, furniture removed).
import { OWNED_UNPREFIXED_KEYS, SKU_PREFIX } from '../config';
import type { CtApi } from '../lib';
import { checkProjectSettings } from '../project-settings';
import { getAll, type Obj } from '../reconcilers/util';
import type { CheckCtx } from '../types';

export interface CheckResult {
  ok: boolean;
  detail?: string;
}
export interface Check {
  name: string;
  run(api: CtApi, ctx: CheckCtx): Promise<CheckResult>;
}

export const FURNITURE_PRODUCT_TYPES = ['bedding-bundle', 'furniture-and-decor', 'product-sets'] as const;
export const MALVA_PRODUCT_TYPES = ['malva-internet-plan', 'malva-phone-plan', 'malva-addon', 'malva-equipment', 'malva-device', 'malva-offer'] as const;
export const SEARCH_REMEDY = 'npm run seed:settings -- --confirm-project spec-test-b2c-telecom';

const ok = (detail?: string): CheckResult => ({ ok: true, ...(detail ? { detail } : {}) });
const fail = (detail: string): CheckResult => ({ ok: false, detail });

type Ref = { id: string; obj?: Obj & { key?: string } };

async function productTypeKeys(api: CtApi): Promise<Map<string, string>> {
  const types = await getAll(api, 'product-types');
  return new Map(types.map((t) => [String(t.id), String(t.key ?? '')]));
}

async function allProducts(api: CtApi): Promise<Obj[]> {
  return getAll(api, 'products');
}

function typeKeyOf(product: Obj, types: Map<string, string>): string {
  return types.get(String((product.productType as Ref).id)) ?? '';
}

export const marketSettings: Check = {
  name: 'market settings (countries US, DE; currencies USD, EUR; languages en-US, de-DE)',
  async run(api) {
    const report = await checkProjectSettings(api);
    return report.missing.length === 0 ? ok() : fail(`missing: ${report.missing.join(', ')}`);
  },
};

export const searchActive: Check = {
  name: 'product search active',
  async run(api) {
    const report = await checkProjectSettings(api);
    return report.searchStatus === 'Activated' ? ok() : fail(`status ${report.searchStatus}; run ${SEARCH_REMEDY}`);
  },
};

async function malvaTax(api: CtApi): Promise<Obj | null> {
  return (await api.get('tax-categories/key=malva-telecom-services')) as Obj | null;
}

export const taxRates: Check = {
  name: 'tax category malva-telecom-services has US and DE rates of 0',
  async run(api) {
    const tax = await malvaTax(api);
    if (!tax) return fail('tax category malva-telecom-services does not exist');
    const rates = (tax.rates as { country: string; amount: number }[]) ?? [];
    const bad = ['US', 'DE'].filter((c) => rates.find((r) => r.country === c)?.amount !== 0);
    return bad.length === 0 ? ok() : fail(`missing or non-zero rate for ${bad.join(', ')}`);
  },
};

export const everyProductTaxable: Check = {
  name: 'every product taxable (tax category with US and DE rates, every product has a tax category)',
  async run(api) {
    const tax = await malvaTax(api);
    const countries = ((tax?.rates as { country: string }[]) ?? []).map((r) => r.country);
    if (!tax || !['US', 'DE'].every((c) => countries.includes(c))) return fail('tax category malva-telecom-services lacks a US or DE rate');
    const untaxed = (await allProducts(api)).filter((p) => !p.taxCategory).map((p) => String(p.key ?? p.id));
    return untaxed.length === 0 ? ok() : fail(`products without a tax category: ${untaxed.join(', ')}`);
  },
};

export const shipping: Check = {
  name: 'shipping zones and Malva shipping methods (free, active, not default)',
  async run(api) {
    const problems: string[] = [];
    for (const country of ['US', 'DE']) {
      const zones = (await api.get('zones', { where: `locations(country="${country}")`, limit: 1 })) as { results?: unknown[] } | null;
      if (!zones?.results?.length) problems.push(`no zone holds ${country}`);
    }
    // The platform rejects the method predicates until a product type defines the offer-kind line item attribute (G).
    const types = (await getAll(api, 'product-types')) as { attributes?: { name: string; savedToLineItem?: boolean }[] }[];
    const offerKindDefined = types.some((t) => (t.attributes ?? []).some((a) => a.name === 'offer-kind' && a.savedToLineItem === true));
    const deferred: string[] = [];
    for (const key of ['malva-shipping-standard', 'malva-delivery-digital']) {
      const m = (await api.get(`shipping-methods/key=${key}`)) as Obj | null;
      if (!m) {
        if (offerKindDefined) problems.push(`shipping method ${key} missing`);
        else deferred.push(key);
        continue;
      }
      if (m.active !== true) problems.push(`${key} is not active`);
      if (m.isDefault !== false) problems.push(`${key} must not be the default`);
      const rates = ((m.zoneRates as { shippingRates: { price: { currencyCode: string; centAmount: number } }[] }[]) ?? []).flatMap((z) => z.shippingRates.map((r) => r.price));
      for (const currency of ['USD', 'EUR']) {
        if (!rates.some((r) => r.currencyCode === currency)) problems.push(`${key} has no ${currency} rate`);
      }
      if (rates.some((r) => r.centAmount !== 0)) problems.push(`${key} has a non-zero rate`);
    }
    if (problems.length > 0) return fail(problems.join('; '));
    return deferred.length > 0 ? ok(`deferred until the product types define offer-kind: ${deferred.join(', ')}`) : ok();
  },
};

export const recurrence: Check = {
  name: 'recurrence policy malva-monthly (Months x 1)',
  async run(api) {
    const p = (await api.get('recurrence-policies/key=malva-monthly')) as { schedule?: { type?: string; value?: number; intervalUnit?: string } } | null;
    if (!p) return fail('recurrence policy malva-monthly does not exist');
    const s = p.schedule;
    return s?.type === 'standard' && s.value === 1 && s.intervalUnit === 'Months' ? ok() : fail(`schedule is ${JSON.stringify(s)}`);
  },
};

export const customerGroups: Check = {
  name: 'customer groups consumer, small-business, employee, existing-customer',
  async run(api) {
    const missing: string[] = [];
    for (const key of OWNED_UNPREFIXED_KEYS.customerGroup) {
      if (!(await api.get(`customer-groups/key=${key}`))) missing.push(key);
    }
    return missing.length === 0 ? ok() : fail(`missing: ${missing.join(', ')}`);
  },
};

export const furnitureRemoved: Check = {
  name: 'furniture sample data removed',
  async run(api) {
    const problems: string[] = [];
    const types = await productTypeKeys(api);
    for (const key of FURNITURE_PRODUCT_TYPES) {
      if ([...types.values()].includes(key)) problems.push(`product type ${key} exists`);
    }
    const foreignProducts = (await allProducts(api)).filter((p) => !typeKeyOf(p, types).startsWith('malva-'));
    if (foreignProducts.length > 0) problems.push(`${foreignProducts.length} product(s) with a non-malva product type`);
    const foreignCategories = (await getAll(api, 'categories')).filter((c) => !String(c.key ?? '').startsWith('malva-cat-'));
    if (foreignCategories.length > 0) problems.push(`${foreignCategories.length} category(ies) without the malva-cat- key prefix`);
    const foreignInventory = (await getAll(api, 'inventory')).filter((i) => !String(i.sku ?? '').startsWith(SKU_PREFIX));
    if (foreignInventory.length > 0) problems.push(`${foreignInventory.length} inventory entry(ies) with a non-${SKU_PREFIX} SKU`);
    return problems.length === 0 ? ok() : fail(problems.join('; '));
  },
};

export const intendedAssortment: Check = {
  name: 'storefront sees only the intended assortment',
  async run(api) {
    const types = await productTypeKeys(api);
    const stray = (await allProducts(api))
      .filter((p) => (p.masterData as { published?: boolean } | undefined)?.published === true)
      .filter((p) => !(MALVA_PRODUCT_TYPES as readonly string[]).includes(typeKeyOf(p, types)))
      .map((p) => `${String(p.key ?? p.id)} (${typeKeyOf(p, types) || 'unknown type'})`);
    return stray.length === 0 ? ok() : fail(`published products outside the malva product types: ${stray.join(', ')}`);
  },
};

export const platformChecks: Check[] = [
  marketSettings,
  searchActive,
  taxRates,
  everyProductTaxable,
  shipping,
  recurrence,
  customerGroups,
  furnitureRemoved,
  intendedAssortment,
];
