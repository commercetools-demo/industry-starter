'use client';

import useSWR from 'swr';
import { ApiError, jsonFetcher } from '@/hooks/fetcher';
import { keyScanLookup } from '@/lib/cache-keys';
import type { ScanProduct } from '@/lib/types';

export type ScanLookupStatus = 'idle' | 'loading' | 'found' | 'unknown' | 'failed';

/**
 * The product a scanned SKU leads to (workstream R): GET /api/instore/scan. `null` as the sku makes no request. A 404 is not an
 * error: it is "the shop does not sell this code" (`unknown`); any other failure is `failed` (the dialog offers Try again).
 * Stock changes while a shopper walks around, so the answer is not kept past a few seconds and a repeated scan asks again.
 */
export function useScanLookup(sku: string | null, country: string) {
  const { data, error, isLoading, mutate } = useSWR<{ product: ScanProduct }>(
    sku ? keyScanLookup(sku, country) : null,
    () => jsonFetcher<{ product: ScanProduct }>(`/api/instore/scan?sku=${encodeURIComponent(sku as string)}`),
    { revalidateOnFocus: false, dedupingInterval: 2000, shouldRetryOnError: false },
  );
  const unknown = error instanceof ApiError && (error.status === 404 || error.code === 'not_found' || error.code === 'validation_failed');
  const status: ScanLookupStatus = !sku ? 'idle' : data ? 'found' : unknown ? 'unknown' : error ? 'failed' : isLoading ? 'loading' : 'loading';
  return { product: data?.product ?? null, status, retry: () => mutate() };
}
