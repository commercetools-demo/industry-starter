# Workstream J: questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | A duplicate registration must not reveal the address, but without an email provider success and refusal necessarily differ. | Refusal is 409 with one generic text ("We could not create an account with those details. If you already have one, sign in instead."). Duplicates are counted per client (5 per 10 min, bucket = client address, or the email when no address is known) so the endpoint cannot enumerate accounts. |
| 2 | Where does the attempt limit live? | In `lib/ct/identity.ts`, reusing `lib/ct/ratelimit.ts` with a hashed bucket id (`login-<sha256(email\|ip)>`, `register-…`, `password-<customerId>`), so no email or IP is in a Custom Object key. Failures expire after 10 min; a success does not reset the count. |
| 3 | Throttle store outage. | Fails open (logged by class only): an unavailable counter must not take sign-in down. The counter needs `manage_custom_objects` anyway (F-todos). |
| 4 | Client address for buckets. | `x-nf-client-connection-ip`, then `x-real-ip`, then first `x-forwarded-for`; empty when none (sign-in then buckets by email only). |
| 5 | Stale session cart at sign-in/registration (cart deleted, not anonymous). | The call is retried once without `anonymousCart` on a 400/404/409 that is not InvalidCredentials/DuplicateField; the returned (or absent) cart replaces `cartId` in the session. |
| 6 | Auto-verification fails after the customer was created. | The account is kept and the patient signed in; `emailVerified:false` is returned and the failure logged (class and status only). |
| 7 | Verification token lookup for "link opened twice". | `GET /customers/email-token={token}` identifies the account; a verified account answers `already-verified`; a dead token plus a verified signed-in visitor also answers `already-verified`; otherwise `expired`. Unverified against the live API (whether a consumed token still resolves). |
| 8 | Resend delivers nothing (no provider). | `requestFreshVerification` returns the token to its server-side caller only; nothing calls it in the demo and no route exposes it. |
| 9 | `GET /api/auth/me` signed out. | 200 `null` (not 401) so SWR treats it as data. The locale layout now seeds `KEY_ACCOUNT` with `null` for anonymous visitors, so first paint makes no request; `useAccount` has no focus/stale revalidation (sign-in/out write the key). |
| 10 | `/account` does not exist until workstream R. | Sign-in lands on `/account` by default, which 404s until R. No placeholder page was added, to avoid a duplicate-route clash with R. R should build the account area under `app/[locale]/(protected)/`. |
| 11 | I-04 also plans `app/[locale]/(protected)/layout`. | J-09 created it (session check, else `RequireSignInForRoute`, reason derived from the path). Expect an add/add merge conflict with I; keeping either version is fine, J's has a test. |
| 12 | Reason line on `/login`. | Derived from the sanitized `next` path (`lib/sign-in-reason.ts`), nothing extra in the URL. |
| 13 | `getCustomerById` exists in `lib/ct/customers.ts` (G). | `identity.ts` has its own variant (adds email and verified flag); G's was left untouched. |
| 14 | Shared files touched. | `lib/types.ts` (+`AccountUser.email?`), `lib/api-paths.ts` (+5 constants), `messages/en-US.json` (+`auth` namespace), `hooks/use-account.ts` (real fetcher), `app/[locale]/layout.tsx` (anonymous seed). No dependencies added. |
