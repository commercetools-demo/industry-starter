# Workstream D: todos and blocked live checks

## D-08 BLOCKED on OA-02 (Frontend API client) and OA-03 (session secret)

No credentials exist in this environment, so the live check was not run and D-08 is NOT ticked. The route (`app/api/health/route.ts`, via `lib/ct/health.ts`) is implemented and unit-tested with a mock. Steps for someone with credentials:

1. Owner completes OA-02 and OA-03; copy `site/.env.example` to `site/.env.local` and fill in `CTP_PROJECT_KEY` (`spec-test-b2c-healthcare`), `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES` (space-separated `scope:<project-key>`), `SESSION_SECRET` (`openssl rand -base64 48`). Never paste these in chat, PRs or logs.
2. `cd site && PORT=3000 npm run dev`. Server start must succeed (instrumentation validates the CTP_* variables).
3. `curl -i localhost:3000/api/health` expects HTTP 200 and `{"ok":true,"projectKey":"spec-test-b2c-healthcare"}`. Record the output in the PR.
4. Negative checks: blank `CTP_CLIENT_SECRET` and restart: server start fails with a message naming `CTP_CLIENT_SECRET`. Wrong secret: `/api/health` returns 500 `{"ok":false}` with no detail.
5. Production check: `NODE_ENV=production` build requires removing `app/api/health/` first (see D-questions.md Q1); in a build that kept it, `curl -i localhost:3000/api/health` returns 404.
6. Grep the dev-server output for the secret values: there must be none (definition of done).
7. Tamper check: edit one character of the `malva_session` cookie and reload a page: it renders anonymously, no error.
8. Confirm the real scopes of the API client against `.env.example` (see D-questions.md Q2).

Scenario "Valid credentials" stays unticked until step 3 is done.

## Deferred for workstream C (needs `lib/utils.ts`)

- D-05 asked for a mapper test asserting use of `getLocalizedString(field, locale)` and `formatMoney(centAmount, currencyCode, locale)` from `lib/utils.ts`. Skipped because C owns `lib/utils.ts`. Once it exists: add a test in `lib/mappers/index.test.ts` that imports both helpers and asserts e.g. `getLocalizedString(mapLocalizedString({'en-US':'x'}), 'en-US') === 'x'` and `formatMoney(1999,'USD','en-US')` yields `$19.99`, then tick the scenario "Localized strings and money" (currently marked N/A in the workstream file).
- The mapper skeleton deliberately does not call either helper (the lookup happens at render time).

## Other

- `lib/session.ts` write helpers only work where cookies are writable (Route Handlers, Server Actions); Server Components must only call `getSession()`.
- Release pipeline step that deletes `app/api/health/` before `next build` is not created (deploy is out of scope here).
