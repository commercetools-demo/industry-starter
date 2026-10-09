## ADDED Requirements

### Requirement: Plumbing listing

The system SHALL provide a Plumbing services page listing exactly these services in this order: Pipe installation & repair, Drain cleaning & CCTV survey, Backflow & water testing, Boiler & hot water, Commercial fit-outs. Design: `design/malva/specs/plp.md`.

#### Scenario: Listing content
- **GIVEN** all five plumbing services are published
- **WHEN** the visitor opens Plumbing
- **THEN** five cards appear in the stated order, each with image, number, name, one-sentence description and a "Learn more" affordance

#### Scenario: Unpublished service
- **GIVEN** one plumbing service is unpublished
- **WHEN** the listing renders
- **THEN** that service is absent and the numbering stays continuous

### Requirement: Waste management listing

The system SHALL provide a Waste management services page listing exactly: General waste collection, Recycling, Hazardous waste, Grease trap servicing, Medical / clinical waste, Liquid waste & tankering, Compliance reporting.

#### Scenario: Listing content
- **GIVEN** all seven waste services are published
- **WHEN** the visitor opens Waste management
- **THEN** seven cards appear in the stated order with the same card contents as the plumbing listing

#### Scenario: Compliance band
- **GIVEN** the waste listing is shown
- **WHEN** the page renders below the cards
- **THEN** a "Compliance, documented" section states how collections are tracked and recorded

### Requirement: Cards lead to the service detail page

The system SHALL make each service card a single link to that service's detail page.

#### Scenario: Open a service
- **GIVEN** the visitor is on a listing
- **WHEN** they activate a card
- **THEN** the service's detail page opens, and its breadcrumb returns to the same listing

#### Scenario: Screen reader name
- **GIVEN** a card is announced by a screen reader
- **WHEN** focus lands on it
- **THEN** the accessible name is the service name and the decorative number is not read

### Requirement: Optional sector filter

The system SHALL allow narrowing a listing by sector (facilities management, manufacturing, property / real estate, healthcare) using a request parameter, and SHALL show the control only when at least two sectors would produce different results.

#### Scenario: Filter by sector
- **GIVEN** the Waste listing and the filter `?sector=healthcare`
- **WHEN** the page renders
- **THEN** only services tagged for healthcare appear, the active filter is shown and removable, and the same URL reproduces the result

#### Scenario: Filter with no match
- **GIVEN** a sector with no tagged services
- **WHEN** the listing renders
- **THEN** the page states that no services match and offers to clear the filter and to request a quote

### Requirement: Listing is public, cacheable and navigable

The system SHALL render listings for any visitor without per-visitor data, with a breadcrumb (`Home / Plumbing`), unique title and description, and a closing request-a-quote band.

#### Scenario: Empty category
- **GIVEN** a category with no published services
- **WHEN** it is opened
- **THEN** the header remains and the body states "No services are listed here yet." with a Request a quote action
