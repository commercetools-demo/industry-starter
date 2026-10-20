<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Spec coverage

Every spec under `openspec/specs/` maps to exactly one primary workstream, or is marked not applicable with the reason. `node plans/verify-plan.mjs` reads this file's table. Columns: spec, primary workstream, also extended by.

## Owned specs

| Spec | Primary | Also | Note |
| --- | --- | --- | --- |
| bootstrap-and-structure | A | | |
| platform-project-setup-and-seed | B | C | C extends with catalogue steps |
| server-architecture-and-data-flow | D | | |
| design-tokens-and-components | E | | |
| design-storefront-shell | F | | |
| design-store-picker-and-locale | F | | |
| fulfilment-and-availability-model | F | K, N | F stores and availability; K mixed bags, states, tax, shipping; N subscriptions |
| design-product-listing-page | G | | |
| design-product-card | G | | |
| design-product-detail-page | H | | |
| design-cart-drawer | I | | |
| design-cart-page | I | | |
| design-checkout-page | K | | |
| design-order-confirmation-page | K | | |
| design-account-area | L | | |
| reviews-and-ratings | M | G | G adds rating filter and sort |
| design-home-page | O | | |

## Generated behavioural templates (grocery origin)

| Spec | Primary | Note |
| --- | --- | --- |
| about-us | P | |
| account-and-self-service | L | |
| account-dashboard | L | |
| account-registration-request | n/a | B2C registers instantly; no seller activation (D-015) |
| account-sign-in | J | |
| address-book | L | |
| authentication-and-identity | J | |
| blog-resources | P | Optional (Q-012) |
| cart-management | I | |
| cart-page | I | |
| checkout | K | |
| checkout-page | K | |
| contact-us | P | |
| delivery-slot-booking | n/a | Standard carrier delivery only (Q-004) |
| discovery-and-browse | G | |
| email-verification | J | Pluggable mail adapter (Q-002) |
| error-pages | P | |
| faq | P | |
| home-landing-page | O | |
| order-confirmation-page | K | |
| order-history | L | |
| out-of-stock-substitutions | n/a | Grocery picking; collection is reserved stock (D-022) |
| password-reset | J | Pluggable mail adapter (Q-002) |
| payment-methods | L | Limited to what the hosted Checkout supports (Q-014) |
| policy-pages | P | |
| post-purchase-order-management | L | |
| product-detail-page | H | |
| product-listing-page | G | |
| saved-lists | L | Saved items as a shopping list |
| search-results-page | G | |
| subscriptions-and-recurring-orders | N | |
| switching-region-or-language | F | |
| weight-based-pricing | n/a | Prices are per pack; per-100 g unit price is display only |
