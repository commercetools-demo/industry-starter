# R — Auth pages and identity

**Specs:** `account-sign-in` (3 of 4 scenarios built; federated excluded), `email-verification` (reduced to auto-verify, D-031), `password-reset` (all 4), and the four flow scenarios of `authentication-and-identity` (this workstream owns **all four**: sign-in carries the cart, ambiguous failure, reset does not confirm the email, verification before recovery; E builds only the session cookie core, which has no scenario of its own in that spec, so nothing is "built in E")
**Depends on:** E, I, M · **Unblocks:** S, T, U · **Decisions:** D-005, D-030, D-031, D-033, D-035, D-050, D-053, D-058, D-059
**Owner prerequisites:** OA-02 (live checks) · **Skill refs:** `commercetools-platform` (customer sign-in, tokens), `commercetools-storefront` (cart merge, session)

## Goal
A visitor can register (the account is verified immediately), log in with a safe return target (the anonymous bundle is merged into the customer's), request a password reset (demo link on screen), set a new password under one shared password policy, and log out; sign-in is rate limited; the account area redirects anonymous visitors to the login page.

## Design

### 1. Identity model (answers every open question as Planner defaults)
- **Credentials are owned by commercetools; customers are global** (D-030): sign-in is `POST /{projectKey}/login`, never `/in-store/...`; no Stores exist (D-058). No SSO / federated sign-in (Planner default: none). Answers: "which IdP owns buyers" → none; "are accounts store-scoped" → no.
- **Lockout and rate limiting are done by the storefront tier** (commercetools does not rate-limit sign-in and there is no IdP): `lib/auth/rate-limit.ts`, numbers in section 4.
- **Session**: E's signed JWT cookie (`jose`, HttpOnly, Secure outside localhost, SameSite=Lax). The customer's commercetools token never reaches the browser; the server calls commercetools with its own client. R writes the session fields through E's `lib/ct/session.ts` (use E's exported `getSession` / session-update / session-clear functions by the names in E's file).
- **Sessions issued before a password reset must stop working** (spec "Token valid password changed"): R writes custom field `sessionsValidAfter` (DateTime) on the customer at reset time; `requireCustomerPage` / `requireCustomerApi` (section 5) reject a session whose issued-at (`iat`, exposed by E's session as the session issue time) is earlier than that field. The field is added to custom type `malva-customer` by `scripts/seed/customer-fields.ts` (R-08).
- **Registration reveals duplicate emails** (Planner default: "An account with this email already exists. Log in or reset your password."), because a silent success would break the flow for a person who forgot they registered; this is mitigated by the registration rate limit and is flagged for the owner.
- New customers get Customer Group `consumer` (D-058, `customerGroup: { typeId: 'customer-group', key: 'consumer' }`) and a generated `customerNumber`.

### 2. commercetools calls (verified against OAS `api-Customer-write`, `api-Customer-read`, `api-CustomerToken` and the docs)
| Purpose | Call |
| --- | --- |
| Sign in + merge | `POST /{projectKey}/login` body `{ email, password, anonymousCart: { id, typeId: 'cart' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart', updateProductData: true }` → `{ customer, cart? }`. Failure is HTTP 400 `InvalidCredentials` (same for unknown email, wrong password, store-bound customer; [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signin)) |
| Register | `POST /{projectKey}/customers` body `CustomerDraft { email, password, firstName, lastName, customerNumber, customerGroup, locale, anonymousCart?, anonymousCartSignInMode? }`; duplicate email → HTTP 400 `DuplicateField` (field `email`); duplicate `customerNumber` → `DuplicateField` (field `customerNumber`, retry up to 3 times with a new number) |
| Auto-verify (D-031) | `POST /{projectKey}/customers/email-token` body `{ id, version, ttlMinutes: 5 }` → `{ value }`, then `POST /{projectKey}/customers/email/confirm` body `{ tokenValue }` ([docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signup-and-email-verification)). The token value is held in a local variable only and never logged |
| Reset token | `POST /{projectKey}/customers/password-token` body `{ email, ttlMinutes: 60, invalidateOlderTokens: true }` → `CustomerToken { value, expiresAt }`; unknown email → HTTP 404 (**swallowed**, see section 4) |
| Validate token without consuming it | `GET /{projectKey}/customers/password-token={tokenValue}` → the Customer, or 404 when expired/unknown/consumed (this is the check the reset page makes on load) |
| Reset | `POST /{projectKey}/customers/password/reset` body `{ tokenValue, newPassword }`; invalid/expired/used → HTTP 400/404 (`InvalidToken`/`ResourceNotFound`) mapped to `INVALID_TOKEN` |
SDK builders (`@commercetools/platform-sdk`): `apiRoot.login().post(...)`, `apiRoot.customers().post(...)`, `.customers().emailToken().post(...)`, `.customers().emailConfirm().post(...)`, `.customers().passwordToken().post(...)`, `.customers().withPasswordToken({ passwordToken }).get()`, `.customers().passwordReset().post(...)`. **Never** `apiRoot.customers().login()` (does not exist as a global sign-in). R-04 first runs the OAS check (`mcp ... commercetools-oas-schemata api-Customer-write`) and writes any difference into `PROJECT-FINDINGS.md`.

Reset token TTL **60 minutes** (D-033; ≤ 60 so the token would also appear in the `CustomerPasswordTokenCreated` message if a connector were added later), `invalidateOlderTokens: true` so a second request kills the first link, **single use** (commercetools consumes it on reset). Email token TTL 5 minutes (consumed immediately).

### 3. Files (all new, R's area; `lib/ct/**` start with `import 'server-only'`)
```
lib/config/password.ts          single source of the password policy (section 6)
lib/config/auth.ts              RATE_LIMITS, TOKEN_TTL_MINUTES = { reset: 60, email: 5 }, MIN_RESPONSE_MS = 400, CUSTOMER_GROUP_KEY = 'consumer'
lib/auth/email.ts               normalizeEmail(raw): trim + lower-case; isPlausibleEmail(raw): /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ and length ≤ 254
lib/auth/return-target.ts       safeReturnPath(input, locale): string
lib/auth/origin.ts              assertSameOrigin(request): void (throws ApiError 403 FORBIDDEN)
lib/auth/rate-limit.ts          rateLimit(key, rule), registerFailure/clearFailures/isLockedOut
lib/auth/guard.ts               requireCustomerPage(locale, path), requireCustomerApi(request)
lib/auth/api.ts                 signedInResponse(...), clientKey(request)
lib/ct/customer.ts              signIn, signUp, verifyEmailNow, createPasswordResetToken, validatePasswordToken, resetPassword, getCustomerById, markSessionsInvalid
lib/mappers/customer.ts         mapCustomer(ctCustomer): AccountUser { id, email, firstName, lastName, customerNumber?, isEmailVerified, createdAt }
app/api/auth/login/route.ts  logout/route.ts  me/route.ts  register/route.ts  forgot-password/route.ts  reset-password/route.ts
app/[locale]/login/page.tsx  register/page.tsx  forgot-password/page.tsx  reset-password/page.tsx
components/auth/{AuthCard,LoginForm,RegisterForm,ForgotPasswordForm,ResetPasswordForm,PasswordStrength,PasswordField}.tsx
components/auth/useAuthForm.ts  (client hook: submit, field errors, aria ids)
hooks/useAuthMutations.ts       login, register, logout, forgotPassword, resetPassword (SWR mutate of KEY_CART and the account key, then router.refresh())
scripts/seed/customer-fields.ts ensures custom type malva-customer has field sessionsValidAfter (DateTime); idempotent
```
`AccountUser` is appended to `lib/types.ts` ("// ---- R: account user ----"). Components import `Field`, `Button`, `Card` from I's `components/ui/*` (use their exported names; if `Field` lacks an `error`/`describedBy` prop, R adds it **inside** `components/ui/Field.tsx` as the only edit to I's file and says so in the commit).

### 4. Security rules (OWASP basics) and the numbers
1. **Generic failures.** Login returns HTTP 401 `{ error: { code: 'INVALID_CREDENTIALS', message: 'Enter a valid email and password.' } }` for unknown email, wrong password, store-bound customer, or any commercetools `InvalidCredentials`. Same status, same body, same headers. Timing: every login attempt that fails is padded to at least `MIN_RESPONSE_MS = 400` ms total before responding (`await sleep(max(0, 400 − elapsed))`).
2. **Rate limits (in memory per server instance, best effort on serverless; Planner default; limits are a constant table in `lib/config/auth.ts`):**
   | Route | Key | Limit |
   | --- | --- | --- |
   | `POST /api/auth/login` | per IP | 20 attempts / 15 min |
   | `POST /api/auth/login` | per normalized email | **lockout:** after **5 consecutive failures** the email is locked for **15 min** (counter resets on a success or after 15 min without failure). Applies to unknown emails identically (the lock is by the string, not by account existence) |
   | `POST /api/auth/register` | per IP | 5 / hour |
   | `POST /api/auth/forgot-password` | per IP | 5 / hour |
   | `POST /api/auth/forgot-password` | per normalized email | 3 / hour (when exceeded: still answers the generic OK, but creates no token) |
   | `POST /api/auth/reset-password` | per IP | 10 / hour |
   Blocked requests answer HTTP 429 `{ error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } }` with `Retry-After: <seconds>`. The IP is `x-nf-client-connection-ip` (Netlify), else the first entry of `x-forwarded-for`, else `'unknown'` (all unknown share one bucket).
3. **Reset request is indistinguishable** (`password-reset` "Address with no account"): the route always answers `200 { ok: true }`; commercetools 404 for an unknown email and every other commercetools failure are swallowed; same padding to 400 ms; tokens are never logged.
4. **CSRF:** all auth POSTs call `assertSameOrigin` (the `Origin` header host must equal the request `Host`; a missing Origin on a browser POST is rejected; localhost ports respected) plus cookies are SameSite=Lax. JSON content type required; body ≤ 4 KB, else 413.
5. **Open redirect:** `safeReturnPath(input, locale)` returns the locale-prefixed path only if it starts with `/`, not `//`, contains no `\`, no `://`, no control characters, and its first segment after the locale is one of `account`, `bundle`, `shop`, `search`, `support`; otherwise `/<locale>/account`. The returned path never includes the host.
6. **Cache:** auth pages and every `/api/auth/*` response send `Cache-Control: no-store`. The reset page sets `referrer: 'no-referrer'` and `robots: { index: false }` in `generateMetadata`; all four pages are `noindex`.
7. **No secrets in logs:** passwords, tokens and reset links are never logged, never put in error messages, never returned except the demo link of D-033.
8. **Passwords** policy enforced client and server from the same module; maximum 128 characters (prevents hashing DoS); never trimmed; `autocomplete` attributes: login email `username`, login password `current-password`, register/reset password `new-password`.
9. **Session rotation:** a successful login/register issues a fresh session token (new `iat`) and keeps only `anonymousId`; the old cart id in the session is replaced by the merged cart id.
10. **Logout** (`POST /api/auth/logout`) clears identity fields and cart id, keeps `anonymousId`, answers `{ ok: true }`; it does not require commercetools.

### 5. Flows
**Login** (`POST /api/auth/login`, body `{ email, password, returnTo? }`): same-origin check → rate limit (IP, then lockout key) → validate (`isPlausibleEmail`, password non-empty ≤ 128) else 400 `INVALID_INPUT` (field-level messages come from the client; the server answers the generic text for malformed input too, status 401, so it cannot be used to probe) → `signIn(email, password, session.cartId)` → on success: `reconcileMergedCart(cart.id)` from M's `lib/ct/cart.ts` (M's merge rules: M's file names the function; the contract R needs is "takes the merged cart id, applies M's rules for quantity caps and conflicts, returns the mapped `Cart` plus a list of removed-line notes"; **no item is dropped silently**: notes are returned as `mergeNotes: string[]` message keys and shown in a toast by `useAuthMutations`) → write session `{ customerId, customerEmail, customerFirstName, customerLastName, cartId }` → `clearFailures(email)` → 200 `{ user: AccountUser, cart: Cart | null, mergeNotes: [], redirectTo: safeReturnPath(returnTo) }`. If sign-in fails **only** because the anonymous cart is stale (error other than `InvalidCredentials`), retry once without the anonymous cart. Merge default `MergeWithExistingCustomerCart` (D-030; the business decision recorded here: merge, never overwrite).
**Return target:** pages read `?returnTo=` (relative path) server-side, pass it to the form as a prop; the form redirects client-side to `redirectTo`. Protected pages redirect anonymous visitors to `/<locale>/login?returnTo=<encoded path>`; "Create an account" and "Forgot your password?" links carry `returnTo` along.
**Register** (`POST /api/auth/register`, body `{ firstName, lastName, email, password, returnTo? }`): same-origin → rate limit → validate names (1–60 chars, trimmed), email, `checkPassword` (400 `WEAK_PASSWORD` with `details.failed: RuleId[]`) → `signUp` (customer created with `isEmailVerified` false) → `verifyEmailNow(customer)` (D-031: server creates the email token and confirms it immediately; a customer already verified is skipped) → `signIn` (merge as above) → same 200 shape as login, status 201. Duplicate email → 409 `ACCOUNT_EXISTS`.
**Forgot password** (`POST /api/auth/forgot-password`, body `{ email }`): same-origin → rate limit → if the email is plausible and not over the per-email limit: `createPasswordResetToken(email)` returns the token or `null` → if a token exists and `process.env.DEMO_SHOW_RESET_LINK === 'true'`: respond `{ ok: true, demoLink: '/<locale>/reset-password?token=<token>' }` (**only** then; the link is absolute-path, locale taken from the request body `locale`, validated against `en-US|de-DE`); otherwise `{ ok: true }`. For an unknown email with the flag on, the response has **no** `demoLink` (otherwise existence leaks); the page therefore shows the same "if an account exists" text in both cases and the banner/link only when `demoLink` is present. Honest limitation: with the flag on, the presence of the link reveals existence in this demo mode; this is accepted by D-033 and documented in the banner. With the flag off nothing leaks. The flag defaults to off in production (Y sets it only on the demo deploy, if the owner wants it).
**Verification before recovery** (spec scenario "Verification before recovery"): because all accounts are verified at registration (D-031), an unverified account can only exist if created outside the storefront (Merchant Center, a script). Planner default: such an account is **not blocked**; the reset request behaves exactly as for any account (same generic response; the page text says "You will be able to log in with your new password; your email address is confirmed when you finish"), and `resetPassword` calls `verifyEmailNow` after a successful reset when `isEmailVerified` is false (the reset link proves control in this demo). So the flow states what is required and never fails opaquely.
**Reset password page** (`/reset-password?token=…`, server component): calls `validatePasswordToken(token)`; invalid/expired/consumed/missing → renders the **expired state**: heading "This reset link is no longer usable", an inline email form "Send a new link" on the same page (reuses `ForgotPasswordForm`), no redirect to login. Valid → `ResetPasswordForm` (new password + `PasswordStrength`). `POST /api/auth/reset-password` body `{ token, password }`: same-origin → rate limit → `checkPassword` (400 `WEAK_PASSWORD` **before any commercetools call**, naming the failed rules) → `resetPassword(token, password)` → `markSessionsInvalid(customerId)` (sets `sessionsValidAfter = now`) → clear the caller's session → 200 `{ ok: true, redirectTo: '/<locale>/login?reset=1' }`. The login page shows the notice "Password changed. Log in with your new password." when `reset=1`. The user must log in again (spec).
**Guards** (`lib/auth/guard.ts`): `requireCustomerPage(locale, path)` = `getSession()`; no `customerId` → `redirect('/login?returnTo=' + encodeURIComponent(path))` with the i18n `redirect` (never inside try/catch); otherwise loads the customer (`getCustomerById`, uncached) and rejects (same redirect) if `custom.sessionsValidAfter > session issued-at`; returns `{ session, customer }`. `requireCustomerApi(request)` does the same and throws E's `ApiError 401 UNAUTHENTICATED` (route handlers answer `Cache-Control: no-store`). Every account page (S, T, V) and every `/api/account/*` route calls one of them; there is no layout-level guard (layouts do not re-run on client navigation).

### 6. Password policy (`lib/config/password.ts`, the only definition; imported by the client indicator, the register/reset forms and the server routes)
```ts
export const PASSWORD_POLICY = { minLength: 10, maxLength: 128 } as const;
export type PasswordRuleId = 'min-length' | 'max-length' | 'lowercase' | 'uppercase' | 'digit' | 'not-email';
export interface PasswordCheck { ok: boolean; failed: PasswordRuleId[]; passed: PasswordRuleId[] }
export function checkPassword(password: string, ctx?: { email?: string }): PasswordCheck
// rules: length ≥ 10; length ≤ 128; at least one a–z; at least one A–Z; at least one 0–9; must not contain the part of ctx.email before '@' when that part has ≥ 4 characters (case-insensitive)
```
Messages (namespace `auth.password.rule.*`): `min-length` "Use at least 10 characters." / "Verwenden Sie mindestens 10 Zeichen."; `max-length` "Use at most 128 characters." / "Verwenden Sie höchstens 128 Zeichen."; `lowercase` "Add a lowercase letter." / "Fügen Sie einen Kleinbuchstaben hinzu."; `uppercase` "Add an uppercase letter." / "Fügen Sie einen Großbuchstaben hinzu."; `digit` "Add a number." / "Fügen Sie eine Zahl hinzu."; `not-email` "Do not use your email address in the password." / "Verwenden Sie Ihre E-Mail-Adresse nicht im Passwort." `PasswordStrength` renders the six rules as a list (`aria-live="polite"` summary "n of 5 requirements met"; each row has a visually-hidden "met"/"not met"). The server returns `details.failed` and the form shows the same messages.

### 7. UI (design `design/specs/login.md`, tokens only)
- Page frame: `--color-surface-brand-subtle` band (the `brand-100` band), padding `--space-9` vertical, a centered card `max-width 440px`, `--radius-xl`, 1 px `--color-border`, `--shadow-sm`, padding `--space-9` (40 px), gap `--space-6`. Container for all four pages is the same `AuthCard`.
- Login: H1 "Log in" (Exo 700, `--text-4xl`), sub "Access your plans, contract and bill." (muted, `--text-sm`+). Fields "Email" and "Password": Exo 600 label with `--tracking-ui`, pill input (`--radius-pill`, 1 px `--color-neutral-400` border, padding 14×18 mapped to nearest tokens). **Visible focus is required** (the prototype removed it): `outline: 2px solid var(--color-action); outline-offset: 2px` on `:focus-visible` for inputs, links and buttons. Error line under the password field: `<p id="login-error" role="alert" aria-live="assertive">` with `color: var(--color-danger)` (D-053, defined by C in the extension block), `--text-sm`, reserved `min-height: 1.125rem` so layout does not jump; inputs get `aria-invalid="true"` and `aria-describedby="login-error"` when the error shows. Submit: full-width pill "Log in" (`--color-action`, white text, Inter 800); disabled with a spinner label "Logging in…" while pending. Footer links: "Forgot your password?" → `/forgot-password`, "New to Malva? Create an account" → `/register`. **No** "Demo account is prefilled" note and **no** prefilled values.
- Register: H1 "Create your account", fields First name, Last name, Email, Password (+ `PasswordStrength`), button "Create account", link "Already have an account? Log in". Field errors appear under each field (`aria-describedby`), first invalid field receives focus on submit.
- Forgot: H1 "Reset your password", sub "Enter your email and we will prepare a reset link.", field Email, button "Send reset link". After submit the form is replaced by the confirmation: "If an account exists for that email, a reset link has been prepared." When `demoLink` is present: a notice (role `status`, `--color-surface-brand` background) "Demo mode: email delivery is disabled." and a link "Open the reset link". Link back to Log in.
- Reset: H1 "Choose a new password", field New password + `PasswordStrength`, button "Change password". Expired state as in section 5.
- All copy via `auth.*` keys, both locales.

**Messages (namespace `auth`):**
| Key | en-US | de-DE |
| --- | --- | --- |
| `login.title` | Log in | Anmelden |
| `login.subtitle` | Access your plans, contract and bill. | Zugriff auf Ihre Tarife, Ihren Vertrag und Ihre Rechnung. |
| `login.submit` / `login.pending` | Log in / Logging in… | Anmelden / Anmeldung läuft… |
| `login.error` | Enter a valid email and password. | Geben Sie eine gültige E-Mail-Adresse und ein gültiges Passwort ein. |
| `login.forgot` | Forgot your password? | Passwort vergessen? |
| `login.create` | New to Malva? Create an account | Neu bei Malva? Konto erstellen |
| `login.resetDone` | Password changed. Log in with your new password. | Passwort geändert. Melden Sie sich mit Ihrem neuen Passwort an. |
| `field.email` / `field.password` | Email / Password | E-Mail / Passwort |
| `field.firstName` / `field.lastName` | First name / Last name | Vorname / Nachname |
| `field.newPassword` | New password | Neues Passwort |
| `register.title` / `register.submit` | Create your account / Create account | Konto erstellen / Konto erstellen |
| `register.haveAccount` | Already have an account? Log in | Sie haben bereits ein Konto? Anmelden |
| `register.exists` | An account with this email already exists. Log in or reset your password. | Zu dieser E-Mail-Adresse gibt es bereits ein Konto. Melden Sie sich an oder setzen Sie Ihr Passwort zurück. |
| `forgot.title` | Reset your password | Passwort zurücksetzen |
| `forgot.subtitle` | Enter your email and we will prepare a reset link. | Geben Sie Ihre E-Mail-Adresse ein, wir bereiten einen Link zum Zurücksetzen vor. |
| `forgot.submit` | Send reset link | Link senden |
| `forgot.confirm` | If an account exists for that email, a reset link has been prepared. | Falls zu dieser E-Mail-Adresse ein Konto existiert, wurde ein Link zum Zurücksetzen vorbereitet. |
| `forgot.demoBanner` | Demo mode: email delivery is disabled. | Demomodus: Der E-Mail-Versand ist deaktiviert. |
| `forgot.demoLink` | Open the reset link | Link zum Zurücksetzen öffnen |
| `forgot.unverifiedHint` | You will be able to log in with your new password; your email address is confirmed when you finish. | Mit dem neuen Passwort können Sie sich anmelden; Ihre E-Mail-Adresse wird beim Abschluss bestätigt. |
| `reset.title` / `reset.submit` | Choose a new password / Change password | Neues Passwort wählen / Passwort ändern |
| `reset.expiredTitle` | This reset link is no longer usable | Dieser Link zum Zurücksetzen ist nicht mehr gültig |
| `reset.expiredBody` | Request a new link below. | Fordern Sie unten einen neuen Link an. |
| `reset.sendNew` | Send a new link | Neuen Link senden |
| `rateLimited` | Too many attempts. Try again later. | Zu viele Versuche. Versuchen Sie es später erneut. |
| `mergeNote.removed` | We removed {count} item(s) from your bundle because they cannot be combined: {names}. | Wir haben {count} Artikel aus Ihrem Paket entfernt, weil sie sich nicht kombinieren lassen: {names}. |

### Pitfalls
- `POST /login` also needs the anonymous cart **version-independent**: pass only `{ id, typeId }`; do not send a version.
- Reset pages must not be cached or indexed and must not leak the token via `Referer`; do not echo the token into logs or analytics.
- `redirect()` must not be wrapped in `try/catch` (it throws by design).
- `useSearchParams` is avoided: pages read `searchParams` on the server and pass props (no Suspense needed).
- In-memory rate limiting resets on cold start and is per instance; do not promise more than "best effort" in copy.
- Do not treat a commercetools 404 on `password-token` as an error to the user.
- Locale-aware navigation only from `@/i18n/routing`.
- Email lookup is case-insensitive in commercetools but normalize anyway so the lockout key is stable.

## Tasks
- [x] R-01 Write `lib/config/password.ts` and `lib/config/auth.ts`. Tests: `lib/config/password.test.ts` (each rule passes/fails on a table; max length; not-email with ≥ 4-char local part; `failed` order is stable).
- [x] R-02 Write `lib/auth/email.ts`, `lib/auth/return-target.ts`, `lib/auth/origin.ts`. Tests: `lib/auth/return-target.test.ts` (accepts `/en-US/account`, `/en-US/bundle/checkout`; rejects `//evil.com`, `https://evil.com`, `/\evil.com`, `/en-US/../x`, control characters, unknown first segment, other locale), `lib/auth/origin.test.ts`, `lib/auth/email.test.ts`.
- [x] R-03 Write `lib/auth/rate-limit.ts` and `lib/auth/api.ts` (`clientKey`, 429 helper with `Retry-After`). Tests: `lib/auth/rate-limit.test.ts` (fake timers: 5 failures lock 15 min even for an unknown email, success clears, window expiry, per-IP limits per route from the table).
- [x] R-04 [SKILL: commercetools-platform] Write `lib/ct/customer.ts` (`signIn` incl. retry without the stale anonymous cart, `signUp` with `customerNumber` generator `MV-<5 random digits>-<digit-sum mod 10>` and 3 retries on `customerNumber` duplicates, `verifyEmailNow` idempotent, `createPasswordResetToken` returning `null` for 404, `validatePasswordToken`, `resetPassword`, `getCustomerById`, `markSessionsInvalid`) and `lib/mappers/customer.ts`; append `AccountUser` to `lib/types.ts`. Typed errors `InvalidCredentialsError`, `AccountExistsError`, `InvalidTokenError`. First check the OAS and record differences in `PROJECT-FINDINGS.md`. Tests: `lib/ct/customer.test.ts` (mocked root: exact request bodies from section 2, error mapping, `verifyEmailNow` creates the token then confirms and does nothing when already verified), `lib/mappers/customer.test.ts`.
- [x] R-05 [SKILL: commercetools-storefront] Routes `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` with the merge via M's `reconcileMergedCart`, session write and rotation, rate limiting, padding. Tests: `app/api/auth/login/route.test.ts`, `logout/route.test.ts`, `me/route.test.ts`.
- [x] R-06 [SKILL: commercetools-storefront] Route `POST /api/auth/register` (auto-verify D-031, group `consumer`, duplicate → 409, weak password → 400 with `details.failed`). Tests: `app/api/auth/register/route.test.ts`.
- [x] R-07 [SKILL: commercetools-storefront] Routes `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` (D-033 demo link flag, TTL 60, invalidateOlderTokens, policy check before any commercetools call, `markSessionsInvalid`, verify-on-reset). Tests: `app/api/auth/forgot-password/route.test.ts`, `app/api/auth/reset-password/route.test.ts`.
- [x] R-08 [SKILL: commercetools-platform] Write `lib/auth/guard.ts` and `scripts/seed/customer-fields.ts` (adds `sessionsValidAfter` to `malva-customer`; run it live with OA-03 and record). Tests: `lib/auth/guard.test.ts` (anonymous → redirect with encoded `returnTo`; session issued before `sessionsValidAfter` → redirect; API variant throws 401), `scripts/seed/customer-fields.test.ts`.
- [x] R-09 Components `AuthCard`, `PasswordField`, `PasswordStrength`, `useAuthForm`, `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, hook `useAuthMutations`; messages `auth.*` both locales. Tests: `components/auth/LoginForm.test.tsx`, `RegisterForm.test.tsx`, `ForgotPasswordForm.test.tsx`, `ResetPasswordForm.test.tsx`, `PasswordStrength.test.tsx` (role alert, aria-invalid, aria-describedby, visible focus class present, no prefilled values).
- [x] R-10 Pages `app/[locale]/login`, `register`, `forgot-password`, `reset-password` (metadata noindex/no-referrer, `searchParams` props, expired state). Tests: `app/[locale]/login/page.test.tsx`, `reset-password/page.test.tsx` (mock `validatePasswordToken`).
- [x] R-11 Cart-merge integration test and mergeNotes toast: `hooks/useAuthMutations.test.tsx` (after login the cart cache holds the merged cart; `mergeNotes` produce a toast; nothing is dropped silently).
- [x] R-12 de-DE review, a11y pass, run `npm run verify`, write C-checks results placeholders, STATUS `Ready for review`.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Credentials accepted | `account-sign-in` | `app/api/auth/login/route.test.ts` → "Credentials accepted: issues a session for the customer and returns the merged cart" |
| Unknown and wrong are indistinguishable | `account-sign-in` | `app/api/auth/login/route.test.ts` → "Unknown and wrong are indistinguishable: identical status, body and headers" |
| Buyer bound to another entry point | `account-sign-in` | `app/api/auth/login/route.test.ts` → "Buyer bound to another entry point: a store-bound customer gets the same generic refusal" (reduced: customers are global, D-030) |
| Federated buyer has no local password | `account-sign-in` | Excluded (see below) |
| Sign in carries the anonymous cart | `authentication-and-identity` | `app/api/auth/login/route.test.ts` → "Sign in carries the anonymous cart: sends the session cart as anonymousCart with MergeWithExistingCustomerCart"; `hooks/useAuthMutations.test.tsx` → "Sign in carries the anonymous cart: no items are silently dropped" |
| Failed sign in is ambiguous | `authentication-and-identity` | `components/auth/LoginForm.test.tsx` → "Failed sign in is ambiguous: both failures show the same message in the alert region" |
| Password reset does not confirm the email | `authentication-and-identity` | `app/api/auth/forgot-password/route.test.ts` → "Password reset does not confirm the email: known and unknown addresses get identical responses and no link is returned by email" |
| Verification before recovery | `authentication-and-identity` | `app/api/auth/reset-password/route.test.ts` → "Verification before recovery: an unverified account is not blocked, the reset confirms the email" |
| Token valid address confirmed | `email-verification` | `lib/ct/customer.test.ts` → "Token valid address confirmed: registration creates the email token and confirms it at once" (reduced, D-031) |
| Link opened twice | `email-verification` | `lib/ct/customer.test.ts` → "Link opened twice: verifying an already verified customer does nothing and does not error" (reduced, D-031) |
| Token expired | `email-verification` | Excluded (see below) |
| Resend needs an identified account | `email-verification` | Excluded (see below) |
| Token valid password changed | `password-reset` | `app/api/auth/reset-password/route.test.ts` → "Token valid password changed: password is reset, sessions are invalidated and the user must log in again" |
| Token expired or consumed | `password-reset` | `app/[locale]/reset-password/page.test.tsx` → "Token expired or consumed: the page offers a new link on the same page without redirecting to login" |
| Address with no account | `password-reset` | `app/api/auth/forgot-password/route.test.ts` → "Address with no account: the confirmation is identical, the commercetools 404 is swallowed and the response time is padded" |
| Password fails policy | `password-reset` | `app/api/auth/reset-password/route.test.ts` → "Password fails policy: refused before any commercetools call, naming the failed rules"; `lib/config/password.test.ts` → "Password fails policy: each rule is named" |

## Chrome verification (run by Claude)
Setup note: the checks create customers `chrome-r-<timestamp>@example.com` through the register page (the `@example.com` domain is the cleanup selector for demo reset, D-054). `DEMO_SHOW_RESET_LINK=true` in `site/.env.local` for C-R-6/7.
- C-R-1 (needs OA-02, I): `http://localhost:3000/en-US/login` at 1440 px → centered card (max 440 px) on the honey-tinted band, H1 "Log in", sub "Access your plans, contract and bill.", fields Email/Password empty (not prefilled), no "Demo account" footnote; Tab through: every field, link and the button shows a visible focus outline (take a screenshot with focus on the Email input); console clean; response header `Cache-Control` contains `no-store`; page has `<meta name="robots" content="noindex">`.
- C-R-2 (needs C-R-1): submit the empty form and then `nobody@example.com` / `Wrong-Password-1` → the same message "Enter a valid email and password." appears in an element with `role="alert"` colored with the danger token (`getComputedStyle` color equals `#a1262b`), the password input has `aria-invalid="true"` and `aria-describedby="login-error"`; network: `POST /api/auth/login` → 401 with body `error.code = "INVALID_CREDENTIALS"`; repeat with a registered email and a wrong password (after C-R-3) → byte-identical response body and the same status.
- C-R-3 (needs C-R-1, M): `/en-US/register` → fill First name "Chrome", Last name "Tester", the unique email, password `Aa1-valid-pass-2026`; while typing, the strength list shows each rule turn "met"; submit → redirected to `/en-US/account`; network `POST /api/auth/register` → 201 with `user.email`, the response sets the session cookie (HttpOnly) and no token appears in the body; `read_customers` (commerce MCP) for that email shows `isEmailVerified: true`, `customerGroup` key `consumer`, a `customerNumber` matching `MV-\d{5}-\d`. A second registration with the same email shows "An account with this email already exists. Log in or reset your password." (409 `ACCOUNT_EXISTS`).
- C-R-4 (needs C-R-3): register with password `short1A` → the form shows "Use at least 10 characters." and no network call is made (client check); `evaluate_script` POST `/api/auth/register` with that password → 400 `WEAK_PASSWORD` with `details.failed` containing `min-length`.
- C-R-5 (needs C-R-3, M): as an anonymous visitor add any plan to My bundle, open `/en-US/bundle`, then go to `/en-US/login?returnTo=%2Fen-US%2Fbundle`, log in with the account from C-R-3 → lands on `/en-US/bundle`, the bundle still holds the plan (merged into the customer's cart); `read_carts` shows one active cart for the customer containing the line and `anonymousId` no longer holds a separate active cart; sign-out clears it from the header; `?returnTo=https://evil.com` and `?returnTo=//evil.com` both end on `/en-US/account` after login.
- C-R-6 (needs C-R-3): `/en-US/forgot-password` → enter the account email → confirmation "If an account exists for that email, a reset link has been prepared." plus the banner "Demo mode: email delivery is disabled." and an "Open the reset link" link; `POST /api/auth/forgot-password` → 200 `{ ok: true, demoLink }`; entering `nobody@example.com` shows the **same confirmation text** but no banner/link, status 200; with `DEMO_SHOW_RESET_LINK` unset (restart) neither case shows a link and both responses are identical.
- C-R-7 (needs C-R-6): open the demo link → "Choose a new password"; submit `weak` → "Use at least 10 characters." (no network call); submit `New-Passw0rd-2026` → redirected to `/en-US/login?reset=1` with "Password changed. Log in with your new password."; log in with the old password → generic error; log in with the new one → `/en-US/account`; open the **same link again** → "This reset link is no longer usable" with an inline email form (no redirect), submit it → confirmation shown on the same page; request two links in a row and open the first → unusable (`invalidateOlderTokens`); `read_customers` shows `custom.fields.sessionsValidAfter` set.
- C-R-8 (needs C-R-7): with two browser contexts logged in as the same customer, reset the password in context A; reload `/en-US/account` in context B → redirected to `/en-US/login?returnTo=%2Fen-US%2Faccount` (old session invalidated).
- C-R-9 (needs C-R-1): lockout: via `evaluate_script` send 5 wrong-password POSTs to `/api/auth/login` for `lock-test@example.com` → each 401; the 6th (even with a plausible password) → 429 `RATE_LIMITED` with `Retry-After` between 1 and 900; a different email still gets 401 (not 429); the same behaviour for an email that is registered and one that is not.
- C-R-10 (needs C-R-1): anonymous `http://localhost:3000/en-US/account` → redirected to `/en-US/login?returnTo=%2Fen-US%2Faccount`; after login the user returns to `/en-US/account`.
- C-R-11 (needs C-R-1): at 375 px width `/en-US/login`, `/register`, `/forgot-password`, `/reset-password?token=x` → card fills the width with margins, no horizontal scroll, the keyboard-focused field stays visible, buttons full width; screenshots kept. Lighthouse accessibility ≥ 95 on login and register.
- C-R-12 (needs C-R-1): `/de-DE/login` → "Anmelden", error "Geben Sie eine gültige E-Mail-Adresse und ein gültiges Passwort ein.", links "Passwort vergessen?" and "Neu bei Malva? Konto erstellen"; `/de-DE/forgot-password` confirmation in German; no raw keys.
- C-R-13 (needs C-R-3): `POST /api/auth/login` from a page on another origin is refused: via `evaluate_script` use `fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json',Origin:'https://evil.example'}...})` (browsers forbid setting Origin, so instead run `curl -i -X POST -H 'Origin: https://evil.example' -H 'content-type: application/json' --data '{"email":"a@b.co","password":"x"}' http://localhost:3000/api/auth/login` in a terminal) → 403 `FORBIDDEN`.

## Manual tests (owner only)
None.

## Excluded
- Scenario "Federated buyer has no local password" of `account-sign-in`: no federated/SSO sign-in (D-030: commercetools-owned passwords; D-005). The scenario "Buyer bound to another entry point" is built only in its reduced form (customers are global, D-030; the generic refusal still holds for a hand-made store-bound customer).
- Scenario "Token expired" and scenario "Resend needs an identified account" of `email-verification`: there is no verification email, link or resend path (D-031, no email at all). "Token valid address confirmed" and "Link opened twice" are verified as the reduced auto-verify behaviour. No `/verify-email` page exists.
- `account-registration-request` (company accounts held for activation) is not built (D-031, D-005).
- Real email delivery of verification and reset links: out of scope (D-031, D-033, D-059); replaced by the demo link flag.
- Multi-factor authentication and store-scoped sign-in: not in v1 (D-030, D-058).

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test.
- [ ] C- lines present; STATUS set to `Ready for review`.
- [ ] No password, token or reset link is logged anywhere (grep in tests: a test asserts `console.*` is never called with them).
- [ ] The password policy exists in exactly one module and both client and server import it.
