<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence for workstream O (checkout)

Recorded 2026-10-12 by J20 **offline**: headless Chrome over the DevTools protocol (the Chrome MCP browser hangs for other agents) against a throw-away local stand-in (outside the repo) for the commercetools API, the Checkout Sessions API and the hosted Checkout script (`main.js`, which the Browser SDK injects). Store `mau-reseller-north`, 375/768/1024/1440 px. Nothing here touched a real commercetools project, Stripe or the seed credentials. The hosted widget of these runs is a stand-in: it proves our integration (session creation, SDK mounting into `<div data-ctc>`, theming from tokens, `checkout_completed` handling, return route, order resolution, number handling), not Checkout's own screens or Stripe. Those are OA-05 and M-O05.

| File | Proves |
| --- | --- |
| `O-run1.txt` | Guest, pickup preset: cart, Checkout, exactly one `POST /api/checkout/session`, no browser call to a commercetools host, one `[data-ctc]`, hosted decline shows plain text (no injected markup) and keeps the cart, pay, `checkout_completed`, `/checkout/return`, landing on `/{locale}/{store}/checkout/confirmation/{number}?t=...`, order number equals the `futureOrderNumber` of the session, order custom fields (`pickupBranchKey`, `isTest`, `salesChannel`), cart `Ordered`, `cartId` gone from the session, second return same path and still one order, stranger and unknown id get the same 404 |
| `O-run2.txt` | No cart goes back to the cart; ship preset without a pickup panel, the order keeps the shipping method chosen in the hosted step and has no `pickupBranchKey`; cancelled return back to the checkout with the notice and a new session; dev helper hidden without `?dev=1`, creates an open order with payment state Pending and `isTest`, refuses a non example.com email; signed-in customer gets the email on the cart and a landing without token; subscription line gives an order and a recurring order; de-DE page |
| `O-run3.txt` | `SUBSCRIPTIONS_PURCHASE_ENABLED=false` with a subscription line: session refused (422), plain text, only Back to cart |
| `O-run4.txt` | Sessions API unreachable: controlled 502, Try again creates a new request |
| `O-run5.txt` | No Application key: 503 text, the dev panel appears by itself and completes the cart without a payment |
| `O-09-flag.txt` | Production build and server with a fake key: build gate, dev route 404, session route 409/503, CSP hosts of the Checkout and Stripe only with the region at build time |
| `storefront-O-01-checkout-{375,768,1024,1440}.png` | Checkout page chrome with the pickup panel and the (stand-in) hosted widget, button colour and font taken from the store's tokens |
| `storefront-O-03-landing-1440.png` | Landing after the return route (P's confirmation page does not exist yet: a 404 page) |
| `storefront-O-04-ship-1440.png` | Ship preset, no pickup panel |
| `storefront-O-05-cancelled-375.png` | Cancelled return notice |
| `storefront-O-06-declined-1440.png` | Hosted error shown as plain text |
| `storefront-O-07-subscriptions-off-{375,1440}.png` | Subscriptions switched off |
| `storefront-O-08-dev-panel-1024.png` | Dev completion panel |
| `storefront-O-09-checkout-de-1440.png` | de-DE chrome |
| `storefront-O-10-unavailable-1440.png` | Sessions API unreachable |
| `storefront-O-11-not-configured-768.png` | No Application key |

Not done here (needs OA-05): `O-orders.txt` with MCP read-backs of orders, Payments, `OrderCreated` and recurring orders (section 10 of the plan), real Stripe cards, `read_applications` / `read_payment_integrations` checks. Console: the only errors are the intended 404 responses (P's confirmation page, the stranger and unknown-id checks, the favicon) and one existing N log line about a default-delivery race.
