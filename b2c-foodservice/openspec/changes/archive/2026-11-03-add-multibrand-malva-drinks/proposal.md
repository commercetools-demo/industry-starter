## Why

The storefront sells one brand, Malva Coffee. The business wants a second brand, Malva Drinks (sparkling and flavoured water inspired by Maison Perrier, usable under the Nestlé NDA), on the same codebase, the same commercetools project and the same BFF, with one shared cart, checkout and account. Today brand is not modelled anywhere: all products are visible everywhere, categories are one global tree, and line items only know their fulfilment.

## What Changes

Survey of current commercetools usage (read-only): one `apiRoot` in `storefront/lib/ct/client.ts`; Product Search via `lib/search/build.ts` + `lib/ct/search.ts` (no product selection filter); a global category tree in `lib/ct/categories.ts`; line items typed by `mcf-line-fulfilment` (`fulfilment` enum) in `lib/ct/cart.ts`; stock read from the online entry (no supply channel) and `mcf-store-*` supply channels in `lib/ct/inventory.ts` and `lib/mappers/channel.ts`; seed in `seed/src/` with types in `data/custom-types.ts` and images from `IMAGE_SOURCE_URL` in `images.ts`.

- Add a brand registry (`malva-coffee`, `malva-drinks`) with per-brand product selection key, inventory channel key, theme, pickup flag and home/PDP variant.
- Add product selections: `mcf-selection-malva-coffee` (all current coffee products) and `mcf-selection-malva-drinks` (new products). Product Search and the category list are filtered by the current brand's selection.
- Header navigation renders only categories that have products in the brand's selection.
- **BREAKING**: URLs become `/{brand}/{locale}/...`. `/` and `/{locale}/...` redirect to `/malva-coffee/{locale}/...`. `/api/*` stays unprefixed and shared; brand travels as a request parameter.
- Add a tab-style brand switcher above the header; the current brand is the first tab.
- Add a brand theme layer (colour tokens only; same layout and components) for Malva Drinks, based on `color.html`.
- Add a `brand` field to the existing line-item custom type `mcf-line-fulfilment` (no new types). Cart is shared; the cart drawer and cart page group lines by brand. Existing lines without `brand` count as `malva-coffee`.
- Malva Drinks products stock in their own inventory channel and have no store pickup (delivery only).
- Malva Drinks home page and PDP variants; PLP, cart, checkout and account are shared.
- Seed: put existing coffee products in the coffee selection; create drinks product type, categories, products (French Kiss, Unflavored, Flavored Forever, Chic), selection, inventory channel and stock; extend the line type with `brand`. Drinks data comes from the scraped Maison Perrier JSON, reduced by a script to one line per distinct (name, size) with its image URLs and an arbitrary numeric sku. No image seeding: the scraped image URLs are used as they are.
- Drinks theme colours come from `styles.css` (colours only).

## Capabilities

### New Capabilities
- `multibrand-routing-and-switcher`: brand registry, `/{brand}/{locale}` URLs, default redirects, brand switcher tabs, brand-aware shared links.
- `brand-catalog-scoping`: per-brand product selection applied to Product Search, category list and navigation; per-brand inventory channel.
- `malva-drinks-storefront`: Malva Drinks home page and PDP, no-pickup rule, brand content.
- `multibrand-seed`: seed for selections, drinks catalogue, channel, stock, images and the `brand` field.

### Modified Capabilities
- `cart-management`: line items carry `brand`; one cart across brands; fulfilment derivation must not treat the brand channel as a store.
- `cart-page`: lines grouped by brand with per-brand subtotals.
- `fulfilment-and-availability-model`: brand inventory channel is not a collection store; drinks are delivery only.
- `design-tokens-and-components`: per-brand colour token layer.
- `design-storefront-shell`: switcher above the header; navigation scoped to the brand.

## Impact

- Storefront: `proxy.ts`, `i18n/routing.ts`, `app/[locale]/**` moves under `app/[brand]/[locale]/**`, `app/layout.tsx`, `app/tokens.css`, `components/layout/*`, `components/home/*`, `components/pdp/*`, `components/cart/*`, `lib/search/build.ts`, `lib/ct/{search,categories,cart,inventory,products}.ts`, `lib/mappers/{cart,category,channel}.ts`, `lib/types.ts`, `lib/cache-keys.ts` (brand in keys), sitemap, robots, SEO canonical/hreflang, `messages/*.json`, tests.
- Seed: `seed/src/data/{custom-types,stores,products,categories,product-types}.ts`, new `data/drinks.ts` and generated `data/drinks.json`, new `seed/scripts/reduce-drinks.ts`, `seed.ts` steps, `reset`/`cleanup` (new keys keep the `mcf-` prefix). `images.ts` is untouched.
- commercetools project: new product selections, one inventory channel, new product type, categories, products, `brand` enum field added to an existing type.
- Out of scope: new CT project, new API client, per-brand checkout/orders, per-brand customers, store pickup for drinks, French content, the in-store companion for drinks (stays coffee-only), image seeding, Maison Perrier fonts/radii (colours only).
