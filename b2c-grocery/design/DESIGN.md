# MALVA — Design foundations

Shared by every page spec in `design/specs/`. Imported from the Claude Design project
**MALVA Luxury Decor App** (`4174979d-389a-49a2-be07-5a9c6875a8eb`, owner Behnam Hamiditehrani).

## Source material

| File | Role | Persisted |
| --- | --- | --- |
| `MALVA Web.dc.html` | Full desktop storefront prototype (1440px): home, browse, PDP, editorial, search, wishlist, cart, checkout, confirmation, account | `design/source/` |
| `Canvas.dc.html` | Visual reference frames for header/footer, listing and product-page states. Its page-builder metadata (block names, authored-field schemas) is **ignored: there is no page builder, ever (D-045)** | `design/source/` |
| `_ds/organic-…/styles.css` | "Organic" design-system tokens and component classes | `design/source/_ds/styles.css` (excerpt, tokens + components used) |
| `_ds/organic-…/readme.md` | Design-system guidance (summarised below) | not copied; summarised here |
| `_ds/organic-…/_ds_bundle.js`, `support.js` | Prototype runtime (`DCLogic`, `<sc-if>`, `<sc-for>`) | **not copied** — prototype tooling, not product code |
| `MALVA App.dc.html`, `MALVA Freshness.dc.html`, `Canvas App.dc.html` | Mobile app / other variants | out of scope for this request |

Prototype caveat: all data is hard-coded (12 products, one fake customer, Paris showroom). The designs
are authoritative for **layout, tokens, components and states**, not for data or business rules.

## Direction ("Organic")

Warm, rounded, slightly playful. Cream-and-sand ground, terracotta accent, sage second accent.
Left-aligned asymmetric layouts, over-rounded containers, pill buttons/inputs, soft circular "blob" accents.
Photography is washed (`.washed`: saturate .6, contrast .85, brightness 1.1, opacity .94) so it sits back into the page.

Do: round everything, give shapes air, use sage as a real second voice. Don't: sharp corners, hairline-only geometry,
greying the palette, other display faces, crowding.

## Tokens

| Group | Values |
| --- | --- |
| Color roles | `--color-bg #f5ead8`, `--color-surface #ebddc5`, `--color-text #201e1d`, `--color-accent #c67139`, `--color-accent-2 #7a8a5e`, `--color-divider` = text @16% |
| Ramps | `neutral`, `accent`, `accent-2`, steps 100–900 (OKLCH). 100–300 fills/hovers, 500 base, 700–900 text on tints and pressed |
| Body text on accent | Accent vs ground is only ≥3:1 — paragraph-size accent text must use `--color-accent-700` |
| Type | Headings **Caprasimo** 400 (`--font-heading`); body **Figtree** 300–700 (`--font-body`), 15px/1.55 |
| Heading scale | h1 42 · h2 32 · h3 25 · h4 20 · h5 16 · h6 13 uppercase +0.08em. Page titles override: hero 76, page H1 52–56, section H2 36–38 |
| Space | 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2 px (`--space-1,2,3,4,6,8`) |
| Radius | sm 8 · md 16 · lg 28; containers `lg × 1.15`, big panels `lg × 1.4–1.6`, controls 999px |
| Elevation | `--shadow-sm/md/lg`, ink-tinted |
| Icons | Lucide, stroke-width 2.75 |
| Motion | `orgIn` .35s (fade + 10px rise) on page enter; `orgUp` .45s for confirmation/toast; `.lift` hover = translateY(-4px), .35s cubic-bezier(.2,.7,.3,1) |
| Layout | Content max-width **1360px**, side padding `--space-8`; sticky header (bg @92% + 10px blur); sticky side rails at `top:110px` |

States are themed, never browser default: hover tint + pressed one ramp step darker, `:focus-visible` 2px accent ring offset 2px,
disabled 45% opacity.

## Shared components

| Component | Spec |
| --- | --- |
| Button | `.btn` + `-primary` (accent fill) / `-secondary` (divider outline) / `-ghost` (accent text) / `-icon` (36px) / `-block`. Heading font, 14–15px, pill |
| Tag | `.tag-accent` (made to order, in-workshop), `-accent-2` (category, on-its-way/packing), `-neutral` (reference, delivered, lead time), `-outline` (search suggestions) |
| Input / Field | Pill input on `--color-surface`, 12px label above; focus border accent |
| Radio | Custom dot, accent when checked |
| Segmented | `.seg` — used for sort (PLP) and size (PDP); selected fills accent |
| Card | `.card` surface fill, `elev-sm/md`; kicker (10px caps accent), title (heading 17px), meta (11px muted) |
| Product tile | Washed image (`.ph`, radius `lg×1.15`) + name (card-title) left / price right, baseline-aligned + maker line (card-meta). `.lift` on hover. Heights vary per context: 340 home, 330 PLP, 290 search/related, 300 story |
| Quantity stepper | Pill border, −/+ icon buttons, 26px count |
| Heart (save) | Outline → filled `currentColor` + accent when saved; floating 36px bg-coloured button top-right on tiles |
| Blob | `--color-accent-2-200` circle; decorative, or as icon holder (64–96px) |
| Section heading | h6 kicker in `accent-700` + h2 38px + optional right-aligned ghost "See all →" |
| Table | `.table` themed header + row rules; right-aligned status column using tags |
| Toast | Fixed bottom-right card `elev-lg`, message + "View bag" button, auto-dismiss 2.8s |
| Header | MALVA wordmark (26px) · primary nav (Shop, New in, Made to order, Journal; active = accent + 2px underline) · search pill (190px) · saved (heart) · Bag primary button with count · account icon |
| Footer | `--color-surface` band, 4-col grid (brand blurb 1.6fr + Shop / House / Help) |
| Announcement bar (Canvas frame) | "Complimentary white-glove delivery over €600 · See how it works" |

## Responsive (not drawn in the web prototype — to be decided)

The web prototype is desktop-only (1440 preview). Canvas shows `chrome/compactNav` and an expanded/collapsed (mobile) search.
Proposed breakpoints and collapse rules live in `PLAN.md` § Responsive; each page spec lists its intended collapse.

## Page structure

Pages are ordinary React components composed in code (D-045: no page builder, block registry or merchandiser-authored layout — never). Visual states for listing, product page and site chrome are taken from the Canvas frames; their block names and field schemas are not part of the product.

## Brand/data mismatch to resolve

The repo is `b2c-grocery` and its behavioral specs (`openspec/specs/`) describe grocery concerns (delivery slots, weight-based pricing,
substitutions, subscriptions). The design is a luxury home-decor shop (made-to-order, white-glove delivery, stylist concierge).
The specs in `design/specs/` describe the **visual/interaction design as drawn**, and mark where grocery behavior from `openspec/specs/`
must be layered in or where a design element has no grocery equivalent. Decide whether MALVA is the intended skin for the grocery starter.
