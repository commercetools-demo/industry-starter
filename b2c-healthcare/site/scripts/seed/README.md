# Seed scripts

Replace the sample furniture data in the commercetools project `spec-test-b2c-healthcare` with healthcare data, and rebuild it from nothing when needed. Run from `site/`; every script accepts `--dry-run`.

## Safety guard (read first)

- Credentials come only from `site/.env.seed.local` (copy `.env.seed.example`) or `SEED_CTP_*` variables in the shell. Never commit them, never paste them in chat.
- `lib.ts: getAdminRoot()` refuses to run unless `SEED_CTP_PROJECT_KEY` is exactly `spec-test-b2c-healthcare` (checked before any network call) and the project the API reports has the same key. A missing variable is named in the error.
- Everything the seed creates has a key starting with `mlv-` (inventory entries `mlv-inv-<sku>`). `cleanup-sample.ts` deletes only what is NOT prefixed; `reset-seed.ts` deletes only what IS prefixed. Both need `--confirm spec-test-b2c-healthcare` (or `--dry-run`).
- Seeding is idempotent (a second run prints `0 change(s)`). An existing resource that differs from the seed is UPDATED in place where commercetools allows it (`update-plans.ts`: prices, attributes, `isSearchable`, new type fields and enum values, shipping rates, tax rates, limits). Where it does not (an attribute type change, a changed SKU, a removed attribute), the run stops with exit 1 and says exactly which reset is needed (`npm run seed:full`).

## One command: `npm run seed:full` (D-038)

```
npm run seed:full -- --dry-run     # lists everything it would delete and create; verify and the search wait are skipped
npm run seed:full                  # passes --confirm spec-test-b2c-healthcare itself
```

reset (`--include-customers`: reviews, `mlv-` resources, every `malva-*` Custom Object container, recurrence policies, the example.com customers with their carts, orders, payments, shopping lists and recurring orders, all deleted with `dataErasure`) → cleanup-sample → seed → verify (looks again for up to 25 s while rating statistics catch up) → wait-for-search. One process, one client, the project-key guard before any network call. Run `seed:reset` alone (without `--include-customers`) to keep customers; a custom type that a customer's cart still uses then cannot be deleted and the error says so.

## Order of a manual run

```
npm run seed:inventory                                   # read-only: counts per resource kind
npm run seed:cleanup -- --dry-run                        # lists what would go
npm run seed:cleanup -- --confirm spec-test-b2c-healthcare
npm run seed                                             # second run must print "0 change(s)"
npm run seed:wait                                        # wait until Product Search holds the 28 products
npm run seed:verify
```

## Scripts

| Script | What it does |
| --- | --- |
| `lib.ts` | project guard, env loading, upsert-by-key helpers, 429 retry, write pause, `ensureKeyed`, diff functions |
| `inventory-project.ts` (`seed:inventory`) | read-only table of counts per kind (for `plans/PROJECT-FINDINGS.md`) |
| `wait-for-search.ts` (`seed:wait`) | checks `searchIndexing.productsSearch.status` is `Activated`, polls Product Search (prefix on `key`) until the seeded count is reached (timeout 5 min, `--expected N`, `--timeout-min M`) |
| `cleanup-sample.ts` (`seed:cleanup`) | deletes non-`mlv-` carts, orders, inventory, products (unpublish first), categories (leaves first), product types, shipping methods, tax categories, stores, zones. Keeps zones `usa` and `europe`; never deletes customers |
| `seed.ts` (`seed`) | channels, tax categories, order states and transitions, custom types, product types, categories, same-day zone, shipping methods, 8 doctors, 20 medications, inventory with cart limits. `--only <product-key>` limits the product steps |
| `seed-full.ts` (`seed:full`) | the whole sequence above in one process; `--dry-run` supported |
| `update-plans.ts` | what a changed seed updates in place, and the reset hint for what cannot be updated |
| `verify.ts` (`seed:verify`) | read-back assertions: counts, prefixes, published, USD, doctor fees and modes vs price channels, shipping cents, inventory limits, states, types, categories, Product Search finds "Okafor" (`--skip-search`) |
| `reset-seed.ts` (`seed:reset`) | deletes reviews, then only `mlv-` resources, and every `malva-*` Custom Object so the seed can be rebuilt; `--include-customers` also erases the example.com customers and their data |
| `fake-root.ts` | in-memory project used by the unit tests; refuses the same deletions the real API refuses (published product, category with children, ...) |
| `data/` | `types.ts`, `states.ts`, `categories.ts`, `tax.ts`, `shipping.ts`, `doctors.ts`, `medications.ts` |

## Clinical stand-in (workstream F)

`seed.ts` also seeds (not with `--only`): 3 to 6 verified reviews per doctor, Custom Objects `malva-schedule` (8), `malva-rx` (7: four from the prototype and Jordan, plus one controlled-class prescription each for Sam, Alex and Jordan), `malva-lab` (5), `malva-credential` (2: Sam active, Jordan pending, Alex none), `malva-allowance` (Sam's $50.00 for the current monthly cycle; create-only, never reset by a re-seed), `malva-booking` (1 past booking), and three synthetic patients (`sam.rivera@`, `alex.chen@`, `jordan.lee@example.com`; verified email, one default address, `mlv-patient.patientRef`). The customers need `SEED_PATIENT_PASSWORD` (without it they are skipped). Prescriptions and the past booking are never overwritten (refills change when an order dispenses); schedules, labs and credentials are compared and a difference stops the run.

| Script | What it does |
| --- | --- |
| `smoke-slots.ts` | `npx tsx scripts/seed/smoke-slots.ts [doctor-key] [remote\|office]`: prints free slots and claims one twice (`version: 0`); the second claim must fail with 409; the test claim is deleted |
| `advance-order.ts` (`seed:advance`) | `npm run seed:advance -- <orderNumber> <state> [--shipment <ShipmentState>] [--dry-run]`: QA tool, moves an order through the `mlv-*` states (refuses unknown transitions); `--shipment Partial` (or Pending, Ready, Shipped, Delivered, Backorder, Delayed) sets the order's `shipmentState` for the order page |

`reset-seed.ts` deletes the reviews and every `malva-*` container (`containers.ts` lists the 13 of `lib/ct/custom-objects.ts`; a test keeps them in step); customers only with `--include-customers`.

## API client scopes

The storefront client's scopes are the comments of `site/.env.example` (a reason per scope; `lib/ct/scopes.test.ts` fails on a duplicate, a missing reason or a resource the code calls without a scope). The seed admin client's scopes are the comments of `site/.env.seed.example`: simplest is `manage_project`, the narrow list is there with the script that needs each one. The exact text for the owner is in `plans/notes/AC-todos.md`.

## Data model notes

- Doctors: one variant (`DOC-<slug>`), `modes` attribute, USD fee per mode as a price on channel `mlv-remote` / `mlv-office` (D-031). Prices are tax-exclusive; tax is 0% US (D-033).
- Medications: price per pack, `maxQtyPerOrder` mirrored as the native inventory `maxCartQuantity`, one demo SKU (`MED-famotidine-20-mg`) has a fixed `expiryDate` custom field on its inventory entry (type `mlv-inventory-meta`).
- Tests never use the network or real credentials: `npx vitest run scripts/seed`.

## Synthetic-only guard and Messages check (workstream X)

`seed.ts` refuses to run (before any write) unless every patient and booking in `data/` is synthetic: emails on `example.com`, phone numbers in the 555-01xx range (`synthetic.ts`). `seed:verify` fails when Messages are enabled in the project (they copy changed field values into a log that only `dataErasure` reaches). Privacy operations live in `scripts/privacy/` (see `docs/privacy-inventory.md`).
