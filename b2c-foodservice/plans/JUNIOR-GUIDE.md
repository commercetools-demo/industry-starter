<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Junior developer guide

Read this once, then follow **one workstream file at a time** (`plans/workstreams/<LETTER>-*.md`). Everything you need is in that file, `DECISIONS.md` and the specs it links. **Do not guess. If something is unclear, write the question down (section 8) and carry on with the default; never wait silently.**

## 0. Where things are

| What | Where |
| --- | --- |
| Behaviour (the contract) | `openspec/specs/`: `design-*`, `bootstrap-and-structure`, `server-architecture-and-data-flow`, `platform-project-setup-and-seed`, `fulfilment-and-availability-model`, `reviews-and-ratings`. The other directories are generated templates; the workstream file says which of them apply |
| Design notes, open design questions | `openspec/changes/b2c-foodservice-design/design.md` |
| Design export (tokens, layouts, copy, screenshots) | `design/export/b2b2c-retailer-design/project/` (VELA prototype: read `app/*.jsx` and `app/styles.css`) |
| Order of work | `plans/DEPENDENCY-PLAN.md`, status in `plans/STATUS.md` |
| Your tasks | `plans/workstreams/<LETTER>-*.md` |
| Decisions already made | `plans/DECISIONS.md`; open questions `plans/QUESTIONS.md` |
| Things only the owner can do or test | `plans/TODO-MANUAL-TESTING.md` |
| Apps | `storefront/` (Next.js, shopper), `seed/` (platform scripts, own package, own `.env.local`) |
| Evidence you produce | `plans/evidence/<LETTER>/` |

## 1. Ground rules

1. Work in **letter order** unless `DEPENDENCY-PLAN.md` says two workstreams are in the same wave. Never start a workstream whose dependencies are not `Done` in `STATUS.md`.
2. The specs are the contract. **Every `#### Scenario` becomes at least one unit test**, or a browser or MCP check recorded as evidence when it cannot be unit-tested. Tick a Scenarios checklist item only when the test exists and passes.
3. If a task conflicts with a decision, write a question and keep the decision until the owner answers.
4. **Secrets** (`CTP_CLIENT_SECRET`, `SEED_CTP_*`, `SESSION_SECRET`, passwords, tokens) never go in git, chat, logs, tests, fixtures, evidence or findings. Only `.env.example` files (names, no values) are committed; real values live in git-ignored `.env.local`. Never read `~/.commercetools/*`.
5. Only tasks in your workstream file are in scope. Do not "improve" other code. Park ideas in `IDEAS.md`.
6. Never put a password, session token or personal data in a URL, log line, analytics event, user-facing error or a cache shared between users. Test data is synthetic (`@example.com`).
7. **Only touch the commercetools project named in `.env.local`** (and typed again as `EXPECTED_PROJECT_KEY`). Scripts refuse any other key.
8. **Seeded keys start with `mcf-`.** Anything without the prefix is not yours, except what a cleanup manifest lists.
9. **Image URLs are stored clean**: no query string, no fragment. Resize at render time only.
10. **No wildcard deletes.** Deleting happens only in seed scripts, driven by a reviewed manifest or the seed's own keys.
11. Markets are US, DE and GB; locales `en-US`, `de-DE`, `en-GB`. Capsules are Nespresso-**compatible**; never use the Nespresso name as a product brand. The site is the **online** channel only.

## 2. How to do a task (the loop)

1. Open the workstream file; take the next unchecked task (`G-03`).
2. One branch per workstream: `git switch -c ws/<letter>-<slug>`.
3. Write the **test first** (or with the code) for the scenarios the task names.
4. Implement exactly the files and signatures listed. Other workstreams import those names.
5. Run the gate in the app you touched: `cd storefront && npm run check` or `cd seed && npm run check`. Run `npm run build` before the last task. It must pass.
6. Commit: `ws-<letter>: <task id> <summary>` (one task per commit). Never commit `.env*` except `.env.example`.
7. Tick the checkbox in the workstream file. Do not tick without a passing `check`.
8. After the last task: walk the workstream's **Definition of done**, run section 4 yourself, save evidence, set `Ready for review` in `STATUS.md`. The lead sets `Done`.

## 3. Unit tests

- Vitest and Testing Library with jsdom; test files sit next to the code.
- **Never call the real commercetools API in a unit test.** Mock `lib/ct/*` or `fetch`. Route handlers: import `GET` and `POST` and call them with `new Request(...)`.
- Name tests after the scenario: `it('Collect at an empty store is shown unavailable', ...)`.
- A bug fix needs a failing test first.

## 4. Verify on your own (browser and project data)

**You verify your own work; the owner does not click through the app.**
- **Browser:** run `npm run dev` and drive the app with the **Chrome DevTools MCP**: navigate, take snapshots and screenshots at 375 px and 1440 px, read the console and network. Follow the workstream's **Browser recipe**. The console must show no errors and the network no failed requests.
- **Project data:** read back with the commercetools MCP when it is connected, otherwise with `cd seed && npm run verify` or a small read-only script. Create, delete and bulk change happen only through seed scripts.
- **Record evidence** in `plans/evidence/<LETTER>/`: screenshots (`<task>-<what>-375.png`), trimmed read-backs (ids and keys only, no personal data, no secrets), and a `README.md` saying what each file proves.
- If something cannot be exercised because data is missing, add the data to the seed (workstreams B and C) instead of asking the owner.

## 5. Manual testing and owner-only actions go in `TODO-MANUAL-TESTING.md`

**Anything only the owner can test or do goes into `plans/TODO-MANUAL-TESTING.md` as a row. Never leave a manual step only in a commit message, a chat message or your head.**

| Prefix | Meaning | Next id |
| --- | --- | --- |
| `OA-nn` | **Owner action**: API clients, Merchant Center settings, the image endpoint URL, payment connector, hosting, domains | next free `OA-nn` |
| `SO-nn` | **Sign-off**: approval of copy, legal text, real content, anything not designed | next free `SO-nn` |
| `M-<LETTER>-nn` | **Manual test**: a real phone, a real card, a visual-fidelity judgement, anything needing a human's account | next free number for your letter |

Each row states: **who**, **when** (the workstream or gate that needs it and what is blocked until it is done), **exact steps** (numbered; URLs, inputs, which file to put a value in, never the value itself), **expected result**, and **status** (`TODO`). Only the owner sets `DONE`, `PASS`, `FAIL` or `WAIVED`.

**Never wait silently.** If your task needs an owner item that is not done: add the row (or reference the existing one), write the default you will build to in `QUESTIONS.md` when it is a decision, finish everything that does not depend on it, mark the dependent task `blocked: OA-nn` in the workstream file, and say so in your hand-off. Then continue with the next unblocked task.

## 6. Code conventions

- TypeScript strict, no `any` (use `unknown` and narrow). Components import types only from `lib/types.ts`.
- Server-only modules start with `import 'server-only'`; client code never imports them. No `@commercetools/*` import outside `lib/ct` and `lib/mappers`.
- Locale-aware navigation from `@/i18n/routing`, never bare `next/link` or `next/navigation` in locale UI. Strings come from the three catalogues with identical keys; never hard-code a locale key.
- **Design tokens only** in components: no hex values, no fonts outside the token layer. The prototype uses raw values in places; do not copy them.
- Money is integer minor units, formatted with `formatMoney` to two decimals. Free-shipping thresholds, tax labels and country come from commercetools data and `COUNTRY_CONFIG`, never constants (the prototype's 75, 8.875% and 2 hours are placeholders).
- Prototype data (VELA, leggings, "Maya" as a hard-coded user) must not leak into seed or copy.
- Ownership and role checks happen **on the server** (route handlers), not by hiding controls.
- Every interactive element is a real `button` or `a` with a visible focus ring.
- Server Components by default; `'use client'` only for interactive leaves; never wrap `redirect()` or `notFound()` in `try/catch`.
- commercetools code: load the `commercetools-*` skill named by the task (`[SKILL: ...]`) first; do not invent endpoints, update actions or field names from memory (the workstream files cite the documentation).
- Seed scripts: idempotent, `--dry-run`, `mcf-` keys, refuse a project key other than the configured one.

## 7. Reporting back

End every working session with a hand-off in your reply: tasks done, evidence paths, new questions (`Q-<letter>-<n>`), new `OA`, `SO` or `M` rows, anything blocked and on which row.

## 8. Questions: write them down, keep the default, do not block

Add a row to `plans/QUESTIONS.md` (or `plans/notes/questions-<letter>.md` when several people work at once; the lead consolidates). Format: id `Q-<letter>-<n>`, the question, **the default you build to**, whether it blocks anything, status `Open`. Build to the default unless it conflicts with a decision, a secret or another project. Stop (after writing the question and telling the lead) only when:
- two documents disagree and no default is safe;
- a commercetools response differs from the workstream (record it in `PROJECT-FINDINGS.md`);
- you need a package not listed, or a test would need real credentials;
- a task would take more than a day;
- anything touches secrets, deploy settings or project data outside the seed scripts.

## 9. Definition of done (every workstream)

- All tasks ticked, each with a passing `check` commit.
- Every scenario of the listed specs has a named test or recorded evidence.
- Browser recipe verified by you; evidence saved in `plans/evidence/<LETTER>/`.
- Owner-only items are in `TODO-MANUAL-TESTING.md`; questions in `QUESTIONS.md`.
- No `TODO` or `FIXME` in code without an `IDEAS.md` entry.
- `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
