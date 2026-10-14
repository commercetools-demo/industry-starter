<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Dashboard

## Purpose

The dashboard shows a reseller what needs attention today: a heads-up, four numbers, recent orders, work waiting on the user, money owed and saved lists. A failure in one source must never blank the page.

Design source: `Malva Seller Portal.dc.html`, page `dash` (greeting "Good morning, Lena", subtitle with company, account, region and currency).

## Requirements

### Requirement: Heads-up banner

The system SHALL show at most one warning banner for the most urgent upcoming change (for example a price list taking effect) with a Review link.

#### Scenario: Price list change
- **GIVEN** a price list effective 1 November that changes three of the user's quoted parts
- **WHEN** the dashboard renders
- **THEN** the banner names the list and the count and links to Price lists

### Requirement: KPI row

The system SHALL show four KPI cards (Open orders, Awaiting your approval, Outstanding balance, Credit available), each with label, value (24 px bold) and a note.

#### Scenario: Approval count honours role
- **GIVEN** three orders pending, one open to the user's role
- **WHEN** the card renders
- **THEN** it shows 1 with "Only tiers open to your role"

#### Scenario: Zero
- **GIVEN** nothing waiting
- **WHEN** the card renders
- **THEN** it shows 0 and "Nothing waiting"

### Requirement: Widgets are independent

The system SHALL load each widget (Recent orders, Waiting on you, Outstanding invoices, Saved lists) separately and show a critical-tinted error with Retry only in the failed widget.

#### Scenario: Finance system down
- **GIVEN** the finance source is not responding
- **WHEN** the dashboard renders
- **THEN** balance and credit KPIs read "Unavailable", the invoices widget shows "Invoices unavailable — Our finance system isn't responding. The rest of your dashboard is unaffected." with Retry, and every other widget is normal

#### Scenario: Retry succeeds
- **GIVEN** the failed widget
- **WHEN** Retry succeeds
- **THEN** only that widget and the two KPIs update

### Requirement: Recent orders and waiting list

The system SHALL list recent orders with number, PO, date, total and a status chip, and a "Waiting on you" list with order, requester, tier and total, and an empty state "Nothing is waiting for you."

#### Scenario: Status chip tones
- **GIVEN** statuses Shipped, Awaiting approval, Processing, Rejected
- **WHEN** chips render
- **THEN** they use success, warning, info and critical tints respectively

### Requirement: Store performance for the reseller (later phase)

The system SHALL show, for roles with store access, sales, orders, conversion and top products of the reseller's own storefront, separate from purchases from Malva.

#### Scenario: Two views of money
- **GIVEN** a user who both sells and buys
- **WHEN** the dashboard renders
- **THEN** store sales and purchases from Malva appear in clearly labelled separate groups

## Layout

Page body fills the width beside the rail (no 1100 px cap, owner request 2026-10-13: it expands on wider screens); KPI grid 200 px minimum; widget pairs 320 px minimum, stretch to equal height, 16 px gaps.

## Gaps

- The design covers purchasing from Malva only. A reseller store performance block (sales, orders, margin, top products, channel mix) is needed; the Store & channels page already shows channel share.
- No date range, no chart widgets (chart tokens exist: `--color-chart-1…6`).

## Platform notes

Per-widget fetch with error boundaries; balances come from a finance system outside commercetools (see `commercetools-integrations` ERP guidance).
