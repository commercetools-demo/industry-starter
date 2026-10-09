<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Invoice recipient and paying account named per destination

## Purpose

Who receives goods, who receives the invoice and who pays the invoice are three different parties in an industrial organization, and they diverge for structural reasons: a site takes delivery, a shared service center processes the paperwork, and a legal entity holds the money. Collapsing them into one billing address is what produces invoices routed to a depot that cannot approve them, and payment taken from an entity with no authority to spend. Getting it right at order capture is far cheaper than correcting it in the ledger afterwards.

## Requirements

### Requirement: Invoice recipient and paying account named per destination

The system SHALL let each destination on an order name its own invoice recipient and its own paying account, and collect settlement against each paying account separately within the one checkout.

#### Scenario: Parties differ from the destination
- **GIVEN** a destination whose invoice recipient and paying account are both different from the receiving site
- **WHEN** the order is confirmed
- **THEN** the order records all three parties separately for that destination

#### Scenario: Two destinations two payers
- **GIVEN** two destinations on one order naming different paying accounts
- **WHEN** settlement is collected
- **THEN** each paying account is settled for its own attributable amount within the one checkout

#### Scenario: Instruments differ per payer
- **GIVEN** two paying accounts settling by different means
- **WHEN** the buyer reaches payment
- **THEN** each account's instrument is collected and bound to that account, rather than one instrument covering the order

#### Scenario: Parties constrained to the organization
- **GIVEN** a buyer at checkout
- **WHEN** they choose an invoice recipient or paying account
- **THEN** only parties recorded against their own organization are selectable, and an unrecognised party is refused

#### Scenario: Default applied visibly
- **GIVEN** a destination for which no invoice recipient or paying account is chosen
- **WHEN** the buyer reviews the order
- **THEN** the organization's default is shown as applied rather than left blank or silently substituted

#### Scenario: One payer fails authorization
- **GIVEN** an order whose destinations name two paying accounts, one of which fails authorization
- **WHEN** settlement is attempted
- **THEN** no partial settlement is left standing and the buyer is told which account failed and for what amount

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Invoice recipient per destination | `[MIDDLEWARE]` | The party that receives and approves the invoice |
| Paying account per destination | `[MIDDLEWARE]` | The account settlement is drawn against, which may differ from the recipient |
| Selectable parties limited to the buyer's own | `[MIDDLEWARE]` | Chosen from the organization's records, never typed free-hand |
| Payment instrument per paying account | `[MIDDLEWARE]` | Different accounts may settle by different means |
| Purchase order and internal coding per destination | `[MIDDLEWARE]` | The reference the buyer's own finance system needs |
| Amount attributable to each paying account | `[MIDDLEWARE]` | Stated before confirmation, not derived afterwards |
| Default inherited when nothing is chosen | `[MIDDLEWARE]` | The organization's default, applied visibly |

## commercetools

**Entities:** `Cart`, `Order`, `Payment`, `PaymentInfo`, `BusinessUnit`, `Customer`, `Type`, `CustomLineItem`

**Verified API surface**

- (concept) An Order or a Cart can reference a set of Payments through the PaymentInfo object, which is what lets one order be settled by more than one payment record — [docs](https://docs.commercetools.com/api/projects/payments)
- (concept) A Payment represents a series of logically connected financial transactions and holds the PSP, the method used, its transactions and its state — so one Payment per paying account keeps each party's settlement independently trackable — [docs](https://docs.commercetools.com/api/projects/payments)
- (concept) Business Units carry billing address identifiers and shipping address identifiers through Add Billing Address Identifier and Add Shipping Address Identifier actions, which is how the parties selectable at checkout are constrained to the organization's own records — [docs](https://docs.commercetools.com/api/projects/business-units)
- (concept) Subscriptions send notifications when a resource is modified and are used to trigger asynchronous processes such as charging a card after an order has shipped, which is how per-payer settlement is driven from an order that is billed later — [docs](https://docs.commercetools.com/api/projects/subscriptions)

**Constraints that change the design**

- commercetools models one billingAddress on a Cart or Order: an invoice recipient and a paying account per destination are Custom Fields on the line or on the itemShippingAddresses entry, not native address roles — [docs](https://docs.commercetools.com/api/projects/carts)
- The actual financial process is carried out by an external PSP, so the amount attributable to each paying account must be computed and authorized by the integration; the platform records Payments and their transactions but does not apportion an order across them — [docs](https://docs.commercetools.com/api/projects/payments)

**Modeling notes**

The platform gives you one billingAddress per order and one Payment list, and this capability needs neither of those shapes: it needs a party triple per destination. Model the invoice recipient and the paying account as Custom Fields carrying references to the organization's own records, attached to the itemShippingAddresses entry rather than to the line, so they live at the same grain as the destination and cannot disagree between two lines going to the same place. Settlement is one Payment per paying account, and the apportionment is yours to compute — the platform will not divide an order total across Payments, so the sum has to be asserted against the order total before authorization rather than after. The failure to design for is the partial one: two payers, one authorization succeeds and one does not, and an order that never completes has real money captured against it. Authorize everything before confirming anything, and make the rollback path explicit.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system is the record of truth for the organization's invoice recipients and paying accounts?
- Who is authorized to name a paying account other than the default, and is that approval recorded?
- When settlement terms rather than an instrument apply, which party's credit standing governs?
