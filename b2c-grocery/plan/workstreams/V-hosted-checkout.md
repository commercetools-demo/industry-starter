# V — Hosted checkout and order confirmation

**Specs:** `malva-storefront-design/checkout-design` (all), `delivery-slot-experience` (Handoff validation and booking), `storefront-bff-and-session` (Checkout session endpoint), `storefront-data-loading` (Order placement and confirmation), `weight-pricing-experience` (provisional notice on summary/confirmation); existing behavior `checkout-page`, `checkout`, `order-confirmation-page`
**Depends on:** E, J, N, O, Q, R · **Unblocks:** Y · **Decisions:** D-035, D-036, D-037, D-042 · **Owner prerequisites:** OA-05 · **Sign-off:** SO-03
**Skill refs:** `/commercetools:commercetools-checkout` (`references/payment-only-mode.md` for session creation), docs: Checkout Browser SDK `checkoutFlow`.

## Goal
"Checkout" in the cart creates a Checkout Session and opens the hosted Complete Checkout (Adyen test) inside our branded page; on completion the cart is cleared and the confirmation page shows the order.

## Design

### Session creation (`lib/ct/checkout-session.ts`, `server-only`)
```ts
export async function createCheckoutSession(cartId: string): Promise<{ sessionId: string }>
```
1. Token: POST `${CTP_AUTH_URL}/oauth/token` with `grant_type=client_credentials&scope=manage_sessions:${CTP_PROJECT_KEY}` and Basic auth (client id/secret). (The only raw `fetch` to commercetools besides the Sessions call — lint exception for this file.)
2. POST `https://session.${region}.commercetools.com/${projectKey}/sessions` with `{ cart: { cartRef: { id: cartId } }, metadata: { applicationKey: CTP_CHECKOUT_APP_KEY } }`; region from `getRegion(CTP_API_URL)` (E). Return `id` as `sessionId`.
Errors map to typed `CheckoutSessionError` (token failure, API error).

### `POST /api/checkout/session` (route)
Order of checks, each with its own error code and **no session created on failure**:
1. `cartId` in session else 400 `NO_CART`; cart must be Active and non-empty (`EMPTY_CART`).
2. Every line in stock (`getAvailableQuantity ≥ quantity`) else 409 `{ error:'UNAVAILABLE_LINES', lines:[lineId] }`.
3. Cart has a deliverable shipping address (`isDeliverable`) else 422 `NO_ADDRESS`; slot fields present else 422 `NO_SLOT`.
4. **Slot re-check and hold (D-042):** `holdSlot(slotId, cartId, 15)` (the hold may expire while the shopper is still paying; the booking is confirmed on the confirmation page — accepted oversell risk, SO-12); `FULL` → clear slot on the cart and respond 409 `{ error:'SLOT_FULL', days }` (fresh `getSlotDays(cart)` (Q-05)).
5. Create the session → `{ sessionId, projectKey, region }`.

### Hosted page `app/[locale]/checkout/page.tsx`
Server: no cart in session → `redirect` to `/cart` (outside try/catch). Renders frame: kicker "Checkout", H1 "Checkout", compact summary `Card` (lines, subtotal, delivery + slot, total with `ProvisionalNotice` when flagged — server fetches the cart) and `<CheckoutFlow/>`.
`components/checkout/CheckoutFlow.tsx` **(client)**: uses the hook `hooks/useCheckoutSession.ts` (never `fetch` directly): on mount it calls `POST /api/checkout/session`; on error → `router.replace('/cart?checkoutError=<code>')`; success → `checkoutFlow({ projectKey, region, sessionId, locale, … })` from `@commercetools/checkout-browser-sdk` into an inline container `<div data-ctc />` (header/leave button hidden by the SDK in inline mode). **V-01 spike** determines the exact SDK callbacks/events for "order created" and the order id; wrap them in `lib/checkout-events.ts` (`parseCheckoutEvent(msg): { type:'order-created'; orderId: string } | { type:'other' }`), unit-tested against sample payloads copied from docs.
On `order-created` → `POST /api/checkout/complete { orderId }`.

### `POST /api/checkout/complete`
Loads the order by id; verifies `order.cart.id === session.cartId` (else 403); sets session `lastOrderId = orderId`, **removes `cartId`**; best-effort `confirmBooking(slotId from order custom fields, orderId)` (idempotent; failure is logged, not fatal); returns `{ orderId }`. Client then `mutate(KEY_CART, null)`, `mutate(KEY_ORDERS)`, and `router.replace('/checkout/confirmation/<orderId>')`.

### Cart page changes (J)
`Checkout` button enabled iff `canCheckout(cart)` (Q-08); click → `router.push('/checkout')`. Show `?checkoutError` messages: `SLOT_FULL` ("That delivery slot just filled — pick another"), `UNAVAILABLE_LINES` (inline notice on those lines), `NO_ADDRESS`, `NO_SLOT`, generic.

### Confirmation page `app/[locale]/checkout/confirmation/[orderId]/page.tsx` (Server)
`getOrderById(orderId)`; allowed only if `order.customerId === session.customerId` **or** `session.lastOrderId === orderId` (guest) else `notFound()`. Content: green-sage `Blob` check (96 px), kicker "Order <number>", H1 "Thank you, {firstName}", slot summary, `ProvisionalNotice` when applicable, buttons "Track this order" (→ `/account/orders/<id>`; for guests the button is omitted and text shows the number) and "Back to the shop". `Cache-Control: private, no-store`.

### Merchant Center side (owner, OA-05)
Checkout application (Complete mode) branding (logo, colors from tokens: accent #c67139, bg #f5ead8, font Figtree), Adyen test connector, allowed origins. Reported as manual test M-V-1.

## Tasks
- [x] V-01 **Spike (docs):** using `/commercetools:commercetools-checkout` and the Browser SDK docs, find the `checkoutFlow` options for inline mode and the exact event/callback delivering "order created" + order id; write sample payloads and findings into `PROJECT-FINDINGS.md` §13; implement `lib/checkout-events.ts` + tests on those payloads.
- [x] V-02 Write `lib/ct/checkout-session.ts` + tests (mock `fetch`): token request body/headers; sessions request body incl. `metadata.applicationKey`; region derived; non-2xx → `CheckoutSessionError`; never logs the token.
- [x] V-03 Write `POST /api/checkout/session` + tests for each check in order (NO_CART, EMPTY_CART, UNAVAILABLE_LINES, NO_ADDRESS, NO_SLOT, SLOT_FULL clears slot and returns days, success returns ids; hold called before create; session not created on any failure).
- [x] V-04 Write `POST /api/checkout/complete` + tests (cart mismatch 403; sets `lastOrderId`, clears `cartId`; booking confirm failure tolerated; idempotent second call).
- [x] V-05 Write the checkout page + `CheckoutFlow` + tests (mock SDK): session requested once; SDK called with expected options and `locale`; error code redirects to cart with `checkoutError`; `order-created` event triggers complete and navigation; redirect to cart when no session cart.
- [x] V-06 Enable the cart Checkout button via `canCheckout`; render checkout error banners/notices + tests (each code shows its message; `UNAVAILABLE_LINES` marks lines).
- [ ] V-07 Write the confirmation page + tests (customer order allowed; guest via `lastOrderId` allowed; other order → `notFound`; provisional notice; guest has no Track button).
- [ ] V-08 Messages (both locales); add `lastOrderId` to `Session` (E) with test; report manual tests M-V-1…M-V-6 and sign-off SO-03.
- [ ] V-09 End-to-end smoke by the owner (M-V-2…M-V-6) — developer prepares exact steps and expected results; record outcomes only after the owner reports.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Ready cart / Missing slot / Guest | V-03, V-06 |
| Empty session cart | V-05 |
| Slot filled (handoff) | V-03, V-06 |
| Track order / Unknown order id | V-07 |
| No cart (400) | V-03 |
| Successful payment (cart cleared, order by id) | V-04, V-07 |
| Slot confirmation | V-04 |

## Manual tests to report (owner; needs OA-05)
- M-V-1: Merchant Center: Checkout application branding applied; Adyen connector in test mode.
- M-V-2: Cart with address + slot → "Checkout": hosted flow opens inline between our header/footer.
- M-V-3: Pay with an Adyen test card: confirmation page shows order number, slot, thank-you name; bag is empty afterward.
- M-V-4: Guest flow (signed out): same, no Track button.
- M-V-5: Make the slot full before clicking Checkout (lower capacity or fill it): cart shows "slot just filled" and the hosted flow does not open.
- M-V-6: Weighed item in bag: provisional notice on checkout summary and confirmation.

## Definition of done
All guards tested; no order creation in our code; owner smoke test passed or logged as FAIL with notes; SO-03 requested.
