<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# FAQ answers readable and indexable without being expanded

## Purpose

The page earns its keep by deflecting support contacts, and that only happens when a search — on the site or on a search engine — lands the buyer directly on the answer. An accordion that fetches its body on expansion is invisible to a crawler and awkward for assistive technology, so the page can be editorially complete and still fail its purpose. The helpfulness signal is analytics about the answers, not part of them.

## Requirements

### Requirement: FAQ answers readable and indexable without being expanded

The system SHALL group published questions under topic headings and deliver each answer's full text in the page's initial response, so an answer is readable and indexable without the reader expanding it.

#### Scenario: Deep link to one question
- **GIVEN** an inbound link that addresses a single question
- **WHEN** it is opened
- **THEN** that question's answer is in view and already open, and the other topics remain reachable on the same page

#### Scenario: Feedback collector unreachable
- **GIVEN** the feedback endpoint is unreachable
- **WHEN** the reader marks an answer unhelpful
- **THEN** the vote is discarded without interrupting the reader, and no acknowledgement implying it was recorded is shown

#### Scenario: Answer not translated
- **GIVEN** a question whose answer has no translation for the reader's locale
- **WHEN** the topic renders
- **THEN** the fallback language version is served and identified as such, rather than a question with an empty body

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| All Q&A content | `[STATIC]` | CMS-managed |
| "Was this helpful?" feedback | `[MIDDLEWARE]` | Feedback submission to analytics / support |

## Open questions

- Is an unhelpful vote routed to an owner of record for that answer, or only to a dashboard nobody is accountable for?
- Do any answers restate a policy, a price or a lead time, and what stops them from drifting from the policy pages and the catalog?
