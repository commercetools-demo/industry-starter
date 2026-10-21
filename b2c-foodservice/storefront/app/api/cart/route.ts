import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { cartResponse, rejectionResponse, STORE_KEY_PATTERN } from '@/lib/cart/respond';
import { CodeRejected, applyDiscountCode, changeCollectionStore, getCartView, removeDiscountCode } from '@/lib/ct/cart';
import { limitClient } from '@/lib/http/limit';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cart -> 200 { cart: Cart | null } (workstream I: the full view; `Cart` keeps every field of the old CartSummary).
 * A missing, foreign, deleted or no longer Active cart gives `cart: null` and its id leaves the session. The read also
 * prices shipping and runs the price check (a changed price recalculates the cart once and marks the line). Never cached.
 * Errors: 503 upstream_unavailable.
 */
export const GET = handle('/api/cart', async () => {
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const { cart, session: next } = await getCartView(session, market);
  return cartResponse(cart, session, next);
});

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * PATCH /api/cart
 *   { action: 'applyDiscountCode', code }       -> 200 { cart } | 422 code_not_applied { details: { reason, cart } }
 *   { action: 'removeDiscountCode', id }        -> 200 { cart }
 *   { action: 'changeCollectionStore', storeKey } -> 200 { cart } | 400 unknown_store | 400 collect_not_available_in_market
 * Other: 400 invalid_request; 404 not_found (no cart of yours); 409 conflict (changed twice while writing).
 * Lines out of stock at the new store still move and carry the `collect-unavailable` flag.
 */
export const PATCH = handle('/api/cart', async (req) => {
  const body: unknown = await req.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  try {
    if (b.action === 'applyDiscountCode' && typeof b.code === 'string') {
      const limited = limitClient(req, 'discount-code', { limit: 20, windowMs: 10 * 60 * 1000 });
      if (limited) return limited;
      const code = b.code.trim();
      // A code with characters no code has can only be unknown: same answer as commercetools gives, cart unchanged.
      if (!CODE_PATTERN.test(code)) {
        return (await rejectionResponse(new CodeRejected('DoesNotExist'), session)) ?? domainError('invalid_request', 400);
      }
      return cartResponse(await applyDiscountCode(session, market, code), session);
    }
    if (b.action === 'removeDiscountCode' && typeof b.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(b.id)) {
      return cartResponse(await removeDiscountCode(session, market, b.id), session);
    }
    if (b.action === 'changeCollectionStore' && typeof b.storeKey === 'string' && STORE_KEY_PATTERN.test(b.storeKey)) {
      return cartResponse(await changeCollectionStore(session, market, b.storeKey), session);
    }
    return domainError('invalid_request', 400);
  } catch (e) {
    const res = await rejectionResponse(e, session);
    if (res) return res;
    throw e;
  }
});
