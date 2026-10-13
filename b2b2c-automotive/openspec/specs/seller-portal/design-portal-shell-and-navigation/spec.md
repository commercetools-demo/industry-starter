<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seller portal shell: top bar, sidebar, switchers, command palette, notifications, copilot

## Purpose

The portal ("Malva Partner Portal" in the design) is where a reseller both runs its own storefront (My store, My customers, With Malva) and buys from Malva (Shop from Malva, Company). One shell must serve both, change what it shows by role and business unit, and keep power-user speed (search, command palette, quick order).

Design source: `Malva Seller Portal.dc.html`, shell and overlays; tokens `design/export/tokens.admin.css`. Not reseller-themed (see `consumer-storefront/theming-design`).

## Requirements

### Requirement: Dark top bar and floating sidebar rail

The system SHALL render an 84 px top bar (dark in both themes) and a floating rounded sidebar rail (316 px, radius 32 px, sticky) on the page canvas, with the active item as a white pill.

#### Scenario: Active item
- **GIVEN** the Catalog & pricing page
- **WHEN** the sidebar renders
- **THEN** that item has the surface background and primary text, other items subdued text with a hover wash

#### Scenario: Narrow viewport
- **GIVEN** a viewport under 1024 px
- **WHEN** the shell renders
- **THEN** the sidebar collapses to an 84 px icon rail, and under 700 px to a drawer opened from the top bar

### Requirement: Navigation groups

The system SHALL group navigation as: Dashboard; My store (Catalog & pricing, Bundles, Product import, Store & channels, Content, Marketing, Email); My customers (Customers, Subscriptions, Returns, Reviews); With Malva (Brand partnership); Shop from Malva (Quick order, Cart & checkout, Orders, Quotes, Approvals, Invoices & billing, Price lists, Saved lists); Company (Company & team, Roles & permissions, Account settings).

#### Scenario: Approvals badge
- **GIVEN** two orders waiting on the signed-in user's role
- **WHEN** the sidebar renders
- **THEN** Approvals shows a count of 2

### Requirement: Navigation follows permissions

The system SHALL hide navigation items the signed-in user's role can never use and SHALL disable (not hide) individual actions the user could normally use, with the reason shown.

#### Scenario: Buyer role
- **GIVEN** a user with the Buyer role
- **WHEN** the shell renders
- **THEN** Brand partnership, Bundles, Email, Content, Marketing, Store & channels, Product import, Customers and Subscriptions are absent

#### Scenario: Approver role
- **GIVEN** an Approver
- **WHEN** the shell renders
- **THEN** Quick order, Cart & checkout and Catalog & pricing are also absent

#### Scenario: Disabled action
- **GIVEN** a user without approval permission opening an order awaiting approval
- **WHEN** the action bar renders
- **THEN** Approve is disabled with "Insufficient permissions to perform this task"

### Requirement: Business unit and store switcher

The system SHALL provide a top-bar switcher listing the company and its divisions plus the stores available, show the current choice in its label ("Hamburg · DACH Online"), and refresh all business-unit-scoped data on change.

#### Scenario: Switch division
- **GIVEN** the user is in Acme Hamburg
- **WHEN** they choose Acme Berlin
- **THEN** a toast confirms, and lists, carts, price lists and approvals reload for Berlin

#### Scenario: Store inherited
- **GIVEN** a division whose store is inherited from its parent
- **WHEN** the switcher renders
- **THEN** that store reads "From parent" and an explicit store reads "Explicit store"

### Requirement: Global search and command palette

The system SHALL offer a top-bar field for part number, OE number or VIN (Enter opens the price build-up for an exact match) and a ⌘K / Ctrl+K palette that jumps to pages or parts (two or more characters).

#### Scenario: Exact part number
- **GIVEN** the code MLV-BD-31201 typed in the top field
- **WHEN** Enter is pressed
- **THEN** the price list page opens on that part

#### Scenario: Escape
- **GIVEN** an open overlay
- **WHEN** Escape is pressed
- **THEN** it closes

### Requirement: Notifications

The system SHALL show a bell with the unread count and a panel of notifications (order shipped, approval waiting, quote counter-offer, customer return received), each linking to its page and individually dismissible, with "You're all caught up." when empty.

#### Scenario: Dismiss
- **GIVEN** three notifications
- **WHEN** one is dismissed
- **THEN** the count drops to two and the item leaves the panel

### Requirement: Customer-session banner

The system SHALL show a warning banner "You are shopping as {customer}. Orders are placed on their behalf." with Exit customer session whenever a seller user acts for a customer.

#### Scenario: Exit
- **GIVEN** the banner is showing
- **WHEN** Exit customer session is pressed
- **THEN** the banner disappears and the seller's own identity is restored

### Requirement: Copilot that asks before changing

The system SHALL offer a Copilot panel for questions and requested changes only when the environment variable `PORTAL_COPILOT_ENABLED` is `true` (see the next requirement), and SHALL require an explicit Confirm showing the exact change before anything is changed, with the outcome stated afterwards.

#### Scenario: Pause a promotion
- **GIVEN** the request "Pause the Brake season promo"
- **WHEN** the Copilot responds
- **THEN** it shows "Set 'Brake season promo' to inactive" with Confirm and Cancel, and only Confirm changes it

### Requirement: Copilot is off until switched on

The system SHALL keep the Copilot off by default. Unless `PORTAL_COPILOT_ENABLED` is `true`, the shell SHALL NOT render the Copilot panel or its launcher, and `POST /api/copilot/plan` and `POST /api/copilot/apply` SHALL answer 404 to a signed-in user (a request with no session still gets 401 first).

#### Scenario: Variable not set
- **GIVEN** `PORTAL_COPILOT_ENABLED` is absent or not `true`
- **WHEN** a signed-in seller opens any portal page
- **THEN** no Copilot launcher is shown and a call to either Copilot route answers 404

#### Scenario: Variable set
- **GIVEN** `PORTAL_COPILOT_ENABLED=true` and a restarted server
- **WHEN** a signed-in seller opens any portal page
- **THEN** the Copilot launcher is shown and the Copilot behaves as in the previous requirement

### Requirement: Light and dark

The system SHALL support light and dark themes through the `data-theme` token set.

#### Scenario: Toggle
- **GIVEN** the moon button
- **WHEN** pressed
- **THEN** all surfaces switch and the top bar stays dark

## Components

Top bar (logo mark 40 px, search 44 px, switcher, ⌘K, bell, Quick order, theme, avatar), sidebar rail, page header (title 32/40, subtitle, one primary action), widget cards (white, radius 8, padding 24), tabs (40 px, radius 8), badges (24 px, radius 4), toast, popovers (radius 16).

## Gaps

- Name mismatch: portal is called "Partner Portal"; the brief says Supplier/Seller. Confirm naming.
- No mobile layout in the file, no focus order, no empty state for a role with no pages.
- Several overlays are positioned with fixed offsets; define responsive behaviour.

## Platform notes

Role gating maps to associate roles and permissions; business units and stores to business-unit hierarchy and store assignment. Use `commercetools-storefront` (B2B permissions, session and BU) and `commercetools-commerce-patterns` (custom associate roles, BU hierarchy).
