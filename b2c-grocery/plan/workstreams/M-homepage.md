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
- [ ] M-04 Write `NewIn` and `EditorialPanel` + tests (four tiles; panel button → `/journal`).
- [ ] M-05 Write `ContactStrip` + page composition; tests: strip omitted entirely when disabled; page calls both fetches in parallel and never fetches the cart or customer (`getCart`/`getCustomer` not called; only `getMarket()` is used).
- [ ] M-06 Report manual tests M-M-1…M-M-3; sign-off requests (design fidelity) added to SO-01.

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
