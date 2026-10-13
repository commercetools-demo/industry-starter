// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Res } from './api';

/** Pure functions that turn "what exists" and "what the seed wants" into update actions ([] means: already in sync). */
export type Action = Record<string, unknown>;
export type KeyOf = (typeId: string, id: string) => string | undefined;

type LStr = Record<string, string> | undefined;

/** Locales of `want` that differ in `have`. */
export const lstringDiffers = (have: LStr, want: LStr): boolean => !!want && Object.entries(want).some(([l, v]) => have?.[l] !== v);

/** Normalises an attribute value so API output and draft input compare equal. */
export function normAttr(v: unknown): unknown {
  if (Array.isArray(v)) {
    const items = v.map(normAttr);
    return items.every((x) => typeof x !== 'object') ? [...items].sort() : items;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('centAmount' in o && 'currencyCode' in o) return `${o.currencyCode}:${o.centAmount}`;
    if ('key' in o && 'label' in o) return o.key;
    return JSON.stringify(o);
  }
  return v;
}

/** Standalone price (Q-003): only the value is ever updated; sku, currency, country and channel are encoded in the seed key. */
export function planStandalonePriceUpdate(existing: Res, draft: { value: { currencyCode: string; centAmount?: number } }): Action[] {
  const have = existing.value as { currencyCode?: string; centAmount?: number } | undefined;
  return have?.centAmount === draft.value.centAmount && have?.currencyCode === draft.value.currencyCode ? [] : [{ action: 'changeValue', value: draft.value }];
}

interface VariantLike {
  id?: number;
  sku?: string;
  images?: { url: string }[];
  attributes?: { name: string; value: unknown }[];
}
interface ProductLike {
  name?: LStr;
  description?: LStr;
  masterVariant: VariantLike;
}

/** Update actions that bring a product's STAGED data to the draft; `publish` is appended when anything changed. */
export function planProductUpdate(existing: Res, draft: ProductLike & { publish?: boolean }): Action[] {
  const staged = ((existing.masterData as { staged: ProductLike }).staged);
  const out: Action[] = [];
  const sku = draft.masterVariant.sku;
  if (lstringDiffers(staged.name, draft.name)) out.push({ action: 'changeName', name: draft.name, staged: true });
  if (lstringDiffers(staged.description, draft.description)) out.push({ action: 'setDescription', description: draft.description, staged: true });

  for (const a of draft.masterVariant.attributes ?? []) {
    const cur = staged.masterVariant.attributes?.find((x) => x.name === a.name);
    if (JSON.stringify(normAttr(cur?.value)) !== JSON.stringify(normAttr(a.value))) out.push({ action: 'setAttribute', sku, name: a.name, value: a.value, staged: true });
  }

  const wantImages = (draft.masterVariant.images ?? []) as { url: string; dimensions?: unknown }[];
  const haveUrls = (staged.masterVariant.images ?? []).map((i) => i.url);
  if (wantImages.length > 0 && JSON.stringify(haveUrls) !== JSON.stringify(wantImages.map((i) => i.url))) {
    for (const url of haveUrls) out.push({ action: 'removeImage', sku, imageUrl: url, staged: true });
    for (const image of wantImages) out.push({ action: 'addExternalImage', sku, image, staged: true });
  }
  if (out.length > 0 && draft.publish) out.push({ action: 'publish' });
  return out;
}

export function planCategoryUpdate(existing: Res, draft: { name?: LStr }): Action[] {
  return lstringDiffers(existing.name as LStr, draft.name) ? [{ action: 'changeName', name: draft.name }] : [];
}

export function planChannelUpdate(existing: Res, draft: { name?: LStr }): Action[] {
  return lstringDiffers(existing.name as LStr, draft.name) ? [{ action: 'changeName', name: draft.name }] : [];
}

const sameSet = (a: string[], b: string[]): boolean => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

interface StoreLike {
  name?: LStr;
  languages?: string[];
  countries?: { code: string }[];
  distributionChannels?: { key?: string; id?: string }[];
  supplyChannels?: { key?: string; id?: string }[];
  productSelections?: { productSelection: { key?: string; id?: string }; active?: boolean }[];
}

export function planStoreUpdate(existing: Res, draft: StoreLike, keyOf: KeyOf): Action[] {
  const e = existing as unknown as StoreLike;
  const keys = (typeId: string, refs?: { key?: string; id?: string }[]) => (refs ?? []).map((r) => r.key ?? keyOf(typeId, r.id ?? '') ?? r.id ?? '');
  const out: Action[] = [];
  if (lstringDiffers(e.name, draft.name)) out.push({ action: 'setName', name: draft.name });
  if (draft.languages && !sameSet(e.languages ?? [], draft.languages)) out.push({ action: 'setLanguages', languages: draft.languages });
  if (draft.countries && !sameSet((e.countries ?? []).map((c) => c.code), draft.countries.map((c) => c.code))) out.push({ action: 'setCountries', countries: draft.countries });
  if (draft.distributionChannels && !sameSet(keys('channel', e.distributionChannels), keys('channel', draft.distributionChannels))) out.push({ action: 'setDistributionChannels', distributionChannels: draft.distributionChannels });
  if (draft.supplyChannels && !sameSet(keys('channel', e.supplyChannels), keys('channel', draft.supplyChannels))) out.push({ action: 'setSupplyChannels', supplyChannels: draft.supplyChannels });
  if (draft.productSelections) {
    const have = (e.productSelections ?? []).map((s) => `${s.productSelection.key ?? keyOf('product-selection', s.productSelection.id ?? '') ?? s.productSelection.id}:${s.active !== false}`);
    const want = draft.productSelections.map((s) => `${s.productSelection.key}:${s.active !== false}`);
    if (!sameSet(have, want)) out.push({ action: 'setProductSelections', productSelections: draft.productSelections });
  }
  return out;
}

export function planRoleUpdate(existing: Res, draft: { permissions?: string[] }): Action[] {
  return sameSet((existing.permissions as string[]) ?? [], draft.permissions ?? []) ? [] : [{ action: 'setPermissions', permissions: draft.permissions ?? [] }];
}

/** Selection membership: add what is missing, remove what is extra (the selections are owned by the seed). */
export function planSelectionMembers(haveProductIds: string[], wantProductIds: string[]): Action[] {
  const have = new Set(haveProductIds);
  const want = new Set(wantProductIds);
  return [
    ...[...want].filter((id) => !have.has(id)).map((id) => ({ action: 'addProduct', product: { typeId: 'product', id } })),
    ...[...have].filter((id) => !want.has(id)).map((id) => ({ action: 'removeProduct', product: { typeId: 'product', id } })),
  ];
}

export function planInventoryUpdate(existing: Res, draft: { quantityOnStock: number }): Action[] {
  return existing.quantityOnStock === draft.quantityOnStock ? [] : [{ action: 'changeQuantity', quantity: draft.quantityOnStock }];
}

export function planDiscountUpdate(kind: 'product-discounts' | 'cart-discounts', existing: Res, draft: { sortOrder?: string; isActive?: boolean; predicate?: string; cartPredicate?: string; stores?: { key?: string }[] }, keyOf?: KeyOf): Action[] {
  const out: Action[] = [];
  if (kind === 'cart-discounts' && draft.stores) {
    const have = ((existing.stores as { key?: string; id?: string }[]) ?? []).map((s) => s.key ?? keyOf?.('store', s.id ?? '') ?? s.id ?? '');
    const want = draft.stores.map((s) => s.key ?? '');
    if (!sameSet(have, want)) out.push({ action: 'setStores', stores: draft.stores.map((s) => ({ typeId: 'store', key: s.key })) });
  }
  if (draft.sortOrder !== undefined && existing.sortOrder !== draft.sortOrder) out.push({ action: 'changeSortOrder', sortOrder: draft.sortOrder });
  if (draft.isActive !== undefined && existing.isActive !== draft.isActive) out.push({ action: 'changeIsActive', isActive: draft.isActive });
  if (kind === 'product-discounts' && draft.predicate !== undefined && existing.predicate !== draft.predicate) out.push({ action: 'changePredicate', predicate: draft.predicate });
  if (kind === 'cart-discounts' && draft.cartPredicate !== undefined && existing.cartPredicate !== draft.cartPredicate) out.push({ action: 'changeCartPredicate', cartPredicate: draft.cartPredicate });
  return out;
}

/** Review text and rating (the target and key never change). */
export function planReviewUpdate(existing: Res, draft: { rating?: number; title?: string; text?: string }): Action[] {
  const out: Action[] = [];
  if (draft.rating !== undefined && existing.rating !== draft.rating) out.push({ action: 'setRating', rating: draft.rating });
  if (draft.title !== undefined && existing.title !== draft.title) out.push({ action: 'setTitle', title: draft.title });
  if (draft.text !== undefined && existing.text !== draft.text) out.push({ action: 'setText', text: draft.text });
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

interface TailoringData { name?: LStr; description?: LStr; variants?: { sku?: string; images?: { url: string }[] }[] }

/** Tailored text and images (Q-T06): every change is published in the same request, there is no review step. */
export function planTailoringUpdate(existing: Res, draft: { name?: LStr; description?: LStr; variants?: { sku: string; images?: { url: string; dimensions?: unknown }[] }[] }): Action[] {
  const staged = (existing.staged as TailoringData | undefined) ?? {};
  const out: Action[] = [];
  if (lstringDiffers(staged.name, draft.name)) out.push({ action: 'setName', name: draft.name });
  if (lstringDiffers(staged.description, draft.description)) out.push({ action: 'setDescription', description: draft.description });
  for (const v of draft.variants ?? []) {
    const haveUrls = (staged.variants?.find((x) => x.sku === v.sku)?.images ?? []).map((i) => i.url);
    const wantUrls = (v.images ?? []).map((i) => i.url);
    if (JSON.stringify(haveUrls) === JSON.stringify(wantUrls)) continue;
    out.push({ action: 'setImages', sku: v.sku, images: v.images ?? [] });
  }
  if (out.length > 0) out.push({ action: 'publish' });
  return out;
}

export function planBusinessUnitUpdate(existing: Res, draft: { name: string; storeMode?: string; stores?: { key?: string }[]; associates?: { customer: { key?: string; id?: string }; associateRoleAssignments: unknown[] }[] }, keyOfCustomer: (id: string) => string | undefined, keyOfStore?: (id: string) => string | undefined): Action[] {
  const out: Action[] = [];
  if (existing.name !== draft.name) out.push({ action: 'changeName', name: draft.name });
  const want = (draft.stores ?? []).map((s) => s.key ?? '');
  const wantStores = want.map((key) => ({ typeId: 'store', key }));
  if (draft.storeMode && existing.storeMode !== draft.storeMode) {
    // Switching mode is one action: Explicit carries its stores (a separate setStores after it is rejected).
    out.push({ action: 'setStoreMode', storeMode: draft.storeMode, ...(draft.storeMode === 'Explicit' ? { stores: wantStores } : {}) });
  } else if (draft.stores) {
    const haveStores = ((existing.stores as { key?: string; id?: string }[]) ?? []).map((s) => s.key ?? keyOfStore?.(s.id ?? '') ?? s.id ?? '');
    if (!sameSet(haveStores, want)) out.push({ action: 'setStores', stores: wantStores });
  }
  const have = new Set(((existing.associates as { customer: { id: string } }[]) ?? []).map((a) => keyOfCustomer(a.customer.id) ?? a.customer.id));
  for (const a of draft.associates ?? []) {
    if (!have.has(a.customer.key ?? '')) out.push({ action: 'addAssociate', associate: a });
  }
  return out;
}
