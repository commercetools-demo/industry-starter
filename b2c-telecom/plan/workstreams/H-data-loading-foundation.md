# H — Data-loading foundation: types, mappers, catalog and search reads

**Specs:** `discovery-and-browse` (both scenarios; the data side: market-priced, filterable, paginated listing data and the explicit empty result; the pages that render them are built in N, O, P). Detail-page links in that spec are superseded by `plp-led-catalog-navigation` (D-052): an offer is reached through its category listing and `?offer=<key>` anchors it, so no scenario here mentions a detail page and nothing detail-shaped is built.
**Depends on:** D, E, G · **Unblocks:** I, J, K, L, M, N, O, P, X · **Decisions:** D-004, D-005, D-010, D-011, D-012, D-016, D-017, D-019, D-052, D-056, D-058
**Owner prerequisites:** none for unit tests; OA-02 (storefront API client) for the live spike H-10 and the Chrome checks · **Skill refs:** `commercetools-storefront` (product-listing, data-loading references), `commercetools-platform` (Product Search), `commercetools-commerce-patterns` (price selection, recurring prices)

## Goal
Every later workstream can read the Malva catalog (category tree, offers with plan/add-on/equipment facts, prices for the buyer's market, text search) through typed, cached, unit-tested functions, and formats money and localized strings in one place. No SDK type leaves `lib/ct/**` or `lib/mappers/**`.

## Design

### 1. Entitlement answer (spec open question: "Is the catalog identical for every buyer, or entitlement-scoped per company?")
**The catalog is identical for every buyer.** There are no Stores, no Product Selections and no per-company entitlement (D-058, D-005: B2B is out of scope). Prices differ only by **market** (currency + country, D-004), never by buyer. The only per-buyer narrowing is *eligibility* (customer type, existing customer, channel, schedule, serviceability), which workstream K applies **on top of** the cached, shared data this workstream returns (`filter` step in the page, never inside a cached function). Consequence: everything H returns may be cached and shared between buyers; nothing H returns depends on `getSession()`. A test (H-11) fails if a file under `lib/ct/` imports both `unstable_cache` and the session module.

### 2. Names (all new files are in H's area unless stated)
| Path | Contents |
| --- | --- |
| `lib/types.ts` | App types (below). Created by H; others append inside marked sections `// ===== <LETTER>: <topic> =====` |
| `lib/format.ts` | `formatMoney`, `getLocalizedString` (the only places for money formatting and localized fallback; nobody else defines them) |
| `lib/config/markets.ts` | `MARKETS`, `marketFromLocale(locale)`, `isLocale(value)` |
| `lib/config/cache.ts` | Every cache TTL (seconds) and the read timeout: see §6 |
| `lib/config/facets.ts` | D-017 filter chips as data + predicates |
| `lib/config/price-bands.ts` | Price bands per currency (minor units) |
| `lib/config/nav.ts` | `NAV_TIE_BREAK_ORDER` (only a tie-break for categories without an order hint) |
| `lib/ct/timeout.ts` | `withTimeout`, `UpstreamTimeoutError` |
| `lib/ct/categories.ts` | `getCategoryTree`, `getCategoryBySlug`, `getCategoryByKey` |
| `lib/ct/catalog.ts` | `getAllOffers`, `getOfferByKey`, `getOffersByKeys`, `getOffersInCategory`, `getCatalogFacts` |
| `lib/ct/search.ts` | `buildSearchRequest` (pure), `searchOffers` |
| `lib/mappers/category.ts`, `lib/mappers/price.ts`, `lib/mappers/attributes.ts`, `lib/mappers/offer.ts` | SDK to app types |
| `lib/catalog/listing.ts` | Pure listing logic: chips, sort, price band, pagination, empty state (new directory, H's area) |
| `app/api/dev/catalog/route.ts` | **Development-only** JSON window for Chrome checks (404 when `NODE_ENV !== 'development'`) |

### 3. `lib/types.ts` (no SDK imports; components import types from here only)
```ts
export type Locale = 'en-US' | 'de-DE';
export type CurrencyCode = 'USD' | 'EUR';
export type CountryCode = 'US' | 'DE';
export interface Market { locale: Locale; currency: CurrencyCode; country: CountryCode }

export interface Money { centAmount: number; currencyCode: string }       // commercetools centAmount; formatMoney is the only divider by 100

export type OfferKind = 'base-package' | 'addon' | 'equipment' | 'device' | 'bundle';
export type PlanFamily = 'internet' | 'phone';
export type Technology = 'cable' | 'fixed-wireless' | 'mobile';              // 'mobile' is derived for phone plans (the phone type has no technology attribute)
export type TermKey = 'month-to-month' | '12-months' | '24-months';
export type TermMonths = 0 | 12 | 24;                                        // 0 = month-to-month
export type AudienceKey = 'consumer' | 'small-business' | 'employee';
export type ExistingCustomerRule = 'any' | 'existing' | 'new';
export type EquipmentKind = 'router' | 'modem' | 'extender' | 'gateway';

export interface PlanFacts {
  kind: 'plan'; family: PlanFamily; technology: Technology;
  downstreamMbps?: number; upstreamMbps?: number;                            // internet plans
  typicalDownloadMbps?: number; typicalUploadMbps?: number; typicalLatencyMs?: number;
  dataGb?: number;                                                           // -1 = unlimited (D-017)
  hotspotGb?: number; linesIncluded?: number;                                // phone plans
  networkGeneration?: '4g' | '5g';
  priceLockMonths?: number; earlyTerminationFee?: string;                    // localized text
  badge?: 'most-popular';
  includedAddons: string[];                                                  // RAW references (product keys such as "malva-appletv" or offer keys); J's refersTo() resolves them
  conflictsWith: string[];                                                   // RAW references, same rule
  requiredEquipmentKinds: EquipmentKind[]; requiredAddonKinds: string[];
  highlights: string[];                                                      // localized bullet strings
}
export interface AddonFacts {
  kind: 'addon'; addonKind: 'streaming' | 'security' | 'protection'; provider?: string;
  appliesToFamilies: PlanFamily[]; appliesToTechnologies: Technology[];      // technologies empty = any
  chargeType?: string; trialDays?: number; tag?: string;                     // tag = Music | Video | Extras (see Planner defaults)
  highlights: string[];
}
export interface EquipmentFacts {
  kind: 'equipment'; equipmentKind: EquipmentKind;
  maxDownstreamMbps?: number; supportedTechnologies: Technology[]; wifiStandard?: string;
  chargeType?: string; incompatibleWith: string[];                           // RAW references (offer or SKU keys)
}
export interface DeviceFacts {
  kind: 'device'; brand?: string; os?: string; networkGeneration?: '4g' | '5g'; compatiblePlanFamilies: PlanFamily[];
}
export type OfferFacts = PlanFacts | AddonFacts | EquipmentFacts | DeviceFacts;

export interface OfferVariant {
  id: number; sku: string; isMaster: boolean;
  term: TermKey | null; termMonths: TermMonths | null;                       // null for add-ons/equipment without a term
  recurringPrice?: Money;                                                    // price carrying a recurrence policy (monthly)
  oneTimePrice?: Money;                                                      // price with no recurrence policy (activation fee, equipment purchase)
  availableQuantity?: number;                                                // only when the variant has inventory (equipment, devices); undefined = not tracked (services)
  images: string[];
  attributes: Record<string, string | number | boolean | string[]>;          // variant-level attributes as plain values (devices: color, memory-gb)
}
export interface Offer {
  id: string; key: string; kind: OfferKind;
  name: string; slug: string; description: string;
  categoryKeys: string[]; primaryCategoryKey?: string;                       // primary = FIRST category assigned in commercetools (plp-led-catalog-navigation)
  anchors: string[];                                                         // product keys of the wrapped plan/add-on/equipment/device
  facts: OfferFacts | null;                                                  // merged from the anchor product (null if the anchor is missing; offer is then hidden, see mapper)
  includedOffers: string[];                                                  // RAW: offer.included-offers ∪ plan.included-addons
  compatibleAddons: string[]; compatibleEquipment: string[];                 // RAW offer keys (exceptions/allow-list, see J)
  conflictsWith: string[];                                                   // RAW: offer.conflicts-with ∪ plan.conflicts-with
  audience: AudienceKey[];                                                   // empty = everyone
  existingCustomer: ExistingCustomerRule;
  channels: string[];                                                        // empty = every channel
  startTime?: string; endTime?: string;                                      // ISO; endTime read from attribute `end-time` if G seeds it
  variants: OfferVariant[];                                                  // variants[0] is ALWAYS the master variant (D-011)
  headline: { recurring?: Money; oneTime?: Money; term: TermKey | null; termMonths: TermMonths | null };   // = master variant (D-011)
  image?: string;
}
export interface Category {
  id: string; key: string; name: string; slug: string;
  slugs: Record<string, string>;                                             // every locale's slug (locale switch / canonical redirect)
  parentId?: string; orderHint?: string; image?: string; children: Category[];
}
export interface PriceBand { id: string; min?: number; max?: number }        // minor units, min inclusive, max exclusive
export interface ListingQuery { chip?: string; sort?: 'price-asc' | 'price-desc' | 'name'; band?: string; page?: number; pageSize?: number }
export interface ListingResult {
  offers: Offer[]; total: number; page: number; pageSize: number; pageCount: number;
  chips: { id: string; count: number }[];                                    // counts over the whole category, not just the page
  bands: { id: string; count: number }[];
  empty?: 'no-offers' | 'no-match';                                          // explicit empty reason; recovery links are the root categories
}
export interface SearchResult { offers: Offer[]; total: number; page: number; pageSize: number; categoryFacet: { key: string; count: number }[]; bandFacet: { id: string; count: number }[] }
export type SearchSort = 'relevance' | 'price-asc' | 'price-desc';
```
Other workstreams append their own sections (J: offer rules types, K: eligibility types, M: `Cart`, `CartLine`, S: `Order`, R: `Customer`).

### 4. Formatting (`lib/format.ts`)
```ts
export function formatMoney(money: Money, locale: Locale): string;
export function getLocalizedString(value: Record<string, string> | undefined | null, locale: string): string;
```
- `formatMoney`: `Intl.NumberFormat(locale, { style: 'currency', currency: money.currencyCode, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })` where `whole = money.centAmount % 100 === 0` (matches the prototype: `$25`, `$59.99`). Value = `centAmount / 100` (the only division by 100 in the code base; all five currencies we use have two fraction digits). `en-US` USD 2500 gives `$25`; 5999 gives `$59.99`; `de-DE` EUR 5999 gives `59,99 €` (contains a no-break space U+00A0; tests compare with ` `).
- `getLocalizedString`: exact locale, then same language other region (`en-GB` for `en-US`), then `en-US`, then first non-empty value, then `''`.
- `lib/config/markets.ts`: `MARKETS: Record<Locale, Market> = { 'en-US': {locale:'en-US', currency:'USD', country:'US'}, 'de-DE': {locale:'de-DE', currency:'EUR', country:'DE'} }` (D-004; en-GB/GBP deliberately absent). `marketFromLocale(l: string): Market` throws `Error('Unsupported locale')` for anything else; `isLocale(v: unknown): v is Locale`.

### 5. Price selection and mapping (`lib/mappers/price.ts`, pure)
commercetools price selection ([docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)): currency must match; then validity dates, customer group, channel, country by priority; for a recurring line item the platform first looks for a price tied to the Recurrence Policy and falls back to the one-time price ([docs](https://docs.commercetools.com/api/recurring-orders-overview.md#prices)). This storefront stores per offer variant, per market: one price **with** `recurrencePolicy` (the monthly charge, D-012) and optionally one price **without** it (the one-time charge: activation fee, equipment purchase). No customer-group or channel prices exist (D-004, D-058), so the catalog read passes only `priceCurrency` and `priceCountry` (`productProjectionParameters` / query args); the mapper reads the **raw `variant.prices[]`** (always present on a projection) so it can return both kinds, which the single scoped `price` field cannot:
```ts
export function selectPrices(prices: ReadonlyArray<{ value: {centAmount:number; currencyCode:string}; country?: string; recurrencePolicy?: unknown; validFrom?: string; validUntil?: string; channel?: unknown; customerGroup?: unknown }>,
  market: Market, now: Date): { recurring?: Money; oneTime?: Money };
```
Rules, in order: (1) keep prices with `value.currencyCode === market.currency`; (2) drop any with a `channel` or `customerGroup` (none are seeded; if one appears it is ignored and logged once with `console.warn('[catalog] ignoring scoped price', sku)`); (3) drop prices with `validFrom > now` or `validUntil <= now`; (4) keep `country === market.country` or no country; if both a country-specific and a country-less price of the same kind exist, the **country-specific one wins**; (5) a price with `recurrencePolicy` set is *recurring*, without it *one-time*; (6) if several of the same kind remain, take the lowest `centAmount`. Pitfall: do NOT use `variant.price` (the scoped single price): when a variant has both a recurring and a one-time price in the market it returns only one of them.

### 6. Cache constants (`lib/config/cache.ts`, seconds)
```ts
export const CATEGORY_TREE_TTL = 60;        // categories change rarely; "New category appears without a deploy" within one minute
export const CATALOG_TTL = 60;              // offers + facts: "Catalog edit changes behaviour" after the cache window
export const PRODUCT_TYPE_IDS_TTL = 3600;   // product type key -> id
export const MARKET_VALIDATION_TTL = 300;   // used by D/E if they validate markets against project settings
export const SERVICEABILITY_TTL = 300;      // 5 minutes (D-020), used by K
export const CT_READ_TIMEOUT_MS = 8000;     // upstream read timeout (Error pages "Upstream fault")
```
J/K/others only append constants here. **A TTL is the only cache invalidation**: there are no webhooks in v1. All cached functions are wrapped with `unstable_cache(fn, [name, ...keyParts], { revalidate: TTL, tags: ['catalog'] })` and take only primitive arguments (locale, currency, country). Cached functions return plain JSON (no `Date`, `Map`, `undefined` in arrays).

### 7. Timeouts (`lib/ct/timeout.ts`)
```ts
export class UpstreamTimeoutError extends Error { constructor(readonly label: string, readonly ms: number) { super(`Upstream timeout: ${label} after ${ms} ms`); } }
export function withTimeout<T>(promise: Promise<T>, label: string, ms = CT_READ_TIMEOUT_MS): Promise<T>;   // rejects with UpstreamTimeoutError; clears its timer
```
Every `lib/ct/catalog.ts`, `categories.ts`, `search.ts` network call goes through `withTimeout(…, 'catalog.offers')`. The error propagates to the Next error boundary (I renders the server-error page; "Upstream fault").

### 8. Categories (`lib/mappers/category.ts`, `lib/ct/categories.ts`)
- `mapCategory(sdkCategory, locale): Category` (name and slug localized with `getLocalizedString`; `slugs` = the raw localized slug map; `image` = `assets[0].sources[0].uri` when present; `orderHint` as given).
- `buildCategoryTree(categories: Category[]): Category[]`: roots = no `parentId`; children sorted by `orderHint` ascending (string compare, hints are decimal strings like `0.1`), then `NAV_TIE_BREAK_ORDER` index, then `name`; orphans (parent id not in the list) are treated as roots **and** logged once. Roots sorted the same way.
- `lib/config/nav.ts`: `export const NAV_TIE_BREAK_ORDER = ['malva-cat-phone-plans','malva-cat-home-wireless','malva-cat-cable-internet','malva-cat-add-ons','malva-cat-devices']` (design order: Phone plans, Wireless internet, Cable internet, Add-ons). Used only when order hints are equal or missing.
- `getCategoryTree(locale: Locale): Promise<Category[]>`: one REST call `apiRoot.categories().get({ queryArgs: { limit: 500 } })` (the whole tree is read in one call and walked in memory, never per level), cached (`CATEGORY_TREE_TTL`, key `['category-tree', locale]`). `getCategoryBySlug(slug, locale)`: searches the tree for `slugs[locale] === slug`; if not found, for a slug of **any** other locale (returns the category plus `matchedLocale` so N can redirect to the canonical slug); else `null`. `getCategoryByKey(key, locale)`. Also pure helpers exported from `lib/mappers/category.ts`: `flattenTree(tree)`, `findDescendantKeys(category)` (inclusive), `breadcrumbTrail(tree, key): Category[]` (root → leaf).

### 9. Offer mapping (`lib/mappers/offer.ts`, `lib/mappers/attributes.ts`)
Attribute readers (`attributes.ts`) take a projection variant's `attributes: {name, value}[]` and return plain values: `attrNumber`, `attrString`, `attrBool`, `attrEnumKey` (enum value is `{key,label}`; localized enum `label` is not used, only the key), `attrEnumKeys` (set of enum), `attrStringSet`, `attrLocalized(name, locale)`, `attrLocalizedSet` (`highlights`: a set of localized strings), `attrDate` (ISO string). Missing or wrongly typed attribute: returns `undefined` (or `[]` for sets); **never throws** (a seed lint in G rejects missing speeds; the rules in J fail closed on missing data).

Data flow per request, **three cached reads, no per-offer calls**:
1. `getProductTypeIds()` (cached `PRODUCT_TYPE_IDS_TTL`): `apiRoot.productTypes().get({ queryArgs: { where: 'key in ("malva-offer","malva-internet-plan","malva-phone-plan","malva-addon","malva-equipment","malva-device")', limit: 10 } })` returns key → id.
2. `getCatalogFacts(locale)` (cached `CATALOG_TTL`): reads every **non-offer** product (`apiRoot.productProjections().get({ queryArgs: { where: 'productType(id in (…))', limit: 500, staged: false } })`, loop while `offset+count < total`), maps each to `OfferFacts` keyed by product key (`Record<string, OfferFacts>`).
3. `getAllOffers(market)` (cached `CATALOG_TTL`, key `['offers', locale, currency, country]`): reads every `malva-offer` projection with `priceCurrency`, `priceCountry`, `staged: false`, `limit: 500`, loops pages, maps with `mapOffer(projection, ctx)`, then merges facts: for each offer `facts = anchors.map(k => facts[k]).find(Boolean) ?? null`. Offers whose `facts === null` (anchor missing) **or** whose master variant has neither `recurring` nor `oneTime` price in the market are **removed** and logged (`console.warn('[catalog] offer hidden', key, reason)`): an offer without a price for the buyer's market is not sold there (Planner default; this is what keeps the de-DE market empty until EUR prices are seeded, see Excluded notes and report).

Mapping details for `mapOffer(projection, ctx: {market: Market; categoryIdToKey: Record<string,string>; now: Date})`:
- `id`, `key`, `name` (localized), `slug` (localized), `description` (localized, `''` when absent).
- `kind` from attribute `offer-kind` (enum key); unknown or missing: the offer is dropped and logged.
- `categoryKeys` = `projection.categories[].id` mapped via `categoryIdToKey` (unknown ids dropped); `primaryCategoryKey = categoryKeys[0]` (**first assigned**; assignment order is data, never a runtime guess).
- `anchors` = attribute `anchors` (set of text). `includedOffers` = `included-offers` ∪ the plan's `included-addons`; `conflictsWith` = `conflicts-with` ∪ the plan's `conflicts-with`; `compatibleAddons` = `compatible-addons`, `compatibleEquipment` = `compatible-equipment`; `audience` = `audience` (enum keys), `existingCustomer` = `existing-customer` (default `'any'`), `channels` = `channels`, `startTime` = `start-time`, `endTime` = `end-time` (optional).
- Plan facts mapper `mapPlanFacts`: phone plans get `family: 'phone'`, `technology: 'mobile'`; internet plans `family: 'internet'`, `technology` from `technology` (`cable` | `fixed-wireless`). Add-on tag: attribute `tag` on the add-on product if present, else on the offer.
- Variants: every `[masterVariant, ...variants]`, `isMaster` true for the first. `term`/`termMonths` from variant attribute `contract-term` (`month-to-month` 0, `12-months` 12, `24-months` 24; otherwise `null`). `availableQuantity` = `variant.availability?.availableQuantity` (undefined when the variant has no inventory entry, D-019). `images` = `variant.images[].url`. `attributes`: `color`, `memory-gb`, `contract-term`, `charge-type` as plain values.
- `headline` = the master variant's prices and term (D-011). `image` = first image of the master variant.
- The whole `Offer` must survive `JSON.parse(JSON.stringify(offer))` unchanged (it is passed from Server Components to client components in N).

### 10. Listing logic (`lib/catalog/listing.ts`, pure, used by N and O)
`getOffersInCategory(categoryKey, market)` returns every offer whose `categoryKeys` contains the category **or any of its descendants** (the add-ons root shows streaming, equipment and protection offers). The page then calls `buildListing(offers, query, rootCategoryKeys)`:
```ts
export function buildListing(offers: Offer[], categoryKey: string, query: ListingQuery, roots: Category[]): ListingResult;
```
- **Chips (D-017)**, `lib/config/facets.ts`: `CHIPS_BY_CATEGORY` = phone plans `['all','unlimited','data-capped']`; home wireless `['all','5g','lte']`; cable `['all','up-to-500','1-gbps']`; add-ons root (and its children) `['all','music','video','extras']`; any other category `['all']`. Predicates over `offer.facts`: `unlimited` = `dataGb === -1`; `data-capped` = `dataGb !== undefined && dataGb >= 0`; `5g` = `networkGeneration === '5g'`; `lte` = `networkGeneration === '4g'`; `up-to-500` = `downstreamMbps !== undefined && downstreamMbps <= 500`; `1-gbps` = `downstreamMbps > 500`; `music`/`video`/`extras` = add-on `tag` equals (case-insensitive) `Music`/`Video`/`Extras`. **Why in memory:** these attributes live on the plan product, the search index only holds the offer product's own attributes, so the chip cannot be a search filter. The category is small (at most ~15 offers), so reading them once and filtering in memory is exact and cheaper than N queries. `chips[].count` is computed over all offers of the category (so "N plans" and chip counts do not change when a chip is applied). An unknown chip id behaves as `all`.
- **Sort**: default `price-asc` = master variant `headline.recurring.centAmount` ascending (matches the design order Essential 5GB to Unlimited Max, Cable 100 to Cable Gig); offers with no recurring headline sort last (by `oneTime`), ties by `name`. `price-desc`; `name` (locale-insensitive `localeCompare` on `name`).
- **Price band** (`lib/config/price-bands.ts`): `USD` and `EUR` both `[{id:'lt-25',max:2500},{id:'25-50',min:2500,max:5000},{id:'50-75',min:5000,max:7500},{id:'gt-75',min:7500}]` (min inclusive, max exclusive) applied to the headline recurring amount (or one-time when no recurring); `getPriceBands(currency)` throws for another currency.
- **Pagination**: `pageSize` default `LISTING_PAGE_SIZE = 12` (in `lib/config/facets.ts`), 1-based `page` clamped to `[1, pageCount]` (out of range pages show the last page; `pageCount = max(1, ceil(total / pageSize))`).
- **Empty**: no offers at all in the category: `empty: 'no-offers'`; offers exist but the chip/band hides all: `empty: 'no-match'`. Both return `offers: []`, `total: 0`; the page shows an explicit message and links to the root categories (`roots`), never a blank list.

### 11. Search (`lib/ct/search.ts`)
**Product Search API only** (`apiRoot.products().search().post({ body })`); Product Projection Search is unavailable for projects created after 2026-08-31 and indexing is activated by F (D-056). Index updates take minutes after seeding; a product-type change triggers a full reindex.
```ts
export interface SearchParams { locale: Locale; currency: string; country: string; text?: string; categoryKey?: string; band?: string; sort?: SearchSort; page?: number; pageSize?: number /* default 12 */ }
export function buildSearchRequest(p: SearchParams, offerProductTypeId: string, categoryId?: string): ProductSearchRequest;   // pure
export async function searchOffers(p: SearchParams): Promise<SearchResult>;
```
Request shape (field names carried over from the verified grocery project `b2c-grocery/site/lib/ct/search.ts`; **H-10 re-verifies each against this project and records it in `PROJECT-FINDINGS.md`**):
- Always restrict to offers: `{ exact: { field: 'productType', value: <offer product type id> } }`.
- Text: `{ or: [ { fullText: { field: 'name', language: locale, value: text } }, { wildcard: { field: 'name', language: locale, value: '*<escaped>*', caseInsensitive: true } }, ...(SKU-like text ? [{ exact: { field: 'variants.sku', value: text, caseInsensitive: true } }] : []) ] }` (`*`, `?`, `\` in the user text are escaped with `\`).
- Category: `{ exact: { field: 'categoriesSubTree', value: <category id> } }`.
- Price band: `{ and: [ exact variants.prices.currencyCode, exact variants.prices.country, range variants.prices.centAmount gte/lt ] }` (all three on the same price object).
- Sort: `relevance` omits `sort`; `price-asc|price-desc` = `[{ field: 'variants.prices.centAmount', order, mode: 'min', filter: <currency and country exact> }]`.
- Paging: `limit = pageSize`, `offset = (page - 1) * pageSize`.
- Facets: `distinct` on `categories` (fieldType `reference`, limit 100); `ranges` named `priceBands` on `variants.prices.centAmount` (fieldType `long`, filter = currency + country, one range per band).
- `productProjectionParameters: { priceCurrency, priceCountry }`. Results carry `productProjection`; they are mapped by the same `mapOffer` and merged with the cached facts (so a search result is identical to a listing offer).
- **Availability decision (Planner default): no availability facet or filter.** Services have no inventory (D-019) so every service is always purchasable; equipment/device availability is derived from inventory with extra indexing delay ([docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)), which would make the facet wrong for minutes after a stock change. `Offer.variants[].availableQuantity` carries the live value from the projection for the cart (M) to use.
- Pitfall: one-time prices (equipment purchase, activation fee) are also embedded prices on offer variants, so search price bands and price sort consider them too; this is accepted for text search (the category listing path in §10 uses the exact headline instead). H-10 records whether `variants.prices.recurrencePolicy` is searchable; if it is, add a `{ exists }` condition to restrict to recurring prices and note it in findings.

### 12. Dev-only JSON window (`app/api/dev/catalog/route.ts`) — for Chrome checks
`GET /api/dev/catalog?view=categories|offers|search|offer&locale=en-US&category=<key>&chip=<id>&sort=&band=&page=&q=&key=<offerKey>`; first line of the handler: `if (process.env.NODE_ENV !== 'development') notFound();`. Responses: `view=categories` the tree (`key`, `slug`, `name`, children keys); `view=offers` `ListingResult` where each offer is reduced to `{ key, name, kind, primaryCategoryKey, headline: { recurring, oneTime, termMonths, label: formatMoney(...) }, variantTerms: [..], factsKind }`; `view=search` the same reduced offers plus `total`; `view=offer` one reduced offer or `{ "offer": null }` with status 200. Unsupported locale: status 400 `{ "error": { "code": "UNSUPPORTED_LOCALE", "message": "…" } }`. This route is not part of the product; workstream Y's release check requires the guard.

### 13. Planner defaults in this workstream
1. Offers without a price in the buyer's market, or whose anchor product is missing, are hidden and logged.
2. Recurring price = any price with `recurrencePolicy`; one-time = without. (No lookup of the `malva-monthly` policy id is needed.)
3. Chip filtering, sorting, banding and pagination of **category listings** happen in memory over the cached offer list; **text search** uses Product Search.
4. Default sort = ascending monthly headline price.
5. No availability facet (see §11).
6. Header navigation uses **all** root categories (five, including `malva-cat-devices`), because the navigation is data-driven; the spec's "four items" is the seeded set of the four plan/add-on roots plus the devices root added by G.
7. Add-on `tag` (Music / Video / Extras) is read from an attribute named `tag` on the add-on (or offer); the catalog model spec does not list it (spec gap reported).
8. `end-time` is read from an optional attribute `end-time` on the offer (the model lists only `start-time`).

### Pitfalls
- Version/SDK: `@commercetools/platform-sdk` ^8 and `ts-client` ^4 only inside `lib/ct/**` and `lib/mappers/**`; the mappers import SDK **types** only (`import type`).
- `unstable_cache` serializes with JSON: a `Map`, `Set` or `Date` silently becomes `{}`/string. Return arrays/records of primitives.
- `productProjections().get` with `where` uses **ids** (`productType(id="…")`), never keys: that is why §9 resolves ids first.
- `staged: false` is the default for projections but set it explicitly; an unpublished offer must disappear from listings (error-pages scenario "unpublished").
- Locale: slugs differ per locale; a locale switch keeps the path, so `getCategoryBySlug` must also resolve the other locale's slug.
- Indexing delay (search only): after a seed run, search lags minutes behind; category listings do not (they read projections directly).
- Attribute `highlights` is a **set of localized strings** (array of `{ 'en-US': …, 'de-DE': … }`), not a localized set.
- Never wrap `notFound()`/`redirect()` in try/catch (they throw by design).
- Do not read `getSession()` in any cached function.

## Tasks
- [x] H-01 Create `lib/types.ts` (all of §3), `lib/config/markets.ts`, `lib/format.ts` (`formatMoney`, `getLocalizedString`) with tests `lib/format.test.ts` and `lib/config/markets.test.ts`: `$25`/`$59.99`/`59,99 €` (NBSP), locale fallback order, unsupported locale throws, `isLocale`.
- [x] H-02 Create `lib/config/cache.ts` (§6 constants), `lib/ct/timeout.ts` with `lib/ct/timeout.test.ts` (fake timers: resolves before the limit; rejects with `UpstreamTimeoutError` at exactly `ms`; timer cleared on success).
- [x] H-03 [SKILL: commercetools-storefront] Create `lib/config/nav.ts`, `lib/mappers/category.ts` (`mapCategory`, `buildCategoryTree`, `flattenTree`, `findDescendantKeys`, `breadcrumbTrail`) and fixture `lib/mappers/__fixtures__/categories.json` (8 categories of `telecom-catalog-model`; no secrets) with `lib/mappers/category.test.ts`: order hints, tie-break, orphan root + warning, descendants inclusive, de-DE slugs.
- [x] H-04 [SKILL: commercetools-storefront] Create `lib/ct/categories.ts` (`getCategoryTree`, `getCategoryBySlug`, `getCategoryByKey`) with `lib/ct/categories.test.ts` (mock `next/cache` and the API root: `unstable_cache` called with key `['category-tree', locale]` and `revalidate: CATEGORY_TREE_TTL`; slug of the other locale resolves with `matchedLocale`; unknown slug null; the call goes through `withTimeout`).
- [x] H-05 [SKILL: commercetools-commerce-patterns] Create `lib/mappers/price.ts` (`selectPrices`) with `lib/mappers/price.test.ts`: recurring+one-time pair, country-specific wins over country-less, other currency ignored, channel/customer-group price ignored with warning, `validFrom` in the future ignored, lowest of duplicates, none returns `{}`.
- [x] H-06 [SKILL: commercetools-storefront] Create `lib/mappers/attributes.ts`, `lib/mappers/offer.ts` (`mapOffer`, `mapPlanFacts`, `mapAddonFacts`, `mapEquipmentFacts`, `mapDeviceFacts`, `mergeFacts`) and hand-written fixtures `lib/mappers/__fixtures__/offer-cable-500.json`, `offer-phone-unlimited.json`, `offer-addon-appletv.json`, `offer-router-ac1200.json`, `plan-cable-gig.json` with `lib/mappers/offer.test.ts`: master variant first and used as headline (24-month cable, month-to-month phone), term variants mapped, recurring vs one-time prices, `primaryCategoryKey` = first category, raw references merged (`included-addons` of the plan plus `included-offers` of the offer), phone plan gets `technology: 'mobile'`, missing attribute never throws, unknown `offer-kind` dropped, JSON round trip equality (`JSON.parse(JSON.stringify(o))` deep-equals `o`), German localization with `en-US` fallback.
- [x] H-07 [SKILL: commercetools-storefront] Create `lib/ct/catalog.ts` (`getProductTypeIds`, `getCatalogFacts`, `getAllOffers`, `getOfferByKey`, `getOffersByKeys`, `getOffersInCategory`) with `lib/ct/catalog.test.ts` (mocked API root and `next/cache`): paging loop reads until `total`; hidden offers (no price in market, missing anchor) are absent; three `unstable_cache` wrappers have `revalidate: CATALOG_TTL`/`PRODUCT_TYPE_IDS_TTL` and keys containing locale, currency, country; unpublished offer (not returned by the API) gives `null` from `getOfferByKey`; category lookup includes descendants; every call wrapped by `withTimeout`.
- [x] H-08 Create `lib/config/facets.ts`, `lib/config/price-bands.ts`, `lib/catalog/listing.ts` (`buildListing`) with `lib/catalog/listing.test.ts`, `lib/config/price-bands.test.ts`: every D-017 chip predicate, chip counts over the whole category, default sort ascending headline price, price band edges (2500 belongs to `25-50`), pagination (30 fixture offers: page 2 holds items 13-24; page 9 clamps to 3), empty reasons `no-offers` vs `no-match`.
- [x] H-09 [SKILL: commercetools-platform] Create `lib/ct/search.ts` (`buildSearchRequest` pure, `searchOffers`) with `lib/ct/search.test.ts`: request body exact-equality for text, SKU-like text, wildcard escaping, category subtree, band, both price sorts, `relevance` omits sort, page 2 offset 12, product-type restriction, facets present, no availability facet; `searchOffers` calls `products().search().post` (mock records the method) and returns mapped offers with facts merged.
- [x] H-10 [SKILL: commercetools-platform] Live spike (needs OA-02 and G seeded) and dev window: create `app/api/dev/catalog/route.ts` (§12) with `app/api/dev/catalog/route.test.ts` (non-development env gives 404; invalid locale 400; development env returns reduced offers) ; with `npm run dev`, call the route for `view=search&q=cable` and the plain listing views; confirm the field names of §11 (`productType`, `name` with `language: 'en-US'`, `categoriesSubTree`, `variants.prices.centAmount|currencyCode|country`, `variants.sku`), that `variants.prices.recurrencePolicy` is or is not searchable, that projections carry `prices[].recurrencePolicy`, and that the offer attributes are returned on `masterVariant.attributes`; record every result (including any adaptation made to the code) under a new heading `## H — catalog and search reads` in `plan/PROJECT-FINDINGS.md`; replace the hand-written fixtures by trimmed copies of real responses where they differ (no secrets, no ids of customers).
- [x] H-11 Guard tests: `lib/ct/no-session-in-cache.test.ts` (fails when a file under `lib/ct/` imports both `unstable_cache` and the session module `@/lib/ct/session`), `lib/ct/no-sdk-leak.test.ts` (no file outside `lib/ct/**`, `lib/mappers/**`, `scripts/**` imports `@commercetools/*`); run `npm run verify`; update `STATUS.md` via `node plan/verify-plan.mjs --sync`; report the C-H lines.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Browse a category | `discovery-and-browse` | `lib/catalog/listing.test.ts` → "Browse a category: page 1 holds 12 offers priced in the buyer's market, chip filter applied, counts over the whole category" and `lib/ct/catalog.test.ts` → "Browse a category: offers are read once per market and carry the market's recurring headline price" |
| Nothing matches | `discovery-and-browse` | `lib/catalog/listing.test.ts` → "Nothing matches: a chip with no result returns empty 'no-match' and the root categories for recovery" and "Nothing matches: a category without offers returns empty 'no-offers'" |

Supporting tests that are not scenario-bound but are required: `lib/format.test.ts`, `lib/mappers/*.test.ts`, `lib/ct/*.test.ts` as named in the tasks. UI rendering of the listing and the empty state is verified in N (C-N-*); the search page in P.

## Chrome verification (run by Claude)
Requires `cd site && npm run dev` against the seeded project and OA-02. The dev window is a JSON page, so "snapshot" means reading the JSON text.
- C-H-1 (needs OA-02, G): `http://localhost:3000/api/dev/catalog?view=categories&locale=en-US` → JSON roots in order phone-plans, home-wireless, cable-internet, add-ons, devices (keys `malva-cat-phone-plans`, `malva-cat-home-wireless`, `malva-cat-cable-internet`, `malva-cat-add-ons`, `malva-cat-devices`), `malva-cat-add-ons` has 3 children (`malva-cat-streaming`, `malva-cat-equipment`, `malva-cat-protection`); en-US slugs `phone-plans`, `home-wireless-internet`, `cable-internet`, `add-ons`, `phones-and-devices`; console clean; one 200 response. If the root order differs, report to G (order hints) rather than changing the code.
- C-H-2 (needs OA-02, G): `…/api/dev/catalog?view=offers&locale=en-US&category=malva-cat-cable-internet` → 3 offers in order `malva-offer-cable-100`, `malva-offer-cable-500`, `malva-offer-cable-gig`; each `headline.termMonths` is 24; `headline.recurring.centAmount` 3999, 5999, 7999 with `label` `$39.99`, `$59.99`, `$79.99`; `headline.oneTime.centAmount` 2500 (activation fee; if absent report to G); `variantTerms` contains `0`, `12`, `24`; `chips` = `all` 3, `up-to-500` 2, `1-gbps` 1.
- C-H-3 (needs OA-02, G): same with `category=malva-cat-cable-internet&chip=1-gbps` → exactly `malva-offer-cable-gig`; with `chip=up-to-500` → cable-100 and cable-500; `empty` absent.
- C-H-4 (needs OA-02, G): `category=malva-cat-phone-plans` → 4 offers ordered Essential 5GB $25, Plus 20GB $35, Unlimited $50, Unlimited Max $65 (cent amounts 2500, 3500, 5000, 6500, `termMonths` 0); `chip=unlimited` → 2 (Unlimited, Unlimited Max); `chip=data-capped` → 2.
- C-H-5 (needs OA-02, G): `category=malva-cat-home-wireless` → Air Lite $45, Air 5G $55, Air 5G Plus $75 (`termMonths` 12); `chip=lte` → 1; `chip=5g` → 2.
- C-H-6 (needs OA-02, G): `category=malva-cat-add-ons` → includes streaming, protection and equipment offers (descendants); `chip=music` ≥ 2 (Spotify $10, Apple Music $11), `chip=video` ≥ 2, `chip=extras` ≥ 2; every equipment offer has a `oneTime` or `recurring` price.
- C-H-7 (needs OA-02, G): `…&category=malva-cat-cable-internet&chip=nope` → behaves as `all` (3 offers); `…&category=malva-cat-cable-internet&band=lt-25` → `empty: "no-match"`, `offers: []`; `…&category=does-not-exist` → status 404 with `{ "error": { "code": "CATEGORY_NOT_FOUND", "message": "…" } }` (the dev route implements this; the page-level not-found for an unknown slug is N/I).
- C-H-8 (needs OA-02, G): `…/api/dev/catalog?view=offers&locale=de-DE&category=malva-cat-cable-internet` → prices in EUR (`currencyCode: "EUR"`), `label` like `59,99 €`; if the list is empty because G has no EUR prices, record "G: EUR prices missing" in `VERIFICATION-LOG.md` as a failure against G (not H).
- C-H-9 (needs OA-02, G): `…/api/dev/catalog?view=offer&key=malva-offer-cable-500` → one offer, `kind: "base-package"`, `primaryCategoryKey: "malva-cat-cable-internet"`; `…&key=malva-offer-does-not-exist` → `{ "offer": null }`; `…&locale=fr-FR` → status 400 `UNSUPPORTED_LOCALE`.
- C-H-10 (needs OA-02, G, search indexed): `…/api/dev/catalog?view=search&locale=en-US&q=cable` → `total ≥ 3`, includes the three cable offers; `q=zzzz` → `total: 0`; `q=MLV-` + a real SKU from C-H-2 (copy it from `variantTerms` output) → that offer; Network tab: one request to the dev route; no failed requests.
- C-H-11 (needs OA-02, G): production guard: `npm run build && npm run start`, then `http://localhost:3000/api/dev/catalog?view=categories` → 404 (the route must not exist in production builds).

## Manual tests (owner only)
None.

## Excluded
- No product detail route or detail links: `product-detail-page` is superseded (D-052); `discovery-and-browse` lists it under "Pages" only; no scenario in this capability mentions it.
- Entitlement-scoped catalogs (Stores, Product Selections, per-company visibility) from the spec's Components/commercetools sections: not built (D-005, D-058); the catalog is identical for every buyer (Design §1).
- Availability overlay for services (D-019).

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Both scenario rows above have passing tests; mapper, search and cache tests exist as named.
- [ ] `PROJECT-FINDINGS.md` has the `## H — catalog and search reads` section with verified field names.
- [ ] C-H lines present; STATUS set to `Ready for review`.
- [ ] No file outside `lib/ct/**`, `lib/mappers/**` imports an SDK package; no cached function reads the session.
