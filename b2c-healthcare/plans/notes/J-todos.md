# Workstream J: live checks (BLOCKED on OA-02/OA-03: no commercetools credentials or seeded project)

All commands from `b2c-healthcare/site` with `.env.local` filled; `npm run dev`. The client needs scopes for customers (`manage_customers`), carts, custom objects (`malva-ratelimit`) and the `mlv-patient` Type must exist (workstream E seed).

1. Register: `/en-US/login`, "Create an account", fresh `name@example.com`, 10+ character password. Expect a redirect to `/en-US/account` (404 until R) and the toast "Your account is ready...". In the MC (or `read_customers`): the customer has `isEmailVerified: true`, `custom.fields.patientRef` matching `pt_[a-z0-9]{8}`, no `fundingScheme`, and no password or hash visible.
2. Cookie: DevTools, Application, Cookies: `malva_session` HttpOnly, SameSite=Lax, (Secure outside dev). Decode the payload (middle JWT segment, base64url) in node: only `customerId`, `cartId`, `locale`, `country`, `currency`, no name or email.
3. Header: after sign-in the avatar shows initials; "Sign out" has no UI until R, so run `fetch('/api/auth/logout',{method:'POST'})` and reload: header shows Sign in; cart/account keys cleared.
4. Ambiguity: sign in as `sam.rivera@example.com` with a wrong password and as an unknown address. Same text, same 401, similar timing (note both in `PROJECT-FINDINGS.md` if the platform answers differently).
5. Lockout: 5 wrong attempts for one email, the 6th answers 429 with `Retry-After`, even with the right password; `read_custom_objects` container `malva-ratelimit` has a key `rl-login-<32 hex>` (no email or IP in it). Another email is unaffected.
6. Cart merge: as an anonymous visitor add a line (needs workstream O), sign in as Sam: the lines survive. Check that the platform accepts `anonymousCart` for the session cart (it must have an `anonymousId`/be anonymous) and `anonymousCartSignInMode`; if the cart workstream creates carts without `anonymousId`, confirm merge still works.
7. Registration with `anonymousCart`: same, the cart becomes the new customer's cart.
8. Duplicate: register `sam.rivera@example.com`: 409 with the generic text; five times from one client then 429.
9. `/en-US/login?next=//evil.com` and `?next=https://evil.com`: after sign-in lands on `/account`. A signed-in visitor opening `/en-US/login` is redirected to `/account`.
10. Verification token functions (script or REPL): confirm that `GET /customers/email-token=<token>` works for a fresh token, and what a consumed or expired token returns (400 vs 404); adjust `confirmEmail` (J-questions 7) if needed.
11. Password change: `fetch('/api/account/password', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({currentPassword:'...', newPassword:'...'})})` while signed in; a wrong current password answers 400 "Your current password is not correct."; then sign in with the new one.

Browser check done without credentials (`PORT=3106 npm run dev`, placeholder env, killed afterwards): `/en-US/login?next=/en-US/cart` renders the 440 px card with the reason line "Sign in to view your cart.", Email/Password, "Sign in", "Create an account", no console errors or warnings; an empty submit shows both field errors and focuses Email; `?next=//evil.com` renders normally. Not done: screenshot comparison with the prototype (SO-03 owner sign-off), create-mode look, mobile width.
