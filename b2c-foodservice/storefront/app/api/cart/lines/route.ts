import { NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/api';
import { addLine } from '@/lib/ct/cart';
import { SKU_PATTERN } from '@/lib/ct/inventory';
import { AppError } from '@/lib/errors';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FULFILMENTS = ['delivery', 'collect', 'subscribe'] as const;
type Fulfilment = (typeof FULFILMENTS)[number];

interface Parsed { sku: string; quantity: number; fulfilment: Fulfilment; storeKey?: string; recurrencePolicyKey?: string }

function parse(raw: unknown): Parsed | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.sku !== 'string' || !SKU_PATTERN.test(b.sku)) return null;
  if (typeof b.quantity !== 'number' || !Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 99) return null;
  if (typeof b.fulfilment !== 'string' || !(FULFILMENTS as readonly string[]).includes(b.fulfilment)) return null;
  const fulfilment = b.fulfilment as Fulfilment;
  if (fulfilment === 'collect' && (typeof b.storeKey !== 'string' || b.storeKey.length === 0)) return null;
  if (fulfilment === 'subscribe' && (typeof b.recurrencePolicyKey !== 'string' || b.recurrencePolicyKey.length === 0)) return null;
  return {
    sku: b.sku, quantity: b.quantity, fulfilment,
    ...(typeof b.storeKey === 'string' ? { storeKey: b.storeKey } : {}),
    ...(typeof b.recurrencePolicyKey === 'string' ? { recurrencePolicyKey: b.recurrencePolicyKey } : {}),
  };
}

/**
 * POST /api/cart/lines { sku, quantity (1..99), fulfilment: 'delivery' | 'collect' | 'subscribe', storeKey?, recurrencePolicyKey? }
 * -> 200 { cart: CartSummary }. Only `delivery` is built (workstream G); the other two answer 501 until H.
 * Errors: 400 validation_failed (bad input), 404 not_found (unknown SKU), 422 validation_failed (no price in the
 * cart's market), 409 conflict (changed twice while adding), 501 bad_request (collect and subscribe, until H).
 * The cart is created from the session market, never from client input. The session cookie gets cartId and anonymousId.
 */
export const POST = handle('/api/cart/lines', async (req) => {
  const input = parse(await req.json().catch(() => null));
  if (!input) return jsonError('validation_failed', 400);
  if (input.fulfilment !== 'delivery') throw new AppError('bad_request', 501);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const { cart, session: next } = await addLine(session, market, { sku: input.sku, quantity: input.quantity, fulfilment: 'delivery' });
  return setSessionCookie(
    NextResponse.json({ cart }, { headers: { 'Cache-Control': 'no-store' } }),
    await createSessionToken(next),
  );
});
