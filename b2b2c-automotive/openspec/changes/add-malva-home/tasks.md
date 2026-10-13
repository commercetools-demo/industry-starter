## 1. Routing and layout

- [x] 1.1 Add `categories` to the reserved segments in `storefront/proxy.ts` (no store resolution, no session write) and a test that `/{locale}/categories/x` leaves the session untouched
- [x] 1.2 Create route group `app/[locale]/(malva)/` with its own layout (Malva header, footer, drawer host, default theme, no store/cart/garage/impersonation) and move `app/[locale]/page.tsx` into it as the Malva home
- [x] 1.3 Add `app/[locale]/(malva)/categories/[slug]/page.tsx` with `loading.tsx` and `error.tsx`; unknown slug answers not-found
- [x] 1.4 Point the not-found page's home link at `/{locale}`; update its test
- [x] 1.5 Seed test: no store key equals `categories`

## 2. Whole-catalog data

- [x] 2.1 Make the store scope optional in `lib/search/build.ts` and add tests that a Malva query has no `stores`, price or inventory clause [SKILL: commercetools-storefront]
- [x] 2.2 Add `lib/ct/malva-catalog.ts`: `getMalvaNavCategories(locale)` (facet, then search fallback, 5 minute cache, stale on error) and `searchMalvaProducts(params)` with `mapMalvaSummary` (no price, no availability) [SKILL: commercetools-storefront]
- [x] 2.3 Unit tests for both functions with the SDK mocked: empty category dropped, outage serves stale, summary has no price field

## 3. Reseller finder data

- [x] 3.1 Add `lib/ct/resellers.ts` `listResellers()` (active stores with a distribution channel, store-settings address fields, branch channels, 60 second cache, no ids in the result) [SKILL: commercetools-storefront]
- [x] 3.2 Add `GET /api/resellers` (no session, same public-GET rate limit and method gate as other public routes) and register it in the route policy
- [x] 3.3 Tests: store without distribution channel is dropped, payload has only the listed fields, route answers 405 for POST

## 4. Components

- [ ] 4.1 `MalvaHeader` (wordmark, category nav, Find your reseller button, locale switch, no cart/account/store chip) and `MalvaFooter`
- [ ] 4.2 `BannerCarousel` (server first slide, controls, pause on hover/focus, no autoplay under reduced motion, text-only fallback when an image is missing)
- [ ] 4.3 `ResellerFinder` with `mode` and `productSlug`: search by postal code or city (diacritics-insensitive), Use my location on click only, distance sort, map via `BranchMap`, rows linking to `/{locale}/{store}` or `/{locale}/{store}/p/{slug}` with key and slug validated
- [ ] 4.4 `FinderDrawerProvider` and drawer: focus trap, Escape, scrim, return focus, side transition off under reduced motion, full-width on narrow screens
- [ ] 4.5 `MalvaProductCard` (image, brand, name, part number, fit badge, Select a reseller, no link, no price, no stock) and a Malva listing using `ProductGrid`, `Pagination`, `SortSelect`, `ResultHeader`, brand filter, loading, empty and error states
- [ ] 4.6 Category tiles for the home page
- [ ] 4.7 Component tests for each, including: card has no price/stock/Add to cart/link, drawer opens from a card with the slug and from the header without, Escape returns focus, reduced motion, location refused message
- [ ] 4.8 Extend `no-direct-geocoder.test.ts` to cover `components/malva`

## 5. Messages and copy

- [ ] 5.1 Add every new string to `en-US` and `de-DE` message files (header, banners, finder, drawer, card, listing states, not-found link) and keep the message parity test green

## 6. Seed

- [x] 6.1 Add the Malva banner object (container `malva-site`, key `home-banners`, three or more entries) to the seed content step, idempotent and in the reset and cleanup allow-lists [SKILL: commercetools-commerce-patterns]
- [x] 6.2 Record banner images through the images step from Pexels with clean URLs; fall back to placeholders when blocked, and note which was used in the manual-test row
- [x] 6.3 Seed tests: second run reports 0 changes, reset removes the object

## 7. Specs, plans and checks

- [ ] 7.1 Register the three new specs in `plans/DEPENDENCY-PLAN.md`, add workstream and manual-test rows (finder, drawer, listing, banners, keyboard), and run `node plans/verify-plan.mjs --sync --strict`
- [ ] 7.2 Run `npm run check` in `storefront` and `seed`, and `npm run build` in `storefront`
- [ ] 7.3 Check in the browser (Chrome MCP, already running dev server): home, category listing, drawer from a card and from the header, both locales, narrow viewport; record results in the manual-test rows
- [ ] 7.4 At archive: close the "cross-reseller locator" note in `design-store-picker` Gaps and update `plans/MISSED-FEATURES.md` row C
