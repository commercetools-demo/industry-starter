<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cost center codes assignable to a purchase

## Purpose

A cost center exists so the buyer's finance team can attribute spend without re-keying it, which only works if every code on an order is a code that still exists in their chart of accounts. Free text or a global code list produces orders that reconcile against nothing, and the platform has no cost-center resource of its own to constrain the value for you.

## Requirements

### Requirement: Cost center codes assignable to a purchase

The system SHALL limit the cost centers a buyer can charge a purchase to those their company has defined and assigned to that buyer, so an order never carries an internal billing code the company does not recognize.

#### Scenario: Only assigned codes offered
- **GIVEN** a buyer assigned to two of their company's cost centers
- **WHEN** they choose a cost center for a purchase
- **THEN** only those two codes are offered, each shown with the label the company gave it

#### Scenario: Unassigned code refused
- **GIVEN** a code that exists for the company but is not assigned to this buyer
- **WHEN** that code is submitted for their purchase
- **THEN** the purchase is refused with the reason, and no order is created carrying the code

#### Scenario: Withdrawn code keeps its history
- **GIVEN** a cost center withdrawn from the list after orders were placed against it
- **WHEN** an administrator opens that cost center's usage history
- **THEN** the earlier orders are still attributed to it, while the code is no longer offered for new purchases

#### Scenario: Company uses no cost centers
- **GIVEN** a company that has defined no cost centers
- **WHEN** a buyer completes a purchase
- **THEN** no cost-center selection is required and the order is placed without one

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Cost center list | `[MIDDLEWARE]` | Account configuration |
| Create / edit cost center form | `[MIDDLEWARE]` | Write to account service |
| Assign users to cost center | `[MIDDLEWARE]` | Cross-reference with identity service |
| Usage / order history per cost center | `[MIDDLEWARE]` | Order aggregation query |

## commercetools

**Entities:** `CustomObject`, `Type`, `Cart`, `Order`, `LineItem`, `BusinessUnit`, `Customer`

**Verified API surface**

- (concept) The extensibility rule for B2B context: data that describes this cart, order or line item is a Custom Field, and a standalone record referenced from elsewhere - a code list, a credit limit, organization-wide configuration - is a Custom Object
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- (concept) An Approval Rule can gate on the cost center by predicating on custom.<fieldName> of the Order, which is the mechanism for departmental sign-off rules; a predicate referencing a field the order does not carry never matches
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)

**Constraints that change the design**

- commercetools has no cost-center resource. Model the code list as Custom Objects in a namespaced container - containers behave as namespaces and can be queried as a set - and the selected code as a Custom Field on the cart, order or line item
 — [docs](https://docs.commercetools.com/api/projects/custom-objects)
- A customizable resource can carry only one Type at a time, so the cost-center field has to be added to the Type already assigned to that resource rather than defined in a Type of its own
 — [docs](https://docs.commercetools.com/api/api-extensibility-overview)
- Custom Fields are queryable and sortable, so per-cost-center order history is an Order query predicate on custom.<fieldName> rather than a client-side filter over fetched orders
 — [docs](https://docs.commercetools.com/api/projects/custom-fields)
- A ReferenceType Custom Field is identified by id only and does not support a KeyReference, so storing the code as a reference to its Custom Object means resolving that id at write time - a string or enum field avoids the extra lookup
 — [docs](https://docs.commercetools.com/api/projects/custom-fields)

**Modeling notes**

Decide up front whether a cost center applies to the whole order or per line, because the two choices land on different resources and only the per-line choice supports a requisition split across departments. Model the code as an enum or string Custom Field validated by the middleware against the Custom Object list, not as a reference, so a withdrawn code stays legible on old orders. Keep the code list per top-level company; a project-wide container makes one buyer's chart of accounts visible to another.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Does a cost center apply to the whole order or per line item, and does a single requisition need to split across several?
- Is the code list mastered in the buyer's ERP and synchronised in, or maintained by the buyer's administrator in the storefront?
- What happens to a buyer's in-flight cart when their cost-center assignment is revoked?
