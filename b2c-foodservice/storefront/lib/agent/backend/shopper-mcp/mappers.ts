import { truncateDisplay } from '../../common/fencing';
import type { Cart, CartItem, CartTotals, Order, OrderItem, OrderStatus, Product } from '../../shopping/types';
import { encodeFamilyId } from '../../shopping/ids';
import { minorToMajor, unitPriceMajor } from '../../shopping/money';
import type { McpCart, McpOrder, McpProduct } from './schemas';

/**
 * Shopper MCP records to the agent's domain records. A field the MCP did not send is ABSENT in the result (omission, never null, never a
 * stand-in zero): the docs show no image, URL, rating or availability, so none is mapped (spike T-01, question Q-T-9, decides if the live
 * server carries them). Availability is "not explicitly false": with no availability field a product is in stock, and the cart refuses
 * what cannot be sold (`line_item_not_orderable`).
 */

/** The option name a family's variants are listed under: the MCP gives variant titles only, not option dimensions. */
export const VARIANT_OPTION = 'Variant';

const SHORT_DESCRIPTION_CHARS = 160;

export interface MappedProduct {
  /** The record search returns: a family once, or a plain product. */
  product: Product;
  /** The family's purchasable variants (empty for a plain product). */
  variants: Product[];
  /** The long description, when the MCP sent one. */
  longDescription?: string;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Map one MCP product, or null when it carries no price (not displayable, and the platform says such a product is not in scope). */
export function mapProduct(p: McpProduct, fallbackCurrency: string): MappedProduct | null {
  const variants = p.variants ?? [];
  const title = p.title ?? p.id;
  const description = p.description?.plain;
  const currency = variants.find((v) => v.price?.currency)?.price?.currency ?? p.price_range?.min?.currency ?? fallbackCurrency;
  const shortDescription = description ? truncateDisplay(description, SHORT_DESCRIPTION_CHARS) : undefined;
  // A fresh object per record: records must not share their label and attribute containers.
  const base = () => ({ currency, labels: [] as string[], attributes: {} as Record<string, string>, inStock: true });

  if (variants.length > 1) {
    const familyId = encodeFamilyId(p.id);
    const amounts = variants.map((v) => v.price?.amount).filter(isNumber);
    const lowest = amounts.length > 0 ? Math.min(...amounts) : p.price_range?.min?.amount;
    if (!isNumber(lowest)) return null;
    const labels = uniqueLabels(variants.map((v) => v.title ?? v.sku ?? v.id), variants.map((v) => v.sku ?? v.id));
    const mapped: Product[] = variants.flatMap((v, i) => {
      const amount = v.price?.amount ?? lowest;
      return [{ ...base(), productId: v.sku ?? v.id, title: v.title ?? title, price: minorToMajor(amount, currency), options: {}, optionValues: { [VARIANT_OPTION]: labels[i] }, variantOf: familyId }];
    });
    return {
      product: { ...base(), productId: familyId, title, price: minorToMajor(lowest, currency), ...(shortDescription ? { shortDescription } : {}), options: { [VARIANT_OPTION]: labels }, optionValues: {} },
      variants: mapped,
      ...(description ? { longDescription: description } : {}),
    };
  }

  const only = variants[0];
  const amount = only?.price?.amount ?? p.price_range?.min?.amount;
  if (!isNumber(amount)) return null;
  return {
    product: { ...base(), productId: only?.sku ?? only?.id ?? p.id, title: only?.title ?? title, price: minorToMajor(amount, currency), ...(shortDescription ? { shortDescription } : {}), options: {}, optionValues: {} },
    variants: [],
    ...(description ? { longDescription: description } : {}),
  };
}

/** Variant labels must be unique within a family or the model cannot tell them apart: a repeat gets its SKU appended. */
function uniqueLabels(labels: string[], skus: string[]): string[] {
  return labels.map((label, i) => (labels.indexOf(label) !== i || labels.lastIndexOf(label) !== i ? `${label} (${skus[i]})` : label));
}

type Totals = { type: string; amount: number }[] | undefined;
const totalOf = (totals: Totals, type: string): number | undefined => totals?.find((t) => t.type === type)?.amount;

/** A line's total in minor units: its `subtotal` entry, else unit price × quantity as the MCP stated it. */
function lineTotalMinor(line: { quantity: number; item: { price?: number }; totals?: Totals }): number | undefined {
  return totalOf(line.totals, 'subtotal') ?? (isNumber(line.item.price) ? line.item.price * line.quantity : undefined);
}

export function mapCart(cart: McpCart, fallbackCurrency: string): Cart {
  const currency = cart.currency ?? fallbackCurrency;
  const items: CartItem[] = cart.line_items.flatMap((line) => {
    const total = lineTotalMinor(line);
    if (total === undefined || line.quantity <= 0) return [];
    return [{ productId: line.item.id, title: line.item.title ?? line.item.id, price: unitPriceMajor(total, line.quantity, currency), quantity: line.quantity, optionValues: {} }];
  });
  return { items, currency };
}

/** The lines as the MCP holds them, for the read-modify-write edits (`update_cart` replaces every line). */
export function cartLines(cart: McpCart): { sku: string; quantity: number }[] {
  return cart.line_items.map((l) => ({ sku: l.item.id, quantity: l.quantity }));
}

/** Cent-exact totals for the checkout card, from the MCP `totals` (minor units). Null when the MCP sent no total and there are no line subtotals to sum. */
export function mapCartTotals(cart: McpCart, fallbackCurrency: string): CartTotals | null {
  const currency = cart.currency ?? fallbackCurrency;
  const subtotal = totalOf(cart.totals, 'subtotal');
  const discount = cart.totals?.filter((t) => /discount/i.test(t.type)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const total = totalOf(cart.totals, 'total') ?? subtotal;
  if (total === undefined) return null;
  return { currency, ...(subtotal !== undefined ? { subtotalMinor: subtotal } : {}), ...(discount ? { discountMinor: discount } : {}), totalMinor: total };
}

// Order status, in PRECEDENCE order (refund, return, cancelled, delayed, shipped, complete, processing). A confirmed order that has not
// shipped is `processing`, not `shipped`. The platform's wording is not documented beyond "processing" (spike T-01 settles it, U8): a value
// that matches no row maps to NO status and the order card is refused, so the model describes it in words instead of mislabelling it.
const STATUS_RULES: readonly [RegExp, OrderStatus][] = [
  [/refund/i, 'refunded'],
  [/return/i, 'return_initiated'],
  [/cancel/i, 'cancelled'],
  [/delay/i, 'delayed'],
  [/out[_ -]?for[_ -]?delivery/i, 'out_for_delivery'],
  [/ship|dispatch|in[_ -]?transit/i, 'shipped'],
  [/deliver|complete|fulfilled|collected/i, 'delivered'],
  [/process|confirm|open|pending|placed|preparing|received/i, 'processing'],
];

/** The order's status from its lines' statuses, by precedence; undefined when any line's wording is not one the mapping knows. */
export function mapOrderStatus(statuses: readonly (string | undefined)[]): OrderStatus | undefined {
  const matched: OrderStatus[] = [];
  for (const raw of statuses) {
    if (!raw) return undefined;
    const rule = STATUS_RULES.find(([re]) => re.test(raw));
    if (!rule) return undefined;
    matched.push(rule[1]);
  }
  if (matched.length === 0) return undefined;
  const order: OrderStatus[] = STATUS_RULES.map(([, s]) => s);
  return matched.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
}

const qtyOf = (q: McpOrder['line_items'][number]['quantity']): number => (typeof q === 'number' ? q : (q.total ?? 0));

/** An order. `placedAt`, `estimatedDelivery` and `trackingUrl` are ABSENT: the Shopper MCP sends none of them (a tracking id and a carrier are not a URL; a date derived from a method's name is invented). */
export function mapOrder(order: McpOrder, fallbackCurrency: string, storefrontHost?: string): Order {
  const currency = order.currency ?? fallbackCurrency;
  const items: OrderItem[] = order.line_items.map((line) => {
    const quantity = qtyOf(line.quantity);
    const total = lineTotalMinor({ quantity, item: line.item, totals: line.totals });
    return { productId: line.item.id, title: line.item.title ?? line.item.id, quantity, price: total === undefined ? 0 : unitPriceMajor(total, quantity, currency), optionValues: {} };
  });
  const status = mapOrderStatus(order.line_items.map((l) => l.status));
  const totalMinor = totalOf(order.totals, 'total') ?? totalOf(order.totals, 'subtotal') ?? order.line_items.reduce((sum, l) => sum + (lineTotalMinor({ quantity: qtyOf(l.quantity), item: l.item, totals: l.totals }) ?? 0), 0);
  const viewUrl = safePermalink(order.permalink_url, storefrontHost);
  return { orderId: order.id, ...(status ? { status } : {}), items, total: minorToMajor(totalMinor, currency), currency, ...(viewUrl ? { viewUrl } : {}) };
}

/** The "View order" link, kept only when it is https and on the storefront's own host. Anything else is dropped (defence in depth: it is MCP-supplied text). */
export function safePermalink(url: string | undefined, storefrontHost: string | undefined): string | undefined {
  if (!url || !storefrontHost) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.host.toLowerCase() === storefrontHost.toLowerCase() ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}
