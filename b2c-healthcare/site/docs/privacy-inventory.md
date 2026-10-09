<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Privacy inventory (workstream X, spec `health-data-minimization`, D-025)

Every place where personal or health data may be stored. All data in this project is synthetic. The boundary: what crosses into
commerce is an identifier, a quantity and a price. Orders carry `rxNumber`, `rxLineRef`, quantity and price; never a sig,
diagnosis, lab value or reason for a visit. The clinical stand-in (Custom Objects in the `malva-*` containers) is a labelled demo
replacement for an EHR (D-025).

The scripts that act on this list live in `scripts/privacy/` and use the seed admin client (project-key guard, `--dry-run`):

| Script | npm | Purpose |
| --- | --- | --- |
| `erase-patient.ts <customerId or email>` | `privacy:erase` | Deletes everything of one patient with `dataErasure=true` (never a plain DELETE) |
| `subject-access.ts <customerId>` | `privacy:access` | Queries all 13 resource kinds of the GDPR list and every `malva-*` container, writes a JSON report |
| `retention.ts` | `privacy:retention` | Removes or de-identifies what outlived its basis; also runs as a scheduled Netlify function |
| `audit-live.ts` | `privacy:audit` | Reads orders, carts, payments and customers and fails if any clinical fixture string is present |

## 1. commercetools resources

Owner: the storefront (commerce). Erasure path: `DELETE ...?dataErasure=true` (also removes Messages and the platform's internal
logs for the resource). Messages are disabled in this project (PROJECT-FINDINGS) and `seed:verify` fails if they are enabled.

| Resource | Personal data held | Retention | Erasure path |
| --- | --- | --- | --- |
| Customer | Name, email, addresses (street, phone), `custom.patientRef` (opaque), `custom.fundingScheme` | Until the account is closed | `erase-patient`, `dataErasure=true`, deleted last |
| Cart | Shipping address, line items, line custom fields `rxNumber`, `rxLineRef`, `prescribedQty`, `credentialRef`, `credentialValidTo`, `coveredAmount`, `settlement` | Carts expire by platform rules | `dataErasure=true` (a Customer delete alone keeps carts) |
| Order | Same as Cart plus `custom` order meta (`allowanceApplied`, `restrictedApplied`), line fields `dispensedQty`, `authorizationParams` (dates and refill count only), `suppliedLots` | Statutory order retention is an owner decision (open question in the spec) | `dataErasure=true` |
| Payment | Tender amounts, method (`allowance`, `restricted-health-account`, card), PSP interface id | With the order | `dataErasure=true` (also payments only referenced by the patient's carts and orders) |
| Review | `customer` reference, text | Until the account is closed | `dataErasure=true` |
| ShoppingList | Saved lists: customer reference, line items (medication SKUs) | Until the account is closed | `dataErasure=true` |
| RecurringOrder | Customer reference, recurring cart (auto-refill) | Until cancelled | Not in the platform's `dataErasure` list: `erase-patient` cancels it and reports it; see `plans/notes/X-todos.md` |
| DiscountCode | Only if a `cartPredicate` names a customer id | Owner decision | `dataErasure=true` for codes whose predicate contains the customer id |
| BusinessUnit, Quote, QuoteRequest, StagedQuote | Not used by this B2C storefront; queried and erased for completeness | n/a | `dataErasure=true` (a shared Business Unit only loses the associate) |
| Message | Created by the platform per change; disabled here | n/a | Removed by `dataErasure=true` on the source resource |
| Product, Category, Inventory | Must hold no personal data (the platform does not police this). Medication names are catalog data | n/a | n/a |

## 2. Custom Object containers (API-only, invisible in the Merchant Center)

Owner: the clinical stand-in (`lib/clinical/`, `lib/ct/clinical-store.ts`) and the BFF modules named in the code. Every container
is listed in `scripts/privacy/inventory.ts`; `inventory.test.ts` fails when a container exists in `lib/ct/custom-objects.ts` but not
here. Erasure path for all: `DELETE .../custom-objects/{container}/{key}?dataErasure=true`.

| Container | Holds | Linked to a person by | Retention | Erasure |
| --- | --- | --- | --- | --- |
| `malva-rx` | Prescriptions: sig, prescriber, refills | `patientRef` | Clinical system owns it | `erase-patient` |
| `malva-lab` | Lab orders, results, notes | `patientRef` | Clinical system owns it | `erase-patient` |
| `malva-credential` | Credential class, issuer, validity | `patientRef` | Until `validTo` | `erase-patient` |
| `malva-booking` | Appointment, reason text, phone, guest name, email and phone | `patientRef` or `guest.email` | Guest: `expiresAt` = visit + 90 days; cancelled patient booking: reason and phone removed visit + 90 days | `erase-patient`, `retention` |
| `malva-slot-claim` | Doctor, mode, start, request id | None (pseudonymous request id) | Deleted with the booking; stale claims by `retention` | `erase-patient` (the booking's claim), `retention` |
| `malva-schedule` | Doctor weekly pattern | None | Kept | n/a |
| `malva-counter` | Order number counter | None | Kept | n/a |
| `malva-ratelimit` | Failure timestamps, key `rl-<customerId>` or `rl-login-<hash of email>` | Customer id; hash of email | Entry is removed when no failure is inside the 10 minute window | `erase-patient` (the customer key), `retention` |
| `malva-dispense-ledger` | Per order: `patientRef`, `rxNumber`, `lineRef`, sku, quantities | `patientRef` | With the clinical basis | `erase-patient` |
| `malva-order-attempt` | Checkout lock: cart id + version, order id and number | Cart id | 30 days | `erase-patient` (the patient's carts), `retention` |
| `malva-refill-log` | Auto-refill decision per run (ids, dates, reason code) | Recurring order id | 180 days | `erase-patient`, `retention` |
| `malva-allowance` | Allowance cycle per member (cents, order ids) | `patientRef` | With the membership | `erase-patient` |
| `malva-allowance-ledger` | Per order: `patientRef`, cycle, amount | `patientRef` | With the membership | `erase-patient` |

## 3. Cookies (browser)

| Cookie | Content | Notes |
| --- | --- | --- |
| `malva_session` | Signed JWT: `customerId`, `cartId`, `locale`, `country`, `currency`. No name, email or health data | HttpOnly, SameSite=Lax, 30 days. Stateless: cannot be revoked server side |
| `malva_bk` | Signed JWT: up to 20 booking references, own audience | HttpOnly, 90 days. The reference opens a booking only with the cookie |
| `your-shop-country-locale` | Locale | Not personal |

## 4. Logs and error reports

All server logging goes through `lib/log.ts` (redacts `reason`, `results`, `value`, `sig`, `email`, `phone`, bodies, headers,
credentials; strings lose query strings and email addresses; an Error is reduced to name and status). A few modules call
`console.error` with a fixed text, an error name and a status only. `scripts/privacy/static-scans.test.ts` fails the build if a
logging call receives a health-like key, if an order or cart custom type gets a field named like `sig|diagnosis|condition|result|reason`, or
if a route is defined with a health-like query parameter. No analytics or error-reporting service is wired in v1.

## 5. Content files, fixtures and seed data

| Place | Content | Rule |
| --- | --- | --- |
| `scripts/seed/data/` | Synthetic patients (`@example.com`, phone numbers in the 555 range), prescriptions, labs, one booking | `seed.ts` refuses anything not synthetic; a test asserts no production-looking data |
| `lib/ct/*-fixtures.ts`, `MALVA_FIXTURES=1` | Synthetic dev fixtures, refused in production | Same synthetic rule |
| `content/`, `messages/` | Static copy | No personal data |

## 6. Disclosure through the goods (decision record, task X-08)

Pseudonymity does not remove what the goods themselves say. Decision (to be confirmed by the owner at SO-04):

- The order confirmation page, the order list and order detail, and any future packing slip show the **medication name** (and
  strength, pack and quantity) of each line. The patient is signed in and sees their own record; the name is not hidden because the
  patient must be able to check what was ordered.
- They show **no** sig, diagnosis, prescriber's reason, lab value or RX contents beyond the prescription number the patient typed.
- There are **no emails, SMS messages or shipping labels in v1** (D-029), so nothing leaves the site. A dispatch note or
  parcel label would be a new surface: it must show only the order number and the recipient, not the product names, unless the
  owner re-decides.
- A booking confirmation (`/booked/<ref>`) shows doctor, time and mode, never the reason, phone or email (tested in
  `app/[locale]/booked/[ref]/page.test.tsx`). Guests have no order view.

Owner sign-off: SO-04 (privacy policy wording and the confirmation-content decision above). Evidence to attach: this section, the
confirmation page in the browser recipe, and the `audit-live` output.
