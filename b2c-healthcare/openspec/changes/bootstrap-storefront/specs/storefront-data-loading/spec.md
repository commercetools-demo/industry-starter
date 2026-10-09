<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

## ADDED Requirements

### Requirement: Server-rendered catalog, client-fetched patient state

The system SHALL load catalog and other non-personal data in Server Components by calling `lib/ct/*` directly, and SHALL load personal, mutable data (cart, account, orders, appointments, lab results) through a `'use client'` SWR hook → Route Handler → `lib/ct/*`.

#### Scenario: Catalog page
- **GIVEN** a listing or detail page
- **WHEN** it renders
- **THEN** its data is fetched on the server, in parallel (`Promise.all`) for independent calls, and appears in the first HTML response

#### Scenario: Patient data in the first HTML
- **GIVEN** a page that shows the signed-in patient's data
- **WHEN** the response is produced
- **THEN** that data is not embedded in shared or cached markup; it arrives through the session-scoped hook or a per-request, uncached server read

#### Scenario: No endpoint calls in components
- **GIVEN** a component
- **WHEN** it needs a Route Handler
- **THEN** it uses a hook from `hooks/`; direct `fetch('/api/…')` in a component fails lint

### Requirement: Caching only for public, stable data

The system SHALL cache with `unstable_cache` only data identical for every visitor (project settings 300 s; category tree and shipping methods 60 s) and SHALL NOT cache prices, carts, accounts, orders or any session-dependent data.

#### Scenario: Per-patient data never shared
- **GIVEN** a `lib/ct/*` function that receives a `customerId`, `cartId` or session
- **WHEN** it is reviewed
- **THEN** it is not wrapped in `unstable_cache`

#### Scenario: Request de-duplication
- **GIVEN** `generateMetadata` and the page fetching the same resource
- **WHEN** the page renders
- **THEN** the fetch is wrapped in React `cache()` and executes once per request

### Requirement: Initial client state from the session

The system SHALL pre-fill SWR in the root layout with the cart (when `cartId` exists) and a minimal user object, so the header cart count and sign-in slot render without a loading flash.

#### Scenario: Signed-in first paint
- **GIVEN** a request with a valid session and a cart
- **WHEN** the root layout renders
- **THEN** `KEY_CART` and `KEY_ACCOUNT` are in the SWR fallback and the header shows the count immediately

#### Scenario: Stale cart reference
- **GIVEN** a `cartId` whose cart no longer exists or is not active
- **WHEN** the root layout or the cart endpoint loads it
- **THEN** the missing cart is tolerated, `cartId` is cleared from the session, and the page still renders

#### Scenario: User object source
- **GIVEN** the session cookie holds ids only (`storefront-bff-and-session`)
- **WHEN** the display name is needed
- **THEN** it comes from one `getCustomerById` per request on the pages that show it, not from the cookie

### Requirement: Cache keys and invalidation

The system SHALL define SWR keys centrally in `lib/cache-keys.ts` and SHALL revalidate the affected keys after sign-in, sign-out, region change, cart mutation and order placement.

#### Scenario: Sign-out
- **GIVEN** a signed-in patient with cached account and cart data
- **WHEN** they sign out
- **THEN** `KEY_ACCOUNT` and `KEY_CART` are cleared client-side so the next patient on the same browser sees none of it

#### Scenario: Concurrent cart update
- **GIVEN** a cart mutation that returns 409 (version conflict)
- **WHEN** the Route Handler handles it
- **THEN** it refetches the cart and retries once before returning an error

### Requirement: Server Component boundary

The system SHALL pass only serializable data from Server to Client Components and SHALL NOT pass function props across that boundary.

#### Scenario: Interactive child
- **GIVEN** a server-rendered page needing a click handler
- **WHEN** it is built
- **THEN** the handler lives in a `'use client'` child that receives plain data

#### Scenario: Navigation helpers
- **GIVEN** `redirect()` or `notFound()` in server code
- **WHEN** it is called
- **THEN** it is outside any `try/catch`, or the catch calls `unstable_rethrow(error)`

## commercetools

Skill: `commercetools-storefront` (`core/data-loading.md`, `core/performance.md`, Next.js adapter `data-loading.md`). Search and catalog queries use the Product Search API (`apiRoot.products().search()`), not `productProjections().search()`; the catalog modeling itself (D1) is a later change.
