<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Orchestration board

How the build runs (owner instruction 2026-10-12): the lead works on branch `develop` (branched off `main`, tracked at `origin/develop`). Four "junior" agents work in the same checkout, each in its own directory (`seed/`, `storefront/`, `portal/`, `tools/`), one workstream at a time. When a junior finishes, the lead stages that directory, commits and pushes to `develop`, then starts the next junior. Juniors never commit, never push, never touch another junior's directory without saying so in their report.

Order: seeding and bootstrap first, then two juniors per website.

## Standing rules for juniors
- Read `plans/JUNIOR-GUIDE.md`, the workstream file, the specs it names and `plans/notes/owner-answers.md` first.
- Test first. Keep `npm run check` and `npm test` green in the directory you own.
- No credentials exist in this environment (OA-01). Everything that needs a live commercetools project is built and unit-tested against mocks and recorded as a manual/live check in `plans/TODO-MANUAL-TESTING.md` (Claude verifies it later through the `b2b2c-automotive` MCP and Chrome once `seed/.env.local` exists). Never write to the project through the MCP.
- Questions: append to `plans/notes/questions-<LETTER>.md` (`Q-<letter><nn> | question | default taken | what it blocks`). Missed or deferred features: append to `plans/MISSED-FEATURES.md`. Owner-only items: `plans/TODO-MANUAL-TESTING.md`.
- Never put secrets in files. Image URLs clean (no query). Seeded keys prefixed `mau-` (documented exceptions in `SEED-PLAN.md`).

## Board

| Wave | Junior | Workstream | Directory | Status |
| --- | --- | --- | --- | --- |
| 0 | J1 | D, E, F finish and seed requests | `seed/` | running |
| 0 | J2 | A, B, C for the storefront | `storefront/` | running |
| 0 | J3 | A, B, C for the portal | `portal/` | running |
| 0 | J4 | Fake Contentools server for tests (feeds H, U, X) | `tools/fake-contentools/` | running |

Wave 0 above is the opening state. The full board below is the state at the start of workstream Z (2026-10-12, `develop` at `e9835dfc`). "Built offline" means: code and tests exist, `npm run check` and `verify:build` were green on the dummy environment (`plans/release-gates.mjs` reruns them), and no live commercetools project, Chrome MCP or owner row was needed. It does **not** mean accepted: the live read-backs and owner rows of each workstream stay open in `plans/TODO-MANUAL-TESTING.md` (summary by owner in `plans/OPEN-ITEMS.md`, run `node plans/verify-manual.mjs --list`). Task ticks inside the workstream files are not kept consistently; this board and the evidence folders are the better guide.

## Full board A to Z

| Wave | Workstream | Directory | Commit | Status | Still open (rows) |
| --- | --- | --- | --- | --- | --- |
| 0 | A Scaffold both apps | `storefront/`, `portal/` | `6dd5fb0a`, `b4804229` | Built offline; fresh-clone run now covered by `plans/release-gates.mjs` | A-11 clean-clone proof (Z-03) |
| 0 | B Design tokens and fonts | both apps | same | Built offline, browser checked on fakes | M-B-1 (owner look) |
| 0 | C Locale routing and messages | both apps | same | Built offline, browser checked on fakes | M-C-1 (German wording) |
| 0 | D Seed framework and platform model | `seed/` | `12f01de9`, `e37d13a4` | Built offline against `FakeApi`; never run live | OA-01, M-D-01, M-D-02 |
| 0 | E Seed parts catalog | `seed/` | same | Built offline; placeholder images until OA-03 | OA-03, M-E-01, M-E-02 |
| 0 | F Seed stores, units, roles, customers | `seed/` | same | Built offline | M-F-01, M-F-02 |
| 0 | Fake Contentools (feeds H, U, X) | `tools/fake-contentools/` | `84c4d8db` | Done, gate green | - |
| 1 | G BFF core (storefront and portal) | both apps | `0bd32a9c`, `bf0eae19` | Built offline against mocks | OA-08, OA-09, OA-10, M-G-* live checks |
| 1 | H Contentools and theme adapter | `storefront/` | `0bd32a9c` | Built offline, browser checked against the fake | OA-02, M-H-1, M-H-2 |
| 1 | R Portal shell, navigation, auth, demo login | `portal/` | `bf0eae19` | Built offline | OA-11, SO-01 |
| 2 | I Storefront shell and store picker | `storefront/` | `da074966` | Built offline, browser checked on fakes | SO-01, live read-backs |
| 2 | J Vehicle finder and garage | `storefront/` | `da074966` | Built offline (mock provider only, OA-04 waived) | M-J-3 to M-J-6 (live) |
| 3 | K Home page (Puck) | `storefront/` | `b9663c19` | Built offline | OA-02, M-K-2, M-K-3 |
| 3 | L Product listing and search | `storefront/` | `b9663c19` | Built offline (14 of 14 tasks) | live Product Search proof |
| 3 | M Product detail page | `storefront/` | `b9663c19` | Built offline (9 of 11 tasks) | M-M-2, M-M-4 |
| 3 | S Portal dashboard | `portal/` | `aa993ffe` | Built offline | M-S-2 to M-S-5 (live) |
| 3 | T Portal catalog, pricing, tailoring, discounts | `portal/` | `aa993ffe` | Built offline | OA-12, M-T-* live |
| 3 | U Portal theme, content, store, company | `portal/` | `aa993ffe` | Built offline against the fake; Chrome pass not done (ENV-01) | OA-13, OA-14, M-U-5 |
| 4 | N Cart | `storefront/` | `aa9fbc08` | Built offline | M-N01 to M-N04 |
| 4 | O Checkout (hosted Checkout, Stripe) | `storefront/` | `5bc71517` | Built offline against a dev stand-in; not run with a real Checkout application | OA-05, M-O* |
| 4 | W Portal marketing, bundles, import, brand partnership | `portal/` | `aa993ffe` | Built offline (17 of 20 tasks); W-20 Chrome recipe not done | OA-15, M-W-09 |
| 5 | P Order confirmation (no e-mail, Q-P01) | `storefront/` | `63022c6d` | Built offline | live Checkout order proof |
| 5 | Q Shopper account area | `storefront/` | `63022c6d` | Built offline | M-Q02, M-Q04 to M-Q08 |
| 5 | V Portal customers, subscriptions, returns, reviews | `portal/`, `storefront/` | `d90699e0` | Built offline in fixture mode; refund and renewal need OA-05 | M-V-05 to M-V-12 |
| 6 | X Security hardening | both apps | `b20680b4`, `098dde15`, `63022c6d` | Built offline (8 of 15 tasks ticked; attack harness and gates exist); live data attacks open | M-X-05, M-X-06, M-X-09 to M-X-11 |
| 7 | Y Accessibility, responsive, performance | both apps | `1b05e2d7`, `e9835dfc` | Built offline, axe suites and reports | M-Y-01 to M-Y-04, M-Y-21 to M-Y-25, M-Y-31 to M-Y-34 |
| 8 | Z Release readiness | `plans/`, `seed/` | (J28, not yet committed) | In progress: release-gates, verify-manual, spec-coverage, open-items, purge script and test, E2E journeys and release checklist written; everything that needs the live project, a browser or the owner is waiting | M-Z-01 to M-Z-07, all OA and SO rows |

Gate G11 (every owner row closed, `node plans/verify-manual.mjs` exits 0) is not met: see `plans/OPEN-ITEMS.md`.

