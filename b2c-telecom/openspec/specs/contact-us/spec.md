<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Contact page that confirms only enquiries support has accepted

## Purpose

The form is the only element of this page that leaves the browser, and it is the one that can fail invisibly. A dropped enquiry is worse than a form that is plainly unavailable, because the buyer stops looking for another way through and waits for a reply that will never come. The phone, email and office details are published as static content precisely so the page keeps working when the routing does not.

## Requirements

### Requirement: Contact page that confirms only enquiries support has accepted

The system SHALL confirm an enquiry as received only after the seller's CRM or support system has accepted it, so a submission that failed to route is never reported to the buyer as delivered.

#### Scenario: Enquiry accepted downstream
- **GIVEN** a completed enquiry and an available support system
- **WHEN** the buyer submits it
- **THEN** the confirmation names the channel that took the enquiry and carries a reference the buyer can quote when following up

#### Scenario: Routing unavailable
- **GIVEN** the CRM or ticketing endpoint returns an error or exceeds its timeout
- **WHEN** the buyer submits the enquiry
- **THEN** the submission is reported as not sent, the entered text is preserved for a retry, and the phone and email channels are offered as the way through

#### Scenario: Chat script absent
- **GIVEN** the third-party chat script is blocked by the visitor's consent choices or fails to load
- **WHEN** the page renders
- **THEN** the remaining contact options are fully usable and no chat placeholder is shown that a visitor could wait on

#### Scenario: Region without an office
- **GIVEN** a visitor in a region for which no office is listed
- **WHEN** they open the page
- **THEN** the channels that do serve that region are presented, rather than an empty office block

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Contact info (phone, email, offices) | `[STATIC]` | CMS-managed |
| Contact form submission | `[MIDDLEWARE]` | Routes to CRM / support ticketing |
| Live chat widget | `[STATIC]` | Third-party script embed |

## Open questions

- Does an authenticated buyer's enquiry carry an account or company identifier to the CRM, and which identifier is authoritative on that side?
- What is the retention and consent basis for the free-text field, given a buyer may paste order or payment details into it?
- Is the chat vendor in scope for the storefront's consent banner, and does the page remain compliant when chat is declined?
