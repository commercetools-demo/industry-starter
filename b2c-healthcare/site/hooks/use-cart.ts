'use client';
import useSWR, { type SWRResponse } from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import type { CartSummary } from '@/lib/types';

/**
 * Cart state. Placeholder: reads the SWR cache only (seeded by the root layout fallback) and calls
 * no endpoint yet; the cart workstream passes a fetcher built on `API_CART` from lib/api-paths.
 * `null` means no cart.
 */
export function useCart(): SWRResponse<CartSummary | null> {
  return useSWR<CartSummary | null>(KEY_CART, null);
}
