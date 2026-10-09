# Workstream D: questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | The plan says `/api/health` returns 404 in production AND a check fails if the file exists on a release build, while `verify:build` runs on a dev tree that has the file. | `scripts/check-no-health-in-release.mjs` always requires the production 404 guard in the route; it fails on a missing file guard, and fails if the file exists when `NODE_ENV=production` (release pipeline deletes `app/api/health/` first). `verify:build` runs it without NODE_ENV so locally it checks the guard only. |
| 2 | Scopes: the plan says ask the owner (Q-D-n) before widening. | Kept A's list and added only `manage_sessions` (required by the spec). NOT added from the "likely need" list: `manage_my_orders`, `view_states`, `view_project_settings`, `view_inventory_entries`. Owner to confirm whether the booking/inventory/state work needs them. |
| 3 | A's remark: lint rule (d) (`fetch('/api/...')` literal) also covers `hooks/` and `context/`. | Fine for D: no D code lives there. Workstream H hooks must either use a non-literal URL (constant) or A's `CLIENT_DIRS` constant must be split; not changed here (not mine). |
| 4 | Session cookie name. | `malva_session` (A's `test/request.ts` default is `session`, a parameter; left unchanged). |
| 5 | `apiRoot` must not read env at import (build must work with empty env, A-question 5). | `apiRoot` is a lazy Proxy over `getApiRoot()`; env is validated on first use and at server start in `instrumentation.ts` (skipped when `NODE_ENV=test`). `next build` does not run `register()`, so empty env builds. |
| 6 | jose rejects jsdom's `Uint8Array`. | Session/API/health tests use `// @vitest-environment node`; noted in README. Global vitest config untouched. |
| 7 | Secure flag "not in local dev". | `secure` is true unless `NODE_ENV === 'development'`. |
| 8 | Test-only secret fallback. | In `NODE_ENV=test` with no `SESSION_SECRET`, `resolveSecret` uses a constant labelled test-only; the throwing branches are tested via explicit arguments. |
| 9 | Health route "calls apiRoot.get()" vs "no apiRoot in handlers". | The call lives in `lib/ct/health.ts` (`checkConnection`); the route only calls that. |
| 10 | Scenario "Not readable by scripts" cannot be proven in a browser here. | Proven by asserting the `HttpOnly` cookie option; browser/curl check is in the browser recipe. |
