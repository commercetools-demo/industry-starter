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
- [ ] K-02 Write `PriceBlock`, `ProductTile`, `SaveButton` + `hooks/useSaved.ts` stub; tests: tile shape (image, name/price row, brand), out-of-stock tag, discount rendering, heart click does not navigate (spy) and calls `toggle`.
- [ ] K-03 Write `ProductGrid`, `Pagination`, `Breadcrumbs`, `ListingEmpty` + tests (pagination numbers for 1/3/12 pages; current page marked; first page has no Previous link; empty copy and links).
- [ ] K-04 Write `FilterRail` + `AppliedFilters` + `ListingToolbar` + tests: selecting a band calls `router.replace` with `price=…&page` removed; "Clear all" resets to `/shop`; counts displayed; active styles via `aria-pressed/checked`; single result label "1 product".
- [ ] K-05 Write the server page with `Promise.all` and param resolution + tests (mock `getCategoryTree`, `searchProducts`): both calls start before either resolves; unknown category ignored; heading uses category name; page 2 passes `page: 2`.
- [ ] K-06 Tablet filter sheet (`FiltersSheet` client) + tests (button opens dialog containing filters; applying closes).
- [ ] K-07 Add all message keys (both locales); verify the header links `/shop` and `/shop?sort=newest` exist (the active state is H's `PrimaryNav`; add a test here only for the link targets).
- [ ] K-08 Report manual tests M-K-1…M-K-5 and sign-off SO-01 follow-up.

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
- M-K-1 (F done, OA-02): `/en-US/shop` shows 24 tiles, page 2 shows the remaining 12; EUR prices at `/de-DE/shop`.
- M-K-2: Filter by "Bakery": 6 products incl. Sourdough tagged "Out of stock".
- M-K-3: Sort by "Price ↑": first tile is the cheapest.
- M-K-4: Open a product and press Back: same filters/scroll position.
- M-K-5: Compare with the design at 1440 px (spacing, tile layout) and at 1000 px (filters button).

## Definition of done
Every URL parameter works and is shareable; both locales; accessibility roles verified; `verify` passes.
