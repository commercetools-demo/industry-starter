<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream J: Auth and session

Paths are relative to `storefront/` unless they start with `plans/` or `seed/`. Read `plans/JUNIOR-GUIDE.md` first. Workstream D's real exports are used as written in `plans/workstreams/D-server-core.md`: `handle(route, fn)` and `jsonError(code, status)` from `lib/api.ts`, `requireCustomer()` (throws 401), `AppError` and the closed `ErrorCode` union from `lib/errors.ts`, `getSession`, `createSessionToken`, `setSessionCookie`, `clearSessionCookie`, `ensureAnonymousId`, `getMarket` from `lib/session.ts` (cookie `malva-session`), `KEY_ACCOUNT` and the key functions of `lib/cache-keys.ts`, `fetchJson`, `ApiError`, `jsonFetcher` from `hooks/fetcher.ts`, `updateWithRetry` from `lib/ct/retry.ts`. Workstream F already ships a minimal `hooks/useAccount.ts` (reads `GET /api/auth/me`) and its header `AccountMenu` links to **`/account/sign-in`**; workstream G ships `lib/ct/cart.ts` (`getCartForSession`, `createCart`, `addLine`), `CartSummary`, `hooks/useCart.ts`. If a real export differs from this plan, use the real one and say so in your hand-off. Do not rename other workstreams' code.

## 1. Header

| Field | Value |
| --- | --- |
| ID | J |
| Name | Auth and session: sign-in, registration, cart merge, password reset, email verification |
| Depends on | I (cart exists and sits in the session), and transitively D (session, client, errors), E (atoms, icons), F (shell, toast) |
| Wave | 7 |
| Primary specs | `account-sign-in` (generated template) first, then `authentication-and-identity`, `password-reset`, `email-verification` |
| Also read | `server-architecture-and-data-flow` (Session, Route Handler table, Errors), `design-tokens-and-components` (Field, Button, Card, Toast, Steps atoms), `bootstrap-and-structure` (locale links, token-only styling) |
| Generated templates that apply | `account-sign-in`, `authentication-and-identity`, `password-reset`, `email-verification`. Not applicable: `account-registration-request` (seller-activated accounts, D-022, B2B), the federated and store-bound parts of `account-sign-in` (Q-J-01, Q-J-02) |
| Not designed anywhere | The VELA prototype has no sign-in, registration, reset or verification screens (`design.md` section 6). Build them from the atoms in `design-tokens-and-components` and the `.card`, `.field`, `.input` classes of `styles.css` (see Design 3.2). Visual sign-off is `SO-J-a` |
| Skills | `[SKILL: commercetools-platform]` (login, tokens), `[SKILL: commercetools-storefront]` (B2C auth, cart merge, protected layout) |
| Owner prerequisites | `OA-J-a` live commercetools credentials (OA-01) so the browser recipe can run. `OA-J-b` decision on email delivery (QUESTIONS Q-J-03); nothing is blocked, the demo default is a dev outbox adapter. The lead numbers the OA/SO rows |

## 2. Goal and scope

**Goal.** A shopper can create an account, sign in, sign out, reset a forgotten password and confirm an email address. Everything they built anonymously (bag, saved items) is carried into the signed-in session. Failures never reveal whether an email is registered. Later workstreams (K checkout, L account, M reviews) call the helpers J exports to know who the shopper is.

**In scope**
- Pages (locale-prefixed, all under `/account/` because F's header already links to `/account/sign-in`; L's guarded shell lives in the route group `app/[locale]/account/(shell)/` so these pages are not guarded): `/[locale]/account/sign-in`, `/[locale]/account/register`, `/[locale]/account/forgot-password`, `/[locale]/account/reset-password`, `/[locale]/account/verify-email`.
- Route handlers: `/api/auth/login`, `/register`, `/logout`, `/me`, `/password/forgot`, `/password/reset`, `/verify-email/confirm`, `/verify-email/resend`, and dev-only `/api/dev/outbox`.
- Session writes on login, register, logout (fields exactly as `server-architecture-and-data-flow`).
- Anonymous cart merge at sign-in and register.
- Password policy module shared by client and server.
- Pluggable mail adapter (`outbox` for dev, `disabled` in production until the owner decides).
- Rate limiter shared with M (`lib/rate-limit.ts`).
- Helpers other workstreams import: `requireCustomerPage`, `requireCustomerApi`, `safeRedirect`, `useAccount`, `useAuthActions`.
- Seeded customers are verified (SEED-PLAN section 13), so the demo never needs email.

**Out of scope**
- Federated sign-in and SSO (Q-J-01). Store-bound customers and in-store login endpoints (Q-J-02): customers are global.
- Account approval or request flows (`account-registration-request`, D-022).
- A real email provider (Q-J-03). No SMTP, no SendGrid.
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
| `lib/mail/adapter.ts`, `lib/mail/outbox.ts`, `lib/mail/index.ts`, `lib/mail/templates.ts` | Mail adapter port, dev outbox, selector, message builders |
| `lib/rate-limit.ts` | In-memory sliding window. `rateLimit(key, {limit, windowMs})` |
| `app/api/auth/login/route.ts`, `register/route.ts`, `logout/route.ts`, `me/route.ts` | Session handlers |
| `app/api/auth/password/forgot/route.ts`, `password/reset/route.ts` | Reset |
| `app/api/auth/verify-email/confirm/route.ts`, `verify-email/resend/route.ts` | Verification |
| `app/api/dev/outbox/route.ts` | Dev only: returns the last mails for an address. 404 unless `MAIL_ADAPTER=outbox` and `NODE_ENV` is not `production` |
| `app/[locale]/account/sign-in/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`, `verify-email/page.tsx` | Pages (Server Components with client form leaves) |
| `components/auth/AuthCard.tsx`, `SignInForm.tsx`, `RegisterForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, `PasswordField.tsx`, `PasswordStrength.tsx`, `VerifyEmailStatus.tsx`, `VerifyEmailBanner.tsx` | UI |
| `hooks/useAccount.ts` (extends F's file), `hooks/useAuthActions.ts` | `useAccount()` (SWR, `KEY_ACCOUNT`), `useAuthActions()`. Keep the return shape that F's `AccountMenu` already consumes and add fields |
| `messages/en-US.json`, `de-DE.json`, `en-GB.json` | Namespace `auth` (3.9) |
| `.env.example` | Add names only: `MAIL_ADAPTER`, `PUBLIC_SITE_URL` (used to build emailed links; server only) |

### 3.2 Visual design (not designed, derive from atoms)

All screens use one `AuthCard`: centred in the page, `max-width: 480px`, `Card` atom (surface, 1px `--line`, 16px radius, 24px padding), 48px top margin, 80px bottom margin. Above the card an eyebrow (11px uppercase, `--ink-3`) and an H1 in Archivo 800, 34px mobile and 40px desktop, `-0.025em` tracking, `--ink`. Below the H1 one line of body copy in `--ink-2`.

- Fields: the `Field` atom (label 12.5px weight 600 above input, 10px radius, focus ring `0 0 0 3px` accent at 14%). Error text is 12.5px `--ct-danger` under the field with an `x` icon (24px viewBox set, `aria-hidden`).
- Submit: `Button` variant `ink`, size `lg`, `block`. Pending: label replaced by "Signing in…" and `aria-busy="true"`, button disabled at 40% opacity.
- Secondary links: 13px, `--ink-2`, underline on hover, real `a` elements from `@/i18n/routing`.
- Page-level error: a box with `role="alert"`, 10px radius, `--ct-danger` text, 8% danger tint background (use the token with alpha through the token layer; do not write a hex).
- Success notice (after reset, after verification): same box shape in teal, `role="status"`.
- Password field: `PasswordField` has a trailing icon button "Show password" / "Hide password" (`aria-pressed`, `aria-label`, 38px target).
- Strength indicator: list of rules, each with a check icon (teal when met, `--ink-3` when not) and the rule text; `aria-live="polite"` region announces only the count met ("3 of 4 rules met"). No colour-only meaning (icon plus text).
- 375 px: card is full width minus 20px page padding; no horizontal scroll. 1440 px: card centred, nothing else on the page (header and footer from F stay).
- Autocomplete: email `autocomplete="email"`, sign-in password `current-password`, new password `new-password`, first and last name `given-name`, `family-name`.

### 3.3 Pages and component contracts

**`/[locale]/account/sign-in?redirect=<path>&notice=<reset|verified|registered|signed-out>`**
- The destination query parameter is `redirect` (canonical). Workstream N's plan calls it `next`; accept `next` as an alias and read `redirect` first.
- Server Component: if a session with `customerId` exists and the customer resolves, `redirect()` to `safeRedirect(searchParams.redirect, '/account')` (never inside try/catch).
- `<SignInForm redirectTo={string} notice={Notice|null} />`. State machine: `idle -> pending -> (success | error | rateLimited)`. Fields `email`, `password`. Client checks: both non-empty, email looks like an email (`lib/checkout/validate.ts` is not available yet, so use a local `isEmailShape`). On `401 invalid_credentials` show the single i18n message `auth.signIn.invalidCredentials`, keep the email, clear the password, move focus to the password field. On `429 too_many_attempts` show `auth.signIn.tooMany` and disable the button for the returned `retryAfterSeconds`. On `5xx` or network: `auth.errors.unavailable` with a Retry button.
- On success: `mutate(KEY_ACCOUNT, customer, false)`, `mutate(KEY_CART, cart, false)` (the merged cart from the response), then `router.replace(redirectTo)`. If the merged cart has more lines than the anonymous one had, toast `auth.signIn.cartMerged`.
- Links: Forgot password, Create account (carry `redirect`).
- No SSO button (Q-J-01); leave no placeholder slot.

**`/[locale]/account/register`**
- `<RegisterForm redirectTo />`: first name, last name, email, password with `PasswordStrength`. Consent line with links to the privacy and terms pages (route names from workstream P; until P is Done link to `/${locale}/privacy` and `/${locale}/terms`, Q-J-08). States as sign-in plus `policy` errors from the server (`422 password_policy` with `failed: RuleId[]`) and `409 registration_failed` (generic text, see Q-J-05).
- Server pre-fills the email from the HTTP-only cookie `mcf_guest_email` when present (K sets it after a guest order; Q-K-10), then deletes it. Read it in the page, never from the URL.
- After success the shopper is signed in, a toast says `auth.register.created`, and an unverified banner shows (3.8).

**`/[locale]/account/forgot-password`**
- `<ForgotPasswordForm />`: one email field. On submit always show the same confirmation card `auth.forgot.sent` (text does not contain the email, or at most the email the shopper typed; never any account fact). The form never shows a not-found state. Identical for rate-limited responses.

**`/[locale]/account/reset-password?token=<value>`**
- Server Component calls `getCustomerByPasswordToken(token)`. States: `valid` renders `<ResetPasswordForm token />`; `invalid` (unknown, expired, consumed: indistinguishable) renders the card `auth.reset.linkDead` with an inline `<ForgotPasswordForm />` on the same page (scenario: new reset requested from that page). Missing token is `invalid`.
- Sets `Referrer-Policy: no-referrer` (`metadata` or a `<meta name="referrer" content="no-referrer">`) and the response is `dynamic = 'force-dynamic'`. The token is never logged and never put into analytics.
- `ResetPasswordForm`: new password with `PasswordStrength`. Submit is blocked client-side while any rule fails; the failing rule names are shown (scenario "Password fails policy": refused before any commercetools call; the server re-checks first as well).
- Success: browser session is cleared (even if the shopper happened to be signed in), then `router.replace('/account/sign-in?notice=reset')`.

**`/[locale]/account/verify-email?token=<value>&redirect=<path>`**
- Server Component calls `confirmEmail(token)` on load (a GET page with a side effect is acceptable here because the token is single purpose; the confirm route handler exists for the client retry button).
- States rendered by `<VerifyEmailStatus state />`:
  - `confirmed`: card `auth.verify.confirmed`, then `redirect()` server-side to `safeRedirect(redirect, '/account')` with `?verified=1`. (Scenario: no extra click.)
  - `already`: check the session customer first. If a session customer exists and `isEmailVerified` is already true, skip the token call and `redirect()` to the destination with `?verified=1` (the shopper is told by the toast `auth.verify.already`, which the destination shows when it sees `verified=1` and the customer was already verified). If the token call fails and the session customer turns out to be verified, render the card `auth.verify.already` with a primary "Continue" button to the destination.
  - `expired`: card `auth.verify.expired` with a "Send me a new link" button. With a session: `POST /api/auth/verify-email/resend`, then show `auth.verify.resent`. Without a session: the button text is "Sign in to get a new link" and links to `/account/sign-in?redirect=<this page without the token>`.
- Never retry the dead token silently.

**`VerifyEmailBanner`** (exported for L's account layout and the header if F wants it): shows when `useAccount().customer && !customer.isEmailVerified`. Amber (`--ct-amber-500` border) strip, text `auth.verify.banner`, button `auth.verify.bannerResend` (calls resend, then toast). Dismissible for the page view only.

### 3.4 Route handler contracts

All handlers: `export const dynamic = 'force-dynamic'`; wrapped in D's `handle('/api/auth/<name>', fn)`; read the session with D's `getSession()` and write it with `createSessionToken` plus `setSessionCookie(NextResponse.json(body), token)`; errors use `domainError` (3.1) or D's `jsonError` for the generic cases, always `{ "error": { "code": "...", "message": "..." } }`; never return a commercetools error body; log only the correlation id and error code. Where the table below says `400 invalid_request` use D's `bad_request`, and `401 sign_in_required` uses D's `unauthorized` semantics with the domain code kept.

| Handler | Request | Success | Errors |
| --- | --- | --- | --- |
| `POST /api/auth/login` | `{ "email": string, "password": string }` | `200 { "customer": AppCustomer, "cart": CartView | null }` and the session cookie set | `400 invalid_request` (missing fields), `401 invalid_credentials` (any wrong, unknown or commercetools `InvalidCredentials`), `429 too_many_attempts` with `retryAfterSeconds`, `502 upstream_unavailable` |
| `POST /api/auth/register` | `{ "email", "password", "firstName", "lastName" }` | `201 { "customer": AppCustomer, "cart": CartView \| null, "verificationSent": boolean }` | `400 invalid_request`, `422 password_policy` with `failed: RuleId[]`, `409 registration_failed`, `429 too_many_attempts` |
| `POST /api/auth/logout` | none | `200 { "ok": true }`; new session keeps `country`, `currency`, `locale`, `collectionStoreKey`; drops `customerId`, `customerEmail`, `customerFirstName`, `customerLastName`, `cartId`; no new `anonymousId` is created here (workstream I creates it on the first add to bag) | none (idempotent) |
| `GET /api/auth/me` | none | `200 { "customer": AppCustomer \| null }` always (never 401); `null` also when the customer lookup fails | none |
| `POST /api/auth/password/forgot` | `{ "email": string }` | always `200 { "ok": true }` after at least 400 ms | `400 invalid_request` only when the body is not JSON or the email is not a string; an unknown address is not an error |
| `POST /api/auth/password/reset` | `{ "token": string, "newPassword": string }` | `200 { "ok": true }`; session cookie cleared | `422 password_policy` `{failed}` (before any commercetools call), `400 token_invalid` (unknown, expired, consumed), `429` |
| `POST /api/auth/verify-email/confirm` | `{ "token": string }` | `200 { "ok": true, "isEmailVerified": true }` | `400 token_invalid` |
| `POST /api/auth/verify-email/resend` | none (identity from session) | always `200 { "ok": true }` for a signed-in customer | `401 sign_in_required` when no session customer; `429` |
| `GET /api/dev/outbox?to=<email>` | none | `200 { "messages": [{ "to", "template", "link", "createdAt" }] }` newest first, max 5 | `404` unless `MAIL_ADAPTER=outbox` and not production |

`AppCustomer` (in `lib/types.ts`): `{ id: string; email: string; firstName: string; lastName: string; isEmailVerified: boolean; defaultShippingAddressId: string | null; addresses: AppAddress[] }`. `AppAddress` is the shape workstream K and L need: `{ id: string; label: string | null; firstName: string; lastName: string; streetName: string; additionalStreetInfo: string | null; city: string; state: string | null; postalCode: string; country: string; phone: string | null; isDefaultShipping: boolean; isDefaultBilling: boolean }`. J defines both types and the mapper. `label` comes from the address field `additionalAddressInfo` (nickname, Q-L-03).

Rate limits (`lib/rate-limit.ts`, key hashed with SHA-256 so no email is stored in memory in clear): login 5 attempts per 10 minutes per `ip + emailHash`, and 30 per 10 minutes per ip; register 5 per hour per ip; forgot 3 per hour per `emailHash` and 10 per hour per ip; resend 3 per hour per customer; reset 10 per hour per ip. The limiter is per server instance; note in `PROJECT-FINDINGS.md` that a shared store is needed for multi-instance hosting (OA-05).

### 3.5 Exact commercetools calls (`lib/ct/auth.ts`, server only)

Load `[SKILL: commercetools-platform]` and `[SKILL: commercetools-storefront]` first; confirm every call with `node <skill>/scripts/docs-search.mjs` before coding.

| Function | SDK call | Notes |
| --- | --- | --- |
| `signIn(email, password, anon)` | `apiRoot.login().post({ body: { email, password, anonymousCart: { typeId: 'cart', id }, anonymousId, anonymousCartSignInMode: 'MergeWithExistingCustomerCart', updateProductData: true } }).execute()` | Returns `{ customer, cart? }`. Pass `anonymousCart` only if `session.cartId` exists; pass `anonymousId` only if `session.anonymousId` exists (it moves orders, lists and payments created anonymously to the customer). The skill text uses the deprecated `anonymousCartId`; use whichever field the installed `@commercetools/platform-sdk` ^8 type `CustomerSignin` declares, prefer `anonymousCart`. Docs: https://docs.commercetools.com/api/projects/customers#authenticate-customer-sign-in. Never `apiRoot.customers().login()` (does not exist). Global endpoint, not in-store (Q-J-02) |
| `createCustomer(draft)` | `apiRoot.customers().post({ body: { email, password, firstName, lastName, locale, isEmailVerified: false } }).execute()` | Then call `signIn` immediately (skill rule). `locale` is the session locale. Do not pass the anonymous cart here, let `signIn` merge it |
| `findCustomerByEmail(email)` | `apiRoot.customers().get({ queryArgs: { where: 'email=:email', 'var.email': email.toLowerCase(), limit: 1 } }).execute()` | Server only; used by forgot-password to choose the template. Never expose the result |
| `createPasswordToken(email)` | `apiRoot.customers().passwordToken().post({ body: { email, ttlMinutes: 60, invalidateOlderTokens: true } }).execute()` | Returns `{ value, expiresAt }`. Value goes only into the mail adapter. Docs: https://docs.commercetools.com/api/projects/customers#create-a-token-for-resetting-the-customers-password |
| `getCustomerByPasswordToken(token)` | `apiRoot.customers().withPasswordToken({ passwordToken: token }).get().execute()` | 200 means valid, 404 or 400 means dead. Confirm the method name against the installed SDK; if absent, fall back to treating the reset POST as the only validation and show the dead-link card on its `InvalidToken` error |
| `resetPassword(token, newPassword)` | `apiRoot.customers().passwordReset().post({ body: { tokenValue: token, newPassword } }).execute()` | `InvalidToken` (400) maps to `token_invalid`. Docs: https://docs.commercetools.com/api/projects/customers#reset-customers-password |
| `createEmailToken(customerId)` | `apiRoot.customers().emailToken().post({ body: { id: customerId, ttlMinutes: 60 } }).execute()` | Needs the Customer id, not an email, so resend needs a session (spec). Docs: https://docs.commercetools.com/api/projects/customers#create-a-token-for-verifying-the-customers-email |
| `confirmEmail(token)` | `apiRoot.customers().emailConfirm().post({ body: { tokenValue: token } }).execute()` | Sets `isEmailVerified` true |
| `getCustomerById(id)` | `apiRoot.customers().withId({ ID: id }).get().execute()` | For `/me` and `requireCustomer*`. Expand nothing |

Credentials: the commercetools storefront API client needs `manage_customers:{projectKey}` (create customers, tokens, login). Confirm it is in `CTP_SCOPES` (workstream D); if missing, write `OA-J-c` in the todo file and carry on with unit tests.

### 3.6 Session

On login and register success, write via D's session updater: `customerId`, `customerEmail`, `customerFirstName`, `customerLastName`, `cartId = result.cart?.id ?? session.cartId`, `anonymousId` removed. Never store a commercetools token (customer tokens are not requested at all, the BFF uses its own client and checks ownership in code, as the skill does for B2C). Cookie attributes stay as D set them (HTTP-only, `sameSite=lax`, 30 days, `jose` HS256). Issue a **fresh cookie on login** (new `iat`), which prevents session fixation.

Known limit (record in `PROJECT-FINDINGS.md`, Q-J-06): because the cookie holds no commercetools token, a password reset cannot revoke cookies issued earlier in other browsers. The browser that completes the reset is signed out. The spec scenario "sessions issued before the reset no longer authenticate" is therefore met only for that browser by default.

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

### 3.8 Verification policy and mail adapter

- Seeded customers are `isEmailVerified: true`. A new registrant is `false`; the app does not gate shopping, checkout or reviews on it (Q-J-04). It shows `VerifyEmailBanner`.
- Password reset for an **unverified** account: the response is the same generic confirmation, but the mail sent is the `verify-then-reset` template (a verification link and the text that the address must be verified before the password can be reset). This is how "Verification before recovery" states what is required without breaking "Address with no account" (the two specs pull in opposite directions; see Q-J-07).
- `MailAdapter`: `interface MailAdapter { send(message: MailMessage): Promise<void> }`, `MailMessage = { to: string; template: 'verify-email' | 'reset-password' | 'verify-then-reset'; locale: string; link: string; expiresAt: string }`. `getMailAdapter()` reads `MAIL_ADAPTER`: `outbox` (default when `NODE_ENV !== 'production'`: keeps the last 20 messages in memory, never writes the link to a log), `disabled` (default in production: does nothing, logs one line `mail_disabled template=<name>` without address or link). Real adapters are added after Q-J-03 is answered; none are built here. The spec says dev "logs"; a logged token breaks the spec's own rule "never log a reset or verification token", so the dev adapter keeps messages in memory and exposes them on `/api/dev/outbox` (Q-J-03).
- Links are built as `${PUBLIC_SITE_URL}/${locale}/account/reset-password?token=...` and `/account/verify-email?token=...`. `PUBLIC_SITE_URL` defaults to `http://localhost:3000` in dev; missing in production fails the send, not the request.
- `mailEnabled()` (true only when the adapter is not `disabled`) is exported for K's confirmation copy.

### 3.9 i18n keys (namespace `auth`; en-GB equals en-US unless stated)

| Key | en-US | de-DE |
| --- | --- | --- |
| `signIn.title` | Sign in | Anmelden |
| `signIn.intro` | Welcome back. Sign in to see your orders and saved items. | Willkommen zurück. Melden Sie sich an, um Bestellungen und gemerkte Artikel zu sehen. |
| `signIn.email` / `signIn.password` | Email / Password | E-Mail-Adresse / Passwort |
| `signIn.submit` / `signIn.pending` | Sign in / Signing in… | Anmelden / Anmeldung läuft… |
| `signIn.invalidCredentials` | Email or password is incorrect. | E-Mail-Adresse oder Passwort ist falsch. |
| `signIn.tooMany` | Too many attempts. Try again in {seconds} seconds. | Zu viele Versuche. Versuchen Sie es in {seconds} Sekunden erneut. |
| `signIn.forgot` / `signIn.create` | Forgot your password? / Create an account | Passwort vergessen? / Konto erstellen |
| `signIn.cartMerged` | Your bag was added to your account. | Ihr Warenkorb wurde Ihrem Konto hinzugefügt. |
| `notice.reset` / `notice.verified` / `notice.registered` / `notice.signedOut` | Password changed. Sign in with your new password. / Email confirmed. / Account created. / You are signed out. | Passwort geändert. Melden Sie sich mit dem neuen Passwort an. / E-Mail bestätigt. / Konto erstellt. / Sie sind abgemeldet. |
| `register.title` / `register.submit` | Create your account / Create account | Konto erstellen / Konto erstellen |
| `register.firstName` / `register.lastName` | First name / Last name | Vorname / Nachname |
| `register.consent` | By creating an account you agree to the {terms} and {privacy}. | Mit der Kontoerstellung stimmen Sie den {terms} und der {privacy} zu. |
| `register.failed` | We could not create the account with these details. If you already have one, sign in or reset your password. | Das Konto konnte mit diesen Angaben nicht erstellt werden. Falls Sie schon eines haben, melden Sie sich an oder setzen Sie Ihr Passwort zurück. |
| `register.created` | Welcome to Malva Coffee. | Willkommen bei Malva Coffee. |
| `password.show` / `password.hide` | Show password / Hide password | Passwort anzeigen / Passwort verbergen |
| `password.rulesMet` | {met} of {total} rules met | {met} von {total} Regeln erfüllt |
| `password.rules.min_length` | At least 10 characters | Mindestens 10 Zeichen |
| `password.rules.letter` | Contains a letter | Enthält einen Buchstaben |
| `password.rules.digit` | Contains a number | Enthält eine Ziffer |
| `password.rules.not_email` | Is not your email address | Entspricht nicht Ihrer E-Mail-Adresse |
| `password.rules.max_length` | At most 128 characters | Höchstens 128 Zeichen |
| `forgot.title` / `forgot.submit` | Reset your password / Send reset link | Passwort zurücksetzen / Link senden |
| `forgot.sent` | If an account exists for that address, we have sent instructions to it. Check your inbox. | Falls zu dieser Adresse ein Konto existiert, haben wir Anweisungen gesendet. Prüfen Sie Ihren Posteingang. |
| `reset.title` / `reset.submit` | Choose a new password / Change password | Neues Passwort wählen / Passwort ändern |
| `reset.linkDead` | This link can no longer be used. Request a new one below. | Dieser Link ist nicht mehr gültig. Fordern Sie unten einen neuen an. |
| `verify.confirmed` | Your email address is confirmed. | Ihre E-Mail-Adresse ist bestätigt. |
| `verify.already` | This address is already confirmed. | Diese Adresse ist bereits bestätigt. |
| `verify.expired` | This link has expired. | Dieser Link ist abgelaufen. |
| `verify.sendNew` / `verify.signInToResend` / `verify.resent` | Send me a new link / Sign in to get a new link / A new link is on its way. | Neuen Link senden / Anmelden, um einen neuen Link zu erhalten / Ein neuer Link ist unterwegs. |
| `verify.banner` / `verify.bannerResend` | Please confirm your email address. / Resend email | Bitte bestätigen Sie Ihre E-Mail-Adresse. / E-Mail erneut senden |
| `errors.unavailable` / `errors.retry` | Something went wrong on our side. Please try again. / Try again | Bei uns ist etwas schiefgelaufen. Bitte versuchen Sie es erneut. / Erneut versuchen |
| `errors.required` / `errors.emailShape` | This field is required. / Enter a valid email address. | Dieses Feld ist erforderlich. / Geben Sie eine gültige E-Mail-Adresse ein. |

Mail subject and body strings live in `lib/mail/templates.ts` per locale (three catalogues of three templates, short, plain text with the link). Not seen by shoppers while the adapter is `outbox` or `disabled`.

### 3.10 Cache keys, caching

`KEY_ACCOUNT` (exists from D; J uses it, does not redefine). `useAccount` does not revalidate on focus. No server caching of anything in this workstream. Pages that read the session are dynamic. Reset and verify pages send `Cache-Control: no-store`.

### 3.11 Accessibility

One H1 per page; `<form>` with `noValidate` and our own messages; each error is tied to its field by `aria-describedby` and `aria-invalid`; a page-level error uses `role="alert"`; after a failed submit focus moves to the first invalid field (or the password field for invalid credentials); success notices `role="status"`. Every control is a real `button` or `a` with the visible focus ring. Show-password toggle announces its state. The strength list is a `ul`; colour is never the only signal.

## 4. Tasks

Branch `ws/j-auth-and-session`. Commit `ws-j: J-0n summary`. Each task is under half a day. Run `npm run check` before ticking.

- [ ] **J-01 Password policy, safe redirect, rate limiter, types.** Files: `lib/auth/password-policy.ts`, `lib/auth/redirect.ts`, `lib/rate-limit.ts`, `lib/types.ts` (`AppCustomer`, `AppAddress`, `RuleId`), plus tests next to them. Implement as in 3.4 and 3.7. Rules: `min_length` 10, `max_length` 128, `letter`, `digit`, `not_email` (case-insensitive compare with the email local part and the full email). Tests: `Password fails policy names the rule it failed`, `Password of 10 characters with a letter and digit passes`, `safeRedirect rejects absolute URLs, double slashes and backslashes`, `safeRedirect keeps a safe fragment`, `Login attempts are limited per address and per ip`.
- [ ] **J-02 Customer mapper and commercetools auth module.** `[SKILL: commercetools-platform]` `[SKILL: commercetools-storefront]`. Files: `lib/mappers/customer.ts`, `lib/ct/auth.ts`, tests with mocked `apiRoot`. Implement every function of 3.5. `toAppCustomer` maps addresses and the two default flags (`defaultShippingAddressId`, `defaultBillingAddressId` compared to each address id). Tests: `signIn passes anonymousCart and the merge mode only when a guest cart exists`, `signIn never calls the in-store endpoint`, `createCustomer then signIn is a two-step flow`, `toAppCustomer marks the default shipping address`, `getCustomerByPasswordToken maps 404 to dead`.
- [ ] **J-03 Mail adapter.** Files: `lib/mail/*`, `app/api/dev/outbox/route.ts`, `.env.example`. Tests: `Outbox keeps the newest 20 messages`, `Disabled adapter sends nothing and logs no address or link`, `Dev outbox route answers 404 in production`, `Dev outbox route answers 404 when the adapter is disabled`, `Outbox never writes the link to the console`.
- [ ] **J-04 Login, logout, me handlers.** `[SKILL: commercetools-storefront]`. Files: `app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`, `lib/auth/session-customer.ts`, tests. Tests: `Credentials accepted`, `Unknown and wrong are indistinguishable` (both mocked commercetools failures return byte-identical bodies and status), `Sign in carries the anonymous cart`, `Login issues a fresh cookie`, `Logout keeps market and store`, `me returns null not 401`, `Tampered cookie is an empty session`, `Login is rate limited and still ambiguous`.
- [ ] **J-05 Register handler.** `[SKILL: commercetools-storefront]`. File: `app/api/auth/register/route.ts`, tests. Policy check first (no commercetools call on failure). Duplicate email maps to `409 registration_failed` with the generic text. Sends the `verify-email` mail through the adapter and returns `verificationSent`. Tests: `Register refuses a weak password before any commercetools call`, `Register then signs in and merges the cart`, `Duplicate email gives a generic refusal`, `Register passes anonymousId so earlier orders attach`.
- [ ] **J-06 Forgot and reset handlers.** `[SKILL: commercetools-storefront]`. Files: `app/api/auth/password/forgot/route.ts`, `password/reset/route.ts`, tests. Forgot: lookup, choose template (`reset-password` for verified, `verify-then-reset` with an email token for unverified, nothing for unknown), pad to at least 400 ms with a timer helper that tests can fake, always `{ ok: true }`. Tests: `Address with no account gets the same response`, `Unknown and known addresses take the same minimum time`, `Reset token is passed only to the mail adapter`, `Unverified account gets the verify first mail`, `Token valid password changed`, `Token expired or consumed`, `Password fails policy before any commercetools call`, `Reset clears the browser session`.
- [ ] **J-07 Verify handlers.** `[SKILL: commercetools-storefront]`. Files: `app/api/auth/verify-email/confirm/route.ts`, `resend/route.ts`, tests. Tests: `Token valid address confirmed`, `Token expired`, `Resend needs an identified account`, `Resend without session answers 401 sign_in_required`, `Resend is rate limited and still answers ok`.
- [ ] **J-08 Hooks and guards.** Files: `hooks/useAccount.ts` (read F's file first and extend it; do not break `AccountMenu` tests), `hooks/useAuthActions.ts`, `lib/cache-keys.ts` (add `USER_SCOPED_KEYS = ['account','cart','cart-count','checkout','orders','order','addresses','saved-items','my-reviews','recurring-orders','payment-methods']`, append only), `lib/auth/require-customer.ts`, tests. `useAccount` is SWR keyed `KEY_ACCOUNT`, `revalidateOnFocus: false`, fetcher returns `null` when the response is not ok (use D's `jsonFetcher`). `useAuthActions().signOut` posts logout, then calls SWR `mutate(key => key === KEY_ACCOUNT || (Array.isArray(key) ? USER_SCOPED_KEYS.includes(String(key[0])) : USER_SCOPED_KEYS.includes(String(key))), undefined, { revalidate: false })` (this covers G's `KEY_CART` and D's `keyCart(customerId)` forms alike), then navigates to `/account/sign-in?notice=signedOut`. Tests: `Logout clears every user-scoped cache key in both key forms`, `requireCustomerPage redirects with the path preserved`, `requireCustomerApi returns 401 with no detail`.
- [ ] **J-09 Shared UI atoms for auth.** Files: `components/auth/AuthCard.tsx`, `PasswordField.tsx`, `PasswordStrength.tsx` and tests. Tokens only, no hex. Tests: `Strength list names the failing rule`, `Show password toggle exposes its state`, `AuthCard has one H1`.
- [ ] **J-10 Sign-in page.** Files: `app/[locale]/account/sign-in/page.tsx`, `components/auth/SignInForm.tsx`, messages in three catalogues (keys 3.9), tests. Tests: `Failed sign in is ambiguous` (rendered text equal for both cases), `Focus moves to the password after a failed sign in`, `Success redirects to the safe destination`, `Unsafe redirect falls back to account`, `Signed in visitor is sent on`.
- [ ] **J-11 Register page.** Files: `app/[locale]/account/register/page.tsx`, `RegisterForm.tsx`, tests. Tests: `Register shows policy failures by rule`, `Register shows the generic refusal for a duplicate`, `Register pre-fills email from the guest cookie and deletes it`.
- [ ] **J-12 Forgot and reset pages.** Files: `forgot-password/page.tsx`, `reset-password/page.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, tests. Tests: `Confirmation shown is the same for any address`, `Dead link page lets a new reset be requested on the same page`, `Reset page sets no-referrer`, `Reset form blocks a weak password client-side`.
- [ ] **J-13 Verify page and banner.** Files: `verify-email/page.tsx`, `VerifyEmailStatus.tsx`, `VerifyEmailBanner.tsx`, tests. Tests: `Link opened twice routes on without a token error`, `Expired link offers a new one and does not retry silently`, `Resend asks to sign in without a session`, `Banner shows only for unverified customers`.
- [ ] **J-14 Platform probes and findings.** `[SKILL: commercetools-platform]`. Using the dev server and two throwaway customers (`qa-j-<date>-1@example.com`, `-2@`, synthetic passwords), record in `plans/PROJECT-FINDINGS.md` (no tokens, no passwords): (a) does the email token stay valid after one confirmation (open the same link twice)? (b) does `emailConfirm` or `passwordReset` on an expired token return the same error body? (c) does a login with `anonymousCart` when the customer already has an active cart keep both carts' lines (compare line counts)? (d) the `CustomerSignin` field name the installed SDK uses (`anonymousCart` or `anonymousCartId`). (e) what a login does with an anonymous cart whose currency differs from the customer's active cart. Add each answer to the right Q-J row. List the test emails in `plans/evidence/J/test-customers.txt` for the lead's cleanup manifest (D-019).
- [ ] **J-15 Browser recipe, evidence, hand-off.** Run section 6 and 7, save evidence in `plans/evidence/J/`, add todo rows, set `Ready for review`.

## 5. Scenarios checklist

Tick only when the named test exists and passes. Federated and store-bound scenarios are not applicable by decision (Q-J-01, Q-J-02) and are covered by the stated negative test.

`account-sign-in`
- [ ] Credentials accepted: `Credentials accepted` (J-04)
- [ ] Unknown and wrong are indistinguishable: `Unknown and wrong are indistinguishable` (J-04) and `Failed sign in is ambiguous` (J-10)
- [ ] Buyer bound to another entry point: not applicable (Q-J-02); negative test `signIn never calls the in-store endpoint` (J-02)
- [ ] Federated buyer has no local password: not applicable (Q-J-01); the sign-in page has no SSO control, asserted by `Sign-in page offers no federated button` (J-10)

`authentication-and-identity`
- [ ] Sign in carries the anonymous cart: `Sign in carries the anonymous cart` (J-04), browser check B6
- [ ] Failed sign in is ambiguous: `Failed sign in is ambiguous` (J-10)
- [ ] Password reset does not confirm the email: `Address with no account gets the same response` (J-06), `Confirmation shown is the same for any address` (J-12)
- [ ] Verification before recovery: `Unverified account gets the verify first mail` (J-06), see Q-J-07

`password-reset`
- [ ] Token valid password changed: `Token valid password changed` (J-06); browser check B9. The "earlier sessions stop authenticating" half holds for the resetting browser only (Q-J-06)
- [ ] Token expired or consumed: `Token expired or consumed` (J-06), `Dead link page lets a new reset be requested on the same page` (J-12)
- [ ] Address with no account: `Address with no account gets the same response`, `Unknown and known addresses take the same minimum time` (J-06)
- [ ] Password fails policy: `Password fails policy before any commercetools call` (J-06), `Reset form blocks a weak password client-side` (J-12)

`email-verification`
- [ ] Token valid address confirmed: `Token valid address confirmed` (J-07); browser check B11
- [ ] Token expired: `Token expired` (J-07), `Expired link offers a new one and does not retry silently` (J-13)
- [ ] Resend needs an identified account: `Resend needs an identified account` (J-07), `Resend asks to sign in without a session` (J-13)
- [ ] Link opened twice: `Link opened twice routes on without a token error` (J-13)

## 6. Browser recipe (Chrome DevTools MCP)

Prerequisite: `npm run dev`, live credentials (`OA-J-a`), `MAIL_ADAPTER=outbox`. Use throwaway customers you register yourself; invent a synthetic password that satisfies the policy (it protects only `@example.com` test accounts; never reuse a real password and never write it into evidence or a commit). Evidence goes to `plans/evidence/J/<step>-<what>-<375|1440>.png`. For every step: `take_snapshot`, `list_console_messages` (no errors), `list_network_requests` (no failed requests except the expected 401 on the failed login).

| Step | Do | Expect |
| --- | --- | --- |
| B1 | `resize_page` 1440x900, navigate `/en-US/account/sign-in` | Card centred, H1 "Sign in", one email and one password field, no SSO control |
| B2 | Repeat at 375x812 | No horizontal scroll, controls at least 44 px tall |
| B3 | Submit empty | Field errors beside each field, focus on the first |
| B4 | Fill an unregistered email and any password; then the registered `qa-j-...` email with a wrong password | Both show the identical text; compare the two response bodies in `get_network_request` |
| B5 | Navigate `/en-US/account/register`, create `qa-j-<date>-1@example.com` | Weak password shows failing rules; strong one signs in, toast shown, unverified banner shows |
| B6 | Sign out, add one product to the bag as a guest (workstream I UI), sign in | Bag keeps the line, cart count in the header unchanged, `/api/auth/login` response contains the cart |
| B7 | Switch to `/de-DE/account/sign-in` | German copy, same behaviour |
| B8 | `/en-US/account/forgot-password` with the registered email and with `nobody@example.com` | Identical confirmation, identical status and body, similar response time (note both durations) |
| B9 | Verified account only (do B11 first for the QA customer): open `/api/dev/outbox?to=<email>` for the reset link, open it, set a weak then a valid password | Rule names shown; success lands on sign-in with the notice; old password rejected, new accepted |
| B10 | Open the used reset link again | Dead-link card with the request form on the same page |
| B11 | New unverified customer: read the verify link from the outbox, open it | Confirmed, redirected to `/en-US/account` (L's account page may not exist yet; if it does not, open the link with `redirect=/` appended), banner gone after reload |
| B12 | Open the same verify link again signed in | "already confirmed" and routed on, no token error |
| B13 | Open an expired or fabricated verify link signed out, press the new-link button | Asks to sign in; after sign in the resend works and a new outbox message exists |
| B14 | Open `/en-US/account/sign-in?redirect=https://evil.example` and sign in | Lands on `/en-US/account` (or the fallback), never the external URL |
| B15 | Tab through each page | Focus ring visible on every control; show-password toggle reachable |

## 7. Self-verification with data

No owner involvement.
- Read the customer back through the commercetools MCP (when connected) or a read-only script: after B5 the customer has `isEmailVerified` false, after B11 true; after B9 the old password fails at `/api/auth/login` (401).
- `cd seed && npm run verify` still passes (J writes no seed data). Seeded customers (SEED-PLAN section 13) are verified: query `customers` where `email in (...)` and assert `isEmailVerified` is true; record ids and flags only in `plans/evidence/J/seeded-customers.json`.
- Compare the two ambiguous responses of B4 and B8 byte for byte and save the comparison as text in evidence.
- Verify no token or password appears in the server console output during B5 to B13 (`grep` the dev server log for `token=`; the result must be empty) and save "0 matches" as evidence.
- Write `plans/evidence/J/README.md` saying what each file proves.

## 8. Manual testing and owner items

Format per `JUNIOR-GUIDE.md` section 5. Same rows are in `plans/notes/todo-J.md`.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-J-a | Owner | Before J-15 browser recipe | 1. Confirm OA-01 credentials are in `storefront/.env.local`. 2. Confirm the API client scope list includes `manage_customers`. | `/api/health` answers and registration works | TODO |
| OA-J-b | Owner | Before real email is wanted (not blocking) | 1. Decide Q-J-03 (provider or none). 2. If a provider, store its key only in the host secret store. | A real adapter task can be written | TODO |
| SO-J-a | Owner | Before release | 1. Open `/en-US/account/sign-in`, `/account/register`, `/account/forgot-password`, `/account/reset-password`, `/account/verify-email` at 375 and 1440 px. 2. Judge the look against the other pages. 3. Approve or list changes (these screens are not in the VELA design). | Owner signs off or lists changes | TODO |
| M-J-01 | Owner | Before release | 1. On a real phone open `/en-US/account/sign-in`. 2. Sign in as a seeded customer (password from `SEED_DEMO_PASSWORD`, which only you hold). 3. Reload, close the tab, reopen. | Still signed in, no horizontal scroll, keyboard does not cover the button | TODO |
| M-J-02 | Owner | Only if a real email provider is chosen | 1. Register with a real inbox. 2. Click the link in the email. 3. Request a password reset and click that link. | Both links work once and expire as stated | TODO |

## 9. Questions

Each is also in `plans/notes/questions-J.md` (format `Q-J-n | question | default | blocks? | Open`). The default is built.

| ID | Question | Default built | Blocks? |
| --- | --- | --- | --- |
| Q-J-01 | Is SSO or federated sign-in required? | No. No SSO control, no federated route. | No |
| Q-J-02 | Are customers global or store-scoped? | Global; global `/login` endpoint; no `in-store` calls. | No |
| Q-J-03 | Which email provider (if any) sends verification and reset mails, and who owns templates? | `MailAdapter` port with `outbox` in dev (in memory, read at `/api/dev/outbox`) and `disabled` in production. No provider code. | No |
| Q-J-04 | What may an unverified customer do? | Everything (browse, order, review) with a banner. Verification only gates password recovery. | No |
| Q-J-05 | Should registration reveal that an email is already registered? | No: generic refusal text pointing to sign-in and reset. | No |
| Q-J-06 | Must a password reset end sessions in other browsers? | Not possible with a cookie that holds no commercetools token. Only the resetting browser is signed out. Option if required: store a per-customer "sessions valid from" value in a Custom Object and check it on each request (needs scope `manage_key_value_documents`). | No |
| Q-J-07 | The reset spec (no disclosure) and the identity spec ("state what is required for an unverified account") conflict. Which wins? | Both: generic on-screen answer, and the emailed message tells an unverified owner to verify first. | No |
| Q-J-08 | Where are the terms and privacy pages? | `/${locale}/terms` and `/${locale}/privacy` (P may rename; update the two links). | No |
| Q-J-09 | Token validity for reset and verification? | 60 minutes for both, `invalidateOlderTokens: true` for reset. 60 keeps a connector-sent email possible later. | No |
| Q-J-10 | Password policy? | At least 10, at most 128 characters, one letter, one digit, not equal to the email. The seeded demo password (10 or more characters) must meet it. | No |
| Q-J-11 | Merge mode when the customer already has a cart? | `MergeWithExistingCustomerCart` (skill default); lines are kept, none dropped. | No |
| Q-J-12 | Rate limiting beyond one server instance? | In-memory per instance; shared store needed on multi-instance hosting (OA-05). | No |
| Q-J-13 | D's error envelope is closed (fixed `ErrorCode`, body exactly code and message). Field-level and domain codes (`password_policy` with rule ids, `retryAfterSeconds`) need extra properties. May the envelope carry extras? | Yes: `domainError(code, status, extra)` in `lib/api-domain.ts` keeps `{ error: { code, message, ...extra } }` and never carries commercetools text. | No |

## 10. Definition of done

- All tasks ticked, each with a passing `npm run check`; `npm run build` passes.
- Every scenario in section 5 ticked with its named test, or the not-applicable line stands with its negative test.
- Browser recipe B1 to B15 verified by you at 375 and 1440 px; evidence and its `README.md` in `plans/evidence/J/`; console and network clean.
- Section 7 checks recorded; the "0 matches" token-in-log check is saved.
- `PROJECT-FINDINGS.md` has the J-14 answers; Q rows and todo rows are in `plans/notes/`.
- Exports of section 3.7 exist with the exact signatures (K, L and M import them).
- No `TODO` or `FIXME` without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
