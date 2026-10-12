<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seller-adjustable storefront theme (Contentools theme, mapped to automotive tokens)

## Purpose

Every reseller runs a storefront on Malva's platform with its own domain, branding and retail prices, and adapts it from the seller portal. Decisions of 2026-10-12: **the theme is stored in Contentools** (the multi-tenant CMS service, `/Users/behnam/code/cms`), edited with Contentools' own `ThemeManager`, with theme history handled by Contentools; the storefront renders Puck pages with Contentools' renderers; and the storefront takes **only the theme** from Contentools configuration (header, footer and the other configuration documents are not used). This spec fixes how the theme document maps onto the automotive design system and which parts a reseller cannot change.

Design source: `design/export/tokens.automotive.css` (identical to `design-systems/automotive/tokens.css`), `design/export/Reseller Storefront.dc.html`. Contentools sources: `service/src/routes/configuration.route.ts`, `puck/packages/puck-types/src/theme-types.ts`, `puck/packages/puck-theme-manager/src/presets.ts`.

## How Contentools stores and serves the theme

| Fact | Detail |
| --- | --- |
| Storage | commercetools custom object, container `configuration`, key `{storeKey}-theme` (the store key is passed to Contentools as `businessUnitKey`) |
| Read | `GET {CONTENTOOLS_ORIGIN}/service/{storeKey}/configuration/theme` with header `x-project-key` (no user token); 404 means no theme |
| Write | `POST` / `PUT` / `DELETE` same path, needs a JWT and a validated project |
| Fallback | A read for a store with no theme returns the `default` namespace's theme |
| Document | `ThemeTokens` (colours, radius, border, fonts, weights, spacing scale, button, card shadow, header style, shadow style, blur, etc.) |
| CSS | `buildCssVars(tokens)` turns it into CSS custom properties (`--color-primary`, `--color-primary-hover`, `--border-radius`, `--font-heading`, …) |
| Editing and history | `ThemeManager` (`@commercetools-demo/puck-theme-manager`) with presets; Contentools owns editing and history, the portal builds neither |
| Not used | The sibling documents `header`, `footer`, `facet`, `site-metadata`, `category-listing`, `translations`, `b2b-account-menu-links` are ignored by the storefront |

## Requirements

### Requirement: One theme per reseller store, resolved by the store key

The system SHALL read the theme with the store key from the URL path (`/[locale]/[store]/…`), and SHALL seed the `default` namespace with the Malva automotive theme so a store without a theme looks like the design. A reseller is one store; its branches share that store's theme.

#### Scenario: Branches share the store theme
- **GIVEN** a reseller store with branches Hamburg and Berlin
- **WHEN** either branch's pages render under the same store path
- **THEN** both use the store's theme

#### Scenario: No theme saved
- **GIVEN** a reseller that never edited its theme
- **WHEN** the storefront renders
- **THEN** it shows the `default` theme, which is the Garage Maroon design

### Requirement: Storefront renders only from semantic automotive tokens through an adapter

The system SHALL render every shopper-facing surface with the automotive design-system tokens, and SHALL define those tokens in one adapter layer from the Contentools CSS variables. Components SHALL NOT hard-code colours, fonts or radii.

| Contentools value | Automotive tokens it drives |
| --- | --- |
| `colorPrimary` | `--color-brand-700`, `--color-action`, `--color-text-link`, `--color-text-price`, `--color-focus`, `--color-border-brand`; ramp `--color-brand-50…950` derived from it |
| `colorPrimaryHover` | `--color-action-hover` (brand-600) |
| `colorPrimaryForeground` | `--color-text-on-brand` (white when absent, as `buildCssVars` does) |
| `colorSecondary` | `--color-surface-utility` (top bar, footer) |
| Derived from primary | `--color-brand-deep` (hero band, category tiles) = brand-800 |
| `colorAccent` | `--color-accent-*` (ratings, savings chip, hero label), ramp derived |
| `colorBackground` | `--color-surface-page` |
| `colorSurface` | `--color-surface`, `--color-surface-quiet` |
| `colorText`, `colorTextMuted` | `--color-text`, `--color-text-muted` |
| `colorBorder` | `--color-border`, `--color-border-strong` (derived) |
| `fontHeading` | `--font-display` |
| `fontFamily` | `--font-body`, `--font-ui`, `--font-utility` |
| `borderRadius` | Radius scale: none = 0, sm = compact, md = design default, lg = soft, full = pill for buttons |
| `cardShadow` / `shadowStyle` | `--shadow-card` |
| `buttonStyle` | Secondary buttons only; primary calls to action (Add to cart, Checkout, Place order) stay solid |

#### Scenario: Token change reaches every surface
- **GIVEN** a reseller whose `colorPrimary` is not the Malva maroon
- **WHEN** home, listing, product, cart, checkout and confirmation render
- **THEN** buttons, links, prices, focus rings, selected states, hero band and category tiles show the reseller colour and none keeps the default maroon

#### Scenario: Raw values are rejected at review
- **GIVEN** a component with a raw hex colour, font name or radius
- **WHEN** linted
- **THEN** the lint fails and names the token to use

### Requirement: Locked tokens and unsupported theme fields

The system SHALL keep these identical for every reseller: status colours, fit-badge colours and glyphs (✓, ✕), spacing scale and layout widths (`--content-width` 1200, `--container-width` 1440), focus ring width, and the primary-button solid style. The storefront SHALL ignore ThemeTokens it does not support (glass, blur, neumorphic and clay shadow styles, background noise or gradient, animation style, `headerStyle`, `spacingScale`, `colorDestructive` for fit state).

#### Scenario: Reseller picks a glass preset
- **GIVEN** a theme using a surface-blur preset
- **WHEN** the storefront renders
- **THEN** colours, fonts and radius apply and blur is ignored, with no layout change

#### Scenario: Fit colours do not follow the theme
- **GIVEN** a destructive colour set to orange
- **WHEN** a non-fitting part renders
- **THEN** the badge still uses the locked danger tint with ✕

### Requirement: Fonts are loaded from an allow-list

The system SHALL load a font only if it is on an approved list (Poppins, Archivo, Inter, Public Sans, plus approved additions) and SHALL fall back to `system-ui` for any other family string.

#### Scenario: Unknown family
- **GIVEN** `fontFamily` set to a family not on the list
- **WHEN** the storefront renders
- **THEN** it uses `system-ui` and loads no external font

### Requirement: Header and footer are application components

The system SHALL implement the storefront header and footer as application components styled only by the theme, and SHALL render the fitment disclaimer, the "sold and fulfilled by" line and legal links from application code that Puck content cannot remove. Store name, logo and favicon SHALL come from the store settings in the portal (`seller-portal/design-store-and-channels`), not from Contentools.

#### Scenario: Reseller edits content
- **GIVEN** a reseller who edits Puck pages and the theme
- **WHEN** any page renders
- **THEN** the header, footer, disclaimer and legal links are unchanged in structure

### Requirement: External theme values are sanitised and applied at first paint

The system SHALL sanitise every theme value from Contentools against a safe-CSS pattern before it is placed in CSS, and SHALL inline the resulting variables as `<style id="store-theme">` in the root layout's head after the `@theme` defaults, so the first paint has the right theme and `:root` overrides win.

#### Scenario: Hostile value
- **GIVEN** a theme value containing `;}</style><script>`
- **WHEN** the style block is built
- **THEN** the value is dropped or replaced by the default and no markup is injected

### Requirement: Theme changes apply predictably

The system SHALL cache the theme per reseller with a short time-to-live, show the new theme on all pages once the cache expires, and fall back to the last cached theme, or the built-in default, if the Contentools call fails.

#### Scenario: Contentools unavailable
- **GIVEN** the theme endpoint failing
- **WHEN** the storefront renders
- **THEN** it uses the last cached theme, or the built-in default if none, and the page still works

## Components

| Component | Notes |
| --- | --- |
| Theme loader (server) | `lib/contentools/theme.ts`: plain `fetch` of the theme with `x-project-key`, React `cache()`, `null` when absent, falls back |
| Sanitiser | Checks every external value against a safe-CSS pattern before it reaches a `<style>` block |
| Token adapter | Builds the automotive token block from Contentools CSS variables and derives the ramps |
| Font loader | Allow-list only |
| `ThemeManager` host (seller portal) | Specified in `seller-portal/design-storefront-theme-and-branding` |

## Gaps and decisions

- No contrast checking (decision 2026-10-12). A reseller can choose colours that read poorly; the only protection is that fit colours, status colours and layout are locked.
- The prototype hard-codes `#821810` inline, so it cannot be themed as built.
- The prototype mixes several businesses under one brand; with this model the brand slot is the store name and logo of the reseller that owns the domain.
- The seller portal is not reseller-themed and uses the admin kit.

## Platform notes

Contentools writes with a JWT and project validation and is multi-tenant per commercetools project; the storefront reads with the project key only. The JWT is global to the project and is held server-side by the portal (`seller-portal/bootstrap-and-structure`). The `multitenant contentools` Merchant Center app must be installed and connected once by an operator. Load `commercetools-storefront` and `commercetools-connect` (Contentools can deploy as a Connect service) before wiring.
