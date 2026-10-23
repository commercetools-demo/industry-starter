---
title: "How the Malva Coffee demo works"
---

# How the Malva Coffee demo works

This is the build behind the Malva Coffee storefront, the companion to the *Malva Coffee demo script*. The script says what happens on screen; this says how it is built and which parts are real.

## What we built

| Piece | What it is | Where to see it |
|---|---|---|
| Storefront | Next.js 16 (App Router), React 19, Tailwind v4, next-intl; US and Canada | <https://omni-industry-starter.netlify.app/en-US> |
| Server layer | A backend-for-frontend: `lib/ct/*` modules plus Route Handlers under `app/api`. The browser never talks to commercetools | `b2c-foodservice/storefront/lib/ct`, `app/api` |
| Seed package | Idempotent scripts that create everything in the commercetools project, every key prefixed `mcf-` | `b2c-foodservice/seed` |
| Demo gate and tracker | A password gate and visitor analytics from `@ct-demos/demotools` | `/gate`, `app/api/gate`, `app/api/tracker` |
| Plans and specs | Workstreams, decisions and 50 OpenSpec specs | `b2c-foodservice/plans`, `b2c-foodservice/openspec` |

## The one thing to understand

> A line in the bag knows how it will be received. Each line item carries a `fulfilment` value — `collect`, `delivery` or `subscribe` — and everything else follows from it.

The cart clusters by that value. Collect lines carry a store (a supply channel) and the zero-price collection shipping method. Delivery lines carry the standard carrier. Subscribe lines carry a recurrence policy and become recurring orders. The account, the collection tracker and the confirmation page all read the same field, so a mixed bag needs no special case anywhere downstream. The field is a custom type on the line item (`mcf-line-fulfilment`).

## How a mixed bag is paid

The bag is one bag in the UI. At pay time it is cloned into one single-shipping cart per payment group — each collect store, then delivery plus subscription — and each clone is paid in sequence through the hosted Checkout, with order numbers suffixed `-A`, `-B`. This is decision `complete-per-group` in `plans/PROJECT-FINDINGS.md`, taken because the Checkout documentation says the complete mode handles shipping configuration internally and recommends Payment Only for custom shipping ([Checkout browser SDK](https://docs.commercetools.com/checkout/browser-sdk)). The documented alternative is Payment Only with a multiple-shipping cart. **Status:** the decision was written from documentation; the live probes that would confirm it needed a Checkout application and Stripe connector, and the plan file records them as open. Run a mixed-bag test order before relying on it.

## How the catalog and search are modelled

| Feature | commercetools resource |
|---|---|
| Five product types — pods, coffee, machines, accessories, gift sets — with attributes such as `intensity`, `roast`, `system`, `grind` | Product Types |
| Category tree: 5 top-level, 15 children | Categories |
| Listing, facets and search | Product Search API (`products().search()`), never `productProjections().search()` ([reference](https://docs.commercetools.com/api/projects/products-search)) |
| Prices per market | Embedded prices on variants, one per country and currency; tax-exclusive in both markets |
| Per-store stock | [Inventory entries](https://docs.commercetools.com/api/projects/inventory) with a supply channel per store, plus one with no channel for online |
| Six stores | Channels with role `InventorySupply`, with a custom type for address, hours and collection minutes |
| Ratings | Reviews API and the product's `reviewRatingStatistics` ([guide](https://docs.commercetools.com/guides/review-ratings)) |
| Discount codes | Discount Codes pointing at Cart Discounts: `WELCOME10`, `FREESHIP`, `COFFEE15` |
| Shipping | Zones `mcf-zone-us`, `mcf-zone-ca`; methods `mcf-ship-standard`, `mcf-ship-express`, `mcf-collect` |
| Tax | Platform tax mode with tax categories; food 0%, standard goods 8% US (8.875% New York) and 5% GST Canada |
| Order progress | Order states `mcf-order-ordered`, `-preparing`, `-ready-for-collection`, `-collected` |

Measured against the project on 2026-10-23: Product Search returned `total: 41` for an empty query, the stores API returned six stores, and the commercetools MCP read back exactly three Discount Codes (`WELCOME10`, `FREESHIP`, `COFFEE15`), all active.

## How subscriptions work

A subscribable pod or coffee has recurring prices per recurrence policy at 10% below the one-time price. Four policies exist: every 2 weeks, every month, every 2 months, every 3 months. When an order with recurring lines is created, the platform creates one recurring order per distinct schedule, and the account reads and changes them through the Recurring Orders API ([overview](https://docs.commercetools.com/api/projects/recurring-orders-overview)). Changing the interval is only accepted on an Active recurring order with no active skip configuration ([API reference](https://docs.commercetools.com/api/projects/recurring-orders)), so the screen disables the button while a skip is pending. **Status:** the subscription flow was built and unit-tested; the live run needed owner actions that the plan lists as open (`OA-02`, `OA-04`), so confirm with a test order.

## What each surface is made of

| Surface | Built on |
|---|---|
| Browse and search | `lib/ct/products.ts`, `search.ts`, `categories.ts`; routes `category/[slug]`, `shop`, `search` |
| Product page | `lib/ct/product-detail.ts`, `inventory.ts`, `subscription-plan.ts`; route `p/[slug]/[sku]` |
| Cart | `lib/ct/cart.ts`, `cart-enrich.ts`; the `/api/cart/*` handlers |
| Checkout | `lib/ct/checkout.ts`, `checkout-session.ts`; hosted Checkout with Stripe |
| Account | `lib/ct/orders.ts`, `addresses.ts`, `shopping-lists.ts`, `recurring-orders.ts`, `reviews.ts` |
| Markets | `lib/ct/market.ts`; `proxy.ts` keeps the session's market in step with the URL locale |

## Custom types and objects

| Type | Purpose |
|---|---|
| Line item type `mcf-line-fulfilment` | The `fulfilment` enum above |
| Channel type `mcf-store` | Address, city, postal code, phone, hours, collection minutes |
| Order states | The four collection states |

## Where everything runs

| What | Where |
|---|---|
| Storefront | Netlify site `omni-industry-starter`, base directory `b2c-foodservice/storefront`, Node 22 |
| commercetools project | `spec-test-b2c-food`, region `us-central1.gcp` |
| API clients | A frontend client with no admin scopes (the deploy gate fails if one is present); a second client with `manage_products` used only for writing reviews |
| Gate and analytics | `tracker.ctdemo.net`, proxied first-party through `/api/tracker` |

## Decisions worth knowing about

| Decision | Cost |
|---|---|
| US and Canada only, English only (D-030) | No French for Canada |
| All six stores in New York, so collection is US-only (D-035) | Canada is delivery only |
| No email provider, no password reset, accounts verified on creation (D-032) | Nothing in the UI promises an email |
| No review moderation (D-037) | A review counts the moment it is written |
| Product Search API only (D-023) | Requires Product Search indexing switched on in project settings ([reference](https://docs.commercetools.com/api/projects/products-search)) |
| One bag in the UI, cloned per payment group at pay time (D-033) | Several payments for one mixed bag |
| Demo sign-in list instead of typed credentials (D-040) | Only for demo sites; the list and password stay on the server |

## What is real and what is stubbed

| Real | Caveat, same row |
|---|---|
| A live commercetools project with 41 products, prices in two currencies, per-store stock, ratings | A seeded catalog with stock photography, not a customer's |
| Cart, discounts, tax and shipping calculated by commercetools | Canadian provincial tax is not modelled |
| Hosted Checkout connected to Stripe | Test mode only; the mixed-bag path is documented but not proven live in the project's records |
| Six stores with stock per store | Invented addresses; hours read empty in the stores API on 2026-10-23, so the picker shows **Closed today** |
| Demo gate and visitor analytics | The gate is inert in local development |

## Before production

| Area | What to do | What to keep |
|---|---|---|
| Catalog | Replace the seed with a feed from the real PIM, using the catalog migration approach | The product types and the `fulfilment` field |
| Stores | Real addresses and opening hours | Supply channels as stores |
| Payment | Real Stripe account and the Checkout application's live settings | The clone-per-payment-group shape, or switch to Payment Only |
| Email | Add a provider, then restore verification and password reset | The auto-verify path is isolated and removable |
| Demo sign-in | Remove `DEMO_LOGIN_ENABLED` | The ordinary sign-in form |

## Reading the code

| Looking for | Start at |
|---|---|
| How a line becomes collect, ship or subscribe | `lib/ct/cart.ts`, `fulfilment-and-availability-model` spec |
| Market switching | `proxy.ts`, `lib/ct/market.ts` |
| The gate | `lib/gate.ts`, `app/gate/page.tsx`, `app/api/gate/route.ts` |
| Seed data | `seed/src/data/*.ts` |
| Decisions | `plans/DECISIONS.md` |
