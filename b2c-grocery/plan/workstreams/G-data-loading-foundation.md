# G — Data-loading foundation: types, mappers, catalog reads

**Specs:** `storefront-data-loading` — Server-rendered catalog/client-fetched state, Parallel fetches, Type boundary via mappers, Server-side caching of stable data, Client state hooks and keys (infrastructure), Product search API
**Depends on:** D, E, F · **Unblocks:** H(optional), J, K, L, M, P, R · **Decisions:** D-030, D-031, D-043

## Goal
App types, mappers and the server-side catalog reads (categories, product search, product by slug) exist and are unit-tested; client fetch/SWR infrastructure is ready for J.

## Design

### `lib/types.ts` (no imports from SDK; components import only this file)
```ts
export interface Money { centAmount: number; currencyCode: string }
export interface Price { centAmount: number; currencyCode: string; discounted?: Money }
export type IncrementUnit = 'g' | 'kg' | 'ml' | 'l' | 'each';
export interface Increment { value: number; unit: IncrementUnit; label: string }          // label = packLabel localized, e.g. "500 g"
export interface Availability { isOnStock: boolean; availableQuantity: number }
export interface Variant { id: number; sku: string; images: string[]; price?: Price; attributes: Record<string, string | number | boolean | string[]>; increment: Increment; approximateWeight: boolean; availability: Availability }
export interface Product { type: 'Product'; id: string; key?: string; name: string; slug: string; description: string; brand?: string; origin?: string; storage?: 'ambient'|'chilled'|'frozen'; dietary: string[]; allergens: string[]; recurringEligible: boolean; categoryIds: string[]; substituteProductIds: string[]; variants: Variant[] }  // variants[0] = master/default
export interface Category { id: string; key: string; name: string; slug: string; parentId?: string; children?: Category[] }
export interface ListingFacets { categories: { id: string; count: number }[]; priceBands: { id: string; count: number }[]; availability: { inStock: number; outOfStock: number } }
export interface SearchResult { products: Product[]; total: number; page: number; pageSize: number; facets: ListingFacets }
export type SortKey = 'relevance' | 'newest' | 'price-asc' | 'price-desc';
```
(J adds `Cart`, `CartLine` and `Address`; R adds `Order`.)

### Mappers (`lib/mappers/*`, `server-only`, pure functions)
- `mapProduct(projection: ProductProjection, ctx: {locale, currency, country}): Product` — localized strings via `getLocalizedString`; attribute values by name from product-level attributes (master variant attributes in projection) and variant attributes `incrementValue`, `incrementUnit` (enum key), `approximateWeight`, `packLabel` (ltext); price = variant `price` (scoped) with `discounted`; images = `variant.images[].url`; availability from `variant.availability` (`isOnStock`, `availableQuantity` default 0).
- `mapCategory(cat, locale)`, `buildCategoryTree(categories, locale)` (root = no parent; children sorted by `orderHint`).
- Fixtures under `lib/mappers/__fixtures__/` (JSON copied from real responses, **no secrets**).

### Catalog reads (`lib/ct/*`, `server-only`)
- `lib/ct/categories.ts`: `getCategoryTree(locale)` (wrapped with `unstable_cache`, key `['category-tree', locale]`, `revalidate: 60`), `getCategoryBySlug(slug, locale)`.
- `lib/ct/search.ts`:
  ```ts
  export interface SearchParams { locale: string; currency: string; country: string; text?: string; categoryId?: string; priceBand?: string; availability?: 'in-stock' | 'out-of-stock'; sort?: SortKey; page?: number; pageSize?: number /* default 24 */ }
  export async function searchProducts(p: SearchParams): Promise<SearchResult>;
  export const getProductBySlug: (slug: string, ctx: Ctx) => Promise<Product | null>; // React cache() wrapped
  export async function getProductsByIds(ids: string[], ctx: Ctx): Promise<Product[]>;
  export async function getProductBySku(sku: string, ctx: Ctx): Promise<Product | null>; // exact variants.sku
  ```
  Use **only** `apiRoot.products().search().post({ body })` (never `productProjections().search()`). Category filter via `exact categoriesSubTree`; text via `fullText` on `name` with `language: locale`; `productProjectionParameters: { priceCurrency, priceCountry }`; `limit = pageSize`, `offset = (page-1)*pageSize`; facets: distinct `categories.id`; price ranges on `variants.prices.centAmount`; availability facet field verified in G-05. Sort: `relevance` omits `sort`; `newest` → `createdAt desc`; `price-asc/desc` → `variants.prices.centAmount`.
- `lib/ct/locale-validation.ts`: `getValidCountryConfig()` per skill (`unstable_cache` 300 s).
- **Never** cache anything that reads `getSession()`.

### Client infrastructure
- `lib/cache-keys.ts`: `KEY_CART='cart'`, `KEY_ACCOUNT='account'`, `KEY_ORDERS='orders'`, `KEY_ADDRESSES='addresses'`, `KEY_WISHLIST='wishlist'`, `KEY_RECURRING='recurring'`, `keyOrder(id)`.
- `lib/fetcher.ts` (client-safe): `class ApiError extends Error { status: number; data?: unknown }`, `async function fetchJson<T>(url, init?): Promise<T>` (throws `ApiError` with `data.error` message on non-2xx), `async function sendJson<T>(url, method, body?)`.
- `lib/config/price-bands.ts`: bands per currency in minor units: `USD` and `EUR` both `[{id:'lt-500',max:500},{id:'500-1500',min:500,max:1500},{id:'1500-3000',min:1500,max:3000},{id:'gt-3000',min:3000}]`, `getPriceBands(currency)`.

## Tasks
- [x] G-01 Write `lib/types.ts`, `lib/cache-keys.ts`, `lib/config/price-bands.ts` with tests (`getPriceBands('EUR')` ids; unknown currency → throws).
- [x] G-02 Write `lib/fetcher.ts` with tests (mock `fetch`: ok JSON; non-2xx → `ApiError` with message from body; network error propagates).
- [x] G-03 Write `lib/mappers/product.ts` + fixtures + tests: weighed variant (increment 500 g, label "500 g", `approximateWeight`), `each` product, missing price → `price` undefined, de-DE localization with fallback, availability default 0, discounted price.
- [x] G-04 Write `lib/mappers/category.ts` + tests (tree building, orderHint sorting, locale fallback, orphan parents handled).
- [x] G-05 Write `lib/ct/search.ts`: `searchProducts` request builder as a **pure function** `buildSearchRequest(params)` (tested thoroughly: text, category subtree, price band, availability, sorts, pagination offset for page 2 = 24) plus `searchProducts` calling `apiRoot.products().search().post` (tested with mocked root). **Spike (needs OA-02):** run one real search, confirm the field names used for the availability facet and price-band filter, also confirm that `fullText.language` accepts `en-US`, and that a price-band filter on `variants.prices.centAmount` must be combined with the price's `currencyCode` and `country` (record the working query shape); record all in `PROJECT-FINDINGS.md` §4; if a field is not supported, adapt and note the adaptation.
- [ ] G-06 Write `getProductBySku` (used by J to find the product behind a SKU), `getProductBySlug` (exact `slug` match with `language`, wrapped in React `cache`) and `getProductsByIds`; tests for not-found → `null` and dedupe within a request.
- [ ] G-07 Write `lib/ct/categories.ts` with `unstable_cache` TTL 60 and `getCategoryBySlug`; test that the cache wrapper is configured with `revalidate: 60` and key includes the locale (mock `next/cache`).
- [ ] G-08 Write `lib/ct/locale-validation.ts` (TTL 300) + test; export `getValidMarkets()` (filtered `COUNTRY_CONFIG`), and use it inside `POST /api/locale` (E) to reject unsupported markets (test: invalid market → 400), and change `app/[locale]/layout.tsx` to pass `getValidMarkets()` to `LocaleSwitcher` (test: a market missing from the project is not offered); add a **lint-style test** `lib/ct/no-session-in-cache.test.ts` that greps files under `lib/ct/` and fails if a file importing `unstable_cache` also imports `@/lib/session`.
- [ ] G-09 Report manual tests M-G-1, M-G-2; update `PROJECT-FINDINGS.md` with the verified search field names.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Category page (server fetch, no /api) | L/K page tests; here: `searchProducts` is plain server function |
| Page with category and tree (parallel) | K page test asserts both calls started before either resolved |
| Price display (formatMoney) | D-01 + component tests |
| Cached function reads session | G-08 |
| Search call uses `products().search()` | G-05 (mock records the method) |
| Listing page size | G-05 offsets |

## Manual tests to report
- M-G-1 (needs OA-02): With a one-off script or the dev server page created in K, confirm that searching "milk" returns Whole milk and that page 2 of all products is non-empty.
- M-G-2: Confirm EUR prices for `de-DE`: first product price in a German session is shown with `€`.

## Definition of done
No SDK type leaves `lib/ct`/`lib/mappers`; every search path is covered by `buildSearchRequest` tests; findings updated.
