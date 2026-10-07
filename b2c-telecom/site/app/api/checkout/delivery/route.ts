import { checkoutRoute, readCheckoutBody, textOf } from '@/lib/checkout-api';
import { listDelivery, selectDelivery } from '@/lib/ct/checkout';
import { CheckoutRefusal } from '@/lib/checkout/refusal';

export const dynamic = 'force-dynamic';

/** Delivery options from the platform's matching list (never filtered on the client). `DEV_FORCE_NO_DELIVERY` works in development only. */
export async function GET(request: Request) {
  return checkoutRoute(request, {}, async (session, market) => {
    const forceNone = process.env.NODE_ENV === 'development' && process.env.DEV_FORCE_NO_DELIVERY === 'true';
    return { data: await listDelivery(session, market, { forceNone }) };
  });
}

export async function POST(request: Request) {
  return checkoutRoute(request, { mutating: true }, async (session, market) => {
    const id = textOf((await readCheckoutBody(request)).shippingMethodId);
    if (!id) throw new CheckoutRefusal(400, 'INVALID_BODY', 'shippingMethodId is required.');
    return { data: { state: await selectDelivery(session, market, id) } };
  });
}
