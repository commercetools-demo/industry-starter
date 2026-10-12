# Gap analysis: old DTV demo vs the Malva telecom storefront

Inputs: `dtv-demo-features.md` (React app and catalogue data), `dtv-microservices-features.md` (offer and pricing services, read from the deployed images' source), and a code audit of `b2c-telecom/site` and `openspec/specs` on `main`. Everything about Malva was read from code and specs, not run. The old services' rules were read, not executed.

**Decisions taken after the first draft (2026-10-12)**
1. The old flow becomes a real page, the plan finder, linked from the header navigation. No demo flag.
2. No promotion has a duration: no "N days free", no trial days, no time windows, no prepayment, no timeline. The only promotion is the first-month promotion, a Cart Discount that applies to the first order. Recurring orders are charged the standing price.
3. Recurring-affecting discounts are removed (second-line $10, bundle $5, intro prices, year tiers). First-order codes stay.
4. Channel-scoped prices and customer-group prices are in scope. DMA as an eligibility input is not.
5. No breaking change.

## 1. Short answers

| Question | Answer |
|---|---|
| Missing in the frontend? | The single-screen flow (plan, three sections of extras, one-button continue), visitor controls for customer type, existing customer and ZIP, a promotions list in the cart, and a live price strip. 10 gaps, section 2. |
| Missing in the APIs? | A filtered offer list, an offer detail with resolved relations, a pricing preview, state and ZIP limits on offers, required-offer and required-add-on-kind rules, removal of negated offers, customer-group and channel price selection. 8 gaps, section 3. |
| Calculating anything wrong? | The totals are the engine's, so no. What was wrong is derived figures and display: the stored schedule and everything built from it used list prices, the summary rows did not foot, the discount rank is probably inverted, and tax sat outside "Due today". Decision 2 and 3 remove the cause of the schedule problem; the rest are fixes. Section 4. |
| Same experience on top of ours? | Yes, as a normal page using Malva's own rule engine, with three new endpoints. Nothing from the old services is ported. Section 5. |

## 2. Frontend gaps

| # | Old DTV feature | Malva today | Resolution | Spec |
|---|---|---|---|---|
| FE-1 | One page lists base packages, first one pre-selected | Category listing, nothing selected, cart empty until "Choose plan" | Finder page, first plan selected | `plan-finder-page` |
| FE-2 | Included / Compatible add-ons / Compatible equipment as three sections with empty states | One card with Add-ons and Equipment fieldsets inside "Customize"; included items are checked, disabled rows | Three-section detail | `plan-finder-page` |
| FE-3 | "Add to plan" per item, item turns into "INCLUDED!" | Checkbox/radio only after "Choose plan" | Draft add and remove, applied on Continue | `plan-finder-page` |
| FE-4 | (Old demo had no remove) | Remove exists | Finder offers remove | `plan-finder-page` |
| FE-5 | "Continue with <package>" creates a priced cart and opens it | Selecting a plan writes to the cart at once | One-button continue to `/bundle` | `plan-finder-page` |
| FE-6 | Customer-type dropdown | Derived from signed-in groups; anonymous = consumer; only the login sample dropdown switches | Declared context for anonymous visitors, account governs signed-in | `buyer-context-controls` |
| FE-7 | Existing-customer dropdown | Derived from group or held services | Same | `buyer-context-controls` |
| FE-8 | Service address sent with the cart | `/api/serviceability` and `/api/cart/address` exist; no component calls them, so browse is never location-gated | ZIP form wired in | `buyer-context-controls` |
| FE-9 | Applied-promotions table | One "Discounts" total; `appliedDiscountKeys` never rendered | Promotions list (name, lines, amount) | `first-order-promotions`, `cart-page` |
| FE-10 | "Due now" | "Due today" | Keep; add "Then monthly" line and footing rows | `pricing-consistency`, `cart-page` |

Dropped by decision: "7 DAYS FREE then $X/mo", the time-based rates table, "days until valid / expired" columns, STARZNOW banner, sign-in, chat and device links, hard-coded address.

Already ahead of the old demo: blocking warnings for conflicts, equipment and eligibility, and remove on card and cart.

## 3. API gaps

| # | Old service behaviour | Malva today | Resolution | Spec |
|---|---|---|---|---|
| API-1 | `GET offers?type=&custType=&existingCust=&eligibility=` | Eligibility is server-internal; dev-only `/api/dev/catalog` | `GET /api/offers` | `offer-catalog-api` |
| API-2 | `GET offers/{id}` with expanded included, add-ons, equipment | Rules computed per candidate; `POST /api/offers/compatibility` answers one candidate | `GET /api/offers/[key]` | `offer-catalog-api` |
| API-3 | `POST pricing` returns dueNow and promotions | Probe cart exists for prompts; cart routes return engine totals only | `POST /api/pricing/preview` returning `dueToday`, `thenMonthly`, `lines`, `promotions`, `issues` | `offer-catalog-api` |
| API-4 | Eligibility by state or ZIP on an offer | Gates on audience, existing customer, channel, window, per-ZIP serviceability by technology | `eligible-regions` | `eligibility-gated-offer` |
| API-5 | `dependentOffers`, `requiredProducts` | None. `required-addon-kinds` only linted; seed never writes it; spec says it blocks checkout | Required offers and required kinds enforced | `offer-dependencies` |
| API-6 | `negatedProducts` | None | Replace on add | `offer-dependencies` |
| API-7 | Included offers as zero-price child lines | Plan bullets only | Visible included lines (no placeholder prices) | `offer-dependencies` |
| API-8 | Customer-group price on a bundle; channel price on a phone | Prices selected by country and recurrence policy only | Group and channel price selection, cache key includes both | `audience-and-channel-pricing` |

Dropped by decision: discount custom fields for timing (`daysUntilValid`, `daysUntilExpired`, `isFutureFree`, prepayment).

A price carrying a one-time and a recurring part: Malva uses two prices and an activation-fee custom line item. No change.

Already covered in Malva: required equipment, symmetric exclusive offers with replace choice, channel and release-window eligibility, audience gating, server re-check of every add, re-validation before checkout.

## 4. Calculation review

### 4.1 What is right
Due today, Monthly and One-time are the engine's numbers read back. No second discount engine runs in the storefront. The prompt asks the engine on a probe cart.

### 4.2 Findings and how this change resolves them

| # | Finding (evidence in `site/`) | Resolution |
|---|---|---|
| C-1 | Schedule and everything derived (`standing` = `unitListPrice` at `lib/mappers/cart.ts:220`; "Monthly after today" at `lib/checkout/review.ts:14-20`; order monthly at `lib/mappers/order.ts:177-182`) used list prices, and second-line $10, bundle $5, code, and tier discounts were not in them | Removed by decision 3: with first-order-only promotions, standing price is the right recurring amount. `pricing-consistency` makes that explicit and keeps group and channel selection in it |
| C-2 | Free first month and intro price both matched on Cable 100 and Air 5G; schedule only knew the intro | Intro prices removed; schedule shows the first month as period 1 (`introductory-period-price`) |
| C-3 | Intro discount was `AnyOrder`; platform cannot end it after N periods; nothing reconciled generated orders | Every remaining discount is `NonRecurringOrdersOnly`, enforced by a seed test and a lint (`first-order-promotions`); spike confirms recurring orders |
| C-4 | Summary rows do not foot: Plans/Add-ons/Devices already net, then a "Discounts" row of `-discountTotal` (`OrderSummary.tsx:42-52`) | Footing rows, "Then monthly" and "You save" separated (`pricing-consistency`) |
| C-5 | Discount rank probably inverted: platform applies the higher rank first (confirmed in the discount documentation); seed ranks ascend with intended order | Re-rank, one order table, engine-order test (`pricing-consistency`). With four discounts removed the live impact is small, but the table and test stop it returning |
| C-6 | "Due today" excludes tax when the rate is not included (`lib/mappers/cart.ts:262`) | Include tax (`pricing-consistency`) |
| C-7 | `discountTotal` = `max(0, list×qty − total)`; custom and financed lines differ (`lib/mappers/cart.ts:249-253`) | Engine's discounted amounts (`pricing-consistency`) |
| C-8 | Per-unit price averaged (`lib/mappers/cart.ts:139`) | Disappears with the second-line discount; no requirement needed |
| C-9 | Free shipping re-implemented with a hard-coded currency (`lib/ct/checkout.ts:144-152`) | Engine-evaluated (`pricing-consistency`) |
| C-10 | Dead data: `trial-days`, `price-steps`, `intro-free-months` as a duration, `charge-type`, `required-addon-kinds`, unused flag `ONE_TIME_AS_CUSTOM_LINE_ITEM` | `trial-days` and `price-steps` removed from model and seed; `intro-free-months` kept as a flag; `required-addon-kinds` enforced; `charge-type` and the unused flag deleted or documented (tasks 1.3, 2.7) |

Display only: cards show "$55", carts "$55.00", and cards did not show the free month or activation fee. Resolved in `pricing-consistency`.

### 4.3 Old-service rules not carried over
- Its own discount arithmetic (`applyPromotion`, `determineRateOverTime`) and time windows. Not needed under decision 2.
- A placeholder price of 100000 cents for priceless offers with included items.
- Silent drop of a repeated included product.
- A uniqueness check that never ran and warnings that never blocked.
- `promotionalOffers` accepted and ignored.
- Quantity fixed at 1; no cart update path.
- A response returned before its background write finished.
- "Existing customer" check that flags any offer without `existingCust = true` for existing customers, including included items.
- Prepayment amount multiplied by 100 regardless of currency.

## 5. How the old experience fits on ours

The old flow needs three things Malva does not have as endpoints, and nothing else: an offer list filtered by buyer context, an offer detail with its three groups, and a priced answer for a plan plus extras. Malva already has the rules behind each (`getVisibleOffers`, `buildCandidateList`, the probe cart). With promotions limited to the first order the priced answer is two numbers, because the engine's price for the order placed now is "Due today" and the engine-selected recurring prices are "Then monthly". No service-day field, no timeline, no discount arithmetic.

The finder holds the draft in the browser and applies it to the real cart on Continue, then opens `/bundle`, which becomes the priced summary: rows that foot, the promotions list, "Then monthly".

Risks (design): customer-group and channel prices make the catalog read per-buyer (cache key must include them); a declared audience for anonymous visitors is self-declared, which is acceptable for this storefront but not verified; recurring-order prices need one spike.

## 6. Traceability

| Old feature | Landing |
|---|---|
| Package list, filters, auto-select | FE-1, FE-6, FE-7 → `plan-finder-page`, `buyer-context-controls` |
| Package detail (three sections) | FE-2 → `plan-finder-page` |
| Add to plan, included badge | FE-3 → `plan-finder-page` |
| Continue creates priced cart | FE-5, API-3 → `plan-finder-page`, `offer-catalog-api` |
| Service address | FE-8 → `buyer-context-controls` |
| Due now | FE-10 → `pricing-consistency`, `cart-page` |
| Applied promotions table (name, lines, amount) | FE-9 → `first-order-promotions`, `cart-page` |
| Offer types incl. bundle | `offer-dependencies` |
| Conflicts, dependencies, negation, eligibility | API-5, API-6 → `offer-dependencies`; conflicts already built |
| Geo-restricted add-ons | API-4 → `eligibility-gated-offer` |
| Channel price, customer-group price on a bundle | API-8 → `audience-and-channel-pricing` |
| Header navigation link | → `storefront-shell` |
| 7 days free, time-based rates, validity columns, prepayment, gift | Dropped by decision 2 |
| Marketing banner, chat, sign-in, device links | Not carried over |
