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
- [x] V-07 Write the confirmation page + tests (customer order allowed; guest via `lastOrderId` allowed; other order → `notFound`; provisional notice; guest has no Track button).
- [x] V-08 Messages (both locales); add `lastOrderId` to `Session` (E) with test; report manual tests M-V-1…M-V-6 and sign-off SO-03.
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
Common set-up for M-V-2…M-V-8: `cd site && npm run dev -- --port 3010` (needs `.env.local`), open `http://localhost:3010/en-US/shop`, add two items (for M-V-6 add a weighed item such as the 500 g bananas pack), open `/en-US/cart`, in "Delivery" save a US address (any name and street, postcode `10001`, city New York, country United States), pick any delivery slot, then press **Checkout**. Adyen test card (test mode, Adyen docs "Test card numbers"): Visa `4111 1111 4555 1142`, expiry `03/30`, CVC `737`, any holder name; 3-D Secure 2 challenge card Visa `4212 3456 7890 1237` (challenge password `password`); a holder name of `REFUSED` makes Adyen refuse the payment.
- M-V-1 (OA-05): Merchant Center, Checkout, Applications: the Complete Checkout application whose key is `CTP_CHECKOUT_APP_KEY` shows the MALVA branding (logo, accent `#c67139`, background `#f5ead8`, font Figtree), lists the Adyen connector in **test mode**, and has `http://localhost:3010`, `http://localhost:3000` and the Netlify URL as allowed origins / return URLs. Expected: all four present; note anything that is missing.
- M-V-2 (OA-05): With the set-up above press Checkout. Expected: the browser goes to `/en-US/checkout`; our header and footer stay; H1 "Checkout" with the kicker "Checkout"; on the right (or above on a phone) our summary card with the lines, delivery, slot and total; on the left the hosted checkout renders **inline** (no full-screen overlay, no "Leave checkout" header) with address, shipping method and payment steps; the hosted shipping list also shows the old 500.00 / 750.00 methods (known, D-049, `standard` is pre-selected on the cart: check it is the one offered first); DevTools Network: `POST /api/checkout/session` answered 200 with `sessionId`, `projectKey`, `region` and header `Cache-Control: private, no-store`, exactly once.
- M-V-3 (OA-05): Continue M-V-2 signed in (use a `qa-*@example.com` customer from `scripts/seed/create-qa-order.ts` or register one before filling the bag) and pay with the Visa test card. Expected: after the hosted success the page moves to `/en-US/checkout/confirmation/<orderId>` with the sage check, kicker "Order <number>", H1 "Thank you, <first name>", the delivery slot line, the total, the buttons "Track this order" (opens `/en-US/account/orders/<orderId>` with the same lines and slot) and "Back to the shop"; the header bag count is gone and `/en-US/cart` is empty; Merchant Center shows the order with the `cart-delivery` custom fields (slot) and a payment in state Authorized/Paid; `POST /api/checkout/complete` answered 200 once; reloading the confirmation page still works.
- M-V-4 (OA-05): Same as M-V-3 but signed out (private window, no account). Expected: the confirmation page opens with H1 "Thank you, <first name entered in the hosted address step>", **no** "Track this order" button, the text "Keep your order number for reference: <number>."; opening the same confirmation URL in another private window (no cookie) or after clearing cookies gives the "page not found" page.
- M-V-5 (OA-05): Slot becomes full before the handoff. In `site/lib/config/slots.ts` set `capacity` to `1`, restart the dev server. In window A pick slot S (e.g. tomorrow 10:00-12:00). Restart the dev server again (the in-memory holds are lost), then in a private window B build a bag, address (`10001`) and pick **the same slot S**. Back in window A press Checkout. Expected: A lands on `/en-US/cart?checkoutError=SLOT_FULL` with the banner "That delivery slot just filled. Please pick another one.", the slot is cleared from the bag (Delivery step asks for a slot again), no hosted checkout opened and no session in the Network tab beyond the failed `POST /api/checkout/session` (409 `SLOT_FULL` with `days`). Revert `capacity` afterwards.
- M-V-6 (OA-05): With a weighed item in the bag go through M-V-2 and M-V-3. Expected: the hosted checkout's own summary (our CheckoutSummary was removed from the checkout page on 2026-10-07) shows the total; the confirmation shows "Total (provisional): ..." and the same note; the order detail page also shows the provisional note.
- M-V-7 (OA-05): Declined payment. In the hosted payment step use the Visa test card with holder name `REFUSED`. Expected: the hosted checkout shows its own payment-failed page and lets you retry; you stay on `/en-US/checkout`; no order exists in Merchant Center; the bag is still full; paying again with a good card then works as M-V-3.
- M-V-8 (OA-05): Out-of-stock handoff. With a bag, address and slot ready (Checkout enabled), open Merchant Center, Inventory, and lower the available quantity of one SKU in the bag below its bag quantity (the cart page still shows it as available until it reloads), then press Checkout. Expected: `/en-US/cart?checkoutError=UNAVAILABLE_LINES` with the banner "Some items are no longer available in the quantity you chose. Please update your bag." and, under that item, "Only N available right now."; restore the inventory afterwards.

## Definition of done
All guards tested; no order creation in our code; owner smoke test passed or logged as FAIL with notes; SO-03 requested.

## Implementation notes (deviations, recorded by the developer)
- **Findings** are in `PROJECT-FINDINGS.md` §18 (the plan said §13, which was taken). Session creation was verified live once (201, `activeCart`, `state: ACTIVE`, `expiryAt`); the SDK in the browser and a card payment were **not** run by the developer (M-V-2…M-V-8 are the owner's).
- "Order created" arrives as `onInfo` with `code: 'checkout_completed'` (and also `order_created`), `payload.order.id`. `parseCheckoutEvent` accepts both; `CheckoutFlow` hands the order over once. `skipPaymentSuccessPage: true` is set because we navigate to our own confirmation page.
- `locale` for the SDK: the SDK knows `en-US` and `de` but not `de-DE`, so `sdkLocale` maps `de-*` to `de`.
- `lib/ct/checkout-session.ts` returns `{ sessionId, projectKey, region }` (the route returns it as is). Errors are `CheckoutSessionError` with `code` `TOKEN_FAILED | SESSION_FAILED` and the HTTP status, no bodies, no token in the message.
- `POST /api/checkout/session` also calls Q's `ensureShippingMethod(cartId)` before the hold (no-op when `standard` is already set) so that the hosted flow starts from `standard`; a cart where it does not apply answers 422 `SHIPPING_UNAVAILABLE` (extra code, shown as a message on the cart page). The hold TTL comes from `SLOT_CONFIG.holdMinutes` (15). An expired hold is simply renewed here (the check needs only `slotId` on the cart). A slot that is full **or no longer bookable** clears the slot and answers 409 `SLOT_FULL` with fresh `days`. A Sessions API failure answers 500 `CHECKOUT_ERROR` and keeps the hold.
- `POST /api/checkout/complete` (`lib/ct/orders.ts` gained `getOrderRef(id)` returning `{ id, cartId?, customerId?, slotId? }` from the raw order): 400 `INVALID_ORDER` / `NO_CART`, 404 `ORDER_NOT_FOUND`, 403 `FORBIDDEN` for a cart mismatch. A second call for the same order (session has `lastOrderId` and no `cartId`) answers `{ orderId }` without work. Session has the new field `lastOrderId`; **logout also clears it** (small additive change in `app/api/auth/logout/route.ts` and its test).
- Both checkout routes live outside `/api/account`, so they do not use `privateJson`; they set `Cache-Control: private, no-store` themselves. `next.config.ts` got `headers()` for `/:locale/checkout/:path*` (`private, no-store`, test in `next.config.test.ts`), which covers the checkout and confirmation pages.
- Hook `hooks/useCheckoutSession.ts`: `start()` and `complete(orderId)` never throw (`{ ok, ... error }`); a failed `start` revalidates `KEY_CART` (the server may have cleared the slot); `complete` writes `null` into `KEY_CART` and revalidates `KEY_ORDERS`. If `complete` fails the checkout page shows a retry button (the payment already went through).
- Cart page: `CartView({ checkoutError })` (the page passes `searchParams.checkoutError`), `useRouter().push('/checkout')` as `onCheckout`, banner `data-testid="checkout-error"` from `checkout.error.<code>` (unknown codes and `NETWORK` use `generic`). `UNAVAILABLE_LINES` marks lines whose `availableQuantity < quantity` with "Only N available right now." (`CartLineRow` got an optional `short` prop). The existing `CartView.test.tsx` got a router mock (additive) because `CartView` now uses the router.
- Confirmation page: access is `order.customerId === session.customerId` (owner, may track) **or** `session.lastOrderId === orderId` (guest); anything else is `notFound()`. The first name is the session customer's, else the first name of the order's shipping address (entered in the hosted checkout), else "Thank you". `components/checkout/{CheckoutFlow,OrderConfirmation}.tsx` (CheckoutSummary removed 2026-10-07: the hosted checkout shows its own summary; hosted styles come from `lib/checkout-styles.ts`); the confirmation is a client component only because it reuses `dayLabel`/`windowLabel` from `SlotPicker`.
- Messages: the whole `checkout` namespace (was `{}`) in both locales, German machine-translated (IDEAS).
- Open points: Q-V-1 (hand-off needs the browser), Q-V-2 (hosted shipping list shows the old methods). SO-03 awaits the owner after M-V-2.
