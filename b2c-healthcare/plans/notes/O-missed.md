# Workstream O: gaps and things other workstreams must pick up

- **Checkout (Q):** the cart is a customer cart with `shippingAddress { country }` only and `mlv-standard` preselected; Q must set the real address and the chosen method, call `consumeAuthorization` once at order creation (using `SelectedLine` limits), and clear the cart id from the session after the order (`clearCart`). Q should call `getCartValidated`-equivalent checks again before placing the order: the page flags unavailable lines but nothing server-side stops a direct `POST /orders` with a stale cart (no API Extension, D-028).
- **Total includes flagged lines:** the platform total still counts lines flagged unavailable (the BFF never removes them); the page says "N not included" and disables Checkout. Accepted simplification from the workstream file.
- **Monthly ceiling and the cart:** lines in the cart do not count towards the monthly ceiling (only dispensed orders do), so two carts or two orders in parallel can still exceed it (N-missed, race).
- **No discount codes, no minimum order, no quantity change:** the four scenarios are marked N/A in the workstream file with reasons.
- **Subtotal is summed on the server** from the platform's line totals (O-questions 3); the platform has no subtotal field.
- **Header count for a customer without `cartId` in the session** is read through `?view=summary`, which looks the cart up by `customerId` when the session has none.
- **Region switch** (G): a currency change clears `cartId` from the session but leaves the old cart Active in commercetools; the next read picks "the newest Active cart of the customer", which may be the old-currency cart. The region switcher UI (not built yet) should decide whether to delete or ignore it; the add route would add lines in the new currency to a cart of the old one. Not handled.
- **Fixture cart** is in memory per server process and has no refill/ledger effects; it checks layout and routes only.
- **Chrome DevTools MCP was unavailable:** no rendered check; component tests plus curl against `MALVA_FIXTURES=1`.
- `plans/verify-plan.mjs` reports `STATUS.md counts are stale` (not edited here by instruction).
