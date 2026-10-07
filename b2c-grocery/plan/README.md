# Implementation plan (v1 storefront)

Start here. Everything a junior developer needs, in reading order:

1. `DECISIONS.md` — every product decision (D-nnn). Binding.
2. `JUNIOR-GUIDE.md` — how to work, test, commit, report manual tests, when to stop and ask.
3. `DEPENDENCY-PLAN.md` — workstreams **A → Z**, dependencies, critical path, gates, schedule.
4. `workstreams/<LETTER>-*.md` — one file per workstream: design, numbered tasks, unit tests per scenario, manual tests to report, definition of done.
5. `TODO-MANUAL-TESTING.md` — owner actions (OA-nn), design sign-offs (SO-nn) and the manual tests the owner must run (M-<letter>-<n>, generated from the workstream files).
6. `STATUS.md` — progress per workstream (counts are generated).
7. `PROJECT-FINDINGS.md` — what is actually in the commercetools project `spec-test-b2c` (filled by workstream F).
8. `QUESTIONS.md`, `IDEAS.md`, `recipes/` — questions to the owner, parked ideas, test recipes.

Specs (the contract) live in `openspec/changes/{bootstrap-nextjs-storefront,malva-storefront-design,grocery-storefront-features}/specs/`.

## Verify the plan itself
```bash
node plan/verify-plan.mjs          # checks dependency order, task counts, ids, spec coverage, openspec validity
node plan/verify-plan.mjs --sync   # regenerates the graph, STATUS counts and the manual-test table first
```
Run it after editing any workstream file. It must print `plan verification: OK`.

## ID prefixes
`A`–`Z` workstreams and tasks (`A-03`) · `D-nnn` decisions · `OA-nn` owner actions · `SO-nn` sign-offs · `M-<letter>-<n>` manual tests · `Q-nnn` questions.
(Task ids use the workstream letter, e.g. `O-03` is workstream O's third task; owner actions use `OA-`.)
