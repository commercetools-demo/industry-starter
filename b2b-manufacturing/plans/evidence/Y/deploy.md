# Y — deployment readiness (no secrets recorded)

| Check | Result |
| --- | --- |
| `netlify.toml`: base site dir, `npm run build`, publish `.next`, Node 22 | present; production context runs `check:release` first |
| Dev pages absent from the release | `check-no-dev-pages`: OK |
| No health-project reference in the release | `check-no-health-in-release`: OK |
| Production gate | `check-sample-content --strict` fails while `sample: true` items remain (by design, SO-04) |
| Bundle and HTML hold no secrets or commercetools host | `check-bundle-secrets`: OK |
| `npm audit --omit=dev` | 0 vulnerabilities |
| README | Deploy section: env var table with scope and owner, smoke test, rollback |

Not done here (owner, OA-05): creating the Netlify site, setting the variables, and the preview smoke test on the deployed URL (Y-02, Y-03). The same smoke path was run against the local production build (see `../R/live-check.md`, `../S/live-check.md`, `../Z/`).
