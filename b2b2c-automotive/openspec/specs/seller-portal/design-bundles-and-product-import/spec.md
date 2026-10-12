<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Bundles and product import (local products)

## Purpose

Resellers can sell Malva parts together at a bundle price, and add their own local products (for example a brake-service kit) through a form or CSV. Local products are visible only to the reseller's branches.

Design source: `Malva Seller Portal.dc.html`, pages `bundles` and `import`.

## Requirements

### Requirement: Create a bundle

The system SHALL create a bundle as one product listing its components, a bundle name and a discount percentage, and show components total, bundle price and customer saving live.

#### Scenario: Live price
- **GIVEN** three components totalling €168.40 and a 10% discount
- **WHEN** the form renders
- **THEN** bundle price is €151.56 and saving €16.84

#### Scenario: Draft first
- **GIVEN** "Create bundle"
- **WHEN** pressed
- **THEN** the bundle is created as draft and listed with a Draft chip until published

### Requirement: Bundle rules

The system SHALL only allow components from the reseller's assigned assortment, SHALL show the bundle as unavailable when any component is unavailable, and SHALL not price the bundle below the price floor of its components.

#### Scenario: Component withdrawn
- **GIVEN** a live bundle whose component is withdrawn
- **WHEN** the storefront renders
- **THEN** the bundle is hidden and the portal shows why

### Requirement: Bundle list

The system SHALL list bundles with components, components price, bundle price, saving and status (Live, Draft).

#### Scenario: Live
- **GIVEN** a published bundle
- **WHEN** listed
- **THEN** it shows a success chip

### Requirement: Local product creation

The system SHALL create a local product from name, SKU, price, product type (Local part or Bundle) and category, with required attributes Name, SKU, price, category.

#### Scenario: Duplicate SKU
- **GIVEN** an existing SKU
- **WHEN** submitted
- **THEN** it is refused and the SKU field shows the conflict

### Requirement: CSV import with validation report

The system SHALL import products from CSV using the Merchant Center column layout, show rows, valid, warnings and errors, a column mapping panel (Mapped, Unmapped) and a row-level issue list with effect (Skipped or Default used) before importing.

#### Scenario: Preview before commit
- **GIVEN** a file of 120 rows with 112 valid, 6 warnings, 2 errors
- **WHEN** it is validated
- **THEN** "Import 112 rows" is offered, errors are listed with row and reason, and nothing is imported until pressed

#### Scenario: Unmapped fitment
- **GIVEN** a column "fitment" not in the Local product type
- **WHEN** mapping shows
- **THEN** it is Unmapped with a warning and the choice to ignore or map

### Requirement: Local products cannot claim fitment

The system SHALL not allow a local product to assert vehicle compatibility unless it carries the compatibility attributes, and SHOULD require Malva approval for local products with a fitment claim.

#### Scenario: Local part with fitment
- **GIVEN** a local part with compatible vehicles
- **WHEN** published
- **THEN** it enters a review state and shows in listings only after approval

## Gaps

- No bundle editor beyond a form (component quantities, images), no CSV template download, no import history, no image import, no price import column validation against floor.
- Fitment for local products is a business rule to decide.

## Platform notes

Bundle modelling choices (parent/child, product type) in `commercetools-commerce-patterns`; bulk import with Import API limits (20 operations per request, no ordering guarantee). Load before building.
