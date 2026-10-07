# L — Recurring pricing core: price modes, intro and phased schedules, subscriptions, checkout spike

**Specs:** `introductory-period-price` (all 6 scenarios), `term-phased-price-schedule` (all 6 scenarios), `subscriptions-and-recurring-orders` (all 4 scenarios; "Schedule changed in place" is excluded by D-040)
**Depends on:** E, G, H · **Unblocks:** M, Q, S, U · **Decisions:** D-004, D-012, D-013, D-019, D-021, D-023, D-040, D-041, D-054, D-059
**Owner prerequisites:** OA-05 (spike probes P3 and P4 only; everything else in L needs only OA-02) · **Skill refs:** `commercetools-commerce-patterns` (recurring orders, price modes), `commercetools-platform` (SDK, update actions), `commercetools-checkout` (spike)

## Goal
The app knows, for every monthly line, which recurrence policy and price mode it uses; can state to the buyer the amount for every period of a term (intro and stepped) and keep that schedule on the order; can read the account's recurring orders; and the one big commerce risk (can one hosted-Checkout cart hold recurring Fixed, recurring Dynamic and one-time lines?) is proven or its fallback is recorded in `PROJECT-FINDINGS.md` before U is built (Gate 2).

## Design

### What the docs say (verified 2026-10-07 with the documentation tools)
- A Recurring Order generates future Orders from a **recurring Cart** (`origin = RecurringOrder`). That recurring Cart "contains only Line Items and Custom Line Items that are linked to a Recurrence Policy". Source: https://docs.commercetools.com/api/recurring-orders-overview (sections "Recurring Carts", "Initial creation").
- **Initial creation, Method A** ("Create Order from Cart", the normal `POST /orders`): "Use when the Cart contains a mix of one-time and recurring purchases, or recurring items with different schedules." The platform groups the recurring items by recurrence schedule, creates one Recurring Order and one recurring Cart per group, and the non-recurring lines stay only on the Order. So for the *Orders API* the **initial cart may mix** recurring and one-time lines. Whether the **hosted Checkout** accepts such a cart and handles `recurringPaymentConfiguration` is NOT documented: that is exactly what the spike (L-08) proves.
- **Prices:** each price used by a recurring line must be tied to a Recurrence Policy; "if no such price is found, the platform defaults to using the standard one-time purchase price" (silent fallback, no error). Same page, section "Prices".
- **Line item:** `recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-monthly' }, priceSelectionMode: 'Fixed' | 'Dynamic' }` on `addLineItem` (also `setLineItemRecurrenceInfo`). `Fixed` keeps the price set when the Recurring Order was created; `Dynamic` takes the current product price at each generated order. `priceSelectionMode` is **beta**.
- **Payments with Checkout:** "The Cart associated with the Recurring Order must have a `recurringPaymentConfiguration` configured using the `paymentStrategy` `Checkout`" and "the Payment Connector must support Recurring Orders and have Stored Payment Methods enabled" (https://docs.commercetools.com/checkout/recurring-orders-in-checkout). The configuration "is only evaluated on Carts with the `RecurringOrder` CartOrigin" (api overview, "Payments"). Update actions on the cart (names from the docs table): `setRecurringPaymentStrategy` (sets the strategy, keeps allocations), `setRecurringPaymentConfiguration` (strategy + allocations), `addRecurringPaymentAllocation`, `removeRecurringPaymentAllocation`. **The OAS served by the documentation tool does not yet contain these fields (beta): their exact JSON field names are unverified, so the spike discovers them against the live API.** Checkout's Recurring Payment Job sets the allocation to 100 % of the stored payment method after the first order. Split payments and gift cards are not available for recurring carts. If the payment of a subsequent order fails the Recurring Order goes to `Failed` and does not retry (must be set `Active` again).
- **RecurringOrder** (REST `/{projectKey}/recurring-orders`, GET supports `where`, `expand`): fields `id, key, cart, originOrder, startsAt, resumesAt, expiresAt, lastOrderAt, nextOrderAt, recurringOrderState (Active|Paused|Expired|Canceled|Failed), schedule (StandardSchedule {value, intervalUnit Days|Weeks|Months} | DayOfMonthSchedule {day}), customer, customerEmail, custom`. Update actions: `setRecurringOrderState` (with `recurringOrderState: { type: 'active'|'paused'|'canceled'|'expired' }` and for canceled an optional `reason`), `setSchedule`, `setStartsAt`, `setExpiresAt`, `setOrderSkipConfiguration`, `setKey`, `setCustomType`, `setCustomField`, `transitionState`. **There is no update action that changes a price or a line**: a stepped term price cannot be driven through the Recurring Order itself (this is why D-013 stores the schedule explicitly).
- **Session API:** `POST https://session.us-central1.gcp.commercetools.com/{projectKey}/sessions` with token scope `manage_sessions`, body `{ "cart": { "cartRef": { "id": "<cartId>" } }, "metadata": { "applicationKey": "<key>" } }` (https://docs.commercetools.com/checkout/installing-checkout). Checkout API host for Applications: `https://checkout.us-central1.gcp.commercetools.com/{projectKey}/applications/key={key}` (https://docs.commercetools.com/checkout/applications-api; the scope for the GET is listed on https://docs.commercetools.com/checkout/scopes, read it before L-08; if the storefront client lacks it, probe P5 reports `UNKNOWN (scope)`, it does not fail the spike).
- **Cart Discounts** used here: absolute value, `target.type = 'lineItems'`, predicate field identifiers `sku`, `product.key`, `categories.key`, `custom.<field>`, cart predicate `lineItemExists(...)`; multi-unit patterns use `CartDiscountPatternTarget` (https://docs.commercetools.com/api/projects/predicates, https://docs.commercetools.com/api/projects/cartDiscounts).

### Files this workstream creates (names binding; other workstreams import them)
| File | Purpose |
| --- | --- |
| `lib/config/pricing.ts` | `INTRO_DEFS`, `STEP_DEFS`, `MONTHLY_POLICY_KEY`, constants |
| `lib/ct/recurring.ts` | `server-only`: policy lookup, recurrence draft, recurring-order reads/writes, order custom-field stamping |
| `lib/pricing/dates.ts` | date-only (UTC) arithmetic and an injectable clock |
| `lib/pricing/priceMode.ts` | Fixed/Dynamic decision (D-013) |
| `lib/pricing/introPeriod.ts` | intro-period rules |
| `lib/pricing/schedule.ts` | phased schedule record: build, total, cancel, amend, (de)serialise, due transitions |
| `lib/mappers/recurringOrder.ts` | SDK `RecurringOrder` -> `RecurringOrderSummary` |
| `scripts/seed/discounts.ts`, `scripts/seed/data/cart-discounts/intro-*.ts` | seeds the intro Cart Discounts (the loader is reused by M for its two discounts) |
| `scripts/jobs/schedule-sweep.ts` | dry-run report of due schedule transitions |
| `scripts/spike/recurring-checkout.ts` + `scripts/spike/lib/{probe,findings,decide}.ts` | the checkout spike |
`lib/types.ts` (H creates): L appends a section `// ---- L: pricing ----` with the types below. `lib/config/cache.ts` (H): L appends `RECURRENCE_POLICY_TTL_S = 3600`.

### Types (append to `lib/types.ts`)
```ts
export type PriceSelectionMode = 'Fixed' | 'Dynamic';
export type TermMonths = 0 | 12 | 24;                 // 0 = month-to-month
export interface LineRecurrence { policyKey: 'malva-monthly'; priceSelectionMode: PriceSelectionMode }

export type PeriodKind = 'intro' | 'standing' | 'step';
export interface SchedulePeriod {
  index: number;                 // 1-based
  fromMonth: number; toMonth: number; months: number;   // billing months, inclusive, counted from the order date
  startsOn: string; endsOn: string;                     // YYYY-MM-DD, inclusive both ends
  monthlyAmount: Money;                                 // per unit (per line of service)
  kind: PeriodKind;
}
export interface AfterTerm { startsOn: string; monthlyAmount: Money; basis: 'month-to-month-price' }
export interface PriceSchedule {
  v: 1;
  offerKey: string; sku: string; termMonths: TermMonths; quantity: number;
  currencyCode: string; priceMode: PriceSelectionMode;
  orderDate: string;                       // YYYY-MM-DD (UTC): the intro and the term both start here (D-023)
  periods: SchedulePeriod[];               // [] never; month-to-month has ONE open-ended period (toMonth = 0 meaning "until cancelled")
  openEnded: boolean;                      // true for month-to-month
  totalContractValue: Money | null;        // sum over the term x quantity; null when openEnded
  dueAtOrder: Money;                       // first period amount x quantity + one-time fees of this line (activation fee)
  afterTerm: AfterTerm | null;             // null for month-to-month
  introEndsOn: string | null;
  status: 'active' | 'cancelled' | 'amended';
  cancelledOn?: string; amendedOn?: string; supersedes?: string;  // supersedes = the amendedOn of the previous version
}
export interface ScheduleError { code: 'PERIOD_NOT_PRICED' | 'NO_STANDING_PRICE' | 'INTRO_NOT_BELOW_STANDING' | 'BAD_DATE'; detail?: string }
export type ScheduleResult = { ok: true; value: PriceSchedule } | { ok: false; error: ScheduleError };

export interface RecurringOrderSummary {
  id: string; key?: string; originOrderId: string; state: 'Active' | 'Paused' | 'Expired' | 'Canceled' | 'Failed';
  startsAt: string; nextOrderAt?: string; lastOrderAt?: string; expiresAt?: string;
  cadence: { unit: 'Days' | 'Weeks' | 'Months'; every: number } | { dayOfMonth: number };
  monthly: Money;                          // total of the recurring cart (engine value)
  lines: { name: string; sku: string; quantity: number; priceSelectionMode: PriceSelectionMode | null }[];
  failureReason?: string;
}
```

### `lib/config/pricing.ts` (demonstration data; **Planner default**, owner may overrule)
```ts
export const MONTHLY_POLICY_KEY = 'malva-monthly' as const;
export interface IntroDef { offerKey: string; term: 0 | 12 | 24; months: number; amountCents: { USD: number; EUR: number } }
export interface StepDef  { offerKey: string; term: 12 | 24; coversMonths: number; steps: { fromMonth: number; deltaCents: { USD: number; EUR: number } }[] }
export const INTRO_DEFS: IntroDef[] = [
  { offerKey: 'malva-offer-wireless-5g', term: 12, months: 3, amountCents: { USD: 3500, EUR: 3200 } },   // Air 5G: 3 months at $35 / EUR 32, then the 12-month price ($55)
  { offerKey: 'malva-offer-cable-100',   term: 24, months: 6, amountCents: { USD: 2999, EUR: 2799 } },   // Cable 100: 6 months at $29.99, then $39.99
];
export const STEP_DEFS: StepDef[] = [
  { offerKey: 'malva-offer-phone-unlimited', term: 24, coversMonths: 24, steps: [{ fromMonth: 13, deltaCents: { USD: 500, EUR: 450 } }] }, // Unlimited 24-month: year 2 is $5 / EUR 4.50 more
];
export const INTRO_DISCOUNT_KEY_PREFIX = 'malva-cd-intro-';      // Cart Discount keys, one per IntroDef: malva-cd-intro-<offerKey-without-malva-offer->-<term>
```
Rules: one offer+term may appear in **either** `INTRO_DEFS` **or** `STEP_DEFS`, never both (checked by a unit test); `amountCents` is always **below** the standing price and **never 0** in demonstration data (a $0 payable-now cart may be refused by the hosted Checkout: see Pitfalls) but the code supports 0. Standing price = the recurring price of the variant (what the cart shows as the line's list price).

### `lib/pricing/dates.ts`
```ts
export type Clock = () => Date;                       // injectable; tests pass a fixed clock
export const systemClock: Clock = () => new Date();
export function toDateOnly(d: Date): string;          // 'YYYY-MM-DD' in UTC
export function parseDateOnly(s: string): Date | null; // null when not /^\d{4}-\d{2}-\d{2}$/ or not a real date
export function addMonths(date: string, n: number): string;  // clamp to month end: addMonths('2026-01-31', 1) === '2026-02-28'
export function addDays(date: string, n: number): string;
export function diffDays(a: string, b: string): number;      // b - a in whole days
```
Always compute period boundaries from the **order date** (`addMonths(orderDate, k)`), never by adding one month repeatedly (drift: Jan 31 -> Feb 28 -> Mar 28).

### `lib/pricing/priceMode.ts` (D-013)
```ts
export function termFromContractTerm(v: 'month-to-month' | '12-months' | '24-months'): TermMonths;
export function priceModeForTerm(term: TermMonths): PriceSelectionMode;           // 12|24 -> 'Fixed', 0 -> 'Dynamic'
export type MonthlyLineKind = 'plan' | 'addon' | 'equipment-rental' | 'installment' | 'lease';
export function lineRecurrence(kind: MonthlyLineKind, term: TermMonths): LineRecurrence;
export function priceModeCopyKey(mode: PriceSelectionMode): 'pricing.mode.fixed' | 'pricing.mode.dynamic';
```
Rules (Planner default for non-plan kinds): `plan` follows its term; `addon` and `equipment-rental` are always `Dynamic` (month-to-month services whose price can change with notice); `installment` and `lease` (Q, D-015) are always `Fixed`. `lineRecurrence` always returns `policyKey: 'malva-monthly'` (D-012).
Messages (both locales): `pricing.mode.fixed` = en "Price locked for your {months}-month term" / de "Preis für Ihre Laufzeit von {months} Monaten festgeschrieben"; `pricing.mode.dynamic` = en "Price can change; we tell you before it does" / de "Preis kann sich ändern; wir informieren Sie vorher". (Answers the spec question "Fixed or Dynamic: per product or project-wide": **per line, derived from the term**, shown to the buyer in words.)

### `lib/ct/recurring.ts` (`server-only`) [SKILL: commercetools-platform]
```ts
export interface RecurrencePolicyRef { id: string; key: string; version: number }
export async function getMonthlyPolicy(): Promise<RecurrencePolicyRef>;          // GET /recurrence-policies/key=malva-monthly, cached RECURRENCE_POLICY_TTL_S; throws ApiError('RECURRENCE_POLICY_MISSING') if 404
export function recurrenceInfoDraft(r: LineRecurrence): { recurrencePolicy: { typeId: 'recurrence-policy'; key: string }; priceSelectionMode: PriceSelectionMode };
export function assertRecurringPrice(line: { price?: { recurrencePolicy?: { id: string } } }, policy: RecurrencePolicyRef, sku: string): void; // throws ApiError('RECURRING_PRICE_MISSING', sku) when the price fell back to the one-time price
export async function getRecurringOrdersForCustomer(customerId: string, ctx: MapContext): Promise<RecurringOrderSummary[]>; // consumed by S
export async function getRecurringOrdersForOrder(orderId: string, ctx: MapContext): Promise<RecurringOrderSummary[]>;
export async function setRecurringOrderState(id: string, state: 'paused' | 'canceled' | 'active', reason?: string): Promise<RecurringOrderSummary>; // version-conflict retry once
export async function cancelRecurringOrdersForOrder(orderId: string, reason: string): Promise<{ canceledIds: string[]; lastOrderAt?: string }>; // consumed by V
export async function ensureRecurringPaymentStrategy(orderId: string): Promise<{ checked: number; updated: number }>; // idempotent, consumed by U (see spike P8/P9)
export async function stampOrderCustomFields(orderId: string, fields: Record<string, string | number | boolean>): Promise<void>; // consumed by U/V
```
Implementation notes:
- `getRecurringOrdersForCustomer`: `GET /recurring-orders?where=customer(id="<id>")&expand=cart&sort=createdAt desc&limit=50` (the customer id is a UUID: escape quotes anyway). The mapper needs `cart.lineItems[*].recurrenceInfo` and names (`name` localized by `ctx.locale`), so `expand=cart` is mandatory.
- `getRecurringOrdersForOrder`: `where=originOrder(id="<orderId>")`.
- `setRecurringOrderState`: update action `{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason } }` (`reason` only for canceled; `paused` and `active` have no extra field except `resumesAt` for active, which we never set). The update fails with `InvalidOperation` while the recurring order "is processing an Order": retry once after 1 s, then throw `ApiError('RECURRING_ORDER_BUSY')`.
- `cancelRecurringOrdersForOrder`: finds the recurring orders of the order, cancels each that is `Active|Paused|Failed`, returns the largest `lastOrderAt` (may be undefined: before service start no order was generated yet) so V can tell the buyer "no further orders; the last was on …" (scenario "Paused or canceled").
- `ensureRecurringPaymentStrategy(orderId)`: for each recurring order of the order, read `cart` (id, version, `recurringPaymentConfiguration`), if the strategy is not `Checkout` send the update action found working by spike probe P9 (default `setRecurringPaymentStrategy`). Used only if spike P8 reports `NOT_INHERITED`; implemented always so U can call it unconditionally.
- `stampOrderCustomFields`: reads the order; if `order.custom` is absent send `{ action: 'setCustomType', type: { typeId: 'type', key: 'malva-order' }, fields }`, else one `setCustomField` action per field; version-conflict retry once. Type `malva-order` is defined by G (fields `serviceStartDate`, `priceSchedule`, `labelSnapshot`, `cancellation`, `returnRequest`; String fields hold JSON text).
- Scopes: OA-02 names `view_recurring_orders manage_recurring_orders view_recurrence_policies`; the exact names are not confirmed. If the first call returns 403 `insufficient_scope`, copy the missing scope name from the error body into `PROJECT-FINDINGS.md` section "L - scopes" and write a question in `QUESTIONS.md`. Do not guess other scopes.

### `lib/pricing/introPeriod.ts` (pure)
```ts
export interface IntroPeriod { amount: Money; standing: Money; months: number; startsOn: string; endsOn: string /* first day of the standing price */; }
export function introDefFor(offerKey: string, term: TermMonths): IntroDef | null;
export function computeIntro(args: { def: IntroDef; standing: Money; orderDate: string }): { ok: true; value: IntroPeriod } | { ok: false; error: ScheduleError };
export function isIntroActive(intro: Pick<IntroPeriod, 'endsOn'>, today: string): boolean;   // today < endsOn
export function amountOn(intro: IntroPeriod, date: string): Money;                           // revert at endsOn, no customer action
export function shiftForDelay(intro: IntroPeriod, expectedServiceStart: string, actualServiceStart: string): IntroPeriod; // extends endsOn by the days of delay
export function resolveEarlyCancellation(args: { cancelledOn: string; serviceStartDate: string; intro: IntroPeriod | null }): { windowOpen: boolean; owedForPromo: Money /* always 0 */; rule: 'cancel-before-service-start' | 'no-clawback' };
export function discountKeyFor(def: IntroDef): string;   // 'malva-cd-intro-wireless-5g-12'
```
`computeIntro`: `amountCents[currency]` must exist (else `NO_STANDING_PRICE`... use detail `currency`), must be `< standing.centAmount` (else `INTRO_NOT_BELOW_STANDING`), `startsOn = orderDate`, `endsOn = addMonths(orderDate, months)`. 

**The four open questions of `introductory-period-price` (Planner defaults unless a decision exists):**
1. *Start at order, activation, or first provisioning?* **At the order date** (D-023, owner decision). The cancellation window (D-040) runs to the stored service-start date; the two are independent.
2. *Delayed provisioning: who bears the unused period?* **The operator.** Because the period runs from the order date, a delay beyond the expected service start (`order date + install lead time`: cable 5 days, others 0) would otherwise eat the buyer's promotion. `shiftForDelay` moves `endsOn` later by `max(0, actualServiceStart - expectedServiceStart)` days, so the customer is never charged the standing price for days the service did not exist. With no delay nothing moves (D-023 holds). No UI in v1; the function is used by the sweep report and V/U if an actual start is ever recorded. (This resolves the tension between spec scenario "Service start delayed" and D-023; flagged in the report.)
3. *What is owed when cancelling inside the opening period?* **Nothing is clawed back.** Before the stored service-start date the order is cancelled in full (D-040) and nothing is owed; after it, the promotional discount already given is not recovered, the months used are billed at their scheduled amounts, and the only termination charge is the plan's early-termination fee as stated on its label (V shows the formula text). `resolveEarlyCancellation` returns `owedForPromo = 0` and the rule name; copy: `intro.cancel.rule` = en "If you cancel during your introductory period you keep the savings you have already received." / de "Wenn Sie während des Einführungszeitraums kündigen, behalten Sie die bereits erhaltene Ersparnis."
4. *Can a customer hold several opening periods at once?* **Yes, one per line of service**, independent (each line has its own schedule and end date); **never two on one line** (an offer+term is in at most one definition). Holding a second line with an intro is not blocked by the first.

**How the engine applies it:** one Cart Discount per `IntroDef`: key `malva-cd-intro-<offer slug>-<term>`, `cartPredicate: "true"`, `target: { type: 'lineItems', predicate: 'sku = "<the sku of that offer+term variant>"' }`, `value: absolute` (`standing - intro` per currency; EUR and USD in one `money` array), `stackingMode: 'Stacking'`, `sortOrder: '0.2'`, `requiresDiscountCode: false`, `isActive: true`, `recurringOrderScope: { type: 'AnyOrder' }` (field verified in the CartDiscountDraft schema; other values: `NonRecurringOrdersOnly`, `RecurringOrdersOnly`, `ApplicableRecurrencePolicies`), no `validFrom/validUntil` (the period belongs to the customer, not the campaign: spec "Modeling notes"). The discount makes the **first charge** correct. Withdrawing the campaign = set the discount inactive (`changeIsActive false`): new carts lose it, stored schedules do not change (scenario "Campaign withdrawn after purchase"). A cart line "has the intro" iff its `discountedPricePerQuantity[].discountedPrice.includedDiscounts[].discount.key` contains `discountKeyFor(def)` (this, not config, is what M passes as `introApplied`).

### `lib/pricing/schedule.ts` (pure)
```ts
export interface ScheduleInput {
  offerKey: string; sku: string; termMonths: number; quantity: number;
  standing: Money;                 // per unit recurring list price (before the intro discount)
  introApplied: boolean;           // engine says the intro cart discount is on the line
  monthToMonth: Money | null;      // per unit price of the same offer's month-to-month variant (after-term price)
  oneTimeDueNow: Money;            // one-time fees attributed to this line in total (activation fee x quantity); centAmount 0 if none
  orderDate: string;               // YYYY-MM-DD
}
export function buildSchedule(input: ScheduleInput, today?: string): ScheduleResult;
export function totalContractValue(s: PriceSchedule): Money | null;
export function periodOn(s: PriceSchedule, date: string): SchedulePeriod | null;
export function amountDueOn(s: PriceSchedule, date: string): Money;                    // per unit
export function monthsRemaining(s: PriceSchedule, date: string): number;               // whole billing months left in the term (0 when openEnded) -> V's early-termination formula
export function cancelSchedule(s: PriceSchedule, cancelledOn: string): PriceSchedule;  // status 'cancelled', periods unchanged
export function amendFrom(s: PriceSchedule, amendedOn: string, newStanding: Money): ScheduleResult; // reprice remainder from the amendment date
export function serializeSchedules(list: PriceSchedule[]): string;                      // JSON '{"v":1,"schedules":[...]}'
export function parseSchedules(json: string): { ok: true; value: PriceSchedule[] } | { ok: false; error: 'BAD_JSON' | 'BAD_VERSION' | 'BAD_SHAPE' };
export function dueTransitions(list: { orderNumber: string; schedule: PriceSchedule }[], today: string): { orderNumber: string; sku: string; kind: 'intro-ends' | 'step' | 'term-ends'; on: string; newAmount: Money }[];
```
`buildSchedule` algorithm (deterministic):
1. `standing.centAmount <= 0` -> `NO_STANDING_PRICE`.
2. `term = 0` (month-to-month): `openEnded = true`; periods = one period `{ index 1, fromMonth 1, toMonth 0, months 0, startsOn orderDate, endsOn '9999-12-31' }`; if `introApplied` and an intro def exists for (offer, 0) the intro period precedes it (period 1 intro of `def.months`, period 2 standing open-ended). `totalContractValue = null`, `afterTerm = null`.
3. `term = 12|24`: if an `IntroDef` exists and `introApplied`: period 1 = intro (`months = def.months`, amount = intro amount), period 2 = standing for the remaining `term - def.months` months. If an intro def exists but `introApplied = false` (campaign withdrawn, or discount removed): a single standing period of `term` months (no intro shown).
4. If a `StepDef` exists for (offer, term): `if (term > def.coversMonths) return PERIOD_NOT_PRICED { detail: String(def.coversMonths + 1) }` (scenario "Period with no price": never extend the last known period); else periods are the standing amount until `steps[0].fromMonth - 1`, then `standing + deltaCents[currency]` from each `fromMonth` until the next step or the end of the term.
5. A term with neither def: one standing period of `term` months. A `term` that is not 0, 12 or 24 and has no def covering it returns `PERIOD_NOT_PRICED`.
6. `afterTerm` (committed terms only): requires `monthToMonth`; if null return `NO_STANDING_PRICE` with detail `afterTerm`. `startsOn = addMonths(orderDate, term)`, `monthlyAmount = monthToMonth`, `basis: 'month-to-month-price'`.
7. `periods[i].startsOn = addMonths(orderDate, fromMonth - 1)`, `endsOn = addDays(addMonths(orderDate, toMonth), -1)`.
8. `totalContractValue = sum(period.months * period.monthlyAmount) * quantity` in the line's currency; `dueAtOrder = periods[0].monthlyAmount * quantity + oneTimeDueNow`.
9. `introEndsOn = (period 1 is intro) ? period 1 endsOn + 1 day : null`.

**The four open questions of `term-phased-price-schedule` (Planner defaults):**
1. *Who owns the term schedule after the order: commerce or billing?* **The billing system is the owner of record for charging; commerce stores the agreed schedule on the order** (`malva-order.priceSchedule`, written at order creation from the order date) and never recomputes it from catalog state. There is no real billing system in v1 (D-059), so the Recurring Order created by the platform keeps charging the amount it was created with (Fixed) or the catalog price (Dynamic); **the stored schedule, not the Recurring Order, is what the buyer was promised.** `scripts/jobs/schedule-sweep.ts` (dry-run only) lists every boundary that is due so a future billing integration or an operator can act. This is a known v1 limitation: charges after the first order are **not** driven from the schedule. Owner to confirm.
2. *Early cancellation: what happens to the remaining schedule, what is recovered?* `cancelSchedule` marks it `cancelled` with `cancelledOn` and leaves every period as agreed (history stays truthful). Remaining periods are void (never billed). The only amount recovered is the early-termination fee shown on the plan's label (cable "$10 x months remaining", wireless/phone none; V displays the text and may compute with `monthsRemaining`). Nothing earlier is re-rated.
3. *End of term: revert automatically or renew at the last agreed amount?* **Reverts to the offer's month-to-month price** (`afterTerm`, read from the offer's month-to-month variant, stated before commitment with its start date). It never renews at the last agreed (possibly discounted) amount. Disclosed in the PriceSchedule component ("After your {n}-month term, {amount}/mo from {date}").
4. *Mid-term amendment: from the amendment date or rebase the whole term?* **From the amendment date**: `amendFrom` keeps the periods already elapsed unchanged (months before `amendedOn`), re-prices the remaining months with the new standing price (applying the same intro/step definitions only to months not yet elapsed, and never creating a new intro), sets the old schedule's status `amended` and the new one `supersedes` the old `amendedOn`. There is **no amendment UI in v1** (D-040: no plan changes); the function and its tests exist so the rule is fixed in code. M shows the revised schedule before acceptance whenever an amendment flow is added.

### Recurring Order reads (consumed by S) and the `Recurring order created` rule
The recurring order is created by the platform when the Order is created from a cart with recurring lines (Method A); the storefront never calls `POST /recurring-orders` (unless the spike picks fallback F2). The buyer-visible "next order" is `nextOrderAt`. Mapper `lib/mappers/recurringOrder.ts`:
`mapRecurringOrder(ro, ctx): RecurringOrderSummary` — `state = ro.recurringOrderState`; `cadence` from `ro.schedule` (`type 'standard'` -> `{ unit: intervalUnit, every: value }`, `type 'dayOfMonth'` -> `{ dayOfMonth: day }`); `monthly = ro.cart.obj.totalPrice`; `lines` from `ro.cart.obj.lineItems` (`name` = `getLocalizedString(li.name, ctx.locale)`, `priceSelectionMode = li.recurrenceInfo?.priceSelectionMode ?? null`); `failureReason` from `ro.failure?.message` if present. Throws nothing; missing expanded cart yields `monthly = { centAmount: 0, currencyCode: ctx.currency }` and `lines: []`.

### Seeding the intro discounts (`scripts/seed/discounts.ts`) [SKILL: commercetools-commerce-patterns]
Run with `npm run seed:discounts` (add to `package.json`: `"seed:discounts": "tsx --conditions=react-server scripts/seed/discounts.ts"`). The `--conditions=react-server` flag makes the `server-only` package a no-op outside Next.js; every script that imports `lib/ct/**` needs it. Behaviour (D-054): refuse to run unless `CTP_PROJECT_KEY === 'spec-test-b2c-telecom'`; only touch keys starting `malva-cd-`; for each manifest in `scripts/seed/data/cart-discounts/*.ts` (default export `CartDiscountManifest = { key, name: LocalizedString, description?, cartPredicate, target, value, sortOrder, stackingMode, requiresDiscountCode, isActive }`): `GET /cart-discounts/key={key}`; 404 -> create; exists -> one update with `changeName, changeCartPredicate, changeTarget, changeValue, changeSortOrder, changeStackingMode, changeRequiresDiscountCode, changeIsActive, setDescription`. Use the seed client factory exported by `scripts/seed/lib.ts` (F owns it: read its exports first and use them; do not create a second client factory). The intro manifests are generated from `INTRO_DEFS` by `scripts/seed/data/cart-discounts/intro-defs.ts` (a function returning the manifests; the SKU is resolved by reading the product projection of `offerKey` and choosing the variant whose `contract-term` attribute equals the term; fail loudly if not found). Idempotent: running twice changes nothing.

### The checkout spike (task L-08; Gate 2) [SKILL: commercetools-checkout]
**Question:** can ONE cart carry (a) a recurring **Fixed** line, (b) a recurring **Dynamic** line and (c) one-time lines (equipment purchase as a Line Item, activation fee as a Custom Line Item), with `recurringPaymentConfiguration.paymentStrategy = Checkout`, be accepted by the hosted Checkout (session creation) and turn into an Order plus a Recurring Order whose recurring cart holds only the recurring lines?
**Script:** `scripts/spike/recurring-checkout.ts`, run `npm run spike:recurring-checkout -- [--skip-checkout] [--keep]` (script: `tsx --conditions=react-server scripts/spike/recurring-checkout.ts`). Needs `site/.env.local` (OA-02 client; `CTP_CHECKOUT_APP_KEY` from OA-05 for P3/P4; without it use `--skip-checkout` and P3/P4 are recorded `BLOCKED (OA-05)`). It creates only resources whose key starts `spike-recurring-` and deletes them at the end (carts, orders, recurring orders) unless `--keep`.
**Data used** (USD, country US, locale en-US): Fixed line = offer `malva-offer-cable-500` variant `contract-term = 24-months` (recurring price, `recurrenceInfo` Fixed); Dynamic line = offer `malva-offer-phone-unlimited` variant `month-to-month` (Dynamic); equipment purchase = offer `malva-offer-router-ax3000` variant `charge-type = one-time` (a Line Item **without** `recurrenceInfo`); activation fee = Custom Line Item `{ name: {'en-US': 'Activation fee'}, slug: 'spike-activation-fee', quantity: 1, money: { currencyCode: 'USD', centAmount: 2500 }, taxCategory: <first tax category whose key starts 'malva-'> }` (no `recurrenceInfo`). Product lookup by `GET /product-projections/key=<key>?priceCurrency=USD&priceCountry=US`; if a key or variant is missing, stop with "run seed (G) first".

Probes (each logs `id, title, status: PASS|FAIL|INFO|UNKNOWN|BLOCKED, evidence` where evidence is HTTP status + error `code` + the first 200 chars of the message, never a token or secret):
| Id | What it does | PASS when |
| --- | --- | --- |
| P0 | Reads policy `malva-monthly` and prints its schedule | exists, `schedule = standard, 1 Months` |
| P1 | Creates cart `{currency USD, country US, taxMode Platform, shippingAddress {country US, postalCode 10001}, key spike-recurring-<ts>}` and adds the four lines (Fixed, Dynamic, one-time Line Item, Custom Line Item) in **one** update. P1b: separate cart with recurring + only the Custom Line Item. P1c: separate cart with recurring + only the one-time Line Item | all adds return 200 |
| P2 | For each recurring line, checks `line.price.recurrencePolicy.id === policy.id` (price tied) | both tied. A line that fell back to the one-time price is FAIL `price-fell-back:<sku>` |
| P3 | On the P1 cart sends the recurring payment action. Tries in order, stops at the first 200: (1) `{ action: 'setRecurringPaymentConfiguration', recurringPaymentConfiguration: { paymentStrategy: 'Checkout' } }`, (2) `{ action: 'setRecurringPaymentStrategy', paymentStrategy: 'Checkout' }`, (3) `{ action: 'setRecurringPaymentConfiguration', paymentStrategy: 'Checkout' }`. Records every attempt's status and the error body, and the **field names of the accepted action**. Then reads the cart and checks `recurringPaymentConfiguration.paymentStrategy` is present and `Checkout`. | accepted and present. 4xx on all = FAIL (`initial-cart-rejects-config`). 200 but field absent = FAIL (`initial-cart-ignores-config`) |
| P4 | Sets shipping method (first of `GET /shipping-methods/matching-cart?cartId=`), then `POST session.<region>/<project>/sessions` with the cart and `CTP_CHECKOUT_APP_KEY` (token scope `manage_sessions`) | 201 with an `id` |
| P5 | `GET checkout.<region>/<project>/applications/key=<key>`; records only: `key, mode, status, countries, allowedOrigins count, paymentsConfiguration` integration keys and types. Never copies anything else | retrievable; `status = Active`. 403 = UNKNOWN (scope) |
| P6 | `POST /orders` from the P1 cart (Method A, orderNumber `spike-recurring-<ts>`), no payment (this is only a platform behaviour probe) | 201 |
| P7 | `GET /recurring-orders?where=originOrder(id="<orderId>")&expand=cart`; records count, and per recurring order: schedule, which SKUs are on its recurring cart, which `priceSelectionMode` each has, cart `origin` | every recurring cart has `origin = RecurringOrder` and **only** recurring lines; records whether Fixed and Dynamic share one recurring order (INFO) |
| P8 | Reads `recurringPaymentConfiguration` of each recurring cart | `paymentStrategy === 'Checkout'` = PASS (`inherited`); absent = FAIL `NOT_INHERITED` (expected to be possible; handled by `ensureRecurringPaymentStrategy`) |
| P9 | On each recurring cart sends the action that P3 found working (else candidate 2 then 1) | 200 and strategy readable afterwards |
| P10 | INFO: builds a second cart with one intro line (cable-100 24-month, discount from the intro seed) and orders it; records the recurring cart line's price and total (does the recurring cart carry the intro price or the standing price?) | INFO only |
| P11 | INFO: sends `{ action: 'recalculate' }` to a recurring cart | INFO (200 = recurring carts can be updated) |
`decide(results)` (`scripts/spike/lib/decide.ts`, pure, unit-tested) returns `{ architecture, rationale }`:
| Condition (first match wins) | architecture |
| --- | --- |
| P2 FAIL | `BLOCKED-DATA`: a variant has no price tied to `malva-monthly`; fix G seed, re-run |
| P6 FAIL or P1 FAIL, and P1b PASS and P1c FAIL | **F1**: every one-time charge (activation fee, equipment purchase, device outright) becomes a Custom Line Item without recurrence |
| P6 FAIL or P1 FAIL otherwise | **F2**: split into a recurring cart and a one-time cart |
| P4 FAIL | **F3**: if the error text mentions recurring/mixed/payment strategy use F3 (see below), otherwise `BLOCKED-CHECKOUT` (configuration problem, owner) |
| P8 FAIL and P9 FAIL | `BLOCKED-RECURRING-PAYMENT` (owner escalation: connector/Checkout does not support what D-041 needs) |
| P3 PASS and P8 PASS | **A**: one mixed cart, strategy set on the initial cart and inherited |
| otherwise (P3 FAIL or P8 FAIL, P9 PASS) | **A-prime**: one mixed cart; U calls `ensureRecurringPaymentStrategy(orderId)` right after the order is created |
| any of P3/P4 `BLOCKED` | `PENDING (OA-05)` plus the best guess from the other probes |
**Documented fallbacks** (written verbatim into the findings section by the script, selected by `architecture`):
- **A / A-prime (default):** M keeps one cart. U creates the session for that cart; after order creation U calls `ensureRecurringPaymentStrategy(order.id)` (a no-op under A) and `stampOrderCustomFields`.
- **F1 — Custom Line Items for one-time charges:** M's `addOfferLine` creates equipment purchases and device outright lines as Custom Line Items (`name`, `slug: <sku>`, `money` from the variant one-time price) instead of Line Items; activation fee is already a Custom Line Item. Inventory is not tracked on Custom Line Items, so `lib/ct/availability.ts` still blocks the add before it is created. Cost: no product link on the order line (name/slug carry the SKU).
- **F2 — two carts:** at "Pay", U splits the bundle cart into R (all recurring lines) and O (one-time lines). R goes to the hosted Checkout (it creates the Order and the Recurring Order and takes the first month). O is paid with a second session, in a second step shown as "Pay one-time fees". If O fails, R stays ordered and O is shown as unpaid on the confirmation page. M's cart stays one cart; only U changes.
- **F3 — Checkout in Payment Only mode:** switch the Checkout Application to Payment Only if Complete mode refuses the mixed cart; U already renders its own steps around the payment. Requires address/shipping on the cart before the session.
The script writes (or replaces between markers) this block in `plan/PROJECT-FINDINGS.md`:
```
<!-- SPIKE-L:BEGIN -->
## L - Checkout spike (recurring + one-time) - run <ISO timestamp>
Result: <architecture>  |  Gate 2: owner review required
| Probe | Title | Status | Evidence |
...
Accepted action field names: <from P3>
Initial cart may mix recurring and one-time lines: <yes (P1/P6) | no>   (documented for Orders API Method A; Checkout behaviour per P4)
Recurring grouping: <N recurring orders; Fixed and Dynamic lines in same order: yes|no>
Fallback plan: <the paragraph for the chosen architecture, plus a one-line list of the other three>
Open items: <BLOCKED probes and what unblocks them>
<!-- SPIKE-L:END -->
```
and prints the same to the console. No secrets: only the whitelisted fields above.

### Sweep job (`scripts/jobs/schedule-sweep.ts`) — dry-run only
`npm run job:schedule-sweep -- [--today=YYYY-MM-DD]` (script `tsx --conditions=react-server scripts/jobs/schedule-sweep.ts`): queries orders `where=custom(fields(priceSchedule is defined)) and orderState="Open"` in pages of 100, parses with `parseSchedules`, runs `dueTransitions(list, today)` and prints one line per due transition (`order, sku, kind, date, new amount`). It **writes nothing** to commercetools (Planner default: billing is out of scope, D-059; the spec's "scheduled job outside commercetools" is satisfied by this report job plus a note that a real billing integration would act on it).

### Pitfalls
- A recurring line whose variant has no price tied to `malva-monthly` is charged the one-time price with **no error**: always call `assertRecurringPrice` after `addLineItem` (M does) and fail the add.
- `priceSelectionMode` is beta; the OAS does not know the recurring payment fields. Never copy field names from memory into app code: the spike records the accepted shape; `ensureRecurringPaymentStrategy` uses it.
- Neither `Fixed`/`Dynamic` nor a Cart Discount's `recurringOrderScope` can express "discounted for N months, then standing": `NonRecurringOrdersOnly` would apply the intro to the first order only, `AnyOrder` would apply it to every generated order for as long as the discount is active. Probe P10 records which one happens; the schedule record stays the promise either way.
- `Fixed` also freezes the intro discount's effect; do not treat the platform as the owner of the stepped price (D-013).
- Month arithmetic: use `addMonths(orderDate, k)`, never repeated additions; use UTC date-only strings, never local `Date` getters (de-DE users in other time zones would see shifted dates).
- Recurring Orders do not retry after a failed payment; they stay `Failed` until set `Active`. The account page (S) must show `Failed` clearly.
- A $0 payable-now cart may be refused by the hosted Checkout; demonstration intro amounts are never 0.
- Scripts importing `lib/ct/**` need `tsx --conditions=react-server` (`server-only` throws otherwise).
- The spike creates real orders in the shared project: only keys `spike-recurring-*`, deleted at the end; run it once per decision, not in a loop.

## Tasks
- [ ] L-01 Append the L types to `lib/types.ts`; create `lib/config/pricing.ts` (constants and the two demonstration lists above) and append `RECURRENCE_POLICY_TTL_S = 3600` to `lib/config/cache.ts`. Tests `lib/config/pricing.test.ts`: no offer+term in both lists; every `amountCents` value is an integer > 0; every `STEP_DEFS.coversMonths >= term`; keys match `/^malva-offer-[a-z0-9-]+$/`.
- [ ] L-02 Create `lib/pricing/dates.ts` with the functions above. Tests `lib/pricing/dates.test.ts`: `addMonths('2026-01-31',1)='2026-02-28'`, leap year `addMonths('2028-01-31',1)='2028-02-29'`, `addMonths('2026-10-07',24)='2028-10-07'`, `diffDays`, `parseDateOnly('2026-02-30')=null`, `toDateOnly` uses UTC (clock fixed at `2026-10-07T23:30:00-05:00` gives `2026-10-08`).
- [ ] L-03 Create `lib/pricing/priceMode.ts` + messages `pricing.mode.fixed|dynamic` (en-US and de-DE). Tests `lib/pricing/priceMode.test.ts`: 12 and 24 are Fixed, 0 is Dynamic, add-on and equipment-rental are Dynamic for any term, installment and lease are Fixed, policy key is always `malva-monthly`, `termFromContractTerm` maps the three enum values.
- [ ] L-04 Create `lib/ct/recurring.ts` part 1 (`getMonthlyPolicy`, `recurrenceInfoDraft`, `assertRecurringPrice`) [SKILL: commercetools-platform]. Tests `lib/ct/recurring.test.ts` (mock `@/lib/ct/client`): policy fetched once within TTL; 404 throws `RECURRENCE_POLICY_MISSING`; draft shape exact; `assertRecurringPrice` throws `RECURRING_PRICE_MISSING` when the price has no policy and passes when the ids match.
- [ ] L-05 Create `lib/pricing/introPeriod.ts` (all functions, tests first). Tests `lib/pricing/introPeriod.test.ts`: one test per intro scenario (see table), plus: amount not below standing returns `INTRO_NOT_BELOW_STANDING`; missing currency returns error; `discountKeyFor` gives `malva-cd-intro-wireless-5g-12`; `shiftForDelay` with 0 delay changes nothing.
- [ ] L-06 Create `lib/pricing/schedule.ts` part 1: `buildSchedule`, `totalContractValue`, `periodOn`, `amountDueOn`, `monthsRemaining`. Tests `lib/pricing/schedule.test.ts` with **fixed fixture prices written in the test** (never read from the catalog): Unlimited 24 with standing 4500 and month-to-month 5000 USD cents (year 1 $45.00, year 2 $50.00, total 12 x 4500 + 12 x 5000 = 114000 cents for quantity 1, after-term $50.00 starting `addMonths(orderDate, 24)`), Cable 100 24 with standing 3999 and intro 2999 (6 months $29.99 then 18 months $39.99, `introEndsOn = addMonths(orderDate, 6)`), month-to-month (one open-ended period, `totalContractValue null`), `term 36` with `coversMonths 24` returns `PERIOD_NOT_PRICED` with detail `25`, `introApplied=false` shows no intro period, quantity 3 multiplies totals and `dueAtOrder` includes `oneTimeDueNow`.
- [ ] L-07 Create `lib/pricing/schedule.ts` part 2: `cancelSchedule`, `amendFrom`, `serializeSchedules`, `parseSchedules`, `dueTransitions`. Tests (same file): cancel keeps periods and sets status; amend at month 14 of Unlimited-24 keeps months 1-13 and reprices 14-24 with the new standing price and links `supersedes`; serialisation round-trips; `parseSchedules('{"v":2}')` returns `BAD_VERSION`; `dueTransitions` reports `intro-ends`, `step` and `term-ends` on the right dates and ignores cancelled schedules.
- [ ] L-08 **Checkout spike** [SKILL: commercetools-checkout]. Create `scripts/spike/recurring-checkout.ts`, `scripts/spike/lib/probe.ts` (wrapper that runs a probe, catches SDK errors and maps them to `{status, code, message<=200 chars}`), `scripts/spike/lib/decide.ts` (pure decision table above) and `scripts/spike/lib/findings.ts` (`renderFindings(results, decision, nowIso): string`, `writeBetweenMarkers(filePath, begin, end, text)` creating the markers at the end of the file if absent); add the npm script `spike:recurring-checkout`. Ensure `vitest.config.ts` `include` covers `scripts/**/*.test.ts` (append the glob if absent; A owns that file, mention it in the commit message). Tests `scripts/spike/lib/decide.test.ts` (every row of the decision table, plus `BLOCKED` probes giving `PENDING (OA-05)`), `scripts/spike/lib/findings.test.ts` (renders the table, replaces an existing block without touching other text, never prints a string that looks like a bearer token: assert the output contains no `Bearer ` and no value of any env var). Runs offline (probes mocked); the live run is L-09.
- [ ] L-09 **Run the spike and record the result** (needs OA-02; OA-05 for P3/P4/P5): `cd site && npm run spike:recurring-checkout` (add `-- --skip-checkout` if OA-05 is not DONE). Confirm the `<!-- SPIKE-L -->` block was written to `plan/PROJECT-FINDINGS.md`, read it, and confirm no spike resource remains (query carts/orders/recurring-orders with key prefix `spike-recurring-`). Add a short "L - scopes" paragraph to `PROJECT-FINDINGS.md` with the exact recurring-order and recurrence-policy scope names that worked (or the missing one). If the result is not `A` or `A-prime`, write a question in `QUESTIONS.md` and **stop**: M and U wait for the owner's decision. If P3/P4 were skipped, tick this task only after the re-run after OA-05 (record both runs). No unit test (live task): evidence is the findings block.
- [ ] L-10 Create `lib/ct/recurring.ts` part 2: reads, state changes, `ensureRecurringPaymentStrategy`, `stampOrderCustomFields` and `lib/mappers/recurringOrder.ts`; use the action shapes recorded in L-09 [SKILL: commercetools-platform]. Tests `lib/ct/recurring.test.ts` and `lib/mappers/recurringOrder.test.ts` (mock the SDK root): mapping of a standard and a day-of-month schedule; `Failed` carries `failureReason`; cancel returns `lastOrderAt` and skips `Expired`; `setRecurringOrderState` retries once on `InvalidOperation` and then throws `RECURRING_ORDER_BUSY`; `ensureRecurringPaymentStrategy` updates only carts without `Checkout`; `stampOrderCustomFields` uses `setCustomType` when no custom type exists and `setCustomField` otherwise.
- [ ] L-11 Create `scripts/seed/discounts.ts`, `scripts/seed/data/cart-discounts/intro-defs.ts` and the npm script `seed:discounts`; run it against the project (needs OA-03). [SKILL: commercetools-commerce-patterns]. Tests `scripts/seed/discounts.test.ts` (mock client): refuses a project key other than `spec-test-b2c-telecom`; refuses a manifest key not starting `malva-cd-`; creates when 404; updates when present; running twice sends no create; generated manifests: key `malva-cd-intro-wireless-5g-12`, absolute value equals `standing - intro` for USD and EUR, `validFrom/validUntil` absent.
- [ ] L-12 Create `scripts/jobs/schedule-sweep.ts` and the npm script `job:schedule-sweep` (dry-run). Tests `scripts/jobs/schedule-sweep.test.ts`: with two orders (one stepped, one intro) and `today` on their boundaries it prints the expected lines; it performs no write call (mock asserts only GET).
- [ ] L-13 Report the Chrome (commerce-MCP) checks C-L-1 to C-L-5 and the manual tests M-L-1, M-L-2; run `npm run verify`; set `STATUS.md` to `Ready for review`.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Both prices shown before commitment | `introductory-period-price` | `lib/pricing/introPeriod.test.ts` → "Both prices shown before commitment: exposes promotional amount, standing amount and the date the standing amount begins" (UI part: M `PriceSchedule.test.tsx`) |
| Period runs from start of service | `introductory-period-price` | `lib/pricing/introPeriod.test.ts` → "Period runs from start of service: each customer's end date is computed from their own order date" |
| Reverts without customer action | `introductory-period-price` | `lib/pricing/introPeriod.test.ts` → "Reverts without customer action: amountOn returns the standing price from the end date" and `lib/pricing/schedule.test.ts` → "Reverts without customer action: dueTransitions reports intro-ends" |
| Campaign withdrawn after purchase | `introductory-period-price` | `lib/pricing/schedule.test.ts` → "Campaign withdrawn after purchase: a stored schedule parsed after the config is emptied is unchanged" and `scripts/seed/discounts.test.ts` → "Campaign withdrawn after purchase: deactivating changes only isActive" |
| Service start delayed | `introductory-period-price` | `lib/pricing/introPeriod.test.ts` → "Service start delayed: end date moves by the days of delay, never earlier" |
| Canceled within the opening period | `introductory-period-price` | `lib/pricing/introPeriod.test.ts` → "Canceled within the opening period: nothing owed for the promotion, rule is named" |
| Every period priced | `term-phased-price-schedule` | `lib/pricing/schedule.test.ts` → "Every period priced: Unlimited 24-month has a year-1 and a year-2 period" |
| Total contract value stated | `term-phased-price-schedule` | `lib/pricing/schedule.test.ts` → "Total contract value stated: sum of period months times amount times quantity" |
| Schedule fixed at commitment | `term-phased-price-schedule` | `lib/pricing/schedule.test.ts` → "Schedule fixed at commitment: serialise then parse returns identical periods regardless of catalog price" |
| End of term price disclosed | `term-phased-price-schedule` | `lib/pricing/schedule.test.ts` → "End of term price disclosed: afterTerm has the month-to-month amount and its start date" |
| Mid term change reprices the remainder | `term-phased-price-schedule` | `lib/pricing/schedule.test.ts` → "Mid term change reprices the remainder: months before the amendment unchanged, remaining months repriced" |
| Period with no price | `term-phased-price-schedule` | `lib/pricing/schedule.test.ts` → "Period with no price: a term beyond the schedule is PERIOD_NOT_PRICED, not priced from the last period" |
| Recurring order created | `subscriptions-and-recurring-orders` | `lib/mappers/recurringOrder.test.ts` → "Recurring order created: summary exposes cadence, state and the next order date" and `lib/ct/recurring.test.ts` → "Recurring order created: reads by customer expand the cart" |
| Catalog price moved | `subscriptions-and-recurring-orders` | `lib/pricing/priceMode.test.ts` → "Catalog price moved: Fixed and Dynamic each map to their own buyer-facing copy key" and `lib/mappers/recurringOrder.test.ts` → "Catalog price moved: each line carries its price selection mode" |
| Paused or canceled | `subscriptions-and-recurring-orders` | `lib/ct/recurring.test.ts` → "Paused or canceled: cancel returns the last order date and no further state change is attempted on expired orders" |

## Chrome verification (run by Claude)
These checks use the commerce MCP and the filesystem (L has no page of its own; the buyer-facing UI is checked in M).
- C-L-1 (needs OA-03, G): MCP `read_recurrence_policies` with key `malva-monthly` → exists, schedule `standard`, value 1, interval `Months`.
- C-L-2 (needs OA-03, L-11): MCP `read_cart_discounts` where key starts `malva-cd-intro-` → exactly 2 (`malva-cd-intro-wireless-5g-12`, `malva-cd-intro-cable-100-24`), active, no validity dates, target predicate `sku = "…"` equals the SKU of that variant (compare with `read_product_projections` key `malva-offer-wireless-5g`).
- C-L-3 (needs OA-02, G): MCP `read_product_projections` for `malva-offer-cable-500`, `malva-offer-phone-unlimited`: every recurring variant has a price with `recurrencePolicy.key = malva-monthly` in USD/US and EUR/DE (prices without a policy are only the one-time equipment/activation ones) → none missing.
- C-L-4 (needs OA-05 for the checkout rows): open `plan/PROJECT-FINDINGS.md` → block `SPIKE-L` present, every probe P0–P11 has a status, `Result:` is one of A, A-prime, F1, F2, F3, BLOCKED-*, no token or secret text, the fallback paragraph matches the result.
- C-L-5 (needs OA-02): MCP `read_carts`, `read_orders`, `read_recurring_orders` filtered by key prefix `spike-recurring-` → none remain (unless the run used `--keep`).
- C-L-6 (needs OA-02): run `npm run job:schedule-sweep -- --today=2027-10-07` → prints the term-end and step lines for any order with a stored schedule, prints "0 writes", exit code 0; run with no orders → prints "no schedules found", exit code 0.

## Manual tests (owner only)
- M-L-1 (needs OA-05): In Merchant Center → Checkout open the Adyen payment integration attached to the application whose key is in `CTP_CHECKOUT_APP_KEY` → "Stored payment methods" is enabled, the integration status is Active, and the connector lists recurring-orders support. Record the answer in `TODO-MANUAL-TESTING.md`.
- M-L-2 (needs OA-05): Read the `SPIKE-L` block in `PROJECT-FINDINGS.md` and reply `APPROVED` (or the changes wanted) in `TODO-MANUAL-TESTING.md` → Gate 2 passes. M and U do not start before this is APPROVED.

## Excluded
- Scenario "Schedule changed in place" (`subscriptions-and-recurring-orders`): changing a recurring order's cadence or quantity is a plan change, out of scope in v1 (D-040: no plan changes; the monthly cadence is fixed by the offer). No test, no UI. The recurring-order mutation we do support (cancel, pause) is covered by "Paused or canceled".
- Charging each period at the scheduled amount (billing) is out of scope (D-059); only the dry-run sweep exists.
- Buyer-chosen cadence UI from the subscriptions spec text ("the buyer sets a cadence"): cadence is always the monthly policy (D-012).

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test.
- [ ] C- and M- lines present; STATUS set to `Ready for review`.
- [ ] `PROJECT-FINDINGS.md` has the `SPIKE-L` block with a final architecture (A, A-prime, F1, F2 or F3), the "L - scopes" paragraph, and no spike resources remain in the project.
- [ ] Owner replied `APPROVED` to M-L-2 (Gate 2).
