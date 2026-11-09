// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/executor.py; changes: TypeScript port; memory runtime not ported (the memory tools answer a fixed text); search notes appended to the result; sign-in-required mapped; model-supplied ids sanitized before they are echoed; switched-off systems also refuse the disclosure tool.

import { z } from 'zod';
import { BaseToolExecutor, type Handler, InvalidArguments, clampLimit } from '../common/execution';
import { ToolOutcomes, type ToolOutcome } from '../common/streaming';
import type { SkillRegistry } from '../common/skills';
import { NotOffered, SignInRequired, type StorefrontBackend, Unavailable } from './backend';
import { type ShoppingAgentConfig, absentTools } from './config';
import { PRESENTATION_COMPONENTS } from './enrichment';
import { STOREFRONT_FENCE } from './fencing';
import { gatedAddToCart, gatedRemoveFromCart, gatedUpdateCartItem, rememberOrderItems } from './gates';
import { cartPayload, orderPayload, ordersPayload, productDetailsPayload, searchResultText } from './serialization';
import { describeIssues } from './tools/presentation';
import { type SearchFilters, type ShoppingSessionContext, type ShoppingSessionState, rememberProducts } from './types';

/** The shopping agent's tools, one handler each, over the shared executor frame. Every path executes through this class, so a tool result is the same bytes everywhere. */

const MAX_ORDERS = 20;

const FiltersSchema = z.object({
  category: z.string().nullish().transform((v) => v ?? undefined),
  min_price: z.number().nullish().transform((v) => v ?? undefined),
  max_price: z.number().nullish().transform((v) => v ?? undefined),
  min_rating: z.number().nullish().transform((v) => v ?? undefined),
  attributes: z.record(z.string(), z.string()).nullish().transform((v) => v ?? {}),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating']).nullish().transform((v) => v ?? 'relevance'),
});

/** Validate one model-supplied argument. Only a failure raised here is reported as bad arguments. */
function parseFilters(value: unknown): SearchFilters {
  const result = FiltersSchema.safeParse(value);
  if (!result.success) throw new InvalidArguments(describeIssues(result.error));
  const f = result.data;
  return { ...(f.category !== undefined ? { category: f.category } : {}), ...(f.min_price !== undefined ? { minPrice: f.min_price } : {}), ...(f.max_price !== undefined ? { maxPrice: f.max_price } : {}), ...(f.min_rating !== undefined ? { minRating: f.min_rating } : {}), attributes: f.attributes, sort: f.sort };
}

const toInt = (raw: unknown, fallback = 1): number => {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n !== 0 ? n : fallback;
};

export class ShoppingToolExecutor extends BaseToolExecutor<StorefrontBackend, ShoppingAgentConfig, ShoppingSessionContext, ShoppingSessionState> {
  readonly fence = STOREFRONT_FENCE;
  readonly components = PRESENTATION_COMPONENTS;
  readonly displayedText = 'Displayed to the customer.';
  readonly unavailableText = '{name} is temporarily unavailable. Work with what you already have or let the customer know.';
  private readonly notOfferedText = '{detail} is not something this store offers; say so plainly.';
  private readonly soldOutText = 'Nothing was added: {detail}. Tell the customer, offer what the message names as available, and add that only once they choose it.';
  private readonly signInText = 'The customer is not signed in, so their orders cannot be shown. Ask them to sign in to see their orders; do not guess order details.';

  constructor(options: { backend: StorefrontBackend; config: ShoppingAgentConfig; skills: SkillRegistry; session: ShoppingSessionContext; state: ShoppingSessionState }) {
    // The disclosure tool is not in the tool list unless enabled; refuse it here too, so a model that guesses its name reaches nothing.
    const absent = new Set(absentTools(options.config));
    if (!options.config.enableDisclosures) absent.add('present_disclosure');
    super({ ...options, absent });
  }

  protected override domainError(error: unknown): ToolOutcome | null {
    // The message is backend text arriving outside the fence: sanitized and capped.
    const detail = this.sanitize((error as Error | undefined)?.message ?? '', 200);
    if (error instanceof Unavailable) return ToolOutcomes.error(this.soldOutText.replace('{detail}', detail || 'unavailable'));
    if (error instanceof NotOffered) return ToolOutcomes.error(this.notOfferedText.replace('{detail}', detail || 'This'));
    if (error instanceof SignInRequired) return ToolOutcomes.error(this.signInText);
    return null;
  }

  protected handlers(): Record<string, Handler> {
    return {
      search_products: (i) => this.searchProducts(i),
      get_product_details: (i) => this.getProductDetails(i),
      get_cart: () => this.getCart(),
      add_to_cart: (i) => this.addToCart(i),
      update_cart_item: (i) => this.updateCartItem(i),
      remove_from_cart: (i) => this.removeFromCart(i),
      get_preferences: () => this.getPreferences(),
      get_orders: (i) => this.getOrders(i),
      get_order_status: (i) => this.getOrderStatus(i),
    };
  }

  private cap(): number {
    return this.config.provenanceCap;
  }

  // -- catalogue
  private async searchProducts(input: Record<string, unknown>): Promise<ToolOutcome> {
    const query = this.sanitize(input.query ?? '', 300);
    const filters = input.filters ? parseFilters(input.filters) : undefined;
    const limit = this.searchLimit(input.limit);
    const products = await this.backend.searchProducts(this.session, query, filters, limit);
    rememberProducts(this.state, products, this.cap());
    let text = searchResultText(query, products, this.config.maxFencedChars);
    // Runtime-authored notes (a filter the backend could not apply) go AFTER the fence, in fixed wording.
    const notes = this.backend.drainNotes?.() ?? [];
    if (notes.length > 0) text += '\n' + notes.map((n) => `Note: ${n}`).join('\n');
    return ToolOutcomes.ok(text);
  }

  private async getProductDetails(input: Record<string, unknown>): Promise<ToolOutcome> {
    const productId = String(input.product_id ?? '');
    const details = await this.backend.getProductDetails(this.session, productId);
    if (!details) return ToolOutcomes.error(`No product with id ${this.sanitize(productId, 80)}.`);
    // The variants enter provenance with the record, so the cart takes their ids.
    rememberProducts(this.state, [details, ...details.variants], this.cap());
    return this.fenced(productDetailsPayload(details));
  }

  // -- cart
  private async getCart(): Promise<ToolOutcome> {
    return this.fenced(cartPayload(await this.backend.getCart(this.session)));
  }

  private addToCart(input: Record<string, unknown>): Promise<ToolOutcome> {
    return gatedAddToCart({ backend: this.backend, config: this.config, session: this.session, state: this.state, productId: String(input.product_id ?? ''), quantity: toInt(input.quantity) });
  }

  private updateCartItem(input: Record<string, unknown>): Promise<ToolOutcome> {
    return gatedUpdateCartItem({ backend: this.backend, config: this.config, session: this.session, state: this.state, productId: String(input.product_id ?? ''), quantity: toInt(input.quantity) });
  }

  private removeFromCart(input: Record<string, unknown>): Promise<ToolOutcome> {
    return gatedRemoveFromCart({ backend: this.backend, config: this.config, session: this.session, state: this.state, productId: String(input.product_id ?? '') });
  }

  // -- customer context and orders
  private async getPreferences(): Promise<ToolOutcome> {
    const p = await this.backend.getPreferences(this.session);
    return this.fenced(Object.fromEntries(Object.entries({ user_id: p.userId, display_name: p.displayName, loyalty_tier: p.loyaltyTier, default_location: p.defaultLocation, preferences: p.preferences }).filter(([, v]) => v !== undefined)));
  }

  private async getOrders(input: Record<string, unknown>): Promise<ToolOutcome> {
    const limit = clampLimit(input.limit, 5, MAX_ORDERS);
    const orders = await this.backend.getOrders(this.session, limit);
    rememberOrderItems(this.state, orders, this.cap());
    return this.fenced(ordersPayload(orders));
  }

  private async getOrderStatus(input: Record<string, unknown>): Promise<ToolOutcome> {
    const orderId = String(input.order_id ?? '');
    const order = await this.backend.getOrder(this.session, orderId);
    // Not found and not yours read the same: the backend returns null for both.
    if (!order) return ToolOutcomes.error(`No order with id ${this.sanitize(orderId, 64)}.`);
    rememberOrderItems(this.state, [order], this.cap());
    return this.fenced(orderPayload(order));
  }
}
