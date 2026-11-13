## Why

> **Superseded in part by workstream T2 (decision D-055, 2026-11-05).** The Shopper MCP is removed. The backend is `StorefrontApiBackend` over the storefront's own modules (`lib/ct/*`, `lib/mappers/*`), built with the shopper's cookie session. The assistant's cart is the shopper's bag: there is no second cart and no adopt step. The current requirements are in `specs/shopping-assistant-storefront-backend/`, which replaces `specs/shopping-assistant-shopper-mcp/`. Where the text below names the Shopper MCP, the storefront modules are meant. This document is kept as the record of the T decisions.

Shoppers who do not know which coffee, capsule or sparkling water they want have only filters and search today. The business wants a conversational shopping assistant in the storefront, built on Anthropic's reference commerce agent (`github.com/anthropics/commerce-agents`, Apache-2.0) and driven by the **commercetools Shopper MCP** (UCP shopping MCP server) instead of direct commercetools API calls.

## What Changes

- Add a docked assistant panel (launcher in the header, never a modal) on the website experience, in `en-US` and `en-CA`, for both brands.
- Port the reference agent core to TypeScript under `storefront/lib/agent/` keeping upstream module names: fencing, trust-safety gates, server-side presentation enrichment, grounding, the streaming turn loop and the prompt-cache layout.
- Implement the reference's one integration interface (`StorefrontBackend`) **only** over the Shopper MCP. Scope fixed by the owner:
  - **Catalogue**: search products, read product details.
  - **Cart**: read, add, change quantity, remove, then adopt the assistant cart as the storefront bag.
  - **Old orders**: read an existing order of the signed-in shopper.
  - **No ordering on behalf of the shopper.** The assistant never places an order or moves money; the shopper pays in the existing hosted Checkout.
- No new commercetools API calls other than the Shopper MCP tools. Two narrow exceptions are owner-approved: a new storefront API that **adopts the assistant's MCP cart as the shopper's bag** (validates and normalises it, then sets its id in the session; Q-T-1), and verifying order ownership through the storefront's existing account order read (Q-T-2).
- Six presentation cards: products, comparison, plan, guide, order status, checkout summary. The activity of each tool call is shown in plain words.
- Session, transcript and provenance stored server side (Netlify Blobs with compare-and-set); the browser only holds the signed `malva-session` cookie.

### Not built (by decision)

Policies/terms search, fulfilment options, disclosures, web search, long-term memory and any order-placing tool. Their tools stay out of the prompt through the reference's own config switches. The merchant role and the Agent-SDK/MCP-server runtimes of the reference are not ported.

## Capabilities

### New Capabilities
- `shopping-assistant-shopper-mcp`: the backend over the Shopper MCP, ids, money, errors, per-market servers.
- `shopping-assistant-trust-safety`: the enforced rules between the model and the shopper.
- `shopping-assistant-turn-and-transport`: turn loop, streaming, caching, deadlines, session storage, routes, abuse control.
- `shopping-assistant-chat-ui`: panel, launcher, cards, language, tokens.
- `shopping-assistant-cart`: the assistant cart and its adoption as the storefront bag.
- `shopping-assistant-order-lookup`: retrieving an old order.

### Modified Capabilities
None while the change is open. On archive, `cart-management` gains a pointer to `shopping-assistant-cart` (see tasks).

## Impact

- Storefront: new `lib/agent/**`, `components/assistant/**`, `context/assistant-context.tsx`, `app/api/assistant/**`, `messages/*.json` (namespace `assistant`), `app/[brand]/[locale]/layout.tsx` (mount), `lib/env.ts`, `scripts/check-bundle-secrets.mjs`, `scripts/predeploy-check.mjs`, `app/api/api-matrix.test.ts`, `eslint/` boundary rules, `third_party/`, `NOTICE`.
- New dependencies: `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `@netlify/blobs`, `zod` (pinned exactly).
- Platform (owner): Shopper MCP server per market (US, Canada), an API client with scope `mcp:<project>:<server>`, Store `storefront.checkoutUrlTemplate` and `orderUrlTemplate`, an Anthropic API key with a spend cap.
- Out of scope: new commercetools data or seed, per-brand MCP servers, the in-store companion, memory, e-mail, any change to checkout.
