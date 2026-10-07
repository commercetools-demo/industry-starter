# Workstream X report (coordinated offer release)

Branch `ws/x-coordinated-offer-release`. Live work ran against `spec-test-b2c-telecom` only (seed client, through the release scripts; scratch scripts only for reads and for the final cleanup). M (My bundle) is not merged: everything that needs M is listed below.

## Done
X-01 … X-08, all ticked. `npm run verify` passes (173 test files, 1160 tests). Every scenario row of X's table has a test named after the scenario title (`release/apply.test.ts`, `lib/offers/release.test.ts`, `release/preview.test.ts`, `release/validate.test.ts`, `release/history.test.ts`, `release/cancel.test.ts`).

Live (X-08), as one operator named `claude`, all started and ended in the pre-release state (see "Cleanup"):
- C-X-1 validate: broken example exit 3 with `DANGLING_KEY malva-offer-nope`; summer example `OK`.
- C-X-2 preview: 27 offers plus the new one at USD 40.00 / EUR 40.00, `malva-offer-phone-online-only` withdrawn, discount added, checklist printed, zero writes.
- C-X-3 apply (`releaseAt` 21:32:00Z, applied 21:16): new offer published, variants and prices dark, old offer `end-time` = releaseAt, discount `validFrom` = releaseAt, record `scheduled` with `appliedBy claude`.
- C-X-4 (through `GET /api/dev/catalog?view=offers&category=malva-cat-phone-plans`, polled every 5 s, because N's pages do not exist yet): the old offer left the listing at 21:32:01, the new offer ($40) was in it at 21:32:58 (see Findings 1). No console or browser check was possible without N.
- C-X-5 cancel: a second scheduled release cancelled before its time, offer, discount and record state gone.
- C-X-6 rollback with expedite: rollback manifest generated, applied with a 3 minute lead; at 21:39:27 the summer offer left the listing and `online-only` came back (at about 21:40:20).
- C-X-7 history `--at` before the instant lists nothing, between the instants lists the release with author, `appliedBy` and the new price, after the rollback lists only the rollback with the restored price.
- C-X-8 `--fail-after 2`: exit 1, record `rolled-back`, no created offer or discount, old offer unchanged; the example then applied without the flag.
- C-X-9 `npm run seed:verify` with scheduled releases present: the release check passes (`3 record(s), 2 scheduled`).
- Extra: a price patch (`patchOffers`) on `malva-offer-phone-essential` applied and cancelled live: the platform accepts a closed price (`validUntil` = T) and a new price of the same scope (`validFrom` = T) side by side.

## Not done / blocked
- C-X-4 in a real browser (screenshots, 375 px, de-DE copy, console and network): needs N (`/shop/phone-plans`). The read side is proven through the dev catalog view; the page check is still to run once N is merged.
- M must call `assertReleased` (see TODOs); not enforceable from X.

## Questions for the owner
None blocking. Planner defaults I had to extend (overrule any):
1. A release manifest also has `reinstateCartDiscounts` (inverse of `withdrawCartDiscounts`, needed to roll back a withdrawn discount) and `rollbackOf` (set on generated rollbacks). Both are optional.
2. `release:rollback` only reads the project (no `--confirm-project`): it writes `releases/<key>-rollback.release.json` and prints it. `--expedite "<reason>"` on it writes `expedite.reason` into the generated manifest and uses a 3 minute lead (15 minutes otherwise); `--at` sets `releaseAt`. `release:apply` takes expedite from the manifest only.
3. `release:apply|validate|preview` accept `--release-at <ISO>` (overrides the manifest's instant, so the committed example needs no edit) and `--file <path>` (manifest outside `releases/`).
4. The record also stores the applied `manifest` (needed by `release:verify` and `release:rollback` without the file) and `error` / `inconsistentKeys`.
5. `release:cancel` is also allowed for `applying` and `inconsistent` records (the way out of a crashed apply); it needs `--confirm-project`.
6. `seed:verify` revalidates only releases that are scheduled and not yet effective; an effective release is not revalidated (a later rollback would make it fail for the right reason).

## Missed features and deviations
- **No separate `.test.ts` per task commit order**: `lib/offers/release.ts` is committed in X-03 (the preview imports it); its tests, the wiring and the usage/lead tests are in X-07. `history.test.ts` needs the apply engine and is in X-05. `X-08` also carries a code fix (below).
- `RELEASE_MIN_LEAD_MS` is defined in `lib/offers/release.ts` and, as a copy, in `scripts/seed/release/types.ts` (the engine must not depend on a lib file being importable at load); `release-lead-vs-cache.test.ts` asserts both equal 10 minutes and that `CATALOG_TTL` and `CATEGORY_TREE_TTL` (60 s) are at most 5 minutes. `PRODUCT_TYPE_IDS_TTL` is excluded on purpose (it never holds an offer).
- **Reinstating is dark through the price, not the end-time**: `reinstateOffers` clears `end-time` immediately (an attribute cannot start later) and, per scope, closes the newest closed price and adds a copy that opens at `releaseAt` (new key `<key>_<releaseAt stamp>`). Until `releaseAt` the offer has no valid price, so H's mapper hides it and the platform cannot price a line. My first version cleared `validUntil`, which made the offer purchasable at apply time; the live rollback showed it and X-08's commit fixes it (test `rollback.test.ts`, "a reinstated offer stays unpurchasable until the rollback instant").
- `filterReleased` wraps `getAllOffers` (so `getOfferByKey`, `getOffersByKeys`, `getOffersInCategory` are covered) and `searchOffers`, which also lowers `total` by the removed count (K's convention). The cache still holds raw offers, so the filter is evaluated on every read.
- Price keys added by a release are `<existing key without stamp>_<releaseAt as YYYYMMDDTHHMMSSZ>`; the platform accepts them.
- Exit code 7 is `EXIT.INCONSISTENT` appended to F's `config.ts` table (the only edit to F's files besides `checks/index.ts` and the count in `checks/catalog.test.ts`, which now includes the release check).
- Text and attribute patches are applied at apply time (visible early) as planned; the validator warns `EARLY_VISIBLE_PATCH` and the preview lists them.

## TODOs for other workstreams
- **M (`addLineItem`)**: resolve the offer and call `assertReleased(offer)` from `@/lib/offers/release` before adding; map `ReleaseError` (`code 'OFFER_NOT_RELEASED'`) to a 409 `OFFER_NOT_RELEASED` with the usual envelope. A line whose offer was withdrawn after it was added is no longer in `getAllOffers`, so K's `revalidateCart` flags it blocking with `OFFER_NOT_FOUND` (resolution `remove`): M shows it like any other issue.
- **N / P / O**: request the whole offer set (`getVisibleOffers*` already do) and paginate after filtering; never use the search `total` without the corrected value from `searchOffers`.
- **Owner / OA-03**: the seed client scope list needs `manage_key_value_documents` (release records live in Custom Object container `malva-releases`). It is already present (G report): confirm for the production-like client.
- **Orchestrator**: copy Findings into `PROJECT-FINDINGS.md`; `node plan/verify-plan.mjs --sync`. C-X lines in the workstream file still say `release:apply -- <key>` without `--release-at`: use `--release-at <now+15 min>` when running them (or edit the manifest).

## Findings
All observed live on 2026-10-07.
1. **Withdrawal is exact, a new offer lags by up to the catalog TTL.** With `CATALOG_TTL` = 60 s: the old offer left the listing within 1 s of `end-time` (the filter runs on every read); the new offer appeared 57 s later (the cached read built before the instant had no valid price for it and hid it; the next cache refresh includes it). Same for a reinstated offer (about 53 s). So for up to 60 s after the instant neither the old nor the new offer shows. Suggestion for H (not done, outside X): read the offers with a price-selection time of `now + CATALOG_TTL`, or let a future `start-time` bypass the "no price" hiding. The 10 minute lead only covers the time before the instant.
2. Embedded prices with a future `validFrom` are accepted on product create and on `setPrices`, and a closed price (`validUntil` = T) next to a new price of the same scope (`validFrom` = T) is accepted (no `DuplicatePriceScope`). A product with only future-dated prices is published and found by Product Search about one minute after creation (search lag observed: the exact-key search found the new offer at 21:17:43, apply finished 21:16:36).
3. Scoped price projection (`product-projections?priceCurrency=USD&priceCountry=US`) returns no `price` for a recurring-only variant unless `priceRecurrencePolicy` is given, even for the currently valid price; H's mapper reads the raw `prices[]` and is unaffected. Product Search price filters and sorts ignore validity dates (docs: scoped price search does not consider validity): a search sorted or banded by price can use a price that is not yet valid.
4. `setValidFromAndUntil` on cart discounts: sending only `validFrom` clears `validUntil` (used for reinstate). Custom Object upsert (`POST /custom-objects` without `version`) overwrites; `GET /custom-objects?where=container="malva-releases"` lists the container.
5. Clock: apply to the instant was 15 minutes; no skew was observable at one-second polling (platform and BFF agreed to the second).
6. Failure injection works against the real platform: after write 2 (discount created, offer created and published) compensation unpublished and deleted the offer and deleted the discount; the second apply of the same key succeeded.
7. **Not mine, but seen**: `seed:verify` check "catalog counts" fails in the project (cart discounts 9 expected 6, discount codes 2 expected 1): two intro discounts from workstream L and at least one discount and one code created by a parallel agent (not `malva-cd-rel-*`). It also failed before my first apply (8 vs 6).

Cleanup: the summer offer, both example discounts, the scratch offers and every `malva-releases` record were deleted; `malva-offer-phone-online-only` and `malva-offer-phone-essential` have their original two undated prices and no `end-time`; `npm run seed -- --plan` reports `unchanged=121`; the project holds 52 products and 27 offers again. Local `releases/.state/*.before.json` files are gitignored.

## Manual tests added
None.

## Junior design choices
No UI. Technical choices: `ReleaseManifest` extras above, the `testDeps.ts` / `fixture.ts` test support, the CLI flags `--release-at`, `--file`, `--expedite "<reason>"` (rollback), and the validator codes `DUPLICATE_KEY`, `PRICE_OVERLAP` (a patch whose scope already has a price starting at or after `releaseAt`: another release is pending), `EXPEDITE_REASON`, `LEAD_TIME` (refusals of apply).

## Chrome checks ready
C-X-1 … C-X-3, C-X-5 … C-X-9 were run (CLI and commerce reads, results above). C-X-4 (browser) needs N.
