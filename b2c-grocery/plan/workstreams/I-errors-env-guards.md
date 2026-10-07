# I — Error pages, env validation completion, secret guards

**Specs:** `storefront-delivery-quality` — Error and not-found experience, Environment validation (completion), Dev-only routes (guard prepared); `storefront-bff-and-session` — Secret in client bundle (guard)
**Depends on:** E, H · **Unblocks:** Y · **Decisions:** D-044 (no CI → local guards)

## Goal
Friendly error/not-found pages in both locales and local guards that fail `npm run verify` if a secret could leak.

## Design
- `app/[locale]/error.tsx` **(client)**: props `{ error, reset }`; kicker `errors.kicker`, H1 `errors.title`, message `errors.body`, buttons "Try again" (`reset`) and "Back to the shop" (`Link` to `/shop`). Never print `error.message` to the user; log with `console.error` in an effect.
- `app/[locale]/not-found.tsx`: H1 `errors.notFoundTitle`, text, buttons "Back to the shop" and "Contact us".
- `app/global-error.tsx` **(client)**: renders its own `<html><body>` with minimal inline-free markup (classes only), message in English (no intl available) and a reload button.
- `scripts/check-secrets.mjs` exports `checkSecrets(rootDir)`: fails when (a) any tracked file under `site/` — excluding `scripts/`, `*.test.*`, `.next/` — contains `NEXT_PUBLIC_CTP` or `NEXT_PUBLIC_SESSION`, (b) `.env.example` has a non-empty value for `CTP_CLIENT_SECRET`, `CTP_CLIENT_ID`, `SESSION_SECRET`, `CTP_CHECKOUT_APP_KEY`, (c) a tracked file whose **basename** starts with `.env` other than `.env.example` (so `site/.env.example` passes), (d) a string literal of ≥32 chars is assigned to `SESSION_SECRET`/`CLIENT_SECRET` in source. Wired into `verify` as `check:secrets` (first step).
- `scripts/check-bundle-secrets.mjs` exports `scanBundle(dir, env)`: after the build, scans `site/.next/static/**` for the strings `CLIENT_SECRET`, `SESSION_SECRET`, and for the **values** of the `CTP_CLIENT_SECRET`, `CTP_CLIENT_ID`, `SESSION_SECRET` variables when set. Wired into `verify` after the build step as `check:bundle`.
- `app/not-found.tsx` (root, unmatched non-locale URLs) and `app/[locale]/[...rest]/page.tsx` calling `notFound()` so unmatched locale URLs render the localized not-found page.
- `scripts/check-release.mjs` (used by Y): fails if `app/api/health` exists, or any route under `app/**/dev/**` lacks the `NODE_ENV === 'development'` guard (it must call `notFound()` otherwise).

## Tasks
- [x] I-01 Write `error.tsx`, `not-found.tsx`, `global-error.tsx`, the root `app/not-found.tsx` and the catch-all `[...rest]/page.tsx` (test: the catch-all calls `notFound`) + message keys (both locales). Tests: `error.tsx` shows generic text (never the raw error message), "Try again" calls `reset`; `not-found` has a link to `/shop` (locale aware); `global-error` renders html/body.
- [x] I-02 Write `scripts/check-secrets.mjs` with tests on temp git repos/dirs for each rule (a–d) and a passing case; add `check:secrets` to `verify`; write `scripts/check-bundle-secrets.mjs` + tests (temp `.next/static` with a planted secret value fails; clean passes) and append `check:bundle` after `build` in `verify`.
- [x] I-03 Write `scripts/check-release.mjs` (+ tests) but do **not** add it to `verify`; add `verify:release` = `verify` + `check:release`.
- [x] I-04 Verify `validateEnv()` covers `CTP_CHECKOUT_APP_KEY` (E) and add `README` section "Environment variables" listing all variables, which are secret, where to set them (`.env.local`, Netlify UI).
- [x] I-05 Report manual tests M-I-1, M-I-2.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Unhandled server error | I-01 |
| Unknown product (not found with path back) | I-01 (+ L) |
| Secret in client bundle | I-02 |
| Missing variable | E-01 |
| Production build (health 404) | I-03 + Y |

## Manual tests to report
- M-I-1: `cd site && npm run dev`; at 1440 px and 390 px wide open `http://localhost:3000/en-US/nope` and `http://localhost:3000/de-DE/nope` (also `/en-US/shop/x/y`) → localized not-found page (English: "We could not find that page"; German: "Diese Seite haben wir nicht gefunden") inside the normal header/footer, with a "Back to the shop" button going to `/en-US/shop` (`/de-DE/shop`) and a "Contact us"/"Kontakt" button going to `/<locale>/contact`; HTTP status of the page is 404 (DevTools Network). Note `/shop` and `/contact` are 404 themselves until later workstreams add them.
- M-I-2: `cd site && npm run dev`; temporarily add `throw new Error('boom-test')` at the top of `site/app/[locale]/page.tsx`'s component, open `http://localhost:3000/en-US` and `/de-DE` → the localized error page shows the kicker, title, a "Try again"/"Erneut versuchen" button and a "Back to the shop" link; the text `boom-test` and any stack trace are not on the page (in production build; the dev overlay may show it); the console logs the error. Remove the throw, click "Try again" → the home page renders. Revert the change afterwards.

## Definition of done
`verify` runs secrets guard; pages localized; release check ready for Y.

## Implementation notes (deviations, recorded by the developer)
- `app/not-found.tsx` renders inside the root layout (Next.js wraps it), so it has no `<html>/<body>` and no intl provider: English text and a plain `<a href="/">` (with a scoped eslint-disable for `no-html-link-for-pages`; `next/link` is restricted by lint and the routing `Link` needs the locale provider). The proxy redirects `/` to the visitor's locale. `global-error.tsx` does render its own `<html><body>`.
- `error.tsx` / `not-found.tsx` / `[...rest]/page.tsx` live under `app/[locale]/` and are rendered inside the locale layout (chrome stays). Contact link goes to `/contact` (the same href as the footer); `/shop` and `/contact` do not exist yet.
- `checkSecrets(rootDir)` takes the project root (`site/`) and uses `git ls-files --cached --others --exclude-standard` (so new, not-yet-committed files are also scanned, ignored `.env.local` is not), falling back to a directory walk outside git. It returns a list of violation strings instead of throwing; the CLI exits 1. Rule (d) only matches `SESSION_SECRET`/`CLIENT_SECRET` followed by `=` or `:` and a quoted literal of 32+ chars. Secret values are never printed. `scripts/` and `*.test.*` are excluded from (a) and (d).
- `scanBundle(dir, env)` also fails if `dir` does not exist (so `check:bundle` cannot silently pass without a build). The CLI loads `.env.local` with `process.loadEnvFile` (Node 22) so the real local values are searched in `.next/static`.
- `verify` order: `check:secrets` first, `check:bundle` after `build`. `verify:release` = `verify` + `check:release`. `check:release` currently fails on purpose because `app/api/health` still exists (Y removes it). It treats any source file in a `dev` path segment under `app/` as a dev route and requires both `NODE_ENV === 'development'`-style comparison and a `notFound()` call.
- I-04: `validateEnv()` already required `CTP_CHECKOUT_APP_KEY` (E); added an explicit test. README "Environment variables" section added in `site/README.md`.
