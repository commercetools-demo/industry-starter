# O-00: real names O imports

| Need | Real name and path |
| --- | --- |
| Product Search wrapper | `searchProducts(ctx, scope, params, { limit, withFacets })` in `lib/ct/search.ts` (ids only); `ctx` is `{ locale, currency, country, storeChannelId? }` (`lib/search/build.ts`) |
| Parsed filters | `parseListingParams(sp, scope)` and `listingHref(path, params, scope)` in `lib/search/params.ts`; facet `collection` accepts `bestseller`, `new`, `limited-edition`, `subscribable` (`lib/search/facet-config.ts`, `COLLECTION_VALUES`); the badge facet maps to `variants.attributes.badge.key`, subscribable to `variants.attributes.subscribable` (no gap, no change to G needed) |
| Collect filter | URL param `avail=1` (`ListingParams.avail`), applies only when a store is chosen |
| Cards from ids | `getListingProjections(ids, ctx)` in `lib/ct/products.ts` returns `ProductSummary[]` with the shopper's price, in search order. Not cached |
| Card and grid | `components/product/ProductCard.tsx` (client), `components/listing/ProductGrid.tsx` (`wide` gives four columns) |
| Category tree | `getCategoryTree(locale)` in `lib/ct/categories.ts` (cached 60 s); `Category` has `key`, `name`, `slug`, `imageUrl?` (`lib/types.ts`) |
| Store by key | `getChannelByKey(key, locale)` in `lib/ct/channels.ts` (from the cached channel list); `getStoresForCountry(country, locale)` |
| Promise figures | `getPromiseFigures(market, collectionStoreKey)` in `lib/ct/promise.ts` returns `{ freeShippingThreshold: Money or null, collectionMinutes: number or null, returnDays }` (note: not `getPromiseFigures()` without arguments) |
| Picker | `useCollectionStore().open()` in `hooks/useCollectionStore.ts` |
| Session | `getSession()` in `lib/session.ts` (invalid token gives `{}`) |
| Glow and glass utilities | none exist in `app/*.css`; O adds `hero-glow` style via arbitrary values built from tokens in the components |
| Steps atom | `components/ui/Steps.tsx` is a horizontal wizard (client); the subscribe strip uses three small cards instead |
| Metadata | `pageMetadata` in `lib/content/seo.ts`; JSON-LD `components/content/JsonLd.tsx`; `siteOrigin()` |
| Listing routes | `/shop`, `/category/<slug>`, `/search`; product page `/p/<slug>/<sku>` |

Seed (mock server fixtures and `seed/src/data`): four root categories `mcf-cat-pods`, `-coffee`, `-machines`, `-accessories` (plus `-gifts`). Category images are not seeded in the fixtures (placeholder tiles); badges `bestseller` and `new` exist in the fixtures (read-back in `readback.md`).
