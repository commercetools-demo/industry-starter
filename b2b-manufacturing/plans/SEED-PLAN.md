# Seed plan (workstream E, and demo data for T)

Goal: put everything the Malva storefront needs into the commercetools project **by scripts** a junior can re-run, so the project can be rebuilt from nothing, and remove the sample data that came with the project. Modelled on `b2c-grocery/site/scripts/seed/` (`seed.ts`, `verify.ts`, `cleanup-*.ts`, `data/`). Package: `b2b-manufacturing/seed/` (D14). Project: the one behind the `spec-b2b-manufacturing` MCP (D10).

## Safety rules (apply to every script)
- Credentials from environment only: `seed/.env.local` with `SEED_CTP_*` (a **separate admin client**, OA-01). Never printed, never committed.
- `SEED_CTP_PROJECT_KEY` must equal `EXPECTED_PROJECT_KEY` (the same value, repeated in `seed/.env.local`; a second source so a pasted wrong value fails). The scripts also read the project and compare its key, and **refuse to run if the key contains `healthcare`** (the other team's project).
- Everything the seed creates has the key prefix `mpw-` (custom-object containers `mpw-*`).
- **No wildcard deletion.** `inventory-sample.ts` lists every resource whose key is **not** `mpw-` into `data/sample-inventory.json` for review (Claude reviews it through the MCP before anything is deleted). `cleanup-sample.ts --manifest data/sample-inventory.json --confirm <projectKey>` deletes **exactly** what is in that file and nothing else. `reset-seed.ts` deletes only `mpw-` resources.
- Idempotent: upsert by key; a second run changes nothing (`verify.ts` proves it). `--dry-run` prints the action list and writes nothing (also no JSON files).
- Demo customers are synthetic (`*@example.com`); passwords come from `SEED_DEMO_PASSWORD`.

## Layout (`seed/`)
```
package.json  tsconfig.json  vitest.config.ts  .env.example  README.md
src/
  lib.ts                 env loading, admin root, key guards, upsert helpers, rate-limit pause, --dry-run
  configure-project.ts   project settings (Product Search, tax fallback, languages, countries, currencies, My-BU defaults)
  inventory-sample.ts    write data/sample-inventory.json (non-mpw resources)
  cleanup-sample.ts      delete exactly the reviewed manifest
  seed.ts                create/update everything below, in dependency order
  verify.ts              read-back assertions
  reset-seed.ts          delete only mpw- resources
  data/
    services.ts          the 12 services (copy, sectors, frequencies, flags)
    categories.ts  types.ts  tax-shipping.ts  roles.ts  demo.ts  portal-demo.ts  site-image-slots.ts
    product-images.json  site-images.json   (generated, committed; clean URLs)
```
All scripts run as `npx tsx src/<name>.ts [--dry-run] [--only <key>]`.

## What gets created
| Resource | Content |
| --- | --- |
| **Project settings** | `changeProductSearchIndexingEnabled {enabled: true, mode: 'ProductsSearch'}`; `changeCountryTaxRateFallbackEnabled true` (owner request); languages `en-US`, `de-DE`; countries `US`, `DE`; currencies `USD`, `EUR` (adds, never removes what the project already has); `changeMyBusinessUnitStatusOnCreation Active` is **not** set (registration uses the provisioning client, D18) |
| **Tax category `mpw-service-vat`** | DE 19 % (not included in price); US 0 % fallback (state sales tax is stated on the quote) |
| **Zone `mpw-service-area`** | locations US, DE |
| **Shipping method `mpw-on-site-service`** | "On-site service, no delivery", default, tax category above, zone `mpw-service-area`, rate 0 in USD and in EUR |
| **Product type `mpw-service`** | attributes: `summary` (ltext), `sectors` (set of enum: facilities, manufacturing, property, healthcare; searchable), `frequencies` (set of enum: one-off, weekly, fortnightly, monthly, quarterly, annual), `included` (set of ltext), `steps` (set of ltext), `records` (set of ltext), `faq` (set of nested `mpw-faq-item`), `related` (set of reference product), `needs-waste-details` (boolean), `display-order` (number), all `SameForAll` (single variant). The nested `faq` attribute references `mpw-faq-item` **by id** (the platform does not accept a key there), so the seed creates the FAQ type first and looks up its id |
| **Product type `mpw-faq-item`** (nested) | `question`, `answer` (ltext) |
| **Categories** | `mpw-plumbing` (name "Plumbing", slug `plumbing`), `mpw-waste-management` ("Waste management", `waste-management`), order hints for display |
| **Products (12)** | key `mpw-svc-<slug>`, SKU `MPW-<SLUG>`, one variant, prices **USD 0 and EUR 0** (D12), tax category `mpw-service-vat`, categories, 1+ images (clean URLs), published. Order, names and descriptions per `design/malva/specs/plp.md` |
| **Store `mpw-web`** | languages en-US, de-DE; countries US, DE |
| **Product selection `mpw-all-services`** | all 12 products, assigned to store `mpw-web` as active |
| **Custom types** | `mpw-line-service` (line-item: frequency enum, note string); `mpw-quote-request` (quote-request: sector enum, siteCount enum, wasteTypes, permitNumber, notes, contactName, jobTitle, phone, reference); `mpw-customer` (customer: jobTitle, phone); `mpw-company` (business-unit: sector enum) |
| **Associate roles** | below |
| **Demo companies** | `mpw-demo-co` (the main demo: admin, site contact, finance users, 2 sites) and `mpw-other-co` (isolation test, one admin) with customers, addresses, business units, associates |
| **Portal demo data** (Custom Objects) | containers `mpw-visits`, `mpw-waste-docs`, `mpw-invoices`; keys `<buKey>.<id>`; ≈ 12 visits, 8 waste notes, 6 invoices for `mpw-demo-co`; different data for `mpw-other-co` |

### Associate roles (permissions verified against the `Permission` enum, D19)
| Role | buyerAssignable | Permissions |
| --- | --- | --- |
| `mpw-admin` | yes | CreateMyCarts, UpdateMyCarts, DeleteMyCarts, ViewMyCarts, ViewOthersCarts, CreateMyQuoteRequestsFromMyCarts, UpdateMyQuoteRequests, ViewMyQuoteRequests, ViewOthersQuoteRequests, ViewMyQuotes, ViewOthersQuotes, AcceptMyQuotes, AcceptOthersQuotes, DeclineMyQuotes, DeclineOthersQuotes, RenegotiateMyQuotes, RenegotiateOthersQuotes, CreateMyOrdersFromMyQuotes, ViewMyOrders, ViewOthersOrders, UpdateAssociates, UpdateBusinessUnitDetails, AddChildUnits |
| `mpw-site-contact` | yes | CreateMyCarts, UpdateMyCarts, DeleteMyCarts, ViewMyCarts, CreateMyQuoteRequestsFromMyCarts, UpdateMyQuoteRequests, ViewMyQuoteRequests, ViewMyQuotes, AcceptMyQuotes, DeclineMyQuotes, RenegotiateMyQuotes, CreateMyOrdersFromMyQuotes, ViewMyOrders |
| `mpw-finance` | yes | ViewMyQuoteRequests, ViewOthersQuoteRequests, ViewMyQuotes, ViewOthersQuotes, ViewMyOrders, ViewOthersOrders |

### Service data (`data/services.ts`; copy verbatim from `design/malva/specs/plp.md`)
| Key slug | Category | Sectors | Frequencies (Q-016) | Waste details |
| --- | --- | --- | --- | --- |
| pipe-installation-repair | plumbing | all four | one-off, annual | no |
| drain-cleaning-cctv-survey | plumbing | all four | one-off, quarterly, annual | no |
| backflow-water-testing | plumbing | facilities, manufacturing, property, healthcare | one-off, quarterly, annual | no |
| boiler-hot-water | plumbing | all four | one-off, annual | no |
| commercial-fit-outs | plumbing | all four | one-off | no |
| general-waste-collection | waste | all four | weekly, fortnightly, monthly | no |
| recycling | waste | all four | weekly, fortnightly, monthly | no |
| hazardous-waste | waste | manufacturing, healthcare, facilities | one-off, monthly, quarterly | **yes** |
| grease-trap-servicing | waste | facilities, manufacturing, healthcare, property | monthly, quarterly | no |
| medical-clinical-waste | waste | healthcare | weekly, fortnightly, monthly | **yes** |
| liquid-waste-tankering | waste | manufacturing, facilities | one-off, monthly, quarterly | **yes** |
| compliance-reporting | waste | all four | monthly, quarterly, annual | no |

Each also carries 4 included items, 3–4 steps, 2–3 records produced, 3 FAQ items and 2–3 related services, written as realistic copy in en-US and de-DE, not flagged as sample (Q-011; the owner may still edit it, SO-03). German copy lives in `seed/src/data/services.de.ts`.

## Images
Product and banner images are clean URLs (no query string, no fragment) in `data/product-images.json` and `data/site-images.json`; the seed applies them to the products. Test: every stored URL is clean.

## Verification (Claude, after each run, through the MCP)
1. `verify.ts` passes. 2. `read_products`: 12 services, all `mpw-svc-*`, published, one variant each with a 0 price in USD and EUR and ≥ 1 image whose URL has **no `?`**. 3. `read_categories`: the two. 4. `read_stores` + `read_product_selections`: `mpw-web` with `mpw-all-services` active. 5. `read_associate_roles`: three roles with the listed permissions. 6. `read_project`: Product Search `ProductsSearch` activated, `countryTaxRateFallbackEnabled` true. 7. `read_product_search` finds "drain" and returns 12 services. 8. A second seed run reports 0 changes. 9. `read_business_units`: `mpw-demo-co` and `mpw-other-co`, each with its associates.

## Status
Scripts and data: written, type-checked and unit-tested offline (`cd seed && npm run check`: 49 tests). **Not yet executed against a project** — blocked on OA-01. Expect small API-shape fixes on the first live run (the typed SDK calls compile, but no response has been seen); record them in `PROJECT-FINDINGS.md`.
