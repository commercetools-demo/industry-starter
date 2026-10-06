# W — Subscriptions (recurring orders)

**Specs:** `grocery-storefront-features` → `subscription-experience` (all); existing behavior `subscriptions-and-recurring-orders`
**Depends on:** F, J, L, O, R, V · **Unblocks:** — · **Decisions:** D-034 · **Owner prerequisites:** OA-05 (spike) · **Sign-off:** SO-05, Gate 3
**Skill refs:** `commercetools-storefront` `core/optional/recurring-prices.md`, `core/optional/recurring-orders.md`, `b2c/optional/recurring-*.md`. The Recurring Orders API is **beta**.

## Goal
Eligible products can be bought on a cadence; customers see and manage their recurring orders.

## Gate first: spike W-01 (risk R-1)
**Prerequisite: workstream V (hosted checkout) is done.** Before any UI: prove that a cart whose line has `recurrenceInfo` becomes a **Recurring Order** when completed through the hosted Checkout (Adyen test). If it does **not**, stop, write the result in `PROJECT-FINDINGS.md` §13, set `FEATURE_SUBSCRIPTIONS=false` as the default (selector hidden) and ask the owner (Gate 3).

## Design (after Gate 3 passes)
- Feature flag `lib/config/features.ts`: `subscriptionsEnabled = process.env.FEATURE_SUBSCRIPTIONS !== 'false'` (server-side; pass to client as prop, not `NEXT_PUBLIC`).
- **Cart line:** J's `POST /api/cart/line-items` already accepts `recurrencePolicyKey`; this workstream makes `lib/ct/cart.ts` build `recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key }, priceSelectionMode: 'Dynamic' }` (key-based resource identifier; verify shape in the cart OAS) — **only** when the product is `recurringEligible` and the policy key ∈ {`weekly`,`every-2-weeks`,`monthly`}; otherwise 400.
- `lib/ct/recurrence-policies.ts`: `getRecurrencePolicies(locale)` (`unstable_cache` 300 s) → `{ key, id, name }[]` localized.
- PDP `components/product/RecurrenceSelector.tsx` **(client)** (L's slot): `Segmented`/radios "One-time" (default) + policies; notice `subscription.priceNotice` ("The price of each repeat order follows the current price and may change.") shown for non-one-time choices; hidden when product not eligible or flag off; the choice is passed to `AddToBag`.
- Cart line badge `RecurrenceBadge` (J slot): "Repeats every 2 weeks" + the same notice.
- `lib/ct/recurring-orders.ts` (`server-only`): `getRecurringOrders(customerId)`, `getRecurringOrder(id, customerId)` (ownership), update functions — **verify the actual update action names via OAS `api-RecurringOrder-write` (W-02)**: expected capabilities: change schedule (policy), change line quantity, pause, resume, cancel (state transitions), skip next. Map to `RecurringOrderSummary = { id, state: 'Active'|'Paused'|'Canceled'|'Other', cadenceLabel, lines: {name, quantity}[], nextOrderAt?: string, lastOrderAt?: string }`.
- Routes (401 anonymous; `privateJson()`): `GET /api/account/recurring`, `PATCH /api/account/recurring/[id]` `{ action: 'set-cadence'|'set-quantity'|'pause'|'resume'|'cancel', policyKey?, lineId?, quantity? }`.
- Page `/account/subscriptions` (`(protected)`): list `Card`s: items, cadence, state `Tag`, next order date (`Intl.DateTimeFormat` by locale), actions Change cadence (dialog), Change quantity (inline stepper), Pause/Resume, Cancel (confirm dialog stating last order date); empty state + link to the shop. Changes state: "applies from the next order".

## Tasks
- [x] W-01 **Spike (needs OA-05, F done):** with a test cart containing a recurrence line, complete a hosted checkout in test mode and check whether a Recurring Order exists (Merchant Center/API). Record result + steps in `PROJECT-FINDINGS.md` §13 and the TODO file (M-W-1). **Stop for Gate 3.**
- [x] W-02 Verify OAS names for `recurrenceInfo` draft and RecurringOrder update actions; record in findings; adjust design.
- [x] W-03 Write `lib/config/features.ts` + `lib/ct/recurrence-policies.ts` + tests (flag parsing; policies localized; cached 300 s).
- [x] W-04 Extend `addLineItem` for `recurrenceInfo` + route validation + tests (eligible product + valid key → request contains Dynamic; ineligible → 400; unknown key → 400; one-time → no recurrenceInfo).
- [x] W-05 Write `RecurrenceSelector` + `RecurrenceBadge` + tests (hidden when ineligible or flag off; notice visible for cadence; selection passed to add).
- [x] W-06 Write `lib/ct/recurring-orders.ts` + tests (ownership; mapping; each action maps to the right update call; cancel returns last order date).
- [x] W-07 Write the recurring routes + tests (401; 404 not owner; 400 invalid action; success returns the refreshed summary).
- [x] W-08 Write the subscriptions page + dialogs + hook `useRecurring` (`KEY_RECURRING`) + tests (next order date shown; change cadence updates same order; cancel dialog shows last-order date; empty state).
- [x] W-09 Messages (both locales); report manual tests M-W-1…M-W-5 and sign-off SO-05.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Subscribe / Ineligible product | W-04, W-05 |
| Notice shown | W-05 |
| Active recurring order | W-08 |
| Change cadence / Cancel | W-06, W-08 |
| Spike fails (flag off) | W-03 |

## Manual tests to report
- M-W-1 (OA-05): `cd site && npx tsx scripts/seed/create-qa-recurring.ts --policy every-2-weeks` (needs `.env.seed`). Expected: it prints a `recurring:` line (state Active, schedule 2 Weeks, a `nextOrderAt` date two weeks ahead); if it prints `NO Recurring Order was created`, spike W-01 failed: set `FEATURE_SUBSCRIPTIONS=false` as the default and ask the owner (Gate 3). The developer ran the same flow live with the storefront client and it passed (PROJECT-FINDINGS §19); the open part is the hosted-Checkout hand-off, covered by M-W-3. Delete the data with `npx tsx scripts/seed/cleanup-qa.ts`.
- M-W-2: `npm run dev -- --port 3010`, open `http://localhost:3010/en-US/shop`, open "Whole milk 1 L" (eligible). Expected: above the quantity stepper a "Repeat" group with "One-time" (selected), "Every week", "Every 2 weeks", "Every month"; choosing "Every 2 weeks" shows "The price of each repeat order follows the current price and may change." and choosing "One-time" hides it. Open "Bananas" (not eligible): no "Repeat" group. Switch to `/de-DE`: labels "Wiederholen", "Einmalig", "Alle 2 Wochen". With `FEATURE_SUBSCRIPTIONS=false` in `site/.env.local` (restart): the milk page has no group either, `/en-US/account` shows no "Subscriptions" row and `/en-US/account/subscriptions` is a 404.
- M-W-3: On the milk page choose "Every 2 weeks", press Add to bag, open `/en-US/cart`. Expected: the line shows a tag "Repeats every 2 weeks" and the price notice; adding milk again as "One-time" creates a second, separate line without the tag. Then do the V checkout (see M-V-2 and M-V-3) signed in as a `qa-*@example.com` customer. Expected: Merchant Center, Orders, Recurring orders lists one Recurring Order (Active, every 2 weeks, customer = that customer, next order in two weeks) and `/en-US/account/subscriptions` (signed in as that customer) shows it.
- M-W-4: `cd site && npx tsx scripts/seed/create-qa-recurring.ts`, sign in with the printed e-mail and password at `/en-US/account/sign-in`, open `/en-US/account/subscriptions` (also via "Subscriptions" in the Details card). Expected: one card "Every 2 weeks", tag Active, "Whole milk 1 L" with a stepper at 1, "Next order: <date two weeks from today>", "Last order: <today>". Press "Change cadence", choose "Every month", Save: the dialog closes, the same card (no second card) shows "Every month" and a next date one month from today. Press "+" on the stepper: 2. Press "Pause": tag Paused, "Paused: no upcoming order"; press "Resume": tag Active and a next order date in the future (not today). Merchant Center shows the same recurring order id each time and no extra order was created.
- M-W-5: On the same card press "Cancel subscription". Expected: a dialog "Cancel this subscription?" with "No further orders will be created. Your last order was on <today's date>."; "Keep subscription" closes it without a change. Confirm: the card shows tag Canceled, "Canceled: no more orders", "Last order: <date>" and no actions; Merchant Center shows the recurring order Canceled. Delete the QA data with `npx tsx scripts/seed/cleanup-qa.ts` (it cancels and deletes the recurring order first).
- SO-05 is the owner's sign-off of the selector, the price notice (product page and bag) and the subscriptions page after M-W-2 to M-W-5 (it is listed in the TODO file, section 2).

## Definition of done
Gate 3 decision recorded; behavior behind the flag; `verify` passes; SO-05 requested.

## Implementation notes (deviations, recorded by the developer)
- Findings are in `PROJECT-FINDINGS.md` §19 (the plan said §13, taken). W-01 was **not** proven in a browser or with a live order: the docs say "Create Order from Cart" creates the Recurring Order by itself and the API is available in the project; `scripts/seed/create-qa-recurring.ts` is the live check (M-W-1) and also creates browser-test data. See Q-W-1. Work continued behind the flag instead of stopping (rule: never block on the owner).
- W-02 (OAS names, checked with the SDK types and docs; the knowledge MCP has `api-RecurringOrder` but not a `-write` schema): a Recurring Order has **no line items** (they are on `cart`, the recurring cart; expand `cart`). Pause/resume/cancel are all `setRecurringOrderState` (`{type:'paused'|'active'|'canceled'}`), the schedule is `setSchedule` (`recurrencePolicy` resource identifier), skip next is `setOrderSkipConfiguration` (`Counter`), and a quantity change is `changeLineItemQuantity` on the recurring cart. Design adjusted accordingly in W-06.
- **Gate 3 / flag:** the spike passed live at API level (PROJECT-FINDINGS §19), so `FEATURE_SUBSCRIPTIONS` stays default on. `subscriptionsEnabled()` is a **function** (reads `process.env` at call time, testable), not a constant. When the flag is off: the PDP page passes no policies (no selector), the add-line route refuses a recurrence key (400 `INVALID_RECURRENCE`), `GET/PATCH /api/account/recurring*` answer 404 before the session is read, `/account/subscriptions` is `notFound()` and `DetailsCard` drops the Subscriptions row. `lib/config/features.ts` also holds `RECURRENCE_POLICY_KEYS` / `isRecurrencePolicyKey`.
- **PDP wiring:** `RecurrenceSelector` got extra props (`policies`, `value`, `onChange`; the slot signature `{ product, variant }` still works and renders nothing without policies). The page loads the localized policies only for eligible products with the flag on and passes them as `recurrencePolicies` through `BuyBox` to `AddToBag` (optional prop, additive), which sends `recurrencePolicyKey` via `addItemWithToast(sku, qty, { recurrencePolicyKey })`. A failing policy read hides the selector, not the page.
- **Add route:** ineligible product 400 `NOT_RECURRING_ELIGIBLE`, unknown key or flag off 400 `INVALID_RECURRENCE`; `null`, `''` or a missing key is one-time. `lib/ct/cart.ts` `addLineItem` already built `recurrenceInfo` (J), so it was not changed.
- **Badge:** `RecurrenceBadge` uses the message `subscription.badge.<policyKey>` (weekly, every-2-weeks, monthly; otherwise "Repeats on a schedule") plus the price notice.
- **Data layer** (`lib/ct/recurring-orders.ts`, `lib/mappers/recurring-order.ts`): summary extended with `stateRaw`, `policyKey`, and `lines[]` `{ id, sku, name, quantity, image? }`. `cadenceLabel` is the localized name of the policy on the recurring cart's lines (expanded), else the schedule. `lastOrderAt` is the last scheduled order, else the date of the original order (the API leaves `lastOrderAt` empty until a scheduled order exists). Resume passes `resumesAt` = next scheduled date (`lib/recurrence-schedule.ts` `nextOccurrence`), because a plain resume would order immediately (live finding). Wrong-state actions throw `RecurringOrderStateError` (409 `INVALID_STATE`); one retry on a version conflict.
- **Routes:** `GET /api/account/recurring` answers `{ recurringOrders, policies }` (policies = the switchable cadences); `PATCH /api/account/recurring/[id]` answers `{ recurringOrder }` (the refreshed summary). "Skip next" from the plan's expected capabilities has no route or button (IDEAS).
- **Page:** messages are under `subscription.manage.*` (and `subscription.*`), not `account.*`; dates via `formatDate` (UTC). The cadence dialog is keyed by order id so its initial choice is the current policy.
- **Test helpers:** `test/recurring.ts` (`recurringOrder`, `recurringCart`, `summary`). `scripts/seed/create-qa-recurring.ts` (+ `cleanup-qa.ts` now cancels and deletes Recurring Orders first) creates a QA customer with a live subscription for browser tests.
- Questions: Q-W-1 (hosted-Checkout hand-off), Q-W-2 (guests), Q-W-3 (slot/stock/substitution for repeat orders). SO-05 is the owner's.
