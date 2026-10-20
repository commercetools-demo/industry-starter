<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Plan: from design specs to a running Malva Coffee storefront

Every commercetools task names the skill to load first.

## 0. Decisions and design gaps (before build)

- [ ] 0.1 Resolve open questions in `design.md` section 5 (Q1 to Q10)
- [ ] 0.2 Decide the brand palette and fonts (D2) and supply logo and photography
- [ ] 0.3 Commission the designs in `design.md` section 6, shopper-critical first: subscribe and save, compatibility guide, store search
- [x] 0.4 Persist the VELA design bundle (`design/export/`)

## 1. Foundations

- [ ] 1.1 Scaffold a Next.js storefront with locale routing and Tailwind v4 [SKILL: commercetools-storefront]
- [ ] 1.2 Port the token layer from `design-tokens-and-components` as the only style source; lint against raw colours, fonts and radii
- [ ] 1.3 Shared atoms: button, chip, field, option button, stepper, card, badge, drawer, modal, toast, steps, icon set
- [ ] 1.4 Money and locale: minor-unit formatting, currency per locale (D3) [SKILL: commercetools-platform]
- [ ] 1.5 Shell: promise bar, header, mega menu, mobile nav, footer, toast [SKILL: commercetools-storefront]

## 2. Platform model and seed

- [ ] 2.1 Product types per shape: pods, coffee, machine, accessory [SKILL: commercetools-commerce-patterns]
- [ ] 2.2 Categories, facets and compatibility (machine system) kept searchable and flat [SKILL: commercetools-platform]
- [ ] 2.3 Prices, unit-price display attributes, tax categories and tax display per market [SKILL: commercetools-commerce-patterns]
- [ ] 2.4 Stores and per-store inventory through supply channels for collection availability [SKILL: commercetools-commerce-patterns]
- [ ] 2.5 Discounts and discount codes, stackable, including a free-shipping code [SKILL: commercetools-commerce-patterns]
- [ ] 2.6 Recurrence policies for subscribable products [SKILL: commercetools-commerce-patterns]
- [ ] 2.7 Seed: catalogue across the four shapes, 4 to 5 stores with different stock, demo shoppers, no VELA names [SKILL: commercetools-platform]

## 3. Shopper experience (in this order)

- [ ] 3.1 Store picker and locale chooser, persisted [SKILL: commercetools-storefront]
- [ ] 3.2 Product card and listing with faceted counts, collect filter and URL state [SKILL: commercetools-platform]
- [ ] 3.3 Product detail: variant selectors per shape, fulfilment choice, availability, add to bag [SKILL: commercetools-storefront]
- [ ] 3.4 Cart drawer and cart page with fulfilment groups and switching [SKILL: commercetools-storefront]
- [ ] 3.5 Checkout: details, fulfilment, hosted payment, promo codes, validation [SKILL: commercetools-checkout]
- [ ] 3.6 Order confirmation with collection tracker [SKILL: commercetools-storefront]
- [ ] 3.7 Home page: hero, tiles, collection banner, sections, editorial and subscribe strip [SKILL: commercetools-storefront]

## 4. Account

- [ ] 4.1 Sign-in, registration, session and guest checkout [SKILL: commercetools-storefront]
- [ ] 4.2 Orders, collection store, saved items [SKILL: commercetools-storefront]
- [ ] 4.3 Subscriptions: list, skip, pause, change interval, cancel [SKILL: commercetools-commerce-patterns]
- [ ] 4.4 Addresses, payment methods, profile and settings [SKILL: commercetools-storefront]

## 5. Quality

- [ ] 5.1 Responsive pass at 1080, 900, 820, 700 and 520
- [ ] 5.2 Accessibility pass: contrast, labels, focus, reduced motion
- [ ] 5.3 Check each screen against `design/export` screenshots and these specs
