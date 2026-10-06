## ADDED Requirements

### Requirement: Deploy configuration

A root `netlify.toml` (`base = "site"`, `command = "npm run build"`, `publish = ".next"`, `NODE_VERSION = "22"`) SHALL exist, with the Netlify project root scoped to `site/`. No `vercel.json` SHALL be added. Netlify environment variables SHALL be set in the Netlify UI and never committed.

#### Scenario: Netlify build
- **WHEN** Netlify builds the repository
- **THEN** it builds from `site/` and ignores `openspec/` and `design/`

### Requirement: Quality gates

There is no CI in v1. `npm run verify` in `site/` SHALL run lint, typecheck, unit tests and `npm run build` in that order and stop at the first failure, and SHALL be run and pass before every commit that completes a task. Lint rules SHALL enforce the layering rules in `storefront-project-structure`.

#### Scenario: Failing typecheck
- **WHEN** a type error exists
- **THEN** `npm run verify` exits non-zero before running tests

### Requirement: Environment validation

The app SHALL validate required environment variables at startup (commercetools settings, `CTP_CHECKOUT_APP_KEY` and `SESSION_SECRET` ≥ 32 characters) and SHALL name the missing variable in the error. `.env.example` SHALL list every variable without values.

#### Scenario: Missing variable
- **WHEN** `CTP_CLIENT_SECRET` is unset
- **THEN** startup fails naming `CTP_CLIENT_SECRET`

### Requirement: Dev-only routes removed before deploy

`app/api/health/route.ts` and any other development-only route SHALL be absent from deployed builds.

#### Scenario: Production build
- **WHEN** a production build is produced
- **THEN** `GET /api/health` returns 404

### Requirement: Error and not-found experience

Each locale SHALL provide `error.tsx`, `not-found.tsx` and a `global-error.tsx`, rendering with the shared chrome tokens and naming the failure with a path back (consistent with `error-pages`).

#### Scenario: Unhandled server error
- **WHEN** a page throws
- **THEN** `error.tsx` shows a message with a retry action and a link to the shop
