# Release notes — Malva Telecom storefront v1 (workstream Z)

Consolidated from `plan/reports/A…Y-report.md`, `QUESTIONS.md`, `PROJECT-FINDINGS.md`, `IDEAS.md`, `DECISIONS.md` and the specs' `## Plan notes`. Written 2026-10-07 by workstream Z. Never contains secrets.

## 1. Verification snapshot (run by Z)

| Check | Result |
| --- | --- |
| `npm run verify:release` in `site/` (worktree) | PASS: 418 test files, 2879 tests, build OK, `check:bundle`, `check:dev-routes`, `check:release` OK |
| Clean clone (`git clone` of the branch into a scratch folder, `nvm` Node 22, `npm ci`, `npm run verify:release`) | PASS (exit 0). The clone has no `.env.local`/`.env.seed`; verify does not need them |
| `npm run seed:verify` (read-only, live project `spec-test-b2c-telecom`) | PASS, "All checks passed." (17 checks incl. 52 products, 27 offers found by Product Search, 0 scheduled releases) |
| `node plan/verify-plan.mjs` | `plan verification: OK`, 26 workstreams, 313 tasks, 243 scenarios, 0 uncovered |
| `openspec validate --specs` | 51 passed, 0 failed |
| `TODO`/`FIXME` in `site/` and `design/` (`git grep`) | none, so nothing to add to `IDEAS.md` (the parked ideas already in `IDEAS.md` are German-copy review and two small follow-ups; see section 7) |
| `npm audit` | not triaged: A reported 8 vulnerabilities (7 high, 1 critical) in the transitive tree; still prints at `npm ci`. Owner or Z-04 follow-up |
| Chrome checks in `VERIFICATION-LOG.md` | 35 of 302 PASS (A–F, parts of G). The rest are **not run** (see section 6) |

Reconciliation done: `## Plan notes` added to 48 specs (12 commits, one per 4 specs) directly above `## Requirements`; the three W notes (`contact-us`, `faq`, `about-us`) already existed and sit at the end of their files (left where W put them). `plan/COVERAGE-REPORT.md` lists capability, workstream, scenario count and status.

## 2. What is built

All of workstreams A–Y are merged. Summary by area (tasks per `STATUS.md`):

- **Foundation (A–E):** Next.js 16.2 / React 19 / next-intl 4 / Tailwind 4 scaffold, `npm run verify` chain (lockfile, versions, secrets, tokens, boundaries, lint, types, tests, build, bundle and dev-route checks); ESLint and `check:boundaries` rules for client/server layering; design tokens and fonts; locale routing (`/en-US`, `/de-DE`, market cookie, region switch API); BFF core (stateless signed session cookie, env guards, error envelope, rate limits, `/api/health` in dev only).
- **Commercetools data (F, G):** seeding framework (`seed`, `seed:plan`, `seed:verify`, `seed:reset`, `seed:cleanup`, allow-listed to project `spec-test-b2c-telecom`), project settings, tax, zones, shipping, Product Search activation; catalog model (6 product types, 4+2 custom types, 8 categories, 52 products = 25 descriptive + 27 offers, 19 inventory entries, 6 recurrence policies incl. device financing, cart discounts and code `WELCOME10`, serviceability objects, 5 demo customers, 3 demo orders with Recurring Orders), hotlinked images with a committed lock file.
- **Reads and rules (H, J, K, L):** cached catalog, listing and Product Search reads; compatibility, add-on, required-equipment rules (pure TypeScript, `lib/offers/`); exclusivity, eligibility, serviceability (table stub), holdings from the customer's orders; recurring pricing core (price schedule, intro periods, cancel schedule, Recurring Order helpers, dry-run sweep `job:schedule-sweep`, checkout spike script).
- **Storefront pages (I, M, N, O, P, Q):** shell (header, footer, drawer, locale switcher, toasts, error pages, guards); "My bundle" (`/bundle`) with cart API, Broadband Facts label, price schedule, discount prompts, discount code, minimum order; category listings `/shop/<slug>` with add-on pickers, replace flow, sort; home page; search (`/search`, fuzzy, part-number match); devices with outright, installments (12/24/36) and lease, stub financing decision.
- **Accounts (R, S, T, V):** register (auto-verified), login, logout, forgot/reset (demo link), session invalidation; account shell, dashboard, order list/detail with stored schedule and label, reorder, print receipt; address book, payment-method list (seeded records), saved lists with "add all to My bundle"; cancel order before service start, device return request, shipment/return state views.
- **Checkout (U):** `/bundle/checkout` wizard (contact, service address, delivery, review, payment), `/order-confirmation/<number>`, checkout API routes, order finalization (schedule, label snapshot, service-start date, device recurring expiry), demo-mode payment, hosted Checkout code path (unit-tested with mocked SDK and Sessions API).
- **Content and operations (W, X, Y):** about, FAQ, support, blog, versioned legal pages and image credits from `site/content/` (en-US and de-DE); coordinated offer release CLI (`release:validate|preview|apply|cancel|rollback|history|verify`) with all-or-nothing apply, scheduling and rollback; `netlify.toml`, security headers, `check-release.mjs`, `build:netlify`, README "Deploying to Netlify".

## 3. What is not built (deferred, superseded, reduced)

| Item | Status | Decision |
| --- | --- | --- |
| `agent-redemption-quota` (7 scenarios) | deferred, spec kept | D-022 |
| `account-registration-request` (3 scenarios) | not built | D-005, D-031 |
| `product-detail-page` (3 scenarios) | superseded by `plp-led-catalog-navigation`; `/product/x` is 404 | D-052 |
| Email of any kind (verification, reset, confirmation), receipt PDF/invoice | not built; reset link on screen in demo mode only; verification reduced to auto-verify | D-031, D-033, D-059 |
| Federated sign-in, MFA, store-scoped sign-in | not built ("Federated buyer has no local password" excluded) | D-030, D-058 |
| `payment-methods` tokenisation form, net terms, credit line | excluded; list-only seeded records | D-032 |
| B2B: cost centers, approvals, associates, quick order, per-company entitlement, share lists with users, company addresses, multiple shipping addresses | excluded in each spec's Plan notes | D-005 |
| Contact form, chat widget, feedback vote control, editor correction without deploy | replaced by `mailto:`, no chat, no vote control, versioned files | D-034, D-059 |
| Plan changes, mid-term amendments, "Schedule changed in place", partial cancellation, return processing, carrier tracking | not built | D-040, D-059 |
| Phone/wireless online cancellation (lead time 0) | not possible by design; copy says so, device return path offered | D-062 |
| Release approval step ("Authoring and releasing are separate"), approval UI | removed | D-057, D-069 |
| Stores, Product Selections | not built | D-058 |
| Real serviceability, credit, billing, provisioning systems; charging each period | stubs only (table, deterministic decision); billing out of scope | D-015, D-020, D-059 |
| "Did you mean", type-ahead suggestions, availability and price facets | not built (fuzzy search only; services have no inventory) | D-019, D-056 |
| Native German catalog names, native German copy, legal text | not built; machine-translated placeholders | D-004, SO-08, SO-09 |
| CI, e2e suite | none; local `verify` / `verify:release` only | D-003, D-059 |
| Content-Security-Policy header | not in v1 (Y); other security headers are set. Z's own text expected CSP; accepted gap, now listed in `IDEAS.md` | Y planner default |
| Static/ISR home page | not met: every page is dynamic because the layout reads the session cookie (C-O-5) | Q-018 |
| Live hosted Checkout payment (Adyen, Stored Payment Methods, recurring), L-09 spike result, U-01 gate | **blocked on OA-05**; unticked: L-09, U-01 | OA-05 |
| Netlify deployment | **blocked on OA-06**; unticked: Y-07 | OA-06, OA-05 |

Unticked tasks across all workstreams: `L-09`, `U-01`, `Y-07` (all blocked on owner actions), plus the workstreams' Definition-of-done lines "C- lines present; STATUS set to Ready for review" (orchestrator).

## 4. Owner actions and manual tests still open

| ID | What | Blocks |
| --- | --- | --- |
| OA-05 | Merchant Center Checkout application (Payment Only, D-061, US and DE, allowed origins localhost:3000/3010 and the Netlify URL, return URL `…/order-confirmation/return`) with Adyen test connector, Stored Payment Methods and recurring orders; set `CTP_CHECKOUT_APP_KEY` in `site/.env.local` and Netlify | L-09, M-L-1, M-L-2 (Gate 2), U-01, C-U-10/11/12/14/19/20, M-U-1..3, C-Z-1/2 payment step, M-Y-2, Netlify build (Q-025) |
| OA-06 | Netlify site (Package directory `b2c-telecom`) and env vars | Y-07, M-Y-1, M-Y-3, M-Y-4, C-Y-*, C-Z-9 |
| OA-07 | Merge planning work to main (marked TODO in the file though main contains the plan) | confirm |
| M-G-1 | Look at five offers in Merchant Center (images are iStock files) | none |
| M-Q-2 | Accept demo handset prices and stub limit (USD 2,500 / EUR 2,300) | none |
| M-T-1 | Add `manage_payment_methods` (and `view_payment_methods`) to the storefront client so write actions work | payment-method page writes |
| M-W-1 / SO-09 | Static page copy, support mailbox, image credits | none |
| SO-08 | Broadband Facts legal wording (placeholders `malva.example`, `1-800-MALVA-00`) | none |
| M-L-1, M-L-2, M-U-1..3, M-Y-1..4 | see `TODO-MANUAL-TESTING.md` | OA-05 / OA-06 |
| M-Z-1 | Revoke the seed/admin API client after the final release; `npm run seed` must then fail with an authentication error | release close-out |
| M-Z-2 | Review these notes and the Netlify site, reply `APPROVED` | release |

## 5. Open owner questions (`QUESTIONS.md`)

Answered: Q-001 (Payment Only, D-061), Q-002 (D-062), Q-003 (D-063), Q-004 (D-066), Q-005 (D-068), Q-006 (D-069). **Open, with the default that was built:**

| ID | Question | Default built |
| --- | --- | --- |
| Q-007 / Q-021 | Guest checkout cannot create a recurring order; require sign-in at "Continue to payment" or add auto-registration? | sign-in required for bundles with monthly items; no auto-registration |
| Q-008 / Q-015 | Seeded images are iStock files; footer and `/legal/image-credits` say Pexels. Reword (suggested: "Photos: iStock by Getty Images, found via Pexels") or relicense | demo only, wording unchanged |
| Q-009 | Demo customers' password (`Malva-Test-123!` was passed once on the command line); keep a documented demo password? | existing customers keep it |
| Q-010 / Q-013 | Demo order `MLV-DEMO-0003` total 0, and "first month free" stacking with the L intro price on Cable 100 and Air 5G (first charge 0; hosted Checkout may refuse a 0 payable cart) | kept |
| Q-011 | `compatible-addons`/`compatible-equipment` are positive exceptions, not an allow-list | kept |
| Q-012 | Header first name costs one customer GET per page; store `firstName` in the cookie instead? | kept `lib/ct/account-name.ts` |
| Q-014 | `recurringOrderScope` cannot limit a discount to the first order; stored schedule stays the promise | accepted |
| Q-016 | Default listing order cheapest first (no order hint, no "Featured") | as built |
| Q-017 | Existing customers see Cable 500, not the cheaper existing-customer offer (reachable by `?offer=`) | as built |
| Q-018 | Home page cannot be static/ISR (layout reads session cookie) | accept dynamic, catalog cached 60 s |
| Q-019 | Header search magnifier is undrawn (sign-off; switch `HEADER_SEARCH_ENABLED`); German queries find no German catalog names | on |
| Q-020 | German wording clash "Zahlungsmethoden/Gespeicherte Listen" vs "Zahlungsarten/Merklisten" | unify when SO-09 copy is reviewed |
| Q-022 | Demo-mode payment (`CHECKOUT_DEMO_PAYMENT`) places orders as Paid; acceptable for the Netlify demo? In production without a key checkout answers `CHECKOUT_UNAVAILABLE` | yes, flagged in the UI |
| Q-023 | Service start uses the longest install lead (as M stores), plan text said earliest | longest |
| Q-024 | Order-number validation in V is looser than `MLV-…` so `QA-…` orders can be tested | keep loose |
| Q-025 | Netlify build requires `CTP_CHECKOUT_APP_KEY`; do OA-05 first or relax the build requirement for a demo deploy; Package directory `b2c-telecom` untested | none |

Questions raised only in workstream reports (not yet in `QUESTIONS.md`):

- **E:** `SESSION_SECRET` (>= 32 chars) must be added to the real `site/.env.local` (OA-02 file has none); production start with a bad variable logs and answers 500 instead of exiting non-zero.
- **F:** Product Search activation accepted (no 15-minute reindex was observed, G).
- **H:** two extra live offers (`malva-offer-cable-existing-customer`, `malva-offer-phone-online-only`) are filtered by K; fine?
- **M:** replace the legal placeholders in `lib/config/label.ts`; confirm minimum order USD 30 / EUR 28; show all prompt pairings or one at a time (now all, capped by `PROMPT_MAX_CANDIDATES`).
- **O:** hero alt text is the category asset name, not a photographer credit; add the photographer to asset names (none exist, `photographer` is null).
- **Q:** demo handset prices and stub limit (M-Q-2); one Recurring Order for plan plus device with the device end date stored on the line: acceptable billing hand-over?
- **R:** registration reveals duplicate emails (kept).
- **S:** dashboard bill counts every non-cancelled order whose recurring orders are not all Expired/Canceled; a Recurring Order stays Active after the term (month-to-month). Confirm.
- **L:** "before the service-start date" is strict, so lead time 0 never has a window (V owns the rule; D-062 accepted it).
- **X:** planner defaults extended (manifest `reinstateCartDiscounts`, `rollbackOf`, CLI flags `--release-at`, `--file`, `--expedite`, `release:cancel` allowed for applying/inconsistent records).
- **U:** the 502 `CHECKOUT_UNAVAILABLE` in production without a key (see Q-022).

## 6. Run by the orchestrator (not by Z, left unticked)

- **Chrome full-journey checks, orchestrator:** C-Z-1 (new consumer journey, en-US, needs OA-02/03 and, for payment, OA-05; demo payment can stand in), C-Z-2 (needs OA-05), C-Z-3, C-Z-4, C-Z-5, C-Z-6, C-Z-7 (de-DE), C-Z-8 (375 px), C-Z-9 (needs OA-06). Z-04, Z-05 below.
- **Lighthouse, orchestrator (Z-05):** mobile and desktop on `/`, a listing, `/bundle`, `/login`, `/account`; targets accessibility >= 95, best practices >= 95, SEO >= 90; scores to go into this file or `FINAL-REPORT.md`.
- **Netlify checks, orchestrator:** all C-Y-1…C-Y-12 and C-Z-9 after OA-06; `/api/health` must answer 404 on staging; headers present (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`; no CSP, see section 3).
- **Z-04, orchestrator or owner:** `/code-review high` and `/security-review` over `site/`; record findings; fix only owner-approved ones.
- **Remaining Chrome checks:** 267 of 302 `C-` lines have no result in `VERIFICATION-LOG.md` (G 9, H 11, I 16, J 10, K 11, L 6, M 22, N 20, O 9, P 13, Q 12, R 12, S 15, T 15, U 24, V 14, W 18, X 9, Y 12, Z 9 have no result yet). Ready-to-run notes are in each report's "Chrome checks ready". Setup helpers: `scripts/seed/create-qa-order.ts` and `cleanup-qa.ts` (S), `seed:financing-customers` (Q), `place-test-order.ts --cart-id` (U), `demo:advance-order` (V), `release:*` (X); the report's caveats (Cache-Control `no-store` only visible under `next start`; forgot-password limit 5/hour/IP in memory; `?next` vs `?returnTo`; C-X lines need `--release-at <now+15 min>`).
- **Clean-up at close-out:** run `seed:reset --demo`/`cleanup-qa.ts` if QA customers remain (R left `chrome-r-<ts>@example.com` customers; S's cleanup removes them); revoke the seed/admin client (M-Z-1).

## 7. Missed features, deviations and follow-ups reported by the workstreams

**Not done inside a workstream**
- L-09 live Checkout spike result (P4, P5 blocked); U-01 gate; Y-07 staging URL.
- `DashboardExtras` (saved-lists preview on the dashboard) is empty (S slot, T did not fill it; `IDEAS.md`).
- Anonymous "Save for later" only links to sign-in; the offer is not remembered after sign-in (T, `IDEAS.md`).
- `PriceSchedule` still shows "Dates assume you order today" on order detail and on the confirmation page; needs a prop to suppress (S, U, V, M).
- "Buy again" confirms with a toast, not the planned `?reordered=<n>` banner on `/bundle` (S).
- `ensureRecurringPaymentStrategy`, `lib/checkout/finalize.ts` and the `--email/--skus/--guest/--skip-finalize` modes of `place-test-order.ts` not built (U; M's `stampOrderPricing` replaces finalize).
- No `/api/auth/me` (D-070). No `loading.tsx` in dynamic routes (N: it makes 404/redirect stream as 200).
- Equipment auto-add path never fires with live data: included equipment satisfies required kinds (J).
- `lib/market/cartSeam` bodies replaced by M; `Mein Bundle` is the German term (not "Mein Paket", W).

**Deviations worth knowing**
- Session: signed cookie holds only references and `signedInAt`; invalidation after a password reset via customer field `sessionsValidAfter` (R).
- Price keys use `_`; set attributes are not `isRequired`; empty sets omitted (G). Offers' recurring prices on handsets are installment plans, not headline prices (H, Q).
- Error codes beyond E's closed `ApiErrorCode` set are literals in `AccountRefusal`/route helpers (J, K, R, T, V).
- Mixed plan plus device orders produce ONE Recurring Order (Q finding); `startsAt` is order creation, not service start (G).
- Intro price and "first month free" stack (L, Q-013); `seed:verify` counts discounts with `atLeast`, so the later extra discounts no longer fail it (X noted a failure; it passes now).
- Release lag: a newly released offer can appear up to 60 s after the instant (X finding 1; suggested fix for H: read prices at `now + CATALOG_TTL`).
- `lib/ct/account-name.ts` adds one customer GET per page for signed-in buyers (I, R).
- Home page is dynamic everywhere (O, Q-018).
- Spec text mismatches fixed by notes, not by editing scenarios: see each spec's `## Plan notes`.

**TODOs left for later changes**
- `npm audit` triage (A); Vitest config ESM warning (A); possibly move `vitest.config.ts` to `.mts`.
- Native German review of all machine-translated copy: `site/content/de-DE/**`, `content.*`, `account.addresses|paymentMethods|lists.*`, `checkout.*`, `confirmation.*`, `orders.*` (`IDEAS.md`).
- Wording of image credits (Q-008/Q-015); replace imagery with licensed or API-key Pexels before any non-demo use.
- Content-Security-Policy (Y).
- Sitemap and hreflang for content (W, `IDEAS.md`).
- Native German catalog names (P, Q-019).
- `lib/offers/serviceability-table.json` and the serviceability Custom Objects are not read by K (stub table used).
- Spike results of Q (`spike:device-recurrence`) are in the Q report; the orchestrator should move them into `PROJECT-FINDINGS.md`; likewise the U checkout-mode entry and the X/T/V findings that reports mark "for PROJECT-FINDINGS" if not yet there.
- `STATUS.md` still needs `--sync` and Z status (orchestrator); `TODO-MANUAL-TESTING.md` OA-07 reads TODO.

## 8. Known risks

- **Pexels endpoint (D-055, D-066):** undocumented public search; returns iStock/Getty hotlinks without licence data. Demo only.
- **Hosted Checkout dependency (D-041, D-061):** unproven until OA-05; unknowns recorded by L and U (`futureOrderNumber` acceptance, completion message codes, whether the connector adds the recurring payment allocation, `paymentReturnUrl` behaviour). The storefront never sets `paymentStrategy` (an order with a strategy and no allocation is refused).
- **Stub systems (D-015, D-020, D-059):** serviceability table, credit decision and billing are deterministic fakes.
- **Demo payment path:** exists outside production without a key or with `CHECKOUT_DEMO_PAYMENT=true`; check the Netlify env before announcing.
- **Rate limits are in memory** (per instance): not reliable on serverless Netlify.
- **Netlify build:** needs `CTP_CHECKOUT_APP_KEY` and the untested Package directory `b2c-telecom` (fallback is in `Y-netlify-deployment.md`); Google Fonts are fetched at build and have flaked once per workstream (retry).
- **Live project hygiene:** `seed:experiments` can leave a stock reservation until the next `npm run seed`; QA customers may remain; `Gate 2` (M-L-2) is formally still open although M and U were built.
