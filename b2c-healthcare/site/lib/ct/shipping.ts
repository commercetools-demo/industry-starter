import 'server-only';
import { unstable_cache } from 'next/cache';
import { apiRoot } from '@/lib/ct/client';
import { mapShippingMethod } from '@/lib/mappers/shipping';
import type { ShippingMethodInfo } from '@/lib/types';

/** TTL (seconds) of the public shipping methods cache. */
export const SHIPPING_METHODS_REVALIDATE_SECONDS = 60;

async function fetchShippingMethods(): Promise<ShippingMethodInfo[]> {
  const { body } = await apiRoot.shippingMethods().get({ queryArgs: { limit: 100, where: 'active=true' } }).execute();
  return body.results.map(mapShippingMethod);
}

/**
 * All active shipping methods with their zone rates: a public read for informational display.
 * Cart-specific rates (matching a cart) are a different, uncached call.
 */
export const getShippingMethods = unstable_cache(fetchShippingMethods, ['ct-shipping-methods'], {
  revalidate: SHIPPING_METHODS_REVALIDATE_SECONDS,
});
