// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/checkout/session` -> `{ sessionId, projectKey, region }`: prepares the session cart (recalculate, prefill, custom fields) and
// creates a hosted Checkout session for it, as late as possible. The cart and the store come from the session cookie only, never from the
// body. Errors: 409 `cart-missing` / `cart-empty`, 422 `lines-unavailable` (with line ids) / `subscriptions-unavailable`,
// 503 `checkout-not-configured`, 502 `checkout-unavailable`. No commercetools type and no token ever leaves this route.
import { handle } from '@/lib/api';
import { checkoutEnvSafe } from '@/lib/checkout/env';
import { EmptyCart, LinesUnavailable, prepareCartForCheckout, SubscriptionsUnavailable } from '@/lib/ct/checkout-prepare';
import { CheckoutMisconfigured, CheckoutUnavailable, createCheckoutSession } from '@/lib/checkout/session';
import { getCheckoutCustomerEmail } from '@/lib/ct/checkout-customer';
import { getSession } from '@/lib/session';
import { getActiveVehicle } from '@/lib/vehicles/active';

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;
const failure = (status: number, error: string, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status, headers: NO_STORE });

export const POST = handle(async () => {
  const { applicationKey } = checkoutEnvSafe();
  if (!applicationKey) return failure(503, 'checkout-not-configured');
  const session = await getSession();
  if (!session.storeKey || !session.cartId) return failure(409, 'cart-missing');
  const { storeKey, cartId } = session;
  try {
    const [vehicle, customerEmail] = await Promise.all([
      getActiveVehicle().catch(() => null),
      session.customerId ? getCheckoutCustomerEmail(storeKey, session.customerId) : Promise.resolve(undefined),
    ]);
    await prepareCartForCheckout({ storeKey, cartId, branchKey: session.branchKey, vehicleLabel: vehicle?.label ?? null, ...(customerEmail ? { customerEmail } : {}), ...(session.impersonatedBy ? { placedOnBehalfBy: session.impersonatedBy } : {}) });
    const created = await createCheckoutSession({ cartId, applicationKey });
    return Response.json(created, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof EmptyCart) return failure(409, 'cart-empty');
    if (error instanceof LinesUnavailable) return failure(422, 'lines-unavailable', { lineItemIds: error.lineItemIds });
    if (error instanceof SubscriptionsUnavailable) return failure(422, 'subscriptions-unavailable');
    if (error instanceof CheckoutMisconfigured) return failure(503, 'checkout-not-configured');
    if (error instanceof CheckoutUnavailable) {
      console.error(`[checkout] session creation failed${error.status ? ` with status ${error.status}` : ''}`);
      return failure(502, 'checkout-unavailable');
    }
    throw error;
  }
});
