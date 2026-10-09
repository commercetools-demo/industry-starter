<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

## ADDED Requirements

### Requirement: Catalog and marketing data are server-rendered

The system SHALL load service catalog data (categories, service Products, listings, detail pages) and managed marketing content in async Server Components that call `lib/ct/*` directly, with independent fetches issued in parallel.

#### Scenario: Parallel fetch
- **GIVEN** a page needing the category tree and the category's services
- **WHEN** it loads
- **THEN** both are requested with `Promise.all`, not one after the other

#### Scenario: Awaited route parameters
- **GIVEN** a page, `generateMetadata` or an OG image route with route parameters
- **WHEN** it reads them
- **THEN** it awaits `params` and `searchParams`

#### Scenario: Single fetch per request
- **GIVEN** `generateMetadata` and the page both need the same service
- **WHEN** the request is served
- **THEN** commercetools is called once, through a function wrapped in React `cache()`

#### Scenario: Not found
- **GIVEN** a slug that matches no published service
- **WHEN** the page loads
- **THEN** `notFound()` is called outside any `try/catch`

### Requirement: Public pages are cacheable and identical for all visitors

The system SHALL NOT read the session cookie in the root layout, locale layout, or any page that is public, so that public pages can be statically rendered or revalidated and are the same for every visitor.

#### Scenario: Layout without session
- **GIVEN** `app/layout.tsx` and `app/[locale]/layout.tsx`
- **WHEN** reviewed or built
- **THEN** neither calls `cookies()`, `headers()` or `getSession()`, and the build output marks the homepage, listings, service pages and About as static or revalidated, not dynamic

#### Scenario: Signed-in client views the homepage
- **GIVEN** a signed-in client and an anonymous visitor
- **WHEN** both request the homepage
- **THEN** the HTML is identical; sign-in state and the quote-list count appear after hydration

#### Scenario: Reserved space
- **GIVEN** the navigation shows the sign-in state and quote-list count client-side
- **WHEN** the page hydrates
- **THEN** the space for them is reserved so the layout does not shift

### Requirement: Per-visitor state is client-fetched

The system SHALL load the quote list, account, Business Units and every portal list through SWR hooks in `hooks/` that call Route Handlers; read hooks SHALL return safe defaults, mutations SHALL throw on failure and SHALL update the cache from the response body without a refetch.

#### Scenario: Hook shape
- **GIVEN** a read hook and its failure
- **WHEN** the endpoint returns an error
- **THEN** the hook returns `null` or `[]`, not an exception

#### Scenario: Mutation updates cache
- **GIVEN** a mutation that returns the new state
- **WHEN** it succeeds
- **THEN** the cache key is updated with `mutate(KEY, data, { revalidate: false })`

#### Scenario: Keys
- **GIVEN** client-state keys
- **WHEN** they are defined
- **THEN** they live in `lib/cache-keys.ts`, and Business-Unit-scoped ones are `[KEY, businessUnitKey]` tuples

#### Scenario: Sign-out
- **GIVEN** a signed-in client
- **WHEN** they sign out
- **THEN** the account, quote-list and Business Unit entries are cleared

### Requirement: Portal and API routes are never cached

The system SHALL render portal pages dynamically and send `Cache-Control: no-store` on every `app/api` response and every portal page.

#### Scenario: Portal response headers
- **GIVEN** a request to a portal page or an API endpoint
- **WHEN** the response is returned
- **THEN** it carries `Cache-Control: no-store`

### Requirement: Server-side cache for stable public data only

The system SHALL use `unstable_cache` with a TTL only for stable public data and SHALL NOT use it for per-visitor or per-session data.

#### Scenario: TTLs
- **GIVEN** the cached public data
- **WHEN** configured
- **THEN** project configuration uses 300 seconds, the category tree 60 seconds, and managed content a value set with the content owner

#### Scenario: Not cached
- **GIVEN** quote lists, account data and portal data
- **WHEN** they are loaded
- **THEN** they are never read through `unstable_cache`

### Requirement: Listings use the Product Search API

The system SHALL implement service listings and any search through `apiRoot.products().search()`, scoped to the default store, and SHALL NOT use `productProjections().search()`.

#### Scenario: Facet-free listing
- **GIVEN** a category listing
- **WHEN** it is requested
- **THEN** one search call returns the category's services in the stated order, and the sector filter, when used, is part of the same call

#### Scenario: Search not enabled
- **GIVEN** product search indexing is not enabled in the project
- **WHEN** the health or smoke check runs
- **THEN** it reports that indexing is missing rather than returning an empty listing

### Requirement: Documented rule

The system SHALL document the server-versus-client rule, the cache TTL table and the deliberate deviation from the skill's root-layout hydration in `site/README.md`.

#### Scenario: README
- **GIVEN** `site/README.md`
- **WHEN** a developer reads it
- **THEN** it states the rule, the TTLs, and why the root layout does not read the session

## commercetools

Skills: `commercetools-storefront` (`core/data-loading.md`, `stack/nextjs/data-loading.md`, `core/search-facets.md`), `commercetools-platform` (`product-search.md`). Resources: Product, Category, Store, ProductSelection (read through Product Search / projections).
