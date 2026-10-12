<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream K: Home page (Puck)

**Depends on:** H (Contentools reads, theme adapter, `ContentoolsPage`), I (shell, pickup logic, `getNavCategories`), J (`VehicleFinderCard`, `getActiveVehicle`, `fitScope`).
**Parallel with:** L. K tasks K-01 to K-05 and K-07 to K-10 do not need L. Task K-06 (popular products) needs L-03 to L-07 merged (`searchParts`, `getListingProjections`, `mapProductSummary`, `ProductCard`); if L is not merged yet, do K-07 to K-10 first and come back to K-06 (never idle, never duplicate L's files).
**Implements:** `cs/design-home-page` (primary).
**Skills:** `commercetools-storefront` (`core/add-page.md`, `core/data-loading.md`, `core/performance.md`), `commercetools-platform`, and the Contentools reference `/Users/behnam/code/b2b2c-starter/.claude/skills/integrate-contentools/SKILL.md` with `/Users/behnam/code/b2b2c-starter/customer/components/home/PuckRenderClient.tsx`.
**Apps and paths:** everything below lives in `b2b2c-automotive/storefront/`. Run commands from that directory.

## 1. Goal

The home page of each reseller store renders its published Contentools Puck page, built from registered automotive blocks (hero with vehicle finder, category tiles, popular products, promo banner, brand strip). When the store has no published home page, a default layout with the same blocks in the design's order renders. Data-driven blocks (pickup promise, tiles, popular products) are fetched on the server once and handed to the blocks through a context, so the page renders without client fetches for its own content.

## 2. Specs and requirements implemented

| Id | Spec path | Requirement title |
| --- | --- | --- |
| K-R1 | `openspec/specs/consumer-storefront/design-home-page/spec.md` | Vehicle-first hero (scenarios: Pickup promise reflects the store, Returning shopper with a saved vehicle) |
| K-R2 | same | Shop by category (scenario: Tile count follows assortment) |
| K-R3 | same | Popular products at this store (scenarios: Stock badge, Fitment on the home page) |
| K-R4 | same | Reseller-controlled content blocks (scenario: Promo banner) |

Context: `bootstrap-and-structure` requirement "Contentools reads and the same-origin proxy" (published page read, `ContentoolsPage`, fallback children) and "Directory structure"; `theming-design`; `design-vehicle-finder-and-garage`.

## 3. Design decisions already taken

| # | Decision | Source |
| --- | --- | --- |
| D1 | Hero, finder, category tiles and popular products are registered automotive Puck blocks; a default layout renders when no home page is published. | `design-home-page` K-R4 |
| D2 | The storefront reads the published page with a plain `fetch` in a Server Component (`POST {origin}/service/{storeKey}/published/puck-pages/query`, body `{ query: 'slug = "<slug>"' }`, header `x-project-key`), React `cache()`, `import type` only from Puck packages. | `bootstrap-and-structure` "Contentools reads" |
| D3 | Home slug is `home`. The page is looked up for the store key from the URL path (the Contentools namespace is the store key; Contentools itself falls back to `default`). | `theming-design` "One theme per reseller store"; this plan |
| D4 | The hero's finder card is the same `VehicleFinderCard` as the standalone Finder block. | J |
| D5 | With an active vehicle, popular products are only products that fit (fit-only, same as the listing). | design.md decision 5; `design-home-page` K-R3 ("or non-fitting ones are labelled and not offered") |
| D6 | "Popular" is a **seeded rank** (owner answer Q-L01): the number attribute `popularity-rank` (1 is the most popular, absent means not ranked). **The seed does not have this attribute yet** (`seed/src/data/product-types.ts` lacks it): it is a seed request (section "Seed requests" below, `plans/notes/seed-requests.md`); until the seed has it, the sort is a no-op ordering by name and K-06's rank tests use fixtures. The home page shows the top N ranked products of the store (4 to 8, default 8), sorted by rank ascending, unranked last. There is no sales analytics. | owner-answers Q-L01; `design-home-page` K-R3; L D10 |
| D7 | Server-fetched home data reaches blocks through `HomeDataContext`, never through client fetches. | this plan; `design-home-page` ("without client fetch for the page itself") |
| D8 | Block props are described in a framework-free file (`lib/puck/automotive-blocks.schema.ts`) so the portal (workstream U, no shared workspace) can copy it to register the same blocks in its Contentools editors. | `bootstrap-and-structure` "Gaps and decisions" (copied, not packaged); Q-K01 |
| D9 | Finder card offers plate and VIN through J's tabs when enabled; the hero never calls a lookup itself. | `design-home-page` Gaps |
| D10 | Rendering the Puck document: try server rendering first; if the build or serverless trace fails on `isomorphic-dompurify`/jsdom (the reference app hit this), load the renderer with `next/dynamic` and `ssr: false` as the reference does. Either way the page JSON is fetched on the server and passed as props (no client fetch for the page). **The client-only fallback is allowed by the owner (Q-H02; Q-K02 follows it)**: no owner acknowledgement is needed, reuse H's `plans/evidence/H/spike-ssr.md` and record the mode in `plans/evidence/K/render-mode.md`. | `bootstrap-and-structure` scenario "Published page"; reference `PuckRenderClient.tsx` |
| D11 | Design strings (from `Reseller Storefront.dc.html`): label "OEM parts · Fit guaranteed", H1 "Genuine parts from {reseller}, ready near you.", line "Pick up in {city} today or have it shipped.", button "Shop all parts", finder title "Find parts for your vehicle", section titles "Shop by category" and "Popular at {reseller}", link "View all ›". They become message keys in both catalogs; the prototype's business names never appear. | design export; design.md section 9 |

## 4. Block contract (`lib/puck/automotive-blocks.schema.ts`, no React, no Puck runtime imports)

```ts
export const AUTOMOTIVE_BLOCKS = ['AutomotiveHero', 'VehicleFinder', 'CategoryTiles', 'PopularProducts', 'PromoBanner', 'BrandStrip'] as const;
export interface AutomotiveHeroProps { eyebrow: string; headline: string; supportingLine: string /* may contain {city} and {pickup} */; ctaLabel: string; ctaHref: string; imageUrl?: string; showFinder: boolean }
export interface VehicleFinderProps { title: string }
export interface CategoryTilesProps { title: string; viewAllLabel?: string }
export interface PopularProductsProps { title: string; count: number /* 4..8 */; viewAllLabel: string }
export interface PromoBannerProps { title: string; text: string; ctaLabel?: string; ctaHref?: string; tone: 'brand' | 'accent' | 'neutral' }
export interface BrandStripProps { title?: string; brands: Array<{ name: string; logoUrl?: string; href?: string }> }
export const DEFAULTS: { [K in typeof AUTOMOTIVE_BLOCKS[number]]: object };
export function parseBlockProps<T>(name, raw: unknown): T; // zod; invalid or missing values fall back to DEFAULTS, never throw
```
Block positions inside a Puck document follow `PuckData.content: [{ type, props: { id, ... } }]` (the shape `PuckDataRenderer` consumes).

## 5. Tasks (test first)

Common rules: Server Components never import Puck packages or `puck-api` except `import type`; `'use client'` files may; tokens only; strings in both catalogs; hooks only for client fetches (blocks make none).

- [ ] **K-00 Preconditions.** `ls components/contentools lib/contentools` (H delivered `ContentoolsPage`, `origin.ts`, `puck.ts`, `theme.ts`); `npm run check` green. MCP and Chrome checks of section 7.1 (which stores have a published home page). [SPEC: K-R4]
- [ ] **K-01 Block schema and defaults.** Create `lib/puck/automotive-blocks.schema.ts` (section 4) with zod parsing and sensible defaults (`count` default 8, clamped 4 to 8; `showFinder` default `true`; `tone` default `brand`). Tests `automotive-blocks.schema.test.ts`: `defaults per block`, `count clamps to 4..8`, `invalid props fall back to defaults`, `unknown tone becomes brand`, `urls must be http(s) or relative` (a `javascript:` href is dropped). [SPEC: K-R4]
- [ ] **K-02 Home data loader.** `lib/ct/home.ts` (server-only, React `cache()`): `getHomeData(ctx): Promise<HomeData>` with `HomeData { storeName: string; branch: { city: string; name: string } | null; pickup: PickupOption; categories: Array<{ id; slug; name }>; popular: ProductSummary[]; vehicle: Vehicle | null }`. `pickup` from `getPickupOption(branch, now, timezone)` (I-03). `categories` from `getNavCategories` (I-07). `popular` from K-06 (return `[]` until K-06 lands). All independent reads in one `Promise.all`. Test `home.test.ts` with mocks: `uses the selected branch for the promise`, `single branch store still has a branch`, `categories equal the shell navigation`. [SKILL: commercetools-storefront] [SPEC: K-R1, K-R2]
- [ ] **K-03 Context.** `components/home/HomeDataContext.tsx` (client): `HomeDataProvider`, `useHomeData()` throws a clear error outside the provider. [SPEC: K-R1]
- [ ] **K-04 Hero block.** `components/home/AutomotiveHero.tsx` (client component, so Puck can render it): band `--color-surface-brand-deep`, padding 40 px vertical (`py-10`) and 24 px horizontal (`px-6`), two columns collapsing under 600 px (`grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`), content width `--content-width`. Left: eyebrow in `--font-ui`, `--tracking-label`, uppercase, colour `--color-accent-300`; H1 (40 px desktop, `--text-4xl` mobile) ; supporting line in `--color-brand-100` with the pickup promise: `pickup === 'today'` "Pick up in {city} today or have it shipped.", `'tomorrow'` "Pick up in {city} tomorrow or have it shipped.", `'ship-to-store'` "Have it shipped to {city} to collect, or to your door."; "Shop all parts" pill button (`--radius-pill`, white fill, brand text, height 48 px) linking to `/{locale}/{store}/parts`. Right (when `showFinder`): `VehicleFinderCard` from J inside a white card, radius `--radius-md`. Image (optional) as a decorative background layer with empty `alt`. Tests `AutomotiveHero.test.tsx`: `promise says today for a same-day store` and `says tomorrow for a next-day store` (scenario "Pickup promise reflects the store"), `ship-to-store line`, `shows saved vehicle instead of empty selectors` (scenario "Returning shopper with a saved vehicle": render with a garage fixture and assert the chip, "Change" and "Shop parts that fit", and no `select`), `finder hidden when showFinder is false`, `one h1`, `no axe violations`. [SPEC: K-R1]
- [ ] **K-05 Category tiles block.** `components/home/CategoryTiles.tsx`: title "Shop by category" (24 px, weight 600); grid `repeat(auto-fill, minmax(150px, 1fr))`, gap 12 px; tile `--color-surface-brand-deep`, hover `--color-brand-800`, radius `--radius-lg`, padding 18 × 14 px, min height 96 px, name bottom-aligned, weight 600, 15 px; each tile is a link to `/{locale}/{store}/category/{slug}`; focus ring `--color-focus`. Never an empty tile: categories without a name are dropped. Tests: `five categories show five tiles` (scenario "Tile count follows assortment"), `no empty tile`, `tile links to the category slug`, `excluded category has no tile`. [SPEC: K-R2]
- [ ] **K-06 Popular products block** (needs L). `lib/ct/home.ts` `getPopularProducts(ctx, count)`: `searchParts(ctx, {}, { sort: 'popular', page: 1, fit: true, brand: [], pickup: false, attrs: {} })`, slice `ids` to `count`, then `getListingProjections` and `mapProductSummary`; with no vehicle this lists the store's most popular products (sort `popular` is L's rank sort over `popularity-rank`, L-03; prices on the cards are the **standalone** prices resolved by L's `getListingProjections` and `selectStandalonePrice` in the order branch channel, store retail channel, Malva base (I D6), never embedded prices). `components/home/PopularProducts.tsx`: heading "Popular at {reseller}", link "View all ›" (`--font-utility`, weight 500, 14 px) to `/parts`, grid `repeat(auto-fill, minmax(250px, 1fr))`, gap 16 px, cards are L's `ProductCard` with a `showStockBadge` look: success-tinted badge "In stock · {city}" or warning-tinted badge "Ships in {min}–{max} days" (from store settings; if L's card already renders these as a stock line, extend `ProductCard` with `variant="home"` that renders the tinted badge instead, keeping one component). Tests: `renders count between 4 and 8`, `badge in stock names the city`, `badge ships in 2–3 days otherwise` (scenario "Stock badge"), `only fitting products with a vehicle` (scenario "Fitment on the home page": the loader is called with the active vehicle's expanded range keys and the search request contains the fitment expression from J), `no vehicle lists popular products`, `price and old price`, `add to cart calls the shared hook`. [SKILL: commercetools-platform] [SPEC: K-R3]
- [ ] **K-07 Promo banner, brand strip, standalone finder.** `components/home/PromoBanner.tsx` (full-width band under the hero when placed there; tone `brand` uses `--color-surface-brand-subtle` with `--color-text-link` heading, `accent` uses `--color-accent-50` with `--color-accent-800` text, `neutral` uses `--color-surface-quiet`; radius `--radius-md`; optional CTA button; text is plain text, never HTML), `BrandStrip.tsx` (row of logos with `alt` = brand name, wraps, grey-scale not required; links optional), `VehicleFinderBlock.tsx` (title and `VehicleFinderCard`). Tests: `promo banner renders from props using theme tokens` (scenario "Promo banner": assert class names/tokens, no inline hex, and that it contains the text, with an HTML string rendered as text), `brand strip alt text`, `empty brands render nothing`. The banner copy does not create a discount; the cart discount itself is configured in the portal (T) and shown in the cart (N). [SPEC: K-R4]
- [ ] **K-08 Register blocks and render.** `components/contentools/automotive-puck-config.ts` (`'use client'`): `automotiveRenderConfig = { ...defaultRenderConfig, components: { ...defaultRenderConfig.components, AutomotiveHero: { fields, defaultProps, render }, ... } }` using the six block names; `fields` use Puck `text`, `textarea`, `number` (min 4, max 8 for count), `radio` for tone and `array` for brands. Extend `components/contentools/ContentoolsPage.tsx` (H) to accept `config` and wrap content in `HomeDataProvider`; keep `PuckApiProvider` with `baseURL={CONTENTOOLS_PROXY_BASE}`. Rendering mode as D10: start with a direct client component import (server-rendered by Next), run `npm run build && npm run start`, `curl -s http://localhost:3000/en-US/<storeKeyA> | grep -c "Shop all parts"`. If the build fails or the string is missing from the HTML, switch to `next/dynamic` with `ssr: false` and write the finding to `plans/evidence/K/render-mode.md`. Tests `ContentoolsPage.test.tsx`: `renders registered blocks in document order`, `unknown block type renders nothing and does not throw`, `no Puck runtime import in server files` (the existing lint rule must pass). [SKILL: commercetools-storefront] [SPEC: K-R4]
- [ ] **K-09 Default layout and home route.** `components/home/DefaultHome.tsx`: `AutomotiveHero` (design strings, `showFinder: true`), `CategoryTiles`, `PopularProducts` with the schema `DEFAULTS`, in a `--content-width` column with 48 px (`--space-7`) gap. `app/[locale]/[store]/page.tsx` (server): `getHomeData` and `getPublishedPage(storeKey, 'home')` (H) in `Promise.all`; page present renders `<ContentoolsPage data=... config=automotiveRenderConfig fallback={<DefaultHome/>} />`, absent renders `DefaultHome`; a Contentools failure renders `DefaultHome` and logs a warning. `generateMetadata`: title "{reseller} | {Parts tagline from messages}" and description with the city. Tests `app/[locale]/[store]/page.test.tsx`: `published page wins over the default`, `no page renders the default layout`, `contentools error falls back to the default`, `one h1 in either mode`. [SPEC: K-R1, K-R4]
- [ ] **K-10 Hand-off note for the portal.** In the PR description and in a comment at the top of `lib/puck/automotive-blocks.schema.ts`: workstream U must copy this file and `automotive-puck-config` field definitions into `portal/` to register the same blocks in the Contentools `PageManager` config. No portal edits here. [SPEC: K-R4]
- [ ] **K-11 Gates.** Messages in both catalogs under `home.*`; `npm run check`; `npm run build`. The home route is dynamic (it reads the session and garage); note that in the build output review. [SPEC: K-R1]

## 6. Test-first scenario checklist

| Spec scenario | Test |
| --- | --- |
| Pickup promise reflects the store | `AutomotiveHero.test.tsx` `promise says today…` and `…tomorrow…` |
| Returning shopper with a saved vehicle | `AutomotiveHero.test.tsx` `shows saved vehicle instead of empty selectors` |
| Tile count follows assortment | `CategoryTiles.test.tsx` `five categories show five tiles` |
| Stock badge | `PopularProducts.test.tsx` `badge in stock names the city`, `badge ships in 2–3 days otherwise` |
| Fitment on the home page | `PopularProducts.test.tsx` `only fitting products with a vehicle` |
| Promo banner | `PromoBanner.test.tsx` `promo banner renders from props using theme tokens` |

## 7. Verification

### 7.1 `b2b2c-automotive` MCP and service checks (record in `plans/evidence/K/mcp-checks.md`)
- `read_custom_objects` (container names as used by Contentools; list containers first with `where` on `container`): the home page document for store A exists and is published; store B has none (so both modes are tested). The seed writes no Puck pages (only the `configuration/default-theme` object and banner images in `mau-site`), so expect no published page: record it and test the published mode with a fixture or a page created in the ThemeManager/PageManager; the default layout is the seeded-data mode.
- Published page via the service: `curl -s -X POST "$CONTENTOOLS_ORIGIN/service/<storeKeyA>/published/puck-pages/query" -H "x-project-key: <projectKey>" -H "content-type: application/json" -d '{"query":"slug = \"home\""}'` returns the document; every `content[].type` in it is a registered block name (compare to `AUTOMOTIVE_BLOCKS` and `defaultRenderConfig`).
- Popular and fit expectations: `read_product_search` sorted by `variants.attributes.popularity-rank` ascending (unranked last), `limit: 8`, with the store scope; with a vehicle add J's range fit expression (expanded keys). The ids must equal the cards. Prices: `read_standalone_prices` for two displayed skus: the card price equals the branch channel price if one exists, else the store retail channel price (`mau-dist-north` / `mau-dist-south`), else the Malva base price (EUR/DE for de-DE, USD/US for en-US).
- Stock: `read_inventory` for two displayed skus at the branch channel matches the badges.
- Categories: the facet call from I-07 gives the tile set; store B (withdrawn line) has fewer tiles.

### 7.2 Chrome DevTools MCP recipe (base `http://localhost:3000`; screenshots in `plans/evidence/K/`)
Viewports 375×812, 768×1024, 1024×768, 1440×900.
1. `/en-US/<storeKeyA>` at 1440, cleared cookies: shell, then the hero band (brand-deep), eyebrow "OEM parts · Fit guaranteed", H1 "Genuine parts from {reseller}, ready near you.", pickup line with the branch city, "Shop all parts", finder card "Find parts for your vehicle" with selects and "Verify fitment"; "Shop by category" tiles; "Popular at {reseller}" with "View all ›". Screenshot `home-1440.png`. `list_console_messages`: no errors.
2. `list_network_requests`: no request for the page document itself and none to `/api/contentools` for page data (published mode); no `fetch` to commercetools hosts. `curl` the HTML: it contains the hero H1 (or, if D10 fell back to client-only rendering, contains the serialized page data and the finder-less default; record which).
3. Change the branch in the shell picker to a next-day branch: the supporting line says "tomorrow"; for a same-day branch "today". Assert the tile count equals the MCP root count.
4. Pick a vehicle in the finder card: the card turns into the chip with "Change" and "Shop parts that fit"; reload: still shown on first paint; "Popular at …" now shows only fitting products (assert each card's badge/hrefs against the MCP fit list). Click "Shop parts that fit": lands on `/parts` fit-only.
5. Stock badges: one card with "In stock · {city}" (success tint, `get_css_styles` background equals `--color-success-50`) and, when seed has one, "Ships in 2–3 days" (warning tint).
6. Store B (`/en-US/<storeKeyB>`): no published page, so the default layout renders with the same sections; store theme colours differ from A (hero band computed colour differs) and no maroon remains if B's primary differs (G: token reaches every surface).
7. Promo banner: if the seeded page has one, it appears below the hero in theme tokens; otherwise render the fixture through the test only.
8. Responsive: at 375 the hero columns stack (finder card below the text), tiles at 150 px minimum (two or three per row), popular cards at 250 px minimum, `scrollWidth <= innerWidth`; screenshots `home-375.png`, `home-768.png`, `home-1024.png`.
9. `/de-DE/<storeKeyA>`: German strings; EUR prices; no console errors.
10. Keyboard: Tab order hero button, finder controls, tiles, cards; every tile and card has a visible focus ring.

### 7.3 Manual rows for `plans/TODO-MANUAL-TESTING.md`
| Id | Who | What | Claude proceeds with |
| --- | --- | --- | --- |
| OA-02 | Owner | Contentools Merchant Center app installed and connected (needed for any published page) | default layout verified; published mode verified with fixtures |
| M-K-1 | Owner | Compare `home-1440.png` and `home-375.png` with `Reseller Storefront.dc.html` view `home` | continue; differences become tasks |
| SO-01 | Owner | Sign off trust strip, brand logos and review block as the designs have none (the Brand strip block is available but empty by default) | blocks as built |

Never wait silently: add the row, continue on the default, mention it in the PR description.

## 8. Definition of done
- K-00 to K-11 ticked; named tests pass; `npm run check`, `npm run build` green.
- Recipe 7.2 completed, screenshots saved, render mode recorded; MCP results recorded.
- `lib/puck/automotive-blocks.schema.ts` exists with the hand-off comment; K-06 is done (or explicitly blocked on L with the PR note, never silently skipped).
- Questions Q-K01 (default) and Q-K02 (client-only fallback allowed, answered through Q-H02) in `plans/notes/questions-IJKLM.md`.

## 9. Evidence
`plans/evidence/K/`: `home-375.png`, `home-768.png`, `home-1024.png`, `home-1440.png`, `home-storeB-1440.png`, `home-saved-vehicle-1440.png`, `render-mode.md`, `mcp-checks.md`.

## Seed requests
- `popularity-rank` (number, searchable) on `mau-pt-part` (1 is most popular, absent = unranked), set on roughly 12 to 16 parts per store-relevant mix (some in each reseller's assortment, some not ranked). Why: D6 (owner answer Q-L01) needs a ranked sort for the home block and L's "Most popular". Also recorded in `plans/notes/seed-requests.md`.

## Progress
- K-00: done (H and I deliverables present; `npm run check` green; live MCP checks M-K-2, no credentials)
- K-01: done (`lib/puck/automotive-blocks.schema.ts` plus `lib/puck/automotive-fields.ts`; tests in `automotive-blocks.schema.test.ts`)
- K-02: done (`lib/ct/home.ts`, `lib/home/types.ts`, `lib/home/template.ts`; `home.test.ts`). The home slug is `/home` (H's `HOME_SLUG`), not `home`
- K-03: done (`components/home/HomeDataContext.tsx`)
- K-04, K-05, K-07: done (`AutomotiveHero`, `CategoryTiles`, `PromoBanner`, `BrandStrip`, `VehicleFinderBlock`, `BlockLink`; hero line also takes `{pickup}`, empty means automatic; Q-K03, Q-K05)
- K-06: done against L's `searchParts`/`getListingProjections`/`mapProductSummary`/`ProductCard` (merged in the tree); tinted badge not done (Q-K04)
- K-08: done (`components/contentools/automotive-puck-config.ts`, `render-config.ts` now exports it, `ContentoolsPage` takes `config` and `homeData`; server rendered, `plans/evidence/K/render-mode.md`)
- K-09: done (`DefaultHome`, `app/[locale]/[store]/page.tsx` with metadata; removed the placeholder test in `app/[locale]/layout.test.tsx`)
- K-10: done (hand-off comments at the top of both `lib/puck/` files, Q-K01)
- K-11: done (`home.*` messages in both catalogs; `npm run check` and `verify:build` green, home route is dynamic)
- Browser recipe run against fakes (commercetools stand-in plus fake Contentools): `plans/evidence/K/`; live rows M-K-2, M-K-3
