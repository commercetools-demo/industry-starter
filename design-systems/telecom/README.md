# Telecom design system

Extracted from the Figma Community file **Telecom website theme** (the `.fig` is git-ignored; re-export it into this folder to re-extract).

## Files
- `tokens.css` / `tokens.json` — colors, type, spacing, radius, elevation (source of truth)
- `foundations/` — preview cards for colors, typography, spacing/radius/shadow
- `components/` — button, plan card, syntax chip, navigation

## Principles
- **Brand red on white.** Red (`brand-600`..`800`) carries headers, nav and CTAs; surfaces are white or `neutral-100`; amber is a sparing accent.
- **Pills and soft cards.** Buttons and CTAs are fully rounded (`radius-pill`); cards use `radius-lg`/`radius-xl`.
- **Exo for UI.** Headings, nav, plan names use Exo with 1px tracking; Inter ExtraBold for registration syntax; Roboto for body copy.
- **Plan card pattern.** Red header → triangle-bulleted benefits → hairline divider, validity, outlined pill CTA.
- Source copy is Vietnamese; swap text freely, keep structure.

## Caveats
Extracted from the file's raw node data: the Figma file has no named styles or variables, so token names are assigned by usage frequency, not designer intent. Some Figma values (e.g. magenta `#f828a5` glows, 45px radii) are decorative one-offs and were left out.
