# Workstream E — Seed: clean sample data, catalog data model, images

**Depends on:** A
**Implements:** (none: see `plans/SEED-PLAN.md`; models decisions D-011, D-031, D-033)
**Skills:** commercetools-catalog-migration, commercetools-platform

## Design
Follow `plans/SEED-PLAN.md` (safety rules, layout, data model, images). Scripts live in `site/scripts/seed/` and run with `npx tsx scripts/seed/<name>.ts [--dry-run] [--only <key>]`. Credentials come from `site/.env.seed.local` (OA-01); the guard refuses any project other than `spec-test-b2c-healthcare`. All created keys use the prefix `mlv-`. Content decisions:
- **Doctors** (8, from `design/source/app-core.jsx`): one variant (SKU `DOC-<slug>`), `modes` attribute, two USD prices on price channels `mlv-remote` and `mlv-office` (D-031). Fees are the prototype's. Description = bio. Category = the specialty. Images = Pexels portraits (Q-035).
- **Medications** (~20): the five from the prototype (Amoxicillin 500 mg 21 caps $14.50, Ibuprofen 400 mg 20 tabs $6.20, Cetirizine 10 mg 30 $8.90, Atorvastatin 20 mg 30 $18.75, Lisinopril 10 mg 30 $11.40) plus common Rx/OTC; attributes `strength`, `dosageForm`, `rxOnly`, `dispenseUnit`, `minRemainingShelfLifeDays`, `maxQtyPerOrder`, `hsaEligible` (for U), `controlClass` (for U; two controlled demo products), `imageQuery`. One inventory entry per SKU (`quantityOnStock` ≥ 500); native `setInventoryLimits.maxCartQuantity` where `maxQtyPerOrder` is set. One demo SKU carries a short-dated `expiryDate` custom field on its inventory entry (expiry-dated-supply).
- Categories, tax (`mlv-rx-medicine`, `mlv-consultation`, US 0%, D-033), zone `mlv-same-day-states` (US/NY, US/TX, US/IL) alongside the existing `usa`, shipping methods `mlv-standard` ($0, "1–2 business days") and `mlv-same-day` ($5.00, "By 8 pm", zone `mlv-same-day-states`; the 14:00 NY cut-off is enforced by the BFF in Q), order **States** (`mlv-received`, `mlv-pharmacist-review`, `mlv-packed-shipped`, `mlv-delivered`, `mlv-cancelled`), custom **Types** (`mlv-rx-line` on line items: `rxNumber`, `rxLineRef`, `prescribedQty`, `credentialRef`, `eligibleForRestricted`, `coveredAmount`; `mlv-patient` on customers: `patientRef`, `fundingScheme`; `mlv-order-meta` on orders: `allowanceApplied`, `restrictedApplied`), channels, review type `mlv-review-meta` (`verifiedPatient`).
- Search: Product Search indexing is already activated (project note); E waits for the index to contain the seeded products.

## Tasks
- [x] E-01 `scripts/seed/lib.ts`: `getAdminRoot()` with project-key guard, env check naming missing `SEED_CTP_*`, `--dry-run` support, rate-limit pause, upsert-by-key helpers; `scripts/seed/inventory-project.ts` prints counts of every resource kind (carts, orders, customers, …) so `PROJECT-FINDINGS.md` can be completed [SKILL: commercetools-platform]
- [x] E-02 `scripts/seed/wait-for-search.ts`: confirm `searchIndexing.productsSearch.status === 'Activated'` and poll `products().search()` until the expected count is returned (timeout 5 min) [SKILL: commercetools-platform]
- [x] E-03 `cleanup-sample.ts --confirm spec-test-b2c-healthcare`: delete every resource **without** the `mlv-` prefix in dependency order (carts, orders, inventory, products unpublish→delete, categories leaves first, product types, shipping methods, tax categories, stores, unused zones except `usa`); dry-run lists; tests with a fake root assert order and that `mlv-` resources are never touched [SKILL: commercetools-platform]
- [x] E-04 `data/types.ts` + `data/states.ts` + `data/categories.ts` + `data/tax.ts` + seeding of product types `mlv-doctor`, `mlv-medication`, custom types, states with transitions, categories (`mlv-doctors` + 7 specialties, `mlv-medicines` + classes), channels, tax categories [SKILL: commercetools-catalog-migration]
- [x] E-05 `data/shipping.ts`: zone `mlv-same-day-states`, shipping methods `mlv-standard` and `mlv-same-day` with USD rates in cents (500 = $5.00), `taxCategory = mlv-consultation`-free (use `mlv-rx-medicine`), `active`, default = standard [SKILL: commercetools-commerce-patterns]
- [x] E-06 `data/doctors.ts` + seed of 8 doctor products (published, USD prices on channels, categories, attributes, slug en-US = name slug); test: every doctor has ≥1 price, `modes` consistent with price channels [SKILL: commercetools-catalog-migration]
- [x] E-07 `data/medications.ts` + seed of ~20 products, inventory entries and limits, tax category, `hsaEligible`/`controlClass`, the short-dated demo SKU; test: SKU uniqueness, price in USD cents, `maxQtyPerOrder` ↔ inventory limit [SKILL: commercetools-catalog-migration]
- [x] E-08 `update-images.ts` adapted from `b2c-grocery/site/scripts/seed/update-images.ts` for medications **and doctors**, plus `site-images.json` banner slots (`home-hero`, `home-cta`, `home-rx-delivery`, `journal-1..3`); **clean URL = no query, no hash**; writes `data/product-images.json` and `data/site-images.json`; tests (`cleanUrl`, `pickUrls` dedupe after cleaning, `parseArgs` bounds, `searchTerm`) never hit the network [SKILL: commercetools-platform]
- [x] E-09 `seed.ts` (calls everything above in order, idempotent) and `verify.ts` (read-back assertions listed in SEED-PLAN "Verification"), `reset-seed.ts` (deletes only `mlv-`); npm scripts `seed`, `seed:verify`, `seed:images`, `seed:cleanup` [SKILL: commercetools-platform]
- [ ] E-10 Run everything against the project (needs OA-01): cleanup → seed → images → verify → second `seed` reports 0 changes; fill the empty rows of `plans/PROJECT-FINDINGS.md` (customers/orders counts, final resource counts) without secrets [SKILL: commercetools-platform]

## Scenarios
No OpenSpec scenarios; acceptance = `seed:verify` green and the Browser recipe.
<!-- SCENARIOS:BEGIN (generated by plans/verify-plan.mjs --sync) -->

<!-- SCENARIOS:END -->

## Browser recipe
Claude, with the Merchant Center MCP (`spec-b2c-health`): `read_products` → 8 `mlv-doc-*` and ~20 `mlv-med-*`, **no** unprefixed products, all published, USD only, every image URL clean (no `?`); `read_product_search` finds "Okafor" and facets `specialty`/`modes`; `read_shipping_methods` shows exactly the two `mlv-` methods with correct cents; `read_states`, `read_types`, `read_product_types`, `read_categories` match the data files; open the product image URLs in the browser and see a photo; second seed run reports no changes.

## Manual tests (owner-only)
OA-01 only.

## Definition of done
JUNIOR-GUIDE §9, plus: the project contains no furniture; `PROJECT-FINDINGS.md` updated; seed README in `site/scripts/seed/README.md` explains each script and the safety guard.
