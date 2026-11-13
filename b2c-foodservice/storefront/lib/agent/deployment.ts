import { UPSTREAM_ORDER_CUES, defineShoppingConfig, type ShoppingAgentConfig } from './shopping/config';

/**
 * This storefront's deployment of the shopping agent (workstream T, decisions D-050 to D-054). CONSTANTS ONLY: anything that renders
 * into the static prompt or the tool list must be the same bytes on every request, so nothing here reads the environment. The model id
 * and the transport are environment settings read elsewhere (they are not prompt bytes).
 *
 * Systems switched off (no policy corpus, no fulfilment-estimate source, no regulated-facts source, no web search, no memory):
 * their tools, prompt lines and grounding rules disappear through the reference's own switches, so the model says "we don't offer that"
 * instead of "try again later".
 *
 * Host ceiling: Netlify functions have a hard 60 s synchronous limit. Request timeout 40 s, 4 tool iterations, provenance cap 60, and a
 * 48 s turn deadline checked between rounds (past it one final round runs with tools disabled so the turn ends in prose).
 * None of these is a prompt-bytes field.
 */
export const DEFAULT_ASSISTANT_MODEL = 'claude-sonnet-5-5';

export const SHOPPING_CONFIG: ShoppingAgentConfig = defineShoppingConfig(DEFAULT_ASSISTANT_MODEL, {
  brandName: 'Malva',
  assistantName: 'the Malva assistant',
  enableCart: true,
  enableOrders: true,
  enablePolicies: false,
  enableFulfillment: false,
  enableDisclosures: false,
  enableWebSearch: false,
  enableMemory: false,
  maxToolIterations: 4,
  requestTimeoutS: 40,
  turnDeadlineS: 48,
  provenanceCap: 60,
  policyGroundingGate: false,
  // Order questions in en-US and en-CA wording: upstream's terms plus "where's"-style cues. All ASCII (JavaScript \b is ASCII-only).
  orderIntentCues: [...UPSTREAM_ORDER_CUES, "where's", 'wheres', "how's"],
  // Real coffee, capsule, machine, accessory and gift SKUs are MCF-<TYPE>-<CODE>[-<SIZE>[-<VARIANT>]> (seed/src/data/products.ts), two to four
  // dash parts after MCF. Order numbers are MC-<10 chars> and cannot match. The Malva Drinks SKUs are bare six-digit numbers: a pattern for them
  // would fire on ordinary numbers, so a typed drinks SKU is NOT grounded by this gate (the model still reads before it writes: provenance gate).
  productIdPatterns: [String.raw`\bMCF(?:-[A-Z0-9]{1,12}){2,4}\b`],
});
