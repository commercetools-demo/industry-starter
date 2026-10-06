# M — Homepage

**Specs:** `homepage-design` (all), `storefront-data-loading` (Session-specific elements stay out of shared content), existing behavior `openspec/specs/home-landing-page`
**Depends on:** G, H, K · **Unblocks:** — · **Decisions:** D-021 (contact strip, journal static), D-022 (recently ordered/quick order not in v1)

## Goal
`/[locale]` renders the MALVA home: hero (two variants), category showcase, new-in products, editorial panel, contact strip; shared content only (bag and account come from the header slots).

## Design
- Config `lib/config/site.ts`: `{ homeLayout: 'editorial' | 'grid'; contactStrip: boolean }` defaults `{ 'editorial', true }`, overridable by env `NEXT_PUBLIC_*`? **No** — read from `process.env.HOME_LAYOUT` / `HOME_CONTACT_STRIP` on the server (not `NEXT_PUBLIC`); invalid → default.
- Page `app/[locale]/page.tsx` (Server): `Promise.all([getCategoryTree(locale), searchProducts({ sort: 'newest', pageSize: 4, … })])`; no cart or customer reads (market only via `getMarket()`), so the body is the same for every visitor in a market. Revalidate: `export const revalidate = 60` is **not** used because currency/country come from cookies (dynamic); keep dynamic.
- Sections (server components in `components/home/`):
  - `HeroEditorial`: 2-col grid `1.05fr/1fr`; sage `Blob` (210 px, 50% opacity, offset −90/−60); `Tag` accent-2 (`home.hero.tag`), H1 76px, 18px body at 72% text, buttons "Shop the collection" (→ `/shop`) and "Read the story" (→ `/journal`); `Photo` 560 px tall (image URL from config `HERO_IMAGE_URL` default a placeholder; `alt` from messages).
  - `HeroGrid`: H1 62px + 3-col grid with 230 px rows: tile A spans 2×2 (→ `/journal`), B, C, D single (→ `/shop`), E spans 2 cols (→ `/journal`); each a `Photo` with `lift`.
  - `CategoryShowcase`: `SectionHeading` ("The aisles" / "Browse by category", link "Everything →"), 6-column grid of `Card`s: 130 px image (category image from messages-config map `categoryImages[slug]` placeholder), name, "NN items" (two digits) — count from the facet of an `all-products` search (`searchProducts({pageSize:1})` facets) or omitted when unknown. Each links to `/shop?category=<slug>`.
  - `NewIn`: `SectionHeading` + 4-col `ProductTile`s (image 340 px variant of the tile via prop `imageHeight`).
  - `EditorialPanel`: `accent-2-700` panel, radius `lg×1.6`, padding 35 px, 2-col: kicker, H2 44px, 17px body, inverted button → `/journal`; image 380 px on `accent-2-300`.
  - `ContactStrip` (when enabled): bordered, 64 px `Blob` with chat icon (Lucide `message-circle`, stroke 2.75), H3 "Questions? Contact us", copy, primary "Contact us" → `/contact`.
- Icons: use `components/ui/Icon.tsx` from H.
- Content (all copy) in `messages/*.json` under `home.*`; placeholder grocery copy (e.g. "Good food, quietly sourced", "Aisle by aisle"). Images: placeholders (`https://picsum.photos/seed/<name>/1200/900`) — real photography is an owner TODO (M-M-3).

## Tasks
- [x] M-01 Write `lib/config/site.ts` + tests (defaults; invalid env falls back). Use `Icon` from H (lucide is installed in A).
- [x] M-02 Write `HeroEditorial` and `HeroGrid` + messages; tests: editorial renders H1, two buttons with right hrefs; grid renders five tiles with spans; variant switch via config renders exactly one hero.
- [x] M-03 Write `CategoryShowcase` + tests: six cards, each links to `/shop?category=slug`; count formatted `NN`; missing count omitted.
- [x] M-04 Write `NewIn` and `EditorialPanel` + tests (four tiles; panel button → `/journal`).
- [x] M-05 Write `ContactStrip` + page composition; tests: strip omitted entirely when disabled; page calls both fetches in parallel and never fetches the cart or customer (`getCart`/`getCustomer` not called; only `getMarket()` is used).
- [x] M-06 Report manual tests M-M-1…M-M-3; sign-off requests (design fidelity) added to SO-01.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Editorial hero default / Magazine grid | M-02 |
| Category click | M-03 |
| Product tile click | M-04 |
| Contact strip off | M-05 |
| Anonymous visitor (no session in shared content) | M-05 |

## Manual tests to report
- M-M-1: `/en-US` and `/de-DE` side by side with the design: hero, categories, new-in, editorial, contact strip.
- M-M-2: Set `HOME_LAYOUT=grid` and restart: magazine grid shows; `HOME_CONTACT_STRIP=false` hides the strip.
- M-M-3: Owner supplies real hero/category photography (replace placeholder URLs) — decision item.

## Definition of done
All sections render with real data; no session reads in the page; both locales; `verify` passes.

## Implementation notes (deviations, recorded by the developer)
- **Market follows the URL locale, not `getMarket()`** (as K and P, D-012): the page uses `COUNTRY_CONFIG[locale]` and only falls back to `getMarket()` for an unknown locale, so a fresh visit to `/de-DE` shows EUR. The page therefore reads no session at all (the test asserts `getSession`, `getCart`, `getMappedCart`, `getCustomer` are never called and `getMarket` only for an unknown locale). See Q-M-1.
- **One search, not two:** the facets of the `sort: 'newest', pageSize: 4` search cover the whole catalog, so the category counts come from it (no extra `pageSize: 1` search). Counts are the direct facet counts rolled up with `rolledUp` (now exported from `lib/listing-view.ts`); an empty category facet means "unknown" and the count is omitted. A category with no products shows "00 items".
- `export const dynamic = 'force-dynamic'` on the page so `HOME_LAYOUT`, `HOME_CONTACT_STRIP` and `HERO_IMAGE_URL` are read per request (otherwise the page would be prerendered at build with the build-time env and would need live commercetools at build).
- `lib/config/site.ts` has a third switch `heroImageUrl` (`HERO_IMAGE_URL`, https only, default a picsum placeholder; the plan named it as config). `HOME_CONTACT_STRIP` accepts `true/1/on` and `false/0/off`; anything else keeps the default (on). Placeholder images live in `lib/config/home-images.ts`, category images keyed by category `key` (locale independent); a category without an entry gets the neutral placeholder block.
- `ProductTile` got two additive props: `imageHeight?: 330 | 340` (home uses 340) and `showSave?: boolean` (home passes `false`: `design/specs/homepage.md` says the heart is not shown on home tiles, only on PLP). Defaults keep the listing unchanged.
- Added `components/home/Hero.tsx` (selects exactly one of `HeroEditorial` / `HeroGrid`) and `lib/home-view.ts` (`buildShowcaseItems`, `twoDigits`). Sections carry `data-hero` / `data-section` / `data-category` / `data-tile` attributes (used by tests, harmless in HTML).
- Showcase shows the first six root categories in tree order. "See all" on New in links to `/shop?sort=newest`. Responsive (proposed in the spec, SO-01): hero stacks under 1200, categories are a scroll-snap row under 768, 3 columns at tablet, 6 at desktop; products 1 / 2 / 4 columns.
- Message keys added (both locales): `home.hero.*`, `home.grid.*`, `home.categories.*`, `home.newIn.*`, `home.editorial.*`, `home.contact.*`. German is machine-translated (see IDEAS). Copy is grocery-adapted ("Good food, quietly sourced", "Aisle by aisle", "The aisles").
- `/journal` and `/contact` are built by X; until merged the buttons lead to a 404 (M-M-1 says so). No page-level `generateMetadata` was added (the layout default applies).
- Live check with `npm run dev` against the seeded project: `/en-US` and `/de-DE` return 200 with all five sections and "06 items" / "06 Artikel" on every card.
