import 'server-only';
import { unstable_cache } from 'next/cache';
import { CATALOG_TTL } from '@/lib/config/cache';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

const PAGE_LIMIT = 500;

/**
 * Cart Discount id to key. References on a cart carry the id only, and the keys (`malva-cd-...`) are what the bundle compares
 * (intro discount on a line, the discount behind a prompt). Shared by every buyer, cached for the catalog TTL.
 */
export async function getCartDiscountKeys(): Promise<Record<string, string>> {
  const read = unstable_cache(
    async (): Promise<Record<string, string>> => {
      const { body } = await withTimeout(getApiRoot().cartDiscounts().get({ queryArgs: { limit: PAGE_LIMIT } }).execute(), 'cart.discount-keys');
      return Object.fromEntries(body.results.flatMap((discount) => (discount.key ? [[discount.id, discount.key] as const] : [])));
    },
    ['cart-discount-keys'],
    { revalidate: CATALOG_TTL, tags: ['catalog'] },
  );
  return read();
}
