## ADDED Requirements

### Requirement: About page

The system SHALL provide an About page with a header ("About Malva" and a one-sentence description), a "One team, two disciplines" story with a team and fleet image, an Accreditations section, a three-item Principles section (Respond fast, Record everything, Waste less) and a closing request-a-quote band.

#### Scenario: Page content
- **GIVEN** the About page is opened
- **WHEN** it renders
- **THEN** the header, story, accreditations, three principles and the closing band appear in that order, with breadcrumb `Home / About`

#### Scenario: Sample accreditations are labelled
- **GIVEN** an accreditation is flagged as sample
- **WHEN** the page renders
- **THEN** it carries a visible "Sample content" marker, and the launch check fails while it is still published

### Requirement: Contact path from About

The system SHALL make Request a quote reachable from the closing band and from the persistent navigation.

#### Scenario: Closing band
- **GIVEN** the visitor reaches the end of the About page
- **WHEN** they choose **Request a quote**
- **THEN** the request form opens
