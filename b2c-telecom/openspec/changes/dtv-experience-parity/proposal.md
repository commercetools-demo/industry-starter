## Why

The old AT&T "DIRECTV NOW" demo (a React app on an offer service and a pricing service, project `att-poc-61`) has a sales flow the Malva storefront lacks: pick a plan, see what is included and what can be added, press one button, read a priced summary. We want that flow as a real page in the Malva storefront, built on Malva's catalog and engine. The comparison also showed that our money display disagrees with itself in a few places, and that making every promotion apply to the first order only removes most of the cause. Details and evidence: [gap-analysis.md](./gap-analysis.md).

## What Changes

- Add a **plan finder page** (`/<locale>/plan-finder`), linked from the header navigation, mobile drawer and footer: choose a plan, see Included / Compatible add-ons / Compatible equipment, add and remove extras in a draft, see live "Due today" and "Then monthly", and continue to the bundle with one button. The existing listing, configurator and cart stay.
- Add the **APIs the flow needs**: `GET /api/offers`, `GET /api/offers/[key]`, `POST /api/pricing/preview`.
- Add **buyer context controls** (customer type, existing customer, ZIP): declared by anonymous visitors and applied consistently to eligibility, prices and the cart; account groups govern for signed-in customers.
- **Promotions apply to the first order only.** The only promotion is the first-month promotion (a Cart Discount, `NonRecurringOrdersOnly`), plus the existing codes. No "N days free", no trial days, no durations, no prepayment, no timeline. Recurring orders are charged the standing price. **Remove** the second-line $10, bundle $5, intro-price (3 and 6 months) and year-tier discounts from the seed, the label text and the prompt pairings.
- Add **customer-group prices** (bundle offer) and **channel-scoped prices** (a call-center phone price), selected by the engine and identical on cards, finder, cart and order.
- Add **offer dependencies**: required offers, required add-on kinds that block checkout, offers a chosen add-on removes, included offers as visible zero-price child lines, a seeded bundle offer, and state or ZIP limits on offers (a premium add-on sold in some states only).
- Fix **pricing display**: summary rows that foot to "Due today", "Then monthly" as a separate line, tax in "Due today", discount amounts from the engine, discount rank direction, free shipping evaluated by the platform.

No breaking change: schedule format v1 stays, orders already placed display their stored schedule, and no existing endpoint changes shape.

Out of scope: copying the old services or their defects (gap analysis 4.3), a real serviceability provider, billing integration, B2B, DMA as an eligibility input, prepayment and free gifts, any discount with a duration.

Commercetools survey: Product Search and projections for the catalog, Cart and Order with `recurrenceInfo` for monthly lines, Cart Discounts and Discount Codes (9 discounts, 2 codes), custom line items for the activation fee, a throwaway probe cart for the discount prompts (`lib/ct/prompts.ts`), custom fields on Order for the stored schedule, Customer Groups for audience. Embedded prices carry only country and recurrence policy today, with no customer-group or channel price in the seed or in the catalog read. Skills consulted: `commercetools-commerce-patterns` (discount rank direction, `recurringOrderScope`, customer-group pricing, recurring orders), `commercetools-storefront`.

## Capabilities

### New Capabilities
- `plan-finder-page`: the single-screen finder, three-section detail, draft add and remove, live price strip, one-button continue.
- `buyer-context-controls`: customer type, existing customer and ZIP controls, declared context for anonymous visitors, location entry.
- `first-order-promotions`: first-order-only promotions, the first-month promotion, promotions list in the bundle, retirement of the recurring discounts.
- `audience-and-channel-pricing`: customer-group and channel-scoped prices.
- `offer-dependencies`: required offers, required add-on kinds, negated offers, included lines, bundle offers.
- `offer-catalog-api`: offer list, offer detail with resolved relations, pricing preview.
- `pricing-consistency`: standing-price recurring amounts, footing summary rows, tax, engine discount amounts, rank direction, shipping, formatting.

### Modified Capabilities
- `storefront-shell`: a "Plan finder" item in the header, drawer and footer (ADDED requirement).
- `eligibility-gated-offer`: state and ZIP limits on offers (ADDED requirement).
- `introductory-period-price`: the first month is the only opening period; schedule shows it as period 1 (ADDED requirements).
- `cart-page`: promotions list, then-monthly line, back to the finder (ADDED requirements).

## Impact

- Frontend: new route `app/[locale]/plan-finder/`, context bar, finder components, header, drawer and footer items, changes to `components/bundle/OrderSummary.tsx`, `PlanCard.tsx`, `components/checkout/CheckoutSummary.tsx` and `ReviewStep.tsx`, listing cards (promotion message).
- API: new `GET /api/offers`, `GET /api/offers/[key]`, `POST /api/pricing/preview`; `/api/serviceability` and `/api/cart/address` gain a UI caller; the cart add path gains dependency handling.
- Libraries: `lib/ct/buyer-context.ts` (declared context, group, channel), `lib/ct/catalog.ts` (price selection by group and channel, cache key), `lib/offers/` (dependency and region rules), `lib/pricing/summary.ts` (new), `lib/ct/prompts.ts` (probe cart reused), `lib/mappers/cart.ts` and `lib/mappers/order.ts`.
- Catalog and seed: remove four discount families and their config (`INTRO_DEFS`, `STEP_DEFS`, `DISCOUNT_AMOUNTS` entries, `price-steps`, `trial-days`), re-rank discounts, add group and channel prices, a call-center channel and customer group, a bundle offer, dependency and region attributes, new seed data and tests.
- Specs and docs: `seed-catalog-data` and `telecom-catalog-model` plan notes, `design/` label text, `discount-activating-offer-prompt` pairings (no requirement change).
- Env: none.
