# Workstream L report (recurring pricing core and checkout spike)

Branch `ws/l-recurring-pricing-core`. Live work ran against `spec-test-b2c-telecom` only (storefront client for the spike and the sweep, seed client for `seed:discounts`).

## Done
L-01 … L-08, L-10, L-11, L-12, L-13 (ticked). L-06 and L-07 are one module and one commit (`lib/pricing/schedule.ts`, commit message names both). `npm run verify` passes (718 tests). `node plan/verify-plan.mjs`: 0 uncovered scenarios; its only error is the STATUS count (orchestrator runs `--sync`).

## Not done / blocked
- **L-09 (run the spike and record the result): NOT ticked.** The spike was run live four times with `--skip-checkout` because OA-05 is not done (no `CTP_CHECKOUT_APP_KEY`). Result block is in `plan/PROJECT-FINDINGS.md` (`SPIKE-L`): **`PENDING (OA-05)`, best guess A**. P4 (Checkout session) and P5 (Checkout application) are `BLOCKED`. Everything else passed. What remains after OA-05: `cd site && npm run spike:recurring-checkout` (no flag), confirm P4/P5, read the block, tick L-09, owner replies `APPROVED` (M-L-2, Gate 2). If P4 fails with a recurring/mixed message the script picks F3 by itself.
- **M-L-1 / M-L-2** need OA-05 (owner).
- Chrome checks C-L-4 needs the final run (block is present, no secrets).

## Questions for the owner
1. **Intro price vs G's `malva-cd-intro-free-month`.** Cable 100 and Air 5G match G's predicate `intro-free-months > 0`, so both discounts stack: line total 0 on the first charge (P10), also in the platform-created recurring cart. Keep "first month free" in addition to the L intro price, or drop one? (Hosted Checkout may refuse a 0 payable-now cart.)
2. **`recurringOrderScope AnyOrder` on the intro discounts** (as the plan says) makes the intro price apply on every generated order while the discount is active. P10 shows the recurring cart carries even a `NonRecurringOrdersOnly` discount, so no scope value gives "first order only". The stored schedule is the promise; confirm that is acceptable for v1.
3. **Cancellation window boundary**: `resolveEarlyCancellation` treats "before the service-start date" strictly (`cancelledOn < serviceStartDate`), so lines with lead time 0 never have an open window. V owns the real rule; say if it should be inclusive.
4. The planned messages live in a new top-level namespace `pricing` (the plan's `pricing.mode.*`); I added `pricing` to the exact-namespace list in `messages/parity.test.ts`.

## Missed features and deviations
- **P3 runs without OA-05** (it is a plain cart update); the plan said BLOCKED. `decide` still returns `PENDING (OA-05)` because P4 is blocked.
- Plan assumed the recurring payment fields are not in the OAS; they are, and live (see Findings). Spike probes added: P3b (allocation, emulating Checkout with a throwaway `PaymentMethod`) and P6b (baseline order with no configuration). `decide` ignores P3b/P6b. Because a strategy without an allocation blocks the order, P6 needs P3b first.
- `ApiError` codes are a closed set (E): L reasons (`RECURRENCE_POLICY_MISSING` INTERNAL, `RECURRING_PRICE_MISSING` VALIDATION, `RECURRING_ORDER_BUSY` CONFLICT) are in `details.reason`; constants `RECURRING_REASON` in `lib/ct/recurring.ts`.
- `setRecurringOrderState(id, state, reason?, ctx?)` has an optional 4th `ctx` (mapping needs the locale); `MapContext` is defined in `lib/mappers/recurringOrder.ts`.
- `buildSchedule(input, today?)`: `today` is only used to reject an order date in the future (BAD_DATE).
- Extra exports: `markAmended` (old version after `amendFrom`), `INSTALL_LEAD_DAYS_CABLE` in `lib/config/pricing.ts`. Amend keeps an intro period whole (a promise); `supersedes` = previous `amendedOn` or the order date.
- Open-ended periods use `endsOn '9999-12-31'`; G's seeded demo schedules use `orderDate + 1200 months`. `parseSchedules` accepts both (verified live by the sweep: 4 schedules read, including G's).
- Sweep: orders filter is `orderState in ("Open","Confirmed")` (G's demo orders are `Confirmed`; the plan said `Open`).
- Intro discount sort orders are `0.71`, `0.72` (sortOrder must be unique; `0.2` is taken by G's bundle discount).
- `seed:discounts` needs `--confirm-project spec-test-b2c-telecom` (F's framework rule) and reuses F's `cartDiscountReconciler`; it reads the offers' projections with the admin client. Exports `applyDiscounts(api, drafts)` for M.
- `http.ts` of the spike uses raw `fetch` (allowed for `scripts/**`).
- `vitest.config.ts` already includes `scripts/**`; not changed.

## TODOs for other workstreams
- **U (critical):** never set `paymentStrategy: Checkout` on the cart yourself without an allocation: the order is refused (`must contain at least one payment allocation`). Let the hosted Checkout add the allocation; `ensureRecurringPaymentStrategy` only acts on recurring carts after the order.
- **U / M:** one mixed cart orders fine (Method A) and yields ONE Recurring Order whose recurring cart holds only the recurring lines (Fixed and Dynamic together); one-time and Custom Line Items stay on the order only. Order needs a customer on the cart, a shipping address, inventory mode `None`, cart typed `malva-order` (as in the spike).
- **M:** call `assertRecurringPrice` after every `addLineItem` with `recurrenceInfo`; pass `introApplied` from the line's discounts (`discountKeyFor`); buyer copy keys `pricing.mode.fixed` (`{months}`), `pricing.mode.dynamic`, `pricing.intro.cancel.rule`.
- **V:** `cancelRecurringOrdersForOrder` returns `lastOrderAt` (undefined before the first generated order); `monthsRemaining`, `cancelSchedule`, `resolveEarlyCancellation` are ready.
- **S:** `getRecurringOrdersForCustomer(customerId, ctx)`; show `Failed` clearly (no retry on the platform).
- **Orchestrator:** run `node plan/verify-plan.mjs --sync`; the findings are already in `PROJECT-FINDINGS.md` (SPIKE-L block and "L - scopes and recurring-payment facts").

## Findings
All in `plan/PROJECT-FINDINGS.md`. Short form:
- Storefront scopes needed for L all exist (`manage_recurring_orders`, `view_recurring_orders`, `view_recurrence_policies`, `manage_payment_methods`, `manage_sessions` ...): no 403.
- `setRecurringPaymentStrategy {paymentStrategy:'Checkout'}` works on the initial cart (stored as `{paymentStrategy, paymentAllocations: []}`); `setRecurringPaymentConfiguration` needs `paymentAllocations`; allocation `id` must be a UUID; `addRecurringPaymentAllocation` with `{type:'Relative', percentage:100}` works; a `PaymentMethod` can be created via the API.
- Strategy without allocation blocks `POST /orders`; no configuration at all orders fine.
- The recurring cart inherits the strategy and accepts `recalculate`; the platform creates ONE recurring order for Fixed + Dynamic lines.
- Recurring cart carries the initial cart's discounts (see Question 1/2).
- Spike resources: all `spike-recurring-*` carts, orders, recurring orders, customers and payment methods are deleted (checked by listing; my own debug leftovers were removed too). The 3 demo orders and recurring orders of G are untouched.

## Manual tests added
M-L-1, M-L-2 (already in the workstream file; both need OA-05).

## Junior design choices
None (no UI). Technical: `scripts/spike/lib/http.ts` raw client; `redact()` strips bearer tokens and secret-looking env values from findings; amend keeps intro periods whole.

## Chrome checks ready
C-L-1 (read `malva-monthly`: standard, 1, Months, verified live), C-L-2 (2 intro discounts, active, no dates, SKU predicates `MLV-AIR-5G-12M`, `MLV-CBL-100-24M`), C-L-3, C-L-5 (no spike resources remain), C-L-6 (`npm run job:schedule-sweep -- --today=2028-03-07` prints the term-end of `MLV-DEMO-0001`, `0 writes`, exit 0; the "no schedules found" branch needs a project without orders, covered by the unit test). C-L-4 after the OA-05 re-run.
