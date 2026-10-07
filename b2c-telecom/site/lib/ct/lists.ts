import 'server-only';
import { resolveLines, type LinePrice } from '@/lib/lists/resolve';
import type { Market } from '@/lib/types';
import { getOffersByKeys } from './catalog';

// Saved lists of the signed-in customer (D-070: no /me endpoints; every list is ownership-checked against the session's customer).

/**
 * Prices and availability of saved lines, resolved NOW from the catalog's price-selected offers (H, cached one minute) in ONE batched
 * read: never a throwaway cart. The market comes from the buyer's locale.
 */
export async function loadLinePrices(lines: readonly { offerKey: string; variantId: number }[], market: Market, now: Date = new Date()): Promise<Map<string, LinePrice>> {
  const offers = await getOffersByKeys([...new Set(lines.map((line) => line.offerKey))], market);
  return resolveLines(lines, offers, now);
}
