<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Secrets inventory, bundle guard and logging review (Q-10, Q-13; S2, S3, S11)

Written 2026-10-22 by workstream Q at commit `70f34305` (branch `ws/q-quality`). **Names only.** No value was read, printed or copied. I did not open `storefront/.env.local` or `seed/.env`. The names come from `storefront/.env.example`, `seed/.env.example` and a grep for `process.env` in the application code.

## 1. Result in one table

| Check | Result |
| --- | --- |
| Every secret name of the storefront and the seed is listed below with the files that read it | done (19 + 5 storefront names, 9 seed names) |
| Any secret name starts with `NEXT_PUBLIC_` | **no.** The only `NEXT_PUBLIC_` name is `NEXT_PUBLIC_SITE_URL`, the public site origin (not a secret) |
| `.env.example` files hold values | **no** (0 lines with a value in either file; `check-secrets.mjs` enforces it) |
| A secret name appears in the client build output | **no.** I searched the 67 files of `.next/static` (production build of 2026-10-22 11:47) for the 10 secret variable names: no hit |
| `node scripts/check-secrets.mjs` (in `storefront`) | `secret check: ok`, exit 0 |
| `node scripts/check-versions.mjs` (in `storefront`) | `version gate: ok`, exit 0 |
| Logging grep of `storefront/app`, `lib`, `components`, `hooks`, `context` | 20 `console.*` statements in 17 files, all one-line JSON with ids and counts, none with a secret, token, email, cookie, authorization header or session value (section 5) |
| Secret value scan of the build (`node scripts/check-bundle-secrets.mjs`) | **not run by me**: the script loads `.env.local`, which I must not read. Its 6 unit tests pass. `npm run verify:build` runs it after `next build` (`package.json`). The lead runs it with the real values |

## 2. Storefront names (`storefront/.env.example`, 19 names)

"Read in" lists files only. "Class": **secret** = a leak is a security event, **setting** = identifier or URL, not secret, **toggle** = switch.

| Name | Class | Read in | If it leaked |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | setting | `lib/env.ts`, `lib/ct/client.ts`, `lib/ct/review-client.ts`, `lib/ct/checkout-session.ts` | nothing (a project key is not secret) |
| `EXPECTED_PROJECT_KEY` | setting | `lib/env.ts`, `app/api/health/route.ts` (deleted by Q-15) | nothing |
| `CTP_AUTH_URL` | setting | `lib/env.ts`, `lib/ct/client.ts`, `lib/ct/review-client.ts`, `lib/ct/checkout-session.ts` | nothing |
| `CTP_API_URL` | setting | `lib/env.ts`, `lib/ct/client.ts`, `lib/ct/review-client.ts`, `lib/ct/checkout-session.ts` | nothing |
| `CTP_CLIENT_ID` | secret | `lib/env.ts`, `lib/ct/client.ts`, `lib/ct/checkout-session.ts` | with the secret: read and write customers, orders, carts, sessions, lists, payment methods, recurring orders of the project |
| `CTP_CLIENT_SECRET` | secret | `lib/env.ts`, `lib/ct/client.ts`, `lib/ct/checkout-session.ts` | same |
| `CTP_SCOPES` | setting | `lib/env.ts`, `lib/ct/client.ts` | reveals the privilege list only. `predeploy-check.mjs` fails on an admin scope |
| `SESSION_SECRET` | secret (highest) | `lib/env.ts`, `lib/session.ts`, `lib/session-reconcile.ts` (proxy) | forge a session for any customer id: account takeover for every customer. Rotate: every session becomes empty (shoppers sign in again) |
| `DEMO_LOGIN_ENABLED` | toggle | `lib/auth/demo-customers.ts` | nothing by itself |
| `DEMO_LOGIN_PASSWORD` | secret | `lib/auth/demo-customers.ts` | sign in as the six demo customers. Same value as `SEED_DEMO_PASSWORD` |
| `NEXT_PUBLIC_SITE_URL` | public by design | `lib/content/seo.ts` | nothing (it is printed in canonical links and the sitemap) |
| `CONTACT_WEBHOOK_URL` | secret (URL may hold a token) | `lib/contact/forward.ts` | post enquiries into the helpdesk channel |
| `CONTACT_WEBHOOK_TOKEN` | secret | `lib/contact/forward.ts` | same |
| `FEEDBACK_WEBHOOK_URL` | secret (URL may hold a token) | `app/api/faq-feedback/route.ts` | post fake FAQ votes |
| `CTP_REVIEWS_CLIENT_ID` | secret | `lib/ct/review-client.ts` | with the secret: scope `manage_products` by default, so it can change the catalogue (D-027 isolates it for review writes only) |
| `CTP_REVIEWS_CLIENT_SECRET` | secret (second highest) | `lib/ct/review-client.ts` | same |
| `CTP_REVIEWS_SCOPES` | setting | `lib/ct/review-client.ts` | nothing. Not checked by `predeploy-check.mjs` |
| `CTP_CHECKOUT_APP_KEY` | setting (the comment says "Not secret") | `lib/ct/checkout-session.ts` | nothing |
| `CTP_SESSION_URL` | setting, **local mock only** | `lib/ct/checkout-session.ts` | if set on a real host the Sessions API call (with a `manage_sessions` bearer token) goes to that URL. See hardening H6 |

## 3. Names read in code but not in `.env.example`

| Name | Class | Read in | Note |
| --- | --- | --- | --- |
| `CSP_REPORT_ONLY` | toggle | `next.config.ts` | `true` switches the CSP header to `Content-Security-Policy-Report-Only` (Q-Q-11). Documented only in a comment in `lib/security-headers.ts`. Suggest listing the name in `.env.example` |
| `NODE_ENV` | host | `lib/session.ts`, `proxy.ts`, `next.config.ts`, `app/api/dev/session/route.ts`, dev pages | set by Next |
| `NEXT_RUNTIME` | host | `instrumentation.ts` | set by Next |
| `URL`, `DEPLOY_PRIME_URL` | host (Netlify) | `lib/content/seo.ts` | fallbacks for the site origin when `NEXT_PUBLIC_SITE_URL` is empty. Not secrets |

## 4. Seed names (`seed/.env.example`, 9 names)

| Name | Class | Read in | If it leaked |
| --- | --- | --- | --- |
| `SEED_CTP_PROJECT_KEY` | setting | `seed/src/lib.ts`, `images.ts`, `advance-order.ts`, `cleanup-tests.ts` | nothing |
| `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL` | setting | `seed/src/lib.ts` | nothing |
| `SEED_CTP_CLIENT_ID` | secret | `seed/src/lib.ts` | with the secret: an admin client (writes project settings, catalogue, customers, orders states) |
| `SEED_CTP_CLIENT_SECRET` | secret (highest of the seed) | `seed/src/lib.ts` (`connect()`), and the same reader in `seed/src/order-ops.ts` | same |
| `SEED_CTP_SCOPES` | setting | `seed/src/lib.ts` | nothing |
| `EXPECTED_PROJECT_KEY` | setting | `seed/src/lib.ts`, `images.ts`, `advance-order.ts`, `cleanup-tests.ts`, `order-ops.ts` | nothing (the second half of the wrong-project guard) |
| `SEED_DEMO_PASSWORD` | secret | `seed/src/lib.ts`, `seed/src/seed.ts` | sign in as the six demo customers |
| `IMAGE_SOURCE_URL` | setting (optional; may hold a token) | `seed/src/lib.ts`, `seed/src/images.ts` | treat as secret if it carries a token |

The seed is a command-line package. It is never part of the Next.js build, so none of these names can enter the browser bundle. `seed/.gitignore` lists `.env`, `.env.*` and `!.env.example`.

## 5. Can any secret reach the client bundle?

No `NEXT_PUBLIC_` secret exists, and Next only inlines `NEXT_PUBLIC_` names, so a plain `process.env.X` in server code is never copied into browser JavaScript. Seven layers sit on top of that:

| Layer | What it does | Proof |
| --- | --- | --- |
| `scripts/check-secrets.mjs` | rejects a `NEXT_PUBLIC_` name that contains `SECRET`, `CLIENT_ID` or `SCOPES`, a value in `.env.example`, a stray `.env*` file, and a tracked env file | `scripts/check-secrets.test.ts`: `Public prefix on a secret fails`, `.env.example lists every variable with an empty value`, `Only .env.local and .env.example may exist`, `The real storefront passes the static secret checks` (I ran the script: ok) |
| `lib/env.ts` `parseEnv` (lines 45-50) | at server start (`instrumentation.ts`) throws if any environment name starts with `NEXT_PUBLIC_` and contains `SECRET`, `CLIENT_ID` or `SCOPES`; also needs `SESSION_SECRET` of 32 characters or more and equal project keys | `lib/env.test.ts`: `Public prefix on a secret fails`, `Missing secret: SESSION_SECRET shorter than 32 names the variable and not the value`, `Wrong project names both keys` |
| `scripts/predeploy-check.mjs` (lines 77-81) | at deploy time rejects any `NEXT_PUBLIC_` name that looks like a secret (`SECRET`, `TOKEN`, `PASSWORD`, `KEY`, `CLIENT`) except `NEXT_PUBLIC_SITE_URL` | `predeploy-check.test.ts`: `a public variable named like a secret fails` |
| `scripts/check-bundle-secrets.mjs` | after `next build`, searches every file in `.next/static` and every `.html` in `.next/server/app` for the **value** of each of 9 secret names (`CTP_CLIENT_SECRET`, `CTP_CLIENT_ID`, `SESSION_SECRET`, `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, `DEMO_LOGIN_PASSWORD`, `CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_TOKEN`, `FEEDBACK_WEBHOOK_URL`) of 8 characters or more; prints only the name and the file | `check-bundle-secrets.test.ts` (6 tests, all pass): `Client bundle scan finds a secret value in .next/static and reports only the name`, `contact webhook token in the bundle is found`, `list covers every secret named in .env.example`. Run by `npm run verify:build` |
| `import 'server-only'` | Next fails the build if a client file imports the module | `lib/architecture.test.ts`: `Every lib/ct file starts with import 'server-only'`, `lib/session.ts, lib/env.ts and lib/api.ts are server-only`, `Components do not import from lib/ct, lib/mappers or lib/session` |
| ESLint `local/no-server-in-client` | a `'use client'` file may not import `@commercetools/*`, `server-only`, `lib/ct/*` or `lib/session` | `eslint/rules.test.mjs`: `Server import in a client file: lib/ct import fails with the boundary rule`. `npx eslint .` ran clean (exit 0). I also checked all 171 `'use client'` files by script: none imports `lib/ct` (except the allowed `image-config`), `lib/session`, `lib/env`, `lib/api`, `lib/rate-limit`, `lib/http/*`, `server-only` or `@commercetools/*` |
| Name scan of the build (mine) | the 10 variable names above are absent from all 67 files of `.next/static` | `grep -rlE "CTP_CLIENT_SECRET\|CTP_CLIENT_ID\|SESSION_SECRET\|CONTACT_WEBHOOK_TOKEN\|CONTACT_WEBHOOK_URL\|FEEDBACK_WEBHOOK_URL\|DEMO_LOGIN_PASSWORD\|CTP_REVIEWS_CLIENT_SECRET\|CTP_REVIEWS_CLIENT_ID\|SEED_DEMO_PASSWORD" .next/static` printed no file name |

Gaps in the guard (all low, see H7 in `security.md`):

- The scan covers `.html` files only. The `.rsc` payloads under `.next/server/app` are also sent to the browser and are not scanned.
- `lib/session-reconcile.ts` reads `SESSION_SECRET` and is deliberately not `server-only` (the proxy imports it). Only `proxy.ts` imports it today (grep). The lint rule would not flag `@/lib/session-reconcile` in a client file. A client import would bundle `jose` but not the secret value (Next does not inline it).

## 6. Logging grep

Command: `rg -n "console\.(log|error|warn|info|debug|trace)|logger\.|\blog\(" app lib components hooks context i18n content instrumentation.ts proxy.ts next.config.ts` (tests excluded). There is no logger library and no `logger.` call. No `console.*` exists in `hooks`, `context`, `i18n`, `content` or any client component. The spec's narrower command (`console.(log|error)`) finds a subset of these.

| # | Call site | What it prints | Judgement |
| --- | --- | --- | --- |
| 1 | `lib/errors.ts:92` `console.error` | one JSON line: `route` (the pattern, for example `/api/orders/[id]`), `code`, `status`, `correlationId`, `upstreamStatus`. No body, email, token or stack | clean. Tests: `Correlation id is logged and not returned`, `Error body is exactly code and message with no stack and no commercetools text` |
| 2 | `lib/contact/handle.ts:27` `console.log` (called 5 times) | `route`, `reference` (our own `MC-<date>-<random>`), `topic`, `status`, `correlationId` | clean: never name, email, order number or message. Test: `logs never contain the message or email` (also checks the client address) |
| 3 | `app/api/faq-feedback/route.ts:32` `console.log` | `route`, `questionId`, `helpful` | clean. Test: `no personal data is logged` |
| 4 | `app/api/recurring-orders/[id]/route.ts:39` `console.error` | `route`, `recurringOrderId`, `code` | clean (an opaque id) |
| 5 | `lib/checkout/placed.ts:49` `console.warn` | `event`, `orderId` | clean |
| 6 | `lib/checkout/finalize.ts:25` `console.warn` | `event`, `orderId` | clean |
| 7 | `lib/checkout/subscription-hook.ts:13` `console.info` | `event`, `orderId`, counts | clean |
| 8 | `lib/ct/orders.ts:68` `console.warn` | `event`, `orderNumber` (or id) | acceptable: an order identifier, not a name or email. If log retention rules treat order numbers as personal data, log the id instead |
| 9 | `lib/pdp/load.ts:17`, `lib/listing/load.ts:142`, `lib/home-data.ts:34`, `lib/ct/promise.ts:20`, `lib/ct/market.ts:34,36`, `lib/shell-data.ts:31,37`, `components/pdp/RelatedStrip.tsx:7` (a server component) | `event` and the upstream `status` number | clean |
| 10 | `lib/shell-data.ts:45`, `lib/mappers/channel.ts:55` `console.warn` | `event` with category keys or a channel key | clean (catalogue keys) |
| 11 | `lib/mappers/cart.ts:215` `console.warn` | a sentence with a number of minor units | clean, and development only (guarded by `NODE_ENV === 'development'`, line 213) |

Other facts that matter for logs:

- **Login and demo login:** the tests `nothing sensitive is logged` (login) and `a failed demo sign-in logs neither the email nor the password` spy on `console` and look for the password and the email.
- **Discount codes:** `cart-routes.test.ts` `code text never logged`.
- **Newsletter:** `newsletter/route.test.ts` `202 and the address is not logged`.
- **Rate limit keys:** `lib/rate-limit.ts`, `lib/http/limit.ts` and `lib/auth/login-flow.ts` contain no log call. The keys are SHA-256 hashes (`hashKey`).
- **Not under the app's control:** Next prints uncaught Server Component errors itself. The thrown commercetools SDK object carries `originalRequest` with the `Authorization` header unless the client masks it (hardening H3).
- **Seed:** 20 `console.*` calls print counts and plan lines. `seed/src/lib.ts:157` `fail()` prints `e.message` for an `Error` and the whole object otherwise (hardening H3). The demo customers it names are `@example.com` addresses.

## 7. Where each secret may live

| Place | Rule | Check |
| --- | --- | --- |
| Git | only `.env.example` files, names only | `git ls-files` lists `storefront/.env.example` and `seed/.env.example` for this project; the real files were never tracked (`git log --all -- storefront/.env.local seed/.env seed/.env.local storefront/.env` is empty). Details in S2 of `security.md` |
| Local | `storefront/.env.local`, `seed/.env.local` (git-ignored) | `storefront/.gitignore:34-35`, `seed/.gitignore:2-4`, root `.gitignore:8-11` |
| Host | the host's environment settings only | RELEASE-CHECKLIST section C rows 2 to 6; owner row OA-N-Q1 |

## 8. Other gate results from this run

| Command (in `storefront`) | Result |
| --- | --- |
| `node scripts/check-secrets.mjs` | `secret check: ok` |
| `node scripts/check-versions.mjs` | `version gate: ok` (Node v22.21.1; next 16.4.2, next-intl 4.14.9, platform-sdk 8.27.0, ts-client 4.10.0, react 19.2.4) |
| `env -i PATH=$PATH node scripts/predeploy-check.mjs` (an empty environment, so only names appear) | exit 1, as designed while the dev routes exist: `Remove app/api/health/route.ts`, `Remove app/api/dev`, `Remove app/[locale]/dev`, and the 10 required variable names reported as "is not set". No value was involved |
| `npm audit --omit=dev --audit-level=high` in both apps | found 0 vulnerabilities (`npm-audit.txt`) |
