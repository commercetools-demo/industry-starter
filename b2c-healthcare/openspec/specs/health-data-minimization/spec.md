<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Health information kept out of the commerce record

## Purpose

The thing that makes this industry different is that the transaction record is itself sensitive. A list of what somebody bought, read alongside a name and an address, discloses their condition as surely as a clinical note does — and a commerce platform is built to make exactly that data easy to search, export, aggregate, replicate into analytics and copy into a test environment. None of those behaviors are faults; they are the product working, and they are why the line has to be drawn at what enters rather than at who may read it. Once clinical detail is in, it is in the order search index, in the change messages, in last night's export and in whatever a developer copied into staging, and no later access control reaches all of those places. Drawing the line at the boundary also survives the thing access rules do not: an erasure request, which has to reach every copy, including ones written automatically by the platform itself. The awkward part, and the one worth stating plainly rather than assuming away, is that pseudonymity is not free — the goods themselves can disclose a condition, so an order confirmation, a dispatch note and a parcel label all leak whatever the product name says, however careful the data model was.

## Requirements

### Requirement: Health information kept out of the commerce record

The system SHALL keep health information about an identifiable person outside the commerce platform, carrying only a reference that cannot be resolved to a condition, authorization or course of treatment from commerce data alone.

#### Scenario: Order carries a reference not a condition
- **GIVEN** an order placed against a clinical authorization
- **WHEN** the order and every resource it touches are read
- **THEN** no condition, diagnosis or treatment is present, only a reference resolvable elsewhere

#### Scenario: Commerce data alone does not re identify
- **GIVEN** a full export of commerce data with no access to the clinical system
- **WHEN** it is examined
- **THEN** the clinical meaning of the references in it cannot be recovered

#### Scenario: Erasure reaches derived copies
- **GIVEN** a request to erase an individual's data
- **WHEN** it is carried out
- **THEN** automatically generated messages and internal copies are removed alongside the records themselves

#### Scenario: Subject access is complete
- **GIVEN** a request for everything held about an individual
- **WHEN** it is answered
- **THEN** custom-held data is included and not only the resources the standard model documents

#### Scenario: Disclosure through the goods is handled
- **GIVEN** goods whose name discloses a condition
- **WHEN** a confirmation, dispatch note or label is produced
- **THEN** what it reveals has been decided deliberately rather than inherited from the catalog

#### Scenario: Test environment holds nobody real
- **GIVEN** a non-production environment seeded from production
- **WHEN** it is inspected
- **THEN** it contains no identifiable person and no resolvable clinical reference

#### Scenario: Retention expires with the basis
- **GIVEN** a commerce record whose clinical basis has been withdrawn or has expired
- **WHEN** the retention period is evaluated
- **THEN** the record is removed or de-identified rather than kept indefinitely

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Opaque reference standing in for clinical identity | `[MIDDLEWARE]` | Meaningless without the system that issued it |
| Clinical meaning resolvable only in the owning system | `[MIDDLEWARE]` | Condition, authorization and treatment never land here |
| Disclosure through the goods themselves considered | `[STATIC]` | Confirmations, dispatch notes and labels say what was bought |
| Erasure that reaches automatically written copies | `[MIDDLEWARE]` | Change messages and internal logs, not just the record itself |
| Subject access answerable across every resource holding data | `[MIDDLEWARE]` | Including custom data the standard model knows nothing about |
| Non-production environments carrying no real person | `[MIDDLEWARE]` | Copying a project copies everything in it |
| Retention governed by the owning system | `[MIDDLEWARE]` | The commerce record must not outlive the clinical basis for holding it |

## commercetools

**Entities:** `Customer`, `Order`, `Cart`, `Payment`, `ShoppingList`, `CustomObject`, `Message`, `Type`, `BusinessUnit`

**Verified API surface**

- (rest) A dataErasure parameter set to true on DELETE ensures removal of all personal data related to the object including Messages and internal logs, and is available on Customer, Cart, Order, Payment, Review, ShoppingList, DiscountCode, CustomObject, BusinessUnit, Quote, QuoteRequest and StagedQuote — [docs](https://docs.commercetools.com/api/gdpr)

**Constraints that change the design**

- Merchants are told to review their data model carefully to ensure that no other resource, for example Product or Category, contains or refers to personal data — the platform does not police where personal data is put, so the boundary is a design decision, not a feature — [docs](https://docs.commercetools.com/api/gdpr)
- A standard DELETE request does not erase personal data that is part of Messages, or the logs commercetools keeps internally for some time to reconstruct data in case of faulty system behavior — [docs](https://docs.commercetools.com/api/gdpr)
- Answering a subject access request means querying Customer, Cart, Order, Payment, Review, Shopping List, Discount Code, Custom Object, Message, Business Unit, Quote, Quote Request and Staged Quote individually by Customer ID predicate — there is no single endpoint that returns everything held about a person — [docs](https://docs.commercetools.com/api/gdpr)
- Custom Objects hold data that does not fit the standard data model and are API-only, so anything a clinical integration parks there is outside every default retention and reporting assumption and has to be enumerated deliberately — [docs](https://docs.commercetools.com/learning-model-your-business-structure/extensibility/data-model-extensions)

**Modeling notes**

Decide the boundary once, write it down, and enforce it at the integration rather than in review. What crosses into commerce is an identifier, a quantity and a price; what stays out is everything that gives those meaning. The reference should be opaque and per-project rather than a clinical record number reused across systems, because a shared identifier makes the two datasets joinable by anyone holding both, which is the thing the split was supposed to prevent. Use dataErasure rather than plain DELETE and know why: an ordinary delete leaves the change messages and internal logs behind, and those messages contain the field values that were changed. Enumerate your Custom Objects — they are the blind spot in every retention policy, because they are API-only, invisible in the Merchant Center, and usually created by an integration nobody remembers owning. Non-production is the other blind spot: seeding a sandbox from production is a two-minute job that copies every one of these decisions into a less-guarded place, so de-identification has to be part of the seeding tool and not a step someone remembers. Finally, be honest in the design review about what pseudonymity does not buy you. If the product name discloses the condition then the order confirmation, the dispatch note and the parcel label disclose it too, and that is a packaging and notification decision rather than a data-model one.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Which system is the record of clinical truth, and what is the agreed contract for what may cross into commerce?
- How long may a commerce order be retained after the clinical basis for it has lapsed?
- Who answers a subject access request when the data is split across two systems, and against which identifier?
- What may appear on a confirmation, a dispatch note and a parcel label, and who signs that off?
