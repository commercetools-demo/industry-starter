# Product detail page (PDP) — design spec

Source: `MALVA Web.dc.html` (screen `pdp`), Canvas group *Product detail* (12 blocks).
Behavior: `openspec/specs/product-detail-page/spec.md`, plus `weight-based-pricing`, `out-of-stock-substitutions`, `saved-lists`, `subscriptions-and-recurring-orders` where applicable.
Foundations: `../DESIGN.md`.

## Layout
Top: ghost "← Back" (13px) returns to the previous screen. Hero grid `1.15fr / 1fr`, gap ≈49px, aligned start.

### Left — `pdp/gallery`
2-col grid, gap 13px: primary image spans 2 cols, 600px tall; two secondary images 290px (detail, in-situ). All washed, radius `lg×1.15`.

### Right — buy box (sticky, top 110px)
Order of blocks:
1. `pdp/identity`: tags (`accent-2` category, `neutral` reference e.g. MLV-LT-041); H1 48px/1.02; maker line 15px muted; optional rating (`showRating`) and brand (`showBrand`).
2. `pdp/price`: heading font 30px, € formatting; `showSaving` adds struck-through original + saving.
3. `pdp/description`: 16px/1.7 at 75% text.
4. `pdp/options` (Canvas): **Finish** swatch circles 44px (ring on selected, selected name on the right of an h6 label); **Size** `.seg` (Small/Medium/Large); **Fitting** radios (Plug-in/Hardwired).
5. `pdp/addToBag` row: quantity stepper · *Add to bag* (primary, flex 1, 15px) · `pdp/saveControl` heart 44px secondary.
6. Concierge note (toggle): `accent-2-100` rounded strip "Unsure of the scale? A stylist will size it to your room." + ghost *Ask →*.
7. `pdp/availability`: name + note, e.g. "In stock · ships in 3 days" or "Made to order · 6–8 weeks".
8. `pdp/specs`: `.table` of Maker, Reference, Material, Lead time, Care; `defaultOpen` specs|none (accordion in Canvas).

### Below
- `pdp/related` "Pairs with": H2 36px, 4-col tiles 290px (`count` authored). Prototype rule: other categories only.
- `pdp/reviews` (Canvas): large "4.8", "36 reviews", 5-bar distribution, *Write a review*, review cards with initials avatar, name, meta, title, body.
- `pdp/breadcrumbs`: Home / Shop / Lighting / Product.

## Interactions
- Add to bag: adds `qty`, shows toast "Added to your bag" + *View bag* (2.8s), bag count in header updates.
- Heart toggles saved; quantity min 1.
- Selecting options updates price/availability/gallery image where variant-specific.
- Related tile → another PDP, resets qty to 1.

## States
Default · Out of stock (add button disabled at 45%, availability states it, offer notify/alternatives per `out-of-stock-substitutions`) ·
Made to order (lead-time tag in cart) · Saved · Loading skeleton for gallery/buy box · Option unavailable (swatch/seg disabled).

## Responsive (proposed)
≥1200 as drawn · 768–1199 single column, gallery first, buy box not sticky · <768 gallery as swipe carousel with dots, sticky bottom bar with price + Add to bag.

## Gaps vs. design
Variant/option logic and reviews data source are not defined by the prototype. Grocery: unit/weight selector, price-per-unit, substitution preference,
subscribe-and-save are not drawn.

## Acceptance
1. Buy box stays visible while scrolling the gallery at ≥1200.
2. Price, availability and options come from the selected variant; none are hard-coded.
3. All images have alt text (authored `imageAlt` / product data).
4. Add to bag is idempotent per click and shows exactly one toast.
