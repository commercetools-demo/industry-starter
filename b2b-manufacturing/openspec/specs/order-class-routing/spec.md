<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# An order class chosen at submission that sets how it is served

## Purpose

A stock replenishment and a machine-down emergency are the same parts ordered with completely different urgency, and industrial sellers price and route them differently for good reason: the emergency travels by a faster and more expensive route and jumps the queue. The buyer is the only party who knows which situation they are in, so the choice has to be theirs at submission — but it cannot be a free choice, because the premium routes are an entitlement, and it cannot be merely a note on the order, because the whole point is that the class changes what happens next.

## Requirements

### Requirement: An order class chosen at submission that sets how it is served

The system SHALL let the buyer choose an order class at submission from those their agreement permits, and carry that class onto the order so it governs the fulfillment route, the charges that apply and the promise the buyer is given.

#### Scenario: Class changes the charge and the promise
- **GIVEN** a buyer entitled to more than one order class
- **WHEN** they change the class before confirming
- **THEN** the charges and the stated promise change with it and are shown before confirmation

#### Scenario: Class limited by entitlement
- **GIVEN** a buyer whose agreement does not permit a premium class
- **WHEN** they reach class selection
- **THEN** that class is not offered, and an order submitted naming it is refused rather than downgraded silently

#### Scenario: Class carried downstream
- **GIVEN** an order submitted under a premium class
- **WHEN** the order is handed to fulfillment
- **THEN** the class is on the order and governs the route taken, rather than being reconstructed from the charge applied

#### Scenario: Cut off honoured
- **GIVEN** a class whose promise depends on a daily cut-off, and a submission after it
- **WHEN** the buyer reaches confirmation
- **THEN** the promise offered reflects the next available window rather than the one that has closed

#### Scenario: Premium class requires a reference
- **GIVEN** a class that requires the unit the urgency relates to
- **WHEN** the buyer submits without it
- **THEN** submission is refused with the missing reference named, rather than accepted and queried later

#### Scenario: Class not available for a line
- **GIVEN** a line that cannot be served by the chosen class
- **WHEN** the cart is revalidated
- **THEN** the line is identified with the reason and the buyer is offered the classes that can serve it

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Classes the buyer's agreement permits | `[MIDDLEWARE]` | An entitlement, not a fixed list on the page |
| Charges attaching to the chosen class | `[MIDDLEWARE]` | Shown before confirmation, never added afterwards |
| Promise stated per class | `[MIDDLEWARE]` | What the buyer is being told will happen, and by when |
| Class recorded on the order | `[MIDDLEWARE]` | Carried downstream, not inferred from the charge |
| Cut-off governing the promise | `[MIDDLEWARE]` | A same-day class submitted late is not a same-day order |
| Reference required by the premium classes | `[STATIC]` | The unit or breakdown the urgency relates to |

## commercetools

**Entities:** `Cart`, `Order`, `ShippingMethod`, `CustomLineItem`, `State`, `Type`, `BusinessUnit`

**Verified API surface**

- (concept) States are used to manage the lifecycle and workflows of resources including Orders, with the application defining the States, which transitions are allowed, and triggering them — so an order class that drives a route is expressed as project-defined data rather than a built-in field — [docs](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)
- (concept) addCustomLineItem charges for something not represented as a Product Variant, which is how an expedite or emergency premium enters the cart as a line the buyer can see before confirming — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/implement-carts/update-carts)
- (concept) Carts and Orders can reference Business Units, which is where a buyer's entitlement to a premium class is resolved from rather than from the signed-in person — [docs](https://docs.commercetools.com/api/projects/business-units)

**Constraints that change the design**

- commercetools has no order type, order class or service level field on the Order: the class is a Custom Field declared through a Type, and nothing in the platform enforces what it implies — [docs](https://docs.commercetools.com/api/projects/orders)
- Setting a shipping method triggers recalculation of shipping cost, taxes and available options, so a class change implemented as a method change requires the cart to be re-read before any total is shown — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)

**Modeling notes**

Two designs both work and they are not interchangeable. If the class only changes carriage and cost, model it as a Shipping Method — the platform then prices it, and you inherit the recalculate-and-re-read discipline for free. If it also changes priority, allocation or which warehouse serves the line, it is not a shipping method and must be a Custom Field on the order that downstream systems read. Mixing the two, so that the method implies the class, is the version that decays: someone adds a method for a carrier and inadvertently creates an order class nobody enforces. Resolve entitlement from the Business Unit rather than the person, and enforce it server-side at submission — a class list filtered only in the storefront is not a control. Keep the cut-off logic and the promise it produces in one place; a class whose promise is computed on the page and re-computed downstream will disagree with itself.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which classes exist, and is the list the seller's, the manufacturer's, or per agreement?
- What promise does each class carry, and who is accountable when it is missed?
- May a class be changed after submission, and by whom?
