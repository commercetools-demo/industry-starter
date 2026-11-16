'use client';

import { useLocale } from 'next-intl';
import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { keyPresetBundle } from '@/lib/cache-keys';
import type { BundleView } from '@/lib/types';

/**
 * The preset bundle of a SKU in the shopper's market. `fallback` is the server-rendered view, so the first paint needs
 * no request. Revalidation on focus is off: prices are re-read on the next page load and when the bag is loaded (D7).
 */
export function usePresetBundle(sku: string, fallback: BundleView | null) {
  const locale = useLocale();
  return useSWR<{ bundle: BundleView | null }>(
    keyPresetBundle(sku, locale),
    () => jsonFetcher<{ bundle: BundleView | null }>(`/api/preset-bundles/${encodeURIComponent(sku)}`),
    { fallbackData: { bundle: fallback }, revalidateOnFocus: false },
  );
}
