<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream A: Bootstrap (scaffold with the skill command, tooling, env, guards, health check)

## 1. Header

| Field | Value |
| --- | --- |
| ID | A |
| Name | Bootstrap: scaffold `storefront/` with `/commercetools:nextjs-setup-project`, adjust to the spec, tooling, environment, guards, health check, agent rules |
| Depends on | none |
| Wave | 1 (parallel with B) |
| Branch | `ws/a-bootstrap`; one task, one commit: `ws-A: A-05 <summary>` |
| Primary spec | `openspec/specs/bootstrap-and-structure/spec.md` |
| Generated templates that apply | none (A is infrastructure; no behavioural template is owned here) |
| Owner prerequisites | **OA-01** (API clients in `storefront/.env.local`) for the live health check only (task A-12 step 3). Everything else works with placeholder values. New rows drafted in `plans/notes/todo-A.md`: `OA-A-b` (live project settings), `M-A-01`, `M-A-02` (optional) |
| Skills to load first | `commercetools-storefront` (`references/stack/nextjs/project-layout.md`, `overview.md`, `data-loading.md`, `references/core/ct-client.md`), `commercetools-platform` (`references/sdk-setup.md`) |

## 2. Goal and scope

**Goal.** From a clean clone with Node 22 and a filled `storefront/.env.local`, `cd storefront && npm ci && npm run check && npm run build` is green. The app is the output of `/commercetools:nextjs-setup-project`, adjusted only as the spec says: two locales (en-US, en-CA) from one `COUNTRY_CONFIG`, a locale proxy, env validation and the project guard, a health route with a deploy gate, lint rules that enforce the BFF boundary, a bundle secret scan and agent rules (`CLAUDE.md`, `AGENTS.md`).

**In scope**
- Run the skill command, verify its output, record evidence.
- Fix-ups the command needs (directory name, versions, git-ignore bug, locale cookie name, unknown-locale redirect).
- Vitest, Testing Library, scripts `dev build start lint typecheck test check`.
- `lib/utils.ts` (`COUNTRY_CONFIG`, constants), `i18n/*`, minimal `messages/*.json`, `app/[locale]/layout.tsx`, `page.tsx`, `error.tsx`, `not-found.tsx` (bare minimum shells, E and P style them).
- `lib/env.ts`, `instrumentation.ts`, `lib/ct/client.ts` (singleton), `app/api/health/route.ts`, `scripts/predeploy-check.mjs`.
- ESLint rules, `scripts/check-versions.mjs`, `scripts/check-secrets.mjs`, `scripts/check-bundle-secrets.mjs`.

**Out of scope (do not do, other workstreams own them)**
- Session (`lib/session.ts`), mappers, `lib/types.ts` content beyond the command's file, `lib/cache-keys.ts` content, `image-config.ts`, error helpers: **D**.
- Design tokens, fonts, atoms, the real message catalogue: **E**.
- Any page, header, footer, picker: **F** onwards.
- Any seed code: **B**, **C**.
- Deploying or the Netlify UI: **Q** (OA-05, `/commercetools:nextjs-deploy-netlify`, D-038).

**Split with D (important).** The command writes `lib/utils.ts`, `lib/types.ts`, `lib/cache-keys.ts`, `i18n/*`, `proxy.ts`. A keeps them working and adds the tests listed here. D (which depends on A) later extends `lib/utils.ts` (`formatMoney` tests, `getLocalizedString`), `lib/types.ts`, `lib/cache-keys.ts` and adds `lib/session.ts`. A creates the minimal `lib/ct/client.ts` because the health check needs it; D hardens it (correlation id, error mapping) without changing its exports.

## 3. Design

### 3.1 What `/commercetools:nextjs-setup-project` does (read from `commands/nextjs-setup-project.md`, plugin 0.47.0)

The command is a prompt Claude executes top to bottom without asking. Its steps:

| Step | What it does | What to check afterwards |
| --- | --- | --- |
| 0 | Sends one anonymous `curl` to the commercetools docs search (telemetry, `|| true`). | Nothing. If the network is blocked it still continues. |
| 1 | `npx create-next-app@^16 site --typescript --app --src-dir=false --tailwind=false --eslint --import-alias "@/*"`, then `npm install @commercetools/platform-sdk@^8 @commercetools/ts-client@^4 next-intl@^4 swr jose tailwindcss @tailwindcss/postcss postcss`. Writes `vercel.json` (deleted by A-01: hosting is Netlify, D-038) and `netlify.toml` (`base = "site"`, `NODE_VERSION = "22"`) at the **project root next to `site/`**. | **The directory is named `site`; this project needs `storefront`** (A-01 handles it). `create-next-app` 16 installs Tailwind v4 even with `--tailwind=false` (verified 2026-10-19 in a scratch run), so no `tailwind.config.*` exists; confirm that. It pins `next` and `eslint-config-next` to an exact version (we saw `16.2.6` while npm had a newer 16.x) and `@types/node ^20`. |
| 2 | Writes `postcss.config.mjs` (`@tailwindcss/postcss`), replaces `app/globals.css` with `@import 'tailwindcss'`, `@source inline(...)` col-span safelists, and a `@theme` with **terracotta cream colours** (`--color-cream`, `--color-terra`, ...) and `Inter`. | The colours are generic placeholders and are **not** Malva tokens. A-02 removes them; E writes the real tokens. |
| 3 | `mkdir -p app/[locale] app/api lib/ct lib/mappers hooks components/{ui,layout,product} context i18n messages`. | Empty folders are not tracked by git (A-02 adds `.gitkeep`). |
| 4 | Writes `lib/types.ts` (Price, Variant, Product, Category), `lib/utils.ts` (`COUNTRY_CONFIG` with en-US/de-DE/en-GB (replace with en-US/en-CA), `DEFAULT_LOCALE`, `formatMoney`, `getLocalizedString`), `lib/cache-keys.ts` (`KEY_CART`, ...). | `COUNTRY_CONFIG` has three markets (en-US, de-DE, en-GB): remove `de-DE` and `en-GB`, add `en-CA` (CA, CAD, English, D-030). No flag emoji (good: no emoji rule). |
| 5 | Writes `i18n/routing.ts` (`defineRouting` from `Object.keys(COUNTRY_CONFIG)`, `defaultLocale 'en-US'`, `localePrefix 'always'`, exports `Link, redirect, usePathname, useRouter, getPathname` from `createNavigation`), `i18n/request.ts` (`getRequestConfig`, loads `messages/<locale>.json`), `next.config.ts` (`createNextIntlPlugin('./i18n/request.ts')`, `images.unoptimized: true`, remotePatterns `storage.googleapis.com` and `**`), and three `messages/*.json` files containing `{}`. | The `{}` catalogues have no keys; A-06 adds a minimal identical key set. |
| 6 | Writes `proxy.ts` (Next 16 name for middleware): skips `/api`, `/_next`, `/favicon`, paths with a dot; passes locale-prefixed paths and sets header `x-next-intl-locale`; otherwise redirects to `/<cookie or en-US>/<path>`; cookie name **`your-shop-country-locale`**. | Two things to fix: (1) the cookie name (A-07 renames it to `malva-locale`), (2) **`/fr-FR/coffee` is redirected to `/en-US/fr-FR/coffee`** because an unknown locale is treated as a path, which violates the "Unknown locale" scenario (A-07 fixes with a test). |
| 7 | `npm list next next-intl @commercetools/platform-sdk @commercetools/ts-client --depth=0` and stops if `next <= 16.0.0`, `next-intl` not 4.x, `platform-sdk <= 8.0.0` or `ts-client <= 4.0.0`. | Save the output as evidence. |

What the command does **not** do (A does it): `.env.example`, `.nvmrc`, `engines`, Vitest, `server-only`, ESLint rules, env validation, project guard, client singleton, health route, `CLAUDE.md` rules, `.gitignore` fix. Next 16's `create-next-app` also writes `AGENTS.md` (a `BEGIN:nextjs-agent-rules` block) and `CLAUDE.md` containing `@AGENTS.md`; keep that block when adding our rules (A-13).

Facts verified in a scratch scaffold on 2026-10-19 (re-check, they may change): `package.json` scripts are only `dev build start lint` and `lint` is `eslint` (no `next lint`); `eslint.config.mjs` uses `defineConfig` from `eslint/config` with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`; `.gitignore` contains `.env*` which **also ignores `.env.example`** (A-08 fixes); the root layout uses Geist fonts (E replaces); `app/page.tsx` and `public/*.svg` are demo content (A-02 deletes).

### 3.2 Final directory layout after A

```
storefront/
  app/
    layout.tsx                 root layout: <html lang>, NextIntlClientProvider (D/I add SWRConfig fallback later)
    globals.css                @import 'tailwindcss'; only (E writes tokens)
    [locale]/layout.tsx        validates locale, notFound() otherwise
    [locale]/page.tsx          placeholder home (O replaces)
    [locale]/error.tsx         'use client' shell with reset button
    [locale]/not-found.tsx     shell
    api/health/route.ts        GET (deleted before deploy)
  lib/
    ct/client.ts               apiRoot singleton (only place with ClientBuilder)
    env.ts                     parseEnv / getEnv / EnvError
    utils.ts                   COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE, formatMoney, getLocalizedString
    types.ts, cache-keys.ts    as written by the command (D extends)
    mappers/.gitkeep
  hooks/.gitkeep  context/.gitkeep  components/{ui,layout,product}/.gitkeep
  i18n/routing.ts  i18n/request.ts
  messages/en-US.json  en-CA.json
  proxy.ts   instrumentation.ts   next.config.ts   postcss.config.mjs   eslint.config.mjs   vitest.config.mts
  eslint/rules/*.mjs  eslint/fixtures/*  eslint/rules.test.mjs
  scripts/check-versions.mjs  check-secrets.mjs  check-bundle-secrets.mjs  predeploy-check.mjs  (+ tests)
  test/setup.ts  test/stubs/server-only.ts
  .env.example  .nvmrc  .gitignore  CLAUDE.md  AGENTS.md  README.md
(project root b2c-foodservice/)  netlify.toml   written by the command, base fixed to storefront (vercel.json deleted, D-038)
```

### 3.3 Exported names and signatures (other workstreams import these)

```ts
// lib/utils.ts
export interface CountryConfig { locale: string; currency: string; country: string; label: string }
export const COUNTRY_CONFIG: Record<string, CountryConfig>;   // keys: 'en-US' | 'en-CA'
export const DEFAULT_LOCALE: CountryConfig;                   // COUNTRY_CONFIG['en-US']
export const LOCALE_COOKIE = 'malva-locale';                  // the only cookie name for the market
export function formatMoney(centAmount: number, currencyCode: string, locale?: string): string;   // D tests it
export function getLocalizedString(obj: Record<string, string> | undefined, locale: string): string;

// lib/env.ts   (import 'server-only')
export interface ServerEnv {
  CTP_PROJECT_KEY: string; CTP_CLIENT_ID: string; CTP_CLIENT_SECRET: string;
  CTP_AUTH_URL: string; CTP_API_URL: string; CTP_SCOPES: string;
  SESSION_SECRET: string; EXPECTED_PROJECT_KEY: string;
}
export class EnvError extends Error { readonly variable: string }   // message never contains a value, except project keys in the guard message
export function parseEnv(source: Record<string, string | undefined>): ServerEnv;  // pure; throws EnvError
export function getEnv(): ServerEnv;                                              // memoised parseEnv(process.env)

// lib/ct/client.ts   (import 'server-only')
export const apiRoot: ByProjectKeyRequestBuilder;   // from createApiBuilderFromCtpClient(...).withProjectKey
export const projectKey: string;
```

Rules inside `parseEnv` (each is a test):
1. Every name above must be present and non-empty after trim, else `EnvError("Missing environment variable <NAME>")`.
2. `SESSION_SECRET.length >= 32`, else `EnvError("SESSION_SECRET must be at least 32 characters")` (the message names the variable, never the value).
3. `CTP_AUTH_URL` and `CTP_API_URL` start with `https://` and have no trailing slash (strip it; do not fail).
4. `CTP_PROJECT_KEY === EXPECTED_PROJECT_KEY`, else `EnvError('Wrong commercetools project: CTP_PROJECT_KEY="a" but EXPECTED_PROJECT_KEY="b"')` (project keys are not secrets; the spec wants both named).
5. Names starting `NEXT_PUBLIC_` and containing `SECRET`, `CLIENT_ID` or `SCOPES` in `source` are an error (`EnvError("<NAME> must not be public")`).

Reading credentials from outside `storefront/.env.local`: Next.js loads `.env`, `.env.development`, `.env.production`, `.env.local` from the app folder. To keep to the spec: (a) `scripts/check-secrets.mjs` fails when any env file other than `.env.local`, `.env.example` exists in `storefront/`; (b) a test greps `lib/`, `app/`, `scripts/` for `homedir(`, `~/.commercetools` and `.commercetools` and fails if found; (c) the junior guide already forbids reading `~/.commercetools/*`.

### 3.4 `instrumentation.ts` (fail fast on start)

```ts
// instrumentation.ts (project root, next to app/)
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getEnv } = await import('@/lib/env');
    getEnv(); // throws EnvError => the server does not start; message names the variable
  }
}
```
Docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`: `register` is called once when a new server instance starts and must finish before requests are served. Verify by starting the server with `SESSION_SECRET=short` (A-12 recipe step 6). `next build` does not run `register`; the health route is `force-dynamic` so the build never calls commercetools.

### 3.5 `lib/ct/client.ts`

SDK (skill `commercetools-platform/references/sdk-setup.md`, `ts-client` ^4: `ClientBuilder` has `withProjectKey`, `withClientCredentialsFlow`, `withHttpMiddleware`, `withCorrelationIdMiddleware`, `build`):

```ts
import 'server-only';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { getEnv } from '@/lib/env';

const env = getEnv();
const client = new ClientBuilder()
  .withProjectKey(env.CTP_PROJECT_KEY)
  .withClientCredentialsFlow({
    host: env.CTP_AUTH_URL,
    projectKey: env.CTP_PROJECT_KEY,
    credentials: { clientId: env.CTP_CLIENT_ID, clientSecret: env.CTP_CLIENT_SECRET },
    scopes: env.CTP_SCOPES.split(/\s+/).filter(Boolean),
  })
  .withHttpMiddleware({ host: env.CTP_API_URL })
  .build();

export const apiRoot = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: env.CTP_PROJECT_KEY });
export const projectKey = env.CTP_PROJECT_KEY;
```
Note: the skill passes `scopes: [process.env.CTP_SCOPES!]` (one element); splitting on spaces is the safe form. `new ClientBuilder(` may appear **only** in this file (ESLint rule A-11). Docs: https://docs.commercetools.com/sdk/typescript-sdk and https://docs.commercetools.com/api/authorization#client-credentials-flow.

### 3.6 `GET /api/health`

`app/api/health/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { apiRoot } from '@/lib/ct/client';
export const dynamic = 'force-dynamic';   // a GET handler is otherwise evaluated at build time
export async function GET() {
  try {
    const { body } = await apiRoot.get().execute();   // GET /{projectKey}, https://docs.commercetools.com/api/projects/project#get-project
    return NextResponse.json({ ok: true, projectKey: body.key });
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'upstream_unavailable', message: 'commercetools did not answer' } }, { status: 502 });
  }
}
```
| Case | Status | Body |
| --- | --- | --- |
| Valid credentials | 200 | `{"ok":true,"projectKey":"<key>"}` (no secret, no scopes, no token) |
| Any failure | 502 | `{"ok":false,"error":{"code":"upstream_unavailable","message":"commercetools did not answer"}}` (no stack, no commercetools body; the skill's `String(e)` leaks details, do not copy it) |
Also (project guard, second half): if `body.key !== getEnv().EXPECTED_PROJECT_KEY` respond 500 `{ok:false,error:{code:'wrong_project',message:'API reports key "<a>", expected "<b>"'}}`.

`scripts/predeploy-check.mjs` exports `checkPredeploy(root): string[]` and fails when `app/api/health/route.ts` exists (message `Remove app/api/health/route.ts before deploying`). `npm run predeploy` runs it. The health route is deleted in workstream Q, not here.

### 3.7 Locale proxy (`proxy.ts`) final behaviour

| Request path | Cookie `malva-locale` | Result |
| --- | --- | --- |
| `/api/...`, `/_next/...`, `/favicon...`, any path containing `.` | any | pass through |
| `/en-CA`, `/en-CA/anything` | any | pass through, header `x-next-intl-locale: en-CA` |
| `/` | none | 307 to `/en-US` |
| `/coffee` | `en-CA` | 307 to `/en-CA/coffee` |
| `/fr-FR/coffee` (first segment looks like a locale: `/^[a-z]{2}(-[A-Z]{2})?$/` and is not supported) | none | 307 to `/en-US/coffee` (segment **replaced**, never nested) |
| `/fr-FR/coffee` | `en-CA` | 307 to `/en-CA/coffee` |
| `/coffee` | `xx-XX` (invalid cookie) | 307 to `/en-US/coffee` |
Query strings are preserved. No `Accept-Language` detection (Q-A-6). The locale list comes from `Object.keys(COUNTRY_CONFIG)`; never hard-code it in `proxy.ts`. Matcher stays `['/((?!api|_next|favicon|.*\\..*).*)', '/']`. Docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

### 3.8 i18n and messages

- `i18n/routing.ts` and `i18n/request.ts` as the command wrote them. In `request.ts` validate with `hasLocale(routing.locales, locale)` from `next-intl` (v4) instead of the `includes` cast if it type-checks; behaviour is identical.
- A's minimal catalogue (E extends it; keys are identical in both files):
  `common.brand` ("Malva Coffee" in both), `common.skipToContent`, `meta.title`, `meta.description`, `home.placeholder`, `errors.title`, `errors.retry`, `errors.notFoundTitle`, `errors.notFoundBody`.
  en-CA may equal en-US text except Canadian spelling (colour). No German or French (D-030).
- Message file name equals the `COUNTRY_CONFIG` key exactly (`en-CA.json`).
- `app/layout.tsx` (async Server Component): `const locale = await getLocale()` from `next-intl/server`, `<html lang={locale}>`, wraps children in `NextIntlClientProvider` (messages from `getMessages()`). `generateMetadata` is **not** added here (P/E).
- `app/[locale]/layout.tsx`: `const { locale } = await params; if (!hasLocale(routing.locales, locale)) notFound();` (`notFound` from `next/navigation` is allowed; never inside try/catch). `generateStaticParams` returns `routing.locales.map(locale => ({ locale }))`.
- Strings in components come from `useTranslations`; never a hard-coded user string (rule from the guide).

### 3.9 Tooling

Packages beyond the command (all required by the guide or the spec; stop and ask for any other): dev: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `vite-tsconfig-paths`; runtime: `server-only`. Change `@types/node` to `^22`.

`package.json` scripts (exact):
```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint .",
"typecheck": "tsc --noEmit",
"test": "vitest run",
"check": "npm run lint && npm run typecheck && npm run test",
"predeploy": "node scripts/predeploy-check.mjs",
"verify:build": "next build && node scripts/check-bundle-secrets.mjs"
```
Also `"engines": { "node": ">=22" }`, `.nvmrc` containing `22`. The version gate runs inside `npm run test` (so `check` fails with the broken rule, as the spec says), see A-04.

`vitest.config.mts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)) } },
  test: { environment: 'jsdom', setupFiles: ['test/setup.ts'], include: ['**/*.test.{ts,tsx,mjs}'], exclude: ['node_modules/**', '.next/**'] },
});
```
`test/stubs/server-only.ts` is `export {};` (the real package throws outside a server component). `test/setup.ts`: `import '@testing-library/jest-dom/vitest';`. Docs: `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`. Async Server Components cannot be unit-tested; test the pure functions and route handlers (rule from the guide: import `GET`/`POST` and call with `new Request(...)`).

### 3.10 ESLint rules (`eslint.config.mjs`, flat config, extend the generated one)

| Rule (spec text) | Implementation | Scope |
| --- | --- | --- |
| No `lib/ct/*` or `@commercetools/*` import from a `'use client'` file | local rule `local/no-server-in-client` in `eslint/rules/no-server-in-client.mjs`: if the first statement is the `'use client'` directive, report `ImportDeclaration` whose source is `@commercetools/*`, `server-only`, starts with `@/lib/ct` or `@/lib/session`, or a relative path that resolves into `lib/ct`. `import type` is also an error for `lib/ct` (types live in `lib/types.ts`). Message id `serverInClient`, text includes "BFF boundary" | all `**/*.{ts,tsx}` |
| No `@commercetools/*` outside `lib/ct`, `lib/mappers` | `no-restricted-imports` pattern `@commercetools/*`, overridden `off` in `lib/ct/**`, `lib/mappers/**`, tests | all |
| No bare `next/link` or `next/navigation` in locale UI | `no-restricted-imports`: path `next/link` (whole module); path `next/navigation` with `importNames: ['redirect','permanentRedirect','useRouter','usePathname']`. `notFound`, `useSearchParams`, `unstable_rethrow` stay allowed (Q-A-8) | `app/[[]locale[]]/**`, `components/**`, `context/**`, `hooks/**` |
| No `any` | `@typescript-eslint/no-explicit-any: error` (already in next typescript config as warn; set to error) | all |
| No raw hex in components | `no-restricted-syntax` selectors on `Literal[value=/^#[0-9a-fA-F]{3,8}$/]`, `Literal[value=/\[#[0-9a-fA-F]{3,8}\]/]` (Tailwind arbitrary values) and `TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\b/]` | `components/**`, `app/**/*.tsx` (not `*.test.*`, not `app/globals.css`, which ESLint does not read) |
| `new ClientBuilder(` only in `lib/ct/client.ts` | `no-restricted-syntax` selector `NewExpression[callee.name='ClientBuilder']`, `off` for that file | all |
Every rule has a fixture `eslint/fixtures/<rule>.bad.tsx` and `.good.tsx` and a test in `eslint/rules.test.mjs` using the ESLint Node API: `new ESLint({ cwd, overrideConfigFile })`, `lintText(code, { filePath })` and asserting `ruleId`/`messageId`. Remember ESLint ignores `eslint/fixtures` for the normal run (`globalIgnores(['eslint/fixtures/**'])`) but the test lints them as text with a fake `filePath` such as `components/x.tsx`.

### 3.11 Scripts

`scripts/check-versions.mjs` exports `checkVersions(root): string[]` (empty = pass) and has a CLI part (prints problems, exit 1). Rules read `package.json` and the installed `node_modules/<pkg>/package.json`: `next` installed version `>16.0.0` and major 16; `next-intl` major 4; `@commercetools/platform-sdk` major 8; `@commercetools/ts-client` major 4; `react` major 19; `tailwindcss` major 4 and no `tailwind.config.*`; `.nvmrc` starts with `22`; `package.json` `next` range must not start with 15. Each problem string names the rule, e.g. `next 15.1.0 installed, the rule is next >16.0.0 (bootstrap-and-structure: Stack and version gates)`. A Vitest test `scripts/check-versions.test.ts` runs `checkVersions` on temp directories (fixtures) and once on the real repo root.

`scripts/check-secrets.mjs` exports `checkSecrets(root)`: `.env.example` exists, lists every name of section 3.3 with an empty value, no `NEXT_PUBLIC_` on a secret name, `git ls-files` shows no `.env*` except `.env.example`, no other env files than `.env.local` and `.env.example` on disk, every scope in the `CTP_SCOPES` comment block has a `# <scope> : <reason>` line.

`scripts/check-bundle-secrets.mjs` exports `checkBundleSecrets(root, env)`: for each of `CTP_CLIENT_SECRET`, `CTP_CLIENT_ID`, `SESSION_SECRET` whose value is at least 8 characters, search every file under `.next/static` (and `.next/server/app` HTML) for the value; report the variable **name** and the file, never the value. Run by `npm run verify:build`.

### 3.12 `.env.example` (committed, names only)

```
# commercetools project key. Also typed again as EXPECTED_PROJECT_KEY below.
CTP_PROJECT_KEY=
# Must equal CTP_PROJECT_KEY. The server refuses to start otherwise.
EXPECTED_PROJECT_KEY=
# Region auth URL, for example https://auth.europe-west1.gcp.commercetools.com
CTP_AUTH_URL=
# Region API URL, for example https://api.europe-west1.gcp.commercetools.com
CTP_API_URL=
# Frontend (non-admin) API client. Server only. Never NEXT_PUBLIC_.
CTP_CLIENT_ID=
CTP_CLIENT_SECRET=
# Space separated scopes, each as <scope>:<project key>. Reasons:
# view_project_settings : read countries, currencies and languages
# view_products : Product Search, channels (stores), inventory, reviews read
# view_published_products : product pages
# view_categories : category tree and pages
# view_shipping_methods : delivery options per market
# view_tax_categories : tax display
# view_types : custom type definitions
# view_cart_discounts : discount messages
# view_discount_codes : discount code validation
# create_anonymous_token : guest sessions and carts
# manage_customers : sign in, registration, account
# manage_orders : place and read orders
# manage_shopping_lists : saved items
# manage_sessions : hosted Checkout payment sessions
CTP_SCOPES=
# At least 32 random characters. Generate: openssl rand -base64 48
SESSION_SECRET=
```
Later workstreams append scopes with a reason (`manage_recurring_orders` in N; the review write scope is Q-D-8). Scope names above come from the skill (`sdk-setup.md`, B2C template); each workstream verifies its own scopes in the docs page https://docs.commercetools.com/api/scopes before adding.

`.gitignore`: keep the generated content and add, after `.env*`, the line `!.env.example`, plus `.next-build-output.txt`.

### 3.13 Directory name, git and hosting files

The command writes into `site/`. Use `storefront/` (spec, D-007). The hosting file `netlify.toml` lands in the project root `b2c-foodservice/`; change `base = "site"` to `base = "storefront"` in it and delete the generated `vercel.json` (Netlify, D-038). (Q-A-2: where `netlify.toml` finally lives is decided in Q with OA-05.)

### 3.14 Agent rules

`storefront/AGENTS.md` keeps the generated `BEGIN:nextjs-agent-rules` block untouched and appends a section "Malva Coffee rules" with: the commands (`npm run dev|check|build`); the BFF chain (component, SWR hook, Route Handler, `lib/ct/<ns>.ts`, commercetools); version gates (next 16.x, next-intl 4, SDK 8, ts-client 4); Product Search only (`products().search()`); token-only styling (no hex, no raw fonts); locale links from `@/i18n/routing`; `import 'server-only'` in server modules; secrets in git-ignored `.env.local` only; manual-testing items go to `plans/TODO-MANUAL-TESTING.md`, questions to `plans/QUESTIONS.md`; load the `commercetools-*` skill before any commercetools task. `storefront/CLAUDE.md` is `@AGENTS.md` plus three lines pointing at `plans/JUNIOR-GUIDE.md` and the workstream files.

## 4. Tasks

Do them in order. Commit after each. Run `cd storefront && npm run check` before ticking (from A-03 on).

- [x] **A-01 Run the skill command** `[SKILL: commercetools-storefront]`
  - Files: creates the app folder; evidence `plans/evidence/A/command-output.txt`.
  - Steps: (1) `cd /Users/behnam/code/commercetools-labs/industry-starter/b2c-foodservice && node -v` must print `v22.x` (else `nvm install 22 && nvm use 22`). (2) `git status` is clean for `storefront/` and `storefront/` does not exist. (3) Run `/commercetools:nextjs-setup-project`. Immediately tell the session: "Use the directory name `storefront` wherever the command says `site`, and write `netlify.toml` with `base = \"storefront\"`." If the command already created `site/`, run `mv site storefront && rm -rf storefront/.next` afterwards (npm paths are relative; the `.next` cache is not). (4) If `storefront/.git` exists (create-next-app inits git outside a repo only; check anyway) remove that folder: `rm -rf storefront/.git`. (5) Save the session's command transcript summary (commands run, versions) to `plans/evidence/A/command-output.txt` with no env values.
  - Tests: none. Done when `ls storefront/app/[locale] storefront/i18n storefront/lib proxy.ts` all exist.

- [x] **A-02 Verify the output and apply the fix-ups** `[SKILL: commercetools-storefront]`
  - Files: `storefront/package.json`, `app/globals.css`, `app/page.tsx` (delete), `public/*.svg` (delete), `README.md`, `netlify.toml`, `vercel.json` (delete), `.gitkeep` files.
  - Steps: (1) Run `npm list next next-intl @commercetools/platform-sdk @commercetools/ts-client react tailwindcss --depth=0 > ../plans/evidence/A/versions.txt` and check against section 3.9 (next > 16.0.0 and 16.x, next-intl 4.x, SDK 8.x, ts-client 4.x). (2) Move to the latest allowed: `npm install next@^16 eslint-config-next@^16 && npm install -D @types/node@^22`. Confirm `npm view next@16 version | tail -1` equals the installed version. (3) Confirm no `tailwind.config.*`; replace `app/globals.css` with exactly `@import 'tailwindcss';` plus a `body { margin: 0; }` line (removes the placeholder cream/terra theme, E owns tokens). (4) Delete `app/page.tsx` and `public/*.svg`. (5) Set `package.json` `name` to `malva-storefront`, `private: true`. (6) `touch .gitkeep` in `lib/mappers`, `hooks`, `context`, `components/ui`, `components/layout`, `components/product`, `app/api` only if empty. (7) Fix `netlify.toml` base; delete `vercel.json` (Netlify, D-038). (8) Rewrite `README.md` (what it is, Node 22, `cp .env.example .env.local`, scripts table, link to `plans/`).
  - Tests: none yet (A-03 adds the harness). Check by `npx tsc --noEmit` passing and `npm run build` passing with the command's default placeholder files (it will, no env needed at this point).

- [x] **A-03 Test harness and scripts**
  - Files: `package.json`, `vitest.config.mts`, `test/setup.ts`, `test/stubs/server-only.ts`, `.nvmrc`, `lib/utils.test.ts` (smoke).
  - Steps: install packages of section 3.9; write config exactly as shown; add scripts; `.nvmrc` = `22`; `engines`. Smoke test `it('Fresh clone builds: the test runner starts')` asserting `COUNTRY_CONFIG['en-US'].currency === 'USD'`.
  - Tests: the smoke test; `npm run check` passes (lint may report warnings from the generated code: fix them, do not disable rules).

- [ ] **A-04 Version gate (script and tests)** `[SKILL: commercetools-platform]`
  - Files: `scripts/check-versions.mjs`, `scripts/check-versions.test.ts`.
  - Implement per section 3.11. The CLI form is `node scripts/check-versions.mjs` (used in `predeploy` and by hand).
  - Tests (spec: Forbidden version, Fresh clone builds): `Forbidden version: next 15.x fails with the version rule`, `Forbidden version: next-intl 3 fails`, `Forbidden version: platform-sdk 9 fails`, `Forbidden version: missing .nvmrc fails`, `Stack and version gates pass on the real repository`.

- [ ] **A-05 `COUNTRY_CONFIG`, constants, routing and messages** `[SKILL: commercetools-storefront]`
  - Files: `lib/utils.ts`, `i18n/routing.ts`, `i18n/request.ts`, `messages/*.json`, `app/layout.tsx`, `app/[locale]/layout.tsx`, `app/[locale]/page.tsx`, `app/[locale]/error.tsx`, `app/[locale]/not-found.tsx`, `lib/utils.test.ts`, `messages/messages.test.ts`.
  - Steps: add `CountryConfig` type and `LOCALE_COOKIE`; keep two entries (`label`: "United States", "Canada"; delete de-DE and en-GB); add the minimal catalogue of section 3.8; write layouts and shells. `error.tsx` is a Client Component with the `reset` button using `useTranslations('errors')`. Placeholder page renders `t('home.placeholder')` inside `<main>`.
  - Tests (spec: Locales, countries and currencies from one source): `Routing locales equal the COUNTRY_CONFIG keys`, `Default locale is en-US and prefix is always`, `Adding a market: every COUNTRY_CONFIG key has a message file with the same keys` (reads `messages/`, compares flattened key sets of all files to the en-US one; also fails if a file exists for a key that is not in COUNTRY_CONFIG), `Adding a market: a test entry derives routing without code changes` (import `defineRouting` with `Object.keys` of a copy that has an extra `fr-FR` and assert it appears).

- [ ] **A-06 Locale proxy** `[SKILL: commercetools-storefront]`
  - Files: `proxy.ts`, `proxy.test.ts`.
  - Steps: rename the cookie to `LOCALE_COOKIE`; implement the table in 3.7; export `proxy` and `config`. Build `NextRequest` objects in tests (`new NextRequest('http://localhost/fr-FR/coffee', { headers: { cookie: 'malva-locale=en-CA' } })`) and read `response.status` and `response.headers.get('location')`.
  - Tests (spec: Unknown locale): `Unknown locale redirects to the default locale, never nested`, `Unknown locale redirects to the cookie locale`, `Bare path gets the cookie locale`, `Invalid cookie falls back to en-US`, `Supported locale passes through and sets x-next-intl-locale`, `API and static paths are not redirected`, `Query string is preserved`.

- [ ] **A-07 Env validation, guard, instrumentation** `[SKILL: commercetools-platform]`
  - Files: `.env.example`, `.gitignore`, `lib/env.ts`, `lib/env.test.ts`, `instrumentation.ts`, `scripts/check-secrets.mjs`, `scripts/check-secrets.test.ts`.
  - Steps: section 3.3, 3.4, 3.11, 3.12. Add `check-secrets` to the `test` run through its test file (not to `check` separately). Append `!.env.example` and confirm with `git check-ignore -v .env.example` printing nothing.
  - Tests (spec: Missing secret, Wrong project, Client bundle scan static half): `Missing secret: SESSION_SECRET shorter than 32 names the variable and not the value`, `Missing secret: a missing CTP variable is named`, `Wrong project names both keys`, `Public prefix on a secret fails`, `Project guard passes when keys match`, `.env.example lists every variable with an empty value`, `Only .env.local and .env.example may exist`, `No code reads credentials from the home directory`.

- [ ] **A-08 Client singleton and health route** `[SKILL: commercetools-platform]`
  - Files: `lib/ct/client.ts`, `app/api/health/route.ts`, `app/api/health/route.test.ts`, `scripts/predeploy-check.mjs`, `scripts/predeploy-check.test.ts`.
  - Steps: section 3.5, 3.6. Test mocks `@/lib/ct/client` with `vi.mock` returning `{ apiRoot: { get: () => ({ execute: async () => ({ body: { key: 'malva-test' } }) }) } }` and mocks `@/lib/env` for `EXPECTED_PROJECT_KEY`.
  - Tests (spec: Credentials valid, Deploy gate): `Credentials valid: health returns 200 with the project key and no secret` (assert the JSON text does not contain the mocked secret and has only `ok` and `projectKey`), `Health failure returns upstream_unavailable without details`, `Wrong project key from the API is reported`, `Deploy gate fails while app/api/health/route.ts exists`, `Deploy gate passes when the route is removed` (temp dir).

- [ ] **A-09 Images config** `[SKILL: commercetools-storefront]`
  - Files: `next.config.ts`, `next.config.test.ts`.
  - Steps: keep `images.unoptimized: true`; replace the `{ hostname: '**' }` pattern by `[{ protocol: 'https', hostname: '**' }]` only (drop `storage.googleapis.com`, redundant; the spec says allow https remote patterns). Import `nextConfig` from the file in a test (export the unwrapped config as `export const baseConfig` and `export default withNextIntl(baseConfig)`).
  - Tests (spec: Image handling): `Images are unoptimized and https remote patterns are allowed`. The "Stored URL with a query" scenario is tested where the URL is written: seed workstream C (`strips query and fragment from stored image URLs`); this file lists it as covered there.

- [ ] **A-10 ESLint rules and fixtures**
  - Files: `eslint.config.mjs`, `eslint/rules/no-server-in-client.mjs`, `eslint/fixtures/*`, `eslint/rules.test.mjs`.
  - Steps: section 3.10. Then run `npm run lint` on the whole app, fix real violations in generated code.
  - Tests (spec: Server import in a client file; Quality gates): `Server import in a client file: lib/ct import fails with the boundary rule`, `Server import in a client file: @commercetools import fails`, `use client file importing lib/types passes`, `Bare next/link in locale UI fails`, `useRouter from next/navigation in locale UI fails`, `notFound from next/navigation passes`, `Link from @/i18n/routing passes`, `any fails`, `Raw hex in a component fails`, `Tailwind arbitrary hex fails`, `new ClientBuilder outside lib/ct/client.ts fails`, `new ClientBuilder in lib/ct/client.ts passes`.

- [ ] **A-11 Bundle secret scan and verify:build** `[SKILL: commercetools-platform]`
  - Files: `scripts/check-bundle-secrets.mjs`, `scripts/check-bundle-secrets.test.ts`.
  - Steps: section 3.11. Test creates a temp `.next/static/chunks/a.js` containing a fake secret value and expects one problem naming the variable (not the value) and none when absent.
  - Tests (spec: Client bundle scan): `Client bundle scan finds a secret value in .next/static and reports only the name`, `Client bundle scan passes on a clean build output`.

- [ ] **A-12 Agent rules, live checks and evidence** `[SKILL: commercetools-storefront]`
  - Files: `AGENTS.md`, `CLAUDE.md`, `plans/evidence/A/*`.
  - Steps: section 3.14. Then run the whole Browser recipe (section 6) and Self-verification (section 7).
  - Tests: `agent-rules.test.ts`: `New contributor: CLAUDE.md and AGENTS.md name the commands, the lint rules and the two plan files` (read both files, assert they contain `npm run check`, `plans/TODO-MANUAL-TESTING.md`, `plans/QUESTIONS.md`, `@/i18n/routing`, and that AGENTS.md still contains `BEGIN:nextjs-agent-rules`).

- [ ] **A-13 Fresh clone dry run and hand-off**
  - Steps: commit everything; `git clone . "$TMPDIR/dry-a"` (use the scratchpad folder), `cd .../b2c-foodservice/storefront`, `cp` a prepared `.env.local` (placeholders are fine, project key identical to expected), `npm ci && npm run check && npm run build`. Save the last 20 lines to `plans/evidence/A/fresh-clone.txt`. Set `STATUS.md` row A to `Ready for review`.

## 5. Scenarios checklist (`bootstrap-and-structure`)

- [ ] Fresh clone builds: A-13 dry run, evidence `fresh-clone.txt`; plus `Stack and version gates pass on the real repository` (A-04)
- [ ] Forbidden version: `Forbidden version: next 15.x fails with the version rule` (and 3 siblings, A-04)
- [ ] Scaffold evidence: `plans/evidence/A/{command-output.txt,versions.txt,health.json}` (A-01, A-12); reviewer reads the folder
- [ ] A new resource: documented in `AGENTS.md` (checked by `New contributor` test) and exercised first by D; test `AGENTS.md lists the six files for a new resource` in `agent-rules.test.ts`
- [ ] Unknown locale: `Unknown locale redirects to the default locale, never nested` (A-06)
- [ ] Adding a market: `Adding a market: every COUNTRY_CONFIG key has a message file with the same keys` (A-05)
- [ ] Missing secret: `Missing secret: SESSION_SECRET shorter than 32 names the variable and not the value` (A-07) and browser step 6
- [ ] Client bundle scan: `Client bundle scan finds a secret value in .next/static and reports only the name` (A-11) and `npm run verify:build` evidence
- [ ] Wrong project: `Wrong project names both keys` (A-07) and browser step 7
- [ ] Stored URL with a query: `Images are unoptimized and https remote patterns are allowed` (A-09); the "only the part before `?` is stored" half is tested by workstream C (`strips query and fragment from stored image URLs`)
- [ ] Credentials valid: `Credentials valid: health returns 200 with the project key and no secret` (A-08) and live step 3
- [ ] Deploy gate: `Deploy gate fails while app/api/health/route.ts exists` (A-08)
- [ ] Server import in a client file: `Server import in a client file: lib/ct import fails with the boundary rule` (A-10)
- [ ] New contributor: `New contributor: CLAUDE.md and AGENTS.md name the commands, the lint rules and the two plan files` (A-12)

## 6. Browser recipe (Chrome DevTools MCP, you run it)

Load the tools first with ToolSearch (`select:mcp__chrome-devtools__navigate_page,...`). Save evidence under `plans/evidence/A/`.

1. `cd storefront && npm run dev` in the background (port 3000). Wait for "Ready".
2. `navigate_page` to `http://localhost:3000/`. Expect the final URL `http://localhost:3000/en-US`. `list_network_requests`: first request is a 307 to `/en-US`, then 200. Save `A-root-redirect-1440.png` (resize to 1440x900 with `resize_page` first).
3. `navigate_page` to `http://localhost:3000/api/health`. With OA-01 done: 200 and JSON `{"ok":true,"projectKey":"<key>"}`. Save the body (key only) to `health.json`. Without OA-01: record `blocked: OA-01` in `plans/evidence/A/README.md` and expect the 502 `upstream_unavailable` body (that also proves the failure shape); never paste values.
4. `navigate_page` to `http://localhost:3000/en-CA`. `take_snapshot`; `evaluate_script` `document.documentElement.lang` returns `en-CA`. `/de-DE` and `/en-GB` must be 404 (removed locales).
5. `navigate_page` to `http://localhost:3000/fr-FR/coffee`: final URL `/en-US/coffee`, status 404 page shell (route `coffee` does not exist yet, but the URL must not be `/en-US/fr-FR/coffee`). In `evaluate_script` run `document.cookie='malva-locale=en-CA'` and load `/coffee`: expect `/en-CA/coffee`.
6. Resize to 375x812 and 1440x900 and take `A-home-375.png`, `A-home-1440.png`. `list_console_messages`: no error. `list_network_requests`: no failed request (a 404 for the unknown `/coffee` page is expected, anything else is not).
7. Fail-fast checks in the terminal (Bash, background, read the output, then stop the server): `SESSION_SECRET=short npm run dev` must print an error that contains `SESSION_SECRET must be at least 32 characters` and must not print the value `short`; `EXPECTED_PROJECT_KEY=other npm run dev` must print both keys. Save the trimmed output as `startup-guard.txt`.
8. `npm run verify:build`; save the tail as `build-tail.txt`.
9. Write `plans/evidence/A/README.md`: one line per file saying what it proves.

## 7. Self-verification with data

- `curl -s http://localhost:3000/api/health` is the read-back. Compare `projectKey` with the key you typed in `.env.local` (read your own file, do not print the secret lines).
- With the commercetools MCP server `food-service` (connected): read the project (`get project`) and confirm the key equals `EXPECTED_PROJECT_KEY`; also confirm the countries, currencies and languages include US/CA, USD/CAD, en-US/en-CA (B adds them, or the owner action OA-A-b did;  if missing, note it for workstream B, do not change anything).
- Without MCP: `cd ../seed && npm run verify` is read-only and prints the project settings; use it.
- Record anything that differs from this file in `plans/PROJECT-FINDINGS.md` (date, finding, source, effect).

## 8. Manual testing and owner items

| ID | Who | When needed | Steps (summary) | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-01 (existing) | Owner | A-12 live health check, A-13 | The owner provides the API clients in `.env` files (`seed/.env.local`, `storefront/.env.local`; names in `.env.example`); project key `spec-test-b2c-food` (D-031) | `/api/health` returns 200 | TODO |
| OA-06 (existing) | Owner | Read-backs | The commerce MCP server `food-service` is connected and can read the project; writes through it were blocked by the permission classifier (see OA-A-b) | MCP read tools listed | Done (reads) |
| M-A-01 | Owner | Optional, after Ready for review | Fresh clone on your own machine with Node 22, copy `.env.example` to `.env.local`, fill it, `npm ci && npm run check && npm run build` | All green | TODO |
| M-A-02 | Owner | Optional | Read `storefront/AGENTS.md` and `CLAUDE.md` and confirm the rules read correctly for your team | Approval or corrections | TODO |

Full rows are in `plans/notes/todo-A.md`.

## 9. Questions (default is built; nobody waits)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-A-1 | The skill command creates `site/`; the spec wants `storefront/`. | Use `storefront/` (rename during or right after the command) | no |
| Q-A-2 | Where does `netlify.toml` live? The command writes it at the project root (`b2c-foodservice/`). | Keep it at the project root, `base = "storefront"`, delete `vercel.json`; revisit in Q with OA-05 | no |
| Q-A-3 | Locale cookie name. | `malva-locale` instead of the command's `your-shop-country-locale` | no |
| Q-A-4 | Detect language from `Accept-Language` for first visits? | No: cookie, else `en-US` | no |
| Q-A-5 | `next` range: exact pin or caret? | Caret `^16` resolved to the latest 16.x; the lockfile pins it | no |
| Q-A-6 | `@types/node` version. | `^22` (Node 22) | no |
| Q-A-7 | Empty folders from the spec layout. | `.gitkeep` files until the folder gets a real file | no |
| Q-A-8 | Which `next/navigation` exports stay allowed in locale UI? | `notFound`, `useSearchParams`, `unstable_rethrow` allowed; `redirect`, `useRouter`, `usePathname`, `permanentRedirect` and all of `next/link` forbidden | no |
| Q-A-9 | Raw-hex lint scope. | `components/**` and `app/**/*.tsx`, excluding tests; CSS files are the token layer (E) | no |
| Q-A-10 | Extra dev packages (`vitest` family, `vite-tsconfig-paths`, `server-only`). | Allowed (the guide and the Next docs name them); anything else needs a question | no |
| Q-A-11 | Is the version gate part of `check`? | Yes, as a Vitest test inside `npm run test`; also runnable as `node scripts/check-versions.mjs` | no |
| Q-A-12 | Should `/api/health` also be disabled at runtime in production? | No: it is deleted before deploy and the predeploy script fails while it exists | no |
| Q-A-13 | Does the health route also verify that the key the API reports equals `EXPECTED_PROJECT_KEY`? | Yes (second half of the project guard) | no |
| Q-A-14 | Fonts and tokens in A? | No: A leaves `globals.css` as `@import 'tailwindcss'` only; E adds tokens and fonts | no |
| Q-A-15 | Should `.env` (non-local) and `.env.development` be forbidden files? | Yes, `check-secrets` fails if they exist (Next would load them, and the spec says credentials come only from `.env.local`) | no |

Also in `plans/notes/questions-A.md`.

## 10. Definition of done

- A-01 to A-13 ticked, each with a passing `npm run check` commit.
- Every scenario in section 5 has the named test or evidence file.
- Fresh clone: `npm ci && npm run check && npm run build` green (evidence `fresh-clone.txt`).
- `plans/evidence/A/` holds `command-output.txt`, `versions.txt`, `health.json` (or the documented blocked note), screenshots at 375 and 1440, `startup-guard.txt`, `build-tail.txt`, `README.md`.
- `git ls-files storefront | grep -E '\.env($|\.)'` prints only `storefront/.env.example`; `.env.example` has no values; `grep -r "NEXT_PUBLIC_" storefront --include=*.ts* --include=.env.example` prints nothing about secrets.
- No `tailwind.config.*`, exactly one `new ClientBuilder(` (in `lib/ct/client.ts`), no `any`.
- `OA`/`M` rows are in `plans/TODO-MANUAL-TESTING.md` (lead merges `plans/notes/todo-A.md`); questions merged from `plans/notes/questions-A.md`.
- `node plans/verify-plan.mjs` passes; `STATUS.md` row A is `Ready for review`.
