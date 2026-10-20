<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Proposal: Malva Coffee, omnichannel B2C food service: UI design specs

## Why

Malva Coffee is an omnichannel food service retailer. It sells Nespresso-compatible capsules and coffee, coffee-related products and coffee machines, online and through collection at its own stores. A Claude Design prototype exists for VELA, a fictional activewear storefront built on the commercetools presales design system, with click-and-collect, faceted browsing, a three-step checkout and an account dashboard. It is the visual and structural reference. It needs to become a stable, reviewable design specification for Malva Coffee before build.

## What changes

- Persist the VELA design bundle in `design/export/` (see `design/README.md`).
- Add flat design specs in `openspec/specs/`, one capability per screen group:
  `design-tokens-and-components`, `design-storefront-shell`, `design-store-picker-and-locale`, `design-cart-drawer`, `design-home-page`, `design-product-card`, `design-product-listing-page`, `design-product-detail-page`, `design-cart-page`, `design-checkout-page`, `design-order-confirmation-page`, `design-account-area`.
- Add `design.md` (VELA to Malva mapping, decisions, open questions, new designs needed) and `tasks.md` (plan).

No application code changes. The existing behavioural spec templates in `openspec/specs/` (tracked by `.commercetools/spec-templates.lock.json`) are untouched.

## Capabilities

New: the twelve `design-*` capabilities above.
Modified: none.

## Impact

- Records where Malva's product range (pods, coffee, machines, accessories, subscriptions) forces departures from VELA's apparel model: variants, facets, imagery, money precision, tax display.
- Lists screens VELA does not have and which must be designed: subscriptions, saved payment methods and addresses, product reviews, store search, delivery slots.
- commercetools surface (survey, no code yet): products and variants with product types per shape, prices and price tiers, inventory by supply channel for collection, stores and channels, carts, orders, recurring orders and recurrence policies, shopping lists for saved items, customers, discounts and discount codes, the hosted Checkout. Skills to load per task are annotated in `tasks.md`.

## Out of scope

Implementation, seed data, deployment, the B2B behaviour in VELA (business units, quotes, approvals, purchase lists, SKU quick order), and a brand re-skin beyond the token contract.
