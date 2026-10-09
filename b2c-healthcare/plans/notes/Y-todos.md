# Workstream Y: owner / follow-up steps

Y-05 is NOT done and not ticked: it needs OA-06 (Netlify account and site).

## Deployment steps (owner, after OA-06)
1. Netlify > Add new site > Import from Git. Base directory `b2c-healthcare/site`; build command, Node 22 and functions directory come from `site/netlify.toml` (`npm run verify:build`). Do not set a publish directory by hand.
2. Site configuration > Environment variables (Production); names and notes in `site/docs/deploy.md` section 2:
   `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET` (secret), `CTP_SCOPES` (from `.env.example`; Frontend client, no `manage_project`, no `manage_my_*`), `SESSION_SECRET` (secret, `openssl rand -base64 48`), `CTP_CHECKOUT_APP_KEY`, `SITE_URL`, `AUTO_REFILL_ENABLED` (optional), `AUTO_REFILL_RUN_SECRET`, `RELOAD_ALLOWANCES_SECRET`, `RETENTION_SECRET` (secrets, 16+ chars, `openssl rand -base64 32`, three different values).
   Must NOT be set: `MALVA_FIXTURES`, `SAME_DAY_NOW_OVERRIDE`, `RESOLVER_FORCE_FAIL`, `MALVA_RELEASE_BUILD`, any `SEED_*`, `PEXELS_CLIENT_ID`, any admin credential.
3. Deploy Previews context: the same dev project (synthetic data only) with its own secret values.
4. Trigger the first deploy. The log must show the prune line (`removed app/api/health, ...`), `bundle scan: ok` and `health check guard: ok`. Functions tab lists `auto-refill-run`, `reload-allowances`, `reload-allowances-scheduled`, `retention`, `retention-scheduled`; the three crons are 0 5 * * *, 10 0 1 * *, 30 3 * * *.
5. Make sure the storefront API client has the scopes the functions need (see Y-missed on `manage_key_value_documents`).
6. Seed and verify the project from a developer machine (never CI): `npm run seed`, `npm run seed:verify`.
7. Record the URL in `plans/STATUS.md` and tick Y-05.

## Post-deploy smoke checklist (`<url>` = deployed origin)
1. `<url>/` redirects to `/en-US`; home renders without console errors.
2. `curl -I <url>/en-US`: has `content-security-policy`, `x-content-type-options: nosniff`, `referrer-policy: same-origin`, `x-frame-options: DENY`, `strict-transport-security`; no `x-powered-by`.
3. `curl -i <url>/api/health` is 404 (route absent); `<url>/en-US/_tokens` and `/en-US/_boom` are 404.
4. `curl -i <url>/api/account/overview` answers 401 with `cache-control: no-store`; `/en-US/account` is `no-store` too.
5. Sign in as Sam (seed account): works; the session cookie has `Secure` and `HttpOnly`; header shows initials.
6. Book a doctor, add an Rx item, checkout: the Checkout widget loads under the CSP with no CSP violations in the console; place the order; the confirmation shows.
7. Guards: `curl -i -X POST <url>/api/internal/auto-refill-run` is 401; `curl -i -X POST <url>/.netlify/functions/reload-allowances` is 401; the same for `/.netlify/functions/retention` (503 means the secret is missing or under 16 characters). No body names an id or a patient.
8. With the real secret (never in chat) invoke `retention` once by hand (X-todos item 5): counts come back; a second run reports zero changes.
9. View source and `_next/static` chunks: no `CTP_`, no secret value, no `.map` files.
10. Netlify Functions logs after the first scheduled runs: 200/204 for each, no health data in any log line.

## Other follow-ups
- Check the CSP against the real Checkout widget and Stripe sandbox (OA-04); adjust `netlify.toml` and `netlify.test.ts` if a host is missing.
- Decide whether to keep schedules in both toml and function config (Y-questions 3).
