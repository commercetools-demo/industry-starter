<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Landing page with session-resolved buyer context

## Purpose

The landing page is the one page every visitor loads, so it is the page most worth caching and the page where caching does the most damage. Its shared merchandising is identical for everyone, while cart count, account identity, entitled promotions and account warnings differ per buyer and per company. Mixing the two into one cacheable response is how one buyer's company name or negotiated offer ends up on another buyer's screen.

## Requirements

### Requirement: Landing page with session-resolved buyer context

The system SHALL resolve every buyer-specific element of the landing page — cart item count, signed-in identity, contract promotions and account alerts — from the current session at request time, and not from page content cached and shared between visitors.

#### Scenario: Anonymous visitor
- **GIVEN** no authenticated session
- **WHEN** a visitor opens the landing page
- **THEN** the shared merchandising renders in full and every account-dependent slot is omitted rather than rendered empty or with a default

#### Scenario: Expired session
- **GIVEN** a session whose token has expired
- **WHEN** the landing page is requested
- **THEN** the page renders as for an anonymous visitor with a sign-in path, and no stale cart count or account name is shown

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Header — logo and global navigation structure | `[STATIC]` | Nav tree from CMS or config |
| Header — search bar | `[STATIC]` | UI shell; query execution is MIDDLEWARE |
| Header — cart icon and item count | `[MIDDLEWARE]` | Session-specific cart state |
| Header — account menu (user name, company) | `[MIDDLEWARE]` | Requires authenticated session |
| Hero banner and promotional carousel | `[STATIC]` | CMS-managed; same for all visitors |
| Featured categories | `[CACHED]` | Category tree from commerce backend, shared |
| Recently ordered and recommended for you | `[MIDDLEWARE]` | User order history plus personalization engine |
| Quick order widget (SKU entry) | `[MIDDLEWARE]` | Product lookup by SKU at runtime |
| Announcements and system alerts | `[STATIC]` | CMS-managed for general notices |
| Footer | `[STATIC]` | CMS-managed links and legal copy |

## commercetools

**Entities:** `BusinessUnit`, `Customer`, `CustomerGroup`, `Store`, `Cart`, `Category`, `CartDiscount`

**Verified API surface**

- (concept) Cart Discounts can be scoped to one or more Stores through the CartDiscount stores array; an empty or absent array applies the discount to every Cart in the Project - this is the mechanism behind account-specific promotional offers — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Constraints that change the design**

- The signed-in company is a Business Unit, not a Customer field. Business Units nest up to five levels with the top level a Company, and Divisions can inherit Stores, Associates with their roles, and Approval Rules from a parent - so the account context shown in the header resolves through the hierarchy — [docs](https://docs.commercetools.com/api/projects/business-units)
- For B2B-specific prices to apply, both businessUnit.customerGroupAssignments and cart.businessUnit must be non-null; if either is missing the platform selects B2C-specific prices instead, silently showing list pricing to a contract buyer — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- The header cart count can change at sign-in: anonymousCartSignInMode chooses between MergeWithExistingCustomerCart and UseAsNewActiveCustomerCart, and the merge can also recalculate tax depending on whether the carts carry a shipping address — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/cart-merge-strategies)

**Modeling notes**

Promotional content itself is not a commercetools resource. What commercetools supplies is the context that selects it - the resolved Business Unit, Store and Customer Group - so the content system should be keyed on those and never on a page-level cache key. Cache the shell and the featured-category tree; fetch the account slots as separate per-session calls so a slow account service degrades a widget rather than the page.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which system owns the hero, announcements and footer copy, and does its targeting key off the Business Unit key or the Customer Group?
- Is 'recently ordered' computed from the buyer's own orders or the whole company account's orders?

---

_Excluded for B2B2C: Personalized promotions (contract-specific); Contract expiry and account alerts._
