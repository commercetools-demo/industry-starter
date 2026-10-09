# Workstream U — Funding: cost-share, allowance, restricted tender, credentials

**Depends on:** N, O, Q, R, S
**Implements:** payer-and-patient-cost-share, benefit-allowance-drawdown, eligible-item-tender-restriction, credentialed-purchase-scope
**Skills:** commercetools-commerce-patterns, commercetools-checkout, commercetools-storefront

## Design
All four are **mock-backed** (Q-060…Q-065 defaults accepted). Each sits behind a server interface so a real system can replace it.
**1. Payer cost-share** (`lib/funding/`): `FundingResolver.resolve(patient, lines) → { perLine: [{ sku, covered, owed, status: 'covered'|'partly'|'not-covered' }], resolvedAt }` — demo rules by medication class (e.g. cardiovascular 80% covered, antibiotics 50%, OTC 0%) for patients with `custom.fundingScheme = 'demo-health-plan'` (Sam). Resolved split stored on the cart line: **unit price owed set as the external line price** (`setLineItemPrice`) and `custom.coveredAmount`; covered amount is **not** a Cart Discount. Cart UI shows both figures per line, "Not covered" for uncovered lines, two totals (you owe / plan covers) — "unpriced" (resolver failure) looks different from "not covered". Re-resolve on every cart change (adding a line can change cover), at cart load, and **again before order creation, comparing** with what the patient saw; mismatch ⇒ order refused with the new split shown. Resolver unavailable ⇒ state `unresolved`, Checkout disabled, **never** default to list price. A `RESOLVER_FORCE_FAIL=1` dev switch exists for the browser test.
**2. Benefit allowance** (`lib/ct/allowance.ts`): Custom Object per member per monthly cycle (`malva-allowance`, key `<patientRef>|YYYY-MM`, `{granted, consumed, lapsed}`) written under optimistic concurrency; seed $50.00/month for Sam. Drawn **first**, as its own **Payment** (`paymentMethodInfo.method = 'allowance'`) with `amountPlanned` = min(balance, total owed); remainder goes to the Checkout card payment (running out = part-payment, not refusal). Balance and "this order would consume $X" shown on the cart and checkout summary; forfeiture date and lapsing amount shown on `/account/allowance`; cycle reload by idempotent `scripts/reload-allowances.ts` (per member per cycle, run twice = same result; also a Netlify scheduled function) — unspent balance **forfeited**, no carry-over. Cancel/return restores to the cycle it came from if still open, otherwise reports "unrecoverable" (S hooks call `restoreAllowance`). Not withdrawable/transferable: no endpoint exists, a test asserts that attempts get 4xx.
**3. Eligible-item restricted tender** (Q-063): product attribute `hsaEligible` copied to the line (`custom.eligibleForRestricted`) at add time. Instrument "Health account card (demo)" is a Payment with `method = 'restricted-health-account'`, capped at the **eligible subtotal** (discount apportioned pro rata; shipping never eligible); wholly eligible → settles everything; mixed → split; wholly ineligible → instrument unavailable with the reason; basket change re-splits both amounts before payment; order lines record `eligibleForRestricted` and which instrument settled each; refund returns qualifying value to the restricted instrument and the rest to the card. Tender order: allowance → restricted → card (Q-064).
**4. Credentialed purchase scope** (Q-065): products with `controlClass` set require the patient to hold a **valid credential** (`CredentialSource`, F-01) whose `class` covers the product's class; refusal distinguishes **no credential / wrong scope / expired / verification pending**; shown but unavailable with the requirement stated (not hidden); re-checked at order placement; credential id + `validTo` copied onto the order line (not a live reference); uncontrolled goods unaffected. Seed gives Sam a valid credential for `schedule-iv`, Jordan a pending one, Alex none.
Order meta: `custom.mlv-order-meta` records `allowanceApplied` and `restrictedApplied`.

## Tasks
- [x] U-01 `lib/funding/resolver.ts` interface + demo implementation + failure mode; table tests per medication class and `unresolved` [SKILL: commercetools-commerce-patterns] [SPEC: payer-and-patient-cost-share]
- [x] U-02 Cart integration: set external line price + `coveredAmount`, re-resolve on every cart mutation/load, response shape with `youOwe`/`planCovers`; tests incl. basket change altering cover on an existing line [SKILL: commercetools-commerce-patterns] [SPEC: payer-and-patient-cost-share]
- [x] U-03 Pre-order re-resolve + compare in `placeOrder` (Q-05), `unresolved` blocks checkout; tests "figures unchanged between review and payment" and "resolver unavailable" [SKILL: commercetools-checkout] [SPEC: payer-and-patient-cost-share]
- [x] U-04 Cart/checkout UI for two figures, "Not covered" vs "unresolved" visuals; tests [SPEC: payer-and-patient-cost-share]
- [x] U-05 `lib/ct/allowance.ts`: balance, `drawdown(orderId, amount)` idempotent on order id with version-conflict retry, `restoreAllowance`, `grantCycle` idempotent; tests: covers/partly covers/concurrent orders/return to open vs closed cycle [SKILL: commercetools-commerce-patterns] [SPEC: benefit-allowance-drawdown]
- [x] U-06 Allowance as its own Payment before the card in `placeOrder`; remainder amount to the Checkout payment; tests incl. "allowance covers the order → no other tender taken" [SKILL: commercetools-checkout] [SPEC: benefit-allowance-drawdown]
- [x] U-07 `scripts/reload-allowances.ts` + Netlify scheduled function wrapper; tests: run twice = once, forfeit not carried; `/account/allowance` page with lapsing amount/date; "not cash" test [SKILL: commercetools-commerce-patterns] [SPEC: benefit-allowance-drawdown]
- [x] U-08 `lib/funding/eligibility.ts`: copy flag to line, `splitBasket(lines, discounts)` pro-rata apportionment, shipping excluded; table tests for wholly/mixed/none and re-split [SKILL: commercetools-commerce-patterns] [SPEC: eligible-item-tender-restriction]
- [x] U-09 Restricted instrument Payment in `placeOrder`, per-line record on order, refund routing by recorded split; tests incl. refund returns to own instrument [SKILL: commercetools-checkout] [SPEC: eligible-item-tender-restriction]
- [x] U-10 Cart shows eligible subtotal and amount needing another tender before checkout; checkout offers the instrument only when available; tests [SPEC: eligible-item-tender-restriction]
- [x] U-11 `lib/ct/credentials.ts` `checkCredential(patientRef, controlClass, at)` returning `OK | NONE | WRONG_SCOPE | EXPIRED | PENDING`; tests for all six scenarios [SKILL: commercetools-commerce-patterns] [SPEC: credentialed-purchase-scope]
- [x] U-12 Enforce at add (rx-lines route), cart load and order placement; copy credential id + expiry to the line; UI states (shown but unavailable with requirement); tests incl. expired between cart and order [SKILL: commercetools-commerce-patterns] [SPEC: credentialed-purchase-scope]
- [x] U-13 Seed additions (cycle objects, credentials, `hsaEligible`/`controlClass` demo products, funding schemes) verified by `seed:verify` [SKILL: commercetools-catalog-migration] [SPEC: benefit-allowance-drawdown]
- [ ] U-14 Update README "Funding model is a demo" and PROJECT-FINDINGS with the Payment shape used (methods `allowance`, `restricted-health-account`) [SPEC: payer-and-patient-cost-share]

## Scenarios
Every scenario is a unit test (or a scripted check) named after it.
<!-- SCENARIOS:BEGIN (generated by plans/verify-plan.mjs --sync) -->
#### payer-and-patient-cost-share › What the scheme covers and what the recipient owes, before paying
- [x] Covered line shows both figures
- [x] Fully covered line
- [x] Uncovered line in a covered basket
- [x] Basket change alters existing cover
- [x] Figures unchanged between review and payment
- [x] Resolver unavailable
#### benefit-allowance-drawdown › A sponsor's allowance, drawn down first and reloaded on a cycle
- [x] Allowance covers the order
- [x] Allowance partly covers the order
- [x] Balance visible before committing
- [x] Cycle reload
- [x] Forfeiture is announced
- [x] Return restores the balance
- [x] Allowance is not cash
#### eligible-item-tender-restriction › A restricted instrument paying only for the lines it may pay for
- [x] Wholly eligible basket
- [x] Mixed basket splits
- [x] Eligible subtotal shown on the basket
- [x] Wholly ineligible basket
- [x] Basket change re splits
- [x] Eligibility visible on the order
- [x] Refund returns to its own instrument
#### credentialed-purchase-scope › Controlled goods sold only against a credential that still holds
- [x] Credential in scope permits purchase
- [x] No credential refuses purchase
- [x] Credential out of scope
- [x] Credential expired between cart and order
- [x] Verification still pending
- [x] Uncontrolled goods unaffected
<!-- SCENARIOS:END -->

## Browser recipe
Claude as Sam: cart with cardiovascular + OTC lines shows covered/owed per line and two totals; add an antibiotic line → cover on others changes and is shown; set `RESOLVER_FORCE_FAIL=1` → "cover unresolved", Checkout disabled; checkout with allowance: MC MCP `read_payments` shows two payments (allowance first, card for remainder) and `malva-allowance` consumed once; cancel the order → balance restored; mixed eligible basket shows eligible subtotal and splits; controlled product by Alex → "credential required", by Jordan → "verification pending", by Sam → purchasable and order line carries credential id; run `reload-allowances` twice → one grant.

## Manual tests (owner-only)
None (uses the Stripe sandbox covered by M-Q-1).

## Definition of done
JUNIOR-GUIDE §9.
