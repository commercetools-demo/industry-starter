## ADDED Requirements

### Requirement: Promotions apply to the first order only

The system SHALL apply every promotion to the order placed today and to no later order: each Cart Discount is created with `recurringOrderScope` `NonRecurringOrdersOnly`, so recurring orders are charged the standing price of the plan. No promotion SHALL have a duration, a start offset or a number of free days. The only promotion Malva sells is the first-month promotion, plus discount codes, and both obey this rule.

#### Scenario: Recurring orders keep the original price
- **GIVEN** a plan with a first-month promotion at $39.99 per month
- **WHEN** the order is placed and the second recurring order is generated
- **THEN** the first order's plan line is discounted and the second order's line is $39.99

#### Scenario: Seed refuses an ongoing discount
- **GIVEN** a seeded cart discount whose `recurringOrderScope` is not `NonRecurringOrdersOnly`
- **WHEN** the seed validation runs
- **THEN** it fails and names the discount, because the schedule and the "Then monthly" figure assume none exists

#### Scenario: Discount created in the Merchant Center
- **GIVEN** a merchandiser creates an `AnyOrder` discount in commercetools
- **WHEN** the catalog lint runs
- **THEN** it reports the discount as a warning, since displayed recurring amounts would no longer match recurring orders

### Requirement: First-month promotion

The system SHALL support a first-month promotion on selected plans, expressed as a Cart Discount in commercetools that reduces the first month's recurring charge of lines whose offer carries `intro-free-months` greater than 0, and SHALL show it to the buyer before commitment. The number of free months SHALL be 1 and the attribute SHALL act as a flag; the storefront SHALL NOT read it as a duration.

#### Scenario: Card states the promotion
- **GIVEN** Cable 100 with the first-month promotion
- **WHEN** its card renders on the listing and in the finder
- **THEN** it reads "First month free, then $39.99/mo" with the standing price for the selected term

#### Scenario: Plan without the promotion
- **GIVEN** a plan with no `intro-free-months`
- **WHEN** its card renders
- **THEN** no promotion message is shown

#### Scenario: Cart shows both amounts
- **GIVEN** a cart with Cable 100
- **WHEN** the bundle renders
- **THEN** "Due today" excludes the plan's first month, "Then monthly" shows $39.99, and the promotion is listed by name

#### Scenario: Promotion withdrawn from sale
- **GIVEN** a placed order that received the promotion
- **WHEN** the discount is deactivated afterwards
- **THEN** the placed order and its stored schedule are unchanged and only new carts are affected

#### Scenario: No trial days anywhere
- **GIVEN** the catalog and the storefront
- **WHEN** a "days free" message is searched for
- **THEN** none exists, and the `trial-days` attribute is removed from the add-on type because no promotion uses it

### Requirement: Promotion names and amounts in the bundle

The bundle SHALL list every applied promotion with its localised name, the lines it affects and the amount it took off, taken from the engine's reported discounted amounts. A promotion that affects one line SHALL be shown under that line; a promotion that affects several lines or the order total SHALL be listed after the lines. The list SHALL have no validity columns, because no promotion has a duration.

#### Scenario: Line-level promotion under its line
- **GIVEN** the first-month promotion on the Cable 100 line
- **WHEN** the bundle renders
- **THEN** its name and the amount off appear under that line

#### Scenario: Order-level code after the lines
- **GIVEN** the `WELCOME10` code applied to the order total
- **WHEN** the bundle renders
- **THEN** it is listed after the lines with its amount and no affected-line list

#### Scenario: Localised
- **GIVEN** a discount with en-US and de-DE names
- **WHEN** the German storefront renders the list
- **THEN** the German name is shown, falling back to en-US

#### Scenario: Nothing applied
- **GIVEN** a cart with no applied promotion
- **WHEN** the bundle renders
- **THEN** no promotions section is shown

### Requirement: Retired recurring discounts

The system SHALL NOT sell the second-line $10 discount, the bundle $5 discount, the 3-month and 6-month intro prices or the year-1 tier percentages, and SHALL remove them from the seed, the label text and the "Ways to save" pairings. Orders already placed with a stored schedule SHALL continue to display it unchanged.

#### Scenario: Seed result
- **GIVEN** the seed after this change
- **WHEN** the cart discounts are listed
- **THEN** only the first-month promotion and the `WELCOME10` and `MALVA-CABLE5` codes exist

#### Scenario: Prompts when nothing is reachable
- **GIVEN** the removed pairings
- **WHEN** the cart prompts are requested
- **THEN** nothing is suggested, as `discount-activating-offer-prompt` requires when no discount is reachable

#### Scenario: Old orders still display
- **GIVEN** an order stamped with an intro or step schedule before this change
- **WHEN** it is shown in the account
- **THEN** the stored schedule is displayed as stored
