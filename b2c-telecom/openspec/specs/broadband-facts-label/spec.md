<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Broadband Facts label shown with every plan

## Purpose

US broadband providers must make a standardized consumer disclosure (the "broadband facts" label) available at the point of sale. A buyer comparing plans on price alone is surprised later by activation fees, an early-termination charge or a price that stops being fixed. The design shows each plan's label inside the bundle line and again on the account page, so the disclosure is read before ordering and again while the contract runs. Because it is a disclosure, its numbers must be the numbers the plan is actually sold at — not copy written next to the plan.

Design reference: `design/specs/broadband-label.md`, `design/source/BroadbandLabel.dc.html`.

## Plan notes

**As built by workstream M (D-053).** The label is rendered in English in both locales by design (FCC format) and its CSS module is literal (the only component exempt from the token lint). Legal provider text and URLs in `lib/config/label.ts` are placeholders. The label snapshot is stored on the order as `labelSnapshot` (`LabelSnapshot` v1, matched to lines by SKU) and shown again in the account (`AccountPlanLabels`).

## Requirements

### Requirement: Broadband Facts label derived from the plan being sold

The system SHALL render, for every internet and phone plan in the bundle and for every active plan on the account page, a Broadband Facts label whose price, fees, term, speeds and data allowance come from the same commercetools data that prices the cart, and SHALL render it in the fixed black-on-white label format regardless of brand styling.

#### Scenario: Label in the bundle
- **GIVEN** a bundle containing a plan
- **WHEN** the bundle page renders
- **THEN** that plan's label appears with its monthly price, price-lock note, one-time fees, early-termination fee, typical speeds and data, and a unique plan ID

#### Scenario: Label matches the charged price
- **GIVEN** a plan whose price or fee changes in the catalog
- **WHEN** the label and the cart line are rendered next
- **THEN** both show the new value; no figure on the label is stored as separate copy

#### Scenario: Label on the account page
- **GIVEN** a signed-in customer with active plans
- **WHEN** the account page renders
- **THEN** one label per active plan is shown, and add-ons (which have no label) are not

#### Scenario: Fee with a formula
- **GIVEN** a plan whose early-termination fee depends on months remaining (cable: "$10 x months remaining")
- **WHEN** the label renders
- **THEN** the fee is shown as the stated formula, and on the account page the same text is shown rather than a computed amount that would go stale

#### Scenario: Required data missing
- **GIVEN** a plan that lacks a value the label needs
- **WHEN** the label would render
- **THEN** the plan cannot be added to the bundle, and the gap is reported to the catalog owner rather than shown as a blank row

#### Scenario: Brand styling does not alter the label
- **GIVEN** any theme or token change
- **WHEN** the label renders
- **THEN** it keeps black text on white, a 2px black border, Roboto and the thick/thin rule hierarchy

## Components

| Component | Notes |
| --- | --- |
| `BroadbandLabel` | Props: `label` = `{ id, planName, kind, price, priceNote, monthlyFees[], oneTime[], etf, discounts, speeds[], data }`; max width 400px; sections per `design/specs/broadband-label.md` |
| Label builder | Maps a plan variant to `label`; the only place field mapping lives |
| Bundle line | Hosts the label beside bullets/validity (`cart-page`) |
| Account plans | Grid of labels (`account-dashboard`) |
| Policy and support links | Configurable; the prototype's `malva.example` and `1-800-MALVA-00` are placeholders |

## commercetools

**Entities:** `Product`, `ProductType`, `ProductVariant`, `Price`, `Cart` / `LineItem`, `Order`

**Modeling notes**

The label's fields are product data, so they belong as typed attributes on the plan product types (`telecom-catalog-model`): downstream/upstream speed, latency, data allowance, contract term, activation fee, early-termination fee text, equipment charge. Typical speeds and latency are not in the current attribute list and need to be added; the price and one-time fees should come from the variant price and cart line data rather than attributes where the platform already carries them. The plan ID is a stable identifier (SKU or key), not a generated string. For an account page, the label shown should be the one in force when the order was placed, so keep the label inputs (or the rendered label) with the order rather than re-reading today's catalog.

## commercetools skills

Load `commercetools-storefront` and `commercetools-commerce-patterns` before implementing this capability. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which attribute holds each label field? `telecom-catalog-model` now defines `typical-download-mbps`, `typical-upload-mbps`, `typical-latency-ms`, `data-gb`, `price-lock-months` and `early-termination-fee`; the monthly equipment fee and one-time fees come from the equipment add-on price and cart lines. The AT&T reference project has no equivalent attributes, so there is nothing to borrow.
- Is the label stored with the order at purchase, or re-derived from the catalog? Re-deriving is simpler but can disagree with what the customer bought.
- Who owns the legal wording (policy URLs, support phone, the FCC footnote), and is the label required for phone plans and add-ons in the launch market?
- "Typical latency/speed" are measured values; where do they come from and how are they refreshed?
