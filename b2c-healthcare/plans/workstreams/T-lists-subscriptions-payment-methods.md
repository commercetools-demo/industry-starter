# Workstream T — Saved lists, auto-refill (recurring orders), saved payment methods

**Depends on:** K, N, J, Q, R, S
**Implements:** saved-lists, subscriptions-and-recurring-orders, payment-methods
**Skills:** commercetools-commerce-patterns, commercetools-storefront, commercetools-checkout

## Design
- **Saved lists ("My medicines")** (Q-066): commercetools **Shopping Lists** (`customer`, `key mlv-list-<id>`, `deleteDaysAfterLastModification` 360). A list line = medication SKU + custom `rxNumber`/`rxLineRef` reference (never sig). "Add all to cart" (one operation) adds every line whose RX is still dispensable (N rules), **names** lines it could not add, keeps the added ones; "No lists yet" empty state; "Line no longer purchasable" handled; list prices at view time come from catalog read (price per line via product projection, not a throwaway cart); price moved since save → show the delta. No sharing (B2C-excluded). Pages `/account/lists`, `/account/lists/[id]`; "Save to My medicines" button on the Rx result card (adds a hook into N-08).
- **Auto-refill = commercetools Recurring Orders** (Q-067): RecurrencePolicies seeded `mlv-monthly`, `mlv-quarterly` (StandardSchedule), price selection **Dynamic**. Enabling auto-refill on an order line/RX creates a Recurring Order from the original order/cart (needs a saved payment method). Each generated run is **gated by the prescription ledger**: a Subscription/Connect-less approach: since API Extensions are out of scope (D-028), runs are produced by a Netlify scheduled function `auto-refill-run` (cron) that for every active recurring order checks `checkAuthorization/ceiling` (N-01), and either lets the order be placed (calls the recurring order's order creation) or **skips and records the reason** (`malva-refill-log` custom object: `{recurringOrderId, runAt, outcome, reason}`) — and stops the recurring order when the authorization lapsed or is exhausted. Controls in `/account/auto-refill`: pause, resume, skip next, change schedule in place, cancel; "Catalog price moved" shows the new price on next run (Dynamic). Home page claim "auto-refills pausable anytime" is true once this ships (M reads `autoRefillEnabled`).
- **Payment methods** (Q-068): saved methods are **tokens held by the PSP** through Checkout's stored payment methods, listed only by descriptor (brand, last4, expiry) and default flag, in `/account/payment-methods`; set default (Checkout stored-payment API; clear the previous default explicitly — the spec's open question: verify live and record in PROJECT-FINDINGS), remove (default removal promotes/clears default, warns if an active auto-refill depends on it), "No methods saved" state. "Net terms / credit line" is B2C-excluded. Needs OA-04 stored-method support; if the sandbox cannot save methods, mark scenarios needing it as blocked in QUESTIONS (Q-T-n) rather than faking.

## Tasks
- [x] T-01 `lib/ct/shopping-lists.ts` (create, list, rename, add/remove line, delete) + mapper; tests [SKILL: commercetools-storefront] [SPEC: saved-lists]
- [x] T-02 `POST /api/lists/[id]/add-all-to-cart` using N validation; result `{ added[], notAdded[{name,reason}] }` with the cart updated for the added ones; tests for all-added, partial, none, empty list [SKILL: commercetools-commerce-patterns] [SPEC: saved-lists]
- [x] T-03 Lists UI (`/account/lists`, detail, "Save to My medicines" on `RxResultCard`, empty state, price-delta note); tests [SPEC: saved-lists]
- [x] T-04 Seed `mlv-monthly` and `mlv-quarterly` Recurrence Policies in `seed.ts`; `lib/ct/recurring.ts` (create from order, pause, resume, skip, change schedule, cancel) with tests mapping each scenario [SKILL: commercetools-commerce-patterns] [SPEC: subscriptions-and-recurring-orders]
- [ ] T-05 `netlify/functions/auto-refill-run.ts` scheduled handler + pure `decideRun(recurringOrder, rxState, ceilings)`; gate tests: lapses between runs → no order and reason recorded; exhausted stops the series [SKILL: commercetools-commerce-patterns] [SPEC: subscriptions-and-recurring-orders]
- [ ] T-06 `malva-refill-log` writer and UI "Last run: skipped — authorization expired" on `/account/auto-refill`; tests [SKILL: commercetools-platform] [SPEC: subscriptions-and-recurring-orders]
- [ ] T-07 Auto-refill UI (`/account/auto-refill`, enable from an order/RX line, pause/resume/skip/cancel/schedule change); `autoRefillEnabled` config flag turned on; tests [SPEC: subscriptions-and-recurring-orders]
- [ ] T-08 `lib/ct/payment-methods.ts` over Checkout stored methods (list descriptors only, set default with explicit clearing, remove); live-verify the default semantics and record in PROJECT-FINDINGS [SKILL: commercetools-checkout] [SPEC: payment-methods]
- [ ] T-09 Payment methods UI + "No methods saved", "Default method removed" warnings; test no PAN/token ever rendered or logged [SPEC: payment-methods]
- [ ] T-10 Checkout integration: allow saving a method during payment (checkbox) and paying with a saved one; manual test M-T-1 pre-registered [SKILL: commercetools-checkout] [SPEC: payment-methods]

## Scenarios
Every scenario is a unit test (or a scripted check) named after it.
<!-- SCENARIOS:BEGIN (generated by plans/verify-plan.mjs --sync) -->
#### saved-lists › Saved and requisition lists with bulk add to cart
- [ ] List converted in one operation
- [ ] Line no longer purchasable
- [ ] No lists yet
#### subscriptions-and-recurring-orders › Subscriptions and recurring orders
- [ ] Recurring order created
- [ ] Schedule changed in place
- [ ] Catalog price moved
- [ ] Paused or canceled
#### payment-methods › Saved payment methods and account payment terms
- [ ] Card tokenized then listed
- [ ] Default method removed
- [ ] No methods saved
<!-- SCENARIOS:END -->

## Browser recipe
Claude as Sam: save RX-77102 meds to a list, Add all → both in cart; make one line's RX exhausted (edit `malva-rx` via MC MCP) → Add all names it; enable auto-refill on a delivered order → MC MCP `read_recurring_orders` shows it Active with the policy; invoke the cron function locally (`npx netlify functions:invoke auto-refill-run`) → order placed, then with expired RX → skipped with reason shown in the UI; pause/resume reflected; payment methods page lists descriptors only (Stripe test card needs M-T-1).

## Manual tests (owner-only)
M-T-1 (save a card in the Stripe sandbox widget, set default, remove) — pre-registered; OA-04.

## Definition of done
JUNIOR-GUIDE §9.
