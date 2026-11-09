// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/config.py; changes: closed TypeScript interface; camelCase; lexicons copied verbatim (extended in deployment.ts, not here); absentTools as a function.

import { BASE_DEFAULTS, type BaseAgentConfig, type ThinkingEffort } from '../common/config';

/** Per-deployment settings for the shopping agent; per-request values travel in `ShoppingSessionContext`. Sections continue the base config's: capabilities, cart caps, grounding gates. */
export interface ShoppingAgentConfig extends BaseAgentConfig {
  /** One extra search rule for the domain (prompt). */
  domainSearchNotes: string;
  /** Registers `present_disclosure` over `getDisclosure` (prompt). */
  enableDisclosures: boolean;

  // -- Systems the store has. Search and product details are the floor; each switch, turned off, removes that system's tools, prompt
  // lines and grounding rule on every path, for a store that has no such system at all. A system that exists and is not wired yet
  // stays on: its backend method throws and the tool answers that it is unavailable.
  enableCart: boolean;
  enableOrders: boolean;
  enablePolicies: boolean;
  enableFulfillment: boolean;

  // -- Cart caps, enforced by the gates on every path.
  maxQuantityPerItem: number;
  maxCartLines: number;

  // -- Grounding gates: each forces one read on a turn's first iteration when the message matches. Lexicons are config, not prompt
  // bytes, so extending them costs no cache hit.
  policyGroundingGate: boolean;
  policyIntentTerms: readonly string[];
  policyIntentCues: readonly string[];
  orderGroundingGate: boolean;
  orderIntentTerms: readonly string[];
  orderIntentCues: readonly string[];
  catalogGroundingGate: boolean;
  /** Regex SOURCES (not RegExp objects: a cached global regex carries lastIndex between `.test()` calls). Matched case-sensitively. */
  productIdPatterns: readonly string[];
}

/** Upstream's lexicons and patterns, copied verbatim. The id patterns cap at four digits so five-digit order ids ground through orders; "delivered" is absent from the order terms because it occurs in ordinary shopping phrasing. */
export const UPSTREAM_POLICY_TERMS = [
  'return', 'returns', 'refund', 'refunds', 'exchange', 'exchanges', 'warranty', 'guarantee', 'cancel', 'cancellation', 'restocking',
  'fee', 'fees', 'shipping cost', 'shipping costs', 'delivery cost', 'price match', 'price lock', 'membership', 'subscription',
  'contract', 'policy', 'policies', 'terms',
] as const;
export const UPSTREAM_POLICY_CUES = [
  '?', 'how', 'what', 'when', 'can i', 'could i', 'do you', 'does', 'is there', 'tell me', 'explain', 'how long', 'how much',
] as const;
export const UPSTREAM_ORDER_TERMS = ['order', 'orders', 'delivery', 'delivery address', 'package', 'parcel', 'shipment', 'tracking', 'tracking number'] as const;
export const UPSTREAM_ORDER_CUES = [
  '?', 'where', 'when', 'status', 'cancel', 'change', 'return', 'refund', 'late', 'arrive', 'arrived', 'track', 'missing', 'damaged', "hasn't", 'delayed',
] as const;
export const UPSTREAM_PRODUCT_ID_PATTERNS = [String.raw`\b[A-Z]{2,4}-\d{3,4}\b`, String.raw`\b[A-Z]{2,4}-[A-Z]{2,6}-\d{2,4}(?:-[A-Z0-9]{2,6})?\b`] as const;

/** Defaults. `model` is required by the base shape, so this is a complete `ShoppingAgentConfig` only with one supplied (see `defineShoppingConfig`). */
export const SHOPPING_DEFAULTS: Omit<ShoppingAgentConfig, 'model'> = {
  ...BASE_DEFAULTS,
  assistantName: 'the shopping assistant',
  brandVoice: 'warm, concise, and plain about trade-offs',
  thinkingEffort: 'low' satisfies ThinkingEffort,
  domainSearchNotes: '',
  enableDisclosures: false,
  enableCart: true,
  enableOrders: true,
  enablePolicies: true,
  enableFulfillment: true,
  maxQuantityPerItem: 24,
  maxCartLines: 100,
  policyGroundingGate: true,
  policyIntentTerms: UPSTREAM_POLICY_TERMS,
  policyIntentCues: UPSTREAM_POLICY_CUES,
  orderGroundingGate: true,
  orderIntentTerms: UPSTREAM_ORDER_TERMS,
  orderIntentCues: UPSTREAM_ORDER_CUES,
  catalogGroundingGate: true,
  productIdPatterns: UPSTREAM_PRODUCT_ID_PATTERNS,
};

/** Merge overrides over the defaults. `Partial<ShoppingAgentConfig>` rejects unknown field names at compile time (excess-property check on an object literal). */
export function defineShoppingConfig(model: string, overrides: Partial<ShoppingAgentConfig> = {}): ShoppingAgentConfig {
  return { ...SHOPPING_DEFAULTS, ...overrides, model: overrides.model ?? model };
}

/** Names `buildTools` leaves out for the systems switched off above. */
export function absentTools(config: Pick<ShoppingAgentConfig, 'enableCart' | 'enableOrders' | 'enablePolicies' | 'enableFulfillment'>): ReadonlySet<string> {
  const names = new Set<string>();
  if (!config.enableCart) for (const n of ['get_cart', 'add_to_cart', 'update_cart_item', 'remove_from_cart', 'checkout']) names.add(n);
  if (!config.enableOrders) for (const n of ['get_orders', 'get_order_status', 'present_order_status']) names.add(n);
  if (!config.enablePolicies) names.add('search_policies');
  if (!config.enableFulfillment) names.add('get_fulfillment_options');
  return names;
}
