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
- [ ] O-01 Write `lib/ct/auth.ts` + tests (mock root): login uses `login().post` with merge mode and anonymous cart; signUp then email token and confirm called in order; `createPasswordResetToken` returns null for unknown email; verify call shapes against OAS and record in findings.
- [ ] O-02 Write `lib/safe-redirect.ts` + tests (relative ok; `//evil.com`, `https://evil.com`, `/other-locale/x`, missing locale → fallback).
- [ ] O-03 Write `/api/auth/login` + tests: success writes session fields and merged cart id; wrong password and unknown email return the **identical** 401 body; anonymous cart id is passed.
- [ ] O-04 Write `/api/auth/register` + tests: weak password 400; duplicate 409; success → verified + signed in; no email is sent (no mail module imported).
- [ ] O-05 Write `/api/auth/logout`, `/api/auth/me` + tests (session cleared; me null when anonymous).
- [ ] O-06 Write `/api/auth/forgot-password`, `/api/auth/reset-password`, `lib/dev-stub.ts`, dev page + tests: same response for known/unknown email; dev stores link, production does not (`NODE_ENV` stub); invalid token 400; dev page 404 outside development.
- [ ] O-07 Write `useAccount`, `AccountLink`, header `account` slot, root fallback + tests (label states; logout clears caches).
- [ ] O-08 Write the four pages + `AuthCard` + messages (both locales) + tests: validation errors with `aria-describedby`; wrong password shows `auth.invalid` ("Email or password is incorrect"); `?redirect=` honored after sign-in using `safeRedirectPath`; register success lands on account.
- [ ] O-09 Write `(protected)/layout.tsx` + tests (anonymous → redirect with `redirect` param; signed-in renders children); report manual tests M-O-1…M-O-5 and sign-off SO-06.

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
- M-O-1 (OA-02 creds): Add Milk anonymously, register a new customer: bag still contains Milk; Merchant Center → Customers shows the customer with email verified.
- M-O-2: Sign out, sign in with wrong password and with an unknown email: same message both times.
- M-O-3: Forgot password (dev): the stub page shows a link; opening it lets you set a new password and signs you in; in a production build the stub is a 404.
- M-O-4: Open `/en-US/account/orders` signed out: redirected to sign-in; after sign-in returns to orders.
- M-O-5: Compare pages with the design system look (440 px card).

## Definition of done
Identical failure responses; no emails; redirects safe; `verify` passes; SO-06 requested.
