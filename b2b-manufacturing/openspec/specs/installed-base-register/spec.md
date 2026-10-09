<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# The buyer's own list of units, held per site

## Purpose

A buyer with a fleet does not shop a catalog, they service a list of machines, and they type the same serial numbers every week because the storefront forgets them. Holding the list makes the buyer's own equipment the entry point to the catalog rather than a search box, and scoping it per site is what stops one depot's list becoming everybody's: the person ordering is responsible for the machines at their location, not the organization's whole fleet.

## Requirements

### Requirement: The buyer's own list of units, held per site

The system SHALL hold the units a buying organization owns or services as a list scoped to the site each unit sits at, and let an entitled buyer start a parts search from any unit on that list without re-entering its identifier.

#### Scenario: Unit added and listed
- **GIVEN** a buyer entitled to manage equipment at one of their organization's sites
- **WHEN** they add a unit by its serial identifier
- **THEN** the unit is validated and appears on that site's list, not on the lists of sites they are not entitled to

#### Scenario: Search starts from a unit
- **GIVEN** a unit already on the buyer's list
- **WHEN** the buyer chooses it as the starting point for a parts search
- **THEN** fitment resolution runs for that unit without the identifier being re-entered

#### Scenario: Bulk upload reports each row
- **GIVEN** a file of units submitted at once
- **WHEN** the upload completes
- **THEN** every row is reported as accepted or rejected with a reason, and the accepted rows appear on the named site's list

#### Scenario: Buyer reference is searchable
- **GIVEN** a unit carrying the buyer's own asset reference
- **WHEN** the buyer searches their list by that reference
- **THEN** the unit is found by the buyer's reference as well as by the manufacturer's identifier

#### Scenario: Site scope respected
- **GIVEN** a buyer entitled to one site of a multi-site organization
- **WHEN** they open the equipment list
- **THEN** only that site's units are listed, and units at the organization's other sites are neither listed nor searchable to them

#### Scenario: Unit removed
- **GIVEN** a unit the organization has disposed of
- **WHEN** an entitled buyer removes it
- **THEN** it leaves the list while orders already placed against it keep their reference to it

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Units listed per site | `[MIDDLEWARE]` | Scoped by the buyer's own site hierarchy, not one flat list per company |
| Add a unit individually | `[MIDDLEWARE]` | Validated against the as-built system before it is accepted |
| Add units in bulk from a file | `[MIDDLEWARE]` | Per-row outcome reported; a fleet is not entered one unit at a time |
| Buyer's own reference and notes per unit | `[MIDDLEWARE]` | The buyer's asset number is how they identify it, not the maker's serial |
| Start a parts search from a unit | `[MIDDLEWARE]` | Hands the identifier to fitment resolution |
| Outstanding service actions against a unit | `[MIDDLEWARE]` | Read from the system that owns them; never authored here |
| List exported | `[MIDDLEWARE]` | The register is also a maintenance document |

## commercetools

**Entities:** `BusinessUnit`, `AssociateRole`, `Customer`, `CustomObject`, `Type`, `ShoppingList`, `Store`

**Verified API surface**

- (concept) Business Units model a buying organization as a Company with Divisions beneath it, hierarchically up to 5 levels, with the top level being of type Company — which is the resource an equipment list is scoped to when the list belongs to a site rather than to a person — [docs](https://docs.commercetools.com/api/projects/business-units)
- (concept) Associates are Customers holding Associate Roles on a Business Unit, and the Associate endpoints validate that an Associate has permission to view or change a unit — so entitlement to a site's equipment list is evaluated server-side rather than hidden in the storefront — [docs](https://docs.commercetools.com/api/projects/business-units)
- (concept) Custom Objects are a generic key-value store addressed by container and key, which is where an equipment register lives when it is the buyer's own data rather than catalog or order data — [docs](https://docs.commercetools.com/api/projects/custom-objects)

**Constraints that change the design**

- Divisions inherit Stores, Associates and their roles, and Approval Rules from parent units, so a list scoped to a Division is visible to associates inherited from the Company above it unless the associate mode is set explicitly — [docs](https://docs.commercetools.com/api/projects/business-units)
- Each top-level Business Unit can include up to 4000 Divisions including direct and indirect children, and only one hierarchy move can run at a time — a concurrent changeParentUnit returns a ConcurrentModification error, including while topLevelUnit is being updated asynchronously — [docs](https://docs.commercetools.com/api/projects/business-units)
- There is no equipment, asset or installed-base resource in commercetools: the register is either a Custom Object keyed by Business Unit or a record in an external asset system, and the platform holds only the reference — [docs](https://docs.commercetools.com/api/projects/custom-objects)

**Modeling notes**

Scope the register to the Business Unit, not to the Customer: the machines belong to the depot, and the person who ordered parts for them last month may have left. That makes Division inheritance the thing to get right — inheriting associates from the Company upward is convenient for administration and is exactly what leaks one site's fleet to another site's buyer, so set the associate mode deliberately rather than taking the default. A Custom Object keyed by Business Unit is enough for a register of a few thousand units and gives you nothing for querying across them; once buyers need to search their fleet by their own asset reference, that search belongs in the asset system and commercetools holds the reference. Do not model a unit as a Product: it is not sellable, it would enter search results, and its lifecycle is nothing like a catalog item's.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which system owns the installed base — the seller's, the manufacturer's, or the buyer's own asset register?
- When a unit changes hands, who is entitled to its service history?
- Is a unit's site assignment maintained by the buyer or received from the servicing organization?
