// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/enrichment.py (_record and the order and cart dumps); changes: TypeScript port; wire keys snake_case with the record's field order; cent-exact totals added; view_url added.

import type { Cart, CartTotals, Order, Product } from './types';

/**
 * The CARD-facing serializer: the whole record the UI renders. TWO SERIALIZERS, TWO AUDIENCES: the model-facing one (`serialization.ts`)
 * drops image URLs, slugs and category to save prompt bytes on every search result. Building a card payload from that compact one ships
 * every product tile with no image, and no test notices because nothing asserts on a field the model never sees.
 *
 * Money in these records is the agent's MAJOR-unit float; the UI formats it through the major-units hook. The one exception is
 * `cardTotals`, which is MINOR units as the platform sent them and goes through the minor-units hook (routing a cent-exact field through
 * the major-units hook multiplies it a second time).
 */

type Row = Record<string, unknown>;
const prune = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined && v !== null));

/** A product record with its fields in declaration order; empty option and label containers are kept (the card reads `options` to decide "has options"). */
export function cardProduct(p: Product): Row {
  return prune({
    product_id: p.productId,
    title: p.title,
    brand: p.brand,
    price: p.price,
    currency: p.currency,
    rating: p.rating,
    review_count: p.reviewCount,
    image_url: p.imageUrl,
    category: p.category,
    labels: p.labels,
    attributes: p.attributes,
    in_stock: p.inStock,
    short_description: p.shortDescription,
    options: p.options,
    option_values: p.optionValues,
    variant_of: p.variantOf,
  });
}

export function cardOrder(order: Order): Row {
  return prune({
    order_id: order.orderId,
    status: order.status,
    placed_at: order.placedAt,
    items: order.items.map((i) => prune({ product_id: i.productId, title: i.title, quantity: i.quantity, price: i.price, option_values: i.optionValues, variant_of: i.variantOf })),
    total: order.total,
    currency: order.currency,
    estimated_delivery: order.estimatedDelivery,
    tracking_url: order.trackingUrl,
    view_url: order.viewUrl,
  });
}

/** Cent-exact totals in MINOR units. `subtotal_minor` and `discount_minor` are present only when the platform supplied them: no shipping, tax or "estimated" figure exists here. */
export function cardTotals(t: CartTotals): Row {
  return prune({ currency: t.currency, subtotal_minor: t.subtotalMinor, discount_minor: t.discountMinor, total_minor: t.totalMinor });
}

export function cardCart(cart: Cart): Row {
  return {
    currency: cart.currency,
    items: cart.items.map((i) => prune({ product_id: i.productId, title: i.title, price: i.price, quantity: i.quantity, image_url: i.imageUrl, option_values: i.optionValues, variant_of: i.variantOf })),
  };
}
