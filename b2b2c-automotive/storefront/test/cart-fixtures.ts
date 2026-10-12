// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Synthetic commercetools carts for the tests of workstream N (shaped like the API, no real data).
import type { mapCart } from '@/lib/mappers/cart';

/** The commercetools cart as the mapper reads it (the SDK type stays inside lib/ct and lib/mappers). */
type Cart = Parameters<typeof mapCart>[0];

export const money = (centAmount: number, currencyCode = 'EUR') => ({ type: 'centPrecision' as const, currencyCode, centAmount, fractionDigits: 2 });
const name = (de: string, en: string) => ({ 'de-DE': de, 'en-US': en });
const ref = (typeId: string, id: string, obj?: unknown) => ({ typeId, id, ...(obj ? { obj } : {}) });

export const brakeWeek = ref('product-discount', 'pd-brake', { key: 'mau-pd-brake', name: name('Bremsen-Woche −8 %', 'Brake week −8%') });
export const welcome = ref('cart-discount', 'cd-welcome', { key: 'mau-cd-welcome', name: name('Willkommen −5 %', 'Welcome −5%') });
export const shippingPromo = ref('cart-discount', 'cd-ship', { key: 'mau-cd-ship', name: name('Versand frei', 'Free shipping') });

const attrs = (extra: Record<string, unknown> = {}) =>
  Object.entries({ brand: { key: 'brembo', label: 'Brembo' }, 'fitment-keys': ['Volkswagen|Golf|2012|2019|2.0 TDI'], 'universal-fit': false, ...extra }).map(([n, value]) => ({ name: n, value }));

export function lineItem(id: string, sku: string, quantity: number, options: { list: number; discounted?: number; total?: number; cartDiscount?: { discount: unknown; perUnit: number }; recurrence?: boolean; supplyChannel?: string; distributionChannel?: string; attributes?: Record<string, unknown> }) {
  const unit = options.discounted ?? options.list;
  const total = options.total ?? unit * quantity - (options.cartDiscount ? options.cartDiscount.perUnit * quantity : 0);
  return {
    id,
    productId: `prod-${sku}`,
    productSlug: name(`${sku}-de`, `${sku}-en`),
    name: name(`Teil ${sku}`, `Part ${sku}`),
    quantity,
    variant: { id: 1, sku, images: [{ url: `https://images.example.com/${sku}.jpg`, dimensions: { w: 10, h: 10 } }], attributes: attrs(options.attributes) },
    price: { id: `price-${sku}`, value: money(options.list), ...(options.discounted !== undefined ? { discounted: { value: money(options.discounted), discount: brakeWeek } } : {}) },
    totalPrice: money(total),
    taxedPrice: { totalNet: money(Math.round(total / 1.19)), totalGross: money(total), taxPortions: [] },
    taxRate: { name: 'DE VAT 19%', amount: 0.19, includedInPrice: true, country: 'DE', id: 'tr' },
    discountedPricePerQuantity: options.cartDiscount
      ? [{ quantity, discountedPrice: { value: money(unit - options.cartDiscount.perUnit), includedDiscounts: [{ discount: options.cartDiscount.discount, discountedAmount: money(options.cartDiscount.perUnit) }] } }]
      : [],
    ...(options.supplyChannel ? { supplyChannel: ref('channel', options.supplyChannel) } : {}),
    ...(options.distributionChannel ? { distributionChannel: ref('channel', options.distributionChannel) } : {}),
    ...(options.recurrence
      ? { recurrenceInfo: { recurrencePolicy: ref('recurrence-policy', 'rp-1', { key: 'mau-rp-monthly', name: name('Monatlich', 'Monthly') }), priceSelectionMode: 'Dynamic' } }
      : {}),
    lineItemMode: 'Standard',
    state: [],
    priceMode: 'Platform',
  };
}

/** Two lines: brake pads x2 with the brake week product discount and a filter x1 with the welcome cart discount. Delivery is free pickup. */
export function ctCart(overrides: Record<string, unknown> = {}): Cart {
  const lines = [
    lineItem('li-1', 'BRK-1', 2, { list: 5000, discounted: 4600, supplyChannel: 'ch-branch', distributionChannel: 'ch-retail' }),
    lineItem('li-2', 'FLT-1', 1, { list: 1000, cartDiscount: { discount: welcome, perUnit: 50 } }),
  ];
  const lineTotal = lines.reduce((sum, l) => sum + l.totalPrice.centAmount, 0);
  const cart = {
    id: 'cart-1',
    version: 4,
    cartState: 'Active',
    country: 'DE',
    locale: 'de-DE',
    store: { typeId: 'store', key: 'mau-reseller-north' },
    totalPrice: money(lineTotal),
    taxedPrice: { totalNet: money(Math.round(lineTotal / 1.19)), totalGross: money(lineTotal), totalTax: money(lineTotal - Math.round(lineTotal / 1.19)), taxPortions: [{ rate: 0.19, amount: money(lineTotal - Math.round(lineTotal / 1.19)), name: 'DE VAT 19%' }] },
    lineItems: lines,
    customLineItems: [],
    discountCodes: [],
    shippingMode: 'Single',
    shippingInfo: { shippingMethodName: 'Pickup in store', price: money(0), shippingRate: { price: money(0), tiers: [] }, taxRate: { name: 'DE VAT 19%', amount: 0.19, includedInPrice: true, country: 'DE' }, shippingMethodState: 'MatchesCart', shippingMethod: ref('shipping-method', 'sm-pickup') },
    custom: { type: ref('type', 't-checkout'), fields: { pickupBranchKey: 'mau-br-north-berlin' } },
    ...overrides,
  };
  return cart as unknown as Cart;
}
