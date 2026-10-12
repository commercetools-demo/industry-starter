'use client';

// Client side of the catalog screens (workstream T): SWR reads and plain async writes against `/api/seller/**`. This is the only
// place the screens reach the network (hook-only fetching). The server re-checks the store and the role on every call.
import useSWR, { useSWRConfig } from 'swr';
import { useCallback } from 'react';
import type {
  AssortmentFilter,
  AssortmentPage,
  BulkPreviewRow,
  CategoryOption,
  ChainInfo,
  DiscountKind,
  DiscountView,
  Impact,
  PriceChange,
  PricePage,
  TailoringDetail,
  TailoringRow,
} from '@/lib/catalog/types';
import type { CartRule, ProductRule } from '@/lib/catalog/discount-rule';
import { swrFetcher, type ApiResult } from './http';

type Body = Record<string, unknown>;

/** Failure bodies keep their machine code and extra fields (violations, count, issues) for the screens. */
export interface CatalogResult<T> extends ApiResult<T> {
  details?: Record<string, unknown>;
}

async function parse<T>(response: Response): Promise<CatalogResult<T>> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // an empty or non-JSON body
  }
  const body = (data ?? {}) as Record<string, unknown>;
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? (data as T) : null,
    error: typeof body.error === 'string' ? body.error : undefined,
    code: typeof body.code === 'string' ? body.code : undefined,
    details: response.ok ? undefined : body,
  };
}

export async function sendJson<T = unknown>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: Body): Promise<CatalogResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    return await parse<T>(response);
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function sendForm<T = unknown>(url: string, form: FormData): Promise<CatalogResult<T>> {
  try {
    return await parse<T>(await fetch(url, { method: 'POST', body: form, credentials: 'same-origin' }));
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

// ---- assortment ----

export interface AssortmentParams {
  state?: AssortmentFilter;
  text?: string;
  categoryId?: string;
  offset: number;
  limit: number;
}

export function useAssortment(storeKey: string, p: AssortmentParams) {
  const url = `/api/seller/assortment?${query({ storeKey, state: p.state === 'all' ? undefined : p.state, text: p.text, categoryId: p.categoryId, offset: p.offset, limit: p.limit })}`;
  return useSWR<AssortmentPage>(['catalog', 'assortment', storeKey, url], () => swrFetcher<AssortmentPage>(url));
}

export function useChain(storeKey: string) {
  return useSWR<ChainInfo>(['catalog', 'chain', storeKey], () => swrFetcher<ChainInfo>(`/api/seller/assortment/chain?${query({ storeKey })}`));
}

export function useCategories(storeKey: string) {
  return useSWR<CategoryOption[]>(['catalog', 'categories', storeKey], async () => (await swrFetcher<{ categories: CategoryOption[] }>(`/api/seller/catalog/categories?${query({ storeKey })}`)).categories);
}

export type Target = { productIds: string[] } | { filter: { state?: AssortmentFilter; text?: string; categoryId?: string } };

export const assortmentApi = {
  impact: (storeKey: string, productIds: string[]) => sendJson<Impact>('POST', '/api/seller/assortment/impact', { storeKey, productIds }),
  assign: (storeKey: string, target: Target) => sendJson<{ added: number }>('POST', '/api/seller/assortment/assign', { storeKey, ...target }),
  withdraw: (storeKey: string, target: Target, confirmation: { confirm: boolean; expectedCount: number }) => sendJson<{ removed: number }>('POST', '/api/seller/assortment/withdraw', { storeKey, ...target, ...confirmation }),
};

/** Re-reads everything of the catalog area after a write (lists, chain counts). */
export function useRefreshCatalog() {
  const { mutate } = useSWRConfig();
  return useCallback(() => mutate((key) => Array.isArray(key) && key[0] === 'catalog'), [mutate]);
}

// ---- prices ----

export function usePrices(storeKey: string, p: { currency?: 'EUR' | 'USD'; text?: string; offset: number; limit: number }) {
  const url = `/api/seller/prices?${query({ storeKey, currency: p.currency, text: p.text, offset: p.offset, limit: p.limit })}`;
  return useSWR<PricePage>(['catalog', 'prices', storeKey, url], () => swrFetcher<PricePage>(url));
}

export const pricesApi = {
  publish: (storeKey: string, currency: 'EUR' | 'USD', changes: PriceChange[], confirm: boolean) =>
    sendJson<{ written: number; deleted: number }>('PUT', '/api/seller/prices', { storeKey, currency, changes, confirm, expectedCount: changes.length }),
  bulkPreview: (storeKey: string, currency: 'EUR' | 'USD', mode: 'percentOfList' | 'setTo', value: number, filter: { text?: string }) =>
    sendJson<{ rows: BulkPreviewRow[]; invalidCount: number }>('POST', '/api/seller/prices/bulk', { storeKey, currency, mode, value, filter, dryRun: true }),
  bulkPublish: (storeKey: string, currency: 'EUR' | 'USD', mode: 'percentOfList' | 'setTo', value: number, filter: { text?: string }, expectedCount: number) =>
    sendJson<{ written: number; deleted: number }>('POST', '/api/seller/prices/bulk', { storeKey, currency, mode, value, filter, dryRun: false, confirm: true, expectedCount }),
  importPreview: (storeKey: string, currency: 'EUR' | 'USD', csv: string) =>
    sendJson<{ rows: { sku: string; listCent: number | null; newCent: number | null; belowListPercent: number; aboveListPercent: number; problem?: string }[]; invalidCount: number }>('POST', '/api/seller/prices/import', { storeKey, currency, csv, dryRun: true }),
  importPublish: (storeKey: string, currency: 'EUR' | 'USD', csv: string, expectedCount: number) =>
    sendJson<{ written: number; deleted: number }>('POST', '/api/seller/prices/import', { storeKey, currency, csv, dryRun: false, confirm: true, expectedCount }),
};

// ---- tailoring ----

export function useTailoringList(storeKey: string, p: { text?: string; offset: number; limit: number }) {
  const url = `/api/seller/tailoring?${query({ storeKey, text: p.text, offset: p.offset, limit: p.limit })}`;
  return useSWR<{ rows: TailoringRow[]; total: number }>(['catalog', 'tailoring', storeKey, url], () => swrFetcher(url));
}

export function useTailoringDetail(storeKey: string, productId: string | null) {
  return useSWR<TailoringDetail>(productId ? ['catalog', 'tailoring-detail', storeKey, productId] : null, () =>
    swrFetcher<TailoringDetail>(`/api/seller/tailoring/${encodeURIComponent(productId as string)}?${query({ storeKey })}`),
  );
}

export interface TailoringPayload {
  name?: Record<string, string>;
  description?: Record<string, string>;
  images?: { url: string; label?: string }[];
}

export const tailoringApi = {
  save: (storeKey: string, productId: string, payload: TailoringPayload) => sendJson<{ published: true }>('PUT', `/api/seller/tailoring/${encodeURIComponent(productId)}`, { storeKey, ...payload }),
  reset: (storeKey: string, productId: string) => sendJson<{ reset: true }>('POST', `/api/seller/tailoring/${encodeURIComponent(productId)}/reset`, { storeKey }),
  upload: (storeKey: string, productId: string, file: File) => {
    const form = new FormData();
    form.set('storeKey', storeKey);
    form.set('file', file);
    return sendForm<{ url: string; width: number; height: number }>(`/api/seller/tailoring/${encodeURIComponent(productId)}/image`, form);
  },
  checkUrl: (storeKey: string, productId: string, url: string) => sendJson<{ url: string; width: number; height: number }>('POST', `/api/seller/tailoring/${encodeURIComponent(productId)}/image-url`, { storeKey, url }),
};

// ---- discounts ----

export function useDiscounts(storeKey: string, kind: DiscountKind) {
  return useSWR<DiscountView[]>(['catalog', 'discounts', storeKey, kind], async () => (await swrFetcher<{ discounts: DiscountView[] }>(`/api/seller/discounts?${query({ storeKey, kind })}`)).discounts);
}

export function useDiscount(storeKey: string, kind: DiscountKind, id: string) {
  return useSWR<DiscountView & { rule: ProductRule | CartRule | null; predicate: string }>(['catalog', 'discount', storeKey, kind, id], () => swrFetcher(`/api/seller/discounts/${kind}/${encodeURIComponent(id)}?${query({ storeKey })}`));
}

export const discountApi = {
  createDraft: (storeKey: string, kind: DiscountKind) => sendJson<DiscountView>('POST', `/api/seller/discounts/${kind}`, { storeKey }),
  save: (storeKey: string, kind: DiscountKind, id: string, rule: ProductRule | CartRule) => sendJson<DiscountView>('PATCH', `/api/seller/discounts/${kind}/${encodeURIComponent(id)}`, { storeKey, rule }),
  setActive: (storeKey: string, kind: DiscountKind, id: string, isActive: boolean) => sendJson<DiscountView>('POST', `/api/seller/discounts/${kind}/${encodeURIComponent(id)}/active`, { storeKey, isActive }),
  remove: (storeKey: string, kind: DiscountKind, id: string) => sendJson('DELETE', `/api/seller/discounts/${kind}/${encodeURIComponent(id)}?${query({ storeKey })}`),
  reorder: (storeKey: string, kind: DiscountKind, orderedIds: string[]) => sendJson<{ changed: number }>('PUT', '/api/seller/discounts/priority', { storeKey, kind, orderedIds }),
};
