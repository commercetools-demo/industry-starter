<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Proposal: Malva B2B2C automotive — design specs for the supplier portal and reseller storefronts

## Why

Malva is a European distributor and brand owner of aftermarket and OEM-equivalent parts. It sells to independent resellers (B2B). Each reseller runs a branded storefront on Malva's platform and sells to drivers and workshops (B2C). Two Claude Design prototypes exist (a reseller storefront and the Malva partner/seller portal). They need to become a stable, reviewable design specification before build, with the brief's four commitments covered: catalog inheritance, vehicle-first browsing, layered pricing, plus reseller theming. Decisions of 2026-10-12: theme and content live in Contentools, resellers earn margin (no commission), and fitting services are out of scope.

## What changes

- Persist the two designs and their design-system tokens in `design/export/`.
- Add design specs, one capability per screen group:
  - `consumer-storefront/theming-design` — the token contract resellers may change.
  - `consumer-storefront/design-*` — shell, home, vehicle finder and garage, listing, detail, cart, checkout, confirmation, store picker, account area.
  - `seller-portal/design-*` — shell, auth, dashboard, catalog assortment, price overrides, product info tailoring, discounts, storefront theme and branding (hosting Contentools), store and channels, content pages (Contentools), customers and subscriptions, returns and reviews, brand partnership, marketing and email, bundles and import, wholesale quick order and cart, orders/quotes/invoices, approvals and roles, price lists and saved lists, company and account.
- Add `design.md` (decisions, coverage, conflicts) and `tasks.md` (plan).

No application code changes. The existing behavioural spec templates under `consumer-storefront/` and `seller-portal/` are untouched.

## Capabilities

New: all directories above.
Modified: none.

## Impact

- Resolves the brief-versus-design conflicts listed in `design.md` into explicit decisions or open questions.
- Identifies screens missing from the designs (account area, portal chrome for the Contentools managers, mobile navigation, branches) so they can be commissioned.
- commercetools surface (survey, no code yet): stores, product selections, channel prices, product tailoring, business units and associate roles, approval rules, quotes, recurring orders, cart and discounts, custom data for fitment; Contentools custom objects for theme, pages and content. Skills to load per task are annotated in `tasks.md`.

## Out of scope

Implementation, seed data, deployment, and Malva-level cross-reseller storefront.

Owner decisions of 2026-10-12 (interview): wholesale buying from Malva is out of scope, so `seller-portal/design-quick-order-and-cart`, `design-orders-quotes-invoices`, `design-approvals-and-roles` and `design-price-lists-and-saved-lists` stay on disk with an `<!-- OUT-OF-SCOPE -->` marker and are not implemented; there is no MAP floor, no territory blocking and no approval of tailored text; no email is sent; payment is hosted commercetools Checkout with Stripe. See `design.md` section 4.1.
