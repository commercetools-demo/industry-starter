<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Dependency plan A to Z

Letters are in a valid **build order**: a workstream depends only on earlier letters. Never start one until everything it depends on is `Done` in `STATUS.md`. Two workstreams in the same wave may run in parallel. `plans/verify-plan.mjs` checks the order and that every spec is covered.

Spec ids: plain names are `openspec/specs/<name>/`. Apps: `storefront/` (shopper app), `seed/` (platform data scripts).

## Workstreams

| ID | Workstream | Implements (primary first) | Depends on | Owner prerequisites | Wave |
| --- | --- | --- | --- | --- | --- |
| A | Bootstrap: scaffold with the skill command, tooling, env, health check, guards | bootstrap-and-structure | none | OA-01 for the live health check only | 1 |
| B | Seed foundation: guards, fake API, settings, cleanup, tax, shipping, channels, types, categories, policies, order states | platform-project-setup-and-seed | none | OA-01 for live runs | 1 |
| C | Seed catalogue: products, variants, embedded prices, recurring prices, inventory, images, discounts, customers, shopping lists, reviews, verify | platform-project-setup-and-seed (continued) | B | OA-01; OA-03 for images | 2 |
| D | Server core: client, session, utils, mappers, types, cache keys, image config, errors, proxy | server-architecture-and-data-flow | A | OA-01 | 2 |
| E | Design system: tokens, atoms, icons, i18n catalogues | design-tokens-and-components | A | none | 2 |
| F | Shell and global pickers: header, mega menu, mobile nav, footer, toast, store picker, locale chooser, channels and availability API | design-storefront-shell, design-store-picker-and-locale, switching-region-or-language, fulfilment-and-availability-model (stores, availability) | B, D, E | none | 3 |
| G | Browse: Product Search, facets, listing, search results, product card | design-product-listing-page, design-product-card, product-listing-page, search-results-page, discovery-and-browse | C, D, E, F | none | 4 |
| H | Product detail: gallery, variants per shape, fulfilment choice, availability, compatibility guide | design-product-detail-page, product-detail-page | G | none | 5 |
| I | Cart: API, drawer, page, fulfilment groups and switching, discount codes | design-cart-drawer, design-cart-page, cart-management, cart-page | H | none | 6 |
| J | Auth and session: sign-in, registration, cart merge, password reset | account-sign-in, authentication-and-identity, password-reset, email-verification | I | Q-answers on email (QUESTIONS) | 7 |
| K | Checkout and confirmation: addresses, shipping, hosted Checkout, mixed bag spike, order states, confirmation | design-checkout-page, design-order-confirmation-page, checkout, checkout-page, order-confirmation-page, fulfilment-and-availability-model (mixed bags, order states, tax, shipping) | I, J | OA-04 (Checkout application and payment connector) | 8 |
| L | Account area: dashboard, orders, collection, saved items, addresses, profile, settings | design-account-area, account-dashboard, account-and-self-service, address-book, order-history, saved-lists, post-purchase-order-management, payment-methods | J, K | none | 9 |
| M | Reviews and ratings: list, write, moderation, own reviews | reviews-and-ratings | H, J | none | 9 |
| N | Subscriptions: recurring prices on the PDP, recurring orders, account management | subscriptions-and-recurring-orders, fulfilment-and-availability-model (subscriptions) | K, L | OA-02 (scope `manage_recurring_orders`) | 10 |
| O | Home page | design-home-page, home-landing-page | G | none | 10 |
| P | Content and error pages: about, contact, FAQ, policies, blog, error pages | about-us, contact-us, faq, policy-pages, blog-resources, error-pages | E, F, J, L | SO-01 (copy and legal text) | 10 |
| Q | Quality and release: responsive, accessibility, end-to-end journeys, security review, performance, deploy gate | none new; verifies all | all | OA-05 (hosting) for deploy | 11 |

## Waves

1. A, B in parallel.
2. C, D, E in parallel (C needs B; D and E need A).
3. F.
4. G.
5. H.
6. I.
7. J.
8. K.
9. L and M in parallel.
10. N, O, P in parallel.
11. Q.

## Graph

```
A ──► D ──┐
A ──► E ──┼─► F ──► G ──► H ──► I ──► J ──► K ──► L ──┬─► N ──┐
B ──► C ──┘ (C feeds G onwards)        │       │        └─► M   │
B ───────► F                           │       └────────────────┴─► Q
                          H ──► M      G ──► O,  E+F ──► P
```

## Gates between waves

| Gate | Condition |
| --- | --- |
| After wave 1 | `cd seed && npm run check` passes; `cd storefront && npm run check && npm run build` passes; `/api/health` answers (with OA-01) |
| After wave 2 | Seed run live and `npm run verify` passes, second `seed` run reports `0 change(s)`; images added when OA-03 is done; storefront server core tests pass |
| After wave 5 | Browse and detail verified in Chrome at 375 and 1440 px with real seeded data, evidence saved |
| After wave 8 | One order placed end to end in the browser with the hosted Checkout test card, evidence saved |
| Before Q | Every spec scenario has a named test or evidence; `TODO-MANUAL-TESTING.md` has no row without an owner, steps and expected result |

## Spec ownership rule

A spec listed in several workstreams is primary in the first one listed and only extended in the others. `verify-plan.mjs` checks that each spec is primary in exactly one workstream and that every owned spec appears (except those marked not applicable in `SPEC-COVERAGE.md`).
