# Y — Netlify deployment

**Specs:** `storefront-delivery-quality` — Deploy configuration, Dev-only routes removed before deploy, Environment validation (production)
**Depends on:** I–X · **Unblocks:** Z · **Decisions:** D-003 · **Owner prerequisites:** OA-06

## Goal
A production build of `site/` deploys on Netlify with env vars from the Netlify UI, with dev-only routes gone and production guards active.

## Design
- Root `netlify.toml`:
  ```toml
  [build]
    base    = "site"
    command = "npm run build"
    publish = ".next"
  [build.environment]
    NODE_VERSION = "22"
  ```
  Netlify's Next.js runtime is applied automatically for Next 16 projects; if the site does not build, record the log in `plan/QUESTIONS.md` — do **not** add plugins without asking.
- No `vercel.json`.
- Remove dev-only code: delete `app/api/health/route.ts` and `app/[locale]/account/dev/**` **or** keep them and make them return 404 in production **and** have `npm run verify:release` fail while they exist. Decision for v1: **delete the health route**, keep the dev stub page behind `notFound()` outside development, and make `check:release` allow the stub only if it contains the `NODE_ENV === 'development'` guard (test).
- `scripts/check-release.mjs` (from I) final rules: no `app/api/health`; any `dev` route must contain the development guard; `.env*` untracked; `netlify.toml` matches the template; no `vercel.json`.
- Environment variables to set in the **Netlify UI** (owner, OA-06): `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `CTP_CHECKOUT_APP_KEY`, `SESSION_SECRET` (≥32 random chars, different from local), optional `HOME_LAYOUT`, `HOME_CONTACT_STRIP`, `FEATURE_SUBSCRIPTIONS`. Build must fail with a named variable if one is missing (E-02).
- API client for production: **Frontend B2C** template, not admin; the seed/admin client is deleted from the project before launch (Z).

## Tasks
- [x] Y-01 Write `netlify.toml` + test (`scripts/check-release.test.ts` parses the file and asserts base/command/publish/NODE_VERSION) and ensure no `vercel.json` exists.
- [x] Y-02 Delete `app/api/health/route.ts` and its tests; finalize `check:release` rules + tests; add `verify:release` to `site/package.json` (verify + check:release).
- [ ] Y-03 Run `npm run verify:release` locally and fix findings. Add a README section "Deploying to Netlify" (steps, env var list, rollback = redeploy previous deploy in Netlify UI).
- [ ] Y-04 Prepare the deploy checklist as manual tests M-Y-1…M-Y-5 (owner executes with OA-06).
- [ ] Y-05 After the owner reports a successful deploy, record the site URL (non-secret) in `site/README.md`.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Netlify build config | Y-01 |
| Production build (health 404 / absent) | Y-02 |
| Missing variable at production start | E-02 |

## Manual tests to report (owner)
- M-Y-1: Netlify site created from the repo, base directory `site`, env vars set; first deploy succeeds.
- M-Y-2: `https://<site>/api/health` → 404.
- M-Y-3: `https://<site>/` redirects to `/en-US`; shop, product, cart work against the real project.
- M-Y-4: Complete one Adyen test checkout on the deployed site (Checkout allowed origin includes the Netlify URL).
- M-Y-5: Remove one env var in a deploy preview: the Netlify **build** fails naming the variable (then restore).

## Definition of done
`verify:release` passes; owner reports successful deploy; URL recorded; `verify` passes.
