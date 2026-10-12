<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream D: Seed 1, framework, project settings, sample-data cleanup, platform model

**Goal:** a safe, idempotent, testable seed package, a project that is configured (Product Search on, tax fallback on), free of the sample data, and holding the platform model the sites rely on (tax, zones, shipping, product types, categories, the custom types and the `ready-for-pickup` order state, channels, recurrence policies, vehicle table).
**Depends on:** A (repository and tooling exist)
**Implements:** (none: seed scripts, see `plans/SEED-PLAN.md` sections 2 to 6)
**Specs served:** `consumer-storefront/bootstrap-and-structure` and `seller-portal/bootstrap-and-structure` (project key and settings the apps read), `consumer-storefront/design-vehicle-finder-and-garage` (vehicle table, garage field), `consumer-storefront/design-product-listing-page` (searchable attributes), `consumer-storefront/design-store-picker` and `seller-portal/design-store-and-channels` (branch and store custom types), `seller-portal/design-customers-and-subscriptions` (recurrence policies, `malva-customer`), `design-returns-and-reviews` (`malva-return-item`), `consumer-storefront/design-checkout-page` and `design-order-confirmation-page` (`malva-checkout`, `ready-for-pickup`). Dropped by Q-V01 (wholesale out of scope, no data here): `design-price-lists-and-saved-lists` (customer groups), `design-orders-quotes-invoices`, `design-quick-order-and-cart`, `design-approvals-and-roles`.

**Owner answers applied (2026-10-12, `plans/notes/owner-answers.md`):** Q-003 prices are standalone (D only adds the `prices` ordering, E owns the data); Q-V01 no customer groups, no wholesale types or fields; Q-O03 no territory field; Q-P01 no email data; Q-T06 no review container; Q-J04 garage is a customer custom field.
**Skills:** commercetools-platform, commercetools-commerce-patterns (catalog architecture, pricing models), commercetools-catalog-migration (key rules, irreversible product type choices)

## Design decisions

1. Package `seed/`, TypeScript, ESM, Node 20+; SDK `@commercetools/platform-sdk` ^8 and `@commercetools/ts-client` ^4 (design open question J). No framework: plain scripts run by `tsx`.
2. All writes go through scripts using an API client from `seed/.env.local` (git-ignored; only `.env.example` is committed). The `b2b2c-automotive` MCP has no delete tools and is used **read only**.
3. Safety: key prefix `mau-`; `EXPECTED_PROJECT_KEY` typed twice guard plus the key the API reports; refuse `healthcare`; `--dry-run` everywhere; cleanup only by explicit allow-list (`src/data/sample-allowlist.ts`), never by pattern, refuses `mau-` keys, needs `--confirm <projectKey>`.
4. Every step talks to a thin `Api` interface (`src/api.ts`). Tests use an in-memory `FakeApi` (`src/fake-api.ts`) that checks versions (409), unresolved key references (400), referential integrity on delete and unknown update actions. `seed --dry-run --offline` runs the whole seed on it without credentials.
5. Idempotent by read-compare-write (`src/sync.ts` plans, `src/seed.ts` applies); second run must report 0 changes.
6. Product types: attributes searchable and flat (fitment as set of text). Irreversible choices: attribute constraint `None` everywhere (one variant per product), enums for brand and quality tier (new values can be added later).
7. Project settings: `changeProductSearchIndexingEnabled` (mode `ProductsSearch`) and wait for `Activated`; `changeCountryTaxRateFallbackEnabled true` kept. Languages, countries and currencies of the project are not changed.
8. Tax: DE 19 % included, GB 20 % included, US 0 % placeholder (Q-S02). Pickup in store is a shipping method with a zero rate (semantic in SEED-PLAN 3.6).
9. **Custom types, one per resource kind** (a resource has one custom type): `store-settings` (store, includes location fields and `returnWindowDays`, also what P and Q call `malva-store`), `branch-info` (channel), `malva-checkout` (cart and order, with `deliveredAt`), `malva-line` (line item), `malva-customer` (customer: garage JSON, mobile, consent; also what J calls `customer-garage`), `malva-return-item` (order return item, statuses requested, in-transit, received, inspected, refunded, rejected), plus `mau-business-unit-fields` and `mau-cart-discount-fields`. These contract keys are the only seed keys without the `mau-` prefix (`CONTRACT_KEYS`), together with the order state `ready-for-pickup`; `reset` accepts exactly these. Nothing for wholesale (no PO number, payment terms, credit, approval), territories, or a review or outbox container.
10. Order state `ready-for-pickup` (`states` step), no transitions defined so nothing validates the move into it.
11. Standalone prices are deleted by `reset` before channels (they reference them); `isSeedPriceKey` is the guard (key scheme `<sku>__...` and a seeded SKU), never a pattern on foreign keys.

## Tasks

- [ ] D-01 Package skeleton: `seed/package.json` (scripts `seed`, `seed:settings`, `seed:cleanup`, `seed:images`, `verify`, `reset`, `check`, `test`, `lint`), `tsconfig.json`, `vitest.config.ts`, `.gitignore` (`.env*`), `.env.example` (names only), `README.md` [SKILL: commercetools-platform]
- [ ] D-02 `seed/src/lib.ts`: env loading with `SEED_CTP_*` (and unprefixed fallbacks), `assertSafeProject`, `getAdmin()` building the client and confirming the remote key, `Runner` (counts, dry-run), `parseArgs`; test in `src/lib.test.ts` (missing variable named without value, mismatch, `healthcare`, dry-run performs nothing) [SKILL: commercetools-platform]
- [ ] D-03 `seed/src/api.ts` (`Api`, `sdkApi`) and `seed/src/fake-api.ts` (`FakeApi`); tests prove 409 on stale version, 400 on unknown reference, delete refused while referenced [SKILL: commercetools-platform]
- [ ] D-04 `seed/src/settings.ts` and `npm run seed:settings`; tests: emits exactly the two actions, nothing when satisfied, waits then Activated, times out, dry-run writes nothing [SKILL: commercetools-platform]
- [ ] D-05 `seed/src/data/sample-allowlist.ts` (72 products, 42 categories, 3 product types, 2 shipping methods, tax category, 2 zones, 8 channels, 4 discounts, 4 recurrence policies, 7 standalone-price SKUs) and `seed/src/cleanup.ts`; tests in `src/cleanup.test.ts`: only listed resources, counts, valid deletion order, survivors, dry-run, `mau-` refused [SKILL: commercetools-platform]
- [ ] D-06 `seed/src/data/{base,tax-shipping,product-types,categories,custom-types,states,vehicles,extras}.ts` (platform model, 8 systems and 24 groups, 8 custom types with the contract keys, order state `ready-for-pickup`, 26 vehicle records with year ranges, 3 recurrence policies) and `seed/src/data/org.ts` parts for channels (branches with both roles); tests in `src/data.test.ts`: custom types and their fields, one type per resource kind, no territory, wholesale, PO, payment-terms, approval or email data, contract keys defined [SKILL: commercetools-commerce-patterns]
- [ ] D-07 `seed/src/seed.ts` steps `settings`, `tax-shipping`, `product-types`, `categories`, `types`, `states`, `channels`, `recurrence`, `vehicles` with `--only`, `--dry-run`, `--offline`; test that the full run is idempotent [SKILL: commercetools-commerce-patterns]
- [ ] D-08 `seed/src/reset.ts` (explicit seed keys, standalone prices first, reverse order) with test that reset then seed rebuilds and that sample data and foreign standalone prices survive [SKILL: commercetools-platform]
- [ ] D-09 Live run (needs OA-01): `seed:cleanup --dry-run`, review counts, `seed:cleanup --confirm spec-test-b2b2c-automotive`, `seed:settings`, `seed --only settings,tax-shipping,product-types,categories,types,states,channels,recurrence,vehicles`; record output (no secrets) [SKILL: commercetools-platform]
- [ ] D-10 Claude reads the project back through the MCP (recipe below) and attaches the results; second `seed` run reports 0 changes [SKILL: commercetools-platform]

## Test scenarios

| # | Scenario | Given | When | Then |
| --- | --- | --- | --- | --- |
| D-S1 | Wrong project | `EXPECTED_PROJECT_KEY` differs | any script starts | aborts before any request, message names both keys |
| D-S2 | Health project | key contains `healthcare` | any script starts | refused |
| D-S3 | Settings off | indexing Deactivated | `seed:settings` | indexing enabled, waits for Activated, fallback stays true |
| D-S4 | Settings on | already Activated | `seed:settings` | 0 changes |
| D-S5 | Cleanup scope | sample data plus a customer product | `seed:cleanup` | only allow-listed resources deleted, customer product and sample roles survive, counts printed |
| D-S6 | Cleanup order | categories 3 deep, channels used by prices | `seed:cleanup` | no failure: prices before channels, children before parents |
| D-S7 | Prefix guard | a listed key starts `mau-` | plan | refused, nothing deleted |
| D-S8 | Cleanup dry run | any | `--dry-run` | prints `would delete`, writes nothing |
| D-S9 | Idempotent | seed ran | second `seed` | `0 change(s)`, no write |
| D-S10 | Order | `--only products` on an empty project | run | fails with an unresolved reference |
| D-S11 | Offline plan | no credentials | `seed --dry-run --offline` | prints the full plan, 622 changes |
| D-S12 | Contract keys | seed data | key test | every key has `mau-` except the contract type keys and the `ready-for-pickup` state, all of which are defined by the seed |
| D-S13 | One type per resource | the type drafts | test | no resource type id appears twice; `malva-checkout` covers cart and order |
| D-S14 | Dropped features | the seed | test | no wholesale store, customer group, territory, PO, payment-terms, approval, outbox or review data |

## Browser / MCP recipe

No UI. After D-09, Claude reads (never writes) through `mcp__b2b2c-automotive__*`:
1. `read_project`: `searchIndexing.productsSearch.status = Activated`, `carts.countryTaxRateFallbackEnabled = true`.
2. `read_products limit 1`, `read_categories` (where `key = "mau-cat-brakes"`), `read_product_types`, `read_shipping_methods`, `read_tax_categories`, `read_zones`: no sample key remains (`total` of products is 0 before E), seed keys exist.
3. `read_types` (8 seed types: `store-settings`, `branch-info`, `malva-checkout`, `malva-line`, `malva-customer`, `malva-return-item`, `mau-business-unit-fields`, `mau-cart-discount-fields`), `read_states` (`ready-for-pickup`), `read_channels` (9: 1 warehouse + 2 retail + 6 branches, branches with roles `InventorySupply` and `ProductDistribution`), `read_recurrence_policies` (3). No customer groups are seeded.
4. `read_custom_objects container=mau-vehicles`: 26 objects.
5. Re-run `npm run seed` and `npm run verify` (verify is only partly green until E and F: it also checks products and stores).

## Definition of done

`cd seed && npm ci && npm run check` green on a clean clone; `seed --dry-run --offline` prints the plan; steps D-09 and D-10 done with evidence; second `seed` run reports 0 changes; project settings read back; no non-allow-listed resource deleted (counts before and after match the allow-list); README states the run order and the safety rules.

## Evidence to record (in `plans/evidence/D/`, no secrets)

`npm run check` output; `seed:cleanup --dry-run` counts table; `seed:cleanup` log; `seed:settings` log with the Activated wait; MCP read-back JSON excerpts (project settings, counts per kind); second-run output with `0 change(s)`.

## Questions to the owner (defaults apply until answered)

| ID | Question | Default |
| --- | --- | --- |
| Q-S02 | US tax: 0 % placeholder or state rates? | 0 % placeholder |
| Q-S07 | Delete standalone prices, channels, discounts, recurrence policies of the sample too? Keep sample associate roles? | Delete them except roles |
| Q-S13 | Env variable naming | `SEED_CTP_` prefix, unprefixed accepted |
| Q-S14 | Contract type and state keys without the `mau-` prefix (the apps hard-code them)? | Yes, listed in `CONTRACT_KEYS`; alternative: prefix everything and edit the plans of I, J, O, P, Q, U, W |
| OA-01 | Seed API client in `seed/.env.local` | needed before D-09 |
