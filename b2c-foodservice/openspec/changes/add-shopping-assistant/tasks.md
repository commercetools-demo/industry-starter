## 0. How to use this file

> **Superseded in part by workstream T2 (decision D-055, 2026-11-05).** The Shopper MCP is removed. The backend is `StorefrontApiBackend` over the storefront's own modules (`lib/ct/*`, `lib/mappers/*`), built with the shopper's cookie session. The assistant's cart is the shopper's bag: there is no second cart and no adopt step. The current requirements are in `specs/shopping-assistant-storefront-backend/`, which replaces `specs/shopping-assistant-shopper-mcp/`. Where the text below names the Shopper MCP, the storefront modules are meant. This document is kept as the record of the T decisions.

The step-by-step instructions for juniors (files, signatures, tests, done-when) are in `plans/workstreams/T-shopping-assistant.md`. This list mirrors its task ids so `/opsx:apply` can tick them. Read the six `specs/*/spec.md` first.

## 1. Spikes and gates
- [x] T-00 Green baseline and owner prerequisites (OA-T-a to OA-T-d)
- [ ] T-01 Probe the Shopper MCP, record redacted fixtures, answer U1 to U11 *(superseded by T2, D-055)*
- [ ] T-02 Transport gate on a real deploy (SSE or buffered)
- [x] T-03 Vendor Apache-2.0 licence, NOTICE, header convention and header test

## 2. Shared extractions
- [ ] T-04 Product URL builder, SKU pattern and order number pattern importable from server code

## 3. Pure core
- [x] T-05 Config and types (deployment constants, model allowlist)
- [x] T-06 Fencing
- [x] T-07 Streaming and the hand-written partial-JSON parser
- [x] T-08 Skills (four, byte for byte) and generated module with staleness check
- [ ] T-09 Serialization, tool registry, presentation schemas
- [ ] T-10 Grounding lexicons and id patterns measured on real SKUs
- [ ] T-11 Protocol union and client mirror
- [ ] T-12 Prompt assembly and the byte-stability gate

## 4. Backend over the Shopper MCP
- [ ] T-13 MCP client and typed errors *(superseded by T2, D-055)*
- [ ] T-14 Ids and money modules *(superseded by T2, D-055)*
- [ ] T-15 Search and product details *(superseded by T2, D-055)*
- [ ] T-16 Cart, orders, ownership guard *(superseded by T2, D-055)*
- [ ] T-17 Live contract and fenced-cap scripts *(superseded by T2, D-055)*

## 5. Storage
- [ ] T-18 Session store contract, memory store, Netlify Blobs store

## 6. Trust and safety
- [ ] T-19 Gates
- [ ] T-20 Enrichment and presentation runner
- [ ] T-21 Executor

## 7. Turn loop
- [ ] T-22 Orchestrator
- [ ] T-23 Real three-turn cache check

## 8. Routes
- [ ] T-24 Guard (origin, rate classes, flags)
- [ ] T-25 Session route
- [ ] T-26 Turn route
- [ ] T-27 Card routes
- [ ] T-28 Adopt-cart route and `lib/ct/adopt-cart.ts` (with fallback) *(superseded by T2, D-055)*
- [ ] T-29 Matrix, env, bundle-secret, predeploy and lint boundary
- [ ] T-29b Transport proof on a deploy

## 9. UI
- [ ] T-30 Money module and token layer
- [ ] T-31 Client core copied from upstream
- [ ] T-32 Provider, panel, launcher
- [ ] T-33 Showcase page
- [ ] T-34 Six cards
- [ ] T-35 Messages and key-scrape test
- [ ] T-36 Cart revalidation

## 10. Mount and verify
- [ ] T-37 Mount in the locale layout
- [ ] T-38 Gates proof by hand
- [ ] T-39 Money proof (USD, CAD)
- [ ] T-40 Documentation, status, release checklist; on archive add the `cart-management` pointer
