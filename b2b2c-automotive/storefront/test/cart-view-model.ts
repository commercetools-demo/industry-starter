// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// A cart view model (the mapped `Cart`) for the component and hook tests of workstream N.
import type { Cart, CartLine, DeliveryOption, Money } from '@/lib/types';

export const eur = (centAmount: number): Money => ({ centAmount, currencyCode: 'EUR', fractionDigits: 2 });

export const line = (over: Partial<CartLine> = {}): CartLine => ({
  id: 'li-1',
  sku: 'BRK-1',
  productSlug: 'bremsbelag-vorn',
  brand: 'Brembo',
  name: 'Brake pads front',
  imageUrl: null,
  quantity: 2,
  unitPrice: eur(4600),
  listUnitPrice: eur(5000),
  total: eur(9200),
  stock: { fromStore: 2, shipsLater: 0, capped: false, available: 2, branchName: 'Malva Berlin' },
  fit: 'unknown',
  fitment: { fitmentKeys: ['Volkswagen|Golf|2012|2019|2.0 TDI'], universalFit: false },
  recurrence: null,
  ...over,
});

export const pickup: DeliveryOption = { mode: 'pickup', methodKey: 'mau-ship-pickup', fee: eur(0), freeAbove: null, remainingForFree: null, branch: { key: 'b', name: 'Malva Berlin', city: 'Berlin', pickupPromise: 'today' } };
export const ship: DeliveryOption = { mode: 'ship', methodKey: 'mau-ship-standard', fee: eur(590), freeAbove: eur(15000), remainingForFree: eur(4850), branch: null };

export const cart = (over: Partial<Cart> = {}): Cart => ({
  id: 'cart-1',
  version: 4,
  lines: [line(), line({ id: 'li-2', sku: 'FLT-1', name: 'Oil filter', brand: 'Mann', quantity: 1, unitPrice: eur(1000), listUnitPrice: null, total: eur(950), stock: { fromStore: 0, shipsLater: 1, capped: false, available: 1, branchName: 'Malva Berlin' } })],
  itemCount: 3,
  delivery: { selected: 'pickup', options: [pickup, ship] },
  promoCodes: [],
  totals: {
    subtotal: eur(11000),
    savings: [
      { discountId: 'pd', name: 'Brake week −8%', amount: eur(800) },
      { discountId: 'cd', name: 'Welcome −5%', amount: eur(50) },
    ],
    delivery: eur(0),
    tax: { label: 'VAT (19%)', rate: 0.19, amount: eur(1620) },
    total: eur(10150),
    pricesIncludeTax: true,
  },
  hasSubscription: false,
  unpricedSkus: [],
  ...over,
});
