# Implementation plan: Malva Healthcare storefront

Start here. Reading order for a junior developer:

1. `DECISIONS.md` — decisions that bind you (inherited from `design/PLAN.md`, `bootstrap-storefront/design.md`, plus owner answers). Anything marked *Proposed* is a default awaiting the owner; build to the default unless `QUESTIONS.md` says it was overruled.
2. `JUNIOR-GUIDE.md` — how to work, test, commit, report manual tests, when to stop and ask.
3. `DEPENDENCY-PLAN.md` — workstreams **A → Z**, dependencies, critical path, gates.
4. `workstreams/<LETTER>-*.md` — one file per workstream: design, numbered tasks, unit tests per scenario, browser verification recipe, definition of done. *(Written spec by spec after the owner answers the questions of that spec; see `STATUS.md`.)*
5. `SPEC-COVERAGE.md` — every OpenSpec capability mapped to a workstream (or explicitly deferred), so nothing is dropped silently.
6. `SEED-PLAN.md` — how the commercetools project is cleaned and seeded (doctors, medications, categories, shipping, tax, types, images).
7. `PROJECT-FINDINGS.md` — what is actually in the commercetools project `spec-test-b2c-healthcare` (kept current by the seed workstream).
8. `TODO-MANUAL-TESTING.md` — the **only** things the owner must do or try by hand: owner actions (OA), sign-offs (SO), manual tests (M).
9. `QUESTIONS.md` — open questions to the owner (with the default we build to), `IDEAS.md` — parked ideas, `STATUS.md` — progress.

Contract = the OpenSpec files: `openspec/specs/**/spec.md` and `openspec/changes/bootstrap-storefront/specs/**/spec.md`. Design = `design/DESIGN.md`, `design/PLAN.md`, `design/source/`.

## Who verifies what

| Who | Does |
| --- | --- |
| Junior developer | Implements one workstream at a time, unit tests per scenario, `npm run check`, writes the browser recipe and any owner-only manual test |
| Claude (orchestrator) | Reviews each workstream, runs the **browser verification** with the Chrome DevTools connector, checks project data through the `spec-b2c-health` Merchant Center MCP, runs `node plans/verify-plan.mjs`, sets `Done` |
| Owner | Only what is in `TODO-MANUAL-TESTING.md` (credentials, legal/design sign-off, real payment card, real inbox) and answers in `QUESTIONS.md` |

## Verify the plan itself
`node plans/verify-plan.mjs` *(created together with the workstream files)* checks dependency order, task ids, spec coverage and OpenSpec validity, and must print `plan verification: OK`.

## ID prefixes
`A`–`Z` workstreams; tasks are `<letter>-<nn>` (`E-03`); `D-nnn` decisions; `Q-nnn` questions; `OA-nn` owner actions; `SO-nn` sign-offs; `M-<letter>-<n>` manual tests.

## Naming note
The request said both `plan/` and `plans/`. Everything lives in `plans/` (the explicit directory instruction). The grocery sibling uses `plan/`; scripts are written so a rename is a one-line change.
