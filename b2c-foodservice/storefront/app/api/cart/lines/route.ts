import { NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { LineRejected, addLine, type AddLineInput } from '@/lib/ct/cart';
import { SKU_PATTERN } from '@/lib/ct/inventory';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FULFILMENTS = ['delivery', 'collect', 'subscribe'] as const;
type Fulfilment = (typeof FULFILMENTS)[number];

/** Store and policy keys are seeded keys (`mcf-...`); anything else is refused before a call is made. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

function parse(raw: unknown): AddLineInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.sku !== 'string' || !SKU_PATTERN.test(b.sku)) return null;
  if (typeof b.quantity !== 'number' || !Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 99) return null;
  if (typeof b.fulfilment !== 'string' || !(FULFILMENTS as readonly string[]).includes(b.fulfilment)) return null;
  const fulfilment = b.fulfilment as Fulfilment;
  const base = { sku: b.sku, quantity: b.quantity };
  if (fulfilment === 'collect') {
    if (typeof b.storeKey !== 'string' || !KEY_PATTERN.test(b.storeKey)) return null;
    return { ...base, fulfilment, storeKey: b.storeKey };
  }
  if (fulfilment === 'subscribe') {
    if (typeof b.recurrencePolicyKey !== 'string' || !KEY_PATTERN.test(b.recurrencePolicyKey)) return null;
    return { ...base, fulfilment, recurrencePolicyKey: b.recurrencePolicyKey };
  }
  return { ...base, fulfilment };
}

/**
 * POST /api/cart/lines { sku, quantity (1..99), fulfilment: 'delivery' | 'collect' | 'subscribe', storeKey?, recurrencePolicyKey? }
 * -> 200 { cart: CartSummary }. Used by H (product page), G (Quick add, delivery) and I (bag).
 * Errors: 400 validation_failed (bad input), 404 not_found (unknown SKU), 422 validation_failed (no price in the cart's
 * market), 409 conflict (changed twice while adding). Collect and subscribe (workstream H) add domain codes in the same
 * envelope `{ error: { code, message, ...extra } }`:
 *   400 collect_not_available_in_market (a Canada session), 400 unknown_store, 409 not_available_for_collection
 *   (`available` says how many the store has), 400 unknown_policy, 422 price_unavailable (no recurring price).
 * The cart is created from the session market, never from client input. The session cookie gets cartId and anonymousId.
 */
export const POST = handle('/api/cart/lines', async (req) => {
  const input = parse(await req.json().catch(() => null));
  if (!input) return jsonError('validation_failed', 400);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  try {
    const { cart, session: next } = await addLine(session, market, input);
    return setSessionCookie(
      NextResponse.json({ cart }, { headers: { 'Cache-Control': 'no-store' } }),
      await createSessionToken(next),
    );
  } catch (e) {
    if (e instanceof LineRejected) return domainError(e.code, e.status, e.extra);
    throw e;
  }
});
