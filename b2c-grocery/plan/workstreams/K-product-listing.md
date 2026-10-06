# K — Product listing page (PLP)

**Specs:** `plp-design` (all requirements, incl. Facets in v1, Weight/unit price hook), `storefront-data-loading` (Server-rendered catalog, Parallel fetches), `storefront-project-structure` (Route organization)
**Depends on:** G, H, J · **Unblocks:** M, N, P, T · **Decisions:** D-021, D-043, SO-01
**Skill refs:** `commercetools-storefront` `b2c/product-listing.md`, `core/search-facets.md`

## Goal
`/[locale]/shop` lists 24 products per page with category, price-band and availability filters, sort and numbered pagination, URL-addressable, in the MALVA look.

## Design

### URL contract (single route)
`/[locale]/shop?category=<slug>&price=<bandId>&stock=in|out&sort=relevance|newest|price-asc|price-desc&page=<n>` — all optional; invalid values are ignored (not errors). Parsing lives in `lib/listing-params.ts`: `parseListingParams(searchParams): ListingParams` and `toQueryString(params): string` (omits defaults; resets `page` to 1 when any filter/sort changes).

### Server page `app/[locale]/shop/page.tsx` (Server Component)
`const sp = await searchParams;` `const { country, currency, locale } = await getMarket();` (E) run in parallel (`Promise.all`): `getCategoryTree(locale)`, `searchProducts({...})`. Resolve `category` slug → id from the tree (unknown slug → ignored). Heading = category name or `plp.everything`. `generateMetadata` for title. Page cache: dynamic (reads cookies).

### Components (`components/product/`)
- `ProductTile` (server): washed `Photo` (330 px), top-right `SaveButton` (client, see below), top-left `Tag` "Out of stock" when the default variant is not in stock, name (card-title) + `PriceBlock` on one baseline row, brand line (`card-meta`), `lift` hover; whole tile is a locale `Link` to `/p/<slug>`.
- `PriceBlock` (server): price formatted with `formatMoney`; discounted price shows original struck-through. (N later adds the unit price line.)
- `ProductGrid` (server): 3-column grid desktop (`desktop:grid-cols-3`), 2 columns tablet, 2 compact on mobile; gap `26.4px 17.6px`.
- `SaveButton` (client): uses `useSaved()` from `hooks/useSaved.ts` — **in K it is a stub** `{ isSaved: () => false, toggle: async () => {} }` with the final interface `useSaved(): { isSaved(productId: string): boolean; toggle(productId: string): Promise<void> }`; T replaces the implementation. Clicking calls `preventDefault/stopPropagation` so the tile does not navigate.
- `FilterRail` (client): category rows (`name` + count; active = accent fill), price-band tags, availability radios (Everything / In stock / Out of stock), "Clear all" ghost; every change `router.replace(`/shop?${toQueryString(...)}`)` with locale-aware router; sticky `top-[110px]` at `desktop`.
- `ListingToolbar`: "N products" (ICU plural: "1 product"), `Segmented` sort (Relevance, Newest, Price ↑, Price ↓).
- `AppliedFilters`: removable chips for active filters (above the grid).
- `Pagination({ basePath, params, page, pageCount })`: `basePath` is e.g. `/shop` or `/search`, `params` the other query parameters to preserve (e.g. `{ q }`); Previous · numbers (ellipsis for long lists) · Next; current page `aria-current="page"`; links are real URLs (`Link`). Reused by P.
- `ListingEmpty`: heading "Nothing under those terms", text, `Clear filters` (secondary) and "Contact us" link.
- `Breadcrumbs`: Home / Shop / <Category>, last item not a link.
- Tablet/mobile (`<desktop`): rail hidden; "Filters" button opens a `Dialog`-based sheet containing `FilterRail` content.
- Scroll restoration on Back: rely on Next.js router scroll restoration; ensure links are real URLs (no JS-only state).

### Price band labels
`getPriceBands(currency)` (G) → label built with `formatMoney` ("Under $5.00", "$5–15", …) using message templates `plp.band.*`.

## Tasks
- [x] K-01 Write `lib/listing-params.ts` + tests (defaults; invalid values ignored; `toQueryString` omits defaults and resets page; round trip).
- [x] K-02 Write `PriceBlock`, `ProductTile`, `SaveButton` + `hooks/useSaved.ts` stub; tests: tile shape (image, name/price row, brand), out-of-stock tag, discount rendering, heart click does not navigate (spy) and calls `toggle`.
- [x] K-03 Write `ProductGrid`, `Pagination`, `Breadcrumbs`, `ListingEmpty` + tests (pagination numbers for 1/3/12 pages; current page marked; first page has no Previous link; empty copy and links).
- [x] K-04 Write `FilterRail` + `AppliedFilters` + `ListingToolbar` + tests: selecting a band calls `router.replace` with `price=…&page` removed; "Clear all" resets to `/shop`; counts displayed; active styles via `aria-pressed/checked`; single result label "1 product".
- [x] K-05 Write the server page with `Promise.all` and param resolution + tests (mock `getCategoryTree`, `searchProducts`): both calls start before either resolves; unknown category ignored; heading uses category name; page 2 passes `page: 2`.
- [x] K-06 Tablet filter sheet (`FiltersSheet` client) + tests (button opens dialog containing filters; applying closes).
- [x] K-07 Add all message keys (both locales); verify the header links `/shop` and `/shop?sort=newest` exist (the active state is H's `PrimaryNav`; add a test here only for the link targets).
- [x] K-08 Report manual tests M-K-1…M-K-5 and sign-off SO-01 follow-up.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Default listing | K-05 |
| Apply a filter / Clear all | K-04 |
| Sort by price | K-01 + G-05 builder |
| Save from the grid | K-02 |
| No results | K-03 |
| Back from product | URL-driven (K-01) + M-K-4 |
| German price bands | K-04 with `EUR` |
| Weighed product tile (unit price) | N |
| Tablet filters | K-06 |

## Manual tests to report
- M-K-1 (F done, OA-02): 1. `npm run dev`, open `http://localhost:3000/en-US/shop` at 1440 px. 2. Count tiles: 24, toolbar says "36 products", heading "Everything", pagination shows 1 2 Next (no Previous). 3. Click page 2: URL `?page=2`, 12 tiles, Previous shown, "2" highlighted. 4. Open `/de-DE/shop`: prices in euro (e.g. `Erdbeeren 2,96 €`), German labels, bands "Unter 5,00 €". 5. Open `/en-US/shop?page=99` redirects to `?page=2`; `?sort=bogus&stock=x` shows the default listing.
- M-K-2: 1. On `/en-US/shop` click "Bakery" in the left rail: URL `?category=bakery`, heading "Bakery", breadcrumb Home / Shop / Bakery, toolbar "6 products", a chip "Bakery" above the grid, no page reload. 2. Sourdough loaf shows an "Out of stock" tag top-left. 3. Select "In stock": 5 products, chip added; counts on the other rows/bands change with the filters. 4. "Clear all" returns to `/en-US/shop`. 5. Pick a combination with no match (e.g. Bakery + "Over $30.00"): empty state "Nothing under those terms"; "Clear filters" restores the list; "Contact us" links `/contact`.
- M-K-3: 1. On `/en-US/shop` choose "Price ↑" in the toolbar: URL `?sort=price-asc`, first tile is the cheapest and prices ascend across tile rows; page 2 continues the order. 2. Choose "Price ↓": most expensive first. 3. Choose "Newest" and header "New in" link (`/shop?sort=newest`) show the same order. 4. At 390 px the sort is a select with the same four options.
- M-K-4 (needs L for the PDP): 1. Open `/en-US/shop?category=bakery&sort=price-desc`, scroll down a little, click a tile (PDP `/p/<slug>`; it 404s until workstream L lands, then use browser Back). 2. Press Back: same URL, same filters and sort, scroll position restored. 3. Click the heart on a tile: nothing navigates, heart does nothing yet (saved lists come in T).
- M-K-5: 1. Compare `/en-US/shop` with the design (`design/specs/plp.md`, prototype `browse`) at 1440 px: 230 px sticky rail (stays visible while scrolling, top 110 px), 3 columns, 330 px washed images, name and price on one row, brand line, spacing, kicker "The shop" and 56 px heading. 2. At 1000 px: rail is gone, a "Filters" button appears above the toolbar; it opens a right-hand drawer with the filters, Esc closes, choosing a filter applies it and closes the drawer; grid has 2 columns. 3. At 390 px: 2 compact columns, sort is a select, no horizontal scroll. 4. Tab through filters and tiles: visible focus ring. Review SO-01 breakpoints.

## Definition of done
Every URL parameter works and is shareable; both locales; accessibility roles verified; `verify` passes.

## Implementation notes (deviations, recorded by the developer)
- Added `lib/listing-params.ts` helpers `withListingChange(current, patch)` (resets `page` unless the patch sets it) and `listingHref(params, basePath = '/shop')`; `price` is only syntax-checked in `parseListingParams` (unknown band ids are ignored by `buildSearchRequest`), `category` is a slug resolved by the page.
- **Market follows the URL locale.** The page uses `COUNTRY_CONFIG[locale]` for currency/country (D-012) and only falls back to `getMarket()` for an unknown locale. Reason: `getMarket()` reads the session/cookie, so a fresh visit to `/de-DE/shop` would show USD (the proxy does not set the cookie). See Q-K-1 (the same gap affects the cart layout).
- **Parallel fetches:** the category tree and the search start together; only when a `category` slug is present the search waits for the (cached) tree, because it needs the category id. The test asserts both calls start before either resolves for the default listing.
- **Disjunctive facet counts (acceptance 2 "counts reflect the other filters"):** `lib/ct/listing.ts` `loadListing` runs the main search plus one lean search (`pageSize: 1`) per active filter group without that group's filter, so category/price/availability counts show what each choice would give. The default listing makes a single search. Category counts roll subcategories up (`lib/listing-view.ts`); an "Everything" row sits first in the rail.
- `ListingFilterData` (serializable) is built on the server and passed to the client `FilterRail`, `AppliedFilters`, `FiltersSheet`; price band labels are built client-side from `plp.band.*` + `formatMoney` ("Under $5.00", "$5.00-$15.00"). Shared hook `useListingNavigation` in `components/product/filter-data.ts`.
- The heart is a sibling of the tile `Link` (a button inside an anchor is invalid HTML); the wrapper still calls `preventDefault/stopPropagation`.
- `Pagination` renders nothing for one page, omits Previous on page 1 / Next on the last page; `page > pageCount` redirects to the last page (locale-aware `redirect`).
- Sort is a segmented control from `tablet`, a `Select` below (design: mobile select). Filters sheet is a right-hand `Dialog` drawer; `FilterRail` takes `onChange` so the sheet closes after applying.
- Not built (not in the task list): loading skeleton (`loading.tsx`), inline retry card (the `error.tsx` boundary from I handles failures), category description under the heading. See IDEAS.
- Test helper `test/product.ts` (`makeProduct`, `makeVariant`). Live check with `npm run dev` against the seeded project: `/en-US/shop` 36 products, Bakery 6 incl. Sourdough "Out of stock", `?page=9` redirects to `?page=2`.
