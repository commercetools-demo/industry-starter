<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream G: Browse (Product Search, facets, listing, search results, product card)

## 1. Header

| Field | Value |
| --- | --- |
| ID | G |
| Name | Browse: Product Search, faceted listing, search results, product card, quick add and the cart core it needs |
| Depends on | C (seeded products, prices, inventory, reviews), D (client, session, mappers, errors), E (tokens, atoms, icons, catalogues), F (store context, availability, shell, toast) |
| Wave | 4 (alone) |
| Specs implemented (primary first) | `design-product-listing-page` (primary), `design-product-card` (primary), `product-listing-page` (generated template, applies), `search-results-page` (generated template, applies), `discovery-and-browse` (generated template, applies), `reviews-and-ratings` (extended: requirement "Ratings come from product statistics" and "Listing by rating" only) |
| Generated templates that apply | `product-listing-page`, `search-results-page`, `discovery-and-browse` |
| Owner prerequisites | OA-x1 (live API client, same as OA-01), OA-x2 (images endpoint, OA-03: without it cards show the labelled placeholder), SO-x1 (empty-state and no-results fallback copy, "Featured" meaning). No blocker: all code builds against fixtures and the fake |
| Skills to load first | `commercetools-storefront` (`b2c/product-listing.md`, `core/search-facets.md`, `core/cart.md`, `core/data-loading.md`, `core/performance.md`), `commercetools-platform` (`references/product-search.md`), `commercetools-commerce-patterns` (price selection) |
| App and paths | everything lives in `storefront/` |

## 2. Goal and scope

**Goal.** One server-rendered listing serves a category, "All products" and search results. State (filters, sort, page, query, store toggle) is in the URL, so reload, share and back all reproduce the page. Cards show catalogue data (cacheable), the shopper's price and the availability at the chosen store (per request). Quick add works from a card; the cart core (`lib/ct/cart.ts`, `POST /api/cart/lines`, `useAddToCart`) is created here for the ship case so the page is usable; H adds collect and subscribe, I completes the cart.

**In scope**
- Routes `/[locale]/category/[slug]`, `/[locale]/shop` ("All products"), `/[locale]/search`.
- Product Search request builder with facets and postFilter, the id-first read pattern (search returns ids, then product projections with price selection), rating filter and sort, exact SKU first, typo tolerance, language check.
- Facet sidebar (checkbox, radio, colour dots, button grid, "Show all n"), mobile filter sheet, toolbar (Filters button, "Available at {store}" chip, sort), active-filter chips, grid, empty and no-results states, pagination.
- `ProductCard` (anatomy, badge, price, unit price, swatches, availability line, quick add, save heart), `ProductGrid`.
- `mapProductSummary`, `lib/ct/products.ts`, `lib/ct/search.ts`, `lib/ct/categories.ts` (tree, breadcrumbs).
- `GET /api/search` (client re-fetch for the sheet count, see 3.8) and the cart-core subset: `POST /api/cart/lines` (ship), `GET /api/cart`, `useAddToCart`.

**Explicitly out of scope**
- Collect and subscribe add-to-cart branches and the PDP (H). Cart drawer, cart page, line switching, discounts (I). Saved-items server storage (L; G uses a session-only store, see 3.9). Home page grids (O reuses `ProductCard`). Reviews list and write form (M). Search suggestions and a real "did you mean" (needs an external engine; stated in the page). B2B variant table, pack-size selector and trade flag (spec "Dropped from VELA").

## 3. Design

### 3.1 Files

| Path | Kind | Purpose |
| --- | --- | --- |
| `app/[locale]/category/[slug]/page.tsx`, `app/[locale]/shop/page.tsx`, `app/[locale]/search/page.tsx` | server | Thin pages that call `loadListing()` and render `ListingPage` |
| `app/[locale]/(listing)/loading.tsx`, `error.tsx` | server/client | Skeleton grid and retry state (or per-route if the group does not fit; keep route paths as above) |
| `lib/search/params.ts` | pure | URL parse and serialize |
| `lib/search/facet-config.ts` | pure | Facet definitions |
| `lib/search/price-bands.ts` | pure | Price bands per currency |
| `lib/search/build.ts` | pure | `buildSearchRequest` |
| `lib/search/facets.ts` | pure | Response to view model (`FacetGroup[]`), disabled and counts |
| `lib/ct/search.ts` | server-only | `searchProducts`, language check |
| `lib/ct/products.ts` | server-only | `getListingProjections(ids, ctx)` |
| `lib/ct/categories.ts` | server-only | `getCategoryTree`, `getCategoryBySlug`, `getCategoryByKey`, breadcrumbs (extends D if present) |
| `lib/ct/attribute-labels.ts` | server-only | `getAttributeLabels(locale)`: enum labels per attribute (`unstable_cache`, 3600 s) |
| `lib/ct/cart.ts` | server-only | Cart core (see 3.9): `getCartForSession`, `createCart`, `addLine` (ship only here) |
| `lib/mappers/product-summary.ts` | pure | `mapProductSummary` |
| `lib/product/choice-config.ts`, `lib/product/badge.ts`, `lib/product/unit-price.ts`, `lib/product/swatches.ts` | pure | Required choice, badge precedence, per-unit price, swatch colours |
| `lib/listing/load.ts` | server-only | Page assembly (parallel reads) |
| `components/listing/ListingPage.tsx` | server | Render only |
| `components/listing/ResultHeader.tsx`, `Breadcrumbs.tsx`, `SearchInput.tsx`, `Toolbar.tsx`, `SortSelect.tsx`, `AvailabilityChip.tsx`, `ActiveFilters.tsx`, `FilterSidebar.tsx`, `FacetGroup.tsx`, `FilterSheet.tsx`, `ProductGrid.tsx`, `EmptyState.tsx`, `NoResults.tsx`, `Pagination.tsx` | mix | See 3.5 to 3.8 |
| `components/product/ProductCard.tsx`, `CardImage.tsx`, `PriceLine.tsx`, `AvailabilityLine.tsx`, `SaveButton.tsx`, `QuickAdd.tsx`, `Swatches.tsx` | mix | Card parts (shared with H, O, L) |
| `hooks/useAddToCart.ts`, `hooks/useCart.ts` (minimal, I extends), `hooks/useSavedItems.ts` | client | |
| `app/api/search/route.ts` | handler | GET |
| `app/api/cart/route.ts` (GET), `app/api/cart/lines/route.ts` (POST) | handler | Cart core subset |

### 3.2 URL contract (shared with F's menu, H's breadcrumb links and O)

Path chooses scope: `/category/<slug>` (category subtree), `/shop` (everything), `/search?q=` (text). Query parameters (all optional, unknown ones ignored, serialized in a stable alphabetical order, defaults omitted):

| Param | Meaning | Values |
| --- | --- | --- |
| `q` | search text | trimmed, cut at 100 chars; empty on `/search` shows the prompt state |
| `sort` | order | `featured` (default on category and shop), `price-asc`, `price-desc`, `rating`; on `/search` the default is relevance and the select offers "Best match" first |
| `page` | page number | integer 1..400, default 1 (above the last page the last page is returned, scenario "Page past the last result") |
| `avail` | "Available at {store}" | `1` only |
| `f_<facet>` | facet selection | comma separated keys, e.g. `f_roast=dark,medium`; radio facets hold one value |

Facet names (`<facet>`): `category`, `system`, `intensity`, `roast`, `brew`, `origin`, `decaf`, `organic`, `fairtrade`, `colour`, `price`, `rating`, `collection`. Values: enum keys from the seed (`dark`, `espresso`, `french-press`), booleans `true`, intensity `1`..`13`, `category` the category **key** (`mcf-cat-pods-original`), `price` a band id (`p0`..`p4`, see 3.3), `rating` `4.5` or `4.0`, `collection` one of `bestseller,new,limited-edition,subscribable`. F's `buildListingHref` writes exactly this.

```ts
export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'relevance';
export interface ListingParams { q?: string; sort: SortKey; sortGiven: boolean; page: number; avail: boolean; facets: Record<string, string[]> }
export function parseListingParams(sp: Record<string, string | string[] | undefined>, scope: 'category'|'shop'|'search'): ListingParams;
export function serializeListingParams(p: ListingParams, scope): URLSearchParams;      // omits defaults, sorted keys
export function removeFilter(p: ListingParams, facet: string, value?: string): ListingParams; // resets page to 1
export function toggleFacetValue(p: ListingParams, facet: string, value: string, mode: 'multi'|'single'): ListingParams;
```

Unknown `sort` falls back to the default; `page` below 1 or non-numeric becomes 1; facet values not in the config are dropped (never sent to commercetools); `f_*` for a facet not defined is ignored.

### 3.3 Facet configuration (`lib/search/facet-config.ts`)

Application configuration, not CMS. One entry per facet:

```ts
export interface FacetDef {
  name: string;                 // URL name and response facet name
  labelKey: string;             // i18n key plp.facet.<name>
  control: 'checkbox'|'radio'|'colour'|'grid';
  kind: 'distinct'|'ranges';
  field: string;                // search field path
  fieldType?: 'enum'|'text'|'boolean'|'number';
  appliesTo: CategoryRoot[] | 'all';   // category roots (pods, coffee, machines, accessories, gifts); on /shop and /search a facet shows when it has buckets
  limit?: number;
}
```

| Facet | Control | Field and type | Applies to |
| --- | --- | --- | --- |
| `category` | checkbox | `categories` (ids), kind distinct; mapped to keys with the tree | all |
| `system` | checkbox | `variants.attributes.system.key`, `enum` | pods, machines |
| `intensity` | grid | `variants.attributes.intensity`, ranges `{key:'1', from:1, to:2}` ... `{key:'13', from:13, to:14}` | pods, coffee |
| `roast` | checkbox | `variants.attributes.roast.key`, `enum` | coffee |
| `brew` | checkbox | `variants.attributes.brewMethods.key`, `set_enum` | coffee, machines, accessories (seed has it on coffee only, see Q-G-06) |
| `origin` | checkbox | `variants.attributes.origin`, `text` | coffee |
| `decaf`, `organic`, `fairtrade` | checkbox | `variants.attributes.<name>`, `boolean` (value `true`) | pods, coffee |
| `colour` | colour | `variants.attributes.colour.key`, `enum` | machines, accessories |
| `price` | radio | `variants.prices.centAmount`, ranges from `price-bands.ts` scoped by currency and country | all |
| `rating` | radio | `reviewRatingStatistics.averageRating`, ranges `{key:'4.5', from:4.5}`, `{key:'4.0', from:4.0}` | all |
| `collection` | checkbox | virtual: `bestseller`, `new`, `limited-edition` map to `variants.attributes.badge.key` (`enum`), `subscribable` maps to `variants.attributes.subscribable` boolean true | all |

Enum rule (skill `core/search-facets.md`): enum and lenum attributes use the `.key` sub-path and `fieldType: 'enum'` (never `lenum`); `set_*` types keep their `set_` prefix; every distinct facet and every `exact` in a filter also carries `language: locale` (harmless where unused). Labels for enum keys come from `getAttributeLabels(locale)`; keys are the URL values.

`price-bands.ts`: bands in minor units per currency, same shape for USD and CAD: `p0` under 10.00, `p1` 10.00 to 24.99, `p2` 25.00 to 99.99, `p3` 100.00 to 249.99, `p4` 250.00 and up (`from` inclusive, `to` exclusive). Labels are formatted with `formatMoney` ("Under $10.00", "$10.00 to $24.99", "$250.00 and up"). Q-G-05.

**Verification gates before relying on these (task G-00)**: (a) product-level attributes `badge` and `subscribable` are searchable at `variants.attributes.*` (docs list product-level attributes as supported in Product Search; if not, file a seed request to make them variant-level `SameForAll`); (b) a facet `filter` field is accepted on `distinct` and `ranges` facets; (c) price-level expressions combined in one `and` (currency, country, centAmount) match the same price object; (d) `boost` on `exact`; (e) `set_enum` facet on `brewMethods`. Record each in `plans/evidence/G/mcp-checks.md`; any failure is written to `plans/PROJECT-FINDINGS.md` and the stated fallback is used.

### 3.4 Search request (exact shape; `lib/search/build.ts`, pure)

Docs: [Product Search](https://docs.commercetools.com/api/projects/product-search), [search query language](https://docs.commercetools.com/api/search-query-language), [use postFilter](https://docs.commercetools.com/learning-implement-product-discovery-and-presentation/build-product-listing-pages/use-postfilter), [control facet calculations](https://docs.commercetools.com/learning-implement-product-discovery-and-presentation/build-product-listing-pages/control-facet-calculations). Always `apiRoot.products().search().post({ body })`; never `productProjections().search()` (D-023).

```ts
export interface SearchContext { locale: string; currency: string; country: string; storeChannelId?: string }
export function buildSearchRequest(ctx: SearchContext, scope: { categoryId?: string }, p: ListingParams, opts: { limit: number; offset: number; withFacets: boolean }): ProductSearchRequest;
```

- **query** (`and`, non-scoring parts inside `filter`): `{ filter: [ { exact: { field: 'categoriesSubTree', value: categoryId } } ] }` when a category scope exists; `{ filter: [ exact variants.prices.currencyCode = currency ] }` and `exact variants.prices.country = country` combined so only products sellable in this market match (a product without a price for this currency and country is excluded from listings, which is the "not sellable here" rule; **but** the card scenario "No price for this buyer" still needs a card: it can occur when the price exists for the market but the variant displayed has none, or when a price is removed between search and projection; handled in 3.6); when `avail` is on and a store is chosen: `{ filter: [ { exact: { field: 'variants.availability.isOnStockForChannel', value: storeChannelId } } ] }` (in the query, not postFilter, so counts follow it, scenario "Collect filter"); the text clause when `q` is set:
  ```json
  { "or": [
    { "exact": { "field": "variants.sku", "value": "<q>", "caseInsensitive": true, "boost": 10 } },
    { "fullText": { "field": "name", "language": "<locale>", "value": "<q>", "boost": 3 } },
    { "fuzzy": { "field": "name", "language": "<locale>", "value": "<q>", "level": 2, "mustMatch": "all" } }
  ] }
  ```
  The `fuzzy` branch is added only when `q.length > 5` (spec: "more than five characters"; the API lowers the level by term length itself). Sort by `score desc` then `id asc` when relevance. `markMatchingVariants: true` so the card can name the variant that matched a SKU query (scenario "Part number pasted").
- **postFilter** (`and` of one clause per selected group): distinct groups `exact` with `value` (one) or `or` of `exact` (several), `fieldType` and `language`; `category` uses `exact categoriesSubTree` on the category ids; boolean groups `value: true`; `intensity` `or` of `range { field, gte: n, lt: n+1 }`; `price` `and: [ range centAmount gte/lt, exact currencyCode, exact country ]`; `rating` `range { field: 'reviewRatingStatistics.averageRating', gte }`; `collection` mapped as above (several values are OR).
- **facets**: one per `FacetDef` that applies. **Faceted-count rule** (scenario "Faceted counts"): each facet carries `filter` = `and` of the postFilter clauses of **every other group** and none of its own, so counts compare options within a group. The facets are computed on `query`, never on `postFilter` (docs: facets are computed before postFilter). Price facet `filter` also contains currency and country. If G-00(b) fails, the fallback is one `limit: 0` request per group with that group's own clause removed from the postFilter, run with `Promise.all` (at most 12 requests, only on first render and when the selection changes; not on `page`/`sort` change). Distinct facets: `{ distinct: { name, field, fieldType, language, limit: 50, level: 'products', filter } }`; ranges facets: `{ ranges: { name, field, ranges, filter } }`. Counts are product counts (`level: 'products'`).
- **sort**: `featured` is `createdAt desc` then `name asc` (Q-G-04 pending the owner); `price-asc`: `{ field: 'variants.prices.centAmount', mode: 'min', order: 'asc', filter: { and: [ exact currencyCode, exact country ] } }` then `name asc`; `price-desc` the same with `mode: 'max', order: 'desc'`; `rating`: `{ field: 'reviewRatingStatistics.averageRating', order: 'desc' }` then `{ field: 'reviewRatingStatistics.count', order: 'desc' }` then `name asc`. A price sort `filter` may reference only price-level fields (docs "Sort filters"): do not add attribute clauses to it. Note (docs): sorting ignores the query, so a filtered price sort can rank by a price of a non-matching variant; accepted, recorded in 3.11.
- `limit: 24`, `offset: (page - 1) * 24`; to return the last page when the page is too large: run with the requested offset; if `results` is empty and `total > 0`, rerun once with `offset = floor((total - 1) / 24) * 24` and return `redirectToPage` so the page redirects (scenario "Page past the last result").
- Language check (scenario "Unsupported language"): `getProjectLanguages()` (cached 300 s, shared with F's `getValidCountryConfig`) before searching; a locale not in the project's languages returns `{ status: 'unsupported_language' }` and the page shows `plp.unsupportedLanguage` instead of an empty result.

### 3.5 Reading the products (id-first, `lib/ct/products.ts`)

Search returns ids only, so cards are built with one more call, then reordered to the search order (the API does not guarantee order, per the migration guide):

```ts
apiRoot.productProjections().get({ queryArgs: {
  where: `id in (${ids.map((i) => `"${i}"`).join(',')})`,
  staged: false, limit: ids.length,
  priceCurrency: ctx.currency, priceCountry: ctx.country,   // embedded prices, D-017
  localeProjection: [ctx.locale],
  expand: ['masterVariant.price.discounted.discount', 'variants[*].price.discounted.discount'], // for the discount name
} }).execute();
```

Docs: [query product projections](https://docs.commercetools.com/api/projects/productProjections) and the [Product Search migration guide](https://docs.commercetools.com/guides/migration-guides/product-search-migration-guide) ("Retrieve full Product data"). No `storeProjection` (no Stores or Product Selections are used; the online catalogue is one assortment). Do not use search's `productProjectionParameters` (deprecated December 2025). Ids are validated as UUIDs before they enter the predicate. A projection missing for an id (race with unpublish) is skipped. Price is `variant.price` (selected embedded price); `variant.availability.channels[storeChannelId]` gives the card's availability (display only; docs: eventually consistent, so the PDP and the cart use the inventory read, H and I).

Per request, these run in parallel with `Promise.all`: `getCategoryBySlug` (if any), `getCategoryTree`, `getAttributeLabels`, project languages, then search, then projections (dependent), then map. Server caching (`unstable_cache`, public data only): category tree 60 s, attribute labels 3600 s, project languages 300 s. **No** server cache for projections that include prices or availability (per-market and per-session). The catalogue half of a card could be cached by `[locale, ids]` key later; not now (Q-G-10).

### 3.6 `ProductSummary` and the card

```ts
export interface ProductSummary {
  id: string; slug: string; sku: string;           // sku of the default variant (cheapest in-market variant, tie: master)
  name: string; categoryName: string;
  imageUrl?: string; imageAlt: string;
  badge: 'bestseller'|'limited-edition'|'new'|'subscribe'|null;
  price: { from: Money; fromIsRange: boolean; old?: Money; discountName?: string } | null;   // null: no price in this market
  unit?: { money: Money; perKey: 'capsule' | '100g' };
  label?: { kind: 'intensity'|'roast'; value: string };      // pods: intensity; coffee: roast
  swatches?: { key: string; name: string }[];                // only for colour-differing variants
  requiredChoice: 'grind'|'colour'|null;
  rating: { average: number; count: number } | null;         // average rounded to 1 decimal for display only
  availability: { state: AvailabilityState } | null;         // null when no store chosen
  matchedSku?: string;
}
```

Mapper rules (`mapProductSummary`, pure, tested): price is the lowest selected `value.centAmount` over variants that have a selected price; `fromIsRange` true when the highest differs; discounted: the cheapest variant's `discounted.value` is current and `value` the old; `price: null` when no variant has a price or the amount is 0 (never show zero). Badge precedence is fixed in `lib/product/badge.ts`: `bestseller` > `limited-edition` > `new` > `subscribe` (subscribable) (scenario "Multiple qualifying flags"; Q-G-03). Unit price (`unit-price.ts`): pods `price / capsulesPerPack` of the default variant, perKey `capsule`, shown to 2 decimals ("0.49 per capsule"); coffee `price / sizeGrams * 100`, perKey `100g`; others none. Swatches only when the distinct `colour` count over variants is greater than 1 (machines, cups) (max 4 shown, "+n"); label for pods is the intensity `Intensity {n}`, for coffee the roast label. `requiredChoice` from `choice-config.ts`: `{ 'mcf-coffee': 'grind', 'mcf-machine': 'colour', 'mcf-accessory': 'colour' }` and set only when more than one distinct value exists across variants. Rating from `reviewRatingStatistics` (`averageRating`, `count`) on the product (present on projections), null when `count === 0` (scenarios "Card rating", "No reviews"). Image: first image of the default variant (clean URL) through the listing transform of `lib/ct/image-config.ts`; alt is the image label or the product name; when no image, a `canvas-2` block with the 5:6 ratio and `plp.noPhoto` text (OA-x2).

**Card anatomy** (`ProductCard`, spec "Card anatomy"): the card root is **one link** (`Link` to `/p/<slug>/<sku>`, wrapping image and text); the heart and Quick add are separate buttons positioned over the image and are not nested inside the link (use a positioned wrapper `div` with the link as a sibling stretched with `::after`, so there are no interactive elements inside an anchor). Order: image area `aspect-ratio: 5/6`, radius 16px (`--radius-lg` token), `canvas-2` background, hover shadow `0 18px 40px` ink at 10% in 320ms; badge top-left pill (10px uppercase, ink for bestseller, accent for new, others per tokens; at most one); heart top-right 34px circle; Quick add slides up from the image bottom (`translateY(100%)` to 0) on hover and on keyboard focus within the card, and is always visible on touch (`@media (hover: none)`), as is the heart. Body: category (11px uppercase 0.08em `--ink-3`), name (Archivo 600 15.5px, two-line clamp), a meta row with price (600 15px; "From {price}" when `fromIsRange`; old price struck through with discount colour; unit price line `plp.card.perCapsule`) and swatches or label, then `AvailabilityLine`.

**AvailabilityLine**: dot (7px, teal, amber, stone) plus text `card.availability.in|low|out` with `{store}` ("In stock at {store}", "Low stock at {store}", "Not available at {store}"); with no store chosen a button-like link "Choose a store" that calls `useCollectionStore().open()`. The card stays openable and shippable when the store is out (scenario "Out at the store"). Availability comes from `variant.availability.channels[channelId]` of the default variant mapped with F's `availabilityState`.

**No price** (template scenario "No price for this buyer"): the price slot reads `card.noPrice` ("No price available") and Quick add is disabled; the card is still a link.

**Quick add** (`QuickAdd`): enabled when `requiredChoice === null` and `price !== null`; click calls `useAddToCart().add({ sku, quantity: 1, fulfilment: 'delivery' })` (default fulfilment is delivery; Q-G-02) then `toast.show(t('shell.toast.added'))` and the header badge updates through `mutate(KEY_CART_COUNT)`; with a required choice it navigates to `/p/<slug>/<sku>?choose=grind` (H highlights the missing selector; nothing is added; scenario "Required choice"). Disabled while pending; error shows a toast `card.addError`.

**Save heart**: `SaveButton` with `aria-label` "Save" (`aria-pressed` when saved), filled accent when saved. `useSavedItems()` keeps product ids in `sessionStorage` (`mcf-saved`) for everyone; L swaps the implementation for server shopping lists and merges the session ids on sign-in (scenario "Guest": kept for the session and offered on sign-in, the offer is L's). The click stops propagation (no navigation).

### 3.7 Listing page, header, sidebar, toolbar, grid

**Assembly** (`lib/listing/load.ts` then `ListingPage`, a server component): parse params, session market, store (from session `collectionStoreKey`, mapped to a channel id with F's cached channel list), then reads per 3.5, then view models. Routes: category page returns `notFound()` when the slug does not resolve or when its subtree has no products and no filter is active; `/shop` is "All products"; `/search` with empty `q` shows the prompt and makes **no** search call.

**Header** (`ResultHeader`): breadcrumbs `Home › {category path}` (ancestors from the tree walk, current item `aria-current="page"`, locale `Link`s) or `Home › Search` or `Home › All products`; H1 (Archivo 800, 34 to 40px, -0.025em): category name, `Results for "{query}"` (query as text), or "All products"; count line `{n, plural, one {# product} other {# products}}` from `total`. On `/search` a pill search input (`SearchInput`, client) sits above the header, autofocused on first load of an empty query only, with a clear button (`aria-label` "Clear search"); submit navigates with `router.replace` keeping other params except `page`.

**Sidebar** (`FilterSidebar`, server renders groups from the view model, client island for toggles): `position: sticky; top: 88px`, width 244px (grid `244px minmax(0, 1fr)`, 40px gap). Each group is a `FacetGroup` collapsible `button` (`aria-expanded`, plus/minus icon) open by default, title (Archivo 600 14.5px) and a mono badge with the count of selected options (accent). Controls: checkbox rows (box 16px, check icon when on), radio rows (re-click clears, handled by `toggleFacetValue(..., 'single')` which clears when the value is already selected), colour rows (dot 12px from `swatches.ts`), button grid (4 columns, 40px height; intensity). Each row shows its count (mono, `--ink-3`); **a row whose count is 0 and that is not selected is `disabled`** (scenario "Dead end avoided", struck/dimmed per atoms). Groups with more than 6 options show "Show all {n}" / "Show less" (local state; options beyond 6 are `hidden` not removed so counts stay available). Facet groups with no non-zero bucket and no selection are not rendered. Selection links: every option is an `a` (`Link` with the new URL from `serializeListingParams`, `scroll={false}`) so the page works without JavaScript and the back button restores state; the client island only adds optimistic pending style. The URL change triggers a server render (the RSC refetch), no client search call.

**Toolbar** (`Toolbar`): left, Filters button (visible under 900px, badge with active count); right, `AvailabilityChip` (chip, store icon, `Available at {store}`; active = ink fill; with no store chosen a click opens the store picker instead of toggling, and after a store is chosen it sets `avail=1`) and `SortSelect` (native `select` with the four options `Featured`, `Price: low to high`, `Price: high to low`, `Top rated`; writes `sort` and drops `page`).

**Active filters** (`ActiveFilters`): one removable chip per selected value and for `avail` (ink pill, label, x icon, `aria-label` "Remove filter {label}") plus "Clear all"; removing a chip is a `Link` (no scroll to top, scenario "Remove a chip"); "Clear all" keeps `q` and path but drops facets, `avail`, `sort` and `page`. Hidden when nothing is active.

**Grid**: `ProductGrid` is `grid-template-columns: repeat(3, 1fr)`, gap `28px 24px` beside the sidebar; at 1080px and below 2 columns (the prototype CSS, since the sidebar leaves 3 too narrow; the spec says 3 beside the sidebar and 2 on mobile, see Q-G-09) and below 560px gap `18px 14px`. Image `sizes` attribute `(min-width: 1081px) 28vw, (min-width: 560px) 44vw, 46vw`.

**Empty states.** Filters produce no match (scenario "Facet combination with no matches"): centred search icon, `plp.empty.title` "No products match these filters.", the active chips still visible and individually removable above the message, and a ghost "Clear all filters" button. Search with no match (scenario "Query matches nothing"): `plp.noResults.title` "We couldn't find anything for "{query}"", the search input stays editable and focused, a note that typo-tolerant matching was already applied (no "did you mean" is claimed; Q-G-08), and **fallback content**: a "Browse by category" row of links to the five root categories plus the first four bestsellers (a normal listing request: `f_collection=bestseller`, limit 4) hidden if that returns none. `discovery-and-browse` scenario "Nothing matches" is the same component.

**Pagination** (`Pagination`): server rendered links "Previous", numbers (current, two each side, first and last with ellipsis), "Next", `nav` with `aria-label` "Pagination", `aria-current="page"`; `rel="prev"` and `rel="next"` through `generateMetadata` `alternates`. Search and filtered URLs get `robots: { index: false }`.

**Mobile sheet** (`FilterSheet`, client): under 900px the sidebar becomes a fixed full-height left sheet (`min(360px, 90vw)`, scrim 42%, close button, `role="dialog"` `aria-modal`, focus trap) holding the same groups; selections inside the sheet are **local draft state** (so the grid does not reload on each tap) and update a live count: the sheet calls `GET /api/search?...&countOnly=1` (debounced 250ms, returns `{ total }` using `limit: 0`) and the sticky bottom button reads `Show {n} results`; pressing it navigates once with the final URL and closes the sheet (scenario "Apply"); the close button discards the draft. The count call is the only client search call.

**Back button** (scenario "Back button"): Next.js preserves scroll on history navigation; filters are `Link`s so history entries exist; do not use `router.replace` for facet toggles (sort and chip removal also create entries). Verify scroll restoration in the browser recipe.

**Sticky offsets**: header is 72px, sidebar offset 88px.

### 3.8 `GET /api/search`

`GET /api/search?q=&sort=&page=&avail=&f_roast=dark&scope=<categoryKey|shop>&countOnly=1`. Validates with the same `parseListingParams` and a zod schema (`scope` matches `^(shop|mcf-cat-[a-z0-9-]{1,64})$`). Response `200 { total: number }` when `countOnly=1`, else `200 { total, items: ProductSummary[], facets: FacetGroup[], page, pageCount }`. Errors: `400 invalid_params`, `422 unsupported_language`, `502 upstream_unavailable`. Session supplies market and store; `Cache-Control: no-store`. The listing pages call `lib/listing/load.ts` directly (BFF rule: Server Components may call `lib/ct`); the handler exists for the sheet count and for O/L widgets.

### 3.9 Cart core created here (`lib/ct/cart.ts`, `POST /api/cart/lines`, `GET /api/cart`)

Docs: [carts](https://docs.commercetools.com/api/projects/carts), [cart preparation](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/cart-preparation-and-review). [SKILL: commercetools-storefront] `core/cart.md`.

- `getCartForSession(session)`: no `cartId` returns `null`; `apiRoot.carts().withId({ ID }).get()`; a non-`Active` cart or a thrown 404 clears `cartId` and returns `null`.
- `createCart(session)`: `apiRoot.carts().post({ body: { currency, country, locale, shippingMode: CART_SHIPPING_MODE, ...(customerId ? { customerId } : { anonymousId }), deleteDaysAfterLastModification: 30, shippingAddress: { country }, taxMode: 'Platform' } })`. `anonymousId` is minted with `crypto.randomUUID()` on the first cart and stored in the session. `CART_SHIPPING_MODE` is a constant in `lib/shop-config.ts`, default `'Single'` (skill checklist); **the mode is only settable on a new cart** (docs: `shippingMode` on `CartDraft`), so workstream K's mixed-bag spike may flip it to `'Multiple'`, and I-12 provides `rebuildCart` to migrate existing carts (see I). Cart currency is fixed at creation; the cart is created from the session market, never from client input.
- `addLine(session, { sku, quantity, fulfilment: 'delivery' })`: get or create, then `addLineItem` `{ sku, quantity, custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'delivery' } } }` (the custom type is seeded by B; the field is always written so the UI reads one value); on `409` re-read the cart and retry once (spec "Cart concurrency"); a second conflict returns `409 conflict`. Returns the mapped cart summary. H adds `collect` (`supplyChannel`) and `subscribe` (`recurrenceInfo`); the input type already has the union so H only adds branches.
- Handler `POST /api/cart/lines` body `{ sku: string, quantity: number, fulfilment: 'delivery'|'collect'|'subscribe', storeKey?: string, recurrencePolicyKey?: string }` (zod: sku `^[A-Za-z0-9._-]{1,64}$`, quantity integer 1..99, `collect` requires `storeKey`, `subscribe` requires `recurrencePolicyKey`); in G only `delivery` is accepted, others return `501 not_implemented` until H. Response `200 { cart: CartSummary }` with `CartSummary { id, version, count, lines: { id, sku, quantity }[] }` (I replaces it with the full `Cart` type but keeps these fields). Errors: `404 unknown_sku`, `422 price_unavailable` (commercetools `MissingPriceForProduct`/no price in currency), `409 conflict`, `400 invalid_request`. The session cookie gets `cartId` and `anonymousId`.
- `GET /api/cart` returns `{ cart: CartSummary | null }` and implements the stale-cart clearing above. `hooks/useCart.ts` is `useSWR(KEY_CART)` (revalidate on focus), `hooks/useAddToCart.ts` returns `{ add, isAdding, error }` and updates `KEY_CART` from the response body (no refetch) and `KEY_CART_COUNT`.

### 3.10 i18n keys (identical in `en-US.json` and `en-CA.json`)

`plp.title.all`, `plp.title.search` ("Results for \"{query}\""), `plp.count`, `plp.breadcrumb.home|search|all`, `plp.search.label|placeholder|clear|prompt` ("Enter a coffee, a machine or a product code"), `plp.sort.label|featured|bestMatch|priceAsc|priceDesc|rating`, `plp.filters.title|open|close|clearAll|showAll|showLess|apply` ("Show {n, plural, one {# result} other {# results}}"), `plp.chip.remove`, `plp.facet.<name>` (13 labels), `plp.facet.collection.bestseller|new|limitedEdition|subscribable`, `plp.facet.rating.4_5|4_0` ("4.5 and up", "4.0 and up"), `plp.facet.price.p0..p4` (use the formatter, keys carry only the wording "Under {max}", "{min} to {max}", "{min} and up"), `plp.availableAt` ("Available at {store}"), `plp.empty.title|clear`, `plp.noResults.title|hint|browse|bestsellers`, `plp.unsupportedLanguage`, `plp.error.title|retry`, `plp.noPhoto`, `plp.pagination.aria|previous|next|page`, `card.badge.bestseller|new|limitedEdition|subscribe`, `card.from`, `card.noPrice`, `card.perCapsule`, `card.per100g`, `card.intensity`, `card.rating` ("{avg} out of 5, {count, plural, one {# review} other {# reviews}}"), `card.availability.in|low|out|choose`, `card.quickAdd`, `card.addError`, `card.save|saved`, `card.matchedVariant` ("Matched SKU {sku}"), `shell.toast.added` ("Added to bag", also used by H and I). Quantities such as capsule counts use ICU plural.

### 3.11 Loading, empty, error, responsive, accessibility

- **Loading**: `loading.tsx` renders the same sidebar column (skeleton rows) and a grid of skeleton cards with identical geometry (no layout jump). Filter link clicks show the pending state through `useLinkStatus` (opacity on the grid).
- **Error**: search or projection failure renders `error.tsx` with `plp.error.title` and a Retry that calls `reset()`; a facet-only failure still renders the grid with an unobtrusive "Filters unavailable" line.
- **Eventual consistency (template open question)**: the "Available at {store}" toggle is the only availability filter (no availability facet in the sidebar); the card line and the toggle read indexed availability which lags inventory, so the PDP re-reads the inventory (H) and the cart never trusts the card.
- **Price sort scope (docs)**: sorting ignores the query and filters, so with an attribute filter the rank can use a non-matching variant's price; accepted and recorded in `plans/evidence/G/mcp-checks.md` with one example if observed.
- **Breakpoints**: 1080px grid to 2 columns, 900px sidebar to sheet and Filters button visible, 820px 20px padding, 560px smaller gap. At 375px: 2 columns, cards at least 150px wide, no horizontal scroll.
- **Accessibility**: facet controls are real checkboxes/radios or links with `aria-pressed`/`aria-checked`; groups are `fieldset` with `legend` (visually the title); live region announces `{n} products` after navigation; heart and Quick add have labels; focus ring on every control; hover-only controls are also revealed on `:focus-within`; ratings are text (`card.rating`) with decorative stars `aria-hidden`; sheets and the picker trap focus; reduced motion disables the slide and shadow transitions.

## 4. Tasks

Common rules: `lib/ct/*` starts with `import 'server-only'`; components never import `lib/ct`; locale links from `@/i18n/routing`; tokens only; no `any`; all strings in two catalogues; `npm run check` after each task; one commit per task `ws-g: G-0x ...`.

- [ ] **G-00 Preconditions and platform checks.** Run the gates of 3.3 with the commercetools MCP (or `seed` read-only script) and the docs; save `plans/evidence/G/mcp-checks.md` (request, response excerpt ids only, verdict). Confirm Product Search indexing is `Activated` and the seeded counts (products about 40). Record findings in `plans/PROJECT-FINDINGS.md`. [SKILL: commercetools-platform] [SKILL: commercetools-storefront]
- [x] **G-01 URL parameters.** `lib/search/params.ts` as 3.2. Tests `params.test.ts`: `defaults per scope`, `round trip keeps facets and sort`, `unknown sort falls back`, `page clamps to 1 and 400`, `unknown facet and value dropped`, `removeFilter resets page`, `single facet re-click clears`, `serialization is stable and omits defaults`, `q is trimmed and cut at 100`. [SPEC: product-listing-page "Filters survive a reload"]
- [x] **G-02 Facet and price-band config, attribute labels.** `lib/search/facet-config.ts`, `price-bands.ts`, `lib/ct/attribute-labels.ts`. [SKILL: commercetools-platform] Tests: `enum fields point at .key and use enum`, `set enum keeps set_ prefix`, `every facet has a param name and label key`, `price bands are contiguous and per currency`, `labels map enum keys per locale`, `labels cached for an hour`.
- [x] **G-03 Search request builder (pure).** `lib/search/build.ts` per 3.4. Tests `build.test.ts` (assert structure, no snapshots): `category scope uses categoriesSubTree`, `market filter is currency and country`, `avail goes to the query not postFilter`, `text clause has exact sku boost fullText and fuzzy only above five characters`, `facets carry the other groups' filters and not their own` (scenario "Faceted counts"), `selected groups go to postFilter`, `price sort filters currency and country only`, `rating sort uses review statistics`, `rating facet and filter use averageRating ranges`, `intensity maps to ranges`, `no productProjectionParameters key anywhere`, `language on distinct facets and exact filters`. [SKILL: commercetools-platform] [SPEC: product-listing-page, search-results-page]
- [ ] **G-04 Search and projections.** `lib/ct/search.ts` (`searchProducts` with last-page rerun, project-language check, `markMatchingVariants`), `lib/ct/products.ts` (`getListingProjections`). [SKILL: commercetools-platform] [SKILL: commercetools-commerce-patterns] Tests with a mocked `apiRoot`: `keeps search order`, `skips a missing projection`, `no ids skips the projection call`, `ids validated before the predicate`, `Page past the last result returns the last page`, `Unsupported language reports unsupported not empty`, `part number first and its variant is marked` (scenario "Part number pasted"), `projection call carries price currency, country and locale projection`, `uses products().search and never productProjections().search`.
- [ ] **G-05 Categories.** `lib/ct/categories.ts`: `getCategoryTree(locale)` (`apiRoot.categories().get({ queryArgs: { limit: 500, sort: ['orderHint asc'], expand: ['ancestors[*]'] } })`, nested tree in memory, `unstable_cache` 60 s tag `categories`), `getCategoryBySlug` (`where: slug(<locale>="<slug>")`), `getCategoryByKey`, `breadcrumbOf(tree, id)` (walk in memory, no extra calls). Skip if D already provides the tree; extend, do not duplicate. [SKILL: commercetools-storefront] Tests: `tree sorted by order hint`, `breadcrumb walks ancestors`, `slug lookup uses the locale`, `unknown slug returns null`.
- [ ] **G-06 Product summary mapper and helpers.** `lib/mappers/product-summary.ts`, `lib/product/*`. Tests `product-summary.test.ts`: `Card rating shows 4.6 and 12 reviews` (4.58333, count 12), `No reviews hides the rating`, `From price when variants differ`, `Pods unit price 0.49 per capsule` (4.90 for 10), `coffee unit price per 100 g`, `swatches only for colour variants`, `pods show an intensity label`, `Multiple qualifying flags shows one badge by fixed precedence`, `discounted price carries old price and name`, `no price maps to null and zero maps to null`, `requiredChoice for coffee grind and machine colour`, `localized name and category`, `matchedSku set from matching variants`.
- [ ] **G-07 Cart core.** `lib/ct/cart.ts`, `app/api/cart/route.ts` (GET), `app/api/cart/lines/route.ts` (POST ship), `hooks/useCart.ts`, `hooks/useAddToCart.ts`, `CART_SHIPPING_MODE` in `lib/shop-config.ts`, `CartSummary` type. [SKILL: commercetools-storefront] Tests: `creates a cart for the session market when none exists`, `uses anonymousId for a guest and customerId when signed in`, `adds quantity 3 as one line with the fulfilment field`, `retries once on 409 then reports conflict` (spec "Double click"), `non-active cart clears cartId and returns null`, `maps no-price error to 422`, `rejects quantity 0 and 100 and bad sku`, `collect and subscribe return 501 until H`, `session cookie gets cartId`, `two shoppers get only their own cart` (spec "Two shoppers").
- [ ] **G-08 Card parts.** `ProductCard`, `CardImage`, `PriceLine`, `AvailabilityLine`, `SaveButton`, `QuickAdd`, `Swatches`, `hooks/useSavedItems.ts`. Tests `ProductCard.test.tsx`: `Hover reveals heart and quick add within 200ms` (class/state, not timing; plus focus-within), `Touch shows heart and quick add always`, `Card is a single click target for the detail page`, `Pods show sleeve price per capsule and intensity label`, `Out at the store reads Not available and stays openable`, `No store shows Choose a store link`, `No price shows no price and disables quick add`, `Required choice opens the detail page and adds nothing` (spec "Required choice"), `Quick add adds the default variant as ship and toasts`, `Guest save kept for the session`, `heart does not navigate`, `no axe violations`.
- [ ] **G-09 Header, toolbar, chips, sort, search input** (the store availability chip, store toggle and `AvailabilityLine` render nothing in the Canada market, which has no stores; test `Canada listing has no availability controls`). `ResultHeader`, `Breadcrumbs`, `SearchInput`, `Toolbar`, `SortSelect`, `AvailabilityChip`, `ActiveFilters`. Tests: `breadcrumb current page`, `title for search`, `count line plural`, `sort options and URL`, `Collect filter chip toggles avail and opens picker without a store`, `Remove a chip clears one filter and keeps the rest and does not scroll`, `Clear all keeps q and path`, `search pill focused with clear button`.
- [ ] **G-10 Filter sidebar and groups.** `FilterSidebar`, `FacetGroup`, controls, `lib/search/facets.ts`. Tests: `Faceted counts`, `Dead end avoided disables a zero count option`, `radio re-click clears`, `colour dots and button grid render`, `Show all n above six options`, `selected count badge`, `group hidden when no buckets`, `option links carry the new URL`, `no axe violations`.
- [ ] **G-11 Mobile sheet and `GET /api/search`.** `FilterSheet`, `app/api/search/route.ts`. [SKILL: commercetools-platform] Tests: `Apply closes the sheet and navigates once`, `draft selections do not navigate`, `Show n results updates from the count call`, `countOnly uses limit 0`, `invalid params 400`, `unsupported language 422`, `close discards the draft`.
- [ ] **G-12 Listing assembly, states, pagination, routes.** `lib/listing/load.ts`, `ListingPage`, `ProductGrid`, `EmptyState`, `NoResults`, `Pagination`, three route files, `loading.tsx`, `error.tsx`, metadata (`robots: noindex` when `q` or a filter is active, `rel prev/next`). [SKILL: commercetools-storefront] Tests `ListingPage.test.tsx` (mocked ct layer): `Filters survive a reload` (same URL gives same state and count), `Facet combination with no matches keeps removable chips`, `No price for this buyer card states it`, `Page past the last result redirects to the last page`, `Browse a category shows a paginated filterable list`, `Nothing matches offers a way back with fallback content`, `Query matches nothing keeps the query editable`, `Misspelt query sends a fuzzy clause and claims no correction`, `Unsupported language reports it`, `Part number pasted puts that product first and names the matched sku`, `Category change resets filters`, `unknown category 404`, `empty q shows the prompt and no search call`, `B2C only: no variant table or pack selector`.
- [ ] **G-13 Messages and gates.** Fill the two catalogues for 3.10, run the parity test, `npm run check`, `npm run build` (the three routes are dynamic because they read the session).

## 5. Scenarios checklist

`design-product-listing-page`:
- [ ] Search (pill search input focused with clear button; H1 names the query): `G-09` `search pill focused...`, `title for search`
- [ ] Faceted counts: `build.test.ts`, `FacetGroup` test `Faceted counts`
- [ ] Dead end avoided: `Dead end avoided disables a zero count option`
- [ ] Collect filter: `build.test.ts` `avail goes to the query`, `Collect filter chip...`
- [ ] Remove a chip: `Remove a chip clears one filter...`
- [ ] Category change: `ListingPage.test.tsx` `Category change resets filters`
- [ ] Apply: `FilterSheet` `Apply closes the sheet and navigates once`
- [ ] Back button: browser recipe step 9 (history and scroll) plus `option links carry the new URL`
- [ ] B2C only: `ListingPage.test.tsx` `B2C only...`

`design-product-card`:
- [ ] Hover, Touch: `ProductCard.test.tsx`
- [ ] Multiple qualifying flags: `product-summary.test.ts`
- [ ] Pods: `Pods unit price 0.49 per capsule`, `ProductCard` pods test
- [ ] Out at the store: `ProductCard.test.tsx`
- [ ] Required choice: `ProductCard.test.tsx`
- [ ] Guest (save): `Guest save kept for the session`

`product-listing-page` (template): Filters survive a reload, Facet combination with no matches, No price for this buyer, Page past the last result: `ListingPage.test.tsx` / `G-04` tests named identically.

`search-results-page` (template): Part number pasted, Query matches nothing, Misspelt query, Unsupported language: `G-04` and `ListingPage.test.tsx`.

`discovery-and-browse` (template): Browse a category, Nothing matches: `ListingPage.test.tsx`.

`reviews-and-ratings` (extended): Card rating, No reviews: `product-summary.test.ts`; Filter (4.5 and up): `build.test.ts` `rating facet and filter...` and browser recipe step 6.

## 6. Browser recipe (Chrome DevTools MCP; base `http://localhost:3000`; evidence `plans/evidence/G/`)

Seeded project, US session, viewports 375x812 and 1440x900. After each step console and network are clean (no commercetools hosts in the network list).
1. `/en-US/shop` at 1440: sidebar (Category, Price, Rating, Collection and the facets that have buckets), toolbar, 3-column grid, count equals the MCP search total. Screenshot `G-01-shop-1440.png`.
2. `/en-US/category/<pods slug>`: breadcrumb `Home › Pods`, H1, facets System, Intensity (button grid), Decaf/Organic/Fairtrade. Select Intensity 8: URL `?f_intensity=8`, chips show it, count equals the MCP count for that filter; other groups' counts changed, the Intensity group's own counts did not collapse (assert numbers with `evaluate_script`). Screenshot `G-02-pods-filtered-1440.png`.
3. Click a zero-count option: it is disabled (assert `disabled`). Select a combination with no results (use the MCP to find one): empty state with chips, remove a chip, results return and scroll position is unchanged.
4. Sort: choose "Price: low to high": URL `sort=price-asc`; first card price is the lowest in market (assert sorted ascending on the displayed `centAmount` data attribute `data-price`); repeat in `/en-CA/...` with CAD. "Top rated": ratings descend; cards without reviews come last and show no stars.
5. Open the store picker from a card line "Choose a store", pick Brooklyn: every card line becomes "In stock at ... / Low stock at ... / Not available at ..."; compare two cards with the MCP inventory. Toggle "Available at Brooklyn": count drops to the MCP total for `isOnStockForChannel`; products out of stock there are gone.
6. Rating radio "4.5 and up": only products with average at least 4.5 (compare with the MCP read of `reviewRatingStatistics`), counts follow.
7. Search `/en-US/search?q=<an exact seeded SKU>`: that product is first and a "Matched SKU" note shows; `?q=<misspelling of a product name, over 5 chars>`: the intended product appears; `?q=zzzzqq`: no-results state with the query editable and fallback categories/bestsellers; `?q=` prompt and no network call to `/api/search`. `<meta name="robots">` is `noindex`.
8. Quick add: on a pod card press Quick add: toast "Added to bag", header badge increases without reload, `POST /api/cart/lines` returns 200; press again, badge 2. On a coffee card press Quick add: navigates to the PDP URL with `choose=grind` and nothing is added (badge unchanged). Check the cart read with the MCP (section 7).
9. History: apply two filters, open a product, press back: same URL, filters and scroll position restored. Reload the filtered URL in a new tab: identical result count.
10. Pagination: choose a scope with more than 24 products, or temporarily check with `?page=2` on `/shop` (about 40 products): Next/Previous keep filters; `?page=99` redirects to the last page.
11. 375px: 2 columns, no horizontal overflow, Filters button with badge opens the sheet; tick two options, the button text changes to `Show n results` (the n matches a desktop count for the same filters), Apply closes and the grid filters; close without Apply discards. Screenshots `G-03-plp-375.png`, `G-04-filter-sheet-375.png`, `G-05-empty-375.png`.
12. Keyboard: Tab order sidebar, toolbar, cards once each; Quick add appears on focus; Enter on a facet option applies it. `/en-CA/shop` shows CAD prices with two decimals and no collection availability on cards (Canada is delivery only).

## 7. Self-verification with data

Use the commercetools MCP when available (`read_product_search`-style call) or `cd seed && npm run verify`; record trimmed results in `plans/evidence/G/mcp-checks.md`.
- Product Search `{ "query": { "exact": { "field": "variants.prices.currencyCode", "value": "USD" } }, "limit": 0 }` total equals the `/shop` count line for the US; the same for CAD/CA (products without a price in a market are absent by design).
- Facet request with a roast filter: counts per group computed with the other groups' filters; compare two buckets with `limit: 0` requests using the clause in `query`.
- Rating: `reviewRatingStatistics.averageRating` range filter totals equal the "4.5 and up" and "4.0 and up" counts; `count` of products without reviews equals the number the seed reports (three products without reviews, SEED-PLAN section 8).
- Price sort: first five ids of a price-asc request equal the first five cards for the market; if a filtered example shows the docs' sort-scope inversion, record it.
- Availability: for two seeded SKUs (one in stock at a store, one at 0) the card dot colour equals the `read_inventory` result for that supply channel.
- Cart: after Quick add, `read_carts` (by `cartId` from the session debug view or `GET /api/cart`) shows the line with `custom.fields.fulfilment = delivery`, no `supplyChannel`, a price equal to the card price, and `shippingMode` as configured.
- Seed gaps found (missing `badge`, `subscribable`, ratings, images, colour enum labels) become rows in `plans/notes/seed-requests.md`, never an owner question.

## 8. Manual testing and owner items

Rows (also in `plans/notes/todo-G.md`):

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x2 | Owner | Before images appear on cards (G works without) | 1. Provide `IMAGE_SOURCE_URL` as in OA-03. 2. Run `cd seed && npm run seed:images`. | Cards show photos; until then the labelled placeholder | TODO |
| SO-x1 | Owner | Before release | 1. Read the `plp.*` and `card.*` strings in `messages/en-US.json`. 2. Decide what "Featured" sort means (Q-G-04). 3. Approve the no-results fallback (categories and bestsellers) copy. | Copy approved or edited | TODO |
| M-G-01 | Owner | After G is Ready for review | 1. Open `/en-US/category/<pods>` on desktop and on a real phone. 2. Compare with `design/export/.../screenshots/plp-filters.png` and `01-plp-applied.png`. | Visual fidelity judged acceptable | TODO |
| M-G-02 | Owner | After G | 1. On a real phone apply filters via the sheet, rotate the phone, press Back. | Filters and scroll restored, sheet usable | TODO |

## 9. Questions

Mirrored in `plans/notes/questions-G.md`.

1. **Q-G-01** `reviews-and-ratings` expects a fallback if Product Search cannot filter or sort on rating statistics. The docs show both exist. Default: use `reviewRatingStatistics.averageRating` filter, ranges facet and sort directly; no seed attribute or review hook needed (spec fallback not built).
2. **Q-G-02** "Quick add adds the default variant with default fulfilment": which fulfilment? Default: delivery (collect needs a chosen store and stock; subscribe needs an interval).
3. **Q-G-03** Badge precedence when several flags apply. Default: Bestseller, Limited edition, New, Subscribe & save.
4. **Q-G-04** What does "Featured" sort mean (no popularity data in the seed)? Default: newest first (`createdAt` desc) then name; proposal: seed a `featuredRank` number attribute.
5. **Q-G-05** Price bands per market. Default: under 10, 10 to 24.99, 25 to 99.99, 100 to 249.99, 250 and up in both currencies (USD and CAD).
6. **Q-G-06** The spec lists Brew method for machines and accessories but the seed defines `brewMethods` on coffee only. Default: facet defined for all three, shown only where buckets exist (so effectively coffee); seed request for machines optional.
7. **Q-G-07** Exact SKU matching several products (template open question). Default: all matching products are listed, boosted first, and each card names the matched SKU; no single-result redirect.
8. **Q-G-08** Is a real "did you mean" in scope? Default: no (needs an external engine); the page says typo-tolerant matching is on and claims no correction.
9. **Q-G-09** Spec says 3 grid columns beside the sidebar and the tokens spec says grids go to 3 columns at 1080px, while the prototype CSS shows 3 columns above 1080 and 2 below. Default: 3 above 1080px, 2 at 1080px and below.
10. **Q-G-10** Cache the catalogue half of cards by `[locale, ids]` (template "Modeling notes")? Default: no in v1; per-request reads only (simpler, correct); revisit in Q performance.
11. **Q-G-11** No-results fallback content: who curates it and per category or global? Default: global, derived (root categories plus bestsellers); no CMS.
12. **Q-G-12** Saved items for guests: session-only (`sessionStorage`) or a cookie? Default: `sessionStorage`; L moves it to shopping lists and merges on sign-in.
13. **Q-G-13** Products with no price in the shopper's market: hidden from the listing or shown as "No price available"? Default: hidden by the market filter in the query (not sellable here, template `switching-region-or-language`); the card state exists for the race case and for H's links.

## 10. Definition of done

- G-00 to G-13 ticked with passing `npm run check`; `npm run build` passes and the three routes are dynamic.
- Every scenario in section 5 has a named passing test or recorded evidence.
- Browser recipe walked at 375 and 1440 with evidence in `plans/evidence/G/` (screenshots named above, `mcp-checks.md`, `README.md`); console and network clean; counts equal the MCP counts.
- Exported and described in header comments for H, I, L, M and O: `ProductCard`, `ProductGrid`, `mapProductSummary`, `ProductSummary`, `searchProducts`, `getListingProjections`, `buildSearchRequest`, `parseListingParams`, `getCategoryTree`, `lib/ct/cart.ts` (`getCartForSession`, `createCart`, `addLine`), `useAddToCart`, `useCart`, `CartSummary`, `POST /api/cart/lines`, `GET /api/cart`.
- `grep -rn "productProjections().search\|productProjectionParameters" lib app components` returns nothing outside tests that assert absence.
- OA-x2, SO-x1, M-G-01, M-G-02 in `plans/notes/todo-G.md`; questions Q-G-01 to Q-G-13 in `plans/notes/questions-G.md`; seed gaps in `plans/notes/seed-requests.md`.
- `STATUS.md` set to `Ready for review`.
