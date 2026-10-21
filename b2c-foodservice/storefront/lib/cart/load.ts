import 'server-only';
import { getCartView } from '@/lib/ct/cart';
import { getSession } from '@/lib/session';
import type { Cart } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

/**
 * The bag for a server-rendered page (workstream I): the session's cart as the full view, `null` when there is none, and
 * `undefined` when it could not be read (the page then lets the client try again and show its own error). Never throws.
 */
export async function loadCart(locale: string): Promise<Cart | null | undefined> {
  const market = marketForLocale(locale);
  try {
    const { cart } = await getCartView(await getSession(), { country: market.country, currency: market.currency, locale: market.locale });
    return cart;
  } catch {
    return undefined;
  }
}
