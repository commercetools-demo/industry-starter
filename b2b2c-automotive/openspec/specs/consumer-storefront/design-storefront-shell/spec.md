<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront shell: utility bar, header, category nav, footer

## Purpose

The shell wraps every shopper page. It carries the reseller's identity, the two contexts that change what a shopper sees (selected store and selected vehicle), search, account and cart. Getting it right once makes every page inherit the reseller's theme and context.

Design source: `Reseller Storefront.dc.html`, header, nav and footer blocks.

## Requirements

### Requirement: Shell carries identity and shopping context

The system SHALL show, on every page, the reseller wordmark, the current store, a search field, sign-in or account entry, the cart count and the category navigation.

#### Scenario: Context visible everywhere
- **GIVEN** a shopper who has chosen a store and a vehicle
- **WHEN** any page renders
- **THEN** the header shows "Your store" with store name and city and a Change control, and the vehicle chip is reachable from the header or page body

#### Scenario: Cart count reflects quantity
- **GIVEN** a cart with 2 units of one line and 1 unit of another
- **WHEN** the header renders
- **THEN** the cart control reads "Cart · 3"

### Requirement: Utility bar states commercial promises from configuration

The system SHALL render the top utility bar from reseller configuration (pickup promise, free-shipping threshold, currency and country, help and tracking links).

#### Scenario: Threshold follows the shipping rule
- **GIVEN** a reseller whose free-shipping threshold is €99
- **WHEN** the bar renders
- **THEN** it states €99, and the cart and checkout use the same figure

### Requirement: Category navigation and active state

The system SHALL render the first-level categories the reseller's assortment contains, with an underline on the active category, and an "All parts" entry first.

#### Scenario: Excluded line disappears
- **GIVEN** a reseller that excluded the Lighting line
- **WHEN** the navigation renders
- **THEN** Lighting is absent and no link leads to it

### Requirement: Responsive behaviour

The system SHALL keep the header usable from 375 px: the header wraps, category navigation scrolls horizontally, and controls stay at least 44 px tall.

#### Scenario: Narrow viewport
- **GIVEN** a 375 px viewport
- **WHEN** the header renders
- **THEN** search takes its own row, the nav scrolls sideways and nothing overflows the page

## Components

| Component | Source | Notes |
| --- | --- | --- |
| Utility bar | Store config | Black surface (`--color-surface-utility`), 13 px |
| Wordmark or logo | Store settings (portal) | Click returns home |
| Store chip | Session | 10 px brand dot with 4 px halo; opens store picker |
| Search field | Search | 44 px field, 46 px brand button; placeholder "Search parts, brands, part numbers" |
| Sign in / account | Session | Archivo link style |
| Cart button | Cart | Brand-50 fill, brand text |
| Category nav | Assortment | 14 px, 500 weight, 2 px active underline |
| Footer | Application component | "Sold and fulfilled by {reseller}", Terms, Privacy, Returns; styled by the theme only |

## Theming hooks

Primary colour, secondary (utility surface), accent, fonts and radius from the Contentools theme through the token adapter (`consumer-storefront/theming-design`); logo and name from the store settings. Header and footer are application components, not Contentools configuration.

## Gaps

- No design for the mobile menu, mini-cart drawer or account dropdown. Needed before build.
- Header search has no suggestions or results design (see `consumer-storefront/design-product-listing-page`).
- Language and country switching is not designed; the bar shows a fixed "Canada (CAD $)". Treat as configuration (see `consumer-storefront/theming-design` gaps on mock data).
