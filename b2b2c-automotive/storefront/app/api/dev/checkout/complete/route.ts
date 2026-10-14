// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// DEV ONLY (workstream O-08). `POST /api/dev/checkout/complete` { customerEmail } creates an order from the session cart WITHOUT any payment,
// so confirmation (P) and account/subscriptions (Q) can be verified before the owner has set up Stripe (OA-05). It answers 404 in production
// and whenever CHECKOUT_DEV_COMPLETE is not "true" (checked twice), refuses emails outside @example.com, tags the order `isTest`, and never
// creates a Payment. The answer is the real return URL, so the browser exercises `/checkout/return` exactly as the hosted flow does.
import { z } from 'zod';
import { handle, parseJson } from '@/lib/api';
import { checkoutEnvSafe } from '@/lib/checkout/env';
import { EmptyCart, LinesUnavailable, prepareCartForCheckout, SubscriptionsUnavailable } from '@/lib/ct/checkout-prepare';
import { createDevOrderFromCart } from '@/lib/ct/orders';
import { getSession } from '@/lib/session';
import { getActiveVehicle } from '@/lib/vehicles/active';

const body = z.object({ customerEmail: z.string().max(254).regex(/^[^\s@]+@example\.com$/i, 'Only @example.com addresses are accepted') });
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;
const failure = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

const run = handle(async (request: Request) => {
  const { customerEmail } = await parseJson(request, body);
  const session = await getSession();
  if (!session.storeKey || !session.cartId) return failure(409, 'cart-missing');
  const { storeKey, cartId } = session;
  try {
    const vehicle = await getActiveVehicle().catch(() => null);
    await prepareCartForCheckout({ storeKey, cartId, branchKey: session.branchKey, vehicleLabel: vehicle?.label ?? null, ...(session.impersonatedBy ? { placedOnBehalfBy: session.impersonatedBy } : {}) });
    const order = await createDevOrderFromCart({ storeKey, cartId, customerEmail });
    return Response.json({ redirect: `/checkout/return?orderId=${order.id}` }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof EmptyCart) return failure(409, 'cart-empty');
    if (error instanceof LinesUnavailable) return failure(422, 'lines-unavailable');
    if (error instanceof SubscriptionsUnavailable) return failure(422, 'subscriptions-unavailable');
    throw error;
  }
});

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  if (!checkoutEnvSafe().devComplete) return new Response(null, { status: 404 });
  return run(request);
}
