import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

/**
 * Under `complete-per-group` a mixed bag is paid as several clone carts (one per fulfilment group). Their ids travel in a short
 * HTTP-only cookie, not in the session token (the session format is shared). Every use re-checks that the cart belongs to the
 * session, so a forged cookie only ever names carts the shopper owns.
 */
export const PAY_CARTS_COOKIE = 'mcf_pay_carts';
const MAX_AGE = 3600;
const ID = /^[A-Za-z0-9-]{1,64}$/;

export async function readPayCartIds(): Promise<string[]> {
  const raw = (await cookies()).get(PAY_CARTS_COOKIE)?.value ?? '';
  return raw.split(',').filter((id) => ID.test(id)).slice(0, 8);
}

export function setPayCartIds<T extends NextResponse>(res: T, ids: readonly string[]): T {
  res.cookies.set(PAY_CARTS_COOKIE, ids.join(','), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: ids.length ? MAX_AGE : 0 });
  return res;
}

export function clearPayCartIds<T extends NextResponse>(res: T): T {
  return setPayCartIds(res, []);
}
