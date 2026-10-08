# Healthcare design system

Extracted from the Figma Community file **Desktop Designs : Healthcare Consultation** (the `.fig` is git-ignored; re-export it into this folder to re-extract).

## Files
- `tokens.css` / `tokens.json` — colors, gradients, type, spacing, radius, elevation (source of truth)
- `foundations/` — preview cards for colors, typography, spacing/radius/shadow
- `components/` — button, navigation, search bar, service/specialisation cards, doctor card, blog card, pagination, medication card, prescription card

## Principles
- **Azure brand, navy ink.** Azure (`brand-*`, base `#2aa7ff`) carries every action: buttons, active nav link, active pagination page, links. Navy (`navy-700` `#1b3c74`) carries section headings and the footer; `navy-900` `#102851` carries hero and nav text.
- **Soft sky surfaces.** Pages sit on `gradient-sky` or white; cards are white with `radius-lg` (15px) and a faint cool shadow. Inputs use `neutral-25` (`#fafbfe`), not a border.
- **8px controls.** Buttons, inputs and service cards use `radius-md`. The clinic booking action and filter chips use the tighter `radius-sm` (4px). Nothing is pill-shaped.
- **Poppins for UI.** Headings, nav, buttons and doctor names are Poppins (Medium for buttons, SemiBold for section titles). Lato carries meta lines (experience, ratings, filters); Roboto is footer-only.
- **Green means availability.** `success-500` marks "Available Today", "FREE" fees and the patient-satisfaction badge. Don't use it for generic positive actions.
- **Doctor card pattern.** Round photo on a peach gradient → Azure-cyan name → specialty and experience → location and clinic → fee → satisfaction badge; availability and the booking button sit in a right column.

## Caveats
- **Contrast.** White on `brand-500` is about 2.6:1, below WCAG AA for the 14px button labels. It matches the Figma, so the components keep it. For small text on white use `brand-600` or darker, and consider `brand-600` as the button fill.
- **Token names are inferred.** The Figma file has no named styles or variables, so tokens come from usage frequency in the raw node data. The brand and navy scales are generated from the two sampled anchors (`#2aa7ff`, `#1b3c74` / `#102851`); only those values appear in the design.
- **Medication and prescription cards are not in the Figma.** The file only has a "Medicines" nav link and drugstore/capsule icons. `medication-card` and `prescription-card` are composed from the existing tokens and patterns (doctor-card layout, `success`/`warning`/`danger` status dots, `radius-lg` cards, `radius-md` buttons) and are not designer-approved. Copy and prices are placeholders, in USD rather than the file's INR.
- **Left out.** The `#14bef0` cyan appears only as the doctor-name color and button stroke, so it is kept as `info-500` rather than a scale. Photos, brand illustrations, Font Awesome icons and the demo copy (Surya Nursing Home, INR fees, Indian addresses) are not part of the system; the cards use placeholder icons.
