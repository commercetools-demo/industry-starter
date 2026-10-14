// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Who may see an order (workstream P, D2, D3): the owner customer, the browser whose anonymous id placed the order, or the holder of the
// signed private link. The link token is HS256, audience `order-view`, claims `{ oid, sk }`, 30 days, signed with `ORDER_ACCESS_SECRET`
// (never the session secret: a leaked order link must not be a session secret). Replaces the stub of workstream O; signatures unchanged.
import 'server-only';
import { jwtVerify, SignJWT } from 'jose';
import { getOrderAccessSecret } from '@/lib/env';

const AUDIENCE = 'order-view';
const MAX_AGE = '30d';

export async function signOrderAccessToken(input: { orderId: string; storeKey: string }): Promise<string> {
  return new SignJWT({ oid: input.orderId, sk: input.storeKey }).setProtectedHeader({ alg: 'HS256' }).setAudience(AUDIENCE).setIssuedAt().setExpirationTime(MAX_AGE).sign(getOrderAccessSecret());
}

/** True only for an unexpired token of this audience, signed with the order access secret, for exactly this order and store. */
export async function verifyOrderAccessToken(token: string, input: { orderId: string; storeKey: string }): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getOrderAccessSecret(), { audience: AUDIENCE, algorithms: ['HS256'] });
    return payload.oid === input.orderId && payload.sk === input.storeKey;
  } catch {
    return false;
  }
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
  return verifyOrderAccessToken(token, { orderId: order.id, storeKey: order.storeKey });
}
