# Workstream P report (search)

Branch `ws/p-search`. Live checks ran against `spec-test-b2c-telecom` (dev server on port 3150, storefront client) through curl; no browser run.

## Done
P-01 … P-11 (all ticked; P-02 and P-03 share one commit). `npm run verify` passes. The four scenario rows (Part number pasted, Query matches nothing, Misspelt query, Unsupported language) have tests named after them (`node plan/verify-plan.mjs`: 0 uncovered; its only complaint is the STATUS count, which the orchestrator syncs). `npm run search:wait` works live (index ready in 1 s, "Cable 500" returns 3 hits).

Live facts verified: `q=cable` 3 plans; `Unlimitd` Unlimited and Unlimited Max; `Unlim` the same two; `Cabel 500` Cable 500 and 100; `MLV-CBL-500-24M` (any case) Cable 500 flagged as part number; one character changed none; `Malva` 6 results (Security & protection 1, Routers & equipment 5); `Spotify` 1; `zzzzqq` none. Pages return 200 with `lang`, `noindex` and `<title>` right in en-US and de-DE; no `/p/` or `/products/` links; dev log clean.

## Not done / blocked
Nothing blocked. Browser C-P-* checks not run by me (mobile 375 px, Lighthouse, keyboard focus ring screenshot, C-P-12 error state live).

## Questions for the owner
- SO sign-off for the header magnifier (design has no search entry). One-line switch: `HEADER_SEARCH_ENABLED` in `lib/config/search.ts`.
- German catalog names are English, so `de-DE/search?q=Tarif` finds nothing (not a bug; the offer names are not localized).

## Missed features and deviations
- Hits are mapped through K's `getVisibleOffers` on `Offer.id` (H has no `getOffersByIds`); eligibility, release windows and `dedupeByAnchors` apply. `runSearch` takes `getLanguages` and `getOffers` functions instead of `languages`/`getOffersByIds`.
- Product Search request additionally filters by the `malva-offer` product type id (anchor products would otherwise eat the 100 hits) and adds a case-insensitive wildcard clause (`*text*`) for half-typed words. Live finding: `fullTextPrefix` on `name` answers 400 "Full text prefix is not supported". Query has at most 4 expressions.
- `matchedSku` is set only for an exact (case-insensitive) variant SKU. The API's `matchingVariants` also lists variants for a plain name query ("cable" reported every cable variant), so it is not used as a part-number signal (it is still returned by `searchOfferHits`).
- Error code `UPSTREAM_ERROR` (502) instead of `SEARCH_UNAVAILABLE` (not in `ApiErrorCode`).
- `SearchSortSelect` (new) instead of reusing N's `SortSelect` (two listing sorts only; search needs "Best match").
- No `loading.tsx` (N's finding: it makes 404/redirect stream as 200).
- New helpers: `lib/search/load.ts`, `tiles.ts`, `components/search/CategoryTiles.tsx`; `SearchResultItem.path` (locale-less link for the locale-aware `Link`) and `category` in the API JSON.
- `lib/ct/search.test.ts` mock of `./client` extended with `get()` for the project languages.
- Header search icon shows from 768 px; below that the drawer's first item is "Search".
- Plan file: C-P-4 uses `MLV-CBL-500-24M`; C-P-8 counts are 6 / 1 / 5. Added an "Implementation notes" section.

## TODOs for other workstreams
- O: home search field (if any) can post to `/{locale}/search` with `name="q"`; use `SearchForm`.
- A catalog rename reaches search only after the index lag (about 2 minutes live).

## Findings
- `fullTextPrefix` is unsupported on `name` (400). Wildcard `*x*` works and is what H's listing search uses.
- `matchingVariants` is noisy for name queries (see above).
- `fuzzy` level 2 on `Unlimitd` and `Cabel 500` works; short or whole-word queries need no special handling.
- Chrome C-P-12 caveat: with `CTP_API_URL` unreachable the category tree (header) may fail too and show the global error page instead of the search error state; unit tests cover the state. Use a request-level failure if the live check is needed.

## Manual tests added
None.

## Junior design choices
Whole page layout (honey title strip with the form, status line with sort, category chips, 1/2/3 column cards on a 12 per page grid, numbered pagination), the result card (honey header with kind label and name, category, highlight, "From price", pink part-number pill, secondary "View in {category}" CTA), no-results/start/unsupported/error panels (subtle brand surface with category tiles), header magnifier (44 px icon button) and the drawer item with icon and label.
