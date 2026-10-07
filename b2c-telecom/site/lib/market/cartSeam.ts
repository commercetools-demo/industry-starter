import 'server-only';
import type { NextResponse } from 'next/server';
import type { SwitchCart } from '@/lib/market/switch';

// Seam to the cart (workstream M replaces both bodies; D cannot import the cart because it is built later).
// Contract for M: whenever the cart in the session has a currency/country different from getMarket(), treat it as "no cart".

/** Maps the session cart to the shape the region switch needs, or null when there is no cart. */
export async function readCartForSwitch(): Promise<SwitchCart | null> {
  return null;
}

/** Forgets the session's cart (removes cartId from the session cookie on `res`). */
export async function discardCartForSwitch(res: NextResponse): Promise<void> {
  void res;
}
