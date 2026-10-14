## Context

The storefront is multi-tenant by path: `/{locale}/{store}/...`. `app/[locale]/page.tsx` calls `notFound()`, and `proxy.ts` resolves the first segment after the locale as a store key and writes the store fields into the session. Everything reseller-facing assumes a store: `getNavCategories(storeId)` keeps a root category only if the store has products in it, the product search always carries `exact('stores', storeId)`, and cards show price, stock, branch city and Add to cart.

Facts found in the code and seed (read-only):

- Reseller address and coordinates already exist as `store-settings` custom fields (`addressLine`, `postalCode`, `city`, `latitude`, `longitude`), and branches are channels with `address` and `geoLocation` (`seed/src/data/org.ts`). The finder needs no new seed data for its list.
- `components/store-picker` already has `BranchList`, `BranchRow`, `BranchMap` and `map-config`, and a test that forbids the browser from geocoding directly (`no-direct-geocoder.test.ts`).
- Banner images for resellers live in a custom object under the site container; the Image source fetch has been a blocker (OA-03) and uses the `_next/data` GET with clean URLs.
- The commercetools Product Search API supports a query with no `stores` clause, so a whole-catalog listing is a smaller query than the reseller one, not a new mechanism.

Decision assumed for this proposal (the owner had not answered when the change was written): choosing a reseller from a card opens the same product at that reseller (option A).

## Goals / Non-Goals

**Goals:**
- A Malva-level home, listing and finder that need no store, cart or account session.
- One finder component used inline and in a drawer.
- No price, stock or PDP at Malva level, enforced by the card component, not by hiding it with CSS.
- No change to any reseller page or to the store resolution rules except the locale root and the reserved segment.

**Non-Goals:**
- A Malva PDP, cart, account, checkout or Contentools-editable Malva pages.
- Remembering the chosen reseller between visits.
- Checking that a product is in the chosen reseller's assortment before navigating.
- A new map provider or a new geocoder.

## Decisions

**D1. Routes.** `app/[locale]/page.tsx` becomes the Malva home. The Malva listing is a static segment `app/[locale]/categories/[slug]/page.tsx`. Next resolves a static segment before the `[store]` dynamic one, so `/en-US/categories/brakes` never reaches store resolution. `categories` is added to the reserved segments in `proxy.ts` (skip store resolution) so the session is not written, and a test pins that no store may use the key `categories`. Alternatives: a `/malva/...` prefix (longer, and it still needs a reserved word) and a route group with its own layout (the layout is needed anyway, see D2, but the group does not remove the reserved word).

**D2. Separate layout.** Malva pages use their own layout `app/[locale]/(malva)/layout.tsx` inside a route group, so the reseller `[store]` layout (utility bar, store chip, cart, garage, impersonation banner) is not rendered. Malva gets `MalvaHeader`, `MalvaFooter` and the finder drawer host. The reseller layout is not touched.

**D3. Whole-catalog queries.** Two new functions in `lib/ct/malva-catalog.ts`: `getMalvaNavCategories(locale)` (root categories with at least one published product, cached 5 minutes like `getNavCategories`, using the same facet-then-search fallback without the `stores` clause) and `searchMalvaProducts(params)` (the listing query without `stores`, prices or inventory expansions). The existing `buildSearch` is reused with the store scope made optional rather than copied, and a test pins that a Malva query contains no `stores`, `price` or `inventory` clause. Alternative: filter the reseller query by "any store"; rejected because it still pulls store-scoped data and ties the page to the store list.

**D4. Card without commerce data.** A new `MalvaProductCard` renders image, brand, name, part number and `FitBadge`, and a `Select a reseller` button. It is a different component from `ProductCard`, not a prop of it, so a price or stock line cannot appear by a flag mistake. It has no `Link`. The product summary mapper used for it drops price and availability fields (`mapMalvaSummary`), so the data is never sent to the browser.

**D5. Finder data and API.** `lib/ct/resellers.ts` exports `listResellers()`: reads all stores (frontend client, `view_stores` is already a listed scope), keeps those with a distribution channel, reads each store's `store-settings` fields and branch channels through the existing store mapper, and returns `{ key, name, city, postalCode, address, lat, lng, branches: [{ key, name, city, lat, lng }] }`. It is cached 60 seconds like `getStoreContext`. A route `GET /api/resellers` returns it for the client finder; it needs no session, is read-only, rate-limited like other public GETs, and returns no channel or selection ids. The list is small (tens of resellers), so filtering and distance sorting run in the browser; the cached payload is the same for everyone. Alternative: server-side search per keystroke; rejected as unnecessary for this size.

**D6. Finder component.** `components/malva/ResellerFinder` takes `mode: 'inline' | 'drawer'` and `productSlug?: string`. It reuses `BranchMap` and the distance helper from the store picker and renders reseller rows (not `BranchRow`, whose copy is about pickup hours). Search matches postal code prefix or city (case and diacritics insensitive). "Use my location" calls the browser geolocation API only after a click; geocoding of a typed postal code uses the existing app geocode route, never a direct call (the existing `no-direct-geocoder` test is extended to the new folder). Each row links with `href` built from the locale, store key and (when present) product slug, validated against the key and slug patterns before it is rendered.

**D7. Drawer.** `FinderDrawerProvider` (client context) holds `open`, `productSlug` and the opener element. It renders one drawer for the page. The drawer is a `role="dialog"` with `aria-modal`, focus trap, scrim, Escape, and a `translate-x` transition that is disabled under `prefers-reduced-motion`. It is a full-width sheet under the narrow breakpoint. The existing store picker modal is not reused because its layout (two columns, 1100 px) and purpose (branches of one reseller) differ.

**D8. Banners.** The seed writes a Malva banner object (container `malva-site`, key `home-banners`) with at least three entries `{ headline, subline, categorySlug, image }`. Images are recorded by the existing images step from Image source, using clean URLs; when the Image source fetch is blocked the seed falls back to the placeholder images used for reseller banners, and the manual-test row records which was used. The carousel is a client component with a server-rendered first slide, pause on hover and focus, and no autoplay under reduced motion.

**D9. Theme and fonts.** Malva uses the default theme tokens (`app/tokens.css`), not a Contentools reseller theme. No `store-theme` style is injected. Only tokens are used for colour, spacing and type.

**D10. Not-found.** The not-found page's home link goes to `/{locale}`; with D1 that is now the Malva home. The "No store segment" scenario in `bootstrap-and-structure` is changed by this change's delta.

## Risks / Trade-offs

- [`categories` collides with a future store key] → reserved word in `proxy.ts`, a seed test and a note in the bootstrap spec; store keys are `mau-`-prefixed.
- [Whole-catalog search shows parts no reseller sells] → accepted: the finder sends the shopper to a reseller who may not stock it; the reseller not-found page is the fallback. Revisit with a "sold by N resellers" count if wanted (open question).
- [Image source blocked again] → fallback to placeholder images; the carousel and tests do not depend on real images.
- [Duplicated card and listing code between reseller and Malva] → `ProductGrid`, `Pagination`, `SortSelect` and `ResultHeader` are reused; only the card and the data functions are new.
- [Geolocation prompts] → only after a click, and the page works without it.
- [Public `GET /api/resellers` exposes reseller names and addresses] → these are already public on each reseller's site; no ids or internal keys beyond the store key (already in the URL).

## Migration Plan

No data migration. Deploy with the storefront; `/{locale}` changes from 404 to the Malva home. Rollback is reverting the route and layout files; reseller routes are untouched. The seed step for banners is additive and idempotent.

## Open Questions

- Should the chosen reseller be remembered (cookie) so a returning visitor skips the finder? (Left out of scope.)
- Should the Malva listing show how many resellers sell a product, so a card can say "Sold by 2 resellers"?
- Does Malva want its own logo and favicon distinct from the default theme's?
