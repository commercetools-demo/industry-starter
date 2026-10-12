## ADDED Requirements

### Requirement: Plan finder in the header navigation

The system SHALL show a "Plan finder" navigation item in the header, in the mobile drawer and in the footer, linking to `/<locale>/plan-finder`. The item SHALL be added after the category items, SHALL NOT be derived from the category tree, and SHALL show the active state on the finder route.

#### Scenario: Link visible on every page
- **GIVEN** any page
- **WHEN** the header renders
- **THEN** a "Plan finder" item is present after the four category items and leads to the finder in the current locale

#### Scenario: Active state
- **GIVEN** a buyer on the finder
- **WHEN** the header renders
- **THEN** the "Plan finder" item shows the active state and no category item does

#### Scenario: Mobile drawer
- **GIVEN** a viewport below 768 px
- **WHEN** the buyer opens the drawer
- **THEN** "Plan finder" is listed with the other navigation items

#### Scenario: Localised label
- **GIVEN** the German storefront
- **WHEN** the header renders
- **THEN** the item shows the German label

#### Scenario: Catalog unavailable
- **GIVEN** the category tree cannot be read
- **WHEN** the header renders
- **THEN** the "Plan finder" item is still shown, as Support is
