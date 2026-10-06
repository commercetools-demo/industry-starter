# Homepage — design spec

Source: `MALVA Web.dc.html` (screen `home`), Canvas groups *Content* + *Site chrome*.
Behavior: `openspec/specs/home-landing-page/spec.md` (session-resolved buyer context, `[STATIC]/[CACHED]/[MIDDLEWARE]` tags).
Foundations: `../DESIGN.md`.

## Purpose
Establish the brand, route to categories and new arrivals, and surface editorial content. Shared merchandising is cacheable;
cart count and account name come from the session.

## Layout (1440, max-width 1360, side padding 35px, `orgIn` on enter)

Two merchandiser-selectable hero variants (`homeLayout`):

| # | Section | Detail |
| --- | --- | --- |
| 1a | **Editorial hero** (default) | 2-col grid `1.05fr / 1fr`, centred vertically. Left: sage blob (210px, 50% opacity, offset −90/−60) behind tag-accent-2 "Autumn 26 · Chapter one", H1 76px/0.98 max 9em "The quiet table", 18px body (72% text), buttons *Shop the collection* (primary) + *Read the story* (secondary), both 15px. Right: washed image 560px tall |
| 1b | **Magazine grid** | H1 62px "A house made of small decisions" over a 3-col grid, rows 230px, gap 17.6: tile A spans 2×2 (table setting → editorial), B, C, D single (→ browse), E spans 2 cols (workshop → editorial). All tiles `.lift` |
| 2 | **Category showcase** | Section heading "The rooms / Browse by what it does" + ghost "Everything →". 6-col grid of cards (elev-sm, `.lift`): 130px image, name, "NN pieces" meta. Categories: Lighting, Textiles, Furniture, Vases, Tableware, Scent |
| 3 | **Curated products** | Heading "New in / Just off the loom and wheel" + "See all →". 4-col grid of product tiles, image 340px |
| 4 | **Editorial** | Full-width panel `accent-2-700`, radius `lg×1.6`, padding 35px, 2-col: kicker "From the journal · No. 14" (`accent-2-200`), H2 44px (bg colour) "Living with alabaster", 17px body, inverted button (bg fill, `accent-2-800` text) → journal. Right: image 380px on `accent-2-300` |
| 5 | **Concierge strip** (toggle `concierge`) | Outlined panel (divider border, radius `lg×1.4`): 64px blob + chat icon, H3 24px "Ask a stylist", 15px copy, primary "Start a conversation" |
| 6 | Footer | See DESIGN.md |

Vertical rhythm: sections separated by `space-8 × 1.6` (≈56px); bottom page padding 120px.

## Blocks used (Canvas)
`hero` (hero 1a), `sectionHeading`, `categoryShowcase` (count default 6), `curatedProducts` (count 4), `editorial` (imageSide), `promoBanner`
(emphasis primary|accent, e.g. "Two rooms, one delivery"), `newsletterSignup` ("One note a month, no noise"), plus all `chrome/*`.

## Interactions
- Whole tiles/cards are click targets; hover lifts 4px.
- Hero CTAs → browse (`shop`) / editorial. Heart on tiles is not shown on home tiles (only on PLP).
- Header: nav items set active underline; search pill → search screen; bag button → cart; heart → saved; user icon → account.

## States
| State | Behavior |
| --- | --- |
| Anonymous | Account icon links to sign-in; no account-dependent slots rendered (per `home-landing-page`) |
| Empty bag | Bag button reads "Bag"; with items "Bag · N" |
| Concierge off | Section 5 omitted entirely, no gap |
| Missing image | Neutral-200 placeholder block with caption; keep aspect heights |

## Responsive (proposed)
≥1200 as drawn · 768–1199 hero stacks (image below copy, 420px), categories 3-col, products 2-col · <768 single column, categories horizontal
scroll-snap, editorial panel stacks, header collapses to `chrome/compactNav` + collapsed search.

## Gaps vs. design
No newsletter or promo banner appears on the drawn home page (only in Canvas) — place them between 4 and 5 when authored.
Grocery adaptation: "Recently ordered / Recommended for you" and quick-order from `home-landing-page` have **no drawn design**; need a design decision.

## Acceptance
1. Hero variant switches without layout shift in other sections.
2. All colors/spacing resolve to tokens (no hex literals).
3. LCP image is the hero; below-fold images lazy.
4. Cart count never appears in cached HTML.
