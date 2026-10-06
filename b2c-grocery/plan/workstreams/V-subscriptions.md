# V — Subscriptions (recurring orders)

**Specs:** `grocery-storefront-features` → `subscription-experience` (all); existing behavior `subscriptions-and-recurring-orders`
**Depends on:** F, J, L, O, R · **Unblocks:** — · **Decisions:** D-034 · **Owner prerequisites:** OA-05 (spike) · **Sign-off:** SO-05, Gate 3
**Skill refs:** `commercetools-storefront` `core/optional/recurring-prices.md`, `core/optional/recurring-orders.md`, `b2c/optional/recurring-*.md`. The Recurring Orders API is **beta**.

## Goal
Eligible products can be bought on a cadence; customers see and manage their recurring orders.

## Gate first: spike V-01 (risk R-1)
Before any UI: prove that a cart whose line has `recurrenceInfo` becomes a **Recurring Order** when completed through the hosted Checkout (Adyen test). If it does **not**, stop, write the result in `PROJECT-FINDINGS.md` §13, set `FEATURE_SUBSCRIPTIONS=false` as the default (selector hidden) and ask the owner (Gate 3).

## Design (after Gate 3 passes)
- Feature flag `lib/config/features.ts`: `subscriptionsEnabled = process.env.FEATURE_SUBSCRIPTIONS !== 'false'` (server-side; pass to client as prop, not `NEXT_PUBLIC`).
- **Cart line:** J's `POST /api/cart/line-items` already accepts `recurrencePolicyKey`; this workstream makes `lib/ct/cart.ts` build `recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key }, priceSelectionMode: 'Dynamic' }` (key-based resource identifier; verify shape in the cart OAS) — **only** when the product is `recurringEligible` and the policy key ∈ {`weekly`,`every-2-weeks`,`monthly`}; otherwise 400.
- `lib/ct/recurrence-policies.ts`: `getRecurrencePolicies(locale)` (`unstable_cache` 300 s) → `{ key, id, name }[]` localized.
- PDP `components/product/RecurrenceSelector.tsx` **(client)** (L's slot): `Segmented`/radios "One-time" (default) + policies; notice `subscription.priceNotice` ("The price of each repeat order follows the current price and may change.") shown for non-one-time choices; hidden when product not eligible or flag off; the choice is passed to `AddToBag`.
- Cart line badge `RecurrenceBadge` (J slot): "Repeats every 2 weeks" + the same notice.
- `lib/ct/recurring-orders.ts` (`server-only`): `getRecurringOrders(customerId)`, `getRecurringOrder(id, customerId)` (ownership), update functions — **verify the actual update action names via OAS `api-RecurringOrder-write` (V-02)**: expected capabilities: change schedule (policy), change line quantity, pause, resume, cancel (state transitions), skip next. Map to `RecurringOrderSummary = { id, state: 'Active'|'Paused'|'Canceled'|'Other', cadenceLabel, lines: {name, quantity}[], nextOrderAt?: string, lastOrderAt?: string }`.
- Routes (401 anonymous; `privateJson()`): `GET /api/account/recurring`, `PATCH /api/account/recurring/[id]` `{ action: 'set-cadence'|'set-quantity'|'pause'|'resume'|'cancel', policyKey?, lineId?, quantity? }`.
- Page `/account/subscriptions` (`(protected)`): list `Card`s: items, cadence, state `Tag`, next order date (`Intl.DateTimeFormat` by locale), actions Change cadence (dialog), Change quantity (inline stepper), Pause/Resume, Cancel (confirm dialog stating last order date); empty state + link to the shop. Changes state: "applies from the next order".

## Tasks
- [ ] V-01 **Spike (needs OA-05, F done):** with a test cart containing a recurrence line, complete a hosted checkout in test mode and check whether a Recurring Order exists (Merchant Center/API). Record result + steps in `PROJECT-FINDINGS.md` §13 and the TODO file (M-V-1). **Stop for Gate 3.**
- [ ] V-02 Verify OAS names for `recurrenceInfo` draft and RecurringOrder update actions; record in findings; adjust design.
- [ ] V-03 Write `lib/config/features.ts` + `lib/ct/recurrence-policies.ts` + tests (flag parsing; policies localized; cached 300 s).
- [ ] V-04 Extend `addLineItem` for `recurrenceInfo` + route validation + tests (eligible product + valid key → request contains Dynamic; ineligible → 400; unknown key → 400; one-time → no recurrenceInfo).
- [ ] V-05 Write `RecurrenceSelector` + `RecurrenceBadge` + tests (hidden when ineligible or flag off; notice visible for cadence; selection passed to add).
- [ ] V-06 Write `lib/ct/recurring-orders.ts` + tests (ownership; mapping; each action maps to the right update call; cancel returns last order date).
- [ ] V-07 Write the recurring routes + tests (401; 404 not owner; 400 invalid action; success returns the refreshed summary).
- [ ] V-08 Write the subscriptions page + dialogs + hook `useRecurring` (`KEY_RECURRING`) + tests (next order date shown; change cadence updates same order; cancel dialog shows last-order date; empty state).
- [ ] V-09 Messages (both locales); report manual tests M-V-1…M-V-5 and sign-off SO-05.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Subscribe / Ineligible product | V-04, V-05 |
| Notice shown | V-05 |
| Active recurring order | V-08 |
| Change cadence / Cancel | V-06, V-08 |
| Spike fails (flag off) | V-03 |

## Manual tests to report
- M-V-1 (OA-05): spike steps and result (see V-01).
- M-V-2: PDP of Whole milk shows the selector; Bananas (not eligible) does not.
- M-V-3: Subscribe "Every 2 weeks": cart line badge and notice; after checkout a Recurring Order exists.
- M-V-4: `/account/subscriptions`: change cadence, pause, resume — same recurring order id each time.
- M-V-5: Cancel: confirmation states the last order date.

## Definition of done
Gate 3 decision recorded; behavior behind the flag; `verify` passes; SO-05 requested.
