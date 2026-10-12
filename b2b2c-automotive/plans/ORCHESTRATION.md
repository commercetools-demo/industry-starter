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

Later waves are appended here by the lead as juniors finish.
