<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

## ADDED Requirements

### Requirement: Single server-side commercetools client

The system SHALL create exactly one `apiRoot` in `lib/ct/client.ts` using the client-credentials flow, and every commercetools call SHALL go through it.

#### Scenario: Singleton
- **GIVEN** the codebase
- **WHEN** it is searched for `new ClientBuilder(`
- **THEN** it occurs only in `lib/ct/client.ts`

#### Scenario: No raw HTTP to commercetools
- **GIVEN** any server module
- **WHEN** it needs commercetools data
- **THEN** it uses `apiRoot`; `fetch` to a commercetools host is a lint failure

#### Scenario: Missing configuration
- **GIVEN** a missing `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET` or `CTP_SCOPES`
- **WHEN** the server starts or the client is first used
- **THEN** it fails with a message naming the missing variable, not an authentication error from commercetools

### Requirement: Least-privilege API client

The system SHALL use a Frontend (non-admin) API client whose scopes are limited to what the storefront needs, and SHALL NOT use an admin or `manage_project` client in the storefront.

#### Scenario: Scope review
- **GIVEN** `CTP_SCOPES`
- **WHEN** it is compared with the Frontend API client template for B2B storefronts
- **THEN** every scope beyond the template is listed with a reason in `.env.example`

#### Scenario: Elevated operation needs a separate client
- **GIVEN** an operation the Frontend client's scopes cannot perform (for example creating a Business Unit during registration, if confirmed)
- **WHEN** it is implemented
- **THEN** it uses a second, narrowly scoped server-only client (`provisioningRoot`) built by the same builder function in `lib/ct/client.ts` with its own `CTP_PROV_*` variables documented in `.env.example`, never the admin client; the verified reason is that the My Business Units API creates units `Inactive` and cannot set status, assign stores or add associates

### Requirement: Server-managed session in a signed cookie

The system SHALL keep session state only on the server side of the BFF: a signed token in one HTTP-only, `SameSite=Lax`, `Secure` (outside local development), `path=/` cookie with a 30-day lifetime, readable and writable only through `lib/session.ts`.

#### Scenario: Session contents
- **GIVEN** a created session
- **WHEN** its payload is inspected
- **THEN** it contains only the fields of the Session type: `customerId`, `customerEmail`, `customerFirstName`, `customerLastName`, `cartId`, `businessUnitKey`, `storeKey`, `storeId`, `distributionChannelId`, `supplyChannelId`, `productSelectionId`, `country`, `currency`, `locale`; it contains no password, token, payment or document data

#### Scenario: Tampered or expired cookie
- **GIVEN** a cookie that fails signature or expiry validation
- **WHEN** a request reads the session
- **THEN** it is treated as an anonymous empty session and no error reaches the visitor

#### Scenario: Secret strength
- **GIVEN** `SESSION_SECRET` missing or shorter than 32 characters
- **WHEN** `lib/session.ts` loads outside an explicit test environment
- **THEN** startup fails; there is no built-in fallback key

#### Scenario: Not readable by scripts
- **GIVEN** a browser
- **WHEN** page script reads `document.cookie`
- **THEN** the session cookie is not visible

### Requirement: Session lifecycle

The system SHALL write `customerId` and the customer name and email on sign-in or registration, `cartId` when a cart is created or adopted, SHALL clear the customer, cart and Business Unit fields on sign-out, and SHALL clear `cartId` when a quote request or order is placed; locale and default-store fields persist.

#### Scenario: Sign-out
- **GIVEN** a signed-in client
- **WHEN** they sign out
- **THEN** `customerId`, name, email, `cartId` and `businessUnitKey` are removed and the locale and default-store fields remain

(Credential handling, verification, reset and registration are specified in `malva-website`; sign-in uses `apiRoot.login().post()`, never `apiRoot.customers().login()`.)

### Requirement: Route Handler boundary

The system SHALL expose commercetools data to the browser only through Route Handlers under `app/api/`, each doing three things: validate the session, call one function in `lib/ct/<namespace>.ts`, return JSON.

#### Scenario: Unauthenticated access to account data
- **GIVEN** a request without `customerId` to an endpoint returning account, quote, document or invoice data
- **WHEN** the handler runs
- **THEN** it responds 401 with `{ error }` and calls no commercetools function

#### Scenario: Business unit required
- **GIVEN** a signed-in request without `businessUnitKey` to an endpoint that is Business-Unit-scoped
- **WHEN** the handler runs
- **THEN** it responds 400 "No active business unit" and calls no commercetools function

#### Scenario: Failure shape
- **GIVEN** a commercetools error inside a handler
- **WHEN** the handler responds
- **THEN** it returns a non-2xx JSON `{ error }` with a message safe to show, and the response never contains the raw SDK error, request body or credentials

#### Scenario: No SDK in handlers
- **GIVEN** any Route Handler
- **WHEN** reviewed
- **THEN** it contains no `apiRoot` calls; those live in `lib/ct/<namespace>.ts`

### Requirement: Business-unit writes use the as-associate chain

The system SHALL perform every user-facing write on carts, quote requests, quotes and orders of a signed-in client through `apiRoot.asAssociate().withAssociateIdValue(...).inBusinessUnitKeyWithBusinessUnitKeyValue(...)`, never through project-level `apiRoot.carts()` or similar.

#### Scenario: Signed-in client submits a request
- **GIVEN** a signed-in client with a Business Unit
- **WHEN** a handler creates or changes their cart or quote request
- **THEN** it does so through the as-associate chain with the session's `customerId` and `businessUnitKey`

#### Scenario: Anonymous visitor
- **GIVEN** a visitor with no `customerId`
- **WHEN** they add a service to the quote list
- **THEN** an anonymous cart in the default store is used, and no as-associate call is made

### Requirement: Type boundary

The system SHALL map commercetools SDK responses to app types in `lib/mappers/` before they leave `lib/ct/`, and components SHALL import only from `lib/types.ts`.

#### Scenario: Component imports
- **GIVEN** a component or hook
- **WHEN** it needs a service, cart or quote shape
- **THEN** the type comes from `lib/types.ts`; an import from `@commercetools/platform-sdk` outside `lib/ct` and `lib/mappers` fails lint

#### Scenario: Localized strings
- **GIVEN** a localized field
- **WHEN** a mapper or component renders it
- **THEN** it uses `getLocalizedString(field, locale)` from `lib/utils.ts`, never a hard-coded locale key

#### Scenario: Services are zero-priced and never show a price
- **GIVEN** a service Product whose single variant carries a USD price of 0 (a commercetools line item needs a matching price, so a service without one cannot be added to a Cart)
- **WHEN** it is mapped
- **THEN** the app type has no price field, and `formatMoney` is available in `lib/utils.ts` for later use but is not called for services

### Requirement: Connection health check

The system SHALL include a development-only `GET /api/health` that calls `apiRoot.get()` and returns `{ ok: true, projectKey }`, or `{ ok: false }` with status 500.

#### Scenario: Valid credentials
- **GIVEN** a correct `.env.local`
- **WHEN** `GET /api/health` is called
- **THEN** it returns `{"ok":true,"projectKey":"<key>"}`

#### Scenario: Not shipped
- **GIVEN** a production deployment
- **WHEN** `GET /api/health` is called
- **THEN** it responds 404

## commercetools

Skills: `commercetools-platform` (SDK client, auth), `commercetools-storefront` (BFF, sessions, B2B as-associate chain). Resources in this change: Project (health check only). Login via `apiRoot.login().post()` and registration are wired by `malva-website`. Frontend API client scopes per the platform skill's `sdk-setup.md`.
