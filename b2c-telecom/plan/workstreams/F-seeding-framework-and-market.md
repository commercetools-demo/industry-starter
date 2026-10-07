# F — Seeding framework, project settings, market and shipping

**Specs:** `seeding-framework` (all requirements and scenarios), `seed-shipping-and-market-settings` (all requirements and scenarios; Store and Product Selection parts narrowed by D-058)
**Depends on:** A, E · **Unblocks:** G, H, X (and every workstream that needs seeded data) · **Decisions:** D-001, D-004, D-012, D-019, D-043, D-044, D-054, D-056, D-058, D-059
**Owner prerequisites:** OA-03, OA-04 · **Skill refs:** `commercetools-platform` (SDK client, update actions, optimistic concurrency), `commercetools-commerce-patterns` (shipping, tax, zones)

## Goal
A developer can run `npm run seed:plan`, `npm run seed -- --confirm-project spec-test-b2c-telecom`, `npm run seed:verify` and `npm run seed:reset` against `spec-test-b2c-telecom` and get the same project state every time; the furniture sample data is removed once (after OA-04); Product Search is active; the US and DE markets can price a cart, pick a zero-cost shipping method and order.

## Design

### Scope split (who owns what inside `site/scripts/seed/`, per ARCHITECTURE.md)
| File | Owner | Content |
| --- | --- | --- |
| `lib.ts` | F | Barrel + `CtApi`, `getAdminApi()`, `loadSeedEnv()`, `assertTarget()` (see below) |
| `config.ts`, `types.ts`, `validate.ts`, `reconcile.ts`, `report.ts`, `reset.ts` | F | New files in F's area (not listed in ARCHITECTURE.md; F creates them) |
| `reconcilers/*.ts` (one file per kind) + `reconcilers/registry.ts` | F creates; G appends `customObject.ts`, `demoCustomer.ts`, `demoOrder.ts` and registers them in `registry.ts` | |
| `seed.ts`, `verify.ts`, `project-settings.ts`, `cleanup-furniture.ts` | F | The four commands named in ARCHITECTURE.md |
| `checks/index.ts`, `checks/platform.ts` | F creates; G appends `checks/catalog.ts`; X appends `checks/releases.ts` | Registry of `seed:verify` checks |
| `data/market.ts`, `data/tax.ts`, `data/zones.ts`, `data/shipping.ts`, `data/recurrence.ts`, `data/customer-groups.ts` | F | Only these six files of `data/**`; **G owns every other file in `data/**`** |
| `test/fake-ct.ts` | F | In-memory fake of the commercetools REST surface used by all seed unit tests (G and X reuse it) |
| `site/lib/config/demo.ts` | F | `DEMO_MARKER_FIELD = 'demoMarker'`, `DEMO_MARKER_VALUE = 'malva-demo'` (constants imported by the seed scripts and by the BFF workstreams that stamp demo data) |

The spec says "`seed/` package, sibling of `site/`, own `package.json`". **Planner default:** follow ARCHITECTURE.md (`site/scripts/seed/`, run with `tsx`, `site/package.json` scripts). The "never imported by `site/`" rule becomes a lint rule: workstream B's boundary check must reject any import from `scripts/` inside `app/`, `components/`, `lib/`, `hooks/`, `context/` (F-01 adds the test `config.test.ts` → "site source never imports scripts/seed", a plain file scan, in case B has not added the rule yet).

### npm scripts (F appends to `site/package.json`; none of them is part of `npm run verify`, they need credentials)
| Script | Command | Writes? |
| --- | --- | --- |
| `seed:plan` | `tsx scripts/seed/seed.ts --plan` | no |
| `seed` | `tsx scripts/seed/seed.ts` (needs `--confirm-project <key>`) | yes |
| `seed:verify` | `tsx scripts/seed/verify.ts` | no |
| `seed:reset` | `tsx scripts/seed/reset.ts` (needs `--confirm-project <key> --yes`; dry run without `--yes`) | yes |
| `seed:settings` | `tsx scripts/seed/project-settings.ts` (needs `--confirm-project <key>`) | yes (search activation only) |
| `seed:cleanup` | `tsx scripts/seed/cleanup-furniture.ts` (`--list` or `--execute`) | `--execute` only |

Arguments after `--` are passed through: `npm run seed -- --confirm-project spec-test-b2c-telecom`.

### Environment (`site/.env.seed`, gitignored; `site/.env.seed.example` committed with **names only**)
`CTP_SEED_PROJECT_KEY`, `CTP_SEED_AUTH_URL`, `CTP_SEED_API_URL`, `CTP_SEED_CLIENT_ID`, `CTP_SEED_CLIENT_SECRET`, `CTP_SEED_SCOPES` (optional; when present it is sent as the token scope), `SEED_DEMO_PASSWORD` (used by G only). `loadSeedEnv(file = '.env.seed')` parses `KEY=value` lines (same tiny parser as the grocery project, no `dotenv` dependency); values already present in `process.env` win. The seed client is **never** the storefront client (`.env.local`).

Scopes (OA-03): the owner creates the client from Merchant Center's admin template or with these scopes (each `:spec-test-b2c-telecom`): `manage_project manage_products manage_categories manage_types manage_shipping_methods manage_tax_categories manage_cart_discounts manage_discount_codes manage_customers manage_customer_groups manage_orders manage_key_value_documents` plus the recurrence-policy and recurring-order scopes (exact names are shown in Merchant Center, record them in `PROJECT-FINDINGS.md`). `manage_key_value_documents` (Custom Objects) is **not** in the OA-03 text today; G (serviceability table) and X (release records) need it. F-01 records the scopes the live token actually returns (`scope` field of the token response, names only) in `PROJECT-FINDINGS.md`.

### Safety: the target check (`assertTarget`)
`config.ts` exports:
```ts
export const ALLOWED_PROJECT_KEYS = ['spec-test-b2c-telecom'] as const;   // D-054; the ONLY allow-list entry
export const OWNED_PREFIX = 'malva-';
export const OWNED_UNPREFIXED_KEYS = { customerGroup: ['consumer', 'small-business', 'employee', 'existing-customer'] } as const; // D-058
export const SKU_PREFIX = 'MLV-';
export type Mode = 'read' | 'write';
export function assertTarget(opts: { envProjectKey: string; confirmProject?: string; mode: Mode }): void;
```
Rules (every violation throws `TargetError` with the exit code 2 and a message that **names the key found**):
1. `mode: 'write'` and `envProjectKey` not in `ALLOWED_PROJECT_KEYS` → `Refusing to write: project "<key>" is not in the allow-list (allowed: spec-test-b2c-telecom)`.
2. `mode: 'write'` and `confirmProject !== envProjectKey` (flag missing or different) → `Refusing to write: pass --confirm-project <key> naming the target project (found "<key>")`.
3. After the token is obtained, `GET /{projectKey}` must return the same `key` (guards against a stale `CTP_SEED_PROJECT_KEY` with another client); otherwise `Refusing: credentials belong to project "<other>"`.
4. Read-only commands (`seed:plan`, `seed:verify`, `seed:cleanup --list`) need no confirmation flag but still reject keys outside the allow-list (a read against an unknown project is refused too: **Planner default**, cheaper than reasoning about it).
`isOwnedKey(kind, key)` is true for keys starting with `malva-` and for the four customer-group keys above; nothing else is ever created, updated or deleted by `seed`/`seed:reset` (the cleanup script is the only exception, with its own gate).

### Exit codes (all scripts in `scripts/seed/`)
| Code | Meaning |
| --- | --- |
| 0 | Success (plan printed, run completed, all checks passed) |
| 1 | At least one resource `failed`, or a `seed:verify` check failed |
| 2 | Target refused (`TargetError`) |
| 3 | Pre-flight stop before any write: validation error (dangling reference, duplicate SKU, bad enum) or project settings missing |
| 4 | Completed but at least one resource `skipped` because of a conflict (incompatible product type change) |
| 5 | Gate not satisfied (cleanup without OA-04 `APPROVED`, listing hash mismatch) |
| 6 | Search index not ready within the timeout (the data itself was written) |

### Manifest format
Manifests are **typed TypeScript modules** under `scripts/seed/data/` (single source of truth; no JSON except lock files). `types.ts` (F):
```ts
export type Kind =
  | 'type' | 'productType' | 'taxCategory' | 'zoneCoverage' | 'customerGroup' | 'recurrencePolicy'
  | 'category' | 'shippingMethod' | 'cartDiscount' | 'discountCode' | 'product' | 'inventory'
  | 'customObject' | 'demoCustomer' | 'demoOrder';          // last three added by G
export interface Draft { key: string }                        // every draft carries its stable key
export interface Ref { kind: Kind; key: string; from: { kind: Kind; key: string } }
export type Change = { path: string; from: unknown; to: unknown };
export type Outcome =
  | { status: 'created' | 'unchanged' } | { status: 'updated'; changes: Change[] }
  | { status: 'skipped'; reason: string } | { status: 'failed'; error: string };
export interface SeedManifest { [K in Kind]?: Draft[] }       // arrays of drafts per kind
export interface Reconciler<D extends Draft = Draft, R = unknown> {
  kind: Kind;
  order: number;                                              // dependency order, table below
  refs(draft: D): Ref[];                                      // every key this draft points at
  fetch(api: CtApi, key: string): Promise<R | null>;          // GET by key; null on 404
  create(api: CtApi, draft: D, ctx: Ctx): Promise<void>;
  diff(existing: R, draft: D): { changes: Change[]; conflict?: string };   // conflict => skipped
  update(api: CtApi, existing: R, changes: Change[], draft: D, ctx: Ctx): Promise<void>;
  remove(api: CtApi, existing: R, ctx: Ctx): Promise<void>;  // used by seed:reset only
}
```
`CtApi` (in `lib.ts`) is a thin wrapper over `@commercetools/ts-client` (`client.execute({ method, uri: '/<projectKey>/…', body })`) so reconcilers are data-driven and the fake in `test/fake-ct.ts` implements the same three methods:
```ts
export interface CtApi {
  get(path: string, query?: Record<string, string | number | string[]>): Promise<unknown | null>; // null on 404
  post(path: string, body: unknown): Promise<unknown>;     // create and update
  del(path: string, query: { version: number }): Promise<unknown>;
  writes: number;                                          // incremented by post and del; "Second run changes nothing" asserts it stays 0
}
```
`getAdminApi()` builds the client with `ClientBuilder().withClientCredentialsFlow` + `withHttpMiddleware` + `withRetryMiddleware({ maxRetries: 3, retryDelay: 200, backoff: true, retryCodes: [429, 500, 502, 503, 504] })`. A `409 ConcurrentModification` on update is retried up to 3 times by re-fetching the resource and recomputing the diff.

### Dependency order (`order`; the planner sorts by it, resets in reverse)
| order | Kind | Why here |
| --- | --- | --- |
| 10 | `type` (custom types) | Referenced by categories, customers, orders, line items |
| 20 | `taxCategory` | Products and shipping methods point at it |
| 30 | `zoneCoverage` | Resolves the zone that holds each seeded country (see Zones) |
| 40 | `customerGroup`, `recurrencePolicy` | Referenced by prices, customers, cart discounts |
| 50 | `productType` | Products need it |
| 60 | `category` (sequential, parents first) | Products point at categories; category-tree locking forbids parallel creation |
| 70 | `shippingMethod` | Needs tax category and zones |
| 80 | `product` (published) | Needs product type, categories, tax category, recurrence policies |
| 90 | `inventory` | Needs the SKUs to exist |
| 100 | `cartDiscount`, `discountCode`, `customObject` | Discounts may reference SKUs/attributes; codes reference discounts |
| 110 | `demoCustomer`, then `demoOrder` | Need products, groups, policies; only with `--with-demo` |

### Per-kind reconciler contract (F implements; **update actions below were checked against the commercetools OpenAPI**, do not add others from memory)
| Kind | fetch (by key) | diff compares | update actions | Conflict (skipped) |
| --- | --- | --- | --- | --- |
| `type` | `GET types/key=…` | name, `resourceTypeIds`, field definitions (name, type, required, label, enum values) | `changeName`, `changeLabel` (fieldName), `addFieldDefinition`, `addEnumValue` / `addLocalizedEnumValue`, `changeEnumValueLabel` / `changeLocalizedEnumValueLabel`, `changeFieldDefinitionOrder` | field type changed; field removed; `resourceTypeIds` changed |
| `taxCategory` | `GET tax-categories/key=…` | name, description, rates (key, name, amount, includedInPrice, country) | `changeName`, `setDescription`, `addTaxRate`, `replaceTaxRate` (by rate id looked up by rate key), `removeTaxRate` | none |
| `zoneCoverage` | `GET zones?where=locations(country="US")` | the country is inside some zone | creates `malva-zone-<cc>` only when **no** zone holds the country | none (adopts existing zones, never edits them) |
| `customerGroup` | `GET customer-groups/key=…` | `groupName` | `changeName` | none |
| `recurrencePolicy` | `GET recurrence-policies/key=…` | name, description, schedule | `setName`, `setDescription`, `setSchedule` | none |
| `productType` | `GET product-types/key=…` | name, description, attributes by name: type (deep), `isRequired`, `level`, `attributeConstraint`, `isSearchable`, `savedToLineItem`, `inputHint`, label, inputTip, enum values | `changeName`, `changeDescription`, `addAttributeDefinition`, `changeLabel`, `setInputTip`, `changeInputHint`, `changeIsSearchable`, `changeSavedToLineItem`, `addPlainEnumValue`, `addLocalizedEnumValue`, `changePlainEnumValueLabel`, `changeLocalizedEnumValueLabel`, `changeAttributeOrderByName` | an existing attribute's **type** differs (including set element type); `level` differs; `attributeConstraint` differs (only `→ None` is possible via `changeAttributeConstraint`; any other change is a conflict); an attribute exists in the project but not in the manifest is only a warning (never removed; "extra attribute" line in the report) |
| `category` | `GET categories/key=…` | name, slug, description, orderHint, parent (by key), assets | `changeName`, `changeSlug`, `setDescription`, `changeOrderHint`, `changeParent`, `addAsset` / `setAssetSources`, `removeAsset` | none |
| `shippingMethod` | `GET shipping-methods/key=…` | name, localizedName, localizedDescription, taxCategory, isDefault, active, predicate, zoneRates (zone key, currency, centAmount) | `changeName`, `setLocalizedName`, `setLocalizedDescription`, `changeTaxCategory`, `changeIsDefault`, `changeActive`, `setPredicate`, `addZone`, `removeZone`, `addShippingRate`, `removeShippingRate` (a changed amount is remove-then-add of that zone/currency rate) | none |
| `cartDiscount` | `GET cart-discounts/key=…` | name, description, value, cartPredicate, target, sortOrder, stackingMode, isActive, requiresDiscountCode, validFrom/validUntil, recurringOrderScope | `changeName`, `setDescription`, `changeValue`, `changeCartPredicate`, `changeTarget`, `changeSortOrder`, `changeStackingMode`, `changeIsActive`, `changeRequiresDiscountCode`, `setValidFromAndUntil`, `setRecurringOrderScope` (verify the name in the OpenAPI when implementing; if absent, `diff` returns a conflict and the report asks for delete-and-recreate by `seed:reset --only cartDiscount`) | `sortOrder` already used by another discount (platform enforces uniqueness): conflict with that key named |
| `discountCode` | `GET discount-codes/key=…` | name, description, code, cartDiscounts (keys), cartPredicate, isActive, max applications, validity | `setName`, `setDescription`, `changeCartDiscounts`, `setCartPredicate`, `changeIsActive`, `setMaxApplications`, `setMaxApplicationsPerCustomer`, `setValidFromAndUntil` | `code` string changed (immutable) |
| `product` | `GET products/key=…` | **staged** projection: name, slug, description, categories + order hints, tax category, variants by `sku` (key, attributes, prices by price `key`, images), published flag | `changeName`, `changeSlug`, `setDescription`, `addToCategory`, `removeFromCategory`, `setCategoryOrderHint`, `setTaxCategory`, `addVariant`, `removeVariant`, `setAttribute` (variantId + name), `setPrices` (per `sku`, replaces that variant's prices in one action; staged:false is not used, everything is staged then `publish`), `addExternalImage`, `removeImage`, `publish` | `productType` differs (cannot be changed on a product): conflict |
| `inventory` | `GET inventory/key=…` | `quantityOnStock`, `restockableInDays` | `changeQuantity`, `setRestockableInDays` | `sku` differs from the manifest for that key |
| `customObject` (G) | `GET custom-objects/<container>/<key>` | `value` deep-equal | upsert is the create call itself (`POST custom-objects` with same container/key replaces the value) | none |
| `demoCustomer`, `demoOrder` (G) | see G | | | |

Notes that matter:
- **Key-addressed**: every `fetch` is `GET …/key=<key>`. Inventory has a `key` too, so inventory entries get key `malva-inv-<sku>`.
- `diff` compares only fields named in the manifest; fields the platform fills in (ids, versions, timestamps, `ancestors`) never produce a change.
- **Idempotence rule (the "second run" scenario):** a second run performs only `GET`s. `CtApi.writes` must stay `0`; the fake asserts it.
- A `product` diff is computed on the **staged** projection; after any change (or when `masterData.published === false` or `hasStagedChanges`) the reconciler issues a final `publish` action, so storefront reads (`staged=false`) see it.

### Planning, validation, execution (`reconcile.ts`, `validate.ts`)
1. `validateManifest(manifest, existingKeys)` (pure, **before any network write**; reads allowed): every `Ref` resolves to a draft in the manifest or to an existing project resource found by `GET …/key=` (cached); keys unique per kind; keys owned (`isOwnedKey`); SKUs unique across all product variants **and** inventory SKUs exist in some variant; price `key`s unique; every `LocalizedString` has both `en-US` and `de-DE`; enum attribute values exist in the product type definition; set/number/money attribute value shapes match their definition; predicates only reference attribute names that exist with `savedToLineItem: true` in some product type (`attributes.\`name\`` regex). Violations are returned as `ValidationError { kind, key, message }[]`; a non-empty list ends the run with **exit 3** before any `POST`. The message for a dangling reference is exactly: `Dangling reference: <fromKind> "<fromKey>" references <kind> "<key>", which no manifest defines and the project does not hold`.
2. `planAll(api, manifest)` → `Plan = { kind, key, action: 'create' | 'update' | 'unchanged' | 'skip', changes, reason }[]`, sorted by `order` then manifest order. `seed:plan` prints it and stops.
3. `applyPlan(api, plan)` runs reconcilers sequentially (no parallelism anywhere: category locking, version conflicts), recording an `Outcome` per item; a `failed` item does **not** stop the run unless it is an item other items depend on (a skipped or failed product type makes every product of that type `skipped` with reason `depends on productType "<key>" (<reason>)`). The skip cascade is the "skips that product type and everything that depends on it" rule.
4. **Interrupted run resumes:** because every step starts with `fetch` by key, re-running creates only what is missing. A `create` that answers `400 DuplicateField` on `key` is treated as "already exists", the resource is re-fetched and diffed.
5. `report.ts` prints one line per item (`created`, `updated` with `path: from → to`, `unchanged`, `skipped` with reason, `failed` with message) and a final `SUMMARY created=… updated=… unchanged=… skipped=… failed=…`; it also returns the counts for tests and sets the exit code per the table.

### CLI flags (`seed.ts`)
`--plan` (no writes), `--confirm-project <key>`, `--only <kind>[,<kind>]` (restrict kinds; dependencies are still validated), `--with-demo` (include `demoCustomer`/`demoOrder`; off by default), `--apply-project-settings` (see below), `--no-wait` (skip the search-index wait), `--json` (machine-readable report on stdout). Order of a full `seed` run: `assertTarget` → project settings **check** → `validateManifest` → plan → apply → `activateSearch` (only if not yet active; see below) → `waitForSearchIndex` unless `--no-wait` → print report.

### Project settings (`project-settings.ts`) and Product Search (D-056)
```ts
export interface SettingsReport { countries: string[]; currencies: string[]; languages: string[]; missing: string[]; searchStatus: 'Activated' | 'Indexing' | 'Deactivated' | string }
export async function checkProjectSettings(api: CtApi): Promise<SettingsReport>;
export async function applyProjectSettings(api: CtApi, report: SettingsReport): Promise<void>;   // only with --apply-project-settings
export async function activateProductSearch(api: CtApi): Promise<'already-active' | 'activated'>;
export async function waitForSearchIndex(api: CtApi, opts: { expectedKeys: string[]; timeoutMs?: number; pollMs?: number; sleep?: (ms: number) => Promise<void> }): Promise<{ lagMs: number }>;
export const REQUIRED = { countries: ['US', 'DE'], currencies: ['USD', 'EUR'], languages: ['en-US', 'de-DE'] } as const;
```
- **Check (always runs, read-only):** `GET /{projectKey}`; compare. If anything is missing the run stops with exit 3 *before writing resources that depend on it* and prints: `Project settings missing: country DE (change in Merchant Center: Settings > Project settings > International, or re-run with --apply-project-settings)`. Without the flag the project is never edited (spec "Project settings missing").
- **`--apply-project-settings`:** sends the **union** of existing and required values with `changeCountries`, `changeCurrencies`, `changeLanguages` (never removes GB/en-GB: they stay enabled, D-001).
- **Activation (docs: <https://docs.commercetools.com/api/projects/product-search#activate-the-product-search-api>):** body `{ "version": <v>, "actions": [{ "action": "changeProductSearchIndexingEnabled", "enabled": true, "mode": "ProductsSearch" }] }` to `POST /{projectKey}`. The current state is `project.searchIndexing.products.status` (`Deactivated` at baseline). `ProductProjectionsSearch` is **never** activated (projects created after 2026-08-31 get `InvalidOperation`; verified in the docs). Needs `manage_project`.
- **Order inside `seed`:** activation happens **after** the products are written (so the first index build covers the whole catalog once). Product Type create/update/delete and Store changes trigger a *full reindex* (about 15 minutes, docs: <https://docs.commercetools.com/api/projects/product-search#full-reindexing>); incremental product/price changes take "a few minutes". Therefore: run the cleanup first (while indexing is still Deactivated, no reindex cost), then seed, then activate.
- **Wait (`waitForSearchIndex`):** poll every 20 s (default `pollMs = 20000`), timeout 30 min (`timeoutMs = 1800000`). Each poll sends `POST /{projectKey}/products/search` with
  `{ "query": { "or": [ { "exact": { "field": "key", "value": "<expectedKey>" } }, … ] }, "limit": 1 }`
  (field `key` is documented in the Product Search guide; G passes the 27 offer keys). A `400 ObjectNotFound` ("Product Search API is not enabled…") means "not ready yet"; ready = `total === expectedKeys.length`. Returns `lagMs` (time from activation or last write to ready). On timeout: print `SEARCH_NOT_READY` and exit **6** (data is fine; re-run `seed:settings --wait-only`).
- Automatic deactivation: Product Search deactivates after 30 days without calls (docs); `seed:verify` fails the "search active" check and the remedy printed is `npm run seed:settings -- --confirm-project spec-test-b2c-telecom`.

### Market, zones, tax, shipping, recurrence, customer groups (data owned by F)
`data/market.ts`:
```ts
export const MARKETS = [
  { locale: 'en-US', language: 'en-US', currency: 'USD', country: 'US' },
  { locale: 'de-DE', language: 'de-DE', currency: 'EUR', country: 'DE' },
] as const;   // D-004; en-GB / GBP are not used
```
A test compares `MARKETS.map(m => m.locale)` with `routing.locales` from `site/i18n/routing.ts` (D) so both sides agree (the spec's "one `COUNTRY_CONFIG` entry in `site/`" is D's market config).

`data/tax.ts` — one placeholder category with a rate per country (D-044):
```ts
export const taxCategories: TaxCategoryDraft[] = [{
  key: 'malva-telecom-services',
  name: 'Malva telecom services (PLACEHOLDER 0%)',
  description: 'Placeholder rates. Real telecom tax treatment is out of scope (D-044).',
  rates: [
    { key: 'malva-tax-us', name: 'US placeholder 0%', amount: 0, includedInPrice: false, country: 'US' },
    { key: 'malva-tax-de', name: 'DE placeholder 0%', amount: 0, includedInPrice: true,  country: 'DE' },
  ],
}];
```
`countryTaxRateFallbackEnabled` stays `true` (project baseline). The existing `standard-tax` category (US 20 %, NC/NY state taxes, DE 19 %) is **not touched and not used**.

`data/zones.ts` — coverage, not ownership. A country can belong to only one zone (docs: <https://docs.commercetools.com/learning-model-your-product-catalog/shipping-methods/data-structure#zones>) and the project already has zones `usa` (US) and `europe` (DE, GB) from the sample data, so creating `malva-zone-us` would fail. **Planner default:** `zoneCoverage` finds the existing zone that holds each seeded country and shipping rates use **that zone's key**; only if none exists it creates `malva-zone-us` / `malva-zone-de`. The adopted zone keys are written to the run context (`ctx.zoneKeys = { US: 'usa', DE: 'europe' }`) and printed in the report. Reset never deletes adopted zones.

`data/shipping.ts` — zero fixed rates (not free-above, not a shipping discount; spec modeling decision). Both methods have `isDefault: false` (making one the default would change the existing sample default `standard-shipping`, which is not ours; the BFF selects by key). Zone keys below are shown for the baseline project; code reads them from `ctx.zoneKeys`.
```ts
export const shippingMethods: ShippingMethodDraft[] = [
  {
    key: 'malva-shipping-standard',
    name: 'Malva standard delivery',
    localizedName: { 'en-US': 'Standard delivery', 'de-DE': 'Standardversand' },
    localizedDescription: { 'en-US': 'SIM cards, routers and activation kits ship at no charge.', 'de-DE': 'SIM-Karten, Router und Aktivierungssets werden kostenlos geliefert.' },
    taxCategory: { typeId: 'tax-category', key: 'malva-telecom-services' },
    active: true, isDefault: false,
    predicate: 'lineItemExists(attributes.`offer-kind` in ("base-package","equipment","device","bundle")) = true',
    zoneRates: [
      { zone: 'US', shippingRates: [{ price: { currencyCode: 'USD', centAmount: 0 } }] },
      { zone: 'DE', shippingRates: [{ price: { currencyCode: 'EUR', centAmount: 0 } }] },
    ],
  },
  {
    key: 'malva-delivery-digital',
    name: 'Malva digital delivery',
    localizedName: { 'en-US': 'Digital delivery', 'de-DE': 'Digitale Bereitstellung' },
    localizedDescription: { 'en-US': 'Nothing to ship. Activated on your bill.', 'de-DE': 'Nichts zu versenden. Wird auf Ihrer Rechnung aktiviert.' },
    taxCategory: { typeId: 'tax-category', key: 'malva-telecom-services' },
    active: true, isDefault: false,
    predicate: 'forAllLineItems(attributes.`offer-kind` = "addon") = true',
    zoneRates: [ same two zone rates with centAmount 0 ],
  },
];
```
`zoneRates[].zone` is the country code in the manifest; the reconciler maps it to the adopted zone's key. Predicate identifiers with a dash are backtick-escaped (docs: <https://docs.commercetools.com/api/projects/predicates#customfield-field-identifiers> states the escape rule for custom fields; **G-18 proves it for attribute names with a live `matching-cart` call**; if the platform rejects it, replace with the unescaped `attributes.offer-kind` form in both places and record it in `PROJECT-FINDINGS.md`). `attributes.offer-kind` works only because G defines it with `savedToLineItem: true`; `validateManifest` checks that. The digital-only decision (spec question) is the **Planner default** "the digital method is selected by predicate for add-on-only carts, and U selects it without asking the buyer; if the matching list has exactly one method U skips the step".

**Pitfall (matching returns every active method):** `GET shipping-methods/matching-cart` also returns the sample methods `standard-shipping` and `express-shipping` (USD 500.00 rates, referenced by existing sample carts and orders so they cannot be deleted). They are not ours and are not touched. The storefront must keep only keys starting with `malva-`. F exports `MALVA_SHIPPING_KEY_PREFIX = 'malva-'` from `site/lib/config/shipping.ts` (new file, F's area) for workstream U/M.

`data/recurrence.ts`:
```ts
export const recurrencePolicies = [{
  key: 'malva-monthly',
  name: { 'en-US': 'Monthly', 'de-DE': 'Monatlich' },
  description: { 'en-US': 'One order every month.', 'de-DE': 'Eine Bestellung pro Monat.' },
  schedule: { type: 'standard', value: 1, intervalUnit: 'Months' },
}];
```
(docs: <https://docs.commercetools.com/api/projects/recurrence-policies>). G adds the four device-financing policies in its own file; the reconciler accepts drafts from both. A recurrence policy cannot be deleted while a cart discount references it (docs), hence reset deletes cart discounts first.

`data/customer-groups.ts`: keys `consumer` ("Consumer"), `small-business` ("Small business"), `employee` ("Employee"), `existing-customer` ("Existing customer"); `groupName` is the English text (the API has no localized name).

### `seed:verify` (`verify.ts`, read-only)
Runs every check registered in `checks/index.ts` and prints `PASS`/`FAIL  <name>  (<detail>)`, ends with `All checks passed.` or `N check(s) failed.`, exit 0/1. F's checks (`checks/platform.ts`):
1. countries US, DE; currencies USD, EUR; languages en-US, de-DE present.
2. `searchIndexing.products.status === 'Activated'` (remedy text names `seed:settings`).
3. Tax category `malva-telecom-services` has US and DE rates both `0`.
4. A zone holding US and a zone holding DE exist; both Malva shipping methods exist, active, `isDefault: false`, every `zoneRate` rate for USD/EUR is `centAmount 0`.
5. Recurrence policy `malva-monthly` exists with schedule `Months` × 1.
6. Four customer groups exist with the exact keys.
7. **Furniture removed:** product types `bedding-bundle`, `furniture-and-decor`, `product-sets` do not exist; no product has a product type outside the `malva-*` family; no category without `malva-cat-` key prefix; no inventory entry with a SKU not starting `MLV-` (cleanup done; Gate 1).
8. **Storefront sees only the intended assortment** (D-058 replaces the Store/Product Selection): after cleanup every published product has a product type key in the six `malva-*` types (no Store is created).
9. `Check` shape: `export interface Check { name: string; run(api: CtApi, ctx: CheckCtx): Promise<{ ok: boolean; detail?: string }> }`.

### Furniture cleanup (`cleanup-furniture.ts`) — one-time, destructive, gated (D-054)
Deletes **only** the three sample product types `bedding-bundle`, `furniture-and-decor`, `product-sets` and what depends on them. Baseline (inspected 2026-10-07): 117 products, 29 categories, 134 inventory entries, cart discount `FurnitureBOGO` (predicate `productType.key = "furniture-and-decor"`) and discount code `BOGO` (references it). **Not deleted, only recorded:** 5 orders, 5 carts, 6 customers, shipping methods `standard-shipping` and `express-shipping`, tax category `standard-tax`, zones `usa` and `europe`, store `b2c-retail-store`, channels `inventory-channel` and `distribution-channel`, cart discount `FreeShip100`, state objects.

Two modes, inventory first (the inventory is the safety net):
1. `npm run seed:cleanup -- --list` (read-only): builds the **dependency listing** and writes it into `plan/PROJECT-FINDINGS.md` between the markers `<!-- CLEANUP-LISTING:BEGIN -->` and `<!-- CLEANUP-LISTING:END -->` (F-12 adds the empty marker pair and a heading "Furniture cleanup inventory"). Also writes a full JSON backup to `scripts/seed/.backup/furniture-<ISO timestamp>.json` (gitignored; add to `.gitignore`). The listing contains: counts and keys per resource class; for products only `key` + product type key; for inventory only `sku` + quantity; **the three exclusion lists** above; a line `listing-sha256: <hex>` (SHA-256 of the sorted JSON of the delete-set ids and versions-free keys), and `listing-generated: <ISO date>`. The delete-set is computed as:
   - product types with keys in `{bedding-bundle, furniture-and-decor, product-sets}`;
   - products whose `productType` is one of them (any other product type present makes the script stop with exit 4 and the key list, because "everything that depends on them" would be ambiguous);
   - cart discounts whose `cartPredicate` or target predicate text contains one of the three type keys, and discount codes whose `cartDiscounts` are only those;
   - inventory entries whose `sku` equals a variant SKU of the deleted products (matched). Entries whose SKU matches nothing are listed as `UNMATCHED` and stop the script (exit 4) until a person decides;
   - categories whose key does **not** start with `malva-cat-` (all 29 at baseline), **provided** no remaining product (outside the delete-set) is assigned to them; otherwise stop (exit 4).
2. `npm run seed:cleanup -- --execute --confirm-project spec-test-b2c-telecom` is refused with **exit 5** unless **all** hold: (a) the `OA-04` row in `plan/TODO-MANUAL-TESTING.md` (found by the line starting `| OA-04 |`; the status is the last cell) is exactly `APPROVED` or `DONE`; (b) `assertTarget` passes in write mode; (c) the freshly computed `listing-sha256` equals the one stored in `PROJECT-FINDINGS.md` (the owner approved *that* list; if the project changed since, run `--list` again and ask again); (d) a backup file from the same run of `--list` exists. Deletion order: discount codes → cart discounts → products (`unpublish` action, then `DELETE ?version=`; re-read the version after unpublish) → inventory entries → categories **deepest first** (sort by `ancestors.length` descending, one at a time) → product types. Every step logs `deleted <kind> <key>`; a `404` is treated as already deleted, so the script is re-runnable. Nothing else is ever deleted; the script ignores any key not in the computed set even if the listing file was edited.
3. After `--execute` the script runs the same read checks as `seed:verify` check 7 and prints `Furniture data removed.`; F-13 appends "what the cleanup deleted" (counts) to `PROJECT-FINDINGS.md`.
4. Idempotent: with nothing left it prints `Nothing to clean up.` and exits 0.

### Reset and the demo marker (`reset.ts`)
- `seed:reset -- --confirm-project <key>` without `--yes` prints what would be removed (dry run). With `--yes`: for each manifest draft, in reverse `order`, `fetch` by key and, only if found **and** `isOwnedKey`, `remove` it. Products are `unpublish`ed then deleted; categories deepest first; product types last; cart discounts before recurrence policies. Resources that exist in the project but not in the manifests (including everything the owner created by hand) are never listed or touched ("Reset limited to what was seeded").
- `--demo`: instead of manifest keys, deletes **demo data** found with the marker: carts, orders, recurring orders, customers whose custom field `demoMarker` equals `malva-demo` (query predicate `custom(fields(demoMarker="malva-demo"))`, supported on carts, orders and customers). Order of deletion: recurring orders (cancel with `setRecurringOrderState` `{ type: "canceled", reason: "demo reset" }` then delete) → orders → carts → customers. The BFF workstreams stamp the marker on everything they create **when `DEMO_MODE=true`**; F adds `DEMO_MODE` (optional boolean, default `false`) to the optional env list in `site/lib/ct/env.ts` (E-owned: **append only**, F-05 says so in its commit). The custom field itself is defined by G's types `malva-cart`, `malva-order`, `malva-customer` (field `demoMarker`, String).
- Exit codes as the table; `--demo` and the manifest reset can be combined.

### Pitfalls
- **Version conflicts:** after every `POST` use the returned `version`; never reuse a stale one. Retry `409` up to 3 times.
- **Category locking:** creating a child locks the parent; sequential only, parents before children (order hint strings are plain `"0.1"`-style decimals).
- **Zones:** a country belongs to one zone only; adopt, never create a duplicate.
- **Shipping method deletion** is blocked while carts/orders reference it; our reset therefore deletes only Malva methods (no sample cart references them unless a demo order used one, in which case reset logs `skipped: referenced by an order`).
- **Search:** product type changes after activation cost a 15-minute full reindex and pause incremental indexing; never alternate seed and activation in a loop.
- **Secrets:** the seed client id/secret live only in `.env.seed`; the reports never print env values; `check:secrets` (E) must stay green; F adds `.env.seed` and `scripts/seed/.backup/` to `.gitignore` in F-01.
- **Predicates:** attribute names with dashes in discount/shipping predicates are backtick-escaped; proven live in G-18.
- **Sample data in the way:** sample customers, carts and orders reference the deleted products; they remain valid (line items are snapshots).

### Planner defaults (owner may overrule)
1. Seed code lives in `site/scripts/seed/` (ARCHITECTURE.md), not in a sibling `seed/` package.
2. Read commands also refuse unknown project keys.
3. Zones: adopt the existing `usa`/`europe` zones instead of creating `malva-zone-us`.
4. Both Malva shipping methods are `isDefault: false`; the BFF filters by the `malva-` key prefix.
5. No Store and no Product Selection (D-058); the "intended assortment" scenario is proven by the cleanup plus a published-products check.
6. Cleanup also deletes the sample cart discount `FurnitureBOGO` and discount code `BOGO` (they exist only for the furniture type); other sample resources stay.
7. Activation of Product Search runs after the first full seed, wait timeout 30 minutes.
8. `--apply-project-settings` is the only way the seeder edits project-wide settings; it only adds.
9. `DEMO_MODE=true` is the switch that makes the BFF stamp the demo marker.

## Tasks
- [x] F-01 Create `scripts/seed/config.ts` (`ALLOWED_PROJECT_KEYS`, `isOwnedKey`, `assertTarget`, `TargetError`, exit-code constants), `scripts/seed/lib.ts` (`loadSeedEnv`, `CtApi`, `getAdminApi` with retry middleware and the project-key echo check), `.env.seed.example` (names only), `.gitignore` entries (`.env.seed`, `scripts/seed/.backup/`), `lib/config/demo.ts`, `lib/config/shipping.ts`; record the token's granted scope names (names only) in `PROJECT-FINDINGS.md`. [SKILL: commercetools-platform] Tests `scripts/seed/config.test.ts`: "Target not confirmed: …" (non-allow-listed key, missing flag, mismatching flag, wrong echoed key all throw with the key named), "Credentials kept out of the repository: …" (`.env.seed` in `.gitignore`; no file under `app/`, `components/`, `lib/`, `hooks/`, `context/` imports `scripts/seed`; `.env.seed.example` has no values).
- [x] F-02 Create `scripts/seed/types.ts`, `scripts/seed/validate.ts`, `scripts/seed/test/fake-ct.ts` (in-memory `CtApi`: stores resources per collection keyed by key, supports `get` by key/where on `locations(country=…)`, `post` create/update with version checks and the update actions of the table, `del`, counts `writes`). [SKILL: commercetools-platform] Tests `scripts/seed/validate.test.ts`: "Dangling reference caught before any write: …" (message text exact, zero `writes`), duplicate SKU, duplicate price key, missing `de-DE` string, unknown enum value, predicate attribute without `savedToLineItem`.
- [x] F-03 Create `scripts/seed/reconcile.ts` (`planAll`, `applyPlan`, skip cascade, 409 retry, `DuplicateField` handling) and `scripts/seed/report.ts` (lines, summary, exit code). [SKILL: commercetools-platform] Tests `scripts/seed/reconcile.test.ts` using a trivial test reconciler and the fake: "Second run changes nothing: …" (`writes === 0`, all `unchanged`), "Manifest edited: …" (one `updated` with the changed path), "Interrupted run resumes: …" (fake throws after the 2nd create; second run creates the rest, no duplicates), "Dependencies respected: …" (creation order equals `order`), "Incompatible product type change: …" (conflict ⇒ `skipped`, dependants `skipped`, exit 4).
- [x] F-04 Create reconcilers `reconcilers/type.ts`, `taxCategory.ts`, `zoneCoverage.ts`, `customerGroup.ts`, `recurrencePolicy.ts` and `reconcilers/registry.ts`; create `data/tax.ts`, `data/zones.ts`, `data/recurrence.ts`, `data/customer-groups.ts`, `data/market.ts`. [SKILL: commercetools-commerce-patterns] Tests `reconcilers/platform.test.ts` and `data/market.test.ts`: tax rates are `0` for US and DE, zone coverage adopts `usa`/`europe` and creates `malva-zone-us` only when none holds US, recurrence schedule is `Months`×1, the four group keys, `MARKETS` locales equal `routing.locales`.
- [x] F-05 Create reconcilers `productType.ts` (deep attribute diff, conflict rules above, extra-attribute warning) and `category.ts` (parents first, `changeParent`, order hints); append optional `DEMO_MODE` to `lib/ct/env.ts` (append only). [SKILL: commercetools-platform] Tests `reconcilers/catalog-structure.test.ts`: attribute added ⇒ `addAttributeDefinition`; enum value added ⇒ `addPlainEnumValue`/`addLocalizedEnumValue`; attribute type changed ⇒ conflict, no delete/recreate calls; category with parent created after parent; `changeOrderHint` on edit.
- [x] F-06 Create reconcilers `shippingMethod.ts` (zone mapping through `ctx.zoneKeys`, rate remove/add), `cartDiscount.ts`, `discountCode.ts`; create `data/shipping.ts`. [SKILL: commercetools-commerce-patterns] Tests `reconcilers/shipping.test.ts`: "Shipping option is free: …" (every rate `centAmount 0` for USD and EUR; matching a fake cart in US returns `malva-shipping-standard`), "Digital-only cart: …" (predicate strings: add-on-only cart matches only `malva-delivery-digital`, mixed cart only `malva-shipping-standard`; evaluate the two predicates with a tiny evaluator over `offer-kind` values), "Shipping rate changed later: …" (manifest rate 0 → 499 gives `removeShippingRate` + `addShippingRate` on the same key, no new method).
- [x] F-07 Create reconcilers `product.ts` (staged diff, variants by SKU, `setPrices`, images, category hints, publish) and `inventory.ts` (key `malva-inv-<sku>`). [SKILL: commercetools-platform] Tests `reconcilers/product.test.ts`: price change ⇒ one `setPrices` for that SKU and one `publish`; name change ⇒ `changeName` only; unpublished product ⇒ `publish`; removed variant ⇒ `removeVariant`; product type change ⇒ conflict; inventory quantity change ⇒ `changeQuantity`.
- [x] F-08 Create `scripts/seed/seed.ts` (flags, order of a run, `--plan`, `--only`, `--with-demo`, `--json`, `--no-wait`) and add the npm scripts. [SKILL: commercetools-platform] Tests `scripts/seed/seed.test.ts`: "Plan mode: …" (prints created/updated/unchanged table, fake `writes === 0`), "Target not confirmed: …" via the CLI entry (`main(['--confirm-project','other'])` exits 2 before any request), exit-code mapping (3 on validation errors, 4 on skipped, 1 on failed).
- [x] F-09 Create `scripts/seed/project-settings.ts` (`checkProjectSettings`, `applyProjectSettings`, `activateProductSearch`, `waitForSearchIndex`) and wire it into `seed.ts` (check before writes; activation and wait after). [SKILL: commercetools-platform] Tests `scripts/seed/project-settings.test.ts`: "Project settings missing: …" (fake project without DE: exit 3, message names `country DE` and "Settings > Project settings > International", no resource written), `--apply-project-settings` sends the union with `changeCountries`, activation sends exactly `{ action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' }` and never `ProductProjectionsSearch`, wait loop with an injected `sleep` (not-ready 400 → ready) and timeout ⇒ exit 6.
- [x] F-10 Create `scripts/seed/verify.ts`, `checks/index.ts`, `checks/platform.ts` (checks 1–8 above). [SKILL: commercetools-platform] Tests `scripts/seed/verify.test.ts`: all green on a fully seeded fake; "Every product taxable: …" (tax category present with rates for US and DE and, for every product in the fake, a `taxCategory`); "Storefront sees only the intended assortment: …" (a published product of type `furniture-and-decor` makes check 8 fail).
- [x] F-11 Create `scripts/seed/reset.ts` (manifest reset with `--yes`, `--demo` marker reset, reverse order, ownership guard). [SKILL: commercetools-platform] Tests `scripts/seed/reset.test.ts`: "Reset limited to what was seeded: …" (fake holds seeded plus hand-made category `hand-made`; after reset only the hand-made one remains; dry run deletes nothing), demo reset deletes only resources with `demoMarker`, recurring order is canceled before deletion.
- [ ] F-12 Create `scripts/seed/cleanup-furniture.ts` `--list` mode: computes the delete-set, writes the `CLEANUP-LISTING` block (add the heading and marker pair to `plan/PROJECT-FINDINGS.md`), writes the JSON backup, prints `listing-sha256`. [SKILL: commercetools-platform] Tests `scripts/seed/cleanup-furniture.test.ts`: listing from a fake holding the baseline shape (3 types, products, 29 categories, inventory, `FurnitureBOGO`, `BOGO`) names every class; `UNMATCHED` inventory or an extra product type stops with exit 4; the exclusion lists are printed.
- [ ] F-13 Extend `cleanup-furniture.ts` with `--execute`: OA-04 status gate (parses `plan/TODO-MANUAL-TESTING.md`), hash check, backup check, deletion order, re-runnability. Tests (same file): "execute without OA-04 APPROVED exits 5 and deletes nothing", "hash mismatch exits 5", deletion order recorded by the fake (codes → discounts → products unpublish+delete → inventory → categories deepest first → product types), second run prints `Nothing to clean up.`, a key outside the set is never deleted.
- [ ] F-14 **Live, with OA-03:** run `npm run seed:settings -- --confirm-project spec-test-b2c-telecom --check-only` (read-only), then `npm run seed:cleanup -- --list` and commit the filled `PROJECT-FINDINGS.md` block; **stop and ask the owner for OA-04** (write the request in `plan/QUESTIONS.md` with the hash). No deletion before `APPROVED`.
- [ ] F-15 **Live, after OA-04 `APPROVED`:** `npm run seed:cleanup -- --execute --confirm-project spec-test-b2c-telecom`; then `npm run seed -- --plan`, `npm run seed -- --confirm-project spec-test-b2c-telecom` (market-level kinds exist now; G adds the catalog), `npm run seed:verify`; record "what the cleanup deleted" (counts), adopted zone keys and the verify output (no secrets) in `PROJECT-FINDINGS.md`; run `npm run verify`; report C-F checks.

## Unit tests (scenario → test)
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Second run changes nothing | `seeding-framework` | `scripts/seed/reconcile.test.ts` → "Second run changes nothing: every item unchanged and zero writes" |
| Manifest edited | `seeding-framework` | `scripts/seed/reconcile.test.ts` → "Manifest edited: only the affected resource is updated and listed as updated" |
| Interrupted run resumes | `seeding-framework` | `scripts/seed/reconcile.test.ts` → "Interrupted run resumes: existing keys recognised, remaining created, no duplicates" |
| Dependencies respected | `seeding-framework` | `scripts/seed/reconcile.test.ts` → "Dependencies respected: resources are created in dependency order" |
| Dangling reference caught before any write | `seeding-framework` | `scripts/seed/validate.test.ts` → "Dangling reference caught before any write: names the missing key and the referrer, zero writes" |
| Plan mode | `seeding-framework` | `scripts/seed/seed.test.ts` → "Plan mode: prints created, updated and unchanged and makes no write calls" |
| Target not confirmed | `seeding-framework` | `scripts/seed/config.test.ts` → "Target not confirmed: refuses before any write and names the project key found" |
| Reset limited to what was seeded | `seeding-framework` | `scripts/seed/reset.test.ts` → "Reset limited to what was seeded: hand-made resources stay untouched" |
| Incompatible product type change | `seeding-framework` | `scripts/seed/reconcile.test.ts` → "Incompatible product type change: reports the conflict and skips the type and its products" |
| Credentials kept out of the repository | `seeding-framework` | `scripts/seed/config.test.ts` → "Credentials kept out of the repository: .env.seed ignored, site source never imports scripts/seed, example file has no values" |
| Shipping option is free | `seed-shipping-and-market-settings` | `scripts/seed/reconcilers/shipping.test.ts` → "Shipping option is free: every USD and EUR rate is zero and matches a US cart" |
| Digital-only cart | `seed-shipping-and-market-settings` | `scripts/seed/reconcilers/shipping.test.ts` → "Digital-only cart: only the digital method matches an add-on-only cart" |
| Every product taxable | `seed-shipping-and-market-settings` | `scripts/seed/verify.test.ts` → "Every product taxable: tax category has US and DE rates and every product has a tax category" |
| Storefront sees only the intended assortment | `seed-shipping-and-market-settings` | `scripts/seed/verify.test.ts` → "Storefront sees only the intended assortment: a published non-Malva product fails the check" |
| Project settings missing | `seed-shipping-and-market-settings` | `scripts/seed/project-settings.test.ts` → "Project settings missing: stops before writing and names the setting and where to change it" |
| Shipping rate changed later | `seed-shipping-and-market-settings` | `scripts/seed/reconcilers/shipping.test.ts` → "Shipping rate changed later: the method is updated in place" |

(The test file for the reconciler suites sits at `scripts/seed/reconcilers/*.test.ts`; the path in F-04…F-07 above is the same folder.)

## Chrome verification (run by Claude)
No browser surface exists in F; the checks use the commerce MCP read tools (REST equivalents given) and the CLI output. Claude records results in `VERIFICATION-LOG.md`.
- C-F-1 (needs OA-03, OA-04): after F-15, MCP `read_product_types` (GET `/spec-test-b2c-telecom/product-types`) → `total` is 0 or only `malva-*` types; MCP `read_categories` → `total` 0 or all keys start `malva-cat-`; MCP `read_inventory` → every `sku` starts `MLV-` (or total 0); MCP `read_products` → total 0 or only Malva product types.
- C-F-2 (needs OA-03, OA-04): MCP `read_shipping_methods` → methods `malva-shipping-standard` and `malva-delivery-digital` exist, `active: true`, `isDefault: false`, every `zoneRates[].shippingRates[].price.centAmount` is `0`, zone ids belong to zones holding US and DE; the sample `standard-shipping` and `express-shipping` still exist unchanged.
- C-F-3 (needs OA-03): MCP `read_tax_categories` (key `malva-telecom-services`) → rates for `US` and `DE`, both `amount: 0`; `standard-tax` unchanged; MCP `read_recurrence_policies` → `malva-monthly` with schedule `{ type: "standard", value: 1, intervalUnit: "Months" }`; MCP `read_customer_groups` → four keys.
- C-F-4 (needs OA-03): MCP `read_project` → `searchIndexing.products.status` is `Activated` (or `Indexing` right after activation, then `Activated` within 30 minutes); countries still include `GB`, `DE`, `US`; MCP `read_product_search` with `{ "query": { "exact": { "field": "key", "value": "malva-offer-cable-100" } } }` is **skipped until G is Verified** (no offers yet), then returns `total: 1`.
- C-F-5 (needs OA-03): run `cd site && npm run seed -- --plan` and `npm run seed:verify` on the seeded project → plan shows only `unchanged`, verify prints `All checks passed.` for the F checks; run `npm run seed -- --confirm-project wrong-key` → exit code 2, message contains `wrong-key`.
- C-F-6 (needs OA-03, OA-04): `git status` after all runs shows no `.env.seed`, no `scripts/seed/.backup/` and no secret in `plan/PROJECT-FINDINGS.md` (`npm run check:secrets` passes).

## Manual tests (owner only)
None. (The owner actions OA-03 and OA-04 are in `TODO-MANUAL-TESTING.md`; F stops at F-14 until OA-04 is `APPROVED`.)

## Excluded
- Spec components `Store` `malva-us` and `ProductSelection` `malva-all-offers` (and the matching dependency-order entry "stores and product selections"): not built, **D-058** (no Stores). The behaviour they were meant to give is checked as described in the table row for the "intended assortment" scenario.
- Spec component "Market configuration: one `COUNTRY_CONFIG` entry in `site/`": belongs to workstream D (market config); F only tests that its `MARKETS` agree with `routing.locales`.
- Spec requirement text about the Pexels key being a seeding credential: the image method is D-055 (no key); see workstream G.
- Import API usage: not used (spec modeling note; tens of resources, synchronous API chosen).

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test.
- [ ] C- lines present; STATUS set to `Ready for review`.
- [ ] OA-04 is `APPROVED`, `seed:cleanup --execute` ran once, `PROJECT-FINDINGS.md` holds the listing, the deletion counts, scopes (names only), adopted zone keys.
- [ ] `npm run seed:verify` green for F's checks on the live project; Product Search `Activated` (Gate 1 part one).
