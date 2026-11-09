// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/gates.py; changes: TypeScript port; promise-chain mutex instead of asyncio.Lock; model-supplied ids are sanitized before they are echoed; order items carry their order's currency; provenance enforcement can be switched off for a human's card click.

import { KeyedMutex } from '../common/mutex';
import { AgentEvents, type ToolOutcome, ToolOutcomes } from '../common/streaming';
import type { StorefrontBackend } from './backend';
import type { ShoppingAgentConfig } from './config';
import { STOREFRONT_FENCE } from './fencing';
import { cartPayload, cartSummary } from './serialization';
import { type Cart, type Order, type Product, type ShoppingSessionContext, type ShoppingSessionState, hasOptions, rememberProducts } from './types';

/**
 * The cart gates. A cart write accepts only product ids that catalogue or order tools returned this session (or lines already in the
 * cart), holds an add of a product that still has options to choose and points at its variants, caps the resulting line quantity at the
 * config's limit, and reports any cap it applied; writes for one session are serialised because a turn's tool calls run concurrently.
 *
 * Provenance authorises the MODEL's writes, because a model can name an id it never read. A human clicking a card this server itself
 * composed is not that threat: the card route passes `enforceProvenance: false` (the quantity cap and the options hold still apply).
 */

export const PROVENANCE_GATE = 'provenance';
export const OPTIONS_GATE = 'options';

const idText = (productId: string): string => STOREFRONT_FENCE.sanitizeText(productId, 80);

/** `get_product_details` comes first in the hint: text search does not match ids, and an empty search reads to the model as proof the product does not exist. */
export function provenanceError(productId: string): string {
  return (
    `product_id ${idText(productId)} was not returned by catalog or order tools in this session. Resolve it first: call get_product_details with this exact id ` +
    '(text search does not match product ids), or find it via search or order history, then add it using a product_id from those results.'
  );
}

/** The held outcome when `productId` has no session provenance, else null. */
export function checkProvenance(state: ShoppingSessionState, productId: string): ToolOutcome | null {
  return state.seenProducts.has(productId) ? null : ToolOutcomes.held(PROVENANCE_GATE, provenanceError(productId));
}

export function optionsError(product: Product): string {
  // Option names are catalogue text arriving outside the fence: sanitized and kept short. The values themselves are in the fenced record the model already holds.
  const names = STOREFRONT_FENCE.sanitizeText(Object.keys(product.options).join(', '), 60);
  return (
    `product_id ${idText(product.productId)} has options still to choose (${names}), so the cart takes one of its variants. Settle each option from what the customer said ` +
    "or the customer's profile, ask once with the values as chips when one is still open, then add the matching variant's product_id from the variants get_product_details returns for this id."
  );
}

/** The held outcome when the record for `productId` is a family with options still to choose; its variants are what the cart takes. THE REFUSAL is the control: a card's Add button branching on "has options" is only an affordance. */
export function checkOptions(state: ShoppingSessionState, productId: string): ToolOutcome | null {
  const product = state.seenProducts.get(productId);
  return product && hasOptions(product) ? ToolOutcomes.held(OPTIONS_GATE, optionsError(product)) : null;
}

/** Items on the customer's own orders count as provenance, so a reorder needs no search. */
export function rememberOrderItems(state: ShoppingSessionState, orders: readonly Order[], cap: number): void {
  rememberProducts(
    state,
    orders.flatMap((order) =>
      order.items.map((item) => ({
        productId: item.productId,
        title: item.title,
        price: item.price,
        currency: order.currency,
        labels: [],
        attributes: {},
        inStock: true,
        options: {},
        optionValues: item.optionValues,
        ...(item.variantOf ? { variantOf: item.variantOf } : {}),
      })),
    ),
    cap,
  );
}

/** The gates read the cart, compute, then write; a second mutation for the same session in the same round must not interleave with that. In one process only: the backend also verifies its writes (the platform's own concurrency handling). */
export const cartLocks = new KeyedMutex();

function written(text: string, cart: Cart): ToolOutcome {
  return ToolOutcomes.ok(text, [AgentEvents.cartUpdate(cartPayload(cart))]);
}

interface GateArgs {
  backend: StorefrontBackend;
  config: ShoppingAgentConfig;
  session: ShoppingSessionContext;
  state: ShoppingSessionState;
  productId: string;
}

export async function gatedAddToCart(args: GateArgs & { quantity: number; enforceProvenance?: boolean }): Promise<ToolOutcome> {
  const { backend, config, session, state, productId } = args;
  if (args.enforceProvenance !== false) {
    const held = checkProvenance(state, productId);
    if (held) return held;
  }
  const options = checkOptions(state, productId);
  if (options) return options;
  const requested = Math.max(1, args.quantity);
  const max = config.maxQuantityPerItem;
  return cartLocks.run(session.sessionId, async () => {
    const current = await backend.getCart(session);
    const existing = current.items.find((i) => i.productId === productId);
    if (!existing && current.items.length >= config.maxCartLines) return ToolOutcomes.error('The cart is full.');
    const allowed = Math.min(requested, Math.max(0, max - (existing?.quantity ?? 0)));
    if (allowed <= 0) return ToolOutcomes.error(`This item is already at the per-item limit of ${max}.`);
    const cart = await backend.addToCart(session, productId, allowed);
    // The confirmation names the id only: titles are catalogue text and stay inside fences.
    const capped = allowed < requested ? ` (capped at the per-item limit of ${max})` : '';
    return written(`Added ${idText(productId)} x${allowed}${capped}. Cart now has ${cartSummary(cart)}.`, cart);
  });
}

export async function gatedUpdateCartItem(args: GateArgs & { quantity: number }): Promise<ToolOutcome> {
  const { backend, config, session, state, productId } = args;
  const requested = Math.max(1, args.quantity);
  const applied = Math.min(requested, config.maxQuantityPerItem);
  return cartLocks.run(session.sessionId, async () => {
    const held = await checkProvenanceOrCart(backend, session, state, productId);
    if (held) return held;
    const cart = await backend.updateCartItem(session, productId, applied);
    const capped = applied < requested ? ` (capped at the per-item limit of ${config.maxQuantityPerItem})` : '';
    return written(`Updated quantity${capped}. Cart now has ${cartSummary(cart)}.`, cart);
  });
}

export async function gatedRemoveFromCart(args: GateArgs): Promise<ToolOutcome> {
  const { backend, session, state, productId } = args;
  return cartLocks.run(session.sessionId, async () => {
    const held = await checkProvenanceOrCart(backend, session, state, productId);
    if (held) return held;
    const cart = await backend.removeFromCart(session, productId);
    return written(`Removed. Cart now has ${cartSummary(cart)}.`, cart);
  });
}

/** Update and remove also accept a line already in the cart, which may predate the session; the cart is fetched only when provenance alone does not pass. */
async function checkProvenanceOrCart(backend: StorefrontBackend, session: ShoppingSessionContext, state: ShoppingSessionState, productId: string): Promise<ToolOutcome | null> {
  if (checkProvenance(state, productId) === null) return null;
  const current = await backend.getCart(session);
  if (current.items.some((i) => i.productId === productId)) return null;
  return ToolOutcomes.held(PROVENANCE_GATE, provenanceError(productId));
}
