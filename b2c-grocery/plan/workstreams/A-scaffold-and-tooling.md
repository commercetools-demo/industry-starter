# A — Scaffold, tooling, verify script

**Specs:** `bootstrap-nextjs-storefront` → `storefront-platform-stack` (all), `storefront-delivery-quality` (Quality gates)
**Depends on:** nothing · **Unblocks:** B, C, D, E, F · **Decisions:** D-004, D-013, D-023, `.nvmrc` = Node 22
**Owner prerequisites:** none · **Skill refs:** `/commercetools:nextjs-setup-project` (command text is the source for flags)

## Goal
A `site/` Next.js 16 app that builds, lints, typechecks and runs Vitest, with one command (`npm run verify`) that proves it.

## Design
- Directory: `site/` at the repo root. Repo root keeps `openspec/`, `design/`, `plan/`.
- Package manager: **npm** only. `package-lock.json` committed. `.nvmrc` (Node 22) already exists at the repo root; do not change it.
- `package.json` scripts (exact):
  ```json
  {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "check:lockfile": "node scripts/check-lockfile.mjs",
    "verify": "npm run check:lockfile && npm run lint && npm run typecheck && npm test && npm run build"
  }
  ```
  (Later workstreams append more `check:*` steps to `verify`; keep the order lint → typecheck → test → build with checks first.)
- `vitest.config.ts`: plugin `@vitejs/plugin-react`, `test.environment = 'jsdom'`, `test.setupFiles = ['./vitest.setup.ts']`, `test.globals = true`, `resolve.alias['@'] = project root`, `test.include = ['**/*.test.{ts,tsx}']`, exclude `node_modules`, `.next`.
- `vitest.setup.ts`: `import '@testing-library/jest-dom/vitest'`; `afterEach(cleanup)`.
- Server-only tests add the first-line comment `// @vitest-environment node`.
- `test/utils.tsx` (created here as a stub, completed in D): exports `renderWithProviders(ui, options?)` that wraps in a fresh `SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}`; D adds `NextIntlClientProvider`.
- `.env.example` lists every variable with empty values (see Variables). `.gitignore` ignores `.env`, `.env.*` except `.env.example`, `.next`, `coverage`.

### Variables (all server-only, no `NEXT_PUBLIC_`)
`CTP_PROJECT_KEY` (=`spec-test-b2c`), `CTP_AUTH_URL` (=`https://auth.us-central1.gcp.commercetools.com`), `CTP_API_URL` (=`https://api.us-central1.gcp.commercetools.com`), `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `CTP_CHECKOUT_APP_KEY`, `SESSION_SECRET` (≥32 chars). The non-secret defaults may be written in `.env.example`; secrets stay empty. Optional (non-secret) variables, also listed in `.env.example`: `HOME_LAYOUT` (`editorial`|`grid`), `HOME_CONTACT_STRIP` (`true`|`false`), `HERO_IMAGE_URL`, `FEATURE_SUBSCRIPTIONS` (`true`|`false`).

`CTP_SCOPES` (space-separated, each `:spec-test-b2c`): see the list in `plan/TODO-MANUAL-TESTING.md` row OA-02.

## Tasks
- [x] A-01 From the repo root run `npx create-next-app@^16 site --typescript --app --src-dir=false --tailwind=false --eslint --import-alias "@/*" --use-npm` (if `--tailwind=false` or `--src-dir=false` is rejected, use `--no-tailwind` / `--no-src-dir`). Confirm `site/tailwind.config.*` does not exist. Commit.
- [x] A-02 `cd site`; install runtime deps `@commercetools/platform-sdk@^8 @commercetools/ts-client@^4 @commercetools/checkout-browser-sdk next-intl@^4 swr jose server-only lucide-react tailwindcss @tailwindcss/postcss postcss` and dev deps `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx`. Run `npm list next next-intl --depth=0`: `next` must be > 16.0.0, `next-intl` 4.x. Commit with lockfile.
- [x] A-03 Add `vitest.config.ts`, `vitest.setup.ts`, `test/utils.tsx` as designed. Add `test/smoke.test.ts` asserting `1 + 1 === 2` plus a jsdom check (`document.body` exists). Run `npm test`.
- [x] A-04 Set the `package.json` scripts exactly as in Design; set `"engines": {"node": ">=22"}`; `npm run lint` and `npm run typecheck` must pass on the scaffold.
- [x] A-05 Write `scripts/check-lockfile.mjs`: exits 1 with a clear message if `pnpm-lock.yaml`, `yarn.lock` or `bun.lockb` exists in `site/` or the repo root, or if `package-lock.json` is missing. Add `scripts/check-lockfile.test.ts` that runs the function against temp directories (export a `checkLockfiles(dir)` function; the CLI part calls it).
- [x] A-06 Create `.env.example` (see Variables). The root `.gitignore` already ignores `.envrc`, `.env`, `.env.local`, `.env.seed*`; add `.env.*` with the exception `!.env.example`. Add `test/gitignore.test.ts` that runs `git check-ignore` and asserts `.envrc`, `site/.env.local`, `site/.env.seed` are ignored and `site/.env.example` is not.
- [x] A-07 Remove create-next-app boilerplate: default page content, `public/*.svg` it added, scaffold CSS. Keep a minimal root `app/layout.tsx` and `app/page.tsx` ("Bootstrap OK"). `npm run build` passes.
- [x] A-08 Write `site/README.md`: Node version (`nvm use`), `npm ci`, `npm run dev`, `npm run verify`, env setup (copy `.env.example` → `.env.local`), pointer to `plan/`.
- [x] A-09 Run `npm run verify` from a clean clone state (`rm -rf node_modules .next && npm ci && npm run verify`). Report manual tests M-A-1, M-A-2 (already in the TODO file) as ready.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Version check passes | `test/versions.test.ts` reads `package.json` and asserts `next` range starts `^16`, `next-intl` `^4`, no `tailwind.config.*` file |
| Old framework rejected | same file: asserts no `15.` in dependency ranges |
| No Tailwind v3 artifacts | same file |
| Wrong lockfile | `scripts/check-lockfile.test.ts` |
| Offline tests | `npm test` passes with network disabled (no test imports a network client) |

## Manual tests to report
- M-A-1: In `site/` run `npm ci && npm run verify` → all steps pass, exit code 0 (Node 22 via `nvm use`).
- M-A-2: `npm run dev`, open `http://localhost:3000` → the "Bootstrap OK" page renders without console errors (the `/en-US` redirect arrives in D).

## Definition of done
`npm run verify` passes from a clean install; no secrets in the repo; `STATUS.md` A = Ready for review.
