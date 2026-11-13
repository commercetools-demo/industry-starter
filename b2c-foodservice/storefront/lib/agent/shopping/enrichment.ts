// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/enrichment.py; changes: TypeScript port; order-status refusal when the order carries no mappable status; checkout carries cent-exact totals (minor units); disclosure kept for completeness (its tool is switched off here).

import { CHIPS_COMPONENT, CHIPS_TOOL, type EnrichmentContext, type PresentationComponent, PresentationRefused, parseSuggestions } from '../common/presentation';
import type { StorefrontBackend } from './backend';
import type { ShoppingAgentConfig } from './config';
import { cardCart, cardOrder, cardProduct, cardTotals } from './card-serialization';
import { PROVENANCE_GATE } from './gates';
import { cartPayload } from './serialization';
import {
  type CheckoutPayload,
  CheckoutSchema,
  type PresentComparisonPayload,
  PresentComparisonSchema,
  type PresentDisclosurePayload,
  PresentDisclosureSchema,
  type PresentGuidePayload,
  PresentGuideSchema,
  type PresentOrderStatusPayload,
  PresentOrderStatusSchema,
  type PresentPlanPayload,
  PresentPlanSchema,
  type PresentProductsPayload,
  PresentProductsSchema,
  parserFor,
} from './tools/presentation';
import type { ShoppingSessionContext, ShoppingSessionState } from './types';

/**
 * The built-in components: each payload joined to the session's catalogue records, the cart, or an order before it reaches the host. The
 * model supplies IDS AND PROSE ONLY; every displayed fact (title, price, image, rating, stock, order data) is joined here from records a
 * tool returned this session. Ids without session provenance are dropped and reported; a component left with nothing canonical to show is
 * refused with a route back to a read tool.
 */

export type ShoppingContext = EnrichmentContext<StorefrontBackend, ShoppingAgentConfig, ShoppingSessionContext, ShoppingSessionState>;
type Row = Record<string, unknown>;
const prune = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined && v !== null));

function resolve(state: ShoppingSessionState, productIds: readonly string[], dropped: string[]): Row[] {
  const records: Row[] = [];
  for (const id of productIds) {
    const product = state.seenProducts.get(id);
    if (product) records.push(cardProduct(product));
    else dropped.push(id);
  }
  return records;
}

function noteDropped(context: ShoppingContext, dropped: readonly string[]): void {
  // Ids are model text echoed to the model: sanitized, capped.
  if (dropped.length > 0) context.notes.push(`Skipped unknown product_ids not seen in this session: ${dropped.map((d) => d.slice(0, 80)).join(', ')}.`);
}

/** The spread between the cheapest and dearest enriched entries; null when fewer than two carry a price, the spread is zero, or the currencies differ. */
export function comparisonPriceDelta(entries: readonly Row[]): Row | null {
  const products = entries.map((e) => e.product as Row);
  if (new Set(products.map((p) => p.currency ?? 'USD')).size > 1) return null;
  const priced = entries
    .filter((e) => typeof (e.product as Row).price === 'number')
    .map((e) => [(e.product as Row).price as number, e.product_id as string] as const)
    .sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  if (priced.length < 2) return null;
  const [lowPrice, lowId] = priced[0];
  const [highPrice, highId] = priced[priced.length - 1];
  const amount = Math.round((highPrice - lowPrice) * 100) / 100;
  if (amount <= 0) return null;
  return { amount, low_product_id: lowId, low_price: lowPrice, high_product_id: highId, high_price: highPrice };
}

async function enrichProducts(payload: PresentProductsPayload, context: ShoppingContext): Promise<Row> {
  const dropped: string[] = [];
  const items: Row[] = [];
  for (const pick of payload.picks) {
    const product = context.state.seenProducts.get(pick.product_id);
    if (!product) {
      dropped.push(pick.product_id);
      continue;
    }
    items.push(prune({ product: cardProduct(product), reason: pick.reason }));
  }
  if (items.length === 0) throw new PresentationRefused("None of those product_ids came from this session's catalog results. Search first and pick from the results.", PROVENANCE_GATE);
  noteDropped(context, dropped);
  return prune({ title: payload.title, layout: payload.layout, items });
}

async function enrichComparison(payload: PresentComparisonPayload, context: ShoppingContext): Promise<Row> {
  const dropped: string[] = [];
  const entries: Row[] = [];
  for (const entry of payload.entries) {
    const product = context.state.seenProducts.get(entry.product_id);
    if (!product) {
      dropped.push(entry.product_id);
      continue;
    }
    entries.push(prune({ product_id: entry.product_id, pros: entry.pros, cons: entry.cons, best_for: entry.best_for, product: cardProduct(product) }));
  }
  if (entries.length < 2) throw new PresentationRefused("A comparison needs at least 2 products whose product_ids came from this session's catalog results.", PROVENANCE_GATE);
  noteDropped(context, dropped);
  const enriched = prune({ title: payload.title, entries, dimensions: payload.dimensions, recommended_product_id: payload.recommended_product_id });
  const delta = comparisonPriceDelta(entries);
  if (delta) enriched.price_delta = delta;
  return enriched;
}

async function enrichPlan(payload: PresentPlanPayload, context: ShoppingContext): Promise<Row> {
  const dropped: string[] = [];
  const steps = payload.steps.map((step) => prune({ label: step.label, detail: step.detail, products: resolve(context.state, step.product_ids, dropped) }));
  noteDropped(context, dropped);
  return prune({ title: payload.title, intro: payload.intro, steps });
}

async function enrichGuide(payload: PresentGuidePayload, context: ShoppingContext): Promise<Row> {
  const dropped: string[] = [];
  const related = resolve(context.state, payload.related_product_ids, dropped);
  noteDropped(context, dropped);
  return { title: payload.title, sections: payload.sections, sources: payload.sources, related_products: related };
}

async function enrichOrderStatus(payload: PresentOrderStatusPayload, context: ShoppingContext): Promise<Row> {
  // Re-read through the backend: the same ownership check as every order read, so a card can never show an order that is not the caller's.
  const order = await context.backend.getOrder(context.session, payload.order_id);
  if (!order) throw new PresentationRefused(`No order with id ${payload.order_id.slice(0, 64)} — look it up first.`);
  // A state the mapping does not know cannot be drawn on the delivery rail: the model describes it in words instead.
  if (!order.status) throw new PresentationRefused("This order's state is not one the status card can show. Describe where it stands in words, from the order details you have.");
  return prune({ order_id: payload.order_id, summary: payload.summary, next_step: payload.next_step, order: cardOrder(order) });
}

async function enrichCheckout(payload: CheckoutPayload, context: ShoppingContext): Promise<Row> {
  const cart = await context.backend.getCart(context.session);
  if (cart.items.length === 0) throw new PresentationRefused('The cart is empty — nothing to check out.');
  const enriched = prune({ note: payload.note, fulfillment_method: payload.fulfillment_method });
  enriched.cart = cartPayload(cart);
  // Cent-exact numbers from the platform cart, never the sum of line totals (which can exceed what is owed when whole-cart discounts are not spread across lines).
  const totals = await context.backend.getCartTotals?.(context.session);
  if (totals) enriched.totals = cardTotals(totals);
  enriched.lines = cardCart(cart).items;
  const handoffs = await context.backend.checkoutHandoff?.(context.session, cart);
  if (handoffs && handoffs.length > 0) enriched.handoffs = handoffs.map((h) => prune({ url: h.url, label: h.label, seller: h.seller }));
  return enriched;
}

async function enrichDisclosure(payload: PresentDisclosurePayload, context: ShoppingContext): Promise<Row> {
  if (!context.state.seenProducts.has(payload.product_id)) {
    throw new PresentationRefused("That product_id didn't come from this session's catalog results. Search or look it up first, then disclose it.", PROVENANCE_GATE);
  }
  const disclosure = await context.backend.getDisclosure?.(context.session, payload.product_id);
  if (!disclosure) throw new PresentationRefused('No disclosure exists for that product — answer from search_policies content instead.');
  return disclosure as unknown as Row;
}

// -- Partial payloads while a call is still streaming (synchronous, cheap, provenance-only) -------------------------------------------

const asRows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter((v): v is Row => v !== null && typeof v === 'object') : []);

function seen(state: ShoppingSessionState, productId: unknown): Row | null {
  const product = typeof productId === 'string' ? state.seenProducts.get(productId) : undefined;
  return product ? cardProduct(product) : null;
}

function seenAll(state: ShoppingSessionState, productIds: unknown): Row[] {
  return Array.isArray(productIds) ? productIds.map((id) => seen(state, id)).filter((r): r is Row => r !== null) : [];
}

function partialProducts(data: Row, state: ShoppingSessionState): Row {
  const items: Row[] = [];
  for (const pick of asRows(data.picks)) {
    const record = seen(state, pick.product_id);
    if (!record) continue;
    items.push(pick.reason ? { product: record, reason: pick.reason } : { product: record });
  }
  const payload: Row = { items };
  for (const key of ['title', 'layout']) if (data[key]) payload[key] = data[key];
  return payload;
}

function partialPlan(data: Row, state: ShoppingSessionState): Row {
  const steps = asRows(data.steps)
    .filter((s) => s.label)
    .map((s) => prune({ label: s.label, detail: s.detail, products: seenAll(state, s.product_ids) }));
  const payload: Row = { title: data.title || '', steps };
  if (data.intro) payload.intro = data.intro;
  return payload;
}

function partialComparison(data: Row, state: ShoppingSessionState): Row {
  const entries: Row[] = [];
  for (const entry of asRows(data.entries)) {
    const record = seen(state, entry.product_id);
    if (record) entries.push(prune({ product_id: entry.product_id, pros: entry.pros ?? [], cons: entry.cons ?? [], best_for: entry.best_for, product: record }));
  }
  const payload: Row = { entries, dimensions: data.dimensions ?? [] };
  for (const key of ['title', 'recommended_product_id']) if (data[key]) payload[key] = data[key];
  return payload;
}

function partialGuide(data: Row): Row | null {
  // A guide's sections are the model's; nothing joins from the session.
  const sections = asRows(data.sections).filter((s) => s.heading && s.body).map((s) => ({ heading: s.heading, body: s.body }));
  if (!data.title && sections.length === 0) return null;
  return { title: data.title || '', sections };
}

type Component = PresentationComponent<unknown, ShoppingContext, ShoppingSessionState>;

/** Erases the payload type so heterogeneous components share one table; each component's own `parse` still produces the exact type its `enrich` expects. */
function component<P>(spec: PresentationComponent<P, ShoppingContext, ShoppingSessionState>): Component {
  return spec as unknown as Component;
}

export const PRESENTATION_COMPONENTS: ReadonlyMap<string, Component> = new Map(
  [
    component({ name: 'present_products', component: 'products', parse: parserFor(PresentProductsSchema), enrich: enrichProducts, enrichPartial: partialProducts }),
    component({ name: 'present_comparison', component: 'comparison', parse: parserFor(PresentComparisonSchema), enrich: enrichComparison, enrichPartial: partialComparison }),
    component({ name: 'present_plan', component: 'plan', parse: parserFor(PresentPlanSchema), enrich: enrichPlan, enrichPartial: partialPlan }),
    component({ name: 'present_guide', component: 'guide', parse: parserFor(PresentGuideSchema), enrich: enrichGuide, enrichPartial: (data) => partialGuide(data) }),
    component({ name: 'present_order_status', component: 'order_status', parse: parserFor(PresentOrderStatusSchema), enrich: enrichOrderStatus }),
    component({ name: 'checkout', component: 'checkout', parse: parserFor(CheckoutSchema), enrich: enrichCheckout }),
    component({ name: CHIPS_TOOL, component: CHIPS_COMPONENT, parse: parseSuggestions }),
    component({ name: 'present_disclosure', component: 'disclosure', parse: parserFor(PresentDisclosureSchema), enrich: enrichDisclosure }),
  ].map((spec) => [spec.name, spec] as const),
);
