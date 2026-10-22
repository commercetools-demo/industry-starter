<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Bootstrap scenarios (Q-03)

Spec: `openspec/specs/bootstrap-and-structure/spec.md`. Every proof ran in a scratch clone of `ws/q-quality` at commit `22ea28d6` (outside the worktree). Every edit was made in the clone only and undone afterwards (`git checkout --`, `npm ci`), so the clone was clean again after each step. Shell values were fake. No real network call was possible. Versions and durations are in `clean-clone.md`.

| Scenario (ledger title) | Result |
| --- | --- |
| Fresh clone builds | pass (`clean-clone.md`) |
| Forbidden version | pass: `next` 15, `react` 18 and `next-intl` 3 each fail the gate with its message |
| Scaffold evidence | pass: 7 tracked files in `plans/evidence/A/` (the health response is the 502 shape, blocked by OA-01) |
| Missing secret | pass with a note: the message names the variable only; `next start` stays up and answers 500 (S1) |
| Client bundle scan | pass: clean build passes; a planted fake secret is found |
| Wrong project | pass with the same note (S1): both keys named, zero connections to the fake endpoint |
| Stored URL with a query | pass: unit tests and a direct call; no recorded image file exists yet (OA-03) |
| Deploy gate | pass: fails and lists exactly what to remove; passes once removed (scratch only) |
| Server import in a client file | pass: lint fails with the boundary rule; the build fails too when the import is used |

## Fresh clone builds

Given a clean checkout, Node 22 and the environment. When `npm ci && npm run check && npm run build` runs. Then all four steps pass.

Commands and numbers: see `clean-clone.md`. At `22ea28d6`: `npm ci` 0, `npm run check` 0 (227 files, 1908 tests), `npm run build` 0, `npm run verify:build` 0. At `48f0ad13`: 1910 tests, the rest the same. Result: pass.

## Forbidden version

Rule (`storefront/scripts/check-versions.mjs`): `next`, `next-intl`, `@commercetools/platform-sdk`, `@commercetools/ts-client`, `react` and `tailwindcss` must be installed at the stated major, `next` must be above 16.0.0, `next` in `package.json` must not start with 15, there must be no `tailwind.config.*`, and `.nvmrc` must start with 22.

How `npm run check` reaches it: `check` is `lint && typecheck && test`. There is no separate script. The gate runs inside `npm test` as the test `Stack and version gates pass on the real repository` (`scripts/check-versions.test.ts:63`). I also ran the script directly each time (`node scripts/check-versions.mjs`).

Baseline on the clean clone: `version gate: ok`.

### next 15, package.json range only

Change (clone only): `npm pkg set dependencies.next='^15.5.28'`. Diff: `-    "next": "^16.4.2",` and `+    "next": "^15.5.28",`.

```
$ node scripts/check-versions.mjs
version gate: package.json next range "^15.5.28" starts with 15, the rule is next 16.x (bootstrap-and-structure: Stack and version gates)
exit=1

$ npm run check          (lint and typecheck pass, then the test run fails)
 FAIL  scripts/check-versions.test.ts > version gate > Stack and version gates pass on the real repository
+   "package.json next range \"^15.5.28\" starts with 15, the rule is next 16.x (bootstrap-and-structure: Stack and version gates)",
 Test Files  1 failed | 226 passed (227)
      Tests  1 failed | 1907 passed (1908)
exit=1
```

`npm ci` also refuses this edit before touching `node_modules`: `Invalid: lock file's next@16.4.2 does not satisfy next@15.5.28`.

Result: pass. Restored with `git checkout -- package.json`.

### next 15, really installed

Change (clone only): `npm install --no-save next@15.5.28`, then restored with `npm ci`.

```
$ node scripts/check-versions.mjs
version gate: next 15.5.28 installed, the rule is next major 16 (bootstrap-and-structure: Stack and version gates)
exit=1

$ npm run check
 FAIL  scripts/check-versions.test.ts > version gate > Stack and version gates pass on the real repository
+   "next 15.5.28 installed, the rule is next major 16 (bootstrap-and-structure: Stack and version gates)",
 Test Files  1 failed | 226 passed (227)
      Tests  1 failed | 1907 passed (1908)
exit=1
```

Lint and typecheck still pass with `next` 15 installed. Only the gate catches it. Result: pass.

### react 18, really installed

Change (clone only): `npm install --no-save react@18.3.1 react-dom@18.3.1`, then restored with `npm ci`. An edit of the `react` line in `package.json` alone (`npm pkg set dependencies.react=18.3.1`) is not seen by the gate (it checks the installed version for `react`: `version gate: ok`), but `npm ci` rejects it: `Invalid: lock file's react@19.2.4 does not satisfy react@18.3.1`.

```
$ node scripts/check-versions.mjs
version gate: react 18.3.1 installed, the rule is react major 19 (bootstrap-and-structure: Stack and version gates)
exit=1

$ npm run check
 FAIL  scripts/check-versions.test.ts > version gate > Stack and version gates pass on the real repository
+   "react 18.3.1 installed, the rule is react major 19 (bootstrap-and-structure: Stack and version gates)",
 Test Files  6 failed | 221 passed (227)
      Tests  5 failed | 1901 passed (1906)
exit=1
```

Four other tests fail too, and one more test file cannot load (`lib/listing/page-data-metadata.test.ts`: `cache is not a function`), because the app needs React 19. The version rule is in the output. Result: pass.

### next-intl 3, really installed (spec wording: "next-intl below 4")

Change (clone only): `npm install --no-save --force next-intl@3.26.5` (plain install refuses: `peer next@"^10 ... ^15"` does not accept `next` 16). Restored with `npm ci`.

```
$ node scripts/check-versions.mjs
version gate: next-intl 3.26.5 installed, the rule is next-intl major 4 (bootstrap-and-structure: Stack and version gates)
exit=1
```

Result: pass. After restore: `version gate: ok`.

Unit tests of the gate (fixtures for `next` 15.1.0, `next-intl` 3, platform-sdk 9, missing `.nvmrc`, `next` 16.0.0) also pass: `scripts/check-versions.test.ts`, 7 tests.

## Scaffold evidence

Given workstream A has finished. When a reviewer reads `plans/evidence/A/`. Then it shows the command output, the dependency versions and the health check response.

In the clean clone, all seven files exist and are tracked by git:

| File | Shows |
| --- | --- |
| `plans/evidence/A/README.md` | what each file proves |
| `plans/evidence/A/command-output.txt` | what `/commercetools:nextjs-setup-project` did (folder renamed to `storefront`, `vercel.json` not written) |
| `plans/evidence/A/versions.txt` | `next@16.4.2`, `next-intl@4.14.9`, `platform-sdk@8.27.0`, `ts-client@4.10.0`, `react@19.2.4`, `tailwindcss@4.3.3` |
| `plans/evidence/A/health.json` | the health response: status 502, `upstream_unavailable` (blocked: OA-01, no credentials; the live 200 is OA-A-c) |
| `plans/evidence/A/startup-guard.txt` | `SESSION_SECRET=short` and a wrong `EXPECTED_PROJECT_KEY` stop `npm run dev` |
| `plans/evidence/A/build-tail.txt` | tail of `npm run verify:build` |
| `plans/evidence/A/fresh-clone.txt` | last lines of `npm ci && npm run check && npm run build` |

Deployment files in the clone: `b2c-foodservice/netlify.toml` exists (`base = "storefront"`, `NODE_VERSION = "22"`). No `vercel.json` exists in `b2c-foodservice/` or `storefront/`, and `git ls-files` lists no file with `vercel` in its name under `b2c-foodservice/`.

Two small notes on A's old files. `health.json` is the failure shape, not a 200 (known and blocked). `command-output.txt` still says `next 16.2.6` and lists `messages/{en-US,en-GB,de-DE}.json`; those are the scaffold's first-run values, and `versions.txt` has the final versions. Result: pass.

## Missing secret

Given `SESSION_SECRET` missing or shorter than 32 characters. When the server starts. Then it fails fast with a message naming the variable, not its value.

Where the check lives: `lib/env.ts` (`parseEnv`, called by `getEnv`). It is called at start by `instrumentation.ts` and at module load by `lib/ct/client.ts:6`.

### The built app, SESSION_SECRET unset

Command: all other fake variables set, `SESSION_SECRET` unset, `node node_modules/next/dist/bin/next start -p 3301` (stopped by PID afterwards).

```
Ready in 69ms
Failed to prepare server Error [EnvError]: An error occurred while loading instrumentation hook: Missing environment variable SESSION_SECRET
  variable: 'SESSION_SECRET'
Failed to preload entries: Error [EnvError]: ... Missing environment variable SESSION_SECRET

GET /en-US     -> 500  (body: "Internal Server Error")
GET /api/health -> 500
GET /robots.txt -> 500
```

### The built app, SESSION_SECRET too short

Command: `SESSION_SECRET=too-short-fake` (a made-up 14 character value), `next start -p 3304`.

```
Failed to prepare server Error [EnvError]: An error occurred while loading instrumentation hook: SESSION_SECRET must be at least 32 characters
  variable: 'SESSION_SECRET'
GET /en-US      -> 500
GET /api/health -> 500
```

The value `too-short-fake` appears 0 times in the log. None of the fake secret values appeared in any start log (checked by `grep -c`, 0 each).

### The env loader called directly (exit code)

Command: the real `lib/env.ts` loaded with Node (`node --conditions react-server probe.mjs file://.../lib/env.ts`, which calls `parseEnv(process.env)` and exits 1 on error).

```
SESSION_SECRET unset:   EnvError variable=SESSION_SECRET message="Missing environment variable SESSION_SECRET"   exit=1
SESSION_SECRET=too-short-fake:   EnvError variable=SESSION_SECRET message="SESSION_SECRET must be at least 32 characters"   exit=1
all variables valid:    env ok   exit=0
```

### The build with no environment

`npm run build` stops (exit 1) with `Missing environment variable CTP_PROJECT_KEY` and the variable name only (see `clean-clone.md`, F1).

### Result: pass, with one surprise

**S1.** The message names the variable and never a value. But `next start` does not exit. It prints "Ready", then the error, stays listening, and answers every request with a plain 500 (`Internal Server Error`). No page is rendered. It is fail-fast in the sense that nothing is served, not in the sense of a process exit. The build and the loader do exit with 1. On Netlify the hosting runtime starts the app, so the same 500 would be seen there; this was not tested. If an exit is wanted, the register hook in `instrumentation.ts` could call `process.exit(1)` in production. Not changed.

## Client bundle scan

Given a production build. When the build output is searched for the client secret value. Then it is not present.

The scan: `storefront/scripts/check-bundle-secrets.mjs`. It reads the values of nine secret names from the environment (`CTP_CLIENT_SECRET`, `CTP_CLIENT_ID`, `SESSION_SECRET`, `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, `DEMO_LOGIN_PASSWORD`, `CONTACT_WEBHOOK_URL`, `CONTACT_WEBHOOK_TOKEN`, `FEEDBACK_WEBHOOK_URL`; the list is kept equal to `.env.example` by a test) and searches `.next/static/**` and `.next/server/app/**/*.html`. Ignored values: shorter than 8 characters or unset.

### Clean build

```
$ rm -rf .next && npm run build      (fake env in the shell)     exit=0
$ node scripts/check-bundle-secrets.mjs
bundle scan: ok (checked 9 of 9 secret values)
exit=0
```

### Planted fake secret

Change (clone only), in `components/layout/LocalePill.tsx` (a `'use client'` component in the site header): one added attribute on the `<button>`, whose value is the fake `CTP_CLIENT_SECRET` from the shell.

```
+      data-planted="dummy-not-a-secret"
```

```
$ rm -rf .next && npm run build         exit=0
$ node scripts/check-bundle-secrets.mjs
bundle scan: CTP_CLIENT_SECRET value found in client output .next/static/chunks/1curk2pcjx_qw.js
exit=1
```

The message names the variable and the file, not the value. After `git checkout -- components/layout/LocalePill.tsx`, a rebuild and the scan give `bundle scan: ok (checked 9 of 9 secret values)` again. Result: pass.

Note for Q-10: the scan covers `.next/static` and prerendered `.html` only. This app's pages are all dynamic, so no page HTML is scanned; only the static chunks are.

## Wrong project

Given `CTP_PROJECT_KEY` differs from `EXPECTED_PROJECT_KEY`. When the server starts. Then it stops with a message naming both keys.

Setup: `CTP_AUTH_URL` and `CTP_API_URL` pointed at `https://127.0.0.1:3399`. A small fake endpoint (my own script, stopped by PID afterwards) counted every TCP connection and never answered. A control run proves the counter works.

Command: `CTP_PROJECT_KEY=fake-project EXPECTED_PROJECT_KEY=other-project next start -p 3302`

```
connections to the fake endpoint before: 0
Ready in 67ms
Failed to prepare server Error [EnvError]: An error occurred while loading instrumentation hook:
  Wrong commercetools project: CTP_PROJECT_KEY="fake-project" but EXPECTED_PROJECT_KEY="other-project"
  variable: 'CTP_PROJECT_KEY'
GET /en-US      -> 500
GET /api/health -> 500
connections to the fake endpoint after: 0
```

Control (keys equal, `next start -p 3303`): `GET /en-US -> 200`, `GET /api/health -> 502`, and the counter went from 0 to 13. So the counter sees real attempts, and the wrong-project run made none.

The env loader (`lib/env.ts`) throws this error before `lib/ct/client.ts` builds the client, so no token request can be made. Project keys are not secrets, so naming both is allowed. The same message appears in A's `startup-guard.txt` for `npm run dev`.

Result: pass. The same surprise as S1 applies: the process stays up and answers 500.

## Stored URL with a query

Given an image URL carrying `?auto=compress&w=750`. When it is written to commercetools. Then only the part before `?` is stored.

Where: `seed/src/images.ts` `cleanUrl()` (removes the query and the fragment) and `storefront/lib/ct/image-config.ts` `cleanImageUrl()`. `seed/src/verify.ts:52` reports any stored image URL that is not clean.

```
$ cd seed && npx tsx -e "import { cleanUrl } from './src/images'; console.log(cleanUrl('https://img.example.test/p/1.jpeg?auto=compress&w=750'))"
https://img.example.test/p/1.jpeg
```

Tests (all pass): `seed/src/images.test.ts` `Images > URL with query`; `seed/src/lib.test.ts` `isCleanUrl accepts scheme, host and path only`; `seed/src/verify.test.ts` (unclean image URL reported); `storefront/lib/ct/image-config.test.ts` (6 tests, including `cleanImageUrl removes query and fragment` and `mapImages stores and returns the clean URL even if the source has a query`).

Limit: `seed/src/data/images.json` (the recorded photos) does not exist yet (OA-03, the image source), so no recorded file could be checked for dirty URLs. Result: pass on code and tests.

## Deploy gate

Given the pre-deploy check runs. When `app/api/health/route.ts` exists. Then the check fails.

Command: `npm run predeploy` (`node scripts/predeploy-check.mjs`) in the clone with fake env in the shell. The clone is a git checkout, so the tracked-file check ran too.

```
$ npm run predeploy
predeploy: Remove app/api/health/route.ts before deploying
predeploy: Remove app/api/dev before deploying
predeploy: Remove app/[locale]/dev (the design kitchen sink) before deploying
exit=1
```

Nothing else was reported: environment, scopes, project keys, `.nvmrc` and tracked env files were all fine.

Then, in the clone only (scratch, restored with `git checkout -- .`):

```
$ rm app/api/health/route.ts
$ npm run predeploy
predeploy: Remove app/api/dev before deploying
predeploy: Remove app/[locale]/dev (the design kitchen sink) before deploying

$ rm -r app/api/dev "app/[locale]/dev"
$ npm run predeploy
predeploy: ok                                          exit=0
```

Two extra checks with the routes removed: a `SESSION_SECRET` starting with `dummy` gives `predeploy: SESSION_SECRET looks like a sample value`, and a different `EXPECTED_PROJECT_KEY` gives `predeploy: EXPECTED_PROJECT_KEY (other-project) does not equal CTP_PROJECT_KEY (fake-project)`. With no environment at all it lists each of the ten required variable names as `... is not set`. No value is ever printed.

For the lead: the real release will fail this gate until `app/api/health`, `app/api/dev` and `app/[locale]/dev` are deleted (Q-15). Nothing was deleted in the worktree. Result: pass.

## Server import in a client file

Given a `'use client'` file imports `lib/ct/cart`. When lint runs. Then it fails with the boundary rule.

The rule: `local/no-server-in-client` (`storefront/eslint/rules/no-server-in-client.mjs`, wired in `eslint.config.mjs`). Real server module used: `lib/ct/cart.ts`.

Change (clone only), in `components/layout/LocalePill.tsx` (already `'use client'`): one added line, `import { getCartForSession } from '@/lib/ct/cart';`.

```
$ npm run lint
components/layout/LocalePill.tsx
  7:1   error    BFF boundary: a 'use client' file must not import '@/lib/ct/cart'. Call a Route Handler through an SWR hook and take types from lib/types.ts  local/no-server-in-client
  7:10  warning  'getCartForSession' is defined but never used  @typescript-eslint/no-unused-vars
2 problems (1 error, 1 warning)
exit=1
```

With the import also used (`void getCartForSession;`), lint reports the same one error, and `npm run build` fails as well (exit 1): `Error: Turbopack build failed with 35 errors`, first error `./lib/session.ts:2:1 ... You're importing a module that depends on "next/headers"`. So there is a second guard (`server-only`). With the import unused, the build passes (the import is dropped), so lint is the only guard in that case.

The other lint rules of the spec's Quality gates requirement, planted in the same file and then restored:

```
4:1   error  'next/link' import is restricted from being used. Use Link from '@/i18n/routing' so links keep the locale prefix   no-restricted-imports
5:1   error  BFF boundary: a 'use client' file must not import '@commercetools/ts-client'. ...                                 local/no-server-in-client
5:1   error  '@commercetools/ts-client' import is restricted ... No @commercetools/* import outside lib/ct and lib/mappers     no-restricted-imports
16:18 error  Unexpected any. Specify a different type                                                                          @typescript-eslint/no-explicit-any
16:39 error  No raw hex colours in components; use design tokens                                                                 no-restricted-syntax
5 problems (5 errors, 0 warnings)
```

After `git checkout -- components/layout/LocalePill.tsx`, `npm run lint` exits 0. Result: pass.

## Scratch state

- Clone: `/private/tmp/claude-501/-Users-behnam-code-commercetools-labs-industry-starter-b2c-foodservice/aceb131f-558d-44f4-9e90-2262b7ee45a6/scratchpad/clean-clone` (clean `git status`, at `48f0ad13`, `node_modules` kept; the lead removes it).
- Servers started (ports 3301 to 3304 and the counter on 3399) were all stopped by PID. Nothing listens on those ports.
- Nothing in the worktree was changed except `clean-clone.md` and this file.
