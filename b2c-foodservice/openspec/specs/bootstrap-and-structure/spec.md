<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront bootstrap and project structure

## Purpose

Malva Coffee's online storefront is one Next.js application that sells pods, coffee, machines and accessories in the United States and Canada, for delivery everywhere and for collection in the six New York City stores (US market only). This spec fixes the stack, the folder layout, the configuration and the quality gates so every later workstream builds on the same ground and a new developer can start the app in minutes. It follows the `commercetools-storefront` skill and its Next.js adapter (`references/stack/nextjs`), scaffolded by `/commercetools:nextjs-setup-project`.

In scope: the online channel only. In-store selling is a separate system and is not built here.

## Requirements

### Requirement: Stack and version gates

The system SHALL be a Next.js App Router application on the current stable major of Next.js (16 at time of writing; the version installed is the latest `16.x`, never 15.x), React 19, TypeScript in strict mode, Tailwind CSS v4 through `@tailwindcss/postcss`, `next-intl` v4, `swr`, `jose`, `@commercetools/platform-sdk` ^8 and `@commercetools/ts-client` ^4 (the versions the skill gates on), Vitest with Testing Library for tests, and Node 22 (`.nvmrc`). Dependencies are pinned by `package-lock.json`.

#### Scenario: Fresh clone builds
- **GIVEN** a clean checkout, Node 22 and a filled `.env.local`
- **WHEN** a developer runs `npm ci && npm run check && npm run build`
- **THEN** type check, lint, unit tests and the production build all pass

#### Scenario: Forbidden version
- **GIVEN** a dependency change that sets `next` to a 15.x version or `next-intl` below 4
- **WHEN** the check script runs
- **THEN** it fails with the version rule it broke

### Requirement: Scaffold by the skill command

The system SHALL be created by running `/commercetools:nextjs-setup-project` in `storefront/` (the app root, a sibling of `seed/`, `plans/`, `design/` and `openspec/`), and the generated structure SHALL then be adjusted only as this spec states. Manual scaffolding that bypasses the command is not allowed except to repair a partial run. The command creates its app folder as `site/`; workstream A renames it to `storefront/` and fixes the paths it wrote in `netlify.toml` and deletes the generated `vercel.json`, because the hosting target is Netlify (D-038).

#### Scenario: Scaffold evidence
- **GIVEN** workstream A has finished
- **WHEN** a reviewer reads `plans/evidence/A/`
- **THEN** it shows the command output, the dependency versions installed and the health check response

### Requirement: Directory layout

The system SHALL use this layout under `storefront/`:

| Path | Holds |
| --- | --- |
| `app/layout.tsx` | Root layout, SWR fallback hydration |
| `app/[locale]/` | All shopper pages, `layout.tsx`, `error.tsx`, `not-found.tsx` |
| `app/api/` | BFF Route Handlers (one folder per resource) |
| `lib/ct/` | Server-only commercetools modules: `client.ts` (the `apiRoot` singleton), one file per namespace, `image-config.ts` |
| `lib/mappers/` | commercetools to app type mappers |
| `lib/types.ts` | The only types UI code imports |
| `lib/session.ts` | `jose` session helpers |
| `lib/cache-keys.ts` | SWR and cache tag keys |
| `lib/utils.ts` | `COUNTRY_CONFIG`, `formatMoney`, `getLocalizedString` |
| `hooks/` | `'use client'` SWR hooks, one per resource |
| `context/` | Cart, store and locale providers |
| `components/{ui,layout,product,...}/` | Components; `ui` holds the atoms of `design-tokens-and-components` |
| `i18n/` | `routing.ts`, `request.ts` |
| `messages/` | `en-US.json` and `en-CA.json` with identical keys |
| `proxy.ts` | Locale routing middleware |
| `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts` | Tooling |
| `.env.example`, `.nvmrc`, `CLAUDE.md`, `AGENTS.md` | Environment template, runtime pin, rules for coding agents |

#### Scenario: A new resource
- **GIVEN** a feature needs a new commercetools resource
- **WHEN** a developer adds it
- **THEN** they add `lib/ct/<namespace>.ts`, a mapper, a type, a Route Handler, a SWR hook and a cache key, and nothing else in the tree changes shape

### Requirement: Locales, countries and currencies from one source

The system SHALL define markets once in `COUNTRY_CONFIG` and derive routing, currency, country and message files from it: exactly two entries (D-030): `en-US` (US, USD) and `en-CA` (CA, CAD, English only; French is not built). Routes are always locale-prefixed (`/en-US/...`, `/en-CA/...`), the default locale is `en-US`, and each locale has a message catalogue with the same keys. Prices are tax-exclusive in both markets (D-036). Collection features are enabled by a per-market flag that is true for US and false for CA (D-035).

#### Scenario: Unknown locale
- **GIVEN** a request to `/fr-FR/coffee` or `/de-DE/coffee`
- **WHEN** the proxy handles it
- **THEN** it redirects to the default or cookie locale, never renders a page without a locale

#### Scenario: Adding a market
- **GIVEN** a new entry is added to `COUNTRY_CONFIG`
- **WHEN** a message file with the same key exists
- **THEN** routing, currency formatting and cart creation use it without further code changes

### Requirement: Hosting on Netlify

The system SHALL deploy to Netlify (D-038) using `netlify.toml` at the app root and the `/commercetools:nextjs-deploy-netlify` skill, SHALL NOT keep Vercel configuration, and SHALL set the same server-only environment variables in Netlify (never with a `NEXT_PUBLIC_` prefix). The hosted Checkout return URLs and any Stripe webhooks point at the Netlify site URL.

#### Scenario: Deploy config
- **GIVEN** the app root after workstream A
- **WHEN** a reviewer lists deployment files
- **THEN** `netlify.toml` exists and no `vercel.json` exists

### Requirement: Configuration and secrets

The system SHALL read commercetools settings only from server environment variables (`CTP_PROJECT_KEY`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_SCOPES`) plus `SESSION_SECRET` (at least 32 characters) and, for the demo sign-in of `design-account-area`, `DEMO_LOGIN_ENABLED` and `DEMO_LOGIN_PASSWORD`, keep them in git-ignored `.env.local`, and commit only `.env.example` with names and no values. No secret has a `NEXT_PUBLIC_` prefix. The storefront API client is the Frontend (non-admin) client with only the scopes the storefront needs, including `manage_recurring_orders` once subscriptions are built. A feature that needs a broader scope (reviews) uses a second isolated server-only client (`server-architecture-and-data-flow`).

#### Scenario: Missing secret
- **GIVEN** `SESSION_SECRET` shorter than 32 characters
- **WHEN** the server starts
- **THEN** it fails fast with a message naming the variable, not its value

#### Scenario: Client bundle scan
- **GIVEN** a production build
- **WHEN** the build output is searched for the client secret value
- **THEN** it is not present

### Requirement: Project guard

The system SHALL refuse to start against any commercetools project other than the one named in `EXPECTED_PROJECT_KEY`, and SHALL never read credentials from outside `storefront/.env.local`.

#### Scenario: Wrong project
- **GIVEN** `CTP_PROJECT_KEY` differs from `EXPECTED_PROJECT_KEY`
- **WHEN** the server starts
- **THEN** it stops with a message naming both keys

### Requirement: Image handling

The system SHALL set `images.unoptimized: true` and allow https remote patterns, and SHALL route every product image URL through the three transform functions in `lib/ct/image-config.ts` (listing, detail, thumbnail). Stored image URLs are clean (no query string and no fragment); sizing happens only at render time.

#### Scenario: Stored URL with a query
- **GIVEN** an image URL carrying `?auto=compress&w=750`
- **WHEN** it is written to commercetools
- **THEN** only the part before `?` is stored

### Requirement: Health check

The system SHALL expose `GET /api/health` returning `{"ok":true,"projectKey":"..."}` after a successful `apiRoot.get()` call, and SHALL remove or disable it before any deploy.

#### Scenario: Credentials valid
- **GIVEN** valid credentials
- **WHEN** `/api/health` is called
- **THEN** it returns 200 with the project key and no secret

#### Scenario: Deploy gate
- **GIVEN** the pre-deploy check runs
- **WHEN** `app/api/health/route.ts` exists
- **THEN** the check fails

### Requirement: Quality gates

The system SHALL provide `npm run dev`, `build`, `lint`, `typecheck`, `test` and `check` (lint, typecheck and test). `check` is the gate every task must pass before it is ticked. Lint rules forbid: importing `lib/ct/*` or `@commercetools/*` from a `'use client'` file; bare `next/link` or `next/navigation` imports in locale UI (use `@/i18n/routing`); `any`; raw hex colour values in components.

#### Scenario: Server import in a client file
- **GIVEN** a `'use client'` file imports `lib/ct/cart`
- **WHEN** lint runs
- **THEN** it fails with the boundary rule

### Requirement: Rules for coding agents

The system SHALL include `storefront/CLAUDE.md` and `AGENTS.md` stating the BFF boundary, the version gates, the token-only styling rule, the locale-link rule, where manual-testing items are recorded (`plans/TODO-MANUAL-TESTING.md`) and where questions go (`plans/QUESTIONS.md`).

#### Scenario: New contributor
- **GIVEN** a developer or agent opens the app folder
- **WHEN** they read `CLAUDE.md`
- **THEN** they know which commands to run, which rules are enforced by lint and where to report manual tests
