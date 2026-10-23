<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Clean-clone gates (Q-03)

A fresh clone of branch `ws/q-quality` was made outside the worktree. Nothing was built or installed in the worktree. All values in the shell environment were obviously fake (`CTP_CLIENT_SECRET=dummy-not-a-secret` and similar). No `.env.local` was used for the gates. No real network call was possible: the auth and API URLs pointed at a dead local address.

## Result

| Gate | Result |
| --- | --- |
| `npm ci` (storefront, seed) | pass |
| `npm run check` (storefront): lint, typecheck, tests | pass: 227 test files, 1910 tests, 0 failed |
| `npm run build` (storefront) | pass with the env below; fails fast without it (finding F1) |
| `npm run verify:build` (build, then client bundle scan) | pass: `bundle scan: ok (checked 9 of 9 secret values)` |
| `npm run check` (seed): `tsc --noEmit && vitest run` | pass: 12 test files, 143 passed, 4 skipped or todo (147) |
| `npm run build` (seed) | no such script; the seed package has no build step |
| `npm audit --omit=dev` (both apps) | 0 vulnerabilities |

## Environment

| Item | Value |
| --- | --- |
| Machine | Darwin arm64 |
| Node | v22.21.1 (`.nvmrc` is `22`) |
| npm | 10.9.4 |
| `next` | 16.4.2 (Turbopack) |
| `react`, `react-dom` | 19.2.4 |
| `next-intl` | 4.14.9 |
| `@commercetools/platform-sdk`, `@commercetools/ts-client` | 8.27.0, 4.10.0 |
| `tailwindcss` | 4.3.3 |
| `vitest` (storefront, seed) | 5.0.5, 2.1.9 |
| `typescript` | 5.9.3 (both apps) |
| `eslint` | 9.39.5 |
| `swr`, `jose` | 2.5.1, 6.2.13 |

Commits:

- First full run: `22ea28d60becfca7af4bdb3b69d43a6cacea782a` (1908 tests, 227 files).
- The worktree moved on while the task ran. The clone was fast-forwarded to `48f0ad138b1d9e3df0efa8c7a6c3408b51ebfd10` and `npm ci`, `check`, `verify:build` and the seed check were run again. All passed (1910 tests, 227 files). The three commits in between change only app code (`proxy.ts`, reviews, account menu), not any gate file, script, lockfile or lint rule.
- Scenario proofs in `bootstrap.md` were run at `22ea28d6`. They do not depend on the three later commits.

## Commands and durations

Durations are wall clock. The npm cache was warm, so `npm ci` is faster than on a first-ever install.

| Step | Command (in `b2c-foodservice/`) | Exit | Time |
| --- | --- | --- | --- |
| Clone | `git clone --branch ws/q-quality --single-branch <repo> clean-clone` | 0 | 1.4 s |
| Install storefront | `storefront: npm ci` | 0 | 6 s (490 packages, 572 MB `node_modules`) |
| Lint | `storefront: npm run lint` | 0 | 7 s |
| Typecheck | `storefront: npm run typecheck` | 0 | 4 s |
| Check | `storefront: npm run check` | 0 | 28 s (the vitest run itself 18.9 s) |
| Vitest JSON | `storefront: npx vitest run --reporter=json --outputFile=...` | 0 | 18 s |
| Build without env | `storefront: npm run build` | 1 | 9 s (see F1) |
| Build cold | `storefront: rm -rf .next; npm run build` (fake env) | 0 | 8 s (compile 2.2 s, TypeScript 4.2 s, 68 static pages) |
| Bundle scan | `storefront: node scripts/check-bundle-secrets.mjs` | 0 | under 1 s |
| Build and scan | `storefront: npm run verify:build` | 0 | 9 s |
| Install seed | `seed: npm ci` | 0 | 1 s |
| Seed check | `seed: npm run check` | 0 | 4 s (vitest 2.7 s) |

At the later commit `48f0ad13`: `npm run check` 30 s, `verify:build` 9 s, seed check unchanged (12 files, 143 passed, 4 skipped or todo).

The build output lists 68 routes, all rendered on demand except `/robots.txt` and `/sitemap.xml`. The dev routes `/api/health`, `/api/dev/session`, `/[locale]/dev/design` and `/[locale]/dev/store-picker` are still in the build. The deploy gate lists them (see `bootstrap.md`, Deploy gate).

## Environment used for the build (names only)

Set in the shell for the build and the start tests, never in a file in the repo:

`CTP_PROJECT_KEY`, `EXPECTED_PROJECT_KEY` (equal), `CTP_AUTH_URL`, `CTP_API_URL` (both `https://127.0.0.1:9`, a dead address), `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES` (with `manage_recurring_orders` and `view_recurrence_policies`), `SESSION_SECRET` (more than 32 characters), `DEMO_LOGIN_ENABLED`, `DEMO_LOGIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`, `CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_TOKEN`, `FEEDBACK_WEBHOOK_URL`, `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, `CTP_CHECKOUT_APP_KEY`. All values were made up. Nine of them are in the bundle scan list, so the scan checked 9 of 9.

`npm run check` needs no environment at all. Only `build` and `start` do.

The build printed `{"event":"promise_threshold_failed"}` eight times. That is the app's own log line (`lib/ct/promise.ts:20`) for calls to the dead commercetools address while pages were prepared. It is expected with fake env. The build still passed.

## Test counts

| Package | Files | Tests | Notes |
| --- | --- | --- | --- |
| storefront at `22ea28d6` | 227 | 1908 passed, 0 failed (585 suites) | |
| storefront at `48f0ad13` | 227 | 1910 passed, 0 failed (585 suites) | JSON report: see the path below |
| seed | 12 | 143 passed, 4 skipped or todo (147) | the 4 are live tests that need credentials (`fulfilment.test.ts`, `reviews.test.ts`, 2 each) |

The Vitest JSON report from the clone at `48f0ad13` is at `/private/tmp/claude-501/-Users-behnam-code-commercetools-labs-industry-starter-b2c-foodservice/aceb131f-558d-44f4-9e90-2262b7ee45a6/scratchpad/vitest-q03.json` (1910 of 1910 passed, 227 files, clone path replaced by `<repo>/storefront`). It was not copied into the worktree because the task did not name that file. The file already in `plans/evidence/Q/vitest.json` has 1879 tests and is older.

## Findings

None of these needed an application fix to pass the gates. None was fixed.

**F1. A clean clone cannot build without environment variables.** `npm run build` with no env stops after 9 s:

```
Error: Failed to collect configuration for /api/account/payment-methods/[id]
  [cause]: Error [EnvError]: Missing environment variable CTP_PROJECT_KEY
      at <unknown> (lib/env.ts:55:23)
      at module evaluation (lib/ct/client.ts:6:13)
Error: Failed to collect page data for /api/account/payment-methods/[id]
```

This matches the spec (the scenario says "a filled `.env.local`"). It is a good fail-fast: the message names the variable only. `storefront/README.md` tells the reader to copy `.env.example` to `.env.local` before `npm run build`.

**F2. `npm run check` fails when `NEXT_PUBLIC_SITE_URL`, `URL` or `DEPLOY_PRIME_URL` is set in the shell.** Two tests in `lib/content/seo.test.ts` read the real process environment through `siteOrigin()` (`lib/content/seo.ts:5`) and expect `http://localhost:3000`:

- line 9, `sitemap lists content pages in both locales` (assertion at line 13)
- line 34, `robots disallows api account cart and checkout and points at the sitemap` (assertion at line 39)

Observed with `NEXT_PUBLIC_SITE_URL` exported: `expected 'https://shop.example.test/sitemap.xml' to be 'http://localhost:3000/sitemap.xml'`. Exporting only `URL` (as Netlify's build does) fails the same two tests. A filled `.env.local` does not trigger it (vitest does not load it into `process.env`), so the scenario "Fresh clone builds" as written passes. A CI job that exports the site URL and then runs `npm run check` would fail. Low severity. A fix would stub the variables in those two tests.

**F3. The version gate has no npm script.** `package.json` has no `check:versions` entry. `npm run check` reaches the gate only through the unit test `Stack and version gates pass on the real repository` (`scripts/check-versions.test.ts:63`), which runs `checkVersions(process.cwd())`. The failure therefore shows as a failed test, not as a named step. The gate checks installed versions in `node_modules` for `react`, `next-intl`, the two commercetools packages and `tailwindcss`. It checks the `package.json` range only for `next`. A range edit for `react` alone is caught by `npm ci` (lockfile mismatch), not by the gate. Details in `bootstrap.md`, Forbidden version.

**F4. `npm ci` warns and audits.** Deprecation warnings: `eslint@9.39.5: This version is no longer supported`, `tsconfck@3.1.6: unmaintained`. `npm audit` (all dependencies): storefront 5 high, seed 6 (3 moderate, 1 high, 2 critical). With `--omit=dev` both report 0, so the findings sit in dev tooling only. For Q-13.

**F5. Cosmetic test output.** Vitest prints that `vite-tsconfig-paths` is no longer needed, and that jsdom was created 227 times (115 s of tracked time). Neither affects the result.

**F6. `next start` does not exit on a bad environment.** See `bootstrap.md`, Missing secret and Wrong project. The build and the env loader do fail with exit code 1.

## What was not done

- No browser test and no live commercetools call (not part of this task).
- A cold-cache `npm ci` timing: the cache was warm.
- No other Node version: only 22.21.1 was available and tested.

## Final run (commit `aca6adcd`, 2026-10-22)

The last code commit of the workstream, cloned with `git clone --no-hardlinks --branch ws/q-quality --single-branch` into a scratch folder outside the worktree, with the same fake build environment as above (names only; nothing from `.env.local`).

| Step | Exit | Time | Result |
| --- | --- | --- | --- |
| `storefront: npm ci` | 0 | 4 s | |
| `storefront: npm run check` | 0 | 28 s | lint, typecheck, 230 test files, 1933 tests, 0 failed |
| `storefront: npm run verify:build` | 0 | 8 s | build, then `bundle scan: ok (checked 9 of 9 secret values)` |
| `storefront: npm run build` (cold) | 0 | 3 s | |
| `storefront: node scripts/check-bundle-secrets.mjs` | 0 | under 1 s | `bundle scan: ok (checked 9 of 9 secret values)` |
| `storefront: npm audit --omit=dev` | 0 | | `found 0 vulnerabilities` |
| `seed: npm ci` | 0 | | |
| `seed: npm run check` | 0 | 4 s | 12 files, 143 passed, 4 todo |
| `seed: npm audit --omit=dev` | 0 | | `found 0 vulnerabilities` |

**This run found one more defect (QFX-44):** with the fake environment loaded, which includes `NEXT_PUBLIC_SITE_URL`, two SEO tests failed at the previous commit (`b1d41659`: 1931 passed, 2 failed) because they assumed the variable was unset. They now set the site origin variables themselves (`aca6adcd`). The earlier statement above, "`npm run check` needs no environment at all", is now true for every shell, not only for an empty one.

`npm ci` prints an advisory summary for the development dependencies (the lint and test toolchains); `npm audit --omit=dev` is clean. See `npm-audit.txt` section 3.
