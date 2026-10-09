# Junior developer guide

Read this once, then follow **one workstream file at a time** (`plans/workstreams/<LETTER>-*.md`). Everything you need is in that file, `DECISIONS.md` and the OpenSpec specs it links. **Do not guess. If something is unclear, stop and ask (section 8).**

## 0. Where things are
| What | Where |
| --- | --- |
| Behaviour (the contract) | `openspec/changes/bootstrap-malva-storefront/specs/*`, `openspec/changes/malva-website/specs/*` |
| Design (tokens, layouts, copy, gaps) | `design/malva/DESIGN.md`, `design/malva/specs/*.md`, prototype `design/malva/source/Malva.html` |
| Order of work | `plans/DEPENDENCY-PLAN.md` (A → Z), status in `plans/STATUS.md` |
| Your tasks | `plans/workstreams/<LETTER>-*.md` |
| Decisions already made | `plans/DECISIONS.md`; open questions `plans/QUESTIONS.md` |
| Things only the owner can do | `plans/TODO-MANUAL-TESTING.md` |
| Seed data and scripts | `plans/SEED-PLAN.md`, `seed/` |
| The app (does not exist until workstream A) | `site/` |

## 1. Ground rules
1. Work in **letter order** unless `DEPENDENCY-PLAN.md` says two workstreams are parallel. Never start a workstream whose dependencies are not `Done` in `STATUS.md`.
2. The specs are the contract. Each workstream lists the exact requirements it implements. **Every `#### Scenario` becomes at least one unit test**; the workstream's Scenarios section is the checklist (tick it when the test exists and passes).
3. Decisions are in `DECISIONS.md`. If a task conflicts with a decision, stop and ask.
4. Secrets (`CTP_CLIENT_SECRET`, `CTP_PROV_*`, `SESSION_SECRET`, `SEED_CTP_*`, `SEED_DEMO_PASSWORD`) **never** go in git, chat, logs, tests, fixtures or `PROJECT-FINDINGS.md`. Never read `~/.commercetools/*`.
5. Only tasks in your workstream file are in scope. Do not "improve" other code. Park ideas in `IDEAS.md`.
6. **Data rule:** never put a password, session token, reset token, document content, or a company's data into a URL, log line, analytics event, error message shown to users, or cache shared between users. Test data is synthetic (`@example.com`).
7. **Never touch any commercetools project other than the one in `.env.local`/`seed/.env.local`.** The `spec-b2c-health` project belongs to another team.

## 2. How to do a task (the loop)
1. Open the workstream file; take the next unchecked task (`E-03`).
2. One branch per workstream: `git switch -c ws/<letter>-<slug>` from the planning branch.
3. Write the **test first** (or with the code) for the scenarios the task names.
4. Implement exactly the files and signatures listed. Other workstreams import those names.
5. Run `cd site && npm run check` (type-check, lint, version gate, unit tests; then `npm run build` before the last task). For the seed package: `cd seed && npm run check`. It must pass.
6. Commit: `ws-<letter>: <task id> <summary>` (one task = one commit). Never commit `.env*` except `.env.example`.
7. Tick the checkbox in the workstream file and run `node plans/verify-plan.mjs --sync` to refresh counts. Do not tick without a passing `check`.
8. When the last task is done: walk the workstream's **Definition of done**, set `Ready for review` in `STATUS.md`. Claude then runs the browser verification and project-data checks and sets `Done`.

## 3. Unit tests
- Vitest + Testing Library + jsdom; test files sit next to the code (`thing.ts` → `thing.test.ts`).
- **Never call the real commercetools API in a unit test.** Mock `@/lib/ct/*` (server code) or `fetch` (hooks). Route handlers: import `GET/POST` and call with `new Request(...)`; mock `@/lib/session` and `@/lib/ct/*`.
- Name tests after the scenario: `it('Email already has an account', ...)`.
- A bug fix needs a failing test first.
- Test helpers (`renderWithProviders`, request helper) are created in workstream A and extended later; reuse them.

## 4. Browser verification — Claude does it, you prepare it
The owner does **not** click through the app. Claude drives a real browser (Chrome DevTools connector) against `npm run dev` and checks project data through the Merchant Center MCP. You make that fast:
1. Each workstream has a **Browser recipe**. When you finish, make sure its steps are accurate: URLs, demo accounts (from the seed), what to see, what the console and network must show.
2. If something cannot be exercised without data that does not exist, add the data to the seed (workstream E) instead of asking the owner.
3. Leave the dev server startable with `npm run dev` and a documented `.env.local` template.

## 5. Manual testing — ONLY what a machine cannot do
Report these in `TODO-MANUAL-TESTING.md` section 3 (next id `M-<letter>-<n>`): visual fidelity judgement, a real phone, legal wording, anything needing a human's account. Each row: **What to do** (numbered steps, exact URLs/inputs), **Expected**, **Needs**, **Status** = `TODO`. Commit it with the task (`ws-<letter>: <task> report M-<letter>-<n>`). Only the owner sets `PASS`/`FAIL`. If a task cannot be unit-tested **or** browser-verified, add the manual test **before** ticking the task. **Everything else the owner must do goes in sections 1 and 2** (`OA-*`, `SO-*`) — never leave a manual step only in a commit message or chat.

## 6. Owner actions and sign-offs
- `OA-*`: only the owner can do it (API clients, hosting, connecting tools). If your task needs one that is not `DONE`, stop and ask; never fake it.
- `SO-*`: surfaces the prototype did not design (PDP, quote list, registration, portal, privacy page, mobile menu). Build them as specified; the workstream is not `Done` until its `SO-*` is approved.

## 7. Code conventions
- TypeScript strict, no `any` (use `unknown` + narrowing). Components import types from `@/lib/types` only.
- `lib/ct/**` and `lib/session.ts` start with `import 'server-only'`; client code never imports them. No `@commercetools/platform-sdk` outside `lib/ct` and `lib/mappers`.
- Locale-aware navigation from `@/i18n/routing`, never bare `next/link`/`next/navigation` in locale UI.
- Never format or show a service price (D12/D21). Strings via `getLocalizedString`, never a hard-coded locale key.
- Design tokens only: no hex, no `px` that a token carries, no font outside Inter / Inter Display. Every interactive element is a real `button`/`a` with a visible focus ring (the prototype's clickable `<a onclick>` are defects, see `design/malva/DESIGN.md`).
- Server Components by default; `'use client'` only for interactive leaves; no function props across the boundary; never wrap `redirect()`/`notFound()` in `try/catch`.
- Layouts never read the session (D20). Per-visitor state is SWR → Route Handler.
- User-visible strings come from `messages/en-US.json` (en-US and de-DE catalogues with identical keys; sentence case; no emoji; copy rules in `design/malva/DESIGN.md`).
- commercetools code: load the `commercetools-*` skill named by the task `[SKILL: …]` first; do not invent endpoints, update actions or permission names from memory.
- Seed/data scripts: idempotent (safe to run twice), `--dry-run` supported, never delete anything not in the reviewed manifest (see `SEED-PLAN.md`), refuse to run against a project key other than the configured one.

## 8. Stop and ask
Write the question in `QUESTIONS.md` (format there), set it `Blocking: yes/no`, tell the owner. Stop when:
- a decision looks wrong or two docs disagree;
- a commercetools response differs from the workstream (record it in `PROJECT-FINDINGS.md`);
- you need a package not listed; a test needs real credentials;
- a task would take more than a day;
- anything touches secrets, deploy settings, or project data outside the seed scripts.

## 9. Definition of done (every workstream)
- All tasks ticked, each with a passing `check` commit.
- Every scenario of the listed requirements has a named test (the Scenarios checklist is ticked).
- Browser recipe accurate; owner-only items reported in `TODO-MANUAL-TESTING.md`.
- No `TODO`/`FIXME` in code without an `IDEAS.md` entry.
- `node plans/verify-plan.mjs` passes; `STATUS.md` updated to `Ready for review`.
