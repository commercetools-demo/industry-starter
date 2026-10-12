// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { CartDiscountDraft, DiscountCodeDraft, ProductDiscountDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';
import { systemKey } from './categories';

/**
 * Discounts (design-discounts-and-priority). Funding is encoded two ways because product discounts have no custom
 * fields: the key (`mau-pd-malva-*` vs `mau-pd-<reseller>-*`), and for cart discounts the type `mau-cart-discount-fields`.
 *
 * sortOrder: Malva-funded discounts take the LOWEST values (0.1x), reseller ones come after (0.5x+). Which direction the
 * platform ranks (design says "higher fires first") must be confirmed live, see Q-S05; the values are data, easy to flip.
 * Only one product discount applies per product (the highest ranked), so scopes are kept disjoint per reseller.
 */
const cat = (system: string) => `categoriesWithAncestors.key contains "${systemKey(system)}"`;
const rel = (percent: number) => ({ type: 'relative' as const, permyriad: percent * 100 });

export const productDiscountDrafts: ProductDiscountDraft[] = [
  {
    key: 'mau-pd-malva-filter-autumn', name: ls('Malva Herbstaktion Filter', 'Malva autumn filter promotion'), description: ls('Malva-finanziert, 10 % auf alle Filter', 'Malva-funded, 10% on all filters'),
    value: rel(10), predicate: cat('filters'), sortOrder: '0.11', isActive: true,
  },
  {
    key: 'mau-pd-north-brake-week', name: ls('Küstenwerk Bremsenwoche', 'Küstenwerk brake week'), description: ls('Reseller-Rabatt Nord, 8 % auf Bremsen', 'North reseller discount, 8% on brakes'),
    value: rel(8), predicate: cat('brakes'), sortOrder: '0.51', isActive: true,
  },
  {
    key: 'mau-pd-south-battery-bonus', name: ls('Südkamm Batteriebonus', 'Südkamm battery bonus'), description: ls('Reseller-Rabatt Süd, 5 EUR / 5 USD je Batterie', 'South reseller discount, 5 EUR / 5 USD per battery'),
    value: { type: 'absolute', money: [{ currencyCode: 'EUR', centAmount: 500 }, { currencyCode: 'USD', centAmount: 500 }] },
    predicate: 'categories.key contains "mau-cat-electrical-batteries"', sortOrder: '0.52', isActive: true,
  },
];

const cartType = (fields: Record<string, unknown>) => ({ type: { typeId: 'type' as const, key: 'mau-cart-discount-fields' }, fields });

export const cartDiscountDrafts: CartDiscountDraft[] = [
  {
    key: 'mau-cd-malva-welcome', name: ls('Malva Willkommensrabatt', 'Malva welcome discount'), description: ls('Malva-finanziert, 5 % auf den Warenkorb mit Code', 'Malva-funded, 5% off the cart with a code'),
    value: { type: 'relative', permyriad: 500 }, cartPredicate: 'true', target: { type: 'totalPrice' }, sortOrder: '0.11',
    requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking', custom: cartType({ fundedBy: 'malva' }),
  },
  {
    key: 'mau-cd-north-large-order', name: ls('Küstenwerk Großauftrag -3 %', 'Küstenwerk large order -3%'), description: ls('3 % ab 2.000 EUR Warenwert', '3% from a 2,000 EUR cart'),
    value: { type: 'relative', permyriad: 300 }, cartPredicate: 'lineItemTotal(true) >= "2000.00 EUR"', target: { type: 'totalPrice' }, sortOrder: '0.51',
    requiresDiscountCode: false, isActive: true, stackingMode: 'Stacking', custom: cartType({ fundedBy: 'reseller', storeKey: K.storeNorth }),
  },
  {
    key: 'mau-cd-south-brake-code', name: ls('Südkamm Bremsen-Code', 'Südkamm brake code'), description: ls('5 % auf Bremsenteile, nur mit passendem Warenkorb', '5% on brake parts, only for a matching cart'),
    value: { type: 'relative', permyriad: 500 }, cartPredicate: 'lineItemExists(categoriesWithAncestors.key contains "mau-cat-brakes")', target: { type: 'lineItems', predicate: 'categoriesWithAncestors.key contains "mau-cat-brakes"' },
    sortOrder: '0.52', requiresDiscountCode: true, isActive: true, stackingMode: 'Stacking', custom: cartType({ fundedBy: 'reseller', storeKey: K.storeSouth }),
  },
  {
    key: 'mau-cd-south-free-shipping', name: ls('Südkamm Gratisversand', 'Südkamm free shipping'), description: ls('Versand gratis ab 120 EUR', 'Free shipping from 120 EUR'),
    value: { type: 'absolute', money: [{ currencyCode: 'EUR', centAmount: 590 }, { currencyCode: 'USD', centAmount: 990 }] },
    cartPredicate: 'lineItemTotal(true) >= "120.00 EUR"', target: { type: 'shipping' }, sortOrder: '0.53', requiresDiscountCode: false, isActive: false, stackingMode: 'Stacking',
    custom: cartType({ fundedBy: 'reseller', storeKey: K.storeSouth }),
  },
];

export const discountCodeDrafts: DiscountCodeDraft[] = [
  { key: 'mau-dc-welcome5', code: 'MALVA-WELCOME5', name: ls('Willkommen 5 %', 'Welcome 5%'), cartDiscounts: [{ typeId: 'cart-discount', key: 'mau-cd-malva-welcome' }], isActive: true },
  { key: 'mau-dc-brake5', code: 'SUEDKAMM-BRAKE5', name: ls('Bremsen 5 %', 'Brakes 5%'), cartDiscounts: [{ typeId: 'cart-discount', key: 'mau-cd-south-brake-code' }], isActive: true },
];
