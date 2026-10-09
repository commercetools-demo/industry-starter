<!-- Imported from Claude Design project 6e1ae35d-1b59-4f01-a63f-9ae939e21423 (Store Launchpad — B2B Manufacturing Design System), README.md, condensed. Malva.html consumes this system's tokens (colors_and_type.css). Re-import for the full text. -->

# Store Launchpad — B2B Manufacturing Design System (condensed)

Design system and UI kit for commercetools Store Launchpad. Two sides: **B2B storefront** (home, PLP, PDP, cart, checkout, quote checkout, login/register, quick order, search) and **B2B account area** (dashboard, orders, quotes, purchase lists, approvals, addresses, recurring orders, settings, company admin).

Project contents: `colors_and_type.css`, `fonts/` (Inter 18/24/28pt), `assets/`, `preview/` token cards, `ui_kits/storefront` (Home, PLP, PDP, Cart), `ui_kits/admin` (Dashboard, Orders, Quotes, Purchase lists, Company admin), `ui_kits/shared/Primitives.jsx` (TopBar, Navbar, Footer, Button, Badge, Qty, Icons), `SKILL.md`.

## Content fundamentals
- Voice: professional, neutral, transactional; short task-oriented sentences; second person ("Your cart").
- Sentence case everywhere; buttons are short imperatives ("Request a quote", "Place order").
- Statuses are short labels (Pending, Confirmed, Delivered, Processing, Cancelled).
- Dates DD/MM/YYYY; currency symbol after the number with a space; quantities have a visible stepper.
- Forms: visible top label, helper text underneath; error = red border + explanatory sentence.
- Alerts: full sentence with a concrete action; empty states: plain instruction + one primary CTA.
- No emoji, no exclamation marks (except the greeting).

## Visual foundations
- Palette: near-black ink `#212121` on white; single accent navy `#173A5F`; washes `#F3F5F9`, `#F7F9FC`; border `#D1D1D1`; footer `#262626`.
- Type: Inter only. Body 14/16px, captions 12px, section 20–24px semibold, page title 32px bold, hero 40–48px bold. Letter-spacing -0.01em at display sizes.
- Spacing: 4px grid; paddings 8/12/16/24/32/48/64; card gutters 16–24.
- Radii: buttons and inputs **0 (sharp)**; cards/modals 4–8px; tags 4px.
- Shadows: card `0 1px 2px rgba(25,40,81,.05)`, raised `0 4px 12px rgba(0,0,0,.05)`, overlay `0 12px 32px rgba(0,0,0,.12)`.
- Hover: primary darkens, outline gets 6–8% navy fill, table rows wash `#F7F9FC`. Focus: 2px ring at 2px offset, navy.
- Imagery: realistic industrial photography, cool, no filters; hero photo darkened with a 30–45% black overlay.
- Icons: Heroicons outline 20/24px, monochrome.
- Layout: black 40px topbar, white 72px navbar; account area has a 260px left sidebar; footer dark slab.
