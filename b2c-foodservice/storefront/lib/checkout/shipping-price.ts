/**
 * Delivery pricing (display only, workstream K 3.5). The hosted flow lists and prices the methods; this is for tests and for the
 * Review step's market line. The rate is the one of the cart currency; it is free when the goods total (after discounts) is at
 * or above that rate's `freeAbove`. Flat rates only. Nothing is a constant: the rates come from the shipping method's zone rates.
 */
export interface RateLike {
  price: { centAmount: number; currencyCode: string };
  freeAbove?: { centAmount: number; currencyCode: string };
}
export interface MethodLike {
  zoneRates: { shippingRates: RateLike[] }[];
}

export function priceFor(method: MethodLike, currency: string, goodsCents: number): number | null {
  for (const zone of method.zoneRates) {
    for (const rate of zone.shippingRates) {
      if (rate.price.currencyCode !== currency) continue;
      if (rate.freeAbove && rate.freeAbove.currencyCode === currency && goodsCents >= rate.freeAbove.centAmount) return 0;
      return rate.price.centAmount;
    }
  }
  return null;
}

/** The `freeAbove` figure of the method for a currency, in minor units, or null. */
export function freeAboveFor(method: MethodLike, currency: string): number | null {
  for (const zone of method.zoneRates) {
    for (const rate of zone.shippingRates) {
      if (rate.freeAbove?.currencyCode === currency) return rate.freeAbove.centAmount;
    }
  }
  return null;
}
