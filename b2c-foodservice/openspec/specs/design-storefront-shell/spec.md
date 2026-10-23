<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront shell: top bar, header, mega menu, mobile nav, footer

## Purpose

The shell is on every page and carries the omnichannel promise: the shopper's collection store (US market), market and currency, search and cart are always one click away. It is the same shell for guests and signed-in members.

Design source: `Header`, `MegaMenu`, `MobileNav`, `Footer`, `Toast` in `components.jsx` and `nav-extras.jsx`.

## Requirements

### Requirement: Promise bar

The system SHALL show a slim ink bar above the header with the delivery threshold, the click-and-collect promise and the returns window, e.g. "Free delivery over {threshold} · Free store collection, ready in {minutes} · {days}-day returns". The collection promise is omitted in the Canada market (delivery only, D-035). The figures come from configuration, not copy.

#### Scenario: Threshold changes
- **GIVEN** the free-shipping threshold is edited in configuration
- **WHEN** any page renders
- **THEN** the bar, cart progress and product pages show the new figure

### Requirement: Sticky header

The system SHALL render a 72px sticky header on a translucent canvas with blur and a hairline bottom border, containing in order: menu toggle (under 820px), the "Malva Coffee" wordmark linking home, primary navigation, then the action cluster: collection-store pill (US market only), market pill (United States or Canada), search, account, cart.

Primary navigation: Nespresso pods, Coffee, Machines, Accessories, Gifts. Each link has an underline that grows on hover and is accent-coloured when active.

#### Scenario: Cart count
- **GIVEN** a cart holding 3 units across 2 lines
- **WHEN** the header renders
- **THEN** the cart icon shows a mono-font badge reading 3 and hides the badge at 0

#### Scenario: Signed in
- **GIVEN** a signed-in shopper
- **WHEN** the header renders
- **THEN** the account icon becomes an initials avatar with a dropdown holding name, email, Dashboard and Sign out (registration and sign-in land the shopper signed in at once, no email step, D-032); a guest sees the plain icon that leads to sign-in

### Requirement: Collection-store pill

The system SHALL show the chosen collection store in the header as "Collect at {store}", opening the store picker. When no store is chosen it reads "Choose a store". In the Canada market the pill is hidden.

#### Scenario: Canada market
- **GIVEN** the Canada market is active
- **WHEN** the header renders
- **THEN** no collection-store pill is shown and the promise bar has no collection text

#### Scenario: Store drives availability
- **GIVEN** the shopper picks a store
- **WHEN** they open any listing or product page
- **THEN** availability lines and the "available at" filter use that store

### Requirement: Mega menu

The system SHALL open a full-width panel on hover of a primary link (130ms close delay, so the pointer can travel into it) with: feature links (new in, bestsellers, sets), a two-column "Shop {category}" list, a "More from Malva" list, and a promo tile with image, headline, line and "Shop {category} →". A strip under the panel lists brew methods (espresso, filter, French press, moka, cold brew) in place of VELA's activity strip.

Nespresso pods: Original and Vertuo, Intensity, Limited editions, Decaf. Coffee: Beans, Ground, Single origin, Blends, Subscriptions. Machines: Nespresso, Bean-to-cup, Espresso, Filter, Grinders. Accessories: Cups and mugs, Milk frothers, Descaling and care, Storage.

#### Scenario: Pointer leaves
- **GIVEN** the mega menu is open
- **WHEN** the pointer leaves both link and panel
- **THEN** it closes after 130ms; re-entering within that time keeps it open

#### Scenario: Link target
- **GIVEN** a mega menu entry bound to a category and facet
- **WHEN** it is clicked
- **THEN** the listing opens with that category and facet applied and the menu closes

### Requirement: Mobile navigation

The system SHALL replace the primary navigation under 820px with a full-screen slide-in panel from the left: wordmark and close, then large Archivo links (24px) separated by hairlines, ending with My account.

#### Scenario: Navigating from the panel
- **GIVEN** the mobile panel is open
- **WHEN** a link is tapped
- **THEN** the panel closes and the page changes

### Requirement: Footer

The system SHALL render an ink footer with a brand column (wordmark, one-line tagline, newsletter sign-up with Join) and four link columns (Shop, Collect (US market only), Help, Company), then a bottom row with copyright and Privacy, Terms, Accessibility.

#### Scenario: Newsletter
- **GIVEN** a visitor enters an email and presses Join
- **WHEN** the address is valid
- **THEN** a toast shows "Thanks, you're on the list" and the address is only recorded (no email is sent, D-032, and no copy promises one); an invalid address shows an inline error, never a silent failure

### Requirement: Toast feedback

The system SHALL confirm cart additions and similar actions with a bottom-centre toast ("Added to bag") that fades after 2.2 seconds and does not take focus.

#### Scenario: Repeated action
- **GIVEN** a toast is showing
- **WHEN** another action fires
- **THEN** the text updates and the timer restarts
