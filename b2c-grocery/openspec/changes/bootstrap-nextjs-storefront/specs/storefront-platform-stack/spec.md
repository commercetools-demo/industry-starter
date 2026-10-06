## ADDED Requirements

### Requirement: Supported framework and runtime versions

The storefront SHALL use Node.js 22 (per `.nvmrc`), `next@^16` with the App Router, React 19, `next-intl@^4`, Tailwind CSS v4 and TypeScript. It SHALL NOT use Next.js 15.x or earlier, or `next-intl` below 4.

#### Scenario: Version check passes
- **WHEN** `npm list next next-intl --depth=0` runs in `site/`
- **THEN** `next` is greater than 16.0.0 and `next-intl` is 4.x

#### Scenario: Old framework rejected
- **WHEN** a change pins `next` to 15.x
- **THEN** the dependency check in CI fails

### Requirement: Scaffold procedure

The project SHALL be created in `site/` with `create-next-app@^16` using `--typescript --app --src-dir=false --tailwind=false --eslint --import-alias "@/*"`, because passing `--tailwind` installs Tailwind v3. Tailwind v4 SHALL be installed explicitly with `@tailwindcss/postcss` and `postcss`.

#### Scenario: No Tailwind v3 artifacts
- **WHEN** the scaffold completes
- **THEN** `site/tailwind.config.*` does not exist and `tailwindcss` resolves to 4.x

### Requirement: Runtime dependency set

`site/package.json` SHALL include `@commercetools/platform-sdk`, `@commercetools/ts-client`, `next-intl`, `swr`, `jose`, `tailwindcss`, `@tailwindcss/postcss` and `postcss`. Initial commercetools SDK majors SHALL be `@commercetools/platform-sdk@^8` and `@commercetools/ts-client@^4` as verified by the skill; moving to the latest majors SHALL be a separate, tested change.

#### Scenario: SDK upgrade
- **WHEN** the SDK majors are raised
- **THEN** the change includes passing typecheck, build and a successful `/api/health` smoke test

### Requirement: Dependency policy

New runtime dependencies SHALL be justified in the change that adds them, SHALL be exact-major pinned with a caret range, and the lockfile SHALL be committed.

#### Scenario: Lockfile
- **WHEN** dependencies change
- **THEN** `package-lock.json` is updated in the same commit
