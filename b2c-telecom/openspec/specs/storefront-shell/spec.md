<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront shell: header, navigation, bundle indicator, footer

## Purpose

Every page shares one frame. The prototype's frame carries three things that must stay correct on every page: where the buyer is (active nav), whether they are signed in, and how many items are in their bundle. The last two are per-buyer and change after sign-in, so rendering them from cached shared page content shows one buyer's state to another or shows stale counts.

Design reference: `design/specs/shell.md`.

## Requirements

### Requirement: Sticky shell with session-resolved account and bundle state

The system SHALL render a sticky brand-colored header with wordmark, four category navigation items, an account link and a bundle pill, and a footer, on every page, with the account label and bundle count resolved from the current session rather than from shared cached content.

#### Scenario: Active category highlighted
- **GIVEN** a buyer on a category, add-ons or detail route under one nav item
- **WHEN** the header renders
- **THEN** that nav item shows the active state (dark pill, white text) and the others do not

#### Scenario: Anonymous buyer
- **GIVEN** no authenticated session
- **WHEN** the header renders
- **THEN** the account link reads "Log in" and leads to sign-in, and the bundle pill shows the anonymous bundle's count

#### Scenario: Signed-in buyer
- **GIVEN** an authenticated session
- **WHEN** the header renders
- **THEN** the account link reads "Hi, {first name}" and leads to the account page

#### Scenario: Bundle count counts plans and add-ons
- **GIVEN** a bundle with two plans and one add-on
- **WHEN** the header renders
- **THEN** the pill reads "My bundle · 3"

#### Scenario: Header stays reachable
- **GIVEN** a scrolled page
- **WHEN** the buyer scrolls
- **THEN** the header remains fixed to the top above content

#### Scenario: Footer links
- **GIVEN** any page
- **WHEN** the footer renders
- **THEN** each footer item (Phone plans, Wireless internet, Cable internet, Add-ons, Support) is a working link; the prototype's plain text is not acceptable

## Components

| Component | Notes |
| --- | --- |
| `SiteHeader` | `brand-500`, `--shadow-sm`, container 1440, wraps on narrow widths |
| `NavPill` | Active / inactive, Exo 600 15 |
| `AccountLink` | `[MIDDLEWARE]` session-specific |
| `BundlePill` | `[MIDDLEWARE]` cart count (plan lines + add-on lines) |
| `SiteFooter` | `[STATIC]` |
| Navigation tree | Derived from the four root categories (`telecom-catalog-model`), not hard-coded |

## commercetools

**Entities:** `Cart`, `Customer`, `Category`

**Modeling notes**

The four nav items map to the four top-level categories of the catalog; read them from the category tree and cache that shared tree. The bundle is the commercetools Cart (the prototype's "bundle" is UI vocabulary for it); the count is the number of line items, which is a different number from total quantity — decide which the pill shows. Resolve count and identity per request, as in `home-landing-page`.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- "My bundle" (design) vs "cart" (existing specs and routes): confirm the user-facing term is Bundle everywhere, including checkout and email.
- Where does "Support" lead? No support page is designed (see `contact-us`, `faq`).
- No mobile header is designed; define the collapsed navigation before build.
