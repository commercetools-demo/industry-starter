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

/** What the plan covers per unit (cents), from the line's `coveredAmount`; undefined when no cost-share was ever resolved for the line. */
export function coveredCentsOf(item: Pick<LineItem, 'custom'>): number | undefined {
  const f = item.custom?.fields as Record<string, unknown> | undefined;
  const covered = f?.coveredAmount as { centAmount?: unknown } | undefined;
  return typeof covered?.centAmount === 'number' ? covered.centAmount : undefined;
}

/** `eligibleForRestricted`, copied from the product's `hsaEligible` when the line was added. */
export function eligibleOf(item: Pick<LineItem, 'custom'>): boolean {
  return (item.custom?.fields as Record<string, unknown> | undefined)?.eligibleForRestricted === true;
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
  /** The cost-share resolver could not answer (workstream U): no cover is shown and the cart cannot be checked out. */
  unresolved?: boolean;
}

export function mapCartLine(item: LineItem, options: CartMapOptions = {}): CartLine {
  const fields = rxFieldsOf(item);
  const problem = options.problems?.get(item.id);
  const coveredUnit = coveredCentsOf(item);
  const total = mapMoney(item.totalPrice);
  const coverFields: Partial<CartLine> = options.unresolved
    ? { cover: 'unresolved' }
    : coveredUnit === undefined
      ? {}
      : {
          cover: total.centAmount === 0 ? 'covered' : coveredUnit === 0 ? 'not-covered' : 'partly',
          coveredAmount: { ...total, centAmount: coveredUnit * item.quantity },
          youOwe: total,
        };
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
    ...coverFields,
    ...(eligibleOf(item) ? { eligibleForRestricted: true } : {}),
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
  const total = mapMoney(cart.totalPrice);
  const withCover = lines.some((l) => l.coveredAmount !== undefined);
  const funding: Partial<Cart> = options.unresolved
    ? { unresolved: true }
    : withCover
      ? { youOwe: total, planCovers: { ...total, centAmount: lines.reduce((sum, l) => sum + (l.coveredAmount?.centAmount ?? 0), 0) } }
      : {};
  return {
    id: cart.id,
    version: cart.version,
    itemCount: cart.lineItems.reduce((sum, item) => sum + item.quantity, 0),
    lineCount: lines.length,
    currencyCode: cart.totalPrice.currencyCode,
    lines,
    subtotal,
    shipping: info ? { name: info.shippingMethodName, price: mapMoney(info.discountedPrice?.value ?? info.price) } : null,
    total,
    unavailableCount: lines.filter((l) => l.unavailable).length,
    ...funding,
  };
}
