// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Res } from './api';
import { CONTRACT_KEYS, K } from './data/base';
import { assortmentKeys, localReviewObjects, masterKeys } from './data/assortment';
import { reviewDrafts } from './data/reviews';
import { allProductDrafts, loadImages } from './data/catalog';
import { ALL_GROUP_PATHS, categoryDrafts, categoryKeyOf } from './data/categories';
import { THEME_CONTAINER, THEME_KEY, TAILORINGS, MALVA_BANNERS_KEY, MALVA_BANNER_SLOTS } from './data/content';
import { typeDrafts } from './data/custom-types';
import { PRODUCT_DISCOUNT_CHANNEL, cartDiscountDrafts, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { BUSINESS_UNITS, CUSTOMERS, STORES, channelDrafts, roleDrafts } from './data/org';
import { PARTS, POPULARITY, relatedSkus } from './data/parts';
import { priceDefs, type PriceDef } from './data/prices';
import { productTypeDrafts } from './data/product-types';
import { stateDrafts } from './data/states';
import { shippingMethodDrafts, zoneDrafts } from './data/tax-shipping';
import { VEHICLES, vehicleObjectKey } from './data/vehicles';
import { SELECTION_FOR_STORE } from './drafts';
import { fail, getAdmin, isCleanUrl, isMainModule } from './lib';
import { tailoringKey } from './data/content';

/**
 * Read-back checks after a seed run. Exits 1 on any mismatch. Needs the same API client as the seed (read access).
 *   npm run verify
 */
interface Variant { sku?: string; prices?: unknown[]; images?: { url: string }[]; attributes?: { name: string; value: unknown }[] }

/** Problems with one seeded product (pure; unit tested). All prices are standalone, so a product carries no embedded price. */
export function checkProduct(p: Res, wantPublished: boolean): string[] {
  const out: string[] = [];
  const key = p.key ?? '(no key)';
  const md = p.masterData as { published: boolean; current: { masterVariant: Variant }; staged: { masterVariant: Variant } };
  if (wantPublished && !md.published) out.push(`${key}: not published`);
  const v = (md.published ? md.current : md.staged).masterVariant;
  const attr = (n: string) => v.attributes?.find((a) => a.name === n)?.value;
  if (p.priceMode !== 'Standalone') out.push(`${key}: priceMode must be Standalone`);
  if ((v.prices ?? []).length > 0) out.push(`${key}: has embedded prices, all prices must be standalone`);
  for (const img of v.images ?? []) if (!isCleanUrl(img.url)) out.push(`${key}: image URL is not clean: ${img.url}`);
  if (p.productType && key.startsWith('mau-part-')) {
    for (const n of ['part-number', 'brand', 'quality-tier', 'warranty-months']) if (attr(n) === undefined) out.push(`${key}: attribute ${n} missing`);
    const sku = v.sku ?? '';
    if (POPULARITY[sku] !== undefined && attr('popularity-rank') !== POPULARITY[sku]) out.push(`${key}: popularity-rank must be ${POPULARITY[sku]}`);
    const related = relatedSkus(sku);
    if (related.length > 0 && JSON.stringify([...((attr('related-skus') as string[]) ?? [])].sort()) !== JSON.stringify([...related].sort())) out.push(`${key}: related-skus differ from the seed`);
    if (attr('universal-fit') !== true && !(Array.isArray(attr('fitment-keys')) && (attr('fitment-keys') as unknown[]).length > 0)) out.push(`${key}: neither fitment-keys nor universal-fit`);
  }
  return out;
}

interface PriceRes { key?: string; sku?: string; value?: { currencyCode: string; centAmount: number }; country?: string; channel?: { id: string } }

/**
 * Problems with the standalone prices (pure; unit tested). Price sanity is the only rule: a whole number of cents above
 * zero (there is no price floor, Q-T03). Every priced SKU needs an EUR/DE and a USD/US base price (no channel); a
 * pre-release part must have no price at all.
 */
export function checkPrices(have: PriceRes[], want: PriceDef[], keyOf: (typeId: string, id: string) => string | undefined): string[] {
  const out: string[] = [];
  const byKey = new Map(have.map((p) => [p.key, p]));
  for (const w of want) {
    const p = byKey.get(w.key);
    if (!p) { out.push(`standalone price ${w.key}: missing`); continue; }
    if (p.sku !== w.sku) out.push(`standalone price ${w.key}: sku ${p.sku} instead of ${w.sku}`);
    if (p.value?.currencyCode !== w.currency || p.value?.centAmount !== w.cents) out.push(`standalone price ${w.key}: value ${p.value?.centAmount} ${p.value?.currencyCode}, expected ${w.cents} ${w.currency}`);
    if (p.country !== w.country) out.push(`standalone price ${w.key}: country ${p.country} instead of ${w.country}`);
    const channel = p.channel ? keyOf('channel', p.channel.id) : undefined;
    if (channel !== w.channelKey) out.push(`standalone price ${w.key}: channel ${channel ?? 'none'} instead of ${w.channelKey ?? 'none'}`);
  }
  for (const p of have) {
    const cents = p.value?.centAmount;
    if (cents === undefined || !Number.isInteger(cents) || cents <= 0) out.push(`standalone price ${p.key}: amount must be a whole number of cents above 0`);
  }
  const priced = new Set(want.map((w) => w.sku));
  for (const part of PARTS.filter((x) => x.eur === null)) if (have.some((p) => p.sku === part.sku) || priced.has(part.sku)) out.push(`${part.sku}: pre-release part must have no price`);
  for (const part of PARTS.filter((x) => x.eur !== null)) {
    for (const [currency, country] of [['EUR', 'DE'], ['USD', 'US']] as const) {
      if (!want.some((w) => w.sku === part.sku && w.currency === currency && w.country === country && !w.channelKey)) out.push(`${part.sku}: no ${currency} base price defined`);
    }
  }
  return out;
}

export async function verifySeed(api: Api): Promise<string[]> {
  const problems: string[] = [];
  const need = async (kind: Parameters<Api['getByKey']>[0], key: string): Promise<Res | undefined> => {
    const r = await api.getByKey(kind, key);
    if (!r) problems.push(`${kind} ${key}: missing`);
    return r;
  };

  // project
  const project = await api.getProject();
  if (project.searchIndexing?.productsSearch?.status !== 'Activated') problems.push('project: Product Search indexing (ProductsSearch) is not Activated');
  if (project.carts?.countryTaxRateFallbackEnabled !== true) problems.push('project: countryTaxRateFallbackEnabled is not true');
  for (const [field, wanted] of [['languages', ['de-DE', 'en-US']], ['countries', ['DE', 'US']], ['currencies', ['EUR', 'USD']]] as const) {
    const missing = wanted.filter((x) => !(project[field] as string[]).includes(x));
    if (missing.length) problems.push(`project: ${field} lacks ${missing.join(', ')}`);
  }

  // platform model
  const tax = await need('tax-categories', 'mau-tax-parts');
  const rates = ((tax?.rates as { country: string; amount: number }[]) ?? []);
  for (const [country, amount] of [['DE', 0.19], ['GB', 0.2], ['US', 0]] as const) if (tax && rates.find((r) => r.country === country)?.amount !== amount) problems.push(`tax category mau-tax-parts: ${country} rate must be ${amount}`);
  for (const z of zoneDrafts) await need('zones', z.key as string);
  for (const s of shippingMethodDrafts) await need('shipping-methods', s.key as string);
  for (const t of productTypeDrafts) await need('product-types', t.key as string);
  for (const t of typeDrafts) await need('types', t.key);
  for (const s of stateDrafts) await need('states', s.key);
  for (const k of CONTRACT_KEYS) if (!typeDrafts.some((t) => t.key === k) && !stateDrafts.some((s) => s.key === k)) problems.push(`contract key ${k}: not defined by the seed`);
  for (const c of channelDrafts) await need('channels', c.key);
  for (const r of recurrencePolicyDrafts) await need('recurrence-policies', r.key);
  for (const r of roleDrafts) {
    const have = await need('associate-roles', r.key);
    const missing = (r.permissions ?? []).filter((x) => !((have?.permissions as string[]) ?? []).includes(x));
    if (have && missing.length) problems.push(`associate role ${r.key}: missing permissions ${missing.join(', ')}`);
  }

  // categories: 3 levels
  const cats = new Map<string, Res>();
  for (const c of categoryDrafts) { const r = await need('categories', c.key as string); if (r) cats.set(c.key as string, r); }
  for (const g of ALL_GROUP_PATHS) {
    const r = cats.get(categoryKeyOf(g));
    if (r && ((r.ancestors as unknown[]) ?? []).length !== 2) problems.push(`category ${r.key}: must be at level 3 (root > system > group)`);
  }

  // products
  const idKeys = new Map<string, Map<string, string>>();
  for (const [typeId, kind] of [['channel', 'channels'], ['product-selection', 'product-selections']] as const) {
    idKeys.set(typeId, new Map((await api.list(kind)).filter((r) => r.key).map((r) => [r.id, r.key as string])));
  }
  const keyOf = (typeId: string, id: string) => idKeys.get(typeId)?.get(id);
  const images = loadImages('product-images.json');
  const products = new Map((await api.list('products')).filter((p) => p.key?.startsWith('mau-')).map((p) => [p.key as string, p]));
  const drafts = allProductDrafts(images);
  for (const d of drafts) {
    const p = products.get(d.key as string);
    if (!p) { problems.push(`product ${d.key}: missing`); continue; }
    problems.push(...checkProduct(p, d.publish === true));
  }

  // standalone prices (Q-003): only the seed's own SKUs and keys are compared
  const wantPrices = priceDefs();
  const seededSkus = new Set(drafts.map((d) => d.masterVariant?.sku));
  const havePrices = (await api.list('standalone-prices')).filter((p) => seededSkus.has(p.sku as string)) as PriceRes[];
  problems.push(...checkPrices(havePrices, wantPrices, keyOf));

  // inventory
  const wantInv = inventoryDrafts();
  const haveInv = new Set((await api.list('inventory')).map((i) => i.key));
  const missingInv = wantInv.filter((i) => !haveInv.has(i.key as string));
  if (missingInv.length) problems.push(`inventory: ${missingInv.length} of ${wantInv.length} entries missing (first: ${missingInv[0]?.key})`);

  // stores, channels, selections
  const idByKey = new Map([...products].map(([k, p]) => [k, p.id]));
  const memberSets: Record<string, Set<string>> = {};
  for (const [selKey, expected] of [[K.selMaster, masterKeys()], [K.selNorth, assortmentKeys(K.storeNorth)], [K.selSouth, assortmentKeys(K.storeSouth)]] as const) {
    const sel = await need('product-selections', selKey);
    if (!sel) continue;
    const have = new Set(await api.listSelectionProducts(sel.id));
    memberSets[selKey] = have;
    const want = expected.map((k) => idByKey.get(k)).filter((x): x is string => !!x);
    if (have.size !== want.length || want.some((id) => !have.has(id))) problems.push(`selection ${selKey}: has ${have.size} products, expected ${want.length}`);
  }
  const north = memberSets[K.selNorth];
  const south = memberSets[K.selSouth];
  if (north && south && [...north].every((id) => south.has(id)) && north.size === south.size) problems.push('selections mau-sel-north and mau-sel-south are identical; resellers must differ');
  for (const s of STORES) {
    const store = await need('stores', s.key);
    if (!store) continue;
    const sels = ((store.productSelections as { productSelection: { id: string }; active?: boolean }[]) ?? []);
    const expectedSel = SELECTION_FOR_STORE[s.key];
    if (!sels.some((x) => keyOf('product-selection', x.productSelection.id) === expectedSel && x.active !== false)) problems.push(`store ${s.key}: selection ${expectedSel} not assigned and active`);
    const dist = ((store.distributionChannels as { id: string }[]) ?? []).map((c) => keyOf('channel', c.id));
    for (const c of [s.distribution, ...s.branches]) if (!dist.includes(c)) problems.push(`store ${s.key}: distribution channel ${c} not set`);
    const supply = ((store.supplyChannels as { id: string }[]) ?? []).map((c) => keyOf('channel', c.id));
    for (const b of s.branches) if (!supply.includes(b)) problems.push(`store ${s.key}: branch ${b} not a supply channel`);
    if (!supply.includes(K.supplyMalva)) problems.push(`store ${s.key}: central warehouse not a supply channel`);
  }

  // people
  for (const b of BUSINESS_UNITS) {
    const r = await need('business-units', b.key);
    if (r && ((r.associates as unknown[]) ?? []).length < b.associates.length) problems.push(`business unit ${b.key}: associates missing`);
  }
  const customers = await api.list('customers');
  for (const c of CUSTOMERS) if (!customers.some((x) => x.key === c.key && x.email === c.email)) problems.push(`customer ${c.email}: missing`);

  // discounts and tailoring
  for (const d of productDiscountDrafts) {
    const r = await need('product-discounts', d.key as string);
    if (r && PRODUCT_DISCOUNT_CHANNEL[d.key as string] && !String(r.predicate).includes('channel.id')) problems.push(`product discount ${d.key}: predicate lacks the store channel clause`);
  }
  await refreshStoreKeys(api, idKeys);
  for (const d of cartDiscountDrafts) {
    const r = await need('cart-discounts', d.key as string);
    if (!r) continue;
    const have = ((r.stores as { key?: string; id?: string }[]) ?? []).map((x) => x.key ?? idKeys.get('store')?.get(x.id ?? '') ?? x.id).sort();
    const want = (d.stores ?? []).map((x) => (x as { key?: string }).key).sort();
    if (JSON.stringify(have) !== JSON.stringify(want)) problems.push(`cart discount ${d.key}: stores ${have.join(',') || 'none'} instead of ${want.join(',') || 'none'}`);
  }
  for (const d of reviewDrafts()) {
    const r = await need('reviews', d.key as string);
    if (r && r.rating !== d.rating) problems.push(`review ${d.key}: rating ${String(r.rating)} instead of ${d.rating}`);
  }
  for (const o of localReviewObjects()) if (!(await api.getObject(o.container, o.key))) problems.push(`custom object ${o.container}/${o.key}: missing`);
  for (const d of discountCodeDrafts) await need('discount-codes', d.key as string);
  for (const t of TAILORINGS) {
    const r = await need('product-tailoring', tailoringKey(t.store, t.sku));
    for (const img of (t.images ?? [])) if (!isCleanUrl(img.url)) problems.push(`tailoring ${tailoringKey(t.store, t.sku)}: image URL is not clean: ${img.url}`);
    if (r && (r as { published?: boolean }).published !== true) problems.push(`tailoring ${r.key}: not published (tailoring publishes at once)`);
  }

  // custom objects
  const vehicles = await api.listObjects(K.cVehicles);
  if (vehicles.length !== VEHICLES.length) problems.push(`custom objects ${K.cVehicles}: ${vehicles.length}, expected ${VEHICLES.length}`);
  for (const v of VEHICLES.slice(0, 1)) if (!vehicles.some((o) => o.key === vehicleObjectKey(v))) problems.push(`custom object ${K.cVehicles}/${vehicleObjectKey(v)}: missing`);
  if (!(await api.getObject(THEME_CONTAINER, THEME_KEY))) problems.push(`custom object ${THEME_CONTAINER}/${THEME_KEY}: missing (Contentools default theme)`);
  const banners = (await api.getObject(K.cMalvaSite, MALVA_BANNERS_KEY))?.value as { banners?: { image?: { url?: string } }[] } | undefined;
  if (!banners) problems.push(`custom object ${K.cMalvaSite}/${MALVA_BANNERS_KEY}: missing`);
  else {
    if ((banners.banners ?? []).length < MALVA_BANNER_SLOTS.length) problems.push(`custom object ${K.cMalvaSite}/${MALVA_BANNERS_KEY}: fewer than ${MALVA_BANNER_SLOTS.length} banners`);
    for (const b of banners.banners ?? []) if (!isCleanUrl(b.image?.url ?? '')) problems.push(`${K.cMalvaSite}/${MALVA_BANNERS_KEY}: image URL is not clean: ${b.image?.url}`);
  }
  for (const s of STORES) if (!(await api.getObject(K.cAssortment, s.key))) problems.push(`custom object ${K.cAssortment}/${s.key}: missing`);
  return problems;
}

async function refreshStoreKeys(api: Api, idKeys: Map<string, Map<string, string>>): Promise<void> {
  idKeys.set('store', new Map((await api.list('stores')).filter((r) => r.key).map((r) => [r.id, r.key as string])));
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
  console.log('note: Product Search results are not probed here; check them through the b2b2c-automotive MCP (read_product_search), see SEED-PLAN.md.');
}

if (isMainModule(import.meta.url)) main().catch(fail);
