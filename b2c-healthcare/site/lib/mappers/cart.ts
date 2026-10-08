import type { Cart as CtCart, LineItem } from '@commercetools/platform-sdk';
import { mapLocalizedString, mapMoney } from '@/lib/mappers';
import type { Cart, CartLine, CartLineProblem, Money } from '@/lib/types';

/** Custom type of the line items (seed: `scripts/seed/data/types.ts`). */
export const RX_LINE_TYPE_KEY = 'mlv-rx-line';

export interface RxLineFields {
  rxNumber: string;
  rxLineRef: string;
  prescribedQty: number;
  /** Unit price at the previous read, in cents; undefined before the first read. */
  lastSeenCents?: number;
}

/** The prescription fields of a line item, or null for a line that does not carry them. */
export function rxFieldsOf(item: Pick<LineItem, 'custom'>): RxLineFields | null {
  const f = item.custom?.fields as Record<string, unknown> | undefined;
  if (!f || typeof f.rxNumber !== 'string' || typeof f.rxLineRef !== 'string') return null;
  const seen = f.lastSeenUnitPrice as { centAmount?: unknown } | undefined;
  return {
    rxNumber: f.rxNumber,
    rxLineRef: f.rxLineRef,
    prescribedQty: typeof f.prescribedQty === 'number' ? f.prescribedQty : 0,
    ...(typeof seen?.centAmount === 'number' ? { lastSeenCents: seen.centAmount } : {}),
  };
}

/** The unit price of a line as the platform selected it (the discounted price when one applies). */
export function unitPriceOf(item: LineItem): Money {
  return mapMoney(item.price.discounted?.value ?? item.price.value);
}

export interface CartMapOptions {
  /** Lines that failed re-validation, by line item id. */
  problems?: ReadonlyMap<string, CartLineProblem>;
  /** Lines whose unit price differs from the previous read. */
  priceUpdated?: ReadonlySet<string>;
}

export function mapCartLine(item: LineItem, options: CartMapOptions = {}): CartLine {
  const fields = rxFieldsOf(item);
  const problem = options.problems?.get(item.id);
  return {
    id: item.id,
    sku: item.variant.sku ?? '',
    name: mapLocalizedString(item.name),
    rxNumber: fields?.rxNumber ?? '',
    rxLineRef: fields?.rxLineRef ?? '',
    prescribedQty: fields?.prescribedQty ?? item.quantity,
    unitPrice: unitPriceOf(item),
    totalPrice: mapMoney(item.totalPrice),
    priceUpdated: options.priceUpdated?.has(item.id) ?? false,
    ...(problem ? { unavailable: problem } : {}),
  };
}

/**
 * Platform cart -> app cart. `total` is `cart.totalPrice` and the shipping row is `shippingInfo` as calculated by
 * the platform. The subtotal is the sum of the platform's own line totals, taken here on the server in integer
 * cents (the platform has no subtotal field); components never add prices (O-07).
 */
export function mapCart(cart: CtCart, options: CartMapOptions = {}): Cart {
  const lines = cart.lineItems.map((item) => mapCartLine(item, options));
  const first = cart.lineItems[0];
  const subtotal: Money | null = first
    ? { centAmount: cart.lineItems.reduce((sum, item) => sum + item.totalPrice.centAmount, 0), currencyCode: first.totalPrice.currencyCode, fractionDigits: first.totalPrice.fractionDigits }
    : null;
  const info = cart.shippingInfo;
  return {
    id: cart.id,
    version: cart.version,
    itemCount: cart.lineItems.reduce((sum, item) => sum + item.quantity, 0),
    lineCount: lines.length,
    currencyCode: cart.totalPrice.currencyCode,
    lines,
    subtotal,
    shipping: info ? { name: info.shippingMethodName, price: mapMoney(info.discountedPrice?.value ?? info.price) } : null,
    total: mapMoney(cart.totalPrice),
    unavailableCount: lines.filter((l) => l.unavailable).length,
  };
}
