## 1. Verify platform mechanics

- [x] 1.1 Confirm with the commercetools docs MCP how to restrict Product Search to a product selection (filter field and semantics) and how product selection mode `Individual` is created and assigned; record the answer in design.md D3 [SKILL: commercetools-platform]
- [x] 1.2 Confirm the update action to add a field definition to an existing type (`addFieldDefinition`) and that adding an enum field is allowed on a type in use [SKILL: commercetools-platform]

## 2. Brand registry and URL scheme

- [x] 2.1 Add `lib/brands.ts` (registry, `isBrandSlug`, `DEFAULT_BRAND`, `brandFromParams`) with unit tests
- [x] 2.2 Move `app/[locale]/**` to `app/[brand]/[locale]/**`; validate the brand param (not found otherwise) and pass brand through layout and `generateStaticParams`
- [x] 2.3 Extend `proxy.ts`: `/` and `/{locale}/...` redirect (308) to `/malva-coffee/{locale}/...` keeping query; brand segment continues into the locale and market reconciliation; leave `/api`, `_next` and files alone; add redirect-matrix tests in `proxy.test.ts`
- [x] 2.4 Make `@/i18n/routing` `Link`, `redirect`, `getPathname` brand-aware so call sites keep locale-free hrefs; update sitemap, robots, canonical and hreflang to include the brand
- [x] 2.5 Pass `brand` to the BFF as a validated parameter from SWR hooks and add it to `lib/cache-keys.ts`; update `architecture.test.ts` and lint rules if they pin the old route shape
- [x] 2.6 Keep the in-store companion redirect logic working under `/malva-coffee/...` (`lib/app-mode.ts`, `proxy.instore.test.ts`)

## 3. Brand switcher and theme

- [x] 3.1 Build `BrandSwitcher` (tab style, current brand first, links to the other brand home in the current locale) above the promise bar and header; add messages to both `messages/*.json` with identical keys
- [x] 3.2 Add the drinks palette from `styles.css` to `app/tokens.css` under `[data-brand="malva-drinks"]` using the D7 mapping (semantic overrides plus `--brand-neutral-*`, `--brand-accent-*`, `--brand-accent-2-*` ramps; colours only, no fonts or radii); use the accent-700 step for text and button fills; set `data-brand` on `<html>` in `app/layout.tsx`; extend `tokens.test.ts` for both brands incl. the 4.5:1 pairs
- [x] 3.3 Scope the promise bar, store pill, locale pill and footer content to the brand (no collection promise on drinks) using the registry `pickup` flag

## 4. Brand catalogue scoping

- [x] 4.1 Add `brand` to `SearchContext` and apply the product selection filter in `lib/search/build.ts` per task 1.1; update `build` and `search` tests [SKILL: commercetools-platform]
- [x] 4.2 Scope home products, related products, PDP lookup and sitemap in `lib/ct/{products,home-products,product-detail}.ts` and `lib/related.ts` to the brand selection; other-brand slug returns not found [SKILL: commercetools-storefront]
- [x] 4.3 Replace `getCategoryTree(locale)` with `getCategoryTree(locale, brand)` deriving categories (plus ancestors) from the selection via a no-hits categories facet; brand in the cache key; update header, `MegaMenu`, `MobileNav`, category pages and `lib/category-tree.ts` tests [SKILL: commercetools-storefront]
- [x] 4.4 Make `STATIC_TOP_CATEGORIES` and `mega-config` per brand
- [x] 4.5 Read drinks availability from the brand inventory channel in `lib/ct/inventory.ts` (coffee unchanged); extend `inventory.test.ts` [SKILL: commercetools-storefront]

## 5. Cart: shared cart with brand lines

- [x] 5.1 Add `brand` to the line custom type constants and `addLine`: derive brand from selection membership of the SKU's product, write `custom.fields.brand`, set the drinks `supplyChannel`, write `fulfilment = delivery`; reject `collect` for drinks with `validation_failed` [SKILL: commercetools-storefront]
- [x] 5.2 Fix `fulfilmentOf` and store-channel detection so a brand channel is never treated as collect; default missing `brand` to `malva-coffee`; tests in `lib/mappers/cart` and `cart-order-type.test.ts` [SKILL: commercetools-storefront]
- [x] 5.3 Preserve `brand` in switch-fulfilment, quantity change, market carry-over and reorder (`lib/ct/cart.ts`, `lib/ct/reorder.ts`, `session-reconcile.ts`) with tests
- [x] 5.4 Add `brand` to `CartLine` in `lib/types.ts` and `groups` to `CartView` in `lib/mappers/cart.ts`; order mapper keeps brand
- [x] 5.5 Render brand sections with subtotals in the cart drawer and cart page, current brand first, one total and one checkout; update component tests [SKILL: commercetools-storefront]
- [x] 5.6 Verify checkout and order confirmation with a mixed cart (one shipment, one shipping method, one order) and show brand sections in order summary [SKILL: commercetools-checkout]

## 6. Malva Drinks pages

- [x] 6.1 Add home and PDP variant switch driven by the registry (`HomeSections`, `ProductDetail`)
- [x] 6.2 Build drinks home: hero, four product-line tiles, editorial strip, promise row; messages in both locales
- [x] 6.3 Build drinks PDP: gallery (scraped image URLs, placeholder when none), size options per variant, delivery block, drinks facts row; no collect or subscribe blocks
- [x] 6.4 Hide store pickup UI for drinks across PDP, cart lines (no collect switch) and shell

## 7. Seed

- [x] 7.1 Add `brand` enum field to type `mcf-line-fulfilment` in `seed/src/data/custom-types.ts` (planned type update; no new type) with tests [SKILL: commercetools-platform]
- [x] 7.2 Add `seed/src/data/brands.ts` with selection keys and the drinks channel (key without `mcf-store-` prefix, role `InventorySupply`) [SKILL: commercetools-platform]
- [x] 7.3 Add seed steps `product-selections` and `selection-membership` (all coffee products into the coffee selection, idempotent) [SKILL: commercetools-platform]
- [x] 7.4 Write `seed/scripts/reduce-drinks.ts` (run with `tsx`, args: input path, output path): drop rows with empty name or category, group by distinct (name, size), collect distinct non-empty `Image_URL` values per group in first-appearance order, assign sequential number-only skus from `100001`, reduce `description` HTML to plain text, keep `name` and `size` as plain fields, print counts and fail on duplicate sku; add a vitest with a small fixture (duplicate rows, junk row, empty image, repeated image URLs)
- [x] 7.5 Run the script on `Maison Perrier Sparkling Water Flavors _ Maison Perrier.json` and commit the output `seed/src/data/drinks.json` (expect 28 lines, 16 names, 6 rows dropped)
- [x] 7.6 Add `seed/src/data/drinks.ts`: product type `mcf-drink` (variant text attribute `size`, CombinationUnique), four categories, one product per name with one variant per size line (sku, images from the line), invented US and CA prices per size, tax `mcf-tax-food`, membership in the drinks selection [SKILL: commercetools-catalog-migration]
- [x] 7.7 Add the drinks inventory channel and stock entries on that channel (seed step `drinks-catalog`) [SKILL: commercetools-platform]
- [x] 7.8 Update `reset`, `cleanup`, `verify` and `seed:inventory` for new kinds (product selections) and keys; update `seed/README.md`
- [x] 7.9 Run seed twice against the dev project and confirm idempotency [SKILL: commercetools-platform]

## 8. Verification and docs

- [x] 8.1 `npm run check` and `npm run build` pass in `storefront/`; seed tests pass
- [x] 8.2 Browser pass: both brands' home, PLP, PDP, switcher order, legacy redirects, mixed cart in drawer, cart page, checkout, order confirmation, US and CA
- [x] 8.3 Update demo docs and `storefront/AGENTS.md` (URL scheme, brand registry, "new commercetools resource" rule note) and record open questions Q6 and Q7 in `plans/QUESTIONS.md` with the defaults used
