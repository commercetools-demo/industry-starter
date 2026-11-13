import { type AgentEvent } from '../common/streaming';
import type { StorefrontBackend } from '../shopping/backend';
import { cardProduct } from '../shopping/card-serialization';
import type { ShoppingAgentConfig } from '../shopping/config';
import { gatedAddToCart } from '../shopping/gates';
import { newSessionState, type ShoppingSessionContext, type ShoppingSessionState } from '../shopping/types';

/**
 * Card interactions (T-27). A card click is a shopper action, not a model action, so it takes the SAME caps and options hold as the
 * agent's own add (one code path: `gatedAddToCart`, serialised on the same per-session mutex) but NOT the provenance gate: the shopper
 * chose the product from a card they were shown. It never touches the model, and never places an order.
 */

export type CardAddResult = { ok: true; cart: Record<string, unknown> } | { ok: false; reason: string };

const ID_PATTERN = /^[A-Za-z0-9:_.-]{1,80}$/;
export function isProductId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export async function cardAdd(args: {
  backend: StorefrontBackend;
  config: ShoppingAgentConfig;
  session: ShoppingSessionContext;
  productId: string;
  quantity: number;
  state?: ShoppingSessionState;
}): Promise<CardAddResult> {
  const quantity = Number.isInteger(args.quantity) && args.quantity >= 1 ? Math.min(args.quantity, args.config.maxQuantityPerItem) : 1;
  const outcome = await gatedAddToCart({
    backend: args.backend,
    config: args.config,
    session: args.session,
    state: args.state ?? newSessionState(),
    productId: args.productId,
    quantity,
    enforceProvenance: false,
  });
  const update = outcome.events.find((e: AgentEvent) => e.type === 'cart_update');
  if (outcome.isError || outcome.blocked || !update) return { ok: false, reason: outcome.resultText };
  return {
    ok: true,
    cart: (update.data.cart ?? {}) as Record<string, unknown>,
  };
}

/** The product's card payload (the SAME serializer the streamed cards use) plus its purchasable variants, or null when unknown. */
export async function cardProductDetail(
  backend: StorefrontBackend,
  session: ShoppingSessionContext,
  productId: string,
): Promise<Record<string, unknown> | null> {
  const details = await backend.getProductDetails(session, productId);
  if (!details) return null;
  return {
    product: cardProduct(details),
    variants: details.variants.map(cardProduct),
  };
}
