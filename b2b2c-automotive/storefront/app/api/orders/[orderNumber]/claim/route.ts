// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/orders/{orderNumber}/claim` { store, password, token? }: the guest "Create account" of the confirmation page (workstream P-05, D6).
// Only the owner browser (same anonymous id) or the holder of the private link may call it; every other case, and an unknown order, is the
// same 404. The email is the order's (never from the request). The customer is created in the order's store, the order is attached with
// `setCustomerId`, and when that fails the new customer is deleted again (no half-created account). Then the shopper is signed in.
// Failures the shopper cannot fix (the order has an account, the email exists here, a write failed) are one generic message. No email is sent.
import { z } from 'zod';
import { handle, parseJson } from '@/lib/api';
import { clientKey, loginCustomer } from '@/lib/auth/login';
import { checkPassword, MAX_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { ORDER_NUMBER_FORMAT } from '@/lib/checkout/order-number';
import { createStoreCustomer, deleteCustomer, DuplicateCustomerError } from '@/lib/ct/customers';
import { claimOrder, getOrderForConfirmation } from '@/lib/ct/orders';
import { canViewOrder } from '@/lib/order-access';
import { createRateLimiter } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

const body = z.object({ store: z.string().min(2).max(256), password: z.string().max(MAX_PASSWORD_LENGTH), token: z.string().max(2048).optional() });
const NO_STORE = { 'Cache-Control': 'private, no-store' };
// Per server instance and client address, like the sign-in: ten attempts in fifteen minutes.
const limiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

const json = (payload: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(payload, { status, headers: { ...NO_STORE, ...headers } });
const failed = () => json({ error: 'account-failed' }, 409);

export const POST = handle(async (request: Request, context: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await context.params;
  if (!limiter.allow(clientKey(request))) return json({ error: 'Too many attempts. Try again later.' }, 429, { 'Retry-After': '900' });
  const input = await parseJson(request, body);
  const notFound = () => json({ error: 'Not found' }, 404);
  if (!ORDER_NUMBER_FORMAT.test(orderNumber)) return notFound();

  const session = await getSession();
  const order = await getOrderForConfirmation(input.store, orderNumber);
  const storeKey = order?.store?.key;
  if (!order || !storeKey || storeKey !== input.store) return notFound();
  const viewer = { id: order.id, storeKey, ...(order.customerId ? { customerId: order.customerId } : {}), ...(order.anonymousId ? { anonymousId: order.anonymousId } : {}) };
  if (!(await canViewOrder(session, viewer, input.token))) return notFound();

  // The order already belongs to an account (or has no email to register): nothing to offer, and no hint why.
  if (order.customerId || !order.customerEmail) return failed();
  const policy = checkPassword(input.password);
  if (!policy.ok) return json({ error: 'password', rule: policy.rule }, 400);

  const address = order.shippingAddress;
  let customer;
  try {
    customer = await createStoreCustomer(storeKey, {
      email: order.customerEmail,
      password: input.password,
      ...(address?.firstName ? { firstName: address.firstName } : {}),
      ...(address?.lastName ? { lastName: address.lastName } : {}),
    });
  } catch (error) {
    if (error instanceof DuplicateCustomerError) return failed();
    throw error;
  }

  try {
    await claimOrder(storeKey, order.id, customer.id);
  } catch (error) {
    await deleteCustomer(storeKey, customer.id, customer.version).catch(() => console.error('[order] claim rollback failed'));
    if (error instanceof Error && error.message === 'The order already has a customer') return failed();
    throw error;
  }

  await loginCustomer({ storeKey, email: order.customerEmail, password: input.password });
  return json({ ok: true });
});
