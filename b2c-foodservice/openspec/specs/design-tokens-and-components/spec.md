<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Design tokens and shared components

## Purpose

Every Malva Coffee screen is built from one token layer and a small set of shared atoms, so pages stay consistent and a re-skin is a token change rather than a page change. The system is inherited from VELA, which is bound to the commercetools presales design system: a warm off-white canvas, navy ink, violet and teal as restrained accents, large Archivo display type.

Design source: `app/colors_and_type.css` and `app/styles.css` in the VELA export.

## Requirements

### Requirement: Single token layer

The system SHALL style every surface from the semantic tokens below and SHALL NOT use raw colour, font or radius values in components.

| Token | VELA value | Role |
| --- | --- | --- |
| `--ink` | `#191741` | Primary text, primary button, footer and banner background |
| `--ink-2` | `#4F4F99` | Secondary text |
| `--ink-3` | `#7C7975` | Meta and muted text |
| `--canvas` | `#FBF9F5` | Page background |
| `--canvas-2` | `#F4F0E8` | Alternate section and image placeholder background |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--line`, `--line-2` | `#E7E2D9`, `#DEDAD4` | Hairlines and control borders |
| `--accent`, `--accent-press` | `#6359FF`, `#4242B2` | Links, focus, selected state, accent button |
| `--teal` | `#0BBFBF` | Availability and success |
| `--ct-amber-500` | `#FFB000` | Low stock |
| `--ct-danger` | `#E5484D` | Errors |
| `--maxw` | `1320px` | Content width, 32px side padding (20px under 820px) |

Values are VELA's until the brand re-skin decision (`design.md` D2) lands; only values change, never token names.

#### Scenario: Re-skin by token
- **GIVEN** the owner approves a Malva palette
- **WHEN** the token values are replaced
- **THEN** no component, page or spec requirement needs editing

### Requirement: Typography

The system SHALL use Archivo for display and headings (weights 600 to 800, negative tracking on large sizes), Roboto for body and UI at 15px with 1.55 line height, and Roboto Mono for order numbers, codes and cart counts. Eyebrows are 11px, uppercase, 0.18em tracking, weight 600. The brand wordmark is set in Archivo 800 with 0.16em letter spacing.

#### Scenario: Page title
- **GIVEN** any listing, cart or account page
- **WHEN** the page title renders
- **THEN** it is Archivo 800 at 34 to 40px with -0.025em tracking, and the hero title scales with `clamp(44px, 5.6vw, 82px)`

### Requirement: Shape, spacing and motion

The system SHALL use pill radius (999px) for buttons, chips, inputs in search and badges; 10px for form fields and selectors; 16px for cards; 24 to 32px for hero and banner panels. Spacing follows an 8px base. Transitions are 120ms (press), 200ms (hover, state) and 320ms (drawer, entrance); entrance animation is a 10px upward translate only and is disabled under `prefers-reduced-motion`.

#### Scenario: Content never hidden at rest
- **GIVEN** a user with reduced motion or an offscreen render
- **WHEN** a page mounts
- **THEN** all content is visible without any animation having run

### Requirement: Shared atoms

The system SHALL provide these atoms with the states shown, and every page SHALL compose from them.

| Atom | Variants and states |
| --- | --- |
| Button | `ink` (default), `accent`, `ghost`; `lg` size; block; disabled at 40% opacity; 0.985 press scale |
| Chip | default, hover (ink border), active (ink fill) |
| Field | label 12.5px weight 600 above input; focus ring `0 0 0 3px` accent at 14% |
| Option button | selected (ink fill), disabled (struck through, muted fill) for variant choice |
| Colour swatch | 14px in cards, 42px on the detail page, selected ring `2px canvas + 4px ink` |
| Stepper | pill, minus and plus, 38px targets |
| Card | surface, 1px line, 16px radius, 24px padding |
| Badge | pill, 10px uppercase; `ink` (Bestseller), `accent` (New) |
| Availability dot | 7px; teal in stock, amber low, stone out |
| Rating | filled star, value, count |
| Drawer | right side, 440px, overlay at 42% ink |
| Modal | centred, 560px, 24px radius |
| Toast | bottom centre pill, ink, teal check, 2.2s |
| Steps | numbered circles with connector; active ink, done teal |

#### Scenario: Disabled option explains itself
- **GIVEN** a variant option that is not available for the chosen fulfilment
- **WHEN** it renders
- **THEN** it is struck through, not selectable, and carries a title stating why

### Requirement: Iconography

The system SHALL use one inline icon set with 24px viewBox, 1.75 stroke, round caps, drawn from the VELA `ICONS` map, and SHALL NOT use emoji. New glyphs are added to the set, not imported from elsewhere. Coffee-specific glyphs (cup, bean, capsule, machine) are added to the same style.

#### Scenario: New glyph
- **GIVEN** a screen needs a capsule icon
- **WHEN** it is added
- **THEN** it is a 24px, 1.75 stroke, round-cap path in the shared set

### Requirement: Breakpoints

The system SHALL respond at 1080px (grids to 3 columns), 900px (detail, cart and account grids to one column, hero image hidden), 820px (mobile navigation, 2-column product grid, 20px padding), 700px and 520px (smaller brand wordmark).

#### Scenario: Phone
- **GIVEN** a 390px viewport
- **WHEN** a listing renders
- **THEN** the grid is two columns, the nav is the slide-in menu, and filters open as a full-height sheet

### Requirement: Accessibility

The system SHALL keep text contrast at WCAG AA against canvas and surface, give every icon-only control an `aria-label`, mark decorative icons `aria-hidden`, and keep focus visible on every control.

#### Scenario: Icon button
- **GIVEN** the cart, search or close icon button
- **WHEN** a screen reader reads it
- **THEN** it announces its purpose, not "button"
