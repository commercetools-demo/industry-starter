<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Articles addressable and indexable independently of the listing

## Purpose

This content exists to be found by a search engine and cited in a sales conversation, which makes addressability the requirement and layout a detail. An article reachable only through a filtered listing earns no ranking and cannot be linked from an email, so the filters and the related-content block are conveniences over the CMS taxonomy rather than the route to the content.

## Requirements

### Requirement: Articles addressable and indexable independently of the listing

The system SHALL serve every published article at its own stable address carrying that article's title, description and canonical metadata, so the article is reachable and indexable without the listing's filter state.

#### Scenario: Filter matches nothing
- **GIVEN** a filter combination that matches no published article
- **WHEN** the reader applies it
- **THEN** the listing states that nothing matched and keeps the applied filters visible so they can be relaxed one at a time

#### Scenario: Article withdrawn
- **GIVEN** an article that was published and has since been withdrawn
- **WHEN** its address is requested
- **THEN** the withdrawn text is not served, and the response directs the reader to the topic the article belonged to

#### Scenario: Article without tags
- **GIVEN** an article carrying no taxonomy tags
- **WHEN** its detail page renders
- **THEN** the related-content block is omitted rather than filled with unrelated articles

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Article listing and filters | `[STATIC]` | CMS-managed content |
| Article detail content | `[STATIC]` | CMS-managed |
| Related content suggestions | `[STATIC]` | CMS taxonomy / tagging |

## Open questions

- Does the article address space share a prefix with category or product slugs, and which system arbitrates a collision?
- Are gated resources such as a case study behind a form in scope here, and does the gate live in the CMS or in the storefront's session tier?
