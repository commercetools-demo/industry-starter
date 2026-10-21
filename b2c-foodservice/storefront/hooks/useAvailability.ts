'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { keyAvailability } from '@/lib/cache-keys';
import type { SkuAvailability } from '@/lib/types';

/**
 * Per-store stock for one SKU: `{ sku, ship, stores: [{ storeKey, state, quantity }] }`.
 * Pass `null` as the sku to make no request (store picker opened from the header).
 * Contract for H and I: `ship` is the online warehouse, `stores` only lists the market's stores.
 */
export function useAvailability(sku: string | null, country: string, storeKey: string | null = null) {
  return useSWR<SkuAvailability>(
    sku ? keyAvailability(sku, country, storeKey) : null,
    () => jsonFetcher<SkuAvailability>(`/api/availability?sku=${encodeURIComponent(sku as string)}&country=${encodeURIComponent(country)}`),
    { revalidateOnFocus: false },
  );
}
