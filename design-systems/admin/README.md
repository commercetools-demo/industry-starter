# Admin design system (B2B2X — the first B)

Back-office / seller-dashboard UI for any **manufacturer or brand that sells to other businesses**: the people who manage catalog, orders, customers (buyer accounts), pricing and payouts. Extracted from the Figma Community file **Bredar – Seller Dashboard – UI Design Kit** (the `.fig` is git-ignored; keep it in this folder to re-extract).

## Files
- `tokens.css` / `tokens.json` — primitive palette, semantic light + dark tokens, type, spacing, radius, elevation, layout (source of truth; the JSON is generated from the CSS)
- `foundations/` — colors (ramps + light/dark semantics), typography, spacing/radius/shadow/grid, iconography
- `components/` — see the table below
- `layouts/dashboard.html` — a full desktop + mobile dashboard composed from the components, with a light/dark toggle

| Area | Cards |
|---|---|
| Actions | `button` (primary/secondary, icon, group, load-more, spinner, reactions) |
| Forms | `form-fields` (input, textarea, upload, tags, OTP, search), `selection-controls` (checkbox, radio, toggle), `dropdown` (select, action menu, option lists), `date-picker` |
| Display | `badge-status`, `avatar-thumbnail`, `navigation-disclosure` (tabs, pagination, accordion, dividers, page/widget/modal titles, sticky bottom bar), `overlays` (tooltip, toast, modal, popover, notification + message items) |
| Shell | `sidebar` (expanded, collapsed, mobile), `top-bar` |
| Data | `table` (list rows, cells, grid view, bulk select), `charts` (line, combo, column, bar, donut, sparkline, legends, tooltip), `widgets` (the dashboard widget catalogue) |

## Principles
- **Quiet, near-monochrome chrome.** The action color is near-black (`--color-bg-brand` `#303030`), not a hue. Blue is reserved for *state*: active nav/tab text, selected checkbox/radio/day, focus and the caret.
- **Semantic tokens, never ramps, in components.** Use `--color-bg-*`, `--color-text-*`, `--color-border-*`; they flip with `data-theme="dark"`. Ramps (`--color-gray-12`…) are for charts, illustrations and new tokens only.
- **Status tints are filled chips, not outlines.** Success/warning/info/critical badges use the `*-subdued` fill with dark text (`--color-text`), r6.
- **Radius ladder.** 4 tooltip/status chip · 6 badge/checkbox/radio · 8 widget card, small button, tab, tag, toast · 12 button, input, nav item, table row, notification card · 16 modal, popover, menu · 32 floating sidebar rail · full for avatar, icon button, toggle.
- **Controls are 44px (medium) or 36px (small).** Inputs are 44px, dropdown fields 40px, icon buttons 36/44px round.
- **Inter only, always tight.** Every style carries −1 % to −3 % tracking (tokens: `--tracking-*`). Weights are 500 / 600 / 700; body copy is Semibold 15/24 by default. Chart axis, legend and tooltip labels use SF Pro Text (`--font-chart`).
- **Dark top bar in both themes.** `--color-bg-topbar` stays `#303030`; the sidebar is a floating rounded rail (`--color-bg-surface-subdued`) on the page canvas, with the active item as a white pill.
- **Widgets are the unit of layout.** White r8 cards, 24px vertical padding / 32px gap on desktop & tablet, 16px / 24px on mobile. Page widths 1440 / 1024 / 375; body widths 1100 / 940 / 375; widget columns 12-col 1020, 8-col 675, 4-col 329 (desktop), 892 / 552 / 324 (tablet), 343 (mobile).
- **Hover reveals actions.** Table rows and grid cards get `--color-bg-surface-hover` and surface their action buttons on hover; bulk selection raises the sticky bottom bar.

## Making it B2B
The kit is a generic seller dashboard, so for manufacturers/brands selling to businesses rename and extend, don't restyle:
- Customers → **Buyer accounts / business units** (company avatar, account manager, credit status chip)
- Orders → add **PO number, payment terms, approval status** chips (use `badge-status` warning/success/critical)
- Pricing → **customer-group price lists, tiered pricing, quote requests** reuse the table + pricing-table widget
- Catalog → **SKU / MOQ / lead time** columns use the metrics cell; stock levels use the number bar

## Caveats
- Extracted from the file's raw node data (kiwi-decoded `canvas.fig`), not from rendered output. Measurements, fills, radii, padding, and text styles are exact; interactions and animations are inferred from the variant names.
- **Dark theme** comes from the kit's `[ Theme ]` variable collection, with one deliberate change: Figma's dark page canvas is `#4a4a4a`, identical to the hover and brand fills, so those vanish against the page. `--color-bg-page` is `#1a1a1a` (gray-16) in dark here. Check dark mode against your own screens before shipping it.
- The kit's *Internal Only Canvas* also contains an older generic palette (Neutral/01–08, Primary/Secondary pastels, "Deprecated" styles). It is **not** used by the components and is left out.
- Icons are **redrawn approximations** (24px, 1.5 stroke) of the Figma vector set — swap in your icon library. The logo, product photography and emoji reactions are placeholders.
- Channel brand logos (Amazon, TikTok, Microsoft, Bing, LinkedIn, WhatsApp …) are not reproduced.
- No `.design-sync/config.json` yet: create the claude.ai design-system project and run `/design-sync` to link it.
