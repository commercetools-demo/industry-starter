## ADDED Requirements

### Requirement: Homepage presents both services and a quote path

The system SHALL render a homepage that states what Malva does, offers both service lines, and gives a request-a-quote action above the fold. Design: `design/malva/specs/homepage.md`.

#### Scenario: First view
- **GIVEN** a visitor opens the site root
- **WHEN** the page renders
- **THEN** the hero shows the headline, a one-sentence promise, a **Request a quote** action and an **Explore services** action, without scrolling on a 1440×900 viewport

#### Scenario: Choosing a service line
- **GIVEN** the homepage is shown
- **WHEN** the visitor selects the Plumbing or Waste management card
- **THEN** they land on that service listing

### Requirement: Homepage speaks to each audience

The system SHALL show one card for each audience — facilities managers, manufacturers, property and real estate, healthcare — each with a one-sentence outcome.

#### Scenario: Audience cards
- **GIVEN** the homepage is shown
- **WHEN** the audience section renders
- **THEN** exactly the four audiences appear in the order facilities managers, manufacturers, property and real estate, healthcare

#### Scenario: Audience card opens a prefilled quote
- **GIVEN** an audience card is a link
- **WHEN** the visitor selects it
- **THEN** the request-a-quote form opens with the matching sector selected

### Requirement: Proof content is managed and never rendered empty

The system SHALL source service-level figures, accreditations and testimonials from managed content, and SHALL omit a section that has no entries rather than render an empty block.

#### Scenario: No testimonials published
- **GIVEN** no testimonials are published
- **WHEN** the homepage renders
- **THEN** the testimonials block is absent and the rest of the page is unchanged

#### Scenario: Sample content is labelled
- **GIVEN** a figure, accreditation or testimonial is flagged as sample (not yet confirmed by the owner)
- **WHEN** the page renders
- **THEN** the item is shown with a visible "Sample content" marker, and a launch check fails while any sample-flagged item is still published

### Requirement: Global chrome on every page

The system SHALL show on every page the top bar (24/7 emergency number, Client portal, Request a quote), the sticky navigation (Plumbing, Waste management, About, Client portal, Request a quote), and the footer (service links, company links).

#### Scenario: Current section
- **GIVEN** the visitor is on the Waste management listing
- **WHEN** the navigation renders
- **THEN** the Waste management item is marked as the current page

#### Scenario: Small screen
- **GIVEN** a viewport narrower than 900px
- **WHEN** the navigation renders
- **THEN** a menu button gives keyboard and touch access to every navigation link, and Request a quote stays visible

#### Scenario: Emergency number
- **GIVEN** a mobile device
- **WHEN** the visitor selects the emergency number
- **THEN** the device offers to dial it

### Requirement: Homepage performance and discoverability

The system SHALL serve the homepage as server-rendered, cacheable content with no per-visitor data, one `h1`, a unique title and description, and an optimised hero image that does not shift layout.

#### Scenario: Cached delivery
- **GIVEN** two different visitors request the homepage
- **WHEN** the responses are compared
- **THEN** they are identical, including for a signed-in client
