import type { Cart as CtCart, LineItem } from '@commercetools/platform-sdk';
import { groupKeyOf, groupLines } from '@/lib/cart/plan';
import type { CartEnrichment } from '@/lib/mappers/cart';
import type { Cart, CartLine, CartLineStore, Money, Store } from '@/lib/types';

/** Test data for the cart (workstream I): commercetools-shaped carts for server code, view-shaped carts for the UI. */
export const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
export const cad = (centAmount: number): Money => ({ centAmount, currencyCode: 'CAD' });
const ct = (centAmount: number, currencyCode = 'USD') => ({ type: 'centPrecision' as const, centAmount, currencyCode, fractionDigits: 2 });

export const STORE_SOHO: Store = {
  id: 'ch-soho', key: 'mcf-store-nyc-soho', name: 'Malva SoHo', addressLine: '1 Prince St', city: 'New York', postalCode: '10012',
  country: 'US', timeZone: 'America/New_York', collectionMinutes: 15,
  hours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
};
export const STORE_BK: Store = { ...STORE_SOHO, id: 'ch-bk', key: 'mcf-store-brooklyn', name: 'Malva Brooklyn', addressLine: '2 Bedford Ave' };

export interface CtLineOpts {
  id: string; sku: string; productId?: string; quantity?: number; cents?: number; fulfilment?: string | null;
  channelId?: string; policyId?: string; discountedCents?: number; totalCents?: number; currency?: string; custom?: Record<string, unknown>;
  includedInPrice?: boolean;
}

/** A commercetools line item with the fields the mapper reads. */
export function ctLine(o: CtLineOpts): LineItem {
  const currency = o.currency ?? 'USD';
  const quantity = o.quantity ?? 1;
  const unit = o.discountedCents ?? o.cents ?? 1000;
  const fields: Record<string, unknown> = { ...(o.fulfilment === null ? {} : { fulfilment: o.fulfilment ?? 'delivery' }), ...o.custom };
  return {
    id: o.id,
    productId: o.productId ?? `p-${o.sku}`,
    productSlug: { 'en-US': `slug-${o.sku}` },
    name: { 'en-US': `Product ${o.sku}` },
    productType: { typeId: 'product-type', id: 'pt' },
    variant: { id: 1, sku: o.sku, images: [{ url: `https://img.example.com/${o.sku}.jpg`, dimensions: { w: 1, h: 1 }, label: `Image ${o.sku}` }] },
    price: { id: 'pr', value: ct(o.cents ?? 1000, currency), ...(o.discountedCents ? { discounted: { value: ct(o.discountedCents, currency), discount: { typeId: 'product-discount', id: 'd' } } } : {}) },
    quantity,
    totalPrice: ct(o.totalCents ?? unit * quantity, currency),
    taxRate: { name: 'tax', amount: 0.08, includedInPrice: o.includedInPrice ?? false, country: 'US' },
    discountedPricePerQuantity: [], state: [], perMethodTaxRate: [], priceMode: 'Platform', lineItemMode: 'Standard',
    ...(o.channelId ? { supplyChannel: { typeId: 'channel' as const, id: o.channelId } } : {}),
    ...(o.policyId ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy' as const, id: o.policyId }, priceSelectionMode: 'Fixed' as const } } : {}),
    custom: { type: { typeId: 'type', id: 't' }, fields },
  } as unknown as LineItem;
}

export interface CtCartOpts {
  lines?: LineItem[]; id?: string; version?: number; currency?: string; country?: string; shippingCents?: number | null;
  taxCents?: number | null; totalCents?: number; mode?: 'Single' | 'Multiple'; codes?: { id: string; code: string; state: string; name?: string }[];
  anonymousId?: string; customerId?: string; cartState?: string;
}

/** A commercetools cart. Totals default to the sum of the line totals (net), plus shipping and tax when given. */
export function ctCart(o: CtCartOpts = {}): CtCart {
  const lines = o.lines ?? [];
  const currency = o.currency ?? 'USD';
  const net = lines.reduce((n, l) => n + l.totalPrice.centAmount, 0);
  const shipping = o.shippingCents === undefined ? 695 : o.shippingCents;
  const tax = o.taxCents === undefined ? 100 : o.taxCents;
  const gross = o.totalCents ?? net + (shipping ?? 0) + (tax ?? 0);
  return {
    id: o.id ?? 'cart-1', version: o.version ?? 3, cartState: o.cartState ?? 'Active', country: o.country ?? 'US', locale: 'en-US',
    lineItems: lines, customLineItems: [], totalLineItemQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    totalPrice: ct(net + (shipping ?? 0), currency), shippingMode: o.mode ?? 'Single',
    ...(o.anonymousId ? { anonymousId: o.anonymousId } : {}), ...(o.customerId ? { customerId: o.customerId } : {}),
    ...(tax === null ? {} : { taxedPrice: { totalNet: ct(net + (shipping ?? 0), currency), totalGross: ct(gross, currency), totalTax: ct(tax, currency), taxPortions: [] } }),
    ...(shipping === null || lines.length === 0 ? {} : { shippingInfo: { shippingMethodName: 'Standard', price: ct(shipping, currency), shippingRate: { price: ct(695, currency), tiers: [] }, shippingMethodState: 'MatchesCart' } }),
    discountCodes: (o.codes ?? []).map((c) => ({ discountCode: { typeId: 'discount-code', id: c.id, obj: { id: c.id, code: c.code, ...(c.name ? { name: { 'en-US': c.name } } : {}) } }, state: c.state })),
    directDiscounts: [], refusedGifts: [], origin: 'Customer', itemShippingAddresses: [],
  } as unknown as CtCart;
}

export const vt = (key: string, v: Record<string, string | number>) =>
  key === 'variant.intensity' ? `Intensity ${v.n}` : key === 'variant.capsules' ? `${v.count} capsules` : `${v.n} g`;

/** A full enrichment for products `p-<sku>`: every SKU is a pod with intensity 8 and 10 capsules unless `products` says otherwise. */
export function enrichment(over: Partial<CartEnrichment> = {}): CartEnrichment {
  return { products: {}, inventory: null, stores: [STORE_SOHO, STORE_BK], threshold: usd(7500), policies: {}, nudge: null, ...over };
}

// ---------------------------------------------------------------- view-shaped carts for the UI

const storeOf = (s: Store): CartLineStore => ({ key: s.key, id: s.id, name: s.name, addressLine: s.addressLine, city: s.city, collectionMinutes: s.collectionMinutes });

export function viewLine(o: Partial<CartLine> & { id: string; fulfilment?: CartLine['fulfilment']; store?: Store | CartLineStore }): CartLine {
  const fulfilment = o.fulfilment ?? 'delivery';
  const store = o.store ? ('postalCode' in o.store ? storeOf(o.store) : o.store) : fulfilment === 'collect' ? storeOf(STORE_SOHO) : undefined;
  const quantity = o.quantity ?? 1;
  const unitPrice = o.unitPrice ?? usd(1000);
  const { store: _s, ...rest } = o;
  void _s;
  return {
    sku: `SKU-${o.id}`, productId: `p-${o.id}`, slug: `slug-${o.id}`, name: `Product ${o.id}`, imageAlt: `Product ${o.id}`,
    variantSummary: 'Intensity 8 · 10 capsules', quantity, unitPrice, total: { ...unitPrice, centAmount: unitPrice.centAmount * quantity },
    groupKey: groupKeyOf({ fulfilment, store }), notices: [], maxQuantity: 99, ...rest, fulfilment, ...(store ? { store } : {}),
  };
}

export function viewCart(lines: CartLine[], over: Partial<Cart> = {}): Cart {
  const subtotal = lines.reduce((n, l) => n + l.total.centAmount, 0);
  const shippable = lines.filter((l) => l.fulfilment !== 'collect').reduce((n, l) => n + l.total.centAmount, 0);
  return {
    id: 'cart-1', version: 3, currency: 'USD', country: 'US', shippingMode: 'Single',
    count: lines.reduce((n, l) => n + l.quantity, 0), lines, groups: groupLines(lines),
    subtotal: usd(subtotal), discount: null, shipping: { amount: usd(695), isFree: false }, tax: { amount: usd(120), included: false },
    total: usd(subtotal + 695 + 120), codes: [],
    freeShipping: shippable === 0 ? { threshold: usd(7500), remaining: null, reached: false } : shippable >= 7500 ? { threshold: usd(7500), remaining: null, reached: true } : { threshold: usd(7500), remaining: usd(7500 - shippable), reached: false },
    minimumOrder: { value: null, shortfall: null }, canCheckout: lines.length > 0, blockers: lines.length > 0 ? [] : ['empty'], nudge: null, ...over,
  };
}
