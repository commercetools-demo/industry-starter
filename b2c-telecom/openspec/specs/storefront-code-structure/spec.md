<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront code structure with a server-only commercetools boundary

## Purpose

Every page in this storefront reads or changes commercetools data, and the rules that keep that safe are structural, not stylistic: the browser never talks to commercetools, secrets never leave the server, and components never see raw platform types. If the structure is left to each contributor, the first component that imports the SDK directly puts a secret in the bundle and the first one that reads a raw `ProductProjection` couples the whole UI to the platform schema. Fixing the folder layout and the three layers up front makes the right place for new code obvious and makes violations detectable by tooling.

## Plan notes

**As built by workstreams B and E.** The session module is `lib/ct/session.ts`. The stateless signed cookie (`malva-session`, HttpOnly, SameSite=lax) holds references and `signedInAt` only, never a commercetools token (D-030); customer data is read with the storefront client-credentials client and always filtered by the session's `customerId` (D-070). Boundaries are enforced by ESLint and `check:boundaries`; server modules must start with `import 'server-only'`.

## Requirements

### Requirement: Storefront code structure with a server-only commercetools boundary

The system SHALL organise `site/` so that all commercetools access lives in server-only modules, the browser reaches commercetools only through Route Handlers, and components consume only application types produced by mappers.

#### Scenario: Client code imports a server module
- **GIVEN** a `'use client'` module that imports anything under `lib/ct/`
- **WHEN** lint or build runs
- **THEN** it fails with the import named, rather than shipping the SDK into the client bundle

#### Scenario: Component imports a platform type
- **GIVEN** a component that imports a type from `@commercetools/platform-sdk` or from `lib/ct/`
- **WHEN** lint runs
- **THEN** it fails and points to `lib/types.ts` as the only permitted source of types for components

#### Scenario: Catalog page loaded on the server
- **GIVEN** a category listing page
- **WHEN** it loads categories and offers
- **THEN** it calls `lib/ct/*` directly from an async Server Component, fetches independent data in parallel, and does not make a Route Handler round trip

#### Scenario: Mutable user state loaded through the client layer
- **GIVEN** the cart or the signed-in customer
- **WHEN** a component needs it
- **THEN** it uses a SWR hook that calls a Route Handler, which calls `lib/ct/*`; components never call `fetch('/api/...')` inline

#### Scenario: Session carries no commercetools credential
- **GIVEN** a visitor's session cookie
- **WHEN** it is decoded
- **THEN** it holds only locale, country, currency, cart reference and, when signed in, a customer reference or token the server needs, and it is HTTP-only and signed

#### Scenario: New feature added
- **GIVEN** a contributor adding an endpoint and its client hook
- **WHEN** they follow the repository layout
- **THEN** each of the three layers (commercetools helper, Route Handler, SWR hook) has one obvious location and one existing example to copy

## Components

| Component | Notes |
| --- | --- |
| `app/[locale]/` | Locale-prefixed routes: home, category listing, search, cart, checkout, account |
| `app/api/` | Route Handlers: `auth`, `account`, `cart`, `checkout`, `shipping-methods`, `offers` (configuration validation) |
| `lib/ct/` | Server-only helpers and the `apiRoot` singleton in `client.ts`; guarded by the `server-only` package so a client import fails the build |
| `lib/mappers/` | commercetools to application mappers; the only code that reads SDK response shapes |
| `lib/types.ts` | Application types; the only type source components may import |
| `lib/offers/` | Pure functions for offer configuration and compatibility, shared by server and UI (see `configurable-offers-and-compatibility`) |
| `lib/session.ts` | `jose` signed JWT in an HTTP-only cookie |
| `lib/cache-keys.ts`, `hooks/`, `context/` | SWR keys, client hooks, providers such as the cart context |
| `lib/utils.ts` | Single `COUNTRY_CONFIG`, `formatMoney`, `getLocalizedString` |
| `components/{ui,layout,catalog,offers}/` | Presentational components; `offers/` holds the configurator and add-on pickers |
| `i18n/`, `messages/`, `proxy.ts` | next-intl routing, request config, catalogs, locale middleware |

## commercetools

**Entities:** `Cart`, `Customer`, `Category`, `Product`, `ProductProjection`, `Store`

**Verified API surface**

- (rest) Product Search through `apiRoot.products().search()` is the discovery call; the deprecated `productProjections().search()` is not used — see the `commercetools-platform` skill's product-search reference
- (rest) Customer sign-in uses `apiRoot.login().post()`, not `apiRoot.customers().login()` — per the commercetools-storefront skill

**Constraints that change the design**

- Locale-aware navigation primitives (`Link`, `useRouter`, `redirect`) come from `@/i18n/routing`, never from `next/link` or `next/navigation`, or the locale prefix is lost.
- `redirect()` and `notFound()` throw control-flow errors and must not sit inside `try/catch`.
- `unstable_cache` is only for stable public data (category tree, offer catalog). Anything per-customer or per-session goes through SWR.
- `params` is a Promise in current Next.js and must be awaited.

**Modeling notes**

Catalog is split by volatility: category tree, offer definitions and add-on definitions are cacheable with a TTL and shared by every visitor; price, availability and cart-dependent compatibility are overlaid per request. This is the same split the existing listing and cart specs assume, restated here as folder and caching rules so it is not rediscovered page by page.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Should the lint rules be ESLint `no-restricted-imports` entries, a dedicated boundary-check script, or both?
- Is a stateless signed-cookie session sufficient, or will signed-in customer tokens force a server-side session store?
