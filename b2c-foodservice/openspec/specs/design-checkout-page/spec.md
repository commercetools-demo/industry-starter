<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Checkout page

## Purpose

Checkout collects only what the bag needs: an address when anything ships, a pickup person when anything is collected, and payment. Members skip contact entry, guests are first class, and discounts can be stacked and removed in view of the total.

Design source: `CheckoutPage` in `pages-checkout.jsx`.

## Requirements

### Requirement: Three steps

The system SHALL present Details, Fulfilment and Payment as a numbered step indicator beside the H1. Completed steps show a teal check and are clickable to go back; later steps are not.

#### Scenario: Going back
- **GIVEN** the shopper is on Payment
- **WHEN** they click completed step 1
- **THEN** step 1 opens with their entries retained

### Requirement: Step 1, contact and address

The system SHALL show, for a guest, a Contact card (email, first and last name) with a "Use my account" link when a session exists; for a member, a confirmation card "Signed in as {first}" with a "Check out as guest" link. When anything ships it SHALL show a Shipping address card: saved addresses as radio rows (label, default tag, name, line, phone) plus "Use a new address", or the address form for guests. When everything is collected it SHALL show "Pickup only, no address needed".

#### Scenario: Member with saved addresses
- **GIVEN** a member with a default address and a shipping line
- **WHEN** step 1 renders
- **THEN** the default address is preselected and the form is hidden until "Use a new address"

#### Scenario: Guest switch
- **GIVEN** a member chooses "Check out as guest"
- **WHEN** the switch applies
- **THEN** contact and address fields clear

#### Scenario: Collect only
- **GIVEN** every line is collect
- **WHEN** step 1 renders
- **THEN** no address is requested

### Requirement: Step 2, fulfilment

The system SHALL show a Pickup location card when anything is collected (store row with address, hours, phone, "Ready in about {n} minutes", Change link; "Who's picking up?" as It's me or Someone else with an alternate-name field), and a Delivery method card when anything ships (address recap; Standard and Express cards with price and days). A delivery slot picker is added where Malva offers timed delivery (`design.md` Q6).

#### Scenario: Someone else collects
- **GIVEN** "Someone else" is chosen
- **WHEN** the card updates
- **THEN** an alternate-name field appears and is required to continue

#### Scenario: Free shipping code
- **GIVEN** a free-shipping code is applied
- **WHEN** Standard renders
- **THEN** it shows "code applied" and the shipping line is free

### Requirement: Step 3, payment

The system SHALL show a Payment card with a security note, then Back and "Place order · {total}". Card entry in the prototype is a mock; the build uses the hosted commercetools Checkout payment component so card data never touches the storefront (`design.md` D6). The card keeps its place, copy and button.

#### Scenario: Payment failure
- **GIVEN** a payment is declined
- **WHEN** the result returns
- **THEN** the shopper stays on step 3 with the reason and can retry, and the bag is untouched

#### Scenario: Placement
- **GIVEN** payment succeeds
- **WHEN** the order is created
- **THEN** the bag clears and the confirmation page opens

### Requirement: Summary and promo codes

The system SHALL show a sticky summary: item count, a scrollable (200px) list of lines with image, name, variant, quantity, fulfilment and price, then a Promo codes field with Add and Enter support; applied codes are teal pills (mono code, label, saving, remove x) and stack. Totals: Subtotal, Discount (teal, negative), Shipping, Tax, Total.

#### Scenario: Invalid code
- **GIVEN** an unknown code is entered
- **WHEN** Add is pressed
- **THEN** an inline red message says the code is not valid and nothing changes

#### Scenario: Duplicate code
- **GIVEN** a code is already applied
- **WHEN** it is added again
- **THEN** a message says it is already applied

#### Scenario: Remove a code
- **GIVEN** an applied code
- **WHEN** its x is pressed
- **THEN** the discount and total recompute

### Requirement: Validation

The system SHALL validate email, name, address (when shipping), phone and pickup person inline on the step they belong to, and block Continue with a message beside the field. The prototype does not validate.

#### Scenario: Missing email
- **GIVEN** a guest with no email
- **WHEN** Continue is pressed
- **THEN** the email field shows an error and focus moves to it

### Requirement: Dropped from VELA

The system SHALL NOT carry over the "Create a quote" button.

#### Scenario: B2C
- **GIVEN** the Malva payment step
- **WHEN** it renders
- **THEN** Place order is the only commit action
