## Context

The old DTV demo put a React UI on two Cloud Run services. The offer service listed offers and expanded their relations. The pricing service built a commercetools cart, ran conflict and eligibility checks, re-implemented discount arithmetic for free periods and windows, and returned due-now, ongoing rate, a timeline and promotions. Evidence and the defects found there: [gap-analysis.md](./gap-analysis.md), `dtv-demo-features.md`, `dtv-microservices-features.md`.

Malva already has the rules (`lib/offers`: compatibility, exclusivity, eligibility, holdings, serviceability, required equipment) and reads totals from the engine. What it lacks is the finder page and its three endpoints, buyer controls, group and channel prices, dependency rules, and a few display fixes.

Decisions of 2026-10-12 shape this design: the finder is a normal page; promotions apply to the first order only; recurring orders keep the original price; group and channel prices are in; no breaking change.

Constraints: Next.js BFF only (no new services); commercetools is the pricing engine; keys not ids; every cart write is re-checked server-side; `lib/ct` stays the only importer of the SDK.

## Goals / Non-Goals

**Goals:**
- The old demo's flow as the plan finder page, with the APIs it needs.
- One engine-derived number per money figure, on every surface.
- Customer-group and channel prices that match between card and cart.
- The dependency rules the catalog model already promises.

**Non-Goals:**
- Porting the old services, their API shapes or their defects.
- Any promotion with a duration (free days, trial days, steps, windows), prepayment, gifts, a rate timeline.
- DMA as an eligibility input, a real serviceability provider, billing integration, B2B, agent tooling.

## Decisions

### D-1: Finder is a normal route with a static nav item

`app/[locale]/plan-finder/page.tsx`. The header's category items come from the category tree (`loadNavItems`); the finder item is appended from static config (`lib/config/nav.ts`) so it survives a catalog outage, like Support. Same item in the drawer and footer. Alternative: turn the listing into the finder. Rejected: it changes the main browsing flow for a flow that differs in shape (draft, one apply).

### D-2: Draft in the browser, one apply on Continue

Extras live in client state and are applied by one Continue action: plan first (with its required equipment), then each extra attached to the plan line, then navigation to `/bundle`. Alternative: write each choice to the cart like the cards do. Rejected: the old flow and the one-plan-per-category rule make an immediate write surprising, and abandoned choices would leave a cart behind. Cost: Continue can partly fail, hence "accepted lines kept, refused line named" in the spec.

### D-3: First-order-only promotions, recurring orders at the standing price

Every Cart Discount is `NonRecurringOrdersOnly`. A seed test fails on any other scope and a catalog lint warns about Merchant Center discounts that are not (so a merchandiser's `AnyOrder` discount cannot silently make displayed recurring amounts wrong). With that invariant, "Then monthly" is `Σ line.price.value × quantity` over recurring lines, where `price.value` is the engine's own price selection for the buyer's market, group and channel. No arithmetic on discounts. This is also why `PriceSchedule` v1 stays: standing is the list/selected price, the first-month promotion is a first period, and nothing else needs a new format.

The invariant rests on one platform behaviour to confirm by spike (task 3.2): a cart with a recurring line placed with `POST /orders` applies `NonRecurringOrdersOnly` discounts to the order created now and not to generated recurring orders. The commerce-patterns skill states the scope controls whether a discount repeats; the spike checks it on Fixed and Dynamic price modes and with a customer-group price.

### D-4: Pricing preview is one probe cart

`POST /api/pricing/preview` builds one throwaway cart with the same builder the real add uses (`lib/ct/cartDrafts.ts`, as `lib/ct/prompts.ts` does), reads the engine's line totals and discounted amounts, then deletes it in `finally`. `dueToday` is the cart total (plus tax per `pricing-consistency`); `thenMonthly` is the standing-price sum of D-3; `promotions` is built from `discountedPricePerQuantity` with discount names and amounts. The probe builder is moved from `prompts.ts` to `lib/ct/probe.ts` and shared; probes carry a custom field so a sweep can find leaks. Alternative: compute the preview in our code from the catalog. Rejected: it would become the second discount engine the gap analysis warns against.

Latency: one create, one delete per preview. The finder debounces and shows its strip as pending; Continue never waits for it.

### D-5: Declared context for anonymous visitors

A cookie `malva-buyer-context` holds `customerType`, `existingCustomer` and `postalCode`, each restricted to its enum or format, read in `lib/ct/buyer-context.ts` for anonymous sessions only. Signed-in sessions ignore it. The declared audience becomes the anonymous cart's customer group so that eligibility (guard), price selection and discounts agree.

A commercetools cart carries one customer group, while a declared buyer can be both small business and existing. Resolution picks one group by the existing priority list in `lib/config/eligibility.ts`, and eligibility still reads both flags from the context. Whether the cart can carry several groups is part of spike 3.2; if it can, use all.

Self-declaring "employee" is unverified. That is acceptable for this demo storefront, and recorded as a risk so it is removed or verified before any real use.

### D-6: Group and channel prices selected by the engine, cache keyed per buyer

Embedded prices gain `customerGroup` and `channel`. Cart side: the line item sets `distributionChannel` for channel prices and the cart's customer group for group prices; price selection stays with commercetools. Catalog side: reads pass the group and channel to price selection (projection `priceCustomerGroup`, `priceChannel`), and the cache key becomes market + group + channel so one buyer's price is never served to another. A parity test prices every seeded offer for every audience and channel and compares card price with the cart line price. No Direct Discounts and no external prices are used, so discount codes keep working. Alternative: show group prices as a cart discount. Rejected: card and cart would disagree before the add.

### D-7: Channel resolution

Channel is `online` unless the signed-in customer is in a new customer group `call-center`, in which case it is `call-center`. Visitors cannot choose a channel. Alternative: a query parameter or cookie. Rejected: a lower price must not be reachable by anyone who edits a URL.

### D-8: Dependencies, regions and included lines in `lib/offers`

New attributes on `malva-offer`: `requires-offers`, `negates-offers`, `eligible-regions`. `required-addon-kinds` already exists on plans. Rules are pure functions next to `rules.ts`, called by `guardAdd` (add time), `revalidateLines` (every read, blocking only) and the finder. Negated-offer replacement happens in the add request and never on a read, because `revalidate.ts` documents that lines are never dropped on read. Included offers become zero-price child lines in `addOfferLine` and are removed with the parent. Region match compares state and ZIP only.

### D-9: Summary figures in one module

`lib/pricing/summary.ts` defines the rows and figures once and is used by the bundle, checkout, finder strip, order and confirmation mappers: `dueToday = totalPrice (+ tax if not included)`; `thenMonthly` per D-3; rows per `pricing-consistency`; "You save" informational. The "Discounts" row only counts order-level discounts.

### D-10: Discount rank and the retired discounts

Seed ranks descend in intended order, with one table (`scripts/seed/data/cart-discounts/order.ts`) and a test that prices with the fake engine. The four retired families (second-line, bundle, intro prices, tier percentages) leave the seed, `DISCOUNT_AMOUNTS`, label text and prompt pairings, together with `INTRO_DEFS`, `STEP_DEFS`, `price-steps` and `trial-days`. The schedule library keeps reading intro and step periods so old orders display unchanged. The seeder does not necessarily delete discounts that are no longer in the manifest, so cleaning the live test project is a separate, explicit, confirm-flagged script, run only on request.

## Risks / Trade-offs

- [Recurring orders carry a promotion after all] The scope behaves differently from the documentation on some price modes → spike 3.2 before shipping; reconciliation report lists mismatches.
- [A merchandiser adds an `AnyOrder` discount] Displayed "Then monthly" would be wrong → lint warning and a notice on the affected bundle line (`pricing-consistency`).
- [Per-buyer prices cost cache hits] Cache key grows by group and channel → few distinct values (4 groups, 2 channels); measure in the parity test run.
- [Self-declared audience] An anonymous visitor can declare employee → documented risk; only offers and prices for that audience are reachable, nothing else; remove or verify before real use.
- [Cart holds one customer group] Declared small business + existing customer cannot both be a cart group → priority list, spike confirms whether several are possible.
- [Probe cart leaks] A failure between create and delete → `finally` delete, tag, sweep, project cart-deletion setting as backstop.
- [Finder Continue partly fails] Accepted lines are kept and the refused line is named on the bundle.
- [Retired discounts live in the test project] Re-seed does not remove them → explicit cleanup script, user-confirmed.

## Migration Plan

1. Seed changes are additive except the removals (D-10): add group and channel prices, the `call-center` channel and group, dependency and region attributes, the bundle offer; then remove retired discounts from the manifest.
2. Ship the pricing fixes (rows, tax, rank, engine amounts) first; they change displays only.
3. Ship APIs, then the finder page and nav item.
4. Rollback: remove the nav item to hide the finder; the rest changes no stored data. Stored schedules stay v1.

## Open Questions

- Who is in the call-center channel today? Assumed a signed-in customer in a new `call-center` group (D-7).
- Can a cart carry more than one customer group (D-5)? Spike 3.2.
- Should the first-month promotion also appear on the home page promo tiles? Not specified here.
- Should anonymous visitors be allowed to declare "employee" at all (D-5)? Assumed yes for the demo.
