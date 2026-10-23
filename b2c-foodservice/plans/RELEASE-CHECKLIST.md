<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Release checklist (workstream Q)

Final gate before the owner deploys the Malva Coffee storefront. The team prepares and verifies; the owner performs deploys, creates credentials and closes owner rows. `[x]` means verified with the evidence named in the line (path under `plans/evidence/Q/`); `[ ]` means open, with the row or task that closes it. Update the status in the line, never delete a line.

**Status of 2026-10-22 (workstream Q, commit of the last `ws-q:` commit, see `plans/evidence/Q/FINAL-REPORT.md`):** everything that can be proven offline against the mock is `[x]` with its evidence path; what is `[ ]` needs the live project, the hosted Checkout with Stripe, a real device, a person or the deploy, and points at its owner row in `plans/OWNER-HANDOFF.md`.

Run order: 1) section A (offline, from a clean clone), 2) section B (live project and browser sweeps), 3) section C (owner rows), 4) deploy with the skill (section D), 5) post-deploy smoke (section E), 6) cleanup and known gaps (section F). Open owner rows of the whole project are in `plans/TODO-MANUAL-TESTING.md`.

## A. Gates that run offline (no credentials, no commercetools)

- [x] Clean clone: `git clone --no-hardlinks <repo> <scratch>`, check out the release commit, `cd storefront && npm ci && npm run check && npm run build`; same in `seed/` (`npm ci && npm run check`). Result in `plans/evidence/Q/clean-clone.md` (versions of Node 22, Next 16.x, next-intl, SDK), repeated on the final commit of this workstream. Task Q-03. Repeat on the release commit before the deploy (Q-Q-1).
- [x] `node plans/verify-plan.mjs --strict --scenarios --tests` exits 0 (`plans/evidence/Q/verify-plan-output.txt`): order of workstreams valid, every spec primary in exactly one workstream, every scenario of every applicable spec has a ticked checkbox whose named test exists and passed in the Vitest JSON report. Output in `plans/evidence/Q/spec-coverage.md`. Tasks Q-01, Q-02.
- [x] `node plans/verify-plan.mjs --manual` exits 0 for structure (every owner row has who, when, steps, expected, status; ids unique; every OA, SO or M id named in a plan file exists).
- [x] Bootstrap scenarios proved: forbidden version fails `check` (try `next` 15.x in a scratch copy), missing or short `SESSION_SECRET` stops the server with a message naming the variable, wrong `EXPECTED_PROJECT_KEY` stops it naming both keys, client bundle scan finds no secret, lint forbids `lib/ct` in a client file. `plans/evidence/Q/bootstrap.md`.
- [x] `npm audit --omit=dev` in `storefront/` and `seed/`: no high or critical, or each accepted by the owner in writing (M-Q-05). `plans/evidence/Q/npm-audit.txt`: 0 vulnerabilities in both apps. Run again on the release day (the advisory database moves).
- [x] Secrets: `git ls-files` shows only `.env.example` files; `node scripts/check-bundle-secrets.mjs` (storefront, after `npm run build`) passes; history scan finds no secret (`plans/evidence/Q/secrets.md` sections 1 and 6). Task Q-10.
- [x] No `TODO` or `FIXME` in code without an `IDEAS.md` entry (`rg -n "TODO|FIXME" storefront seed --glob '!node_modules'`): the only matches are the file name `TODO-MANUAL-TESTING.md` in strings.
- [x] Unit test suite green with the JSON report saved (`npx vitest run --reporter=json --outputFile=../plans/evidence/Q/vitest.json`): 230 files, 1932 tests, 0 failed; seed 12 files, 143 passed, 4 todo.

## B. Live project and browser sweeps

- [ ] (offline part done; live part blocked on OA-01, OA-S-04, M-Q-03) Data sweep against `SEED-PLAN.md` through the commercetools MCP or `seed verify`; second `npm run seed` reports `0 change(s)`. `plans/evidence/Q/data-sweep.md`. Task Q-04.
- [x] Responsive pass at 1440, 1080, 900, 820, 700, 520 and 375 on every page in `plans/evidence/Q/routes.md`: no horizontal scroll, breakpoint behaviours of `design-tokens-and-components` observed. `plans/evidence/Q/responsive/` (24 pages, 168 runs, all pass; one breakpoint question, Q-Q-21). Tasks Q-05, Q-06.
- [x] (automated and keyboard parts; the VoiceOver pass is M-Q-02) Accessibility pass: contrast table, labels, focus, reduced motion, keyboard, Lighthouse accessibility, SEO and best practices at least 95 on the page list (or each lower score explained). `plans/evidence/Q/a11y/` (Lighthouse accessibility 100 on 20 pages; SEO below 95 only on pages that are `noindex` on purpose, listed in `known-issues.md`). Tasks Q-07, Q-08. Token decision: M-E-02 (workstream E).
- [x] (J0 to J14 on the mock, hosted payment simulated; J15 blocked on OA-K-a) End-to-end journeys J0 to J15 of `plans/E2E-JOURNEYS.md` run on a release build with read-backs. `plans/evidence/Q/journeys.md`. Task Q-09.
- [x] Security review (section 6 of workstream Q): BFF boundary, bundle scan, cookie flags, 401 matrix, IDOR matrix, CSRF and origin check, open redirect, XSS (reviews, contact, search, JSON-LD), headers and CSP, rate limits, logging. `plans/evidence/Q/security.md`: no open high finding; the dev routes (F-3) are open by design until `npm run predeploy` is run. Tasks Q-10 to Q-13.
- [x] (two misses accepted pending M-Q-05) Performance: traces for home, listing, product, cart; budgets met or each miss explained; cache headers verified. `plans/evidence/Q/perf.md`: the product page's script is 212 kB against 200 kB (Q-Q-19) and the mobile Lighthouse LCP is 3.1 to 4.6 s against 2.5 s because of the placeholder pictures (Q-Q-20); the traces are 0.55 to 0.63 s. Task Q-14.
- [ ] (blocked: OA-04, OA-K-a, M-Q-08) Full hosted Checkout with Stripe verified with the test card (J1, J2, J3, J15) and a declined card; the Canada journey is ship-only.
- [x] (proven on the mock; the live check of the discount code on a mixed bag is M-Q-09) Mixed bag outcome (mixed bags are required, D-033: one order with multiple shipping, or the documented fallback that still shows every line in its cluster) matches `plans/DECISIONS.md`: complete-per-group, every line in its cluster (J2, `journeys.md`).

## C. Deployment preparation (owner performs, Claude verifies)

| # | Item | How verified | Row | Status |
| --- | --- | --- | --- | --- |
| 1 | Netlify site created (hosting is Netlify, D-038) | `/commercetools:nextjs-deploy-netlify` verifies credentials then hands off to the host's skill | OA-05 | open: owner (`DEPLOY-NETLIFY.md` section 6) |
| 2 | Production API client for the storefront with exactly the scopes in `storefront/.env.example` (including `manage_recurring_orders`, `view_recurrence_policies`) and nothing admin; values only in the host's environment settings | `check-secrets`; scopes list compared with the `.env.example` comment; owner never pastes values into chat | OA-01, OA-02 | open: owner; the scope list and the gate are ready (`predeploy` fails on an admin scope or a missing one) |
| 3 | `SESSION_SECRET` of at least 32 random characters, different per environment | `predeploy-check` (length only, value never printed) | OA-N-Q1 | gate ready; owner sets the value (OA-N-Q1) |
| 4 | `EXPECTED_PROJECT_KEY` equals `CTP_PROJECT_KEY` for the target project | `predeploy-check` (names of both keys only) | OA-N-Q1 | gate ready; owner sets the value (OA-N-Q1) |
| 5 | Hosted Checkout application (full checkout flow) and Stripe connector set for the production origin and allowed origins; names of the variables only in `.env.example` | owner row; J1 on the deployed URL | OA-04 | open: OA-04, OA-K-a, OA-K-b; the CSP origins come from M-Q-08 |
| 6 | Contact and feedback receivers set (`CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_TOKEN`, `FEEDBACK_WEBHOOK_URL`) | M-P-01 on the deployed URL | OA-P1 | gate ready (`https` only); owner sets the values (OA-P1) |
| 7 | Site origin variable set for sitemap and metadata | `/sitemap.xml` shows the production origin | OA-05 | open: owner sets `NEXT_PUBLIC_SITE_URL` (its name is in `.env.example`) |
| 8 | Node 22 set on the host (`.nvmrc`, and the host's Node setting); build command `npm run build`; base directory `storefront` | host build log | OA-05 | ready: `storefront/netlify.toml` sets base `storefront`, `npm run build`, Node 22; `.nvmrc` is 22 |
| 9 | Debug and dev switches off: no `scripts/dev/*` shipped, no test-only routes, no dev logging flags; no `NEXT_PUBLIC_*` that is not meant to be public | `predeploy-check`, `rg` | | gate ready; **the dev routes are still in the tree on purpose**, so `npm run predeploy` fails until they are removed (`DEPLOY-NETLIFY.md` section 3) |
| 10 | `app/api/health/route.ts` removed or disabled (spec "Deploy gate") | `predeploy-check` fails while it exists; `GET /api/health` is 404 on the deployed URL | | open by design, same as 9; the gate names the route |
| 11 | Real legal text, contact channels and images (policies no longer draft) | owner rows | SO-01, SO-02, SO-P3, SO-P5 | open: owner |
| 12 | Demo accounts: the seeded demo customers share one known password; decide to keep (demo site, documented) or rotate and hide | owner decision recorded | SO-Q2 | open: owner decision (Q-Q-8) |
| 13 | Commercetools project is the demo project, not a production tenant with real customers; sample data cleanup (D-019) reviewed | `plans/evidence/Q/data-sweep.md` | OA-07 | open: owner; the offline sweep is in `data-sweep.md`, the live one waits for OA-01 |
| 14 | HTTPS only, HSTS, `Secure` session cookie on the deployed URL | `curl -I`, `get_network_request` | | ready in code (HSTS and `Secure` cookies in production builds, QFX-31, QFX-38); to be proven on the URL (M-Q-10) |
| 15 | Rollback: the host's previous deployment can be restored in one click; commercetools data changes are additive (seed idempotent) | note in `plans/evidence/Q/FINAL-REPORT.md` | | documented: `DEPLOY-NETLIFY.md` section 8 and `FINAL-REPORT.md` |
| 16 | Monitoring and alerting: none built; recorded as a known gap | `FINAL-REPORT.md` | M-Q-06 | recorded as a known gap; owner accepts with M-Q-06 |

## D. Deploy (owner)

1. Run `node plans/verify-plan.mjs --release` (all workstreams `Done`, all owner rows `DONE`, `PASS` or `WAIVED`).
2. In the storefront folder run `npm run predeploy` (the deploy gate of Q-15) and fix what it reports.
3. Deploy with the skill: `/commercetools:nextjs-deploy-netlify`.
4. Tell Claude the URL; Claude runs section E.

## E. Post-deploy smoke (Claude runs it on the deployed URL)

- [ ] `GET /en-US` and `/en-CA` return 200; `/en-US/does-not-exist` returns 404 with the localized page; `GET /api/health` returns 404.
- [ ] `curl -I` shows the security headers (CSP, nosniff, referrer policy, permissions policy, HSTS) and no `x-powered-by`.
- [ ] Session cookie has `HttpOnly`, `Secure`, `SameSite=Lax` after sign-in.
- [ ] Sign in as one seeded shopper per market (US and Canada); sign out.
- [ ] One order round trip (J1 in the US) with the test card, then its cleanup entry in `test-data.md`.
- [ ] One subscription round trip (J3, J4) and the account tab.
- [ ] Contact form delivers to the real receiver (M-P-01).
- [ ] Lighthouse accessibility, SEO and best practices and a performance trace on home, listing and product (`plans/evidence/Q/deployed/`).
- [ ] No console errors and no failed requests on the pages above.

## F. Test data and known gaps

- [ ] (blocked: needs the live project, OA-01 and M-Q-04; the helper and its dry run are tested against the in-memory fake, every test record of Q lives only in the mock) Purge dry run read by the owner (`plans/evidence/Q/purge-plan.txt`, M-Q-04), then `--apply --confirm <projectKey>`; no `TST-` or `tst-` leftovers except those accepted in `plans/evidence/Q/leftovers.md` (orders cannot be deleted).
- [ ] (blocked: OA-S-04) Second `npm run seed` after the purge reports `0 change(s)`.
- [ ] (listed in `plans/evidence/Q/FINAL-REPORT.md` section 7; waits for the owner's written yes) Known gaps accepted by the owner (M-Q-06): no monitoring or alerting; rate limits are per instance unless the host provides them; renewal payment for subscriptions depends on Checkout recurring payments (public beta); no cookie banner (no third-party scripts); content is in the repository (a text correction needs a deploy); newsletter and any other route listed as "not built" in `plans/evidence/Q/fixes.md`; in-store selling is out of scope (D-001).
- [ ] (not run: only when the repository is published) If the repository will be published: run the `ct-builders-readiness` skill and keep its report out of the published tree (`plans/evidence/Q/PUBLISH-READINESS.md`); MIT and SPDX headers on every source file, no customer or internal names, `design/export/` decision by the owner.
- [ ] (open: SO-Q2; the route answers 404 unless `DEMO_LOGIN_ENABLED=true`) Demo sign-in (D-040): owner confirms `DEMO_LOGIN_ENABLED` is `true` only on demo deployments and `DEMO_LOGIN_PASSWORD` is set in Netlify as a secret.
