<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream G: BFF core (commercetools clients, session, health)

**Depends on:** A (scaffold, gates, lint rules), C (`lib/utils.ts` with `COUNTRY_CONFIG`, `getLocalizedString`; `i18n/config.ts`; `proxy.ts` locale step; `lib/locale-redirect.ts`).
**Parallel with:** E, F (seed). G must not wait for them: every test mocks commercetools; live checks that need seeded stores are deferred to workstream I and listed in section 7.
**Owner prerequisites:** OA-01 (a project key and an API client in `.env.local`; for local dev the seed/admin client may stand in, see decision 6). Never paste secrets in chat. If OA-01 is not `DONE`, do tasks G-01 to G-09 (all offline), then add the OA rows in section 8 and tell Claude; do not wait silently.
**Branch:** `ws/g-bff-core`. Commit per task: `ws-G: G-03 <summary>`.
**Skills:** `commercetools-platform` (`references/sdk-setup.md`: ClientBuilder singleton, scopes), `commercetools-storefront` (`references/core/ct-client.md`, Next.js adapter `data-loading.md` for `lib/session.ts`, the BFF Route Handler shape and the health route; B2B `session-and-bu.md` for the portal session). Tag `[SKILL: ...]` on every task that touches the SDK or the API.

## 1. Goal

Each app has the server tier every later workstream imports:
- **Storefront:** one frontend `apiRoot`; a stateless signed session cookie; store resolution from the URL path (`/[locale]/[store]`) with a short TTL cache; `lib/api.ts` Route Handler helpers; `/api/locale`; `/api/health` (dev only).
- **Portal:** three clients (frontend `apiRoot`, seller-admin `adminRoot`, provisioning `provisioningRoot`), the B2B session, the same helpers, `/api/locale`, `/api/health`.
- Environment validation that fails fast with a message naming the variable, never its value.
- Least-privilege scope registry per client, reconciled with `.env.example`.

Out of scope here: sign-in, carts, associates, ownership checks (`authorizeStore`), Contentools JWT and proxy (H, U, X), any feature endpoint.

## 2. Specs and requirement ids implemented

`b2b2c-automotive/openspec/specs/consumer-storefront/bootstrap-and-structure/spec.md`
- **BFF boundary and helpers**: scenarios `Single client`, `Secret in the bundle`.
- **Stateless session**: scenarios `Weak secret`, `Customer bound to a store` (the guard helper; the sign-in endpoint is workstream Q).
- **Store resolved from the path**: scenarios `Two resellers`, `Unknown store`, `No store segment`, `Store changes mid-session` (proxy half and `lib/ct/stores.ts`; the visual proof with real stores is workstream I).
- **Environment and least privilege**: variables, frontend client, scope reasons (with A's `check-secrets`).
- **Bootstrap acceptance**: `/api/health` confirms commercetools credentials.
- **Gates and tests**: `check-no-health-in-release` is exercised by the real route.

`b2b2c-automotive/openspec/specs/seller-portal/bootstrap-and-structure/spec.md`
- **B2B session**: scenario `Switch business unit or store` (the pure session function; the switch endpoint is R).
- **As-associate for buying, admin client for selling**: the three clients and the lint fence from A-07 (the `authorizeStore` checks and the cross-store tests are R, T, X).
- **Environment and least privilege**: three credential sets, `Scope drift`.
- **Registration and provisioning**: only the provisioning client file; the registration endpoint is R.
- **Bootstrap acceptance**: `/api/health` confirms credentials.

## 3. Design decisions already taken

| Decision | Source |
| --- | --- |
| One `apiRoot` singleton in `lib/ct/client.ts`; one function per operation in `lib/ct/<namespace>.ts`; Route Handlers only validate session, call `lib/ct`, return JSON; browser never calls commercetools; no secret with a public env prefix | storefront spec "BFF boundary and helpers"; skill `ct-client.md` |
| Frontend (non-admin) API client; scopes listed with one-line reasons in `.env.example` | storefront spec "Environment and least privilege" |
| Session = `jose` HS256 JWT in an HTTP-only, `sameSite: lax`, `path: /` cookie, about 30 days; `getSession`, `getLocale`, `createSessionToken`, `setSessionCookie`, `clearSessionCookie` in `lib/session.ts`; `SESSION_SECRET` at least 32 characters; middleware and Node layer read the same secret | storefront spec "Stateless session" |
| Storefront session fields: `customerId`, `cartId`, `locale`, `currency`, `country`, `storeKey`, `distributionChannelId`, `supplyChannelId`, `productSelectionId`; locale triple changes together; `cartId` resets when currency changes | same |
| Portal session fields: `customerId`, `businessUnitKey`, `storeKey`, `distributionChannelId`, `supplyChannelId`, `productSelectionId`, `accountGroupIds`, `cartId`, locale triple; the five business-unit/store fields written together; `storeKey` is also the Contentools namespace | portal spec "B2B session"; skill B2B critical rules |
| Store resolved in `proxy.ts` and `lib/ct/stores.ts` through a short TTL cache; reads the store with its distribution channel, supply channel, product selection; writes the four store fields together; unknown store is 404; store change clears `cartId`; no tenant registry | storefront spec "Store resolved from the path" |
| Three portal credential sets: `CTP_*`, `CTP_ADMIN_*`, `CTP_PROVISION_*`; admin client also needs `manage_key_value_documents`; provisioning scopes include `manage_business_units`; admin client not imported outside `app/api/seller/**`, `lib/ct/seller/**`, `lib/contentools/jwt.ts` | portal spec "As-associate..." and "Environment and least privilege" |
| SDK majors `platform-sdk ^8`, `ts-client ^4` | `design.md` question J, storefront spec "Scaffold" |
| Sessions, `cartId` and store fields reset together; no `customerId` in any URL, log or cache shared between users | skill CRITICAL tier |

Defaults chosen by this plan (specs silent; questions in `plans/notes/questions-ABCGH.md`):
1. Cookie names `malva_session` (storefront) and `malva_portal_session` (portal), `Secure` when `NODE_ENV === 'production'`.
2. `SESSION_SECRET` missing or shorter than 32 characters: `instrumentation.ts` throws at server start; `lib/session.ts` also throws on import, except when `NODE_ENV === 'test'`. No fallback key, ever.
3. `lib/session-core.ts` (sign, verify, pure session transforms, takes the secret as a parameter, no `server-only`, no env access) is imported by `proxy.ts`; A's `check-server-only` is amended in G-03 to exempt exactly `lib/session-core.ts` and `lib/locale-redirect.ts`. Everything else under `lib/ct`, `lib/session.ts`, `lib/contentools` keeps `import 'server-only'`.
4. Default channel pair of a store: the first distribution channel and the first supply channel, sorted by `key` ascending; workstream I's store picker overrides it with the chosen branch (Q-G03).
5. Store cache: in-memory `Map`, TTL 60 s for a found store, 10 s for "not found"; on a commercetools error the proxy uses the stale entry if there is one, otherwise answers 503 (never a 404 for an outage).
6. Local dev may run with the seed/admin client credentials in `.env.local` (the same project), as the sibling project did; this hides missing-scope bugs, so a second health check with the real least-privilege frontend client is required before G is `Done` (OA-08).
7. API error body: `{ "error": "<safe message>" }` with the HTTP status; messages: 400 own validation text, 401 `Not signed in`, 403 `Insufficient permissions to perform this task` (portal spec text), 404 `Not found`, 409 `Conflict, please retry`, anything else `Something went wrong`.

## 4. Tasks

Tags: **S** storefront only, **P** portal only, **S+P** both (same file in both apps unless noted). Write the test first for each.

### G-01 Environment validation and startup check [SKILL: commercetools-platform] [SPEC: Environment and least privilege; Weak secret]
`lib/env.ts` (no `server-only`; imported by the proxy):
```ts
export interface CtConfig { projectKey: string; authUrl: string; apiUrl: string; clientId: string; clientSecret: string; scopes: string[]; }
export interface AppEnv { frontend: CtConfig; sessionSecret: string; contentoolsOrigin: string; }
export interface PortalEnv extends AppEnv { admin: CtConfig; provisioning: CtConfig | null; }
export function validateEnv(env: Record<string, string | undefined>): AppEnv;          // S
export function validatePortalEnv(env: Record<string, string | undefined>): PortalEnv; // P
export function getSessionSecret(): Uint8Array;   // reads process.env.SESSION_SECRET, min 32 chars, TextEncoder
```
Rules: each missing or empty variable throws `Error('Missing environment variable CTP_CLIENT_ID')` (name only, never value); `CTP_AUTH_URL`, `CTP_API_URL`, `CONTENTOOLS_ORIGIN` must parse with `new URL()` (message names the variable); `CTP_SCOPES` splits on whitespace and must not be empty; `SESSION_SECRET` shorter than 32 characters throws `SESSION_SECRET must be at least 32 characters`. Portal: `CTP_ADMIN_*` always required; `CTP_PROVISION_*` required when `CTP_PROVISION_CLIENT_ID` is set or `NODE_ENV === 'production'`, otherwise `provisioning: null`.
`instrumentation.ts`: `export async function register() { if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV !== 'test') validateEnv(process.env) }` (portal: `validatePortalEnv`).
`test/env.ts` (vitest setup, add to `setupFiles`): sets dummy `CTP_*`, `CTP_ADMIN_*`, `CTP_PROVISION_*`, `SESSION_SECRET` of 48 `x`, `CONTENTOOLS_ORIGIN=https://contentools.example.test` when unset.
Tests (`lib/env.test.ts`): one `Missing <VAR>` test per variable (`it.each`), `Weak secret`, `Invalid URL names the variable`, `Error messages never contain the value` (set `CTP_CLIENT_SECRET=topsecretvalue`, break another variable, assert the message lacks it), `Scopes are split on whitespace`, portal: `Provisioning is optional outside production`, `Provisioning is required in production`.

### G-02 commercetools clients [SKILL: commercetools-platform] [SPEC: Single client; BFF boundary]
`lib/ct/client.ts` starts with `import 'server-only'` and is the **only** file containing `new ClientBuilder(`:
```ts
import 'server-only';
import { createApiBuilderFromCtpClient, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import type { CtConfig } from '@/lib/env';
export function createApiRoot(c: CtConfig): ByProjectKeyRequestBuilder {
  const client = new ClientBuilder()
    .withProjectKey(c.projectKey)
    .withClientCredentialsFlow({ host: c.authUrl, projectKey: c.projectKey, credentials: { clientId: c.clientId, clientSecret: c.clientSecret }, scopes: c.scopes })
    .withHttpMiddleware({ host: c.apiUrl })
    .build();
  return createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: c.projectKey });
}
```
S: `export const apiRoot = createApiRoot(validateEnv(process.env).frontend); export const projectKey = ...;`
P: `client.ts` exports `apiRoot` (frontend) and `createApiRoot`; `lib/ct/admin-client.ts` (`import 'server-only'`, `export const adminRoot = createApiRoot(validatePortalEnv(process.env).admin)`), `lib/ct/provisioning-client.ts` (`export function getProvisioningRoot()` returns `createApiRoot(...)` or throws `Provisioning client is not configured` when `provisioning` is null; created lazily and cached). The three files use different credentials; `admin-client.ts` and `provisioning-client.ts` do **not** construct a `ClientBuilder` themselves.
Extend the A-07 ESLint rules: banned in all files except `lib/ct/client.ts`: `fetch(` whose first argument is a string or template containing `commercetools.com` or `CTP_API_URL` or `CTP_AUTH_URL` (rule id `no-raw-commercetools-http`; fixture and test as in A-07).
Tests (`lib/ct/client.test.ts`, mock `@commercetools/ts-client` with `vi.mock`): `Singleton` (a repo-wide text search over tracked `.ts`/`.tsx` files excluding `*.test.*` and `eslint/fixtures` finds `new ClientBuilder(` exactly once, in `lib/ct/client.ts`), `No raw HTTP to commercetools` (lint fixture fails), `Client builder receives split scopes`, `Missing configuration names the variable` (import with an env missing `CTP_PROJECT_KEY`), portal: `Admin and frontend use different credentials` (the mocked builder was called with two different `clientId`s), `Provisioning client throws when not configured`, `Provisioning client is created once`.

### G-03 Session core and session module [SKILL: commercetools-storefront] [SPEC: Stateless session; B2B session]
1. `lib/types.ts` gains the `Session` interface (components and tests import it from here, never from `lib/session`):
   - S: `{ customerId?: string; cartId?: string; locale?: AppLocale; currency?: string; country?: string; storeKey?: string; distributionChannelId?: string; supplyChannelId?: string; productSelectionId?: string }`.
   - P: `{ customerId?: string; businessUnitKey?: string; storeKey?: string; distributionChannelId?: string; supplyChannelId?: string; productSelectionId?: string; accountGroupIds?: string[]; cartId?: string; locale?: AppLocale; currency?: string; country?: string }`.
   Later workstreams extend the interface and the allow-list in the same commit.
2. `lib/session-core.ts` (no `server-only`, no env, no `next/*` imports):
```ts
export const SESSION_KEYS: readonly (keyof Session)[];            // the allow-list, one place
export function pickSession(input: unknown): Session;             // keeps only allow-listed keys with the right primitive type
export async function signSession(session: Session, secret: Uint8Array): Promise<string>;  // HS256, iat, exp 30d
export async function verifySession(token: string | undefined, secret: Uint8Array): Promise<Session>; // {} on missing, tampered, expired, wrong alg
export function applyLocale(session: Session, locale: AppLocale): Session;   // sets locale+currency+country from COUNTRY_CONFIG; clears cartId when currency changes
export interface StoreContext { storeKey: string; distributionChannelId: string; supplyChannelId: string; productSelectionId: string; }
export function applyStore(session: Session, ctx: StoreContext): Session;    // all four together; clears cartId when storeKey changed
// P only:
export interface BusinessContext extends StoreContext { businessUnitKey: string; accountGroupIds: string[]; }
export function applyBusinessContext(session: Session, ctx: BusinessContext): Session; // the five fields in one value; clears cartId
export function setCookieHeader(header: string | null, name: string, value: string): string; // replace or add one cookie in a Cookie header (used by the proxy to forward a fresh session to the same request)
```
`applyStore` and `applyBusinessContext` return a new object; they never return a partially updated one (if any field of `ctx` is empty they throw).
3. `lib/session.ts` (`import 'server-only'`):
```ts
export const SESSION_COOKIE = 'malva_session';       // P: 'malva_portal_session'
export async function getSession(): Promise<Session>;                       // cookies() + verifySession
export async function getLocale(): Promise<{ locale: AppLocale; currency: string; country: string }>; // session triple, else cookie your-shop-country-locale, else DEFAULT_LOCALE
export async function createSessionToken(session: Session): Promise<string>;
export async function setSessionCookie(session: Session): Promise<void>;   // httpOnly, sameSite lax, path /, secure in production, maxAge 30d
export async function clearSessionCookie(): Promise<void>;
export async function updateSession(patch: (s: Session) => Session): Promise<Session>; // read, transform, write once; on error no cookie is written
```
The module computes the secret with `getSessionSecret()` at import and throws unless `NODE_ENV === 'test'`.
4. Amend `scripts/check-server-only.mjs` (A-06): exempt exactly `lib/session-core.ts` and `lib/locale-redirect.ts`; add the test `Pure modules are exempt but nothing else is`.
Tests (`lib/session-core.test.ts`, `lib/session.test.ts`; mock `next/headers` `cookies()` with an in-memory jar): `Session contents are allow-listed` (extra keys and wrong types dropped), `Tampered token gives an empty session`, `Expired token gives an empty session`, `Token signed with another secret gives an empty session`, `alg none is rejected`, `Locale triple changes together`, `cartId resets when currency changes`, `cartId survives a locale change with the same currency`, `Store fields change together`, `Store change clears cartId` (scenario Store changes mid-session, session half), `Incomplete store context throws and changes nothing`, `Cookie flags` (`httpOnly`, `sameSite: 'lax'`, `path: '/'`, `maxAge` about 30 days, `secure` only in production), `Weak secret` (import `lib/session` with a 31-char secret and `NODE_ENV` stubbed to `development`: throws; message mentions 32), `No fallback key` (secret unset: throws), `updateSession writes once`, `setCookieHeader replaces an existing cookie`, `setCookieHeader adds a missing cookie`. P adds: `Business context fields change together` and `Switch business unit or store` (all five fields plus cleared cartId in one returned value).

### G-04 Route Handler helpers [SKILL: commercetools-storefront] [SPEC: BFF boundary and helpers]
`lib/api.ts` (`import 'server-only'`):
```ts
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response>): (...a: A) => Promise<Response>; // maps ApiError and SDK errors (error.statusCode) to safe { error } bodies; logs only status, route-less message class; never the body, headers or credentials
export function requireCustomer(session: Session): asserts session is Session & { customerId: string }; // throws ApiError(401)
export function requireBusinessUnit(session: Session): asserts session is Session & { businessUnitKey: string }; // P only: ApiError(400, 'No active business unit')
export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T>; // zod; ApiError(400, first issue message)
```
Document the Route Handler template (validate session, call `lib/ct`, return `Response.json`) in each README.
Test helpers in `test/api.ts`: `expectUnauthenticated(handler)`, `expectSanitizedError(handler)` (handler that throws `{ statusCode: 500, message: 'secret-token-abc' }`: body is `{"error":"Something went wrong"}` and does not contain `secret-token-abc`).
Tests (`lib/api.test.ts`): `Failure shape`, `Unauthenticated access is 401 before any commercetools call` (assert the mocked `lib/ct` function is not called), `Business unit required` (P), `SDK 404 maps to Not found`, `SDK 409 maps to retry message`, `Unknown error maps to 500 without details`, `Invalid JSON body is 400`, `Zod issue becomes the message`.

### G-05 Types, mappers, store lookup [SKILL: commercetools-storefront] [SPEC: Store resolved from the path; Type boundary]
1. `lib/types.ts`: `Money { centAmount: number; currencyCode: string; fractionDigits: number }`, `LocalizedString = Record<string, string>`, `StoreSummary { key: string; name: string; countries: string[]; currencies: string[] } & StoreContext`.
2. `lib/mappers/index.ts` re-exports; `lib/mappers/money.ts` `mapMoney(m: TypedMoney): Money`; `lib/mappers/store.ts` `mapStore(store: Store): StoreSummary | null` (`null` when the store has no distribution channel, no supply channel or no product selection; name via `getLocalizedString(store.name, locale)` is done by the caller, the mapper keeps the whole localized map in `nameLocalized`).
3. `lib/ttl-cache.ts` (no `server-only`): `createTtlCache<T>({ ttlMs, negativeTtlMs, now = Date.now })` with `get(key)`, `set(key, value | null)`, `getStale(key)`.
4. `lib/ct/stores.ts`: `export async function getStoreContext(storeKey: string): Promise<StoreSummary | null>` using `apiRoot.stores().withKey({ key }).get({ queryArgs: { expand: ['distributionChannels[*]', 'supplyChannels[*]', 'productSelections[*].productSelection'] } })`; 404 returns `null`; other errors rethrow; result cached per decision 5 (stale on error). The key is validated first with `/^[A-Za-z0-9_-]{2,256}$/` (the commercetools key pattern) so odd path segments never reach the API.
Tests (`lib/ttl-cache.test.ts`, `lib/mappers/store.test.ts`, `lib/ct/stores.test.ts`): `Cache hit within the TTL`, `Cache expiry`, `Negative entries expire sooner`, `Store with channels and selection maps to a context`, `Store without a product selection maps to null`, `Channels are chosen by ascending key`, `Unknown store is null`, `Invalid key never calls commercetools`, `Stale entry is served when commercetools fails`, `Failure without a cache entry rethrows`, `Money mapper keeps fraction digits`.

### G-06 Proxy: store resolution after the locale step [SKILL: commercetools-storefront] [SPEC: Store resolved from the path] (S only)
Extend C's `proxy.ts`: after a locale `pass` decision, split the pathname; segment 1 is the store key.
- No segment 1 (path is `/de-DE`): continue (C's page answers 404).
- `getStoreContext(key)` returns `null`: `NextResponse.rewrite(new URL('/' + locale, request.url), { status: 404 })`. The `[locale]/page.tsx` calls `notFound()`, so no catalogue data is touched.
- Lookup throws and there is no stale entry: `new NextResponse('Service unavailable', { status: 503 })`.
- Found: read the session cookie with `verifySession`, `applyStore` (clears `cartId` when the store differs), write the cookie on the response when the session changed, **and** forward the new cookie to the same request with `setCookieHeader` on the request headers so Server Components see the new store in the same request, set request header `x-store-key: <key>` (H and I read it), keep `x-next-intl-locale`.
Spike first (30 minutes): importing `lib/ct/stores.ts` (which has `import 'server-only'`) from `proxy.ts`. Run `npm run build` and `npm run dev` with a request. If it builds and runs, keep it. If Next refuses (`server-only` error in the proxy bundle), use the fallback and note it in the PR: create `app/api/store-context/route.ts` (GET `?store=<key>`, protected by header `x-proxy-token` equal to a hex HMAC-SHA256 of the string `store-context` with `SESSION_SECRET`, otherwise 404), and let the proxy `fetch(new URL('/api/store-context?store=' + key, request.url), { headers: { 'x-proxy-token': token } })`; JSON in, same behaviour out.
Tests (`proxy.test.ts`, mock `@/lib/ct/stores`): `Two resellers` (two keys resolve to two different `x-store-key` and session payloads), `Unknown store` (response is a rewrite to `/de-DE` with status 404; `getStoreContext` called once), `No store segment` (no lookup), `Store changes mid-session` (cookie from store A, request to store B: the new cookie decodes to B's four fields and no `cartId`), `Same store keeps the cart`, `Fresh session is forwarded to the request cookie header`, `Outage without cache is 503`, `Outage with stale entry continues`, `Dev path and api path never trigger a lookup`.

### G-07 `/api/locale` [SKILL: commercetools-storefront] [SPEC: Stateless session, locale triple]
`app/api/locale/route.ts` (S+P): `GET` returns `getLocale()` as JSON; `POST` body `{ locale: 'de-DE' | 'en-US' }` (zod `z.enum(LOCALES)`), applies `applyLocale` to the session via `updateSession`, sets cookie `your-shop-country-locale` (same options as C), returns `{ locale, currency, country }`. Unsupported locale: 400. Wrap in `handle`.
Tests (`app/api/locale/route.test.ts`, use `makeRequest`): `Post switches the triple together`, `Post to a different currency clears the cart`, `Unsupported locale is 400`, `Get falls back to the cookie then to de-DE`, `Tampered session cookie falls back to defaults`.

### G-08 Health route and release guard [SKILL: commercetools-platform] [SPEC: Bootstrap acceptance; Release without health route]
`app/api/health/route.ts` (S+P): returns 404 `{ error: 'Not found' }` when `NODE_ENV === 'production'`; otherwise `apiRoot.get().execute()` and `Response.json({ ok: true, projectKey: body.key })`. P also: `admin` probe `adminRoot.customObjects().get({ queryArgs: { limit: 1 } }).execute()` (success true, failure false without details) and `provisioning: 'configured' | 'missing'` from the env only; `ok` is true when frontend and admin both work. On failure: status 503 `{ ok: false, error: 'commercetools unreachable or credentials invalid' }`, no message from the SDK.
Tests (`app/api/health/route.test.ts`): `Valid credentials`, `Invalid credentials give 503 without details`, `Not shipped` (production returns 404 and calls nothing), portal: `Admin probe failure is reported but not detailed`, plus the A-08 script test `Release without health route` run against the real file.

### G-09 Scopes registry, `.env.example`, bundle check [SKILL: commercetools-platform] [SPEC: Environment and least privilege; Scope drift; Secret in the bundle]
`lib/scopes.ts` (no `server-only`; data only):
```ts
export interface ScopeDoc { scope: string; reason: string; }
export const FRONTEND_SCOPES: readonly ScopeDoc[];   // S: the ten scopes of the storefront spec; P: the twelve of the portal spec
export const ADMIN_SCOPES: readonly ScopeDoc[];      // P: [{ scope: 'manage_key_value_documents', reason: 'read and refresh the Contentools JWT custom object' }]
export const PROVISION_SCOPES: readonly ScopeDoc[];  // P: [{ scope: 'manage_business_units', ... }, view/manage customers, view_stores, view_associate_roles (minimum, no manage_project)]
```
Reasons are copied from the `.env.example` comments written in A-05. `lib/scopes.test.ts` parses `.env.example` (`# <scope> : <reason>` lines per block) and asserts both directions: `Scope used by code but missing from .env.example fails`, `Scope in .env.example but unused fails`, `Every scope has a reason`, `No manage_project anywhere`, `Provisioning has no admin scopes` (P). Later workstreams (T, U, ...) add scopes to the registry and the example together.
Run `npm run verify:build` and confirm `check-bundle-secrets` passes with the real `.env.local` loaded (`set -a; . ./.env.local; set +a` first). Add the test `Secret in the bundle: values in .next/static fail` (already in A-08; here run against a build that reads the real env).

### G-10 Customer-to-store guard helper [SPEC: Customer bound to a store] (S only)
`lib/mappers/customer-store.ts`: `export function customerBelongsToStore(customerStores: { key: string }[] | undefined, storeKey: string): boolean`. The sign-in endpoint (workstream Q) calls it and answers with the generic failure message when false. Tests: `Customer bound to a store` (customer of A signing in at B is refused, at A allowed), `Customer without stores is refused`.

### G-11 Live checks and README
With OA-01 in place: `npm run dev`, `curl -s localhost:3000/api/health` returns `{"ok":true,"projectKey":"<key>"}`; portal on 3001 returns `ok:true` and `admin:true`. Document the env setup, the Route Handler template, and the three-client rule (portal) in each README. Run `npm run check && npm run verify:build` in both apps.

## 5. Test-first scenarios (unit and component tests)

| Test name | File | Spec scenario |
| --- | --- | --- |
| `Singleton`, `No raw HTTP to commercetools`, `Missing configuration names the variable` | `lib/ct/client.test.ts` | Single client; BFF boundary |
| `Secret in the bundle: values in .next/static fail` | `scripts/check-bundle-secrets.test.mjs` | Secret in the bundle |
| `Weak secret`, `No fallback key`, `Tampered token ...`, `Session contents are allow-listed`, `Cookie flags` | `lib/session*.test.ts` | Weak secret; Stateless session |
| `Customer bound to a store` | `lib/mappers/customer-store.test.ts` | Customer bound to a store |
| `Two resellers`, `Unknown store`, `No store segment`, `Store changes mid-session` | `proxy.test.ts` | the four Store-path scenarios |
| `Switch business unit or store`, `Business context fields change together` | `lib/session-core.test.ts` (P) | Switch business unit or store |
| `Admin and frontend use different credentials` | `lib/ct/client.test.ts` (P) | As-associate / admin client separation |
| `Scope used by code but missing from .env.example fails` and its reverse | `lib/scopes.test.ts` | Undocumented scope; Scope drift |
| `Valid credentials`, `Not shipped`, `Release without health route` | `app/api/health/route.test.ts`, A-08 script test | Bootstrap acceptance; Release without health route |
| `Failure shape`, `Unauthenticated access ...`, `Business unit required` | `lib/api.test.ts` | BFF boundary; Route Handler boundary |

Scenarios owned elsewhere: Bare path, Unsupported locale (C); Hook-only fetching (A lint, hooks later); Weak secret at server start via `instrumentation.ts` is covered by the `lib/env.test.ts` unit test, with a manual start in section 6.

## 6. Browser and terminal verification recipe (Claude)

Needs OA-01 (credentials in `.env.local`). Terminal (Bash) first.
1. Weak secret: `SESSION_SECRET=short npm run dev` in each app: the server refuses to serve and the log line says `SESSION_SECRET must be at least 32 characters` (and no variable value). Save `plans/evidence/G/weak-secret-storefront.txt`, `weak-secret-portal.txt`.
2. `npm run dev` (3000 and 3001): `curl -i localhost:3000/api/health` returns 200, `{"ok":true,"projectKey":"<key>"}`; `localhost:3001/api/health` additionally `"admin":true`. Production: `npm run build && npm run start`: `/api/health` returns 404 (check with the real build; note `verify:build` fails while the file exists, so run this with `RELEASE` unset). Save `health-*.txt`.
3. Session cookie, Chrome DevTools MCP, on `http://localhost:3000/de-DE/<store>` where `<store>` is any existing store key (if none exists yet, use `http://localhost:3000/api/locale` instead, which needs no store): `navigate_page`; `evaluate_script` `fetch('/api/locale',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({locale:'en-US'})}).then(r=>r.json())` returns `{locale:'en-US',currency:'USD',country:'US'}`; `document.cookie` does **not** contain `malva_session`; `list_network_requests` then `get_network_request` of the POST: `set-cookie` contains `malva_session=`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Secure` in dev. Repeat with `de-DE` and assert EUR/DE. Screenshot of the network panel result is not available; save the header text to `plans/evidence/G/set-cookie-storefront.txt` and the JSON to `locale-switch.json`.
4. Tamper: with curl, `curl -s -c jar -X POST -H 'content-type: application/json' -d '{"locale":"en-US"}' localhost:3000/api/locale`, edit one character of the cookie value in `jar`, `curl -s -b jar localhost:3000/api/locale` returns the `de-DE` defaults with status 200 (no 500). Save `tamper.txt`.
5. Secret leak: grep the dev server output for the values of `CTP_CLIENT_SECRET` and `SESSION_SECRET` (use `grep -c` with the value from the env in a shell variable, never print it): count must be 0. Save `secret-grep.txt` containing only the two counts.
6. Real least-privilege client (after OA-08, OA-09): repeat step 2 with the real client; any 403 from commercetools means a scope is missing from the registry, fix `lib/scopes.ts` and `.env.example` together.
7. Store resolution live (needs seeded stores from F; otherwise defer to workstream I and note it in the PR): `curl -I localhost:3000/de-DE/<existing-store>` is 200, `curl -I localhost:3000/de-DE/nope` is 404; two stores give different `x-store-key` request behaviour (check through a dev-only log line behind `DEBUG_STORE=1`, not committed).

## 7. Project-data checks (MCP `b2b2c-automotive`, read-only)
- `mcp__b2b2c-automotive__read_project`: the returned `key` equals the `projectKey` from `/api/health`. Record the key (not secrets) in `plans/evidence/G/project.json` together with currencies, countries and languages.
- `mcp__b2b2c-automotive__read_stores` (limit 20): list store keys; for each, note whether `distributionChannels`, `supplyChannels` and `productSelections` are non-empty (the exact preconditions for `mapStore`). If there are no stores yet (F not done), write `no stores yet; live store resolution moves to workstream I` in `plans/evidence/G/stores.md`.
- No write tools; never run a seed from G.

## 8. Manual items for `plans/TODO-MANUAL-TESTING.md` (OA/SO/M)
Add to section 1 (never wait on them; keep going on offline tasks):
| ID | Needed by | Action | Status |
| --- | --- | --- | --- |
| OA-08 | G, before deploy | Create the **frontend API client** for the storefront with exactly the scopes listed in `storefront/.env.example` (template Frontend B2C plus `create_anonymous_token`; no admin scopes); put the values in `storefront/.env.local`. Do not paste secrets in chat. | TODO (local dev uses the OA-01 client meanwhile) |
| OA-09 | G, R, before deploy | Create the portal clients: **frontend** (scopes in `portal/.env.example`), **seller-admin** (`manage_key_value_documents`, more added by T and U), **provisioning** (`manage_business_units` and the minimum customer and store read scopes, no `manage_project`); values in `portal/.env.local` as `CTP_*`, `CTP_ADMIN_*`, `CTP_PROVISION_*`. | TODO |
| OA-10 | G, before deploy | Generate a fresh `SESSION_SECRET` per app and per environment (at least 32 random characters, for example `openssl rand -base64 48`), local and Netlify. | TODO |
Section 3 (manual tests): none required for G (machines verify everything).

## 9. Definition of done
- `npm run check` and `npm run verify:build` green in both apps; every test in section 5 exists and passes; no `it.skip`.
- `new ClientBuilder(` appears once in each app (`grep -rn "new ClientBuilder(" --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v test` prints one line, in `lib/ct/client.ts`).
- No secret value in dev output (section 6 step 5), no `NEXT_PUBLIC_` on any variable in `.env.example`.
- `/api/health` returns the project key in dev, 404 in a production start, and the release build check fails while the file exists.
- Proxy store resolution passes its unit tests; the `server-only` spike result (kept or fallback) is written in the PR.
- OA-G rows exist; Q-G01 to Q-G03 are in `plans/notes/questions-ABCGH.md`.

## 10. Evidence to record
`plans/evidence/G/`: `weak-secret-storefront.txt`, `weak-secret-portal.txt`, `health-storefront.txt`, `health-portal.txt`, `health-production-404.txt`, `set-cookie-storefront.txt`, `set-cookie-portal.txt`, `locale-switch.json`, `tamper.txt`, `secret-grep.txt`, `project.json`, `stores.md`, `spike-server-only-in-proxy.md` (kept or fallback, with the error text if any), and the `npm run check` tails.
