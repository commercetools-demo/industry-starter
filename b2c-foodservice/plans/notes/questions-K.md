<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream K (checkout and confirmation)

Draft for the lead to consolidate into `plans/QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | status`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-K-01 | Payment-only hosted Checkout cannot take the design's own "Place order" button; the widget has its own pay button. Accept? | Yes: widget button labelled "Place order" via Checkout text customisation (OA-K-d), inside the Payment card; Back stays ours. | No | Open |
| Q-K-02 | Mixed bags: which strategy after the K-01 spike? Should G/I create every cart as `shippingMode: Multiple` (the mode is immutable after creation)? | Strategy from the K-01 decision rule. G's `CART_SHIPPING_MODE` stays `'Single'`; K clones into a `Multiple` cart at checkout when there are two groups (a `Multiple` cart shows no tax estimate on the cart page until every quantity is allocated). | K-03 to K-07 detail | Open |
| Q-K-02b | If only tax fails under Multiple, fix data or fall back? | Fix data in the seed and keep Multiple. | No | Open |
| Q-K-02c | Under the `order-per-group` fallback, on which order do discount codes apply? | First order only. | No | Open |
| Q-K-03 | Can the hosted pay button be hidden, triggered or labelled from our page? | Not assumed; spike probe S12. | No | Open |
| Q-K-04 | Order number format? | `MC-` plus 10 base32 characters derived from the cart id (deterministic, so retries cannot create a second order). | No | Open |
| Q-K-05 | If the order exists but the `transitionState` to `mcf-order-ordered` fails? | Log, show the order without tracker, retry on the next read. | No | Open |
| Q-K-06 | May the shipping country differ from the market? | No: shipping country is the session country. | No | Open |
| Q-K-07 | Billing address for collect-only orders? | Contact name and email with the store's country; the widget collects any extra fields the PSP needs. | No | Open |
| Q-K-08 | Should "Check out as guest" detach the order from the signed-in customer? | No: fields clear only (spec); the order stays on the account. | No | Open |
| Q-K-09 | Save a new checkout address to the account? | Checkbox, off by default, members only. | No | Open |
| Q-K-10 | How does a guest's email reach the register page after an order? | HTTP-only cookie `mcf_guest_email`, 1 hour, deleted on read; never a URL. | No | Open |
| Q-K-11 | Where do delivery-day texts ("2-4 business days") come from? | `ShippingMethod.localizedDescription` per locale; request to workstream B to write them in the seed; no text when absent. | No | Open |
| Q-K-12 | Tracker mapping for `ordered`, and ship-only orders? | `ordered` = Ordered active (spec, not the prototype); ship-only orders show no tracker, only the delivery card. | No | Open |
| Q-K-13 | Notification promises (emailed receipt, SMS when ready)? | Not shown while no mail adapter is enabled; never for SMS; copy says to check the page or account. | No | Open |
| Q-K-14 | Who may open a guest order's confirmation? | Anyone holding the order id; phone and billing hidden. Member orders need the owning session. | No | Open |
| Q-K-15 | Behaviour if `complete` is called twice? | `finalizeOrder` is idempotent by order number. | No | Open |
