import 'server-only';
import { cookies } from 'next/headers';
import { MARKET_COOKIE, marketFor, type Market } from '@/lib/utils';

/** The buyer's market for API routes and server components. Reads the `malva-market` cookie only; no commercetools call. */
export async function getMarket(): Promise<Market> {
  const store = await cookies();
  return marketFor(store.get(MARKET_COOKIE)?.value ?? '');
}
