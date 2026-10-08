import { checkoutRoute, readCheckoutBody, textOf } from '@/lib/checkout-api';
import { saveDetails, type DetailsInput } from '@/lib/ct/checkout';
import { CheckoutRefusal } from '@/lib/checkout/refusal';
import type { CheckoutAddress } from '@/lib/types';

export const dynamic = 'force-dynamic';

function parseAddress(value: unknown): CheckoutAddress | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new CheckoutRefusal(400, 'INVALID_BODY', 'An address must be an object.');
  const raw = value as Record<string, unknown>;
  const optional = (name: string): string | undefined => {
    const text = textOf(raw[name])?.trim();
    return text ? text : undefined;
  };
  const additionalStreetInfo = optional('additionalStreetInfo');
  const state = optional('state');
  const phone = optional('phone');
  return {
    firstName: textOf(raw.firstName)?.trim() ?? '',
    lastName: textOf(raw.lastName)?.trim() ?? '',
    streetName: textOf(raw.streetName)?.trim() ?? '',
    ...(additionalStreetInfo ? { additionalStreetInfo } : {}),
    city: textOf(raw.city)?.trim() ?? '',
    ...(state ? { state } : {}),
    postalCode: textOf(raw.postalCode)?.trim() ?? '',
    // Validated by `validateAddress` (anything but US or DE is refused) before it reaches commercetools.
    country: (textOf(raw.country)?.trim() ?? '') as CheckoutAddress['country'],
    ...(phone ? { phone } : {}),
  };
}

/** Contact and addresses onto the cart; answers with the state read back (tax and shipping recalculated by the platform). */
export async function POST(request: Request) {
  return checkoutRoute(request, { mutating: true }, async (session, market) => {
    const body = await readCheckoutBody(request);
    const email = textOf(body.email);
    const phone = textOf(body.phone);
    const serviceAddress = parseAddress(body.serviceAddress);
    const billingAddress = parseAddress(body.billingAddress);
    const input: DetailsInput = { ...(email === undefined ? {} : { email }), ...(phone === undefined ? {} : { phone }), ...(serviceAddress ? { serviceAddress } : {}), ...(billingAddress ? { billingAddress } : {}) };
    return { data: { state: await saveDetails(session, market, input) } };
  });
}
