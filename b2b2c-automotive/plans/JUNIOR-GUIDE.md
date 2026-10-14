<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Junior developer guide

Read this once, then follow **one workstream file at a time** (`plans/workstreams/<LETTER>-*.md`). Everything you need is in that file, `DECISIONS.md` and the OpenSpec specs it links. **Do not guess. If something is unclear, write the question down (section 8) and carry on with the default; never wait silently.**

## 0. Where things are
| What | Where |
| --- | --- |
| Behaviour (the contract) | `openspec/specs/consumer-storefront/{bootstrap-and-structure,theming-design,design-*}`, `openspec/specs/seller-portal/{bootstrap-and-structure,design-*}`; ignore the other spec directories (generated templates) |
| Design decisions, conflicts, open questions A to K | `openspec/changes/b2b2c-automotive-design/design.md` |
| Design export (tokens, layouts, copy) | `design/` |
| Order of work | `plans/DEPENDENCY-PLAN.md` (A to Z), status in `plans/STATUS.md` |
| Your tasks | `plans/workstreams/<LETTER>-*.md` |
| Decisions already made | `plans/DECISIONS.md`; open questions `plans/QUESTIONS.md` |
| Things only the owner can do or test | `plans/TODO-MANUAL-TESTING.md` |
| Apps | `storefront/` (shopper, Next.js 16, multi-tenant by URL path `/[locale]/[store]`), `portal/` (Partner Portal, Next.js 16) |
| Seed package | `seed/` (own package, own `.env.local`) |
| Evidence you produce | `plans/evidence/<LETTER>/` |

## 1. Ground rules
1. Work in **letter order** unless `DEPENDENCY-PLAN.md` says two workstreams are parallel. Never start a workstream whose dependencies are not `Done` in `STATUS.md`.
2. The specs are the contract. Each workstream lists the exact specs it implements. **Every `#### Scenario` becomes at least one unit test** (or a browser or MCP check recorded as evidence when it cannot be unit-tested); tick the workstream's Scenarios checklist only when it exists and passes.
3. Decisions are in `DECISIONS.md`. If a task conflicts with a decision, write a question (section 8) and keep the decision until the owner answers.
4. **Secrets** (any `CTP_CLIENT_SECRET`, `SEED_CTP_*`, `SESSION_SECRET`, Contentools JWT, demo passwords, API tokens) **never** go in git, chat, logs, tests, fixtures, evidence or `PROJECT-FINDINGS.md`. Only `.env.example` files (names, no values) are committed; real values live in git-ignored `.env.local`. Never read `~/.commercetools/*`.
5. Only tasks in your workstream file are in scope. Do not "improve" other code. Park ideas in `IDEAS.md`.
6. **Data rule:** never put a password, session token, JWT, or a customer's personal data into a URL, log line, analytics event, error message shown to users, or a cache shared between users. Test data is synthetic (`@example.com`).
7. **Never touch any commercetools project other than `spec-test-b2b2c-automotive`** (the one in `.env.local` and `seed/.env.local`). Other projects (for example the health project) belong to other teams. Scripts refuse to run when the configured project key differs.
8. **Seeded keys start with `mau-`** (products, categories, stores, business units, roles, selections, types, channels, discounts, customers' keys). Anything without the prefix is not yours.
9. **Image URLs are stored clean**: no query string, no fragment. Size or compress at render time, never in the stored value.
10. **No wildcard deletes.** The MCP has no delete tool. Deleting happens only in seed scripts that read an explicit, reviewed allowlist of keys or ids. Never "delete everything that is not mine".
11. Locales are `de-DE` and `en-US` only. Resellers earn **margin**, not commission. There is **no fitting (installation) service**. Do not add either.

## 2. How to do a task (the loop)
1. Open the workstream file; take the next unchecked task (`E-03`).
2. One branch per workstream: `git switch -c ws/<letter>-<slug>` from the planning branch.
3. Write the **test first** (or with the code) for the scenarios the task names.
4. Implement exactly the files and signatures listed. Other workstreams import those names.
5. Run the gate in the app you touched: `cd storefront && npm run check`, `cd portal && npm run check` or `cd seed && npm run check` (type-check, lint, unit tests). Run `npm run build` before the last task. It must pass.
6. Commit: `ws-<letter>: <task id> <summary>` (one task per commit). Never commit `.env*` except `.env.example`.
7. Tick the checkbox in the workstream file and run `node plans/verify-plan.mjs --sync` to refresh counts. Do not tick without a passing `check`.
8. When the last task is done, walk the workstream's **Definition of done**, run section 4 yourself, save the evidence, and set `Ready for review` in `STATUS.md`. The lead confirms and sets `Done`.

## 3. Unit tests
- Vitest + Testing Library + jsdom; test files sit next to the code (`thing.ts` next to `thing.test.ts`).
- **Never call the real commercetools or Contentools API in a unit test.** Mock the server modules (`lib/ct/*`, `lib/contentools/*`) or `fetch`. Route handlers: import `GET/POST` and call with `new Request(...)`.
- Name tests after the scenario: `it('Fitting part shows the fit badge', ...)`.
- A bug fix needs a failing test first.
- Test helpers are created in workstream A and extended later; reuse them.

## 4. Verify on your own (browser and project data)
You verify your own work; the owner does not click through the apps.
- **Browser:** drive the running app with the **Chrome DevTools MCP** (`npm run dev`, then navigate, snapshot, screenshot at 375 px and 1440 px, read console and network). Follow the workstream's **Browser recipe**; the console must show no errors and the network no failed requests.
- **Project data:** read back with the **`b2b2c-automotive` MCP** (project `spec-test-b2b2c-automotive`): products, stores, business units, orders, custom objects. The MCP can read, create and update, **not delete**; create, delete and bulk update happen through seed scripts.
- **Record evidence** in `plans/evidence/<LETTER>/`: screenshots (`<task>-<what>-375.png`), MCP read-backs as trimmed JSON or markdown (ids and keys only, no personal data, no secrets), and a short `README.md` listing what each file proves. Link it from the workstream's Definition of done.
- If something cannot be exercised because data is missing, add the data to the seed (workstreams D to F) instead of asking the owner.
- Leave the dev server startable with `npm run dev` and a documented `.env.example`.

## 5. Manual testing and owner-only actions: ANY item goes in `TODO-MANUAL-TESTING.md`
Whatever only the owner can test or do goes into `plans/TODO-MANUAL-TESTING.md` as a row. **Never leave a manual step only in a commit message, a chat message or your head.**

| Prefix | Meaning | Next id |
| --- | --- | --- |
| `OA-nn` | **Owner action**: creating API clients, installing a Merchant Center app, hosting, domains, a payment account, a provider contract | next free `OA-nn` |
| `SO-nn` | **Sign-off**: a decision or approval on something not designed (missing screens, legal wording, real content) | next free `SO-nn` |
| `M-<LETTER>-nn` | **Manual test**: visual fidelity judgement, a real phone, a real card, anything needing a human's account (no mail inbox: no email is sent) | next free number for your workstream letter |

Each row states: **who** (owner or named person), **when** (the workstream or gate that needs it, and what is blocked until it is done), **exact steps** (numbered, with URLs, inputs and which file to put a value in, never the value itself), **expected result**, and **status** (`TODO`). Only the owner sets `DONE`, `PASS`, `FAIL` or `WAIVED`.

**Never wait silently.** If your task needs an owner item that is not done: add the row (or reference the existing one), write the default you will build to in `QUESTIONS.md` if it is a decision, finish everything that does not depend on it, mark the dependent task `blocked: OA-nn` in the workstream file, and tell the lead in your hand-off. Then continue with the next unblocked task.

## 6. Code conventions
- TypeScript strict, no `any` (use `unknown` plus narrowing). Components import types from the app's own `types` module only.
- Server-only modules start with `import 'server-only'`; client code never imports them. No `@commercetools/platform-sdk` outside the server layer (`lib/ct`, `lib/mappers`). Stay on `platform-sdk` ^8 and `ts-client` ^4 (D-018).
- Locale-aware navigation from the app's i18n routing module, never bare `next/link` or `next/navigation` in locale UI. Strings come from the `de-DE` and `en-US` catalogues with identical keys; never hard-code a locale key.
- **Design tokens only** in components: no hex values, no `px` that a token carries, no font outside the kit (automotive kit for `storefront/`, admin kit for `portal/`). The prototype uses raw hex; do not copy it.
- Currency, tax label, shipping threshold and country come from store configuration, never from constants (prototype CAD, HST 13% and "$99" are placeholders).
- Prototype data (parts, prices, names such as "Hartmann", "Autoline") must not leak into seed or copy.
- Role, store-scope (`authorizeStore`) and price-sanity checks (any price above zero) are enforced **on the server** (route handlers and server actions), not only by hiding portal controls. There is no MAP floor and no territory blocking (owner 2026-10-12, D-030, D-031). The portal has two roles, Admin and Buyer. No email is ever sent (D-034).
- The browser reaches Contentools only through the same-origin `/api/contentools` proxy; the JWT never reaches the browser.
- Every interactive element is a real `button` or `a` with a visible focus ring.
- Server Components by default; `'use client'` only for interactive leaves; never wrap `redirect()` or `notFound()` in `try/catch`.
- commercetools code: load the `commercetools-*` skill named by the task (`[SKILL: ...]`) first; do not invent endpoints, update actions or permission names from memory.
- Seed scripts: idempotent (safe to run twice), `--dry-run` supported, `mau-` keys, explicit delete allowlist, refuse a project key other than the configured one.

## 7. Reporting back
End every working session with a short hand-off in your reply: tasks done, evidence paths, new questions (`Q-<letter>-<n>` in `plans/notes/questions-<letter>.md` or directly in `QUESTIONS.md`), new `OA`/`SO`/`M` rows, anything blocked and on which row.

## 8. Questions: write them down, keep the default, do not block
Add a row to `plans/QUESTIONS.md` (or, when several juniors work at once, to `plans/notes/questions-<letter>.md`, which the lead consolidates). Format: id `Q-<letter>-<n>`, the question, **the default you build to**, whether it blocks anything, status `Open`. Build to the default unless it conflicts with a decision, a secret or another project. Stop (after writing the question and telling the lead) only when:
- two documents disagree and no default is safe;
- a commercetools response differs from the workstream (record it in `PROJECT-FINDINGS.md`);
- you need a package not listed, or a test would need real credentials;
- a task would take more than a day;
- anything touches secrets, deploy settings, or project data outside the seed scripts.

## 9. Definition of done (every workstream)
- All tasks ticked, each with a passing `check` commit.
- Every scenario of the listed specs has a named test or recorded evidence (the Scenarios checklist is ticked).
- Browser recipe verified by you; evidence saved in `plans/evidence/<LETTER>/`.
- Owner-only items reported in `TODO-MANUAL-TESTING.md`; questions in `QUESTIONS.md`.
- No `TODO` or `FIXME` in code without an `IDEAS.md` entry.
- `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
