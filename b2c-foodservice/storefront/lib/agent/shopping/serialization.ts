// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/serialization.py; changes: TypeScript port; every dump is an ordered literal (key order is prompt bytes, and a generic object walk hoists integer-like keys); omission instead of None; order and cart payloads read the camelCase domain types; wire keys stay snake_case.

import { MAX_FENCED_CHARS } from '../common/fencing';
import { STOREFRONT_FENCE } from './fencing';
import { type Cart, type CartItem, type FulfillmentOption, type Order, type Policy, type Product, type ProductDetails, itemCount, lineTotal, subtotal } from './types';

/**
 * The payloads read tools hand the model, built once so every path returns the same bytes. TWO SERIALIZERS, TWO AUDIENCES: this module is
 * the MODEL-facing one and drops image URLs, slugs and category to save prompt bytes on every search result. The card-facing serializer
 * (`card-serialization.ts`) carries the whole record. Building a card payload from this one ships every tile with no image.
 *
 * The search header is the one runtime-authored line outside the fence: the result count and a fixed sentence on how to read the results
 * as text matches. Only the count varies.
 */

type Row = Record<string, unknown>;

const nonEmpty = <T extends object>(value: T): T | undefined => (Object.keys(value).length > 0 ? value : undefined);
const present = (value: unknown): boolean => value !== undefined && value !== null;
const prune = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([, v]) => present(v)));

export function compactProduct(product: Product): Row {
  return prune({
    product_id: product.productId,
    title: product.title,
    brand: product.brand,
    price: product.price,
    currency: product.currency,
    rating: product.rating,
    review_count: product.reviewCount,
    in_stock: product.inStock,
    labels: product.labels.length > 0 ? product.labels : undefined,
    attributes: nonEmpty(product.attributes),
    options: nonEmpty(product.options),
    option_values: nonEmpty(product.optionValues),
    variant_of: product.variantOf,
    short_description: product.shortDescription,
  });
}

const VARIANT_ALWAYS = new Set(['product_id', 'option_values', 'price', 'in_stock']);

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** A variant inside its family's record: its id, option values, price, stock, and only the fields and attributes where it differs from the family, so a long size run stays short. */
export function variantRow(variant: Product, family: Row): Row {
  const row = compactProduct(variant);
  delete row.variant_of;
  const familyAttributes = (family.attributes ?? {}) as Record<string, string>;
  const attributes = Object.fromEntries(Object.entries(variant.attributes).filter(([k, v]) => familyAttributes[k] !== v));
  const kept: Row = Object.fromEntries(Object.entries(row).filter(([k, v]) => VARIANT_ALWAYS.has(k) || (k !== 'attributes' && !sameValue(family[k], v))));
  // A row leads with its id and option values; that is what the model scans for.
  const { product_id: id, option_values: optionValues = {}, ...rest } = kept;
  return { product_id: id, option_values: optionValues, ...rest, ...(Object.keys(attributes).length > 0 ? { attributes } : {}) };
}

export function productDetailsPayload(details: ProductDetails): Row {
  const family = compactProduct(details);
  return prune({
    ...family,
    long_description: details.longDescription,
    specs: nonEmpty(details.specs),
    review_highlights: details.reviewHighlights.length > 0 ? details.reviewHighlights : undefined,
    variants: details.variants.length > 0 ? details.variants.map((v) => variantRow(v, family)) : undefined,
  });
}

export const SEARCH_EMPTY_HEADER =
  'Search returned 0 results: nothing in the catalog matched this query. Run the broader retry before telling the customer it is not carried, and do not present a different product as the requested one. Search matches product text, not ids; resolve a product id with get_product_details.';

export function searchResultHeader(count: number): string {
  if (count === 0) return SEARCH_EMPTY_HEADER;
  return (
    `Search returned ${count} result(s): the catalog's closest text matches, which can include related items rather than the exact thing searched for. ` +
    'Treat a result as the requested item only if its title and attributes match; if none do, the item was not found, and anything you offer instead is named as a stand-in.'
  );
}

/** The whole search_products result: the header line, then the fenced payload. */
export function searchResultText(query: string, products: readonly Product[], maxChars: number = MAX_FENCED_CHARS): string {
  const payload = { query, result_count: products.length, results: products.map(compactProduct) };
  return `${searchResultHeader(products.length)}\n${STOREFRONT_FENCE.fencePayload(payload, maxChars)}`;
}

/** Fixed-point money for a model-facing summary (two places). Display formatting of money for the shopper is never done here. */
export function cartSummary(cart: Cart): string {
  return `${itemCount(cart)} item(s), subtotal ${subtotal(cart).toFixed(2)} ${cart.currency}`;
}

export function cartLinePayload(item: CartItem): Row {
  return prune({
    product_id: item.productId,
    title: item.title,
    price: item.price,
    quantity: item.quantity,
    image_url: item.imageUrl,
    option_values: nonEmpty(item.optionValues),
    variant_of: item.variantOf,
    line_total: lineTotal(item),
  });
}

export function cartPayload(cart: Cart): Row {
  return { items: cart.items.map(cartLinePayload), item_count: itemCount(cart), subtotal: subtotal(cart), currency: cart.currency };
}

export function orderPayload(order: Order): Row {
  return prune({
    order_id: order.orderId,
    status: order.status,
    placed_at: order.placedAt,
    items: order.items.map((item) =>
      prune({
        product_id: item.productId,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        option_values: nonEmpty(item.optionValues),
        variant_of: item.variantOf,
      }),
    ),
    total: order.total,
    currency: order.currency,
    estimated_delivery: order.estimatedDelivery,
    tracking_url: order.trackingUrl,
  });
}

export function ordersPayload(orders: readonly Order[]): unknown {
  return orders.length > 0 ? orders.map(orderPayload) : { note: 'No orders found.' };
}

export function policiesPayload(policies: readonly Policy[]): unknown {
  return policies.length > 0 ? policies.map((p) => prune({ policy_id: p.policyId, title: p.title, category: p.category, content: p.content })) : { note: 'No matching policy content.' };
}

export function fulfillmentPayload(options: readonly FulfillmentOption[]): unknown {
  return options.length > 0 ? options.map((o) => prune({ method: o.method, eta: o.eta, fee: o.fee, location: o.location })) : { note: 'No fulfillment options available.' };
}
