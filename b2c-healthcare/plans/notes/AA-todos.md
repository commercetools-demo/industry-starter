# Follow-up AA: live checks and the Checkout Application the owner must configure

No commercetools or Checkout credentials were available: everything below is unrun. Unit tests use fakes (`test/fake-shop.ts`, `test/checkout-flow.ts` plays "Checkout creates the order"); the browser path was run with `MALVA_FIXTURES=1` (`npm run e2e`, PORT=3121).

This file REPLACES the OA-04 details of `LIVE-TODOS.md` (OA-04 and Phase E, LT-63 to LT-76): the Application is now **Complete Checkout**, not Payment Only.

## A. Merchant Center: the Checkout Application (replaces OA-04)

Merchant Center > Checkout > Applications > Create application, project `spec-test-b2c-healthcare`:

| Setting | Value |
| --- | --- |
| Application type | **Complete Checkout** (not Payment Only: only this mode creates the order) |
| Application name / key | `Malva storefront` / a key of your choice (2-256 of `A-Z a-z 0-9 _ -`); put the key in `CTP_CHECKOUT_APP_KEY` |
| Countries | United States |
| Origin URLs | the production origin (`SITE_URL`) and `http://localhost:3000` for development. Do **not** use "Allow all origins" in production |
| Payment return URL | `<SITE_URL>/en-US/order` (Checkout appends `?orderId=<id>` after a redirect-based payment; that page forwards to `/en-US/order/<id>`) |
| Discount code function | **off** (the cart gate compared the total the buyer saw; a code typed inside Checkout would move it) |
| User agreements | optional; add the pharmacy terms if the owner wants a mandatory checkbox |
| Payment integrations | the **Stripe connector (sandbox)**: card as a web component or drop-in; **enable stored payment methods** (saved cards) for workstream T. Stripe keys stay in the Merchant Center, never in this repo |
| Skipping Checkout's own steps | if the Application offers "skip default pages" for address and shipping method (docs: *Extend the Checkout functionality > Skip default Checkout pages*), skip both: our cards already set them on the cart. If it cannot be skipped, leave the steps on; the buyer confirms the same data (AA-L2) |
| Order number | leave default: `finalizeOrder` sets `MLV-` after creation (do not configure a number generator) |

API client scopes (the Frontend client of OA-02; see `.env.example`): `manage_sessions`, `manage_checkout_payment_intents` (cancel / refund through Checkout), `manage_orders`, `manage_payments` (tender Payments), `manage_key_value_documents`, plus the payment-method scopes of T. No Stripe or PSP key in `.env`.

Optional safety net: a Subscription on `OrderCreated` delivered to a small Connect event app (or queue consumer) that POSTs the message to `POST <SITE_URL>/api/internal/order-created` with header `x-order-secret: <ORDER_FINALIZE_SECRET>` (16+ characters, same value in Netlify). Without it the order page and the order list finalize lazily.

## B. Live checks (in order)

AA-L1. **Application mode and order creation.** After a test payment the order exists with no `orderNumber` and no state (Checkout did not set them), then the browser callback gives it `MLV-000001` and `mlv-received`. Check `transitionState` to `mlv-received` with `force: true` is accepted on an order that has no state. Record the answer in `PROJECT-FINDINGS.md`.

AA-L2. **Address and shipping inside Checkout.** With the address and the delivery method on the cart (our cards), does `checkoutFlow` skip or prefill its address / shipping steps? If it shows them, do they take our choice, and does a change made there (a different method) leave the cart consistent with what `prepare` validated? If Checkout changes the cart, the total can differ from `expectedTotal`: record and decide whether to delete our two cards instead.

AA-L3. **SDK messages.** In the browser: `checkout_completed` carries `payload.order.id`; `payment_started`, `payment_cancelled` and the error `payment_failed` exist with those names (carried over from Q, unverified). A redirect-based payment method ends on `/en-US/order?orderId=<id>`.

AA-L4. **Tender Payments already on the cart.** With the allowance (or health-account) Payment attached and the session created for the remainder: does Checkout collect only the card remainder? Check the card Payment's `Authorization` amount equals `cardDue` (cart total minus the tender Payments). If Checkout charges the full total, the order is refused by `finalizeOrder` as `FUNDING_CHANGED` and the card is given back (this is the safeguard working); then decide per AA-questions 6 (gift-card connector, or no allowance on card orders).

AA-L5. **Exactly once.** Pay with `4242 4242 4242 4242` and watch three callers race: the browser callback, a quick reload of `/en-US/order/<id>`, and (if wired) the subscription route. Expected: one `MLV-` number, `refillsLeft` reduced once, `consumedBy` lists the order id once, the allowance drawn once, `malva-order-attempt/fin-<orderId>` is `done`. Close the tab right after paying (before the redirect): opening `/en-US/account/orders` later still shows the order numbered.

AA-L6. **Declined and abandoned.** `4000 0000 0000 0002`: Checkout's own message, no order, the cart stays, nothing consumed; "Continue to payment" can be pressed again (a new session). A buyer who changes the delivery method after the form opened: the prepared session is dropped and the button comes back.

AA-L7. **Cancel (S).** Before packing, card authorized only: cancel the order -> `mlv-cancelled`, the refill and allowance restored, the Payment shows a `CancelAuthorization` transaction (Stripe: PaymentIntent canceled) and the order page says **"Payment released"**. Confirm the Payment Intents `cancelPayment` request body `{"actions":[{"action":"cancelPayment"}]}` is accepted. Capture the payment in Stripe (or `capturePayment`), then cancel another order: `refundPayment` is accepted, a `Refund` transaction appears (Initial/Pending), the page says "Refund requested" and, when the connector sets it to Success, "Refunded". Cancel again: no second request is made.

AA-L8. **Dispense refusal after payment.** Set the prescription's `refillsLeft` to 0 between the gate and the callback (Merchant Center custom object): the order is cancelled, the card payment is released, the page says the prescription can no longer be filled, the cart is kept.

AA-L9. **Allowance covers everything.** Sam with a 5000 allowance and a 1875 cart: "Place order" creates the order without opening Checkout (the storefront order creation), `MLV-` number and state set, balance drawn once; cancel restores it.

AA-L10. **Saved cards (T).** Tick "Save this card" inside the Checkout form; the card appears on `/en-US/account/payment-methods`; the next checkout lists it first. Auto-refill (T) still works with that method.

AA-L11. **Subscription route (optional).** POST a real `OrderCreated` message to `/api/internal/order-created`: 401 without or with a wrong secret, 503 without the env var, 200 with it; the order is finalized once; a second delivery answers `replay: true`.

AA-L12. **Scopes.** `manage_checkout_payment_intents`, `manage_sessions`, `manage_orders`, `manage_payments`, `manage_key_value_documents`.

## C. Manual (owner only)

M-Q-1 (real card entry in the Checkout form, Stripe sandbox) now runs against the full Checkout: steps 1 to 3 as in `notes/Q-todos.md` with the button "Continue to payment" (not "Place order"), the Checkout form opens inside the Payment card, Checkout shows its own pay button, and after success the page goes to `/en-US/order/<id>`. Steps 4 (declined) and 5 (double activation: Checkout's own button, one order) stand; step 6 ("Totals moved after authorization") no longer exists: the amount is compared before Checkout starts, and Checkout verifies it itself.
