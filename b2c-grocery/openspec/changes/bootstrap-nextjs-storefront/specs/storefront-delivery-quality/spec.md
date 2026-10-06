## ADDED Requirements

### Requirement: Deploy configuration

Root `vercel.json` (`buildCommand: npm run build`, `outputDirectory: .next`, framework `nextjs`) and `netlify.toml` (`base = "site"`, `command = "npm run build"`, `publish = ".next"`, `NODE_VERSION = "22"`) SHALL exist, with the platform project root scoped to `site/`.

#### Scenario: Netlify build
- **WHEN** Netlify builds the repository
- **THEN** it builds from `site/` and ignores `openspec/` and `design/`

### Requirement: Quality gates

CI SHALL run install, lint, typecheck and `npm run build` for `site/` on every pull request and SHALL fail on any error. Lint rules SHALL enforce the layering rules in `storefront-project-structure`.

#### Scenario: Failing typecheck
- **WHEN** a pull request introduces a type error
- **THEN** CI fails and merge is blocked

### Requirement: Environment validation

The app SHALL validate required environment variables at startup (commercetools settings and `SESSION_SECRET` ≥ 32 characters) and SHALL name the missing variable in the error. `.env.example` SHALL list every variable without values.

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
