// Builders for commercetools Cart JSON as the API returns it (only the fields the app reads). Cast once, here.
import type { Cart as CtCart } from '@commercetools/platform-sdk';

export interface LineSpec {
  id: string;
  sku: string;
  offerKey: string;
  quantity?: number;
  /** Unit list price in cents. */
  price: number;
  /** Engine line total in cents (defaults to price x quantity). */
  total?: number;
  /** undefined = one-time line. */
  mode?: 'Fixed' | 'Dynamic';
  parent?: string;
  /** Cart Discount ids applied to the line. */
  discounts?: string[];
  /** Cents granted per unit by each discount in `discounts` (default 1). */
  discountCents?: number;
  /** How many units carry the discounts (default: all units). */
  discountedUnits?: number;
  currency?: string;
}

export interface FeeSpec {
  id: string;
  offerKey: string;
  money: number;
  quantity?: number;
  total?: number;
}

export interface CartSpec {
  id?: string;
  version?: number;
  currency?: string;
  country?: string;
  lines?: LineSpec[];
  fees?: FeeSpec[];
  codes?: { id: string; code: string; state: string }[];
  totalPrice?: number;
  taxed?: { net: number; gross: number };
  discountOnTotal?: number;
  postalCode?: string;
}

const cents = (centAmount: number, currencyCode: string) => ({ type: 'centPrecision', centAmount, currencyCode, fractionDigits: 2 });

export function ctLine(spec: LineSpec, currency = 'USD'): unknown {
  const quantity = spec.quantity ?? 1;
  const total = spec.total ?? spec.price * quantity;
  const fields: Record<string, string> = { offerKey: spec.offerKey };
  if (spec.parent) fields.parentLineItemId = spec.parent;
  return {
    id: spec.id,
    productId: `prod-${spec.offerKey}`,
    productKey: spec.offerKey,
    name: { 'en-US': spec.offerKey },
    variant: { id: 1, sku: spec.sku },
    price: { id: `price-${spec.id}`, value: cents(spec.price, currency), ...(spec.mode ? { recurrencePolicy: { typeId: 'recurrence-policy', id: 'pol-1' } } : {}) },
    quantity,
    totalPrice: cents(total, currency),
    discountedPricePerQuantity: spec.discounts
      ? [
          ...(spec.discountedUnits !== undefined && spec.discountedUnits < quantity
            ? [{ quantity: quantity - spec.discountedUnits, discountedPrice: { value: cents(spec.price, currency), includedDiscounts: [] } }]
            : []),
          {
            quantity: spec.discountedUnits ?? quantity,
            discountedPrice: {
              value: cents(total / quantity, currency),
              includedDiscounts: spec.discounts.map((id) => ({ discount: { typeId: 'cart-discount', id }, discountedAmount: cents(spec.discountCents ?? 1, currency) })),
            },
          },
        ]
      : [],
    ...(spec.mode ? { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: 'pol-1' }, priceSelectionMode: spec.mode } } : {}),
    custom: { type: { typeId: 'type', id: 'type-line' }, fields },
    lineItemMode: 'Standard',
  };
}

export function ctFee(spec: FeeSpec, currency = 'USD'): unknown {
  const quantity = spec.quantity ?? 1;
  return {
    id: spec.id,
    name: { 'en-US': 'Activation fee', 'de-DE': 'Aktivierungsgebühr' },
    slug: `activation-fee:${spec.offerKey}`,
    quantity,
    money: cents(spec.money, currency),
    totalPrice: cents(spec.total ?? spec.money * quantity, currency),
  };
}

export function ctCart(spec: CartSpec = {}): CtCart {
  const currency = spec.currency ?? 'USD';
  const lines = spec.lines ?? [];
  const fees = spec.fees ?? [];
  const sum = lines.reduce((acc, line) => acc + (line.total ?? line.price * (line.quantity ?? 1)), 0) + fees.reduce((acc, fee) => acc + (fee.total ?? fee.money * (fee.quantity ?? 1)), 0);
  return {
    id: spec.id ?? 'cart-1',
    version: spec.version ?? 3,
    cartState: 'Active',
    country: spec.country ?? 'US',
    lineItems: lines.map((line) => ctLine(line, currency)),
    customLineItems: fees.map((fee) => ctFee(fee, currency)),
    totalPrice: cents(spec.totalPrice ?? sum, currency),
    ...(spec.taxed ? { taxedPrice: { totalNet: cents(spec.taxed.net, currency), totalGross: cents(spec.taxed.gross, currency), taxPortions: [] } } : {}),
    ...(spec.discountOnTotal ? { discountOnTotalPrice: { discountedAmount: cents(spec.discountOnTotal, currency), includedDiscounts: [] } } : {}),
    discountCodes: (spec.codes ?? []).map((entry) => ({
      discountCode: { typeId: 'discount-code', id: entry.id, obj: { id: entry.id, code: entry.code } },
      state: entry.state,
    })),
    custom: { type: { typeId: 'type', id: 'type-cart' }, fields: spec.postalCode ? { postalCode: spec.postalCode } : {} },
    taxMode: 'Platform',
    inventoryMode: 'None',
  } as unknown as CtCart;
}
