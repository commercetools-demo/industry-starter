import type { ShippingMethod } from '@commercetools/platform-sdk';
import type { Money } from '@/lib/types';
import { mapMoney } from '@/lib/mappers/money';

/** The standard carrier method (SEED-PLAN section 3). Its `freeAbove` is the shop's free-shipping threshold. */
export const STANDARD_SHIPPING_KEY = 'mcf-ship-standard';

/**
 * `freeAbove` of the standard method in the given currency, or null. Only rates that match the location
 * (`isMatching !== false`) and the currency count; the shop never invents a number.
 */
export function mapFreeAbove(methods: ShippingMethod[], currency: string): Money | null {
  const method = methods.find((m) => m.key === STANDARD_SHIPPING_KEY);
  if (!method) return null;
  for (const zone of method.zoneRates) {
    for (const rate of zone.shippingRates) {
      if (rate.isMatching === false) continue;
      if (rate.freeAbove && rate.freeAbove.currencyCode === currency) return mapMoney(rate.freeAbove);
    }
  }
  return null;
}
