## ADDED Requirements

### Requirement: Each service has a detail page

The system SHALL provide one detail page per published service at a stable, readable URL, showing: name, description, what is included, who it is for, how it works, the compliance records the client receives, frequency options, related services, and a request-a-quote action. No price SHALL be shown. Design (proposed): `design/malva/specs/pdp.md`.

#### Scenario: Open a service
- **GIVEN** the published service "Drain cleaning & CCTV survey"
- **WHEN** the visitor opens its page
- **THEN** all listed content blocks that have content are shown, and no price, tax or total appears

#### Scenario: Unknown or unpublished service
- **GIVEN** a URL for a service that is not published
- **WHEN** it is requested
- **THEN** a not-found page is returned with links to both listings

### Requirement: Request a quote for this service

The system SHALL offer, on every detail page, a primary action that opens the request form with this service preselected, reachable by keyboard before the long content and present at every breakpoint.

#### Scenario: Preselected service
- **GIVEN** the visitor is on a detail page
- **WHEN** they choose **Request a quote for this service**
- **THEN** the form opens at the Site step with that service already part of the request

#### Scenario: Small screen
- **GIVEN** a viewport narrower than 900px
- **WHEN** the page renders
- **THEN** the action card appears above the long content and a sticky bar repeats the primary action

### Requirement: Add the service to the quote list

The system SHALL let a visitor add a service to their quote list from its detail page without leaving it.

#### Scenario: Add
- **GIVEN** the service is not in the list
- **WHEN** the visitor chooses **Add to quote list**
- **THEN** the control changes to an added state with a link to the list, and the nav count increases by one

#### Scenario: Already added
- **GIVEN** the service is already in the list
- **WHEN** the page renders
- **THEN** the added state is shown and activating the control does not add a duplicate

### Requirement: Related services

The system SHALL show up to three related services as cards, never the current service.

#### Scenario: Fewer than three related
- **GIVEN** a service with one related service
- **WHEN** the page renders
- **THEN** one card is shown and no empty slots

### Requirement: Search-engine and sharing metadata

The system SHALL give each detail page a unique title and description, canonical URL, breadcrumb markup, and `Service` structured data naming Malva as provider.

#### Scenario: Structured data
- **GIVEN** a published service page
- **WHEN** its markup is inspected
- **THEN** it contains `Service` data with name, description, provider and service type, and a breadcrumb list matching the visible trail
