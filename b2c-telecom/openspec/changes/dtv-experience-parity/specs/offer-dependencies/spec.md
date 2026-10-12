## ADDED Requirements

### Requirement: Required offers

The system SHALL support an offer declaring `requires-offers` (set of offer keys) and SHALL refuse to add the offer, and refuse checkout for a cart holding it, unless every required offer is in the cart or already held by the customer. The refusal SHALL name the missing offer and offer to add it.

#### Scenario: Required offer missing
- **GIVEN** an add-on that requires the Roku Streaming Stick
- **WHEN** the buyer adds the add-on to a cart without the stick
- **THEN** the add is refused with the reason "Requires Roku Streaming Stick" and an action to add both

#### Scenario: Required offer present
- **GIVEN** a cart holding the stick
- **WHEN** the buyer adds the add-on
- **THEN** it is added

#### Scenario: Required offer removed later
- **GIVEN** a cart with the add-on and the stick
- **WHEN** the buyer removes the stick
- **THEN** the add-on is flagged as blocking, with the reason, on the next cart read, and checkout is not offered

#### Scenario: Required offer is held, not in the cart
- **GIVEN** a customer who holds the required service on an active order
- **WHEN** they add the dependent offer
- **THEN** it is accepted, using the same holdings source as the exclusive-offer rule

#### Scenario: Server re-checks
- **GIVEN** a request to the cart endpoint that omits a required offer, however produced
- **WHEN** it arrives
- **THEN** the cart is unchanged and the response carries the reason in the standard blocked-add form

### Requirement: Required add-on kinds block checkout

The system SHALL enforce a plan's `required-addon-kinds` (installation, equipment and any later kind): checkout SHALL be blocked until the cart holds at least one add-on or equipment line of each required kind attached to that plan, and the cart SHALL say which kind is missing. The seed SHALL set the attribute where the catalog needs it.

#### Scenario: Installation required
- **GIVEN** a cable plan requiring the `installation` kind and a cart with no installation add-on
- **WHEN** the buyer views the cart
- **THEN** an issue states "Choose an installation option" with a link to the choices, and "Check out" is not offered

#### Scenario: One of the kind is enough
- **GIVEN** the same plan with DIY installation attached
- **WHEN** the buyer views the cart
- **THEN** the issue is gone, and replacing DIY with professional installation also leaves it satisfied

#### Scenario: Included kind satisfies the requirement
- **GIVEN** a plan that includes the required kind (as the cable modem is included)
- **WHEN** the cart is evaluated
- **THEN** no line is demanded for that kind

#### Scenario: Lint matches behaviour
- **GIVEN** the catalog lint that today warns about installation
- **WHEN** this requirement is implemented
- **THEN** lint and checkout use the same rule, and the seed writes `required-addon-kinds` where the lint expects it

### Requirement: Negated offers are replaced on add

The system SHALL support an offer declaring `negates-offers` (set of offer keys). When such an offer is added, any cart line for a negated offer SHALL be removed in the same cart update, the buyer SHALL be told which line was removed and why, and the removal SHALL happen only with the buyer's action on the add (not on a cart read).

#### Scenario: Professional installation replaces DIY
- **GIVEN** a cart with DIY installation attached to a plan
- **WHEN** the buyer adds professional installation, which negates DIY
- **THEN** DIY is removed, professional installation is added, both in one update, and a notice names the replacement

#### Scenario: Negated offer added after
- **GIVEN** a cart with professional installation
- **WHEN** the buyer adds DIY, which professional installation negates
- **THEN** the same symmetric rule applies and the buyer chooses replace or keep, as for exclusive offers

#### Scenario: Not applied on read
- **GIVEN** a cart in which both negating offers exist because the catalog changed
- **WHEN** the cart is read
- **THEN** nothing is removed, the conflict is reported as a blocking issue, and the buyer resolves it

### Requirement: Included offers are visible child lines

The system SHALL represent each offer in a plan's `included-offers` as a child line item attached to the plan line, at price 0, so that the cart and the summary show what the plan includes. The line SHALL be created when the plan is added, SHALL be removed with the plan, SHALL NOT be removable alone, and SHALL NOT change the plan's price. The old service's practice of giving a priceless offer a placeholder price SHALL NOT be used.

#### Scenario: Included add-on appears
- **GIVEN** a plan including Spotify
- **WHEN** the plan is added
- **THEN** a "Spotify, included" child line at 0 appears under the plan, and the summary totals are unchanged by it

#### Scenario: Included line cannot be removed alone
- **GIVEN** the included line
- **WHEN** the buyer looks for a remove control
- **THEN** none is offered on the child line; removing the plan removes it

#### Scenario: Add of the same offer is refused
- **GIVEN** a plan including Spotify and an included child line
- **WHEN** the buyer tries to add Spotify
- **THEN** it is refused as already included, as today

#### Scenario: Plan without a price
- **GIVEN** an offer with included offers and no price of its own
- **WHEN** it is offered for sale
- **THEN** it is not sellable and the catalog lint reports it, because Malva requires a price on every sellable variant

#### Scenario: Repeated included offer is not dropped
- **GIVEN** two plans in one cart that both include the same offer
- **WHEN** the cart is built
- **THEN** each plan has its own included child line

### Requirement: Bundle offers

The system SHALL seed at least one offer of kind `bundle` (for example cable internet plus a phone plan with a bundled price) that anchors several plans and lists included offers, and SHALL price it from the bundle offer's own price (with customer-group prices as in `audience-and-channel-pricing`), with audience and existing-customer restrictions applying to the bundle as a whole. The bundle SHALL NOT rely on a cart discount for its bundled price.

#### Scenario: Bundle appears in the finder
- **GIVEN** a bundle offer eligible for the buyer
- **WHEN** the finder lists plans
- **THEN** the bundle appears with its bundled price and shows the anchored plans as included

#### Scenario: Bundle gated by audience
- **GIVEN** a bundle limited to small-business existing customers
- **WHEN** a consumer browses
- **THEN** the bundle is absent, not refused
