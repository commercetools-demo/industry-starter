import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { mapFreeAbove } from '@/lib/mappers/shipping';
import type { Money } from '@/lib/types';

/** The free-shipping threshold read from the standard method's `freeAbove` for a market (null when none). */
async function fetchFreeShippingThreshold(country: string, currency: string): Promise<Money | null> {
  const { body } = await apiRoot
    .shippingMethods()
    .matchingLocation()
    .get({ queryArgs: { country, currency } })
    .execute();
  return mapFreeAbove(body.results, currency);
}

/**
 * The single source for the free-shipping figure: the promise bar, the cart and the product page all call this.
 * Public data, cached 60 s per country and currency (tag `shipping-methods`).
 */
export const getFreeShippingThreshold: (country: string, currency: string) => Promise<Money | null> = cachedPublic(
  'shippingMethods',
  ['free-shipping-threshold'],
  fetchFreeShippingThreshold,
);
