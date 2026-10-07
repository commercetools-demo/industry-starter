# Q — Devices and acquisition modes

**Specs:** `device-acquisition-mode` (all 6 scenarios; handset listing, pickers and the financing stub are the means). Also verifies, but does not build, the `telecom-catalog-model` scenario "Handset is one product with its options as variants" (built by G).
**Depends on:** L, M, N · **Unblocks:** U · **Decisions:** D-010, D-011, D-012, D-013, D-015, D-016, D-019, D-021, D-024, D-035, D-041, D-044, D-052, D-054, D-058
**Owner prerequisites:** OA-02, OA-03 (live checks and the seed run); OA-05 is **not** needed here (U needs it) · **Skill refs:** `commercetools-commerce-patterns` (recurring prices, price selection fallback), `commercetools-storefront` (cart routes), `commercetools-platform` (types, update actions)

## Goal
A buyer opens `/en-US/shop/phones-and-devices`, sees the handsets, picks color and memory, chooses how to pay (pay in full, installments over 12/24/36 months, or lease), sees exactly what is due today and monthly with the end-of-term obligation, adds the line to "My bundle", and can change the mode there. The mode and term are stored on the line and survive onto the order; a deterministic stub decides financing when U calls it at "Continue to payment".

## Design

### 1. What is sold (one product, one SKU, mode on the line)
G creates the two handset products (`malva-phone-nova-5g`, `malva-phone-nova-pro`, type `malva-device`) and their offers (`malva-offer-phone-nova-5g`, `malva-offer-phone-nova-pro`, type `malva-offer`, `offer-kind = device`). Variants differ by **color and memory only** (D-015, `telecom-catalog-model`). Prices live on the offer variants (D-011). Q **adds the acquisition prices** to those variants and **never hard-codes a SKU**: it finds variants through their attributes `color` and `memory-gb` (G's default SKU form is `MLV-DEV-<MODEL>-<MEM>-<COLOR>`, e.g. `MLV-DEV-NOVAPRO-256-BLACK`; if G's differs, nothing in Q changes).

| Offer | Colors | Memory | Modes offered |
| --- | --- | --- | --- |
| `malva-offer-phone-nova-5g` | black, silver | 128 GB, 256 GB | outright, installments 12/24/36. **No lease** (this is the "Mode unavailable for this device" case) |
| `malva-offer-phone-nova-pro` | black, silver, violet | 256 GB, 512 GB | outright, installments 12/24/36, lease 24 |

**Price table (cents, the contract of the seed; price depends on memory, never on color).** `Instalment × term = outright` exactly, so no rounding exists.

| Offer / memory | USD outright | USD 12 / 24 / 36 per month | USD lease 24 per month | EUR outright | EUR 12 / 24 / 36 per month | EUR lease 24 per month |
| --- | --- | --- | --- | --- | --- | --- |
| Nova 5G 128 GB | 72000 | 6000 / 3000 / 2000 | — | 64800 | 5400 / 2700 / 1800 | — |
| Nova 5G 256 GB | 82800 | 6900 / 3450 / 2300 | — | 75600 | 6300 / 3150 / 2100 | — |
| Nova Pro 256 GB | 100800 | 8400 / 4200 / 2800 | 3300 | 93600 | 7800 / 3900 / 2600 | 3000 |
| Nova Pro 512 GB | 118800 | 9900 / 4950 / 3300 | 3900 | 111600 | 9300 / 4650 / 3100 | 3600 |

USD prices carry `country: "US"`, EUR prices `country: "DE"` (D-004). **One deliberate hole** (demonstrates the price-fallback trap, section 3): the Nova 5G **256 GB Silver** variant has **no 36-month installment price** (USD and EUR). Leave it; a data test asserts it.

Per-channel handset price (spec open question): **Planner default: not used.** No handset price has a `channel`. Channel-specific offers (call-center, online-only) are made with `malva-offer.channels` and `eligibility-gated-offer` (K), never with channel prices. A data test asserts no device price has a channel.

### 2. Recurrence policies (verified against the docs)
Facts checked in the commercetools docs (2026-10-07):
- A **price is tied to one Recurrence Policy**; price selection looks for a price with the line's policy and **falls back to the one-time price when none matches, with no error** ([price selection](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection), [create a recurring order](https://docs.commercetools.com/guides/create-a-recurring-order): "If you do not set specific prices ... the one time-purchase price will be used instead").
- A policy has **only a cadence** (`StandardSchedule` value + `Days|Weeks|Months`, or `DayOfMonthSchedule`); it has no end date ([recurring orders overview](https://docs.commercetools.com/api/recurring-orders-overview)).
- The **end date lives on the Recurring Order**: `RecurringOrderDraft.startsAt` / `expiresAt`, and the update action `setExpiresAt` (`{ action: "setExpiresAt", expiresAt }`) ([Recurring Orders API](https://docs.commercetools.com/api/projects/recurring-orders), OAS `api-RecurringOrder`). When the expiry is reached the Recurring Order becomes `Expired` and no order is created.
- **Create Order from Cart creates one Recurring Order per recurrence schedule found** ("grouped by their recurrence schedule"); the Recurring Orders API (`POST /recurring-orders`) instead needs a cart whose lines **all** share one schedule, and also accepts `startsAt`, `expiresAt`, `custom`. `Order.recurringOrder` and `Order.origin = RecurringOrder` mark generated orders; `RecurringOrder.originOrder` links back.
- `priceSelectionMode` (`Fixed` | `Dynamic`) is **beta** per line; Q-03 confirms it works in this project.

**Consequence, Planner default.** One monthly policy (`malva-monthly`, D-012) cannot give different monthly amounts for a 12, 24 and 36 month installment, because the price is chosen by policy and a plan of the same cadence would also be merged into the same Recurring Order (which could then not end at the device term). Therefore Q seeds **four additional policies**, all `StandardSchedule { value: 1, intervalUnit: "Months" }`:

| Key | Used for | Name en-US / de-DE |
| --- | --- | --- |
| `malva-device-installment-12` | installments, 12 months | "Device installments, 12 months" / "Geräteraten, 12 Monate" |
| `malva-device-installment-24` | installments, 24 months | "Device installments, 24 months" / "Geräteraten, 24 Monate" |
| `malva-device-installment-36` | installments, 36 months | "Device installments, 36 months" / "Geräteraten, 36 Monate" |
| `malva-device-lease-24` | lease, 24 months | "Device lease, 24 months" / "Gerätemiete, 24 Monate" |

The term is **also** stored as `acquisitionTermMonths` (custom field) because the policy key is an implementation detail; a unit test asserts the term field equals the number in the policy key. Service lines keep `malva-monthly` (D-012); the plan and the device are different commitments and become **different Recurring Orders** (so cancelling or ending one never touches the other; this answers the spec question "can either be canceled alone": yes). **Risk:** if the platform groups by schedule *value* instead of by policy, the plan and the device would merge. Q-03 proves it in the live project. Fallback if it merges (record in `PROJECT-FINDINGS.md`, do not stop): leave `expiresAt` unset, rely on `acquisitionTermMonths` and `acquisitionEndDate` for the end of the device payments (account pages show "payment x of N" from dates), and flag it to the owner as a billing-system responsibility.

**Payments count.** The initial Order (paid at checkout) carries payment number 1 of the term. The Recurring Order then generates payments 2…N at `startsAt`, `startsAt + 1 month`, … (`nextOrderAt` table in the docs: the first generated order happens on `startsAt`). Q-03 measures what `startsAt` is for Orders created from a cart and writes the result as `FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER` in `lib/config/devices.ts` (default `2`). Expiry rule (pure function `computeRecurringExpiry`): `expiresAt = startsAt + (termMonths − FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER) months + 7 days`, i.e. after the last scheduled payment and well before the next one (the 7-day buffer absorbs month-end clamping and processing delay). After order creation the platform creates the Recurring Orders in the background (asynchronously): `applyDeviceRecurringExpiry(orderId)` (section 6) polls up to 5 times, 2 s apart, and is idempotent.

### 3. The price-fallback trap (must not silently resolve to outright)
Two independent guards, both mandatory:
1. **Availability guard (before the cart call).** A mode/term is offered for a variant only if the variant has a price for the market (country+currency) tied to the matching policy key. Missing price → mode/term unavailable (`MODE_UNAVAILABLE` / `TERM_UNAVAILABLE`, HTTP 409). Computed in `getAvailableModes(variant, market)`.
2. **Resolution guard (after the cart call).** After `addLineItem` the response line must satisfy `line.price.recurrencePolicy.id === policyIdFor(mode, term)` (the resolved `LineItem.price` carries `recurrencePolicy`; for outright it must be absent) **and** `line.recurrenceInfo` present (financed) or absent (outright). Otherwise the route removes the line again (same request, a second update) and answers HTTP 422 `PRICE_NOT_FOR_TERM`. The same function `assertPriceFromPolicy(line, expected)` runs again in `assertDeviceCartIntegrity(cart)`, which U calls before creating a checkout session (section 6). Never compare amounts to detect this; compare the policy.

### 4. Modes, amounts and wording (pure module `lib/devices/acquisition.ts`)
```ts
export type AcquisitionMode = 'outright' | 'installments' | 'lease';
export type InstallmentTerm = 12 | 24 | 36;
export type EndOfTerm = 'owned' | 'owned-after-final-payment' | 'return';
export interface LineAcquisition { mode: AcquisitionMode; termMonths: number /* 0 for outright */; endOfTerm: EndOfTerm; endDate?: string /* ISO date: final payment (installments) or return-by date (lease) */; financingDecisionId?: string }
export interface DevicePrices { outright?: Money; installments: Partial<Record<InstallmentTerm, Money>>; lease: Partial<Record<24, Money>> }
export interface AcquisitionQuote { mode; termMonths; dueNow: Money; recurring?: { amount: Money; payments: number /* total payments incl. the first */; remaining: number /* payments after today */ }; totalPayable: Money; endOfTerm: EndOfTerm; endDate?: string }
export function policyKeyFor(mode: AcquisitionMode, termMonths: number): string | null   // outright → null; installments,24 → 'malva-device-installment-24'; lease,24 → 'malva-device-lease-24'
export function getAvailableModes(prices: DevicePrices): { outright: boolean; installments: InstallmentTerm[]; lease: 24[] }
export function quoteAcquisition(prices: DevicePrices, mode: AcquisitionMode, termMonths: number, today: Date, quantity?: number): AcquisitionQuote   // throws AcquisitionError('MODE_UNAVAILABLE'|'TERM_UNAVAILABLE')
export function endOfTermFor(mode: AcquisitionMode): EndOfTerm        // outright 'owned', installments 'owned-after-final-payment', lease 'return'
export function computeEndDate(mode, termMonths, today): string | undefined   // installments: today + (term−1) months; lease: today + (term−1) months + 30 days (RETURN_WINDOW_DAYS)
export function computeRecurringExpiry(startsAt: Date, termMonths: number): Date
export function readAcquisition(custom: Record<string, unknown> | undefined): LineAcquisition | null   // reads the line custom fields; NEVER infers from price
```
**Due now / recurring (Planner default, answers "Full price, a deposit or nothing"):** outright → `dueNow` = full price, no recurring part. Installments and lease → **no deposit; `dueNow` = the first monthly payment** (the initial Order contains the recurring line at its price, so the buyer pays payment 1 at checkout); recurring = same amount, `payments = term`, `remaining = term − 1`. `totalPayable = monthly × term`.

**End-of-term obligation (Planner default):** outright: "You own the device from day one." Installments: "You own the device after your final payment on {date}." Lease: "At the end of the lease you must return the device by {date} (within 30 days of your final payment)." The date is shown as an **estimate computed from today** at review ("if you order today"), and fixed at the moment the financing decision is recorded (section 5), where `acquisitionEndDate` is written to the line.

**Line custom fields (type `malva-line-item`, G owns the type; Q ensures fields, section 7).** `offerKey` (String), `acquisitionMode` (Enum `outright|installments|lease`), `acquisitionTermMonths` (Number, 0 for outright), plus **Q adds**: `acquisitionEndOfTerm` (Enum `owned|owned-after-final-payment|return`), `acquisitionEndDate` (Date, optional), `financingDecisionId` (String, optional).

### 5. Financing decision (stub) — `lib/devices/financing.ts` (pure, no I/O)
Planner defaults for the four spec open questions:
1. **Who owns the financing agreement and credit decision, and when:** the decision is a Malva-side interface with a deterministic stub (D-015). It is evaluated **when the buyer clicks "Continue to payment" on `/bundle/checkout`** (workstream U), re-evaluated **server-side again inside `POST /api/checkout/session`** (never trusting the client), and only an `approved` decision lets the session be created. The agreement of record is the order line's custom fields plus `financingDecisionId`.
2. **Can the mode change after the order is placed:** **No** (D-040: no plan changes post-purchase; only cancel before service start and device return within 30 days). The remaining term is unaffected.
3. **How a leased device is tracked as an asset:** **not tracked in v1.** The asset reference is the order number + line item id with `acquisitionMode = lease`; no serial number is captured (no real asset/OMS system, D-059). A real serial would be a new custom field written by a fulfillment system.
4. **Financed device + service commitment, cancel either alone:** **Yes.** They are separate lines with separate policies and (per section 2) separate Recurring Orders. V's v1 cancel works on the whole order before service start; after that nothing in v1 cancels one or the other.

```ts
export type CreditFlag = 'approve' | 'decline';          // Customer custom field malva-customer.creditCheck; absent = 'approve'
export interface FinancingLine { lineId: string; mode: 'installments' | 'lease'; termMonths: number; quantity: number; monthly: Money }
export interface FinancingRequest { customerId: string | null; creditFlag: CreditFlag | null; currency: 'USD' | 'EUR'; lines: FinancingLine[] }
export type FinancingReason = 'ok' | 'no-financed-lines' | 'sign-in-required' | 'customer-declined' | 'amount-over-limit';
export interface FinancingDecision { decisionId: string; outcome: 'approved' | 'declined' | 'sign-in-required'; reason: FinancingReason; financedTotal: Money; limit: Money; decidedAt: string /* ISO */ }
export interface FinancingProvider { decide(req: FinancingRequest): Promise<FinancingDecision> }
export function getFinancingProvider(): FinancingProvider    // returns the stub; no env var in v1
export const FINANCING_LIMIT_CENTS = { USD: 250000, EUR: 230000 } as const   // in lib/config/devices.ts
```
Stub rules, evaluated in this order: (a) no financed lines → `approved`, reason `no-financed-lines`; (b) `customerId === null` → `sign-in-required` (a credit decision needs an identified customer; guests may still buy outright, D-035); (c) `creditFlag === 'decline'` → `declined`, `customer-declined`; (d) `financedTotal = Σ monthly × termMonths × quantity` greater than the limit → `declined`, `amount-over-limit`; else `approved`, `ok`. `decisionId = 'stub-' + fnv1a32(customerId|currency|sorted "lineId:mode:term:qty:cents").toString(16).padStart(8,'0')` (deterministic, pure, no `crypto`). Examples with USD: 2 × Nova Pro 512 GB installments 36 = 2 × 3300 × 36 = 237600 → approved; 3 × = 356400 → declined `amount-over-limit`.

`lib/ct/devices.ts` also exposes `recordFinancingDecision(cartId, decision)`: on `approved` it writes `financingDecisionId` and `acquisitionEndDate` onto each financed line (`setLineItemCustomField`), so the order carries them. Route `POST /api/devices/financing/decision` (Q, new) runs the decision for the signed-in session's cart and returns `{ decision }`; U calls the same server function directly (no HTTP) and handles the three outcomes: `approved` → continue; `declined` → show `FinancingDecisionNotice` (Q component) with the reason and a button "Pay in full instead" per financed line (calls PATCH below); `sign-in-required` → redirect to `/login?returnTo=/bundle/checkout`.

### 6. Code layout (all new files are in Q's area unless marked "append")
```
lib/config/devices.ts              constants: RETURN_WINDOW_DAYS = 30, INSTALLMENT_TERMS = [12,24,36], LEASE_TERMS = [24], MAX_DEVICE_QUANTITY = 3, FINANCING_LIMIT_CENTS, FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER = 2, POLICY_CACHE_SECONDS = 300, EXPIRY_BUFFER_DAYS = 7, DEVICE_POLICY_KEYS
lib/devices/acquisition.ts         section 4
lib/devices/summary.ts             summarizeByMode(lines): totals per mode (Mixed modes)
lib/devices/cart-actions.ts        buildAddDeviceActions, buildChangeModeActions, assertPriceFromPolicy, assertDeviceCartIntegrity
lib/devices/financing.ts           section 5
lib/ct/devices.ts                  server-only: getDevicePolicyMap, getDeviceOffers, recordFinancingDecision, getCreditFlag, applyDeviceRecurringExpiry
lib/mappers/device.ts              projection -> DeviceOffer
lib/types.ts                       append section "// ---- Q: devices ----": LineAcquisition, DeviceOffer, DeviceVariant, AcquisitionQuote, FinancingDecision
app/api/cart/devices/route.ts                 POST add
app/api/cart/devices/[lineId]/route.ts        PATCH change mode/term
app/api/devices/financing/decision/route.ts   POST decision
components/devices/{DeviceCard,DevicePicker,AcquisitionModePicker,AcquisitionSummary,EndOfTermNotice,AcquisitionLine,AcquisitionTotals,FinancingDecisionNotice}.tsx
hooks/useDeviceActions.ts          addDeviceLine, changeAcquisition (calls the routes, writes the returned Cart into M's cart cache key)
scripts/seed/data/devices.ts       policies + price tables above (typed, tested)
scripts/seed/devices.ts            idempotent seeder, `npm run seed:devices`
scripts/spikes/device-recurrence.ts  live spike (Q-03)
scripts/seed/create-financing-customers.ts  two test customers (Q-12)
```
**Appends to other workstreams' files (only these):** `components/offers/OfferGrid.tsx` (N) one branch rendering `DeviceCard` when `offer.kind === 'device'`; `lib/mappers/cart.ts` (M) maps `line.acquisition = readAcquisition(custom.fields)`; `lib/types.ts` cart line type gets `acquisition?: LineAcquisition`; `components/bundle/BundleLine.tsx` (M) renders `AcquisitionLine` for lines with `acquisition`; `package.json` script `seed:devices`; `lib/ct/recurring.ts` (L) is only **read**, never edited. If M's/N's actual export names differ from the ones Q uses below, use theirs (open their workstream file first); the behaviour does not change.

**Interfaces Q needs from other workstreams (name them as found in their files):** from M `lib/ct/cart.ts`: a function that gets the session's cart (creating it if absent) and a function that applies update actions with the version-conflict retry (below called `getOrCreateCart(session)` and `updateCart(cartId, actions)`), the mapped `Cart` type, and the cart cache key `KEY_CART` in `hooks/useCart.ts`; from N: the `OfferGrid` card switch point; from L: the `malva-monthly` policy exists and `lib/pricing/priceMode.ts`'s rule that committed terms use `Fixed` (Q uses `Fixed` for installments and lease); from E: `getSession()`; from H: `Offer`/`OfferVariant` types, `formatMoney`, `getLocalizedString`.

**Cart actions (verified in OAS `api-Cart-write`: `addLineItem` accepts `sku`, `quantity`, `recurrenceInfo`, `custom`; `removeLineItem` takes `lineItemId`, `quantity` optional).** Add financed line:
```json
{ "action": "addLineItem", "sku": "<variant sku>", "quantity": 1,
  "recurrenceInfo": { "recurrencePolicy": { "typeId": "recurrence-policy", "key": "malva-device-installment-24" }, "priceSelectionMode": "Fixed" },
  "custom": { "type": { "typeId": "type", "key": "malva-line-item" },
              "fields": { "offerKey": "malva-offer-phone-nova-pro", "acquisitionMode": "installments", "acquisitionTermMonths": 24, "acquisitionEndOfTerm": "owned-after-final-payment" } } }
```
Outright: no `recurrenceInfo`, fields `acquisitionMode: "outright"`, `acquisitionTermMonths: 0`, `acquisitionEndOfTerm: "owned"`. **Changing the mode = one update with two actions: `removeLineItem` (the old line) then `addLineItem` (same sku and quantity, new mode)**; never patch recurrence on an existing line (the price must be re-resolved from scratch and the guard re-run). The line id changes; M's cart mapper keeps display order by `addedAt`, so the line stays where it was only if `addedAt` is passed: Q passes the old line's `addedAt` in the new `addLineItem`.

**Routes (JSON; errors `{ error: { code, message, details? } }`, E's `ApiError`; success returns the full mapped `Cart` like every cart route):**
- `POST /api/cart/devices` body `{ offerKey: string, sku: string, quantity: 1|2|3, mode: AcquisitionMode, termMonths: number }` → 200 `Cart` | 400 `INVALID_INPUT` | 404 `OFFER_NOT_FOUND` | 409 `MODE_UNAVAILABLE` (`details.available: AcquisitionMode[]`, message "Lease is not available for Nova 5G. Available: pay in full, installments.") | 409 `TERM_UNAVAILABLE` (`details.availableTerms`) | 422 `PRICE_NOT_FOR_TERM`.
- `PATCH /api/cart/devices/[lineId]` body `{ mode, termMonths }` → same codes + 404 `LINE_NOT_FOUND` (line not in the session's cart) + 400 `NOT_A_DEVICE_LINE`.
- `POST /api/devices/financing/decision` → 200 `{ decision }`; 401 `{ error: { code: 'UNAUTHENTICATED' } }` is **not** used: anonymous visitors get 200 with `outcome: 'sign-in-required'`.

**UI (undrawn: Junior design choice, D-068).** Design it from tokens and `components/ui` and document the choice here; one-line rationale in the PR/commit message. Device card (`DeviceCard`): honey header band `--color-surface-brand` with name and tag, image slot 4:3, `DevicePicker` (two `radiogroup`s of filter-chip pills: "Color", "Memory"; `aria-checked`, arrow-key navigation), `AcquisitionModePicker` (three radio cards: "Pay in full", "Installments", "Lease"; when installments is chosen a second chip row "12 months / 24 months / 36 months"), `AcquisitionSummary` (rows "Due today", "Then", "Total payable", `EndOfTermNotice`), quantity stepper 1–3, pill CTA "Add to bundle" (action color `--color-action`). Unavailable modes/terms render **disabled with a visible reason** ("Not available for Nova 5G"), never hidden. Card headline price: "From {lowest installment-36 monthly across variants}/mo" and below "or {lowest outright} outright" (Nova 5G: "From $20.00/mo", "or $720.00 outright"; Nova Pro: "From $28.00/mo", "or $1,008.00 outright"). Card is a Client Component only for the pickers; the data comes from the server (`getDeviceOffers`). Selected state is in component state plus URL query `?offer=<key>` anchor from N is respected.

**Messages (namespace `devices`, both locales).**
| Key | en-US | de-DE |
| --- | --- | --- |
| `from` | From {price}/mo | Ab {price}/Monat |
| `orOutright` | or {price} outright | oder {price} bei Einmalzahlung |
| `color` / `memory` | Color / Memory | Farbe / Speicher |
| `memoryValue` | {gb} GB | {gb} GB |
| `mode.label` | How do you want to pay? | Wie möchten Sie zahlen? |
| `mode.outright` / `mode.installments` / `mode.lease` | Pay in full / Installments / Lease | Einmalzahlung / Ratenzahlung / Miete |
| `term.label` | Installment term | Laufzeit der Raten |
| `term.months` | {months} months | {months} Monate |
| `summary.dueToday` | Due today | Heute fällig |
| `summary.then` | Then {price}/mo for {count} more months | Danach {price}/Monat für weitere {count} Monate |
| `summary.total` | Total payable: {price} | Gesamtbetrag: {price} |
| `endOfTerm.owned` | You own the device from day one. | Das Gerät gehört Ihnen ab dem ersten Tag. |
| `endOfTerm.ownedAfterFinalPayment` | You own the device after your final payment on {date}. | Das Gerät gehört Ihnen nach der letzten Rate am {date}. |
| `endOfTerm.return` | At the end of the lease you must return the device by {date} (within 30 days of your final payment). | Am Ende der Mietzeit müssen Sie das Gerät bis zum {date} zurückgeben (innerhalb von 30 Tagen nach der letzten Rate). |
| `estimate` | Estimated, if you order today. | Voraussichtlich, wenn Sie heute bestellen. |
| `add` | Add to bundle | In mein Paket |
| `unavailable` | {mode} is not available for {device}. Available: {modes}. | {mode} ist für {device} nicht verfügbar. Verfügbar: {modes}. |
| `termUnavailable` | The {months}-month term is not available for this color and memory. | Die Laufzeit von {months} Monaten ist für diese Farbe und diesen Speicher nicht verfügbar. |
| `change` | Change how you pay | Zahlungsart ändern |
| `financing.declinedTitle` | We could not approve financing for this bundle. | Die Finanzierung für dieses Paket konnte nicht genehmigt werden. |
| `financing.amountOverLimit` | The financed total is above your limit of {limit}. | Der finanzierte Gesamtbetrag liegt über Ihrem Limit von {limit}. |
| `financing.customerDeclined` | Financing is not available for this account. | Für dieses Konto ist keine Finanzierung verfügbar. |
| `financing.payInFull` | Pay in full instead | Stattdessen in einer Summe zahlen |
| `totals.byMode` | {mode}: {count} item(s), due today {due}, monthly {monthly} | {mode}: {count} Artikel, heute fällig {due}, monatlich {monthly} |
`{mode}` in `unavailable`/`totals.byMode` is the localized `mode.*` string; `{modes}` is a comma-joined list of them.

### 7. Seeder (`scripts/seed/devices.ts`, idempotent, D-054)
Uses F's admin-client factory and its project-key allow-list guard (the same import `scripts/seed/seed.ts` uses; open it first). Touches only `malva-*` keys. Steps: (1) create/update the four policies by key (`POST /recurrence-policies`; update schedule with `setSchedule` if different); (2) ensure fields on custom type `malva-line-item` (`addFieldDefinition` for `acquisitionEndOfTerm` Enum, `acquisitionEndDate` Date, `financingDecisionId` String; error out, never recreate, if the existing `acquisitionMode` enum lacks `outright|installments|lease`); (3) ensure field `creditCheck` (Enum `approve|decline`) on custom type `malva-customer`; (4) for each device offer variant add/change/remove embedded prices to match the table (`addPrice` with `recurrencePolicy: { typeId, key }` — verify field shape against OAS `api-Product` `ProductAddPriceAction`; `changePrice`, `removePrice`), then `publish`. Diff key = `(country, currency, recurrencePolicy key)`. Prints a table of what it changed. **Run it once with OA-03 done and record the result in `PROJECT-FINDINGS.md` §Q.**

### Pitfalls
- **Line merging:** commercetools merges `addLineItem` of the same variant into one line unless the lines differ in supply/distribution channel, shipping details or custom fields. Mode/term differ in custom fields, so two modes of the same SKU are two lines. Q-03 proves it; unit tests cannot.
- `Price` selection ignores the term custom field entirely; only the policy selects the price (section 3).
- Recurring Orders are created **asynchronously** after the Order; never read them in the same request that created the order without polling.
- `priceSelectionMode` is beta: record the Q-03 result; if it is rejected, record the fallback (no `priceSelectionMode`, platform default) in `PROJECT-FINDINGS.md` and ask.
- Inventory: handsets have inventory entries (D-019) but cart `InventoryMode` is `None`; do not add stock logic.
- Money: use `formatMoney(locale)`; compute totals from integers (`centAmount × payments × quantity`), never floats.
- Dates: do month arithmetic in UTC with day clamping (`Jan 31 + 1 month = Feb 28/29`); test it.
- Never put the stub in `app/` code: only `lib/devices/financing.ts`, so a real provider replaces it in one place.
- `lib/ct/devices.ts` starts with `import 'server-only'`; `lib/devices/*` is pure and may be imported by client components.

## Tasks
- [x] Q-01 Create `lib/config/devices.ts` and `lib/devices/acquisition.ts` (section 4: `policyKeyFor`, `getAvailableModes`, `quoteAcquisition`, `endOfTermFor`, `computeEndDate`, `computeRecurringExpiry`, `readAcquisition`, `AcquisitionError`) and append the Q types to `lib/types.ts`; `lib/devices/summary.ts` with `summarizeByMode`. Tests: `lib/devices/acquisition.test.ts`, `lib/devices/summary.test.ts` (table-driven from the price table, including month-end clamping and the Nova 5G 256 Silver 36-month hole).
- [x] Q-02 [SKILL: commercetools-commerce-patterns] Write `scripts/seed/data/devices.ts` (policies, price tables USD/EUR, the deliberate hole) and `scripts/seed/devices.ts` (section 7) with `npm run seed:devices`; `scripts/seed/devices.test.ts` (every installment × term = outright; lease totals; no price has a channel; hole present; dry-run plan against a mocked admin root produces the expected add/change/remove actions and is empty on a second run). Run it live (needs OA-03) and record the result in `PROJECT-FINDINGS.md` §Q.
- [x] Q-03 [SKILL: commercetools-commerce-patterns] Spike `scripts/spikes/device-recurrence.ts` (needs OA-02 + OA-03; uses the admin client; creates a throwaway customer `qa-q-<hex>@example.com`, a cart with one `malva-monthly` plan line and one `malva-device-installment-24` line plus one outright line of another SKU in a separate run, creates the Order, polls recurring orders by `originOrder`, calls `setExpiresAt`, then deletes what it can). Record in `PROJECT-FINDINGS.md` §Q: (a) `priceSelectionMode` accepted; (b) number of Recurring Orders produced (expected 2: plan, device) and their `schedule`; (c) `startsAt` / `nextOrderAt` relative to the order date and therefore the value of `FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER`; (d) `setExpiresAt` accepted; (e) two lines of the same SKU in different modes stay separate lines; (f) `line.price.recurrencePolicy` is present on a resolved financed line and absent on outright; (g) a financed line for the Nova 5G 256 Silver 36-month hole resolves to the one-time price (proof of the trap). Update `lib/config/devices.ts` with the measured constant. If (b) is 1, apply the fallback in section 2 and record it.
- [x] Q-04 [SKILL: commercetools-platform] Write `lib/ct/devices.ts` (`getDevicePolicyMap` cached `POLICY_CACHE_SECONDS`, `getDeviceOffers(market)` via product projections with predicate `masterVariant(attributes(name="offer-kind" and value(key="device")))`, `getCreditFlag(customerId)`, `applyDeviceRecurringExpiry(orderId)`) and `lib/mappers/device.ts` (projection → `DeviceOffer`, localized strings, prices filtered by the market's country+currency, policy id → key). Tests: `lib/mappers/device.test.ts` (fixture projection), `lib/ct/devices.test.ts` (mocked SDK: expiry is set once and only on Recurring Orders whose cart contains device lines; idempotent; polling gives up after 5 tries without throwing).
- [x] Q-05 [SKILL: commercetools-storefront] Write `lib/devices/cart-actions.ts` (`buildAddDeviceActions`, `buildChangeModeActions` = remove + add keeping `addedAt`, `assertPriceFromPolicy`, `assertDeviceCartIntegrity`). Tests in `lib/devices/cart-actions.test.ts`: action JSON equals the section 6 snippets; outright has no `recurrenceInfo`; fallback trap detected when the resolved price has no policy or another policy.
- [x] Q-06 [SKILL: commercetools-storefront] Routes `POST /api/cart/devices` and `PATCH /api/cart/devices/[lineId]` using M's cart helpers, availability guard before and resolution guard after (rollback via `removeLineItem`). Tests: `app/api/cart/devices/route.test.ts`, `app/api/cart/devices/[lineId]/route.test.ts` (success, `MODE_UNAVAILABLE` naming the available modes, `TERM_UNAVAILABLE`, `PRICE_NOT_FOR_TERM` with rollback, line not in cart, quantity 4 rejected).
- [x] Q-07 Write `lib/devices/financing.ts` (stub per section 5), `recordFinancingDecision` in `lib/ct/devices.ts` and route `POST /api/devices/financing/decision`. Tests: `lib/devices/financing.test.ts` (all four rules in order, determinism of `decisionId`, EUR limit, examples), `app/api/devices/financing/decision/route.test.ts` (anonymous → `sign-in-required` 200; flag decline; over limit; approved writes `financingDecisionId` through the mocked cart helper).
- [x] Q-08 Append the mapper line to `lib/mappers/cart.ts` (`acquisition`) and to the cart line type; add `lib/ct/devices.ts#assertDeviceCartIntegrity` export wiring for U. Tests: `lib/mappers/cart.device.test.ts` (fixture cart with outright + installments lines → both lines carry their own `acquisition`; a line with a misleading price but mode installments still reads installments).
- [x] Q-09 Components `DeviceCard`, `DevicePicker`, `AcquisitionModePicker`, `AcquisitionSummary`, `EndOfTermNotice` + messages `devices.*` in both locales. Tests: `components/devices/DeviceCard.test.tsx`, `components/devices/EndOfTermNotice.test.tsx` (keyboard radio behaviour, disabled lease on Nova 5G with reason, summary numbers per mode, estimate label).
- [x] Q-10 Hook `hooks/useDeviceActions.ts`; wire `DeviceCard` into N's `OfferGrid` (branch on `offer.kind === 'device'`, data from `getDeviceOffers` in the listing page for the `phones-and-devices` slug). Tests: `hooks/useDeviceActions.test.tsx` (writes the returned cart into the cart cache; surfaces `MODE_UNAVAILABLE` message), `components/offers/OfferGrid.device.test.tsx`.
- [x] Q-11 Components `AcquisitionLine` (mode, term, amounts, end-of-term, "Change how you pay" with the same picker, calls PATCH), `AcquisitionTotals` (per-mode totals), append branch to M's `BundleLine`. Tests: `components/devices/AcquisitionLine.test.tsx`, `components/devices/AcquisitionTotals.test.tsx`.
- [ ] Q-12 Component `FinancingDecisionNotice` (for U) and `scripts/seed/create-financing-customers.ts` (creates `qa-fin-ok-<hex>@example.com` and `qa-fin-declined-<hex>@example.com`, flag `creditCheck = decline` on the second, passwords generated and printed to the console only; satisfies `lib/config/password.ts` from R if present, else 12 chars with upper, lower, digit; deletes nothing). Tests: `components/devices/FinancingDecisionNotice.test.tsx`, `scripts/seed/create-financing-customers.test.ts` (drafts only).
- [ ] Q-13 Messages review (every `devices.*` key exists in both locales), a11y pass (axe-style assertions in component tests), `PROJECT-FINDINGS.md` §Q complete, run `npm run verify`, set STATUS to `Ready for review`.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Same device three modes | `device-acquisition-mode` | `lib/devices/acquisition.test.ts` → "Same device three modes: outright is due in full, installments and lease show the first payment due now and the monthly amount with its term"; `components/devices/DeviceCard.test.tsx` → "Same device three modes: switching mode updates due today, monthly and total" |
| Mixed modes in one order | `device-acquisition-mode` | `lib/devices/summary.test.ts` → "Mixed modes in one order: totals are stated per mode and each line keeps its own mode and term"; `lib/mappers/cart.device.test.ts` → "Mixed modes in one order: outright and installments lines each carry their own acquisition" |
| Mode unavailable for this device | `device-acquisition-mode` | `app/api/cart/devices/route.test.ts` → "Mode unavailable for this device: lease on Nova 5G is refused with 409 naming outright and installments"; `components/devices/DeviceCard.test.tsx` → "Mode unavailable for this device: lease is disabled with a visible reason" |
| End of term obligation disclosed | `device-acquisition-mode` | `components/devices/EndOfTermNotice.test.tsx` → "End of term obligation disclosed: lease states the return-by date, installments the ownership date, outright ownership from day one"; `lib/devices/acquisition.test.ts` → "End of term obligation disclosed: lease return date is final payment plus 30 days" |
| Mode persisted to the order | `device-acquisition-mode` | `lib/devices/cart-actions.test.ts` → "Mode persisted to the order: add action writes mode, term, end of term and offer key as line custom fields"; `lib/devices/acquisition.test.ts` → "Mode persisted to the order: readAcquisition returns mode and term from custom fields and never infers them from the price" |
| Mode changed before checkout | `device-acquisition-mode` | `app/api/cart/devices/[lineId]/route.test.ts` → "Mode changed before checkout: the line is removed and re-added in one update, repriced, with the new term"; `components/devices/AcquisitionLine.test.tsx` → "Mode changed before checkout: due now, recurring amount and term are restated" |
| Handset is one product with its options as variants (verified here, built by G) | `telecom-catalog-model` | `lib/mappers/device.test.ts` → "Handset is one product with its options as variants: colors and memories are variants of one offer and no mode is a variant" |

Additional non-scenario tests that must exist: price-fallback guard (`lib/devices/cart-actions.test.ts` → "price fallback: a financed line that resolved to the outright price is rejected"), `scripts/seed/devices.test.ts` (data invariants), `lib/devices/financing.test.ts` (stub rules).

## Chrome verification (run by Claude)
- C-Q-1 (needs OA-02, OA-03, G, N): open `http://localhost:3000/en-US/shop/phones-and-devices` at 1440 px → heading for phones and devices, two device cards "Nova 5G" and "Nova Pro" in the generic grid; Nova 5G shows "From $20.00/mo" and "or $720.00 outright", Nova Pro "From $28.00/mo" and "or $1,008.00 outright"; no console errors; no failed network requests; the Product Search/projection requests return 200.
- C-Q-2 (needs C-Q-1): on the Nova Pro card click Memory "512 GB" then Color "Violet" → chips show `aria-checked="true"`, the card's price panel updates to the 512 GB prices (pay in full $1,188.00); switching to 256 GB returns $1,008.00; arrow keys move the selection inside each radio group.
- C-Q-3 (needs C-Q-1): Nova Pro 256 GB Black, quantity 1: "Pay in full" → Due today $1,008.00 and no "Then" row; "Installments" + "24 months" → Due today $42.00, "Then $42.00/mo for 23 more months", "Total payable: $1,008.00", end-of-term "You own the device after your final payment on {date}." with the estimate label; "36 months" → $28.00 and "35 more months"; "Lease" → Due today $33.00, "Then $33.00/mo for 23 more months", "Total payable: $792.00", end of term "At the end of the lease you must return the device by {date} (within 30 days of your final payment)." where {date} is today + 23 months + 30 days.
- C-Q-4 (needs C-Q-1): Nova 5G card → the "Lease" option is disabled and shows "Not available for Nova 5G" (or the localized equivalent); via `evaluate_script` `fetch('/api/cart/devices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offerKey:'malva-offer-phone-nova-5g',sku:<a Nova 5G sku read from the page data or MCP>,quantity:1,mode:'lease',termMonths:24})})` → HTTP 409 `error.code = "MODE_UNAVAILABLE"` and `error.details.available` equal to `["outright","installments"]`; the cart is unchanged.
- C-Q-5 (needs C-Q-1, Q-02 live): Nova 5G 256 GB Silver → in Installments the "36 months" chip is disabled with the reason; other colors/memories have all three terms; POST the same variant with `termMonths: 36` → 409 `TERM_UNAVAILABLE`.
- C-Q-6 (needs C-Q-1, M): add Nova Pro 256 GB Black "Pay in full", then Nova Pro 512 GB Silver "Installments 24 months" → "My bundle" (`/en-US/bundle`) shows both device lines, each with its own mode, term and amounts; the per-mode totals block states "Pay in full: 1 item(s), due today $1,008.00, monthly $0.00" and "Installments: 1 item(s), due today $49.50, monthly $49.50" (the wording from `devices.totals.byMode`); network: the two POST `/api/cart/devices` return 200 with the full cart; with the commerce MCP `read_carts` on the session cart: line 1 `custom.fields.acquisitionMode = outright`, no `recurrenceInfo`; line 2 `acquisitionMode = installments`, `acquisitionTermMonths = 24`, `recurrenceInfo.recurrencePolicy` = policy `malva-device-installment-24`, `priceSelectionMode = Fixed`, and `price.recurrencePolicy` set to that same policy with `centAmount 4950`.
- C-Q-7 (needs C-Q-6): in `/en-US/bundle` on the installments line choose "Change how you pay" → "Lease" → the line is repriced to $39.00/mo, the term restated as 24 months, totals block updated; PATCH `/api/cart/devices/<lineId>` returns 200; `read_carts` shows the new line with `acquisitionMode = lease`, policy `malva-device-lease-24`, `centAmount 3900`, and the old line gone; then change back to "Pay in full" → no `recurrenceInfo`, price `118800`, `acquisitionTermMonths = 0`.
- C-Q-8 (needs C-Q-6, spike done): `read_recurrence_policies` lists `malva-monthly`, `malva-device-installment-12`, `-24`, `-36`, `malva-device-lease-24`, each Months/1; `read_product_projections` for `malva-offer-phone-nova-pro` shows, for each variant, a one-time price and the recurring prices of the table with `recurrencePolicy` set and none with a `channel`.
- C-Q-9 (needs R, C-Q-6): sign in as the `qa-fin-ok-*` customer (run `npx tsx scripts/seed/create-financing-customers.ts`, read the printed credentials), keep an installments line in the cart, then via `evaluate_script` `fetch('/api/devices/financing/decision',{method:'POST'})` → 200 `decision.outcome = "approved"`, `reason = "ok"`; after it the cart line carries `financingDecisionId` and `acquisitionEndDate` (check with `read_carts`). Add 3 × Nova Pro 512 GB installments 36 → outcome `declined`, reason `amount-over-limit`, `financedTotal.centAmount = 356400`, `limit.centAmount = 250000`. Sign in as `qa-fin-declined-*` with one cheap installments line → `declined`, `customer-declined`. Signed out (new anonymous session) with an installments line → `sign-in-required`; with only outright lines → `approved`, `no-financed-lines`.
- C-Q-10 (needs C-Q-1): at 375 px width `/en-US/shop/phones-and-devices` → cards stack in one column, no horizontal scroll, chips wrap, the mode radio cards stack, the CTA is full width and reachable; screenshot taken by Claude; owner may comment (D-068).
- C-Q-11 (needs C-Q-3): `/de-DE/shop/phones-and-devices` → copy is German per the table ("Ab 20,00 €/Monat" style via `formatMoney`, "Heute fällig", "Ratenzahlung", "Miete"); dates in German format; no raw message keys visible.
- C-Q-12 (needs C-Q-3): Lighthouse accessibility on the listing page ≥ 95; radiogroups have accessible names; the focus ring is visible on chips and the CTA.

## Manual tests (owner only)
- M-Q-2 (needs OA-03): confirm the demonstration price table (section 1, USD/EUR) and the stub limit (USD 2,500 / EUR 2,300) are acceptable as demo data → reply in `TODO-MANUAL-TESTING.md`.

## Excluded
- Per-channel handset price (AT&T style call-center price below web price): not built, Planner default (section 1); channel offers use `eligibility-gated-offer` (K).
- A real credit bureau / financing provider, asset (serial) tracking of leased devices, and changing the mode after the order is placed: out of scope (D-040, D-059).
- Billing of the installments by an external system: the platform's Recurring Order generates the payments; no invoice or billing integration (D-059).
- No scenario of `device-acquisition-mode` is excluded; all six are built.

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test.
- [ ] C- and M- lines present; STATUS set to `Ready for review`; screenshots taken by Claude (C- checks); owner may comment (D-068).
- [ ] `PROJECT-FINDINGS.md` §Q records the spike results (a)–(g) and the measured `FIRST_GENERATED_ORDER_IS_PAYMENT_NUMBER`.
- [ ] A financed line can never resolve to the outright price without a 422 and rollback (test + C-Q-5).
