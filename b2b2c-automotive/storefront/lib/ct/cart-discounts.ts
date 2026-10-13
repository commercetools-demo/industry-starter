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

const CODE = /^[A-Z0-9_-]{1,40}$/;
const rejected = (code: string, reason: PromoReason): PromoCodeState => ({ code, id: '', state: 'not-applied', reason });

/** The typed code as the portal's campaigns write it: trimmed, upper case, at most 40 characters of `A-Z 0-9 _ -`; `null` when it cannot be a code. */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

/** W-02: the store's own campaign code `<CODE>-<STOREKEY upper>` first, then the plain code. The store key is the session's, never the request's. */
export function codeCandidates(raw: string, storeKey: string): string[] {
  const code = normalizeCode(raw);
  return code ? [`${code}-${storeKey.toUpperCase()}`, code] : [];
}

type SdkFailure = { statusCode?: number; body?: { errors?: { code?: string; reason?: string }[] } };
const nonApplicableReason = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null ? (error as SdkFailure).body?.errors?.find((e) => e.code === 'DiscountCodeNonApplicable')?.reason : undefined;

/**
 * Adds a discount code (the store-suffixed campaign code first, then the plain one). A code that exists but does not match the cart stays
 * on the cart with its state; a code that does not exist (or is malformed) is refused by commercetools, so nothing changes and `cart` is null
 * (the caller keeps the cart it has). A suffixed code that exists but cannot apply reports its own reason and the plain code is not tried.
 */
export async function applyPromoCode(storeKey: string, cartId: string, rawCode: string): Promise<{ cart: CtCart | null; promo: PromoCodeState }> {
  const typed = rawCode.trim();
  const candidates = codeCandidates(rawCode, storeKey);
  if (candidates.length === 0) return { cart: null, promo: rejected(typed, 'not-valid') };
  let last: PromoCodeState = rejected(typed, 'not-valid');
  for (const code of candidates) {
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
      if ((typeof error === 'object' && error !== null ? (error as SdkFailure).statusCode : undefined) !== 400) throw error;
      const reason = nonApplicableReason(error);
      last = rejected(typed, (reason && STATE_REASON[reason]) || 'not-valid');
      if (reason && reason !== 'DoesNotExist') return { cart: null, promo: last };
    }
  }
  return { cart: null, promo: last };
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
