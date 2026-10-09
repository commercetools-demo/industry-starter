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

The system SHALL use a Frontend (non-admin) API client whose scopes are limited to those the storefront needs, and SHALL NOT use an admin or `manage_project` client.

#### Scenario: Scope review
- **GIVEN** `CTP_SCOPES`
- **WHEN** it is compared with the B2C frontend template (plus `manage_sessions` and `manage_orders`)
- **THEN** any scope beyond the template is listed with a reason in `.env.example`

### Requirement: Server-managed session in an opaque cookie

The system SHALL keep session state only on the server side of the BFF: a signed token in one HTTP-only, `SameSite=Lax`, `Secure` (outside local development), `path=/` cookie with a 30-day lifetime, readable and writable only through `lib/session.ts`.

#### Scenario: Session contents
- **GIVEN** a created session
- **WHEN** its payload is inspected
- **THEN** it contains only `customerId`, `cartId`, `country`, `currency` and `locale`; it contains no name, email, date of birth, prescription, appointment or other health data (`health-data-minimization`)

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

### Requirement: Session lifecycle fields

The system SHALL write `customerId` on sign-in or registration, `cartId` when a cart is created or adopted, and SHALL clear `customerId` on sign-out and `cartId` when an order is placed; locale fields persist.

#### Scenario: Sign-out
- **GIVEN** a signed-in patient
- **WHEN** they sign out
- **THEN** `customerId` and `cartId` are removed and the locale fields remain

(Credential handling, verification and reset are specified in `authentication-and-identity`, `account-sign-in` and `password-reset`; sign-in itself uses `apiRoot.login().post()`.)

### Requirement: Route Handler boundary

The system SHALL expose commercetools data to the browser only through Route Handlers under `app/api/`, each doing three things: validate the session, call one function in `lib/ct/<namespace>.ts`, return JSON.

#### Scenario: Unauthenticated access to patient data
- **GIVEN** a request without `customerId` to an endpoint that returns account, order or appointment data
- **WHEN** the handler runs
- **THEN** it responds 401 with `{ error }` and calls no commercetools function

#### Scenario: Failure shape
- **GIVEN** a commercetools error inside a handler
- **WHEN** the handler responds
- **THEN** it returns a non-2xx JSON `{ error }` with a message safe to show, and the response never contains the raw SDK error, request body or credentials

#### Scenario: No SDK in handlers
- **GIVEN** any Route Handler
- **WHEN** reviewed
- **THEN** it contains no `apiRoot` calls; those live in `lib/ct/<namespace>.ts`

### Requirement: Type boundary

The system SHALL map commercetools SDK responses to app types in `lib/mappers/` before they leave `lib/ct/`, and components SHALL import only from `lib/types.ts`.

#### Scenario: Component imports
- **GIVEN** a component or hook
- **WHEN** it needs a cart, order or product shape
- **THEN** the type comes from `lib/types.ts`; an import from `@commercetools/platform-sdk` outside `lib/ct` and `lib/mappers` fails lint

#### Scenario: Localized strings and money
- **GIVEN** a localized field or a price
- **WHEN** a mapper or component renders it
- **THEN** it uses `getLocalizedString(field, locale)` and `formatMoney(centAmount, currencyCode, locale)` from `lib/utils.ts`, never a hard-coded locale key or `centAmount / 100`

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

Skills: `commercetools-platform` (SDK client, auth), `commercetools-storefront` (BFF, sessions). Resources: Project (health check only) in this change. Auth through `apiRoot.login().post()` is wired by the account change. Frontend API client scopes per `sdk-setup.md`.
