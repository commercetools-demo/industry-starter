<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Policy pages stating the effective date of the text shown

## Purpose

These pages carry the terms a buyer is held to, so which text applied on which date is a matter of record rather than presentation. Checkout links to them at the moment of consent, which means the address has to outlive any restructure of the content system and the page has to be readable without abandoning the purchase. The failure mode is a silent edit: a policy that changed with no effective date cannot be reconciled against an order placed before the change.

## Requirements

### Requirement: Policy pages stating the effective date of the text shown

The system SHALL serve the shipping and returns, terms and conditions, and privacy policies at stable addresses, each stating the date on which the version being displayed took effect.

#### Scenario: Opened from checkout
- **GIVEN** a buyer part-way through checkout
- **WHEN** they open a policy from the consent text
- **THEN** the policy is readable and they return to checkout with the cart, entered addresses and selections intact

#### Scenario: Version superseded
- **GIVEN** a policy that has been replaced by a newer version
- **WHEN** the page is requested
- **THEN** the current text is served with its own effective date, and that date moves with the text rather than remaining at the previous value

#### Scenario: Policy not translated
- **GIVEN** a policy with no translation for the buyer's locale
- **WHEN** they open it
- **THEN** the fallback language version is served and identified as such, because an empty policy page blocks a lawful purchase

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| All policy content | `[STATIC]` | CMS or legal content management |

## Open questions

- Which system of record holds superseded policy versions, so the text in force on a given order's date can be produced later?
- Do the policies vary by selling region, and is the variant chosen by the buyer's locale, the shipping destination, or the store the cart was created in?
- Does a material change to the terms require re-consent from buyers with an open standing order, and where is that consent recorded?
