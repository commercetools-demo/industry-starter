// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Res } from './api';

/** Pure functions that turn "what exists" and "what the seed wants" into update actions ([] means: already in sync). */
export type Action = Record<string, unknown>;
export type KeyOf = (typeId: string, id: string) => string | undefined;

type LStr = Record<string, string> | undefined;
type Ref = { key?: string; id?: string } | undefined;

/** Locales of `want` that differ in `have`. */
export const lstringDiffers = (have: LStr, want: LStr): boolean => !!want && Object.entries(want).some(([l, v]) => have?.[l] !== v);

const stableStringify = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Normalises an attribute value so API output and draft input compare equal (enum {key,label} becomes its key, sets of scalars are sorted). */
export function normAttr(v: unknown): unknown {
  if (Array.isArray(v)) {
    const items = v.map(normAttr);
    return items.every((x) => typeof x !== 'object') ? [...items].sort() : items;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('key' in o && 'label' in o) return o.key;
    return stableStringify(o);
  }
  return v;
}

interface PriceLike {
  value?: { currencyCode?: string; centAmount?: number };
  country?: string;
  recurrencePolicy?: Ref;
}
interface VariantLike {
  id?: number;
  sku?: string;
  images?: { url: string }[];
  attributes?: { name: string; value: unknown }[];
  prices?: PriceLike[];
  recurrencePrices?: PriceLike[];
}
interface ProductLike {
  name?: LStr;
  description?: LStr;
  masterVariant: VariantLike;
  variants?: VariantLike[];
}

/** One text per price: country, currency, amount and recurrence policy key. */
export function priceSigs(v: VariantLike, keyOf: KeyOf): Set<string> {
  const sig = (p: PriceLike) => {
    const policy = p.recurrencePolicy ? (p.recurrencePolicy.key ?? keyOf('recurrence-policy', p.recurrencePolicy.id ?? '') ?? p.recurrencePolicy.id) : undefined;
    return `${p.country ?? '-'}:${p.value?.currencyCode}:${p.value?.centAmount}:${policy ?? 'one-time'}`;
  };
  return new Set([...(v.prices ?? []), ...(v.recurrencePrices ?? [])].map(sig));
}

const allVariants = (p: ProductLike): VariantLike[] => [p.masterVariant, ...(p.variants ?? [])];

/**
 * Update actions that bring a product's STAGED data to the draft; `publish` is appended when anything changed.
 * Covers name, description, attributes and images (scope `core`) and prices including recurrence prices (scope `prices`),
 * per variant by SKU.
 */
export function planProductUpdate(existing: Res, draft: ProductLike & { publish?: boolean }, keyOf: KeyOf, scope: 'core' | 'prices' = 'core'): Action[] {
  const staged = ((existing.masterData as { staged: ProductLike }).staged);
  const out: Action[] = [];
  const core = scope === 'core';
  if (core && lstringDiffers(staged.name, draft.name)) out.push({ action: 'changeName', name: draft.name, staged: true });
  if (core && lstringDiffers(staged.description, draft.description)) out.push({ action: 'setDescription', description: draft.description, staged: true });

  const haveBySku = new Map(allVariants(staged).map((v) => [v.sku, v]));
  for (const want of allVariants(draft)) {
    const sku = want.sku;
    const have = haveBySku.get(sku);
    if (!have) continue; // new variants are not added by the planner (the seed's variants are fixed per product)
    for (const a of core ? (want.attributes ?? []) : []) {
      const cur = have.attributes?.find((x) => x.name === a.name);
      if (JSON.stringify(normAttr(cur?.value)) !== JSON.stringify(normAttr(a.value))) out.push({ action: 'setAttribute', sku, name: a.name, value: a.value, staged: true });
    }
    // Prices: compare as sets; any difference rewrites the variant's prices in one action.
    const wantSigs = priceSigs({ prices: (want.prices ?? []).map((p) => ({ ...p, recurrencePolicy: p.recurrencePolicy })) }, keyOf);
    const haveSigs = priceSigs(have, keyOf);
    if (!core && (wantSigs.size !== haveSigs.size || [...wantSigs].some((s) => !haveSigs.has(s)))) out.push({ action: 'setPrices', sku, prices: want.prices, staged: true });
    // Images: only when the draft has images (no recorded file means: leave images alone).
    const wantUrls = (want.images ?? []).map((i) => i.url);
    const haveUrls = (have.images ?? []).map((i) => i.url);
    if (core && wantUrls.length > 0 && JSON.stringify(haveUrls) !== JSON.stringify(wantUrls)) {
      for (const url of haveUrls.filter((u) => !wantUrls.includes(u))) out.push({ action: 'removeImage', sku, imageUrl: url, staged: true });
      for (const image of (want.images ?? []).filter((i) => !haveUrls.includes(i.url))) out.push({ action: 'addExternalImage', sku, image, staged: true });
    }
  }
  if (out.length > 0 && draft.publish) out.push({ action: 'publish' });
  return out;
}

/** Category name, and one asset per recorded image while the category has none (the API has no setAssets for categories). */
export function planCategoryUpdate(existing: Res, draft: { name?: LStr; assets?: unknown[] }): Action[] {
  const out: Action[] = lstringDiffers(existing.name as LStr, draft.name) ? [{ action: 'changeName', name: draft.name }] : [];
  if ((draft.assets ?? []).length > 0 && ((existing.assets as unknown[]) ?? []).length === 0) for (const asset of draft.assets ?? []) out.push({ action: 'addAsset', asset });
  return out;
}

/** setCustomField for every field of the draft that differs (fields are never removed). */
export function planCustomFields(existing: Res, draft: { custom?: { fields?: Record<string, unknown> } }): Action[] {
  const have = ((existing.custom as { fields?: Record<string, unknown> } | undefined)?.fields) ?? {};
  return Object.entries(draft.custom?.fields ?? {})
    .filter(([name, value]) => stableStringify(have[name]) !== stableStringify(value))
    .map(([name, value]) => ({ action: 'setCustomField', name, value }));
}

export function planChannelUpdate(existing: Res, draft: { name?: LStr; custom?: { fields?: Record<string, unknown> } }): Action[] {
  return [...(lstringDiffers(existing.name as LStr, draft.name) ? [{ action: 'changeName', name: draft.name }] : []), ...planCustomFields(existing, draft)];
}

export function planInventoryUpdate(existing: Res, draft: { quantityOnStock: number }): Action[] {
  return existing.quantityOnStock === draft.quantityOnStock ? [] : [{ action: 'changeQuantity', quantity: draft.quantityOnStock }];
}

export function planDiscountUpdate(kind: 'product-discounts' | 'cart-discounts', existing: Res, draft: { sortOrder?: string; isActive?: boolean; predicate?: string; cartPredicate?: string }): Action[] {
  const out: Action[] = [];
  if (draft.sortOrder !== undefined && existing.sortOrder !== draft.sortOrder) out.push({ action: 'changeSortOrder', sortOrder: draft.sortOrder });
  if (draft.isActive !== undefined && existing.isActive !== draft.isActive) out.push({ action: 'changeIsActive', isActive: draft.isActive });
  if (kind === 'product-discounts' && draft.predicate !== undefined && existing.predicate !== draft.predicate) out.push({ action: 'changePredicate', predicate: draft.predicate });
  if (kind === 'cart-discounts' && draft.cartPredicate !== undefined && existing.cartPredicate !== draft.cartPredicate) out.push({ action: 'changeCartPredicate', cartPredicate: draft.cartPredicate });
  return out;
}

/** Review text and rating (the target and key never change). Reviews carry no state (D-037). */
export function planReviewUpdate(existing: Res, draft: { rating?: number; title?: string; text?: string }, _keyOf?: KeyOf): Action[] {
  const out: Action[] = [];
  if (draft.rating !== undefined && existing.rating !== draft.rating) out.push({ action: 'setRating', rating: draft.rating });
  if (draft.title !== undefined && existing.title !== draft.title) out.push({ action: 'setTitle', title: draft.title });
  if (draft.text !== undefined && existing.text !== draft.text) out.push({ action: 'setText', text: draft.text });
  return out;
}

const sameSet = (a: string[], b: string[]): boolean => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** State name, roles and transitions (by key). */
export function planStateUpdate(existing: Res, draft: { name?: LStr; roles?: string[]; transitions?: { key?: string }[] }, keyOf: KeyOf): Action[] {
  const out: Action[] = [];
  if (lstringDiffers(existing.name as LStr, draft.name)) out.push({ action: 'setName', name: draft.name });
  if (draft.roles && !sameSet((existing.roles as string[]) ?? [], draft.roles)) out.push({ action: 'setRoles', roles: draft.roles });
  if (draft.transitions) {
    const have = ((existing.transitions as Ref[]) ?? []).map((t) => t?.key ?? keyOf('state', t?.id ?? '') ?? t?.id ?? '');
    const want = draft.transitions.map((t) => t.key ?? '');
    if (!sameSet(have, want)) out.push({ action: 'setTransitions', transitions: want.map((key) => ({ typeId: 'state', key })) });
  }
  return out;
}

interface RateLike { id?: string; name?: string; amount?: number; includedInPrice?: boolean; country: string; state?: string }

/** Tax rates are matched by country and state: missing ones are added, differing ones replaced, extra ones left alone. */
export function planTaxUpdate(existing: Res, draft: { rates?: RateLike[] }): Action[] {
  const have = (existing.rates as RateLike[]) ?? [];
  const out: Action[] = [];
  for (const want of draft.rates ?? []) {
    const cur = have.find((r) => r.country === want.country && (r.state ?? '') === (want.state ?? ''));
    if (!cur) out.push({ action: 'addTaxRate', taxRate: want });
    else if (cur.amount !== want.amount || cur.includedInPrice !== want.includedInPrice || cur.name !== want.name) out.push({ action: 'replaceTaxRate', taxRateId: cur.id, taxRate: want });
  }
  return out;
}

interface ZoneRateLike { zone: Ref; shippingRates?: { price: { currencyCode: string; centAmount: number }; freeAbove?: { currencyCode: string; centAmount: number } }[] }

/** Shipping rates per zone: a missing zone is added, a changed price or free-above tier is replaced (remove then add). */
export function planShippingUpdate(existing: Res, draft: { zoneRates?: ZoneRateLike[] }, keyOf: KeyOf): Action[] {
  const have = (existing.zoneRates as ZoneRateLike[]) ?? [];
  const out: Action[] = [];
  const zoneKey = (z: Ref) => z?.key ?? keyOf('zone', z?.id ?? '') ?? z?.id;
  for (const want of draft.zoneRates ?? []) {
    const cur = have.find((z) => zoneKey(z.zone) === want.zone?.key);
    const zone = { typeId: 'zone', key: want.zone?.key };
    if (!cur) {
      out.push({ action: 'addZone', zone });
      for (const shippingRate of want.shippingRates ?? []) out.push({ action: 'addShippingRate', zone, shippingRate });
      continue;
    }
    for (const w of want.shippingRates ?? []) {
      const c = (cur.shippingRates ?? []).find((r) => r.price.currencyCode === w.price.currencyCode);
      const same = c && c.price.centAmount === w.price.centAmount && (c.freeAbove?.centAmount ?? null) === (w.freeAbove?.centAmount ?? null);
      if (same) continue;
      if (c) out.push({ action: 'removeShippingRate', zone, shippingRate: { price: c.price, ...(c.freeAbove ? { freeAbove: c.freeAbove } : {}) } });
      out.push({ action: 'addShippingRate', zone, shippingRate: w });
    }
  }
  return out;
}

/** Field and attribute definitions added later are added to existing types; nothing is ever removed or retyped. */
export function planTypeUpdate(existing: Res, draft: { fieldDefinitions?: { name: string }[] }): Action[] {
  const have = new Set(((existing.fieldDefinitions as { name: string }[]) ?? []).map((f) => f.name));
  return (draft.fieldDefinitions ?? []).filter((f) => !have.has(f.name)).map((fieldDefinition) => ({ action: 'addFieldDefinition', fieldDefinition }));
}

export function planProductTypeUpdate(existing: Res, draft: { attributes?: { name: string }[] }): Action[] {
  const have = new Set(((existing.attributes as { name: string }[]) ?? []).map((a) => a.name));
  return (draft.attributes ?? []).filter((a) => !have.has(a.name)).map((attribute) => ({ action: 'addAttributeDefinition', attribute }));
}
