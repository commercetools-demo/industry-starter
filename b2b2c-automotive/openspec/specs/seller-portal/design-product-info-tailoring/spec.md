<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product info tailoring

## Purpose

> **Scope note (owner, 2026-10-12):** tailored text needs no review or approval (it publishes at once), and tailored images are supported.

A reseller can change how a product looks to its shoppers (name, description, image) without changing whether it is available or what it fits. Master data stays locked.

Design source: `Malva Seller Portal.dc.html`, page `catalog`, tab "Product info" ("Your presentation", "Master record").

## Requirements

### Requirement: Tailor presentation fields only

The system SHALL allow editing product name, description and image per assigned product, and SHALL lock SKU, fitment and specifications.

#### Scenario: Locked fields
- **GIVEN** the Product info tab
- **WHEN** the master record panel renders
- **THEN** it states "Untailored fields fall back to the master. Tailoring changes how a product looks, never whether it's available. SKU, fitment and specs stay locked."

### Requirement: Fallback and reset

The system SHALL show the master value when a field is untailored, mark tailored products with a "Tailored" chip in the product list, and provide "Reset to master" per product.

#### Scenario: Reset
- **GIVEN** a tailored product
- **WHEN** Reset to master is pressed
- **THEN** all tailored fields clear, the chip disappears and the storefront shows the master text

### Requirement: Content review before publishing

The system SHALL send tailored text and images through Malva content review before they publish, show the master text meanwhile and show review state.

#### Scenario: Pending review
- **GIVEN** an edited description
- **WHEN** it is saved
- **THEN** the product shows "Awaiting Malva content review, shown with the master text meanwhile", and Brand partnership lists it

#### Scenario: Rejected
- **GIVEN** a rejected edit
- **WHEN** the reseller opens it
- **THEN** the reviewer's reason shows and the reseller can edit and resubmit

### Requirement: Localisation

The system SHALL edit tailored text per supported language of the store and show which languages are tailored.

#### Scenario: Missing language
- **GIVEN** a store in German and English with only German tailored
- **WHEN** an English shopper views the product
- **THEN** the master English text shows

### Requirement: Image replacement scope

The system SHALL let the reseller upload an image that replaces the master image for its own shoppers, with size and format limits and a requirement of review.

#### Scenario: Wrong format
- **GIVEN** a file that is not JPG, PNG or WebP or is too small
- **WHEN** it is uploaded
- **THEN** it is refused with the limit stated

## Gaps

- Design has name, description and one image only; no SEO fields, no multiple images, no per-language switch, no review status UI, no side-by-side master versus tailored.
- Review workflow roles are not designed.

## Platform notes

Maps to product tailoring in commercetools (store-scoped overrides of name, description, images and similar). Load `commercetools-commerce-patterns` (catalog architecture) and confirm which fields tailoring can cover before promising any field here.
