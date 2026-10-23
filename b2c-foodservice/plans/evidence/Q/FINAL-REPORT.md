<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Final report of workstream Q (quality and release)

Written 2026-10-22 on branch `ws/q-quality`, code final at commit `aca6adcd`. Index of the evidence: `README.md`. The owner's list of what is left: `plans/OWNER-HANDOFF.md`. The deploy runbook: `plans/DEPLOY-NETLIFY.md`. The gate list: `plans/RELEASE-CHECKLIST.md`.

## 1. Verdict

The storefront is **ready for review and for the owner's live steps, not yet for a deploy**. Everything that can be proven without the live project, the hosted Checkout with Stripe, a real phone or a person is proven, with its evidence: the code builds from a clean clone, 1933 storefront tests and 143 seed tests pass, 24 pages pass at 7 widths, accessibility scores 100 on 20 audited pages and the contrast, keyboard and dialog runs find nothing open, 15 journeys (J0 to J14) were walked end to end against the local mock commercetools, the security review has no open high finding, and 44 defects found along the way are fixed. Three things stand between this and a launch: the payment path has never run against the real hosted Checkout (J15 and the payment step of J1 to J3 are simulated), the discount code on a mixed bag shows one total and charges another in the mock (question Q-Q-16, row M-Q-09: **do not launch codes on mixed bags before the live check**), and the dev routes are still in the tree on purpose, so `npm run predeploy` fails until the hand tests end.

## 2. What was verified

| Area | How | Result | Evidence |
| --- | --- | --- | --- |
| Clean clone | fresh clone, `npm ci`, `npm run check`, `npm run build`, `npm run verify:build`, seed `npm ci` and `check`, `npm audit --omit=dev` | pass (numbers in section 5) | `clean-clone.md`, `bootstrap.md` |
| Bootstrap scenarios | forbidden versions, missing secret, wrong project, bundle scan, server import in a client file, deploy gate | pass; one defect (server stayed up on a bad environment) fixed | `bootstrap.md` |
| Spec scenarios | every scenario of every applicable spec: 260 on disk, 256 covered by a named, passing test or a written reason, 4 blocked on owner rows, 0 uncovered | pass | `spec-coverage.md`, `verify-plan-output.txt` |
| Data sweep | the seed against `SEED-PLAN.md` by 143 tests on an in-memory fake; read-only reads of the live project settings | offline pass; the live sweep and the second seed run need OA-01 and OA-S-04 | `data-sweep.md` |
| Responsive | 24 pages at 1440, 1080, 900, 820, 700, 520, 375: overflow, clipped elements, target size, headings, landmarks, console | 168 of 168 pass; breakpoints read as min-width (question Q-Q-21) | `responsive/` |
| Accessibility | contrast (3971 text nodes, the hero gradient pixel by pixel), skip link, focus ring on 209 stops, focus not obscured, dialogs, mega menu, forms, status messages, reduced motion, reflow at 640 and 320 px, text spacing, Lighthouse | pass after fixes; VoiceOver and real photographs left to a person | `a11y/` |
| Journeys | J0 to J14 at 1440 px and, where the script asks, at 375 px, with read-backs; the browser recipes of E, H, I, K, L, M marked "not run in a browser" | pass after fixes; J15 blocked on OA-K-a; the payment step simulated the way the platform does it | `journeys.md`, `plans/evidence/{E,H,I,K,L,M}/browser-run-q.md` |
| Security | S1 to S18: boundary and secrets, cookies, 401 and IDOR matrix of all 45 route files, same-origin guard, XSS payloads, headers and CSP, limiter, logging, dependencies, history scan | no open high finding; findings fixed (section 3); dev routes open by design | `security.md`, `401-matrix.md`, `secrets.md`, `npm-audit.txt` |
| Performance | traces (desktop, mobile with 4x CPU and Fast 4G), Lighthouse CLI before and after, requests and bytes per page, cache headers | budgets met except two, both recorded | `perf.md` |
| Deploy gate | `npm run predeploy` with every check and its tests; the runbook | the gate works and lists exactly what to remove; passes on a scratch copy once removed | `bootstrap.md`, `plans/DEPLOY-NETLIFY.md` |

## 3. Defects found and fixed (44)

Every fix has an id in `fixes.md` with its commit, and a unit test wherever the cause can be tested without a browser (the test names are in the commits); a defect that only shows in a browser names the journey or run that found it. The ones that mattered most:

- **A market switch lost the bag** (QFX-24, serious): a prefetch of an old-market link moved the session back and dropped the cart. The proxy now writes cookies only for a real page load; Next.js strips its own prefetch headers before the proxy, so the browser's `Sec-Fetch-Dest` decides.
- **The last payment of a mixed bag left its lines in the old bag** (QFX-12): paid items came back at the next sign-in.
- **A server with an invalid environment stayed up** answering 500 on every route (QFX-30): it now exits with 1 in production after naming the variable.
- **Every link prefetched its page on every visit** (QFX-05, QFX-22): 49 requests on the home page, 60 on the cart; now 25 and 25.
- **Dialogs**: focus did not return to the opener where the browser does not focus buttons on click (QFX-14), a console warning on close (QFX-15), and Tab left the store picker because a radio group is one tab stop (QFX-39).
- **Accessibility**: document titles on error and account pages (QFX-08, QFX-19), names that did not contain their visible text (QFX-03, QFX-29), focus hidden under the sticky header (QFX-04), 24 px targets (QFX-07, QFX-10), a skipped heading level (QFX-40), the hero eyebrow at 4.43:1 on its gradient (QFX-41, invisible to axe), the mega menu not taking focus on ArrowDown (QFX-42).
- **Search and sharing**: title and description were streamed into the body so audits and previews saw none (QFX-28); no canonical address (QFX-33).
- **Layout shift**: the footer jumped down when the account list arrived, 0.07 to 0.21 on a phone (QFX-43).
- **Security hardening**: `Secure` on three cookies (QFX-31), `Retry-After` on the review limit (QFX-32), no secret header in an SDK error (QFX-35), the bundle scan reads the page payloads (QFX-36), more deploy-gate checks (QFX-37), HSTS (QFX-38).
- Smaller: the cart summary subtotal and sticky box (QFX-06, QFX-18), subscription labels (QFX-13), the product page stock hint (QFX-26), seed grammar (QFX-27), a test that depended on the shell environment (QFX-44).

## 4. Open defects and decisions

| id | What | Next step |
| --- | --- | --- |
| QO-01 | A discount code on a mixed bag: the Review total and the sum of the payments differ because the code is on the first payment only (Q-Q-16, K's rule Q-K-02c) | live check M-Q-09, then workstream K decides; blocks launch of codes on mixed bags |
| QO-02 | An unknown product or category answers HTTP 200 with `noindex`, and a page past the last answers 200 (Q-Q-18) | the lead; default keep |
| QO-03 | Mobile Lighthouse LCP 3.1 to 4.6 s (placeholder pictures) and the product page script 212 kB against 200 kB (Q-Q-19, Q-Q-20) | re-measure with real images (Q-17); owner accepts with M-Q-05 |
| QO-04 | `app/api/health`, `app/api/dev`, `app/[locale]/dev` are still there | owner, `plans/DEPLOY-NETLIFY.md` section 3, when the hand tests end |
| QO-05 | the six demo customers share one known password (SO-Q2, Q-Q-8) | owner |
| QO-06 | parked ideas: error page without reference number, cart count 0 while commerce is down, `Shipping $0.00` wording, Buy again names no pack, `GET /api/checkout` 404 without a bag | `plans/IDEAS.md` |
| QO-07 | live-only checks: hosted Checkout, Stripe, J15, the CSP origins (M-Q-08), statistics lag, live recurring orders | `plans/OWNER-HANDOFF.md` |

Questions raised, each with a default that was built on: Q-Q-15 to Q-Q-21 (`plans/notes/questions-Q.md`).

## 5. Check results (2026-10-22)

| Check | Result |
| --- | --- |
| `cd storefront && npm run check` (lint, typecheck, tests) | pass: 230 test files, 1933 tests, 0 failed |
| `cd seed && npm run check` | pass: 12 files, 143 passed, 4 todo |
| `node --test plans/verify-plan.test.mjs` | pass: 11 tests |
| `node plans/verify-plan.mjs --strict --scenarios --ticks --manual --questions --tests plans/evidence/Q/vitest.json` | `plan ok: 17 workstreams, 50 specs, strict`; 260 scenarios, 256 covered, 4 blocked on owner rows, 0 uncovered (`verify-plan-output.txt`) |
| `--release` | fails by design today: workstreams not `Done`, owner rows `TODO` (144 scenario or owner rows open); this is the deploy step's gate |
| Clean clone at `aca6adcd` | pass: `npm ci`, `check` (1933 tests), `verify:build` (`bundle scan: ok (checked 9 of 9 secret values)`), cold `build`, seed `check` (143 passed, 4 todo); the run found QFX-44 and the fix is in that commit (`clean-clone.md`, section "Final run"). Repeat on the release commit before the deploy (Q-Q-1) |
| `npm audit --omit=dev` in both apps | 0 vulnerabilities |
| `npm run predeploy` | fails by design until the dev routes are removed; it names them |
| Lighthouse (CLI 13.5.0) | accessibility 100 on 20 pages, best practices 100 (checkout 96, the 404 of an empty bag), SEO 100 on public pages and 54 on the ones that are `noindex` on purpose |
| Responsive matrix | 168 of 168 |
| Console on the journeys | no error and no failed request except where a step expects one |

## 6. Owner rows that are open

All of them, in order, with what each unlocks: `plans/OWNER-HANDOFF.md`. The ones that decide the launch: OA-01 and OA-S-04 (live project and seed), OA-04 and OA-K-a (Checkout application with Stripe), M-Q-08 and M-Q-09 (CSP origins, codes on mixed bags), OA-N1 (what a renewal does), SO-01 (legal text), SO-Q2 (demo accounts), OA-05 (Netlify), then Q-17 after the deploy.

## 7. Known gaps (for the owner's written acceptance, M-Q-06)

- **No monitoring or alerting.** Netlify's logs are the only record; the app logs one JSON line per event with ids and counts, never a personal value. Recommended before launch: an uptime check on `/en-US`, an alert on 5xx from the host, and a daily look at the host's function error rate.
- **Rate limits are per server instance** (Q-Q-7). On a serverless host a determined caller can spread over instances; add a host rule for `/api/auth/*`, `/api/contact`, `/api/newsletter` (hardening H2, H12).
- **The newsletter form validates and stores nothing** (D-032, Q-F-07): the footer says `Join` and the answer is a success. Connect it or remove it before launch.
- **Renewal payment for subscriptions** depends on Checkout recurring payments (public beta) or on leaving renewals out (OA-N1); the order itself is created by commercetools.
- **No cookie banner**: there is no third-party script or analytics (SO-P4).
- **Content lives in the repository** (policies, journal, FAQ, About): a correction is a deploy.
- **Demo sign-in** shares one known password and works only where `DEMO_LOGIN_ENABLED=true` (SO-Q2).
- **The CSP keeps `'unsafe-inline'` for scripts** (Next.js inline payload) and allows `https://*.commercetools.com` until the real Checkout origins are known (M-Q-08); a nonce is parked in `plans/IDEAS.md`.
- **Tokens are stateless**: logout cannot revoke a copied session cookie before it expires (30 days; hardening H10).
- Real photographs, VoiceOver, a real phone and the hosted payment pages are not covered by anything here.

## 8. Rollback

The host keeps every deploy: restore the previous one in Netlify (Deploys, the earlier build, Publish deploy) and the site is back in a minute. No migration is involved: the seed is idempotent and only adds or updates; test records are removed with `seed:cleanup-tests` (orders cannot be deleted by the API and stay). A change of the commercetools project data is therefore not rolled back by a code rollback; the steps are in `plans/DEPLOY-NETLIFY.md` section 8.

## 9. Recommended next steps

1. Owner: steps 1 to 4 of `plans/OWNER-HANDOFF.md` (credentials, seed, images, Checkout application). Claude can then run the live journeys the same day.
2. Run M-Q-09 first (the discount code on a mixed bag); it is the only open point that touches money.
3. Answer the questions Q-Q-15 to Q-Q-21 (all have defaults; none blocks).
4. When the hand tests end: remove the dev routes, `npm run predeploy`, deploy a preview, then Q-17.
