# Workstream S: gaps and things other workstreams must pick up

- **Allowance and restricted funds (U):** `restoreAllowance` and `restoreRestricted` in `lib/ct/order-cancel-hooks.ts` are no-ops; U must fill them (idempotent, called with the order id, also on a retried cancel).
- **Capture and refund (Q-Q-1):** payments are authorization-only; no capture on `mlv-packed-shipped` exists. The refund is a marker (`Refund` transaction `Initial`) plus a void; moving it to `Success` is manual (Stripe sandbox / Merchant Center). An order that was cancelled after a capture would need a real refund call: not built.
- **No order-history pagination or filters:** the list is the newest 50 orders (`order-history` mentions filter and paging across the whole history). No "load more".
- **Shipment detail:** only `shipmentState` is shown. Deliveries, parcels, their items and tracking references (`Delivery`, `Parcel`, `TrackingData`) are not modeled or displayed; a carrier integration would write them.
- **Returns and the refund state of a return:** not accepted for dispensed medicines (pharmacy rule), so no `ReturnInfo` flow.
- **No printable receipt** (Q-044 default).
- **No confirmation email** (OrderCreated subscription): out of scope.
- **Cancelled-order notification:** nothing is sent to the buyer; the order page is the only place that says so.
- **Reorder in fixtures:** not available (the fixture order does not keep prescription line references).
- **Two cancel clicks in two tabs** are safe (ledger entry and Refund marker are idempotent), but the loser of a race may see "could not cancel" once; the page refresh shows the real state.
- **The overview tile and the list share a query shape but not code:** `countOrders` (R) and `listOrdersForCustomer` both filter on `customerId`; a change to the scoping rule must change both.
- **A cancelled-by-refusal order (Q-missed)** appears in the list as Cancelled with no refund row until a payment marker exists: Q's `cancelOrder` releases the payment but writes no `Refund` transaction.
- **`plans/verify-plan.mjs` may report `STATUS.md counts are stale`** (not edited here by instruction).
- **Chrome DevTools MCP was unavailable:** component tests plus curl against `MALVA_FIXTURES=1`.
