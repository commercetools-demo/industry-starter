<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

<!-- OUT-OF-SCOPE -->

# Wholesale orders, quotes and invoices

> **Out of scope (owner, 2026-10-12).** Wholesale buying from Malva is not built (Q-V01): resellers pull parts from the master catalog into their product selection, so they already have them. No workstream implements this spec; `plans/verify-plan.mjs` skips it because of the marker line above. Kept for reference only.

## Purpose

After ordering from Malva, a reseller tracks orders, negotiates larger purchases as quotes and settles invoices under payment terms.

Design source: `Malva Seller Portal.dc.html`, pages `orders`, `quotes`, `invoices`.

## Requirements

### Requirement: Orders list

The system SHALL list the account's orders with number, PO number, date, payment terms, approval state, total and status chip, with tabs All, Open, Needs approval, Delivered and an Export CSV action.

#### Scenario: Needs approval
- **GIVEN** an order awaiting tier 1 of 2
- **WHEN** the Needs approval tab renders
- **THEN** it appears with warning tint and "Tier 1 of 2"

### Requirement: Order detail (later phase)

The system SHALL provide order detail with lines, shipments, documents, approval history and reorder.

#### Scenario: Reorder
- **GIVEN** a delivered order
- **WHEN** Reorder is pressed
- **THEN** the lines enter the cart at today's contract prices with differences flagged

### Requirement: Quotes

The system SHALL list quotes with number, subject, status (Negotiating, Offer received, Accepted, Expired), validity, quoted total and next step, with tabs Active, Closed, All and "Request a quote".

#### Scenario: Accepting at the agreed price
- **GIVEN** an offer "Accept at €347.00 / unit"
- **WHEN** accepted
- **THEN** the lines enter the cart at the negotiated price, not the list price, and the quote shows Accepted and the resulting order

#### Scenario: Expired
- **GIVEN** a quote past its validity
- **WHEN** listed
- **THEN** it shows Expired with the lapse date and cannot be accepted

### Requirement: Quote conversation (later phase)

The system SHALL show each quote as a thread of rounds with comments, line prices and actions Accept, Decline, Renegotiate.

#### Scenario: Renegotiate
- **GIVEN** an offer received
- **WHEN** the buyer renegotiates with a comment
- **THEN** the quote returns to Negotiating awaiting Malva's counter

### Requirement: Invoices and balance

The system SHALL list invoices with number, order, issued, due, amount and status (Open, Paid, Overdue), a note stating outstanding balance, overdue amount and payment terms with their as-of time, and "Download statement".

#### Scenario: Overdue
- **GIVEN** an invoice past due
- **WHEN** listed
- **THEN** it shows a critical Overdue chip and is included in the overdue figure

#### Scenario: Finance unavailable
- **GIVEN** the finance source failing
- **WHEN** the page renders
- **THEN** a localised error with Retry shows in place of the table

### Requirement: Pay online (later phase)

The system SHALL offer Pay now on open invoices through the portal's payment provider.

#### Scenario: Partial payment
- **GIVEN** an open invoice
- **WHEN** a partial amount is paid
- **THEN** the balance reduces and status stays Open

## Gaps

- No filters, search, pagination, order detail, invoice detail or pay flow in the design; no credit-limit warnings on cart.
- Payment terms rule (Net 60 above €10,000 with approval) lives in copy only.

## Platform notes

Quote lifecycle (quote request, staged quote, quote, order) from `commercetools-commerce-patterns`. Invoices and balances come from an ERP or finance system, not commercetools.
