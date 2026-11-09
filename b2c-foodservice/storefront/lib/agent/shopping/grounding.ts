// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/grounding.py; changes: TypeScript port.

import { type GroundingRule, findToken, matchesTermsAndCues } from '../common/grounding';
import type { ShoppingAgentConfig } from './config';
import type { ShoppingSessionState } from './types';

/**
 * The shopping agent's grounding rules, in precedence order: a store-terms question starts from search_policies, a post-purchase
 * question from get_orders, and a mention of an unseen product id from get_product_details. A rule whose system the config switches off
 * never fires.
 */

type Rule = GroundingRule<ShoppingAgentConfig, ShoppingSessionState>;

const policy: Rule['fires'] = (config, text) =>
  config.enablePolicies && config.policyGroundingGate && matchesTermsAndCues(text, config.policyIntentTerms, config.policyIntentCues) ? {} : null;

const orders: Rule['fires'] = (config, text) =>
  config.enableOrders && config.orderGroundingGate && matchesTermsAndCues(text, config.orderIntentTerms, config.orderIntentCues) ? {} : null;

const catalog: Rule['fires'] = (config, text, state) => {
  if (!config.catalogGroundingGate) return null;
  const token = findToken(text, config.productIdPatterns);
  // An id the session already resolved needs no forced re-read; ids compare case-insensitively.
  if (token === null) return null;
  const seen = new Set([...state.seenProducts.keys()].map((id) => id.toUpperCase()));
  return seen.has(token.toUpperCase()) ? null : { product_id: token };
};

export const GROUNDING_RULES: readonly Rule[] = [
  { name: 'policy', tool: 'search_policies', fires: policy },
  { name: 'orders', tool: 'get_orders', fires: orders, prefetchIntro: () => 'Recent orders for this turn, fetched by the host (the same data a get_orders call returns):' },
  {
    name: 'catalog',
    tool: 'get_product_details',
    fires: catalog,
    prefetchIntro: (args) => `Catalog record for ${String(args.product_id)}, fetched by the host (the same data a get_product_details call returns):`,
  },
];
