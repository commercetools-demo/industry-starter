import 'server-only';
import { cache } from 'react';
import { apiRoot } from '@/lib/ct/client';
import { mapProductBasics } from '@/lib/mappers/product';
import type { ProductBasics } from '@/lib/types';

/**
 * One published product by key, or null when it does not exist. Not wrapped in `unstable_cache`
 * (prices depend on currency/country); de-duplicated per request by getProductByKeyCached.
 */
export async function getProductByKey(key: string, currency: string, country: string): Promise<ProductBasics | null> {
  try {
    const { body } = await apiRoot
      .productProjections()
      .withKey({ key })
      .get({ queryArgs: { priceCurrency: currency, priceCountry: country } })
      .execute();
    return mapProductBasics(body);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}

/**
 * Request-scoped memo shared by `generateMetadata` and the page: both call this with the same
 * primitive arguments and the fetch runs once per request. Arguments must stay primitives
 * (React `cache` compares by identity).
 */
export const getProductByKeyCached = cache(getProductByKey);
