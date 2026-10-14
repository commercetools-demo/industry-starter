<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Saved payment methods and account payment terms

## Purpose

A saved card is the most sensitive thing an account page touches, and the only version of it that is safe to keep is a token the provider can redeem and the storefront cannot. Anchoring the requirement on the representation, rather than on the add and remove buttons, is what keeps the page out of card-data scope. In a business account this page reads two systems of record at once: the vault for instruments, and the finance system for terms and credit, which have very different availability characteristics.

## Requirements

### Requirement: Saved payment methods and account payment terms

The system SHALL hold each saved payment method as a token issued by the payment provider and present it to the buyer only by its non-sensitive descriptor and its default flag.

#### Scenario: Card tokenized then listed
- **GIVEN** card details submitted to the provider's tokenization form
- **WHEN** tokenization succeeds
- **THEN** the account lists the card by brand and last four digits, and the only card reference the storefront holds is the provider's token

#### Scenario: Default method removed
- **GIVEN** the payment method currently marked default
- **WHEN** the buyer removes it
- **THEN** no method is marked default and the next checkout asks the buyer to choose, rather than promoting another method silently

#### Scenario: No methods saved
- **GIVEN** an account with no saved payment methods
- **WHEN** the buyer opens the page
- **THEN** the absence is stated plainly with a path to add one, rather than an empty table

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Saved payment method cards | `[MIDDLEWARE]` | Payment service or vault |
| Add new card form | `[MIDDLEWARE]` | Payment tokenization via middleware |
| Remove and set default | `[MIDDLEWARE]` | Write to payment service |

## commercetools

**Entities:** `PaymentMethod`, `Payment`, `Customer`, `BusinessUnit`, `CustomObject`

**Verified API surface**

- (concept) A PaymentMethod holds the provider token in token.value, identifies the connector through paymentInterface and optionally interfaceAccount, is owned by either a customer or a businessUnit reference, and carries a required default boolean plus a paymentMethodStatus of Active or Inactive — [docs](https://docs.commercetools.com/api/projects/payment-methods)
- (update-action) setDefault and setPaymentMethodStatus are PaymentMethod update actions; deleting a PaymentMethod takes the current version as a required query parameter and generates the PaymentMethodDeleted Message — [docs](https://docs.commercetools.com/api/projects/payment-methods)

**Constraints that change the design**

- Stored Payment Methods in Checkout support card payments only, and automated reversals cannot be performed against a payment made with a Stored Payment Method - a refund path that relies on automated reversal will not work for these payments — [docs](https://docs.commercetools.com/checkout/stored-payment-methods)
- The Customer has to exist in the Project before Stored Payment Methods can be used, and the customer on the PaymentMethod comes from the Cart's customerId - setting the right customerId before Checkout is initialized is the integration's responsibility, not the platform's — [docs](https://docs.commercetools.com/checkout/stored-payment-methods)
- Each Payment Connector that supports Stored Payment Methods is responsible for keeping the PaymentMethods correct and current, and paymentInterface and interfaceAccount come from the connector's deployment configuration - the storefront reads them and does not choose them — [docs](https://docs.commercetools.com/checkout/stored-payment-methods)
- commercetools has no net-terms or credit-line resource. Budget management and credit-limit enforcement are named as genuinely crossing an integration boundary to an external system, alongside invoice-based payment and reconciliation through a PSP or ERP — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/model-buyer-organizations/b2b-commerce-what-changes)
- A buyer's credit limit is data that belongs to no single resource instance, so it is modeled as a Custom Object rather than a Custom Field; most B2B orders settle by invoice on agreed net terms, recorded with the Payments resource while the downstream financial system issues and reconciles the invoice — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Modeling notes**

The default flag lives on each PaymentMethod as a boolean, not as a single pointer on the account, so promoting one method is a change to at least two records. Prefer moving a method to paymentMethodStatus Inactive over deleting it where past Payments reference the same instrument, so history stays readable. Keep the terms panel and the vault panel independently degradable: they have different owners, different SLAs and different failure modes, and coupling them makes an unrelated ERP outage look like the buyer has no cards.

## commercetools skills

Load `commercetools-checkout` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-checkout]`.

## Open questions

- Does PaymentMethodSetDefaultAction clear the flag on the account's previously default method, or does the storefront clear it explicitly? The action takes a boolean per method, which suggests the latter - confirm before shipping, because getting it wrong leaves the buyer with two defaults or none.
- Which system owns the credit line, and can it be read inside the account page's latency budget, or does it have to be cached with a visible staleness marker?
- Are net terms held per company or per sub-account? A Business Unit division can carry its own Custom Fields, but the finance system may only model the parent, in which case a division cannot show its own terms.
- Who may remove a payment method that the whole company uses - the person who added it, any administrator, or nobody from the storefront at all?

---

_Excluded for B2B2C: Net terms and credit line summary._
