## ADDED Requirements

### Requirement: Offers can be limited to states or ZIP codes

The system SHALL let an offer declare `eligible-regions` (a set of state codes and ZIP codes, such as `NC`, `TX`, `97201`) and SHALL treat the offer as eligible only when the buyer's service location matches one of them. An offer with no regions SHALL be eligible everywhere. The rule SHALL be one of the checks of the shared eligibility resolution, applied to browse, search, the finder, the offer APIs, the cart and checkout alike.

#### Scenario: Add-on sold in some states only
- **GIVEN** an add-on limited to `TX`, `NC` and `WA`
- **WHEN** a buyer whose service location is in Washington browses
- **THEN** the add-on is offered, and for a buyer in Georgia it is absent, not refused

#### Scenario: ZIP-level region
- **GIVEN** an add-on limited to ZIP `97201`
- **WHEN** a buyer in ZIP `97202` browses
- **THEN** the add-on is absent

#### Scenario: No location known
- **GIVEN** a buyer who has not given a location and an offer with regions
- **WHEN** the buyer browses
- **THEN** the offer is shown with "Available in selected areas, enter your ZIP to check" and cannot be added until a matching location is given

#### Scenario: Location changes after adding
- **GIVEN** a cart holding the add-on for a buyer in Texas
- **WHEN** the buyer changes the location to Georgia
- **THEN** the line is reported as not eligible and checkout is blocked until it is resolved

#### Scenario: Only state and ZIP are compared
- **GIVEN** an offer limited to `NC` and a buyer in another state whose city is named "Nc Town"
- **WHEN** eligibility is resolved
- **THEN** the offer is not eligible; city values are never compared with the regions
