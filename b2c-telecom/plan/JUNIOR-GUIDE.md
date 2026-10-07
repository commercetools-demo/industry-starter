# Junior developer guide

Read this once, then follow one workstream file at a time (`plan/workstreams/<LETTER>-*.md`). Everything you need is in those files, `plan/DECISIONS.md` and the OpenSpec specs they link. **Do not guess. If something is unclear, stop and ask (see "Stop and ask").**

## 1. Ground rules
1. Work **in letter order** unless `DEPENDENCY-PLAN.md` says two workstreams are parallel. Never start a workstream whose dependencies are not `Verified` in `STATUS.md`.
2. The specs are the contract: `openspec/specs/<capability>/spec.md`. Each workstream lists the exact capabilities it implements. **Every `#### Scenario` becomes at least one unit test**, and the workstream's table names which one.
3. Decisions are in `plan/DECISIONS.md`. If a task conflicts with a decision, stop and ask.
4. Secrets (`CTP_CLIENT_SECRET`, `SESSION_SECRET`, Adyen keys, `.envrc` contents) **never** go in git, chat, logs, issues, tests, fixtures or `PROJECT-FINDINGS.md`. Never read `~/.commercetools/*`.
5. Only tasks in the workstream file are in scope. Do not "improve" other code. Write unrelated ideas into `plan/IDEAS.md`.
6. Design comes from `design/` (read `design/DESIGN.md` and the matching `design/specs/*.md`). Use tokens by name; never raw hex, px spacing or fonts (lint enforces it).

## 2. How to do a task (the loop)
1. Open the workstream file; take the next unchecked task (`A-03`).
2. `git switch -c ws/<letter>-<slug>` once per workstream (from `main`); one branch per workstream.
3. Write the **test first** (or with the code) for the scenarios the task names.
4. Implement exactly the files and signatures listed. Use the names given; other workstreams import them.
5. Run `cd site && npm run verify` (secrets check → lockfile → tokens → lint → typecheck → test → build). It must pass. Paste nothing secret.
6. Commit: `ws-<letter>: <task id> <short summary>` (one task = one commit). Never commit `.env*` (except `.env.example`).
7. Tick the checkbox in the workstream file and run `node plan/verify-plan.mjs --sync` (updates `STATUS.md`). Do not tick without a passing `verify`.
8. When the **last** task is done: run the workstream's "Definition of done" checklist, set it to `Ready for review` in `STATUS.md` and tell the owner. Claude then runs the Chrome checks and sets `Verified`.

## 3. Tests (unit tests, Vitest)
- Vitest + Testing Library + jsdom. Test files sit next to the code: `thing.ts` → `thing.test.ts`.
- **Never call the real commercetools API in a unit test.** Mock `@/lib/ct/*` (server code) or `fetch` (hooks). Route handlers: import `GET/POST` and call with `new Request(url, {method, body})`; mock `@/lib/session` and `@/lib/ct/*`.
- Components needing translations: use `renderWithProviders` from `site/test/utils.tsx`.
- Worked examples for async Server Components, route handlers, `next/headers`/`next-intl` mocks and hooks: `plan/recipes/testing-patterns.md`. Copy them; do not invent new mocking styles.
- Name tests after the scenario: `it('Wrong password: shows the generic message', ...)`. The scenario titles in the workstream table must appear verbatim in the test names (the plan verifier checks the workstream files, reviewers check the tests).
- A bug fix needs a failing test first.

## 4. Verification and manual testing — who does what
- **You do not do manual testing.** After you set a workstream to `Ready for review`, Claude starts the app against the live seeded project and drives it with the Chrome DevTools connector (screenshots, console, network, accessibility, Lighthouse, responsive sizes). The checks are the `C-<letter>-<n>` lines in your workstream file and results go to `plan/VERIFICATION-LOG.md`. If a check fails, Claude reopens the task with the failure; fix it and set `Ready for review` again.
- You **write the Chrome checks** for your workstream (a `- C-<letter>-<n>: <exact URL/steps> → <expected result>` line each) when you design the task, so Claude knows precisely what to verify. Write them as if for someone who has never seen the app.
- Only things Claude cannot do go to the owner as `M-<letter>-<n>` lines (Merchant Center, Adyen/Netlify accounts, subjective visual sign-off, anything needing a person's credentials). Add them with `- M-<letter>-<n> (needs OA-nn): <steps> → <expected>`. Never write "tested manually" in `STATUS.md`; only the owner sets an `M-` test to `PASS`/`FAIL`, only Claude sets a `C-` check result.
- If the task cannot be unit-tested at all, add the `C-`/`M-` line **before** ticking the task.

## 5. Owner actions and sign-offs
- Items that need something only the owner can do (API clients, approvals, Checkout/Adyen/Netlify setup) are `OA-*` in `TODO-MANUAL-TESTING.md`. If your task needs one and it is not `DONE`, stop and ask; do not fake it.
- Designs not drawn in the prototype need approval (`SO-*`). Build them as specified; the workstream is not `Verified` until its `SO-*` is approved or waived.

## 6. Code conventions (summary; details in workstream B)
- TypeScript strict, no `any` (use `unknown` + narrowing). Components import types from `@/lib/types` only.
- `lib/ct/**` starts with `import 'server-only'`. Client code never imports it. The commercetools SDK is only imported under `lib/ct/**`.
- Locale-aware navigation from `@/i18n/routing`, never `next/link` / `next/navigation` for `Link/useRouter/redirect`.
- Money: `formatMoney`; strings: `getLocalizedString`; no hex/px a token carries; no user-visible hard-coded strings (messages files, both locales `en-US` and `de-DE`).
- Server Components by default; `'use client'` only for interactive leaves; no function props across the boundary.
- Never wrap `redirect()/notFound()` in `try/catch`.
- Every new message key is added to **both** `messages/en-US.json` and `messages/de-DE.json`.
- Customer-scoped data: no `/me` endpoints (D-070). Filter every query by the session's `customerId`/`anonymousId` and recheck ownership of any id coming from the client; add the "other customer's resource is refused" test.
- Every commercetools resource we create has a stable `malva-` key; never rely on generated ids.
- Before any commercetools-touching task, load the skill named in the task's `[SKILL: …]` tag.

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
- `C-` checks written for every user-visible behaviour; `M-` tests only where Claude cannot do it.
- No TODO/FIXME left in code without a `plan/IDEAS.md` entry.
- `STATUS.md` updated; status `Ready for review`.
