<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence of workstream Q (quality and release)

Start with `FINAL-REPORT.md`. Everything here was produced on 2026-10-22 on branch `ws/q-quality` against a release build and the local mock commercetools server (`storefront/scripts/mock-ct-server.mjs`); nothing was written to a live project. What only a live project, the hosted Checkout with Stripe, a real device or a person can prove is in `plans/OWNER-HANDOFF.md`.

| File or folder | Task | What it proves |
| --- | --- | --- |
| `FINAL-REPORT.md` | Q-16 | what was verified, what failed and was fixed, known gaps, open owner rows, rollback, monitoring |
| `routes.md` | Q-00 | the route inventory (31 pages, 45 Route Handler files), the placeholders of `E2E-JOURNEYS.md` resolved, versions |
| `spec-coverage.md` | Q-01 | the scenario ledger written by `node plans/verify-plan.mjs --scenarios`: every scenario of every applicable spec is covered by a named test or carries a written reason |
| `vitest.json`, `vitest-seed.json` | Q-03 | the Vitest reports (storefront 230 files, seed 12 files), input of `--tests` |
| `verify-plan-output.txt` | Q-16 | the output of the plan verifier with every flag |
| `clean-clone.md`, `bootstrap.md` | Q-03 | a fresh clone installs, checks and builds; the scenarios of `bootstrap-and-structure` proved one by one (forbidden versions, missing secret, wrong project, bundle scan, server import in a client file, deploy gate) |
| `data-sweep.md` | Q-04 | the seed against `SEED-PLAN.md` (offline column by tests, live column read-only where the project allows); the live second-seed run and the cleanup dry run wait for OA-01 and OA-S-04 |
| `responsive/` | Q-05, Q-06 | 24 pages at 7 widths, 168 runs, all pass; 72 full-page screenshots |
| `a11y/` | Q-07, Q-08 | checklist, contrast, keyboard, dialog and form runs, Lighthouse, known issues |
| `journeys.md`, `J<n>-<step>-<width>.png` | Q-09 | J0 to J14 walked at 1440 and 375 px; J15 blocked on the hosted Checkout (OA-K-a) |
| `test-data.md` | Q-09 | the register of every synthetic record (mock only) |
| `fixes.md` | Q-09 | the 44 defects found and fixed (QFX-01 to QFX-44), and what was handed over (QO-01 to QO-07) |
| `security.md`, `401-matrix.md`, `secrets.md`, `npm-audit.txt` | Q-10 to Q-13 | the review of S1 to S18, the authorization of every Route Handler, secret names and the bundle guard, `npm audit` of both apps |
| `perf.md`, `perf-after.json`, `perf-runner.mjs.txt`, `perf-measures.json` | Q-14 | traces, Lighthouse before and after, requests and bytes per page, caching headers, budgets |
| `deployed/` | Q-17 | does not exist yet: the post-deploy smoke after the owner deploys |

The deploy runbook is `plans/DEPLOY-NETLIFY.md`, the gate list `plans/RELEASE-CHECKLIST.md`, the owner's list `plans/OWNER-HANDOFF.md`. The browser recipes of the earlier workstreams that were marked "not run in a browser" were run by Q and are in `plans/evidence/{E,H,I,K,L,M}/browser-run-q.md`.

Not produced, with the reason: `purge-plan.txt` and `leftovers.md` (the cleanup dry run needs the live project, owner row M-Q-04; every test record of this run lives only in the mock and disappears with it), `PUBLISH-READINESS.md` (only if the repository is published, checklist section F).
