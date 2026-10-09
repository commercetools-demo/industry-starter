# Workstream Q: gaps and things other workstreams must pick up

- **Order page (S):** checkout redirects to `/order/<id>`; that route does not exist yet (S). The order carries `orderNumber`, state `mlv-received`, the shipping address and line records. `lib/ct/orders.ts` and `order-number.ts` are Q's; S adds `orders-read.ts`.
- **Cancelling (S):** `restoreAuthorization(orderId)` must be called when an order is cancelled before `mlv-packed-shipped`; the payment must be released too (`PaymentProvider.release` / Payment Intents `cancelPayment`). Use `getPaymentProvider()` from `lib/checkout/provider.ts`.
- **Cancelled-after-refusal orders:** when the prescription refuses at the last moment the order is cancelled but stays in commercetools (the cart is already Ordered). It carries `mlv-cancelled`; S's order list should hide or label it.
- **Attempt lock records:** `malva-order-attempt` entries (one per attempt) are never cleaned up. A retention job or a short TTL is not built.
- **Monthly ceiling race** remains (N-missed): two orders in parallel can both pass the count check.
- **Order number gaps:** a number taken for an order that then failed is not reused (documented, harmless).
- **Authorization lag:** the server reads the Payment right after the widget reports completion; if the PSP's authorization notification is slower, the answer is `PAYMENT_REQUIRED` ("Authorize your payment...") although the buyer paid. No polling or retry is built; the buyer can click Place order again (the widget would not charge twice for an authorized payment, to be confirmed live).
- **Address not saved to the address book** from checkout; a new address typed at checkout is only on the cart. A "Save to my address book" box is not built.
- **No billing address** (P-missed): Checkout payment-only collects what the PSP needs inside its component.
- **Same-day price shown on the card** is the matching rate of the method; the Delivery row of the summary is the cart's `shippingInfo`. They agree by construction but come from two reads.
- **Discount codes at checkout, gift cards, saved cards (T), payer cost share and tender (U)** are not part of this workstream.
- **Region switch (O-missed):** a cart left Active in another currency can still be picked as "newest Active cart"; checkout does not detect a currency different from the session's.
- **Chrome DevTools MCP was unavailable:** no rendered check; component tests plus curl against `MALVA_FIXTURES=1` (see below).
- **Fixture mode** writes no refills and the fixture order exists only in memory; the order page does not exist yet, so the redirect ends on a 404 page in a fixture run.
- `plans/verify-plan.mjs` may report `STATUS.md counts are stale` (not edited here by instruction).
