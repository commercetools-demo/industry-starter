<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# About page assembled entirely from published CMS content

## Purpose

This is the page a prospect lands on from a campaign or a supplier vetting exercise, and its content changes on a marketing and legal cadence rather than a release cadence. Binding it to nothing but the content system keeps two properties that the transactional pages cannot have: an editor can correct a credential the same day, and the page still answers when the catalog, pricing or session tier is degraded.

## Requirements

### Requirement: About page assembled entirely from published CMS content

The system SHALL present the seller's company story, credentials and route to sales on a single page assembled entirely from published content, so the page can be served without any call to a commerce API.

#### Scenario: Editor publishes a correction
- **GIVEN** an editor revises the company story and a certification claim in the content system
- **WHEN** the page is next requested
- **THEN** the revised text is served without a storefront deployment, and the previous version is no longer reachable at the same address

#### Scenario: Commerce tier degraded
- **GIVEN** the commerce API is unreachable
- **WHEN** a visitor opens the page
- **THEN** the page's own content is served in full, and the shared shell's session-dependent elements fall back to their signed-out state instead of blocking the render

#### Scenario: Locale without translation
- **GIVEN** a visitor whose locale has no translated version of the content
- **WHEN** they open the page
- **THEN** the storefront's fallback language is served and identified as such, rather than an empty page or an error

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| All content (hero, story, team, CTAs) | `[STATIC]` | Fully CMS-managed |

## Open questions

- Which certification and compliance claims on this page are legally controlled, and who signs off before an editor publishes a change to them?
- Should the sales call-to-action carry the referring page into the enquiry for attribution, and is that permitted under the storefront's consent policy?
