import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { cartResponse, LINE_ID_PATTERN, rejectionResponse, STORE_KEY_PATTERN } from '@/lib/cart/respond';
import { changeQuantity, removeLine, switchFulfilment, type SwitchInput } from '@/lib/ct/cart';
import { CART_MAX_LINE_QUANTITY } from '@/lib/shop-config';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

function parseSwitch(b: Record<string, unknown>): SwitchInput | null {
  if (b.fulfilment === 'delivery') return { fulfilment: 'delivery' };
  if (b.fulfilment !== 'collect') return null;
  if (b.storeKey === undefined) return { fulfilment: 'collect' };
  return typeof b.storeKey === 'string' && STORE_KEY_PATTERN.test(b.storeKey) ? { fulfilment: 'collect', storeKey: b.storeKey } : null;
}

/**
 * PATCH /api/cart/lines/<lineId> { quantity } | { fulfilment: 'delivery' } | { fulfilment: 'collect', storeKey? } -> 200 { cart }
 * Errors: 400 invalid_request (quantity not an integer 1..99, bad body); 404 line_not_found; 409 quantity_exceeds_stock
 * (`available`); 409 store_required (no store given or chosen: the client opens the picker and retries); 409
 * not_available_for_collection (`available`); 400 collect_not_available_in_market; 400 unknown_store; 422
 * subscribe_line_not_switchable; 409 conflict (changed twice while writing). Totals in the response are the engine's.
 */
export const PATCH = handle('/api/cart/lines/[lineId]', async (req, ctx) => {
  const { lineId } = await ctx.params;
  if (!LINE_ID_PATTERN.test(lineId)) return domainError('line_not_found', 404);
  const body: unknown = await req.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  try {
    if (b.quantity !== undefined) {
      const q = b.quantity;
      if (typeof q !== 'number' || !Number.isInteger(q) || q < 1 || q > CART_MAX_LINE_QUANTITY) return domainError('invalid_request', 400);
      return cartResponse(await changeQuantity(session, market, lineId, q), session);
    }
    const sw = parseSwitch(b);
    if (!sw) return domainError('invalid_request', 400);
    return cartResponse(await switchFulfilment(session, market, lineId, sw), session);
  } catch (e) {
    const res = await rejectionResponse(e, session);
    if (res) return res;
    throw e;
  }
});

/** DELETE /api/cart/lines/<lineId> -> 200 { cart } (an empty cart keeps its id so the empty state renders); 404 line_not_found. */
export const DELETE = handle('/api/cart/lines/[lineId]', async (_req, ctx) => {
  const { lineId } = await ctx.params;
  if (!LINE_ID_PATTERN.test(lineId)) return domainError('line_not_found', 404);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  try {
    return cartResponse(await removeLine(session, market, lineId), session);
  } catch (e) {
    const res = await rejectionResponse(e, session);
    if (res) return res;
    throw e;
  }
});
