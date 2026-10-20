<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Account and self-service

## Purpose

Every stored detail a buyer cannot change themselves becomes a support ticket, and a stale default address becomes a misdelivered order. In B2B the same surface additionally decides who inside a company may change shared account data, so self-service and permission are the same problem.

## Requirements

### Requirement: Account and self-service

The storefront SHALL let a buyer change their own stored addresses, payment methods and preferences without involving the seller's support team.

#### Scenario: Address added and defaulted
- **GIVEN** an authenticated buyer
- **WHEN** the buyer adds an address and marks it default
- **THEN** the address is stored on the account and the default is used to preselect delivery on the next order

#### Scenario: Last address removed
- **GIVEN** an account with exactly one stored address
- **WHEN** the buyer removes it
- **THEN** the removal is handled explicitly rather than leaving a checkout that cannot preselect an address

## Pages

- [Address book with a default delivery location](../address-book/spec.md)
- [Order history scoped to what the buyer may see](../order-history/spec.md)
- [Session-scoped account dashboard with explicit empty states](../account-dashboard/spec.md)
- [Saved payment methods and account payment terms](../payment-methods/spec.md)
- [Contact page that confirms only enquiries support has accepted](../contact-us/spec.md)
- [FAQ answers readable and indexable without being expanded](../faq/spec.md)
- [Error pages that name the failure and route the buyer back](../error-pages/spec.md)

## commercetools

**Entities:** `Customer`, `Address`, `Payment`, `BusinessUnit`, `AssociateRole`

**Verified API surface**

- (concept) Addresses live on the Customer with addAddress / changeAddress / removeAddress and separate default shipping and default billing pointers, so 'stored' and 'default' are distinct decisions — [docs](https://docs.commercetools.com/api/projects/customers)

**Constraints that change the design**

- In B2B the equivalent surface is scoped by Associate Permissions on a Business Unit, and permissions come in My and Others pairs — Others never implies My, so a role needs both halves deliberately — [docs](https://docs.commercetools.com/api/projects/associate-roles)

**Modeling notes**

Card details are never stored in commercetools; the Payment resource records the settlement and the PSP holds the instrument. In B2B, do not build a second permission model in the storefront — read the Associate's permissions and let the platform refuse what it should refuse.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which account data is personal to a buyer and which is shared company data that only an admin may change?
