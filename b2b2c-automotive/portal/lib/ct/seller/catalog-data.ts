// Shared reads of workstream T (admin client): product selections, the `mau-assortment/<storeKey>` custom object, product
// projections and categories. Short in-memory caches (30 s) keep a page load to a handful of calls; a selection is cached per
// `id:version`, so a write (which bumps the version) is never read stale.
import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import type { CategoryOption, ImageRef, LocalizedText } from '@/lib/catalog/types';
import { catalogRoot } from './catalog-root';
import { chunk, isNotFound } from './versioned';

export const MASTER_SELECTION_KEY = 'mau-sel-malva-master';
export const ASSORTMENT_CONTAINER = 'mau-assortment';
export const ASSORTMENT_ROW_CAP = 5000;

const TTL_MS = 30_000;

export interface AssortmentObject {
  storeKey: string;
  withdrawnByReseller: { sku: string; reason: string }[];
  blockedUpstream: { sku: string; by: string; reason: string }[];
  preRelease: string[];
  pendingReview: string[];
  /** Any other field of the object, written back unchanged. */
  [extra: string]: unknown;
}

export interface ProductInfo {
  id: string;
  key: string;
  sku: string;
  /** Id of the master variant (tailored variants are matched by id). */
  variantId: number;
  name: LocalizedText;
  description: LocalizedText;
  categoryIds: string[];
  ownerStore?: string;
  reviewState?: string;
  images: ImageRef[];
}

interface Timed<T> {
  value: T;
  expires: number;
}
const selectionCache = new Map<string, Timed<Set<string>>>();
const productCache = new Map<string, Timed<ProductInfo>>();
let categoryCache: Timed<CategoryOption[]> | undefined;

export function clearCatalogCaches(): void {
  selectionCache.clear();
  productCache.clear();
  categoryCache = undefined;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function parseAssortmentObject(storeKey: string, raw: unknown): AssortmentObject {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const withdrawn = Array.isArray(v.withdrawnByReseller) ? (v.withdrawnByReseller as { sku?: unknown; reason?: unknown }[]).filter((w) => typeof w?.sku === 'string').map((w) => ({ sku: w.sku as string, reason: typeof w.reason === 'string' ? w.reason : '' })) : [];
  const blocked = Array.isArray(v.blockedUpstream)
    ? (v.blockedUpstream as { sku?: unknown; by?: unknown; reason?: unknown }[]).filter((b) => typeof b?.sku === 'string').map((b) => ({ sku: b.sku as string, by: typeof b.by === 'string' ? b.by : '', reason: typeof b.reason === 'string' ? b.reason : '' }))
    : [];
  return { ...v, storeKey, withdrawnByReseller: withdrawn, blockedUpstream: blocked, preRelease: strings(v.preRelease), pendingReview: strings(v.pendingReview) };
}

/** The store's state object; a store without one reads as "nothing withdrawn, nothing blocked". `version` is undefined when absent. */
export async function readAssortmentObject(storeKey: string): Promise<{ value: AssortmentObject; version?: number }> {
  const root = await catalogRoot();
  try {
    const { body } = await root.customObjects().withContainerAndKey({ container: ASSORTMENT_CONTAINER, key: storeKey }).get().execute();
    return { value: parseAssortmentObject(storeKey, body.value), version: body.version };
  } catch (error) {
    if (isNotFound(error)) return { value: parseAssortmentObject(storeKey, {}) };
    throw error;
  }
}

/** Product ids of a selection (paged, cached per id and version). */
export async function selectionProductIds(selectionKey: string): Promise<Set<string>> {
  const root = await catalogRoot();
  const selection = (await root.productSelections().withKey({ key: selectionKey }).get().execute()).body;
  const cacheKey = `${selection.id}:${selection.version}`;
  const hit = selectionCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;
  const ids = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const page = (await root.productSelections().withKey({ key: selectionKey }).products().get({ queryArgs: { limit: 500, offset } }).execute()).body;
    for (const entry of page.results) ids.add(entry.product.id);
    if (offset + page.results.length >= (page.total ?? 0) || page.results.length === 0) break;
  }
  selectionCache.set(cacheKey, { value: ids, expires: Date.now() + TTL_MS });
  return ids;
}

const attr = (p: ProductProjection, name: string): string | undefined => {
  const value = p.masterVariant.attributes?.find((a) => a.name === name)?.value as unknown;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { key?: unknown }).key === 'string') return (value as { key: string }).key;
  return undefined;
};

export function toProductInfo(p: ProductProjection): ProductInfo {
  return {
    id: p.id,
    key: p.key ?? p.id,
    sku: p.masterVariant.sku ?? '',
    variantId: p.masterVariant.id,
    name: { ...(p.name ?? {}) },
    description: { ...(p.description ?? {}) },
    categoryIds: (p.categories ?? []).map((c) => c.id),
    ownerStore: attr(p, 'owner-store'),
    reviewState: attr(p, 'review-state'),
    images: (p.masterVariant.images ?? []).map((i) => ({ url: i.url, ...(i.label ? { label: i.label } : {}), width: i.dimensions.w, height: i.dimensions.h })),
  };
}

function remember(infos: ProductInfo[]): void {
  const expires = Date.now() + TTL_MS;
  for (const info of infos) productCache.set(info.id, { value: info, expires });
}

/** Product facts for ids (one call per 100 ids; unknown ids are absent from the result). */
export async function hydrateByIds(ids: readonly string[]): Promise<Map<string, ProductInfo>> {
  const out = new Map<string, ProductInfo>();
  const missing: string[] = [];
  for (const id of new Set(ids)) {
    const hit = productCache.get(id);
    if (hit && hit.expires > Date.now()) out.set(id, hit.value);
    else missing.push(id);
  }
  if (missing.length) {
    const root = await catalogRoot();
    for (const part of chunk(missing, 100)) {
      const { body } = await root.productProjections().get({ queryArgs: { where: 'id in :ids', 'var.ids': part, staged: false, limit: 100 } }).execute();
      const infos = body.results.map(toProductInfo);
      remember(infos);
      for (const info of infos) out.set(info.id, info);
    }
  }
  return out;
}

export async function hydrateBySkus(skus: readonly string[]): Promise<Map<string, ProductInfo>> {
  const out = new Map<string, ProductInfo>();
  if (skus.length === 0) return out;
  const root = await catalogRoot();
  for (const part of chunk([...new Set(skus)], 100)) {
    const { body } = await root.productProjections().get({ queryArgs: { where: 'masterVariant(sku in :skus)', 'var.skus': part, staged: false, limit: 100 } }).execute();
    const infos = body.results.map(toProductInfo);
    remember(infos);
    for (const info of infos) out.set(info.sku, info);
  }
  return out;
}

export async function listCategories(): Promise<CategoryOption[]> {
  if (categoryCache && categoryCache.expires > Date.now()) return categoryCache.value;
  const root = await catalogRoot();
  const results: CategoryOption[] = [];
  for (let offset = 0; ; offset += 500) {
    const { body } = await root.categories().get({ queryArgs: { limit: 500, offset } }).execute();
    for (const c of body.results) results.push({ id: c.id, key: c.key ?? c.id, name: { ...c.name }, ...(c.parent ? { parentId: c.parent.id } : {}) });
    if (offset + body.results.length >= (body.total ?? 0) || body.results.length === 0) break;
  }
  categoryCache = { value: results, expires: Date.now() + TTL_MS };
  return results;
}

/** `categoryId` and all its descendants. */
export function categoryAndDescendants(categories: readonly CategoryOption[], categoryId: string): Set<string> {
  const out = new Set([categoryId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return out;
}
