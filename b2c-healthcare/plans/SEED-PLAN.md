# Seed plan (workstreams E and F)

Goal: replace the sample furniture data in `spec-test-b2c-healthcare` with healthcare data, **by scripts** a junior can re-run, so the project can be rebuilt from nothing. Modeled on `b2c-grocery/site/scripts/seed/` (`seed.ts`, `update-images.ts`, `verify.ts`, `cleanup-*.ts`, `data/`), adjusted for this domain. Status: **DRAFT** — items marked ⟨Q-nnn⟩ depend on an owner answer.

## Safety rules (apply to every script)
- Load credentials from environment only (`SEED_CTP_*`, a **separate admin client** from the storefront's; OA-01). Never print them.
- Refuse to run unless `project.key === 'spec-test-b2c-healthcare'` (`lib.ts: getAdminRoot()` reads the project and compares).
- Everything the seed creates carries the prefix `mlv-` in its `key` (custom-object containers `malva-*`). `cleanup-sample.ts` deletes only what is **not** prefixed, behind `--confirm spec-test-b2c-healthcare`; `reset-seed.ts` deletes only prefixed resources.
- Idempotent: upsert by key; a second run changes nothing (`verify.ts` proves it).
- `--dry-run` prints the action list and writes nothing (also no JSON files).
- Product data contains **no real people**. Patients are synthetic (`sam.rivera@example.com` style), passwords come from `SEED_PATIENT_PASSWORD`.

## Layout (inside `site/scripts/seed/`)
```
lib.ts                 admin root, key guard, upsert helpers, rate-limit pause
cleanup-sample.ts      remove non-mlv resources (order: carts, orders, inventory, products unpublished→deleted, categories children→parents, product types, shipping methods, tax categories, stores)
seed.ts                create/update everything below, in dependency order
update-images.ts       pick and store product and banner images (see Images)
verify.ts              read-back assertions (counts, keys, search finds a doctor, prices USD, every product has images)
reset-seed.ts          delete only mlv- resources
data/
  doctors.ts           8 doctors from the prototype (DESIGN.md) + extra profile data
  medications.ts       ~20 medicines (the 5 from RX fixtures + common OTC/Rx)
  categories.ts  shipping.ts  tax.ts  types.ts  states.ts
  patients.ts          3 demo patients (one with prescriptions + labs, one empty, one with refills exhausted)
  prescriptions.ts  labs.ts  reviews.ts  schedules.ts
  product-images.json  site-images.json   (generated, committed)
```
All scripts run as `npx tsx scripts/seed/<name>.ts [--dry-run] [--only <key>]`.

## What gets created (proposed model; ⟨Q-001⟩⟨Q-002⟩⟨Q-004⟩ can change parts)
| Resource | Content |
| --- | --- |
| **Product type `mlv-doctor`** | attributes: `specialty` (enum, searchable), `yearsExperience` (number), `languages` (set of text), `education` (ltext), `clinicName` (text), `city` (enum, searchable), `timezone` (text, IANA), `modes` (set enum remote/office, searchable). Bio = product description. Rating and review count come from Reviews, not attributes |
| Doctor products | 8 doctors, key `mlv-doc-<slug>`, **one variant** (SKU `DOC-<slug>`) with **two USD prices on channels `mlv-remote` and `mlv-office`** (price channels of role `ProductDistribution`/price scope); a doctor offering one mode has one price; `modes` attribute lists offered modes. Price selection by channel gives the fee per mode; Product Search filters on `modes` (Q-002 answered) |
| **Product type `mlv-medication`** | `strength`, `dosageForm` (enum), `rxOnly` (boolean, searchable), `dispenseUnit` (text), `minRemainingShelfLifeDays` (number), `maxQtyPerOrder` (number; mirrored as native inventory limit) |
| Medication products | ~20, key `mlv-med-<slug>`, SKU `MED-<slug>`; price per pack in USD; inventory entry per SKU with `setInventoryLimits` (native max per cart) where the product has a ceiling |
| Categories | roots `mlv-doctors` (children = 7 specialties) and `mlv-medicines` (children = classes: antibiotics, pain relief, allergy, cardiovascular…) |
| Tax categories | `mlv-rx-medicine` and `mlv-consultation`, US rate 0% ⟨Q-012⟩; the sample `standard-tax` is deleted |
| Zones / shipping | reuse zone `usa`; shipping methods `mlv-standard` (1–2 days, $0), `mlv-same-day` (by 8 pm, $5.00, same-day cut-off enforced by the BFF, not by CT ⟨Q-013⟩) |
| Custom types | line item `mlv-rx-line` (`rxNumber`, `rxLineRef`, `prescribedQty`, `dispensedAuthRef`); customer `mlv-patient` (`patientRef` opaque id) ⟨Q-004⟩; order `mlv-order-meta` (`pharmacistReviewedAt`) |
| States | order states `mlv-received` → `mlv-pharmacist-review` → `mlv-packed-shipped` → `mlv-delivered` (+`mlv-cancelled`) matching the timeline ⟨Q-014⟩ |
| Reviews | 3–6 per doctor, `customer`-less verified flag in a review custom field; ratings roll up into product rating statistics |
| Custom objects (containers) | `malva-schedule` (weekly pattern per doctor), `malva-slot-claim` (one object per booked slot, created with `version: 0` so a second claim fails: double-booking protection), `malva-booking`, `malva-rx`, `malva-lab`, `malva-dispense-ledger`, `malva-counter` ⟨Q-001⟩⟨Q-004⟩⟨Q-005⟩ |
| Price channels | `mlv-remote`, `mlv-office` |
| Customers | 3 synthetic patients with verified email, one default address each |
| Project setting | Product Search indexing already activated (2026-10-08); E-02 verifies and waits for the index to fill |

## Images
Inspired by `b2c-grocery/site/scripts/seed/update-images.ts`.
- `update-images.ts [--dry-run] [--only <key>] [--count 2]` searches pexels.com's public JSON endpoint for each **medication** and each **doctor** (portrait query by specialty/gender-neutral terms such as "female doctor portrait"; the owner chose portraits, Q-035) and for every **banner** slot (home hero, closing CTA band, prescription-delivery block, 3 journal covers, 3 doctor-list/page-head backgrounds if used).
- **URLs are stored clean: no query string, no fragment** (`cleanUrl()` from the grocery script, with its unit test). The picked list is written to `data/product-images.json` (products) and `data/site-images.json` (banners, keyed by slot name) so a fresh seed reproduces the same photos.
- Products: old images are removed, new ones added to every variant, product published (as in the grocery script). Banners are consumed by `site/content/images.ts`, not stored in commercetools.
- Search terms are product names without pack sizes (`searchTerm()`); for medicines prefer a generic term ("pills blister pack", "medicine bottle") because brand names return noise: `data/medications.ts` has an `imageQuery` field per product.
- Risk to note in the README: the endpoint is undocumented and the client id is public; fall back to the official Pexels API with a key if it breaks. Licence: Pexels licence (free to use, attribution not required but recorded in `site-images.json` with photographer when the response provides it).
- Unit tests: `cleanUrl` strips queries; `pickUrls` dedupes after cleaning; `parseArgs` bounds; none hit the network.

## Verification (Claude, after each seed run)
1. `verify.ts` passes. 2. `read_products` (MC MCP) shows 8 doctors + ~20 medications, none unprefixed, all published, all USD, all with ≥1 clean image URL (no `?`). 3. `read_product_search` finds "Okafor" and facet `specialty`. 4. `read_shipping_methods` shows two methods with USD cents correct. 5. `read_custom_objects` shows containers with expected counts. 6. A second seed run reports 0 changes.
