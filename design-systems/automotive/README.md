# Automotive design system

Extracted from the Figma Community file **Auto Parts Website** — a Canadian retailer of OEM and aftermarket auto parts (the `.fig` is git-ignored; keep it in this folder to re-extract).

## Files
- `tokens.css` / `tokens.json` — colors, type, spacing, radius, elevation (source of truth; the JSON is generated from the CSS)
- `foundations/` — preview cards for colors, typography, spacing/radius/shadow
- `components/` — button, form fields, badge/rating/fitment, product card, cart, cart selector (header icon + mini-cart), navigation + footer

## Principles
- **Garage Maroon carries action.** `brand-700` (`#821810`) is the one action color: primary buttons, prices, links, active nav, card outlines. `brand-deep` (`#810000`) is only for the search header band and the category tiles. Hover goes to `brand-600`, pressed to `brand-900`.
- **Chrome Gold is trim, not action.** `accent-*` is for ratings, premium/OEM badges and the occasional gradient. Never use gold for buttons or links.
- **Black frames the page.** The delivery bar and footer are `neutral-1000`; the page background is the near-white `neutral-25`, with white cards on top.
- **Square-ish controls, pill for hero CTAs.** Buttons and inputs are 2–3px radius (56px tall primary, 48px compact, 44px fields). Pills (`radius-pill`) are reserved for hero actions such as "Verify" and "Watch now".
- **Price is brand-colored.** Current price is `brand-700` in Poppins SemiBold; the struck-through old price is `neutral-500`.
- **Poppins for almost everything.** Archivo is only for utility links ("show more >", "View All", sign in) and service blurbs; Public Sans is for form fields, badges and table headers.
- **Fitment is a first-class state.** The Year/Brand/Model selector and the green/red fit status pill belong on product pages and cards.
- 1440px canvas, 1200px content width, 4px spacing scale. Copy is Canadian English; show prices in CAD with `$`.

## Caveats
- Extracted from the file's raw node data. The file has no named color or text styles for the site itself (its "Internal Only Canvas" page is a generic e-commerce UI kit), so brand and accent ramp names are assigned by usage frequency; step values `50–950` between the sampled hexes are interpolated.
- The UI kit's orange (`#fa8232`) focus/primary color was **replaced with brand maroon**, since the site never uses it.
- Site text sizes of 17/21/23px were rounded to the 16/20/24 scale. Montserrat and Days One appear only in imagery/logo lockups and were left out.
- The logo, photography and icons are not included — the cards use placeholders.
- No `.design-sync/config.json` yet: create the claude.ai design-system project and run `/design-sync` to link it.
