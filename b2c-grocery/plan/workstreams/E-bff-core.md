# E — BFF core: client, session, env, health, market switch

**Specs:** `storefront-bff-and-session` — BFF boundary, Client singleton, Server-only secrets and environment, Signed cookie session, Connection health check, Inventory mode on carts (helper only); `storefront-locale-routing` — Atomic market switch
**Depends on:** A, B · **Unblocks:** G, I, J, O, V · **Decisions:** D-001, D-031 · **Owner prerequisites:** OA-02 for live checks (unit tests need nothing)

## Goal
The only door to commercetools is built: one `apiRoot`, one session module, validated env, a health route, and the atomic market switch endpoint.

## Design

### `lib/env.ts` (`server-only`) + `lib/env-core.ts` (pure)
Implementation note: `next.config.ts` and `instrumentation.ts` run outside React's server condition, where importing `server-only` throws. The pure functions therefore live in `lib/env-core.ts` (no `server-only`); `lib/env.ts` re-exports them with `import 'server-only'`. App code imports `@/lib/env`; only `next.config.ts` / `instrumentation.ts` import `env-core`. Also exports `shouldValidateAtBuild(env)`.
```ts
export type Env = { CTP_PROJECT_KEY: string; CTP_AUTH_URL: string; CTP_API_URL: string; CTP_CLIENT_ID: string; CTP_CLIENT_SECRET: string; CTP_SCOPES: string; CTP_CHECKOUT_APP_KEY: string; SESSION_SECRET: string };
export function validateEnv(source: Record<string, string | undefined> = process.env): Env; // throws Error(`Missing environment variable: NAME`) naming the FIRST missing one; SESSION_SECRET < 32 chars → `SESSION_SECRET must be at least 32 characters`
export function getRegion(apiUrl: string): string; // 'https://api.us-central1.gcp.commercetools.com' → 'us-central1.gcp'
```
`instrumentation.ts` at `site/` root: `export async function register() { if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') validateEnv(); }` (in dev, missing variables are reported lazily when first used).

### `lib/ct/client.ts` (`server-only`)
Singleton exactly as `commercetools-platform/references/sdk-setup.md` Pattern 2 (reads `CTP_*`). Exports `apiRoot`, `projectKey`, `apiUrl`, `authUrl`. Build the client lazily on first access (`let _root; export function getApiRoot()`), and export `apiRoot` as a getter-compatible proxy only if tests need it; the rule is **one builder per process**.
Naming: all other modules do `import { getApiRoot } from './client'` — **use `getApiRoot()`** (lazy; avoids reading env at import time during `next build`).

### `lib/session.ts` (`server-only`) — from the skill's Next.js `data-loading.md`
Exports: `Session`, `getSession()`, `getMarket()` (named so it does not clash with next-intl's `getLocale`), `createSessionToken(data)`, `setSessionCookie(res, token)`, `clearSessionCookie(res)`. Cookie name `malva-session`; HS256; 30 days; `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` in production. `Session` fields: `customerId, customerEmail, customerFirstName, customerLastName, cartId, anonymousId, country, currency, locale`. Secret: `process.env.SESSION_SECRET`; if production and missing/<32 → throw; in test/dev, fall back to `'dev-only-session-secret-0123456789ab'` **only when `NODE_ENV !== 'production'`**.
`getMarket(): Promise<{ country; currency; locale }>` returns the session's `country/currency/locale` when all present, else the `your-shop-country-locale` cookie resolved through `COUNTRY_CONFIG`, else the default; it makes **no** commercetools call.
Helper `updateSession(patch: Partial<Session>, res: NextResponse)`: merges with the current session, re-signs, sets cookie (used by every mutating route).

### Route handlers
- `app/api/health/route.ts` — `GET` → `{ ok: true, projectKey }` or `{ ok: false, error }` (500). Dev only; deleted in Y.
- `app/api/locale/route.ts` — `POST { locale }`: reject unknown locale (400); read session; compute new `{country,currency,locale}` from `COUNTRY_CONFIG`; if currency changed → `cartId` removed; write session + cookie `your-shop-country-locale`; respond `{ locale, currency, country }`.
- Route handler shape for all later routes: validate session → call `lib/ct/<ns>` → JSON; errors → `{ error }` + status.

### `lib/ct/cart-defaults.ts` (`server-only`)
`export function newCartDraft(session): CartDraft` → `{ currency, country, locale, inventoryMode: 'None', taxMode: 'Platform' }` (+ `anonymousId` when no customer). Used by J.

## Tasks
- [x] E-01 Write `lib/env.ts` + `lib/env.test.ts` (missing var named; short secret; `getRegion` for the project URL → `us-central1.gcp`).
- [x] E-02 Write `instrumentation.ts` and test that `register()` throws in production with a missing variable and is silent in development/test. Also make `next.config.ts` call `validateEnv()` when `process.env.NETLIFY === 'true'` (export `shouldValidateAtBuild(env)` and test it) so a Netlify build fails naming the missing variable.
- [x] E-03 Write `lib/ct/client.ts` (lazy singleton). Test (mock `@commercetools/ts-client` and `platform-sdk`): `getApiRoot()` twice returns the same object and builds the client once.
- [x] E-04 Write `lib/session.ts`. Tests (node env, mock `next/headers` cookies): empty when no cookie; round-trip token; tampered token → `{}`; expired → `{}`; production without secret throws; short secret throws.
- [x] E-05 Write `updateSession` helper and tests (merge keeps unrelated fields; cookie flags httpOnly, sameSite lax, 30 days, secure only in production).
- [x] E-06 Write `app/api/health/route.ts` + test with mocked `getApiRoot` (success and failure shapes).
- [x] E-07 Write `app/api/locale/route.ts` + tests: `de-DE` from `en-US` updates all three fields and removes `cartId`; same-currency switch keeps `cartId`; `fr-FR` → 400; cookie set. Write `lib/ct/cart-defaults.ts` + test (inventoryMode None, taxMode Platform, anonymousId only when anonymous).
- [x] E-08 Fill `.env.local` locally from `.env.example` (never commit) and report manual tests M-E-1…M-E-3.
- [x] E-09 Write `lib/rate-limit.ts`: `rateLimit(key, { limit, windowMs }, now = Date.now()): { ok: boolean; retryAfterSeconds: number }` (fixed window, in-memory `Map` on `globalThis`) and `clientKey(request, route)` (first IP of `x-nf-client-connection-ip` else `x-forwarded-for` else `unknown`, plus route). Default limits used by O/X routes: login 10/min, register 5/min, forgot/reset 5/min, contact 5/min. Tests: window resets; limit enforced; keys independent; `retryAfterSeconds` > 0 when blocked. Document in README: per-instance memory on serverless (accepted risk D-047).

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Client data flow / Unauthorized request | helper pattern proven in J/R route tests; E-04/E-06 here |
| Second builder | B lint rule |
| Secret in client bundle | I (check:secrets) |
| Missing scopes | manual M-E-3 |
| Tampered cookie; Short secret in production | E-04 |
| Valid credentials (health) | E-06 (mock) + M-E-1 (live) |
| New cart (inventory None) | E-07 |
| Switch to Germany | E-07 |

## Manual tests to report
- M-E-1 (needs OA-02): `curl http://localhost:3000/api/health` → `{"ok":true,"projectKey":"spec-test-b2c"}`.
- M-E-2: In the browser POST `/api/locale` `{"locale":"de-DE"}` (fetch in DevTools) → response `{locale:'de-DE',currency:'EUR',country:'DE'}` and cookies `malva-session`, `your-shop-country-locale` are set, `HttpOnly` for the first.
- M-E-3 (needs OA-02): Remove `manage_sessions` from the API client scopes (or use a throwaway client) → `/api/health` still ok but checkout session creation (V) fails with a named-scope error. (Run later with V; keep row `BLOCKED` until then.)

## Definition of done
Env validated, one client, one session module, health + locale routes tested; `verify` passes.
