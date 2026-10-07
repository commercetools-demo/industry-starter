# Implementation plan (v1 storefront — Malva Telecom)

Start here. Everything a junior developer needs, in reading order:

1. `DECISIONS.md` — every product decision (D-nnn). Binding.
2. `JUNIOR-GUIDE.md` — how to work, test, commit, report, when to stop and ask.
3. `DEPENDENCY-PLAN.md` — workstreams **A → Z**, dependencies, critical path, gates.
4. `ARCHITECTURE.md` — file, route and module ownership: the names every workstream must use.
5. `workstreams/<LETTER>-*.md` — one file per workstream: design, numbered tasks, a scenario → test table, Chrome checks (run by Claude), owner-only manual tests, definition of done. Template: `workstreams/_TEMPLATE.md`.
6. `TODO-MANUAL-TESTING.md` — **owner** actions (OA-nn), design sign-offs (SO-nn) and the few manual tests only the owner can run (M-<letter>-<n>).
7. `VERIFICATION-LOG.md` — the Chrome checks (C-<letter>-<n>) that Claude runs against the live app and project, with results.
8. `STATUS.md` — progress per workstream (counts are generated).
9. `PROJECT-FINDINGS.md` — what is actually in the commercetools project `spec-test-b2c-telecom` (filled by workstreams F, G, L).
10. `QUESTIONS.md`, `IDEAS.md`, `recipes/` — questions to the owner, parked ideas, test recipes.

Specs (the contract) live in `openspec/specs/<capability>/spec.md`. Design (tokens, components, pages) lives in `design/`; the reference data model from the AT&T demo project is in `plan/ATT-REFERENCE-MODEL.md`.

## Verify the plan itself
```bash
node plan/verify-plan.mjs          # dependency order, task counts, ids, spec + scenario coverage, openspec validity
node plan/verify-plan.mjs --sync   # regenerates the graph, STATUS counts, owner-test table and Chrome-check table first
```
Run it after editing any workstream file. It must print `plan verification: OK`. It fails if any `#### Scenario` of a built capability is not named in a workstream's test table.

## ID prefixes
`A`–`Z` workstreams and tasks (`A-03`) · `D-nnn` decisions · `OA-nn` owner actions · `SO-nn` sign-offs · `M-<letter>-<n>` owner-only manual tests · `C-<letter>-<n>` Chrome checks run by Claude · `Q-nnn` questions.
