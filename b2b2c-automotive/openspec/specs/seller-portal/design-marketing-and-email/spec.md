<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Marketing (Malva co-op campaigns) and email

## Purpose

Malva funds part of reseller advertising and supplies approved copy. Resellers also write transactional emails and run campaigns to their own customers.

Design source: `Malva Seller Portal.dc.html`, pages `marketing` and `email`.

## Requirements

### Requirement: Co-op campaign cards

The system SHALL show each Malva campaign with name, funding share ("Malva funds 50% of ad spend"), approved caption, promo code and suggested channels, and actions "Copy caption" and "Create discount".

#### Scenario: Create discount
- **GIVEN** the campaign code BRAKE8
- **WHEN** Create discount is pressed
- **THEN** a draft cart discount with that code is created and listed in `seller-portal/design-discounts-and-priority`, inactive until the reseller activates it

#### Scenario: Brand-funded copy is fixed
- **GIVEN** an approved caption
- **WHEN** the card renders
- **THEN** it reads "Brand-funded, can't be edited" and has no edit control

### Requirement: Campaign eligibility and proof (later phase)

The system SHALL show campaign dates, eligible products and the funding claim status, and accept proof of spend.

#### Scenario: Expired
- **GIVEN** a campaign past its end date
- **WHEN** the card renders
- **THEN** it is labelled Ended and Create discount is disabled

### Requirement: Email templates

The system SHALL edit templates (Order confirmation, Shipment update, Win-back) with subject and body, support variables `{{order_number}}` and `{{customer_name}}`, and preview with sample order data.

#### Scenario: Preview
- **GIVEN** the subject "Your order {{order_number}} is confirmed"
- **WHEN** previewed
- **THEN** it shows "Your order MO-482913 is confirmed" using sample data

#### Scenario: Unknown variable
- **GIVEN** a variable not in the list
- **WHEN** saving
- **THEN** the save is refused naming the variable

### Requirement: Campaigns by audience rule

The system SHALL list campaigns with audience rule, status (Sent, Draft, Scheduled), sent count and open rate, and create a campaign from a rule or from a plain-language audience description with a suggested rule and customer count to confirm.

#### Scenario: Suggested rule
- **GIVEN** the description "Customers who bought brake discs but not pads"
- **WHEN** a rule is suggested
- **THEN** it shows the rule and "27 customers" and applies only after "Use rule"

#### Scenario: Consent
- **GIVEN** a customer who has not consented to marketing
- **WHEN** a campaign is sent
- **THEN** that customer is excluded

### Requirement: Transactional events

The system SHALL list order events (placed, shipped, delivered) with template, state (Live or Not set up) and last sent, and note that sending is optional and event emails stay silent without a provider.

#### Scenario: Not set up
- **GIVEN** "Order delivered" with no template
- **WHEN** listed
- **THEN** it shows "Not set up" and no email is sent for it

### Requirement: Branded by theme

The system SHALL apply the reseller's logo and colours (see `consumer-storefront/theming-design`) to all templates.

#### Scenario: Preview with theme
- **GIVEN** a published theme
- **WHEN** a template is previewed
- **THEN** logo and brand colour show

## Gaps

- No campaign calendar, no template editor beyond text, no unsubscribe or consent management UI, no send-time or segment size limits, no AI usage disclosure.

## Platform notes

Event-driven emails need an order subscription and an email provider (see `commercetools-integrations`, transactional email: at-most-once versus at-least-once delivery matters).
