<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream K (checkout and confirmation)

Draft for the lead to consolidate into `plans/QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | status`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-K-01 | The complete hosted Checkout (D-039) has its own pay button and pages; the design's three steps and "Place order" button are replaced. Accept? | Answered by D-039: Review stage ours, the rest hosted; the pay button is labelled "Place order" through Application texts (OA-K-d); the owner judges fidelity in SO-K-b. | No | Answered |
| Q-K-02 | Mixed bags (required, D-033): which mechanism after the spike? Should G/I create every cart as `shippingMode: Multiple`? | Mechanism from K-01's rule (`complete-multiple`, `complete-per-group`, `payment-only-for-collect`). G's `CART_SHIPPING_MODE` stays `'Single'`; K clones into a `Multiple` cart when the strategy needs it. Reason: with `Multiple` the cart page shows no tax estimate until every quantity is allocated, which would break `design-cart-page` Tax presentation. | Blocks K-03 to K-07 detail only | Open |
| Q-K-02b | If only tax fails under Multiple: fix data or fall back? | Fix data in the seed and keep the strategy. | No | Open |
| Q-K-02c | Under `complete-per-group`, on which order do discount codes apply? | First order only. | No | Open |
| Q-K-03 | Can the hosted pay button be hidden or triggered from our page? | Not assumed; probe S12. | No | Open |
| Q-K-04 | Order number format? | `MC-` plus 10 base32 characters derived from the cart id (deterministic, so retries cannot duplicate). | No | Open |
| Q-K-05 | What if an order exists but `transitionState` to `mcf-order-ordered` fails? | Log, show the order with no tracker, retry on the next read. | No | Open |
| Q-K-06 | May the shipping country differ from the market? | No: the shipping country is the session country (cart currency and prices depend on it); the Application is limited to the market's country if S12 shows it can be. | No | Open |
| Q-K-07 | Billing address and pickup identity for collect orders? | We ask a pickup name on Review; the hosted flow collects the rest. | No | Open |
| Q-K-08 | Should "Check out as guest" detach the order from the signed-in customer? | Not applicable under the hosted flow: a signed-in cart stays the customer's; guests use a guest cart. | No | Open |
| Q-K-09 | Save a new checkout address to the account? | Whatever the hosted flow does; L's address book is the place to manage addresses. | No | Open |
| Q-K-10 | Where does a guest's email travel to the register page? | HTTP-only cookie `mcf_guest_email`, 1 hour, deleted on read. Never a URL. | No | Open |
| Q-K-11 | Where do delivery-day texts come from? | `ShippingMethod.localizedDescription` for `en-US` and `en-CA` (seed change): "2-4 business days" style for standard. No text if absent. | No | Open |
| Q-K-12 | Tracker mapping for `ordered`, and for ship-only orders? | `ordered` = Ordered active (spec, not the prototype). Ship-only orders (all Canada orders) show no tracker, only the delivery card. | No | Open |
| Q-K-13 | Notification promises (emailed receipt, SMS when ready)? | None anywhere (D-032); copy says check the page or account. Answered. | No | Answered |
| Q-K-14 | Guest order page access? | Anyone holding the order id sees it with phone and billing hidden; member orders need the owning session. | No | Open |
| Q-K-15 | Idempotency on the placement path if `complete` is called twice? | `finalizeOrder` is idempotent by order number. | No | Open |
| Q-K-16 | Express delivery: does the hosted flow offer it next to standard? D-034 says standard carrier only. | Seed standard and express as methods; the hosted flow lists what matches; no carrier choice, no slots. Owner may drop express from the seed. | No | Open |
| Q-K-17 | Strategy before the live spike: which mechanism is built? | `complete-per-group` (documentation predicts S13 FAIL). Built: the bag is cloned at pay time into one Single cart per group (each collect store, then delivery plus subscription), paid in sequence as orders `<base>-A`, `-B`. `lib/checkout/strategy.ts` is the one switch; `buildFulfilmentActions` and `ensureCheckoutCart` exist for `complete-multiple`. | Re-run S13 to S15 live (OA-K-a) | Open |
| Q-K-18 | Where do the clone cart ids live between the Review stage and payment? | A short HTTP-only cookie `mcf_pay_carts` (ids, labels and display amounts; every use re-checks ownership), not a new session field, because the session token format is shared with the proxy. | No | Open |
| Q-K-19 | Order lines carry no attribute labels (attributes are not saved on lines, Q-I-7), so the confirmation shows name and quantity without the variant summary. | Empty `variantSummary` on orders; follow-up: enrich from a product read or save the attributes on the line. | No | Open |
| Q-K-20 | `seed:order` file location: the plan says `seed/src/scripts/order-ops.ts`. | `seed/src/order-ops.ts`, next to the other scripts (the seed has no `scripts` folder). L adds subcommands there. | No | Open |
| Q-K-21 | Which SDK locale for `en-CA` and `en-US`? | Both `en`; the page locale goes in `currencyLocale` for money formatting. Probe S12 confirms live. | No | Open |
| Q-K-22 | A redirect payment (3-D Secure) of the first of two payments. | `/checkout/return` finalises it and sends the shopper to `/<locale>/checkout?resume=1&part=<n>`, which opens the next payment. | No | Open |
| Q-K-23 | The mock needs the Sessions API. | Optional `CTP_SESSION_URL` (base URL) overrides the session host; unset in every real environment. | No | Open |
| Q-K-24 | Guest order access (Q-K-14) shows the shipping address to whoever holds the order id (a UUID). | Kept: no customer phone or billing address is in the view at all. | No | Open |
