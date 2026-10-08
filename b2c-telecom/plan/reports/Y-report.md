# Workstream Y report: Netlify deployment

## Done
Y-01 (security headers JSON + `headers()` entry, appended last so existing rule order is unchanged), Y-02 (`b2c-telecom/netlify.toml`), Y-03 (`check-release.mjs`/`.d.mts`/test, scripts `build:netlify`, `check:release`, `verify:release`), Y-04 (`npm run verify:release` passes locally), Y-05 (README "Deploying to Netlify"), Y-06 (this report).

## Not done / blocked
- Y-07 and all live steps: OA-06 (Netlify site + env vars) and OA-05 (Netlify origin in Checkout allowed origins) are not done. Blocked: M-Y-1..M-Y-4 (owner), C-Y-1..C-Y-12 (need a staging URL). README says "Staging: not yet deployed".
- The Package-directory assumption (`b2c-telecom`) is untested on real Netlify; the pre-approved fallback is in the workstream file.

## Questions for the owner
- `CTP_CHECKOUT_APP_KEY` is required by Netlify builds (E). Before OA-05 the first deploy fails unless a placeholder value is set or the check is relaxed. With `CHECKOUT_DEMO_PAYMENT=true` the demo payment works (Q-022), but the build still needs the variable.

## Missed features and deviations
- Rule 9 (dev routes): telecom dev routes are `*.dev.ts(x)` files excluded from production by `pageExtensions` (and proven absent by `check:dev-routes`), so they carry no `NODE_ENV` guard. The rule skips `*.dev.ts(x)` files and still demands guard + `notFound()` in any other file below a `dev` directory or `app/api/health`.
- Rule 4 ignores any `.example` file (`.env.seed.example` is tracked legitimately).
- Rule 5: `.env.example` prefills the three non-secret defaults (`CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`); those only need to be listed. The other five must be empty.
- README env table also lists `CHECKOUT_DEMO_PAYMENT` (U) and `SITE_URL` (W).
- `@netlify/plugin-nextjs` is declared only in `netlify.toml` (Netlify installs it), not in `package.json`.

## TODOs for other workstreams
- Z: run C-Y-* after the owner reports the URL. C-Y-4 expects `/api/health` to answer 404 on staging (it is absent from production builds).

## Findings
None from live services (no deploy possible). `npm run verify:release` passes.

## Manual tests added
M-Y-1, M-Y-2, M-Y-3, M-Y-4 as in the workstream file (unchanged).

## Junior design choices
None (no UI).
