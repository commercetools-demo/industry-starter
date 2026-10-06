import 'server-only';
import { NextResponse } from 'next/server';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { CartNotActiveError } from './ct/cart';
import { mapCart } from './mappers/cart';
import { getMarket, updateSession, type Session } from './session';

export type Market = Awaited<ReturnType<typeof getMarket>>;

/** Every cart route answers with the full server cart so the client never recomputes totals. */
export async function cartJson(cart: CtCart, market: Market, patch: Partial<Session> = {}): Promise<NextResponse> {
  const res = NextResponse.json({ cart: mapCart(cart, market) });
  await updateSession({ cartId: cart.id, ...patch }, res);
  return res;
}

/** `{ cart: null }` and drop the (stale) cart id from the session cookie. */
export async function clearedCartJson(): Promise<NextResponse> {
  const res = NextResponse.json({ cart: null });
  await updateSession({ cartId: undefined }, res);
  return res;
}

export const jsonError = (error: string, status: number, extra: Record<string, unknown> = {}): NextResponse =>
  NextResponse.json({ error, ...extra }, { status });

/** Quantities are whole units of the sellable variant (weight is expressed by choosing a variant), so integers >= 1. */
export const isValidQuantity = (q: unknown): q is number => typeof q === 'number' && Number.isInteger(q) && q >= 1;

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** Maps a failed cart call to a response. A cart that stopped being Active clears the session cart id. */
export async function cartFailure(e: unknown): Promise<NextResponse> {
  if (e instanceof CartNotActiveError) {
    const res = jsonError('CART_NOT_FOUND', 404);
    await updateSession({ cartId: undefined }, res);
    return res;
  }
  const status = typeof e === 'object' && e !== null ? (e as { statusCode?: unknown }).statusCode : undefined;
  console.error('Cart request failed', e instanceof Error ? e.message : e);
  return jsonError('CART_ERROR', status === 409 ? 409 : 500);
}
