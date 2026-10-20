<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream B: Seed foundation (guards, fake API, settings, cleanup, tax, shipping, channels, types, categories, policies, order states)

## 1. Header

| Field | Value |
| --- | --- |
| ID | B |
| Name | Seed foundation: review, extend, live-run and verify the platform model of the Malva Coffee project |
| Depends on | none (the seed package `seed/` has its own `.env.local`; A is not needed) |
| Wave | 1 (parallel with A) |
| Branch | `ws/b-seed-foundation`; commit `ws-B: B-12 <summary>` |
| Primary spec | `openspec/specs/platform-project-setup-and-seed/spec.md` (all requirements; C extends it with the catalogue steps) |
| Also served (data half, verified here by read-back) | `fulfilment-and-availability-model` (stores as supply channels, shipping by market, tax by market, order states, line item fulfilment type), `reviews-and-ratings` (review states, built in C) |
| Generated templates that apply | none |
| Owner prerequisites | **OA-01** (seed API client in `seed/.env.local`) for every live task B-10 to B-14; **OA-07** (review of `seed/cleanup-manifest.json` before the first delete). New rows drafted in `plans/notes/todo-B.md`: `OA-x` (seed client scope list), `SO-x` (tax rates), `SO-x` (invented store addresses), `M-B-01` |
| Skills to load first | `commercetools-platform`, `commercetools-commerce-patterns` (`taxes.md`, `bopis-shipping.md`, `high-precision-money.md`), `commercetools-catalog-migration` (key rules, irreversible product type choices), `commercetools-storefront` (`references/b2c/*` for the data the storefront will read) |

## 2. Goal and scope

**Context.** The seed package was written by another agent from `plans/SEED-PLAN.md` and has **never run against a live project** (`STATUS.md`). It sits at `seed/` (`package.json`, `src/*.ts`, `src/data/*.ts`, tests next to the code, `seed/README.md` may still be appearing). B is the **junior-facing work around it**: read it against the spec, close gaps with tests, then run it live, in a safe order, and prove with read-backs that the project holds the foundation of the platform model.

**Goal.** After B: the commercetools project has Product Search indexing `Activated`, the country tax-rate fallback on, countries/currencies/languages for US/DE/GB added, **no leftover Merchant Center sample data** (only what the reviewed manifest listed was removed), and the foundation resources exist with `mcf-` keys: tax categories, zones, shipping methods, order states, custom types, product types, categories, six store channels, four recurrence policies. A second run reports `0 change(s)`. The evidence folder proves each step.

**In scope**
- Review of: guards and env (`src/lib.ts`), fake API (`src/fake-api.ts`), settings (`src/settings.ts`), inventory and cleanup (`src/inventory.ts`, `src/cleanup.ts`), reset (`src/reset.ts`), and the foundation data files (`src/data/{base,tax-shipping,custom-types,states,product-types,categories,stores,extras}.ts`).
- Gap closing: missing scenario tests, the order-notes custom type (spec vs seed gap, Q-B-1), `.env.example` scope reasons, README run order.
- Live run of the **foundation steps** only: `settings`, `tax`, `shipping`, `states`, `types`, `product-types`, `categories`, `channels`, `recurrence`.
- Read-back and evidence.

**Out of scope (C does them)**: `products`, `prices`, `inventory`, `discounts`, `customers`, `shopping-lists`, `review-states`, `reviews`, `seed:images`, the full `verify`. Do not run those steps in B.

**Hard safety rules** (from `JUNIOR-GUIDE.md`, restated because B is where deletion exists)
1. Only the project named in `seed/.env.local` and typed again as `EXPECTED_PROJECT_KEY`. Never a project whose key contains `health`.
2. No wildcard deletes. Deletion only through a **reviewed manifest** (`seed:cleanup`) or the seed's own keys (`reset`). Never run `reset -- --confirm <key>` live in B (dry run only), and never run a delete step without the lead having the OA-07 approval in writing.
3. Secrets (`SEED_CTP_CLIENT_SECRET`, `SEED_DEMO_PASSWORD`) never appear in chat, logs, evidence or tests. The manifest file (`seed/cleanup-manifest.json`, git-ignored) contains sample customer e-mails: never copy it into `plans/evidence/`; copy only the counts table.
4. Create, update and delete of project data happen only through the seed scripts. Reads can use the commercetools MCP.

## 3. Design

### 3.1 The package as the junior finds it (read it, do not rewrite it)

| Path | Behaviour to know |
| --- | --- |
| `src/lib.ts` | `readSeedEnv` (variables `SEED_CTP_PROJECT_KEY`, `SEED_CTP_AUTH_URL`, `SEED_CTP_API_URL`, `SEED_CTP_CLIENT_ID`, `SEED_CTP_CLIENT_SECRET`, `SEED_CTP_SCOPES`, `EXPECTED_PROJECT_KEY`; optional `SEED_DEMO_PASSWORD`, `IMAGE_SOURCE_URL`), `assertSafeProject` (key equals `EXPECTED_PROJECT_KEY`, never `health`), `connect` (builds the client, then `GET project` and compares the key **the API reports**), `parseArgs` (`--dry-run --offline --only --confirm --manifest`), `Runner` (counts changes, prints `would ...` in dry run) |
| `src/api.ts`, `src/fake-api.ts` | Thin `Api` interface over the SDK (`getByKey`, `getById`, `list`, `create`, `update`, `remove`, `verifyCustomerEmail`, `getProject`, `updateProject`) and an in-memory fake that enforces versions (409), unresolved key references (400) and reference-exists on delete |
| `src/sync.ts` | Pure planners: from "what exists" and "what the seed wants" to update actions (`[]` means in sync). This is what makes the run idempotent |
| `src/seed.ts` | Steps in order: `settings`, `tax`, `shipping`, `states`, `types`, `product-types`, `categories`, `channels`, `recurrence`, `products`, `prices`, `inventory`, `discounts`, `customers`, `shopping-lists`, `review-states`, `reviews`. `--only a,b` runs just those; a step whose prerequisite is neither in the run nor in the project is **skipped and reported** (exit code 1), never created silently. Prints `plan by step` and `N change(s)` |
| `src/settings.ts` | `npm run seed:settings`; sends only the missing actions; waits for `Activated` (poll 5 s, timeout 15 min) |
| `src/inventory.ts` | `npm run seed:inventory`: reads 17 kinds, writes `seed/cleanup-manifest.json` (type, ref, id, key, name, version, depth; counts; `skippedSeedOwned`); seed-owned keys are only counted; built-in states skipped; orders and carts never listed |
| `src/cleanup.ts` | `npm run seed:cleanup -- --manifest <file> [--dry-run] --confirm <key>`; refuses before any request: wrong `--confirm`, manifest for another project, manifest older than 24 h; refuses every `mcf-` entry; deletes in `DELETE_ORDER`; unpublishes a product before deleting; retries failures up to 3 passes |
| `src/reset.ts` | `npm run reset -- --dry-run` / `--confirm <key>`: deletes only the seed's own keys (prefix or `CONTRACT_KEYS`) in reverse order |
| `src/verify.ts` | `npm run verify`: read-back of the whole seed; exits 1 with `PROBLEM ...` lines. Until C has run live it **reports products, prices, inventory, discounts, customers and reviews as missing**: that is expected after B |
| `src/data/*.ts` | The platform model (sections 3.3 and 3.4). Keys come from `K` in `data/base.ts` |
| Scripts in `package.json` | `check` (`tsc --noEmit && vitest run`), `seed`, `seed:settings`, `seed:inventory`, `seed:cleanup`, `seed:images`, `verify`, `reset` |

Facts verified while planning (2026-10-19): `cd seed && npx vitest run` showed 64 passed and 1 failing test in `src/verify.test.ts` (`checkProduct finds a missing locale and an unpublished product`). The seed was still being written; the junior's first task records the state and does **not** edit a test to make it pass.

### 3.2 Live run order (the only order to use)

All commands from `cd seed`. Replace `<key>` with the project key (read it from your own `.env.local`; do not echo the secret lines).

| # | Command | Writes? | Expected |
| --- | --- | --- | --- |
| 1 | `npm run check` | no | green (offline) |
| 2 | `npm run seed -- --dry-run --offline --only settings,tax,shipping,states,types,product-types,categories,channels,recurrence` | no | prints the full plan for a fresh project; ends `N change(s)` |
| 3 | `npm run seed:settings -- --dry-run` | no | connects (guards pass) and prints the actions it would send |
| 4 | `npm run seed:inventory -- --dry-run` | no | counts table, `dry run: manifest not written` |
| 5 | `npm run seed:inventory` | writes the local manifest file only | counts table, manifest written |
| 6 | **OA-07**: the owner reviews the manifest and approves in writing | | |
| 7 | `npm run seed:cleanup -- --manifest cleanup-manifest.json --dry-run` | no | `type / to delete` table, no write, `0 failed` |
| 8 | `npm run seed:cleanup -- --manifest cleanup-manifest.json --confirm <key>` (within 24 h of step 5) | **deletes manifest entries** | `N deletion(s), 0 failed, 0 refused` |
| 9 | `npm run seed:settings` | project settings | `Product Search indexing is Activated`; `N change(s)` |
| 10 | `npm run seed -- --only settings,tax,shipping,states,types,product-types,categories,channels,recurrence` | foundation resources | `N change(s)`, no `SKIPPED` line |
| 11 | the same command again | none | `0 change(s)` |

If step 8 reports failures (a resource still referenced): do not loop. Follow section 3.7.

### 3.3 What each foundation step sends (so you can read the response against it)

| Step | Resource and SDK call | Create or update actions | Docs |
| --- | --- | --- | --- |
| `settings` | `apiRoot.get()` then `apiRoot.post({ body: { version, actions } })` | `changeProductSearchIndexingEnabled { enabled: true, mode: 'ProductsSearch' }`; `changeCountryTaxRateFallbackEnabled { countryTaxRateFallbackEnabled: true }`; `changeLanguages`, `changeCountries`, `changeCurrencies` with the existing entries plus the missing ones (add only) | https://docs.commercetools.com/api/projects/project |
| `tax` | `taxCategories()` `.post` / `.withId().post` | create with `rates`; updates `addTaxRate`, `replaceTaxRate`, `removeTaxRate` | https://docs.commercetools.com/api/projects/taxCategories |
| `shipping` | `zones()` then `shippingMethods()` | create; updates `addZone`, `addShippingRate`, `removeShippingRate`; each zone rate has `price` and `freeAbove` | https://docs.commercetools.com/api/projects/zones , https://docs.commercetools.com/api/projects/shippingMethods |
| `states` | `states()` (type `OrderState`) | create with `transitions` (targets created first); `setTransitions` | https://docs.commercetools.com/api/projects/states |
| `types` | `types()` | create `mcf-line-fulfilment` (line-item, enum `fulfilment`) and `mcf-store` (channel); updates `addFieldDefinition` | https://docs.commercetools.com/api/projects/types |
| `product-types` | `productTypes()` | create with attribute definitions; updates `addAttributeDefinition` (never removes or changes a constraint: those are irreversible) | https://docs.commercetools.com/api/projects/productTypes |
| `categories` | `categories()` | create with slugs in en-US, en-GB, de-DE, `orderHint`, `parent` by key; updates `changeName`, `addAsset` (images, in C) | https://docs.commercetools.com/api/projects/categories |
| `channels` | `channels()` | create with `roles: ['InventorySupply']`, `address`, `geoLocation`, `custom` (type `mcf-store`); updates `setCustomField` etc. | https://docs.commercetools.com/api/projects/channels |
| `recurrence` | `recurrencePolicies()` | create `schedule: { type: 'standard', value, intervalUnit }` | https://docs.commercetools.com/api/projects/recurrence-policies |

Product Search note (https://docs.commercetools.com/api/projects/product-search): creating or changing a **Product Type** triggers a full reindex (about 15 minutes on average). That only matters once products exist.

### 3.4 Expected end state after B (what the read-back must show)

| Resource | Expected count and content |
| --- | --- |
| Project | `searchIndexing.productsSearch.status = Activated`; `carts.countryTaxRateFallbackEnabled = true`; `countries` include `US DE GB`; `currencies` include `USD EUR GBP`; `languages` include `en-US en-GB de-DE`; nothing removed |
| Tax categories | 2: `mcf-tax-food` (US 0%, DE 7% included, GB 0% included), `mcf-tax-standard` (US 8% country rate, US-NY 8.875%, DE 19% included, GB 20% included). US `includedInPrice: false`, DE and GB `true` |
| Zones | 3: `mcf-zone-us`, `mcf-zone-de`, `mcf-zone-gb` (one country each) |
| Shipping methods | 3: `mcf-ship-standard` (US 6.95 USD free above 75.00; DE 4.90 EUR free above 60.00; GB 3.95 GBP free above 50.00; `isDefault: true`), `mcf-ship-express` (14.95 / 12.90 / 9.95), `mcf-collect` (0 in each zone). Tax category `mcf-tax-standard` |
| Order states (`mcf-` prefix) | 4: `mcf-order-ordered` (initial), `mcf-order-preparing`, `mcf-order-ready-for-collection`, `mcf-order-collected`; transitions ordered to preparing to ready to collected. Review states come in C |
| Custom types | `mcf-line-fulfilment` (resource `line-item`, field `fulfilment` enum `collect`, `ship`, `subscribe`), `mcf-store` (resource `channel`, fields `addressLine`, `city`, `postalCode`, `phone`, `hours`, `collectionMinutes`), plus `mcf-order-notes` if Q-B-1 is applied |
| Product types | 5: `mcf-pods`, `mcf-coffee`, `mcf-machine`, `mcf-accessory`, `mcf-gift-set` with the attributes of `SEED-PLAN.md` section 6 |
| Categories | 20 (`mcf-cat-pods` with 2 children, `mcf-cat-coffee` 4, `mcf-cat-machines` 5, `mcf-cat-accessories` 4, `mcf-cat-gifts`), each with slugs in the three languages |
| Channels | 6 with role `InventorySupply`: `mcf-store-nyc-soho`, `mcf-store-brooklyn`, `mcf-store-berlin-mitte`, `mcf-store-munich`, `mcf-store-london-soho`, `mcf-store-manchester`; each with `address.country`, `geoLocation` Point `[lng, lat]`, custom fields incl. `hours` (JSON text by weekday) and `collectionMinutes` (30, 45, 30, 45, 20, 30) |
| Recurrence policies | 4: `mcf-every-2-weeks` (Weeks 2), `mcf-every-month` (Months 1), `mcf-every-2-months` (Months 2), `mcf-every-3-months` (Months 3) |
| Everything else | No Merchant Center sample resource remains that the approved manifest listed; orders and carts are untouched; anything the owner removed from the manifest is still there |
Counts of categories (20) were read from `seed/src/data/categories.ts`; if a count in the data file has changed by the time you run, trust the data file and write the new number in the evidence README.

### 3.5 Read-back (no owner needed)

With the commercetools MCP connected (OA-06): list its tools first (`ToolSearch` with `commercetools`). Use the **read** tools only. Equivalent REST reads through the SDK (what the MCP does underneath) for when you write a throwaway read-only script (never in `check`):

| Read | Call | Check |
| --- | --- | --- |
| Project | `apiRoot.get()` | the four settings rows of 3.4 |
| One resource by key | `apiRoot.<resource>().withKey({ key }).get()` (resources: `taxCategories`, `zones`, `shippingMethods`, `states`, `types`, `productTypes`, `categories`, `channels`, `recurrencePolicies`) | fields of 3.4 |
| Seed-owned list | `apiRoot.<resource>().get({ queryArgs: { where: 'key in ("mcf-...", ...)', limit: 100 } })` | `total` equals the count of 3.4 |
| Nothing foreign left | `apiRoot.<resource>().get({ queryArgs: { limit: 1, withTotal: true } })` for each kind of the manifest (products, product types, categories, discounts, shipping methods, zones, tax categories, channels, types, recurrence policies, states) and compare `total` with the number of `mcf-` resources you expect for that kind (and, for states, add the built-in states) | products `total = 0` until C; every other kind equals the counts of 3.4 plus anything the owner kept in the manifest review |
| Channels | `apiRoot.channels().get({ queryArgs: { where: 'roles contains any ("InventorySupply")' } })` | exactly the 6 stores |

Query predicate reference: https://docs.commercetools.com/api/predicates/query.

### 3.6 Evidence (`plans/evidence/B/`, no secrets, no personal data)

`check.txt` (output of `npm run check`), `scenario-map.md` (B-02), `offline-plan.txt`, `settings-dry-run.txt`, `inventory-counts.txt` (counts table only), `cleanup-dry-run.txt`, `cleanup-run.txt` (count lines and `REFUSED` lines, not entity names that are personal data), `settings-run.txt`, `seed-foundation-1.txt`, `seed-foundation-2.txt` (the `0 change(s)` run), `readback-<resource>.json` (keys, ids and the checked fields only), `README.md` (one line per file saying what it proves).

### 3.7 When a response differs from this file

Stop the step, do not loop, and:
1. Write a dated row in `plans/PROJECT-FINDINGS.md` (what you sent: action names and resource, what came back: status code and error `code`; no secrets).
2. Fix it only if it is a seed-code defect inside B's scope (a wrong field in a draft, a wrong action name): write a failing offline test first (teach `FakeApi` the rule if needed), fix, `npm run check`, commit `ws-B: <task> fix <what>`, re-run the step (it is idempotent).
3. If the fix touches deletion logic, scopes, or anything the lead must decide: write the question and tell the lead; keep the default.

| Symptom | First action |
| --- | --- |
| 403 `insufficient_scope` naming a scope | Add the scope row `OA-x` (B1) and tell the owner which scope the error named; do not try other credentials |
| 400 `InvalidField` / `InvalidOperation` on a draft | Read the error `message`; compare with the docs page of 3.3; fix the draft with a test |
| 409 `ConcurrentModification` | Re-run the step (the planners re-read) |
| 429 | Wait a minute, re-run (the scripts pause 80 to 100 ms between writes) |
| Delete fails with a reference error (for example a tax category still used) | It is listed in `FAILED` lines. Do not widen the manifest. Record it, tell the lead; the owner decides (OA-07) |
| `seed:settings` times out waiting for `Activated` | Read the project (`searchIndexing`), re-run `seed:settings` once; if still not `Activated`, record the last status and ask the lead |
| A step prints `SKIPPED, missing prerequisite` | You ran steps out of order; run the prerequisite steps first |

### 3.8 Review checklist for the seed (what to compare, with the spec scenario it serves)

| Area | Compare with | Check |
| --- | --- | --- |
| Guards | spec "Guards on every script" | Wrong `EXPECTED_PROJECT_KEY` aborts **before any request** and prints both keys; the key the API reports is compared; no secret is printed anywhere (grep the code for `console.` and `clientSecret`) |
| Settings | spec "Project settings" | Only missing actions are sent; countries/currencies/languages are **added**, never removed; second run sends nothing |
| Cleanup | spec "Safe cleanup of sample data" | Dependency order equals the spec (prices, products, discounts, shipping methods, tax categories, zones, categories deepest first, product types, recurrence policies, channels, custom types); manifest older than 24 h refused; `mcf-` refused and reported; built-in states not listed; products unpublished first |
| Idempotency | spec "Idempotent seed in dependency order" | Second run `0 change(s)`; `--only products,prices` without prerequisites reports and does not create |
| Ownership | spec "Seed ownership and keys" | Every key in `src/data` starts `mcf-` or is in `CONTRACT_KEYS`; `reset` deletes only those |
| Tax | `SEED-PLAN.md` section 2, spec fulfilment "Tax by market" | rates as 3.4; `includedInPrice` false for US only |
| Shipping | `SEED-PLAN.md` section 3, spec fulfilment "Shipping by market" | per-zone currency; free thresholds as `freeAbove` on standard shipping (the storefront reads them from the shipping method, not constants) |
| Product types | `SEED-PLAN.md` section 6 and the `commercetools-catalog-migration` skill | attribute constraints: `SameForAll` for product-level facts, `CombinationUnique` for variant dimensions (`capsulesPerPack`, `sizeGrams`, `grind`, `colour`, `bundle`): **irreversible**, confirm with the lead before the first live run (Q-B-13); every attribute used in listing filters has `isSearchable: true`; `badge` and `subscribable` exist on all five types |
| Categories | `SEED-PLAN.md` section 7 | slugs unique per language, order hints, parents by key, tree depth 2 |
| Channels | spec fulfilment "Stores are supply channels" | role `InventorySupply`, key `mcf-store-<city>`, localized name, address, `geoLocation`, hours and phone in custom fields |
| States | spec fulfilment "Order states for collection" | `initial` flag on `ordered`; transitions in order; review states are C |
| Types | spec fulfilment "Fulfilment per line" | `fulfilment` enum `collect|ship|subscribe` on line items |

## 4. Tasks

Run `cd seed && npm run check` before ticking a code task. `[SKILL]` tags are on every task that touches commercetools.

- [ ] **B-01 Baseline and reading** `[SKILL: commercetools-platform]`
  - Files: none changed; evidence `plans/evidence/B/check.txt`.
  - `cd seed && npm ci && npm run check` and save the output. If a test fails (today: `verify.test.ts` as noted in 3.1) write the failing test name in `plans/evidence/B/README.md`, tell the lead, and carry on with reading; do not edit tests to turn them green. Read `seed/README.md` (if present), `src/lib.ts`, `src/seed.ts`, `src/settings.ts`, `src/inventory.ts`, `src/cleanup.ts`, `src/reset.ts`.
  - Tests: none.

- [ ] **B-02 Scenario map** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/B/scenario-map.md`.
  - For each scenario of section 5, find the test with `rg -n "Scenario title" seed/src/*.test.ts` and write `scenario | test file | test name | passes`. A scenario without a test goes to B-03 to B-07 as an added test.
  - Tests: none (the map is the output).

- [ ] **B-03 Review guards and env** `[SKILL: commercetools-platform]`
  - Files: `seed/src/lib.ts`, `seed/src/lib.test.ts`.
  - Compare against checklist rows "Guards". Add tests only where missing: `Mismatched key aborts before the API is contacted` (assert no `fetch` call: inject a throwing client), `The API reporting another key aborts` (`assertRemoteKey`), `Keys containing health are refused`, `No script prints SEED_CTP_CLIENT_SECRET` (read all `src/**/*.ts` and assert no `console.*` argument references `clientSecret` or `SEED_DEMO_PASSWORD`).
  - Tests named after spec: `Mismatched key`.

- [ ] **B-04 Review settings** `[SKILL: commercetools-platform]`
  - Files: `seed/src/settings.ts`, `seed/src/lib.test.ts`.
  - Compare with 3.3 row `settings` and the docs page https://docs.commercetools.com/api/projects/project#change-product-search-indexing-enabled . Confirm the field of `changeCountryTaxRateFallbackEnabled` is `countryTaxRateFallbackEnabled` in the OpenAPI schema (`commercetools-oas-schemata`, resource `api-Project`). Add tests if missing: `Fresh project`, `Dry run`, `Second run reports nothing to change`, `Existing countries are kept when adding US DE GB`.
  - Tests named after spec: `Fresh project`, `Dry run`.

- [ ] **B-05 Review inventory and cleanup safety** `[SKILL: commercetools-platform]`
  - Files: `seed/src/inventory.ts`, `seed/src/cleanup.ts`, `seed/src/cleanup.test.ts`.
  - Compare with the checklist row "Cleanup". Add tests if missing: `Review before delete`, `Wrong confirmation`, `Seed data protected`, `Cleanup refuses a manifest older than 24 hours before any request`, `Customers and shopping lists appear in the manifest counts so the owner sees them` (the sample project may hold customers: the table must show their count), `Orders and carts are never listed`. Add one line to the manifest counts output reminding "orders and carts are never touched by cleanup (Q-B-2)".
  - Tests named after spec: `Review before delete`, `Wrong confirmation`, `Seed data protected`.

- [ ] **B-06 Review the foundation data** `[SKILL: commercetools-commerce-patterns]`
  - Files: `seed/src/data/{tax-shipping,custom-types,states,product-types,categories,stores,extras}.ts`, `seed/src/data.test.ts` (create if absent).
  - Walk the checklist rows Tax, Shipping, Product types, Categories, Channels, States, Types against `plans/SEED-PLAN.md` and 3.4. Add a data test per row that asserts the numbers of 3.4 (`Tax rates are 0, 7, 0 for food and 8, 8.875, 19, 20 for standard`, `US prices are tax-exclusive and DE and GB inclusive`, `Standard shipping thresholds are 75, 60 and 50`, `Collect costs nothing in all zones`, `Every store is an InventorySupply channel with geo location and hours`, `Order states are in transition order and ordered is initial`, `Slugs exist in en-US, en-GB and de-DE for every category`, `Constraint choices: variant dimensions are CombinationUnique`).
  - Tests: as listed.

- [ ] **B-07 Close the spec gaps** `[SKILL: commercetools-platform]`
  - Files: `seed/src/data/custom-types.ts`, `seed/src/data/base.ts` (`K`, `CONTRACT_KEYS`), `seed/src/data.test.ts`, `seed/src/verify.ts`.
  - The spec "Idempotent seed in dependency order" lists custom types "(line item fulfilment, order notes)"; the seed has the line item type and the store channel type but **no order notes type**. Default (Q-B-1): add `mcf-order-notes`, `resourceTypeIds: ['order']`, one field `note` (`String`, `inputHint: 'MultiLine'`, not required, labels en/de), key `K.typeOrderNotes`, listed in `CONTRACT_KEYS`; `verify` checks it. Write the failing data test first (`Custom types include line item fulfilment and order notes`), then the draft.
  - Also confirm (read-only) that `README` and `seed.ts` doc comments agree about steps and flags; fix wording only.
  - Tests: `Custom types include line item fulfilment and order notes`, `Contract keys are all defined by the seed`.

- [ ] **B-08 `.env.example` scope reasons and README** `[SKILL: commercetools-platform]`
  - Files: `seed/.env.example`, `seed/README.md`.
  - `.env.example`: every variable of 3.1 with an empty value and a comment; `SEED_CTP_SCOPES` with one `# <scope> : <reason>` line per scope, verified against https://docs.commercetools.com/api/scopes . Starting list (check each name on that page, remove any that does not exist, add any the live run asks for): `manage_project_settings` (settings), `manage_products` (products, product discounts, inventory, reviews), `manage_categories`, `manage_product_types`, `manage_channels`, `manage_tax_categories`, `manage_shipping_methods`, `manage_zones`, `manage_types`, `manage_states`, `manage_cart_discounts`, `manage_discount_codes`, `manage_recurrence_policies`, `manage_customers`, `manage_shopping_lists`. `manage_orders` is **not** listed (the seed never touches orders or carts).
  - README: purpose, Node version, `cp .env.example .env.local`, the live run order of 3.2, the safety rules of section 2, what each script prints, "never commit `.env.local` or `cleanup-manifest.json`", `seed/.gitignore` containing `.env*` (with `!.env.example`), `cleanup-manifest.json`.
  - Tests: `env example lists every variable with an empty value` (a test that parses `.env.example`), `gitignore protects secrets and the manifest`.

- [ ] **B-09 Pre-live gate** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/B/offline-plan.txt`.
  - `npm run check` green; `npm run seed -- --dry-run --offline --only settings,tax,shipping,states,types,product-types,categories,channels,recurrence` saved; confirm OA-01 is done (`seed/.env.local` exists; `git check-ignore seed/.env.local` prints the path). Confirm the lead agreed Q-B-13 (irreversible constraints).
  - Blocked: **OA-01** for every task below.

- [ ] **B-10 Live: connect and dry runs** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/B/settings-dry-run.txt`, `inventory-counts.txt`.
  - Commands 3 and 4 of 3.2. Save the output.
  - Tests: none.

- [ ] **B-11 Live: inventory and manifest** `[SKILL: commercetools-platform]`
  - Files: `seed/cleanup-manifest.json` (local, git-ignored), evidence `inventory-counts.txt`.
  - Commands 5 and 6. Tell the lead the counts table and ask for **OA-07** (written approval). Do not delete anything until it is given.
  - Blocked: **OA-07**.

- [ ] **B-12 Live: cleanup** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/B/cleanup-dry-run.txt`, `cleanup-run.txt`.
  - Commands 7 and 8 inside 24 hours of the manifest. If older, repeat B-11. Save counts and `REFUSED`/`FAILED` lines.
  - Tests: none.

- [ ] **B-13 Live: settings** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/B/settings-run.txt`, `readback-project.json`.
  - Command 9, then read back the project (3.5, row Project). Save only `key`, `searchIndexing`, `carts.countryTaxRateFallbackEnabled`, `countries`, `currencies`, `languages`.

- [ ] **B-14 Live: foundation steps and read-back** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/B/seed-foundation-1.txt`, `seed-foundation-2.txt`, `readback-*.json`, `README.md`.
  - Commands 10 and 11; read back every row of 3.4; write differences into `PROJECT-FINDINGS.md` (3.7). Set `STATUS.md` row B to `Ready for review`.

## 5. Scenarios checklist (`platform-project-setup-and-seed`)

- [ ] Fresh project: `Fresh project` in `seed/src/lib.test.ts` + live evidence `settings-run.txt`, `readback-project.json`
- [ ] Dry run (settings): `Dry run` in `seed/src/lib.test.ts` + `settings-dry-run.txt`
- [ ] Review before delete: `Review before delete` in `seed/src/cleanup.test.ts` + `inventory-counts.txt`
- [ ] Wrong confirmation: `Wrong confirmation` in `seed/src/cleanup.test.ts`
- [ ] Seed data protected: `Seed data protected` in `seed/src/cleanup.test.ts`
- [ ] Mismatched key: `Mismatched key` in `seed/src/lib.test.ts` + B-03 additions
- [ ] Re-run: `Re-run` in `seed/src/seed.test.ts` + live `seed-foundation-2.txt` (`0 change(s)`)
- [ ] Partial run: `Partial run` in `seed/src/seed.test.ts`
- [ ] Reset: `Reset` in `seed/src/reset.test.ts` (live: dry run only, evidence `reset-dry-run.txt`)
- [ ] URL with query: covered by C (`URL with query` in `seed/src/images.test.ts`)
- [ ] Blocked source: covered by C (`Blocked source`)
- [ ] Later images: covered by C (`Later images`)
- [ ] Drift: covered by C (`Drift` in `seed/src/verify.test.ts`)
- [ ] No credentials: `No credentials` in `seed/src/lib.test.ts` (and `npm run check` + the offline dry run of B-09 pass with no `.env.local`)
- [ ] Data half of `fulfilment-and-availability-model` (stores are supply channels, shipping by market, tax by market, order states): B-06 data tests and the read-back of 3.4

## 6. Browser recipe

B has no user interface. Browser use is limited to proving the storefront can talk to the seeded project once A is Done (skip, with a note in the evidence README, if A is not Done):
1. `cd storefront && npm run dev`; navigate to `http://localhost:3000/api/health` (Chrome DevTools MCP): `{"ok":true,"projectKey":"<key>"}` where the key equals the seed's project key (proves one project, two clients).
2. Console and network clean; save `B-health.json` (key only).
No screenshots at 375 or 1440 are needed because there is no page.

## 7. Self-verification with data

Section 3.4 (expected end state) and 3.5 (read-back) are the verification. Order of preference: (1) the commercetools MCP read tools; (2) a throwaway read-only script using the SDK calls of 3.5 kept out of git; (3) `npm run verify` (expect only the catalogue and people sections to fail until C). Never ask the owner to look in the Merchant Center for anything the read-back can show. Save the trimmed JSON (keys, ids and checked fields only) under `plans/evidence/B/`.

## 8. Manual testing and owner items

| ID | Who | When needed | Steps (summary) | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-01 (existing) | Owner | B-10 to B-14 | Seed API client into `seed/.env.local`, project key typed twice | `seed:settings -- --dry-run` connects | TODO |
| OA-07 (existing) | Owner | B-11 to B-12 | Review `seed/cleanup-manifest.json`, remove entries to keep, approve in writing | Written approval | TODO |
| OA-x (B1) | Owner | With OA-01 | Create the seed client with the scope list of `seed/.env.example` (B-08) instead of an unspecified "manage scopes" | No 403 during the live run | TODO |
| SO-x (B1) | Owner or accountant | Before release | Confirm tax rates (US 0 food and 8 standard, NY 8.875, DE 7 and 19, GB 0 and 20; Q-010) | Written confirmation | TODO |
| SO-x (B2) | Owner | Before release | Confirm the six invented store addresses and the hours are acceptable as demo data | Approval | TODO |
| M-B-01 | Owner | Optional, after B-14 | Open the Merchant Center for the project: Settings, Project settings, Storefront Search (active); Settings, Shipping methods (3); Products, Categories (20) | Matches `plans/evidence/B/README.md` | TODO |

Full rows in `plans/notes/todo-B.md`.

## 9. Questions (default is built)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-B-1 | The spec lists a custom type for order notes; the seed has none. | Add `mcf-order-notes` (order, field `note`), in `CONTRACT_KEYS` | no |
| Q-B-2 | `SEED-PLAN.md` section 1 and `D-019` say orders and carts cannot be deleted through the API. The docs say they can (`manage_orders` scope; Delete Order and Delete Cart exist). Does cleanup remove sample orders and carts? | No: the seed never touches orders or carts (needs no `manage_orders`); the plan text is corrected by the lead | no |
| Q-B-3 | Seed client scopes: a precise list or `manage_project`? | The precise list of B-08 (least privilege) | OA-01 |
| Q-B-4 | US food tax and GB food tax. | 0 and 0 (Q-010); owner or accountant confirms | no |
| Q-B-5 | New York state rate. | Include 8.875% for `NY`; every other US state uses the 8% country rate | no |
| Q-B-6 | Free-shipping threshold representation. | `freeAbove` on the standard zone rate (not price tiers); F and I read it from the shipping method | no |
| Q-B-7 | `mcf-collect` price and tax category. | 0 in each currency; tax category `mcf-tax-standard` | no |
| Q-B-8 | Store names and the channel name format. | `Malva Coffee <area>` in all languages | no |
| Q-B-9 | Live `reset`. | Dry run only in B; a real `reset --confirm` only with a lead instruction | no |
| Q-B-10 | Wait for `Activated`. | Poll every 5 s, time out after 15 minutes | no |
| Q-B-11 | Node version of the seed (`engines >=20`) vs the project (Node 22). | Align the seed to `>=22` and add `seed/.nvmrc` `22` | no |
| Q-B-12 | Seed files that must be git-ignored. | `.env*` except `.env.example`, `cleanup-manifest.json` | no |
| Q-B-13 | Product type attribute constraints are irreversible. Confirm `SameForAll` for product facts and `CombinationUnique` for the variant dimensions before the first live run. | As seeded (lead confirms in writing before B-14) | B-14 |
| Q-B-14 | `verify` before C: expected to fail on catalogue and people sections. | Accepted; B reads back with MCP or a throwaway script | no |
| Q-B-15 | Manifest review scope: the sample project may contain customers and shopping lists; the cleanup deletes them if listed. | They are listed; the owner removes any entry to keep (OA-07) | OA-07 |

Also in `plans/notes/questions-B.md`.

## 10. Definition of done

- B-01 to B-14 ticked; code tasks each with a passing `cd seed && npm run check` commit (or a documented failing baseline that is not B's to fix).
- Every scenario of section 5 has its named test or evidence; `plans/evidence/B/scenario-map.md` exists.
- Live: `seed-foundation-2.txt` ends with `0 change(s)`; `readback-*.json` match section 3.4; the project settings read back as required; `cleanup-run.txt` shows `0 failed, 0 refused` (or each failure is a written finding with the owner's decision).
- Counts before and after match the approved manifest (nothing outside it was deleted).
- No secret and no personal data in `plans/evidence/B/` (grep for `@example.com` and `SECRET`).
- `seed/.env.example`, `seed/README.md`, `seed/.gitignore` are right (B-08).
- Rows in `plans/TODO-MANUAL-TESTING.md` (lead merges `plans/notes/todo-B.md`), questions in `plans/QUESTIONS.md` (from `plans/notes/questions-B.md`), findings in `plans/PROJECT-FINDINGS.md`.
- `node plans/verify-plan.mjs` passes; `STATUS.md` row B is `Ready for review`.
