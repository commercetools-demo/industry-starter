<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Release checklist (workstream Z-11)

Final gate before the owner deploys. Claude prepares and verifies; the owner performs deploys, creates credentials and closes rows (D7, D9). `[x]` means verified with evidence named in the line; `[ ]` means open, with the row that closes it. Open rows of the whole project: `plans/OPEN-ITEMS.md`.

Run order: 1) `node plans/release-gates.mjs` (offline, dummy env), 2) the owner rows in section C, 3) the live sweep (`plans/E2E-JOURNEYS.md`), 4) the post-deploy smoke list (section D).

## A. Gates that run offline (no credentials, no commercetools)

- [x] (2026-10-13, scratch copy of the working tree: 10 of 10 PASS, `plans/evidence/Z/clean-clone.md`; still repeat from a true clean clone on the release commit, Q-Z05) `node plans/release-gates.mjs` is all PASS: plans (`verify-plan --sync --strict`, `verify-manual --structure`, `plans/*.test.mjs`, spec coverage refresh), seed `npm run check`, storefront and portal `npm run check` and `npm run verify:build` in a scratch copy. Result of the last run: `plans/evidence/Z/clean-clone.md`. For the release commit repeat it from a clean clone: `git clone --no-hardlinks <repo> <scratch>`, check out the commit, then `node plans/release-gates.mjs --install` (needs the npm registry).
- [ ] (2026-10-13: exits 1, 170 rows open, structure valid) `node plans/verify-manual.mjs` exits 0 (every owner row `DONE`, `PASS`, `ACCEPTED` or `WAIVED by <name> <date>: <reason>`). It fails while owner rows are open: that is gate G11.
- [ ] (2026-10-13: runs; 51 of 252 scenarios UNCOVERED, not yet explained) `node plans/spec-coverage.mjs`: no unexplained `UNCOVERED` scenario (`plans/SPEC-COVERAGE.md`, `plans/evidence/Z/spec-coverage.md`).
- [ ] (2026-10-13: seed 0 findings; storefront 8 high and portal 11 high, all via the Contentools/Puck packages (`braces` through nimbus, `uuid` through `@measured/puck`), no fix available upstream; owner accepts or waits) `npm audit --omit=dev` shows no high or critical in storefront, portal and seed (needs the registry; `plans/evidence/X/npm-audit-*.txt` is the last run).
- [ ] (2026-10-13: no `attack` script exists; the attack suites are vitest tests that pass inside `check`; the production-build run with the stub is not built) X attack harness (`npm run attack` in both apps on production builds with the stub) passes; results in `plans/evidence/Z/attack-rerun.json`.

## B. ct-builders readiness (gates of the `ct-builders-readiness` skill)

The project stays in commercetools labs (owner answer Q-Z01, 2026-10-12). Verdict wording: **gate 0 not applicable (stays in labs)**; never "publishable" while a judgement item is open.

| Gate | Status |
| --- | --- |
| 0 Roadmap overlap | **Not applicable (stays in labs, owner 2026-10-12, Q-Z01).** Recorded, no product-side owner sought. Needs the owner's confirmation in M-Z-01. |
| 1 MIT and SPDX headers | Open: run `apply_fixes.py` dry run, apply only after the owner says go (M-Z-01). New files of this workstream carry the header. |
| 1b Files not ours (`design/export/`) | Open: owner decides whether it ships (M-Z-01); default excluded, no headers added. |
| 2 "Unsupported" said out loud | Markdown headers carry it; `SUPPORT.md`, README banner, `CONTRIBUTING.md` come with the apply step (M-Z-01). |
| 3 Credentials | Open until the sweep runs: `git ls-files` must show only `.env.example`; `check-secrets` and `check-bundle-secrets` are part of the gates in A. |
| 4 Customer and internal information | Partly done 2026-10-13: names and local paths scrubbed from specs, seed, storefront and tools. Still open: `design/export/` (M-Z-01) and `plans/` (excluded from any published tree). Original text: `Hartmann`, `Lindner`, `Autoline` and `/Users/...` paths must be scrubbed from kept files (D5, D6); fictional brand `Malva` stays (M-Z-07). |
| 5 Internal tooling | `.claude/`, `CLAUDE.md`, `plans/`, `openspec/` are excluded from any published tree (D6). |
| 6 History | Default: a published copy is a fresh single-commit export; owner confirms public or private (M-Z-02). |
| 7 Proves it builds | **Verified 2026-10-13:** all six `puck-*` packages resolve (renderer and editor 0.8.3, the other four 0.8.1) and the gates in A pass offline. Section A (gates) plus `npm view @commercetools-demo/puck-renderer version` (and `puck-editor`, `puck-types`, `puck-page-manager`, `puck-content-manager`, `puck-theme-manager`) resolve from the public registry. |
| Shared change-set (org strings) | List `commercetools-demo` and `commercetools-labs` strings in `package.json`, README, `netlify.toml`, links; rewrite only if the destination changes (not by default). |

Report location: `plans/evidence/Z/PUBLISH-READINESS.md` (internal, must not ship).

## C. Deployment preparation (owner performs; Claude verifies afterwards)

| # | Item | How verified | Row |
| --- | --- | --- | --- |
| 1 | Production commercetools API clients, three per app set (`CTP_*` frontend, `CTP_ADMIN_*` seller admin, `CTP_PROVISION_*` provisioning), only the scopes `.env.example` lists | `check-secrets`, `scopes.test.ts`; owner creates the clients, values never pasted into chat | OA-01, OA-08, OA-09, OA-12, OA-13, OA-15, M-Z-04 |
| 2 | `SESSION_SECRET` (32+ characters, different per app and environment), `IMPERSONATION_SECRET` (same in both apps), `ORDER_ACCESS_SECRET`, `STOREFRONT_ORIGIN`, `PORTAL_ORIGIN`, `CSP_IMG_HOSTS`, `CONTENTOOLS_ORIGIN`, the Checkout application key and Stripe connector settings (names only; the Stripe secret key lives in the connector's secured configuration), `PROXY_STRICT_STORE=true` | `check-secrets`, `check-build-env` with `RELEASE=1` | OA-10, M-Z-04 |
| 3 | Debug switches off in production: `ATTACK_MODE`, `CONTENTOOLS_JWT_CANARY`, `DEMO_LOGIN_ENABLED`, `DEMO_ONSCREEN_RESET` (the owner decides explicitly whether a demo deployment keeps on-screen reset, then also `DEMO_RESET_ACKNOWLEDGED=true`), `CHECKOUT_DEV_*`, any `NEXT_PUBLIC_*` flag | `check-no-attack-mode`, `check-no-demo-login`, `check-demo-reset` (part of `verify:build`), grep | M-X-10, M-Z-06 |
| 4 | Release build: no dev pages, no `/api/health`, no sample data in a production context, vehicle mock acknowledged (`VEHICLE_MOCK_ACKNOWLEDGED=true`) or off | `verify:build` with `CONTEXT=production`, `check-no-dev-pages`, `check-no-health-in-release`, `check-vehicle-provider` | M-Z-05 |
| 5 | Hosting: `netlify.toml` per app (Node 22, base directory set in the UI), `.nvmrc`, X headers on the deployed URL, HTTPS only, HSTS, `Secure` cookies, storefront allows framing by the portal origin | owner deploys (skills `nextjs-deploy-netlify` or `nextjs-deploy-vercel`); Claude then runs `curl -I` and the Chrome sweep | M-X-04, M-X-10, OA-14, M-Z-05 |
| 6 | Store setup procedure in `storefront/README.md` and `portal/README.md`: create a store in the Merchant Center, assign branch channels, product selection, shipping methods and zones, theme from `default`; the host rewrite to `/{locale}/{store}` is the admin's job | README review | |
| 7 | Contentools connected in the production project (Merchant Center app) and the portal Theme tab loads | Chrome on the deployed portal | OA-02 |
| 8 | Real product images (OA-03); plate and VIN: mock provider only, recorded decision (OA-04 waived) | owner rows | OA-03, OA-04 |
| 8a | Payments: Stripe connector with production keys and webhook (test mode only until the owner says otherwise), Checkout application configured for the production project and allowed origins, a test order and a refund end to end, recurring orders able to charge (saved payment method on the Stripe side) | owner row, then Claude with Chrome and `read_payments` | OA-05, M-Z-04 |
| 9 | Seed is idempotent and documented: re-seed, `reset`, `seed:cleanup`, `purge:test-data` | `seed/README.md`; the seed tests prove a second run writes nothing and that `reset` removes everything the seed created (`seed/src/purge-test-data.test.ts`) | M-D-01, M-D-02 |
| 10 | Rollback: the host's previous deploy can be restored in one click; commercetools data changes are additive (seed idempotent) | review; note in `FINAL-REPORT.md` | |
| 11 | Post-deploy smoke list (Claude, deployed URLs) | see section D | M-Z-05 |
| 12 | Monitoring and alerting: none built; recorded as a known gap | `FINAL-REPORT.md` | M-Z-06 |

## D. Post-deploy smoke list (Claude runs it on the deployed URLs)

- [ ] `GET /de-DE/<store A>` returns 200 with its theme; `GET /de-DE/nope` returns 404; `GET /api/health` returns 404 on both apps.
- [ ] `curl -I` shows the X headers (CSP, frame rules, HSTS, nosniff, referrer policy).
- [ ] Sign in as each persona (Shopper, Admin A, Buyer A, Admin B); demo login absent.
- [ ] One order round trip (J1) and its cleanup (`purge:test-data`).
- [ ] Lighthouse on home, listing, product and the portal dashboard (`plans/evidence/Z/deployed/`).

## E. Test data and known gaps

- [ ] Purge dry run read by the owner (`plans/evidence/Z/purge-plan.txt`), then `purge:test-data -- --apply --confirm <projectKey>` (M-Z-03); no `TST-` leftovers except those accepted in `plans/evidence/Z/leftovers.md`.
- [ ] Data sweep through the MCP against `SEED-PLAN.md` (Z-06) recorded in `plans/evidence/Z/data-sweep.md`.
- [ ] Known gaps accepted by the owner (M-Z-06): no e-mail is sent anywhere (Q-P01), on-screen password reset (demo only, gated by `DEMO_ONSCREEN_RESET`), Stripe in test mode only, no rate limiting, no monitoring, no wholesale buying from Malva (Q-V01), no MAP floor (Q-T03), no territory blocking (Q-O03), theme contrast of reseller themes not checked (Q-Y01).
