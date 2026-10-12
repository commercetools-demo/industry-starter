<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront theme (Contentools ThemeManager hosted in the portal)

## Purpose

Resellers adapt their storefront theme from the seller portal. The theme is stored in Contentools and edited with Contentools' own `ThemeManager`; Contentools also owns theme history. The portal builds no theme editor and no version handling. **No screen exists in the supplied designs**, so the page chrome around the embedded editor needs a design in the admin kit.

Token behaviour is in `consumer-storefront/theming-design`. Store name, logo and favicon are store settings (`seller-portal/design-store-and-channels`), not part of the theme.

## Requirements

### Requirement: Theme tab under Store & channels

The system SHALL add a "Theme" tab to Store & channels (beside Settings, Channels, Share) that mounts `ThemeManager`, through the portal's Contentools proxy with `projectKey`, `businessUnitKey` set to the session `storeKey`, an absolute `baseURL` and a placeholder `jwtToken` (the real JWT stays on the server; see `seller-portal/bootstrap-and-structure`).

#### Scenario: No store selected or not connected
- **GIVEN** no selected store, or Contentools not connected
- **WHEN** the Theme tab opens
- **THEN** it asks to pick a store, or shows "Contentools isn't connected", and the editor does not load

#### Scenario: Permission
- **GIVEN** a user without store-edit permission
- **WHEN** Store & channels renders
- **THEN** the Theme tab is hidden, or shown read-only if the user may view

### Requirement: Presets limited to what the storefront supports

The system SHALL offer only presets and options the storefront honours (see "unsupported theme fields" in `consumer-storefront/theming-design`), hiding or marking the rest.

#### Scenario: Unsupported option
- **GIVEN** a preset that sets a blur or neumorphic style
- **WHEN** the preset list renders
- **THEN** the preset is hidden or marked "Not supported on your storefront"

### Requirement: Storefront preview with real pages

The system SHALL show the reseller a preview of Home, Listing, Product, Cart and Checkout using the saved theme, at desktop and 375 px widths.

#### Scenario: Switch page
- **GIVEN** the preview on Home
- **WHEN** Product is chosen
- **THEN** a real product from the reseller's assortment shows with the saved theme

### Requirement: Saving states when it takes effect

The system SHALL confirm a save with the storefront domain and the time the change appears (cache lifetime).

#### Scenario: Save
- **GIVEN** an edited theme
- **WHEN** it is saved
- **THEN** a toast states the domain and that the storefront updates within the cache lifetime

### Requirement: Reset to default

The system SHALL provide "Reset to Malva default", which deletes the reseller's theme so the `default` business unit's theme applies, after confirmation.

#### Scenario: Reset
- **GIVEN** a customised theme
- **WHEN** reset is confirmed
- **THEN** the storefront shows the default theme after the cache window

### Requirement: Email and invoice colours follow the theme

The system SHALL apply the store logo and the theme's primary colour to transactional emails and invoices through the theme loader (`seller-portal/design-marketing-and-email`).

#### Scenario: Colour reaches email
- **GIVEN** a saved theme
- **WHEN** a confirmation email is rendered
- **THEN** its button and heading use the primary colour

## Layout (proposed, admin kit)

Page header with tabs; widget card containing the embedded editor; right or lower preview card with device toggle and page switcher.

## Gaps

- Page chrome and preview need designs.
- Confirm how `ThemeManager` is styled inside the admin kit (it ships with its own Nimbus provider) and whether it works in dark mode.
- History and restore are Contentools' concern; confirm what `ThemeManager` offers so the portal does not duplicate it.
