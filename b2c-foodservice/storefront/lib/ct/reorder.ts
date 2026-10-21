import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { LineRejected, addLine, getCartForSession, type CartMarket } from '@/lib/ct/cart';
import { getInventoryDetail } from '@/lib/ct/inventory';
import { AppError } from '@/lib/errors';
import { fulfilmentOf } from '@/lib/mappers/cart';
import { CART_MAX_LINE_QUANTITY } from '@/lib/shop-config';
import type { Session } from '@/lib/session';
import type { CartSummary, Fulfilment, ReorderResult, ReorderSkipReason } from '@/lib/types';
import { getLocalizedString, marketForCountry } from '@/lib/utils';

export interface PlannedLine {
  sku: string; name: string; quantity: number;
  /** What was ordered. */
  ordered: Fulfilment;
  /** What Buy again will add: `collect` only with a chosen store in a collection market; subscribe lines become one-off. */
  fulfilment: 'delivery' | 'collect';
  storeKey?: string;
}

/**
 * Pure. One planned line per order line (quantities of the same SKU and fulfilment stay separate; the cart merges them).
 *  - subscribe lines are re-added as one-off delivery lines (N owns subscriptions);
 *  - collect lines use the CURRENT store (`session.collectionStoreKey`), and with no store, or in a market without collection,
 *    they are added as delivery.
 */
export function planReorder(
  order: Pick<Order, 'lineItems'>,
  ctx: { locale: string; collection: boolean; storeKey?: string },
): PlannedLine[] {
  return order.lineItems.flatMap((l): PlannedLine[] => {
    const sku = l.variant.sku;
    if (!sku) return [];
    const ordered = fulfilmentOf(l);
    const base = {
      sku, name: getLocalizedString(l.name, ctx.locale) || sku,
      quantity: Math.min(Math.max(1, l.quantity), CART_MAX_LINE_QUANTITY), ordered,
    };
    if (ordered === 'collect' && ctx.collection && ctx.storeKey) return [{ ...base, fulfilment: 'collect' as const, storeKey: ctx.storeKey }];
    return [{ ...base, fulfilment: 'delivery' as const }];
  });
}

/** Why a line could not be added; null means the error is not a per-line refusal and is rethrown. */
export function reasonFor(e: unknown): ReorderSkipReason | null {
  if (e instanceof LineRejected) {
    if (e.code === 'not_available_for_collection') return 'out_of_stock';
    if (e.code === 'price_unavailable') return 'price_missing';
    return 'unavailable';
  }
  if (e instanceof AppError) {
    if (e.code === 'not_found') return 'not_found';
    if (e.code === 'validation_failed') return 'price_missing';
    return null;
  }
  if ((e as { statusCode?: unknown } | null)?.statusCode === 400) return 'unavailable';
  return null;
}

export interface ReorderRun { result: ReorderResult; session: Session }

/**
 * Adds the order's lines to the CURRENT bag (never a new cart, never replacing it, Q-L-09). Lines the shopper cannot buy
 * now are listed with a reason; the rest are added. Stock: online inventory for delivery lines (a shortfall adds what is
 * there), the store's stock for collect lines (checked by `addLine`).
 */
export async function runReorder(session: Session, market: CartMarket, order: Order): Promise<ReorderRun> {
  const collection = marketForCountry(market.country)?.collection ?? false;
  const plan = planReorder(order, { locale: market.locale, collection, storeKey: session.collectionStoreKey });
  const added: ReorderResult['added'] = [];
  const skipped: ReorderResult['skipped'] = [];

  let stock: Record<string, { online: number }> | null = null;
  try {
    const skus = plan.filter((p) => p.fulfilment === 'delivery').map((p) => p.sku);
    stock = skus.length > 0 ? await getInventoryDetail(skus) : {};
  } catch {
    stock = null; // the stock read failed: addLine still checks collect lines, delivery lines are tried as they are
  }

  let current = session;
  let cart: CartSummary | null = null;
  for (const line of plan) {
    let quantity = line.quantity;
    if (line.fulfilment === 'delivery' && stock) {
      const online = stock[line.sku]?.online ?? 0;
      if (online <= 0) {
        skipped.push({ sku: line.sku, name: line.name, reason: 'out_of_stock' });
        continue;
      }
      quantity = Math.min(quantity, online);
    }
    const attempt = async (q: number) =>
      addLine(
        current,
        market,
        line.fulfilment === 'collect' && line.storeKey
          ? { sku: line.sku, quantity: q, fulfilment: 'collect', storeKey: line.storeKey }
          : { sku: line.sku, quantity: q, fulfilment: 'delivery' },
      );
    try {
      let out;
      let used = quantity;
      try {
        out = await attempt(used);
      } catch (e) {
        // A store with less than ordered: add what it has when it has any.
        const available = e instanceof LineRejected && e.code === 'not_available_for_collection' ? Number(e.extra.available ?? 0) : 0;
        if (available > 0) {
          used = Math.min(quantity, available);
          out = await attempt(used);
        } else throw e;
      }
      current = out.session;
      cart = out.cart;
      added.push({ sku: line.sku, name: line.name, quantity: used, fulfilment: line.fulfilment === 'collect' ? 'collect' : 'delivery' });
    } catch (e) {
      const reason = reasonFor(e);
      if (!reason) throw e;
      skipped.push({ sku: line.sku, name: line.name, reason });
    }
  }
  if (!cart) cart = (await getCartForSession(current)) ?? { id: '', version: 0, count: 0, lines: [] };
  return { result: { added, skipped, cart }, session: current };
}
