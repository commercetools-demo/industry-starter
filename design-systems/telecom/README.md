# Telecom design system

Extracted from the Figma Community file **Telecom website theme** (the `.fig` is git-ignored; re-export it into this folder to re-extract).

## Files
- `tokens.css` / `tokens.json` — colors, type, spacing, radius, elevation (source of truth)
- `foundations/` — preview cards for colors, typography, spacing/radius/shadow
- `components/` — button, plan card, syntax chip, navigation

## Principles
- **Honey Locust brand, After-Party Pink complement.** Honey Locust (`brand-*`, base `#f9c162`) carries headers and nav; After-Party Pink (`pink-*`, base `#c162f9`) carries actions: CTAs, links, bullets. Surfaces are white or `neutral-100`.
- **Light brand means dark text.** Never put white text on `brand-500`; use `text-on-brand` (`brand-950`). White text is fine on `pink-700` and darker.
- **Pills and soft cards.** Buttons and CTAs are fully rounded (`radius-pill`); cards use `radius-lg`/`radius-xl`.
- **Exo for UI.** Headings, nav, plan names use Exo with 1px tracking; Inter ExtraBold for registration syntax; Roboto for body copy.
- **Plan card pattern.** Honey header → triangle-bulleted benefits → hairline divider, validity, pink outlined pill CTA.
- All copy is US English.

## Caveats
Extracted from the file's raw node data: the Figma file has no named styles or variables, so token names are assigned by usage frequency, not designer intent. The original red/amber palette was replaced with Honey Locust and After-Party Pink. Decorative one-offs (magenta glows, 45px radii) were left out.
