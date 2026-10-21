<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream O: Home page

Read `plans/JUNIOR-GUIDE.md` first. Everything runs in `storefront/`. Dev URL assumed `http://localhost:3000`.

## 1. Header

| Field | Value |
| --- | --- |
| ID | O |
| Name | Home page: hero, category tiles, collection banner, bestsellers, new arrivals, editorial strip, subscribe strip |
| Depends on | G (Product Search wrapper, `ProductCard`, `ProductGrid`, listing URLs and filters; its `collection` facet already maps `bestseller`, `new` and `subscribable`), and through G: C (seeded categories, badges, images), D (server core), E (atoms), F (shell, store picker, promise figures) |
| Wave | 10 (parallel with N and P) |
| Specs implemented (primary first) | `design-home-page` (primary), `home-landing-page` (generated B2B template, adapted below) |
| Generated template that applies | `home-landing-page` applies as the **rule** that shared merchandising is separated from per-person slots and that expired sessions render as anonymous. Its components table is B2B (business unit, contract promotions, quick order, recently ordered, account alerts); see D2 for the row-by-row decision. Its commercetools section (Business Unit, Customer Group, Store-scoped Cart Discounts) does **not** apply: this is a B2C storefront (D-015). |
| Owner prerequisites | None blocking. SO-02 (photography and wordmark approval, existing) for the real hero and tile images; SO-O1 (home page copy); OA-03 (images) only for real photos; placeholders ship meanwhile |
| Skills | `commercetools-storefront` (`references/core/add-page.md`, `core/performance.md`, `stack/nextjs/best-practices/metadata.md`, `server-components.md`, `image.md`), `commercetools-platform` (Product Search) |

## 2. Goal and scope

**Goal.** The home page says what Malva Coffee is (pods, coffee, machines, online for delivery or collection), sends the shopper into a category in one click, sells the collect-in-store promise, and offers subscriptions. It renders for everyone from the same shared merchandising; everything specific to one person (collection store name, header cart count and account) comes from the session at request time and is never stored in a cache shared between people.

**In scope**: route `/{locale}` and its seven sections, the content module, metadata and structured data, the loading and failure behaviour of each section, tests, browser recipe.

**Out of scope**

- Header, promise bar, footer, store picker, locale chooser (F). O only calls them.
- Product card, listing, filters (G). O reuses `ProductCard` and G's search wrapper.
- A carousel or a recently-viewed or "recently ordered" strip (not designed; template rows not applicable).
- Personalised recommendations, loyalty text (no loyalty scheme, design.md Q7).
- A CMS. Content is a typed module in the repository (Q-O-1).
- Static generation of the whole page (Q-O-6, parked in `IDEAS.md`).

## 3. Design

### D1. Visual source of truth

`design/export/b2b2c-retailer-design/project/app/pages-shop.jsx` (`HomePage`), `components.jsx` (`Footer`, F), `styles.css` (`.hero`, `.section`, `.section-tight`, `.section-head`, `.grid-4`, media queries) and `screenshots/home*.png`. The prototype screenshot `home.png` shows only the shell (the page body did not render); use `home2.png` to `home5.png`. The prototype uses raw hex values and inline styles: **do not copy them**. Use the tokens of `design-tokens-and-components`. Translate the few raw values like this:

| Prototype value | Token form to write |
| --- | --- |
| Hero background `linear-gradient(180deg,#FBF9F5,#F4F0E8)` | `linear-gradient(180deg, var(--canvas), var(--canvas-2))` |
| Violet glow `rgba(99,89,255,0.20)` | `color-mix(in srgb, var(--accent) 20%, transparent)` |
| Glass card `rgba(255,255,255,0.86)` | `color-mix(in srgb, var(--surface) 86%, transparent)` with `backdrop-filter: blur(16px)` |
| Tile bottom gradient `rgba(25,23,65,0.55)` | `linear-gradient(180deg, transparent, color-mix(in srgb, var(--ink) 55%, transparent))` |
| Banner eyebrow `#8F8FFF` on ink | `var(--teal)` (7.4:1 on ink; `--accent` on ink is only 3.6:1 and fails AA for small text) |
| Banner body `#C2C2FF` | `color-mix(in srgb, var(--canvas) 78%, var(--ink))` (10:1 on ink) |
| Banner glow `--ct-glow-violet` | same as the hero glow, 50% opacity |
| Proof tile `rgba(255,255,255,0.07)` / border `0.14` | `color-mix(in srgb, var(--surface) 7%, transparent)` / `14%` |

If E has already defined named utilities for the glow or glass, use those instead.

### D2. The `home-landing-page` template, row by row

| Template component | Source tag | Decision for Malva |
| --- | --- | --- |
| Header logo and navigation | STATIC | F. Not in O. |
| Search bar | STATIC | F. |
| Cart icon and count | MIDDLEWARE | F, via `useCart()` (SWR to `/api/cart`). O only **tests** the scenarios below. No server cache touches it. |
| Account menu | MIDDLEWARE | F, from session fields. Same. |
| Hero banner and carousel | STATIC | O hero, **one** hero, no carousel; content from `content/home.ts`. |
| Featured categories | CACHED | O category tiles; category tree through the shared `unstable_cache` (60 s) of G or D. |
| Recently ordered and recommended | MIDDLEWARE | Not applicable: B2B template, not in design-home-page. A "Buy again" strip is parked in `IDEAS.md`. |
| Quick order widget | MIDDLEWARE | Not applicable (B2B). |
| Announcements and alerts | STATIC | The promise bar of F is the only notice. No alert banner. |
| Footer | STATIC | F (links by P). |

Both template scenarios are tested (section 5) even though the home page body has no account slot: the guarantee is that **nothing on the page** shows a name, cart count or stale account for an anonymous or expired session, and that the one per-person element in the body (collection store) is read from the session on the server per request.

### D3. Files

| File | Purpose |
| --- | --- |
| `app/[locale]/page.tsx` | Server Component. Replaces the bare shell that A created. Reads session and market, composes the sections, `generateMetadata`. |
| `components/home/Hero.tsx` | Hero (server) with `OpenStoreButton` leaf |
| `components/home/HeroFeaturedCard.tsx` | Glass card (server): featured product name and price as a link |
| `components/home/PromiseRow.tsx` | Three promise items (server) |
| `components/home/CategoryTiles.tsx` | Four tiles (server) |
| `components/home/CollectionBanner.tsx` | Ink panel (server) with `OpenStoreButton` |
| `components/home/OpenStoreButton.tsx` | `'use client'` leaf calling `useCollectionStore().open()` (F) |
| `components/home/ProductSection.tsx` | Eyebrow, title, "View all", four-up grid (server); `ProductGrid` from G |
| `components/home/EditorialStrip.tsx` | Image and brand story (server) |
| `components/home/SubscribeStrip.tsx` | Subscribe and save strip (server) |
| `components/home/HomeSkeletons.tsx` | `ProductSectionSkeleton`, used as `Suspense` fallback |
| `content/home.ts` | The content source (D4) |
| `lib/home-data.ts` (server-only) | `getHomeData(ctx)`: the parallel fetches (D5) |
| `messages/*.json` | keys `home.*` (D9) |

Names of G's and F's exports (search wrapper, `ProductGrid`, listing href builder, promise figures, `useCollectionStore`) are **not guessed**: task O-00 greps them and writes the real names to `plans/evidence/O/paths.md`.

### D4. Content source (`content/home.ts`)

Copy that marketing changes (hero eyebrow, headline, editorial text) lives here, per locale, both required (so no fallback logic is needed, and a missing locale is a type error):

```ts
import type { Locale } from '@/i18n/routing';

export interface HomeContent {
  hero: {
    featuredProductKey: string | null;       // commercetools product key, e.g. 'mcf-pod-original-ristretto'; null hides the glass card
    imageUrl: string | null;                  // clean URL (no query); null uses the featured product's first image, then a token-coloured placeholder
    imageAlt: Record<Locale, string>;
    eyebrow: Record<Locale, string>;          // campaign or season
    headline: Record<Locale, string>;         // 800 weight; line break marked with \n
    subline: Record<Locale, string>;
  };
  tiles: { categoryKeys: string[] };          // order; capped at 4 by the component; default the four top categories
  editorial: {
    imageUrl: string | null;
    imageAlt: Record<Locale, string>;
    eyebrow: Record<Locale, string>;
    headline: Record<Locale, string>;
    body: Record<Locale, string>;
    cta: Record<Locale, string>;
    href: string;                             // locale-less app path, e.g. '/journal' (P) or a category path
  };
}
export const HOME_CONTENT: HomeContent = { /* defaults below */ };
```

Defaults to ship (`en-US`; `en-CA` equals `en-US` except Canadian spelling where it differs and the **Canada market is delivery only**: the collection banner, the `Find your store` button and the `home.promise.collect` item are not rendered when the market has no stores, D-035):

| Field | en-US |
| --- | --- |
| `hero.eyebrow` | The Autumn Edit |
| `hero.headline` | Great coffee,\nyour way. |
| `hero.subline` | Compatible pods, fresh beans and machines. Order online, collect in store or have it delivered. |
| `editorial.eyebrow` | Our promise |
| `editorial.headline` | Sourced with care.\nRoasted for flavour. |
| `editorial.body` | We work with growers we know, roast in small batches, and take back used capsules so they can be recycled. |
| `editorial.cta` | Read about our coffee |

Claims such as "take back used capsules" are **invented placeholders** until the owner confirms (SO-O1, Q-O-3): put a `// DRAFT copy` comment on the content, not in the UI. `editorial.href` defaults to the About page route that P creates (`/about`); until P is done, use the coffee category path.

The pod-recycling variant of the editorial strip ("for pods it is the capsule recycling promise") is the default text above; a coffee-sourcing variant is parked (Q-O-3).

### D5. Data fetching (server, one `Promise.all`)

```ts
// lib/home-data.ts  (server-only)
export async function getHomeData(ctx: { locale: string; country: string; currency: string; collectionStoreKey?: string }) {
  const [tree, featured, bestsellers, fresh, subscribable, store] = await Promise.all([
    getCategoryTree(ctx.locale),                       // cached 60 s (G or D); never throws to the page: [] on failure
    getFeaturedProduct(HOME_CONTENT.hero.featuredProductKey, ctx),   // null when key null, unpublished or failing
    searchHomeProducts({ badge: 'bestseller', limit: 4 }, ctx),      // [] on failure
    searchHomeProducts({ badge: 'new', limit: 4 }, ctx),             // [] on failure
    countSubscribable(ctx),                            // number, 0 on failure (limit 1 search, total only)
    ctx.collectionStoreKey ? getStoreByKey(ctx.collectionStoreKey) : null,   // from the cached channel list (F)
  ]);
  return { tree, featured, bestsellers, fresh, hasSubscribable: subscribable > 0, store };
}
```

- Each fetch has its own `catch` that returns the empty value and logs `{ section, correlationId }`; **one failing section never blocks the page** (spec: a section with no products is omitted). Do not wrap `notFound()` or `redirect()` in these `try` blocks (there are none on this page).
- Product Search is `apiRoot.products().search()` (D-023) through G's wrapper, with `productProjectionParameters: { priceCurrency, priceCountry }` so cards arrive with prices; **no server cache for products or prices** (skill: prices may change; also per-market). Only the category tree and channel list are cached.
- Bestsellers and new arrivals are filtered on the product-level attribute `badge` (seed: enum `none | bestseller | new | limited-edition`). G's `collection` facet already maps `bestseller`, `new` and `limited-edition` to `variants.attributes.badge.key` and `subscribable` to the boolean attribute (G-00 verifies they are searchable). O uses that facet through G's wrapper; only if G-00 found a gap does task O-02 add a small, tested change in G's wrapper.
- The bottom two sections stream: wrap each `ProductSection` in `<Suspense fallback={<ProductSectionSkeleton />}>` and fetch inside them, **or** keep one `Promise.all` and stream with a single boundary; choose the first (each section independent). Hero, tiles and banner render without waiting for products.
- The page reads `getSession()` once (for `collectionStoreKey` and market) and `getLocale()` in the same `Promise.all` as the other fetches. An invalid or expired token yields `{}` (D module): the page renders as for an anonymous visitor.
- Rendering mode: dynamic (reads cookies), no shared response cache. Rationale: spec `home-landing-page`; the store banner is session specific.

### D6. Sections

Wrapper rules: Server Components by default; interactive leaves only (`OpenStoreButton`). Links are locale-aware (`@/i18n/routing`); there is exactly one `<h1>` (the hero headline); each other section has an `<h2>`. Section vertical spacing uses the `.section` (72 px) and `.section-tight` (48 px) rules from E; content width `--maxw` with 32 px side padding (20 px under 820 px).

1. **Hero** (`Hero.tsx`). Section background gradient (D1). Two columns `minmax(0, 1.05fr) minmax(0, 0.95fr)`, gap 40, min height 520, padding `40px 32px 24px`.
   Left: eyebrow (accent colour; 11 px uppercase tracked, E class), `<h1>` Archivo 800 `clamp(44px, 5.6vw, 82px)`, line height 0.98, tracking -0.03em (split on `\n` with `<br />`, not on JSON), subline 18 px `--ink-2` max width 440, two buttons: primary `Shop the edit` (ink, large, arrow icon) linking to the **bestsellers listing** (G's href with `badge=bestseller`; default: the all-products listing, Q-O-4), ghost `Find your store` with pin icon (`OpenStoreButton`, opens the picker). Under them `PromiseRow`: three items with icons (truck, store, repeat) and text from F's promise figures: `Free shipping over {threshold}` (market threshold from shipping rate tiers, formatted with `formatMoney`), `Free collection, ready in {minutes} minutes` (**store** minutes when a store is chosen, else the minimum across the market's stores), `{days}-day returns`. **No figure is a constant in O.**
   Right: relative wrapper; glow layer; rounded (`--ct-radius-2xl`, 24 to 32 px) image box with `aspect-ratio: 4 / 4.4`, shadow, `next/image` `fill`, `priority`, `sizes="(max-width: 900px) 0px, 560px"`, alt from content. Glass card at bottom: eyebrow `Favourite` (small caps), product name (Archivo 600, 15 px), price button in ink (`formatMoney`) linking to the product page. The card is omitted when there is no featured product or it has no price (scenario "Hero product").
   Under 900 px the right column is hidden with CSS `display: none` (so it is out of the accessibility tree). `priority` on a hidden image still downloads it; accept that single download and let workstream Q check it against the performance budget (Q-O-5). Do not try to avoid it with tricks such as a `sizes` of `0px` (not valid).
2. **Category tiles** (`CategoryTiles.tsx`). Four 4:5 tiles in `.grid-4` (4 columns; 2 columns from 1080 px down, Q-O-2, to avoid a 3 + 1 layout). Tiles are the categories whose keys are in `HOME_CONTENT.tiles.categoryKeys` in that order, **capped at four**, each found in the category tree; a key that does not resolve is skipped (scenario "Tile order"). Tile = `<a>` (real link) with image (`next/image`, lazy), bottom gradient, label (Archivo 600, 17 px, white) and an arrow icon. Label is the localized category name (`getLocalizedString`). White label contrast against the image is guaranteed by the gradient (min 4.5:1 verified in Q with a dark and a light photo). Missing image: `--canvas-2` block with a category icon from the shared set. Default category order (SEED-PLAN section 7): pods, coffee, machines, accessories. The label for the pods tile shows the category name from the platform; the sub-brand wording rule of D-005 applies (see section 10).
3. **Collection banner** (`CollectionBanner.tsx`). Ink rounded panel (`--ct-radius-2xl`) with violet glow, padding `44px 48px`, two columns `minmax(0, 1.3fr) minmax(0, 1fr)`; left: eyebrow `Order online, collect in store` (`--teal`), `<h2>` `Ready in {minutes} minutes at {store}.` (Archivo 700, 34 px) using the **session's** store from `getHomeData` (name from the channel, minutes from the channel custom field `collectionMinutes`), one line `See live availability as you browse, reserve what you want and skip the queue. Free, always.`, buttons `Change store` (accent, pin icon, `OpenStoreButton`) and `Shop collect-eligible` (ghost on dark, links to G's listing with the "available at my store" filter on). With **no store chosen** the heading reads `Collect in store, ready in minutes.` and the first button reads `Choose a store`; `Shop collect-eligible` stays (it opens the picker when no store is chosen: `OpenStoreButton` variant) (scenario "Store named"). Right: three proof tiles (`clock` Fast, `shield` Reserved, `leaf` No fees; text from messages), each with teal icon. Under 900 px: one column, proof tiles in a row below (wrap).
4. **Bestsellers** and 5. **New arrivals** (`ProductSection.tsx`). Props: `eyebrow`, `title`, `viewAllHref`, `products: ProductSummary[]`. Returns `null` when `products.length === 0` (scenario "No new products"). Head: eyebrow, `<h2>` (Archivo 700, 34 px; 27 px under 820), `View all` link (underline grows). Grid `.grid-4` with G's `ProductCard` (cards own their availability line, heart and quick add). New arrivals eyebrow in accent colour. `View all` goes to the listing with `badge=bestseller` or `badge=new`.
6. **Editorial strip** (`EditorialStrip.tsx`). Alternate canvas background (`--canvas-2`), two columns 1fr 1fr, gap 40, padding `64px 32px`; left image 5:4 rounded 2xl (lazy, alt from content, placeholder tinted block if no URL), right: eyebrow text in `--ink-2` (not `--teal`: teal text on the light canvas is only 2.2:1 and fails AA); headline Archivo 700 36 px; paragraph 16 px `--ink-2` max 440; button `Explore` ink linking to `editorial.href`. All strings and image from `HOME_CONTENT` (scenario "Editorial content").
7. **Subscribe and save strip** (`SubscribeStrip.tsx`, new design, SO-O2). Rendered only when `hasSubscribable`. Panel on `--surface` with 1 px `--line` border, radius 16 to 24, three numbered steps (`Choose`, `Set an interval`, `Skip or cancel any time`) built from the shared Steps atom or three small cards, a heading `Subscribe & save`, a line `Never run out. Save {percent}% on every delivery.` **only if** the percent is known (see below) else without the percent, and a button `Shop subscriptions` linking to the listing filtered to subscribable products (G's `subscribable=true` filter). Saving percent: do not hard-code; omit the number in this workstream (Q-O-7) so O does not depend on N.

Order on the page: Hero, Category tiles, Collection banner, Bestsellers, Editorial strip, New arrivals, Subscribe strip (prototype order, subscribe strip last).

### D7. Metadata and structured data

`generateMetadata({ params })` (await `params`): `title` from `home.meta.title`, `description` (155 characters max, per locale from `messages`), `alternates.canonical` `/{locale}` and `alternates.languages` for `en-US` and `en-CA`, `openGraph` (title, description, one image: hero image URL or a static `app/opengraph-image.png` supplied by SO-02). JSON-LD `Organization` and `WebSite` with `potentialAction` `SearchAction` pointing at the search route of G; rendered once in the page as `<script type="application/ld+json">` with `JSON.stringify` (content is fixed data, no user input).

### D8. States and failure behaviour

| Situation | Behaviour |
| --- | --- |
| Product Search fails or index not ready | Bestsellers, new arrivals, hero card omitted; the rest renders; one server log line per section |
| Category tree fails | Tiles section omitted |
| Store key in session no longer exists | Banner behaves as "no store chosen"; `collectionStoreKey` is **not** cleared by O (F owns it) |
| Slow product fetch | Fallback skeleton (aria-busy) for that section only |
| Expired or tampered session | Renders as anonymous, no store in the banner, nothing about a person |
| Image missing | Token-coloured placeholder, same aspect ratio (no layout shift) |
| Reduced motion | Entrance animation (`fade-up`, 10 px translate) only inside `@media (prefers-reduced-motion: no-preference)`; content visible without it |

### D9. i18n keys (`home.*`; identical keys in `en-US` and `en-CA`)

en-CA equals en-US except where noted.

| Key | en-US |
| --- | --- |
| `home.meta.title` | Malva Coffee: pods, coffee and machines |
| `home.meta.description` | Compatible capsules, fresh coffee beans and machines. Order online and collect in store or have it delivered. |
| `home.hero.cta` | Shop the edit |
| `home.hero.findStore` | Find your store |
| `home.hero.favourite` | Favourite |
| `home.promise.shipping` | Free shipping over {threshold} |
| `home.promise.collect` | Free collection, ready in {minutes} minutes |
| `home.promise.returns` | {days}-day returns |
| `home.tiles.aria` | Shop by category |
| `home.banner.eyebrow` | Order online, collect in store |
| `home.banner.titleStore` | Ready in {minutes} minutes at {store}. |
| `home.banner.titleNoStore` | Collect in store, ready in minutes. |
| `home.banner.text` | See live availability as you browse, reserve what you want and skip the queue. Free, always. |
| `home.banner.changeStore` | Change store |
| `home.banner.chooseStore` | Choose a store |
| `home.banner.shopCollect` | Shop collect-eligible |
| `home.banner.proofFast` / `proofReserved` / `proofNoFees` | Fast / Reserved / No fees |
| `home.bestsellers.eyebrow` / `title` | Most loved / Bestsellers |
| `home.new.eyebrow` / `title` | Just landed / New arrivals |
| `home.viewAll` | View all |
| `home.subscribe.eyebrow` | Subscribe & save |
| `home.subscribe.title` | Never run out of coffee |
| `home.subscribe.step1` / `step2` / `step3` | Choose your coffee or pods / Set how often / Skip or cancel any time |
| `home.subscribe.cta` | Shop subscriptions |

Hero and editorial copy live in `content/home.ts`, not in these catalogues (D4).

### D10. Accessibility

One `<h1>`. Sections are `<section aria-labelledby>`. Tiles and cards are links with the visible name inside (no `aria-label` that differs from visible text). The glass card button is a link (`<a>`) styled as a button. Decorative icons `aria-hidden`. Hero image has real alt; tile images `alt=""` because the label is the link text. The promise row is a list (`ul`). Focus rings from E on every control. Contrast: all text on `--ink` uses `--canvas` or teal; text on `--canvas` or `--canvas-2` uses `--ink` or `--ink-2` (not `--ink-3`, not `--teal`).

### D11. Responsive (the five tokens breakpoints)

| Width | Behaviour |
| --- | --- |
| above 1080 | As designed: hero two columns, tiles in 4, grids in 4, banner two columns |
| 1080 | Product grids 3 columns; tiles 2 columns (Q-O-2); footer by F |
| 900 | Hero image column hidden and text fills the width; banner one column; editorial one column (image first) |
| 820 | Side padding 20; product grids and tiles 2 columns; section padding 52; section titles 27 px |
| 700 | Banner proof tiles wrap to two rows if narrower than 360 px each |
| 520 | Smaller wordmark (F); hero headline at its clamp minimum; buttons stack full width |

## 4. Tasks

Common rules: test first; `npm run check` before ticking; commit `ws-o: O-0x summary`; tokens only; both catalogues; no `any`; server code `import 'server-only'`.

- [x] **O-00 Preconditions and paths.** G is `Done`. Grep and write to `plans/evidence/O/paths.md`: G's search wrapper and its filter parameters (`collection` facet values `bestseller`, `new`, `subscribable`; the collect filter), `ProductCard`, `ProductGrid`, listing href builder, category tree function, F's `getPromiseFigures()` (`lib/ct/promise.ts`, returns `{ freeShippingThreshold, collectionMinutes, returnDays }`), `useCollectionStore` (`open()`), `getStoreByKey` or channels cache, E's utilities for glow and glass, `Steps` atom. Check that seed data has: categories `mcf-cat-*` with images, products with `badge` values `bestseller` and `new`, at least four of each (run `seed` verify or read with the MCP). If `new` has none, that is fine (the section disappears) but record it. `npm run check` green. [SKILL: commercetools-platform]
- [x] **O-01 Content module.** `content/home.ts` with types and defaults (D4); unit test that every locale has every string and no URL has a query string. Tests: `Editorial content: copy image and link come from the content module`, `content has both locales`, `Canada market hides the collection banner`, `image urls are clean`.
- [x] **O-02 Home data.** `lib/home-data.ts` (D5); add `badge` filter to G's wrapper if missing (with its test in G's test file). Tests (mock `lib/ct/*`): `a failing section returns empty and the others still return`, `featured product null when the key is unset`, `bestsellers query asks for badge bestseller with four results`, `subscribable count uses one result and total only`, `no server cache wraps product searches`. [SKILL: commercetools-platform] [SKILL: commercetools-storefront]
- [x] **O-03 Hero** (Canada market: no `Find your store` button and no collect promise item; test `Canada market hides store button and collect promise`). `Hero.tsx`, `HeroFeaturedCard.tsx`, `PromiseRow.tsx`, `OpenStoreButton.tsx`. Promise figures from F. Tests: `Hero product: glass card links to the product page and shows its price`, `no featured product hides the card`, `Narrow screen: image column has display none under 900 and text fills the width` (class assertion plus recipe), `hero has exactly one h1`, `promise figures come from the figures function not constants`, `Find your store opens the picker`. [SKILL: commercetools-storefront]
- [x] **O-04 Category tiles.** `CategoryTiles.tsx` per D6.2. Tests: `Tile order: tiles follow the configured order capped at four`, `unknown category key is skipped`, `tile is a link to the category listing`, `missing image shows the placeholder`, `five configured keys render four tiles`.
- [x] **O-05 Collection banner.** `CollectionBanner.tsx` per D6.3. Tests: `Store named: headline names the chosen store and its minutes`, `no store chosen asks to choose one`, `unknown store key behaves as none`, `Shop collect-eligible links to the collect filtered listing`, `banner never renders a name or cart count`.
- [x] **O-06 Product sections.** `ProductSection.tsx`, `HomeSkeletons.tsx`, the two uses with `Suspense`. Tests: `No new products: the New arrivals section is absent`, `Bestsellers renders four cards with View all link`, `section failure omits only that section`, `skeleton has aria-busy`.
- [x] **O-07 Editorial and subscribe strips.** `EditorialStrip.tsx`, `SubscribeStrip.tsx`. Tests: `Editorial content: strip text and image come from content`, `Entry point: Shop subscriptions links to the listing filtered to subscribable products`, `subscribe strip hidden when nothing is subscribable`, `strip never shows a hard coded percent`.
- [x] **O-08 Page, metadata, structured data.** `app/[locale]/page.tsx`, `generateMetadata`, JSON-LD, composition order, Suspense boundaries. Tests: `Anonymous visitor: page renders shared merchandising and no account slot`, `Expired session: page renders as anonymous with no name and no cart count` (cookie with an expired JWT built with `jose`), `tampered cookie renders as anonymous`, `metadata has canonical and three alternates`, `json-ld is valid json with a SearchAction`, `page does not set cache headers that allow sharing across sessions` (response `Cache-Control` is not public). [SKILL: commercetools-storefront]
- [x] **O-09 Messages, responsive, motion.** Keys of D9 in two catalogues; CSS for D1 and D11 (use E's utilities; no raw values); entrance animation inside `prefers-reduced-motion: no-preference`. Tests: `catalogues have the same home keys`, `entrance animation is disabled under reduced motion` (CSS text assertion), `no raw colour values in home components` (lint passes). `npm run check`, `npm run build` (home route listed as dynamic).
- [ ] **O-10 Browser and data verification** (sections 6 and 7); evidence in `plans/evidence/O/`; add owner rows; `STATUS.md` `Ready for review`.

## 5. Scenarios checklist

`design-home-page` (primary):

- [ ] Hero product: `Hero.test.tsx` `Hero product: glass card links to the product page and shows its price`.
- [ ] Narrow screen: `Hero.test.tsx` `Narrow screen: image column has display none under 900 and text fills the width`; recipe step 6.5.
- [ ] Tile order: `CategoryTiles.test.tsx` `Tile order: tiles follow the configured order capped at four`.
- [ ] Store named: `CollectionBanner.test.tsx` `Store named: headline names the chosen store and its minutes`, `no store chosen asks to choose one`.
- [ ] No new products: `ProductSection.test.tsx` `No new products: the New arrivals section is absent`.
- [ ] Editorial content: `EditorialStrip.test.tsx` `Editorial content: strip text and image come from content`.
- [ ] Entry point: `SubscribeStrip.test.tsx` `Entry point: Shop subscriptions links to the listing filtered to subscribable products`; recipe step 6.7.

`home-landing-page` (template, adapted):

- [ ] Anonymous visitor: `page.test.tsx` `Anonymous visitor: page renders shared merchandising and no account slot`.
- [ ] Expired session: `page.test.tsx` `Expired session: page renders as anonymous with no name and no cart count`; recipe step 6.9.

## 6. Browser recipe (Chrome DevTools MCP)

Base `http://localhost:3000`. Evidence `plans/evidence/O/<step>-<what>-<375|1440>.png` and `README.md`. After each step: console without errors, no failed network request.

1. **6.1 Desktop, en-US.** `resize_page` 1440x900, `navigate_page /en-US`. `take_snapshot`: one `h1`, buttons `Shop the edit` and `Find your store`, three promise items with the **market** threshold (`$` amount equals the threshold in the shipping method rate tiers, read in section 7), glass card with a price, four tiles, banner, `Bestsellers` with four cards, editorial, subscribe strip. Screenshot full page. `evaluate_script`: `document.querySelectorAll('h1').length === 1`.
2. **6.2 Hero and tiles.** Click the glass card: product page opens. Back. Click each tile: the right category listing. Check the order matches `HOME_CONTENT.tiles.categoryKeys`.
3. **6.3 Store banner.** Fresh context (no cookie): banner says `Collect in store, ready in minutes.` and `Choose a store`. Press `Find your store` in the hero: the picker opens (F). Pick `Brooklyn`: banner now reads `Ready in <n> minutes at Brooklyn.` (n equals the channel's `collectionMinutes`) after the page refreshes. Reload: still named (session). `Shop collect-eligible` opens the listing with the collect filter.
4. **6.4 Markets.** `/en-CA`: CAD threshold (99) from the market, two promise items (shipping, returns), no collection banner, no `Find your store` button, no store pill; `/en-US` still shows the collection banner and the six NYC stores (F).
5. **6.5 Responsive.** `resize_page` 1080, 900, 820, 700, 520, 375 (height 900). At each: `evaluate_script` `document.documentElement.scrollWidth <= window.innerWidth`; at 1080 grids are 3 columns and tiles 2; at 900 `getComputedStyle(document.querySelector('.hero-media')).display === 'none'` (use the real selector the component has) and the hero text fills the width; at 820 side padding 20 px and 2-column grids; at 375 buttons are full width and at least 44 px high. Screenshots at 1440, 900 and 375.
6. **6.6 Empty sections.** With the seed variant that has no `new` badge (or temporarily filter the fetch in a test dev server with an env override used only in tests) the `New arrivals` heading is absent from the snapshot. If the seed always has new products, cover this by the unit test only and say so in the README.
7. **6.7 Subscribe entry.** Press `Shop subscriptions`: the listing opens with the subscribable filter applied (URL carries it, every card has the Subscribe badge or option).
8. **6.8 Failure isolation.** Start a second dev server on port 3002 with `CTP_API_URL` pointing to an unreachable host (`http://127.0.0.1:9`) in its own `.env.local` copy; open `/en-US`: the page still renders hero, banner and editorial without sections that need commercetools, with no unhandled error overlay; server log shows one line per failed section.
9. **6.9 Signed out and expired session.** The session cookie is HttpOnly, so the browser cannot forge an expired one and **no test-only route may be built for it**. The expired-token scenario is covered by the unit test (it builds an expired JWT with `jose`); say so in the README. In the browser: sign in, open `/en-US` (header shows the initials avatar), sign out, reload: no name, no cart badge, banner without a store only if the store was never chosen.
10. **6.10 Reduced motion and keyboard.** `emulate` `prefers-reduced-motion: reduce`: all content visible immediately. Tab through the page: order logical, focus ring visible, tiles and cards reachable.
11. **6.11 Performance and accessibility.** `lighthouse_audit` mobile and desktop (accessibility, best practices, SEO at least 95, 95, 95); `performance_start_trace` with reload and `performance_stop_trace`: LCP element is the hero image (or the headline when the image is hidden under 900 px), LCP at most 2.5 s on the dev machine in a production build (`npm run build && npm run start`); record numbers. Report paths in the README.

## 7. Self-verification with data (no asking the owner)

1. Read the market thresholds: shipping methods `mcf-ship-standard` free-above tiers for US and CA (commercetools MCP or `seed verify`); they must equal the home promise figures in step 6.1 and 6.4 (USD 75, CAD 99 unless the seed changed).
2. Read the six store channels with their `collectionMinutes`; the banner minutes equal the chosen store's value.
3. Read products with `badge = bestseller` and `new`; the sections show those, at most four each, in the grid order of G's default sort.
4. Read category keys and images; the tiles' images are those category images.
5. Record the read-backs as ids and values only in `plans/evidence/O/readback.md`.

## 8. Manual testing and owner items (also in `plans/notes/todo-O.md`)

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| SO-O1 | Owner | Before release | 1. Read `storefront/content/home.ts` (hero, editorial). 2. Approve or replace the copy, especially the recycling and sourcing claims. 3. Name the featured product (`featuredProductKey`) and the tile order. | Final copy in the file | TODO |
| SO-O2 | Owner | Before release | Compare `plans/evidence/O/6-1-home-1440.png` and `6-5-home-375.png` with the VELA screenshots `design/export/b2b2c-retailer-design/project/screenshots/home2.png` to `home5.png`; approve the **new** Subscribe strip (not in the prototype). | Approval or change list | TODO |
| SO-02 (existing) | Owner | Before release | Photography and wordmark approval; real hero, tile and editorial images replace placeholders (OA-03). | Written approval | TODO |
| M-O-01 | Owner | After O-10 | Open the home page on a real phone: hero legibility, tap targets, banner buttons, no horizontal scroll. | No problems | TODO |

## 9. Questions (also in `plans/notes/questions-O.md`)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-O-1 | Where do hero, editorial and announcement copy live (the template asks which system owns it)? | A typed module `content/home.ts` plus the catalogues; swap for a CMS later | no |
| Q-O-2 | Tiles at 1080 px: spec says grids go to 3 columns, which leaves 3 + 1 for four tiles | Two columns at 1080 and below | no |
| Q-O-3 | Are the recycling and sourcing claims true, and is the editorial strip about recycling (pods) or sourcing (coffee)? | Placeholder recycling text, flagged as draft | release |
| Q-O-4 | Where does "Shop the edit" go? | Listing filtered to bestsellers | no |
| Q-O-5 | The hero image is hidden under 900 px but still downloaded when `priority` | Accept one download; Q checks the budget | no |
| Q-O-6 | Should the home page be statically cached (ISR) with per-person parts as client islands? | No, dynamic; shared cache only for category tree and channels | no |
| Q-O-7 | Show a saving percent on the subscribe strip? | No number (avoids a dependency on N and a claim that varies by product) | no |
| Q-O-8 | Bestsellers: only products with the `bestseller` badge, or fill to four by rating? | Badge only, no fill | no |
| Q-O-9 | A "Buy again" or recently viewed strip for signed-in shoppers? | Not built, parked in `IDEAS.md` | no |
| Q-O-10 | Which top-level label for the pods tile (the spec says "Nespresso pods", D-005 forbids the brand as a product name)? | Use the platform category name; recommended wording "Compatible pods" with the line "Nespresso-compatible" | no |
| Q-O-11 | Featured product for the hero glass card? | The first seeded Original pod with a price in every market | no |
| Q-O-12 | Is the promise row "returns" figure the same in all markets? | Read from F's configuration, same source as the promise bar | no |

## 10. Definition of done

- O-00 to O-10 ticked, each with a passing `check` commit; `npm run build` shows the home route.
- Every scenario of section 5 has a named passing test or recorded evidence.
- Recipe steps 6.1 to 6.11 done with evidence at 375 and 1440; console and network clean; Lighthouse and trace numbers recorded.
- No threshold, minutes, days, product name or percent is a constant in components (grep proves it).
- Read-backs of section 7 match the page.
- `plans/notes/todo-O.md` and `questions-O.md` exist; `IDEAS.md` has the parked items.
- No `TODO` or `FIXME` in code without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` `Ready for review`.
