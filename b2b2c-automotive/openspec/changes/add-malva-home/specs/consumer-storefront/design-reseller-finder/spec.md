## ADDED Requirements

### Requirement: Reseller list with branches

The system SHALL list every reseller store that is active and has a distribution channel, with the reseller name, its city, the number of branches and its branch cities. The list SHALL be read on the server through one function in `lib/ct`, cached for a short time, and SHALL expose only name, key, city, address, coordinates and branch summaries (no channel ids, no selection ids).

#### Scenario: Two resellers
- **GIVEN** the stores Küstenwerk and Südkamm with branches
- **WHEN** the finder loads
- **THEN** both are listed with their cities and branch counts

#### Scenario: A store without a catalogue
- **GIVEN** a store without a distribution channel
- **WHEN** the finder loads
- **THEN** that store is not listed

### Requirement: Search and location

The system SHALL filter the list by a postal code or city typed in the search field and SHALL offer "Use my location", which sorts by distance. It SHALL work without location access, never block on a permission prompt, and suggest typing a postal code when location is refused. Geocoding SHALL go through the app's own route, never directly from the browser to a third party.

#### Scenario: Search by city
- **GIVEN** the finder
- **WHEN** the shopper types a city
- **THEN** only resellers with a branch in that city remain, and "No reseller found" shows when none match

#### Scenario: Location refused
- **GIVEN** the shopper refuses location
- **WHEN** the refusal is received
- **THEN** a message suggests a postal code and the list stays usable

### Requirement: One component, two places

The system SHALL render the same finder component in the home page (inline) and in a drawer. The drawer SHALL open from the right (from the left in right-to-left locales), trap focus, close on Escape, on the close button and on the scrim, return focus to its opener, and be a full-width sheet on narrow screens.

#### Scenario: Header button
- **GIVEN** any Malva page
- **WHEN** "Find your reseller" in the header is pressed
- **THEN** the drawer opens with the finder

#### Scenario: Escape
- **GIVEN** the drawer open
- **WHEN** Escape is pressed
- **THEN** it closes and focus returns to the opener

### Requirement: Choosing a reseller

The system SHALL turn each reseller row into a "Shop at this reseller" link. The destination SHALL be the same product at that reseller (`/{locale}/{store}/p/{slug}`) when the drawer was opened from a card, otherwise the reseller's home (`/{locale}/{store}`). The destination SHALL be built from the store key and the product slug only.

#### Scenario: From a card
- **GIVEN** the drawer opened from the card of product P
- **WHEN** "Shop at this reseller" is pressed for Küstenwerk
- **THEN** `/{locale}/mau-reseller-north/p/{slug of P}` opens

#### Scenario: From the header
- **GIVEN** the drawer opened from the header button
- **WHEN** a reseller is chosen
- **THEN** the reseller's home opens

#### Scenario: Product not sold there
- **GIVEN** the product is not in that reseller's assortment
- **WHEN** the product address is opened
- **THEN** the reseller's not-found page shows (the finder does not check availability)
