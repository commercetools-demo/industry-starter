# Questions to the owner

Format: `Q-nnn` · spec(s) · **Question** · **Default** (what we build to if unanswered; the owner may overrule at any time) · **Blocking** (blocks which workstream) · **Answer**.
Juniors add questions at the bottom (JUNIOR-GUIDE §8), id `Q-<letter>-<n>`.
Status: `Open` / `Answered (date)`. Round 1 = the blocking ones asked in chat on 2026-10-08.

## Round 1 — blocking, shape the whole plan
### Q-001 · design-pdp, design-plp, design-home-page, design-account-area (D1) — Answered 2026-10-08: A (Custom Objects)
**What is a booking, and who owns availability?** Nothing outside commercetools exists for scheduling.
- **Default (A):** doctors are catalog **Products**; weekly availability is a **Custom Object** per doctor; a booking is a **Custom Object**; double booking is prevented by a *slot-claim* Custom Object created with `version: 0` (the second create fails); bookings are not Orders and not in the cart; payment at the visit.
- (B) A booking is a zero-amount **Order** (shows in order history, uses order search, but mixes appointments with medicine orders and puts visit details in the commerce record).
- (C) A mocked external scheduler module behind an interface, no commercetools storage.
**Blocking:** E, F, K, L, M, R. **Answer:**

### Q-004 · design-account-area, design-plp, prescription-bound-supply, health-data-minimization (D7) — Answered 2026-10-08: A (CT Custom Objects stand-in)
**Where do prescriptions and lab results live in this demo?** The specs say clinical data must stay out of commerce; no EHR exists.
- **Default (A):** a clearly labelled **demo stand-in**: Custom Objects in containers `malva-rx` / `malva-lab` behind one server module `lib/clinical/` with an interface a real EHR adapter can replace; patients link through an opaque `patientRef` on the Customer; the order carries only RX number + line reference + dispensed quantity, never sig or diagnosis; synthetic data only.
- (B) JSON fixtures in the repo behind the same interface (nothing clinical in commercetools at all; no Merchant-Center visibility).
**Blocking:** F, N, R. **Answer:**

### Q-005 · dispensing-quantity-limit, prescription-bound-supply — Answered 2026-10-08: B (BFF only in v1; direct-API bypass gap documented in the README and workstream N, API Extension is a future task)
**Where are limits enforced?** The specs require refusal "wherever the request arrives from" (direct API calls too), which needs a commercetools **API Extension** on cart update/order creation, hosted at a public URL (Netlify function or Connect app).
- **Default (A):** v1 enforces in the BFF (cart and order routes) **and** a thin API Extension hosted on the same deployment, added in workstream N; native `setInventoryLimits` handles the per-cart ceiling.
- (B) BFF-only in v1; the gap is documented and the Extension is a later workstream.
**Blocking:** N, Y (deployment must expose the extension URL). **Answer:**

### Q-006 · scope — Answered 2026-10-08: ALL of saved lists, subscriptions/auto-refill, payer cost-share + benefit allowance + eligible-tender, credentialed purchase scope are IN v1 (workstreams T, U; follow-ups Q-060..Q-069 below)
**Which parts are in v1?** In: everything marked "in" in `SPEC-COVERAGE.md`. **Default: defer** the four heavy domain capabilities — payer/cost-share, benefit allowance, eligible-item tender, credentialed purchase scope (B2B-flavoured, none designed) — and saved lists + subscriptions/recurring orders (home copy about auto-refills stays hidden). **Blocking:** DEPENDENCY-PLAN T, U. **Answer:**

### Q-007 · checkout, checkout-page, payment-methods, design-checkout — Answered 2026-10-08: A (CT Checkout payment-only + Stripe sandbox)
**How is payment taken?** The design requires a payment widget (no card fields in the storefront).
- **Default (A):** commercetools **Checkout** (payment-only mode) with a **Stripe** sandbox connector; needs OA-04.
- (B) Adyen hosted checkout (the grocery sibling used Adyen).
- (C) No real PSP in v1: a clearly labelled demo payment (a `Payment` object authorised by the BFF) so the whole flow works without an account.
**Blocking:** Q, OA-04. **Answer:**

### Q-008 · email-verification, password-reset, design-pdp (confirmation email), contact-us — Answered 2026-10-08: NO email provider. New registrants' emails are auto-verified (customer created and email-confirmed server-side at registration). Password reset, booking confirmation and contact therefore need a no-email design: see Q-070..Q-072
**How are emails sent?** commercetools sends none.
- **Default (A):** a `Mailer` interface with a **console/dev outbox** implementation in dev and a provider adapter (Resend or SendGrid, your choice) when OA-05 is done; booking confirmations, verification and reset all go through it.
- (B) Provider from day one.
**Blocking:** J (verification/reset links in dev work with the console outbox). **Answer:**

### Q-009 · bootstrap Q4 — Answered 2026-10-08: Netlify
**Hosting target?** **Default:** Netlify (the sibling projects moved `netlify.toml` into the site directory). **Blocking:** Y only. **Answer:**

## Round 2 — answered 2026-10-08
Q-005 = BFF only, Q-008 = no email (auto-verify), Q-009 = Netlify, Q-060…Q-065 = mock resolvers per the defaults below. Also done by Claude on request: product search indexing (`ProductsSearch`) **activated**; `countryTaxRateFallbackEnabled` was already `true`.

### Follow-ups opened by Q-008 (no email provider)
- **Q-070 — Answered 2026-10-08: OMIT the reset UI** (no forgot-password page or link; signed-in password change stays under account). *Password reset without email.* **Default:** signed-in patients change their password (current + new). "Forgot password" asks for the email and, **outside production only**, shows the commercetools reset token/link on screen; in production the page says reset is unavailable in this demo. The `password-reset` scenarios are tested against the token API.
- **Q-071** *Booking confirmation "A confirmation was sent to <email>".* **Default:** copy changes to "Keep your reference <ref>. Confirmation is shown here and under My appointments"; no email claim shown. Guest access = same-session cookie + reference page link (signed token).
- **Q-072** *Contact page.* **Default:** shows the support email address and phone as plain text; no form (a form with nowhere to deliver would mislead).
- **Q-073** *Auto-verification.* **Default:** registration sets `isEmailVerified` true immediately via the Frontend/admin path (customer email-verify token consumed server-side). `email-verification` scenarios about resend/expiry are implemented but unreachable in the UI; flagged in the README as demo behaviour.



### Follow-ups opened by Q-006 (all four deferred groups are in v1)
- **Q-060** *Payer cost-share resolver.* There is no real claims engine. **Default:** a **mock funding-scheme resolver** module `lib/funding/` (interface + deterministic demo rules per medication class: e.g. 80% covered for cardiovascular, 50% for antibiotics, 0% OTC) selected by a `fundingScheme` on the patient; resolved split stored on the line (external price = amount owed; covered amount in a custom field); re-resolved at cart load and before order creation; resolver failure = "cover unresolved", checkout blocked. (payer-and-patient-cost-share)
- **Q-061** *Cost-share on doctor visits?* **Default:** medications only; visits stay pay-at-visit.
- **Q-062** *Benefit allowance ledger.* **Default:** Custom Object per member per cycle (granted/consumed/lapsed, optimistic concurrency), monthly cycle, unspent balance **forfeited** (no carry-over), allowance settles as its own **Payment** *first*, remainder to Stripe; refund restores to the open cycle, else reported unrecoverable; reload = idempotent script `reload-allowances.ts` (run on a schedule by hosting cron). Seed gives Sam Rivera $50/month. (benefit-allowance-drawdown)
- **Q-063** *Eligible-item tender (HSA/FSA-style).* **Default:** product attribute `hsaEligible` (searchable) copied to the line at add time; a second restricted instrument "Health account card (demo)" paying only eligible lines; discounts apportioned pro rata, shipping never eligible; refund returns to the originating instrument. Needs Q-007's PSP for the remainder. (eligible-item-tender-restriction)
- **Q-064** *Order of tenders.* **Default:** allowance → restricted instrument → card for the shortfall.
- **Q-065** *Credentialed purchase scope for patients.* The spec targets professionals. **Default:** apply it to a small set of **controlled medicines** (control class `schedule-iv` etc.): the patient must hold a valid credential record (e.g. a "controlled-substance agreement" with expiry, issued by the demo clinic) in the clinical stand-in; verification states pending / valid / expired / out of scope; re-checked at order placement; credential id + expiry copied onto the line. Controlled products are shown but unavailable with the requirement stated (not hidden). (credentialed-purchase-scope)
- **Q-066** *Saved lists for patients.* **Default:** "My medicines" lists (name + prescription-line references, never sig), bulk add to cart only for lines whose RX is still dispensable; implemented with commercetools **Shopping Lists**; no sharing (B2C-excluded). (saved-lists)
- **Q-067** *Subscriptions / auto-refill.* **Default:** commercetools **Recurring Orders** with a monthly/quarterly **Recurrence Policy**, price mode **Dynamic**; each run is gated by the prescription ledger (a run is skipped and the reason recorded when the RX is exhausted/expired); pause/skip/cancel in the account area; the home "auto-refills" claim becomes true. Depends on Q-007 for off-session payment (Stripe saved method). (subscriptions-and-recurring-orders)
- **Q-068** *Payment methods (saved cards).* **Default:** now in scope because of Q-067: list, set default, remove saved Stripe methods through Checkout's stored-payment-method support; "net terms" part excluded (B2C).
- **Q-069** *Scale.* These add ~6 workstream-sized pieces (T = saved lists + recurring + saved methods; U = funding, allowance, restricted tender, credentials, each its own task block). Default: schedule them **after** Q and S as in the dependency plan; the core flow ships first.

## Round 3 — data model and catalog (asked before writing E, F)
- **Q-002 — Answered 2026-10-08: ONE variant per doctor, two prices distinguished by price channel (`mlv-remote`, `mlv-office`)**; a doctor with one mode has one price. (Original proposal was two variants.) *Doctor shape.* **Default:** one Product per doctor with **two variants** (`mode=remote`, `mode=office`), each with its own USD price; single-mode doctors have one variant; specialty = category + searchable attribute; rating/reviews from commercetools **Reviews**. Alternative: one variant, two prices by channel. **Blocking:** E, K.
- **Q-003 — Answered (accepted as proposed).** *Availability rules.* **Default:** per-doctor weekly pattern (as the prototype's 10 base times, 30-min slots) in the **doctor's own time zone**; "today" = today in the clinic's zone; remote slots shown in the visitor's zone with the zone named; window = next 7 days; slots in the past or < 2 h away hidden. **Blocking:** F, K, L.
- **Q-010** *Demo patients.* **Default:** 3 synthetic patients (Sam Rivera with both prescriptions, labs, one past booking; one empty account; one with exhausted refills), password from `SEED_PATIENT_PASSWORD` env. **Blocking:** F.
- **Q-011** *Regions.* **Default:** en-US/USD only; GB/DE remain in the project untouched. **Blocking:** none.
- **Q-012 — Answered: as proposed.** *Tax.* Sample "20% VAT included" is wrong for the US. **Default:** tax categories `mlv-rx-medicine` and `mlv-consultation` with 0% US rate, tax mode `Platform`, no tax line shown (design-cart open question: no exempt breakdown in the summary). **Blocking:** E, O.
- **Q-013 — Answered: as proposed.** *Same-day delivery (D8).* **Default:** cut-off 14:00 America/New_York (constant in config), offered only to addresses in the three seeded cities' states (NY, TX, IL) via the shipping method's zone; $5.00; otherwise Standard only. **Blocking:** E, Q.
- **Q-014** *Pharmacist review.* **Default:** order **States** `received → pharmacist-review → packed-shipped → delivered` (+ cancelled); the timeline reads the order state; a QA script `advance-order.ts` moves states (no pharmacist UI). **Blocking:** E, S.
- **Q-015** *Reviews.* **Default:** real commercetools Review objects, seeded, shown only when `authorIsVerified`-style custom flag is true; rating average and count from product rating statistics. **Blocking:** E, L.
- **Q-016** *Home statistics.* **Default:** keep only what is computed (live doctor count, average rating from reviews, "available now" count); remove "2M+ consultations" and "15 min median wait" (no source). **Blocking:** M.
- **Q-035 — Answered 2026-10-08: ALSO doctor portraits from Pexels** (overrules D9 default); medicines and banners as proposed. *Imagery.* **Default:** medications, hero, CTA band, delivery block and journal covers from Pexels via `update-images.ts` (clean URLs); doctors keep initials on peach (D9). Alternative: Pexels portraits for doctors (fictional people with stock photos of real strangers — we advise against). **Blocking:** E.

## Round 3 — behaviour per spec (asked when that workstream is designed)
**Shell / home (H, M)**
- **Q-020** Cart count = number of lines (prototype) or total quantity? **Default:** lines. (design-storefront-shell)
- **Q-021** Logo target inside the app: **default** the new home page `/en-US` (the prototype's marketing-file full reload disappears).
- **Q-022** Mobile menu design: **default** slide-down drawer with the four primary links + Sign in/Cart; needs SO-02.
- **Q-023** Hero chips: **default** keep the live "N doctors available now" chip, drop the "Rx out for delivery" chip (spec).

**Catalog / PLP / search (K)**
- **Q-030** Default sort of the doctor list (not designed): **default** soonest availability, then rating.
- **Q-031** Page size for pagination: **default** 9 (3×3 on desktop).
- **Q-032** "Near you": **default** city filter only (office mode), no distance.
- **Q-033** Search (D11) scope and the spec's exact-SKU resolution: **default** full-text over doctor name/specialty/clinic and medication name; the part-number rule applies only to medication SKUs; results page groups Doctors | Medicines.

**PDP / booking (L)**
- **Q-025** Guest booking retention (D6): **default** consent line + guests' bookings and "reason" deleted 90 days after the visit unless attached to an account; reason text stored encrypted-at-rest by CT only; never logged. SO-04 for wording.
- **Q-026** Guest → account: **default** a booking is attached after the email is verified and matches (spec); unattached bookings expire.
- **Q-027** Cancel / reschedule (not designed): **default** cancel only, up to 2 h before, frees the slot; reschedule out of v1.
- **Q-034** Booking confirmation link for guests: **default** signed token link in the email + same-session access.

**Prescriptions / cart (N, O)**
- **Q-036** Refill model: **default** each RX line has `refillsLeft`; consumption happens once, at order placement (idempotent on order id), restored on cancellation before "packed". RX with 0 refills is shown but not selectable with the reason.
- **Q-037** Rate limit of RX lookup: **default** 5 failed lookups per 10 min per customer, tracked in a Custom Object (works on serverless).
- **Q-038** Partial supply when less remains than requested: **default** refuse the line (no partial), stating what remains.
- **Q-039** Expiry-dated supply for medicines: **default** a minimum remaining shelf life per product (days) held on the inventory entry custom field as a single worst-case expiry date; short-dated stock flagged and priced separately only if seeded (one demo SKU).
- **Q-040** Price changed since add (design-cart): **default** reprice from the platform and show a "Price updated" note until dismissed.

**Checkout / orders (Q, S)**
- **Q-041** Order number: commercetools needs it set at order creation. **Default:** `MLV-` + zero-padded sequence from a Custom Object counter (optimistic concurrency).
- **Q-042** Address validation provider: **default** format-only validation (US ZIP, E.164-ish phone) without a provider; no autocomplete.
- **Q-043** Cancelling an order (post-purchase): **default** allowed until state `packed-shipped`; the refill is restored; payment refund per Q-007.
- **Q-044** Printable receipt: **default** none in v1.

**Account (J, R)**
- **Q-045** Lab PDF: **default** server-generated simple PDF (no external service), no lab values in the URL; downloaded via POST/authenticated GET.
- **Q-046** Reference ranges: **default** fixed per test as in the prototype.
- **Q-047** "Discuss with a doctor": **default** opens that lab's ordering doctor profile (every lab's ordering doctor exists in the catalog).
- **Q-048** Profile editing and notification settings (not designed): **default** out of v1; account holds name, email, password change, address book.
- **Q-049** Verification before purchase: **default** an unverified patient can browse and book as a guest but cannot place a medication order.

**Static content (V)**
- **Q-050** Journal: **default** 3 seeded articles as files in the repo (`content/journal/*.md`) with Pexels covers; block hidden if none; articles at `/journal/<slug>`.
- **Q-051** Contact form: **default** form validated and sent through the Mailer (Q-008); until OA-05 the dev outbox records it; no free text stored in commercetools.
- **Q-052** About/policy/FAQ copy: **default** Claude drafts neutral placeholder copy marked "draft"; legal copy needs SO-03/SO-04.

**Privacy (X)**
- **Q-053** Retention periods and erasure tooling: **default** scripts `erase-patient.ts` (dataErasure=true on every resource) and `subject-access.ts` (queries all 13 resources + custom objects), plus a test-environment de-identification guard in the seed.

## Answers log
*(owner answers are copied under each question and summarized into `DECISIONS.md`)*
