/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import useSWR from 'swr';
import { keyWishlistProducts } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/fetcher';
import type { Product } from '@/lib/types';

/** The saved products of the signed-in customer, priced for the market of `locale` (the saved page). */
export function useSavedProducts(locale: string) {
  return useSWR<Product[]>(keyWishlistProducts(locale), async () => (await fetchJson<{ products: Product[] }>(`/api/account/wishlist/products?locale=${encodeURIComponent(locale)}`)).products, {
    revalidateOnFocus: false,
  });
}
