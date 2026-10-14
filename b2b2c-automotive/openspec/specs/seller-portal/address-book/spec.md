<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Address book with a default delivery location

## Purpose

Deliveries repeat to the same handful of places - a head office, two warehouses, a site that runs for six months - so re-typing an address per order is both the slowest part of ordering and the largest single source of failed deliveries. The default is the part that carries the value: a book the buyer has to search through every time is only a slower form of re-entry.

## Requirements

### Requirement: Address book with a default delivery location

The system SHALL make every delivery location saved against the account selectable at checkout without re-entry, with exactly one of them marked as the default for new orders.

#### Scenario: Default preselected for a new order
- **GIVEN** an account with three saved addresses, one of them marked default
- **WHEN** the buyer begins a new order
- **THEN** the default is already selected and the other two are offered without the buyer re-entering either

#### Scenario: Validation cannot resolve the address
- **GIVEN** an address the validation service cannot resolve
- **WHEN** the buyer saves it
- **THEN** the fields that could not be resolved are named alongside the service's nearest match, and the buyer decides before anything is stored

#### Scenario: Default address removed
- **GIVEN** the address currently marked default
- **WHEN** the buyer removes it
- **THEN** no address is marked default and the next order asks the buyer to choose, rather than another address being promoted silently

#### Scenario: Company site added centrally
- **GIVEN** an administrator adds a new site to the company account
- **WHEN** another buyer in that company begins an order
- **THEN** the new site is offered to them without their having saved it themselves

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Address cards | `[MIDDLEWARE]` | Account's saved addresses |
| Add and edit address form | `[MIDDLEWARE]` | Write to account |
| Address validation | `[MIDDLEWARE]` | Third-party validation service via middleware |
| Set as default | `[MIDDLEWARE]` | Write to account preferences |

## commercetools

**Entities:** `Customer`, `BusinessUnit`, `Cart`, `Store`, `Type`

**Verified API surface**

- (rest) My Customer Profile exposes the full address set of update actions - addAddress, changeAddress, removeAddress, setDefaultShippingAddress, addShippingAddressId, removeShippingAddressId and the billing equivalents - so a storefront can maintain a personal address book without reaching for the general Customers endpoint — [docs](https://docs.commercetools.com/api/projects/me-profile)
- (update-action) A Business Unit carries its own addresses through addAddress, changeAddress, setDefaultShippingAddress, setDefaultBillingAddress and the addShippingAddressId and addBillingAddressId identifier actions, which is where a company's sites belong rather than on one employee's Customer record — [docs](https://docs.commercetools.com/api/projects/business-units)

**Constraints that change the design**

- commercetools stores addresses but does not verify them; there is no address-verification resource. A third-party service such as Loqate, Google Places or UPS Address Validation is integrated in the frontend or the BFF, before the address is written, to avoid extra calls to commercetools — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)
- Business Unit addresses never inherit down the hierarchy. A Division that inherits its Associates and its Stores from the parent Company still needs its own shipping and billing addresses, and a Division with inherited people but no addresses is a common and easily missed cause of B2B checkout failure — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/inheritance-modes)
- Setting a Cart's shipping address triggers automatic recalculation of shipping cost, taxes and the available delivery options, so the cart has to be re-read after a saved address is applied or the storefront shows totals that no longer match — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)
- Address update actions on the My Business Units API require the UpdateBusinessUnitDetails Permission and return AssociateMissingPermission without it; that API also cannot change a Business Unit's status or manage its Stores — [docs](https://docs.commercetools.com/api/projects/me-business-units)

**Modeling notes**

Decide per project whose book this is. A consumer's book is customer.addresses; a company's delivery locations belong on the Business Unit so they outlive the employee who added them. In both cases the default is a pointer into an existing address set, so the address is saved first and named as default second - batch the two actions in one update if a partially saved state would be visible. Keep the shipping and billing identifier lists distinct from the defaults: an address can be present in the book, absent from shippingAddressIds, and still not be a legal delivery target.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which validation provider, and is it authoritative? A hard block on an unresolvable address will reject legitimate rural and industrial addresses; a warning-only mode returns the delivery failures the integration was bought to prevent.
- Do company sites need per-associate visibility, or may every buyer in a Business Unit ship to every site the company has saved? Associate permissions are per role and per unit, with no per-address granularity.
- Where does a job site that exists for one project live - a Business Unit address that has to be cleaned up later, or a cart-level address that is never reusable?
