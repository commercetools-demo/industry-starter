// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Named savings and discount code states read from an expanded commercetools cart (workstream N-06). Pure.
import type { Cart as CtCart, DiscountCodeInfo, Reference } from '@commercetools/platform-sdk';
import { mapMoney } from '@/lib/mappers/money';
import type { CartSaving, Money, PromoCodeState, PromoReason } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

type DiscountRef = Reference & { obj?: { key?: string; name?: Record<string, string> } };

/** Merges by discount id; names come from the expanded discount (name in the locale, else key, else `fallbackName`). */
export function collectSavings(cart: CtCart, locale: string, fallbackName: string): CartSaving[] {
  const byId = new Map<string, { name: string; cent: number; currency: string; digits: number }>();
  const add = (discount: DiscountRef, cent: number, like: Money) => {
    if (cent <= 0) return;
    const hit = byId.get(discount.id);
    if (hit) {
      hit.cent += cent;
      return;
    }
    const obj = discount.obj;
    const name = getLocalizedString(obj?.name, locale) || obj?.key || fallbackName;
    byId.set(discount.id, { name, cent, currency: like.currencyCode, digits: like.fractionDigits });
  };

  for (const line of cart.lineItems ?? []) {
    const discounted = line.price.discounted;
    if (discounted) add(discounted.discount as DiscountRef, (line.price.value.centAmount - discounted.value.centAmount) * line.quantity, mapMoney(line.price.value));
    for (const per of line.discountedPricePerQuantity ?? []) {
      for (const included of per.discountedPrice.includedDiscounts) {
        add(included.discount as DiscountRef, included.discountedAmount.centAmount * per.quantity, mapMoney(included.discountedAmount));
      }
    }
  }
  for (const included of cart.discountOnTotalPrice?.includedDiscounts ?? []) add(included.discount as DiscountRef, included.discountedAmount.centAmount, mapMoney(included.discountedAmount));
  for (const included of cart.shippingInfo?.discountedPrice?.includedDiscounts ?? []) add(included.discount as DiscountRef, included.discountedAmount.centAmount, mapMoney(included.discountedAmount));

  return [...byId.entries()].map(([discountId, v]) => ({ discountId, name: v.name, amount: { centAmount: v.cent, currencyCode: v.currency, fractionDigits: v.digits } }));
}

export const STATE_REASON: Record<string, PromoReason> = {
  DoesNotMatchCart: 'does-not-match',
  NotActive: 'not-active',
  NotValid: 'not-valid',
  MaxApplicationReached: 'max-reached',
  ApplicationStoppedByPreviousDiscount: 'stopped-by-previous',
  DoesNotExist: 'not-valid',
};

function mapCodeInfo(info: DiscountCodeInfo): PromoCodeState {
  const obj = (info.discountCode as Reference & { obj?: { code?: string } }).obj;
  const applied = info.state === 'MatchesCart';
  return { code: obj?.code ?? '', id: info.discountCode.id, state: applied ? 'applied' : 'not-applied', reason: applied ? null : (STATE_REASON[info.state] ?? 'not-valid') };
}

export function mapPromoCodes(cart: CtCart): PromoCodeState[] {
  return (cart.discountCodes ?? []).map(mapCodeInfo);
}
