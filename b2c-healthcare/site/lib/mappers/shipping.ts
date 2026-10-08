import type { Money as CtMoney, ShippingMethod } from '@commercetools/platform-sdk';
import type { Money, ShippingMethodInfo } from '@/lib/types';
import { mapLocalizedString } from '@/lib/mappers';

function toMoney(money: CtMoney): Money {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: money.currencyCode }).resolvedOptions()
    .maximumFractionDigits;
  return { centAmount: money.centAmount, currencyCode: money.currencyCode, fractionDigits: digits ?? 2 };
}

export function mapShippingMethod(method: ShippingMethod): ShippingMethodInfo {
  return {
    id: method.id,
    key: method.key ?? method.id,
    name: method.name,
    description: mapLocalizedString(method.localizedDescription),
    isDefault: method.isDefault,
    rates: method.zoneRates.flatMap((zr) =>
      zr.shippingRates.map((rate) => ({
        zoneId: zr.zone.id,
        price: toMoney(rate.price),
        freeAbove: rate.freeAbove ? toMoney(rate.freeAbove) : null,
      })),
    ),
  };
}
