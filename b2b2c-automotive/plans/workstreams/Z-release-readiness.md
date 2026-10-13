<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream Z — Release readiness and final verification

Status: DRAFT v1 (2026-10-12). Nothing new is built. Claude walks the whole system on a **release build**, juniors fix what is found, and the owner closes the open manual rows. Dev URLs assumed: storefront `http://localhost:3000`, portal `http://localhost:3001`.

## Goal

End state: every workstream A to Y is `Done`; both apps build from a clean clone; every spec scenario of the specs this project implements (the four out-of-scope seller-portal specs excluded) has a passing test or evidence; the data in the commercetools project is exactly what `SEED-PLAN.md` says with no test leftovers; the ct-builders readiness report exists with an honest verdict (gate 0 recorded as not applicable because the project stays in labs; the mechanical hygiene gates are still run); and **every row of `plans/TODO-MANUAL-TESTING.md` is `DONE`, `PASS` or waived in writing by the owner** (gate G11).

## Depends on

A to Y (all). Owner prerequisites: all `OA-*` and `SO-*` rows (`OA-01` to `OA-05`, `OA-07` to `OA-14`, `SO-01`; `OA-05` is the Stripe test account, the Stripe connector and the Checkout application) and every `M-*` row added by the workstreams (`M-V-*`, `M-W-*`, `M-X-*`, `M-Y-*`, and the earlier ones).

## Specs and requirements verified

Z implements nothing. It verifies **every** spec this project owns under `b2b2c-automotive/openspec/specs/`:

- `consumer-storefront/`: `bootstrap-and-structure`, `theming-design`, `design-storefront-shell`, `design-store-picker`, `design-vehicle-finder-and-garage`, `design-home-page`, `design-product-listing-page`, `design-product-detail-page`, `design-cart-page`, `design-checkout-page`, `design-order-confirmation-page`, `design-account-area`.
- `seller-portal/`: `bootstrap-and-structure`, `design-portal-shell-and-navigation`, `design-auth-screens`, `design-dashboard`, `design-catalog-assortment`, `design-price-overrides-and-margin`, `design-product-info-tailoring`, `design-discounts-and-priority`, `design-storefront-theme-and-branding`, `design-content-pages`, `design-store-and-channels`, `design-company-and-account`, `design-customers-and-subscriptions`, `design-returns-and-reviews`, `design-marketing-and-email`, `design-bundles-and-product-import`, `design-brand-partnership`.
- **Out of scope (owner, 2026-10-12, Q-V01), not verified:** `seller-portal/design-quick-order-and-cart`, `design-orders-quotes-invoices`, `design-approvals-and-roles`, `design-price-lists-and-saved-lists` (each carries the marker `<!-- OUT-OF-SCOPE -->`; wholesale buying from Malva is not built). The spec-coverage script (Z-02) skips specs with that marker. Parts of in-scope specs that depend on them (cost centres and budgets and "approval rule" scenarios in `design-company-and-account`, the Approver role, Approvals badge and "Shop from Malva" navigation group in the shell spec) are `N/A: out of scope Q-V01` in the coverage triage.
- The pre-existing template specs in the same folders (for example `cart-page`, `checkout`, `quote-negotiation`) are **not** this project's and are not verified here (design.md decision 1: they are not edited).

Requirement-level verification is by the spec coverage report (Z-02). Gate G11 of `DEPENDENCY-PLAN.md` is Z's exit.

## Decisions already taken (do not reopen)

| # | Decision | Source |
| --- | --- | --- |
| D1 | "Done" for a workstream means: its definition of done is met, `plans/STATUS.md` says `Done`, and its evidence folder `plans/evidence/<LETTER>/` exists. | all workstreams |
| D2 | Z verifies on a **clean clone** of the commit under test (no `node_modules`, no `.env.local`, no `.next`), using `git clone --no-hardlinks <repo path> <scratch dir>` then checking out the commit. Scratch work goes in the session scratchpad directory, not `/tmp`. | skill `ct-builders-readiness` gate 7 |
| D3 | The project **stays in labs** (`commercetools-labs/industry-starter`), not ct-builders (owner answer Q-Z01, 2026-10-12). Gate 0 (roadmap overlap) is therefore recorded as **not applicable (stays in labs, owner 2026-10-12)**; no product-side owner is sought. The remaining gates are still run as mechanical hygiene (MIT and SPDX headers, unsupported wording, no credentials, no customer or internal data, history note, clean-clone build), because they are cheap and keep the repository safe to share inside labs. | skill `references/judgement.md`; Q-Z01 |
| D4 | The readiness report is written to `plans/evidence/Z/PUBLISH-READINESS.md` (the skill writes it at the repo root; here it is internal evidence and must not ship). | decided here |
| D5 | Names `Hartmann`, `Lindner`, `Autoline` and every part name or price of the design prototype are placeholders (design.md Risks). They must not appear in code, seed, copy or fixtures; examples in specs are rewritten to neutral `reseller-a` / `reseller-b`. `Malva` is the project's fictional brand and stays. | design.md Risks; Q-Z02 |
| D6 | Absolute local paths (`/Users/...`) in any file that could be shared are replaced by repo-relative paths or a named reference ("the integrate-contentools skill"). `plans/`, `.claude/` and `openspec/` are **excluded** from any published tree by default; the scrub is still applied to the kept files. | Q-Z03 |
| D7 | The Merchant Center, Netlify and hosting actions are the owner's (Claude has no deploy credentials). Claude prepares, the owner clicks, Claude verifies afterwards with `curl` and Chrome. | `DEPENDENCY-PLAN.md` prerequisites |
| D8 | Test data is purged only by a script that reads the evidence registers, dry run by default; the `b2b2c-automotive` MCP has no delete tool for carts, orders and most resources, so the purge script (admin credentials, run by a junior or the owner) is the deletion path. | Z-07 |
| D9 | Claude never closes an owner row. A row becomes `DONE`/`PASS` only with the owner's statement quoted in the row (who, when, what), or `WAIVED by <name> <date>: <reason>`. | memory: self-verify, minimise owner asks; manual items in the TODO file |

## Tasks

A task is done when its output exists in `plans/evidence/Z/` and, where code changed, `npm run check` is green. Work in this order; do not wait silently on owner rows: list them, mark the dependent tasks `BLOCKED-ON-OWNER` in `plans/STATUS.md`, and continue.

### A. Consistency

- [ ] **Z-01** Plan and spec consistency. Run `node plans/verify-plan.mjs` (must exit 0; it regenerates the graph and waves in `DEPENDENCY-PLAN.md`, so commit the regenerated blocks), and the OpenSpec validation of this project's artifacts: `openspec validate b2b2c-automotive-design --strict`, then `openspec validate --specs --strict` and keep only the results for the specs listed above (the template specs may fail and are out of scope; record that in the output). Check every workstream file `plans/workstreams/*.md` has all task boxes ticked or an explicit `N/A: <reason>`, and `plans/STATUS.md` says `Done` for A to Y. Output `plans/evidence/Z/consistency.md`.
- [ ] **Z-02** Spec coverage. Create `plans/spec-coverage.mjs` (Node, no dependencies): for each spec listed above, parse `### Requirement:` and `#### Scenario:` headings, then search the workstream "Tests" tables, the test files (`describe`/`it`/`test` names in `storefront/**/*.test.*` and `portal/**/*.test.*`) and the evidence recipe logs (`plans/evidence/**/recipe-log.md`) for the scenario title (case-insensitive, punctuation ignored). Output `plans/evidence/Z/spec-coverage.md`: one row per scenario with `covered by` (test file and name, or evidence file) or `UNCOVERED`. A human then triages every `UNCOVERED`: add the missing test, or mark `N/A: <reason>` (for example a later-phase requirement not built, or a scenario depending on an out-of-scope spec, with the decision id from the workstream; specs with the marker `<!-- OUT-OF-SCOPE -->` are skipped by the script). No scenario may stay unexplained.
- [ ] **Z-03** Clean-clone gates (gate G1 again, on the final commit). In the scratch directory: clone, check out the commit, then for each app: `cd b2b2c-automotive/storefront && nvm use && npm ci && npm run check && npm run build`; `cd ../portal && nvm use && npm ci && npm run check && npm run build`; `cd ../seed && npm ci && npm run verify` (the seed package's offline verification; see `seed/README.md`). Also `node scripts/check-no-dev-pages.mjs`, `check-no-health-in-release.mjs`, `check-bundle-secrets.mjs` (extended in X with the JWT shape), `check-shared-copies.mjs`, `check-no-attack-mode.mjs` (created in X-12 for both apps; fails if `ATTACK_MODE` or `CONTENTOOLS_JWT_CANARY` appears in `netlify.toml`, `.env.example` defaults or any committed `.env*`; Z only runs it and fixes the script if it is missing). Save full logs (tail 80 lines each) in `plans/evidence/Z/clean-clone.md` with the commit hash, Node version and date.

### B. Browser and journey sweep

- [ ] **Z-04** Browser sweep on release builds (`npm run build && npm run start` in both apps, seeded project): every page of `plans/evidence/Y/pages.md`, every empty and error state, at 375 and 1440, light and dark for the portal, personas Admin and Buyer. For each: `list_console_messages` clean, `list_network_requests` shows no commercetools host, no 4xx/5xx other than intended, screenshots into `plans/evidence/Z/browser/`. Anything that fails goes to a fix list `plans/evidence/Z/fixes.md` with the file, the test added and the commit.
- [ ] **Z-05** End-to-end journeys, each executed once on the release builds with the MCP read-back named in the table below. Record step, URL, observation and screenshot in `plans/evidence/Z/journeys.md`.

| Journey | Steps | MCP read-back |
| --- | --- | --- |
| J1 Shopper buys a fitting part | open `/de-DE/<A>`, choose branch on the Leaflet map (or the list), choose vehicle, listing shows only fitting parts, product page fit banner, add to cart, pay in the hosted commercetools Checkout with the Stripe test card, confirmation (on screen only, no e-mail) | `read_orders` by order number: lines, store A, branch/channel, taxed price, customer; `read_payments` Stripe payment `Success`; `read_inventory` stock of the branch channel decreased |
| J2 Subscription | shopper adds a part with the subscribe option and an interval, checks out through Checkout, manages the subscription in the account (pause, resume); Admin A sees it in the portal Subscriptions page | `read_recurring_orders` active then paused then active; `read_recurrence_policies` on the part |
| J3 Reseller prices, assortment and tailoring | portal as Admin A: set a standalone retail price above zero (accepted, visible in the storefront), try zero or negative (refused), withdraw a part, reinstate, publish tailored text and a tailored image (visible at once, no approval) | `read_standalone_prices` price on the store channel present or absent; `read_product_tailoring` text and images; storefront listing and PDP reflect within the documented cache TTL |
| J4 Theme | portal Theme tab edits a colour and font and uploads a logo (Contentools `upload-file`) for store A | `read_custom_objects` container `configuration`, key `<businessUnitKey>-theme`; storefront A shows it at first paint, B and a store without a theme show `default` |
| J5 Branch with its own stock and price | Admin A edits a branch (Leaflet map position, stock, price override on that branch channel) | `read_channels`, `read_inventory` and `read_standalone_prices` for the branch channel; storefront shows the branch values |
| J6 Return and refund | shopper requests a return (within 30 days of `deliveredAt`) in the account area, Admin A inspects and refunds in the portal, the refund runs through the payment (Checkout/Stripe connector), shopper sees Refunded | `read_orders` `returnInfo` fields; `read_payments` refund transaction per V's decision on refunds |
| J7 Review | verified buyer posts a review, appears at once (no review gate), Admin A replies | `read_reviews` published with the reply |
| J8 Bundle | Admin A creates and publishes a bundle; shopper adds it; withdraw a component | `read_products` bundle published then removed from selection; cart lines parent and children |
| J9 Shop as customer | portal Admin A (Admin only) opens the storefront as a customer, places an order, idle expiry | `read_orders` `custom.placedOnBehalfBy` |
| J10 Isolation | Admin B tries Admin A's data through UI and `fetch`; a Buyer tries Admin-only pages | all 403/404; MCP versions unchanged |

### C. Data sweep and cleanup

- [ ] **Z-06** Data sweep through the MCP, read only, against `SEED-PLAN.md`: `read_project` (search indexing on, country tax rate fallback on, currencies EUR and USD, languages `de-DE`, `en-US`; EUR/DE and USD/US per Q-010), `read_stores` (the two reseller stores only; no wholesale store), `read_business_units`, `read_associate_roles` (the seed's `mau-role-admin` and `mau-role-buyer`; no Approver of ours. The three sample associate roles, among them `approver`, are left in place by the seed cleanup, `SEED-PLAN.md` section 6, and are listed as sample leftovers, not deviations), `read_customers`, `read_customer_groups` (none: no customer groups exist), `read_categories`, `read_product_types` (no leftover sample types), `read_products` (counts equal the seed manifest; no sample-data products such as the platform's sample catalog; no products with a name containing a prototype placeholder), `read_product_selections` and `read_product_selection_assignments`, `read_inventory`, `read_standalone_prices` (all prices are standalone, Malva base price included, Q-003; branch channels carry prices and inventory, Q-005), `read_product_tailoring` (text and images), `read_channels`, `read_shipping_methods`, `read_zones`, `read_tax_categories`, `read_cart_discounts`, `read_discount_codes`, `read_product_discounts`, `read_custom_objects` (containers: the seed's `mau-vehicles` (26 records), `mau-assortment` (one per store), `mau-site` (`banner-images`), then `configuration`, `contentools-configuration`, `malva-coop-campaigns`, `malva-email-templates`, `malva-email-campaigns`, `malva-impersonation`, `malva-local-review`, `malva-customer-notes`, `malva-price-changes`, plus whatever the final workstream files add; demo records have `"demo": true`, nothing else unexpected; `malva-rules` has no `map-floor` and `malva-notification-outbox` does not exist), `read_types` (the eight seed types: `store-settings`, `branch-info`, `malva-checkout`, `malva-line`, `malva-customer`, `malva-return-item`, `mau-business-unit-fields`, `mau-cart-discount-fields`, plus `malva-review` and any type V, W or U add after the seed; no `portal-order`, `portal-cart`, `portal-customer`, `reseller-company`, `malva-order-audit`, `malva-customer-consent`), `read_states` (`ready-for-pickup` and the review states), `read_recurrence_policies` (the three `mau-rp-*` policies exist and the subscribable parts, `recurring-eligible`, can use them), `read_recurring_orders`, `read_payment_integrations`. Output `plans/evidence/Z/data-sweep.md` with count tables and a "deviations" list. [SKILL: commercetools-platform]
- [ ] **Z-07** Test data cleanup. The authoritative lists are `plans/evidence/V/test-data.md`, `W/test-data.md`, `X/test-data.md`, `Y/test-data.md` (and `Z`'s own). Create `seed/scripts/purge-test-data.mjs` (admin credentials from `seed/.env.local`): reads those registers (record type and id), **dry run by default**, prints the plan, deletes only ids found in the registers and whose key, PO or name carries the `TST-` prefix (re-checked per record before deleting), in dependency order (return infos stay with their order; recurring orders and their `TST-` recurrence policies, shopping lists, reviews, carts, orders with `dataErasure=false` unless the owner says otherwise, payments of test orders, custom objects, product tailoring records with `TST-` test images, standalone prices of test parts, discount codes, cart discounts, products and bundles, import containers; the removed things (outbox objects, `malva-rules/map-floor`, approval rules, the wholesale store, purchase-order data) are not purged because they are not created). Flags `--apply` and `--confirm=<project key>`. Claude runs the dry run and shows the output; the **apply** is run by the owner or a junior after reading it (row M-Z-03). After apply, rerun Z-06 and prove with `read_orders`, `read_carts`, `read_recurring_orders`, `read_recurrence_policies`, `read_product_tailoring`, `read_shopping_lists`, `read_reviews`, `read_cart_discounts`, `read_products` that no `TST-` record remains. Orders and recurring orders that cannot be deleted are listed with their state (cancelled) in `plans/evidence/Z/leftovers.md` with the owner's decision.
- [ ] **Z-08** Security re-run on the final build (there is no MAP floor and no territory rule, so no floor audit; a reseller may set any price above zero and the zero-or-negative refusal is part of the X harness): the X attack harness (`npm run attack` in both apps with production builds and the stub) passes, results appended to `plans/evidence/Z/attack-rerun.json`; `npm audit --omit=dev` shows no high or critical in both apps and in `seed/`; `plans/notes/security-review.md` has no open high finding.

### D. ct-builders readiness

- [ ] **Z-09** Run the `ct-builders-readiness` skill against `b2b2c-automotive/` and write `plans/evidence/Z/PUBLISH-READINESS.md` (template in the skill). [SKILL: ct-builders-readiness]
  1. Establish facts: `gh repo view commercetools-labs/industry-starter --json isPrivate` (if `gh` is available; else ask via row M-Z-02) to set `--public` or not.
  2. Customer-name candidates: `python3 ~/.claude/skills/ct-builders-readiness/scripts/derive_terms.py --gh commercetools-labs --limit 60` (needs `gh`); confirmed terms for `--terms`: `hartmann,lindner,autoline` (D5). Do not hand-roll the term list.
  3. Sweep: `python3 ~/.claude/skills/ct-builders-readiness/scripts/sweep.py b2b2c-automotive --json --name b2b2c-automotive --owner commercetools-labs [--public] --terms hartmann,lindner,autoline --candidates <triaged list> --description "<the repo description>" > plans/evidence/Z/sweep.json` (these paths contain none of the words the shell guard refuses; if your shell guard refuses a path, ask the owner to run the command and give you the JSON).
  4. Judge what the sweep cannot: gate 0, triage of candidates (dismiss with a reason; report the rest), worthiness.
  5. Offer the mechanical fixes (dry run only): `python3 ~/.claude/skills/ct-builders-readiness/scripts/apply_fixes.py b2b2c-automotive` (mode `compliance`); apply with `--apply` **only after** the owner says "go" in row M-Z-01 (Q-Z01 itself is answered: stays in labs). Never use `--mode new-org` here. After applying, run Z-03 again (a header above `"use client"` breaks files) and read every refusal.
- [ ] **Z-10** Gate-by-gate expectations and the work each needs (fill the real result into the report; the defaults below are what Claude must expect and say):

| Gate | Expected result and reasoning | Work |
| --- | --- | --- |
| 0 Roadmap overlap | **Not applicable (stays in labs, owner 2026-10-12, Q-Z01).** The project is not proposed for ct-builders, so no roadmap-overlap decision is sought. The report records this line verbatim and notes, for information only, the shapes the skill would flag (Next.js storefront, Contentools page builder embed, portal screens that mirror Merchant Center, seed tooling). The verdict wording never says "publishable"; it says `gate 0 not applicable (stays in labs)`. | One paragraph in the report; confirmation in row M-Z-01; mechanical fixes below are still worthwhile hygiene |
| 1 MIT and SPDX header | Expect missing headers in generated or hand-written `.ts`, `.tsx`, `.mjs`, `.css` files; markdown has the HTML-comment header already | `apply_fixes.py` dry run, then apply after the owner's go in M-Z-01; insert below `"use client"` and shebangs (the script does) |
| 1b Files not ours | Contentools packages are dependencies, not vendored; the design export under `design/export/` was produced by a design tool and has no licence: refused by the script | Decide with the owner whether `design/export/` ships (row M-Z-01); default exclude from a published tree; do not add headers to it |
| 2 "Unsupported" said out loud | Needs `SUPPORT.md`, README banner "freely available, AS IS and UNSUPPORTED", `CONTRIBUTING.md` | `apply_fixes.py` templates |
| 3 Credentials | Must be none: `.env.example` has only names and comments; `seed/.env.local`, `.env.local`, `.next`, cookie jars are git-ignored; the attack harness keeps jars in memory | run sweep; also `git ls-files | grep -E '\.env($|\.)'` shows only `.env.example` |
| 4 Customer and internal information | Expect hits: `Hartmann`, `Lindner`, `Autoline` in specs and design export; `/Users/behnam/...` paths in specs and design.md; internal hostnames; the `b2b2c-starter` and `cms` local paths | scrub (D5, D6); the sweep must show zero confirmed-term hits in the kept tree |
| 5 Internal tooling | `.claude/` (skills, settings), `CLAUDE.md`, `plans/`, `openspec/` are working tools | exclude from a published tree (D6); the committed `AGENTS.md` block written by `next dev` is fine to keep |
| 6 History | The worktree sweep cannot see history. `industry-starter` holds other projects and commit messages. | Default: a published copy would be a fresh single-commit export of the kept tree, not a push of this history; row M-Z-02 asks the owner. Claude does not push or create repositories |
| 7 Prove it still works | clean-clone build and tests green (Z-03); external packages resolvable from the public registry (`npm view @commercetools-demo/puck-renderer version`, same for `puck-editor`, `puck-types`, `puck-page-manager`, `puck-content-manager`, `puck-theme-manager`); if any is private the gate fails and must be reported | run and record |
| Shared change-set (org strings) | hardcoded `commercetools-demo`/`commercetools-labs` strings in `package.json`, README, `netlify.toml`, GitHub links | list them; rewrite only if the destination changes (not by default) |

### E. Release checklist (deployment preparation; the owner performs deploys)

- [ ] **Z-11** Release checklist, ticked with evidence in `plans/evidence/Z/release-checklist.md`:

| # | Item | How verified |
| --- | --- | --- |
| 1 | Production commercetools credentials: three separate API clients per app set (`CTP_*` frontend, `CTP_ADMIN_*` seller admin, `CTP_PROVISION_*` provisioning) with only the scopes `.env.example` lists, each with its reason; no scope in code that is not documented | `check-secrets`, `scopes.test.ts`, owner row M-Z-04 (creates the clients; never pasted into chat) |
| 2 | `SESSION_SECRET` (32+ characters, different per app and environment), `IMPERSONATION_SECRET` (same in both apps), `STOREFRONT_ORIGIN`, `CONTENTOOLS_ORIGIN`, the Checkout application key and Stripe connector settings (names only; the Stripe secret key lives in the connector's secured configuration, never in the apps), `PROXY_STRICT_STORE=true` documented in `.env.example` with a reason each | `check-secrets` |
| 3 | Debug switches off in production: `ATTACK_MODE`, `CONTENTOOLS_JWT_CANARY`, `DEMO_ONSCREEN_RESET` (on-screen reset; the owner decides explicitly whether a demo deployment keeps it on), any `NEXT_PUBLIC_*` flag | `check-no-attack-mode.mjs`, grep |
| 4 | Release build: no dev pages, no `/api/health`, no sample data in the production context (the storefront spec: preview may show sample data, production fails the build while it remains) | gate scripts; run a build with `CONTEXT=production` |
| 5 | Hosting: `netlify.toml` per app (Node 22, base directory set in the UI), `.nvmrc`, headers from X present on the deployed URL, HTTPS only, HSTS, `Secure` cookies | owner deploys (skills `nextjs-deploy-netlify` or `nextjs-deploy-vercel` hand off to the vendor skill); Claude then runs `curl -I`, Chrome sweep on the deployed URL (row M-Z-05) |
| 6 | Store setup procedure written in `storefront/README.md` and `portal/README.md`: create store in the Merchant Center, assign branch channels (stock and prices), product selection, shipping methods and zones, theme from `default`; host rewrite to `/{locale}/{store}` is the admin's job | README review |
| 7 | Contentools connected in the production project (Merchant Center app, OA-02) and the portal Theme tab loads for a store | Chrome on deployed portal |
| 8 | Real product images present (OA-03), plate/VIN provider decision recorded (OA-04) | owner rows closed |
| 8a | Payments in production: Stripe connector deployed with **production** keys and webhook endpoint configured (test mode only until the owner says otherwise), commercetools Checkout application configured for the production project and allowed origins, a test order and a refund complete end to end, recurring orders are able to charge (saved payment method on the Stripe side) | owner rows OA-05 and M-Z-04; Claude verifies with Chrome and `read_payments` after the owner's step |
| 9 | Seed is idempotent and documented: how to re-seed, how to purge test data, how to roll a bad seed back (`seed/README.md`) | read and dry-run `npm run verify` |
| 10 | Rollback: the host's previous deploy can be restored in one click; commercetools data changes are additive (seed idempotent); note in `FINAL-REPORT.md` | review |
| 11 | Post-deploy smoke list (Claude runs on the deployed URLs): `GET /de-DE/<A>` 200 with theme; `GET /de-DE/nope` 404; `GET /api/health` 404; `curl -I` shows the X headers; sign-in as each persona; one order round trip and its cleanup | recorded |
| 12 | Monitoring and alerting: none is built; recorded as a known gap | `FINAL-REPORT.md` |

### F. Manual rows and the final verification

- [ ] **Z-12** Create `plans/verify-manual.mjs` (Node, no dependencies): parses `plans/TODO-MANUAL-TESTING.md`, finds table rows whose first cell matches `^(OA|SO|M)-[A-Z0-9-]+$`, reads the status cell (the last column named Status; accepted: `DONE`, `PASS`, or `WAIVED by <name> <date>: <reason>`; case-insensitive) and prints each row with its status; exit 1 if any row is not accepted or if a `WAIVED` row lacks name, date or reason; also exit 1 if a row id referenced in any workstream file (`plans/workstreams/*.md`: tokens matching `(OA|SO|M)-[A-Z0-9-]+`) has no row in the TODO file (the workstreams list rows to add; this catches rows nobody merged). Add a test with a fixture table.
- [ ] **Z-13** Merge the manual rows listed in workstreams V, W, X, Y and this file into `plans/TODO-MANUAL-TESTING.md` if the coordinator has not (do not change the wording; add id, owner action, status `TODO`). Run `node plans/verify-manual.mjs`; it will fail while owner rows are open. Send the list of open rows to the user in the final message with the exact owner action for each; this is the only place Claude "waits": it never idles, it reports and continues.
- [ ] **Z-14** Final verification: after the owner answers, update each row with the owner's statement (quoted), the date and the evidence link, then rerun `node plans/verify-manual.mjs` until it exits 0. **Gate G11 is met only when it exits 0.** Rows that need a live deploy are verified by Claude with `curl` and Chrome against the deployed URL, evidence in `plans/evidence/Z/deployed/`.
- [ ] **Z-15** Final report `plans/evidence/Z/FINAL-REPORT.md`: what was built (per workstream, one line), what is demo-only (demo records, Stripe in test mode only, demo campaigns), what is not built or out of scope (no e-mail is sent anywhere, owner decision Q-P01; wholesale buying from Malva, Q-V01; MAP price floor, Q-T03; territory blocking, Q-O03; rate limiting; monitoring; Malva-side screens; theme contrast checks), and the **known gap "on-screen password reset"**: the storefront and portal show the password-reset link on screen instead of mailing it (Q-P01), so anyone who knows an email address can reset that account; it is demo only, gated by `DEMO_ONSCREEN_RESET` (off in production unless the owner turns it on), accepted by the owner and never to be presented as production-ready; payments run through hosted commercetools Checkout with the Stripe connector in test mode only, known gaps and ideas, the ct-builders verdict line (exact wording from the skill), how to re-seed, purge test data, redeploy and roll back, and the table of owner rows with their final status.

## Tests

| Test (name) | File | Asserts |
| --- | --- | --- |
| `verify-manual accepts closed rows` | `plans/verify-manual.test.mjs` | DONE, PASS and well-formed WAIVED pass; TODO, BLOCKED, WAIVED without date fail |
| `verify-manual catches unmerged rows` | same | an id used in a workstream and absent from the TODO file fails |
| `spec-coverage parses headings` | `plans/spec-coverage.test.mjs` | fixture spec with 2 requirements and 3 scenarios gives 3 rows; covered and uncovered cases |
| `no attack mode in release config` | `portal/scripts/check-no-attack-mode.test.mjs`, `storefront/scripts/check-no-attack-mode.test.mjs` | fixture `netlify.toml` containing `ATTACK_MODE=1` fails |
| `purge script is dry run by default` | `seed/scripts/purge-test-data.test.mjs` | without `--apply` no delete call; with `--apply` but wrong `--confirm` aborts; a record without the `TST-` prefix is skipped even if listed |
| `purge respects registers` | same | ids not in the registers are never touched |
| existing suites | both apps and seed | `npm run check` green on the clean clone (Z-03) |

### Role matrix for Z

Z re-runs the two personas (Admin and Buyer; Approver is dropped with the out-of-scope wholesale specs) through Z-04 and J3, J6, J9, J10: Admin sees every portal page of the nav, Buyer only its items (matrices of V, W and `design-portal-shell-and-navigation`), shop-as is Admin only, Admin B sees nothing of A. Any difference from the V, W and X matrices is a defect, not a note.

## Browser recipe (Chrome DevTools MCP; Claude runs it)

1. Start both release builds with the seeded project (and the stub only for X's rerun). `resize_page` 1440x900, then 375x812.
2. For every page in `plans/evidence/Y/pages.md` and for every journey J1 to J10: `navigate_page`, `wait_for` a known text, `take_snapshot`, `take_screenshot`, `list_console_messages`, `list_network_requests`; record anomalies.
3. Deployed URLs (after M-Z-05): repeat steps 1 and 2 on the deployed storefront and portal for the smoke pages, plus `lighthouse_audit` on home, listing, product and portal dashboard.
4. Evidence naming: `plans/evidence/Z/browser/<app>-<page>-<viewport>.png`, `plans/evidence/Z/deployed/<app>-<page>-<viewport>.png`.

## MCP read-back checks (`b2b2c-automotive` MCP)

Per Z-05 (journeys) and Z-06 (data sweep) above, plus after the purge: `read_orders` where `createdAt > "<date of the first test>"` compared with the registers (every remaining order must be a journey order that is intentionally kept, listed in `leftovers.md`), `read_carts` with `cartState="Active"` (none left from tests), `read_recurring_orders`, `read_shopping_lists`, `read_reviews`, `read_product_tailoring`, `read_custom_objects` containers listed in Z-06.

## Manual items (rows for `plans/TODO-MANUAL-TESTING.md`; never wait silently)

All remaining `OA-*`, `SO-*` and `M-*` rows are Z's manual items. Z adds these rows:

| ID | Type | What the owner does | Blocks |
| --- | --- | --- | --- |
| M-Z-01 | owner confirmation | Confirm the recorded answer "stays in labs, not ct-builders" (Q-Z01; gate 0 is not applicable, no product-side owner needed); decide whether `design/export/` ships inside labs; say go or no-go to applying the mechanical compliance fixes (headers, SUPPORT.md, banner) | Z-09 apply step |
| M-Z-02 | owner info | Say whether `industry-starter` is public or private and whether history may be exposed (default: no; any shared copy would be a fresh export) | Z-09 `--public` flag, gate 6 |
| M-Z-03 | owner action | Read the purge dry run (`plans/evidence/Z/purge-plan.txt`) and run `purge-test-data.mjs --apply --confirm=<project key>` or approve a junior doing it | Z-07 |
| M-Z-04 | owner action | Create the production API clients and secrets (frontend, admin, provisioning) with the scopes in `.env.example`, set them in the hosting settings and `.env.local`; set the production Stripe keys and webhook in the Stripe connector's configuration and configure the production Checkout application (OA-05 covers the test setup); never in chat | release items 1, 2, 8a |
| M-Z-05 | owner action | Deploy both apps with the Netlify (or Vercel) skill, set the base directories, connect the Contentools Merchant Center app in the production project, create the production stores, and tell Claude the URLs | release items 5, 7, 11 |
| M-Z-06 | owner decision | Confirm the "demo-only" list in the final report and the known gaps (no e-mail is sent anywhere, Q-P01; on-screen password reset, anyone who knows an email can reset that account, demo only, gated by `DEMO_ONSCREEN_RESET`; Stripe in test mode only; no rate limiting; no monitoring) as accepted for this release | Z-15 |
| M-Z-07 | owner decision | Confirm that `Malva` is the project's fictional brand and not a real customer or prospect (Q-Z02) | Z-09 triage |
| all OA, SO, M | existing | close or waive each in writing (D9) | gate G11 |

## Definition of done

1. Z-01 to Z-15 ticked or `BLOCKED-ON-OWNER` with the row id; `plans/STATUS.md` shows A to Z `Done` (Z `Done` only when the next line is true).
2. `node plans/verify-manual.mjs` exits 0 (every row `DONE`, `PASS` or waived in writing) and `node plans/verify-plan.mjs` exits 0.
3. Clean-clone build and checks green for storefront, portal and seed; spec coverage has no unexplained `UNCOVERED`; data sweep and purge show no `TST-` leftovers except those the owner accepted.
4. `plans/evidence/Z/PUBLISH-READINESS.md` exists with an honest verdict line; gate 0 is recorded as `not applicable (stays in labs, owner 2026-10-12)`, the other gates carry their real results; the words "publishable" or "ready to publish" never appear while a judgement item is open.
5. `plans/evidence/Z/FINAL-REPORT.md` written.

## Progress

- 2026-10-12 (J28): offline half of Z built; nothing here needed credentials, a browser or the owner.
  - Z-02 done: `plans/spec-coverage.mjs` (+ `spec-coverage.test.mjs`) writes `plans/evidence/Z/spec-coverage.md` and the COVERAGE block of `plans/SPEC-COVERAGE.md` (31 specs, 252 scenarios; five levels, see Q-Z04; the UNCOVERED and PLANNED rows are the honest gap list). `verify-plan.mjs --sync` keeps that block (it only regenerates the part above it).
  - Z-03 script done: `plans/release-gates.mjs` runs every offline check of plans, seed, `tools/fake-contentools`, storefront and portal (`verify:build` in a fresh scratch copy, dummy env) and prints PASS or FAIL per gate; result table in `plans/evidence/Z/clean-clone.md`. A true clean clone (`--no-hardlinks`) plus `npm ci` run on the release commit is still to do (Q-Z05).
  - Z-05 prepared: `plans/E2E-JOURNEYS.md` (J0 to J12, accounts, steps, expected results, read-backs). Running them is M-Z-08 (needs OA-01, OA-02, OA-05, Chrome MCP).
  - Z-07 script done: `seed/src/purge-test-data.ts` (`npm run purge:test-data`, dry run by default, register driven, `TST-` re-check per record, never `mau-`), tests in `seed/src/purge-test-data.test.ts`, which also proves that `reset` removes everything the seed creates in every kind and container it writes (the existing cleanup and reset cover the seed; no new seed delete path was needed). The live dry run and `--apply` are M-Z-03 and M-Z-09.
  - Z-09 partial: gate 0 recorded as not applicable (stays in labs); `plans/evidence/Z/PUBLISH-READINESS.md` is a partial report; the sweep needs M-Z-01, M-Z-02, M-Z-07.
  - Z-11 prepared: `plans/RELEASE-CHECKLIST.md`.
  - Z-12 done: `plans/verify-manual.mjs` (+ `verify-manual.test.mjs`): ids, columns, cell counts, status values, WAIVED shape, unmerged ids; prints open counts per owner and blocker; `--structure` for the gate script, strict mode (exit 1 while rows are open) is gate G11. Fixed two rows that did not parse (Q-Z07).
  - Z-13 done: all workstream rows are in `TODO-MANUAL-TESTING.md`; M-Z-08 and M-Z-09 added. 170 rows, 2 closed at this date.
  - Open items consolidated by who acts: `plans/open-items.mjs` writes `plans/OPEN-ITEMS.md` (TODO rows, questions, MISSED-FEATURES). Board of A to Z: `plans/ORCHESTRATION.md`.
  - Not done (blocked on the owner or the live project): Z-01 partial (`plans/evidence/Z/consistency.md`: `verify-plan --strict` passes; `openspec validate` cannot validate the flat spec folders), Z-04, Z-05 execution, Z-06, Z-08, Z-09 sweep, Z-10 results, Z-14, Z-15.
- Commands: `node plans/release-gates.mjs [--skip-build]`, `node plans/verify-manual.mjs [--structure|--list]`, `node plans/spec-coverage.mjs`, `node plans/open-items.mjs`, `node --test plans/*.test.mjs`.

## Evidence (all under `plans/evidence/Z/`)

`consistency.md`, `spec-coverage.md`, `clean-clone.md`, `browser/*.png`, `journeys.md`, `data-sweep.md`, `purge-plan.txt`, `leftovers.md`, `attack-rerun.json`, `sweep.json`, `PUBLISH-READINESS.md`, `release-checklist.md`, `deployed/*`, `manual-rows-final.md` (every row: id, status, closer, date, quoted statement, evidence), `FINAL-REPORT.md`.
