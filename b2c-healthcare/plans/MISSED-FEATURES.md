# Missed features, gaps and known limitations (consolidated)

Consolidation of `plans/notes/<A..X>-missed.md`, plus the "not done" and N/A items recorded in `<A..X>-questions.md` and `<A..X>-todos.md` (workstreams Y and Z had no notes when this was written). Duplicates are merged; each entry lists every source.

**Citations.** `notes/N-missed.md#b3` = third bullet of that file; `notes/N-questions.md#8` = row 8; `notes/N-todos.md#7` = step 7 of the first numbered list (`#Ln` = numbered item under a "Live checks" heading when a file has two lists).

**Severity.** `blocker` = a spec requirement or the demo flow fails without it. `should` = a spec gap or a risk that should be closed before real use. `nice` = polish, documentation or scale hardening.

**Follow-up workstream.** Existing letters where the code lives (E seed, Y deployment); `NEW:` names a proposed workstream that does not exist yet. Companion files: `QUESTIONS-RAISED.md` (decisions), `LIVE-TODOS.md` (runbook).

## Table of contents
1. [Catalog and booking](#1-catalog-and-booking) (MF-001 to MF-024)
2. [Prescriptions and dispensing](#2-prescriptions-and-dispensing) (MF-025 to MF-033)
3. [Cart, checkout and payment](#3-cart-checkout-and-payment) (MF-034 to MF-049)
4. [Orders](#4-orders) (MF-050 to MF-058)
5. [Account](#5-account) (MF-059 to MF-073)
6. [Funding (allowance, cost-share, credentials)](#6-funding-allowance-cost-share-credentials) (MF-074 to MF-079)
7. [Privacy](#7-privacy) (MF-080 to MF-089)
8. [Static content](#8-static-content) (MF-090 to MF-097)
9. [Tooling, lint, tests and design system](#9-tooling-lint-tests-and-design-system) (MF-098 to MF-116)
10. [Deployment](#10-deployment) (MF-117 to MF-125)
11. [Spec scenarios not met or N/A, by spec](#11-spec-scenarios-not-met-or-na-by-spec)
12. [Summary counts](#12-summary-counts)

---

## 1. Catalog and booking

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-001 | Nothing was seeded or verified against the real project: E-10 is not ticked, `product-images.json` and `site-images.json` are `{}` placeholders (`seed:verify` fails the images check until `seed:images` runs); `PROJECT-FINDINGS.md` empty rows and the "no furniture left" definition-of-done are unmet. | seed (SEED-PLAN) | blocker | E (`notes/E-todos.md`, `notes/E-missed.md#b8`) | E (live), see LIVE-TODOS |
| MF-002 | Existing products are create-if-missing: attribute edits need `seed:reset` then `seed`; the shipping method zone reference is compared by id only (diff ignores zone); images are never compared. | seed | should | E (`notes/E-missed.md#b6`, `#b7`) | E |
| MF-003 | `reset-seed.ts` does not know reviews, customers or Custom Objects; reviews then block product deletion; L's price changes force a reset. | seed | should | F, L, E (`notes/F-missed.md#b2`, `notes/F-todos.md#9`, `notes/L-todos.md#1`) | E |
| MF-004 | Doctor "clinic" is not searchable (`clinicName` not a searchable attribute); the spec says search by name, specialty or clinic. | design-plp, search (D11) | should | K, E (`notes/K-missed.md#b2`, `notes/K-questions.md#3`) | E (type change before first seed) |
| MF-005 | No medication product page: medicine search hits have no link; the region "not available" card exists only on the doctor profile; `NotAvailableInRegion` and `sellableInRegion` wait for a medicine page. | design-pdp, product-detail-page | should | K, W (`notes/K-missed.md#b4`, `notes/W-missed.md#b4`) | NEW: medicine PDP |
| MF-006 | Header search: K's `SearchForm` is placed only as a magnifier link at 900 px and up; the mobile menu has no search row. | design-storefront-shell (D11) | should | K, M (`notes/K-missed.md#b1`, `notes/M-missed.md#b4`) | H (with SO-02) |
| MF-007 | Facet counts are fetched but not displayed; `/search` shows at most 8 hits per group. | design-plp | nice | K (`notes/K-missed.md#b5`, `#b7`) | K |
| MF-008 | Availability costs one Custom Object query per candidate (up to 50) per request (list) and per 60 s (home); no precomputed next-slot attribute or cache. | design-plp, design-home-page | nice | K, M (`notes/K-missed.md#b3`, `notes/M-missed.md#b2`) | K |
| MF-009 | "Next: Tue 14" is assembled as "weekday day" (other locales may want another order). | design-plp | nice | K (`notes/K-missed.md#b4`) | W/K |
| MF-010 | Doctor profile is served for any product key (not type-checked); only doctor keys are linked, the slots route 404s without a schedule. | product-detail-page | nice | L (`notes/L-missed.md#b8`) | L |
| MF-011 | Profile page reads projection and reviews per request and one customer read; no cache (would have to be keyed by currency). | design-pdp | nice | L (`notes/L-missed.md#b7`) | L |
| MF-012 | Booking stores no fee; confirmation shows today's price of the mode ("Pay at the visit" when no price). | design-pdp | nice | L (`notes/L-missed.md#b5`, `notes/L-questions.md#16`) | L |
| MF-013 | Times are shown in the clinic zone, not the visitor's (deviation from Q-003 "remote in the visitor's zone"). | design-pdp, Q-003 | should | L (`notes/L-questions.md#11`) | L (owner decision QR-010) |
| MF-014 | A slot claim is per doctor and mode: a doctor can be booked remote and in office at the same instant. | design-pdp | should | F (`notes/F-questions.md#5`) | F (owner decision QR-009) |
| MF-015 | Video visits have no join link or provider; the confirmation and appointment texts are placeholders. | design-pdp | should | L (`notes/L-missed.md#b6`, `notes/L-questions.md#3`) | NEW: video session provider |
| MF-016 | `POST /api/bookings` has no rate limit (guests can hold many slots). | design-pdp | should | L (`notes/L-missed.md#b3`) | L |
| MF-017 | No purge of expired guest bookings or old slot claims in F/L code; only X's retention function (not yet live) removes them. An expired guest booking is unreadable but stored. | health-data-minimization | should | F, L (`notes/F-missed.md#b3`, `notes/L-missed.md#b2`, `notes/F-questions.md#7`) | X (live), Y |
| MF-018 | No reschedule (v1); cancel only (staff rule 2 h); no cancel for guests. | design-account-area | should | R, L (`notes/R-missed.md#b3`) | NEW: reschedule and guest cancel |
| MF-019 | The "My appointments" link on the confirmation page 404s until R ships; a guest who registers sees the booking only from the same browser until R-07's attach runs. | design-pdp | nice | L (`notes/L-missed.md#b1`) | R (done, verify live) |
| MF-020 | Hero alt text is empty, photographer credit is not displayed, `home-cta` photo slot seeded but unused (brand gradient used). | design-home-page | nice | M (`notes/M-missed.md#b7`, `#b8`) | M |
| MF-021 | Home statistics "2M+ consultations" and "15 min median wait" were removed (no source); "8,000 verified doctors" is the real doctor count; "available now" is "available today". Review counts are 3 to 6 per doctor, not the prototype's 96 to 421. | design-home-page (Q-016) | nice | M, F (`notes/M-questions.md#1`, `#4`, `notes/F-missed.md#b8`) | M (owner QR-018, QR-019) |
| MF-022 | All messages are sent to the client, so gated claim text (same-day, auto-refill) exists in the payload though not rendered. | design-home-page | nice | M (`notes/M-missed.md#b5`) | M |
| MF-023 | `getShippingMethods` returns every active method regardless of zone or currency; the UI must filter. | checkout | nice | G (`notes/G-missed.md#b6`) | Q |
| MF-024 | `getProductByKeyCached` and rating statistics types live in `lib/ct` and `lib/types.ts` in two places; `generateStaticParams` or any page using the root layout is dynamic (the layout reads the session): static marketing pages are not possible without a split layout. | design-storefront-shell | nice | F, G, H, V (`notes/F-missed.md#b7`, `notes/G-missed.md#b3`, `notes/H-missed.md#b3`, `notes/V-missed.md#b1`) | H (layout split) |

## 2. Prescriptions and dispensing

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-025 | No API Extension: direct API calls bypass prescription, per-order and monthly limits (D-028, README "Known gap"). | dispensing-quantity-limit ("direct API"), prescription-bound-supply | blocker for production, should for demo | N, O, Q, T (`notes/N-missed.md#b4`, `notes/N-questions.md#22`, `notes/O-missed.md#b1`) | NEW: API Extension workstream |
| MF-026 | Monthly ceiling race: two concurrent orders can both pass the count check; cart lines do not count towards the ceiling. | dispensing-quantity-limit | should | N, O, Q, T (`notes/N-missed.md#b2`, `notes/O-missed.md#b4`, `notes/Q-missed.md#b4`, `notes/T-missed.md#b4`) | N (per-patient-month counter) |
| MF-027 | Ceiling is derived from `maxQtyPerOrder` (no separate monthly attribute), counted in UTC calendar month, in packs. | dispensing-quantity-limit | should | N (`notes/N-questions.md#4`-`#6`) | E + N (owner QR-011) |
| MF-028 | Short-dated channel `mlv-short-dated` and price are not in the seed; short-dated stock is excluded, not offered. No inventory supply-channel seed for lots; a lot is text on the order line. | prescription-bound-supply (expiry-dated supply) | should | N (`notes/N-missed.md#b5`, `#b6`, `notes/N-questions.md#10`) | E |
| MF-029 | Per-account minimum shelf life and ceiling overrides are B2C-excluded and not built. | dispensing-quantity-limit | nice | N (`notes/N-missed.md#b7`) | none (excluded) |
| MF-030 | `withSuppliedLots` and `promiseStillMet` are not wired into `advance-order` at the `packed` step; `suppliedLots` stays `[]`. | prescription-bound-supply | should | N, Q (`notes/N-missed.md#b1`, `notes/Q-questions.md#15`) | F/N |
| MF-031 | Cart-load re-check of a lowered ceiling is a function (`validateRxSelection`), used by O; the platform also removes lines on the next cart update if a native limit is lowered (not verified). | dispensing-quantity-limit | nice | N, O (`notes/N-missed.md#b3`, `notes/O-todos.md#8`) | N (live) |
| MF-032 | Native upper limit error code `LineItemQuantityAboveLimit` is assumed, not verified. | dispensing-quantity-limit | should | N (`notes/N-questions.md#8`, `notes/N-todos.md#6`) | N (live) |
| MF-033 | `/prescriptions` is dynamic and must not be CDN-cached; deployment must keep `cache-control: private`. | prescription-bound-supply, health-data-minimization | should | N (`notes/N-missed.md#b9`) | Y |

## 3. Cart, checkout and payment

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-034 | No live payment: no Checkout Application or Stripe account (OA-04); without `CTP_CHECKOUT_APP_KEY` no order can be placed. The fake provider ("DEMO payment") serves tests and fixtures only. | checkout, checkout-page, payment-methods | blocker | Q (`notes/Q-questions.md#2`, `notes/Q-todos.md`) | Q (live) |
| MF-035 | Checkout application mode (does Checkout create orders?) unverified; if it does, orders lack `orderNumber` and line records. | checkout | blocker | Q (`notes/Q-todos.md#L1`) | Q (live) |
| MF-036 | Widget message names (`payment_started`, `payment_completed`, `checkout_completed`, `payment_cancelled`, `payment_failed`) and the custom payment button pickup (`data-ctc-selector="paymentButton"`) are from docs, unverified. | checkout-page | should | Q (`notes/Q-todos.md#L2`, `#L3`) | Q (live) |
| MF-037 | Authorization lag: the server reads the Payment right after the widget reports; a slow PSP notification returns `PAYMENT_REQUIRED` although the buyer paid. No polling or retry; double-charge protection unconfirmed. | checkout | should | Q (`notes/Q-missed.md#b6`) | Q |
| MF-038 | Authorization only, no capture on `mlv-packed-shipped`; refund is a marker plus void; capture after cancel is not built. | checkout, order-history | should | Q, S (`notes/Q-questions.md#18`, `notes/S-missed.md#b2`) | NEW: capture and refund |
| MF-039 | Address typed at checkout is not saved to the address book (no "Save to my address book" box); no state/ZIP warning in checkout; no billing address. | checkout, address-book | nice | Q, P (`notes/Q-missed.md#b7`, `#b8`, `notes/P-missed.md#b2`) | Q |
| MF-040 | Order attempt lock records `malva-order-attempt` are never cleaned (X retention covers 30 days once live); order number gaps are not reused (harmless). | health-data-minimization | nice | Q (`notes/Q-missed.md#b4`, `#b5`) | X |
| MF-041 | Region switch could leave an old-currency cart "newest Active"; W fixed `fetchActiveCart` by currency; checkout itself does not detect a currency different from the session's. Old carts are never deleted. | design-cart, switching-region-or-language | should | O, Q, W (`notes/O-missed.md#b7`, `notes/Q-missed.md#b13`, `notes/W-missed.md#b3`) | W/Q |
| MF-042 | Cart total counts lines flagged unavailable ("N not included", Checkout disabled); Subtotal row is summed on the server; "Price updated" note disappears on the next read. | design-cart | should | O (`notes/O-missed.md#b2`, `#b5`, `notes/O-questions.md#5`) | O (owner QR-029, QR-030) |
| MF-043 | No discount codes, no minimum order, no quantity change on cart (scenarios N/A with reasons in the workstream file); discount codes and gift cards not part of checkout. | design-cart, discount codes | should | O, Q (`notes/O-missed.md#b3`, `notes/Q-missed.md#b9`) | NEW: promotions (if wanted) |
| MF-044 | Cart read can make up to three platform calls (recalculate, optional custom-field update, N's reads); slow-page risk; no caching per patient. | design-cart | nice | O (`notes/O-todos.md#12`) | O |
| MF-045 | Same-day delivery price shown on the card and the summary Delivery row come from two reads (agree by construction). | checkout | nice | Q (`notes/Q-missed.md#b10`) | Q |
| MF-046 | Policy "opened from checkout" is proven for the link only; the checkout page must use `PolicyLink`. | policy pages | should | V (`notes/V-missed.md#b4`, `notes/V-todos.md`) | Q |
| MF-047 | A hand-typed `POST /orders` with a stale cart is not stopped server-side (no API Extension). | checkout | should | O (`notes/O-missed.md#b1`) | NEW: API Extension |
| MF-048 | No standalone "add a card" form on `/account/payment-methods`; saving happens in the widget. Refunds to saved cards are manual; automated reversals do not work for stored-method payments. | payment-methods | should | T (`notes/T-missed.md#b5`, `#b6`, `notes/T-questions.md#23`, `#24`) | T (owner QR-020) |
| MF-049 | Business-unit payment features (net terms, credit line, company methods, list sharing) are B2C-excluded and not built. | payment-methods, saved-lists | nice | T (`notes/T-missed.md#b7`, `notes/T-questions.md#22`) | none (excluded) |

## 4. Orders

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-050 | Order history shows the newest 50 only: no pagination, no filters across the whole history. | order-history | should | S (`notes/S-missed.md#b3`, `notes/S-questions.md#5`) | S |
| MF-051 | Shipment detail: only `shipmentState`; no Delivery, Parcel or TrackingData (no carrier integration). | order-history (tracking) | should | S (`notes/S-missed.md#b4`, `notes/S-questions.md#12`) | NEW: carrier integration |
| MF-052 | Returns and refund state for a return are not built (pharmacy rule); scenarios "Return started" and "Refund state visible" are N/A. | order-history | nice | S (`notes/S-missed.md#b5`, `notes/S-questions.md#15`) | none (policy) |
| MF-053 | No printable receipt (Q-044 default). | order-history | nice | S (`notes/S-missed.md#b6`) | S |
| MF-054 | No confirmation email and no cancelled-order notification (D-029); the order page is the only place that says so. | order-history | nice | S (`notes/S-missed.md#b7`, `#b8`) | none (D-029) |
| MF-055 | Reorder unavailable in fixtures; a cancel race in two tabs may show "could not cancel" once. | order-history | nice | S (`notes/S-missed.md#b9`, `#b10`) | S |
| MF-056 | Cancelled-by-refusal orders (last-moment prescription refusal) appear as Cancelled with no `Refund` row because Q's `cancelOrder` releases the payment but writes no marker. | order-history | should | S, Q (`notes/S-missed.md#b12`, `notes/Q-missed.md#b3`) | Q/S |
| MF-057 | `restoreAllowance` and `restoreRestricted` hooks in `lib/ct/order-cancel-hooks.ts` were no-ops at S's merge; U must have filled them (verify). | order-history, benefit-allowance-drawdown | should | S, U (`notes/S-missed.md#b1`) | U (verify) |
| MF-058 | `countOrders` (R) and `listOrdersForCustomer` (S) share the `customerId` scoping rule but not code. | order-history | nice | S (`notes/S-missed.md#b11`) | S |

## 5. Account

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-059 | No password-reset UI (Q-070, D-032): `password-reset` spec not built. Email verification resend/expiry are implemented but unreachable (auto-verified, D-029, Q-073). | password-reset, email-verification | should (decided) | J (`notes/J-missed.md#b8`, `notes/J-questions.md#8`) | none (owner decision) |
| MF-060 | Session cookie is stateless (30 days): sign-out, password change and erasure do not revoke other browsers; login CSRF is SameSite=Lax only. | account-sign-in | should | D, J, R, X (`notes/D-missed.md#b3`, `notes/J-missed.md#b4`, `#b5`, `notes/R-missed.md#b7`, `notes/X-missed.md#b6`) | NEW: session revocation |
| MF-061 | Registration collects no date of birth or consent text; terms and privacy acceptance missing. | account-register | should | J (`notes/J-missed.md#b10`) | J + owner (QR-007) |
| MF-062 | Rate-limit buckets `rl-*` accumulate in `malva-ratelimit` with no purge (X retention covers it once live). | account-sign-in | nice | J (`notes/J-missed.md#b9`) | X |
| MF-063 | Sign-in has no sign-out control until R (R added it in the account side nav); `/account` was a 404 until R. | account-sign-in | nice | J (`notes/J-missed.md#b1`, `#b2`) | R (verify) |
| MF-064 | Email change (`changeEmail` de-verifies) is not offered; the profile shows email read-only. | account profile | nice | J, P (`notes/J-missed.md#b6`) | P |
| MF-065 | Address book: approximate ZIP-prefix to state table (e.g. 733xx wrong); address count unlimited and unpaged; a name change does not rewrite saved addresses; no billing address handling; `defaultBillingAddressId` never set. | address-book | nice | P (`notes/P-missed.md#b2`-`#b6`) | P |
| MF-066 | Profile editing beyond name and password and notification settings are out of v1 (Q-048). | design-account-area | nice | P (`notes/P-questions.md#7`) | none |
| MF-067 | Orders tile only counts; `/account/orders` was a stub until S. | design-account-area | nice | R (`notes/R-missed.md#b2`) | S (verify) |
| MF-068 | Appointment cards omit the reason for the visit (health-data rule). | design-account-area | nice | R (`notes/R-missed.md#b4`) | none |
| MF-069 | Account reads (`listBookingsForPatient`, labs) fetch all of a patient's objects (pages of 200) on every render; four platform reads on the overview; none cached. | design-account-area | nice | R (`notes/R-missed.md#b5`, `#b6`) | R |
| MF-070 | Lab PDF: English only, Helvetica WinAnsi only (other characters print `?`), file name carries the lab id. | design-account-area (labs) | nice | R (`notes/R-missed.md#b8`, `#b9`) | R |
| MF-071 | Guest booking attach finds guests by exact-case email (plus lowercase); the attach hook runs a customer read and a booking query on every sign-in. | account-sign-in | nice | R (`notes/R-missed.md#b10`, `#b11`) | R |
| MF-072 | No dev fake session: every signed-in view is verified by unit tests only until a seeded project exists. | design-account-area | should | R (`notes/R-questions.md#13`) | R (live) |
| MF-073 | Header cart count for a customer without `cartId` in the session uses `?view=summary`, which looks up by customerId (one read, no write). | design-cart | nice | O (`notes/O-missed.md#b6`) | O |

## 6. Funding (allowance, cost-share, credentials)

Workstream U notes are brief (`notes/U-missed.md`, `U-questions.md`, `U-todos.md`).

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-074 | No allowance exists until the first reload creates the cycle object (Q-062 said the seed gives Sam $50/month). | benefit-allowance-drawdown | should | U (`notes/U-missed.md#b1`, `notes/U-questions.md`) | E/U (seed runs the reload) |
| MF-075 | Allowance cycle is the UTC month, not patient local time; an unrecoverable allowance outcome is only logged. | benefit-allowance-drawdown | should | U (`notes/U-missed.md#b2`, `#b7`) | U |
| MF-076 | Controlled products are not flagged on the PLP or PDP; the reason shows only in prescription and cart rows (Q-065 said shown but unavailable with the requirement stated). | credentialed-purchase-scope | should | U (`notes/U-missed.md#b3`) | NEW: medicine PDP / U |
| MF-077 | Cover percentages are fixed demo values with a 3000-cent order cap (no real claims engine); reverting cover transiently writes list prices on the cart before the next recalculation. | payer-and-patient-cost-share | nice | U (`notes/U-questions.md`, `notes/U-missed.md#b5`) | U (owner QR-012) |
| MF-078 | No `netlify.toml`; the allowance schedule is declared in the function config; shared-file merge risk with T on the account-nav test. | deployment | nice | U (`notes/U-missed.md#b4`, `#b6`) | Y |
| MF-079 | Dev-server check used fixtures: the prescription lookup route guess returned 404; forced-fail and controlled-product states covered by unit tests only; the funding Payment amount with tender Payments on the cart and the `externalPrice` revert are unverified. | eligible-item-tender-restriction, payer-and-patient-cost-share | should | U (`notes/U-todos.md`) | U (live) |

## 7. Privacy

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-080 | Nothing in `scripts/privacy/` ran live; predicates are written from API field names and the GDPR page. The definition of done (erase a throwaway patient) is not demonstrated. | health-data-minimization | blocker | X (`notes/X-missed.md#b1`, `notes/X-todos.md#1`) | X (live) |
| MF-081 | RecurringOrder cannot be erased through `dataErasure`: cancelled and reported `notErasable`. | health-data-minimization | should | X (`notes/X-missed.md#b2`) | X + commercetools support |
| MF-082 | Hashed login buckets cannot be tied to a person: erase does not remove them; retention removes them within a day. | health-data-minimization | nice | X (`notes/X-missed.md#b3`) | none |
| MF-083 | Subject access scale: `malva-order-attempt` and DiscountCode/CartDiscount reads list the whole container and filter in memory. | health-data-minimization | nice | X (`notes/X-missed.md#b4`) | X |
| MF-084 | Orders keep medication names by design (D-025, SO-04); the audit does not flag product names. | health-data-minimization | nice | X (`notes/X-missed.md#b5`) | none |
| MF-085 | Patient bookings keep reason text until cancelled and 90 days past the visit; completed patient bookings are not retention-deleted (clinical history). | health-data-minimization | should | X (`notes/X-missed.md#b7`, `notes/X-questions.md#8`) | X (owner QR-006) |
| MF-086 | The retention function has no seed project-key guard; safety is the secret header and idempotent rules. | deployment | nice | X (`notes/X-missed.md#b8`) | X |
| MF-087 | Erased customer's session cookie remains valid; behaviour of pages for a missing customer id was not tested. | account-sign-in | should | X (`notes/X-missed.md#b6`) | NEW: session revocation |
| MF-088 | SO-04 row in `TODO-MANUAL-TESTING.md` not updated; evidence is in `docs/privacy-inventory.md` section 6. | health-data-minimization | nice | X (`notes/X-missed.md#b9`, `notes/X-questions.md#11`) | docs |
| MF-089 | Project Messages must be disabled (verified by `seed:verify`); an unrelated Subscription that needs Messages would copy health-adjacent data. | health-data-minimization | nice | X (`notes/X-questions.md#13`) | Y |

## 8. Static content

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-090 | All policy, FAQ, about, contact and journal copy is placeholder (`draft: true`); legal wording needs SO-03/SO-04. | policy pages, faq, about | should | V, I, L (`notes/V-todos.md`) | owner + V |
| MF-091 | Contact has no form (Q-072): shows email and phone only. | contact-us | nice | V (`notes/V-todos.md`) | none (decided) |
| MF-092 | FAQ has no accordion and no "Was this helpful?" control. | faq | nice | V (`notes/V-questions.md#5`) | V |
| MF-093 | Withdrawn articles return HTTP 200 (not 410) with `noindex` and are exempt from the sitemap. | journal | nice | V (`notes/V-missed.md#b2`) | V |
| MF-094 | Content changes need a rebuild or redeploy (files in the repo); "editor publishes without deployment" is covered only as "page reads the current file". | journal | nice | V (`notes/V-missed.md#b3`) | V |
| MF-095 | `SITE_URL` unset gives localhost canonicals; policy version "in force" uses the server's UTC date as ISO strings. | seo | should | V (`notes/V-missed.md#b5`, `#b6`) | Y |
| MF-096 | `getPublishedArticles` includes drafts, so placeholder articles can show on the home row in production. | home, journal | should | M, V (`notes/M-missed.md#b3`) | V (owner QR-023) |
| MF-097 | Not rendered in a real browser: visual compare of journal list and article, JS-disabled rendering, mobile viewport, screenshots under `plans/evidence/`. | design-* | nice | V, H (`notes/V-todos.md`, `notes/H-todos.md`) | all (browser pass) |

## 9. Tooling, lint, tests and design system

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-098 | `npm audit` reports vulnerabilities in transitive dev dependencies; untriaged (D-002 pins old SDK majors); `pdf-lib` and the Checkout SDK added more. | bootstrap-storefront | should | A, D, G, R (`notes/A-missed.md#b8`, `notes/D-missed.md#b6`, `notes/G-missed.md#b8`, `notes/R-questions.md#3`) | A |
| MF-099 | No bundle scan inside `npm run check` (needs a build); `scripts/check-bundle.mjs` runs in `verify:build`. "Server-only modules guarded at build time" proven only by a guard test (vacuous at A; build-failure test not written). | bootstrap-storefront | should | A (`notes/A-missed.md#b2`, `#b3`) | A |
| MF-100 | Design lint rules cannot run in oxlint; they run via ESLint as warnings only; the font regex false-positives on `font-family: 'Poppins'` (space); hex and px rules flag `href="#add"` and `sizes="(max-width: 768px) ..."`; rules see only string literals, not templates or Tailwind arbitrary values. | design-system-tokens | should | B, H (`notes/B-missed.md#b1`-`#b4`, `notes/H-missed.md#b8`) | B |
| MF-101 | `--text-*` tokens map without line heights; `--space-*` tokens have no Tailwind mapping; the `lg:`/`sm:` breakpoints (640/1024 px) sit beside the design's 900 px. | design-system-tokens | nice | B, H (`notes/B-missed.md#b6`, `#b7`, `notes/H-missed.md#b4`, `#b5`) | B |
| MF-102 | `design/DESIGN.md` hover/active states and tokens-per-element were not audited beyond the spec scenarios. | design-system-tokens | nice | B (`notes/B-missed.md#b8`) | B |
| MF-103 | SO-01 screenshot pair (white vs navy label) never saved: the DevTools screenshot tool refused repo paths. Computed styles were checked. | design-system-tokens | nice | B, H (`notes/B-todos.md`, `notes/H-todos.md`) | B (owner QR-015) |
| MF-104 | Scenarios "Action color", "Green means available or free", "Radius by element" can now be tested and ticked (H's primitives tests exist). | design-system-tokens | nice | B, H (`notes/B-todos.md`, `notes/H-todos.md`) | B |
| MF-105 | D-05 mapper test for `getLocalizedString`/`formatMoney` skipped (C owned utils); G's `catalog.test.ts` exercises both. | bootstrap-storefront | nice | D, G (`notes/D-todos.md`, `notes/G-todos.md`) | D |
| MF-106 | `formatMoney` derives fraction digits from `Intl`, not from Money `fractionDigits`; high-precision money not handled. | i18n | nice | C (`notes/C-missed.md#b4`) | C |
| MF-107 | "Single source" scenario is a scan of `.tsx` for `'en-US'`/`'USD'` only; typed messages (`AppConfig`) not added. | i18n | nice | C (`notes/C-missed.md#b2`, `notes/C-todos.md`) | C |
| MF-108 | `routing.locales` and `proxy.ts` use the unfiltered `COUNTRY_CONFIG`; an unconfigured region such as `/de-DE/...` still renders by URL; "Region not configured in commercetools" is enforced only in the switcher and `POST /api/locale`. | switching-region-or-language | should | C, G, W (`notes/C-todos.md`, `notes/G-missed.md#b4`, `notes/W-missed.md#b1`) | W (when a second region exists) |
| MF-109 | Mobile menu has no region entry; the switcher is hidden under the `nav` breakpoint. | switching-region-or-language | nice | W (`notes/W-missed.md#b6`) | H |
| MF-110 | Unmatched `/en-US/...` 404 renders Next's default page when not called through `notFound()`; the I catch-all fixes pages under the locale, but a root `app/not-found.tsx` is not defined. `_boom` and `_tokens` exist in the route table in production (answering 404). | error-pages | nice | H, I (`notes/H-todos.md`, `notes/I-missed.md#b1`-`#b3`) | I |
| MF-111 | A failure in the root layout goes to `global-error` (English only, no header); `lib/log.ts` is used only by `lib/api.ts`; other `console.error` calls are unchecked (X's scan covers logging call shapes). | error-pages | nice | I (`notes/I-missed.md#b5`, `#b6`) | I |
| MF-112 | The expired-session prompt is a card at the route, not a redirect; spec wording "routed to sign-in" is met by the card's link. | error-pages | nice | I (`notes/I-missed.md#b7`) | I |
| MF-113 | Static scans are regex-based: they catch common shapes (`unstable_cache` on patient data, navigation in try, handlers in server pages), not every possible one. | architecture rules | nice | G, X (`notes/G-missed.md#b2`) | G |
| MF-114 | `plans/STATUS.md` counts are stale after many workstreams (`node plans/verify-plan.mjs --sync`); `verify-plan.mjs` reports it. | planning | nice | O, Q, S, T (`notes/O-missed.md#b9`, `notes/T-missed.md#b14`) | docs owner |
| MF-115 | `SEED-PLAN.md` and `PROJECT-FINDINGS.md` disagree with the built seed (field names, ledger and counter owners, E-02 wording). | seed | nice | E, F (`notes/E-missed.md#b1`-`#b3`, `notes/F-missed.md#b1`, `#b5`) | docs owner |
| MF-116 | Browser verification for most workstreams (K, L, M, N, O, Q, R, S, T, U, V, W, I) used curl or component tests against `MALVA_FIXTURES=1` because the Chrome DevTools connector was unavailable: no rendered layout, focus or 390 px checks, no Lighthouse for K, L, M. | all design specs | should | K, L, M, N, O, P, Q, R, S, T, U (`notes/*-missed.md`, `notes/*-todos.md`) | all (browser pass) |

## 10. Deployment

| ID | Description | Spec(s) | Severity | Source | Follow-up |
| --- | --- | --- | --- | --- | --- |
| MF-117 | Release pipeline step that deletes `app/api/health/` before `next build` does not exist; `verify:build` fails the check when `NODE_ENV=production` and the folder exists. | bootstrap-storefront ("Not shipped") | blocker for release | D (`notes/D-missed.md#b1`, `notes/D-todos.md` "Other") | Y |
| MF-118 | Scheduled Netlify functions (`auto-refill-run`, `reload-allowances-scheduled`, `retention-scheduled`) need secrets and registration; no `netlify.toml`; no live check of the crons. | subscriptions-and-recurring-orders, benefit-allowance-drawdown, health-data-minimization | blocker for those features | T, U, X (`notes/T-todos.md#L8`, `notes/U-todos.md`, `notes/X-todos.md#5`) | Y |
| MF-119 | Set `SITE_URL`, `SESSION_SECRET`, `CTP_*`, `CTP_CHECKOUT_APP_KEY`, `AUTO_REFILL_*`, `RELOAD_ALLOWANCES_SECRET`, `RETENTION_SECRET` in Netlify; never `MALVA_FIXTURES`, `RESOLVER_FORCE_FAIL`, `SAME_DAY_NOW_OVERRIDE` in production (see LIVE-TODOS section 3). | deployment | blocker | M, Q, T, U, V, X | Y |
| MF-120 | Hosting must keep `cache-control: private` on patient pages and `no-store` on `/api/account/*`; `next.config.ts` sets the account headers. | health-data-minimization | should | N, R (`notes/N-missed.md#b9`, `notes/R-questions.md#8`) | Y |
| MF-121 | `NODE_ENV=production` must hide fixtures, `_tokens`, `_boom` and the fake payment provider (guards exist and are tested; confirm on the built site). | bootstrap-storefront | should | K, Q, I, H | Y |
| MF-122 | Cron function timing and public-call safety: `GET /.netlify/functions/auto-refill-run` from the public internet must not start a run; unverified live. | subscriptions-and-recurring-orders | should | T (`notes/T-todos.md#L8`) | Y |
| MF-123 | Platform behaviours unverified live (shapes, scopes, search paths, Checkout): see LIVE-TODOS "Things that may fail live". | many | should | all | each workstream (live) |
| MF-124 | Trial project expires 2026-12: nothing built there outlives it (PROJECT-FINDINGS). | deployment | nice | PROJECT-FINDINGS | owner |
| MF-125 | PR bodies for A-09 (clean-clone dry run) and B-08 proof were left to whoever opens the PR. | bootstrap-storefront | nice | A, B (`notes/A-todos.md`, `notes/B-todos.md`) | docs owner |

## 11. Spec scenarios not met or N/A, by spec

Scenarios the juniors left unticked or marked N/A, with the reason. Each maps to the MF above.

| Spec | Scenario | Reason | MF |
| --- | --- | --- | --- |
| bootstrap-storefront (D) | "Valid credentials" (`/api/health` returns 200) | blocked on OA-02, OA-03 | MF-001, LIVE step "health" |
| bootstrap-storefront (D) | "Localized strings and money" (D-05) | C owned `lib/utils.ts`; G covers it | MF-105 |
| bootstrap-storefront (A) | "Reproducible install" with `.env.example` values | file has no values; build works with empty env | MF-099 |
| design-system-tokens (B) | "Action color", "Green means available or free", "Radius by element" | needed real components (now exist) | MF-104 |
| session and catalog (G) | "Catalog page", "Patient data in the first HTML" | needed real pages (H/J) | MF-116 |
| dispensing-quantity-limit / prescription-bound-supply (N) | "Request arriving outside the storefront" | BFF-only (D-028, Q-005 = B) | MF-025 |
| dispensing-quantity-limit (N) | "Override where permitted" | B2C-excluded | MF-029 |
| design-cart (O) | four scenarios: discount codes, minimum order, quantity change | not designed or excluded | MF-043 |
| order-history (S) | "Return started", "Refund state visible" | pharmacy rule, no returns | MF-052 |
| order-history (S) | tracking references (Delivery/Parcel/TrackingData) | no carrier integration | MF-051 |
| design-account-area (R) | "Sign-in and create account card" scenarios | J's workstream; unticked in R with N/A reasons | MF-063 |
| switching-region-or-language (W) | "Product not sellable in the new region" for cart lines | cart emptied on currency change; covered by read flag, notice and search exclusion | MF-108 |
| password-reset | whole spec | omitted (Q-070) | MF-059 |
| email-verification | resend and expiry | implemented, unreachable (Q-073) | MF-059 |
| payment-methods | "add a card" path | widget only | MF-048 |
| payment-methods, saved-lists | business-account items (net terms, list sharing, who may remove a card) | B2C-excluded | MF-049 |
| address-book | "Default address removed" | spec followed over plan | (resolved, QR-042) |

## 12. Summary counts

See the report: 125 entries (MF-001 to MF-125).
