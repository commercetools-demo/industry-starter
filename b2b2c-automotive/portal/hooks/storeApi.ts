'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Client data of Store & channels (workstream U-05, U-06). SWR keys are `[name, businessUnitKey, ...]` tuples so a unit switch
// refreshes them (see hooks/useUnits.ts). Every call names the session's store; the server checks it again.
import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useViewer } from '@/context/ViewerContext';
import type { BranchInput, CreateBranchInput, StoreLocationInput } from '@/lib/store/schemas';
import type { Branch, ChannelStats, StockPage, StockRow, StoreSettings } from '@/lib/store/types';
import type { PreviewPageStatus } from '@/lib/portal/storefront-urls';
import { postJson, swrFetcher, type ApiResult } from './http';
import { postForm, sendJson } from './sellerHttp';

const q = (storeKey: string) => `storeKey=${encodeURIComponent(storeKey)}`;
const base = '/api/seller/store';

export function useStoreSettings() {
  const { storeKey, businessUnitKey } = useViewer();
  return useSWR<StoreSettings>(['store-settings', businessUnitKey, storeKey], () => swrFetcher<StoreSettings>(`${base}/settings?${q(storeKey)}`), { revalidateOnFocus: false });
}

export function useBranches() {
  const { storeKey, businessUnitKey } = useViewer();
  return useSWR<{ branches: Branch[] }>(['store-branches', businessUnitKey, storeKey], () => swrFetcher<{ branches: Branch[] }>(`${base}/branches?${q(storeKey)}`), { revalidateOnFocus: false });
}

export function useBranchStock(branchKey: string | null, offset: number, text: string) {
  const { storeKey, businessUnitKey } = useViewer();
  return useSWR<StockPage>(
    branchKey ? ['store-branch-stock', businessUnitKey, storeKey, branchKey, offset, text] : null,
    () => swrFetcher<StockPage>(`${base}/branches/${encodeURIComponent(branchKey as string)}/stock?${q(storeKey)}&offset=${offset}${text ? `&text=${encodeURIComponent(text)}` : ''}`),
    { revalidateOnFocus: false, keepPreviousData: true },
  );
}

export function useChannelStats() {
  const { storeKey, businessUnitKey } = useViewer();
  return useSWR<ChannelStats>(['store-channels', businessUnitKey, storeKey], () => swrFetcher<ChannelStats>(`${base}/channels?${q(storeKey)}`), { revalidateOnFocus: false });
}

export function useLinkInBioStatus() {
  const { storeKey, businessUnitKey } = useViewer();
  return useSWR<{ published: boolean }>(['store-link-in-bio', businessUnitKey, storeKey], () => swrFetcher<{ published: boolean }>(`${base}/link-in-bio-status?${q(storeKey)}`), { revalidateOnFocus: false });
}

/** The writes of the Store screens; each refreshes the matching reads. */
export function useStoreActions() {
  const { storeKey, businessUnitKey } = useViewer();
  const { mutate } = useSWRConfig();
  const refresh = useCallback((name: string) => mutate((key) => Array.isArray(key) && key[0] === name && key[1] === businessUnitKey), [mutate, businessUnitKey]);
  return {
    saveSettings: async (input: { name: Record<string, string>; location: StoreLocationInput }): Promise<ApiResult<StoreSettings>> => {
      const result = await sendJson<StoreSettings>('PUT', `${base}/settings`, { storeKey, ...input });
      if (result.ok) await refresh('store-settings');
      return result;
    },
    uploadAsset: async (kind: 'logo' | 'favicon', file: File): Promise<ApiResult<StoreSettings>> => {
      const form = new FormData();
      form.set('storeKey', storeKey);
      form.set('file', file);
      const result = await postForm<StoreSettings>(`${base}/${kind}`, form);
      if (result.ok) await refresh('store-settings');
      return result;
    },
    geocode: (address: string): Promise<ApiResult<{ result: { label: string; lat: number; lng: number } | null; unavailable: boolean }>> => postJson(`${base}/geocode`, { storeKey, address }),
    createBranch: async (input: Omit<CreateBranchInput, 'storeKey'>): Promise<ApiResult<{ branch: Branch }>> => {
      const result = await postJson<{ branch: Branch }>(`${base}/branches`, { storeKey, ...input });
      if (result.ok) await refresh('store-branches');
      return result;
    },
    updateBranch: async (key: string, input: Omit<BranchInput, 'storeKey'>): Promise<ApiResult<{ branch: Branch }>> => {
      const result = await sendJson<{ branch: Branch }>('PUT', `${base}/branches/${encodeURIComponent(key)}`, { storeKey, ...input });
      if (result.ok) await refresh('store-branches');
      return result;
    },
    removeBranch: async (key: string): Promise<ApiResult<{ status: string }>> => {
      const result = await sendJson<{ status: string }>('DELETE', `${base}/branches/${encodeURIComponent(key)}?${q(storeKey)}`);
      if (result.ok) await refresh('store-branches');
      return result;
    },
    setStock: async (branchKey: string, sku: string, change: { availableQuantity?: number; priceCent?: number | null }): Promise<ApiResult<{ row: StockRow }>> => {
      const result = await sendJson<{ row: StockRow }>('PUT', `${base}/branches/${encodeURIComponent(branchKey)}/stock/${encodeURIComponent(sku)}`, { storeKey, ...change });
      if (result.ok) await refresh('store-branch-stock');
      return result;
    },
    resetTheme: (): Promise<ApiResult<{ status: string }>> => sendJson('DELETE', `${base}/theme?${q(storeKey)}`),
  };
}

/** The preview pages with their storefront URLs and whether each exists yet (the Product page uses a real assortment part). */
export function usePreviewPages(locale: string) {
  const { storeKey, businessUnitKey } = useViewer();
  return useSWR<{ pages: PreviewPageStatus[] }>(['store-preview-pages', businessUnitKey, storeKey, locale], () => swrFetcher<{ pages: PreviewPageStatus[] }>(`/api/store/preview-pages?locale=${encodeURIComponent(locale)}`), {
    revalidateOnFocus: false,
  });
}
