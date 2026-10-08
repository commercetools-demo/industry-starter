# Project findings: commercetools project `spec-test-b2c-healthcare`

Read through the `spec-b2c-health` Merchant Center MCP on 2026-10-08. Workstream E/F re-run these reads after seeding and update this file. **No secrets here.**

## Project settings
| Setting | Value | Consequence |
| --- | --- | --- |
| key / name | `spec-test-b2c-healthcare` / "Spec test B2C - healthcare" | Seed scripts refuse to run against any other key |
| countries | GB, DE, US | v1 sells in US only (`en-US`, USD). GB/DE stay in the project; `COUNTRY_CONFIG` lists only `en-US` |
| currencies | EUR, GBP, USD | prices are seeded in USD only |
| languages | en-GB, de-DE, en-US | localized fields filled for `en-US` only (plus `en-GB` fallback not needed) |
| trial | until 2026-12 | project is a trial: do not build anything that must outlive it without telling the owner |
| **searchIndexing.productsSearch** | **Activated 2026-10-08** (done by Claude via MCP; the legacy `products` projection-search index stays Deactivated) | Product Search API is available. E-02 only verifies status and waits for the index to fill after seeding |
| searchIndexing.orders | Activated | order search available |
| messages | disabled, 15-day retention | change Messages are off; good for `health-data-minimization` (fewer copies). Keep disabled unless a Subscription needs them |
| carts.deleteDaysAfterLastModification | 90 | abandoned carts are removed after 90 days |
| carts.countryTaxRateFallbackEnabled | true | |
| discounts | Stacking | |
| inventory.reservationExpirationInMinutes | 30, release expired = true | relevant if `ReserveOnCart` is chosen for medication stock |

## Sample data present (all "removable"; none is healthcare)
| Resource | Count | Detail |
| --- | --- | --- |
| Products | 117 | furniture/decor (e.g. `charcoal-chair`), keys without a prefix, published, USD/EUR/GBP embedded prices, images on `storage.googleapis.com/merchant-center-europe/sample-data/...` |
| Product types | 3 | `furniture-and-decor`, `product-sets`, `bedding-bundle` |
| Categories | 29 | home-decor, furniture, kitchen, new-arrivals and children |
| Shipping methods | 2 | `standard-shipping` (rate **50000 cents = $500.00**, free above $10,000), `express-shipping` (750.00) — both wrong for this project; replaced |
| Zones | 2 | `europe` (DE, GB), `usa` (US) — `usa` is reused, `europe` is left alone |
| Tax categories | 1 | `standard-tax`: US rate 20% *included in price* plus NC/NY state rows — wrong for US sales tax; replaced by tax categories in SEED-PLAN |
| Stores | 1 | `b2c-retail-store`, no channels/selections |
| Custom types | 0 | |
| Customers / orders / carts | not checked yet (E-01 lists them) | |
| Inventory | per-SKU entries exist for the sample SKUs | removed with the products |

## Facts that change the plan
1. **Search indexing off** → E-02 must turn it on before K can be verified. Indexing is asynchronous: poll the status.
2. **Sample data must be removed by an explicit, confirmed script** (`cleanup-sample.ts --confirm spec-test-b2c-healthcare`), deleting only resources that do **not** carry the seed prefix `mlv-` (sample keys have no prefix), so a second run is safe.
3. **Wrong tax model**: US "20% included" would price medicine and consultations with VAT inside the price. See Q-012.
4. **Shipping rates in cents are 100× too high** (50000 on a $ project); never reuse them.
5. No custom Types exist, so the line-item / customer types (RX reference, patient reference) are created by E.
6. The MCP exposes create/update for almost every resource type; **API clients cannot be created through it**, hence OA-01/02 for the owner.
