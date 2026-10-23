<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Plan: from design specs to a running Malva Coffee storefront

Every commercetools task names the skill to load first.

## 0. Decisions and design gaps (before build)

- [ ] 0.1 Resolve the remaining open questions in `design.md` section 5 (Q3, Q6 and Q9 are resolved by D-030, D-034, D-035)
- [ ] 0.2 Decide the brand palette and fonts (D2) and supply logo and photography
- [ ] 0.3 Commission the designs in `design.md` section 6, shopper-critical first: subscribe and save, compatibility guide, store search (no delivery slot picker, no password reset)
- [x] 0.4 Persist the VELA design bundle (`design/export/`)

## 1. Foundations

- [ ] 1.1 Scaffold a Next.js storefront with locale routing and Tailwind v4 [SKILL: commercetools-storefront]
- [ ] 1.2 Port the token layer from `design-tokens-and-components` as the only style source; lint against raw colours, fonts and radii
- [ ] 1.3 Shared atoms: button, chip, field, option button, stepper, card, badge, drawer, modal, toast, steps, icon set
- [ ] 1.4 Money and locale: minor-unit formatting, currency per locale for en-US (USD) and en-CA (CAD) (D3) [SKILL: commercetools-platform]
- [ ] 1.5 Shell: promise bar, header, mega menu, mobile nav, footer, toast [SKILL: commercetools-storefront]

## 2. Platform model and seed

- [ ] 2.1 Product types per shape: pods, coffee, machine, accessory [SKILL: commercetools-commerce-patterns]
- [ ] 2.2 Categories, facets and compatibility (machine system) kept searchable and flat [SKILL: commercetools-platform]
- [ ] 2.3 Prices, unit-price display attributes, tax categories and tax-exclusive display for US and Canada (D-036) [SKILL: commercetools-commerce-patterns]
- [ ] 2.4 Six NYC stores and per-store inventory through supply channels for collection availability (US market only) [SKILL: commercetools-commerce-patterns]
- [ ] 2.5 Discounts and discount codes, stackable, including a free-shipping code (standard carrier only) [SKILL: commercetools-commerce-patterns]
- [ ] 2.6 Recurrence policies for subscribable products [SKILL: commercetools-commerce-patterns]
- [ ] 2.7 Seed: catalogue across the four shapes, six NYC stores with different stock, demo shoppers, no VELA names [SKILL: commercetools-platform]

## 3. Shopper experience (in this order)

- [ ] 3.1 Store picker (hidden in Canada) and US/Canada market chooser, persisted [SKILL: commercetools-storefront]
- [ ] 3.2 Product card and listing with faceted counts, collect filter (US only) and URL state [SKILL: commercetools-platform]
- [ ] 3.3 Product detail: variant selectors per shape, fulfilment choice, availability, add to bag [SKILL: commercetools-storefront]
- [ ] 3.4 Cart drawer and cart page with fulfilment clusters, per-line fulfilment chips for mixed bags (D-033), switching and promo codes [SKILL: commercetools-storefront]
- [ ] 3.5 Checkout: hand-off to the full hosted commercetools Checkout with Stripe (D-039), reduced shell, read-only order summary by cluster, failure and return handling [SKILL: commercetools-checkout]
- [ ] 3.6 Order confirmation with collection tracker (no email claims) [SKILL: commercetools-storefront]
- [ ] 3.7 Home page: hero, tiles, collection banner, sections, editorial and subscribe strip [SKILL: commercetools-storefront]

## 4. Account

- [ ] 4.1 Sign-in, registration (auto-verified, signed in at once), session; no password reset or email verification (D-032) [SKILL: commercetools-storefront]
- [ ] 4.2 Orders, collection store, saved items [SKILL: commercetools-storefront]
- [ ] 4.3 Subscriptions: list, skip, pause, change interval, cancel [SKILL: commercetools-commerce-patterns]
- [ ] 4.4 Addresses, payment methods, profile and settings [SKILL: commercetools-storefront]

## 5. Quality

- [ ] 5.1 Responsive pass at 1080, 900, 820, 700 and 520
- [ ] 5.2 Accessibility pass: contrast, labels, focus, reduced motion
- [ ] 5.4 Deploy to Netlify with `netlify.toml` (D-038) [SKILL: commercetools:nextjs-deploy-netlify]
- [ ] 5.3 Check each screen against `design/export` screenshots and these specs
