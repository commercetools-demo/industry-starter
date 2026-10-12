// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// STUB of workstream O, replaced by workstream P (`lib/order-access.ts`, own secret `ORDER_ACCESS_SECRET`). The signatures are P's contract:
// who may see an order (the customer, the browser that placed it, or the holder of a signed private link) and the token of that link.
// Until P lands the token is signed with a key derived from the session secret and carries an audience, so it is not a session token.
import 'server-only';
import { jwtVerify, SignJWT } from 'jose';
import { getSessionSecret } from '@/lib/env';

const AUDIENCE = 'malva-order-access';
const MAX_AGE = '30d';

async function key(): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array([...getSessionSecret(), ...new TextEncoder().encode(`:${AUDIENCE}`)]));
  return new Uint8Array(digest);
}

export async function signOrderAccessToken(input: { orderId: string; storeKey: string }): Promise<string> {
  return new SignJWT({ storeKey: input.storeKey })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setSubject(input.orderId)
    .setIssuedAt()
    .setExpirationTime(MAX_AGE)
    .sign(await key());
}

export interface OrderAccessSubject {
  customerId?: string;
  anonymousId?: string;
}
export interface OrderAccessOrder extends OrderAccessSubject {
  id: string;
  storeKey: string;
}

/** The owner customer, the browser whose anonymous id placed the order, or the holder of a valid token for this order and store. */
export async function canViewOrder(session: OrderAccessSubject, order: OrderAccessOrder, token?: string): Promise<boolean> {
  if (order.customerId && session.customerId === order.customerId) return true;
  if (order.anonymousId && session.anonymousId === order.anonymousId) return true;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, await key(), { audience: AUDIENCE, algorithms: ['HS256'] });
    return payload.sub === order.id && payload.storeKey === order.storeKey;
  } catch {
    return false;
  }
}
