// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { CartDiscountDraft, DiscountCodeDraft, ProductDiscountDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';
import { productByCode } from './products';

/**
 * Discounts (SEED-PLAN section 12). Cart discounts that need a code are stackable; codes are the code strings the
 * storefront shows: WELCOME10, FREESHIP, COFFEE15. sortOrder values are unique per kind and never end in 0.
 * One automatic product discount (seasonal sale) applies to selected machines.
 */
const money = (cents: number, cadCents: number) => [{ currencyCode: 'USD', centAmount: cents }, { currencyCode: 'CAD', centAmount: cadCents }];

export const SEASONAL_CODES = ['MAC-POD1', 'MAC-LEVER', 'MAC-DRIP'];
export const seasonalSkus = (): string[] => SEASONAL_CODES.flatMap((c) => productByCode(c).variants.map((v) => v.sku));

export const productDiscountDrafts = (): ProductDiscountDraft[] => [
  {
    key: K.discountSeasonal, name: ls('Seasonal machine sale'), description: ls('15% off selected machines'),
    value: { type: 'relative', permyriad: 1500 }, predicate: `sku in (${seasonalSkus().map((s) => `"${s}"`).join(', ')})`, sortOrder: '0.91', isActive: true,
  },
];

export const cartDiscountDrafts: CartDiscountDraft[] = [
  {
    key: K.discountWelcome, name: ls('Welcome 10%'), description: ls('10% off the cart with code WELCOME10'),
    value: { type: 'relative', permyriad: 1000 }, cartPredicate: 'true', target: { type: 'totalPrice' }, sortOrder: '0.51',
    requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking',
  },
  {
    // Applies to whatever shipping method the cart uses (a method-specific predicate is open, Q-S-6); the code is meant for standard shipping.
    key: K.discountFreeShip, name: ls('Free standard shipping'), description: ls('Shipping is free with code FREESHIP'),
    value: { type: 'relative', permyriad: 10000 }, cartPredicate: 'true', target: { type: 'shipping' }, sortOrder: '0.52',
    requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking',
  },
  {
    // 15 USD off over 60 USD, 20 CAD off over 80 CAD. The money array carries one amount per currency.
    key: K.discountCoffee15, name: ls('15 off coffee orders'), description: ls('15 USD (20 CAD) off a cart over 60 USD (80 CAD) with code COFFEE15'),
    value: { type: 'absolute', money: money(1500, 2000) },
    cartPredicate: 'lineItemTotal(true) >= "60.00 USD" or lineItemTotal(true) >= "80.00 CAD"', target: { type: 'totalPrice' }, sortOrder: '0.53',
    requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking',
  },
];

export const discountCodeDrafts: DiscountCodeDraft[] = [
  { key: 'mcf-code-welcome10', code: 'WELCOME10', name: ls('Welcome 10%'), cartDiscounts: [{ typeId: 'cart-discount', key: K.discountWelcome }], isActive: true },
  { key: 'mcf-code-freeship', code: 'FREESHIP', name: ls('Free shipping'), cartDiscounts: [{ typeId: 'cart-discount', key: K.discountFreeShip }], isActive: true },
  { key: 'mcf-code-coffee15', code: 'COFFEE15', name: ls('15 off'), cartDiscounts: [{ typeId: 'cart-discount', key: K.discountCoffee15 }], isActive: true },
];
