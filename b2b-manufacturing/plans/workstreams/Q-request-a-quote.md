# Workstream Q — Request a quote

**Depends on:** N, P
**Implements:** malva-request-a-quote, malva-service-detail[Request a quote for this service]
**Skills:** commercetools-storefront (`b2b/checkout.md` — "Request a Quote" submission), commercetools-commerce-patterns (quote lifecycle)

## Design
`design/malva/specs/checkout.md` incl. the owner-decided section. Route `/[locale]/request-a-quote`; stepper **Service · Site · Contact**; no payment.
- **Entry modes:** empty list → step 1 offers Plumbing / Waste management / Both and a free-text need; with services (from the list, or `?service=<slug>` which adds the service first) → step 1 shows them editable, the three-way choice only as "Not sure yet". `?sector=` preselects the sector.
- **Step 2 Site:** company (prefilled when signed in), sector (Facilities management, Manufacturing, Property / real estate, Healthcare, Other), site address (line 1, city, postcode, country US or DE (by locale)), number of sites (1, 2–10, 11–50, 50+); when a signed-in client has sites, choose one or enter a new address. Optional waste types and permit/licence fields **only** when a service with `needsWasteDetails` is in the request (Q-018).
- **Step 3:** signed-in → contact prefilled, **Submit request**; anonymous → "Create your account and submit": name, job title, work email, phone, password (N's rules), consent line with a privacy link, **Create account and submit**.
- **Submission** `POST /api/quote-requests` (one idempotent action, key = a client-generated UUID stored in the form state): validates; anonymous → `registerCompany` (N) then sign-in session patch (F); sets the cart's `shippingAddress` (site) and custom fields via `asAssociate(session).carts()`; verifies the cart is single-shipping, has no discount codes, has ≥ 1 available line; then `asAssociate(session).quoteRequests()` create with `cart` reference and custom type `mpw-quote-request` (`sector, siteCount, wasteTypes, permitNumber, notes, contactName, jobTitle, phone, reference`). `reference` = `MQ-` + 6 base-32 characters. On success clears `cartId` from the session and returns `{ reference }`; on **any** failure after account creation compensates (N's rule) so no account is left half-created; entered data is kept client-side.
- Permission check: the user's role must allow `CreateMyQuoteRequestsFromMyCarts`; otherwise the submit is replaced with the message naming the company administrator.
- One request per site (Q-017): after the confirmation "Add another site" starts a new request with the services prefilled.
- Aside card: commercial phone, email, hours, emergency line for contracted clients (from `content/contact.json`). Abuse: honeypot field + the shared rate limiter (U finalises); no visual challenge.
- Errors: inline per field with `aria-describedby`/`aria-invalid`, a live region announces them, focus moves to the first invalid field; step changes move focus to the step heading.
- Confirmation: "Request received. Thanks {name} — our commercial team will contact you within one working day." with the reference; link to Quotes and requests.

## Tasks
- [x] Q-01 Form state machine (steps, back keeps data, entry modes, `?service=`/`?sector=`) with component tests per scenario of "Three-step request form" and "Sector-specific questions" [SPEC: malva-request-a-quote]
- [x] Q-02 Validation rules and messages (exact strings from the spec), focus and live-region behaviour; tests for each message [SPEC: malva-request-a-quote]
- [x] Q-03 `lib/ct/quote-requests.ts`: set shipping address and custom fields on the cart, create the Quote Request through the associate chain; tests assert the cart shape (single shipping, no discount code, site address, zero-priced lines) and the custom fields [SKILL: commercetools-storefront] [SPEC: malva-request-a-quote]
- [x] Q-04 `POST /api/quote-requests` orchestration with idempotency key and compensation; tests: success, duplicate email asks to sign in and keeps data, delivery failure leaves no account, double submit creates once, missing permission [SKILL: commercetools-commerce-patterns] [SPEC: malva-request-a-quote]
- [x] Q-05 Signed-in prefill and site choice; test "Request appears in the portal" at the data level (the created Quote Request is returned by a BU-scoped query helper `listQuoteRequests(session)` in `lib/ct/quote-requests.ts`; R builds the screen on it) [SKILL: commercetools-storefront] [SPEC: malva-request-a-quote]
- [x] Q-06 Consent line, honeypot, aside card, confirmation and "Add another site"; tests for aside content and rejected automated submission [SPEC: malva-request-a-quote]
- [x] Q-07 Service-page link `?service=<slug>` handled end to end (replaces L's link target check) [SPEC: malva-service-detail]
- [x] Q-08 Live check: submit as a brand-new visitor; MCP shows the customer, Business Unit, cart and Quote Request (state Submitted) with custom fields and reference; delete test data with `scripts/dev-delete-test-company.ts` [SKILL: commercetools-commerce-patterns] [SPEC: malva-request-a-quote]

## Scenarios
<!-- SCENARIOS:BEGIN (generated by plans/verify-plan.mjs --sync) -->
#### malva-request-a-quote › Three-step request form
- [x] Choose what is needed
- [x] Services from the list
- [x] Going back keeps data
#### malva-request-a-quote › Required information and validation
- [x] Missing service
- [x] Invalid email
- [x] Sector and site capture
#### malva-request-a-quote › Sector-specific questions
- [x] Clinical waste selected
- [x] Only plumbing selected
#### malva-request-a-quote › An account is required to submit
- [x] Visitor without an account
- [x] Account and request in one action
- [x] Email already has an account
- [x] Request shape
#### malva-request-a-quote › Submission creates exactly one request
- [x] Successful submission
- [x] Double submit or reload
- [x] Delivery failure
#### malva-request-a-quote › Signed-in clients
- [x] Prefill
- [x] Request appears in the portal
- [x] Missing permission
#### malva-request-a-quote › Consent, abuse protection and contact alternatives
- [x] Aside content
- [x] Automated submission
#### malva-service-detail › Request a quote for this service
- [x] Preselected service
- [x] Small screen
<!-- SCENARIOS:END -->

## Browser recipe
Claude: (1) guest → PDP → Request a quote for this service → complete 3 steps → account + request created, confirmation with reference, signed in; (2) signed in as demo admin → list with two services → submit; (3) invalid email, missing company, missing service messages and focus; (4) existing email message; (5) hazardous service shows waste fields; (6) double-click Submit creates one request (MCP); (7) 375 px layout; console clean.

## Manual tests (owner-only)
SO-02.

## Definition of done
JUNIOR-GUIDE §9, plus: MCP evidence for the live submission saved to `plans/evidence/Q/`.
