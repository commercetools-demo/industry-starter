# Workstream H report (data-loading foundation)

Branch `ws/h-data-loading-foundation`. Live checks ran against `spec-test-b2c-telecom` (read-only, storefront client) through the dev window.

## Done
H-01 … H-11, all ticked. `npm run verify` passes (609 tests). Both scenario rows have tests named after the scenario titles (`lib/catalog/listing.test.ts`, `lib/ct/catalog.test.ts`). Fixtures in `lib/mappers/__fixtures__/` are trimmed copies of real live projections and categories (no secrets), so H-10's "replace fixtures" step is already satisfied. Terminal-run live checks (curl-equivalent via node) matched C-H-1..10 apart from the data differences listed under Findings. C-H-11 (production 404) is enforced by `check:dev-routes` inside `npm run verify`.

## Not done / blocked
Nothing. Not run: the browser-based C-H lines (JSON pages, same URLs).

## Questions for the owner
- Two offers outside the plan's examples exist live (`malva-offer-cable-existing-customer`, `malva-offer-phone-online-only`); K must filter them by eligibility. Fine, or should C-H expectations change to include them?

## Missed features and deviations
- **Dev route is `app/api/dev/catalog/route.dev.ts`** (not `route.ts`), following E's `pageExtensions` convention (`check:dev-routes`). The handler still starts with the `NODE_ENV !== 'development'` guard and returns 404 (plain `Response`, not `notFound()`).
- Add-on `tag` attribute is really named `addon-tag` (G). `AddonFacts.tag` stores the enum KEY (`music`, `video`, `extras`), not the label.
- `OfferVariant.attributes` holds enum KEYS as strings (`color: 'black'`, `memory-gb: '128'`).
- **Handsets:** the recurring prices on handset variants are installment/lease plans (several per variant). They are NOT the headline monthly price: `recurringPrice` is unset for `kind: 'device'` and all financed amounts are in new `OfferVariant.financedPrices` (lowest first, `selectRecurringPrices` in `lib/mappers/price.ts`). Q should use this.
- Added `ListingResult.recoveryLinks` (root categories `{key,name,slug}`, present when `empty`) so the "root categories for recovery" scenario is testable. Band counts are over the offers the chip keeps; chip counts are over the whole category.
- `getCategoryBySlug` returns `{ category, matchedLocale } | null`; helper `findCategoryBySlug`, `CategorySlugMatch` exported from `lib/mappers/category.ts`.
- An internet plan without a valid `technology` produces no facts (offer then hidden and logged) rather than a guessed technology.
- `mapOffer(projection, ctx, locale?)` returns `Offer | null` (null = unknown `offer-kind`, logged) with `facts: null`; `mergeFacts` attaches facts. `mapFacts(projection, typeKey, locale)` dispatches by product type key. `getAllOffers` does the hiding.
- `lib/utils.ts` (D) still has its own `Market` type and `marketFor`; `lib/types.ts` `Market` is structurally identical. Not unified.
- `plan/STATUS.md` not synced (orchestrator does it); `verify-plan.mjs` reports OK, 0 uncovered scenarios.

## TODOs for other workstreams
- N: a live category read for `malva-cat-add-ons` returns 13 offers (descendants), chips counts music 2, video 3, extras 3.
- K: filter `malva-offer-cable-existing-customer` and `malva-offer-phone-online-only` by eligibility/channel on top of the cached lists.
- Q: financed handset prices are `variants[].financedPrices` (policies are not identified; the cents are only a sorted list; if Q needs policy ids, extend `RawPrice` mapping to carry `recurrencePolicy.id` / price key).
- P: search facets are `categoryFacet` (category keys) and `bandFacet`; availability is deliberately not filtered.

## Findings
Recorded in `plan/PROJECT-FINDINGS.md` under `## H — catalog and search reads` (Product Search field names verified; `variants.prices.recurrencePolicy` is not searchable; projections carry all markets' prices and `recurrencePrices`; availability only on stocked variants; category order hints; live listing contents; de-DE whole-euro prices).

## Manual tests added
None.

## Junior design choices
None (no UI). Technical: price sort groups monthly offers before one-time-only offers in both directions; unknown chip or band id is ignored (acts as `all`); out-of-range page clamps.

## Chrome checks ready
C-H-1 … C-H-10 (dev server running, `/api/dev/catalog`). Expected values that differ live: C-H-2 cable has 4 offers (extra `malva-offer-cable-existing-customer`, $49.99), chips `all 4, up-to-500 3, 1-gbps 1`; C-H-4 phone plans has 5 offers (extra `malva-offer-phone-online-only` $45), chips `unlimited 3, data-capped 2`; C-H-7 `band=lt-25` gives `empty: "no-match"` as expected; C-H-8 de-DE labels are `40 €`, `50 €`, `60 €`, `80 €`.
