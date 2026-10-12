## ADDED Requirements

### Requirement: Customer-group prices

The system SHALL support a price on a variant that applies only to a customer group, SHALL seed one on the bundle offer for the `small-business` group and one for the `existing-customer` group, and SHALL select it for any buyer whose resolved groups include that group, on every surface that shows or charges the price (listing card, finder, offer API, cart, checkout, order). A buyer with no matching group SHALL get the standard price.

#### Scenario: Group price shown and charged
- **GIVEN** the bundle offer at $75 with a $59 price for `small-business`
- **WHEN** a small-business customer sees the card, adds the bundle and checks out
- **THEN** the card, the cart line and the order line are all $59

#### Scenario: Standard price for others
- **GIVEN** the same bundle
- **WHEN** a consumer sees the card
- **THEN** it shows $75

#### Scenario: Declared audience prices the anonymous cart
- **GIVEN** an anonymous visitor who declared small business
- **WHEN** they add the bundle
- **THEN** the cart's customer group is `small-business` and the line is $59, and the card showed $59 before they added it

#### Scenario: Buyer in two groups
- **GIVEN** a customer in `small-business` and `existing-customer`, each with a different bundle price
- **WHEN** price selection runs
- **THEN** the lowest qualifying price is used, as the platform selects it, and the card shows the same

#### Scenario: Catalog cache does not mix groups
- **GIVEN** the cached catalog read
- **WHEN** two buyers in different groups read the same card
- **THEN** each gets their own group's price, because the cache key includes the resolved group and channel

#### Scenario: Group price on a recurring line
- **GIVEN** a monthly bundle with a group price
- **WHEN** the next recurring order is generated
- **THEN** its line is charged the same group price as the first order's standing price, for lines on both Fixed and Dynamic price modes, as verified by the spike in tasks 3.2

### Requirement: Channel-scoped prices

The system SHALL support a price on a variant that applies only in one sales channel, SHALL seed a lower call-center price on one phone plan variant, and SHALL select the price by the buyer's sales channel on every surface. The buyer's channel SHALL be `online` by default and `call-center` for a signed-in customer in the `call-center` customer group; a visitor SHALL NOT be able to choose a channel.

#### Scenario: Call-center price
- **GIVEN** a phone plan at $50 online and $45 in the call-center channel
- **WHEN** a call-center agent's customer account views and adds the plan
- **THEN** the card, the line and the order show $45

#### Scenario: Online buyer
- **GIVEN** the same plan
- **WHEN** an online buyer views it
- **THEN** it shows $50, and no channel control exists

#### Scenario: Channel restricted offers unchanged
- **GIVEN** an offer with a `channels` restriction
- **WHEN** it is requested from another channel
- **THEN** it does not resolve, as in `eligibility-gated-offer`, independent of channel prices

#### Scenario: Cart lines carry the channel
- **GIVEN** a call-center buyer adding a plan
- **WHEN** the line item is created
- **THEN** the line item's distribution channel is the call-center channel so that the engine selects the channel price

#### Scenario: Channel price fallback
- **GIVEN** a variant with no price for the buyer's channel
- **WHEN** price selection runs
- **THEN** the standard price applies and no error is raised

### Requirement: Price on cards equals price in cart

The system SHALL read catalog prices for the buyer's resolved customer group and channel, and a test SHALL assert for every seeded offer and every audience and channel combination that the card price equals the price of the line the cart creates.

#### Scenario: Parity test
- **GIVEN** every seeded offer, audience and channel combination
- **WHEN** the parity test runs against the fake engine
- **THEN** the card price equals the cart line price in each case

### Requirement: Discount codes and group prices do not hide each other

The system SHALL keep customer-group and channel prices as embedded prices selected by the engine, and SHALL NOT use Direct Discounts or an external price source, so that discount codes keep working on every cart.

#### Scenario: Code on a group-priced line
- **GIVEN** a small-business cart with the group-priced bundle
- **WHEN** the buyer applies `MALVA-CABLE5` on a cable line
- **THEN** the code applies on top of the group price and is accepted
