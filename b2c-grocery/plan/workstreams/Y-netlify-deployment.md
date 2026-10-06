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
- [x] Y-03 Run `npm run verify:release` locally and fix findings. Add a README section "Deploying to Netlify" (steps, env var list, rollback = redeploy previous deploy in Netlify UI).
- [x] Y-04 Prepare the deploy checklist as manual tests M-Y-1…M-Y-5 (owner executes with OA-06).
- [ ] Y-05 After the owner reports a successful deploy, record the site URL (non-secret) in `site/README.md`.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Netlify build config | Y-01 |
| Production build (health 404 / absent) | Y-02 |
| Missing variable at production start | E-02 |

## Manual tests to report (owner)
- M-Y-1 (OA-06): 1. In Netlify create or open the site from this repository (base directory `site`, build settings from `netlify.toml`). 2. Site configuration, Environment variables: set `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `CTP_CHECKOUT_APP_KEY`, `SESSION_SECRET` (32+ random characters, not the local value); optional `HOME_LAYOUT`, `HOME_CONTACT_STRIP`, `HERO_IMAGE_URL`, `FEATURE_SUBSCRIPTIONS`. 3. Deploy the release branch. Expected: the build succeeds and the deploy is published. If it fails, copy the log (without values) into `plan/QUESTIONS.md`.
- M-Y-2: Open `https://<site>/api/health`. Expected: HTTP 404. Also open `https://<site>/en-US/account/dev/reset-link`. Expected: the 404 page.
- M-Y-3: Open `https://<site>/`. Expected: redirect to `/en-US`. Then open the shop, one product, add it to the bag and open the bag. Expected: real products and prices from the project, no error pages.
- M-Y-4 (OA-05): 1. In the commercetools Checkout application add the Netlify URL to the allowed origins. 2. On the deployed site sign in, add a product, choose address and slot, go to checkout and pay with the Adyen test card. Expected: the order confirmation page, and the order exists in Merchant Center.
- M-Y-5: In a deploy preview (or branch deploy) delete one required variable, for example `CTP_SCOPES`, and deploy. Expected: the Netlify build fails and the log names the missing variable. Then restore the variable and redeploy.

## Definition of done
`verify:release` passes; owner reports successful deploy; URL recorded; `verify` passes.

## Implementation notes (deviations, recorded by the developer)
- `check:release` now also checks (all with tests): `netlify.toml` at the repository root equals the template (`NETLIFY_TEMPLATE`, compared ignoring spacing and blank lines), no `vercel.json` at the repository root or in `site/`, and no tracked `.env*` file other than `.env.example` (`git ls-files --cached`; skipped outside a checkout). `checkRelease(rootDir)` still takes `site/`; the repository root is its parent.
- The dev reset-link page used `isDevStubEnabled()` and so lacked the literal `NODE_ENV` comparison that `check:release` requires. It now compares `process.env.NODE_ENV !== 'development'` directly before `notFound()` (behaviour unchanged, its tests pass).
- Deleted `app/api/health/**` (route and test). Stale `.next/types` after deleting a route make `tsc` fail until `.next` is removed; a clean checkout is not affected.
- Y-05 stays open: it needs the owner's successful deploy report and site URL (OA-06 says the site exists, but no URL or deploy result was reported). M-E-1 in the TODO file curls `/api/health`, which no longer exists after Y (it was PASS before).
- No Netlify plugins were added; if the first build fails, record the log in `plan/QUESTIONS.md`.
