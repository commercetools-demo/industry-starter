## Context

One Next.js 16 storefront (`storefront/`), one commercetools project, one `apiRoot`, one BFF (`app/api/*` → `lib/ct/*` → commercetools). Routes live under `app/[locale]/` with `localePrefix: 'always'`; the proxy reconciles the market (session and `malva-locale` cookie) from the locale segment. Search is Product Search only; categories come from one cached global tree; a line item carries `custom.fulfilment` (type `mcf-line-fulfilment`), and `fulfilmentOf()` falls back to `collect` when a line has a `supplyChannel`. Store channels are `InventorySupply` channels filtered by the `mcf-store-` key prefix in the mapper.

Malva Drinks reuses all of this. It differs in: catalogue (own product selection), stock location (own inventory channel), theme (colour tokens), home and PDP, and delivery-only fulfilment.

## Goals / Non-Goals

**Goals:**
- Two brands, one codebase, one BFF, one cart, one checkout, one account.
- Brand is decided by the URL; catalogue, navigation, theme and pickup rules follow from it.
- No new custom types; extend `mcf-line-fulfilment` with a field.
- Adding a third brand later is a registry entry plus seed data, not a refactor.

**Non-Goals:**
- Separate CT projects, API clients, stores or orders per brand.
- Per-brand customers, prices logic or promotions (shared; revisit later).
- Store pickup for Malva Drinks; the in-store companion for Malva Drinks.
- Pixel-copying Maison Perrier assets. Style inspiration only; imagery comes from the owner's image source.

## Decisions

### D1. Brand registry as the single source
`lib/brands.ts` exports `BRANDS` keyed by slug (`malva-coffee`, `malva-drinks`) with: `productSelectionKey`, `inventoryChannelKey` (undefined for coffee: it keeps the online entry plus store channels), `pickup: boolean`, `home` and `pdp` variant ids, `theme` id, and display name. `isBrandSlug()` mirrors `isLocaleKey()`. Everything else reads this file.
*Alternative:* env-driven config. Rejected: brands are code-level variants (components differ), not deployment settings.

### D2. URL: `/{brand}/{locale}`, route group moved to `app/[brand]/[locale]/`
The proxy gains a brand step before the locale step:
- `/` → `/malva-coffee/{cookie or default locale}`; `/{locale}/rest` → `/malva-coffee/{locale}/rest` (308 for legacy links, keeps query).
- First segment a brand → continue to existing locale logic on the second segment. Unknown first segment → not found.
- `/api/*`, `_next`, files: unchanged. Brand reaches the BFF as a `brand` query/body parameter validated with `isBrandSlug`, defaulting to `malva-coffee`; never trusted for anything but catalogue scoping.
`next-intl` routing: keep `localePrefix: 'always'` and mount the locale segment under `[brand]`; `@/i18n/routing` `Link`/`redirect` wrappers read the brand from params so call sites keep passing locale-free hrefs. `getPathname` and sitemap/hreflang include the brand.
*Alternative:* brand as subdomain or cookie. Rejected by the requirement (path schema); a cookie also breaks shareable URLs and SEO.

### D3. Product selection drives catalogue
- Two product selections (mode `Individual`): `mcf-selection-malva-coffee`, `mcf-selection-malva-drinks`. Seed adds every existing coffee product to the first and every drinks product to the second.
- Product Search requests add the brand selection as a query filter (and PDP/related/home product reads go through search or verify membership), so a drinks SKU is not reachable on a coffee URL and vice versa (PDP of the other brand → 404 on that brand, with the brand switcher offering the other tab).
- Confirmed in the Product Search docs ("Filter by Store and Product Selection"): add `{ "exact": { "field": "productSelections", "value": "<selection id>" } }` to the query. The value is the selection **id**, so the BFF resolves key → id once (cached) from `product-selections/key=...`. Selection mode `Individual`, products added with the `addProduct` action. Type change: `addFieldDefinition` is a documented Type update action. The request builder takes `brand` in `SearchContext`, so only `buildSearchRequest` changes.
- Cache keys (`cachedPublic`) gain the brand segment so brands never share a cached tree or list.

### D4. Navigation categories derived from the selection
Categories are not directly bound to a selection. The category tree for a brand is: categories that appear on at least one product in the brand's selection (a search facet on `categories` with the selection filter, no hits) plus their ancestors, built into the same tree shape. Header, mega menu, mobile nav and category pages read `getCategoryTree(locale, brand)`. Drinks get their own category subtree (Sparkling, Flavoured, Chic, ...), so there is no overlap with coffee categories in practice.
*Alternative:* a `brand` list field on the category type. Rejected as default (manual upkeep, drift from selection); kept as fallback if the facet approach proves too slow (cached 60 s already).

### D5. Cart: shared cart, brand on the line item
- Reuse custom type `mcf-line-fulfilment`: add enum field `brand` (values `malva-coffee`, `malva-drinks`) via an `addFieldDefinition` update in the seed (types step already plans type updates). Do not create types.
- `addLine` sets `custom.fields.brand` from the validated brand of the product (derived server-side from selection membership, not from the client-sent value).
- Drinks lines also set `supplyChannel` to the drinks inventory channel so stock is reserved there. To prevent the existing "has `supplyChannel` ⇒ collect" fallback from misclassifying them, `fulfilmentOf()` always uses the custom field first (already the case) and the fallback only treats a channel as collect when it is a store channel (`mcf-store-` key / not a brand channel). Drinks lines are written with `fulfilment = delivery`.
- Missing `brand` on a line (older carts) is read as `malva-coffee`.
- UI: `mapCart` exposes `brand` per line and `groups: {brand, lines, subtotal}[]`; drawer and cart page render one section per brand, current brand first. One cart total, one checkout, one order; the order lines keep the brand custom field for reporting.
- Shipping: `CART_SHIPPING_MODE` stays `Single`. A mixed cart ships as one delivery shipping method. Decided by the owner: one shipment for a mixed cart.
- Market carry-over, reorder, subscribe and recurring flows copy `brand` with the line. Subscriptions remain coffee-only (drinks PDP has no subscribe block).

### D6. Inventory channel per brand
`mcf-channel-malva-drinks` (`InventorySupply`, own key without the `mcf-store-` prefix so the store mapper ignores it). Drinks inventory entries are created with this `supplyChannel`. `getInventoryDetail` resolves the `ship` state of a drinks SKU from the brand channel entry instead of the entry with no channel. Coffee behaviour is unchanged.
Assumption: the brief's "inventory channel on the line item → custom field → brand" is read as: the line's brand is stamped into the `brand` custom field, and for drinks that matches the line's supply channel. The custom field is the source of truth for the UI; the channel is for stock.

### D7. Theme: colour tokens only, values from `styles.css`
`app/tokens.css` stays the single hex file. Add `[data-brand="malva-drinks"]` overrides of the existing semantic tokens so every component restyles with no code change; `<html data-brand>` is set in the root layout from the URL brand. Only colours are taken from `styles.css`; its fonts (Barlow), radii and square "blueprint" frame are NOT adopted (same design, different colour tokens).
Mapping (storefront token ← `styles.css`): `--canvas` ← `--color-bg` #f2f2f3; `--canvas-2` ← `--color-neutral-100` #f5f5f8; `--surface` ← `--color-surface` #e9e9ea; `--ink` ← `--color-text` #1d1f20; `--ink-2` ← `--color-neutral-700`; `--ink-3` ← `--color-neutral-600`; `--line` ← `--color-neutral-300`; `--line-2` ← `--color-neutral-200`; `--accent` ← `--color-accent` #5980a6; `--accent-press` ← `--color-accent-700` #416180; `--teal` family (secondary accent) ← `--color-accent-2-*` ramp; focus ring and overlay derive from them as today. The neutral, accent and accent-2 ramps 100–900 are added verbatim as `--brand-neutral-*`, `--brand-accent-*`, `--brand-accent-2-*` for components that want a ramp step.
Contrast check: #5980a6 on #f2f2f3 is about 3.9:1, below 4.5:1 for small text. Components use `--accent` both as text and as a fill under light text, so the drinks block maps `--accent` to the 700 step (#416180, 5.3:1) and `--accent-press` to the 800 step (#2c455d); the 600 step (#597ea3, close to the brand's #5980a6) stays in the `--brand-accent-*` ramp for graphics. `tokens.test.ts` asserts the contrast pairs for both brands.

### D8. Home and PDP variants, everything else shared
`HomeSections` and `ProductDetail` pick a variant from the registry. Drinks home: hero, four product-line tiles (French Kiss, Unflavored, Flavored forever, Chic), editorial strip, promise row (no collection promise). Drinks PDP: gallery, flavour/pack-size options, delivery block only (no `CollectBlock`, no `SubscribeBlock`), facts row for drinks (volume, sparkling, ingredients). PLP, search, cart, checkout, account, order pages are the same components, fed by the brand context.

### D9. Pickup off for drinks
Registry `pickup: false` hides the store pill, collect option, collection promise and `CollectBlock` for the brand, and `addLine` rejects `fulfilment: 'collect'` for a drinks product with `validation_failed`. In a mixed cart the store pill/picker still shows (coffee lines can be collected) on coffee URLs only.

### D10. Seed
Idempotent, `mcf-`-prefixed, reusing the existing `upsert` and `plan*Update` helpers. New steps: `product-selections`, `selection-membership` (coffee products into the coffee selection), `drinks-catalog` (product type `mcf-drink`, categories, products, channel, inventory) and an extended `types` step (add `brand`).
**No image seeding.** Drinks images are the absolute URLs already in the scraped data; they are written as variant `images` with their URL as is (no recorded-images file, no `IMAGE_SOURCE_URL` call for drinks). `images.ts` is unchanged.
`reset`, `cleanup`, `verify` learn the new keys.

### D11. Drinks source data: reduce, then seed
Source: `Maison Perrier Sparkling Water Flavors _ Maison Perrier.json` at the repo root (841 rows, keys `category`, `name`, `size`, `description`, `Image_URL`). Observed: the rows differ only in `Image_URL`; there are 29 distinct (name, size) pairs; 6 rows are a junk "Browse Maison Perrier® Products" link with an empty category; one pair (Strawberry, 11.15 fl oz Can) has no image; the four Unflavored bottle/can pairs repeat 150+ rows but hold only 8 distinct URLs; `description` is HTML with inline styles and 17 distinct values; `Image_URL` carries an `itok` cache-busting query string.
A deterministic script `seed/scripts/reduce-drinks.ts` (run with `tsx`, input and output paths as arguments, never imported by the seed at runtime) reads the source and writes `seed/src/data/drinks.json`:
- one object per distinct (name, size) pair, in first-appearance order: `{ sku, category, name, size, description, images }`; `name` and `size` stay plain top-level fields (no combined key field);
- `images` is the ordered list of distinct non-empty `Image_URL` values of that pair (query string kept as scraped);
- `sku` is an arbitrary number-only string, sequential from `100001` in output order (stable across runs because the order is);
- junk rows (empty `name`/`category`) are dropped and counted; `description` is reduced to plain text paragraphs (tags, style attributes and the duplicate marketing boilerplate whitespace removed);
- the script prints counts (rows in, rows dropped, lines out, lines without images) and fails if two lines share a sku.
The seed then maps lines to CT: one product per distinct `name` (slug from the name), one variant per size line with its sku, `drinkSize` as a text variant attribute (not `size`: an attribute name has one type project-wide and the in-store drinks use `size` as an enum), images from `images`, category from `category` (four categories: French Kiss, Unflavored, Flavored Forever, Chic), prices invented per size (pack count and volume scale the price; CAD derived like the rest of the seed), tax `mcf-tax-food`, in the drinks selection, stock on the drinks channel. Lines without images (Strawberry) get no images and the shared placeholder renders.
*Alternative:* seed straight from the 841 rows. Rejected: 97% duplicates and non-deterministic ordering.

## Risks / Trade-offs

- [URL move touches every route and test] → move with a codemod-style rename, keep `Link` wrappers brand-aware, run `npm run check`; add proxy tests for the redirect matrix.
- [Product Search selection filter semantics unverified] → task 1.1 confirms before implementation; fallback is filtering ids through the selection's products endpoint (slower, cached).
- [Facet-derived categories hide empty categories incl. ones with only out-of-selection products] → intended; covered by scenario tests.
- [Channel-based `collect` fallback regression] → explicit unit tests for drinks lines in `fulfilmentOf`, switch-fulfilment and reorder.
- [Brand parameter spoofing on `/api`] → brand is only a scoping hint; add-to-cart derives brand from the SKU's selection membership.
- [Mixed cart: shipping, free-shipping threshold, discounts are cart-wide] → owner decided one shipment, one shipping method, cart-wide threshold and discounts.
- [Drinks accent #5980a6 fails 4.5:1 as text on the light background] → text and button fills use the 700 step in the drinks block; contrast test enforces it.
- [Scraped copy and imagery are Maison Perrier's] → covered by the Nestlé NDA per the brief; data stays in the seed, not in UI strings.
- [Scraped image URLs are third-party (goodnes.com) and may expire or block hotlinking] → URLs live only in `drinks.json`; PDP and PLP fall back to the placeholder on load error; owner can later re-host.

## Migration Plan

1. Run seed (types update, selections, membership, drinks data). Idempotent and additive.
2. Deploy storefront. Legacy URLs 308 to `/malva-coffee/...`, so bookmarks and the in-store companion links keep working. Existing carts keep working (lines without `brand` = coffee).
3. Rollback: redeploy the previous storefront build; the seed changes are additive (extra enum field, extra resources) and harmless to the old build.

## Open Questions

Resolved by the owner: Q1 palette = `styles.css` (colours only); Q2 mixed cart = one shipment; Q3 same markets and tax category; Q4 prices invented, product data from the scraped file; Q5 no in-store companion for drinks.

- Q6. Drinks wordmark/logo: default is the text wordmark "Malva Drinks" in the existing heading font.
- Q7. Are the scraped Image_URLs acceptable to hotlink in the demo, or should they be re-hosted? Default: hotlink.
