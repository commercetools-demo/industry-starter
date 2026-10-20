<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Server architecture and data flow (BFF)

## Purpose

All commercetools access happens on the server. The browser calls only the app's own endpoints, never commercetools, so secrets stay server-side and the app owns the shape of every response. Catalogue pages are rendered on the server and cached; cart, account and other per-person data load through SWR from Route Handlers.

## Requirements

### Requirement: The BFF boundary

The system SHALL follow this call chain and no other: component, then SWR hook, then Route Handler in `app/api/*`, then `lib/ct/<namespace>.ts`, then commercetools. Server Components may call `lib/ct/*` directly for catalogue data. A Route Handler only validates the session and input, calls one `lib/ct` function and returns JSON.

#### Scenario: Client component needs data
- **GIVEN** a client component needs the cart
- **WHEN** it is written
- **THEN** it uses `useCart()`, which fetches `/api/cart`, and imports no `lib/ct` module

#### Scenario: Raw fetch to commercetools
- **GIVEN** code calls a commercetools REST URL with `fetch`
- **WHEN** it is reviewed
- **THEN** it is rejected; the SDK `apiRoot` is the only client

### Requirement: Type boundary

The system SHALL map every commercetools response to app types in `lib/mappers/*` before it leaves `lib/ct`, and components SHALL import types only from `lib/types.ts`. Prices are integer minor units with a currency code and are formatted by `formatMoney(centAmount, currency, locale)` with two decimals.

#### Scenario: Price display
- **GIVEN** a price of 490 cents in EUR for locale `de-DE`
- **WHEN** it is formatted
- **THEN** it renders as "4,90 €", never "5"

### Requirement: Session

The system SHALL hold session state in a `jose`-signed JWT in an HTTP-only, `sameSite=lax`, 30-day cookie, read and written only on the server. The session carries: `customerId`, `customerEmail`, `customerFirstName`, `customerLastName`, `cartId`, `anonymousId`, `country`, `currency`, `locale`, `collectionStoreKey`. It never carries a commercetools token, the secret or card data.

| Field | Set when | Cleared when |
| --- | --- | --- |
| `customerId` | Login, registration | Logout |
| `cartId` | First add to bag, login merge | Order placed |
| `anonymousId` | First cart for a guest | Login |
| `country`, `currency`, `locale` | Market choice, first visit | Never |
| `collectionStoreKey` | Store chosen | Never (persists) |

#### Scenario: Tampered cookie
- **GIVEN** a session cookie with an invalid signature
- **WHEN** a request arrives
- **THEN** it is treated as an empty session and no error leaks

#### Scenario: Market change
- **GIVEN** a shopper changes market
- **WHEN** country, currency and locale update
- **THEN** all three change together and `cartId` is reset so no cart holds mixed currencies

### Requirement: Route Handler table

The system SHALL expose these handlers, each documented with its request, response and session needs in its workstream:

| Path | Methods | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Connectivity check (removed before deploy) |
| `/api/session/store`, `/api/session/market` | PUT | Collection store and market choice (market updates country, currency, locale together and resets `cartId`) |
| `/api/cart/count` | GET | Header badge count |
| `/api/newsletter`, `/api/contact`, `/api/faq-feedback` | POST | Content-page forms (honest "not sent" when no destination is configured) |
| `/api/auth/login`, `/register`, `/logout`, `/me` | POST, POST, POST, GET | Customer session |
| `/api/cart` | GET, POST, PATCH, DELETE | Cart read, line add or update, addresses, discount codes |
| `/api/cart/lines/[lineId]` | PATCH, DELETE | Quantity, fulfilment, remove |
| `/api/shipping-methods` | GET | Methods for the session currency and country |
| `/api/channels` | GET | Collection stores |
| `/api/availability` | GET | Per-store stock for a SKU |
| `/api/search` | GET | Product Search with facets |
| `/api/shopping-lists` | GET, POST, DELETE | Saved items |
| `/api/orders`, `/api/orders/[id]` | GET | Order history and detail |
| `/api/reviews`, `/api/reviews/[id]` | GET, POST, PATCH, DELETE | Product reviews and the customer's own (`reviews-and-ratings`) |
| `/api/recurring-orders`, `/api/recurring-orders/[id]` | GET, PUT | Subscriptions |
| `/api/recurrence-policies` | GET | Policies for the selector |
| `/api/account/*` | GET, PATCH, DELETE | Profile, addresses |

#### Scenario: Unauthenticated account call
- **GIVEN** no customer session
- **WHEN** `/api/orders` is called
- **THEN** it returns 401 with no data and no detail about why

### Requirement: Catalogue reads use Product Search

The system SHALL use `apiRoot.products().search()` (Product Search API) for listing and search, and never the deprecated `productProjections().search()`. Product Search indexing SHALL be enabled on the project before search is built (`platform-project-setup-and-seed`).

#### Scenario: Facet counts
- **GIVEN** a listing with an active roast filter
- **WHEN** facet counts are requested
- **THEN** each group is counted against all other active groups

### Requirement: Credentials and scopes

The system SHALL use one Frontend API client with only the scopes the storefront needs. Where a feature needs a scope that is too broad for that client (creating reviews needs `manage_products`), the system SHALL use a second, isolated, server-only client for that one module and document it in `plans/DECISIONS.md`; the broad client is never used for anything else.

#### Scenario: Review creation
- **GIVEN** a customer submits a review
- **WHEN** the handler runs
- **THEN** only the review module uses the isolated client, and no other module imports it

### Requirement: Caching

The system SHALL cache only public, stable data (category tree, channel list, recurrence policies, shipping methods) with `unstable_cache` and a TTL plus tags, and SHALL NOT cache per-person data (cart, account, orders, availability tied to a session) on the server. SWR holds per-person data on the client keyed by `lib/cache-keys.ts`, with the customer id or market in the key where it scopes the data.

#### Scenario: Two shoppers
- **GIVEN** two shoppers request their carts at the same time
- **WHEN** both responses return
- **THEN** each contains only its own cart

### Requirement: Cart concurrency

The system SHALL retry a cart update once on a 409 version conflict after re-reading the cart, and SHALL surface a second conflict as a clear error.

#### Scenario: Double click
- **GIVEN** two quantity updates race
- **WHEN** the second hits a stale version
- **THEN** it re-reads and applies once, not twice

### Requirement: Errors

The system SHALL return JSON errors `{ "error": { "code": "...", "message": "..." } }` with a stable code, never a stack trace or a commercetools error body, and log the correlation id server-side.

#### Scenario: commercetools 5xx
- **GIVEN** commercetools returns a 503
- **WHEN** a handler catches it
- **THEN** the client receives code `upstream_unavailable` and the page shows the retry state of the design
