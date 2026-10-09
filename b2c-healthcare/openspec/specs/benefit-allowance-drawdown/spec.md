<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A sponsor's allowance, drawn down first and reloaded on a cycle

## Purpose

A sponsor — an employer, a plan, a program — gives a member an amount to spend in this store and nowhere else, refreshed on a cycle, usually forfeited if unused. That is a tender, not a discount and not a budget, and the difference is not pedantry. A discount changes what the goods cost; an allowance leaves the price alone and changes who pays it, which is the only model under which the sponsor can be billed and the member's remaining entitlement can be stated. A budget, meanwhile, watches spend and warns — the allowance actually settles the order, and if it runs out mid-basket the member owes the rest from their own pocket rather than being blocked. Order of application is where implementations go wrong. Draw the allowance last and it is spent on whatever is left after a card has already been charged; draw it first and the member spends the sponsor's money on the things it was granted for, which is what everyone involved intended. The cycle matters too: an allowance that reloads is a recurring liability with a forfeiture date, and members overwhelmingly want to know what will be lost and when.

## Requirements

### Requirement: A sponsor's allowance, drawn down first and reloaded on a cycle

The system SHALL apply the member's remaining sponsor allowance to an order before any other tender, reduce the remaining balance by the amount consumed, and leave only the shortfall to be settled by ordinary payment.

#### Scenario: Allowance covers the order
- **GIVEN** a member whose remaining allowance exceeds the order total
- **WHEN** the order is placed
- **THEN** the whole total is drawn from the allowance, no other tender is taken, and the new balance is stated

#### Scenario: Allowance partly covers the order
- **GIVEN** a member whose remaining allowance is less than the order total
- **WHEN** the order is placed
- **THEN** the allowance is consumed in full and only the shortfall is charged to the member's own tender

#### Scenario: Balance visible before committing
- **GIVEN** a member with an allowance
- **WHEN** they review the basket
- **THEN** the remaining balance and the amount this order would consume are both shown

#### Scenario: Cycle reload
- **GIVEN** a member who exhausted the allowance in the previous cycle
- **WHEN** the cycle rolls over
- **THEN** the new grant is available, and any forfeited remainder is not carried into it

#### Scenario: Forfeiture is announced
- **GIVEN** an allowance that will lapse at the end of the cycle
- **WHEN** the member views their balance
- **THEN** the amount that will lapse and the date it lapses are both stated

#### Scenario: Return restores the balance
- **GIVEN** an order settled partly from the allowance
- **WHEN** it is canceled or returned
- **THEN** the consumed amount is returned to the cycle it came from, or reported as unrecoverable if that cycle has closed

#### Scenario: Allowance is not cash
- **GIVEN** a member with an unspent balance
- **WHEN** they attempt to withdraw it or transfer it to another member
- **THEN** the request is refused

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Allowance balance held per member per cycle | `[MIDDLEWARE]` | Granted amount, consumed amount, remainder, and when it lapses |
| Reload cadence and forfeiture of the unspent remainder | `[MIDDLEWARE]` | Whether it carries over is a scheme rule, not a default |
| Remaining balance shown before checkout | `[MIDDLEWARE]` | Discovered on the basket, not at the payment step |
| Drawdown applied ahead of other tenders | `[MIDDLEWARE]` | Sponsor money first, the member's own money for the shortfall |
| Shortfall settled by ordinary payment | `[MIDDLEWARE]` | Running out is a part-payment, not a refusal |
| Balance restored on cancellation or return | `[MIDDLEWARE]` | To the cycle it came from, if that cycle is still open |
| Allowance confined to this store and this member | `[MIDDLEWARE]` | Not transferable, not refundable as cash |

## commercetools

**Entities:** `Payment`, `PaymentInfo`, `Cart`, `Order`, `CustomObject`, `CustomLineItem`, `Type`, `Customer`, `BusinessUnit`, `Extension`

**Verified API surface**

- (concept) A Payment represents a series of logically connected financial transactions such as reserving, charging or refunding money, and an Order or a Cart can reference a set of Payments using the PaymentInfo object — [docs](https://docs.commercetools.com/api/projects/payments)
- (concept) Custom Objects are grouped into containers which can be used like namespaces, and can be read by container and key or queried within a container — [docs](https://docs.commercetools.com/api/projects/custom-objects)

**Constraints that change the design**

- commercetools has no wallet, stored-value, allowance or entitlement-balance resource; Custom Objects exist to store data that does not fit the standard data model, and the platform neither reloads a balance on a cycle nor enforces that it is non-transferable — [docs](https://docs.commercetools.com/api/projects/custom-objects)
- A maximum of 20000000 Custom Objects can be created per Project as a soft limit, which bounds a design that writes one object per member per cycle and is the number to check before assuming a per-cycle ledger will scale — [docs](https://docs.commercetools.com/api/projects/custom-objects)
- Checkout creates the Order and manages the Payment lifecycle but does not update orderState, and the business logic for capture, cancellation and refund is the implementation's to write — so returning an allowance on a refund is code you own, not a platform behavior — [docs](https://docs.commercetools.com/learning-implement-checkout/implement-commercetools-checkout/payment-lifecycle)

**Modeling notes**

Model the drawdown as a Payment with its own method rather than as a discount on the lines. An Order can reference several Payments through PaymentInfo, so an allowance payment and a card payment coexist naturally, and the reconciliation everyone eventually needs — how much did the sponsor fund this month — is then a query over payments rather than an archaeology exercise over discounts. It also keeps the line prices true, which matters because the sponsor is usually invoiced against them. Hold the balance outside the cart: a Custom Object per member per cycle, containing granted, consumed and lapsed, written under optimistic concurrency. Two orders placed at once against the same balance is the failure worth designing for, and the version conflict is the protection — do not read-modify-write without it. Nothing about the cycle is automatic. The platform will not grant, reload, expire or forfeit anything, so reloading is a scheduled job you own, and the job needs to be idempotent per member per cycle because it will be run twice. On refunds, decide the rule before you need it: returning value to a cycle that has already closed is the case that will happen and the one nobody specifies, and the honest options are restore to the current cycle, refund as money, or forfeit — but not silence.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system grants the allowance, and is commercetools the ledger of record or a mirror of one?
- Does an unspent balance carry into the next cycle, and if not, when exactly does it lapse?
- When an order settled from a closed cycle is refunded, is the value restored, repaid as money, or forfeited?
- Can one member hold allowances from more than one sponsor at once, and in what order are they drawn?
