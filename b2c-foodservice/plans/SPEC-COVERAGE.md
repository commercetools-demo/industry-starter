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
| fulfilment-and-availability-model | F | K, N | F stores (six in NYC, US only) and availability; K mixed bags, states, tax, shipping; N subscriptions |
| design-product-listing-page | G | | |
| design-product-card | G | | |
| design-product-detail-page | H | | |
| design-cart-drawer | I | | |
| design-cart-page | I | | |
| design-checkout-page | K | | |
| design-order-confirmation-page | K | | |
| design-account-area | L | | |
| reviews-and-ratings | M | G | G adds rating filter and sort; no moderation (D-037) |
| design-home-page | O | | |

## Generated behavioural templates (grocery origin)

| Spec | Primary | Note |
| --- | --- | --- |
| about-us | P | |
| account-and-self-service | L | |
| account-dashboard | L | |
| account-registration-request | n/a | B2C registers instantly and is auto-verified; no seller activation (D-015, D-032) |
| account-sign-in | J | |
| address-book | L | |
| authentication-and-identity | J | |
| blog-resources | P | Optional (Q-012) |
| cart-management | I | |
| cart-page | I | |
| checkout | K | |
| checkout-page | K | |
| contact-us | P | |
| delivery-slot-booking | n/a | Standard carrier delivery only (Q-004, D-034) |
| discovery-and-browse | G | |
| email-verification | n/a | Not applicable: no email provider; registrations are verified automatically (D-032) |
| error-pages | P | |
| faq | P | |
| home-landing-page | O | |
| order-confirmation-page | K | |
| order-history | L | |
| out-of-stock-substitutions | n/a | Grocery picking; collection is reserved stock (D-022) |
| password-reset | n/a | Not applicable: no email provider, no password reset (D-032) |
| payment-methods | L | Saved methods not built; the hosted Checkout with Stripe owns card data (Q-014, D-039) |
| policy-pages | P | |
| post-purchase-order-management | L | |
| product-detail-page | H | |
| product-listing-page | G | |
| saved-lists | L | Saved items as a shopping list |
| search-results-page | G | |
| subscriptions-and-recurring-orders | N | |
| switching-region-or-language | F | |
| weight-based-pricing | n/a | Prices are per pack; per-100 g unit price is display only |

## Scenario map (workstream Q)

Scenarios whose title is not named in the primary workstream's Scenarios checklist, with the test or evidence that proves them (found by Q on 2026-10-21 with `node plans/verify-plan.mjs --scenarios`). `blocked:` rows wait for an owner row and are listed by `--release`; `n/a:` rows belong to templates that are not applicable (D-032). Test titles are checked against the Vitest report by `--tests`.

| Spec | Scenario | Evidence |
| --- | --- | --- |
| server-architecture-and-data-flow | Collection in Canada | `Collection flag: US true, Canada false (D-035, Q-A-17)` (lib/utils.test.ts) |
| design-storefront-shell | Canada market | `Store pill is hidden in the Canada market` (components/layout/Header.test.tsx) |
| design-store-picker-and-locale | Canada market | `renders nothing in the Canada market` (components/store/StorePicker.test.tsx) |
| design-store-picker-and-locale | Market change | `Market change: country, currency and locale change together and cartId is reset` (lib/session.test.ts) |
| design-store-picker-and-locale | Only the offered markets | `Only the offered locales are listed` (components/locale/LocaleChooser.test.tsx) |
| fulfilment-and-availability-model | Canada has no collection | `Canada has no collection banner and no store button` (app/[locale]/page.test.tsx) |
| fulfilment-and-availability-model | Collect line | `Each line shows the collect, delivery or subscription marker` (components/checkout/CheckoutPage.test.tsx) |
| fulfilment-and-availability-model | Lines are marked by cluster | `Mixed bag with collect, ship and subscribe lines shows three clusters each with its own heading and promise` (components/cart/CartPage.test.tsx) |
| fulfilment-and-availability-model | Mixed order | `a mixed order keeps every line under its marker and shows the collection and delivery cards` (components/order/order.test.tsx) |
| fulfilment-and-availability-model | Ready | `Ready minutes come from the store data` (components/checkout/CheckoutPage.test.tsx) |
| fulfilment-and-availability-model | Recurring order creation fails | `Pending card links to contact` (components/account/subscriptions/SubscriptionsTab.test.tsx) |
| fulfilment-and-availability-model | US address without state rate | `US address without state rate has a tax portion` (lib/checkout/summary.test.ts) |
| fulfilment-and-availability-model | Canadian address | `accepts a Canadian postal code and upper-cases it; the state is not asked for` (lib/account/address-validate.test.ts) |
| design-product-listing-page | Canada toolbar | `Canada listing has no availability controls` (components/listing/ListingPage.test.tsx) |
| design-product-card | Canada card | `Canada card has no availability line and no Choose a store link` (components/product/ProductCard.test.tsx) |
| design-product-detail-page | Canada market | `Canada market renders no Collect card, no collect block and no store control` (components/pdp/Fulfilment.test.tsx) |
| design-product-detail-page | Mixed bag line | `Mixed bag shows one cluster per fulfilment group and each line inside its cluster` (components/checkout/CheckoutPage.test.tsx) |
| design-cart-drawer | Mixed bag in the drawer | `a collect line out of stock offers Ship, and shipping moves it` (components/cart/CartDrawer.test.tsx) |
| design-cart-drawer | Canada drawer | `Canada drawer shows only delivery and subscription lines and no collect cluster` (components/cart/CartDrawer.test.tsx) |
| design-cart-page | Lines are labelled | `Mixed bag with collect, ship and subscribe lines shows three clusters each with its own heading and promise` (components/cart/CartPage.test.tsx) |
| design-cart-page | Changing a line moves it | `switching one line moves only that line between clusters` (components/cart/CartPage.test.tsx) |
| design-cart-page | Canada market | `Canada bag has no Collect chip, no collect cluster and no collect badge` (components/cart/CartPage.test.tsx) |
| design-cart-page | Switch to delivery | `Switch to ship from a collect line out of stock moves it and clears the warning` (components/cart/CartPage.test.tsx) |
| design-cart-page | Invalid code | `Discount code rejected tells why and leaves totals unchanged` (components/cart/CartPage.test.tsx) |
| design-cart-page | Duplicate code | `Duplicate code says it is already applied and sends nothing` (components/cart/CartPage.test.tsx) |
| design-cart-page | Remove a code | `a code that stops applying stays visible, muted, with the reason, and can be removed` (components/cart/CartPage.test.tsx) |
| design-checkout-page | Empty cart | `Empty cart shows the empty state with no summary block` (components/cart/CartPage.test.tsx) |
| design-checkout-page | Mixed bag summary | `Mixed bag shows one cluster per fulfilment group and each line inside its cluster` (components/checkout/CheckoutPage.test.tsx) |
| design-checkout-page | Canada summary | `Canada food is zero rated and standard goods carry GST` (lib/checkout/summary.test.ts) |
| design-checkout-page | B2C | `B2C only: a card grid, no variant table or pack selector` (components/listing/ListingPage.test.tsx) |
| design-checkout-page | Start checkout | blocked: OA-K-a, M-K-07 — the hosted Checkout (full flow with Stripe) is not set up; the Review stage and session call are tested (CheckoutPage tests), the embedded flow is live-only |
| design-checkout-page | Back to bag | `Back to review unmounts the widget and a new session is created on return` (components/checkout/CheckoutPage.test.tsx) |
| design-checkout-page | Standard carrier only | blocked: OA-K-a — which methods the hosted flow offers is only visible live; the project has one carrier method (seed test), see M-K-07 |
| design-checkout-page | Payment declined | blocked: OA-K-a — declined card needs the Stripe test mode (J15); the bag-intact path is the Back to review test |
| design-checkout-page | Success return | `an order that already exists goes to its confirmation, not to a second session` (components/checkout/CheckoutPage.test.tsx) |
| design-order-confirmation-page | Return from hosted Checkout | `Widget mount point exists and the region is named` (components/checkout/CheckoutPage.test.tsx) |
| design-order-confirmation-page | Mixed order | `a mixed order keeps every line under its marker and shows the collection and delivery cards` (components/order/order.test.tsx) |
| design-account-area | Sign in as a seeded customer | `lists customers by market without any email` (components/auth/SignInForm.test.tsx) |
| design-account-area | Nothing sensitive in the page | `Nothing sensitive in the page: the list carries keys, names and markets, never an email or the password` (app/api/auth/demo-login-gate.test.ts) |
| design-account-area | Disabled | `Disabled: DEMO_LOGIN_ENABLED not true answers 404 on demo-login` (app/api/auth/demo-login-gate.test.ts) |
| design-account-area | Canada market | `Collection tab and nav entry are hidden in the Canada market` (components/account/AccountShell.test.tsx) |
| design-account-area | Toggle | blocked: M-L-browser — the 44x26 animation is visual; the save-on-press behaviour is tested in SettingsTab tests |
| reviews-and-ratings | Immediate visibility | `New review is published at once` (components/reviews/ReviewsSection.test.tsx) |
| reviews-and-ratings | New review is live | `Valid review` (components/reviews/ReviewsSection.test.tsx) |
| design-home-page | Canada market | `Canada market hides store button and collect promise` (components/home/Hero.test.tsx) |
| server-architecture-and-data-flow | Review creation | `Review creation: only the review module imports the isolated client, and no other module imports it` (lib/ct/review-client-boundary.test.ts) |
| bootstrap-and-structure | Deploy config | `Deploy config: netlify.toml exists, builds the storefront on Node 22, and no vercel.json exists` (scripts/release-config.test.ts) |
| authentication-and-identity | Password reset does not confirm the email | n/a: D-032, no password reset and no email |
| authentication-and-identity | Verification before recovery | n/a: D-032, accounts are verified automatically, no recovery flow |
| checkout | Totals moved after authorization | `Session is refused when the total moved` (app/api/checkout/placement-routes.test.ts) |
| checkout-page | No delivery method for address | blocked: OA-K-a — the address and delivery step are inside the hosted Checkout; the storefront shows `checkout_blocked` for a bag the market cannot ship |
| discovery-and-browse | Browse a category | `Browse a category shows a paginated filterable list` (lib/listing/load.test.ts) |
| discovery-and-browse | Nothing matches | `Query matches nothing keeps the query and offers fallback content` (lib/listing/load.test.ts) |
| product-listing-page | Filters survive a reload | `Filters survive a reload (same URL gives same state and count)` (lib/listing/load.test.ts) |
| product-listing-page | Facet combination with no matches | `Facet combination with no matches keeps removable chips and a clear button` (components/listing/ListingPage.test.tsx) |
| product-listing-page | No price for this buyer | `No price for this buyer card states it` (components/listing/ListingPage.test.tsx) |
| product-listing-page | Page past the last result | `Page past the last result redirects to the last page` (lib/listing/load.test.ts) |
| search-results-page | Part number pasted | `Part number pasted puts that product first and names the matched sku` (lib/listing/load.test.ts) |
| search-results-page | Query matches nothing | `Query matches nothing keeps the query editable and shows fallback content` (components/listing/ListingPage.test.tsx) |
| search-results-page | Misspelt query | `Misspelt query sends a fuzzy clause and claims no correction` (lib/listing/load.test.ts) |
| search-results-page | Unsupported language | `Unsupported language reports it` (components/listing/ListingPage.test.tsx) |
