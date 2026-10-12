<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream A: Scaffold both apps, tooling, quality gate

**Depends on:** none (first workstream).
**Owner prerequisites:** none. No commercetools call happens in A; placeholders in `.env.local` are enough.
**Branch:** `ws/a-scaffold-both-apps`. One task = one commit: `ws-A: A-03 <summary>`. Never commit `.env*` except `.env.example`.
**Skills:** `commercetools-storefront` (Next.js adapter: `references/stack/nextjs/project-layout.md`, `overview.md`), `commercetools-platform` (SDK setup).

## 1. Goal

Two empty-but-gated Next.js 16 apps exist: `b2b2c-automotive/storefront/` (shopper) and `b2b2c-automotive/portal/` (partner portal). From a clean clone, in each app, `npm ci && npm run check && npm run build` is green. Every gate script named in the specs exists, works and is covered by a test. No feature code, no tokens, no locale logic (B, C), no commercetools client (G).

## 2. Specs and requirements implemented

Primary owner of both specs. Requirements for which A delivers the whole thing are marked **full**; the others are delivered in part here and finished by the workstream named.

`b2b2c-automotive/openspec/specs/consumer-storefront/bootstrap-and-structure/spec.md` (storefront)
| Requirement title | A delivers |
| --- | --- |
| Scaffold with the pinned stack | full |
| Directory structure | full (folders only where they hold a file; see 4.4) |
| Styling from the automotive tokens | gate script placeholder only; B does the tokens |
| Locale routing for two locales | not here (C) |
| Store resolved from the path | not here (G, I) |
| BFF boundary and helpers | the lint rule "ClientBuilder only in `lib/ct/client.ts`"; G writes the client |
| Stateless session | not here (G) |
| Client state | the lint rule "no `fetch('/api/...')` in components"; hooks come later |
| Contentools reads and the same-origin proxy | the lint rule "no Puck value imports in Server Components"; H does the rest |
| Environment and least privilege | `.env.example` with every variable and scope reason, `check-secrets` |
| Gates and tests | full, including `check-bundle-secrets`, `check-no-dev-pages`, `check-no-health-in-release` |
| Deployment config | full (`netlify.toml`, `AGENTS.md`) |
| Bootstrap acceptance | the `npm run check` part only |

`b2b2c-automotive/openspec/specs/seller-portal/bootstrap-and-structure/spec.md` (portal)
| Requirement title | A delivers |
| --- | --- |
| Scaffold with the same pinned stack | full (plus the three Puck manager packages) |
| Directory structure | full (same rule as storefront; `check-routes` gets the navigation allow-list later in R) |
| Styling from the admin kit | placeholder only (B) |
| Locale routing for two locales | not here (C) |
| B2B session, As-associate for buying, Permissions in two layers | not here (G, R, X) |
| Contentools JWT, Contentools editors, Isolated editor styling | not here (H lays the storefront half, U and X the portal half) |
| Environment and least privilege | `.env.example` with three credential sets and scope reasons |
| Gates and tests | full, plus the lint rule that fences the admin client (4.6) |
| Deployment config | full |

## 3. Design decisions already taken

| Decision | Source |
| --- | --- |
| App directories are `storefront/` and `portal/` | `design.md` section 8 question K; both bootstrap specs |
| Stack: Next `^16` (latest 16.4.0), React 19, next-intl `^4`, `platform-sdk ^8`, `ts-client ^4`, swr, jose, zod, server-only, Tailwind v4 via `@tailwindcss/postcss`, Node 22 | storefront spec "Scaffold with the pinned stack"; `design.md` question J (stay on the pins) |
| No Tailwind config file; scaffold with `--tailwind=false` then add Tailwind v4 by hand | storefront spec "Tailwind v3 guard" |
| No npm workspace; shared code is copied between apps | storefront spec "Gaps and decisions" |
| Admin client importable only from `app/api/seller/**`, `lib/ct/seller/**`, `lib/contentools/jwt.ts` | portal spec "As-associate for buying, admin client for selling" |
| Storefront Contentools proxy never forwards writes | storefront spec "Contentools reads and the same-origin proxy" |
| Gate scripts ported from `b2b-manufacturing/site/scripts`; drop `check-sample-content` | storefront spec "Gates and tests" |
| Release builds contain no health route and no dev pages | both specs, "Gates and tests", "Deployment config" |

Defaults chosen by this plan (not in the specs):
- Package names `malva-storefront` and `malva-portal`; both `"private": true`.
- Test runner Vitest 3 or newer with jsdom, Testing Library, `jest-axe`, as in `b2b-manufacturing/site/package.json` (copy its versions).
- Gate scripts exist **per app** (duplicated in `storefront/scripts` and `portal/scripts`, same files, since there is no workspace). Differences are kept in a small `scripts/app.config.mjs` (3 values: `APP`, `SECRET_VARS`, `ADMIN_CLIENT_ALLOWED`).
- `check-tokens` and `check-messages` are created here as **pass-through scripts** (print `skipped: implemented in workstream B/C` and exit 0, with a test that proves the skip message); B and C replace them.

## 4. Tasks

Do the storefront first, then repeat for the portal with the differences listed in each task. Work in `b2b2c-automotive/` as the project root.

### A-01 Scaffold `storefront/` [SKILL: commercetools-storefront]
1. `cd b2b2c-automotive && node -v` must print v22.x. If not, `nvm install 22`.
2. Run the skill command `/nextjs-setup-project`. It runs, in effect: `npx create-next-app@^16 storefront --typescript --app --src-dir=false --tailwind=false --eslint --import-alias "@/*" --use-npm`. The directory must not exist before the command. **Scaffold first, then add anything else.**
3. `cd storefront && npm i next-intl@^4 @commercetools/platform-sdk@^8 @commercetools/ts-client@^4 swr jose zod server-only @commercetools-demo/puck-renderer @commercetools-demo/puck-editor @commercetools-demo/puck-types`
4. `npm i -D tailwindcss @tailwindcss/postcss postcss vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-axe @types/jest-axe`
5. Pin `next` to an exact version that `npm view next version` reports and is `>=16.4.0` (sibling uses `16.4.0`); keep others as caret ranges. Commit `package-lock.json`.
6. Create `.nvmrc` containing `22`. In `package.json` add `"engines": { "node": ">=22" }`.
7. `postcss.config.mjs`: `export default { plugins: { '@tailwindcss/postcss': {} } };`. `app/globals.css` first line `@import 'tailwindcss';`. No `tailwind.config.*`.
8. Delete the scaffold demo content (`app/page.tsx` becomes `export default function Page() { return null; }`, remove `public/*.svg`, scaffold CSS).
9. Verify: `npm run dev` starts, `curl -s -o /dev/null -w '%{http_code}' localhost:3000/` prints 200. Stop the server.

### A-02 Scaffold `portal/` [SKILL: commercetools-storefront]
Same as A-01 with `portal` as the directory, plus `npm i @commercetools-demo/puck-page-manager @commercetools-demo/puck-content-manager @commercetools-demo/puck-theme-manager`. Do **not** install `puck-renderer` or `puck-editor` explicitly in the portal (they arrive transitively). Check that the Puck manager peer dependencies (`@commercetools/nimbus`, `@chakra-ui/react`, `react-router-dom@<6`, `react-intl`) are listed in `npm ls` output; if `npm i` warns about missing peers, install exactly the versions named in the warning (`npm view @commercetools-demo/puck-theme-manager peerDependencies`). Record the final peer set in `portal/README.md` (A-11). If peers conflict with React 19, stop and add a row to `plans/notes/questions-ABCGH.md` (Q-A01 below is the placeholder).

### A-03 `scripts/check-versions.mjs` (+ test) [SPEC: Scaffold with the pinned stack, Version gate]
Port from `b2b-manufacturing/site/scripts/check-versions.mjs` (read it first). Rules, reading `package.json` and the installed `node_modules/<pkg>/package.json`:
- `next` installed version `> 16.0.0`; `next-intl` major 4; `@commercetools/platform-sdk` major 8; `@commercetools/ts-client` major 4; `react` major 19.
- Fails when `.nvmrc` is missing or does not start with `22`.
Export `checkVersions(root)` returning `string[]` of problems (empty = pass); the CLI part prints them and `process.exit(1)`. Test file `scripts/check-versions.test.mjs` builds a temp dir with fake `package.json` files. Tests: `Version gate passes on the pinned stack`, `Version gate fails on next 15`, `Version gate fails on next-intl 3`, `Version gate fails on platform-sdk 9`, `Version gate fails without .nvmrc`.

### A-04 `scripts/check-tailwind.mjs` (+ test) [SPEC: Scaffold with the pinned stack, Tailwind v3 guard]
Fails when any of `tailwind.config.{js,cjs,mjs,ts}` exists, when `app/globals.css` does not start with `@import 'tailwindcss';`, or when `postcss.config.mjs` lacks `@tailwindcss/postcss`. Tests: `Tailwind v3 guard fails on a config file`, `Tailwind v3 guard fails without the v4 import`, `Tailwind v3 guard passes on the scaffold`.

### A-05 `scripts/check-secrets.mjs` + `.env.example` + `.gitignore` (+ test) [SKILL: commercetools-platform] [SPEC: Environment and least privilege, Undocumented scope; Secret in the bundle (static half)]
1. `.gitignore`: `.env`, `.env.local`, `.env.*.local`, `.next/`, `node_modules/`, `coverage/`, `*.tsbuildinfo`, `.next-build-output.txt`.
2. `storefront/.env.example` (no values, a comment per line; scope reasons are mandatory, one line each):
```
# Project key of the commercetools project (also the Contentools tenant).
CTP_PROJECT_KEY=
# Region auth URL, e.g. https://auth.europe-west1.gcp.commercetools.com
CTP_AUTH_URL=
# Region API URL, e.g. https://api.europe-west1.gcp.commercetools.com
CTP_API_URL=
# Frontend (non-admin) API client id.
CTP_CLIENT_ID=
# Frontend API client secret. Server only. Never NEXT_PUBLIC_.
CTP_CLIENT_SECRET=
# Space separated scopes. Each one is explained below.
# view_project_settings   : read currencies, countries and languages for COUNTRY_CONFIG checks
# view_published_products : product pages and search (published projection)
# view_categories         : category tree and category pages
# view_stores             : resolve the store from the URL path
# view_product_selections : the store's assortment (product selection) for search filters
# view_shipping_methods   : shipping choices at checkout
# view_types              : read custom type definitions (vehicle fitment, garage)
# create_anonymous_token  : anonymous sessions and carts
# manage_customers        : sign-in, registration, account area
# manage_orders           : place and read the shopper's orders
CTP_SCOPES=
# Session cookie signing secret, at least 32 random characters (openssl rand -base64 48).
SESSION_SECRET=
# Origin of the Contentools service, no trailing slash needed.
CONTENTOOLS_ORIGIN=
```
`portal/.env.example` carries the three credential sets from the portal spec: `CTP_*` (frontend client, scope list from the spec with a reason each: `view_project_settings`, `view_published_products`, `view_categories`, `view_stores`, `view_product_selections`, `view_associate_roles`, `view_types`, `manage_customers`, `manage_orders`, `manage_quotes`, `manage_quote_requests`, `view_quotes`), `CTP_ADMIN_*` (`CTP_ADMIN_CLIENT_ID`, `CTP_ADMIN_CLIENT_SECRET`, `CTP_ADMIN_SCOPES`; reason lines for `manage_key_value_documents` = read and refresh the Contentools JWT custom object, and a note "assortment, price, discount and tailoring scopes are added by workstreams T and U, each with a reason"), `CTP_PROVISION_*` (`CTP_PROVISION_CLIENT_ID`, `CTP_PROVISION_CLIENT_SECRET`, `CTP_PROVISION_SCOPES`; reason for `manage_business_units`), `SESSION_SECRET`, `CONTENTOOLS_ORIGIN`. Scope comments use the exact format `# <scope> : <reason>` as above (the gate parses it).
3. `scripts/check-secrets.mjs`, ported from the sibling, with `SECRET_VARS` from `scripts/app.config.mjs`. Rules: no `NEXT_PUBLIC_` on a secret name; `.env`, `.env.local`, `.next/` not tracked (`git ls-files`); `.env.example` exists, lists every variable with an empty value; every scope listed in a `*_SCOPES` comment block has a `# <scope> : <reason>` line (reason not empty), and `*_SCOPES` blocks contain no scope without such a line (this is the "Undocumented scope" scenario). Tests: `Undocumented scope`, `Public prefix on a secret`, `Tracked env file`, `Missing variable in .env.example`, `Scope with an empty reason`.

### A-06 `scripts/check-server-only.mjs` (+ test) [SPEC: Directory structure, Server-only boundary]
Rules: every file in `lib/ct/**` and `lib/session*.ts` and `lib/contentools/**` (except `origin.ts`, which is imported by client code) starts with `import 'server-only';`; no file with `'use client'` or under `components/`, `hooks/`, `context/` imports `@/lib/ct/*`, `@/lib/session*` (type-only imports from `@/lib/session` are an error too; types live in `lib/types.ts`), or `@/lib/contentools/puck` / `theme`. Placeholder `lib/ct/index.ts` containing only `import 'server-only'; export {};` so the rule has a file to check. Tests: `Server-only boundary fails when a client file imports lib/ct`, `lib/ct file without server-only fails`, `Passes on the placeholder`.

### A-07 ESLint rules with fixtures (+ test) [SPEC: BFF boundary, Single client; Client state, Hook-only fetching; Contentools reads, createContext footgun]
`eslint.config.mjs` (flat config, extend `eslint-config-next`). Add `no-restricted-imports` / `no-restricted-syntax` overrides:
1. `new ClientBuilder(` banned everywhere except `lib/ct/client.ts` (selector `NewExpression[callee.name='ClientBuilder']`; override that file `off`). G creates the file; the override already points at it.
2. `@commercetools/platform-sdk` and `@commercetools/ts-client` importable only in `lib/ct/**` and `lib/mappers/**` (type imports from `platform-sdk` in `lib/mappers/**` allowed).
3. `fetch('/api/...')` and `` fetch(`/api/... `` banned in `components/**`, `app/**/*.tsx` (selector on `CallExpression[callee.name='fetch'] > Literal[value=/^\/api\//]` and the template-literal form); allowed in `hooks/**`.
4. `next/link`, `redirect`, `useRouter`, `usePathname` from `next/navigation` banned in `app/[locale]/**` and `components/**` (use `@/i18n/routing`; C creates it). `notFound` and `useSearchParams` from `next/navigation` stay allowed.
5. Value imports from `@commercetools-demo/puck-*` banned in files without `'use client'` under `app/**` and `lib/**` (use a small custom rule in `eslint/rules/no-puck-in-server.mjs` that checks the first statement is a `'use client'` directive; `import type` is allowed).
6. Portal only: imports of `@/lib/ct/admin-client` and `@/lib/ct/provisioning-client` banned outside `app/api/seller/**`, `lib/ct/seller/**`, `lib/contentools/jwt.ts` (admin) and `app/api/auth/register/**` (provisioning).
Each rule has a fixture under `eslint/fixtures/<rule>.bad.tsx` and a test `eslint/rules.test.mjs` that runs the ESLint Node API (`new ESLint({ overrideConfigFile, cwd })`, `lintText(code, { filePath })`) and expects the message id. Tests, one per rule: `Single client`, `SDK outside lib/ct`, `Hook-only fetching`, `Locale-aware navigation only`, `createContext footgun`, `Admin client fence` (portal), plus a "good" fixture per rule that must lint clean.

### A-08 Remaining gate scripts (+ tests) [SPEC: Gates and tests; Release without health route; Secret in the bundle; Preview versus production]
Port from `b2b-manufacturing/site/scripts/`: `check-bundle-secrets.mjs` (scan `.next/static` for the values of the secret env vars that are set, ignoring values shorter than 8 characters), `check-no-dev-pages.mjs` (fails in a release build when a route under `app/**/dev/**` exists), `check-no-health-in-release.mjs` (fails while `app/api/health/route.ts` exists, when `RELEASE=1` or `NODE_ENV=production` with `CONTEXT=production`), `check-routes.mjs` (parses `.next-build-output.txt`; A version: the route table must contain no route that begins with `/dev`; R extends it with the navigation allow-list in the portal). Create pass-through `check-tokens.mjs` and `check-messages.mjs` as described in section 3.
Drop `check-sample-content`, `contrast-audit`, `seo-audit`, `sync-site-images` (not in this project's specs). `scripts/gate.test.mjs` runs every script's exported function once on the clean scaffold and expects no problems. Tests: `Release without health route`, `Secret in the bundle`, `Dev page in a release build`, `Gate on a clean scaffold`.

### A-09 `npm run check` wiring and test helpers [SPEC: Gates and tests]
`package.json` scripts (identical in both apps):
```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint .",
"typecheck": "tsc --noEmit",
"test": "vitest run",
"check": "tsc --noEmit && eslint . && node scripts/check-versions.mjs && node scripts/check-tailwind.mjs && node scripts/check-secrets.mjs && node scripts/check-server-only.mjs && node scripts/check-tokens.mjs && node scripts/check-messages.mjs && node scripts/check-routes.mjs --static && node scripts/check-no-dev-pages.mjs && node scripts/check-no-health-in-release.mjs && vitest run",
"verify:build": "next build 2>&1 | tee .next-build-output.txt && node scripts/check-routes.mjs .next-build-output.txt && node scripts/check-no-health-in-release.mjs && node scripts/check-bundle-secrets.mjs"
```
`vitest.config.mts`: plugin react, `environment: 'jsdom'`, `setupFiles: ['test/setup.ts']`, alias `@` to the app root, and `test.include` for `**/*.test.{ts,tsx,mjs}`. `test/setup.ts`: `import '@testing-library/jest-dom/vitest'` and `expect.extend(toHaveNoViolations)` from `jest-axe`. Helpers (copy shape from the sibling `site/test/`): `test/render.tsx` exporting `renderWithProviders(ui, { locale = 'de-DE', messages })` (wraps in `NextIntlClientProvider` and `SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}`) and `test/request.ts` exporting `makeRequest(url: string, init?: RequestInit): Request`. One smoke test each: `test/render.test.tsx` (`renders a child inside providers`), `test/request.test.ts` (`builds an absolute Request`). `renderWithProviders` imports `NextIntlClientProvider`; C later feeds it real catalogs.

### A-10 Directory layout and deployment files [SPEC: Directory structure; Deployment config]
Create only folders that hold a file. Placeholders that A must create so later workstreams drop files in: `lib/ct/index.ts`, `lib/types.ts` (`export {};`), `lib/utils.ts` (`export {};`, C fills), `lib/cache-keys.ts` (`export {};`), `lib/errors.ts` (`export class AppError extends Error { constructor(public status: number, message: string) { super(message); } }`), `components/ui/.gitkeep` is **not allowed**; skip empty folders. Do not create `app/api/*` folders. `app/layout.tsx` is the scaffold root layout reduced to `<html lang="de-DE"><body>{children}</body></html>` with `export const metadata = { title: 'Malva' }` (storefront) or `'Malva Partner Portal'` (portal). `netlify.toml` in each app: 
```toml
[build]
  command = "npm run build"
  publish = ".next"
[build.environment]
  NODE_VERSION = "22"
[[plugins]]
  package = "@netlify/plugin-nextjs"
```
(base directory is set in the Netlify UI, per both specs; write that in the README). Run `npm run dev` once: Next writes an `AGENTS.md` block into the app; commit it as-is. Add `CLAUDE.md` (3 lines: "Read AGENTS.md; run `npm run check` before commit; see plans/JUNIOR rules") and `README.md` (A-11).

### A-11 READMEs and dry run [SPEC: Bootstrap acceptance, npm run check passes]
`storefront/README.md` and `portal/README.md`: what the app is, Node 22, `cp .env.example .env.local`, scripts table, the gate list with one line each, Netlify base directory note ("set Base directory to `b2b2c-automotive/storefront` or `portal` in the Netlify UI"), the Puck peer set (portal), and a line "Shared code with the other app is copied, not packaged (no workspace)". Dry run in **both** apps: fresh clone in a temp dir (`git clone . $TMPDIR/dryrun-a` then `cd $TMPDIR/dryrun-a/b2b2c-automotive/<app>`), `cp .env.example .env.local`, `npm ci && npm run check && npm run verify:build`. Paste the last 15 lines of each output into the PR description (never any env value).

## 5. Test-first scenarios (unit tests)

Every scenario of the two specs that is in A's scope is a named test. Write the failing test, then the script.

| Test name | File | Spec scenario |
| --- | --- | --- |
| `Version gate ...` (5 tests, A-03) | `scripts/check-versions.test.mjs` | Version gate |
| `Tailwind v3 guard ...` (3 tests, A-04) | `scripts/check-tailwind.test.mjs` | Tailwind v3 guard |
| `Undocumented scope`, `Public prefix on a secret`, ... (A-05) | `scripts/check-secrets.test.mjs` | Undocumented scope; Scope drift (portal, static half) |
| `Server-only boundary ...` (A-06) | `scripts/check-server-only.test.mjs` | Server-only boundary |
| `Single client`, `SDK outside lib/ct`, `Hook-only fetching`, `Locale-aware navigation only`, `createContext footgun`, `Admin client fence` (A-07) | `eslint/rules.test.mjs` | Single client; Hook-only fetching; createContext footgun; Project-level admin fence |
| `Release without health route` (A-08) | `scripts/check-no-health-in-release.test.mjs` | Release without health route; Release (portal) |
| `Secret in the bundle` (A-08) | `scripts/check-bundle-secrets.test.mjs` | Secret in the bundle |
| `Gate on a clean scaffold` (A-08) | `scripts/gate.test.mjs` | Gates and tests |
| `renders a child inside providers`, `builds an absolute Request` (A-09) | `test/*.test.ts(x)` | helpers |

Scenarios whose test lives in a later workstream: Version gate (portal "same limits") is covered here by running the same script in the portal; No raw values and Tokens in sync (B); Bare path, Unsupported locale (C); Weak secret, Customer bound to a store (G); Published page, Hostile value, Write through the storefront proxy (H); Two resellers, Unknown store (G, I); Cross-store write, Tampered store (R, U, X).

## 6. Browser verification recipe (Chrome DevTools MCP, run by Claude)

Pages are empty, so the check is short.
1. `cd storefront && npm run dev` (port 3000). `mcp__chrome-devtools__navigate_page` to `http://localhost:3000/`. Assert: HTTP 200 (list_network_requests), `list_console_messages` shows no error. `take_screenshot` to `plans/evidence/A/storefront-root.png`.
2. Stop it, `cd ../portal && PORT=3001 npm run dev`. Navigate to `http://localhost:3001/`, same assertions, screenshot `plans/evidence/A/portal-root.png`.
3. Run `npm run verify:build` in each app and save the tails to `plans/evidence/A/storefront-build.txt` and `plans/evidence/A/portal-build.txt`.
No unit test may call a live service.

## 7. Project-data checks (MCP `b2b2c-automotive`)
None. A does not touch commercetools.

## 8. Manual items to add to `plans/TODO-MANUAL-TESTING.md`
None required. If A-02 hits the Puck peer-dependency conflict, the owner action is `OA-07` in `plans/TODO-MANUAL-TESTING.md` (decide Puck manager peer versions, see questions Q-A01; already listed there) and stop that task (do not wait silently: continue with A-03 to A-11 on the storefront and tell Claude).

## 9. Definition of done
- Both apps: `npm ci && npm run check && npm run verify:build` green in a fresh clone.
- Every `[SPEC:]` test in section 5 exists and passes; no `it.skip`.
- `git ls-files | grep -E '\.env($|\.local)'` prints nothing; `.env.example` has no values.
- No `tailwind.config.*`, no `new ClientBuilder(` anywhere (G adds the only one).
- PR description holds both build tails. Status in `plans/STATUS.md` (if present) is `Ready for review`.

## 10. Evidence to record
`plans/evidence/A/`: `storefront-root.png`, `portal-root.png`, `storefront-build.txt`, `portal-build.txt`, and the output of `node -v; npm ls next next-intl @commercetools/platform-sdk @commercetools/ts-client react` for each app (`versions-storefront.txt`, `versions-portal.txt`).
