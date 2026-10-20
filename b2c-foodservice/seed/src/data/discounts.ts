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
const money = (cents: number) => [{ currencyCode: 'USD', centAmount: cents }, { currencyCode: 'EUR', centAmount: cents }, { currencyCode: 'GBP', centAmount: cents }];

export const SEASONAL_CODES = ['MAC-POD1', 'MAC-LEVER', 'MAC-DRIP'];
export const seasonalSkus = (): string[] => SEASONAL_CODES.flatMap((c) => productByCode(c).variants.map((v) => v.sku));

export const productDiscountDrafts = (): ProductDiscountDraft[] => [
  {
    key: K.discountSeasonal, name: ls('Seasonal machine sale', 'Saisonaktion Maschinen'), description: ls('15% off selected machines', '15 % auf ausgewählte Maschinen'),
    value: { type: 'relative', permyriad: 1500 }, predicate: `sku in (${seasonalSkus().map((s) => `"${s}"`).join(', ')})`, sortOrder: '0.91', isActive: true,
  },
];

export const cartDiscountDrafts: CartDiscountDraft[] = [
  {
    key: K.discountWelcome, name: ls('Welcome 10%', 'Willkommen 10 %'), description: ls('10% off the cart with code WELCOME10', '10 % auf den Warenkorb mit Code WELCOME10'),
    value: { type: 'relative', permyriad: 1000 }, cartPredicate: 'true', target: { type: 'totalPrice' }, sortOrder: '0.51',
    requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking',
  },
  {
    // Applies to whatever shipping method the cart uses (a method-specific predicate is open, Q-S-6); the code is meant for standard shipping.
    key: K.discountFreeShip, name: ls('Free standard shipping', 'Gratis Standardversand'), description: ls('Shipping is free with code FREESHIP', 'Versand gratis mit Code FREESHIP'),
    value: { type: 'relative', permyriad: 10000 }, cartPredicate: 'true', target: { type: 'shipping' }, sortOrder: '0.52',
    requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking',
  },
  {
    // 15 off over 60 (USD), 55 (EUR), 50 (GBP). The money array carries one amount per currency.
    key: K.discountCoffee15, name: ls('15 off coffee orders', '15 Rabatt ab Mindestbestellwert'), description: ls('15 off a cart over 60 USD, 55 EUR or 50 GBP with code COFFEE15', '15 Rabatt ab 60 USD, 55 EUR oder 50 GBP mit Code COFFEE15'),
    value: { type: 'absolute', money: money(1500) },
    cartPredicate: 'lineItemTotal(true) >= "60.00 USD" or lineItemTotal(true) >= "55.00 EUR" or lineItemTotal(true) >= "50.00 GBP"', target: { type: 'totalPrice' }, sortOrder: '0.53',
    requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking',
  },
];

export const discountCodeDrafts: DiscountCodeDraft[] = [
  { key: 'mcf-code-welcome10', code: 'WELCOME10', name: ls('Welcome 10%', 'Willkommen 10 %'), cartDiscounts: [{ typeId: 'cart-discount', key: K.discountWelcome }], isActive: true },
  { key: 'mcf-code-freeship', code: 'FREESHIP', name: ls('Free shipping', 'Gratis Versand'), cartDiscounts: [{ typeId: 'cart-discount', key: K.discountFreeShip }], isActive: true },
  { key: 'mcf-code-coffee15', code: 'COFFEE15', name: ls('15 off', '15 Rabatt'), cartDiscounts: [{ typeId: 'cart-discount', key: K.discountCoffee15 }], isActive: true },
];
