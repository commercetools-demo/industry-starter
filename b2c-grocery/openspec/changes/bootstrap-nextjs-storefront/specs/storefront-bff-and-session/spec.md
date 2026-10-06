## ADDED Requirements

### Requirement: BFF boundary

Every commercetools call SHALL originate on the server. The browser SHALL reach commercetools only through Route Handlers under `app/api/`, which SHALL do exactly three things: validate the session, call a `lib/ct/<namespace>.ts` function, and return JSON. Route Handlers SHALL NOT contain raw SDK calls, and no code SHALL call commercetools REST endpoints with raw `fetch()`.

#### Scenario: Client data flow
- **WHEN** a component needs the cart
- **THEN** a SWR hook calls `/api/cart`, which calls `lib/ct/cart.ts`, which calls `apiRoot`

#### Scenario: Unauthorized request
- **WHEN** an account endpoint is called without `customerId` in the session
- **THEN** it responds 401 with `{ "error": "Unauthorized" }`

### Requirement: Client singleton

`lib/ct/client.ts` SHALL export a single module-level `apiRoot` built with `ClientBuilder` using client-credentials flow, and every helper SHALL import it from there.

#### Scenario: Second builder
- **WHEN** `new ClientBuilder()` appears outside `lib/ct/client.ts`
- **THEN** review/lint rejects it

### Requirement: Server-only secrets and environment

All commercetools settings (`CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`), `CTP_CHECKOUT_APP_KEY` and `SESSION_SECRET` SHALL be server-only environment variables without a `NEXT_PUBLIC_` prefix. `.env` SHALL be git-ignored and a `.env.example` with placeholders SHALL be committed. The API client SHALL use the Frontend B2C template scopes including `manage_sessions` and `manage_orders`, and SHALL NOT be an admin client.

#### Scenario: Secret in client bundle
- **WHEN** a build output or env file exposes a `NEXT_PUBLIC_CTP_*` or session secret value
- **THEN** the `check:secrets` step of `npm run verify` fails

#### Scenario: Missing scopes
- **WHEN** the API client lacks `manage_sessions`
- **THEN** the health check or cart creation fails and setup docs name the missing scope

### Requirement: Signed cookie session

The session SHALL be a `jose` HS256 JWT in an HTTP-only, `sameSite=lax`, `path=/` cookie with 30-day expiry, read and written only on the server through `lib/session.ts` exposing `getSession`, `getLocale`, `createSessionToken`, `setSessionCookie` and `clearSessionCookie`. The session SHALL hold `customerId`, customer name/email, `cartId`, `country`, `currency` and `locale`, and nothing else sensitive. `SESSION_SECRET` SHALL be at least 32 characters, and the app SHALL refuse to start in production without it.

#### Scenario: Tampered cookie
- **WHEN** the session cookie signature is invalid or expired
- **THEN** `getSession()` returns an empty session and the visitor is treated as anonymous

#### Scenario: Short secret in production
- **WHEN** the production build runs with a missing or short `SESSION_SECRET`
- **THEN** startup fails with a clear message

### Requirement: Customer login and anonymous cart merge

Customer sign-in SHALL use `apiRoot.login().post()` (never `apiRoot.customers().login()`), SHALL pass the session's `anonymousCartId` with `anonymousCartSignInMode: 'MergeWithExistingCustomerCart'`, and SHALL write `customerId` and the merged `cartId` to the session. Sign-in failure messages SHALL NOT distinguish unknown email from wrong password.

#### Scenario: Sign in with items in the bag
- **WHEN** an anonymous visitor with a cart signs in
- **THEN** the cart is merged into the customer's cart and the session `cartId` is the merged cart

#### Scenario: Logout
- **WHEN** a customer logs out
- **THEN** `customerId` and `cartId` are cleared and client cart/account state is invalidated

### Requirement: Connection health check

During development `app/api/health/route.ts` SHALL call `apiRoot.get().execute()` and return `{ ok: true, projectKey }` or `{ ok: false, error }` with status 500. The route SHALL be deleted before any deployment.

#### Scenario: Valid credentials
- **WHEN** `GET /api/health` runs with valid credentials
- **THEN** it returns `{"ok":true,"projectKey":"<key>"}`

### Requirement: Checkout session endpoint

`POST /api/checkout/session` SHALL read `cartId` from the session, verify the cart is non-empty and Active, obtain a token with `manage_sessions`, create a Checkout Session at `https://session.us-central1.gcp.commercetools.com/spec-test-b2c/sessions` with the cart reference and `metadata.applicationKey = CTP_CHECKOUT_APP_KEY`, and return `{ sessionId, projectKey, region }`. The region SHALL be derived from `CTP_API_URL`.

#### Scenario: No cart
- **WHEN** the session has no `cartId`
- **THEN** the endpoint responds 400 and no session is created

### Requirement: Inventory mode on carts

Every cart the app creates SHALL be created with `inventoryMode: 'None'`, `taxMode: 'Platform'`, the session country and currency, and `locale`.

#### Scenario: New cart
- **WHEN** the first line is added by an anonymous visitor
- **THEN** a cart is created with inventory mode None and the session country and currency
