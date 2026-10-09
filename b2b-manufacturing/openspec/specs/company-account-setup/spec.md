<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Company account setup

## Purpose

A B2B account is a company, not a person, and it cannot transact until the seller has accepted it and someone inside it has authority to configure it. Treating registration as instant self-service sign-up produces accounts with no credit terms, no delivery locations and nobody entitled to fix either.

## Requirements

### Requirement: Company account setup

The storefront SHALL let a company register, be activated by the seller, and have its first administrator configure the addresses and payment methods the company will buy against.

#### Scenario: Registration pending activation
- **GIVEN** a company submitting its business details
- **WHEN** the registration is submitted
- **THEN** a pending company record exists, the submitter is told activation is required, and no ordering is possible yet

#### Scenario: Activated with an administrator
- **GIVEN** a pending company the seller has accepted
- **WHEN** activation completes
- **THEN** the company can transact and at least one associate holds the permissions needed to configure it

#### Scenario: Sub company under a parent
- **GIVEN** an activated company with divisions that buy separately
- **WHEN** a division is added
- **THEN** the division is modeled beneath the parent and inherits what the parent grants it

#### Scenario: Activation declined
- **GIVEN** a pending company the seller will not accept
- **WHEN** the decision is recorded
- **THEN** the submitter is told, and no partially usable account is left behind

## Pages

- [Account request held until the seller activates it](../account-registration-request/spec.md)
- [Buyer sign-in with password or federated identity](../account-sign-in/spec.md)
- [Address book with a default delivery location](../address-book/spec.md)
- [Company user and role administration](../user-and-role-management/spec.md)
- [Company profile with permission-gated editing](../company-profile/spec.md)
- [Password reset gated on a valid, unexpired reset token](../password-reset/spec.md)
- [Email verification by token with a recoverable resend path](../email-verification/spec.md)

## commercetools

**Entities:** `BusinessUnit`, `Company`, `Division`, `Customer`, `Associate`, `AssociateRole`, `Store`, `Channel`

**Verified API surface**

- (concept) A company is a BusinessUnit; Business Units model companies in hierarchical structures and define which Associates may represent them — [docs](https://docs.commercetools.com/api/associates-overview)
- (concept) An Associate is a Customer acting on behalf of a company; the person and the company are separate resources joined by an AssociateRoleAssignment on the Business Unit — [docs](https://docs.commercetools.com/api/associates-overview)

**Constraints that change the design**

- Associates and their roles are inherited within the Business Unit hierarchy, so a division's access is a function of the parent's grants and not only its own — [docs](https://docs.commercetools.com/api/associates-overview)
- B2B resources — Carts, Orders, Recurring Orders, Quotes, Quote Requests and Shopping Lists — are the ones whose businessUnit field is set; a resource created outside that context is not company-scoped and will not appear in company views — [docs](https://docs.commercetools.com/api/associates-overview)

**Modeling notes**

Decide the Business Unit shape (single company, or company with divisions) before the first account is created — restructuring a hierarchy after orders exist is painful because inheritance changes who can see what. The seller-side activation step is a workflow the storefront reflects, not one it owns; model where that decision is actually made.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Where does seller-side activation happen — Merchant Center, a CRM, or a custom back office?
- Do divisions buy independently, and if so do they inherit the parent's pricing and entitlements?
