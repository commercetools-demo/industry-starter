<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

## ADDED Requirements

### Requirement: Supported framework and dependency versions

The project SHALL be a Next.js App Router application in `b2c-healthcare/site/` using `next@^16`, `next-intl@^4`, React 19, TypeScript, Tailwind CSS v4, `swr`, `jose`, `@commercetools/platform-sdk@^8` and `@commercetools/ts-client@^4`, installed with npm and a committed lockfile.

#### Scenario: Version gate
- **GIVEN** the installed dependencies
- **WHEN** the version check runs (part of the quality gate)
- **THEN** it fails if `next` is below 16.0.0 or `next-intl` is below 4

#### Scenario: Tailwind v4 without a config file
- **GIVEN** a fresh checkout
- **WHEN** styles build
- **THEN** Tailwind runs through `@tailwindcss/postcss`, `app/globals.css` begins with `@import 'tailwindcss';`, and no `tailwind.config.*` exists

#### Scenario: Reproducible install
- **GIVEN** a clean clone
- **WHEN** `npm ci` then `npm run build` run with the variables of `.env.example`
- **THEN** both succeed

### Requirement: Directory layout

The project SHALL follow the layout in `design.md`: server-only code under `lib/` (`lib/ct/`, `lib/mappers/`, `lib/session.ts`, `lib/types.ts`), BFF handlers under `app/api/`, client state under `hooks/` and `context/`, and locale routes under `app/[locale]/`.

#### Scenario: Server-only boundary
- **GIVEN** any file with `'use client'` or any file under `components/` or `hooks/`
- **WHEN** it imports from `lib/ct/*` or `lib/session`
- **THEN** the lint check fails; such code imports types from `lib/types.ts` only

#### Scenario: Server-only modules guarded at build time
- **GIVEN** `lib/ct/*` and `lib/session.ts`
- **WHEN** a client bundle would include them
- **THEN** the build fails because they import `server-only`

### Requirement: Secrets and environment files

The project SHALL read every commercetools and session secret from server-only environment variables and SHALL document them in `.env.example` without values.

#### Scenario: No public prefix on secrets
- **GIVEN** the environment variables `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `SESSION_SECRET`
- **WHEN** the repo is scanned
- **THEN** none appears with a `NEXT_PUBLIC_` prefix and none appears in a client bundle

#### Scenario: Nothing committed
- **GIVEN** the repository
- **WHEN** `git ls-files` runs
- **THEN** `.env`, `.env.local` and `.next/` are absent, `.gitignore` lists them, and `.env.example` is present

### Requirement: Local quality gate

The project SHALL provide `npm run check` that runs type-check, lint (including the design lint of `design-system-tokens`), the version gate and unit tests, and the build SHALL fail on type errors.

#### Scenario: Gate on a clean scaffold
- **GIVEN** the scaffold with no feature code
- **WHEN** `npm run check` runs
- **THEN** it passes

#### Scenario: Token parity wired
- **GIVEN** `design/source/_ds/tokens.css` and the storefront theme
- **WHEN** `npm run check` runs
- **THEN** the parity check of `design-system-tokens` is part of it (the check's own behavior is specified there)

### Requirement: Bootstrap smoke test

The system SHALL render a locale-prefixed placeholder page that proves routing, messages, tokens and the commercetools connection work end to end before any feature is built.

#### Scenario: Placeholder renders
- **GIVEN** the dev server
- **WHEN** a visitor requests `/en-US`
- **THEN** a page renders using token-styled elements and a message from `messages/en-US.json`, without console errors

#### Scenario: Health endpoint is temporary
- **GIVEN** `app/api/health/route.ts` that returns `{ ok, projectKey }`
- **WHEN** a production build is produced
- **THEN** the endpoint does not exist (build step or check fails if the file is present on the release branch)

## commercetools

Uses the `commercetools-platform` SDK setup; no resources are read or written by the scaffold itself except the project fetch of the health check.
