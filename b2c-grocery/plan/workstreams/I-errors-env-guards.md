# I — Error pages, env validation completion, secret guards

**Specs:** `storefront-delivery-quality` — Error and not-found experience, Environment validation (completion), Dev-only routes (guard prepared); `storefront-bff-and-session` — Secret in client bundle (guard)
**Depends on:** E, H · **Unblocks:** Y · **Decisions:** D-044 (no CI → local guards)

## Goal
Friendly error/not-found pages in both locales and local guards that fail `npm run verify` if a secret could leak.

## Design
- `app/[locale]/error.tsx` **(client)**: props `{ error, reset }`; kicker `errors.kicker`, H1 `errors.title`, message `errors.body`, buttons "Try again" (`reset`) and "Back to the shop" (`Link` to `/shop`). Never print `error.message` to the user; log with `console.error` in an effect.
- `app/[locale]/not-found.tsx`: H1 `errors.notFoundTitle`, text, buttons "Back to the shop" and "Contact us".
- `app/global-error.tsx` **(client)**: renders its own `<html><body>` with minimal inline-free markup (classes only), message in English (no intl available) and a reload button.
- `scripts/check-secrets.mjs` exports `checkSecrets(rootDir)`: fails when (a) any tracked file (use `git ls-files`) contains `NEXT_PUBLIC_CTP` or `NEXT_PUBLIC_SESSION`, (b) `.env.example` has a non-empty value for `CTP_CLIENT_SECRET`, `CTP_CLIENT_ID`, `SESSION_SECRET`, `CTP_CHECKOUT_APP_KEY`, (c) a tracked file other than `.env.example` matches `/^\.env/`, (d) a string literal of ≥32 chars next to `SESSION_SECRET`/`CLIENT_SECRET` assignment in source. Wired into `verify` as `check:secrets` (first step).
- `scripts/check-release.mjs` (used by Y): fails if `app/api/health` exists or any route under `app/**/dev/**` exists.

## Tasks
- [ ] I-01 Write `error.tsx`, `not-found.tsx`, `global-error.tsx` + message keys (both locales). Tests: `error.tsx` shows generic text (never the raw error message), "Try again" calls `reset`; `not-found` has a link to `/shop` (locale aware); `global-error` renders html/body.
- [ ] I-02 Write `scripts/check-secrets.mjs` with tests on temp git repos/dirs for each rule (a–d) and a passing case; add `check:secrets` to `verify`.
- [ ] I-03 Write `scripts/check-release.mjs` (+ tests) but do **not** add it to `verify`; add `verify:release` = `verify` + `check:release`.
- [ ] I-04 Verify `validateEnv()` covers `CTP_CHECKOUT_APP_KEY` (E) and add `README` section "Environment variables" listing all variables, which are secret, where to set them (`.env.local`, Netlify UI).
- [ ] I-05 Report manual tests M-I-1, M-I-2.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Unhandled server error | I-01 |
| Unknown product (not found with path back) | I-01 (+ L) |
| Secret in client bundle | I-02 |
| Missing variable | E-01 |
| Production build (health 404) | I-03 + Y |

## Manual tests to report
- M-I-1: Visit `/en-US/nope` and `/de-DE/nope`: localized not-found page with working links.
- M-I-2: Temporarily throw inside a page in dev; confirm the error page shows a retry button and no stack trace.

## Definition of done
`verify` runs secrets guard; pages localized; release check ready for Y.
