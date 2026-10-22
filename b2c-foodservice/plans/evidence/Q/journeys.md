<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# End-to-end journeys (Q-09)

Run 2026-10-22 by workstream Q with the Chrome DevTools MCP against a **production build** (`npm run build`, `next start -p 3100`) of branch `ws/q-quality`, talking to the **local mock commercetools** (`storefront/scripts/mock-ct-server.mjs`, project `mock-project`). There is no live project, Checkout Application or Stripe connector yet (OA-01, OA-04, OA-K-a), so:

- Everything the shopper sees in the storefront is verified here at 1440x900 and, where `E2E-JOURNEYS.md` asks, at 375x812 (`emulate` mobile, touch). The MCP window cannot be resized below 500 px; the 375 px views use device emulation.
- The **hosted Checkout widget and Stripe cannot run against the mock**: its script URL is the mock origin, which the CSP correctly blocks (a mock-only artefact). The pay step is simulated the way the platform does it: the storefront creates the payment session (`POST /api/checkout/session`), the mock plays the hosted Checkout finishing (`POST /__mock/place-order`, scratch helper outside the repository), the storefront finalises (`POST /api/checkout/complete`) and renders the confirmation. Steps that need the real widget are marked `blocked: OA-K-a` and are owner rows M-K-01 to M-K-04, M-Q-01.
- Mock limits to remember: flat 8% tax per country (so pods show tax that the real project zero-rates), no Product Search relevance, placeholder images (`1200 x 1440`), orders and carts live in memory only.
- Browser cookies on `localhost` are shared across ports (other dev projects on this machine set `NEXT_LOCALE`, `portal_last_bu`, ...); journeys use isolated browser contexts.
- Read-backs use the mock's debug routes (`GET /__mock/orders`, `/__mock/carts`), not the live project: ids and numbers only.

Screenshots are in this folder as `J<n>-<what>-<375|1440>.png`. Console and network were checked after each step: no console error and no failed request unless the step says so.

Defects found are listed in `fixes.md`.

## J0 Shell, market and store persistence: PASS

| Step | Observation |
| --- | --- |
| 1 | `/` redirects to `/en-US`. Promise bar `Free shipping over $75.00 · Free café collection, ready in 30 min · 30-day returns`; wordmark, five primary links (Pods, Coffee, Machines, Accessories, Gifts), store pill `Choose a store`, market pill `US (USD) \| EN`, search, sign in, cart `0 items`. |
| 2 | Hover on Coffee opens the mega menu (New in, Bestsellers, Sets; Shop coffee; More from Malva; brew-method strip). `J0-mega-1440.png`. |
| 3 | Store pill opens the picker with the six New York City stores; choosing Williamsburg gives the pill `Collect at Malva Coffee Williamsburg`; after a reload it is still chosen. `J0-store-picker-1440.png`. |
| 4 | Market pill: Canada goes to `/en-CA` (`lang="en-CA"`), CAD prices, **no store pill**, promise bar `Free shipping over $99.00 · 30-day returns` (no collection promise), exactly one `PUT /api/session/market` (200). Switching back to the US: pill is `Choose a store` (Williamsburg forgotten). |
| 5 | At 375 px the menu toggle appears, the slide-in navigation opens (16 px bold links; the first link has focus), Escape closes it, no horizontal overflow. `J0-mobile-nav-375.png`. |
| 6 | Newsletter: `not-an-email` gives the inline error `Enter a valid email address` (`aria-invalid`, `aria-describedby`); a valid address gives the toast `Thanks, you're on the list` (the form is a validated no-op, nothing is stored: Q-F-07). |

## J1 Guest buys a pod box

### J1-US (collect, `/en-US`, store Harlem): PASS (hosted payment simulated)

| Step | Observation |
| --- | --- |
| 1 | `Ember Ristretto` pod page: pack selector 10 sleeve, 50 box, 100 box; three cards (Collect in store, Delivery, Subscribe and save). With Williamsburg chosen the product is out of stock there: see J8. With Harlem chosen: `In stock at Malva Coffee Harlem`, `Ready today, in about 30 minutes`, button `Reserve for collection - $5.90`; the 50 box shows `$25.95` and `$0.52 per capsule`. `J1-ca-pdp-1440.png` is the Canada page (J1-CA). |
| 2 | `Reserve for collection - $25.95`: toast `Reserved for collection`, header `Cart, 1 item`, nothing opens (design Q-H-12). |
| 3 | `/en-US/cart`: group `Collect · Malva Coffee Harlem` with address and readiness, the line has the `Collect` chip active, shipping `Free`, `Estimated tax`. `J1-us-cart-1440.png`. |
| 4 | `/en-US/checkout`: Review stage, `Pickup at Malva Coffee Harlem`, `Who's picking up?`. Pressing Continue with an empty pickup name shows `Enter the name of the person collecting.` (field `Pickup name`, `autocomplete=name`, `aria-invalid`, `aria-describedby`, announced in `role=alert`). `J1-us-checkout-review-1440.png`. With a name the Pay stage opens; the hosted widget is the mock origin and is blocked by the CSP (expected, `blocked: OA-K-a`). |
| 5 | Payment simulated; `/api/checkout/complete` returns the order id; confirmation `Order confirmed`: order number, store, hours, `Ready in about 30 minutes`, tracker `Ordered, Preparing, Ready, Collected`, `Bring a photo ID and your order number.`, `Create an account with this order`; no password in the URL, no sentence that promises an email. `J1-us-confirmation-1440.png`. |
| 6 | The same confirmation URL in a second isolated context (no cookies) **shows the order**: the page is addressed by the order id only. Real order ids are UUIDs; the page is `no-store`, `noindex`, `Referrer-Policy: strict-origin-when-cross-origin`. Recorded as question Q-Q-15 (default: keep, an unguessable id is the capability). |

Read-back (mock): order `MC-RKSSNE2QGK` has no `customerId`, `customerEmail` is the test address, one line (`MCF-POD-EMBER-50`) with a supply channel and `fulfilment = collect`, shipping method `mcf-collect` price 0, state `mcf-order-ordered`, total 2803 USD cents (mock flat tax).

### J1-CA (delivery, `/en-CA`): PASS (hosted payment simulated)

`Ember Ristretto` in Canada shows Delivery and Subscribe only (no Collect card, no store pill); `Add to bag - $8.10`; bag group `Shipping to you`, `Free standard over $99.00 · 2 to 4 business days`, shipping `$8.95`, estimated tax; confirmation shows a `Delivery` block (`Standard`, estimated 2-4 business days, shipping address) and no collection block. `J1-ca-cart-1440.png`, `J1-ca-confirmation-1440.png`. Read-back: order `MC-10TR0AGZDF`, CAD, line `fulfilment = delivery`, no supply channel, shipping method `mcf-ship-standard`, no `mcf-collect`.
