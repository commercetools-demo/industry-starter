import type { Cart as CtCart, LineItem } from '@commercetools/platform-sdk';
import { toCodeState, stateReasonKey } from '@/lib/cart/discount-reasons';
import { groupKeyOf, groupLines } from '@/lib/cart/plan';
import { blockers, freeShipping, minimumOrder, variantSummary, type VariantTranslator } from '@/lib/cart/summary';
import { availabilityState } from '@/lib/availability';
import { BRANDS, brandOfLineFields } from '@/lib/brands';
import { bundlePresetOf, childrenOf, isBundleChild, isBundleParent } from '@/lib/mappers/bundle-lines';
import { mapMoney } from '@/lib/mappers/money';
import { CART_MAX_LINE_QUANTITY, LOW_STOCK_THRESHOLD } from '@/lib/shop-config';
import type {
  AppliedCode, Cart, CartLine, CartLineStore, CartNudge, Fulfilment, InventoryDetail, LineNotice, Money, ProductShape,
  RecurrencePolicyView, Store, VariantAttrValue,
} from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/** Minimal cart for the quick add path (the full view is `mapCart`; these fields stay a subset of it). */
/** Units in the bag. A bundle's parts are not counted: the bundle counts once, at its own quantity (workstream V, D8). */
export function unitsOf(lines: readonly Pick<LineItem, 'id' | 'quantity' | 'key' | 'custom'>[]): number {
  return lines.filter((l) => !isBundleChild(l)).reduce((n, l) => n + l.quantity, 0);
}

export function mapCartSummary(c: Pick<CtCart, 'id' | 'version' | 'lineItems' | 'totalLineItemQuantity'>) {
  return {
    id: c.id,
    version: c.version,
    count: unitsOf(c.lineItems),
    lines: c.lineItems.filter((l) => !isBundleChild(l)).map((l) => ({ id: l.id, sku: l.variant?.sku ?? '', quantity: l.quantity })),
  };
}

export interface EnrichedVariant {
  /** Product and variant attributes as enum keys, numbers or text. */
  attrs: Record<string, VariantAttrValue>;
  labels: Record<string, string>;
  /** The price the shopper would get now (discounted when a product discount applies). */
  currentPrice?: Money;
}
export interface EnrichedProduct {
  shape: ProductShape;
  systemKey?: string;
  variants: Record<string, EnrichedVariant>;
}

/** What the batched reads add to a cart (lib/ct/cart-enrich.ts). Plain data. */
export interface CartEnrichment {
  products: Record<string, EnrichedProduct>;
  /** Strongly consistent stock per SKU. null: the read failed, so no stock flag is raised. */
  inventory: Record<string, InventoryDetail> | null;
  stores: Store[];
  sessionStoreKey?: string;
  /** Free-shipping threshold of the cart's market. */
  threshold: Money | null;
  /** Recurrence schedule per policy id. */
  policies: Record<string, RecurrencePolicyView['schedule']>;
  nudge: CartNudge | null;
  /** Workstream V: the presets of each bundle product (by product id), for the bag's bundle name and discount. */
  bundles?: Record<string, Record<number, { name: string; discountPercent: number }>>;
}

export interface MapContext {
  locale: string;
  t: VariantTranslator;
  /** Collection is offered in this market (US). */
  collection: boolean;
  /** Minimum order value in minor units (0 = off). */
  minOrder?: number;
  /** Unit prices before a change that was just detected, by line id. */
  previousPrices?: Record<string, Money>;
}

export const EMPTY_ENRICHMENT: CartEnrichment = {
  products: {}, inventory: {}, stores: [], threshold: null, policies: {}, nudge: null,
};

const FULFILMENTS: readonly Fulfilment[] = ['collect', 'delivery', 'subscribe'];

/** The custom field first, derived from the line when missing (a line added by another channel). */
export function fulfilmentOf(l: Pick<LineItem, 'custom' | 'recurrenceInfo' | 'supplyChannel'>): Fulfilment {
  const raw: unknown = l.custom?.fields?.fulfilment;
  if (typeof raw === 'string' && (FULFILMENTS as readonly string[]).includes(raw)) return raw as Fulfilment;
  if (l.recurrenceInfo) return 'subscribe';
  // A supply channel means collect only for a brand with pickup: Malva Drinks lines carry the brand's inventory channel, which is not a store.
  if (l.supplyChannel && BRANDS[brandOfLineFields(l.custom?.fields)].pickup) return 'collect';
  return 'delivery';
}

/** The price paid per unit before cart-level discounts: the discounted price when a product discount applies. */
export function effectivePrice(l: Pick<LineItem, 'price'>): Money {
  return mapMoney(l.price.discounted?.value ?? l.price.value);
}

/**
 * Lines whose stored price differs from the price the shopper would get now (subscribe lines are excluded: their price is
 * the recurring one). Returns the previous unit price per line id. Pure.
 */
export function detectPriceChanges(ct: Pick<CtCart, 'lineItems'>, enrichment: Pick<CartEnrichment, 'products'>): Record<string, Money> {
  const out: Record<string, Money> = {};
  for (const l of ct.lineItems) {
    if (fulfilmentOf(l) === 'subscribe') continue;
    // An external price is set by the shop (a preset bundle's parent, workstream V); the catalogue price does not apply to it.
    if (l.priceMode === 'ExternalPrice') continue;
    const current = enrichment.products[l.productId]?.variants[l.variant?.sku ?? '']?.currentPrice;
    if (!current) continue;
    const stored = effectivePrice(l);
    if (stored.centAmount !== current.centAmount || stored.currencyCode !== current.currencyCode) out[l.id] = stored;
  }
  return out;
}

function storeOf(channelId: string | undefined, stores: readonly Store[]): CartLineStore | undefined {
  const s = channelId ? stores.find((x) => x.id === channelId) : undefined;
  return s
    ? { key: s.key, id: s.id, name: s.name, addressLine: s.addressLine, city: s.city, collectionMinutes: s.collectionMinutes }
    : undefined;
}

function noticesOf(
  l: LineItem, fulfilment: Fulfilment, inventory: CartEnrichment['inventory'], storeId: string | undefined, previous: Money | undefined,
): { notices: LineNotice[]; maxQuantity: number } {
  const notices: LineNotice[] = [];
  let max = CART_MAX_LINE_QUANTITY;
  if (previous) notices.push({ kind: 'price-updated', previous });
  const stored: unknown = l.custom?.fields?.priceWas;
  if (!previous && typeof stored === 'number' && stored > 0 && stored !== effectivePrice(l).centAmount) {
    notices.push({ kind: 'price-updated', previous: { centAmount: stored, currencyCode: l.price.value.currencyCode } });
  }
  if (inventory) {
    const entry = inventory[l.variant?.sku ?? ''];
    const available = fulfilment === 'collect' ? (storeId ? (entry?.stores[storeId] ?? 0) : 0) : (entry?.online ?? 0);
    max = Math.min(max, Math.max(available, 1));
    if (available <= 0) notices.push({ kind: fulfilment === 'collect' ? 'collect-unavailable' : 'out-of-stock' });
    else if (l.quantity > available) notices.push({ kind: 'quantity-exceeds-stock', available });
  }
  return { notices, maxQuantity: max };
}

function mapLine(l: LineItem, e: CartEnrichment, ctx: MapContext): CartLine {
  const sku = l.variant?.sku ?? '';
  const fulfilment = fulfilmentOf(l);
  const brand = brandOfLineFields(l.custom?.fields);
  const product = e.products[l.productId];
  const variant = product?.variants[sku];
  const store = fulfilment === 'collect' ? storeOf(l.supplyChannel?.id, e.stores) : undefined;
  const name = getLocalizedString(l.name, ctx.locale);
  const image = l.variant?.images?.[0];
  const unit = effectivePrice(l);
  const list = mapMoney(l.price.value);
  const { notices, maxQuantity } = noticesOf(l, fulfilment, e.inventory, l.supplyChannel?.id, ctx.previousPrices?.[l.id]);

  let collectAtSessionStore: CartLine['collectAtSessionStore'];
  // No Collect chip on a line of a brand without pickup (Malva Drinks).
  if (fulfilment === 'delivery' && ctx.collection && BRANDS[brand].pickup) {
    const s = e.stores.find((x) => x.key === e.sessionStoreKey);
    collectAtSessionStore =
      s && e.inventory ? { storeKey: s.key, storeName: s.name, state: availabilityState(e.inventory[sku]?.stores[s.id] ?? 0, LOW_STOCK_THRESHOLD) } : null;
  }
  const policyId = l.recurrenceInfo?.recurrencePolicy?.id;
  const schedule = policyId ? e.policies[policyId] : undefined;

  return {
    id: l.id, sku, productId: l.productId,
    slug: getLocalizedString(l.productSlug, ctx.locale),
    name,
    ...(image?.url ? { imageUrl: image.url } : {}),
    imageAlt: image?.label ?? name,
    variantSummary: product && variant ? variantSummary(product.shape, variant.attrs, variant.labels, ctx.t) : '',
    quantity: l.quantity,
    unitPrice: unit,
    ...(l.price.discounted ? { oldUnitPrice: list } : {}),
    total: mapMoney(l.totalPrice),
    fulfilment,
    brand,
    groupKey: groupKeyOf({ fulfilment, store }),
    ...(store ? { store } : {}),
    ...(policyId && schedule ? { recurrence: { policyId, schedule } } : {}),
    ...(collectAtSessionStore !== undefined ? { collectAtSessionStore } : {}),
    notices,
    maxQuantity,
    ...(product ? { shape: product.shape } : {}),
    ...(product?.systemKey ? { systemKey: product.systemKey } : {}),
  };
}

/** Stock notices that a part can raise; they are copied onto its bundle row (D8). Price notices stay on the parts. */
const STOCK_NOTICES = new Set(['out-of-stock', 'quantity-exceeds-stock', 'collect-unavailable']);

/** A row of the bag: a normal line, or a bundle with its parts folded into one `bundle` block (workstream V, D8). */
function mapVisibleLine(l: LineItem, all: LineItem[], e: CartEnrichment, ctx: MapContext): CartLine {
  const line = mapLine(l, e, ctx);
  if (!isBundleParent(l)) return line;
  const parts = childrenOf(all, l);
  const partLines = parts.map((c) => mapLine(c, e, ctx));
  const machineSku = String(l.custom?.fields?.bundleMachineSku ?? '');
  const ordered = [...partLines].sort((a, b) => Number(b.sku === machineSku) - Number(a.sku === machineSku));
  const machine = ordered.find((p) => p.sku === machineSku);
  const preset = e.bundles?.[l.productId]?.[bundlePresetOf(l) ?? -1];
  const discount = typeof l.custom?.fields?.bundleDiscount === 'number' ? l.custom.fields.bundleDiscount : undefined;
  const wasCents = l.custom?.fields?.bundleWasCents;
  const wasUnitPrice: Money | undefined = typeof wasCents === 'number' && wasCents > 0
    ? { centAmount: wasCents, currencyCode: line.unitPrice.currencyCode } : undefined;
  // The bundle SKU has no stock of its own (it is never sold alone): its stock and limits come from the parts only.
  const stock = [
    ...line.notices.filter((n) => !STOCK_NOTICES.has(n.kind)),
    ...partLines.flatMap((p) => p.notices.filter((n) => STOCK_NOTICES.has(n.kind))),
  ];
  // The collect chip of the row shows the worst state of its parts at the session store (the bundle has no stock of its own).
  const chips = partLines.map((p) => p.collectAtSessionStore);
  const rank = { out: 0, low: 1, in: 2 } as const;
  const worst = chips.every((c): c is NonNullable<typeof c> => !!c)
    ? chips.reduce((a, b) => (rank[b.state] < rank[a.state] ? b : a))
    : undefined;
  const collect = line.collectAtSessionStore !== undefined && worst !== undefined
    ? { collectAtSessionStore: worst }
    : {};
  return {
    ...line,
    ...(machine?.imageUrl ? { imageUrl: machine.imageUrl, imageAlt: machine.imageAlt } : {}),
    ...(wasUnitPrice && wasUnitPrice.centAmount > line.unitPrice.centAmount ? { oldUnitPrice: wasUnitPrice } : {}),
    ...collect,
    maxQuantity: Math.min(CART_MAX_LINE_QUANTITY, ...partLines.map((p) => p.maxQuantity)),
    notices: stock,
    bundle: {
      presetName: preset?.name ?? 'Bundle',
      discountPercent: preset?.discountPercent ?? (discount !== undefined ? Math.round(discount * 100) : 0),
      ...(wasUnitPrice ? { wasUnitPrice } : {}),
      items: ordered.map((p) => ({
        sku: p.sku, name: p.name, ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
        role: p.sku === machineSku ? 'machine' : 'item',
      })),
    },
  };
}

function mapCodes(ct: CtCart, locale: string): AppliedCode[] {
  return (ct.discountCodes ?? []).map((d) => {
    const state = toCodeState(d.state);
    const obj = d.discountCode.obj;
    const name = obj?.name ? getLocalizedString(obj.name, locale) : '';
    const reasonKey = stateReasonKey(state);
    return {
      id: d.discountCode.id, code: obj?.code ?? '', ...(name ? { name } : {}), state, ...(reasonKey ? { reasonKey } : {}),
    };
  });
}

function shippingOf(ct: CtCart): Cart['shipping'] {
  const prices: Money[] =
    ct.shippingMode === 'Multiple'
      ? (ct.shipping ?? []).map((s) => s.shippingInfo.price).map(mapMoney)
      : ct.shippingInfo
        ? [mapMoney(ct.shippingInfo.price)]
        : [];
  if (prices.length === 0) return null;
  const amount = { centAmount: prices.reduce((n, p) => n + p.centAmount, 0), currencyCode: prices[0].currencyCode };
  return { amount, isFree: amount.centAmount === 0 };
}

/**
 * The commercetools cart plus its enrichment to the view the UI and checkout read (workstream I, 3.2 and 3.4). Pure.
 * Totals are read from the engine: `total` is `taxedPrice.totalGross` when present else `totalPrice`, `tax` is
 * `taxedPrice.totalTax`, `shipping` is `shippingInfo.price` (the sum of `shipping[]` prices in Multiple mode). Only
 * `subtotal` and `discount` are display sums of engine line fields; nothing decides on them except the minimum order.
 */
export function mapCart(ct: CtCart, enrichment: CartEnrichment, ctx: MapContext): Cart {
  const currency = ct.totalPrice.currencyCode;
  // The bag's rows: a bundle's parts are hidden, the parent carries them in its `bundle` block (workstream V, D8).
  const lines = ct.lineItems.filter((l) => !isBundleChild(l)).map((l) => mapVisibleLine(l, ct.lineItems, enrichment, ctx));
  const sum = (f: (l: LineItem) => number) => ct.lineItems.reduce((n, l) => n + f(l), 0);
  const subtotal: Money = { centAmount: sum((l) => l.totalPrice.centAmount), currencyCode: currency };
  const saved = sum((l) => Math.max(0, effectivePrice(l).centAmount * l.quantity - l.totalPrice.centAmount));
  const taxed = ct.taxedPrice;
  const total = mapMoney(taxed?.totalGross ?? ct.totalPrice);
  const shipping = shippingOf(ct);
  const includedInPrice = ct.lineItems.some((l) => l.taxRate?.includedInPrice === true);
  const tax: Cart['tax'] = taxed?.totalTax ? { amount: mapMoney(taxed.totalTax), included: includedInPrice } : null;

  const min = minimumOrder(subtotal, ctx.minOrder);
  const stops = blockers(lines, min.shortfall !== null);
  if (process.env.NODE_ENV === 'development' && taxed?.totalTax && !includedInPrice) {
    const drift = Math.abs(subtotal.centAmount + (shipping?.amount.centAmount ?? 0) + taxed.totalTax.centAmount - total.centAmount);
    if (drift > 2 * (lines.length + 1)) console.warn(`cart total drift of ${drift} minor units (display sums differ from the engine total)`);
  }

  return {
    id: ct.id, version: ct.version, currency, country: ct.country ?? '',
    shippingMode: ct.shippingMode === 'Multiple' ? 'Multiple' : 'Single',
    count: unitsOf(ct.lineItems),
    lines, groups: groupLines(lines),
    subtotal,
    discount: saved > 0 ? { centAmount: saved, currencyCode: currency } : null,
    shipping, tax, total,
    codes: mapCodes(ct, ctx.locale),
    freeShipping: freeShipping(enrichment.threshold, lines),
    minimumOrder: min,
    canCheckout: stops.length === 0,
    blockers: stops,
    nudge: enrichment.nudge,
  };
}
