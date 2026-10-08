# Junior developer guide

Read this once, then follow one workstream file at a time (`plans/workstreams/<LETTER>-*.md`). Everything you need is in that file, `DECISIONS.md` and the OpenSpec specs it links. **Do not guess. If something is unclear, stop and ask (section 7).**

## 1. Ground rules
1. Work in **letter order** unless `DEPENDENCY-PLAN.md` says two workstreams are parallel. Never start a workstream whose dependencies are not `Done` in `STATUS.md`.
2. The specs are the contract. Each workstream lists the exact requirements it implements. **Every `#### Scenario` becomes at least one unit test**; the workstream file maps scenario → test name.
3. Decisions are in `DECISIONS.md`. If a task conflicts with a decision, stop and ask.
4. Secrets (`CTP_CLIENT_SECRET`, `SESSION_SECRET`, PSP keys, seed admin credentials) **never** go in git, chat, logs, tests, fixtures or `PROJECT-FINDINGS.md`. Never read `~/.commercetools/*`.
5. Only tasks in your workstream file are in scope. Do not "improve" other code. Park ideas in `IDEAS.md`.
6. **Health data rule** (`health-data-minimization`): no lab value, medication name, reason-for-visit text, RX number or booking detail in a URL, log line, analytics event, error report, cache, or commercetools order note. Test data is synthetic; never paste real patient data anywhere.

## 2. How to do a task (the loop)
1. Open the workstream file; take the next unchecked task (`E-03`).
2. One branch per workstream: `git switch -c ws/<letter>-<slug>` from the planning branch.
3. Write the **test first** (or with the code) for the scenarios the task names.
4. Implement exactly the files and signatures listed. Other workstreams import those names.
5. Run `cd site && npm run check` (type-check, lint incl. design lint, version gate, token parity, unit tests; then `npm run build` before the last task). It must pass.
6. Commit: `ws-<letter>: <task id> <summary>` (one task = one commit). Never commit `.env*` except `.env.example`.
7. Tick the checkbox in the workstream file and update the counts in `STATUS.md`. Do not tick without a passing `check`.
8. When the last task is done: walk the workstream's **Definition of done**, set `Ready for review` in `STATUS.md`. Claude then runs the browser verification and project-data checks and sets `Done`.

## 3. Unit tests
- Vitest + Testing Library + jsdom; test files sit next to the code (`thing.ts` → `thing.test.ts`).
- **Never call the real commercetools API in a unit test.** Mock `@/lib/ct/*` (server code) or `fetch` (hooks). Route handlers: import `GET/POST` and call with `new Request(...)`; mock `@/lib/session` and `@/lib/ct/*`.
- Name tests after the scenario: `it('Unknown or foreign RX: same message for both', ...)`.
- A bug fix needs a failing test first.
- Test helpers (`renderWithProviders`, request helper) are created in workstream A and extended by later ones; reuse, do not invent new mocking styles.

## 4. Browser verification — Claude does it, you prepare it
The owner does **not** click through the app. Claude drives a real browser (Chrome DevTools connector) against `npm run dev` and checks project data through the Merchant Center MCP. You make that fast:
1. Each workstream file has a **Browser recipe** section. When you finish, make sure its steps are accurate: URLs, test accounts (from the seed), what to see, what the console and network must show.
2. If something cannot be exercised without data that does not exist, add the data to the seed (workstream E) instead of asking the owner.
3. Leave the dev server startable with `npm run dev` and a documented `.env.local` template; never ask Claude to supply secrets in chat.

## 5. Manual testing — ONLY what a machine cannot do
Report these in `TODO-MANUAL-TESTING.md` section 3 (next id `M-<letter>-<n>`): real payment card in the PSP sandbox, real email inbox delivery, legal/consent copy, visual sign-off against the design, anything needing a human's account. Each row: **What to do** (numbered steps, exact URLs/inputs), **Expected**, **Needs**, **Status** = `TODO`. Commit it with the task (`ws-<letter>: <task> report M-<letter>-<n>`). Only the owner sets `PASS`/`FAIL`. If a task cannot be unit-tested **or** browser-verified, add the manual test **before** ticking the task.

## 6. Owner actions and sign-offs
- `OA-*`: something only the owner can do (create an API client, PSP/email account, hosting). If your task needs one that is not `DONE`, stop and ask; never fake it.
- `SO-*`: surfaces the prototype did not design (address book, error pages, registration, reset, static pages, empty/error states, mobile menu). Build them as specified; the workstream is not `Done` until its `SO-*` is approved.

## 7. Code conventions (details in workstream A and the `bootstrap-storefront` specs)
- TypeScript strict, no `any` (use `unknown` + narrowing). Components import types from `@/lib/types` only.
- `lib/ct/**` and `lib/session.ts` start with `import 'server-only'`; client code never imports them. No `@commercetools/platform-sdk` outside `lib/ct` and `lib/mappers`.
- Locale-aware navigation from `@/i18n/routing`, never bare `next/link`/`next/navigation`.
- Money via `formatMoney`, strings via `getLocalizedString`, never `centAmount / 100`. Totals come from the platform, never summed in the browser.
- Design tokens only: no hex, no `px` a token carries, no font outside Poppins/Lato/Roboto. Every interactive element is a real `button`/`a` with a visible focus ring (the prototype's clickable `div`s are defects, see `design/DESIGN.md`).
- Server Components by default; `'use client'` only for interactive leaves; no function props across the boundary; never wrap `redirect()`/`notFound()` in `try/catch`.
- User-visible strings come from `messages/en-US.json` (US English; copy conventions in `design/DESIGN.md`).
- Commercetools code: load the `commercetools-*` skill named by the task `[SKILL: …]` first; do not invent endpoints or update actions from memory.
- Seed/data scripts: idempotent (safe to run twice), `--dry-run` supported, never delete anything not tagged by the seed (see `SEED-PLAN.md`).

## 8. Stop and ask
Write the question in `QUESTIONS.md` (format there), set it `Blocking: yes/no`, tell the owner. Stop when:
- a decision looks wrong or two docs disagree;
- a commercetools response differs from the workstream (record it in `PROJECT-FINDINGS.md`);
- you need a package not listed; a test needs real credentials;
- a task would take more than a day;
- anything touches secrets, deploy settings, or project data outside the seed scripts.

## 9. Definition of done (every workstream)
- All tasks ticked, each with a passing `npm run check` commit.
- Every scenario of the listed specs has a named test (the workstream maps them).
- Browser recipe accurate; owner-only manual tests and `OA-`/`SO-` items reported.
- No `TODO`/`FIXME` in code without an `IDEAS.md` entry.
- `STATUS.md` updated to `Ready for review`.
