<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Deploying to Netlify (runbook)

For the owner. Hosting is Netlify (D-038, owner row OA-05). Claude did **not** deploy and did not remove the dev routes: this runbook says what to remove, when, and which variable names to set. It lists **names only**. Values go into Netlify's environment settings and, for the dry run, into a local untracked `storefront/.env.production`; never into chat, git or an evidence file.

The deploy itself is done with the command `/commercetools:nextjs-deploy-netlify`, which checks the commercetools credentials and then hands over to Netlify's own agent skill (`netlify-deploy`, from `netlify/context-and-tools`). Read the two notes in section 4 first: the command was written for another folder layout.

## 1. What the repository already has

| Item | Value | Where |
| --- | --- | --- |
| Netlify configuration | base directory `b2c-foodservice/storefront` (relative to the repository root), build command `npm run build`, publish `.next`, `NODE_VERSION = "22"` | `netlify.toml` (repository root of the project) |
| Node version file | `22` | `storefront/.nvmrc` |
| Other hosts | none: no `vercel.json` (a test fails if one appears) | `storefront/scripts/release-config.test.ts` |
| Security headers, CSP, HSTS | set by the app for every route | `storefront/next.config.ts`, `storefront/lib/security-headers.ts` |
| Deploy gate | `npm run predeploy` | `storefront/scripts/predeploy-check.mjs` |
| Bundle secret scan | `npm run verify:build` (build, then scan the browser output for secret values) | `storefront/scripts/check-bundle-secrets.mjs` |
| Start-up check | the server exits with code 1 and a message naming the variable when the environment is wrong | `storefront/instrumentation.ts` |

## 2. Before you start (owner rows)

Do these first; each row is in `plans/TODO-MANUAL-TESTING.md` and listed in order in `plans/OWNER-HANDOFF.md`.

| Row | What | Why it blocks the deploy |
| --- | --- | --- |
| OA-05 | Create the Netlify site and connect the repository | there is nothing to deploy to |
| OA-N-Q1 | Production storefront API client (Frontend, non-admin) and a `SESSION_SECRET` | the site cannot start without them |
| OA-04, OA-K-a, OA-K-g | Checkout Application (Complete Checkout) with the Stripe connector, and its key in `CTP_CHECKOUT_APP_KEY` | the pay step answers "service unavailable" without it |
| M-Q-08 | Confirm the origins of the hosted Checkout for the policy (first run with `CSP_REPORT_ONLY=true`) | an enforced policy that misses an origin blocks the pay widget |
| SO-Q2 | Decide the demo accounts (keep or rotate the shared password) | the sign-in dropdown goes public with the site |
| OA-P1 | Where contact messages go | without it the contact form says "not sent" |
| OA-M-a | Second API client for review writes | without it reviews can be read but not written |
| OA-02 | Scopes `manage_recurring_orders`, `view_recurrence_policies` on the storefront client | subscriptions need them (the gate checks both) |

## 3. Remove the dev routes (when and what)

The routes below exist for the hand tests and for the mock server journeys, so Q left them in the repository on purpose. **`npm run predeploy` fails while they exist.** Delete them in one commit (for example `deploy: remove dev routes`) **after** the owner has finished the hand tests and **before** the deploy. The gate prints exactly these lines:

```
predeploy: Remove app/api/health/route.ts before deploying
predeploy: Remove app/api/dev before deploying
predeploy: Remove app/[locale]/dev (the design kitchen sink) before deploying
```

| Path | What it is | Delete with it |
| --- | --- | --- |
| `storefront/app/api/health/route.ts` | health route; it is not guarded in production and returns the project key | `route.test.ts` next to it |
| `storefront/app/api/dev/` | `session/route.ts`, a test helper that writes a session | its test |
| `storefront/app/[locale]/dev/` | `design/` (component kitchen sink) and `store-picker/` (picker harness) | their tests (`design/page.test.tsx` and the picker's) |

After deleting, run `npm run check`; a test or import that still names a deleted route will say so. Keep `storefront/scripts/mock-ct-server.mjs`, `storefront/scripts/dev/` and the mock documentation: they are local aids, nothing in `app/`, `lib/` or `components/` may import them (the gate checks that too), and Netlify never runs them. The sample-data cleanup of the commercetools project is a different thing (OA-07).

## 4. How the deploy command and this project differ

1. The command looks for `site/.env` and `site/app/api/health/route.ts`. In this project the app is in `storefront/`, the local file is `storefront/.env.local` and the dry-run file is `storefront/.env.production`. Do not copy `.env.local` to `site/`: tell the command the folder, or set the variables by hand in Netlify (section 5).
2. The command prints an example scope list. **Use the list in `storefront/.env.example`**, not the example: this storefront also needs `manage_recurring_orders`, `view_recurrence_policies`, `manage_payment_methods` and `view_payment_methods`, and does not use `manage_order_edits`. Never set a client that holds `manage_project` or any other admin scope (the gate fails on the admin scopes it knows).
3. The admin client of the seed (`seed/.env`, the `SEED_*` names) must never be set on Netlify.

## 5. Environment variables (names only)

Set them in Netlify under Site configuration, Environment variables. Scope **Builds and Functions** (the build reads the project settings, the server reads them at run time). Mark every row marked secret as secret.

| Name | Required | Secret | Notes |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | yes | no | commercetools project key |
| `EXPECTED_PROJECT_KEY` | yes | no | must equal `CTP_PROJECT_KEY`; the server refuses to start otherwise (the guard against deploying to the wrong project) |
| `CTP_AUTH_URL` | yes | no | region auth URL, `https://` |
| `CTP_API_URL` | yes | no | region API URL, `https://` |
| `CTP_CLIENT_ID` | yes | yes | the Frontend API client |
| `CTP_CLIENT_SECRET` | yes | yes | the Frontend API client |
| `CTP_SCOPES` | yes | no | the scopes of `.env.example`, each as `<scope>:<project key>`; no admin scope |
| `SESSION_SECRET` | yes | yes | at least 32 random characters, different per environment (`openssl rand -base64 48`); changing it signs every shopper out |
| `NEXT_PUBLIC_SITE_URL` | yes | no | the public origin, for example `https://shop.example.com`; sitemap, `robots.txt` and canonical links use it. The only `NEXT_PUBLIC_` name |
| `CTP_CHECKOUT_APP_KEY` | yes | no | key of the Checkout Application (OA-K-a) |
| `DEMO_LOGIN_ENABLED` | demo only | no | `true` only on a demo deployment (D-040); empty or `false` otherwise (the demo sign-in then answers 404) |
| `DEMO_LOGIN_PASSWORD` | with the demo sign-in | yes | the shared password of the seeded customers; the seed's `SEED_DEMO_PASSWORD` holds the same value |
| `CONTACT_WEBHOOK_URL` | for the contact form | yes | `https://` receiver (OA-P1); empty: the form reports "not sent" |
| `CONTACT_WEBHOOK_TOKEN` | optional | yes | bearer token for that receiver |
| `FEEDBACK_WEBHOOK_URL` | optional | yes | receiver of FAQ helpful votes; empty: one log line per vote |
| `CTP_REVIEWS_CLIENT_ID` | for review writes | yes | second client, scope `manage_products` only (OA-M-a) |
| `CTP_REVIEWS_CLIENT_SECRET` | for review writes | yes | second client |
| `CTP_REVIEWS_SCOPES` | optional | no | default `manage_products:<project key>`; the gate fails if it holds anything else |
| `CSP_REPORT_ONLY` | optional | no | `true` sends the Content-Security-Policy as report-only for the first live run (M-Q-08); empty: enforced |
| `CTP_SESSION_URL` | **never** | no | for the local mock only; the gate fails when it is set, because it would send the payment-session token to another host |

Set by Netlify itself and read by the app: `URL` and `DEPLOY_PRIME_URL` (fallback for the site origin when `NEXT_PUBLIC_SITE_URL` is empty), `NODE_ENV=production`. `NODE_VERSION` comes from `netlify.toml`.

If a build fails on Netlify's secret scan (a value found in the output), check first that `npm run verify:build` passes locally; the scan list is in `check-bundle-secrets.mjs`. A public, non-secret value such as the site origin may be listed in Netlify's `SECRETS_SCAN_OMIT_KEYS` (see Netlify's documentation); never omit a secret.

## 6. Steps

1. **Local preflight** in `storefront/` with Node 22: `npm ci`, `npm run check`, `npm run verify:build`. All pass.
2. **Remove the dev routes** (section 3), commit, run `npm run check` again.
3. **Dry run of the gate** with the production values in an untracked `storefront/.env.production` (the gate reads that file and the shell; it prints names, lengths and keys, never values): `npm run predeploy`. It must print `predeploy: ok`. It checks: the three dev paths are gone, no folder named `debug` or `test` under `app/`, no tracked `.env` file except `.env.example`, no import of `scripts/dev`, `.nvmrc` pins 22, every required variable is set, `SESSION_SECRET` has 32 characters or more and is not a sample, the two project keys are equal, `manage_recurring_orders` and `view_recurrence_policies` are in the scopes and no admin scope is, no secret-named `NEXT_PUBLIC_` variable, `CTP_SESSION_URL` is empty, the webhook URLs are `https://`, the reviews client holds `manage_products` only. Then delete `.env.production` or keep it untracked.
4. **Run `/commercetools:nextjs-deploy-netlify`** and follow section 4. It hands over to Netlify's `netlify-deploy` skill for site linking, variables and the deploy.
5. **Deploy a preview first** (Q-Q-14): a deploy preview or a branch deploy, with `CSP_REPORT_ONLY=true` for the first run. Walk journey J1 on it with the test card and read the console for policy reports (M-Q-08). Fix the policy, switch `CSP_REPORT_ONLY` off, repeat.
6. **Deploy production** and tell Claude the URL: it runs the post-deploy smoke of `plans/RELEASE-CHECKLIST.md` section E and writes `plans/evidence/Q/deployed/` (task Q-17).

## 7. Settings to check on Netlify

| Setting | Value | Why |
| --- | --- | --- |
| Base directory, build command, publish directory | `storefront`, `npm run build`, `.next` (from `netlify.toml`) | the project root is not the app |
| Node | 22 | `netlify.toml` and `.nvmrc` |
| Functions region | near the region of the commercetools API (the region is in `CTP_API_URL`) | every page waits for commercetools; a far region adds a round trip per call |
| Rate limiting rule | a host rule on `/api/auth/*`, `/api/contact` and `/api/newsletter` (Q-Q-7) | the app's own limiter is in memory and per instance |
| Header from the visitor address | the host overwrites `x-forwarded-for` (or `x-real-ip`) | the limiter reads the first value of `x-forwarded-for`; a client-supplied value would let a caller rotate it (security.md H2) |
| HTTPS and HSTS | HTTPS only; the app sends `Strict-Transport-Security: max-age=31536000` | cookies are `Secure` in production |
| Custom domain | set `NEXT_PUBLIC_SITE_URL` to the final origin, redeploy | canonical links and the sitemap |

## 8. Rollback

1. **Code:** Netlify keeps every deploy. In Deploys, open the previous good deploy and choose Publish deploy. No data change is involved.
2. **Environment variables:** a changed variable applies from the next deploy; restore the old value and redeploy (or trigger a deploy of the previous commit).
3. **commercetools data:** the seed is idempotent and additive (`npm run seed` twice gives `0 change(s)`); nothing in a deploy changes project data. Test records are removed by `seed:cleanup-tests` (M-Q-04), orders cannot be deleted.
4. **Sessions:** rotating `SESSION_SECRET` signs every shopper out; bags stay in commercetools and come back at the next sign-in.

## 9. If something is wrong after the deploy

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| The function log shows one line naming a variable and the deploy answers 5xx everywhere | a required variable is missing, `SESSION_SECRET` is short, or the two project keys differ | fix the variable named in the log; values are never printed |
| Pages load but prices and products are missing | wrong region URL, wrong scopes, or the project is not seeded (OA-01) | compare `CTP_API_URL`, `CTP_AUTH_URL` and `CTP_SCOPES` with `.env.example`; run the data sweep (`plans/evidence/Q/data-sweep.md`) |
| The pay step says the service is unavailable | `CTP_CHECKOUT_APP_KEY` empty or the Checkout Application is not set (OA-K-a) | set it, redeploy |
| The pay widget is blank and the console shows policy errors | an origin of the hosted Checkout is not in the policy | M-Q-08: report-only first, then add the origins |
| Contact form says "not sent" | `CONTACT_WEBHOOK_URL` empty or the receiver refuses (OA-P1) | check the receiver; the message is kept in the form |
| Review form says "service unavailable" | the second client is not set (OA-M-a) | set `CTP_REVIEWS_CLIENT_ID` and `CTP_REVIEWS_CLIENT_SECRET` |
| `/api/health` answers 200 | the dev routes were not removed | section 3; the gate would have failed |
