<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# plans/

Implementation plan for the Malva Coffee online storefront (`storefront/`; markets US and Canada, hosted on Netlify) and its platform data scripts (`seed/`), written for junior developers to follow task by task.

| File | Purpose |
| --- | --- |
| `JUNIOR-GUIDE.md` | **Start here.** Rules, the task loop, tests, how to verify on your own, how to report manual testing, when to stop and ask |
| `DEPENDENCY-PLAN.md` | Workstreams A to Q, who depends on whom, waves, gates |
| `workstreams/<LETTER>-*.md` | One file per workstream: design, tasks, scenario checklist, browser recipe, definition of done |
| `STATUS.md` | Progress and environment status |
| `DECISIONS.md` | Decisions already made |
| `QUESTIONS.md` | Open questions to the owner, each with the default being built |
| `TODO-MANUAL-TESTING.md` | **Everything only the owner can do or test**: actions (OA), sign-offs (SO), manual tests (M) |
| `SEED-PLAN.md` | The platform data model and seed contract |
| `SPEC-COVERAGE.md` | Which workstream implements which spec, and which specs do not apply |
| `PROJECT-FINDINGS.md` | Verified platform facts and environment findings |
| `IDEAS.md` | Parked ideas |
| `verify-plan.mjs` | `node plans/verify-plan.mjs`: checks the plan against the specs |
| `evidence/<LETTER>/` | Screenshots, read-backs and logs a workstream produced while verifying itself (no secrets) |
| `notes/questions-<LETTER>.md` | Per-workstream question drafts; the lead consolidates them into `QUESTIONS.md` |

Specs: `../openspec/specs/` (the `design-*` specs, `bootstrap-and-structure`, `server-architecture-and-data-flow`, `platform-project-setup-and-seed`, `fulfilment-and-availability-model`, `reviews-and-ratings`, and the generated behavioural templates). Design notes and open design questions: `../openspec/changes/b2c-foodservice-design/design.md`. Design export: `../design/`.
