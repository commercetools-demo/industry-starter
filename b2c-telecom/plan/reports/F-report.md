# Workstream F report (seeding framework, project settings, market and shipping)

## Done
F-01 ... F-15. `npm run verify` passes on the branch (11 steps). Every scenario row of F's table has a test named after the scenario title (`config.test.ts`, `validate.test.ts`, `reconcile.test.ts`, `seed.test.ts`, `reset.test.ts`, `reconcilers/shipping.test.ts`, `verify.test.ts`, `project-settings.test.ts`). 103 seed tests in `site/scripts/seed/`.

Live commands were run for real against `spec-test-b2c-telecom` (see Findings): `seed:settings --check-only`, `seed:cleanup --list`, `seed:cleanup --execute` (no-op), `seed:plan`, `seed` (twice), `seed:verify`, `seed:reset` (dry run only), `seed -- --confirm-project wrong-key` (exit 2).

## Not done / blocked
- The two Malva shipping methods `malva-shipping-standard` and `malva-delivery-digital` are **not yet in the project**. The platform rejects their predicates (`Unknown field 'attributes.offer-kind'`) until a product type defines `offer-kind` with `savedToLineItem: true` (workstream G). The seeder skips them with a clear reason (exit 4) and creates them in the first `seed` run after G's product types exist. C-F-2 can only be run after G. Nothing else is open.
- F-14 asked to stop for OA-04: not applicable (OA-04 was approved and executed by the orchestrator on 2026-10-07; the script's own gate accepts that status).

## Questions for the owner
- Q1 (for the orchestrator/G): shipping methods depend on G's product types (see above). Confirm that G's first live seed is also the moment the shipping methods appear, and that C-F-2 moves behind G in the verification order.
- Q2: Product Search was activated now (project has no products), as the plan's F-15 requires. When G creates its six product types the platform does a full reindex (about 15 minutes, per docs); G's `waitForSearchIndex` already waits for it. Accepted?

## Missed features and deviations
- **OA-04 gate** accepts a status cell whose first word is `APPROVED` or `DONE` (the real cell reads `APPROVED and EXECUTED 2026-10-07 (...)`, the plan said "exactly").
- **F-12 and F-13** are one file written together (`cleanup-furniture.ts`); the F-12 commit holds the code and all tests, the F-13 commit only ticks the box. The `--execute` path appends no "what the cleanup deleted" counts to `PROJECT-FINDINGS.md` itself (the orchestrator's one-off cleanup is already recorded there; a future real run would be recorded by hand).
- **Cleanup stop rule** "any other product type present stops the script": implemented as "products of a product type that is neither one of the three nor `malva-*`", otherwise a re-run after G's seeding would stop forever. Deletion uses ids (`DELETE /<collection>/<id>`) because sample entries may have no key.
- **Search status field**: the plan says `searchIndexing.products.status`; the live project reports the Product Search API at `searchIndexing.productsSearch.status` (`products` is the deprecated Product Projection Search index). All code uses `productsSearch`.
- **Validation of predicates**: `validateManifest` checks predicate attribute names against the product types of the manifest and the project only when at least one product type exists anywhere (before G there are none; the planner then skips the dependent resources, see above). Once types exist, an unknown attribute is a validation error (exit 3), as specified.
- `diff(existing, draft, ctx?)` got an optional third `ctx` parameter (needed to map shipping countries to adopted zone keys). `zoneCoverage` drafts use the country code as `key`; `ctx.zoneKeys` is filled by `diff` (adopted zone) or `create`. A `SkipError` class (types.ts) lets a reconciler turn a platform refusal into `skipped` (used for a duplicate cart discount `sortOrder`, naming the other discount). `planAll(api, manifest, reconcilers, ctx?, knownAttributes?)` and `applyPlan(api, manifest, plan, reconcilers, ctx)` are the engine signatures.
- `CtApi` paths are relative to the project (`''` is the project itself). A POST ending in `/search` does not count as a write.
- `DEMO_MODE`: `lib/ct/env.ts` is a re-export of `env-core.ts`, so the append is `isDemoMode(source)` in `lib/ct/env-core.ts` (E's `Env` type and `validateEnv` are untouched, so no E test changes) plus an optional `DEMO_MODE=` line in `.env.example`.
- `.env.seed` of the owner uses `CTP_*` names. `loadSeedEnv` maps values read from that file to `CTP_SEED_*`; the process environment's `CTP_*` (storefront) variables are never used. Documented in `.env.seed.example` (names only, `CTP_SEED_*`).
- Extra files beyond the plan: `scripts/seed/cli.ts` (args, exit-code mapping), `manifest.ts` (`buildManifest`, G appends its kinds), `reconcilers/util.ts`, `test/fixtures.ts`, `lib/config/demo.ts`, `lib/config/shipping.ts`.
- `seed:reset`: `--demo` alone resets only the demo data; `--demo --with-manifest` does both. Dry run (no `--yes`) still needs `--confirm-project`. Category `assets` actions (`addAsset`, ...) are not implemented (no data uses them).
- Update-action names were verified against the OpenAPI for product types, cart discounts and recurring orders (`setRecurringOrderState` with `recurringOrderState: { type: 'canceled', reason }`). The action names of shipping methods, types, tax categories, customer groups, recurrence policies, categories, discount codes, products and inventory are the plan's and were not re-checked; only the live-verified paths (tax category create, customer group create, recurrence policy create, project update) ran against the real API. Update paths of those reconcilers ran only against the fake.
- A transient `next build` failure (Google font download inside `next/font`) happened once during `npm run verify`; the rerun passed.

## TODOs for other workstreams
- **G**: define product type `malva-offer` (or the one that carries it) with attribute `offer-kind` (enum values `base-package`, `equipment`, `device`, `bundle`, `addon`), `savedToLineItem: true`, then re-run `npm run seed -- --confirm-project spec-test-b2c-telecom`: the shipping methods are created. Prove the backtick escape with `matching-cart` (G-18); if rejected switch both predicates in `data/shipping.ts`.
- **G**: append reconcilers to `reconcilers/registry.ts`, kinds to `manifest.ts`, `checks/catalog.ts` to `checks/index.ts`, categories parents first (validated), SKU/price keys unique (validated), published products get a `taxCategory` (check `every product taxable`). Reuse `test/fake-ct.ts` (supports products, variants, prices, categories, discounts, custom types, search) and `test/fixtures.ts`. The wait for the search index uses the product keys of the manifest.
- **U/M**: keep only shipping methods whose key starts with `MALVA_SHIPPING_KEY_PREFIX` (`lib/config/shipping.ts`); the sample `standard-shipping` and `express-shipping` still exist.
- **BFF workstreams**: stamp `demoMarker` (`DEMO_MARKER_FIELD`/`DEMO_MARKER_VALUE` from `lib/config/demo.ts`) on carts, orders, customers when `isDemoMode()`; G defines the custom field on `malva-cart`, `malva-order`, `malva-customer`.
- **Orchestrator**: run `node plan/verify-plan.mjs --sync` (STATUS counts for E and F), update `PROJECT-FINDINGS.md` baseline line about `searchIndexing.products` if wanted, and move the shipping finding forward to G.

## Findings
- Seed client reads (zones, stores, orders, carts, customers, channels, product types, products, inventory, categories, discounts) work without `manage_zones`, `manage_stores`, `manage_orders`.
- Project after F: tax category `malva-telecom-services` (US and DE rate 0, US `includedInPrice:false`, DE `true`), customer groups (4), recurrence policy `malva-monthly`, zones adopted `US=usa`, `DE=europe`, Product Search **Activated** (`searchIndexing.productsSearch.status`). Orders/carts/customers/stores/products/categories/inventory: 0; sample shipping methods and `standard-tax` untouched.
- Shipping predicate over an undefined attribute is rejected at creation: `Unknown field 'attributes.offer-kind'.` (details in `PROJECT-FINDINGS.md`).
- Activation response: no visible `Indexing` state; `productsSearch.status` was `Activated` right after the update (zero products).
- `seed:verify` live output: PASS for market settings, product search active, tax rates, every product taxable, shipping (deferred note), recurrence, customer groups, furniture removed, intended assortment; `All checks passed.`
- Exit codes seen live: `seed` 1 (the first attempt, shipping failure, before the skip logic), then 4 (skipped shipping), `seed -- --confirm-project wrong-key` 2, `seed:cleanup --execute` 0.
- `git ls-files`: no `.env.seed`, no `.backup/` (none created: the delete set was empty); `check:secrets` passes inside `verify`.

## Manual tests added
None.

## Junior design choices
None (no UI). Technical choices: the plan output wording (`would create/update/unchanged/skip`), the deferral of the shipping check, and the `--with-manifest` flag are mine.

## Chrome checks ready
C-F-1 (all totals are 0 now: product types, categories, inventory, products), C-F-3 (tax category, recurrence policy, four customer groups), C-F-4 (read_project: `productsSearch.status` Activated; countries GB, DE, US still enabled; the `read_product_search` part waits for G), C-F-5 (`seed -- --plan` all unchanged except the two skipped shipping methods; `seed:verify` passes; `--confirm-project wrong-key` exit 2), C-F-6. **C-F-2 is not ready** (shipping methods appear after G).
