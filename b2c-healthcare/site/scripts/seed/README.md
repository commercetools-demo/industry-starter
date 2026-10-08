# Seed scripts

Replace the sample furniture data in the commercetools project `spec-test-b2c-healthcare` with healthcare data, and rebuild it from nothing when needed. Run from `site/`; every script accepts `--dry-run`.

## Safety guard (read first)

- Credentials come only from `site/.env.seed.local` (copy `.env.seed.example`) or `SEED_CTP_*` variables in the shell. Never commit them, never paste them in chat.
- `lib.ts: getAdminRoot()` refuses to run unless `SEED_CTP_PROJECT_KEY` is exactly `spec-test-b2c-healthcare` (checked before any network call) and the project the API reports has the same key. A missing variable is named in the error.
- Everything the seed creates has a key starting with `mlv-` (inventory entries `mlv-inv-<sku>`). `cleanup-sample.ts` deletes only what is NOT prefixed; `reset-seed.ts` deletes only what IS prefixed. Both need `--confirm spec-test-b2c-healthcare` (or `--dry-run`).
- Seeding is create-if-missing and idempotent; an existing resource that differs is reported (exit 1), never overwritten.

## Order of a full run

```
npm run seed:inventory                                   # read-only: counts per resource kind
npm run seed:cleanup -- --dry-run                        # lists what would go
npm run seed:cleanup -- --confirm spec-test-b2c-healthcare
npm run seed                                             # second run must print "0 change(s)"
npm run seed:wait                                        # wait until Product Search holds the 28 products
npm run seed:images                                      # picks photos, updates products, writes data/*.json
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
| `update-images.ts` (`seed:images`) | searches pexels.com for every doctor (portrait), medication (generic `imageQuery`) and banner slot; replaces product images and republishes; writes `data/product-images.json` and `data/site-images.json`. `--count 1..6`, `--only <key\|slot>` |
| `verify.ts` (`seed:verify`) | read-back assertions: counts, prefixes, published, USD, clean image URLs, doctor fees and modes vs price channels, shipping cents, inventory limits, states, types, categories, Product Search finds "Okafor" (`--skip-search`, `--no-images`) |
| `reset-seed.ts` (`seed:reset`) | deletes only `mlv-` resources so the seed can be rebuilt |
| `fake-root.ts` | in-memory project used by the unit tests; refuses the same deletions the real API refuses (published product, category with children, ...) |
| `data/` | `types.ts`, `states.ts`, `categories.ts`, `tax.ts`, `shipping.ts`, `doctors.ts`, `medications.ts`, `site-slots.ts`, generated `product-images.json` / `site-images.json` |

## Clinical stand-in (workstream F)

`seed.ts` also seeds (not with `--only`): 3 to 6 verified reviews per doctor, Custom Objects `malva-schedule` (8), `malva-rx` (4), `malva-lab` (5), `malva-credential` (1), `malva-booking` (1 past booking), and three synthetic patients (`sam.rivera@`, `alex.chen@`, `jordan.lee@example.com`; verified email, one default address, `mlv-patient.patientRef`). The customers need `SEED_PATIENT_PASSWORD` (without it they are skipped). Prescriptions and the past booking are never overwritten (refills change when an order dispenses); schedules, labs and credentials are compared and a difference stops the run.

| Script | What it does |
| --- | --- |
| `smoke-slots.ts` | `npx tsx scripts/seed/smoke-slots.ts [doctor-key] [remote\|office]`: prints free slots and claims one twice (`version: 0`); the second claim must fail with 409; the test claim is deleted |
| `advance-order.ts` (`seed:advance`) | `npm run seed:advance -- <orderNumber> <state> [--dry-run]`: QA tool, moves an order through the `mlv-*` states; refuses unknown transitions |

`reset-seed.ts` does not delete reviews, customers or Custom Objects; see `plans/notes/F-todos.md`.

## Images

`update-images.ts` uses the public JSON endpoint behind pexels.com/search (undocumented, public web client id). It may break; the fallback is the official Pexels API with a key (needs a small change in `searchPexels`). Pexels licence: free to use, attribution not required; the photographer is stored in `site-images.json` when the response provides it. Stored URLs are clean (no query, no fragment): `cleanUrl()`.

## Data model notes

- Doctors: one variant (`DOC-<slug>`), `modes` attribute, USD fee per mode as a price on channel `mlv-remote` / `mlv-office` (D-031). Prices are tax-exclusive; tax is 0% US (D-033).
- Medications: price per pack, `maxQtyPerOrder` mirrored as the native inventory `maxCartQuantity`, one demo SKU (`MED-famotidine-20-mg`) has a fixed `expiryDate` custom field on its inventory entry (type `mlv-inventory-meta`).
- Tests never use the network or real credentials: `npx vitest run scripts/seed`.
