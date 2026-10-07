# Junior developer guide

Read this once, then follow one workstream file at a time (`plan/workstreams/<LETTER>-*.md`). Everything you need is in those files, `plan/DECISIONS.md` and the OpenSpec specs they link. **Do not guess. If something is unclear, stop and ask (see "Stop and ask").**

## 1. Ground rules
1. Work **in letter order** unless `DEPENDENCY-PLAN.md` says two workstreams are parallel. Never start a workstream whose dependencies are not marked Done in `STATUS.md`.
2. The specs are the contract: `openspec/changes/{bootstrap-nextjs-storefront,malva-storefront-design,grocery-storefront-features}/specs/**/spec.md`. Each workstream lists the exact requirements it implements. Every `#### Scenario` becomes at least one unit test.
3. Decisions are in `plan/DECISIONS.md`. If a task conflicts with a decision, stop and ask.
4. Secrets (`CTP_CLIENT_SECRET`, `SESSION_SECRET`, Adyen keys, `.envrc` contents) **never** go in git, chat, logs, issues, tests, fixtures or `PROJECT-FINDINGS.md`. Never read `~/.commercetools/*`.
5. Only tasks in the workstream file are in scope. Do not "improve" other code. Write unrelated ideas into `plan/IDEAS.md`.

## 2. How to do a task (the loop)
1. Open the workstream file; take the next unchecked task (`A-03`).
2. `git switch -c ws/<letter>-<slug>` once per workstream (from `main`, after the planning branch is merged); one branch per workstream.
3. Write the **test first** (or with the code) for the scenarios the task names.
4. Implement exactly the files and signatures listed. Use the names given; other workstreams import them.
5. Run `cd site && npm run verify` (lint → typecheck → test → build). It must pass. Paste nothing secret.
6. Commit: `ws-<letter>: <task id> <short summary>` (one task = one commit). Do not commit `.env*` (except `.env.example`).
7. Tick the checkbox in the workstream file and update `plan/STATUS.md` (task counts). Do not tick without a passing `verify`.
8. When the **last** task is done: run the workstream's "Definition of done" checklist, then set it to `Ready for review` in `STATUS.md` and tell the owner. The owner/Claude verifies and sets `Done`.

## 3. Tests (unit only — D-004)
- Vitest + Testing Library + jsdom. Test files sit next to the code: `thing.ts` → `thing.test.ts`.
- **Never call the real commercetools API in a unit test.** Mock `@/lib/ct/*` (server code) or `fetch` (hooks). Route handlers: import `GET/POST` and call with `new Request(url, {method, body})`; mock `@/lib/session` and `@/lib/ct/*`.
- Components needing translations: use `renderWithProviders` from `site/test/utils.tsx`. It is created in A as a stub (fresh `SWRConfig provider: () => new Map()` only), extended in D (`NextIntlClientProvider` with `messages/<locale>.json`) and in H (`ToastProvider`).
- Worked examples for async Server Components, route handlers, `next/headers`/`next-intl` mocks and hooks: `plan/recipes/testing-patterns.md`. Copy them; do not invent new mocking styles.
- Name tests after the scenario: `it('Wrong password: shows the generic message', ...)`.
- A bug fix needs a failing test first.

## 4. Manual testing — you do NOT do it, the owner does; you REPORT it
Unit tests cannot cover real commercetools, Merchant Center, Adyen, Netlify or visual fidelity. For anything the owner must try by hand:
1. Open `plan/TODO-MANUAL-TESTING.md`, section **3. Manual tests**.
2. Add (or complete the pre-seeded) row with the next id `M-<letter>-<n>`: *What to do* (numbered steps with exact URLs/inputs), *Expected result*, *Needs* (credentials, data), *Status* = `TODO`.
3. Commit it with the task (`ws-<letter>: <task id> report M-<letter>-<n>`).
4. Never write "tested manually" yourself in `STATUS.md`. Only the owner sets a manual test to `PASS`/`FAIL`.
If the task cannot be unit-tested at all, you must add the manual test **before** ticking the task.

## 5. Owner actions and sign-offs
- Items that need something only the owner can do (credentials, Merchant Center setup, Adyen, Netlify) are `OA-*` in the TODO file. If your task needs one and it is not `DONE`, stop and ask; do not fake it.
- Designs not drawn in the MALVA prototype need approval (`SO-*`). Build them as specified, but the workstream is not Done until its `SO-*` is approved.

## 6. Code conventions (summary; details in workstream B)
- TypeScript strict, no `any` (use `unknown` + narrowing). Components import types from `@/lib/types` only.
- `lib/ct/**` starts with `import 'server-only'`. Client code never imports it.
- Locale-aware navigation from `@/i18n/routing`, never `next/link` / `next/navigation` for `Link/useRouter/redirect`.
- Money: `formatMoney`; strings: `getLocalizedString`; no hex/px a token carries; no user-visible hard-coded strings (messages files, both locales).
- Server Components by default; `'use client'` only for interactive leaves; no function props across the boundary.
- Never wrap `redirect()/notFound()` in `try/catch`.
- Every new message key is added to **both** `messages/en-US.json` and `messages/de-DE.json` (German can be a faithful translation; mark machine-translated keys in `plan/IDEAS.md` for review).

## 7. Stop and ask (write the question in `plan/QUESTIONS.md`, tell the owner)
- A decision seems wrong or two docs disagree.
- A commercetools response differs from what the workstream says (record it in `PROJECT-FINDINGS.md`).
- You need a package not listed.
- A test needs real credentials.
- A task would take more than a day.
- Anything that touches secrets, deploy settings or the commercetools project data outside the seed scripts.

## 8. Definition of done (every workstream)
- All tasks ticked, each with a passing `npm run verify` commit.
- Every scenario in the listed specs has a test (the workstream file maps them).
- Manual tests reported in the TODO file; owner actions identified.
- No TODO/FIXME left in code without a `plan/IDEAS.md` entry.
- `STATUS.md` updated; status `Ready for review`.
