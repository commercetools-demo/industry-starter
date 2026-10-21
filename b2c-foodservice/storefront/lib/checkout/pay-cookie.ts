import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import type { CheckoutPayment, GroupKey } from '@/lib/types';

/**
 * Under `complete-per-group` a mixed bag is paid as several clone carts (one per fulfilment group). Their ids and the payment
 * labels travel in a short HTTP-only cookie, not in the session token (the session format is shared). The amounts are for display
 * only: the session route re-reads the cart and checks the total. Every use re-checks that the cart belongs to the session, so a
 * forged cookie only ever names carts the shopper owns.
 */
export const PAY_CARTS_COOKIE = 'mcf_pay_carts';
const MAX_AGE = 3600;
const ID = /^[A-Za-z0-9-]{1,64}$/;
const CLUSTER = /^(delivery|subscribe|collect:[A-Za-z0-9_-]{1,256})$/;

export interface PayPart extends CheckoutPayment {
  /** The clone cart that is paid for this part. */
  id: string;
}

/** The parts of this shopper's current mixed payment (empty when the bag is paid directly). */
export async function readPayParts(): Promise<PayPart[]> {
  const raw = (await cookies()).get(PAY_CARTS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const parts: PayPart[] = [];
    for (const p of parsed.slice(0, 8) as Record<string, unknown>[]) {
      if (typeof p.id !== 'string' || !ID.test(p.id)) return [];
      if (typeof p.clusterKey !== 'string' || !CLUSTER.test(p.clusterKey)) return [];
      if (typeof p.totalCents !== 'number' || !Number.isInteger(p.totalCents) || p.totalCents < 0) return [];
      parts.push({
        id: p.id, part: parts.length, clusterKey: p.clusterKey as GroupKey,
        label: typeof p.label === 'string' ? p.label.slice(0, 120) : null, totalCents: p.totalCents,
      });
    }
    return parts;
  } catch {
    return [];
  }
}

export function setPayParts<T extends NextResponse>(res: T, parts: readonly PayPart[]): T {
  const value = JSON.stringify(parts.map(({ id, clusterKey, label, totalCents }) => ({ id, clusterKey, label, totalCents })));
  res.cookies.set(PAY_CARTS_COOKIE, parts.length ? value : '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: parts.length ? MAX_AGE : 0 });
  return res;
}

export function clearPayParts<T extends NextResponse>(res: T): T {
  return setPayParts(res, []);
}

/** The parts as plain payments for the client (no cart ids). */
export function paymentsOf(parts: readonly PayPart[]): CheckoutPayment[] {
  return parts.map(({ part, clusterKey, label, totalCents }) => ({ part, clusterKey, label, totalCents }));
}
