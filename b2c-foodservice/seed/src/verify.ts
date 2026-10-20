// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, Res } from './api';
import { CONTRACT_KEYS, COUNTRIES, CURRENCIES, K, LANGUAGES } from './data/base';
import { CATEGORIES } from './data/categories';
import { CUSTOMERS, shoppingListDraft } from './data/customers';
import { typeDrafts } from './data/custom-types';
import { cartDiscountDrafts, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { priceDefsOf, priceSig } from './data/prices';
import { productTypeDrafts } from './data/product-types';
import { PRODUCTS, type ProductDef } from './data/products';
import { REVIEWS, expectedStats } from './data/reviews';
import { stateDrafts } from './data/states';
import { STORES } from './data/stores';
import { shippingMethodDrafts, taxCategoryDrafts, zoneDrafts } from './data/tax-shipping';
import { fail, getAdmin, isCleanUrl, isMainModule } from './lib';
import { priceSigs, type KeyOf } from './sync';

/**
 * Read-back checks after a seed run. Exits 1 on any mismatch. Needs the same API client as the seed (read access).
 * Compares: project settings, every seeded resource per type, prices against the table (a hand-edited price is reported
 * by SKU), inventory against the rule, image URLs are clean, and product reviewRatingStatistics.count against the
 * seeded approved reviews.
 *
 *   npm run verify
 */
interface Variant { sku?: string; prices?: unknown[]; recurrencePrices?: unknown[]; images?: { url: string }[]; attributes?: { name: string; value: unknown }[] }
interface ProductData { name?: Record<string, string>; description?: Record<string, string>; masterVariant: Variant; variants?: Variant[]; categories?: { id: string }[] }

/** Problems with one seeded product (pure; unit tested): publication, locales, variants, prices, clean image URLs. */
export function checkProduct(p: Res, def: ProductDef, keyOf: KeyOf): string[] {
  const out: string[] = [];
  const key = p.key ?? '(no key)';
  const md = p.masterData as { published: boolean; current: ProductData; staged: ProductData };
  if (!md.published) out.push(`${key}: not published`);
  const data = md.published ? md.current : md.staged;
  for (const l of LANGUAGES) {
    if (!data.name?.[l]) out.push(`${key}: name missing in ${l}`);
    if (!data.description?.[l]) out.push(`${key}: description missing in ${l}`);
  }
  const variants = [data.masterVariant, ...(data.variants ?? [])];
  if (variants.length !== def.variants.length) out.push(`${key}: ${variants.length} variant(s), expected ${def.variants.length}`);
  for (const vd of def.variants) {
    const v = variants.find((x) => x.sku === vd.sku);
    if (!v) { out.push(`${key}: variant ${vd.sku} missing`); continue; }
    const want = new Set(priceDefsOf(def, vd).map(priceSig));
    const have = priceSigs(v as never, keyOf);
    const missing = [...want].filter((s) => !have.has(s));
    const extra = [...have].filter((s) => !want.has(s));
    if (missing.length || extra.length) out.push(`${vd.sku}: price drift, expected ${missing.join(' | ') || 'no change'}, unexpected ${extra.join(' | ') || 'none'}`);
    for (const img of v.images ?? []) if (!isCleanUrl(img.url)) out.push(`${vd.sku}: image URL is not clean: ${img.url}`);
  }
  return out;
}

/** Reviews versus statistics: count (and average) of the product must equal the seeded approved reviews. */
export function checkReviewStatistics(p: Res, expected: { count: number; averageRating: number }): string[] {
  const stats = p.reviewRatingStatistics as { count?: number; averageRating?: number } | undefined;
  const have = stats?.count ?? 0;
  const out: string[] = [];
  if (have !== expected.count) out.push(`${p.key}: reviewRatingStatistics.count is ${have}, expected ${expected.count} seeded approved review(s)`);
  else if (expected.count > 0 && Math.abs((stats?.averageRating ?? 0) - expected.averageRating) > 0.001) out.push(`${p.key}: averageRating ${String(stats?.averageRating)}, expected ${expected.averageRating.toFixed(3)}`);
  return out;
}

const keyMap = async (api: Api, kind: Kind): Promise<Map<string, string>> => new Map((await api.list(kind)).filter((r) => r.key).map((r) => [r.id, r.key as string]));

export async function verifySeed(api: Api): Promise<string[]> {
  const problems: string[] = [];
  const need = async (kind: Kind, key: string): Promise<Res | undefined> => {
    const r = await api.getByKey(kind, key);
    if (!r) problems.push(`${kind} ${key}: missing`);
    return r;
  };

  // project
  const project = await api.getProject();
  if (project.searchIndexing?.productsSearch?.status !== 'Activated') problems.push('project: Product Search indexing (ProductsSearch) is not Activated');
  if (project.carts?.countryTaxRateFallbackEnabled !== true) problems.push('project: countryTaxRateFallbackEnabled is not true');
  for (const [field, wanted] of [['languages', LANGUAGES], ['countries', COUNTRIES], ['currencies', CURRENCIES]] as const) {
    const missing = wanted.filter((x) => !(project[field] as string[]).includes(x));
    if (missing.length) problems.push(`project: ${field} lacks ${missing.join(', ')}`);
  }

  // tax, zones, shipping
  for (const t of taxCategoryDrafts) {
    const have = await need('tax-categories', t.key as string);
    const rates = (have?.rates as { country: string; state?: string; amount: number; includedInPrice: boolean }[]) ?? [];
    for (const w of t.rates ?? []) {
      const r = rates.find((x) => x.country === w.country && (x.state ?? '') === (w.state ?? ''));
      if (have && (!r || r.amount !== w.amount || r.includedInPrice !== w.includedInPrice)) problems.push(`tax category ${t.key}: rate ${w.country}${w.state ? `-${w.state}` : ''} must be ${String(w.amount)} (included in price: ${w.includedInPrice})`);
    }
  }
  const zoneKeys = await keyMap(api, 'zones');
  for (const z of zoneDrafts) await need('zones', z.key as string);
  for (const s of shippingMethodDrafts) {
    const have = await need('shipping-methods', s.key as string);
    if (!have) continue;
    const zr = (have.zoneRates as { zone: { id: string }; shippingRates: { price: { centAmount: number; currencyCode: string }; freeAbove?: { centAmount: number } }[] }[]) ?? [];
    for (const w of s.zoneRates ?? []) {
      const c = zr.find((z) => zoneKeys.get(z.zone.id) === (w.zone as { key?: string }).key);
      const wantRate = w.shippingRates?.[0];
      const haveRate = c?.shippingRates?.[0];
      if (!c || !wantRate || haveRate?.price.centAmount !== wantRate.price.centAmount || (haveRate?.freeAbove?.centAmount ?? null) !== (wantRate.freeAbove?.centAmount ?? null)) problems.push(`shipping method ${s.key}: rate for zone ${(w.zone as { key?: string }).key} differs from the seed`);
    }
  }

  // types and states
  for (const t of typeDrafts) await need('types', t.key);
  for (const s of stateDrafts) {
    const have = await need('states', s.key);
    if (have && s.roles && JSON.stringify([...((have.roles as string[]) ?? [])].sort()) !== JSON.stringify([...s.roles].sort())) problems.push(`state ${s.key}: roles differ`);
  }
  for (const k of CONTRACT_KEYS) if (!typeDrafts.some((t) => t.key === k) && !stateDrafts.some((s) => s.key === k)) problems.push(`contract key ${k}: not defined by the seed`);

  // product types, categories, channels, recurrence
  for (const t of productTypeDrafts) {
    const have = await need('product-types', t.key as string);
    const names = new Set(((have?.attributes as { name: string }[]) ?? []).map((a) => a.name));
    const missing = (t.attributes ?? []).filter((a) => !names.has(a.name)).map((a) => a.name);
    if (have && missing.length) problems.push(`product type ${t.key}: attributes missing ${missing.join(', ')}`);
  }
  for (const c of CATEGORIES) {
    const have = await need('categories', c.key);
    const slug = (have?.slug ?? {}) as Record<string, string>;
    if (have) for (const l of LANGUAGES) if (!slug[l]) problems.push(`category ${c.key}: slug missing in ${l}`);
  }
  for (const s of STORES) {
    const have = await need('channels', s.key);
    if (have && !((have.roles as string[]) ?? []).includes('InventorySupply')) problems.push(`channel ${s.key}: role InventorySupply missing`);
  }
  for (const r of recurrencePolicyDrafts) await need('recurrence-policies', r.key as string);

  // products and prices
  const policyKeys = await keyMap(api, 'recurrence-policies');
  const keyOf: KeyOf = (typeId, id) => (typeId === 'recurrence-policy' ? policyKeys.get(id) : undefined);
  const products = new Map((await api.list('products')).filter((p) => p.key?.startsWith('mcf-')).map((p) => [p.key as string, p]));
  for (const def of PRODUCTS) {
    const p = products.get(def.key);
    if (!p) { problems.push(`product ${def.key}: missing`); continue; }
    problems.push(...checkProduct(p, def, keyOf));
  }

  // inventory (the rule is deterministic)
  const haveInv = new Map((await api.list('inventory')).map((i) => [i.key as string, i]));
  const wantInv = inventoryDrafts();
  const missingInv = wantInv.filter((i) => !haveInv.has(i.key as string));
  if (missingInv.length) problems.push(`inventory: ${missingInv.length} of ${wantInv.length} entries missing (first: ${missingInv[0]?.key})`);
  const wrongInv = wantInv.filter((i) => haveInv.has(i.key as string) && haveInv.get(i.key as string)?.quantityOnStock !== i.quantityOnStock);
  if (wrongInv.length) problems.push(`inventory: ${wrongInv.length} entries differ from the rule (first: ${wrongInv[0]?.key})`);

  // discounts and codes
  for (const d of productDiscountDrafts()) await need('product-discounts', d.key as string);
  for (const d of cartDiscountDrafts) await need('cart-discounts', d.key as string);
  for (const d of discountCodeDrafts) {
    const r = await need('discount-codes', d.key as string);
    if (r && r.code !== d.code) problems.push(`discount code ${d.key}: code is ${String(r.code)}, expected ${d.code}`);
  }

  // people
  const customers = await api.list('customers');
  for (const c of CUSTOMERS) {
    const r = customers.find((x) => x.key === c.key);
    if (!r || r.email !== c.email) problems.push(`customer ${c.email}: missing`);
    else if (r.isEmailVerified !== true) problems.push(`customer ${c.email}: email not verified`);
  }
  await need('shopping-lists', shoppingListDraft().key as string);

  // reviews and statistics
  const reviews = await api.list('reviews');
  const byKey = new Map(reviews.map((r) => [r.key, r]));
  for (const d of REVIEWS) {
    const r = byKey.get(d.key);
    if (!r) problems.push(`review ${d.key}: missing`);
    else {
      if (r.rating !== d.rating) problems.push(`review ${d.key}: rating ${String(r.rating)} instead of ${d.rating}`);
      if (r.includedInStatistics !== true) problems.push(`review ${d.key}: not included in statistics (state must be ${K.reviewApproved})`);
    }
  }
  for (const def of PRODUCTS) {
    const p = products.get(def.key);
    if (p) problems.push(...checkReviewStatistics(p, expectedStats(def.key)));
  }
  return problems;
}

async function main() {
  const { api } = await getAdmin();
  const problems = await verifySeed(api);
  if (problems.length > 0) {
    console.error(problems.map((p) => `PROBLEM ${p}`).join('\n'));
    console.error(`verify: FAILED (${problems.length})`);
    process.exit(1);
  }
  console.log('verify: OK');
  console.log('note: Product Search results are not probed here; check them with the commercetools MCP or the storefront.');
}

if (isMainModule(import.meta.url)) main().catch(fail);
