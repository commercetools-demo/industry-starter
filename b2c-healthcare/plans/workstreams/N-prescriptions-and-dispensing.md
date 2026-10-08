# Workstream N — Prescription lookup and dispensing rules

**Depends on:** F, G, H, J
**Implements:** design-plp[Prescription lookup by RX number], prescription-bound-supply, dispensing-quantity-limit, expiry-dated-supply
**Skills:** commercetools-commerce-patterns, commercetools-storefront, commercetools-platform

## Design
Page `/[locale]/prescriptions` (sign-in required, reason "Sign in to look up your prescriptions."). Lookup `POST /api/prescriptions/lookup { rx }`: normalise (`rx 48213`, `RX48213` → `RX-48213`), rate-limit (F-05), read from the `PrescriptionSource` (F-01); **unknown and foreign RX return the identical response** and the same message "We couldn't find “<input>”. Check the number printed on your prescription." (input HTML-escaped, never logged); the patient's own prescriptions are listed as quick-picks instead of the prototype's demo badges. Result card: RX number, "Prescribed by <doctor> · <date>", badges "Patient: <name>" and "N refills left", select-all, one row per medication (checkbox, name, sig, "Qty N", price from the catalog), "N selected · $total" (total computed by the server from catalog prices — shown figure is informational; the platform cart is authoritative), "Add to cart". Rows that cannot be dispensed are shown **with a reason and cannot be selected**: no refills left (`RX-48213`), authorization expired (reason = expiry, not exhaustion), medication out of stock, per-cart ceiling / period ceiling reached ("N available"), short-dated / unmet shelf-life promise.
Rules (BFF-only enforcement, D-028, **documented gap**: direct API calls can bypass them — README + `plans/QUESTIONS.md` Q-005):
- **prescription-bound-supply**: supply only against an in-window authorization with remaining quantity ≥ requested; no partial supply (Q-038: refuse the line, state what remains); consumption happens **once at order placement** (Q workstream calls `consumeAuthorization(orderId, lines)`, idempotent on order id; the ledger is `malva-rx` `refillsLeft` plus a `malva-dispense-ledger` entry per order id); abandoned/removed cart consumes nothing; the order line stores `rxNumber`, `rxLineRef`, `prescribedQty` and dispensed qty (not sig/diagnosis); cancellation before `mlv-packed-shipped` restores the refill (S). Standing replenishment stops at the window (T).
- **dispensing-quantity-limit**: per-item `maxQtyPerOrder` via native inventory limit **and** a per-party, per-period ceiling (**calendar month**, stated in the UI; rolling windows are not used) counted from the `malva-dispense-ledger`; the refusal states the ceiling and what remains; a lowered ceiling is re-checked when the cart loads (O) and at order creation; override is B2C-excluded.
- **expiry-dated-supply**: product attribute `minRemainingShelfLifeDays` shown on the row ("Minimum N months of shelf life on delivery"); inventory entry custom field `expiryDate` (single worst-case date per location, Q-039); stock that cannot meet the promise is shown as short-dated with its actual expiry (demo SKU, own price via a second variant price channel `mlv-short-dated`) or excluded with a reason; lot and expiry recorded on the order line at placement (custom field `suppliedLots[]` set by `advance-order` in F-08/`packed` step) and re-checked before dispatch.
Add to cart (`POST /api/cart/rx-lines`) is implemented in O (cart core); N provides the validation function `validateRxSelection(patientRef, rx, lineRefs)` used by both.

## Tasks
- [x] N-01 `lib/dispense/rules.ts` pure functions: `checkAuthorization`, `checkCeiling`, `checkShelfLife` returning typed refusal reasons (`NO_REFILLS | EXPIRED | OUT_OF_STOCK | CEILING | SHELF_LIFE | OK` + remaining quantity) with table tests for every scenario of the three specs [SKILL: commercetools-commerce-patterns] [SPEC: prescription-bound-supply]
- [x] N-02 `lib/ct/dispense-ledger.ts`: read remaining, `consumeAuthorization(orderId, lines)` idempotent on order id (second call is a no-op), `restoreAuthorization(orderId)`; optimistic-concurrency tests with simulated version conflicts and retries [SKILL: commercetools-commerce-patterns] [SPEC: prescription-bound-supply]
- [x] N-03 Per-party/per-period ceiling: `lib/ct/ceilings.ts` (`getUsedInPeriod(patientRef, sku, month)`, written by N-02), tests: second order inside period refused on cumulative count, period rollover frees the ceiling, ceiling lowered while a cart is open [SKILL: commercetools-commerce-patterns] [SPEC: dispensing-quantity-limit]
- [x] N-04 Native limits: confirm the seed's `setInventoryLimits`, map `LineItemQuantityAboveLimit`-style platform errors to the same refusal message shape; test mapper [SKILL: commercetools-platform] [SPEC: dispensing-quantity-limit]
- [x] N-05 `lib/ct/shelf-life.ts`: promise computed from inventory `expiryDate` and `minRemainingShelfLifeDays`; short-dated presentation (actual expiry + own price), excluded stock with reason; "undated goods unaffected"; tests [SKILL: commercetools-commerce-patterns] [SPEC: expiry-dated-supply]
- [x] N-06 `POST /api/prescriptions/lookup` with normalisation, rate limit, identical not-found for foreign/unknown, no logging of input; tests per scenario incl. "same message for both" and 429 [SKILL: commercetools-storefront] [SPEC: design-plp]
- [x] N-07 `GET /api/prescriptions` (own prescriptions for quick-picks, no-store) and `validateRxSelection` used by O [SKILL: commercetools-storefront] [SPEC: prescription-bound-supply]
- [ ] N-08 Page `/prescriptions` + `RxLookupForm`, `RxResultCard`, `MedicationRow` (disabled-with-reason states, select-all, selected count and total, empty "Your medications will appear here after you search."), toast "Added to cart · View cart →" 5 s (wired to O's hook); tests [SPEC: design-plp]
- [ ] N-09 Order-line record shape `lib/dispense/line-record.ts` (`rxNumber`, `rxLineRef`, `prescribedQty`, `authorizationParams` copy, `suppliedLots[]`) + test that no `sig`/diagnosis/name-of-condition fields exist in the type; used by Q [SPEC: prescription-bound-supply]

## Scenarios
Every scenario is a unit test (or a scripted check) named after it.
<!-- SCENARIOS:BEGIN (generated by plans/verify-plan.mjs --sync) -->
#### design-plp › Prescription lookup by RX number
- [ ] Lookup
- [ ] Unknown or foreign RX
- [ ] Before searching
- [ ] Selection
- [ ] Add to cart
- [ ] Medication that cannot be dispensed
- [ ] Quick-pick badges
#### prescription-bound-supply › Supply bound to an authorization, and to what is left on it
- [ ] Supply within the authorization
- [ ] Request exceeds what remains
- [ ] Authorization outside its window
- [ ] Parameters readable from the order
- [ ] Abandoned cart consumes nothing
- [ ] Standing replenishment stops at the window
#### dispensing-quantity-limit › Quantity ceilings that hold across a period, not just a basket
- [ ] Order within the ceiling
- [ ] Single request exceeding the ceiling
- [ ] Second order inside the same period
- [ ] Request arriving outside the storefront
- [ ] Period rolls over
- [ ] Ceiling lowered while a cart is open
- [ ] Override where permitted
#### expiry-dated-supply › Remaining shelf life promised before buying, and kept afterwards
- [ ] Remaining life shown before commitment
- [ ] Account minimum excludes unsuitable stock
- [ ] Short dated stock offered on its own terms
- [ ] Supplied lot recorded
- [ ] Stock ages before dispatch
- [ ] Mixed lots on one line
- [ ] Undated goods unaffected
<!-- SCENARIOS:END -->

## Browser recipe
Claude as Sam: `/en-US/prescriptions` without a session → sign-in card with the reason; `rx 77102` → card with 3 refills, 2 medications; `RX-48213` → rows disabled "No refills left"; as Alex Chen look up `RX-77102` → the same not-found text as for `RX-00000`, and 6 attempts in 10 min → rate-limit message; Network shows no medication data in URLs; unchecking rows updates the selected count/total; short-dated demo SKU shows its expiry and price; MC MCP: `malva-rx` unchanged after lookups.

## Manual tests (owner-only)
None.

## Definition of done
JUNIOR-GUIDE §9, plus: README section "Known gap: limits bypassable through the API" (Q-005 = B).
