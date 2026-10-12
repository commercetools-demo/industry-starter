## 1. Foundations

- [x] 1.1 Write `lib/pricing/summary.ts` with the figure and row definitions of design D-9 (dueToday, thenMonthly, rows, "You save") and unit tests from the `pricing-consistency` scenarios
- [x] 1.2 Move the probe-cart builder out of `lib/ct/prompts.ts` into `lib/ct/probe.ts` with the leak-detection custom field and delete-in-`finally`; keep prompts behaviour identical [SKILL: commercetools-commerce-patterns]
- [x] 1.3 Add a test that fails when an attribute mapped into offer facts has no consumer; remove `trial-days`, `price-steps` seed data and the unused `ONE_TIME_AS_CUSTOM_LINE_ITEM`; `charge-type` is kept: it is read by the offer mapper and release validation (decision recorded here; model-notes update with 9.2)

## 2. Seed and catalog data

- [x] 2.1 Remove the second-line, bundle, intro-price and tier discounts from the seed manifest, `DISCOUNT_AMOUNTS`, `INTRO_DEFS`, `STEP_DEFS`, the label discount text and the prompt pairings; keep the schedule library's reading of intro and step periods [SKILL: commercetools-commerce-patterns]
- [x] 2.2 Seed validation: fail on any cart discount whose `recurringOrderScope` is not `NonRecurringOrdersOnly`; catalog lint warning for Merchant Center discounts that are not [SKILL: commercetools-commerce-patterns]
- [x] 2.3 Re-rank the remaining discounts descending in intended order, create the single order table and add the engine-order test [SKILL: commercetools-commerce-patterns]
- [x] 2.4 Add the `call-center` channel and customer group, customer-group prices on the bundle offer (`small-business`, `existing-customer`) and a call-center price on one phone plan variant; update price seeding and its tests [SKILL: commercetools-commerce-patterns]
- [x] 2.5 Add `requires-offers`, `negates-offers` and `eligible-regions` to the offer type and draft types; update `telecom-catalog-model` notes [SKILL: commercetools-commerce-patterns]
- [x] 2.6 Seed: a bundle offer, DIY and professional installation with `negates-offers`, a required-offer pair, a state-limited add-on, and `required-addon-kinds` where the lint expects it
- [x] 2.7 Write the confirm-flagged cleanup script that removes the retired discounts from a live project; do not run it without the owner's go-ahead [SKILL: commercetools-platform]
- [x] 2.8 Update seed counts in tests and the stale discount copy in the seeded label text (the `seed-catalog-data` plan notes move with 9.2; `design/` is a static prototype and stays as drawn)

## 3. Spikes (before dependent tasks)

- [ ] 3.1 Spike: place an order from a cart with a monthly recurring line carrying the first-month promotion and WELCOME10; price the second to fourth generated recurring orders on Fixed and Dynamic price modes; record the result in design.md [SKILL: commercetools-commerce-patterns]
- [ ] 3.2 Spike: customer-group price and channel price on recurring lines (first order and generated orders); whether a cart can carry several customer groups; cost of price selection by group and channel in the catalog read; record in design.md; also confirm a recurring line added with `externalPrice` 0 (included offers, task 4.4) places and generates recurring orders at 0 [SKILL: commercetools-commerce-patterns]

## 4. Rules and cart behaviour

- [x] 4.1 Add required-offer evaluation to `lib/offers`, wire into `guardAdd`, `revalidateLines` and the blocked-add response, including held services [SKILL: commercetools-storefront]
- [x] 4.2 Enforce `required-addon-kinds` at revalidation and in `canCheckout` with the `IssuesBanner` message and link; make lint and checkout share one rule [SKILL: commercetools-storefront]
- [x] 4.3 Add negated-offer replacement to the add request (single cart update, notice returned), symmetric choice for the reverse add, report-only on read [SKILL: commercetools-storefront]
- [x] 4.4 Create included offers as zero-price child lines in `addOfferLine`, remove with the parent, forbid single removal [SKILL: commercetools-storefront]
- [x] 4.5 Add `eligible-regions` to the eligibility resolution (state and ZIP only), the "enter your ZIP" state and cart re-validation on location change [SKILL: commercetools-storefront]
- [x] 4.6 Remove any cart-side matching of all service-address values against an offer's list

## 5. Buyer context, group and channel pricing

- [x] 5.1 Declared-context cookie and `buyer-context.ts` resolution for anonymous sessions, enum validation, signed-in sessions ignore it; apply the declared audience as the anonymous cart's customer group [SKILL: commercetools-storefront]
- [x] 5.2 Resolve channel (`online`, or `call-center` by customer group) in `buyer-context.ts`; set `distributionChannel` on cart line items [SKILL: commercetools-storefront]
- [x] 5.3 Read catalog prices by group and channel, key the catalog cache by market, group and channel [SKILL: commercetools-commerce-patterns]
- [x] 5.4 Card-vs-cart price parity test over every seeded offer, audience and channel against the fake engine

## 6. Pricing display fixes

- [x] 6.1 Replace list-based "Monthly after today", order monthly and contract total with standing-price amounts from the engine selection; add the bundle-checkout-confirmation-account agreement test
- [x] 6.2 Rows that foot: Plans, Add-ons, Devices, One-time fees, order-level discounts, shipping, tax, Due today; "Then monthly" and "You save" outside the sum; update `OrderSummary`, `CheckoutSummary`, `ReviewStep`; footing test over the seeded carts
- [x] 6.3 Include tax in Due today when not included in price
- [x] 6.4 Compute promotion amounts from the engine's reported discounted amounts; delete the `max(0, list × qty − total)` path
- [x] 6.5 Move free-shipping evaluation into the shipping method's rate; delete `optionOf`'s threshold logic and the hard-coded currency [SKILL: commercetools-commerce-patterns]
- [x] 6.6 Schedule: show the first month as period 1 for promoted plans; Due at order equals the cart's line total plus fees; keep v1 readers
- [x] 6.7 Card copy: "First month free, then $X/mo" and activation fee; one decimals rule across card and cart
- [x] 6.8 Reconciliation report: generated recurring orders whose line total differs from the stored standing amount [SKILL: commercetools-connect]
- [x] 6.9 Promotions list in the bundle (under a single line, after the lines otherwise, localised names, none when empty)

## 7. APIs

- [x] 7.1 `GET /api/offers` with filters, paging, `private, no-store`, typed errors, declared context for anonymous callers only [SKILL: commercetools-storefront]
- [x] 7.2 `GET /api/offers/[key]` with the three resolved groups, verdicts and buyer prices; 404 for ineligible [SKILL: commercetools-storefront]
- [x] 7.3 `POST /api/pricing/preview` on the shared probe, same-origin check, rate limit, cleanup guarantee, `issues` for refused items [SKILL: commercetools-storefront]
- [x] 7.4 Contract tests for the three routes against the fake client including failure and cleanup scenarios; test that preview equals the bundle for the same plan and extras

## 8. Frontend

- [x] 8.1 Header, drawer and footer "Plan finder" item from static config with active state; en-US and de-DE labels; update the existing nav tests [SKILL: commercetools-storefront]
- [x] 8.2 Buyer context bar and ZIP form (wire `useCart().setPostalCode` and `/api/serviceability`), derived/read-only states for signed-in buyers
- [x] 8.3 Finder route: family control, list, default selection, `?plan=` restore, context-change reselect, empty state
- [x] 8.4 Three-section detail with per-section empty text, loading and failure states, disabled-with-reason rows
- [x] 8.5 (note: a conflicting extra is not blocked at add time; the preview's `issues` name it with the reason on its row and Continue's server guard decides) Draft add and remove, one equipment per kind, clear on plan change, live price strip from the preview, and the one-button Continue with partial-failure handling and no duplicates
- [x] 8.6 Bundle: back-to-finder link with plan preselected and shared context
- [x] 8.7 Messages in en-US and de-DE for all new strings; keep the parity test green
- [x] 8.8 Accessibility pass on the finder (focus order, live regions for loading and refusal messages, labels on all controls)

## 9. Verification and docs

- [ ] 9.1 Walk the old demo's flow in the browser (filters, three sections, add, continue, bundle summary) with each sample customer; save screenshots
- [ ] 9.2 Update `eligibility-gated-offer`, `introductory-period-price` and `telecom-catalog-model` plan notes; note that `required-addon-kinds` is now enforced
- [ ] 9.3 Release note: finder page, retired discounts, group and channel prices, no schedule format change
