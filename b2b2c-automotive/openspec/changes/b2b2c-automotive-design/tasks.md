<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Plan: from design specs to a running B2B2C starter

Annotated tasks follow the project rule: every commercetools task names the skill to load first.

## 0. Decisions and design gaps (before build)

- [ ] 0.1 Resolve open questions in `design.md` §8
- [ ] 0.2 Commission missing designs from `design.md` §6, shopper side first (account, mobile nav, vehicle flows)
- [ ] 0.3 Commission portal page chrome for the embedded Contentools managers and the branch management screen in the admin kit
- [x] 0.4 Choose a map provider for the store picker (owner 2026-10-12, Q-I02: OpenStreetMap with Leaflet)
- [ ] 0.5 Approve the font allow-list for `consumer-storefront/theming-design`

## 1. Foundations

- [ ] 1.1 Bootstrap `b2b2c-automotive/storefront` per `consumer-storefront/bootstrap-and-structure` (Next.js 16, next-intl for de-DE and en-US, Tailwind v4, store resolved from the path, session, gates) [SKILL: commercetools-storefront]
- [ ] 1.2 Bootstrap `b2b2c-automotive/portal` per `seller-portal/bootstrap-and-structure` (admin kit tokens, B2B session, as-associate and admin clients, Contentools proxy, gates) [SKILL: commercetools-storefront]
- [ ] 1.3 Port `tokens.automotive.css` and `tokens.admin.css` as the only style sources; lint against raw hex, px and font names
- [ ] 1.4 Contentools: confirm the `multitenant contentools` Merchant Center app is installed and connected; add `lib/contentools/origin.ts`, the same-origin `/api/contentools` proxy in both apps (read-only in the storefront; hardened with store-key rewrite and server-held JWT in the portal) and `getValidContentoolsJwt` in the portal [SKILL: commercetools-connect]
- [ ] 1.5 Theme loader, sanitiser and token adapter: read `{origin}/service/{storeKey}/configuration/theme`, map to automotive tokens, derive ramps, font allow-list, inline `<style id="store-theme">`, cache and fallback [SKILL: commercetools-storefront]
- [ ] 1.6 Seed the Contentools `default` namespace with the Malva automotive theme [SKILL: commercetools-platform]
- [ ] 1.7 Shared components from the kits (button, field, badge, card, table, tabs, modal, toast)

## 2. Platform model and seed

- [ ] 2.1 Product types: part (fitment, quality, warranty), local part, bundle [SKILL: commercetools-commerce-patterns]
- [ ] 2.2 Vehicle compatibility model and lookup, searchable facets kept flat [SKILL: commercetools-platform]
- [ ] 2.3 Business units (reseller and branches), stores and channels; associate roles Admin and Buyer (Approver dropped, owner 2026-10-12) [SKILL: commercetools-commerce-patterns]
- [ ] 2.4 Master catalog selection, per-reseller selections, regional withdrawal, blocked-upstream rule [SKILL: commercetools-commerce-patterns]
- [ ] 2.5 Pricing: all prices standalone (Malva list price and reseller prices on the store and branch channels); no MAP floor, no contract prices (owner 2026-10-12) [SKILL: commercetools-commerce-patterns]
- [ ] 2.6 Product tailoring per reseller store: text and images, published at once, no approval [SKILL: commercetools-commerce-patterns]
- [ ] 2.7 Discounts (product and cart), sort orders, Malva-funded locked tier [SKILL: commercetools-commerce-patterns]
- [ ] 2.8 Seed: 2 resellers with different assortment, prices, themes, Contentools pages and branches; 40 parts; shoppers, recurrence policies on selected parts, no wholesale users, no prototype placeholder names [SKILL: commercetools-platform]

## 3. Shopper storefront (in this order)

- [ ] 3.1 Shell (header and footer as application components), store picker, theme application, Puck renderer wiring [SKILL: commercetools-storefront]
- [ ] 3.2 Automotive Puck blocks: hero, vehicle finder, category tiles, popular products, promo banner, brand strip
- [ ] 3.3 Vehicle finder (selectors first, then plate and VIN) and garage with merge on sign-in [SKILL: commercetools-storefront]
- [ ] 3.4 Home page from Puck with default layout fallback
- [ ] 3.5 Listing and search with request-held filters, fit filter, store stock, facets from application configuration [SKILL: commercetools-platform]
- [ ] 3.6 Product page with fit banner, stock, tailored text, disclaimer [SKILL: commercetools-storefront]
- [ ] 3.7 Cart with named discounts, pickup or ship, promo codes [SKILL: commercetools-storefront]
- [ ] 3.8 Hosted commercetools Checkout with the Stripe connector, subscriptions through recurring orders, idempotent order creation; no territory blocking (owner 2026-10-12) [SKILL: commercetools-checkout]
- [ ] 3.9 Confirmation page with theme; no emails are sent (owner 2026-10-12)
- [ ] 3.10 Account area [SKILL: commercetools-storefront]

## 4. Partner portal

- [ ] 4.1 Shell, role-based navigation, BU and store switcher, command palette, notifications [SKILL: commercetools-storefront]
- [ ] 4.2 Auth with pending-approval registration [SKILL: commercetools-storefront]
- [ ] 4.3 Catalog and assortment, price overrides with margin (no floor), tailoring (text and images), discounts and priority [SKILL: commercetools-commerce-patterns]
- [ ] 4.4 Embed Contentools `ThemeManager`, `PageManager`, `ContentManager` through the hardened proxy with the session `storeKey` (theme history stays in Contentools) [SKILL: commercetools-connect]
- [ ] 4.5 Store, branches and channels
- [x] 4.6 ~~Wholesale: quick order, cart, checkout with PO, orders, quotes, approvals, invoices~~ dropped (owner 2026-10-12, Q-V01; the four specs are marked out of scope)
- [ ] 4.7 Customers, subscriptions (managed in the portal), returns with refunds through the payment, reviews [SKILL: commercetools-storefront]
- [ ] 4.8 Marketing and email screens that store templates and campaigns but never send [SKILL: commercetools-integrations]
- [ ] 4.9 Bundles and product import [SKILL: commercetools-commerce-patterns]
- [ ] 4.10 Dashboard with independent widgets and failure states [SKILL: commercetools-integrations]
- [ ] 4.11 Brand partnership page (fitment-claim review only; no floor and no territory rules, owner 2026-10-12)

## 5. Quality

- [ ] 5.1 Accessibility checks for the default theme and keyboard use of the shell
- [ ] 5.2 Responsive checks at 375, 768, 1024, 1440 for both apps
- [ ] 5.3 Role tests: Admin and Buyer against navigation and disabled actions
- [ ] 5.4 Fitment correctness tests (fit, non-fit, no vehicle) and order, return and review integrity tests (no floor or territory tests)
- [ ] 5.5 Contentools failure tests: theme endpoint down, no home page published
- [ ] 5.6 Publish readiness review of the repository [SKILL: ct-builders-readiness]
