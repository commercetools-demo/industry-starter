// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Named savings and promo codes of the cart (workstream N-06, D7): Product Discounts, Cart Discounts and Discount Codes only.
// Direct Discounts block Discount Codes and are never sent. Needs these expansions on the cart read (see `CART_EXPAND`).
import 'server-only';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/ct/cart-retry';
import { inStore } from '@/lib/ct/in-store';
import { collectSavings, mapPromoCodes, STATE_REASON } from '@/lib/mappers/cart-savings';
import type { PromoCodeState, PromoReason } from '@/lib/types';

export const CART_EXPAND = [
  'lineItems[*].price.discounted.discount',
  'lineItems[*].discountedPricePerQuantity[*].discountedPrice.includedDiscounts[*].discount',
  'lineItems[*].recurrenceInfo.recurrencePolicy',
  'discountOnTotalPrice.includedDiscounts[*].discount',
  'shippingInfo.discountedPrice.includedDiscounts[*].discount',
  'discountCodes[*].discountCode',
  'shippingInfo.shippingMethod',
];

export { collectSavings, mapPromoCodes };

const CODE = /^[A-Za-z0-9_-]{1,64}$/;
const rejected = (code: string, reason: PromoReason): PromoCodeState => ({ code, id: '', state: 'not-applied', reason });

/**
 * Adds a discount code. A code that exists but does not match the cart stays on the cart with its state; a code that does not exist
 * (or is malformed) is refused by commercetools, so nothing changes and `cart` is null (the caller keeps the cart it has).
 */
export async function applyPromoCode(storeKey: string, cartId: string, rawCode: string): Promise<{ cart: CtCart | null; promo: PromoCodeState }> {
  const code = rawCode.trim();
  if (!CODE.test(code)) return { cart: null, promo: rejected(code, 'not-valid') };
  try {
    const cart = await withCartRetry(storeKey, cartId, async (current) => {
      const { body } = await inStore(storeKey)
        .carts()
        .withId({ ID: cartId })
        .post({ body: { version: current.version, actions: [{ action: 'addDiscountCode', code }] }, queryArgs: { expand: CART_EXPAND } })
        .execute();
      return body;
    });
    const entry = mapPromoCodes(cart).find((p) => p.code.toLowerCase() === code.toLowerCase());
    return { cart, promo: entry ?? rejected(code, 'not-valid') };
  } catch (error) {
    const body = typeof error === 'object' && error !== null ? (error as { statusCode?: number; body?: { errors?: { code?: string; reason?: string }[] } }) : {};
    if (body.statusCode === 400) {
      const reason = body.body?.errors?.find((e) => e.code === 'DiscountCodeNonApplicable')?.reason;
      return { cart: null, promo: rejected(code, (reason && STATE_REASON[reason]) || 'not-valid') };
    }
    throw error;
  }
}

export async function removePromoCode(storeKey: string, cartId: string, discountCodeId: string): Promise<CtCart> {
  return withCartRetry(storeKey, cartId, async (current) => {
    const { body } = await inStore(storeKey)
      .carts()
      .withId({ ID: cartId })
      .post({ body: { version: current.version, actions: [{ action: 'removeDiscountCode', discountCode: { typeId: 'discount-code', id: discountCodeId } }] }, queryArgs: { expand: CART_EXPAND } })
      .execute();
    return body;
  });
}
