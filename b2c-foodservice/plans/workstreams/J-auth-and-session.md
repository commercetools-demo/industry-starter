<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream J: Auth and session

Paths are relative to `storefront/` unless they start with `plans/` or `seed/`. Read `plans/JUNIOR-GUIDE.md` first. Workstream D's real exports are used as written in `plans/workstreams/D-server-core.md`: `handle(route, fn)` and `jsonError(code, status)` from `lib/api.ts`, `requireCustomer()` (throws 401), `AppError` and the closed `ErrorCode` union from `lib/errors.ts`, `getSession`, `createSessionToken`, `setSessionCookie`, `clearSessionCookie`, `ensureAnonymousId`, `getMarket` from `lib/session.ts` (cookie `malva-session`), `KEY_ACCOUNT` and the key functions of `lib/cache-keys.ts`, `fetchJson`, `ApiError`, `jsonFetcher` from `hooks/fetcher.ts`, `updateWithRetry` from `lib/ct/retry.ts`. Workstream F already ships a minimal `hooks/useAccount.ts` (reads `GET /api/auth/me`) and its header `AccountMenu` links to **`/account/sign-in`**; workstream G ships `lib/ct/cart.ts` (`getCartForSession`, `createCart`, `addLine`), `CartSummary`, `hooks/useCart.ts`. If a real export differs from this plan, use the real one and say so in your hand-off. Do not rename other workstreams' code.

## 1. Header

| Field | Value |
| --- | --- |
| ID | J |
| Name | Auth and session: sign-in, registration (auto-verified), cart merge |
| Depends on | I (cart exists and sits in the session), and transitively D (session, client, errors), E (atoms, icons), F (shell, toast) |
| Wave | 7 |
| Primary specs | `account-sign-in` (generated template) first, then `authentication-and-identity` |
| Also read | `server-architecture-and-data-flow` (Session, Route Handler table, Errors), `design-tokens-and-components` (Field, Button, Card, Toast, Steps atoms), `bootstrap-and-structure` (locale links, token-only styling) |
| Generated templates that apply | `account-sign-in`, `authentication-and-identity`. Not applicable: `password-reset` and `email-verification` (D-032, no email provider), `account-registration-request` (seller-activated accounts, D-022, B2B), the federated and store-bound parts of `account-sign-in` (Q-J-01, Q-J-02) |
| Not designed anywhere | The VELA prototype has no sign-in or registration screens (`design.md` section 6). Build them from the atoms in `design-tokens-and-components` and the `.card`, `.field`, `.input` classes of `styles.css` (see Design 3.2). Visual sign-off is `SO-J-a` |
| Skills | `[SKILL: commercetools-platform]` (login, tokens), `[SKILL: commercetools-storefront]` (B2C auth, cart merge, protected layout) |
| Owner prerequisites | `OA-J-a` live commercetools credentials (OA-01) so the browser recipe can run. The owner supplies the API clients in `storefront/.env.local` (project `spec-test-b2c-food`). There is no email and no email decision (D-032). The lead numbers the OA/SO rows |

## 2. Goal and scope

**Goal.** A shopper can create an account, sign in, sign out. Registration is verified automatically (D-032): there is no email, no password reset and no email verification. Everything they built anonymously (bag, saved items) is carried into the signed-in session. Failures never reveal whether an email is registered. Later workstreams (K checkout, L account, M reviews) call the helpers J exports to know who the shopper is.

**In scope**
- Pages (locale-prefixed, all under `/account/` because F's header already links to `/account/sign-in`; L's guarded shell lives in the route group `app/[locale]/account/(shell)/` so these pages are not guarded): `/[locale]/account/sign-in` and `/[locale]/account/register`, in both markets (en-US, en-CA).
- Route handlers: `/api/auth/login`, `/register`, `/logout`, `/me`.
- Session writes on login, register, logout (fields exactly as `server-architecture-and-data-flow`).
- Anonymous cart merge at sign-in and register.
- Password policy module shared by client and server.
- Rate limiter shared with M (`lib/rate-limit.ts`).
- Helpers other workstreams import: `requireCustomerPage`, `requireCustomerApi`, `safeRedirect`, `useAccount`, `useAuthActions`.
- Seeded customers are verified (SEED-PLAN section 13); new registrants are verified automatically.

**Out of scope**
- Federated sign-in and SSO (Q-J-01). Store-bound customers and in-store login endpoints (Q-J-02): customers are global.
- Account approval or request flows (`account-registration-request`, D-022).
- Any email: provider, mail adapter, password reset, email verification (D-032).
- Profile editing, password change while signed in, account deletion (workstream L).
- Social login, multi-factor, CAPTCHA, lockout beyond the rate limiter.
- Customer groups, business units, as-associate calls (D-015).

## 3. Design

### 3.1 Files

| File | Purpose |
| --- | --- |
| `lib/auth/password-policy.ts` | Pure, no server-only import. `validatePassword(password, email?)` |
| `lib/auth/redirect.ts` | Pure. `safeRedirect(target, fallback)` |
| `lib/auth/require-customer.ts` | Server-only. `requireCustomerPage(currentPath)` (page-side guard; the API-side guard is D's `requireCustomer()`) |
| `lib/api-domain.ts` | Server-only. `domainError(code, status, extra?)`: same JSON envelope as D (`{ "error": { "code", "message", ...extra } }`) for the domain codes of this workstream (`invalid_credentials`, `password_policy`, `token_invalid`, ...). D's `ErrorCode` union is closed and its body is "exactly code and message", which cannot carry `failed` rule ids or `retryAfterSeconds`; K and M reuse this helper (Q-J-13). Unexpected errors still go through D's `handle()` |
| `lib/auth/session-customer.ts` | Server-only. `sessionFromLogin(result, session)`: maps a login result to session fields |
| `lib/ct/auth.ts` | Server-only. All commercetools calls of this workstream (see 3.5) |
| `lib/mappers/customer.ts` | `toAppCustomer(customer)` (extend D's file if it exists) |
| `lib/rate-limit.ts` | In-memory sliding window. `rateLimit(key, {limit, windowMs})` |
| `app/api/auth/login/route.ts`, `register/route.ts`, `logout/route.ts`, `me/route.ts` | Session handlers |
| `app/[locale]/account/sign-in/page.tsx`, `register/page.tsx` | Pages (Server Components with client form leaves) |
| `components/auth/AuthCard.tsx`, `SignInForm.tsx`, `RegisterForm.tsx`, `PasswordField.tsx`, `PasswordStrength.tsx` | UI |
| `hooks/useAccount.ts` (extends F's file), `hooks/useAuthActions.ts` | `useAccount()` (SWR, `KEY_ACCOUNT`), `useAuthActions()`. Keep the return shape that F's `AccountMenu` already consumes and add fields |
| `messages/en-US.json`, `en-CA.json` | Namespace `auth` (3.9) |
| `lib/auth/demo-customers.ts` | Server-only. `DEMO_CUSTOMERS` (key, email, firstName, lastName, country) matching `seed/src/data/customers.ts`, `listDemoCustomers()` (no emails) and `demoCredentials(key)` |
| `app/api/auth/demo-login/route.ts`, `app/api/auth/demo-customers/route.ts` | Demo sign-in (D-040) |
| `components/auth/DemoSignIn.tsx` | Dropdown and button below the sign-in box |
| `.env.example` | New names only: `DEMO_LOGIN_ENABLED`, `DEMO_LOGIN_PASSWORD` (no mail, D-032) |

### 3.2 Visual design (not designed, derive from atoms)

All screens use one `AuthCard`: centred in the page, `max-width: 480px`, `Card` atom (surface, 1px `--line`, 16px radius, 24px padding), 48px top margin, 80px bottom margin. Above the card an eyebrow (11px uppercase, `--ink-3`) and an H1 in Archivo 800, 34px mobile and 40px desktop, `-0.025em` tracking, `--ink`. Below the H1 one line of body copy in `--ink-2`.

- Fields: the `Field` atom (label 12.5px weight 600 above input, 10px radius, focus ring `0 0 0 3px` accent at 14%). Error text is 12.5px `--ct-danger` under the field with an `x` icon (24px viewBox set, `aria-hidden`).
- Submit: `Button` variant `ink`, size `lg`, `block`. Pending: label replaced by "Signing in…" and `aria-busy="true"`, button disabled at 40% opacity.
- Secondary links: 13px, `--ink-2`, underline on hover, real `a` elements from `@/i18n/routing`.
- Page-level error: a box with `role="alert"`, 10px radius, `--ct-danger` text, 8% danger tint background (use the token with alpha through the token layer; do not write a hex).
- Success notice (after registration, after sign-out): same box shape in teal, `role="status"`.
- Password field: `PasswordField` has a trailing icon button "Show password" / "Hide password" (`aria-pressed`, `aria-label`, 38px target).
- Strength indicator: list of rules, each with a check icon (teal when met, `--ink-3` when not) and the rule text; `aria-live="polite"` region announces only the count met ("3 of 4 rules met"). No colour-only meaning (icon plus text).
- 375 px: card is full width minus 20px page padding; no horizontal scroll. 1440 px: card centred, nothing else on the page (header and footer from F stay).
- Autocomplete: email `autocomplete="email"`, sign-in password `current-password`, new password `new-password`, first and last name `given-name`, `family-name`.

### 3.3 Pages and component contracts

**`/[locale]/account/sign-in?redirect=<path>&notice=<registered|signed-out>`**
- The destination query parameter is `redirect` (canonical). Workstream N's plan calls it `next`; accept `next` as an alias and read `redirect` first.
- Server Component: if a session with `customerId` exists and the customer resolves, `redirect()` to `safeRedirect(searchParams.redirect, '/account')` (never inside try/catch).
- `<SignInForm redirectTo={string} notice={Notice|null} />`. State machine: `idle -> pending -> (success | error | rateLimited)`. Fields `email`, `password`. Client checks: both non-empty, email looks like an email (`lib/checkout/validate.ts` is not available yet, so use a local `isEmailShape`). On `401 invalid_credentials` show the single i18n message `auth.signIn.invalidCredentials`, keep the email, clear the password, move focus to the password field. On `429 too_many_attempts` show `auth.signIn.tooMany` and disable the button for the returned `retryAfterSeconds`. On `5xx` or network: `auth.errors.unavailable` with a Retry button.
- On success: `mutate(KEY_ACCOUNT, customer, false)`, `mutate(KEY_CART, cart, false)` (the merged cart from the response), then `router.replace(redirectTo)`. If the merged cart has more lines than the anonymous one had, toast `auth.signIn.cartMerged`.
- Link: Create account (carry `redirect`). There is no forgot-password link (D-032).
- No SSO button (Q-J-01); leave no placeholder slot.
- **Demo sign-in (D-040).** Below the card (same width, 16px gap) a `Card` titled "Demo customers" holds a native `select` (label "Choose a demo customer", options "Name (US)" / "Name (Canada)", grouped by market with `optgroup`) and a `Button` variant `ghost` "Sign in as". It loads from `GET /api/auth/demo-customers` (rendered only when the server says it is enabled, so no layout shift when disabled), posts the chosen key to `/api/auth/demo-login`, then follows the same success path as the form (mutate account and cart, toast `auth.signIn.cartMerged`, `router.replace(redirectTo)`). Errors reuse the page-level error box.

**`/[locale]/account/register`**
- `<RegisterForm redirectTo />`: first name, last name, email, password with `PasswordStrength`. Consent line with links to the privacy and terms pages (route names from workstream P; until P is Done link to `/${locale}/privacy` and `/${locale}/terms`, Q-J-08). States as sign-in plus `policy` errors from the server (`422 password_policy` with `failed: RuleId[]`) and `409 registration_failed` (generic text, see Q-J-05).
- Server pre-fills the email from the HTTP-only cookie `mcf_guest_email` when present (K sets it after a guest order; Q-K-10), then deletes it. Read it in the page, never from the URL.
- After success the shopper is signed in, a toast says `auth.register.created`. No email is sent and no verification banner shows (D-032).

### 3.4 Route handler contracts

All handlers: `export const dynamic = 'force-dynamic'`; wrapped in D's `handle('/api/auth/<name>', fn)`; read the session with D's `getSession()` and write it with `createSessionToken` plus `setSessionCookie(NextResponse.json(body), token)`; errors use `domainError` (3.1) or D's `jsonError` for the generic cases, always `{ "error": { "code": "...", "message": "..." } }`; never return a commercetools error body; log only the correlation id and error code. Where the table below says `400 invalid_request` use D's `bad_request`, and `401 sign_in_required` uses D's `unauthorized` semantics with the domain code kept.

| Handler | Request | Success | Errors |
| --- | --- | --- | --- |
| `POST /api/auth/login` | `{ "email": string, "password": string }` | `200 { "customer": AppCustomer, "cart": CartView | null }` and the session cookie set | `400 invalid_request` (missing fields), `401 invalid_credentials` (any wrong, unknown or commercetools `InvalidCredentials`), `429 too_many_attempts` with `retryAfterSeconds`, `502 upstream_unavailable` |
| `GET /api/auth/demo-customers` | none | `200 { "customers": [{ "key", "name", "market" }] }` (no email, no password) | `404 not_found` when `DEMO_LOGIN_ENABLED !== 'true'` |
| `POST /api/auth/demo-login` | `{ "key": string }` | same as `/api/auth/login`: `200 { customer, cart }` and the session cookie | `404 not_found` when disabled, `400 invalid_request` for an unknown key, `502 upstream_unavailable`. Server maps key to email, reads `DEMO_LOGIN_PASSWORD`, calls the same `signIn`; shares the login rate limit |
| `POST /api/auth/register` | `{ "email", "password", "firstName", "lastName" }` | `201 { "customer": AppCustomer, "cart": CartView \| null }` (customer is created verified and signed in) | `400 invalid_request`, `422 password_policy` with `failed: RuleId[]`, `409 registration_failed`, `429 too_many_attempts` |
| `POST /api/auth/logout` | none | `200 { "ok": true }`; new session keeps `country`, `currency`, `locale`, `collectionStoreKey`; drops `customerId`, `customerEmail`, `customerFirstName`, `customerLastName`, `cartId`; no new `anonymousId` is created here (workstream I creates it on the first add to bag) | none (idempotent) |
| `GET /api/auth/me` | none | `200 { "customer": AppCustomer \| null }` always (never 401); `null` also when the customer lookup fails | none |

`AppCustomer` (in `lib/types.ts`): `{ id: string; email: string; firstName: string; lastName: string; defaultShippingAddressId: string | null; addresses: AppAddress[] }` (no verification flag: every customer is verified, D-032). `AppAddress` is the shape workstream K and L need: `{ id: string; label: string | null; firstName: string; lastName: string; streetName: string; additionalStreetInfo: string | null; city: string; state: string | null; postalCode: string; country: string; phone: string | null; isDefaultShipping: boolean; isDefaultBilling: boolean }`. J defines both types and the mapper. `label` comes from the address field `additionalAddressInfo` (nickname, Q-L-03).

Rate limits (`lib/rate-limit.ts`, key hashed with SHA-256 so no email is stored in memory in clear): login 5 attempts per 10 minutes per `ip + emailHash`, and 30 per 10 minutes per ip; register 5 per hour per ip. The limiter is per server instance; note in `PROJECT-FINDINGS.md` that a shared store is needed for multi-instance hosting (OA-05, Netlify).

### 3.5 Exact commercetools calls (`lib/ct/auth.ts`, server only)

Load `[SKILL: commercetools-platform]` and `[SKILL: commercetools-storefront]` first; confirm every call with `node <skill>/scripts/docs-search.mjs` before coding.

| Function | SDK call | Notes |
| --- | --- | --- |
| `signIn(email, password, anon)` | `apiRoot.login().post({ body: { email, password, anonymousCart: { typeId: 'cart', id }, anonymousId, anonymousCartSignInMode: 'MergeWithExistingCustomerCart', updateProductData: true } }).execute()` | Returns `{ customer, cart? }`. Pass `anonymousCart` only if `session.cartId` exists; pass `anonymousId` only if `session.anonymousId` exists (it moves orders, lists and payments created anonymously to the customer). The skill text uses the deprecated `anonymousCartId`; use whichever field the installed `@commercetools/platform-sdk` ^8 type `CustomerSignin` declares, prefer `anonymousCart`. Docs: https://docs.commercetools.com/api/projects/customers#authenticate-customer-sign-in. Never `apiRoot.customers().login()` (does not exist). Global endpoint, not in-store (Q-J-02) |
| `createCustomer(draft)` | `apiRoot.customers().post({ body: { email, password, firstName, lastName, locale, isEmailVerified: true } }).execute()` | Verified automatically (D-032). Then call `signIn` immediately (skill rule). `locale` is the session locale. Do not pass the anonymous cart here, let `signIn` merge it |
| `getCustomerById(id)` | `apiRoot.customers().withId({ ID: id }).get().execute()` | For `/me` and `requireCustomer*`. Expand nothing |

Credentials: the commercetools storefront API client needs `manage_customers:{projectKey}` (create customers, tokens, login). Confirm it is in `CTP_SCOPES` (workstream D); if missing, write `OA-J-c` in the todo file and carry on with unit tests.

### 3.6 Session

On login and register success, write via D's session updater: `customerId`, `customerEmail`, `customerFirstName`, `customerLastName`, `cartId = result.cart?.id ?? session.cartId`, `anonymousId` removed. Never store a commercetools token (customer tokens are not requested at all, the BFF uses its own client and checks ownership in code, as the skill does for B2C). Cookie attributes stay as D set them (HTTP-only, `sameSite=lax`, 30 days, `jose` HS256). Issue a **fresh cookie on login** (new `iat`), which prevents session fixation.

Known limit: sessions cannot be revoked server-side because the cookie holds no commercetools token. This only matters for logout in other browsers; there is no password reset (D-032).

### 3.7 Exports for later workstreams (contract)

```
requireCustomerPage(currentPath: string): Promise<{ customerId: string }>   // redirect('/account/sign-in?redirect=<currentPath>') using @/i18n/routing, else returns
// API side: use D's requireCustomer() (lib/api.ts), it throws AppError('unauthorized', 401) with no detail
safeRedirect(target: string | null | undefined, fallback: string): string    // same-origin relative path only
useAccount(): same shape F's AccountMenu uses, plus { customer: AppCustomer | null | undefined; isLoading: boolean; mutate }  // undefined while loading, null signed out
useAuthActions(): { signIn, register, signOut }                              // signOut evicts every user-scoped SWR key (see J-08)
USER_SCOPED_KEYS: readonly string[]                                          // exported from lib/cache-keys.ts additions: first elements of user-scoped SWR keys
```

`safeRedirect` accepts only values that start with a single `/`, contain no `//`, no `\`, no scheme, no control characters, are at most 512 characters, and may end with a `#fragment` of letters, digits and dashes. Anything else returns `fallback`. The locale prefix is added by the locale-aware `redirect`/`router`, so stored values are locale-free paths (`/account/orders`, `/checkout`, `/p/<slug>#reviews`).

### 3.8 Verification policy (D-032)

- There is no email provider, no mail adapter, no password reset and no email verification flow. `password-reset` and `email-verification` are not applicable (`SPEC-COVERAGE.md`).
- Registration creates the customer with `isEmailVerified: true` (verified automatically) and signs in at once. Seeded customers are verified too. No banner, no resend, no link, no token.
- No UI copy promises email (K's confirmation page says nothing about a sent message; there is no `mailEnabled()` export).
- A forgotten password cannot be recovered in the app; a demo customer is recreated by the seed or a new registration.

### 3.9 i18n keys (namespace `auth`; en-CA equals en-US)

| Key | en-US |
| --- | --- |
| `signIn.title` | Sign in |
| `signIn.intro` | Welcome back. Sign in to see your orders and saved items. |
| `signIn.email` / `signIn.password` | Email / Password |
| `signIn.submit` / `signIn.pending` | Sign in / Signing in… |
| `signIn.invalidCredentials` | Email or password is incorrect. |
| `signIn.tooMany` | Too many attempts. Try again in {seconds} seconds. |
| `signIn.create` | Create an account |
| `demo.title` / `demo.label` / `demo.submit` | Demo customers / Choose a demo customer / Sign in as |
| `demo.hint` | For demonstration only. These customers are created by the seed. |
| `signIn.cartMerged` | Your bag was added to your account. |
| `notice.registered` / `notice.signedOut` | Account created. / You are signed out. |
| `register.title` / `register.submit` | Create your account / Create account |
| `register.firstName` / `register.lastName` | First name / Last name |
| `register.consent` | By creating an account you agree to the {terms} and {privacy}. |
| `register.failed` | We could not create the account with these details. If you already have one, sign in. |
| `register.created` | Welcome to Malva Coffee. |
| `password.show` / `password.hide` | Show password / Hide password |
| `password.rulesMet` | {met} of {total} rules met |
| `password.rules.min_length` | At least 10 characters |
| `password.rules.letter` | Contains a letter |
| `password.rules.digit` | Contains a number |
| `password.rules.not_email` | Is not your email address |
| `password.rules.max_length` | At most 128 characters |
| `errors.unavailable` / `errors.retry` | Something went wrong on our side. Please try again. / Try again |
| `errors.required` / `errors.emailShape` | This field is required. / Enter a valid email address. |

### 3.10 Cache keys, caching

`KEY_ACCOUNT` (exists from D; J uses it, does not redefine). `useAccount` does not revalidate on focus. No server caching of anything in this workstream. Pages that read the session are dynamic. Auth pages send `Cache-Control: no-store`.

### 3.11 Accessibility

One H1 per page; `<form>` with `noValidate` and our own messages; each error is tied to its field by `aria-describedby` and `aria-invalid`; a page-level error uses `role="alert"`; after a failed submit focus moves to the first invalid field (or the password field for invalid credentials); success notices `role="status"`. Every control is a real `button` or `a` with the visible focus ring. Show-password toggle announces its state. The strength list is a `ul`; colour is never the only signal.

## 4. Tasks

Branch `ws/j-auth-and-session`. Commit `ws-j: J-0n summary`. Each task is under half a day. Run `npm run check` before ticking.

- [x] **J-01 Password policy, safe redirect, rate limiter, types.** Files: `lib/auth/password-policy.ts`, `lib/auth/redirect.ts`, `lib/rate-limit.ts`, `lib/types.ts` (`AppCustomer`, `AppAddress`, `RuleId`), plus tests next to them. Implement as in 3.4 and 3.7. Rules: `min_length` 10, `max_length` 128, `letter`, `digit`, `not_email` (case-insensitive compare with the email local part and the full email). Tests: `Password fails policy names the rule it failed`, `Password of 10 characters with a letter and digit passes`, `safeRedirect rejects absolute URLs, double slashes and backslashes`, `safeRedirect keeps a safe fragment`, `Login attempts are limited per address and per ip`.
- [x] **J-02 Customer mapper and commercetools auth module.** `[SKILL: commercetools-platform]` `[SKILL: commercetools-storefront]`. Files: `lib/mappers/customer.ts`, `lib/ct/auth.ts`, tests with mocked `apiRoot`. Implement every function of 3.5. `toAppCustomer` maps addresses and the two default flags (`defaultShippingAddressId`, `defaultBillingAddressId` compared to each address id). Tests: `signIn passes anonymousCart and the merge mode only when a guest cart exists`, `signIn never calls the in-store endpoint`, `createCustomer creates a verified customer then signIn is a two-step flow`, `toAppCustomer marks the default shipping address`.
- [x] **J-03 Login, logout, me handlers.** `[SKILL: commercetools-storefront]`. Files: `app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`, `lib/auth/session-customer.ts`, tests. Tests: `Credentials accepted`, `Unknown and wrong are indistinguishable` (both mocked commercetools failures return byte-identical bodies and status), `Sign in carries the anonymous cart`, `Login issues a fresh cookie`, `Logout keeps market and store`, `me returns null not 401`, `Tampered cookie is an empty session`, `Login is rate limited and still ambiguous`.
- [x] **J-04 Register handler.** `[SKILL: commercetools-storefront]`. File: `app/api/auth/register/route.ts`, tests. Policy check first (no commercetools call on failure). Customer is created with `isEmailVerified: true` (D-032) and signed in at once; no email is sent. Duplicate email maps to `409 registration_failed` with the generic text. Tests: `Register refuses a weak password before any commercetools call`, `Register creates a verified customer and signs in`, `Register then merges the cart`, `Duplicate email gives a generic refusal`, `Register passes anonymousId so earlier orders attach`.
- [x] **J-05 Hooks and guards.** Files: `hooks/useAccount.ts` (read F's file first and extend it; do not break `AccountMenu` tests), `hooks/useAuthActions.ts`, `lib/cache-keys.ts` (add `USER_SCOPED_KEYS = ['account','cart','cart-count','checkout','orders','order','addresses','saved-items','my-reviews','recurring-orders','payment-methods']`, append only), `lib/auth/require-customer.ts`, tests. `useAccount` is SWR keyed `KEY_ACCOUNT`, `revalidateOnFocus: false`, fetcher returns `null` when the response is not ok (use D's `jsonFetcher`). `useAuthActions().signOut` posts logout, then calls SWR `mutate(key => key === KEY_ACCOUNT || (Array.isArray(key) ? USER_SCOPED_KEYS.includes(String(key[0])) : USER_SCOPED_KEYS.includes(String(key))), undefined, { revalidate: false })` (this covers G's `KEY_CART` and D's `keyCart(customerId)` forms alike), then navigates to `/account/sign-in?notice=signedOut`. Tests: `Logout clears every user-scoped cache key in both key forms`, `requireCustomerPage redirects with the path preserved`, `requireCustomerApi returns 401 with no detail`.
- [ ] **J-06 Shared UI atoms for auth.** Files: `components/auth/AuthCard.tsx`, `PasswordField.tsx`, `PasswordStrength.tsx` and tests. Tokens only, no hex. Tests: `Strength list names the failing rule`, `Show password toggle exposes its state`, `AuthCard has one H1`.
- [ ] **J-07b Demo sign-in (D-040).** Files: `lib/auth/demo-customers.ts`, `app/api/auth/demo-login/route.ts`, `app/api/auth/demo-customers/route.ts`, `components/auth/DemoSignIn.tsx`, messages, `.env.example` names, tests. The list must equal the seed customers (a test reads `seed/src/data/customers.ts` keys and compares). Tests: `Demo list has names and markets but no email or password`, `Demo login signs in the chosen customer and merges the cart`, `Demo login returns 404 when disabled`, `Unknown demo key is refused`, `Demo sign-in is rate limited like login`, `Demo dropdown is not rendered when disabled`. Browser check: pick each seeded customer in the dropdown, confirm the account menu shows their name; search the page source and network log for the demo password and the seeded emails (must be absent). Evidence in `plans/evidence/J/`.
- [ ] **J-07 Sign-in page.** Files: `app/[locale]/account/sign-in/page.tsx`, `components/auth/SignInForm.tsx`, messages in the two catalogues (keys 3.9), tests. Tests: `Failed sign in is ambiguous` (rendered text equal for both cases), `Focus moves to the password after a failed sign in`, `Success redirects to the safe destination`, `Unsafe redirect falls back to account`, `Signed in visitor is sent on`, `Sign-in page offers no federated button`, `Sign-in page has no forgot-password link`.
- [ ] **J-08 Register page.** Files: `app/[locale]/account/register/page.tsx`, `RegisterForm.tsx`, tests. Tests: `Register shows policy failures by rule`, `Register shows the generic refusal for a duplicate`, `Register pre-fills email from the guest cookie and deletes it`, `Register success shows no email promise`.
- [ ] **J-09 Platform probes and findings.** `[SKILL: commercetools-platform]`. Using the dev server and two throwaway customers (`qa-j-<date>-1@example.com`, `-2@`, synthetic passwords), record in `plans/PROJECT-FINDINGS.md` (no tokens, no passwords): (a) does a login with `anonymousCart` when the customer already has an active cart keep both carts' lines (compare line counts)? (b) the `CustomerSignin` field name the installed SDK uses (`anonymousCart` or `anonymousCartId`). (c) what a login does with an anonymous cart whose currency differs from the customer's active cart (US cart USD, customer cart CAD). Add each answer to the right Q-J row. List the test emails in `plans/evidence/J/test-customers.txt` for the lead's cleanup manifest (D-019).
- [ ] **J-10 Browser recipe, evidence, hand-off.** Run section 6 and 7, save evidence in `plans/evidence/J/`, add todo rows, set `Ready for review`.

## 5. Scenarios checklist

Tick only when the named test exists and passes. Federated and store-bound scenarios are not applicable by decision (Q-J-01, Q-J-02) and are covered by the stated negative test. `password-reset` and `email-verification` are not applicable (D-032, no email provider); they have no scenarios here and are marked `n/a` in `SPEC-COVERAGE.md`.

`account-sign-in`
- [ ] Credentials accepted: `Credentials accepted` (J-03)
- [ ] Unknown and wrong are indistinguishable: `Unknown and wrong are indistinguishable` (J-03) and `Failed sign in is ambiguous` (J-07)
- [ ] Buyer bound to another entry point: not applicable (Q-J-02); negative test `signIn never calls the in-store endpoint` (J-02)
- [ ] Federated buyer has no local password: not applicable (Q-J-01); the sign-in page has no SSO control, asserted by `Sign-in page offers no federated button` (J-07)

`authentication-and-identity`
- [ ] Sign in carries the anonymous cart: `Sign in carries the anonymous cart` (J-03), browser check B6
- [ ] Failed sign in is ambiguous: `Failed sign in is ambiguous` (J-07)
- [ ] Registration is verified automatically: `Register creates a verified customer and signs in` (J-04), browser check B5
- [ ] No password reset or verification surface: `Sign-in page has no forgot-password link` (J-07), browser check B8

## 6. Browser recipe (Chrome DevTools MCP)

Prerequisite: `npm run dev`, live credentials (`OA-J-a`). Use throwaway customers you register yourself; invent a synthetic password that satisfies the policy (it protects only `@example.com` test accounts; never reuse a real password and never write it into evidence or a commit). Evidence goes to `plans/evidence/J/<step>-<what>-<375|1440>.png`. For every step: `take_snapshot`, `list_console_messages` (no errors), `list_network_requests` (no failed requests except the expected 401 on the failed login).

| Step | Do | Expect |
| --- | --- | --- |
| B1 | `resize_page` 1440x900, navigate `/en-US/account/sign-in` | Card centred, H1 "Sign in", one email and one password field, no SSO control, no "Forgot password" link |
| B2 | Repeat at 375x812 | No horizontal scroll, controls at least 44 px tall |
| B3 | Submit empty | Field errors beside each field, focus on the first |
| B4 | Fill an unregistered email and any password; then the registered `qa-j-...` email with a wrong password | Both show the identical text; compare the two response bodies in `get_network_request` |
| B5 | Navigate `/en-US/account/register`, create `qa-j-<date>-1@example.com` | Weak password shows failing rules; strong one signs in at once (auto-verified), toast shown, no banner, no text about email being sent |
| B6 | Sign out, add one product to the bag as a guest (workstream I UI), sign in | Bag keeps the line, cart count in the header unchanged, `/api/auth/login` response contains the cart |
| B7 | Switch to `/en-CA/account/sign-in` | Same English copy, same behaviour in the Canada market |
| B8 | Navigate `/en-US/account/forgot-password`, `/en-US/account/reset-password`, `/en-US/account/verify-email` | All answer the not-found page: these pages are not built (D-032) |
| B9 | Open `/en-US/account/sign-in?redirect=https://evil.example` and sign in | Lands on `/en-US/account` (or the fallback), never the external URL |
| B10 | Tab through each page | Focus ring visible on every control; show-password toggle reachable |
| B14 | Open `/en-US/account/sign-in?redirect=https://evil.example` and sign in | Lands on `/en-US/account` (or the fallback), never the external URL |
| B15 | Tab through each page | Focus ring visible on every control; show-password toggle reachable |

## 7. Self-verification with data

No owner involvement.
- Read the customer back through the commercetools MCP `food-service` (it can read the project) or a read-only script: after B5 the new customer has `isEmailVerified` true without any email step.
- `cd seed && npm run verify` still passes (J writes no seed data). Seeded customers (SEED-PLAN section 13) are verified: query `customers` where `email in (...)` and assert `isEmailVerified` is true; record ids and flags only in `plans/evidence/J/seeded-customers.json`.
- Compare the two ambiguous responses of B4 byte for byte and save the comparison as text in evidence.
- Verify no password appears in the server console output during B4 to B9 (`grep` the dev server log for the synthetic password; the result must be empty) and save "0 matches" as evidence.
- Write `plans/evidence/J/README.md` saying what each file proves.

## 8. Manual testing and owner items

Format per `JUNIOR-GUIDE.md` section 5. Same rows are in `plans/notes/todo-J.md`.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-J-a | Owner | Before J-10 browser recipe | 1. Confirm the API clients are in `storefront/.env.local` (OA-01). 2. Confirm the API client scope list includes `manage_customers`. | `/api/health` answers and registration works | TODO |
| SO-J-a | Owner | Before release | 1. Open `/en-US/account/sign-in` and `/en-US/account/register` at 375 and 1440 px. 2. Judge the look against the other pages. 3. Approve or list changes (these screens are not in the VELA design). | Owner signs off or lists changes | TODO |
| M-J-01 | Owner | Before release | 1. On a real phone open `/en-US/account/sign-in`. 2. Sign in as a seeded customer (password from `SEED_DEMO_PASSWORD`, which only you hold). 3. Reload, close the tab, reopen. | Still signed in, no horizontal scroll, keyboard does not cover the button | TODO |

Removed by D-032 (no email): the former OA-J-b (email provider decision) and M-J-02 (real inbox links).

## 9. Questions

Each is also in `plans/notes/questions-J.md` (format `Q-J-n | question | default | blocks? | Open`). The default is built.

| ID | Question | Default built | Blocks? |
| --- | --- | --- | --- |
| Q-J-01 | Is SSO or federated sign-in required? | No. No SSO control, no federated route. | No |
| Q-J-02 | Are customers global or store-scoped? | Global; global `/login` endpoint; no `in-store` calls. | No |
| Q-J-03 | Which email provider sends verification and reset mails? | Removed by D-032: no email provider, no mail adapter, no reset or verification pages. | No |
| Q-J-04 | What may a new customer do? | Everything; registration is verified automatically (`isEmailVerified: true` at creation, D-032), no banner. | No |
| Q-J-05 | Should registration reveal that an email is already registered? | No: generic refusal text pointing to sign-in (no reset exists). | No |
| Q-J-06 | Must a password reset end sessions in other browsers? | Removed by D-032: there is no password reset. | No |
| Q-J-07 | Reset spec and identity spec conflict on unverified accounts. | Removed by D-032: `password-reset` and `email-verification` are not applicable. | No |
| Q-J-08 | Where are the terms and privacy pages? | `/${locale}/terms` and `/${locale}/privacy` (P may rename; update the two links). | No |
| Q-J-09 | Token validity for reset and verification? | Removed by D-032 (no tokens are issued). | No |
| Q-J-11 | Merge mode when the customer already has a cart? | `MergeWithExistingCustomerCart` (skill default); lines are kept, none dropped. | No |
| Q-J-12 | Rate limiting beyond one server instance? | In-memory per instance; shared store needed on multi-instance hosting (OA-05). | No |
| Q-J-13 | D's error envelope is closed (fixed `ErrorCode`, body exactly code and message). Field-level and domain codes (`password_policy` with rule ids, `retryAfterSeconds`) need extra properties. May the envelope carry extras? | Yes: `domainError(code, status, extra)` in `lib/api-domain.ts` keeps `{ error: { code, message, ...extra } }` and never carries commercetools text. | No |

## 10. Definition of done

- All tasks ticked, each with a passing `npm run check`; `npm run build` passes.
- Every scenario in section 5 ticked with its named test, or the not-applicable line stands with its negative test.
- Browser recipe B1 to B10 verified by you at 375 and 1440 px; evidence and its `README.md` in `plans/evidence/J/`; console and network clean.
- Section 7 checks recorded; the "0 matches" password-in-log check is saved.
- `PROJECT-FINDINGS.md` has the J-14 answers; Q rows and todo rows are in `plans/notes/`.
- Exports of section 3.7 exist with the exact signatures (K, L and M import them).
- No `TODO` or `FIXME` without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
