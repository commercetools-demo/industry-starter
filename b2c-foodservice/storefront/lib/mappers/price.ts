import type { Price as SDKPrice, ProductVariant } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/utils';
import type { Price } from '@/lib/types';
import { mapMoney } from '@/lib/mappers/money';

export function mapPrice(p: SDKPrice, locale = 'en-US'): Price {
  const out: Price = { value: mapMoney(p.value) };
  if (p.discounted) {
    out.discounted = mapMoney(p.discounted.value);
    const name = p.discounted.discount.obj?.name;
    if (name) out.discountName = getLocalizedString(name, locale);
  }
  return out;
}

/** variant.price (set by priceCurrency/priceCountry), else the matching entry of variant.prices. */
export function pickPrice(
  variant: Pick<ProductVariant, 'price' | 'prices'>,
  market: { country: string; currency: string; locale?: string },
): Price | undefined {
  if (variant.price) return mapPrice(variant.price, market.locale);
  const found = variant.prices?.find(
    (p) => p.value.currencyCode === market.currency && (p.country === undefined || p.country === market.country),
  );
  return found ? mapPrice(found, market.locale) : undefined;
}
