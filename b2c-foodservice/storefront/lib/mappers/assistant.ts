/**
 * Pure mappers from storefront read models to the assistant's domain (workstream T2, U-02). No commercetools import, no `server-only`:
 * the backend (`lib/ct/assistant-backend.ts`) calls these after it has read the data.
 *
 * Money: the storefront holds integer minor units; the agent holds major-unit floats. The conversion goes through `lib/agent/shopping/money`
 * only. A figure the platform does not supply is ABSENT (the key is left out), never zero.
 *
 * Ids: a family (a product with more than one variant) is `fam:<defaultSku>`; every other record is its SKU (decision 2 of T2).
 */
import { encodeFamilyId } from '@/lib/agent/shopping/ids';
import { minorToMajor, unitPriceMajor } from '@/lib/agent/shopping/money';
import type { Cart, CartTotals, Order, OrderStatus, Product, ProductDetails } from '@/lib/agent/shopping/types';
import type { OrderStatusKind, ProductPageData, ProductSummary, VariantView, Cart as CartView, OrderView } from '@/lib/types';

/** The closed table from the storefront's order status to the agent's. A kind with no honest mapping is `undefined`: the order then has no status. */
const ORDER_STATUS: Record<OrderStatusKind, OrderStatus | undefined> = {
  ordered: 'processing',
  preparing: 'processing',
  // Ready for collection in a store: the assistant has no status for a pickup state, so it says nothing rather than guess.
  ready: undefined,
  shipped: 'shipped',
  completed: 'delivered',
  cancelled: 'cancelled',
};

/** Same-origin path only (the account page of this storefront). */
function samePath(url: string): string | undefined {
  return url.startsWith('/') && !url.startsWith('//') ? url : undefined;
}

/** A carrier or product link: https only. */
function httpsLink(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A search result. A product that needs a choice (`requiredChoice` set: several colours or grinds) is a family with `fam:<defaultSku>`
 * and its options as far as the summary knows them. Null when the product has no price in this market: a record without a price cannot be
 * offered (the type has no absent price, and zero would be a lie).
 *
 * `inStock` comes from the summary's store availability when there is one. Without a store the summary has no stock, so this mapper
 * reports true only to fill the field; the backend replaces it with the inventory read for every result.
 */
export function productFromSummary(summary: ProductSummary, currency: string): Product | null {
  if (!summary.price) return null;
  const choice = summary.requiredChoice;
  const isFamily = choice !== null;
  const product: Product = {
    productId: isFamily ? encodeFamilyId(summary.sku) : summary.sku,
    title: summary.name,
    price: minorToMajor(summary.price.from.centAmount, currency),
    currency,
    labels: summary.badge ? [summary.badge] : [],
    attributes: summary.label ? { [summary.label.kind]: summary.label.value } : {},
    inStock: summary.availability ? summary.availability.state !== 'out' : true,
    options: isFamily && choice ? { [choice]: (summary.swatches ?? []).map((s) => s.name) } : {},
    optionValues: {},
  };
  if (summary.rating) {
    product.rating = summary.rating.average;
    product.reviewCount = summary.rating.count;
  }
  if (summary.imageUrl) product.imageUrl = summary.imageUrl;
  if (summary.categoryName) product.category = summary.categoryName;
  return product;
}

/** The price a shopper pays for one variant: the discounted amount when there is one. Null when the platform has no price for it. */
function payableMinor(variant: VariantView): number | null {
  if (!variant.price) return null;
  return (variant.price.discounted ?? variant.price.value).centAmount;
}

/** One purchasable variant as its own record: its SKU, its own price and stock, and the option values it has. */
function variantRecord(variant: VariantView, page: ProductPageData, stock: Record<string, number>, familyId?: string): Product | null {
  const minor = payableMinor(variant);
  if (minor === null || minor <= 0) return null;
  const optionValues: Record<string, string> = {};
  for (const selector of page.product.selectors) {
    const raw = variant.attrs[selector.attr];
    if (raw === undefined) continue;
    optionValues[selector.attr] = selector.options.find((o) => o.value === String(raw))?.label ?? String(raw);
  }
  const record: Product = {
    productId: variant.sku,
    title: page.product.name,
    price: minorToMajor(minor, page.currency),
    currency: page.currency,
    labels: [],
    attributes: {},
    inStock: (stock[variant.sku] ?? 0) > 0,
    options: {},
    optionValues,
    ...(familyId ? { variantOf: familyId } : {}),
  };
  const image = variant.images[0]?.url;
  if (image) record.imageUrl = image;
  return record;
}

/**
 * The full record for one product page. A product with more than one variant is a family (`fam:<defaultSku>`): its `options` come from the
 * selectors and `variants` are the purchasable records. A single-variant product is one plain record with `id = sku`.
 * `stock` is the online quantity per SKU from one inventory read; a SKU with no entry is out of stock.
 * Null when nothing on the page can be bought (no priced variant).
 */
export function detailsFromPage(page: ProductPageData, stock: Record<string, number>): ProductDetails | null {
  const product = page.product;
  const isFamily = product.variants.length > 1;
  const familyId = encodeFamilyId(product.defaultSku);
  const variants = product.variants
    .map((v) => variantRecord(v, page, stock, isFamily ? familyId : undefined))
    .filter((v): v is Product => v !== null);

  const lowestOf = (records: Product[]) => records.reduce((best, r) => (r.price < best.price ? r : best));
  const inStock = variants.filter((v) => v.inStock);
  let base: Product | undefined;
  if (isFamily) {
    if (variants.length === 0) return null;
    // The price a family shows is its lowest in-stock variant's, or its lowest variant's when nothing is in stock.
    const priceFrom = lowestOf(inStock.length > 0 ? inStock : variants);
    base = {
      productId: familyId,
      title: product.name,
      price: priceFrom.price,
      currency: page.currency,
      labels: product.badge ? [product.badge] : [],
      attributes: {},
      inStock: inStock.length > 0,
      options: Object.fromEntries(product.selectors.map((s) => [s.attr, s.options.map((o) => o.label)])),
      optionValues: {},
    };
  } else {
    const only = variantRecord(product.variants[0] as VariantView, page, stock);
    if (!only) return null;
    base = { ...only, labels: product.badge ? [product.badge] : [] };
  }

  const attributes: Record<string, string> = {};
  if (product.facts.intensity !== undefined) attributes.intensity = String(product.facts.intensity);
  if (product.facts.roast) attributes.roast = product.facts.roast;
  if (product.facts.origin) attributes.origin = product.facts.origin;

  const details: ProductDetails = {
    ...base,
    attributes,
    category: product.categoryName,
    shortDescription: product.tagline,
    specs: Object.fromEntries(product.facts.specs.map((s) => [s.key, s.value])),
    reviewHighlights: [],
    variants: isFamily ? variants : [],
  };
  if (product.rating) {
    details.rating = product.rating.average;
    details.reviewCount = product.rating.count;
  }
  if (product.description) details.longDescription = product.description;
  const image = product.variants.find((v) => v.sku === product.defaultSku)?.images[0]?.url;
  if (image) details.imageUrl = image;
  return details;
}

/** The bag as the agent sees it: one item per line, `productId` the SKU, the price the effective unit price (line total over quantity). */
export function cartFromView(view: CartView): Cart {
  return {
    currency: view.currency,
    items: view.lines.map((line) => ({
      productId: line.sku,
      title: line.name,
      price: unitPriceMajor(line.total.centAmount, line.quantity, view.currency),
      quantity: line.quantity,
      ...(line.imageUrl ? { imageUrl: line.imageUrl } : {}),
      optionValues: {},
    })),
  };
}

/** Cent-exact totals for the checkout card, in minor units. Null for an empty bag. No shipping or tax figure is ever made up. */
export function totalsFromView(view: CartView): CartTotals | null {
  if (view.lines.length === 0) return null;
  return {
    currency: view.currency,
    totalMinor: view.total.centAmount,
    ...(view.discount ? { subtotalMinor: view.subtotal.centAmount } : {}),
    ...(view.discount && view.discount.centAmount !== 0 ? { discountMinor: view.discount.centAmount } : {}),
  };
}

/**
 * An order for the assistant's order card. `orderId` is the order number. The "View order" link is `<baseHref>/account/orders/<number>`
 * and is kept only when `baseHref` is a same-origin path. The tracking link is kept only when it is https.
 */
export function orderFromView(view: OrderView, baseHref: string): Order {
  const status = ORDER_STATUS[view.status];
  const trackingUrl = view.deliveries.map((d) => httpsLink(d.trackingUrl)).find((u): u is string => u !== undefined);
  const viewUrl = samePath(`${baseHref}/account/orders/${view.orderNumber}`);
  return {
    orderId: view.orderNumber,
    ...(status ? { status } : {}),
    placedAt: view.createdAt,
    items: view.lines.map((line) => ({
      productId: line.sku,
      title: line.name,
      quantity: line.quantity,
      price: minorToMajor(line.unitCents, view.currency),
      optionValues: {},
    })),
    total: minorToMajor(view.totals.totalCents, view.currency),
    currency: view.currency,
    ...(trackingUrl ? { trackingUrl } : {}),
    ...(viewUrl ? { viewUrl } : {}),
  };
}
