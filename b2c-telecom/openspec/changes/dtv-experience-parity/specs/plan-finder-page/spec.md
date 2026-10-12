## ADDED Requirements

### Requirement: Plan finder page

The system SHALL provide a single-screen plan finder at `/<locale>/plan-finder` for every buyer. The page SHALL list the plans the buyer may choose in one plan family, select the first by default, and show the selected plan's details beside the list. It SHALL use the same eligibility filtering, compatibility rules and cart endpoints as the category listings and SHALL NOT replace them.

#### Scenario: Family choice
- **GIVEN** the finder
- **WHEN** it opens
- **THEN** a family control (phone plans, wireless internet, cable internet) is shown, defaulting to the first family with an eligible plan, and changing it reloads the list

#### Scenario: First plan selected by default
- **GIVEN** a buyer context with at least one eligible plan in the family
- **WHEN** the finder opens
- **THEN** the first plan in listing order is selected and its details are shown, and no cart line is created yet

#### Scenario: Changing the context re-selects
- **GIVEN** plan A selected
- **WHEN** the buyer changes customer type, existing-customer status or service location so that the eligible list changes
- **THEN** the list reloads, the first eligible plan is selected, and the previous selection is dropped if it is no longer eligible

#### Scenario: No eligible plan
- **GIVEN** a buyer context for which no plan in the family is eligible
- **WHEN** the finder opens
- **THEN** a message states that no plans are available for the current selection and the details area is not shown

#### Scenario: Plan card
- **GIVEN** a plan in the list
- **WHEN** it renders
- **THEN** it shows the plan name, family, and the monthly price for the selected term, plus the first-month promotion message when the plan has one (see `first-order-promotions`)

#### Scenario: Selection survives reload
- **GIVEN** a selected plan and a draft
- **WHEN** the buyer reloads the page
- **THEN** the selected plan is restored from the URL (`?plan=<key>`) and the draft is cleared

### Requirement: Three-section plan detail

The finder SHALL show, for the selected plan, three labelled sections: Included, Compatible add-ons and Compatible equipment. Each section SHALL list its items with name, kind, price and charge kind and SHALL show its own empty message when it has no items. The sections SHALL be built from `GET /api/offers/[key]` (see `offer-catalog-api`).

#### Scenario: Included items
- **GIVEN** a plan whose `included-offers` contain an add-on
- **WHEN** the detail renders
- **THEN** the item is in the Included section marked "Included", shows no price to pay and has no add control

#### Scenario: Compatible add-ons come from the rule engine
- **GIVEN** a plan and the catalog's add-ons
- **WHEN** the Compatible add-ons section renders
- **THEN** it lists the add-ons whose verdict is allowed, and each add-on the evaluation rejects appears disabled with its reason, as on the listing cards

#### Scenario: Compatible equipment
- **GIVEN** a cable plan whose downstream speed is above a router's maximum
- **WHEN** the Compatible equipment section renders
- **THEN** that router is shown unavailable with the reason that it supports less than the plan delivers

#### Scenario: Empty section
- **GIVEN** a plan with no compatible equipment
- **WHEN** the detail renders
- **THEN** the section shows "No compatible equipment is available for this plan" and does not disappear

#### Scenario: Loading state
- **GIVEN** the buyer selects another plan
- **WHEN** details are being fetched
- **THEN** a loading state replaces the three sections until the new plan's details arrive, and sections of the previous plan are not shown

#### Scenario: Detail failure
- **GIVEN** the detail request fails
- **WHEN** the section area renders
- **THEN** a retry message is shown in place of the sections, and the plan list stays usable

### Requirement: Add and remove extras before continuing

The finder SHALL let the buyer add and remove compatible add-ons and equipment for the selected plan before continuing, keeping the choices in a draft that is applied to the cart only on Continue. An item in the draft SHALL be shown as added and SHALL offer a remove control.

#### Scenario: Add to the draft
- **GIVEN** a compatible add-on with an "Add to plan" control
- **WHEN** the buyer adds it
- **THEN** it is marked added, no cart request is sent, and the Continue button's count increases

#### Scenario: Remove from the draft
- **GIVEN** an add-on in the draft
- **WHEN** the buyer removes it
- **THEN** it returns to the add state and the count decreases

#### Scenario: Draft is cleared when the plan changes
- **GIVEN** a draft with two extras for plan A
- **WHEN** the buyer selects plan B
- **THEN** the draft is cleared, because the extras were chosen for plan A, and the buyer is told so once

#### Scenario: One equipment item per kind
- **GIVEN** a draft with one router
- **WHEN** the buyer adds another router
- **THEN** the second replaces the first, as on the listing card

#### Scenario: Conflicting choice refused with the reason
- **GIVEN** an add-on the shared evaluation marks conflicting with an item in the draft
- **WHEN** the buyer tries to add it
- **THEN** it is not added, the reason is shown, and the buyer may replace the first

### Requirement: Live price strip

The finder SHALL show, below the three sections, "Due today" and "Then monthly" for the selected plan and the draft, taken from `POST /api/pricing/preview`, and SHALL update them after each add or remove.

#### Scenario: Strip follows the draft
- **GIVEN** a selected plan and an empty draft
- **WHEN** the buyer adds a router rental
- **THEN** both figures are requested again and shown with the router included

#### Scenario: Preview slow or failing
- **GIVEN** the preview is pending or fails
- **WHEN** the strip renders
- **THEN** it shows a loading state or "Price unavailable", never a stale figure, and Continue stays available

#### Scenario: Strip equals the bundle
- **GIVEN** the strip's figures for a plan and draft
- **WHEN** the buyer continues
- **THEN** the bundle shows the same Due today and Then monthly

### Requirement: One-button continue to the bundle

The finder SHALL show a button "Continue with <plan name>" (or "Continue" when no plan is selected) that applies the selected plan and the draft to the cart through the existing cart endpoints in one action and opens `/bundle`, where the priced summary of `cart-page` is shown.

#### Scenario: Continue applies plan and extras
- **GIVEN** plan A selected with two extras in the draft
- **WHEN** the buyer presses "Continue with Plan A"
- **THEN** the plan is added with its required equipment, each extra is attached to the plan line, and `/bundle` opens showing those lines

#### Scenario: A line is refused on continue
- **GIVEN** a draft with one extra the server now refuses
- **WHEN** the buyer continues
- **THEN** the accepted lines are kept, the refused line is named with its reason on `/bundle`, and the buyer can return to the finder

#### Scenario: Cart already holds a plan of the same technology
- **GIVEN** a cart holding another plan of the same technology
- **WHEN** the buyer continues with a plan of that technology
- **THEN** the replace-or-keep choice of the one-plan-per-category rule is offered, not a silent replacement

#### Scenario: Continue twice
- **GIVEN** the buyer pressed Continue and came back
- **WHEN** they press Continue again with the same plan and draft
- **THEN** the cart is unchanged, with no duplicated lines

### Requirement: Finder uses only public, tested endpoints

Every read the finder makes SHALL go through `GET /api/offers`, `GET /api/offers/[key]` and the existing cart routes, so that no data reaches the page that a documented endpoint would not return.

#### Scenario: Page and API agree
- **GIVEN** the finder's list for a buyer context
- **WHEN** `GET /api/offers` is called with the same context
- **THEN** the same offers are returned in the same order
