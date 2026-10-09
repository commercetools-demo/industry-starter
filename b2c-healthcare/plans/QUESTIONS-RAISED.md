# Questions raised by the workstream juniors (consolidated)

Consolidation of `plans/notes/<A..X>-questions.md` (workstreams Y and Z had no notes when this was written). Duplicates are merged; the id `QR-nnn` is stable for this file only (it is not the `Q-nnn` of `QUESTIONS.md`, which holds the owner's answers).

**How to cite.** `notes/N-questions.md#8` = row 8 of the table in that file. `notes/X-missed.md#b3` = third bullet of a bullet-list file. `notes/X-todos.md#2` = step 2 of a numbered list; `#Ln` = numbered item under a "Live checks" heading in a file with two lists (`Q-todos`, `T-todos`).

**Reading the entries.** *Default* is what the junior built to. *Workstreams* are the letters affected. *Needs owner* is `yes` when the answer is a product, legal, security or cost decision a junior cannot settle, `no` when the default is safe and the only open part is a live verification (those are tracked in `LIVE-TODOS.md`). Companion files: `MISSED-FEATURES.md`, `LIVE-TODOS.md`.

## Table of contents
1. [Needs your decision](#1-needs-your-decision) (QR-001 to QR-030, ordered by impact)
2. [Conflicts to reconcile](#2-conflicts-to-reconcile) (QR-031 to QR-056)
3. [Answered by a safe default, no owner input needed](#3-answered-by-a-safe-default-no-owner-input-needed), by topic
   - [3.1 Foundation, tooling and design system](#31-foundation-tooling-and-design-system) (A, B, C, D, H, I)
   - [3.2 Seed, project data and Product Search](#32-seed-project-data-and-product-search) (E, F, G, K)
   - [3.3 Catalog, search and booking](#33-catalog-search-and-booking) (K, L, M, F)
   - [3.4 Prescriptions and dispensing](#34-prescriptions-and-dispensing) (N, O)
   - [3.5 Cart, checkout, payment](#35-cart-checkout-payment) (O, Q, T)
   - [3.6 Orders](#36-orders) (S)
   - [3.7 Account, identity, addresses](#37-account-identity-addresses) (J, P, R)
   - [3.8 Saved lists, auto-refill, saved cards](#38-saved-lists-auto-refill-saved-cards) (T)
   - [3.9 Funding, allowance, credentials](#39-funding-allowance-credentials) (U)
   - [3.10 Privacy and retention](#310-privacy-and-retention) (X)
   - [3.11 Static content, regions](#311-static-content-regions) (V, W)
4. [Index by workstream](#4-index-by-workstream)

---

## 1. Needs your decision

### QR-001 Does Checkout create the order in payment-only mode?
- **Question:** The plan has the storefront create the order (needs `MLV-` numbers, the prescription consumption, line records). The Checkout SDK docs describe `checkout_completed` carrying an order id when Checkout itself creates the order. Which mode is the Application configured in?
- **Default:** Checkout only authorizes; the storefront creates the order. If the cart is already `Ordered`, `placeOrder` returns that order (without `orderNumber` or line records).
- **Workstreams:** Q, S, T, U (`notes/Q-questions.md#3`, `notes/Q-todos.md#L1`; see LIVE-TODOS step for OA-04).
- **Needs owner:** yes (owner creates the Application, OA-04).
- **Recommendation:** create the Application in Payment Only mode and record the answer in `PROJECT-FINDINGS.md` before any live checkout test; if it creates orders itself, workstream Q must be reworked.

### QR-002 Capture, refund and what "cancelled" means for money
- **Question:** Payments are authorization-only and never captured (no capture on `mlv-packed-shipped`). The refund is a `Refund/Initial` marker plus a void. Is authorization-only acceptable for the demo, or does the Stripe sandbox need auto-capture? Should a voided, never-captured authorization read "Refund requested" or "Payment released"?
- **Default:** authorization only; capture and refund are manual (README); page says "Refund requested", becoming "Refunded" when the connector sets the transaction to `Success`.
- **Workstreams:** Q, S, T, U (`notes/Q-questions.md#18`, `notes/S-questions.md#9`, `notes/S-missed.md#b2`, `notes/S-todos.md#7`).
- **Needs owner:** yes.
- **Recommendation:** keep authorization-only for v1; change the wording to "Payment released" when no capture exists; add capture on `packed-shipped` as a follow-up workstream if the demo must show settled money.

### QR-003 API Extension: close the direct-API bypass?
- **Question:** Q-005 = B means limits are enforced only in the BFF. Anyone calling the commercetools API directly bypasses prescription, monthly and per-order rules; and auto-refill orders are created by the platform with no hook to refuse them.
- **Default:** BFF only (D-028); T pre-checks runs 36 h ahead and reconciles afterwards; a refused generated order is logged and left for ops.
- **Workstreams:** N, O, Q, T (`notes/N-missed.md#b4`, `notes/O-missed.md#b1`, `notes/T-missed.md#b1`, `notes/T-questions.md#8`, `#11`).
- **Needs owner:** yes (reconfirm, given the T consequence: a charged order that cannot be cancelled automatically).
- **Recommendation:** schedule an API Extension workstream (cart update, order creation, order from recurring order) on the Netlify deployment; until then state the gap in the README (already done) and the demo script.

### QR-004 Confirm the API client scopes (consolidated)
- **Question:** The scope list in `.env.example` was a guess by A, widened by D, Q, T and others. Which scopes does the real Frontend API client get? Open items: `view_project_settings` (G, W), `view_shipping_methods`, `view_inventory_entries`/`view_products` for inventory reads (N), `view_orders` for `countOrders` (R), `manage_my_orders`-free cart access (O), `manage_custom_objects` vs `manage_key_value_documents` (F, J, X), `manage_payments`, `manage_checkout_payment_intents`, `manage_recurring_orders`, `view_recurrence_policies`, `manage_payment_methods` (T).
- **Default:** the list in `.env.example` (see `LIVE-TODOS.md` section 3 for the full table).
- **Workstreams:** A, D, F, G, J, N, O, Q, R, T, U, W, X (`notes/A-questions.md#6`, `notes/D-questions.md#2`, `notes/G-missed.md#b7`, `notes/N-todos.md#1`, `notes/Q-todos.md#L9`, `notes/T-todos.md#L2`).
- **Needs owner:** yes (OA-02: only the owner creates the client).
- **Recommendation:** create the client with exactly the list in `LIVE-TODOS.md` section 3, then run steps in order; widen only on a 403 and record each addition in `DECISIONS.md`. `manage_orders` is broad, review it against least privilege.

### QR-005 Session revocation (stateless 30-day cookie)
- **Question:** The JWT session cannot be revoked: sign-out, password change and data erasure leave other browsers (and an erased customer's cookie) valid for up to 30 days. Add a server-side revocation list or shorten the lifetime?
- **Default:** accept the limitation (bootstrap design Q3 stays open).
- **Workstreams:** D, J, R, X (`notes/D-missed.md#b3`, `notes/J-missed.md#b4`, `notes/R-missed.md#b7`, `notes/X-missed.md#b6`).
- **Needs owner:** yes.
- **Recommendation:** for a health product, add a per-customer `sessionEpoch` (Custom Object or customer custom field) checked on read, and bump it on password change and erasure; at minimum shorten to 7 days.

### QR-006 Retention periods and the erasure scope (SO-04)
- **Question:** Confirm: guest booking `expiresAt` = visit + 90 days; cancelled patient booking de-identified 90 days after the visit; order-attempt locks 30 days; refill log 180 days; stale slot claims a day after the slot; completed patient bookings keep their reason text (treated as clinical history owned by the clinical system); orders keep medication names by design.
- **Default:** those values (`RETENTION` in `scripts/privacy/inventory.ts`; `GUEST_RETENTION_DAYS = 90`).
- **Workstreams:** F, L, X (`notes/X-questions.md#8`, `notes/L-questions.md#2`, `notes/X-missed.md#b7`, `#b5`).
- **Needs owner:** yes (legal, SO-04).
- **Recommendation:** approve 90/90/30/180/1 for the demo; decide explicitly whether completed-booking reasons should also be minimised (recommended: yes, blank the reason at visit + 90 days).

### QR-007 Legal and consent copy (SO-03, SO-04)
- **Question:** Who writes the consent line on the booking form, the policy pages (terms, privacy, shipping), the registration terms and the video "Join" placeholders? Registration collects no terms, privacy or date-of-birth acceptance.
- **Default:** all copy is neutral placeholder marked `draft: true` in front matter; policy "opened from checkout" is proven for the link only.
- **Workstreams:** J, L, V, X (`notes/V-todos.md`, `notes/L-questions.md#3`, `notes/J-missed.md#b10`, `notes/X-todos.md#8`).
- **Needs owner:** yes.
- **Recommendation:** owner or legal supplies final text; remove `draft: true`; add a consent checkbox/link on the registration form and use `PolicyLink` in checkout.

### QR-008 Guest booking attachment rule
- **Question:** Q-026 says a guest booking is attached to an account only after the email is verified and matches. R also attaches any reference found in the visitor's `malva_bk` cookie regardless of email. Is the cookie path acceptable?
- **Default:** both paths (R-07).
- **Workstreams:** L, R (`notes/R-questions.md#9`; also listed under conflicts as QR-031).
- **Needs owner:** yes.
- **Recommendation:** keep the cookie path only for bookings made in the same browser and signed-in patient who is verified (auto-verified in this demo, so risk is low); document it.

### QR-009 Slot claim: per doctor + mode, or per doctor + instant?
- **Question:** The claim key includes the mode, so a doctor can be booked remote and in-office at the same instant (the weekly pattern is shared by both modes).
- **Default:** as planned (key includes mode).
- **Workstreams:** F, L (`notes/F-questions.md#5`).
- **Needs owner:** yes.
- **Recommendation:** change the key to `<doctorKey>.<instant>` (one claim per instant), update `lib/clinical/slots.ts` and `smoke-slots.ts`; it is a one-line product rule that avoids a doctor in two places.

### QR-010 Displayed time zone for slots
- **Question:** Q-003 says remote slots are shown in the visitor's zone with the zone named. L shows the clinic zone for both modes, named in the panel, because the visitor zone is not known on the server.
- **Default:** clinic zone only.
- **Workstreams:** L, K, M, R (`notes/L-questions.md#11`, `notes/R-questions.md#12`).
- **Needs owner:** yes (deviation from an accepted Q-003).
- **Recommendation:** accept clinic zone for v1 (it is unambiguous and named), or add a client-side `Intl` conversion for remote mode.

### QR-011 Monthly dispensing ceiling: definition, timezone and race
- **Question:** The seed has only `maxQtyPerOrder`. N defines the per-patient calendar-month ceiling as equal to it, in UTC, counted in packs, from dispensed orders only (cart lines do not count). Two concurrent orders can both pass.
- **Default:** as stated (`periodCeilingFor`, `periodOf`).
- **Workstreams:** N, O, Q, T (`notes/N-questions.md#4-#7`, `notes/N-missed.md#b2`, `notes/O-missed.md#b4`, `notes/T-missed.md#b4`).
- **Needs owner:** yes (the number is a clinical rule).
- **Recommendation:** add a `monthlyMax` attribute to the medication type (seed change), use the clinic time zone, and add a per-patient-month counter Custom Object with `version`.

### QR-012 Funding demo rules (workstream U)
- **Question:** U set fixed cover percentages per scheme (`COVER_PERCENT`) and an order cap of 3000 cents of cover; the restricted health-account card is opt-in at checkout (Q-064 said allowance, then restricted, then card in sequence); the allowance cycle is the UTC month and no allowance exists until the first reload (Q-062 said the seed gives Sam $50/month). Are these the intended demo rules?
- **Default:** as stated.
- **Workstreams:** U (`notes/U-questions.md`, `notes/U-missed.md#b1`, `#b2`).
- **Needs owner:** yes.
- **Recommendation:** confirm; ask U to document the percentages in the README and have the seed run the first reload so Sam has an allowance on day one.

### QR-013 Medicine product page
- **Question:** There is no medication PDP. Medicine search hits are cards without a link; the region "not available" card exists only on the doctor profile.
- **Default:** none built (design has no medicine page).
- **Workstreams:** K, N, W (`notes/K-missed.md#b4`, `notes/W-missed.md#b4`).
- **Needs owner:** yes.
- **Recommendation:** decide whether medicines are only reachable through the prescription flow (then keep as is and link hits to `/prescriptions`) or add a read-only medicine page.

### QR-014 `seed:reset` scope
- **Question:** `reset-seed.ts` deletes only the E `KINDS`; it leaves reviews, customers and Custom Objects, and the leftover reviews block product deletion. L's seed change (Alvarez/Haddad fees) needs a reset because the seed stops on a diff.
- **Default:** reset as built; manual cleanup.
- **Workstreams:** E, F, L (`notes/F-missed.md#b2`, `notes/F-todos.md#9`, `notes/L-todos.md#1`).
- **Needs owner:** yes.
- **Recommendation:** extend reset to delete reviews first, then Custom Objects in `malva-*` containers; never delete customers without `--include-customers`.

### QR-015 SO-01: label colour on the azure primary button
- **Question:** White on `#2aa7ff` is 2.60:1 (fails AA). Built: navy-900 label (5.59:1) with a hover label token `--color-action-label-hover` (navy-950). Alternative: white on brand-700 (4.74:1). The screenshot pair was never saved.
- **Default:** navy-900 label.
- **Workstreams:** B, H (`notes/B-questions.md#6`, `notes/B-todos.md`, `notes/H-todos.md`).
- **Needs owner:** yes (SO-01).
- **Recommendation:** accept navy labels (design lint and tests already assume them).

### QR-016 SO-02 and SO-03: undesigned screens
- **Question:** Approve the look of the mobile menu drawer, the error and 404 pages, the address book, registration/sign-in create mode, FAQ/contact/about/policies/journal and empty/error states (built from specs, not mockups).
- **Default:** reuse `Card`, `ButtonLink` and the sign-in card proportions.
- **Workstreams:** H, I, J, P, V (`notes/I-questions.md#1`, `notes/I-todos.md`, `notes/H-todos.md`).
- **Needs owner:** yes.
- **Recommendation:** review with the screenshot recipe after deployment; nothing blocks code.

### QR-017 Clinic name search
- **Question:** The spec says search doctors by name, specialty or clinic, but `clinicName` is not searchable in the seed product type.
- **Default:** name and specialty only.
- **Workstreams:** E, K (`notes/K-questions.md#3`, `notes/K-missed.md#b2`).
- **Needs owner:** yes (seed type change; attribute searchability is irreversible per type).
- **Recommendation:** make `clinicName` searchable in the product type before the first live seed.

### QR-018 Meaning of "doctors available now"
- **Question:** Bookings need a 2 h lead, so nobody is bookable "now". M shows "N doctors available today" (hero chip, band).
- **Default:** "today" in the clinic zone.
- **Workstreams:** M, K (`notes/M-questions.md#1`, `notes/M-missed.md#b6`).
- **Needs owner:** yes (copy and rule).
- **Recommendation:** keep "today"; changing to "now" would require allowing same-hour bookings (`MIN_LEAD_MS`).

### QR-019 Review counts versus the design
- **Question:** The prototype shows ratings 4.7 to 5.0 with 96 to 421 reviews; the seed has 3 to 6 reviews per doctor (plan), so cards show the real small counts.
- **Default:** real counts.
- **Workstreams:** F, M (`notes/F-questions.md#15`, `notes/F-missed.md#b8`).
- **Needs owner:** yes.
- **Recommendation:** keep real counts; do not seed hundreds of fake reviews.

### QR-020 Add a card without paying
- **Question:** `/account/payment-methods` has no "add a card" form: Checkout offers tokenisation only during a payment. Is a standalone setup-intent flow wanted? Also, T replaced the planned "Save this card" checkbox with the widget's own stored-methods UI.
- **Default:** empty state links to the cart; saving happens in the widget.
- **Workstreams:** T (`notes/T-questions.md#19`, `#23`, `notes/T-missed.md#b5`).
- **Needs owner:** yes.
- **Recommendation:** keep as is; confirm the widget offers "Save this card" live (LIVE-TODOS).

### QR-021 RecurringOrder is not erasable through `dataErasure`
- **Question:** The GDPR page does not list RecurringOrder. Erase cancels it and reports `notErasable`; the cancelled order keeps the customer reference.
- **Default:** cancel and report.
- **Workstreams:** T, X (`notes/X-questions.md#2`, `notes/X-todos.md#4`).
- **Needs owner:** yes (support request to commercetools).
- **Recommendation:** ask commercetools support whether RecurringOrder can be erased; note the answer in `PROJECT-FINDINGS.md`.

### QR-022 Guest booking abuse and throttle
- **Question:** `POST /api/bookings` has no rate limit and guests need no account, so someone can hold many slots; expired guest bookings and old slot claims are not purged except by the new retention function.
- **Default:** idempotency, `version: 0` claim and validation only.
- **Workstreams:** L, F, X (`notes/L-missed.md#b3`, `notes/L-questions.md#15`).
- **Needs owner:** yes (cost/abuse tolerance).
- **Recommendation:** add a per-client throttle with `lib/ct/ratelimit`, and a cap on open guest bookings per email.

### QR-023 Draft journal articles in production
- **Question:** `getPublishedArticles` includes `draft: true` articles so the home journal row can show placeholders. Hide drafts in production? Is a withdrawn article HTTP 200 (not 410) acceptable?
- **Default:** drafts shown; withdrawn returns 200 with `noindex`.
- **Workstreams:** M, V (`notes/M-missed.md#b3`, `notes/V-questions.md#7`).
- **Needs owner:** yes.
- **Recommendation:** hide drafts when `NODE_ENV=production`; keep 200 + `noindex` (Next cannot set 410 from a page).

### QR-024 Video visit "Join" copy and no-email confirmation
- **Question:** There is no video product or provider; the confirmation shows placeholder lines ("Joining details are not sent by email...").
- **Default:** placeholder copy without an email promise.
- **Workstreams:** L (`notes/L-questions.md#3`).
- **Needs owner:** yes (SO-04).
- **Recommendation:** owner words it, or remove the Join row until a provider exists.

### QR-025 Cancel for guests
- **Question:** A guest has no account area, so cannot cancel a booking; the confirmation page is readable only by cookie.
- **Default:** cancel only for signed-in patients.
- **Workstreams:** R, L (`notes/R-missed.md#b3`).
- **Needs owner:** yes.
- **Recommendation:** add cancel on `/booked/<ref>` for cookie-holders (same 2 h rule).

### QR-026 Design lint: warn or fail?
- **Question:** Design lint is warning-only; `npm run check` does not fail on it. Make it a hard gate (`--max-warnings 0`)?
- **Default:** warnings.
- **Workstreams:** B, H (`notes/B-questions.md#2`).
- **Needs owner:** yes (small).
- **Recommendation:** H reports zero warnings; switch to `--max-warnings 0`.

### QR-027 Photographer credits
- **Question:** Pexels credits from `site-images.json` are not displayed anywhere; the hero alt text is empty (decorative); the `home-cta` slot is seeded but unused.
- **Default:** none shown.
- **Workstreams:** M, E (`notes/M-missed.md#b7`, `#b8`).
- **Needs owner:** yes.
- **Recommendation:** show credits in the footer or an images page if Pexels terms require it; otherwise ignore.

### QR-028 Short-dated stock demo (seed change)
- **Question:** The plan wants short-dated stock priced on a channel `mlv-short-dated`, but the seed has no such channel or price; stock below its shelf-life promise is excluded, not offered.
- **Default:** excluded with a reason.
- **Workstreams:** N, E (`notes/N-questions.md#10`, `notes/N-todos.md#7`).
- **Needs owner:** yes (the scenario is only demonstrable after the seed change).
- **Recommendation:** add the channel and a 700-cent price for `MED-famotidine-20-mg` to the seed (demo date 2026-10-16).

### QR-029 Cart total includes lines flagged unavailable
- **Question:** The platform total counts lines the page flags unavailable (the BFF never removes them); the page says "N not included" and disables Checkout. Also: the Subtotal row is summed on the server because the platform has no subtotal field.
- **Default:** accepted simplification; Subtotal summed server-side.
- **Workstreams:** O (`notes/O-missed.md#b2`, `notes/O-questions.md#3`, `#12`).
- **Needs owner:** yes.
- **Recommendation:** drop the Subtotal row (the total is authoritative) and show the total excluding flagged lines, or remove flagged lines server-side.

### QR-030 "Price updated" note persistence
- **Question:** The note disappears on the next read because the new price is stored at once.
- **Default:** as planned.
- **Workstreams:** O (`notes/O-questions.md#5`).
- **Needs owner:** yes (small).
- **Recommendation:** store the acknowledged price on dismiss if the note must persist.

---

## 2. Conflicts to reconcile

Each item: two workstreams (or a workstream and a plan or an answered Q) chose differently, or an artifact disagrees with another. Status says whether a junior already resolved it.

### QR-031 Guest booking attach rule (Q-026 vs R)
- **Question:** see QR-008. R attaches by cookie regardless of email; Q-026 requires verified matching email.
- **Default:** both paths (R). **Workstreams:** L, R (`notes/R-questions.md#9`). **Needs owner:** yes. **Recommendation:** document and accept, or remove the cookie path. **Status:** open.

### QR-032 Guest retention: 7 days (F) vs 90 days (L, Q-025)
- **Default:** L changed `GUEST_RETENTION_DAYS` to 90 and edited F's test (`notes/L-questions.md#2`, `notes/F-questions.md#8`). **Workstreams:** F, L, X. **Needs owner:** no (resolved; wording is QR-006). **Recommendation:** keep 90, state it in the consent line.

### QR-033 Slot time zone (Q-003 vs L)
- See QR-010. **Status:** open decision.

### QR-034 Throttle failure policy: J fails open, N fails closed
- **Question:** If the rate-limit Custom Object store is down: sign-in (J) continues (fails open); RX lookup (N) returns 500 (fails closed).
- **Default:** both as written (`notes/J-questions.md#3`, `notes/N-questions.md#17`). **Workstreams:** J, N. **Needs owner:** no. **Recommendation:** keep, the choices are deliberate (availability for sign-in, enumeration safety for RX); record in `DECISIONS.md`.

### QR-035 Cart count: G `itemCount` (quantity) vs Q-020 (lines)
- **Default:** H added `lineCount` and the header reads it; `itemCount` kept (`notes/H-questions.md#1`). **Workstreams:** G, H, O. **Needs owner:** no. **Status:** resolved; O's fetcher must return `lineCount` (done).

### QR-036 Product Search field paths: G vs K (and E, W)
- **Question:** G wrote enum attributes as `variants.attributes.specialty` with `fieldType: enum`; K changed them to `.key` paths with `set_enum` for modes; E's `wait-for-search` uses `prefix` on `key` and verify uses `fullText` language `en-US`; W filters `variants.prices.currencyCode` for channel-priced doctors.
- **Default:** K's corrected paths are in `lib/ct/search-query.ts`; all unverified live (`notes/K-questions.md#2`, `notes/G-questions.md#7`, `notes/E-questions.md#7`, `#7b`, `notes/W-todos.md#4`).
- **Workstreams:** E, G, K, W. **Needs owner:** no. **Recommendation:** one live Product Search probe (LIVE-TODOS step "Product Search probe") settles all four.

### QR-037 Remote doctor count: 8 (K) vs 7 (L, M)
- **Question:** L made Dr. Alvarez remote-only and Dr. Haddad office-only; K's todos still say 8 remote doctors.
- **Default:** 7 remote, 7 office; existing projects need `seed:reset` first (`notes/L-questions.md#18`, `notes/L-todos.md#1`, `notes/K-todos.md#3`). **Workstreams:** E, K, L, M. **Needs owner:** no. **Recommendation:** treat K's "8" as stale; tied to QR-014.

### QR-038 SEED-PLAN versus workstream E and F field lists
- **Question:** SEED-PLAN lists `mlv-rx-line.dispensedAuthRef`, `mlv-order-meta.pharmacistReviewedAt`, and container `malva-dispense-ledger`; E built `credentialRef`, `eligibleForRestricted`, `coveredAmount`, `allowanceApplied`, `restrictedApplied`. `malva-counter` has no creating task (Q built it at first use). Later workstreams added `lastSeenUnitPrice` (O), `dispensedQty`/`authorizationParams`/`suppliedLots` (Q), `mlv-list-line` and recurrence policies (T), and U added fields and allowance/credential data.
- **Default:** the workstream lists win (`notes/E-missed.md#b3`, `notes/F-missed.md#b1`, `#b5`). **Workstreams:** E, F, O, Q, T, U. **Needs owner:** no. **Recommendation:** update `SEED-PLAN.md` to the built state (documentation task in `MISSED-FEATURES.md`).

### QR-039 `(protected)` layout created by both I and J
- **Default:** J created `app/[locale]/(protected)/layout.tsx` with a test; expect an add/add merge conflict with I (`notes/J-questions.md#11`, `notes/I-questions.md#4`). **Workstreams:** I, J, R. **Needs owner:** no. **Status:** R and later pages sit under it; confirm the merged tree has one layout.

### QR-040 Three separate patient readers
- **Question:** `lib/ct/identity.ts` (J, email and verified flag), `lib/ct/booking-patient.ts` (L, patientRef and names), `lib/ct/patient.ts` (N, patientRef and name) read overlapping Customer fields; G's `getCustomerById` is a fourth.
- **Default:** kept separate to avoid clashes (`notes/J-questions.md#13`, `notes/L-questions.md#7`, `notes/N-questions.md#16`). **Needs owner:** no. **Recommendation:** merge into one `getPatient()` in a clean-up pass.

### QR-041 `AUTO_REFILL_ENABLED`: default off (M) vs example on (T)
- **Question:** M defaults the flag to false; T's `.env.example` sets it to `true`. M's home line and T's "Auto-refill this order" depend on it.
- **Default:** off unless set (`notes/M-questions.md#6`); `.env.example` shows `true`. **Workstreams:** M, T, Y. **Needs owner:** no. **Recommendation:** deploy with the flag on only where the recurring-order scopes and the scheduled function exist (LIVE-TODOS prerequisites).

### QR-042 Removing the default address (P design vs P-02 task vs spec)
- **Default:** spec wins: no default, none promoted (`notes/P-questions.md#1`). **Needs owner:** no. **Status:** resolved.

### QR-043 Cart line quantity (plan vs N)
- **Question:** The plan says quantity = prescribed quantity; N says one RX line = one pack, quantity 1, prescribed qty in `prescribedQty`.
- **Default:** N (`notes/O-questions.md#2`, `notes/N-questions.md#4`). **Needs owner:** no. **Status:** resolved; T also cannot change quantity (`notes/T-questions.md#13`).

### QR-044 Zone cleanup: E-03 vs PROJECT-FINDINGS
- **Default:** both `usa` and `europe` zones kept (`notes/E-questions.md#2`). **Needs owner:** no. **Status:** resolved.

### QR-045 Doctor key in recipes
- **Question:** F's browser recipe says `mlv-doc-okafor`; the seed key is `mlv-doc-amara-okafor`.
- **Default:** scripts use the real key (`notes/F-questions.md#4`, `notes/F-missed.md#b4`). **Needs owner:** no. **Recommendation:** fix the recipe text.

### QR-046 Lint rule (d): hooks may not call literal `/api`
- **Question:** A applied the "no literal `fetch('/api/…')`" rule to `hooks/**` and `context/**` as well; D, G, H need paths from `lib/api-paths.ts`.
- **Default:** constants in `lib/api-paths.ts` (G, J, N, O, P, R, S, T added many); `CLIENT_DIRS` not split (`notes/A-questions.md#8`, `notes/D-questions.md#3`). **Needs owner:** no. **Status:** resolved in practice.

### QR-047 Tender order: Q-064 vs U
- **Question:** Q-064 says allowance, then restricted instrument, then card for the shortfall. U makes the allowance automatic and the restricted card opt-in.
- **Default:** U (`notes/U-questions.md`). **Needs owner:** yes (see QR-012). **Status:** open.

### QR-048 Q-062 seed allowance versus U "none until first reload"
- **Default:** U (`notes/U-missed.md#b1`). **Needs owner:** yes (QR-012). **Recommendation:** run `reload-allowances.ts` in the seed.

### QR-049 Q-065 "controlled products shown but unavailable with the requirement stated" vs U
- **Question:** U shows the reason only in prescription and cart rows; PLP/PDP do not flag controlled products.
- **Default:** U (`notes/U-missed.md#b3`, `notes/U-questions.md`). **Needs owner:** no. **Recommendation:** add the flag when a medication PDP exists (QR-013).

### QR-050 Q-060 resolver rules (80%/50%/0%) vs U `COVER_PERCENT` and 3000-cent cap
- **Default:** U's fixed table with an order cap (`notes/U-questions.md`). **Needs owner:** yes (QR-012).

### QR-051 Q-067 "each run is gated" vs T's 36-hour pre-check
- **Question:** There is no per-run hook without an API Extension; T checks runs due within 36 h and reconciles generated orders.
- **Default:** pre-check (`notes/T-questions.md#8`). **Needs owner:** yes (QR-003). **Status:** open.

### QR-052 Plan task "Save this card" checkbox versus widget behaviour
- **Default:** no storefront checkbox; widget stored-methods UI (`notes/T-questions.md#19`). **Needs owner:** no (QR-020 covers the owner part).

### QR-053 Header-search placement: K ready component, H no control, M added link
- **Default:** M added `SearchLink` (magnifier link to `/search`) at 900 px and up, hidden below; mobile menu has no search row (`notes/M-questions.md#12`, `notes/M-missed.md#b4`, `notes/K-questions.md#13`). **Needs owner:** no. **Recommendation:** add a search row to the mobile menu with SO-02.

### QR-054 Home header for signed-in users
- **Question:** H's home variant always showed "Sign in"; M changed `HomeAccountSlot` and `MobileMenu` (H's files).
- **Default:** M's change (`notes/M-questions.md#13`). **Needs owner:** no. **Status:** resolved.

### QR-055 Session cookie name
- **Default:** `malva_session` (D), A's test default `session` (parameter) (`notes/D-questions.md#4`, `notes/A-questions.md#7`). **Needs owner:** no. **Status:** resolved.

### QR-056 Root layout and `<html lang>` ownership (B, C, I)
- **Default:** `app/layout.tsx` is the only root and sets `lang` via `getLocale()`; B's font edits must keep it; I's env guard is called first there (`notes/C-questions.md#1`, `notes/C-missed.md#b3`, `notes/I-questions.md#6`). **Needs owner:** no.

---

## 3. Answered by a safe default, no owner input needed

Every entry here has `Needs owner: no`. "Live" means the only open part is a verification in `LIVE-TODOS.md`.

### 3.1 Foundation, tooling and design system

- **QR-057 Worktree started at an old commit (A, E, L, N, O, Q, R, S, T, V).** Default: fast-forwarded to `worktree-b2c-healthcare` (`notes/A-questions.md#1` and the same row in the others). Recommendation: keep as the standard first step (it is in this task's brief).
- **QR-058 Tailwind v4 even with `--tailwind=false` (A).** Default: kept v4, removed scaffold files (`notes/A-questions.md#2`). Recommendation: matches D-001.
- **QR-059 Dependency pins and extras (A, R, Q).** Default: installed next 16.4.0, next-intl 4.14.9, react 19.3.0, platform-sdk 8.27.0, ts-client 4.10.0, swr 2.5.1, jose 6.2.12, vitest 5.0.3, TS 5.9.3; extra dev deps `@testing-library/dom`, `typescript-eslint`; R added `pdf-lib ^1.17.1`; Q added `@commercetools/checkout-browser-sdk` (`notes/A-questions.md#3`, `#4`, `notes/R-questions.md#3`, `notes/Q-questions.md#17`). Recommendation: triage `npm audit` (untriaged since A, see MF in `MISSED-FEATURES.md`).
- **QR-060 `.env.example` with no values vs "build with the placeholders" (A, D).** Default: empty values; `apiRoot` is lazy and `instrumentation.ts` validates at start only (`notes/A-questions.md#5`, `notes/D-questions.md#5`). Recommendation: amend the A-09 text to "builds with empty env".
- **QR-061 Local ESLint rules (A).** Default: `local/no-server-import-in-client` plus path-based `no-restricted-imports`; Vitest aliases `server-only` to a stub and inlines `next-intl` (`notes/A-questions.md#10`, `#11`, `notes/C-questions.md#6`).
- **QR-062 Design lint cannot run in oxlint (B).** Default: adherence selectors run through ESLint (`design/adherence`, warnings); `npm run lint` runs `oxlint -c eslint/oxlint.json`; `.oxlintrc.json` kept verbatim (`notes/B-questions.md#1`, `#7`). Recommendation: fix the font regex upstream (MF).
- **QR-063 Font and token plumbing (B).** Default: `--font-display/meta/body` re-declared in the extensions block; `@theme inline` maps tokens to themselves; 90 tokens (plan said 84); focus ring brand-700 (`notes/B-questions.md#3`, `#4`, `#5`, `#8`).
- **QR-064 Root layout is async and `proxy.ts` own redirect logic (C).** Default: supported prefix through next-intl, otherwise 307 to cookie-or-default locale; client `IntlProvider`; locale cookie `your-shop-country-locale`; root placeholder page deleted (`notes/C-questions.md#2`-`#5`).
- **QR-065 `/api/health` and release pipeline (D).** Default: guard returns 404 in production; `check-no-health-in-release.mjs` requires the guard and fails if the folder exists when `NODE_ENV=production`; the release pipeline must delete `app/api/health/` first (`notes/D-questions.md#1`, `notes/D-todos.md` "Other"). Recommendation: Y implements the deletion step.
- **QR-066 Session details (D, G).** Default: `secure` true unless `NODE_ENV=development`; test-only secret fallback in test; secret resolved lazily (`secret()`); health logic in `lib/ct/health.ts`; `setLocale({ locale })` only, cart cleared on currency change (`notes/D-questions.md#7`-`#10`, `notes/G-questions.md#3`, `#4`).
- **QR-067 Scopes beyond A's list (D).** Default: added only `manage_sessions` (`notes/D-questions.md#2`); the rest is QR-004.
- **QR-068 Shell structure (H).** Default: `Header` is a server-safe shell with client islands; session read in the locale layout only (`getHeaderUser`); `<main id="main">` rendered by the locale layout; footer Company links gated by `live` flags in `lib/nav.ts`; 1.5 px border and 900 px breakpoint as `@utility border-thick` and `--breakpoint-nav`; sign-in route `/login?next=` (`notes/H-questions.md#2`-`#12`).
- **QR-069 Error pages and guards (I).** Default: `NotFoundView`/`FaultView`, English-only `global-error`, `requireSessionOrPrompt` helper (no `(protected)` group by I), `lib/http.ts`, `lib/log.ts` with a dropped-field list, env-guard page as second line behind `instrumentation.ts`, dev-only `/en-US/_boom` (`notes/I-questions.md#2`-`#8`).

### 3.2 Seed, project data and Product Search

- **QR-070 Zone key and zone location (E).** Default: `mlv-standard` references zone key `usa`; zone `Location.state` uses two-letter codes NY/TX/IL; if the key differs, `seed` fails on that step (`notes/E-questions.md#4`, `#5`). Live.
- **QR-071 Price channels need `ProductDistribution` (E).** Default: yes (`notes/E-questions.md#6`). Live.
- **QR-072 Product Search wait and verify queries (E).** Default: `prefix` on `key` = `mlv-`; `fullText` on `name`, language `en-US`; fallbacks named (`notes/E-questions.md#7`, `#7b`). Live (QR-036).
- **QR-073 Custom type field types (E).** Default: Money for `allowanceApplied`, `restrictedApplied`, `coveredAmount`; String for `fundingScheme`, `rxNumber`, `rxLineRef`, `credentialRef`, `patientRef`; Number `prescribedQty`; Booleans; field types cannot change later without recreating the type (`notes/E-questions.md#8`). Recommendation: if any Q/R/T/U writer disagrees, change before the first live seed.
- **QR-074 Inventory expiry type (E).** Default: type `mlv-inventory-meta` with `expiryDate` (Date); fixed `2026-11-15` on `MED-famotidine-20-mg` (`notes/E-questions.md#9`).
- **QR-075 Catalog shape (E).** Default: 20 medications; `controlClass` enum `none`/`schedule-iv` (Alprazolam, Tramadol); 19 of 20 have `maxQtyPerOrder` (acetaminophen none); doctors have both channels (code supports one-mode); attribute constraint `None`; plain `enum` labels; ratings from Reviews; banner slots only the six named (`notes/E-questions.md#10`-`#16`, `#19`).
- **QR-076 Seed tooling exceptions (E, F).** Default: file-level eslint-disable for SDK use in `scripts/seed/lib.ts`; seed scripts not scanned by X; `PEXELS_CLIENT_ID` read from the shell only (`notes/E-questions.md#17`, `notes/E-missed.md#b9`).
- **QR-077 Seed scopes (E).** Default: best guess in `.env.seed.example` (QR-004 covers storefront; OA-01 the seed client) (`notes/E-questions.md#18`).
- **QR-078 Custom Object keys and create-only semantics (F).** Default: slot-claim key `<doctorKey>.<mode>.<YYYYMMDDTHHmmssZ>`; `POST custom-objects` with `version: 0`, 409 means exists; unverified until `smoke-slots.ts` (`notes/F-questions.md#2`, `#3`). Live.
- **QR-079 Slot rules (F).** Default: `listFreeSlots(doctorKey, mode, now, days)`, slots earlier than now + 2 h hidden; claims found by `value(doctorKey and mode)` and filtered in memory; exactly 2 h before is cancellable; request-id idempotency via SHA-256 reference `BK-...`; non-offered slot is `SlotUnavailableError`; date maths with `Intl` only (`notes/F-questions.md#6`, `#7`, `#9`-`#11`, `#22`).
- **QR-080 Prescription expiry (F).** Default: optional `expiresAt` on `Prescription` (Jordan's expired RX) (`notes/F-questions.md#14`).
- **QR-081 Reviews (F).** Default: `reviewRatingStatistics` read via `productProjections().withId().get({staged:false})`; all 29 seeded reviews verified (so the filter is unit-tested only); statistics roll up asynchronously (`notes/F-questions.md#15`).
- **QR-082 Demo patients (F).** Default: fixed synthetic `patientRef`s (`pt_8k2m4q7x`, ...) for idempotency; missing `SEED_PATIENT_PASSWORD` skips customers and `seed:verify` fails "exactly three example.com patients" (`notes/F-questions.md#16`, `#17`).
- **QR-083 Seed overwrite policy (F).** Default: Custom Objects create-only; `malva-rx`/`malva-booking` never compared; schedules, labs, credentials compared and a difference stops the run; `clinical` opt-in in the programmatic API; `advance-order` only from `mlv-received`, refuses skips; shared seed files touched additively (`notes/F-questions.md#18`-`#21`).
- **QR-084 Search and cache (G).** Default: `withCartRetry(fn)` closure re-reads cart; `getActiveCartSafe` clears stale `cartId` only in Route Handlers; `clearPatientState` writes `null`; region enabled when country, currency and (`en-US` or `en`) are listed; price channel by key `mlv-remote`/`mlv-office` via expand or an id-to-key map; `getShippingMethods` is informational (matching rates later); `React.cache` de-duplication needs a browser check; no `unstable_cache` for search (`notes/G-questions.md#1`, `#2`, `#5`, `#6`, `#8`, `#9`, `#11`). Live.
- **QR-085 Types added early (G).** Default: `Category`, `ProductBasics`, `CartSummary`, `AccountUser`, `ShippingMethodInfo` in `lib/types.ts` (`notes/G-questions.md#10`).

### 3.3 Catalog, search and booking

- **QR-086 Fixture mode (K and others).** Default: `MALVA_FIXTURES=1` (dev only, dead-code eliminated in production) feeds doctor list, search, profile, prescriptions, cart, checkout, orders, account (`notes/K-questions.md#1`, `notes/N-questions.md#20`, `notes/O-questions.md#16`, `notes/S-questions.md#16`, `notes/T-questions.md#25`). Recommendation: never set in any deployed environment.
- **QR-087 Doctor list behaviour (K).** Default: up to 50 candidates, availability read per candidate (7 days), sort soonest/rating/name, page size 9 (`DOCTOR_PAGE_SIZE`), "today" = clinic-local date, static filter lists in sync with seed enums, redirect past the last page, filter text applied after 350 ms (`notes/K-questions.md#4`-`#8`, `#15`).
- **QR-088 Search page (K).** Default: exact SKU lookup for medicines only (separate call), `fuzzy` level 2 OR full text, language guard on script, medicine hits are cards without a link plus "Find your prescription" link (`notes/K-questions.md#9`-`#12`). Live.
- **QR-089 Profile and booking panel (L).** Default: phone for patient bookings only; booking-access cookie `malva_bk` (HS256, own audience, max 20 refs, 90 days); `POST /api/bookings` compares requester to the stored booking on idempotent replay; `getBookingPatient`; server passes name and email to the panel; first offered mode default; unpriced mode shows "Fee unavailable"; back link whitelist; first day with free times selected; slot-taken message keeps the dialog open; one request id per slot choice; fee shown on confirmation is today's price (`notes/L-questions.md#4`-`#9`, `#12`-`#14`, `#16`, `#17`, `#19`).
- **QR-090 Home page (M).** Default: up to 3 "available today" cards; single 60 s `unstable_cache` snapshot; statistics only for real figures ("2M+" and "15 min" removed; "8,000 verified doctors" became "Doctors on Malva"); same-day claim only when an active method key ends `same-day` with a zone rate; prescription block rewritten; hero chips General practice, Dermatology, Pediatrics; empty search stopped by `required` pattern; metadata via `pageMetadata` (`notes/M-questions.md#2`-`#5`, `#7`-`#11`, `#15`).

### 3.4 Prescriptions and dispensing

- **QR-091 Remaining quantity and refills (N).** Default: remaining = `refillsLeft` x prescribed quantity; one fill consumes one refill; no partial supply; idempotent on order id via `consumedBy` plus ledger entry written last; restoration removes the id and marks `restoredAt` (`notes/N-questions.md#2`, `#3`).
- **QR-092 Native limit errors (N).** Default: `LineItemQuantityBelowLimit` verified in docs; upper-bound code assumed `LineItemQuantityAboveLimit` with `maxCartQuantity`; seed already sets `maxCartQuantity` (`notes/N-questions.md#8`). Live.
- **QR-093 Concurrency (N).** Default: reuse F's versioned `putObject`; up to 6 retries then `ConcurrencyExhaustedError`; monthly count not serialized (QR-011) (`notes/N-questions.md#7`, `#9`).
- **QR-094 Shelf life (N).** Default: product promise acts as the account minimum; undated goods show nothing; whole months rounded down, min 1 (`notes/N-questions.md#10`-`#12`).
- **QR-095 Lookup behaviour (N).** Default: totals informational; `validateRxSelection(patient, rxNumber, lineRefs, ctx)`; patient reader `lib/ct/patient.ts`; unknown, foreign, malformed and missing-patient all "not found" and count toward the rate limit, checked before lookup; HTML-escaped 404 body (40 characters); quick-picks hide only on failure (`notes/N-questions.md#13`-`#19`).
- **QR-096 Cart behaviour (O).** Default: customer carts only, `shippingMode Single`, `taxMode Platform`, shipping address country-only, `mlv-standard` preselected; newest Active cart of the customer if the session has none; replace-not-duplicate in one update; per-prescription re-validation; body accepts `rxNumber` or `rx`; partial success with `refused`; 422 `NOTHING_ADDED`; disabled Checkout label "Fix N item(s) to continue"; `useToast` announces removal; header count makes no request when signed out; two SWR keys (`KEY_CART`, `KEY_CART_DETAILS`) (`notes/O-questions.md#7`-`#14`).
- **QR-097 `lastSeenUnitPrice` added to the seed type (O).** Default: Money field in `mlv-rx-line`; an existing seeded project needs `npm run seed` again and the seed must update (not skip) existing types (`notes/O-questions.md#4`, `notes/O-todos.md#1`). Live.

### 3.5 Cart, checkout, payment

- **QR-098 Payment adapter without credentials (Q).** Default: real adapter `lib/ct/checkout-provider.ts` behind `PaymentProvider`, unit-tested with injected `fetch`; dev-only fake provider shows "DEMO payment"; without `CTP_CHECKOUT_APP_KEY` the real path answers 503 (`notes/Q-questions.md#2`, `#4`). Live (QR-001).
- **QR-099 Amount and endpoints (Q).** Default: gross when taxed else `totalPrice`; extra `GET /api/checkout` and `POST /api/checkout/demo-authorize`; address applied explicitly via "Use this address", not saved to the address book; delivery re-selected or 422 `NO_DELIVERY_METHOD`; same-day cut-off re-checked at placement (`notes/Q-questions.md#5`, `#6`, `#8`, `#9`, `#14`).
- **QR-100 Idempotency and release (Q).** Default: key = cart id + cart version; `malva-order-attempt` lock (pending, created, done, refused; pending older than 2 min may be taken over); authorization released on stale total, order or line-record failure, number failure, last-moment refusal; a refused-at-last-moment order is cancelled but stays in commercetools; interrupted consumption resumes with the same key; line records written to cart lines before order creation (`notes/Q-questions.md#10`-`#13`, `#15`).
- **QR-101 U credentials in `placeOrder` (Q, U).** Default: Q re-runs `validateRxSelection`; U adds its check in `prepareLines` (`notes/Q-questions.md#16`).
- **QR-102 Order number (Q).** Default: `MLV-` plus counter from `malva-counter/order-number` with optimistic concurrency; gaps possible and harmless (`notes/Q-missed.md#b5`, `notes/Q-todos.md#L10`).

### 3.6 Orders

- **QR-103 Order page and list (S).** Default: new `/order` for an unknown placement outcome (never says "placed"); order types in `lib/order-types.ts`; one query on id and customerId; newest 50, no pagination; cancelled orders shown with a red badge; cancelled timeline shows two steps; estimate row "Today by 8 pm" for same-day else "1-2 business days"; shipment state row only (`notes/S-questions.md#2`-`#7`, `#11`, `#12`).
- **QR-104 Cancel and reorder (S).** Default: transition to `mlv-cancelled`, then `restoreAuthorization`, `restoreAllowance`/`restoreRestricted` (no-op hooks, filled by U), `Refund/Initial` marker per payment, then void; cancelling again completes a half-finished cancel; works without a configured payment service; reorder re-validates each line through N and returns `{ added, notAdded[] }`; returns not built; fixtures for orders on `globalThis` (`notes/S-questions.md#8`, `#10`, `#13`, `#15`, `#16`). Live.

### 3.7 Account, identity, addresses

- **QR-105 Registration and sign-in (J).** Default: duplicate registration answers 409 with one generic text and a per-client limit (5 per 10 min); throttle buckets hash email and IP; sign-in throttle fails open; stale session cart retried once without `anonymousCart`; auto-verification failure keeps the account and signs in, `emailVerified:false`; `GET /api/auth/me` signed out returns 200 `null`; no placeholder `/account` page; reason line derived from `next`; resend verification returns the token to the server caller only (`notes/J-questions.md#1`-`#6`, `#8`, `#9`, `#12`). Live (token lookup, merge).
- **QR-106 Verification token lookup (J).** Default: `GET /customers/email-token={token}`; consumed or dead token answers `already-verified` or `expired` (`notes/J-questions.md#7`). Live.
- **QR-107 Address book (P).** Default: spec wins on default removal; static first-three-ZIP table with an overridable warning (`needs-confirmation`, "Save anyway"); US phone only (`+1XXXXXXXXXX`), required; `addAddress` with key then `addShippingAddressId` and optional default; remove default first, then address; `updateCustomer` re-reads, plans and retries once on 409; name change `PATCH /api/account/profile`, email read-only; pages under `(protected)` without an account layout (`notes/P-questions.md#2`-`#8`). Live.
- **QR-108 Account shell and PDFs (R).** Default: layout inside `(protected)/account`; appointments tile = upcoming `booked`; `lib/account-nav.ts` registry with a test; same 404 for foreign and unknown labs and PDFs; `no-store` stamped by `handle()` plus `next.config.ts` headers; cancel route `POST /api/bookings/[ref]/cancel` with 409 `too-late`; doctor name read once per doctor; PDF through `pdf-lib` from `messages/en-US.json`; no dev fake session (`notes/R-questions.md#2`, `#4`-`#8`, `#11`-`#13`, `#15`). Live.

### 3.8 Saved lists, auto-refill, saved cards

- **QR-109 Saved lists (T).** Default: default list key `mlv-list-my-medicines-<customerId>`; Add all goes through N per line (not `addShoppingList`); any line of the patient's own prescription can be saved; "from cart" creation; saved price delta shown, never silently repriced (`notes/T-questions.md#2`-`#7`). Live.
- **QR-110 Auto-refill (T).** Default: Dynamic price mode project-wide; cadence changes only (`setSchedule`); sources are a past order or own-prescription lines; refills ship `mlv-standard`; first refill one cadence out; a saved method is required (100% Checkout allocation via the beta `setRecurringPaymentConfiguration`); recurring carts excluded from `fetchActiveCart` (`origin="Customer"`); removing a card used by a refill needs `confirm=1` and pauses the refills; resume re-checks (`notes/T-questions.md#9`, `#12`-`#18`). Live.
- **QR-111 Scheduled run (T).** Default: Netlify scheduled function `auto-refill-run` (`0 5 * * *`) calls `/api/internal/auto-refill-run` with `x-refill-secret`; route disabled (503) without `AUTO_REFILL_RUN_SECRET`; platform-created orders reconciled for 5 days (`consumeAuthorization`, `setOrderNumber`, `transitionState` with `force: true`) (`notes/T-questions.md#10`, `#11`). Live.
- **QR-112 Saved cards (T).** Default: `mapDescriptor` reads connector custom fields `brand`/`last4`/`expMonth`/`expYear` (or `cardBrand`...) with a display-name fallback; `setDefault` clears the other defaults first; refunds to saved cards are manual; B2C-excluded items not built; fixtures hold descriptors only (`notes/T-questions.md#20`-`#22`, `#24`). Live.

### 3.9 Funding, allowance, credentials

- **QR-113 Resolver failure (U).** Default: state `unresolved`, Checkout disabled, list price never used; `RESOLVER_FORCE_FAIL` for dev only (`notes/U-questions.md`, `notes/U-todos.md`). Owner part is QR-012.

### 3.10 Privacy and retention

- **QR-114 Erasure and access scope (X).** Default: `dataErasure=true` over Customer, Cart, Order, Payment, Review, ShoppingList, DiscountCode, CustomObject, BusinessUnit, Quote, QuoteRequest, StagedQuote (docs, checked 2026-10-08); explicit deletion of carts (Customer DELETE no longer removes them) with the customer last; tender payments found via cart/order `paymentInfo.payments`; real run needs `--confirm <customerId>` (`notes/X-questions.md#1`, `#3`, `#5`, `#7`). Live.
- **QR-115 Predicates (X).** Default: `customerId="x"`, `customer(id="x")`, `associates(customer(id="x"))`, `resource(id in (...))`; discount codes read and filtered in memory; written from field names, not run (`notes/X-questions.md#4`). Live.
- **QR-116 Custom object ownership (X).** Default: `scripts/privacy/inventory.ts` maps each container to a person key; hashed login buckets cannot be resolved and are removed by retention; a drift test fails if a container lacks an inventory row (`notes/X-questions.md#6`).
- **QR-117 Retention function (X).** Default: Netlify function with `RETENTION_SECRET`, using the storefront `CTP_*` client; no project-key guard in the function (guard stays in the CLI) (`notes/X-questions.md#10`). Live.
- **QR-118 Scan scope and Messages (X).** Default: static scan (b) widened beyond `lib/` and `app/api`; `project.messages.enabled` must be `false` (`notes/X-questions.md#12`, `#13`, `#11`).

### 3.11 Static content, regions

- **QR-119 Content pipeline (V).** Default: own front-matter parser and Markdown subset (unsafe links dropped); `<name>.<locale>.md` translations with en-US fallback; policy versions `content/policies/<slug>/<yyyy-mm-dd>.md`; FAQ is plain text with anchors; offices keyed by `country:`; `SITE_URL` for canonical and sitemap (defaults to localhost); `outputFileTracingIncludes` for `./content/**/*`; footer labels under `shell.footer.*`; `hasArticles` from `showJournal(locale)`; `lib/routes.test.ts` exempts Care/Pharmacy links until pages exist; H's tests edited (`notes/V-questions.md#2`-`#6`, `#8`-`#13`).
- **QR-120 Region switch (W).** Default: start with an empty cart on a currency change (toast); `fetchActiveCart` filters by the session currency (old cart left Active, found again on switching back); regions resolved in the layout (`getSwitchableRegions`, returns `[]` for one region); soft navigation `router.replace` plus `refresh`; `sellableInRegion` flag and search currency filter; no switcher on mobile; label from `Intl.DisplayNames` (`notes/W-questions.md#1`-`#8`). Live (needs a second region).

---

## 4. Index by workstream

| Letter | Entries |
| --- | --- |
| A | 004, 046, 055, 056, 057-061 |
| B | 015, 026, 062, 063 |
| C | 056, 061, 064 |
| D | 004, 005, 046, 055, 060, 065-067 |
| E | 014, 017, 028, 036-038, 044, 070-077 |
| F | 009, 014, 019, 032, 037, 038, 045, 078-083 |
| G | 004, 035, 036, 066, 084, 085 |
| H | 015, 016, 026, 035, 053, 054, 068 |
| I | 016, 039, 056, 069 |
| J | 004, 005, 007, 034, 039, 040, 105, 106 |
| K | 010, 013, 017, 018, 036, 037, 053, 086-088 |
| L | 006-010, 022, 024, 025, 031-033, 037, 040, 089 |
| M | 018, 019, 023, 027, 037, 041, 053, 054, 090 |
| N | 003, 004, 011, 013, 028, 034, 040, 043, 091-095 |
| O | 003, 011, 029, 030, 035, 043, 096, 097 |
| P | 016, 042, 107 |
| Q | 001-004, 011, 098-102 |
| R | 005, 008, 010, 025, 031, 108 |
| S | 001, 002, 103, 104 |
| T | 001-004, 011, 020, 021, 041, 051, 052, 109-112 |
| U | 001, 012, 047-050, 113 |
| V | 007, 016, 023, 119 |
| W | 013, 036, 120 |
| X | 005-007, 021, 114-118 |
| Y, Z | no notes yet |
