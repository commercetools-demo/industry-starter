# Y — Netlify deployment

**Specs:** `storefront-project-bootstrap` — deploy section only (Components row "Deploy config": `netlify.toml` at the repository root, build scoped to `site/`, Node 22); all of its scenarios are owned by A, and no scenario of it is repeated here
**Depends on:** I–X · **Unblocks:** Z · **Decisions:** D-002, D-003, D-004, D-033, D-041, D-059
**Owner prerequisites:** OA-06 (Netlify site and env vars), OA-05 (Netlify URL in the Checkout allowed origins) · **Skill refs:** none (hosting only; the `commercetools:nextjs-deploy-netlify` skill may be used by the owner for the first deploy but is not required)

## Goal
A production build of `site/` deploys on Netlify from the repository with env vars set in the Netlify UI (names only here), carries the security headers, and passes a scripted pre-release check locally and a Chrome smoke test on the staging URL.

## Design

### Where the files live
The git repository root is the parent monorepo (`industry-starter/`); this project is the folder `b2c-telecom/`. In this plan, "repository root" means **`b2c-telecom/`** (the folder holding `design/`, `openspec/`, `plan/`, `site/`), the same convention as the other workstreams. All paths below are relative to it.

| File | Owner | Purpose |
| --- | --- | --- |
| `netlify.toml` | Y | Build config (template below), compared byte-for-byte (ignoring blank lines and spacing) by `check-release` |
| `site/config/security-headers.json` | Y | Single source of the security headers; imported by `next.config.ts` and mirrored in `netlify.toml` |
| `site/next.config.ts` | A (Y appends the `headers()` entry) | `headers()` returns the JSON headers for `source: '/:path*'` |
| `site/scripts/check-release.mjs`, `check-release.d.mts`, `check-release.test.ts` | Y | Pre-release checks (port of `../b2c-grocery/site/scripts/check-release.mjs`) |
| `site/package.json` scripts `build:netlify`, `check:release`, `verify:release` | Y (appends) | See below |
| `site/README.md` section "Deploying to Netlify" | Y | Steps, env var names, rollback |

### `netlify.toml` (exact template; `NETLIFY_TEMPLATE` in `check-release.mjs` holds the same text)
```toml
[build]
  base    = "site"
  command = "npm run build:netlify"
  publish = ".next"
  ignore  = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- . ../design ../plan ../openspec"

[build.environment]
  NODE_VERSION = "22"
  NEXT_TELEMETRY_DISABLED = "1"
  SECRETS_SCAN_OMIT_KEYS = "CTP_PROJECT_KEY,CTP_AUTH_URL,CTP_API_URL,CTP_SCOPES,CTP_CHECKOUT_APP_KEY,SITE_URL"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```
Notes:
- `base = "site"` is resolved by Netlify relative to the repository that Netlify builds. **Planner default for the monorepo case** (Netlify builds `industry-starter/`, not `b2c-telecom/`): the owner sets the Netlify UI "Package directory" to `b2c-telecom` (Netlify reads `netlify.toml` from the package directory) and leaves the UI base directory empty. If the first build log shows that `site/` or `package.json` was not found, do **not** improvise: record the log (no values) in `plan/QUESTIONS.md` and apply the **pre-approved fallback**: move the file to `site/netlify.toml`, delete the `base` line, set the UI Package directory to `b2c-telecom/site`, and change `NETLIFY_TEMPLATE`, its test and the path rule in `check-release.mjs` to match (one commit). When this project is extracted to its own repository, the template works unchanged with no UI directories.
- `[[plugins]]` declares the Netlify Next.js runtime explicitly (it is also applied automatically for Next 16); declaring it makes the plugin version visible in build logs. Docs: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/ . Do not add any other plugin without asking.
- `SECRETS_SCAN_OMIT_KEYS` lists only **non-secret** variable names, because Netlify's secrets scanner fails a build when a variable value appears in build output or static files, and values such as the project key legitimately appear in image URLs and logs. `CTP_CLIENT_SECRET` and `SESSION_SECRET` must **never** be in this list (a test enforces it).
- `ignore` skips a deploy when only `design/`, `plan/` or `openspec/` changed (paths relative to `site/`, same pattern as the grocery project).
- Security headers: Netlify `[[headers]]` apply to static assets, while pages served by the Next.js runtime take their headers from `next.config.ts`, so the **same five headers are defined in both**, sourced from `site/config/security-headers.json`, and a test fails if the two differ. **Planner default:** no `Content-Security-Policy` in v1 (the hosted Checkout, Adyen and Pexels images make a policy risky to ship untested; parked in `plan/IDEAS.md` as "CSP"). `X-Frame-Options: DENY` is safe because the storefront is never framed (the Checkout iframe is embedded by us, not the other way round).
- No `vercel.json` anywhere (D-002).

`site/config/security-headers.json`:
```json
[
  { "key": "X-Content-Type-Options", "value": "nosniff" },
  { "key": "X-Frame-Options", "value": "DENY" },
  { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
  { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
  { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
]
```
`next.config.ts` addition (append to the existing `headers()` array if one exists, otherwise create it): `{ source: '/:path*', headers: securityHeaders }` with `import securityHeaders from './config/security-headers.json'` (requires `"resolveJsonModule": true`, already set by the Next.js scaffold).

### Build command
`site/package.json` (append; keep every existing script):
```json
"build:netlify": "npm run check:lockfile && npm run check:secrets && npm run build && npm run check:bundle",
"check:release": "node scripts/check-release.mjs",
"verify:release": "npm run verify && npm run check:release"
```
`build:netlify` is the **cheap subset of `npm run verify`**: lockfile check, secrets check, production build (which also runs the environment validation owned by E and fails naming a missing variable), and the bundle-secret scan. Lint, typecheck, token lint and unit tests are **not** run on Netlify; they run locally through `npm run verify:release` before a release branch is pushed (D-003: no CI). The script names `check:lockfile` (A), `check:secrets` and `check:bundle` (E) must exist in `package.json`; run `npm run` and confirm before Y-03. If one is missing or named differently, stop and ask (`plan/QUESTIONS.md`); do not rename other workstreams' scripts.

### Environment variables (names only; values live only in the Netlify UI; the owner sets them, OA-06)
| Variable | Required | Scope in Netlify | Note |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | yes | Builds, Functions, Runtime | `spec-test-b2c-telecom` (D-001) |
| `CTP_AUTH_URL` | yes | same | region `us-central1.gcp` URL |
| `CTP_API_URL` | yes | same | region `us-central1.gcp` URL |
| `CTP_CLIENT_ID` | yes | same | the **storefront** API client from OA-02 (never the seed client) |
| `CTP_CLIENT_SECRET` | yes | same, **"Contains secret values"** on | storefront client secret |
| `CTP_SCOPES` | yes | same | storefront scopes from OA-02 |
| `CTP_CHECKOUT_APP_KEY` | yes | same | from OA-05 |
| `SESSION_SECRET` | yes | same, **"Contains secret values"** on | at least 32 random characters, different from local |
| `DEMO_SHOW_RESET_LINK` | optional | same | **Planner default:** `true` on the demo/staging site because no email exists (D-033, D-031); unset or `false` shows only the generic message |
| `SERVICEABILITY_STUB` | optional | same | leave unset (stub is the default, D-020) unless a workstream K file says otherwise |
| `SITE_URL` | optional | same | forces the canonical origin (used by W for canonical links and JSON-LD); when unset W uses Netlify's own `URL` |

**Never** set in Netlify: `CTP_SEED_CLIENT_ID`, `CTP_SEED_CLIENT_SECRET`, `CTP_SEED_SCOPES`, `PEXELS_API_KEY` (seed-only, `site/.env.seed`; D-054, spec `storefront-project-bootstrap`: the seeding credential is never configured for `site/`). No variable name may start with `NEXT_PUBLIC_` and contain `SECRET`, `KEY` or `TOKEN` (E's check; Y adds the `.env.example` rule below).

### `scripts/check-release.mjs` (port of the grocery script; exports `NETLIFY_TEMPLATE` and `checkRelease(siteDir): string[]`)
`checkRelease(rootDir)` takes `site/`; the repository root is `path.resolve(rootDir, '..')`. It returns a list of problems (empty = releasable); the CLI prints them as `Release check failed:\n…` and exits 1. Rules and **exact messages** (tests assert these strings):

| # | Rule | Message |
| --- | --- | --- |
| 1 | `<repo>/netlify.toml` exists | `netlify.toml is missing at the repository root` |
| 2 | its normalized text equals `NETLIFY_TEMPLATE` normalized (trim, collapse spaces, drop blank lines, `\r\n` → `\n`) | `netlify.toml does not match the template (base site, command npm run build:netlify, Node 22, plugin, headers)` |
| 3 | no `vercel.json` in `<repo>` or `site/` | `vercel.json must not exist (hosting is Netlify, D-002)` |
| 4 | `git ls-files --cached` (run in `<repo>`, skipped outside a checkout) lists no `.env*` file other than `.env.example`, and not `.envrc` | `<file>: environment files must not be tracked` |
| 5 | `site/.env.example` exists and contains each of the eight required names (`CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `CTP_CHECKOUT_APP_KEY`, `SESSION_SECRET`) as `NAME=` with an empty value | `.env.example must list <NAME> with an empty value` |
| 6 | every header in `site/config/security-headers.json` appears in the toml as `key = "value"` under `[headers.values]` | `netlify.toml is missing security header <key>` |
| 7 | the toml's `SECRETS_SCAN_OMIT_KEYS` does not contain `CTP_CLIENT_SECRET` or `SESSION_SECRET` | `SECRETS_SCAN_OMIT_KEYS must not include <NAME>` |
| 8 | `package.json` `scripts['build:netlify']` equals the exact string above | `package.json build:netlify does not match the release template` |
| 9 | every source file (`.ts .tsx .js .jsx .mjs`, not tests) under a `dev` directory of `app/`, and under `app/api/health/`, contains the literal comparison `NODE_ENV (===|!==|==|!=) 'development'` **and** a `notFound(` call | `<path>: dev-only route lacks the NODE_ENV === 'development' guard that calls notFound()` |

Rule 9 (**Planner default**): the architecture keeps `/api/health` as a development-only route (owner E); the grocery rule "route must not exist" would contradict that, so the route may stay only if it is guarded and returns the 404 page outside development. The staging check C-Y-4 proves the deployed behaviour (HTTP 404).

### Rollback and release procedure (documented in the README section)
1. `cd site && npm run verify:release` must pass.
2. Push the release branch; Netlify builds it (`npm run build:netlify`).
3. Run the Chrome smoke checks C-Y-* on the deploy URL.
4. Rollback: Netlify UI → Deploys → pick the previous successful deploy → "Publish deploy". No code change is needed.

### Pitfalls
- `.next` left over from an earlier build can make `tsc` fail after a route is deleted; `rm -rf .next` before `verify:release` if typecheck complains about missing generated types.
- Netlify caches `node_modules`; a lockfile that is out of sync fails `check:lockfile` first (good) instead of failing at install.
- The Netlify site must use Node 22 through `NODE_VERSION`; the UI default is older.
- Changing an env var in the Netlify UI does not rebuild: trigger "Clear cache and deploy site".
- The secrets scanner prints the **name** of the offending variable; fix by removing the leak, never by adding a secret to `SECRETS_SCAN_OMIT_KEYS`.
- `check:bundle` runs after `next build`, so it needs `.next`; do not reorder `build:netlify`.
- The Checkout allowed origins must contain the exact Netlify origin (scheme plus host, no trailing slash) before any checkout check; otherwise the hosted checkout refuses to load (OA-05).
- Deploy previews get their own URLs; add each one you want to test to the allowed origins, or test only on the main staging URL.

## Tasks
- [x] Y-01 Create `site/config/security-headers.json`, append the `headers()` entry to `site/next.config.ts`; test `site/config/security-headers.test.ts` (JSON is an array of the five `{ key, value }` pairs; `await nextConfig.headers()` contains `{ source: '/:path*' }` with exactly those headers; no header value contains a newline).
- [x] Y-02 Write `netlify.toml` (exact template above) at the repository root and ensure no `vercel.json` exists; test `site/scripts/netlify-config.test.ts` (parses the file with a small line-based reader and asserts `base = "site"`, `command = "npm run build:netlify"`, `publish = ".next"`, `NODE_VERSION = "22"`, the plugin package, the five headers equal to `config/security-headers.json`, and that the omit list contains neither secret name).
- [x] Y-03 Port `scripts/check-release.mjs` (+ `check-release.d.mts` with `export const NETLIFY_TEMPLATE: string; export function checkRelease(rootDir: string): string[];`) with rules 1–9, add the three package scripts, write `scripts/check-release.test.ts` (`// @vitest-environment node`, builds a throwaway repository in `os.tmpdir()` like the grocery test; one test per rule for pass and fail, exact messages; the unguarded `app/api/health` fails, the guarded one passes; `app/api/devices/route.ts` is not a dev route; `.env.local` tracked fails (use a temporary `git init`), `.env.example` passes).
- [x] Y-04 Run `cd site && npm run verify:release` and fix every finding (only in Y's own files; for a finding in another workstream's code write a `plan/QUESTIONS.md` entry). Run `npx netlify-cli build` is **not** required.
- [x] Y-05 Add section "Deploying to Netlify" to `site/README.md` (create the file if A has not): prerequisites (OA-06, OA-05), the Netlify UI settings (Package directory `b2c-telecom`, build command and publish directory come from `netlify.toml`), the env var table (names only, copy from Design), the release procedure and rollback; no values.
- [x] Y-06 Report the checks below (C-Y-1…C-Y-12, M-Y-1…M-Y-4), set STATUS `Ready for review`, ask the owner to perform M-Y-1 and M-Y-2.
- [ ] Y-07 After the owner reports the deploy URL (non-secret), record it in `site/README.md` under "Deploying to Netlify" as `Staging: https://<site>.netlify.app`; Claude then runs C-Y-1…C-Y-12 against it. (Stays open until the owner reports the URL.)

## Unit tests (scenario → test)
`storefront-project-bootstrap` scenarios: owned by A (not repeated here). The deploy-related behaviours tested by Y are plan-level checks, not spec scenarios:

| Check | Test (file → `it(...)`) |
| --- | --- |
| Netlify build config matches the template | `scripts/netlify-config.test.ts` → "netlify.toml has base site, command build:netlify, publish .next and Node 22" |
| Security headers identical in toml and Next config | `scripts/netlify-config.test.ts` → "toml headers equal config/security-headers.json"; `config/security-headers.test.ts` → "next.config headers() serves the five security headers" |
| Secret names never exempt from scanning | `scripts/netlify-config.test.ts` → "SECRETS_SCAN_OMIT_KEYS excludes CTP_CLIENT_SECRET and SESSION_SECRET" |
| Release check rules 1–9 | `scripts/check-release.test.ts` → one `it` per rule, titled "rule <n>: <message>" |
| No Vercel config | `scripts/check-release.test.ts` → "rule 3: vercel.json must not exist" |
| Dev-only routes guarded | `scripts/check-release.test.ts` → "rule 9: unguarded app/api/health fails, guarded passes" |

## Chrome verification (run by Claude)
`<staging>` is the Netlify URL the owner reports (Y-07), `https://<site>.netlify.app`. Console clean and no failed requests in every check unless stated.
- C-Y-1 (needs OA-06): `<staging>/` → HTTP 200 after a redirect to `<staging>/en-US` (navigate and read the final URL and the `list_network_requests` redirect entry); the home page renders header, hero and footer.
- C-Y-2 (needs OA-06, OA-02): on `<staging>/en-US` click the header "Cable internet" → a listing with real offers and USD prices from the project (for example "$" amounts, not placeholders); add one plan to My bundle; open `<staging>/en-US/bundle` → the plan line and a non-zero monthly total in USD.
- C-Y-3 (needs OA-06, OA-02): switch the market to Germany (language/region switch) → `<staging>/de-DE` shows German UI and EUR prices; `<staging>/de-DE/shop/<cable slug>` lists the same offers with EUR prices.
- C-Y-4 (needs OA-06): `fetch('<staging>/api/health')` from the page → status 404; `<staging>/en-US/nope` → the branded not-found page with HTTP 404; `<staging>/xx` → 404.
- C-Y-5 (needs OA-06): `evaluate_script(() => fetch('/en-US').then(r => Object.fromEntries(['x-content-type-options','x-frame-options','referrer-policy','permissions-policy','strict-transport-security'].map(h => [h, r.headers.get(h)]))))` → the five values equal `site/config/security-headers.json`; repeat for `/_next/static/` asset URL taken from the page (static asset headers come from `netlify.toml`) → same five values.
- C-Y-6 (needs OA-06): list every script URL on the page, fetch each and search for the strings `CTP_CLIENT_SECRET`, `SESSION_SECRET`, `client_secret`, `Basic ` followed by base64, and the project's secret prefix pattern → none found; `list_network_requests` shows no request from the browser to a `commercetools.com` host (all commerce calls are server-side) and the session cookie is `HttpOnly; Secure; SameSite=Lax` (read via the network panel's response headers on `/api/auth/login`, or the cookie list).
- C-Y-7 (needs OA-06, W): `<staging>/en-US/about`, `/en-US/faq`, `/en-US/support`, `/en-US/blog`, `/en-US/blog/cable-or-home-wireless`, `/en-US/legal/terms`, `/en-US/legal/image-credits`, `/de-DE/legal/privacy` → all HTTP 200 with their content (proves the `content/**` files are bundled into the functions); `<link rel="canonical">` on the blog article starts with `<staging>` (or the owner's `SITE_URL`).
- C-Y-8 (needs OA-06, DEMO flag): `<staging>/en-US/forgot-password`, submit a registered email → with `DEMO_SHOW_RESET_LINK=true` a "demo mode: email delivery disabled" banner and the reset link appear (D-033); with the flag unset only the generic message appears.
- C-Y-9 (needs OA-06, OA-05, OA-02): on `<staging>`, sign in with a seeded demo customer, add a plan, open `/en-US/bundle/checkout`, complete the steps and pay with the Adyen test card (card number `4111 1111 1111 1111`, expiry `03/30`, CVC `737`, any holder name) → the order confirmation page with an order number; Merchant Center shows the order (Claude reads it with `read_orders`).
- C-Y-10 (needs OA-06): Lighthouse mobile on `<staging>/en-US` and `<staging>/en-US/shop/<cable slug>` → accessibility ≥ 90, best practices ≥ 90, SEO ≥ 90 (performance is recorded, not gated).
- C-Y-11 (needs OA-06): resize to 375 px and open `<staging>/en-US` and `/en-US/bundle` → the drawer navigation works, no horizontal scroll, bundle pill visible.
- C-Y-12 (needs OA-06): open `<staging>/en-US/bundle` in two browser contexts (normal and a second new page with cleared cookies) → each shows its own empty or own bundle; no shared cart between sessions.

## Manual tests (owner only)
- M-Y-1 (needs OA-06): 1. In Netlify create the site from this repository (Package directory `b2c-telecom`, see Design). 2. In Site configuration, Environment variables, set the eight required variables from the table (values from your `site/.env.local`; `SESSION_SECRET` is a new 32+ character random value, not the local one; tick "Contains secret values" for `CTP_CLIENT_SECRET` and `SESSION_SECRET`), plus `DEMO_SHOW_RESET_LINK=true`. 3. Deploy the release branch → the build succeeds and the deploy is published; give Claude the site URL. If it fails, paste the log without values into `plan/QUESTIONS.md`.
- M-Y-2 (needs OA-05): In Merchant Center, Checkout, add the Netlify origin (for example `https://<site>.netlify.app`, no trailing slash) to the application's allowed origins → the hosted checkout loads on the deployed site (Claude verifies in C-Y-9).
- M-Y-3 (needs OA-06): In a branch deploy or deploy preview delete one required variable (for example `CTP_SCOPES`) and deploy → the Netlify build fails and the log names `CTP_SCOPES` without printing any value; restore the variable and redeploy.
- M-Y-4 (needs OA-06): In Netlify, Deploys, pick the previous successful deploy and "Publish deploy" → the earlier version is live (reload the site); then publish the latest deploy again.

## Excluded
- Every `storefront-project-bootstrap` scenario: owned by A, not repeated.
- Vercel config: D-002 (hosting is Netlify; no `vercel.json`).
- CI-run checks and e2e tests on deploy: D-003 and D-059; the release gate is `npm run verify:release` locally plus the Chrome smoke checks.
- Content-Security-Policy: not in v1 (Planner default above; see `plan/IDEAS.md`).

## Definition of done
- [ ] All tasks ticked except Y-07 (waits for the owner), `npm run verify:release` passes.
- [ ] Unit-test rows above pass; `netlify.toml` equals `NETLIFY_TEMPLATE`.
- [ ] C- and M- lines present; STATUS set to `Ready for review`.
- [ ] Owner reports a successful deploy (M-Y-1) and the URL is recorded (Y-07); C-Y-1…C-Y-12 are `PASS` in `VERIFICATION-LOG.md`.
