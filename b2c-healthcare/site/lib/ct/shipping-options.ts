import 'server-only';
import type { ShippingMethod } from '@commercetools/platform-sdk';
import { isBeforeSameDayCutoff, SAME_DAY_METHOD_KEY, STANDARD_METHOD_KEY } from '@/lib/checkout/config';
import { apiRoot } from '@/lib/ct/client';
import type { DeliveryOption } from '@/lib/types';

const ORDER = [STANDARD_METHOD_KEY, SAME_DAY_METHOD_KEY];
const rank = (key: string) => {
  const i = ORDER.indexOf(key);
  return i === -1 ? ORDER.length : i;
};

/** The price of the rate that matches the cart (matching-cart marks it `isMatching`); the first rate otherwise. */
function matchingPrice(method: ShippingMethod): DeliveryOption['price'] | null {
  const rates = method.zoneRates.flatMap((zr) => zr.shippingRates);
  const rate = rates.find((r) => r.isMatching) ?? rates[0];
  if (!rate) return null;
  return { centAmount: rate.price.centAmount, currencyCode: rate.price.currencyCode, fractionDigits: 2 };
}

/**
 * The delivery methods valid for this cart (`GET shipping-methods/matching-cart`: it considers the cart's address,
 * contents and the project's zones), minus same-day once the 14:00 New York cut-off has passed. The list
 * is never filtered in the browser. Returns an empty list when no method fits the address.
 */
export async function getOptionsForCart(cartId: string, now: Date): Promise<DeliveryOption[]> {
  const { body } = await apiRoot.shippingMethods().matchingCart().get({ queryArgs: { cartId } }).execute();
  const open = isBeforeSameDayCutoff(now);
  const options: DeliveryOption[] = [];
  for (const method of body.results) {
    const key = method.key ?? method.id;
    if (key === SAME_DAY_METHOD_KEY && !open) continue;
    const price = matchingPrice(method);
    if (price) options.push({ key, name: method.name, price });
  }
  return options.sort((a, b) => rank(a.key) - rank(b.key));
}
