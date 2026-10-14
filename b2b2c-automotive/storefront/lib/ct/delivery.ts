// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Delivery of the cart (workstream N-04, D4, D5, D19): pickup at the shopper's branch (`mau-ship-pickup`, rate 0) or standard shipping
// (`mau-ship-standard`, rate and `freeAbove` from the matching zone rate). The choice presets the cart for commercetools Checkout,
// which collects the real address and offers express; the cart never collects a street address.
import 'server-only';
import type { Cart as CtCart, CartUpdateAction, ShippingMethod } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { apiRoot } from '@/lib/ct/client';
import { CART_EXPAND } from '@/lib/ct/cart-discounts';
import { withCartRetry } from '@/lib/ct/cart-retry';
import { inStore } from '@/lib/ct/in-store';
import { mapMoney } from '@/lib/mappers/money';
import type { DeliveryMode, DeliveryOption, Money } from '@/lib/types';

export const SHIP_PICKUP_KEY = 'mau-ship-pickup';
export const SHIP_STANDARD_KEY = 'mau-ship-standard';
export const CHECKOUT_TYPE_KEY = 'malva-checkout';
export const PICKUP_BRANCH_FIELD = 'pickupBranchKey';

export type DeliveryBranch = NonNullable<DeliveryOption['branch']>;
/** The pickup branch as the cart layer needs it to preset the cart. */
export interface PickupPlace {
  key: string;
  address: { street: string; postalCode: string; city: string };
}

const MODE_OF: Record<string, DeliveryMode> = { [SHIP_PICKUP_KEY]: 'pickup', [SHIP_STANDARD_KEY]: 'ship' };

function rateOf(method: ShippingMethod, currency: string): { fee: Money; freeAbove: Money | null } | null {
  for (const zoneRate of method.zoneRates ?? []) {
    const rate = zoneRate.shippingRates.find((r) => r.isMatching !== false && r.price.currencyCode === currency);
    if (rate) return { fee: mapMoney(rate.price), freeAbove: rate.freeAbove ? mapMoney(rate.freeAbove) : null };
  }
  return null;
}

/**
 * The methods that match the cart (`matching-cart`), reduced to pickup and standard. Pickup needs a branch. A method without a rate in
 * the cart currency is dropped. An empty list means "No delivery option available" (a shipping predicate that matches nothing fails silently).
 */
export async function getDeliveryOptions(cart: CtCart, branch: DeliveryBranch | null): Promise<DeliveryOption[]> {
  const { body } = await apiRoot
    .shippingMethods()
    .matchingCart()
    .get({ queryArgs: { cartId: cart.id, expand: ['zoneRates[*].zone'] } })
    .execute();
  const currency = cart.totalPrice.currencyCode;
  const goods = (cart.lineItems ?? []).reduce((sum, line) => sum + line.totalPrice.centAmount, 0);
  const options: DeliveryOption[] = [];
  for (const key of [SHIP_PICKUP_KEY, SHIP_STANDARD_KEY]) {
    const method = body.results.find((m) => m.key === key);
    const mode = MODE_OF[key];
    if (!method || (mode === 'pickup' && !branch)) continue;
    const rate = rateOf(method, currency);
    if (!rate) continue;
    const free = rate.freeAbove !== null && goods >= rate.freeAbove.centAmount;
    const fee = free ? { ...rate.fee, centAmount: 0 } : rate.fee;
    const remaining = rate.freeAbove !== null && !free ? { ...rate.freeAbove, centAmount: rate.freeAbove.centAmount - goods } : null;
    options.push({ mode, methodKey: key, fee, freeAbove: rate.freeAbove, remainingForFree: remaining, branch: mode === 'pickup' ? branch : null });
  }
  return options;
}

/** Presets the cart: the shipping method, the matching address (branch address for pickup, country only for shipping) and `pickupBranchKey`. */
export async function setDelivery(storeKey: string, cartId: string, mode: DeliveryMode, place: PickupPlace | null): Promise<CtCart> {
  if (mode === 'pickup' && !place) throw new ApiError(422, 'no-branch');
  return withCartRetry(storeKey, cartId, async (cart) => {
    const country = cart.country ?? cart.shippingAddress?.country ?? 'DE';
    const hasCustom = Boolean(cart.custom?.type);
    const actions: CartUpdateAction[] = [];
    if (mode === 'pickup' && place) {
      actions.push({ action: 'setShippingAddress', address: { country, city: place.address.city, postalCode: place.address.postalCode, streetName: place.address.street } });
      actions.push({ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: SHIP_PICKUP_KEY } });
      actions.push(
        hasCustom
          ? { action: 'setCustomField', name: PICKUP_BRANCH_FIELD, value: place.key }
          : { action: 'setCustomType', type: { typeId: 'type', key: CHECKOUT_TYPE_KEY }, fields: { [PICKUP_BRANCH_FIELD]: place.key } },
      );
    } else {
      actions.push({ action: 'setShippingAddress', address: { country } });
      actions.push({ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: SHIP_STANDARD_KEY } });
      if (hasCustom && cart.custom?.fields?.[PICKUP_BRANCH_FIELD] !== undefined) actions.push({ action: 'setCustomField', name: PICKUP_BRANCH_FIELD });
    }
    const { body } = await inStore(storeKey)
      .carts()
      .withId({ ID: cartId })
      .post({ body: { version: cart.version, actions }, queryArgs: { expand: CART_EXPAND } })
      .execute();
    return body;
  });
}
