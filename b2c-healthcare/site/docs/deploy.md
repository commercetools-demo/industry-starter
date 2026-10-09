<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Deploying the storefront to Netlify (workstream Y, D-030)

Names only: no value is ever written in this file, in git, in a PR or in chat. Values are set in the Netlify UI
(Site configuration > Environment variables) by the owner (OA-06). `netlify.test.ts` and `docs/deploy.test.ts` fail when this
file, `netlify.toml` or the code drift apart.

## 1. What is deployed

- One Netlify site, **Base directory** `b2c-healthcare/site` (set in the UI, as the sibling projects do), Next.js runtime (the
  Netlify Next adapter is detected automatically; no plugin line is needed).
- **Build command** `npm run verify:build` (from `netlify.toml`): type-check, lint, design lint, version gate, token parity,
  every unit test, then a release build and the production-build checks (section 4). A failure fails the deploy. Node 22.
- Three scheduled functions (`netlify/functions/`, crons in UTC, also declared in `netlify.toml`):

| Function | Cron | Does | Secret |
| --- | --- | --- | --- |
| `auto-refill-run` | `0 5 * * *` | daily auto-refill check; POSTs to `/api/internal/auto-refill-run` | `AUTO_REFILL_RUN_SECRET` in header `x-refill-secret` |
| `reload-allowances-scheduled` | `10 0 1 * *` | monthly allowance reload; calls `/.netlify/functions/reload-allowances` | `RELOAD_ALLOWANCES_SECRET` in header `x-malva-reload-secret` |
| `retention-scheduled` | `30 3 * * *` | daily retention run; calls `/.netlify/functions/retention` | `RETENTION_SECRET` in header `x-malva-retention-secret` |

  Every endpoint that does work answers 503 without its configured secret (or with one under 16 characters), 401 without the
  matching header, and 405 to anything but POST. The guards are tested in `netlify/functions/guards.test.ts`.

## 2. Environment variables (names)

Set every **required** variable for the Production context. All are server-only: never add a `NEXT_PUBLIC_` prefix. Mark the
secret ones "Contains secret values" (Netlify then hides them and, with the secrets scanner, fails a build that leaks one).

| Name | Required | Secret | Notes |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | yes | no | commercetools project key |
| `CTP_AUTH_URL` | yes | no | region auth host |
| `CTP_API_URL` | yes | no | region API host |
| `CTP_CLIENT_ID` | yes | no | the **Frontend** API client (never the seed admin client) |
| `CTP_CLIENT_SECRET` | yes | **yes** | the Frontend API client secret |
| `CTP_SCOPES` | yes | no | space-separated `scope:<project-key>`, least privilege (`.env.example` lists each with its reason); never `manage_project`, never `manage_my_*` |
| `SESSION_SECRET` | yes | **yes** | 32+ random characters (`openssl rand -base64 48`) |
| `CTP_CHECKOUT_APP_KEY` | yes | no | key of the commercetools Checkout Application (OA-04); without it no order can be placed |
| `SITE_URL` | yes | no | public origin (canonical URLs, sitemap, robots), e.g. the production URL |
| `AUTO_REFILL_ENABLED` | optional | no | `true` shows the auto-refill claims; only where the recurring-order scopes and the daily check exist |
| `AUTO_REFILL_RUN_SECRET` | yes | **yes** | 16+ characters; the same value for the app and the function |
| `RELOAD_ALLOWANCES_SECRET` | yes | **yes** | 16+ characters |
| `RETENTION_SECRET` | yes | **yes** | 16+ characters |
| `DOCTOR_PAGE_SIZE` | no | no | testing only; leave unset (default 9) |
| `URL` | provided | no | set by Netlify (the site's primary URL); the scheduled functions use it |
| `NETLIFY` | provided | no | set by Netlify to `true`; makes the build a release build (section 4) |
| `NEXT_RUNTIME` | provided | no | set by Next (`nodejs` or `edge`); read by `instrumentation.ts`; never set by hand |
| `NODE_ENV` | provided | no | set to `production` by `next build`/`next start`; never set by hand |

**Never set in production** (development or script switches; the code ignores some of them in production, but they must not be
present): `MALVA_FIXTURES`, `SAME_DAY_NOW_OVERRIDE`, `RESOLVER_FORCE_FAIL`, `MALVA_RELEASE_BUILD`.

**Scripts only, never on Netlify** (loaded from `.env.seed.local` or the shell on a developer machine): `SEED_CTP_PROJECT_KEY`,
`SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES`,
`SEED_PATIENT_PASSWORD`, `PEXELS_CLIENT_ID`. The seed admin credentials must never be a Netlify variable.

Deploy previews: use the same (development) commercetools project, which holds synthetic data only; never point a preview at real
data. Set the secrets for the "Deploy Previews" context to their own values (not the production ones).

## 3. Steps (owner, needs OA-06; see also `plans/notes/Y-todos.md`)

1. Netlify: Add new site > Import from Git; Base directory `b2c-healthcare/site`; build command and Node version come from
   `netlify.toml`.
2. Add the variables of section 2 (Production context). Generate secrets with `openssl rand -base64 32` (48 for the session).
3. Deploy. The build runs `npm run verify:build`; read the log for `bundle scan: ok`.
4. Set `SITE_URL` to the final origin and redeploy if it was unknown at first.
5. Smoke-check the deployed URL (checklist in `plans/notes/Y-todos.md`), then record the URL in `plans/STATUS.md`.

## 4. Production-build checks (`scripts/check-bundle.mjs`, `scripts/prune-dev-routes.mjs`)

- On Netlify (`NETLIFY=true`) the build first deletes the development-only routes `app/api/health`, `app/[locale]/_tokens`
  and `app/[locale]/_boom`, so they are absent from the build (not only answering 404). The delete is destructive to the
  working tree and runs only when `NETLIFY=true` or `MALVA_RELEASE_BUILD=1`; use a throw-away clone for the latter.
- After the build: no secret variable name or value in `.next/static` or `.next/server`, no source map in the public bundle,
  and (release build) no compiled health/`_tokens`/`_boom` route. `check-no-health-in-release.mjs` guards the health route source.
- Response headers come from `netlify.toml`: CSP (Stripe, commercetools Checkout, Pexels images), `X-Content-Type-Options`,
  `Referrer-Policy: same-origin`, `X-Frame-Options`, HSTS, and `Cache-Control: no-store` for `/api/account/*` and
  `/<locale>/account/*`; `/<locale>/prescriptions` is `private, no-store`. `x-powered-by` is disabled in `next.config.ts`.

## 5. Rotating a secret

1. Generate the new value (`openssl rand -base64 32`).
2. `CTP_CLIENT_SECRET`: create a new secret for the Frontend API client in the Merchant Center (or a new client), set the new
   value in Netlify, redeploy, then delete the old client. `SESSION_SECRET`: setting a new value signs every patient out (the old
   cookies stop verifying); do it in a quiet hour.
3. `AUTO_REFILL_RUN_SECRET`, `RELOAD_ALLOWANCES_SECRET`, `RETENTION_SECRET`: change the value in Netlify and redeploy; the app
   and the function read the same variable, so they change together. Between the change and the redeploy the next scheduled run may
   answer 401; the runs are idempotent and the next one succeeds.
4. Never paste the value in chat, a ticket or a log. If one was exposed, treat it as rotated immediately.

## 6. Running the seeds against the project

Seeds are never run from CI or from the Netlify build. From a developer machine, in `site/`, with `.env.seed.local` filled
(copy `.env.seed.example`; the admin client, not the storefront one): follow `scripts/seed/README.md` (`npm run seed`, `seed:verify`,
...). The scripts refuse any project key other than `spec-test-b2c-healthcare`, support `--dry-run`, and touch only keys with the
`mlv-` prefix. Run `npm run seed:verify` after a seed, and `npm run privacy:audit` to check that no clinical fixture string
reached commerce data.
