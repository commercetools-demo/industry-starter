<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Account area and dashboard

## Purpose

The account area is the shopper's dashboard: current orders and collection status first, the saved collection store, saved items, and personal details. For a coffee retailer it must also manage the recurring part of the relationship (subscriptions), which VELA does not have.

Design source: `AccountPage`, `Toggle`, `DEMO_ORDERS` in `pages-account.jsx`. VELA's B2B dashboard (`pages-b2b-dashboard.jsx`: quotes, approvals, business units) is not carried over (`design.md` D5).

## Requirements

### Requirement: Shell

The system SHALL show an eyebrow "My account", an H1 "Hi, {first}" and a line with membership year and loyalty points, then a 220px vertical tab list beside the content (a horizontal scroller under 900px). The active tab is ink-filled. Sign out is last, muted.

Tabs: Orders, Collection (US market only), Subscriptions (new), Saved, Addresses (new), Payment methods (new), Profile, Settings.

#### Scenario: Not signed in
- **GIVEN** no session
- **WHEN** the account is requested
- **THEN** the shopper is sent to sign-in with the account preserved as the destination; there is no password-reset link, and a new registration lands signed in with no verification step

#### Scenario: Loyalty not offered
- **GIVEN** Malva has no loyalty scheme
- **WHEN** the shell renders
- **THEN** the points text is omitted (`design.md` Q7)

### Requirement: Demo sign-in

The sign-in page SHALL show, below the sign-in box, a "Demo customers" dropdown listing the seeded customers by name and market (for example "Maya Okonkwo (US)", "Priya Nair (Canada)"), with a "Sign in as" button. Choosing a customer and pressing the button signs the shopper in as that customer through the same login path as the form, merges the anonymous bag, and goes to the redirect destination. The list SHALL come from the server; no email address and no password is sent to the browser. The control SHALL be absent when `DEMO_LOGIN_ENABLED` is not `true`.

#### Scenario: Sign in as a seeded customer
- **GIVEN** the sign-in page with demo sign-in enabled
- **WHEN** the shopper picks "Maya Okonkwo (US)" and presses "Sign in as"
- **THEN** they are signed in as that customer and land on the redirect destination, with their bag merged

#### Scenario: Nothing sensitive in the page
- **GIVEN** the sign-in page source and network responses
- **WHEN** they are searched for the seeded emails and the demo password
- **THEN** neither is present

#### Scenario: Disabled
- **GIVEN** `DEMO_LOGIN_ENABLED` is not `true`
- **WHEN** the sign-in page and `POST /api/auth/demo-login` are requested
- **THEN** the dropdown is not rendered and the route answers 404

### Requirement: Orders

The system SHALL list orders newest first as cards: number (Archivo), date and total, a status pill (Ready for collection teal, Delivered grey, otherwise violet) with a collect or truck icon, thumbnails of the items, a teal info block when ready for collection (store, hours, bring ID and number), and buttons: View details, Buy again (delivered), Get directions (ready).

#### Scenario: Ready for collection
- **GIVEN** an order ready at a store
- **WHEN** the Orders tab renders
- **THEN** the card shows the store, its hours and a "Get directions" button

#### Scenario: Buy again
- **GIVEN** a delivered order
- **WHEN** "Buy again" is pressed
- **THEN** available lines are added to the bag, unavailable ones are listed and skipped

#### Scenario: No orders
- **GIVEN** a new account
- **WHEN** the tab renders
- **THEN** it shows a clear empty state with a "Shop coffee" button, never a blank panel

### Requirement: Collection

The system SHALL, in the US market, show the saved collection store (icon tile, name, address, hours, phone, "Change store") and three benefit tiles in a grid (fast collection, in-store returns, member perks).

#### Scenario: Canada market
- **GIVEN** the Canada market is active
- **WHEN** the account renders
- **THEN** the Collection tab is absent and orders show delivery status only

#### Scenario: Change store
- **GIVEN** the Change store button
- **WHEN** it is pressed
- **THEN** the store picker opens and the choice updates availability site-wide

### Requirement: Subscriptions

The system SHALL list subscriptions as cards: product thumbnail, name and variant, interval, next delivery date, price, and actions Skip next, Change interval, Pause, Cancel (confirmed in a modal). New design.

#### Scenario: Skip
- **GIVEN** an active subscription
- **WHEN** Skip next is chosen
- **THEN** the next date moves by one interval and a toast confirms

### Requirement: Saved items

The system SHALL show saved products as a three-up card grid, or an empty card "Nothing saved yet. Tap the heart on any product." with a Browse button.

#### Scenario: Remove
- **GIVEN** a saved card
- **WHEN** its heart is toggled off
- **THEN** it leaves the grid

### Requirement: Addresses and payment methods

The system SHALL list saved addresses as radio-style cards (label, default tag, name, line, phone) with add, edit, delete and set default, and saved payment methods as tokenised cards (brand, last four, expiry, default) with add, remove and set default. New design; addresses can be reused by the hosted Checkout where it supports saved addresses; the storefront does not promise this beyond what the hosted flow does.

#### Scenario: Delete default
- **GIVEN** the default address is deleted
- **WHEN** the deletion is confirmed
- **THEN** the next address becomes default, or none if it was the last

### Requirement: Profile and settings

The system SHALL show a Profile card (first and last name, email, phone, default address, Save changes) and a Settings card with toggle rows (ready-for-collection alerts shown in the account, new arrivals, new arrivals, subscription reminders, loyalty updates when offered) and a muted red "Delete account" button that requires confirmation.

Preferences are stored only; no email is sent (D-032), so no toggle promises an email.

#### Scenario: Toggle
- **GIVEN** a toggle row
- **WHEN** it is pressed
- **THEN** the 44x26 switch animates and the preference is saved immediately

#### Scenario: Delete account
- **GIVEN** Delete account is pressed
- **WHEN** it fires
- **THEN** a confirmation modal states what is erased and what is retained for legal reasons before anything happens
