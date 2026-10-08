# Workstream Q — Checkout and payment

**Depends on:** O, P, J
**Implements:** design-checkout[Single-page checkout layout; Delivery address; Delivery speed re-pricing; Payment through the payment widget; Place order], checkout-page, checkout
**Skills:** commercetools-checkout, commercetools-storefront, commercetools-commerce-patterns

## Design
Page `/checkout` (sign-in required "Sign in to check out."; empty cart → "Your cart is empty. Find a prescription"). Left column three cards (Delivery address, Delivery speed, Payment), sticky (top 96 px) summary right; stacks < 900 px.
- **Address**: prefilled from the default address (P-05), name defaults to account name, inline format validation with focus on the first error. Saving sets `shippingAddress` on the cart; **after every address change the cart is re-read** and shipping/tax/total are taken from that response (checkout-page). No eligible method for the address → message and Place order disabled.
- **Delivery speed**: methods from the platform (`shipping-methods/matching-cart`) as radio cards: "Standard · 1–2 days — FREE" (default) and "Same-day · by 8 pm — $5.00", the latter only if now < 14:00 America/New_York (D-033, config `SAME_DAY_CUTOFF`) **and** the matching-cart result contains it (zone NY/TX/IL). Choice → `setShippingMethod`; summary updates from the recalculated cart.
- **Payment**: commercetools **Checkout** (payment-only mode, Q-007 = A, Stripe sandbox connector): the storefront creates a Checkout session (`POST /api/checkout/session` → Checkout API with the cart id, amount from the cart), mounts the Checkout payment component via `@commercetools/checkout-browser-sdk` in the Payment card; **no card fields in storefront code, no prefilled test card**. Declined payment → no order, cart kept, inline message. Needs OA-04.
- **Place order**: from the server-held cart, **once**: `POST /api/checkout/place` (idempotency key = cart id + version) → re-read cart, re-run N validations (`validateRxSelection` for every line + ceilings + credential checks of U when present), compare cart total with the amount shown/authorized (mismatch ⇒ refuse and ask to review — "Totals moved after authorization"), create order from cart with `orderNumber` = `MLV-<zero-padded counter>` (counter custom object, Q-041), `consumeAuthorization(orderId)` (N-02, idempotent), set order state `mlv-received`, clear `cartId`. Double submit → one order, busy disabled button. Placement fails at the last moment → cart kept, payment released/not captured, clear message. Success → redirect `/order/<id>` (S).
- Order **payment lifecycle**: Checkout creates the Payment and order handling is ours; capture on `mlv-packed-shipped` is out of v1 (authorization-only demo; stated in README) — decision confirm in the PR (Q-Q-1 to the owner if Stripe sandbox needs capture).
Totals always from the cart; "Address changes the total" is satisfied because tax is 0% (D-033) but the re-read is still performed and tested with a fixture whose tax changes.

## Tasks
- [x] Q-01 `lib/checkout/config.ts` (`SAME_DAY_CUTOFF`, tz) + `lib/ct/shipping-options.ts` `getOptionsForCart(cartId, now)` combining platform matching methods with the cut-off; tests incl. just-before/after 14:00 and out-of-state address [SKILL: commercetools-commerce-patterns] [SPEC: checkout-page]
- [x] Q-02 `PUT /api/checkout/address` and `PUT /api/checkout/shipping-method` handlers: set on cart, re-read, return the cart; tests: totals taken from the response, no method for address → 422 [SKILL: commercetools-storefront] [SPEC: checkout-page]
- [x] Q-03 `AddressCard`, `DeliverySpeedCard` (RadioCard, 1.5 px azure border when selected), validation focus handling, "Same-day not available" state; tests [SPEC: design-checkout]
- [ ] Q-04 `POST /api/checkout/session` and `PaymentCard` mounting the Checkout browser SDK; env names in `.env.example` (`CTP_CHECKOUT_*`, public application key only is `NEXT_PUBLIC_*`-free by design: pass it via a server-rendered prop); a test asserting no input with `autocomplete=cc-*` exists in storefront code [SKILL: commercetools-checkout] [SPEC: design-checkout]
- [ ] Q-05 `lib/ct/orders.ts` `placeOrder(cartId, expectedTotal, idempotencyKey)`: re-validate, compare totals, create order with `orderNumber`, state, line custom fields from N-09, consume authorization, clear cart; tests for success, mismatch refusal, last-moment failure keeps cart, retry with same key returns the same order [SKILL: commercetools-commerce-patterns] [SPEC: checkout]
- [ ] Q-06 `POST /api/checkout/place` + client `PlaceOrderButton` (busy/disabled, double-activation test), redirect to `/order/<id>`; declined-payment message path [SKILL: commercetools-checkout] [SPEC: design-checkout]
- [ ] Q-07 `OrderSummary` (lines, Delivery FREE/fee, Total navy 20 px, sticky), empty-cart and anonymous states; tests [SPEC: design-checkout]
- [ ] Q-08 Counter helper `lib/ct/order-number.ts` (optimistic concurrency retries) with concurrency tests [SKILL: commercetools-platform] [SPEC: checkout]
- [ ] Q-09 README section "Payment lifecycle in the demo" (authorize only, how to capture/refund by hand, Stripe sandbox cards) and owner manual test M-Q-1 [SPEC: checkout]

## Scenarios
Every scenario is a unit test (or a scripted check) named after it.
<!-- SCENARIOS:BEGIN (generated by plans/verify-plan.mjs --sync) -->
#### design-checkout › Single-page checkout layout
- [ ] Empty cart
- [ ] Anonymous visitor
#### design-checkout › Delivery address
- [ ] Prefill
- [ ] Invalid input
#### design-checkout › Delivery speed re-pricing
- [ ] Options
- [ ] Same-day not available
- [ ] Change
#### design-checkout › Payment through the payment widget
- [ ] Payment card
- [ ] Declined payment
#### design-checkout › Place order
- [ ] Summary
- [ ] Double submit
- [ ] Success
#### checkout-page › Checkout re-reading totals after each shipping change
- [ ] Address change moves tax
- [ ] No delivery method for address
#### checkout › Checkout
- [ ] Address changes the total
- [ ] Totals moved after authorization
- [ ] Placement fails at the last moment
<!-- SCENARIOS:END -->

## Browser recipe
Claude as Sam with a valid RX line: `/en-US/checkout` shows address prefilled; switch to Same-day (before 14:00 NY, set env `SAME_DAY_NOW_OVERRIDE` in dev) → summary shows $5.00 and total from `read_carts`; after cut-off option absent; payment widget iframe renders and no card inputs exist in the DOM outside the iframe; use the Stripe sandbox card when OA-04 is done (otherwise stop at the widget and record M-Q-1); double-click Place order → exactly one `read_orders` entry with `MLV-` number, state `mlv-received`, `malva-rx` refills decremented once, cart cleared.

## Manual tests (owner-only)
M-Q-1 (real Stripe sandbox card entry in the widget) — pre-registered in `TODO-MANUAL-TESTING.md`; OA-04.

## Definition of done
JUNIOR-GUIDE §9.
