<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Controlled goods sold only against a credential that still holds

## Purpose

In most industries anyone with a payment method is a legitimate buyer, and registration is a convenience. Here the right to buy is granted by somebody outside the transaction — a licensing board, a professional register, a plan administrator — and it is granted for a period and for a scope. A practice licensed to dispense one class of device is not thereby licensed for another, and a registration that lapsed last month is not a registration. Treating this as a one-off check at sign-up is the mistake that matters: accounts outlive credentials, so the account that was legitimate when it was approved quietly becomes an unlawful sale channel on the day a license expires, with nothing in the order flow to notice. The check therefore has to be a property of the purchase, not of the account, and it has to distinguish three different answers that look identical to a shopper who is simply told no: not credentialed, credentialed for something else, and credentialed but awaiting verification.

## Requirements

### Requirement: Controlled goods sold only against a credential that still holds

The system SHALL refuse to sell a credential-controlled product unless the buying party holds a credential that is currently valid and whose scope covers that product's control class, checked again at the moment the order is placed rather than only when the account was opened.

#### Scenario: Credential in scope permits purchase
- **GIVEN** a buyer holding a valid credential whose scope covers a controlled product
- **WHEN** they add it and place the order
- **THEN** the order is accepted and records which credential authorized the controlled line

#### Scenario: No credential refuses purchase
- **GIVEN** a buyer holding no credential for the control class
- **WHEN** they attempt to buy a controlled product
- **THEN** the purchase is refused and the credential class required is named

#### Scenario: Credential out of scope
- **GIVEN** a buyer credentialed for one control class
- **WHEN** they attempt to buy a product in a different control class
- **THEN** the purchase is refused, and the refusal distinguishes wrong scope from no credential

#### Scenario: Credential expired between cart and order
- **GIVEN** a cart holding a controlled line added while the credential was valid
- **WHEN** the credential expires before the order is submitted
- **THEN** the order is not accepted on that line, and the expiry is given as the reason

#### Scenario: Verification still pending
- **GIVEN** a buyer whose submitted credential has not yet been verified
- **WHEN** they attempt to buy a controlled product
- **THEN** they are told verification is outstanding rather than that they are ineligible

#### Scenario: Uncontrolled goods unaffected
- **GIVEN** a buyer with no credential at all
- **WHEN** they buy products carrying no control class
- **THEN** the purchase completes normally

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Credential held against the buying party | `[MIDDLEWARE]` | Its class, its issuing authority and the date it expires |
| Control class declared on the product | `[CACHED]` | The control is a fact about the goods, not about the page they appear on |
| Scope comparison rather than a yes or no flag | `[MIDDLEWARE]` | A credential for one class does not unlock another |
| Expiry evaluated against the date of purchase | `[MIDDLEWARE]` | An account is long-lived; a credential is not |
| Verification state distinguished from refusal | `[MIDDLEWARE]` | Pending, refused and expired are three different answers |
| Re-check at order placement | `[MIDDLEWARE]` | The cart may have been built weeks before it was submitted |
| Controlled lines identified on the order | `[MIDDLEWARE]` | Which credential authorized which line, recorded at the time |

## commercetools

**Entities:** `Customer`, `CustomerGroup`, `BusinessUnit`, `AssociateRole`, `Store`, `ProductSelection`, `ProductType`, `Type`, `CustomObject`, `Cart`, `Order`, `Extension`

**Verified API surface**

- (concept) A buyer organization sees a restricted catalog because of a chain: the Business Unit resolves to a Store, and the Store carries the Product Selections; you do not assign Products to a Business Unit directly, you scope the Store and the Business Unit inherits that scope by resolving to it — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/company-specific-product-catalogs)
- (concept) The Customer is the authentication identity and the Associate is that Customer's membership of a Business Unit together with the roles they hold there, which is what lets one person act for more than one company without duplicating their login — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/customers-and-associates)

**Constraints that change the design**

- The default is permissive: a Store with no Product Selections includes every Product in the Project, so restriction is something you add deliberately by attaching at least one Product Selection — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/company-specific-product-catalogs)
- commercetools has no credential, license, registration or professional-scope concept and will not evaluate an expiry date; Custom Objects exist precisely to persist data that does not fit the standard data model, and the platform neither interprets nor enforces what is in them — [docs](https://docs.commercetools.com/api/projects/custom-objects)
- An API Extension can validate a Cart update and reject it by responding 400 with an errors array, and the platform reports the failure with an errorByExtension object naming the Extension that produced it — which is the only server-side place a rule of this kind can be enforced against a direct API call — [docs](https://docs.commercetools.com/guides/extensions)

**Modeling notes**

Two mechanisms, and the split between them is the whole design. Use Store-attached Product Selections for the coarse question of which catalog a credentialed party sees, because that is the one thing the platform will enforce for you across browse, search and price selection. Use an API Extension on cart update and on order creation for the fine question of whether the credential still holds, because Product Selections have no notion of time and will happily go on serving a catalog to an account whose license expired. Do not put the expiry date in a Customer Group: group membership is a set, changing it is a write, and nothing will perform that write on the day the credential lapses. Hold the credential record as a Custom Object or Custom Fields keyed to the buying party, keep the expiry as a date the Extension compares against now, and let the absence of a record and the presence of an expired one produce different errors. Record the authorizing credential on the order line at placement — not a reference that can later be updated, but the identifier and expiry as they stood — because the question asked afterwards is always whether the sale was lawful on the day it happened, and a live reference cannot answer it. Finally, resist modeling verification-pending as a refusal; it is the state most likely to be hit by a genuine customer, and collapsing it into "no" guarantees a support call.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system is the register of record for a credential, and how long may a verification result be cached before it must be re-read?
- When a credential lapses with orders already placed but not yet fulfilled, are those orders canceled, held, or allowed to complete?
- Is the credential held against the individual placing the order, the organization they buy for, or both, and which one governs when they disagree?
- Should controlled products be hidden from an uncredentialed buyer entirely, or shown as unavailable with the credential requirement stated?
