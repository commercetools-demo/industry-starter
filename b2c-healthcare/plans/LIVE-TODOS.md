# Live runbook: everything that could not be executed without credentials, accounts or a browser

One ordered runbook built from `plans/notes/<A..X>-todos.md` and the live-check parts of `<A..X>-questions.md` and `<A..X>-missed.md` (workstreams Y and Z had no notes when this was written). Context: `plans/TODO-MANUAL-TESTING.md` (owner actions), `plans/PROJECT-FINDINGS.md`, `plans/QUESTIONS-RAISED.md` (decisions that change a step), `plans/MISSED-FEATURES.md`.

**Conventions.** All commands run from `b2c-healthcare/site/` unless stated. `MC MCP` = the `spec-b2c-health` Merchant Center MCP (`read_*` tools; Claude can run these), "browser" = Chrome DevTools connector (Claude) or a real browser (owner). Never paste secrets into chat, PRs or logs. Source cites use `notes/N-todos.md#3` (step 3), `#Ln` (numbered item under a "Live checks" heading in a file with two lists), `-questions.md#n` (row n), `-missed.md#bn` (bullet n).

## Table of contents
1. [Prerequisites (OA ids)](#1-prerequisites-oa-ids)
2. [Environment variables](#2-environment-variables)
3. [API client scopes](#3-api-client-scopes)
4. [Runbook](#4-runbook)
   - [Phase A: project, seed, verify, index](#phase-a-project-seed-verify-index) (LT-01 to LT-20)
   - [Phase B: storefront boot, locale and identity](#phase-b-storefront-boot-locale-and-identity) (LT-21 to LT-33)
   - [Phase C: catalog, search, home, booking](#phase-c-catalog-search-home-booking) (LT-34 to LT-49)
   - [Phase D: prescriptions and cart](#phase-d-prescriptions-and-cart) (LT-50 to LT-62)
   - [Phase E: checkout and payment (needs OA-04)](#phase-e-checkout-and-payment-needs-oa-04) (LT-63 to LT-76)
   - [Phase F: orders](#phase-f-orders) (LT-77 to LT-86)
   - [Phase G: account, addresses, labs](#phase-g-account-addresses-labs) (LT-87 to LT-99)
   - [Phase H: saved lists, auto-refill, saved cards](#phase-h-saved-lists-auto-refill-saved-cards) (LT-100 to LT-117)
   - [Phase I: funding (allowance, restricted tender, credentials)](#phase-i-funding-allowance-restricted-tender-credentials) (LT-118 to LT-124)
   - [Phase J: static content, regions, shell, accessibility](#phase-j-static-content-regions-shell-accessibility) (LT-125 to LT-134)
   - [Phase K: privacy and retention (destructive, last)](#phase-k-privacy-and-retention-destructive-last) (LT-135 to LT-143)
   - [Phase L: release build](#phase-l-release-build) (LT-144 to LT-147)
   - [Phase M: owner-only items](#phase-m-owner-only-items) (LT-148 to LT-155)
5. [Things that may fail live](#5-things-that-may-fail-live)
6. [Step count](#6-step-count)

---

## 1. Prerequisites (OA ids)

From `plans/TODO-MANUAL-TESTING.md` section 1 (status `TODO` unless noted). Do these before Phase A.

| OA | Needed by | Action | Output | Blocks steps |
| --- | --- | --- | --- | --- |
| OA-01 | E, F, N, O, Q, S, T, U, X | In Merchant Center for project `spec-test-b2c-healthcare`, create an **admin API client for seeding** (scopes: section 3.2). Put the values in `site/.env.seed.local` (git-ignored): `SEED_CTP_PROJECT_KEY`, `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES`, `SEED_PATIENT_PASSWORD`. Optional `PEXELS_CLIENT_ID` in the shell for `seed:images` (read from the shell only, `notes/E-missed.md#b9`). | `.env.seed.local` | LT-02 to LT-20, LT-118+, LT-135+ |
| OA-02 | D and every storefront check | Create the **Frontend API client** (B2C template + `manage_sessions`, `manage_orders`; no admin scopes), widened per section 3.1. Put `CTP_*` in `site/.env.local`. | `.env.local` | LT-21 onward |
| OA-03 | D | `SESSION_SECRET` of at least 32 random characters: `openssl rand -base64 48` into `.env.local`. | `.env.local` | LT-21 onward |
| OA-04 | Q, T, U (S for real voids) | Create the commercetools **Checkout Application in Payment Only mode** with a **Stripe sandbox** connector (Stripe test keys stay in Merchant Center, not the repo), enable stored payment methods for T; put the Application key in `CTP_CHECKOUT_APP_KEY`. | `CTP_CHECKOUT_APP_KEY` | Phase E, H (cards), LT-76, LT-110 to LT-117 |
| OA-05 | none | Email provider: not needed (Q-008, no email). | n/a | none |
| OA-06 | Y | Hosting account and Netlify site (Q-009). | site URL | LT-144+, schedules |

Also required: Node and `npm ci` in `site/` (`notes/A-todos.md`), the MC MCP connected for `read_*` steps, a Chrome DevTools connection for browser steps (it was unavailable to K, L, M, N, O, Q, R, S, T, U, V, W, I, which is why the browser steps below are open), Stripe sandbox cards `4242 4242 4242 4242` (success) and `4000 0000 0000 0002` (declined) (`notes/Q-todos.md` M-Q-1).

---

## 2. Environment variables

Storefront variables go in `site/.env.local` (local) and in Netlify site settings (deployed). Seed variables go only in `site/.env.seed.local`. All are server-only, no `NEXT_PUBLIC_` prefix (`.env.example`).

### 2.1 Storefront

| Variable | Required | Used by | Notes (source) |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | yes | all `lib/ct` | `spec-test-b2c-healthcare` (`notes/D-todos.md` step 1) |
| `CTP_AUTH_URL` | yes | all `lib/ct`, Netlify functions | Merchant Center API client page (`notes/D-todos.md` step 1) |
| `CTP_API_URL` | yes | same | same |
| `CTP_CLIENT_ID` | yes | same | validated at server start by `instrumentation.ts` (skipped when `NODE_ENV=test`; `next build` does not run it) (`notes/D-questions.md#5`) |
| `CTP_CLIENT_SECRET` | yes | same | never log; blank value must stop the server naming it (`notes/D-todos.md` step 4) |
| `CTP_SCOPES` | yes | same | space separated `scope:<project-key>`, list in section 3.1 |
| `SESSION_SECRET` | yes | `lib/session.ts` | 32 or more characters; resolved lazily, hard failure at first use; env-guard page names it in dev if missing (`notes/G-questions.md#3`, `notes/I-questions.md#6`) |
| `CTP_CHECKOUT_APP_KEY` | for payment | `lib/ct/checkout-provider.ts` | Application key (not secret); without it payment answers 503 and no order can be placed (`notes/Q-questions.md#2`) |
| `AUTO_REFILL_ENABLED` | optional (`true` to enable) | home line, order card button, `/account/auto-refill` | defaults to off in code; `.env.example` shows `true`; set only where the T scopes and the scheduled function exist (`notes/M-questions.md#6`, `notes/T-todos.md#L18`) |
| `AUTO_REFILL_RUN_SECRET` | with auto-refill | `/api/internal/auto-refill-run`, Netlify `auto-refill-run` | 16 or more characters, same value in app and Netlify function env; route 503 without it, 401 on a wrong secret (`notes/T-questions.md#10`, `notes/T-todos.md#L8`) |
| `RELOAD_ALLOWANCES_SECRET` | with allowance | `netlify/functions/reload-allowances.ts`, scheduled wrapper (header `x-malva-reload-secret`) | endpoint closed (503) without it (`notes/U-todos.md`, `.env.example`) |
| `RETENTION_SECRET` | with retention | `netlify/functions/retention.ts` (header `x-malva-retention-secret`) | 16 or more characters, never in git (`notes/X-todos.md#5`) |
| `SITE_URL` | in production | canonical URLs, sitemap, robots; `auto-refill-run` fallback origin | defaults to `http://localhost:3000`; Netlify also provides `URL` (`notes/V-todos.md`, `notes/U-todos.md`) |
| `DOCTOR_PAGE_SIZE` | optional | doctor list | integer 1 to 50, default 9 (`notes/K-questions.md#8`) |
| `SAME_DAY_NOW_OVERRIDE` | dev only | same-day cut-off | ISO instant, ignored when `NODE_ENV=production` (`notes/Q-questions.md#17`) |
| `RESOLVER_FORCE_FAIL` | dev only | funding resolver | `1` forces "Cover unresolved"; never set in production (`notes/U-todos.md`) |
| `MALVA_FIXTURES` | dev only | fixture loaders | `1` serves seed data without commercetools; must not be set in any deployed environment (`notes/K-questions.md#1`) |
| `NODE_ENV` | automatic | guards | `production` hides fixtures, fake payment, `_tokens`, `_boom`, `/api/health` |

### 2.2 Seed and admin scripts (`site/.env.seed.local`)

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `SEED_CTP_PROJECT_KEY` | yes | all `scripts/seed/*`, `allowances:reload`, `privacy:*` | scripts refuse unless exactly `spec-test-b2c-healthcare` and the API reports the same key (`notes/E-todos.md`) |
| `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES` | yes | same | scopes in section 3.2 |
| `SEED_PATIENT_PASSWORD` | yes for F | `seed` (3 synthetic customers), sign-in tests | missing: seed skips customers and `seed:verify` fails "exactly three example.com patients" (`notes/F-questions.md#17`) |
| `PEXELS_CLIENT_ID`, `PEXELS_API_KEY` | optional | `seed:images`, `seed:images:json` | shell only; `PEXELS_API_KEY` (free, pexels.com/api) selects the official Pexels API, else the undocumented public endpoint (`notes/E-missed.md#b9`, `notes/AC-questions.md`) |

---

## 3. API client scopes

### 3.1 Storefront (Frontend) client: `CTP_SCOPES`

Final list (D-036, follow-up AC): the commercetools **B2C storefront template** + what recurring orders, recurrence policies and recurring prices need + **`manage_key_value_documents`** (Custom Objects) + what the code in `lib/ct/**` actually calls. It is the comment block of `site/.env.example` (a reason per scope) and the exact paste text is in `notes/AC-todos.md`. `site/lib/ct/scopes.test.ts` fails on a duplicate, a scope without a reason, or a resource the code calls that no listed scope covers. Each scope is written `scope:spec-test-b2c-healthcare` in `CTP_SCOPES` (space separated).

| Scope | Needed by |
| --- | --- |
| `view_published_products` | published product projections: doctor and medicine pages, home, listings (template) |
| `view_products` | Product Search, inventory reads (shelf life), review reads, product types and channels (template) |
| `view_categories` | navigation and listing filters (template) |
| `view_stores` | store scoping of carts and prices (template) |
| `view_shipping_methods` | shipping options at checkout, same-day claim on the home page (template) |
| `view_tax_categories` | tax on Rx medicine and consultations (template) |
| `view_cart_discounts`, `view_discount_codes` | promotions in the cart (template) |
| `view_types` | custom type lookups (template) |
| `manage_customers` | register, sign-in, password reset, email verification, profile, addresses (template) |
| `manage_orders` | carts and orders; also Zones (template) |
| `manage_payments` | payment objects for Checkout and tender payments (template) |
| `manage_sessions` | Checkout and cart sessions (Frontend client scope; spec requirement) |
| `manage_shopping_lists` | saved shopping lists (template) |
| `manage_checkout_payment_intents` | release (cancel) an authorized payment when an order cannot be placed |
| `manage_recurring_orders` | auto-refill: read, create, pause, resume, skip, change, cancel (covers viewing recurring orders) |
| `view_recurrence_policies` | the cadences a refill line references; recurring prices are Embedded Prices, read with `view_products` |
| `manage_payment_methods` | saved cards: list descriptors, set default, remove |
| `manage_key_value_documents` | Custom Objects (`malva-*` containers): availability, bookings, clinical stand-in, rate limits, counter, order attempts, ledgers, refill log, retention. This is the only name; `manage_custom_objects` is not a scope (D-036) |
| `view_project_settings` | `getProjectSettings` (region switcher, `/api/locale`); without it `getValidCountryConfig` throws |
| `view_states` | order state keys read through `expand` (the order timeline) |

Not needed, on purpose: `view_standalone_prices` (prices are Embedded Prices; add it only if recurring prices are ever modelled as Standalone Prices), `view_orders` and `view_payment_methods` and `view_recurring_orders` (covered by the manage scopes), `view_inventory_entries` (inventory reads are covered by `view_products`), any `manage_my_*` (the BFF uses the client credentials flow, no password-flow tokens).

### 3.2 Seed (admin) client: `SEED_CTP_SCOPES`

Simplest: **`manage_project:spec-test-b2c-healthcare`** (one scope, everything). Narrow alternative, one scope per line with the script that needs it in `site/.env.seed.example`: `manage_products`, `manage_categories`, `manage_types`, `manage_states`, `manage_shipping_methods`, `manage_tax_categories`, `manage_stores`, `manage_zones`, `manage_orders`, `manage_customers`, `manage_key_value_documents`, `manage_shopping_lists`, `manage_payments`, `manage_recurring_orders`, `manage_recurrence_policies`, `manage_quotes`, `manage_quote_requests`, `manage_staged_quotes`, `manage_business_units`, `manage_discount_codes`, `view_messages`, `view_project_settings`. The last six exist because `seed:full` erases the example.com customers with the privacy collector, which queries every GDPR resource kind (a missing scope would be a 403 half way through).

---

## 4. Runbook

Dependency order: seed, verify, wait for the search index, then storefront checks, then destructive privacy checks last. Mark each step PASS/FAIL in the PR (never secrets). If an earlier step fails, do not continue past its phase.

### Phase A: project, seed, verify, index

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-01 | `npm ci && npm run check` | typecheck, lint, token parity, tests all pass | `notes/A-todos.md` |
| LT-02 | `npm run seed:inventory` | prints counts of what the project holds (customers/orders/carts were "not checked yet"); paste into `PROJECT-FINDINGS.md` empty rows | E: `notes/E-todos.md` Run instructions |
| LT-03 | `npm run seed:cleanup -- --dry-run` | lists only unprefixed (non `mlv-`) resources; zones `usa` and `europe` stay | E: `notes/E-todos.md`, `notes/E-questions.md#2` |
| LT-04 | `npm run seed:cleanup -- --confirm spec-test-b2c-healthcare` | sample furniture products, categories, product types, shipping methods, tax category removed | E: `notes/E-todos.md` |
| LT-05 | If the project was ever seeded with an earlier version (L changed Alvarez/Haddad fees, O/Q/T/U added type fields): the seed now UPDATES existing resources in place (prices, attributes, `isSearchable`, new type fields); for a clean slate run `npm run seed:full` (D-038: reviews, `mlv-` resources, all `malva-*` Custom Objects, recurrence policies, example.com customers and their data, then cleanup-sample, seed, images, verify, wait). `npm run seed:full -- --dry-run` first | clean `mlv-` set | L: `notes/L-todos.md#1`, F: `notes/F-todos.md#9` |
| LT-06 | `npm run seed -- --dry-run` | review plan; check zone key `usa` exists (else set it with `update_zones` setKey or change `ZONE_USA` in `scripts/seed/data/shipping.ts`) | E: `notes/E-todos.md`, `notes/E-questions.md#4` |
| LT-07 | `npm run seed` | finishes without STOP; creates types (`mlv-rx-line` with `lastSeenUnitPrice`, `dispensedQty`, `authorizationParams`, `suppliedLots`; `mlv-list-line`; `mlv-inventory-meta`; order-meta fields), states `mlv-received`, `mlv-pharmacist-review`, `mlv-packed-shipped`, `mlv-delivered`, `mlv-cancelled`, price channels `mlv-remote`/`mlv-office`, 28 products (8 doctors + 20 medications), shipping `mlv-standard` and `mlv-same-day`, recurrence policies `mlv-monthly` (Months 1) and `mlv-quarterly` (Months 3), reviews `mlv-rev-*`, `malva-*` objects, three example.com customers | E, F, O, Q, T, U: `notes/E-todos.md`, `notes/F-todos.md#1`, `notes/T-todos.md#L1`, `notes/O-todos.md#1`, `notes/Q-todos.md#L8`, `notes/U-todos.md` |
| LT-08 | Check the seed UPDATES an existing type (adds field definitions) rather than skipping it: with a project that already has `mlv-rx-line`, confirm the three Q fields and `lastSeenUnitPrice` appear; otherwise add them in the Merchant Center | fields present in `read_types` | O: `notes/O-todos.md#1`, Q: `notes/Q-todos.md#L8` |
| LT-09 | `npm run seed` again | prints `0 change(s) in N step(s)` | E, F: `notes/E-todos.md`, `notes/F-todos.md#1` |
| LT-10 | `npm run seed:wait` | polls Product Search until 28 products indexed (5 min timeout). If `prefix` on `key` is rejected, switch to `exists` on `key`; if `fullText` language `en-US` returns 0 for "Okafor", try `en` | E: `notes/E-todos.md`, `notes/E-questions.md#7`, `#7b` |
| LT-11 | the photos are committed (`data/product-images.json`, `site-images.json`, D-040) and `seed:full` / `seed` apply them; re-pick only if wanted: `npm run seed:images:json` (no credentials, writes the JSON) or `npm run seed:images` (live). `PEXELS_API_KEY` in the shell switches to the official Pexels API | picks reviewed; images replaced and products republished; `scripts/seed/data/product-images.json` and `site-images.json` written; confirm URLs have no `?` | E: `notes/E-todos.md`, M: `notes/M-todos.md#2` |
| LT-12 | `git diff scripts/seed/data/*.json` and commit the generated JSON | both files no longer `{}` | E: `notes/E-todos.md` |
| LT-13 | `npm run seed` | still 0 changes (images are not compared) | E: `notes/E-todos.md` |
| LT-14 | `npm run seed:verify` | all checks PASS, including clinical block, "every product has images", and the Messages-disabled check (`project.messages.enabled` false). If only "product rating statistics are non-zero" fails, wait a few seconds and re-run (async roll-up) | E, F, X: `notes/E-todos.md`, `notes/F-todos.md#2`, `notes/X-todos.md#6` |
| LT-15 | `npx tsx scripts/seed/smoke-slots.ts mlv-doc-amara-okafor office` | list of free slots and `PASS  the second claim of the same slot failed with 409`. A 400 on the first claim means the key format `<doctorKey>.<mode>.<YYYYMMDDTHHmmssZ>` or the `version: 0` create-only semantic differs: record in `PROJECT-FINDINGS.md` | F: `notes/F-todos.md#3`, `notes/F-questions.md#2`, `#3` |
| LT-16 | MC MCP `read_custom_objects`: containers `malva-schedule` 8, `malva-rx` 4, `malva-lab` 5, `malva-credential` 1, `malva-booking` 1; `malva-slot-claim` empty after LT-15 | counts as listed | F: `notes/F-todos.md#4` |
| LT-17 | `read_reviews` | 29 reviews (`mlv-rev-*`) with `custom.fields.verifiedPatient = true`; each doctor's `reviewRatingStatistics.count` equals its review count | F: `notes/F-todos.md#5` |
| LT-18 | `read_customers` | exactly three example.com patients (`mlv-patient-*`), email verified, one default address each, `custom.fields.patientRef` set, Sam has `fundingScheme` "Demo Health Plan" | F: `notes/F-todos.md#6` |
| LT-19 | MC MCP: `read_products`, `read_product_search` ("Okafor", facets specialty and modes), `read_shipping_methods`, `read_states`, `read_types`, `read_product_types`, `read_categories`; open a few image URLs in a browser | doctors have `mlv-remote`/`mlv-office` prices (Alvarez remote only, Haddad office only); no furniture left; types and states as in LT-07 | E: `notes/E-todos.md` browser recipe, L: `notes/L-todos.md#1` |
| LT-20 | `npm run seed:inventory`; fill the empty rows of `PROJECT-FINDINGS.md` (no secrets); tick E-10 | final counts recorded | E: `notes/E-todos.md` |
| LT-20b | `npm run allowances:reload -- --dry-run` then `npm run allowances:reload` (grants the current cycle; Q-062 says Sam gets $50/month; U found no allowance exists until the first reload) then again | first run grants cycles, second run changes nothing | U: `notes/U-missed.md#b1`, `notes/U-todos.md` (script header `scripts/reload-allowances.ts`) |

### Phase B: storefront boot, locale and identity

Prerequisites: OA-02, OA-03. `cp .env.example .env.local`, fill values, then `PORT=3000 npm run dev`.

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-21 | `npm run dev` | server start succeeds; with a blank `CTP_CLIENT_SECRET` it fails naming that variable | D: `notes/D-todos.md` steps 2, 4 |
| LT-22 | `curl -i localhost:3000/api/health` | HTTP 200 and `{"ok":true,"projectKey":"spec-test-b2c-healthcare"}` (record in PR; ticks "Valid credentials"). Wrong secret gives 500 `{"ok":false}` with no detail | D: `notes/D-todos.md` steps 3, 4 |
| LT-23 | Grep dev-server output for the secret values | none found | D: `notes/D-todos.md` step 6 |
| LT-24 | Tamper: edit one character of the `malva_session` cookie and reload | page renders anonymously, no error | D: `notes/D-todos.md` step 7 |
| LT-25 | `curl -i -X POST localhost:3000/api/locale -H 'content-type: application/json' -d '{"currency":"EUR"}'` then with `{"locale":"en-US"}` | 400, then 200 with `Set-Cookie: malva_session` carrying locale, country, currency. Needs project settings listing US, USD and `en`/`en-US` | G: `notes/G-todos.md` Live checks 1, 2 |
| LT-26 | Category tree and shipping methods: two requests within 60 s make one commercetools call (add a temporary counter in `fetchCategoryTree`, remove after); confirm categories do not exceed 500 | one call per 60 s | G: `notes/G-todos.md` Live checks 3 |
| LT-27 | Register at `/en-US/login` "Create an account" with a fresh `name@example.com` and 10+ character password | redirect to `/en-US/account` (R's page now exists) and toast "Your account is ready..."; `read_customers`: `isEmailVerified: true`, `custom.fields.patientRef` matches `pt_[a-z0-9]{8}`, no `fundingScheme`, no password or hash visible | J: `notes/J-todos.md#1` |
| LT-28 | DevTools cookie check: `malva_session` HttpOnly, SameSite=Lax, Secure outside dev; decode the JWT payload | only `customerId`, `cartId`, `locale`, `country`, `currency`; no name or email. Also `malva_bk` cookie (after booking) HttpOnly, payload only `refs` | J: `notes/J-todos.md#2`, L: `notes/L-todos.md#4` |
| LT-29 | Sign in as `sam.rivera@example.com` with wrong password and as an unknown address | same text, same 401, similar timing (note differences in `PROJECT-FINDINGS.md`) | J: `notes/J-todos.md#4` |
| LT-30 | Lockout: 5 wrong attempts for one email; the 6th | 429 with `Retry-After` even with the right password; `malva-ratelimit` has `rl-login-<32 hex>` (no email or IP); another email unaffected | J: `notes/J-todos.md#5` |
| LT-31 | Duplicate registration: register `sam.rivera@example.com`, then five times from one client | 409 with the generic text, then 429. `/en-US/login?next=//evil.com` and `?next=https://evil.com` land on `/account` after sign-in; a signed-in visitor opening `/login` is redirected to `/account` | J: `notes/J-todos.md#8`, `#9` |
| LT-32 | Verification token functions: `GET /customers/email-token=<token>` for a fresh token; observe consumed and expired tokens (400 vs 404); adjust `confirmEmail` if needed | behaviour recorded | J: `notes/J-todos.md#10`, `notes/J-questions.md#7` |
| LT-33 | Password change: `fetch('/api/account/password', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({currentPassword:'...', newPassword:'...'})})` signed in; wrong current password answers 400 "Your current password is not correct."; then sign in with the new one. Also sign out: `fetch('/api/auth/logout',{method:'POST'})` (or R's "Sign out" button) and reload: header shows Sign in | as stated | J: `notes/J-todos.md#3`, `#11`, R: `notes/R-todos.md#9` |

### Phase C: catalog, search, home, booking

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-34 | Product Search probe with `buildSearchRequest` for a doctor, `filters.modes=['office']`; confirm `variants.attributes.modes.key` with `fieldType: set_enum`, `variants.attributes.specialty.key` and `city.key` with `enum`, `rxOnly` boolean; distinct facets `specialty`, `city`, `modes` return buckets; price sort filter; and `variants.prices.currencyCode` accepted as `exact` (channel-priced doctors must match) | all accepted, doctors matched. On failure adjust `lib/ct/search-query.ts` and see section 5 | K: `notes/K-todos.md#1`, G: `notes/G-todos.md` Live checks 6, W: `notes/W-todos.md#4` |
| LT-35 | Confirm `masterVariant.prices[*].channel` expands on search results and on `productProjections/key=mlv-doc-amara-okafor?priceCurrency=USD&priceCountry=US&expand=masterVariant.prices[*].channel` (`prices[].channel.obj.key`) | fees per mode found; else pass `channelKeysById` to the mappers | K: `notes/K-todos.md#2`, L: `notes/L-todos.md#2`, G: `notes/G-questions.md#8` |
| LT-36 | `/en-US/doctors/remote` and `/office` | remote 7 doctors, office 7 (Alvarez remote only, Haddad office only; K's "8" is stale); office shows clinic in meta line and city filter; specialty filter updates URL and Back restores it; "Available today" matches badges; `DOCTOR_PAGE_SIZE=3` shows pager; `?page=99` redirects to last page | K: `notes/K-todos.md#3`, L: `notes/L-questions.md#18` |
| LT-37 | Text search: `/search?q=okafor`, `?q=amox`, `?q=amoxicilin`, `?q=derm` (on /doctors), `?q=zzzz`, `?q=MED-amoxicillin-500-mg` | doctor hit; medicine hits; typo finds the medicine; exact SKU first with "Matched part number"; API accepts `fuzzy` with `fullText` (with `boost`) `or`, and `caseInsensitive` on `exact variants.sku` | K: `notes/K-todos.md#4` |
| LT-38 | Network tab on list and search pages | no commercetools call from the browser | K: `notes/K-todos.md#6` |
| LT-39 | `/en-US` home: up to 3 "Available today" doctor cards whose badge and the chip and band counts match `/en-US/doctors/remote?today=1` | counts equal | M: `notes/M-todos.md#1` |
| LT-40 | Home images: hero, rx, journal images load from clean URLs (no `?` in Network) | as stated | M: `notes/M-todos.md#2` |
| LT-41 | Same-day claim: with `mlv-same-day` active the prescription block says "Same-day delivery in selected states"; deactivate it and the line disappears after 60 s | as stated (needs `view_shipping_methods`) | M: `notes/M-todos.md#3` |
| LT-42 | Sam signed in, reload with throttled CPU; break the commercetools connection | no "Sign in" flash; home still renders static sections | M: `notes/M-todos.md#7`, `#8` |
| LT-43 | Doctor profile `/en-US/doctor/mlv-doc-amara-okafor?m=remote`; reviews: only `verifiedPatient = true` and `includedInStatistics`, 3 to 6 per doctor, dates "Mon YYYY" equal the seed run date | as stated | L: `notes/L-todos.md#3` |
| LT-44 | Booking as guest (Okafor, remote, tomorrow 09:30): confirmation `/en-US/booked/<ref>`; `read_custom_objects` shows one `malva-booking` (key = reference, `guest` block, `reason`, `expiresAt` = visit + 90 days) and one `malva-slot-claim` (`mlv-doc-amara-okafor.remote.<yyyymmddThhmmssZ>`); the time is no longer offered; dev log has no reason, phone or email | as stated | L: `notes/L-todos.md#4` |
| LT-45 | Second browser context, same slot | "That time is no longer available." and grid refreshes; `/booked/<ref>` in that context is a plain 404. Also two simultaneous `POST /api/bookings` for one slot give one 201 and one 409 | L: `notes/L-todos.md#5`, `#9` |
| LT-46 | Booking as Sam | panel says "Booking as Sam Rivera"; dialog asks only Phone and Reason; stored booking has `patientRef`, `phone`, no `guest`, no `expiresAt`; `/booked/<ref>` shows "My appointments". A customer without `patientRef` gets 403 | L: `notes/L-todos.md#6` |
| LT-47 | `curl -I http://localhost:3000/en-US/doctor/nope` | `HTTP/1.1 404` | L: `notes/L-todos.md#7` |
| LT-48 | Cart merge: as an anonymous visitor add a line (after Phase D), then sign in as Sam; also registration with `anonymousCart`. Confirm the platform accepts `anonymousCart` and `anonymousCartSignInMode` for a session cart created without `anonymousId` | lines survive | J: `notes/J-todos.md#6`, `#7` |
| LT-49 | Sign-in lockout store works: `malva-ratelimit` has entries from LT-30 and the client has Custom Object scope | no 500 on sign-in | J: `notes/J-questions.md#3` |

### Phase D: prescriptions and cart

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-50 | Sam: `/en-US/prescriptions`, lookup `rx 77102` | card with 3 refills, 2 medications selectable; `RX-48213` all rows "No refills left", Add disabled; as Alex `RX-77102` gives the same not-found text as `RX-00000`; the 6th failed attempt in 10 min shows the rate-limit message; Network shows the number only in the POST body | N: `notes/N-todos.md#2` |
| LT-51 | MC MCP `read_custom_objects` `malva-rx` after lookups | unchanged; `malva-ratelimit` gains `rl-<customerId>` | N: `notes/N-todos.md#2` |
| LT-52 | Jordan Lee | `RX-31877` shows "This prescription has expired"; `RX-55120` selectable | N: `notes/N-todos.md#3` |
| LT-53 | Inventory query `where=sku in ("A", "B") and supplyChannel is not defined` returns `availableQuantity` and `custom.fields.expiryDate` (type `mlv-inventory-meta`) for `MED-famotidine-20-mg` (expiry 2026-11-15). Before 2026-10-16: "Minimum 1 month of shelf life on delivery"; after: excluded "Stock expires ..., too soon" | as stated | N: `notes/N-todos.md#4` |
| LT-54 | Product query `where=masterVariant(sku in (...))` with `expand=masterVariant.prices[*].channel`: expanded ref arrives as `channel.obj.key`; channel-less USD pack price picked | as stated | N: `notes/N-todos.md#5` |
| LT-55 | Native limit: platform API add `MED-amoxicillin-500-mg` quantity 3 to a cart | 400 `LineItemQuantityAboveLimit` with `maxCartQuantity: 2`; record the exact body in `PROJECT-FINDINGS.md` if names differ from `lib/dispense/limit-errors.ts` | N: `notes/N-todos.md#6`, O: `notes/O-todos.md#7` |
| LT-56 | Optional seed change then check: channel `mlv-short-dated` and a USD price (e.g. 700 cents) on `MED-famotidine-20-mg`; after 2026-10-16 the row shows "Short-dated . expires 2026-11-15" at the lower price and stays selectable | as stated (needs the seed change QR-028) | N: `notes/N-todos.md#7` |
| LT-57 | Cart creation: `POST /api/cart/rx-lines` as Sam (`RX-77102`, both lines); `read_carts` | `customerId` set, no `anonymousId`, `shippingMode Single`, `taxMode Platform`, `shippingAddress.country US`, `shippingInfo.shippingMethodName` "Standard delivery" price 0. If refused (method without address or no zone matching `US`), record the error; fallback: create then `setShippingAddress` and `setShippingMethod` | O: `notes/O-todos.md#3` |
| LT-58 | Cart line fields | `custom.fields.rxNumber`, `rxLineRef`, `prescribedQty` (30), `lastSeenUnitPrice`; quantity 1 | O: `notes/O-todos.md#4` |
| LT-59 | Replace: add `RX-77102` line 1 again; also from another tab at the same time | one line (new id); 409 retried once | O: `notes/O-todos.md#5` |
| LT-60 | Totals: `/en-US/cart` total equals `totalPrice` in MC; delivery FREE; with the 0% US tax category `totalPrice`, not net | as stated | O: `notes/O-todos.md#6` |
| LT-61 | Re-validation: set `MED-lisinopril-10-mg` inventory to 0, reload `/en-US/cart`; edit `malva-rx` `expiresAt` | row struck through "Out of stock", button "Fix 1 item to continue" disabled; Remove makes Checkout a link; "This prescription has expired". Note whether the platform removes lines on cart update when inventory limits are violated | O: `notes/O-todos.md#8`, N: `notes/N-missed.md#b3` |
| LT-62 | Price change `MED-atorvastatin-20-mg`; sign-out/in; scopes | reload shows new price, "Price updated" badge, then gone on next reload; after sign-in the header count and cart return; customer cart query `customerId=:id and cartState="Active"` with `var.id` is allowed | O: `notes/O-todos.md#9`, `#10`, `#2` |

### Phase E: checkout and payment (needs OA-04)

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-63 | Confirm in the Application settings that Checkout does NOT create orders (payment-only mode); record in `PROJECT-FINDINGS.md` | storefront creates the order with `orderNumber` and line records | Q: `notes/Q-todos.md#L1` |
| LT-64 | Verify browser SDK message names against a live widget: `payment_started`, `payment_completed`/`checkout_completed`, `payment_cancelled`, `payment_failed` | names match (server never trusts them) | Q: `notes/Q-todos.md#L2` |
| LT-65 | Custom payment button: the Place order button with `data-ctc-selector="paymentButton"` is picked up although outside the payment card; a click while the widget loads does nothing harmful | as stated | Q: `notes/Q-todos.md#L3` |
| LT-66 | Payment on the cart: Checkout attaches the Payment to the cart at authorization (not only the order); newest payment's `Authorization` transaction (`Success`/`Failure`); transaction `amount` equals `taxedPrice.totalGross` | as stated | Q: `notes/Q-todos.md#L4` |
| LT-67 | `GET shipping-methods/matching-cart?cartId=` for `{country: US, state: NY}` returns `mlv-standard` and `mlv-same-day` (zone `mlv-same-day-states`) with `zoneRates[].shippingRates[].isMatching`; price 0 / 500; for `state: CA` only standard. Zone `Location.state` accepts the two-letter code | as stated | Q: `notes/Q-todos.md#L5`, E: `notes/E-questions.md#5` |
| LT-68 | Cart with country-only address and `mlv-standard`: platform keeps method and tax after `setShippingAddress` with a full address | as stated | Q: `notes/Q-todos.md#L6` |
| LT-69 | M-Q-1 steps 1 to 3: sign in as Sam, RX-77102 both lines, `/en-US/checkout`, "Use this address", Standard FREE; Same-day only for NY/TX/IL before 14:00 New York; no "DEMO payment" banner; DevTools shows no `<input autocomplete="cc-*">` outside the Checkout iframe; pay `4242 4242 4242 4242` | redirect to `/en-US/order/<id>`; MC order has `orderNumber` `MLV-000001`, state `mlv-received`, Payment with `Authorization/Success` equal to the total; Stripe shows an uncaptured PaymentIntent; `malva-rx` for RX-77102 `refillsLeft` minus one, `consumedBy` has the order id; session cart cleared | Q: `notes/Q-todos.md` M-Q-1 |
| LT-70 | Declined card `4000 0000 0000 0002` | inline "Your payment was declined...", cart remains, no order, no refill consumed | Q: M-Q-1 step 4 |
| LT-71 | Double-click Place order with a good card | exactly one order | Q: M-Q-1 step 5 |
| LT-72 | Totals moved: authorize, change delivery method in a second tab, return and place | "The total changed after your payment was authorized..." and the old authorization shows cancelled in Stripe | Q: M-Q-1 step 6 |
| LT-73 | `POST /orders` with `{cart:{typeId:'cart',id}, version, orderNumber, state:{typeId:'state',key:'mlv-received'}}`: state accepted as initial; duplicate `orderNumber` answers 400 `DuplicateField`; line custom fields `dispensedQty`, `authorizationParams`, `suppliedLots` arrive on order lines (String field accepts a multi-lot `suppliedLots` length) | as stated | Q: `notes/Q-todos.md#L7`, `#L8` |
| LT-74 | Counter and locks: `malva-counter/order-number` holds `{ "next": 2 }` after the first order; two parallel placements never share a number; `malva-order-attempt` has one entry per attempt (`<cartId>_<version>`) | as stated (decide retention rule; X sets 30 days) | Q: `notes/Q-todos.md#L10` |
| LT-75 | Release: force a failure after paying (e.g. add an unservable line) | `cancelPayment` voids the authorization in Stripe (`CancelAuthorization` transaction on the Payment); also check that authorization lag does not give a false `PAYMENT_REQUIRED` and that re-clicking does not double charge | Q: `notes/Q-todos.md#L11`, `notes/Q-missed.md#b6` |
| LT-76 | Same-day cut-off: `SAME_DAY_NOW_OVERRIDE=2026-10-08T09:00:00-04:00` offers same-day for NY; `...T15:00:00-04:00` withdraws it with the note; started 13:59 placed 14:01 refused with "No delivery option is available". Layouts at 390 and 900 px, focus ring on radio cards and Place order | as stated | Q: `notes/Q-todos.md#L12`, `#L13` |

### Phase F: orders

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-77 | After the LT-69 purchase: `/en-US/order/<id>` | one green step "Order received" | S: `notes/S-todos.md#1` |
| LT-78 | `npm run seed:advance -- MLV-000001 pharmacist-review --dry-run`, then without `--dry-run`; reload | `read_orders` shows `mlv-pharmacist-review`; two green steps. A skipped step (`... delivered` from `mlv-received`) is refused | S: `notes/S-todos.md#1`, F: `notes/F-todos.md#7` |
| LT-79 | `npm run seed:advance -- MLV-000001 packed-shipped --shipment Shipped`, then `--shipment Partial`, then `delivered` | three green steps, "Shipment: Shipped", no Cancel; "Partly shipped"; delivered shows four green and the no-returns line. Platform accepts `changeShipmentState` `Partial` | S: `notes/S-todos.md#1`, `#8` |
| LT-80 | As Alex open Sam's order URL and a random id; `GET /api/orders/<sam's id>` as Alex | both "Order not found." HTTP 404; API 404 `{"error":"Order not found."}` | S: `notes/S-todos.md#2` |
| LT-81 | Query shape: `where: id="<id>" and customerId="<id>"` with `expand: state, shippingInfo.shippingMethod, paymentInfo.payments[*]`; `sort: createdAt desc`, `limit: 50` on the list accepted | `state.obj.key` and transactions present | S: `notes/S-todos.md#3` |
| LT-82 | `/account/orders` lists newest first; Reorder Sam's RX-48213 order (0 refills) | card names the blocked medication ("no refills left"); RX-77102 lines are added | S: `notes/S-todos.md#4` |
| LT-83 | Cancel before packing (place a fresh order first) | `malva-rx` `refillsLeft` +1 and `consumedBy` without the order id; `malva-dispense-ledger/<orderId>` has `restoredAt`; State `mlv-cancelled`; Payment has one `Refund/Initial` transaction; Stripe PaymentIntent cancelled; pressing Cancel again changes nothing | S: `notes/S-todos.md#5`, N: `notes/N-todos.md#8` |
| LT-84 | Cancel after `packed-shipped` | Cancel button gone; `POST /api/orders/<id>/cancel` 409 `too-late`; nothing restored; platform answers 400 `InvalidOperation` for `packed-shipped -> mlv-cancelled` | S: `notes/S-todos.md#6` |
| LT-85 | `addTransaction` `Refund/Initial` accepted on a Payment holding only `Authorization/Success`; when connector sets it `Success` the page reads "Refunded" (owner QR-002 on wording "Refund requested" vs "Payment released") | as stated | S: `notes/S-todos.md#7` |
| LT-86 | Placement outcome unknown: block `/api/checkout/place` after the widget completes; 390 px layouts of order card and list | browser goes to `/en-US/order`; list shows the order if created | S: `notes/S-todos.md#9`, `#10` |
| LT-86b | Concurrency smoke (optional): two parallel `consumeAuthorization` calls for the last refill of one prescription | exactly one succeeds | N: `notes/N-todos.md#9` |

### Phase G: account, addresses, labs

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-87 | Sam signs in: lands on `/en-US/account`; side nav lists Overview, Lab tests, Appointments, Orders, Addresses, Profile, (T/U entries) then "Sign out" | as stated | R: `notes/R-todos.md#1` |
| LT-88 | Overview as Sam and as Alex | Sam "Hello, Sam", tiles 4 ready / appointment count (only an upcoming booked one counts; seed has a past completed one) / orders, 3 latest lab rows; Alex all zero and "No lab results yet." | R: `notes/R-todos.md#2` |
| LT-89 | `/en-US/account/labs`: five rows; Lipid panel LDL "High", marker at 96 %; Thyroid panel header and note only; Download PDF (check `×10³/µL` and `·` render); "Discuss with a doctor" opens `mlv-doc-sofia-marchetti` | as stated | R: `notes/R-todos.md#3`, `#11` |
| LT-90 | As Alex open `/en-US/account/labs/LAB-50301` and `/l999`; `GET /api/account/labs/LAB-50301` and `/pdf` | identical "Not found." 404; every `/api/account/*` response has `Cache-Control: no-store` | R: `notes/R-todos.md#4` |
| LT-91 | Cancel: book a slot more than 2 h away as Sam, `/account/appointments`, "Cancel appointment" | toast, card moves to Past "Cancelled", slot bookable again, claim gone from `malva-slot-claim`; a booking under 2 h away has no button and `POST /api/bookings/<ref>/cancel` returns 409 `code: 'too-late'` | R: `notes/R-todos.md#5` |
| LT-92 | Guest attach (R-07): as guest book with `sam.rivera@example.com`, then sign in as Sam | booking appears; stored with `patientRef`, no `guest`, no `expiresAt`; other-email guest booking stays guest. Confirm `getObject`+`putObject` with `version` accepted for existing object | R: `notes/R-todos.md#6` |
| LT-93 | Predicate `value(guest(email in ("a@b.c", "A@b.c")))` accepted for Custom Objects (else switch `lib/ct/bookings-attach.ts` to `value(guest is defined)` plus in-memory filter) | accepted | R: `notes/R-todos.md#7`, X: `notes/X-todos.md#3` |
| LT-94 | `countOrders()` with `orders().get({ where: customerId="...", limit: 1, withTotal: true })`: `total` returned and scopes allow `view_orders` | as stated | R: `notes/R-todos.md#8` |
| LT-95 | Address book as Sam `/en-US/account/addresses`: add with default tick; first address of an empty book becomes default without tick | `read_customers`: in `addresses`, `shippingAddressIds`, `defaultShippingAddressId` | P: `notes/P-todos.md#1` |
| LT-96 | Remove the default; ZIP "1234"; NY with ZIP 90210; as Alex remove the only address | `defaultShippingAddressId` empty, no promotion, note shown; inline error with focus on ZIP; warning naming state, ZIP and "CA" and nothing stored until "Save anyway"; "No addresses yet" | P: `notes/P-todos.md#2`, `#3`, `#5` |
| LT-97 | `fetch('/api/account/addresses/<another customer's address id>', {method:'DELETE'})`; signed out | 404 `{error:'Not found.'}`; 401 | P: `notes/P-todos.md#4` |
| LT-98 | Confirm `addAddress` with `key` followed by `addShippingAddressId`/`setDefaultShippingAddress` with `addressKey` in one update works; `setDefaultShippingAddress` with no address id unsets the default | as stated | P: `notes/P-todos.md#6` |
| LT-99 | `/en-US/account/profile`: change name (header initials follow), change password; 390 px layouts of account, addresses, profile; sign out clears cart and account keys (next user's cart empty) | as stated | P: `notes/P-todos.md#7`, `#8`, R: `notes/R-todos.md#9`, `#10` |

### Phase H: saved lists, auto-refill, saved cards

Prerequisites: seed from LT-07 (type `mlv-list-line`, policies), scopes `manage_recurring_orders`, `view_recurrence_policies`, `manage_payment_methods`, `manage_shopping_lists`; OA-04 for payment parts; `AUTO_REFILL_ENABLED=true`.

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-100 | `npm run seed:verify` includes the two recurrence-policy checks and the list line type | PASS | T: `notes/T-todos.md#L1` |
| LT-101 | Lists: save RX-77102 lines from `/prescriptions`; `read_shopping_lists` | key `mlv-list-my-medicines-<customerId>`, `customer` set, `deleteDaysAfterLastModification` 360, line custom fields `rxNumber`, `rxLineRef`, `savedUnitPrice`; a foreign list id gives the same 404 as unknown | T: `notes/T-todos.md#L3` |
| LT-102 | "Add all" with both lines; set one line to `refillsLeft` 0 via MC MCP | both in cart; the exhausted one is named "no refills left", the other stays | T: `notes/T-todos.md#L3` |
| LT-103 | Change the catalog price of a saved medicine and reopen the list | "Up/Down $x since you saved it" | T: `notes/T-todos.md#L4` |
| LT-104 | Enable auto-refill on a delivered order or from `/account/auto-refill`; `read_recurring_orders` | `recurringOrderState` Active, StandardSchedule Months 1, `startsAt`/`nextOrderAt` one month out, `cart` expanded with `origin RecurringOrder`, line `recurrenceInfo` = policy + `priceSelectionMode Dynamic` | T: `notes/T-todos.md#L5` |
| LT-105 | Confirm the beta action body `{ action: 'setRecurringPaymentConfiguration', paymentStrategy: 'Checkout', paymentAllocations: [{ paymentMethod: { typeId: 'payment-method', id }, allocation: { type: 'Relative', percentage: 100 } }] }` on the recurring Cart; the expanded cart carries `recurringPaymentConfiguration` | accepted; else only `attachPaymentMethod` in `lib/ct/recurring.ts` changes | T: `notes/T-todos.md#L6` |
| LT-106 | Actions: `setRecurringOrderState` paused/active/canceled, `setSchedule` by policy key, `setOrderSkipConfiguration` `{ type: 'Counter', totalToSkip: skipped + 1 }`; one skip skips exactly one run (is `totalToSkip` cumulative?); `nextOrderAt` disappears while Paused; update during order creation answers 400 `InvalidOperation` | as stated | T: `notes/T-todos.md#L7` |
| LT-107 | Set `AUTO_REFILL_RUN_SECRET` (16+ chars) in app and Netlify; `npx netlify functions:invoke auto-refill-run --headers '{"x-refill-secret":"<secret>"}'` with a refill due within 36 h | counts returned; `malva-refill-log` gains `<recurringOrderId>.<runForDigits>`. RX expired: refill Paused, page "Last run: skipped (...), your prescription has expired."; `refillsLeft` 0: Canceled, "Auto-refill stopped". No header or wrong secret: 401; no env: 503. Public `GET /.netlify/functions/auto-refill-run` starts no run | T: `notes/T-todos.md#L8` |
| LT-108 | Generated orders: after the platform creates an order from a recurring order, run the function again | order gets `MLV-...` number, state `mlv-received` (`transitionState` with `force: true` accepted), `malva-rx` loses one refill with `consumedBy` containing the order id; another run changes nothing; Order query `recurringOrder(id is defined)` valid; order lines carry `rxNumber`/`rxLineRef`/`prescribedQty` | T: `notes/T-todos.md#L9` |
| LT-109 | Dynamic price: change a refilled medicine's catalog price | next generated order uses the new price | T: `notes/T-todos.md#L10` |
| LT-110 | M-T-1 (owner, OA-04): at checkout save a card in the sandbox widget ("Save this card"); `/en-US/account/payment-methods` shows brand and last four only; set another default; remove the default (none default afterwards); pay again with saved card preselected | as stated, never a card number | T: `notes/T-todos.md` M-T-1 |
| LT-111 | Stored `PaymentMethod` shape: where brand and last four live (custom fields vs `name`), `customer` set from the cart's `customerId`, `paymentMethodStatus` Active, `default`. If it reads "Card" with no digits adjust `mapDescriptor` in `lib/ct/stored-methods.ts`; record shape in `PROJECT-FINDINGS.md` | as stated | T: `notes/T-todos.md#L11`, `notes/T-questions.md#20` |
| LT-112 | Default semantics: with two cards call `setDefault true` on the second WITHOUT clearing the first (MC MCP `update_payment_methods`); do both end up default? | record result in `PROJECT-FINDINGS.md` | T: `notes/T-todos.md#L12`, `notes/T-questions.md#21` |
| LT-113 | Delete: `DELETE /payment-methods/{id}?version=` works for a customer's method; Message `PaymentMethodDeleted` produced; deleted default not replaced; removing a card an auto-refill uses (with `confirm=1`) pauses that refill; resume says "Save a payment method first" | as stated | T: `notes/T-todos.md#L13` |
| LT-114 | Cancel of a stored-method payment: S's `cancelPayment` voids an authorization (automated reversals do not work for stored-method payments); refund after capture is manual | recorded | T: `notes/T-todos.md#L14` |
| LT-115 | The widget shows saved cards first and offers "Save this card" for the Application in payment-only mode (may need enabling on the Application or connector) | as stated | T: `notes/T-todos.md#L15` |
| LT-116 | No card data: DevTools on `/account/payment-methods` and `/checkout`: no card input outside the Checkout frame; no card number or token in any `/api/*` answer | as stated | T: `notes/T-todos.md#L16` |
| LT-117 | Cart isolation and home claim: with an active auto-refill `/cart` still shows the shopping cart; with `AUTO_REFILL_ENABLED=true` home shows "Auto-refills you can pause anytime"; confirm a stale `cart.origin` filter `origin="Customer"` is accepted | as stated | T: `notes/T-todos.md#L17`, `#L18` |

### Phase I: funding (allowance, restricted tender, credentials)

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-118 | Re-seed so order and line custom types have the U fields and the allowance and credential data (LT-07 covers this; see `scripts/seed/README.md`); `npm run allowances:reload` (LT-20b) | Sam has the current cycle | U: `notes/U-todos.md` |
| LT-119 | Confirm the API client has `manage_payments` | tender Payments can be created | U: `notes/U-todos.md` |
| LT-120 | With tender Payments already on the cart, the Checkout session is created for the card remainder only and the payment amount equals the remainder | as stated | U: `notes/U-todos.md` |
| LT-121 | Omitting `externalPrice` in `setLineItemPrice` reverts the line to the platform price (the cover revert writes list prices transiently) | as stated | U: `notes/U-todos.md`, `notes/U-missed.md#b5` |
| LT-122 | Place an order as Sam with allowance and restricted option; cancel it | allowance balance drawn down then restored (fixture run: 5000 to 4397 to 5000); Payments with `paymentMethodInfo.method` `allowance` and `restricted-health-account` each get a `Charge` on placement and a `Refund` on cancel; `restoreAllowance`/`restoreRestricted` hooks do the restore once | U: `notes/U-todos.md`, PROJECT-FINDINGS "Funding Payments" |
| LT-123 | Forced-fail and controlled-product states in a browser: `RESOLVER_FORCE_FAIL=1` shows "Cover unresolved" and disables Checkout; Alprazolam and Tramadol (`schedule-iv`) show the requirement; the prescription lookup route guessed during U's check returned 404, find the real route and re-run | as stated | U: `notes/U-todos.md` |
| LT-124 | Netlify: set `RELOAD_ALLOWANCES_SECRET` and `SITE_URL`; confirm the cron in `reload-allowances-scheduled.ts` is registered; never set `RESOLVER_FORCE_FAIL` in production | schedule visible in Netlify | U: `notes/U-todos.md` |

### Phase J: static content, regions, shell, accessibility

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-125 | H shell in a real browser: Tab-order walk, mobile drawer keyboard walk, authenticated header, side-by-side compare with `design/source/Malva App.html`; 390 px | as designed | H: `notes/H-todos.md` |
| LT-126 | Save the SO-01 evidence once `/en-US/_tokens` exists: `plans/evidence/SO-01-navy.png` and `SO-01-white.png` (the screenshot tool refused repo paths; save elsewhere then copy) | pair saved | B: `notes/B-todos.md` |
| LT-127 | Content: visual compare of journal list and article, mobile journal, JS-disabled rendering, screenshots under `plans/evidence/`; set `SITE_URL` | as stated | V: `notes/V-todos.md` |
| LT-128 | Lighthouse: mobile home performance >= 80, accessibility >= 95, SEO >= 90; check contrast of `text-neutral-600` on surface-subtle and `text-navy-100` on navy-700 | thresholds met | M: `notes/M-todos.md#6` |
| LT-129 | Lighthouse accessibility >= 95 on `/en-US/doctors/remote`, `/en-US/search?q=okafor`, `/en-US/doctor/<key>` with dialog open and closed (Escape closes, focus returns to the clicked time) | thresholds met | K: `notes/K-todos.md#6`, L: `notes/L-todos.md#10` |
| LT-130 | 390 px and 1440 px against `design/source/Malva Healthcare.html`: hero 460 px (300 px under 900 px), chip, services grid, band, footer emergency line; doctors list card right column; profile panel under content with three-column time grid | as designed | M: `notes/M-todos.md#5`, K: `notes/K-todos.md#6`, L: `notes/L-todos.md#10` |
| LT-131 | Rendered checks the juniors could only cover with component tests: N select-all, disabled rows, toast; O 380 px summary column, Remove focus ring, struck rows, toast; Q, S, T, U layouts | as designed | N: `notes/N-missed.md#b10`, O: `notes/O-todos.md#11`, T/U: `notes/T-missed.md#b12` |
| LT-132 | `/en-US/account` layouts at 390 px (side nav stacks, result table scrolls inside card); address and profile 390 px | as stated | R: `notes/R-todos.md#10`, P: `notes/P-todos.md#8` |
| LT-133 | Region switching (needs a second region per `site/README.md` "Add a region"): switcher appears with two valid regions; switching with a cart shows toast "Your cart was emptied...", URL re-prefixed, header count disappears; `read_carts` shows the old cart Active in the old currency; add a line creates a new cart in the new currency; switching back finds the old cart (unless expired) | as stated | W: `notes/W-todos.md#1`, `#2`, `#3` |
| LT-134 | A doctor or medication without a price in the new currency shows "Not available in this region" and is absent from search; if the switcher does not appear check the dev log (`getProjectSettings` scope) | as stated | W: `notes/W-todos.md#5`, `#6` |

### Phase K: privacy and retention (destructive, last)

Use only throwaway patients, and the seed admin client (`.env.seed.local`); never print its secret.

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-135 | Register a throwaway patient in the browser; book as that patient and as a guest with the same email; add an Rx line; place an order (demo authorize or real) | data exists to erase | X: `notes/X-todos.md#1` |
| LT-136 | `npm run privacy:access -- <customerId> --out ~/privacy-throwaway.json` (path outside the repo) | Customer 1, Cart/Order/Payment >= 1, `malva-booking` 2, `malva-rx`/`malva-lab` 0, `malva-dispense-ledger` >= 1, `malva-order-attempt` >= 1, `malva-slot-claim` 2 | X: `notes/X-todos.md#1.1` |
| LT-137 | Verify the predicates live: `carts`/`orders` by `customerId`; `payments`, `reviews`, `shoppingLists`, `quotes`, `quoteRequests`, `stagedQuotes` by `customer(id=...)`; `businessUnits` by `associates(customer(id=...))`; `messages` by `resource(id in (...))`; `recurringOrders` by `customer(id=...)`; custom objects `value(guest(email in (...)))` and `value(recurringOrderId in (...))` | accepted; a 400 names the fix, adjust `QUERIES` in `scripts/privacy/lib.ts` and `collect.ts` | X: `notes/X-todos.md#3` |
| LT-138 | `npm run privacy:erase -- <customerId> --dry-run`, then `npm run privacy:erase -- <customerId> --confirm <customerId>`; attach ids from the log to the PR (ids only) | erase completes | X: `notes/X-todos.md#1.2`, `#1.3` |
| LT-139 | MC MCP `read_customers`, `read_carts`, `read_orders`, `read_payments`, `read_custom_objects` (containers `malva-booking`, `malva-dispense-ledger`, `malva-order-attempt`, `malva-slot-claim`); `read_project` | nothing for that customer; `messages.enabled` false | X: `notes/X-todos.md#1.4` |
| LT-140 | Recurring orders: a cancelled recurring order for an erased customer is acceptable, or ask commercetools support for RecurringOrder erasure (QR-021); check the recurring order after erase | decision recorded | X: `notes/X-todos.md#4` |
| LT-141 | Audit after a purchase: `npm run privacy:audit`; then paste a sig string into a cart note in the MC and re-run (expect exit 1), then delete the note | clean; then exit 1 | X: `notes/X-todos.md#2` |
| LT-142 | Retention function: Netlify env `RETENTION_SECRET`; `npm run privacy:retention -- --dry-run`; `curl -X POST -H "x-malva-retention-secret: $RETENTION_SECRET" https://<site>/.netlify/functions/retention`; then a wrong secret. Schedule `30 3 * * *` UTC | 200 with counts; 401 | X: `notes/X-todos.md#5` |
| LT-143 | Network trace of a full journey (search, book, order) | no URL contains a lab value, RX content or reason text | X: `notes/X-todos.md#7` |

### Phase L: release build

| Step | Command / action | Expected | Source |
| --- | --- | --- | --- |
| LT-144 | Release pipeline deletes `app/api/health/` before `next build` (Y creates the step); then `NODE_ENV=production`: `curl -i localhost:3000/api/health` in a build that kept it returns 404 | as stated | D: `notes/D-todos.md` steps 5 and Other |
| LT-145 | `npm run verify:build` | check, build, bundle scan (no secret in client bundle) and health-absent check pass | L: `notes/L-todos.md#8`, A: `notes/A-missed.md#b2` |
| LT-146 | Production site: `/en-US/_tokens`, `/en-US/_boom`, fixtures and the "DEMO payment" banner are absent; `cache-control: private` on `/prescriptions`; `no-store` on `/api/account/*` | as stated | I, K, Q, N, R (`notes/I-questions.md#7`, `notes/N-missed.md#b9`) |
| LT-147 | Clean-clone dry run for the PR: `git clone`, `cp .env.example .env.local`, `npm ci`, `npm run check`, `npm run build`, `node scripts/check-bundle.mjs`; paste into the PR description | pass | A: `notes/A-todos.md` |

### Phase M: owner-only items

Only the owner sets PASS/FAIL (`TODO-MANUAL-TESTING.md`).

| Step | Item | Source |
| --- | --- | --- |
| LT-148 | SO-01 label colour decision (QR-015) | B, H |
| LT-149 | SO-02 mobile menu look and feel (QR-016) | H |
| LT-150 | SO-03 look of error pages, address book, sign-in create mode, FAQ/contact/about/policies/journal (QR-016) | I, J, P, V |
| LT-151 | SO-04 consent and retention wording, video "Join" lines, "Booking as a guest" copy, privacy policy, retention periods (QR-006, QR-007, QR-024) | L, X, V |
| LT-152 | Confirm the real API client scopes against section 3 (OA-02, QR-004) | A, D, F, G, N, O, Q, T |
| LT-153 | M-Q-1 real card test (LT-69 to LT-72) | Q |
| LT-154 | M-T-1 saved card test (LT-110) | T |
| LT-155 | Sign-off that the order page and checkout page look matches the design (part of the workstream sign-off) | Q, S |

---

## 5. Things that may fail live

Every assumption written from documentation or memory and never run. "Depends" lists the file that breaks if the assumption is wrong. The step column points to the check.

### 5.1 commercetools API shapes

| Assumption | Depends | Check | Source |
| --- | --- | --- | --- |
| Custom Object keys allow `[-_~.a-zA-Z0-9]`; slot-claim key `<doctorKey>.<mode>.<YYYYMMDDTHHmmssZ>` is valid | `lib/clinical/slots.ts` (`slotClaimKey`) | LT-15 | `notes/F-questions.md#2` |
| `POST custom-objects` with `version: 0` is create-only (409 if it exists); `putObject` with a `version` is optimistic | `lib/ct/bookings.ts`, `lib/ct/custom-objects.ts`, N's ledger, counter, order-attempt locks | LT-15, LT-45, LT-74 | `notes/F-questions.md#3`, `notes/N-questions.md#9` |
| Zone `usa` has the key `usa`; zone `Location.state` takes `NY`/`TX`/`IL` | `scripts/seed/data/shipping.ts`, Q's same-day matching | LT-06, LT-67 | `notes/E-questions.md#4`, `#5` |
| Price channel needs `ProductDistribution` | seed channels | LT-07 | `notes/E-questions.md#6` |
| `masterVariant.prices[*].channel` expands on search and projection (`channel.obj.key`) | `lib/mappers`, `lib/ct/doctors.ts`, N's `getCatalogBySku` | LT-35, LT-54 | `notes/G-questions.md#8`, `notes/K-todos.md#2`, `notes/L-todos.md#2`, `notes/N-todos.md#5` |
| Native limit upper-bound error code `LineItemQuantityAboveLimit` with `maxCartQuantity` | `lib/dispense/limit-errors.ts` (`mapLimitError`) | LT-55 | `notes/N-questions.md#8` |
| Inventory query `sku in (...) and supplyChannel is not defined` returns `availableQuantity` and `custom.fields.expiryDate` | `lib/ct` `getSupplyBySku` | LT-53 | `notes/N-todos.md#4` |
| Cart draft with `shippingMethod` by key and country-only address is accepted; platform keeps method/tax after address change | `lib/ct/cart.ts` (`getOrCreateCart`) | LT-57, LT-68 | `notes/O-todos.md#3`, `notes/Q-todos.md#L6` |
| `setLineItemCustomField` for `lastSeenUnitPrice`, and the Q fields, exist because the seed updated (not skipped) the existing type | `lib/ct/cart-read.ts`, `lib/ct/checkout` line records | LT-08 | `notes/O-todos.md#1`, `notes/Q-todos.md#L8` |
| `where=customerId=:id and cartState="Active"` with `var.id` is allowed; `origin="Customer"` filter | `lib/ct/cart.ts` (`fetchActiveCart`) | LT-62, LT-117 | `notes/O-todos.md#2`, `notes/T-questions.md#16` |
| `anonymousCart` and `anonymousCartSignInMode` work for a session cart without `anonymousId` | `lib/ct/identity.ts` login/register | LT-48 | `notes/J-todos.md#6` |
| `GET /customers/email-token={token}` for fresh, consumed and expired tokens | `lib/ct/identity.ts` (`confirmEmail`) | LT-32 | `notes/J-questions.md#7` |
| `addAddress` with `key`, then `addShippingAddressId`/`setDefaultShippingAddress` by `addressKey` in one update; unset default with no address id | `lib/ct/customer-update.ts`, addresses | LT-98 | `notes/P-todos.md#6` |
| `POST /orders` with `state` key accepted as initial state; duplicate `orderNumber` answers 400 `DuplicateField`; String custom field length for `suppliedLots` | `lib/ct/orders.ts`, `order-number.ts` | LT-73 | `notes/Q-todos.md#L7`, `#L8` |
| `shipping-methods/matching-cart` returns `isMatching` rates for NY/TX/IL | `lib/ct` shipping, checkout | LT-67 | `notes/Q-todos.md#L5` |
| Order query `where: id=... and customerId=...` with expands, `sort: createdAt desc`, `limit 50` | `lib/ct/orders-read.ts` | LT-81 | `notes/S-todos.md#3` |
| `transitionState` `packed-shipped -> mlv-cancelled` refused by the state machine (400 `InvalidOperation`) | S cancel `too-late` mapping | LT-84 | `notes/S-todos.md#6` |
| `addTransaction` `Refund/Initial` on a Payment with only an Authorization; connector may refuse a refund without a charge | `lib/ct/order-cancel.ts` | LT-85 | `notes/S-todos.md#7` |
| `changeShipmentState` accepts `Partial` | `scripts/seed/advance-order.ts` | LT-79 | `notes/S-todos.md#8` |
| `countOrders` with `withTotal: true` returns `total` and `view_orders` is granted | `lib/ct/account-summary.ts` | LT-94 | `notes/R-todos.md#8` |
| Custom Object nested predicate `value(guest(email in (...)))` | `lib/ct/bookings-attach.ts`, privacy collectors | LT-93, LT-137 | `notes/R-todos.md#7`, `notes/X-todos.md#3` |
| `getProjectSettings` returns countries, currencies, languages and the client has `view_project_settings` | `lib/ct/project.ts`, `/api/locale`, `lib/regions.ts` | LT-25, LT-134 | `notes/G-missed.md#b7`, `notes/G-todos.md`, `notes/W-todos.md#6` |
| Recurring Orders: beta `setRecurringPaymentConfiguration` body; `recurringPaymentConfiguration` on the expanded cart; `setOrderSkipConfiguration` `Counter` `totalToSkip` cumulative; Order query `recurringOrder(id is defined)`; `transitionState` with `force: true`; recurring order update during order creation answers 400 `InvalidOperation` | `lib/ct/recurring.ts` (`attachPaymentMethod`), `netlify/functions/auto-refill-run.ts`, `lib/refill` | LT-105 to LT-108 | `notes/T-todos.md#L6` to `#L9` |
| `PaymentMethod` shape for stored cards (custom fields `brand`/`last4`/`expMonth`/`expYear` or `name`), `customer` from the cart's `customerId`, `setDefault` per method, `DELETE` with `version`, `PaymentMethodDeleted` message | `lib/ct/stored-methods.ts` (`mapDescriptor`), `lib/ct/checkout-provider.ts` | LT-111 to LT-113 | `notes/T-questions.md#20`, `#21`, `notes/T-todos.md#L11` to `#L13` |
| Shopping Lists: `deleteDaysAfterLastModification` 360 and custom fields on line items | `lib/ct/lists.ts`, seed type `mlv-list-line` | LT-101 | `notes/T-todos.md#L3` |
| `setLineItemPrice` without `externalPrice` reverts to the platform price; Checkout payment amount with tender Payments already on the cart | `lib/funding/*`, `lib/ct/checkout` | LT-120, LT-121 | `notes/U-todos.md` |
| GDPR predicates per resource (carts/orders `customerId`; payments etc. `customer(id=)`; business units `associates(customer(id=))`; messages `resource(id in (...))`; recurring orders `customer(id=)`; discount codes filtered in memory) and `dataErasure=true` on each | `scripts/privacy/lib.ts` (`QUERIES`), `collect.ts` | LT-137, LT-138 | `notes/X-questions.md#4`, `notes/X-todos.md#3` |
| `project.messages.enabled` is false in the real project | `seed:verify` check | LT-14 | `notes/X-todos.md#6` |
| Cancelled RecurringOrder is acceptable erasure (it is not on the `dataErasure` list) | `scripts/privacy/erase-patient.ts` | LT-140 | `notes/X-questions.md#2` |

### 5.2 Product Search

| Assumption | Depends | Check | Source |
| --- | --- | --- | --- |
| Enum attribute paths `variants.attributes.<name>.key`; set of enum with `fieldType: set_enum` (`modes`); `rxOnly` boolean | `lib/ct/search-query.ts` | LT-34 | `notes/K-questions.md#2`, `notes/G-questions.md#7` |
| Distinct facets named `specialty`, `city`, `modes` return buckets | `lib/ct/search-query.ts`, K list | LT-34 | `notes/K-todos.md#1` |
| Price sort uses `variants.prices.centAmount` min/max filtered to the currency | `lib/ct/search-query.ts` | LT-34 | `notes/G-questions.md#7` |
| `variants.prices.currencyCode` `exact` filter matches doctors priced only on channels `mlv-remote`/`mlv-office`; otherwise search returns nothing for doctors | `buildSellableFilter` in `lib/ct/search-query.ts` | LT-34, LT-134 | `notes/W-todos.md#4` |
| `wait-for-search`: `prefix` on `key`; fallback `exists` on `key` | `scripts/seed/wait-for-search.ts` | LT-10 | `notes/E-questions.md#7` |
| `fullText` language `en-US` (not `en`) returns "Okafor" | `scripts/seed/verify.ts`, `lib/ct/search-all.ts` | LT-10, LT-37 | `notes/E-questions.md#7b` |
| `fuzzy` plus `fullText` with `boost` inside `or`; `caseInsensitive` `exact` on `variants.sku` | `lib/ct/search-all.ts` | LT-37 | `notes/K-todos.md#4`, `notes/K-questions.md#10`, `#11` |
| `SCRIPT_BY_LANGUAGE` needs extending if a second language is added | `lib/ct/search-all.ts` | when W adds a second language | `notes/K-todos.md#5` |
| Product statistics (`reviewRatingStatistics`) roll up within seconds | `getRatingStatistics`, `seed:verify` | LT-14, LT-17 | `notes/F-todos.md#2` |

### 5.3 Checkout and payments

| Assumption | Depends | Check | Source |
| --- | --- | --- | --- |
| Payment-only mode does not create orders | `lib/ct/orders.ts` (`placeOrder`) | LT-63 | `notes/Q-todos.md#L1` |
| Browser SDK message names `payment_started`, `payment_completed`/`checkout_completed`, `payment_cancelled`, `payment_failed` | `hooks/use-place-flow.ts`, `components/checkout/PaymentCard.tsx` | LT-64 | `notes/Q-todos.md#L2` |
| `data-ctc-selector="paymentButton"` outside the payment card works as the custom pay button | `components/checkout/*` | LT-65 | `notes/Q-todos.md#L3` |
| Checkout attaches the Payment to the cart at authorization; amount equals `taxedPrice.totalGross` | `getAuthorization` | LT-66 | `notes/Q-todos.md#L4` |
| Authorization notification arrives before the server reads the Payment (else false `PAYMENT_REQUIRED`); a re-click does not double charge | `placeOrder` | LT-75 | `notes/Q-missed.md#b6` |
| Release works through Payment Intents `cancelPayment` (`manage_checkout_payment_intents`), also for stored-method payments | `lib/ct/checkout-provider.ts` | LT-75, LT-114 | `notes/Q-questions.md#11`, `notes/T-todos.md#L14` |
| The Stripe sandbox requires or does not require auto-capture (owner decision QR-002) | S cancel, README | LT-85 | `notes/Q-questions.md#18` |
| Widget offers saved cards and "Save this card" when the cart has `customerId` | T hint card | LT-115 | `notes/T-questions.md#19`, `notes/T-todos.md#L15` |
| Checkout `Sessions` and `Payment Intents` API call shapes (adapter written from docs, unit-tested with injected `fetch`) | `lib/ct/checkout-provider.ts` | LT-69 | `notes/Q-questions.md#2` |

### 5.4 Environment and hosting

| Assumption | Depends | Check | Source |
| --- | --- | --- | --- |
| Netlify scheduled functions can call the app with a secret header; a public GET starts nothing | `netlify/functions/*` | LT-107, LT-124, LT-142 | `notes/T-questions.md#10`, `notes/U-todos.md`, `notes/X-todos.md#5` |
| `URL` (Netlify) or `SITE_URL` gives the origin the functions call | `auto-refill-run.ts`, `reload-allowances-scheduled.ts`, `retention-scheduled.ts` | LT-107 | `notes/U-todos.md` |
| `outputFileTracingIncludes` for `./content/**/*` makes runtime file reads work on Netlify | `next.config.ts`, `lib/content.ts` | LT-127 | `notes/V-questions.md#9` |
| `seed:images` Pexels endpoint (undocumented) still answers | `scripts/seed/update-images.ts` | LT-11 | `notes/E-todos.md`, `notes/E-questions.md` |
| Messages disabled and Subscriptions not needing them | `seed:verify` | LT-14 | `notes/X-questions.md#13` |
| The Chrome DevTools connector allows screenshots to repo paths (it refused) | evidence capture | LT-126 | `notes/B-todos.md`, `notes/H-todos.md` |

---

## 6. Step count

LT-01 to LT-155 (with LT-20b and LT-86b as sub-steps): 157 steps, of which 8 are owner-only (Phase M). 
