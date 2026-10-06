# Product listing page (PLP) — design spec

Source: `MALVA Web.dc.html` (screen `browse`), Canvas group *Category listing* (9 blocks).
Behavior: `openspec/specs/product-listing-page/spec.md`, `discovery-and-browse`, `search-results-page` (for the search variant).
Foundations: `../DESIGN.md`.

## Layout
Page padding-top 35px. Header: h6 kicker "The shop" (`accent-700`), H1 56px = category name ("Everything" by default).
Below: 2-col grid `230px / 1fr`, gap ≈42px, aligned start.

### Left rail — `listing/filters` (sticky, top 110px, gap 26px)
| Group | Control |
| --- | --- |
| Category | Vertical list of pill rows: name left, count right (60% opacity). Active = accent fill, bg text, weight 600. Hover = 7% ink tint |
| Price | Wrapping pill tags: *Any price, Under €150, €150–400, Over €400*; active = accent fill + border |
| Availability | Radios: *Everything, In stock, Made to order* |
| Clear all | Ghost button, 13px |

### Main column
1. **Toolbar** (`resultCount` + `sort`): left "N objects" (14px, 60% muted); right `.seg` with *Curated · Newest · Price ↑ · Price ↓*. Bottom divider, 17.6px padding below.
2. **Grid** (`listing/grid`, columns 3|4, drawn 3): gap 26px × 17.6px. Tile = washed image 330px + heart button (36px, top-right 12px, bg-coloured, `shadow-sm`) + optional "Made to order" `tag-accent` (top-left) → name/price row → maker.
3. **Applied filters** (`appliedFilters`): chips with remove; shown above grid when any non-default filter is active (drawn in Canvas, not in the prototype).
4. **Pagination** (`pagination`): Previous · page numbers · Next, pill buttons, current = primary.
5. **Empty** (`listing/empty`): centred, H3 26px "Nothing under those terms", muted copy, `Clear filters` (secondary) + `Ask a stylist` (Canvas variant).

Breadcrumbs (`listing/breadcrumbs`): "Home / Shop / Lighting", slash-separated, last item current, shown above header in Canvas.
Header block option `showDescription` adds a category blurb under H1.

## Interactions
- Filter/sort changes update the result list in place (no page reload) and the URL query; count updates.
- Heart toggles saved without navigating (stops propagation); tile click → PDP, remembering PLP as the "Back" target with scroll position.
- Category change resets nothing else; **Clear all** resets category, price, availability and sort.
- Nav items "New in" (sort=Newest) and "Made to order" (availability=Made to order) deep-link to the same page with preset filters.

## States
Loading: skeleton tiles with the same heights · Empty: as above · Error: inline retry card · Saved: filled accent heart ·
Made to order: derived badge (design rule in prototype: price > €500 or Textiles — **must come from product data**).

## Responsive (proposed)
≥1200 rail + 3 (or 4) cols · 768–1199 rail becomes a "Filters" button opening a dialog/sheet, grid 2-col · <768 grid 2-col tight (gap 13px), sort becomes a select.

## Gaps vs. design
Only three filter facets drawn; real catalog needs dynamic facets from search (see `product-listing-page`). Grocery needs
weight-based price display (`weight-based-pricing`) and per-tile quick add — neither is drawn.

## Acceptance
1. Facets, sort and page are URL-addressable and shareable.
2. Counts in the category rail reflect the current other filters.
3. Heart state is session-resolved and never cached with the tile HTML.
4. Keyboard: all tiles/filters reachable, visible `:focus-visible` ring.
