<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Store and channels

## Purpose

Store settings define how the reseller's storefront is identified and located; channels show where orders come from; share links attribute orders to a channel.

Design source: `Malva Seller Portal.dc.html`, page `store`, tabs Settings, Channels, Share. The Theme tab is added by `seller-portal/design-storefront-theme-and-branding`.

## Requirements

### Requirement: Store identity

The system SHALL edit store name and logo and SHALL show the storefront address read-only ("Managed by Malva"); domains are set up by an admin in the Merchant Center and at the hosting layer.

#### Scenario: Address is read-only
- **GIVEN** the Settings tab
- **WHEN** it renders
- **THEN** the storefront address shows with no edit control and no availability check

### Requirement: Location

The system SHALL edit address, latitude and longitude for the dealer locator and SHOULD geocode the address into coordinates.

#### Scenario: Save
- **GIVEN** valid values
- **WHEN** Save is pressed
- **THEN** "Location saved" shows and the store picker uses the new point

### Requirement: Branches

The system SHALL manage branches (name, address, hours, pickup promise) used by the shopper store picker.

#### Scenario: Add branch
- **GIVEN** a new branch with hours and pickup rule
- **WHEN** saved
- **THEN** it appears in the storefront picker

### Requirement: Channels table

The system SHALL show per channel: status (Live or Demo), orders in 30 days, revenue and share of sales, with a note that attribution comes from the order's sales-channel field and is indicative where absent.

#### Scenario: Demo channel
- **GIVEN** TikTok in Demo
- **WHEN** the row renders
- **THEN** its chip is info-tinted and figures are labelled as demo data

### Requirement: Share links

The system SHALL generate an attributed storefront link and a link-in-bio page per channel, with QR code and Copy link.

#### Scenario: Attribution
- **GIVEN** the Instagram link
- **WHEN** a shopper orders after following it
- **THEN** the order is credited to Instagram

## Gaps

- No branches, no hours, no shipping and pickup rules, no tax settings, no payment method settings, no legal pages. Branch data feeds `consumer-storefront/design-store-picker`.
- Name, logo and favicon are store settings kept here (not in Contentools). Open question: where the logo file is stored (commercetools store data plus an asset host).

## Platform notes

Store, channels and orders' sales-channel attribution; load `commercetools-storefront` (BOPIS) for per-branch inventory.
