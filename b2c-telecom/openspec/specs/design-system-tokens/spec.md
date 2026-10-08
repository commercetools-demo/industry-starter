<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Telecom design tokens as the single source of brand values

## Purpose

The Malva Telecom design (Honey Locust yellow structure, After-Party Pink actions, pill buttons, Exo/Inter/Roboto type) is defined in Claude Design as a token set. If the storefront restates those values as literals, or renames them, the next design revision has to be re-applied by hand on every component and the two drift until nobody knows which is right. Carrying the tokens once, under their design names, makes a design change a file replacement and makes departures (raw hex, raw px, an unlisted font) detectable by a linter instead of by eye.

Design reference: `design/DESIGN.md`, token source `design/source/_ds/tokens.css`.

## Plan notes

**As built by workstream C (D-053).** Tokens carry over verbatim; the extension block adds `--color-danger: #a1262b` and `--ext-` prefixed off-scale values. Some contrast figures in the plan were corrected (white on pink-950 is 15.74).

## Requirements

### Requirement: Design tokens carried verbatim and used by name

The system SHALL expose every custom property of `design/source/_ds/tokens.css` under the same name and value in the storefront theme, SHALL style components through those tokens rather than literal colors, pixel sizes or font names, and SHALL load only the Exo, Inter and Roboto families.

#### Scenario: Token parity
- **GIVEN** the storefront theme and `design/source/_ds/tokens.css`
- **WHEN** the parity check runs
- **THEN** it fails and names any token that is missing, renamed or differs in value

#### Scenario: Raw value in a component
- **GIVEN** a component that uses a hex color, a `px` literal for spacing, or a font family outside Exo, Inter and Roboto
- **WHEN** the design lint (`design/source/_ds/_adherence.oxlintrc.json` rules) runs
- **THEN** it warns with the rule message; the Broadband Facts label is the only exempt component (see `broadband-facts-label`)

#### Scenario: Text on a brand surface
- **GIVEN** any element on `--color-brand-*` 500 or lighter
- **WHEN** it is rendered
- **THEN** its text uses `--color-text-on-brand` (or `--color-brand-950`), never white; white text appears only on `--color-pink-700` and darker or on `--color-brand-950`

#### Scenario: Actions are pink
- **GIVEN** a primary call to action, link, bullet marker or selected state
- **WHEN** it is rendered
- **THEN** it uses `--color-action` / `--color-pink-*`, with `--color-action-hover` on hover, and is a fully rounded pill if it is a button

#### Scenario: Fonts available without a flash of wrong type
- **GIVEN** a first page load
- **WHEN** fonts load
- **THEN** Exo, Inter and Roboto are self-hosted through the framework font loader (not the design file's runtime Google Fonts `@import`) and exposed as `--font-display`, `--font-cta`, `--font-body`

## Components

| Component | Notes |
| --- | --- |
| Color tokens | `--color-brand-50…950` + `--color-brand-gradient`; `--color-pink-50…950`; `--color-neutral-0,50,100,200,300,400,500,600,700,900`; semantic aliases (`text`, `text-muted`, `text-on-brand`, `text-on-pink`, `text-link`, `surface`, `surface-subtle`, `surface-brand`, `surface-brand-subtle`, `border`, `border-brand`, `border-on-brand`, `action`, `action-hover`) |
| Type tokens | `--font-display/cta/body`, `--text-xs…5xl` (12,14,16,18,20,24,26,36,40), `--tracking-ui` 1px |
| Spacing | `--space-1…9` = 4, 6, 8, 10, 16, 20, 24, 30, 40; `--container-width` 1440px |
| Radius | `--radius-sm 6`, `md 12`, `lg 20`, `xl 24`, `pill 100` |
| Elevation | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Declaration | Tokens declared in `:root` and mapped into Tailwind v4 `@theme` in `globals.css` (see `storefront-project-bootstrap`: "Malva theme tokens") |
| Extensions | Tokens the design lacks but the prototype hard-codes: error color (`#a1262b` → proposed `--color-danger`), off-scale spacing 12/14/28/32/36/48/56/64, display sizes 30/48/56 — added in a clearly marked "storefront extensions" block so they cannot be confused with design tokens |
| Parity check | Script compares theme tokens to `tokens.css`; runs in CI |
| Design lint | The `no-restricted-syntax` rules from `_adherence.oxlintrc.json` (hex, px, font-family) |

## commercetools

Not applicable: this capability carries no commerce data. Brand values live only in the theme.

## commercetools skills

Load `commercetools-storefront` (Next.js stack adapter) before implementing this capability. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Extend the token set with spacing/type/danger additions upstream in the design system, or keep them as storefront-local extensions? Local is the safe default until the design owner agrees.
- The tokens were extracted from a Figma file with no named styles, so names reflect usage frequency, not designer intent; confirm the scale names (`--space-5` = 16px, `--text-3xl` = 26px) are stable before building on them.
- Contrast: white on `pink-700` (#8745ae) passes AA for normal text; confirm `pink-700` on `brand-100`/white for link text and `brand-800` on `brand-100` for breadcrumbs before sign-off.
