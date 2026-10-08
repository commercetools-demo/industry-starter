<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Healthcare design tokens as the single source of brand values

## Purpose

The Malva Healthcare design (Azure actions, navy ink, soft sky surfaces, 8px controls, Poppins/Lato/Roboto) is defined in Claude Design as a token set. If the storefront restates those values as literals or renames them, the next design revision has to be re-applied by hand on every component and the two drift. Carrying the tokens once, under their design names, makes a design change a file replacement and makes departures (raw hex, raw px, an unlisted font) detectable by a linter instead of by eye.

Design reference: `design/DESIGN.md`; token source `design/source/_ds/tokens.css`.

## Requirements

### Requirement: Design tokens carried verbatim and used by name

The system SHALL expose every custom property of `design/source/_ds/tokens.css` under the same name and value in the storefront theme, SHALL style components through those tokens rather than literal colors, pixel sizes or font names, and SHALL load only the Poppins, Lato and Roboto families.

#### Scenario: Token parity
- **GIVEN** the storefront theme and `design/source/_ds/tokens.css`
- **WHEN** the parity check runs
- **THEN** it fails and names any token that is missing, renamed or differs in value

#### Scenario: Raw value in a component
- **GIVEN** a component using a hex color, a `px` literal for spacing, or a font family outside Poppins, Lato and Roboto
- **WHEN** the design lint (rules of `design/source/_ds/_adherence.oxlintrc.json`) runs
- **THEN** it warns with the rule message

#### Scenario: Fonts without a flash of wrong type
- **GIVEN** a first page load
- **WHEN** fonts load
- **THEN** the families are self-hosted through the framework font loader (not the token file's runtime Google Fonts `@import`) and exposed as `--font-display`, `--font-meta`, `--font-body`

### Requirement: Semantic roles of color

The system SHALL use azure for actions, navy for headings and totals, and status colors only for their meaning.

#### Scenario: Action color
- **GIVEN** a primary button, link, active nav item, selected slot, selected radio card or active side-nav item
- **WHEN** it is rendered
- **THEN** it uses `--color-action` / `--color-brand-*`, with `--color-action-hover` on hover

#### Scenario: Green means available or free
- **GIVEN** a badge or label
- **WHEN** it renders "Available today", "FREE", "Results ready" or a normal lab value
- **THEN** it uses the success pair; processing uses warning; out-of-range uses danger; informational (next availability, booking reference) uses info; success color is not used for generic confirmations

#### Scenario: Status text meets contrast
- **GIVEN** badge text on a `-50` status background
- **WHEN** it renders
- **THEN** it uses a text color that reaches 4.5:1 against the background, supplied as storefront-extension tokens (the prototype's `#067a05`, `#8a5d00`, `#0a6f8c`, `#b3402a`) and flagged as not part of `tokens.css`

### Requirement: Accessible controls on the brand fill

The system SHALL keep text on `--color-brand-500` at WCAG AA contrast and SHALL show a visible focus indicator on every interactive element.

#### Scenario: Primary button label
- **GIVEN** a filled primary control (button, active nav underline label, active segmented item, active side-nav item)
- **WHEN** its label text is smaller than 18.66px bold / 24px regular
- **THEN** the label/background pair reaches 4.5:1 (white on `#2aa7ff` is about 2.6:1 and does not qualify); the chosen pair is recorded as decision D4 in `design/PLAN.md`

#### Scenario: Keyboard focus
- **GIVEN** a keyboard user tabbing through inputs, buttons, links, cards that navigate, day cells and slots
- **WHEN** an element receives focus
- **THEN** it shows a focus ring using a brand token (the prototype removes the outline on inputs and shows none elsewhere)

### Requirement: Shape and elevation

The system SHALL apply the radii and shadows of the design consistently.

#### Scenario: Radius by element
- **GIVEN** a component
- **WHEN** it renders
- **THEN** cards use `--radius-lg`; buttons, inputs, segmented controls and service cards use `--radius-md`; slots, small buttons, badges and filter chips use `--radius-sm`; hero image/CTA band use `--radius-xl`; avatars are circular; nothing is pill-shaped

## Components

| Component | Notes |
| --- | --- |
| Color tokens | brand/navy 50–950, neutral 0/25/50–700/900, status pairs, gradients sky/brand/peach, semantic aliases |
| Type tokens | `--font-display/meta/body`, `--text-xs…4xl` |
| Spacing, radius, elevation | `--space-1…8`, `--radius-sm…pill`, `--shadow-sm/md/lg`, `--container-width` |
| Storefront extensions | status `*-700` text colors; content container 1200px; flagged, not in the design file |

## commercetools

None — presentation only.

## Open questions

- D2: content container 1200px (prototype) vs `--container-width: 1440px` (token).
- D4: which label/fill pair resolves the 2.6:1 contrast.
