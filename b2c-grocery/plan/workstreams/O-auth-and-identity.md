# O — Auth pages and identity

**Specs:** `auth-pages-design` (all), `storefront-bff-and-session` (Customer login and anonymous cart merge), existing behavior `authentication-and-identity`, `account-sign-in`, `password-reset`, `email-verification`
**Depends on:** E, H, J · **Unblocks:** Q, R, S, T, W, V · **Decisions:** D-037, D-038 · **Sign-off:** SO-06
**Skill refs:** `commercetools-storefront` `core/customer-auth.md`, `b2c/customer-auth.md`

## Goal
Visitors can register (auto-verified), sign in (anonymous cart merged), reset a password (token only, dev stub link), and the account area is protected.

## Design

### `lib/ct/auth.ts` (`server-only`)
```ts
signIn(email, password, anonymousCartId?): Promise<{ customer: CtCustomer; cart?: CtCart }>   // apiRoot.login().post({ body: { email, password, anonymousCart: anonymousCartId ? { id, typeId: 'cart' } : undefined, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' } })  — NEVER apiRoot.customers().login()
signUp(draft: { email, password, firstName, lastName }): Promise<CtCustomer>                   // apiRoot.customers().post({ body: draft }) then verifyEmailNow(customer)
verifyEmailNow(customer): Promise<void>                                                         // customers().emailToken().post({ body:{ id, version, ttlMinutes: 5 } }) → customers().emailConfirm().post({ body:{ tokenValue } })
createPasswordResetToken(email): Promise<string | null>                                        // customers().passwordToken().post({ body:{ email, ttlMinutes: 60 } }) ; null when customer not found (never throw to the caller)
resetPassword(tokenValue, newPassword): Promise<CtCustomer>                                    // customers().passwordReset().post({ body:{ tokenValue, newPassword } })
```
Verify the exact SDK call shapes against `api-Customer-write` OAS (`node scripts/openApi-schemata.mjs --resource-name api-Customer-write` in the storefront skill folder) in O-01 and record any difference in `PROJECT-FINDINGS.md` §13.

### Routes (all `POST`, JSON)
- `/api/auth/login` `{ email, password }` → sign in with the session's `cartId` as the anonymous cart; writes `customerId, customerEmail, customerFirstName, customerLastName, cartId (merged)`; on any failure → **401** `{ error: 'INVALID_CREDENTIALS' }` (same body for unknown email and wrong password).
- `/api/auth/register` `{ firstName, lastName, email, password }` — password ≥ 8 chars else 400 `{ error:'WEAK_PASSWORD' }`; duplicate email (commercetools `DuplicateField`) → 409 `{ error: 'ACCOUNT_EXISTS' }`; success → customer created, **verified immediately**, signed in, cart merged (call `signIn`).
- `/api/auth/logout` → clears `customerId`, `customer*`, `cartId`; returns `{ ok: true }`.
- `/api/auth/me` `GET` → `{ user: {id,email,firstName,lastName} | null }` from the session only.
- `/api/auth/forgot-password` `{ email }` → always `{ ok: true }` (same body); when a token is created and `NODE_ENV === 'development'`, store it in `lib/dev-stub.ts` (`setLastResetLink(email, url)` storing in `globalThis.__devResetLinks`, a `Map`, so route handlers and pages share it under `next dev` bundling); in production nothing is stored or logged.
- `/api/auth/reset-password` `{ token, password }` → resets, signs in, `{ ok: true }`; expired/invalid token → 400 `{ error: 'INVALID_TOKEN' }`.

### Rate limiting
`/api/auth/login` (10/min), `/register` (5/min), `/forgot-password` and `/reset-password` (5/min) call `rateLimit(clientKey(req, route), …)` from E-09 first; blocked → **429** `{ error: 'RATE_LIMITED' }` with `Retry-After`. Add one test per route.

### Client
- `hooks/useAccount.ts` **(client)**: `useAccount()` → `useSWR(KEY_ACCOUNT, /api/auth/me)`; `useAuthMutations()` → `login`, `register`, `logout`, each: on success `mutate(KEY_ACCOUNT)`, `mutate(KEY_CART)` and `router.refresh()`; **logout also clears** KEY_CART/KEY_ORDERS/KEY_ADDRESSES/KEY_WISHLIST/KEY_RECURRING caches.
- `components/layout/AccountLink.tsx` **(client)**: anonymous → icon button "Sign in" → `/account/sign-in`; signed in → icon/first name → `/account`.
- The `SWRConfig fallback` in `app/[locale]/layout.tsx` also seeds `KEY_ACCOUNT` from the session fields (no commercetools call).
- Safe redirect helper `lib/safe-redirect.ts`: `safeRedirectPath(input, locale)` returns the path only if it starts with `/`, not `//`, not containing `://`, and starts with `/<locale>/`; else `/<locale>/account`.

### Pages (`app/[locale]/account/…`)
`sign-in`, `register`, `forgot-password`, `reset-password` (token in query), and the dev stub `dev/reset-link` (`notFound()` unless `NODE_ENV === 'development'`; shows the last link). Layout `components/auth/AuthCard` = 440 px `Card` (`lg×1.15` radius, surface), H2, `Field`s, primary block button, secondary links.
Protected group: `app/[locale]/account/(protected)/layout.tsx` (Server): `const session = await getSession(); const path = (await headers()).get('x-pathname') ?? '/' + locale + '/account'` (header set by `proxy.ts`, D-04); `if (!session.customerId) redirect({ href: '/account/sign-in?redirect=' + encodeURIComponent(path), locale })` (**outside try/catch**; use i18n `redirect`). Pages under `(protected)`: R, S, T, V.

## Tasks
- [x] O-01 Write `lib/ct/auth.ts` + tests (mock root): login uses `login().post` with merge mode and anonymous cart; signUp then email token and confirm called in order; `createPasswordResetToken` returns null for unknown email; verify call shapes against OAS and record in findings.
- [x] O-02 Write `lib/safe-redirect.ts` + tests (relative ok; `//evil.com`, `https://evil.com`, `/other-locale/x`, missing locale → fallback).
- [x] O-03 Write `/api/auth/login` + tests: success writes session fields and merged cart id; wrong password and unknown email return the **identical** 401 body; anonymous cart id is passed.
- [x] O-04 Write `/api/auth/register` + tests: weak password 400; duplicate 409; success → verified + signed in; no email is sent (no mail module imported).
- [x] O-05 Write `/api/auth/logout`, `/api/auth/me` + tests (session cleared; me null when anonymous).
- [x] O-06 Write `/api/auth/forgot-password`, `/api/auth/reset-password`, `lib/dev-stub.ts`, dev page + tests: same response for known/unknown email; dev stores link, production does not (`NODE_ENV` stub); invalid token 400; dev page 404 outside development.
- [x] O-07 Write `useAccount`, `AccountLink`, header `account` slot, root fallback + tests (label states; logout clears caches).
- [x] O-08 Write the four pages + `AuthCard` + messages (both locales) + tests: validation errors with `aria-describedby`; wrong password shows `auth.invalid` ("Email or password is incorrect"); `?redirect=` honored after sign-in using `safeRedirectPath`; register success lands on account.
- [x] O-09 Write `(protected)/layout.tsx` + tests (anonymous → redirect with `redirect` param; signed-in renders children); report manual tests M-O-1…M-O-5 and sign-off SO-06.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Wrong password | O-03, O-08 |
| Return after sign-in | O-02, O-08 |
| Register / Duplicate email | O-04 |
| Unknown email (reset) / Dev stub | O-06 |
| Anonymous visits orders | O-09 |
| Validation error | O-08 |
| Sign in with items in the bag (merge) | O-03 |
| Logout | O-05, O-07 |

## Manual tests to report
- M-O-1 (OA-02 creds): In a fresh private window open `/en-US`, add any product (for example Whole milk 1 L) to the bag (header shows "Bag · 1"), then open `/en-US/account/register`, enter a new first/last name, a throwaway email such as `qa-<random>@example.com` and an 8+ character password, press Create account → the URL becomes `/en-US/account` (a 404 page until workstream R adds the dashboard, that is expected), the header account button now shows your first name, `/en-US/cart` still contains the milk line, and Merchant Center → Customers lists the new customer with email verified and no email was received.
- M-O-2: In the same window sign out (until R adds the UI: open DevTools → Application → delete the `malva-session` cookie, or run `fetch('/api/auth/logout',{method:'POST'})` in the console and reload), open `/en-US/account/sign-in` and sign in once with the right email and a wrong password, once with an unknown email and any password → both times the same red message "Email or password is incorrect" appears under the form and nothing else differs; DevTools → Network shows HTTP 401 with identical body `{"error":"INVALID_CREDENTIALS"}` both times.
- M-O-3: Run `npm run dev`. Open `/en-US/account/forgot-password`, enter the email of an existing customer and submit → the confirmation "If an account exists for that email, a reset link has been prepared." and a "Development only" link appear; the same text appears for an unknown email (without a stored link); open the link, choose a new password of 8+ characters → you land on `/en-US/account` signed in and can sign in later with the new password; opening the same reset link again shows "This reset link is invalid or has expired." Then run `npm run build && npm start` and open `/en-US/account/dev/reset-link` → 404.
- M-O-4 (needs workstream R merged, the orders page): signed out, open `/en-US/account/orders` → redirected to `/en-US/account/sign-in?redirect=%2Fen-US%2Faccount%2Forders`; sign in → you land on the orders page. Also try `/en-US/account/sign-in?redirect=https://evil.com` and `?redirect=//evil.com` → after sign-in you land on `/en-US/account`, never on another site.
- M-O-5: Open `/en-US/account/sign-in`, `/register`, `/forgot-password` and `/reset-password?token=x` at 1280 px and 390 px wide (EN and DE) → a centred card at most 440 px wide on the surface colour with the large rounded corners, H2 title, labelled inputs, a full-width primary button and ghost links below; submit an empty form → an error under each field in accent colour and the field is announced by a screen reader (aria-invalid and aria-describedby); no horizontal scroll at 390 px. Then review SO-06.

## Definition of done
Identical failure responses; no emails; redirects safe; `verify` passes; SO-06 requested.

## Implementation notes (deviations, recorded by the developer)
- **Real commercetools answers differ from the plan (see `PROJECT-FINDINGS.md` §15):** duplicate email is HTTP 400 `DuplicateField` (mapped to 409 `ACCOUNT_EXISTS`), wrong password and unknown email are both HTTP 400 `InvalidCredentials` (mapped to 401), unknown email on `passwordToken` and a used or bogus token on `passwordReset` are 404. `lib/ct/auth.ts` therefore throws typed errors (`InvalidCredentialsError`, `AccountExistsError`, `InvalidTokenError`) that the routes map.
- `signIn` retries once **without** the anonymous cart when the first attempt fails for any reason other than `InvalidCredentials`, so a stale session cart (ordered or deleted) never blocks sign-in. Both attempts that fail with `InvalidCredentials` end in the same error.
- `lib/auth-api.ts` (server-only) holds `blockedByRateLimit(request, 'login'|'register'|'forgot'|'reset')` (429 `RATE_LIMITED` + `Retry-After`, key `auth:<route>`), `signedInJson(customer, cart?, body?)` (writes `customerId, customerEmail, customerFirstName, customerLastName, cartId` with `updateSession`; the session `cartId` becomes the merged cart id, or is dropped when sign-in returned no Active cart) and `userOf`. Later workstreams that need "the customer is now signed in" should reuse them.
- Responses: login and register return `{ user: { id, email, firstName, lastName } }`; reset-password returns `{ ok: true }` (and signs in; if the sign-in after a successful reset fails it still answers `{ ok: true }` without a session). Extra errors: `INVALID_INPUT` (400, register), `WEAK_PASSWORD` (400, register and reset), `REGISTER_ERROR` / `RESET_ERROR` (500). Logout and me send `Cache-Control: no-store`. Forgot-password swallows commercetools failures (always `{ ok: true }`) and never logs.
- Logout keeps `anonymousId` in the session (a new anonymous cart after sign-out reuses it); only the identity fields and `cartId` are cleared.
- `useAuthMutations()` also exposes `resetPassword(token, password)` (used by the reset form). `logout` clears KEY_ACCOUNT and KEY_CART to `null` and KEY_ORDERS, KEY_ADDRESSES, KEY_WISHLIST, KEY_RECURRING and every `order:<id>` key to `undefined` (filter mutate), then `router.refresh()`.
- The header account slot is `components/layout/AccountLink.tsx`: icon button "Sign in" for visitors; for customers a button linking to `/account` with the first name (visible from the `desktop` breakpoint, aria-label "Account, <name>"). `app/[locale]/layout.tsx` now seeds `KEY_ACCOUNT` from the session fields; `layout.test.tsx` was updated for the extra fallback key and the new label. `AccountUser` was added to `lib/types.ts`.
- Redirect handling: `safeRedirectPath` (also rejects backslashes and control characters) returns a locale-prefixed path; forms pass it through `withoutLocale` because the i18n router adds the locale. The pages take `?redirect=` / `?token=` from `searchParams` (server) and hand them to the client forms (no `useSearchParams`, so no Suspense needed) and carry `redirect` between sign-in and register.
- Auth messages live in the `auth` namespace (both locales); German is machine-translated (see `plan/IDEAS.md`). Form validation is client side (`components/auth/validation.ts`, forms use `noValidate`); the server re-validates password length and email.
- `(protected)/layout.tsx` guards pages only (a layout does not re-run on client-side navigation between its children, and `logout` calls `router.refresh()`); every account **data route** (R, S, T, V) must still check `session.customerId` itself. The route group has no page yet, so `/en-US/account` and `/en-US/account/orders` are 404 until R adds them (M-O-1 and M-O-4 say so).
- The dev stub page `/[locale]/account/dev/reset-link` is dynamic and `notFound()` unless `NODE_ENV === 'development'`; its copy is English only on purpose. `lib/dev-stub.ts` also exports `getLastResetLink()` and `isDevStubEnabled()`.
