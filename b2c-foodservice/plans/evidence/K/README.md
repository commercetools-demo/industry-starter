# Evidence, workstream K (checkout and confirmation)

No live commercetools project, Checkout Application or Stripe connector exists (OA-01, OA-04, OA-K-a), and the Chrome DevTools MCP was held by another session, so there are no screenshots. What was run:

- `mock-flow.mjs` and its output `mock-flow-output.txt`: the checkout API driven end to end against the local mock server (`scripts/mock-ct-server.mjs`, now with orders and the Sessions API) and the real dev server. It adds a delivery line and a collect line, shows the pickup-name validation (422), prepares two payments (collect first, then delivery) as two clone carts, shows a stale total refused (`totals_changed`), creates both sessions, simulates the hosted Checkout finishing each payment (`POST /__mock/place-order`), finalises them through `POST /api/checkout/complete` (the first leaves the bag with the delivery line only, the second empties it and sets the guest email cookie), follows `/checkout/return`, reads both linked orders back (state `ordered` set once) and renders the confirmation page ("Order confirmed", pickup name, tracker) and "No recent order".
- `spike/README.md`: the K-01 spike (documentation only; script written, not run).
- Unit tests named after the scenarios (`npm run check`); `npm run build` passes (checkout, confirmation, orders and return routes are dynamic).

Not proved (owner or later): the hosted Checkout itself (S6 to S8, S11 to S15), the Stripe test card, a real phone, 3-D Secure, visual fidelity at 375 and 1440 px (M-K-07, SO-K-b).
