# Project findings — `spec-test-b2c` (us-central1.gcp)

**Status: INSPECTED (read-only) on 2026-10-06 through the commerce MCP by Claude (task F-01).** No secrets, tokens or client ids here. Re-run F-01 after any seeding.

## 1. Project settings
| Setting | Found | Required | Gap |
| --- | --- | --- | --- |
| countries | GB, DE, US | US, DE | none (GB is extra; storefront exposes only en-US and de-DE) |
| currencies | EUR, GBP, USD | USD, EUR | none |
| languages | en-GB, de-DE, en-US | en-US, de-DE | none |
| product search | `searchIndexing.productsSearch` = **Activated** (legacy `products` index Deactivated, `orders` Activated) | Product Search API activated | none — use `products().search()` only |
| carts | `deleteDaysAfterLastModification` 90; `countryTaxRateFallbackEnabled` true; rounding HalfEven | — | note |
| inventory | `reservationExpirationInMinutes` 30 (irrelevant: we use inventoryMode None) | — | note |
| messages | disabled | — | note |
| trial | `trialUntil` 2026-11 | — | **risk: the project is a trial that ends in 2026-11** |

## 2. Product types (3)
| key | attributes (level) | matches `grocery-product`? |
| --- | --- | --- |
| `furniture-and-decor` | productspec (ltext), new-arrival (boolean), size (ltext), product-description (ltext), search-color (lenum, 15 values), search-finish (lenum), color-label, finish-label (ltext), color-code, finish-code (text) — all variant level | no (home decor) |
| `bedding-bundle` | product-description, product-spec (ltext), product-ref (set of product reference) | no |
| `product-sets` | type (set of ltext), search-color, search-finish, color-label, finish-label, color-code, finish-code | no |

## 3. Categories (29, keys)
Roots: `home-decor`, `furniture`, `kitchen`, `new-arrivals`. Children: home-decor → `bedding`, `room-decor` (→ `home-accents`, `rugs`); furniture → `living-room-furniture` (→ `tables`, `sofas`, `armchairs`), `bedroom-furniture` (→ `beds`, `storage--tables`), `collections` (→ `the-minimalist`, `the-traditionalist`, `the-modernist`); kitchen → `bar-and-glassware` (→ `bar-accessories`, `glassware`), `dinnerware` (→ `bakeware`, `bowls`, `plates`), `serveware` (→ `serving-platters`, `cheese-trays`). Names/slugs exist in en-GB, en-US, de-DE. **None are grocery categories.**

## 4. Products
- **117 products** (published), all home-decor sample data (e.g. `chianti-wine-glass`, sku `CWG-01`), images hosted at `storage.googleapis.com/merchant-center-europe/sample-data/b2c-lifestyle/…`.
- Variants: master variant plus variants by color/finish; prices: embedded, per country — EUR/DE, GBP/GB, USD/US, **same numeric amount in every currency** (e.g. 2599 = 25.99).
- `masterVariant.recurrencePrices` is present in projections; `availability` is populated (`isOnStock`, `availableQuantity` e.g. 99).
- No weight/increment attributes; no `approximateWeight`; no substitutes.
- Product Search field names and price-filter shape: **not yet verified** (task G-05 spike needs the storefront API client, OA-02).

## 5. Inventory
134 inventory entries, quantity 100 each (e.g. `SCG-09`, `MCP-01`, `WCS-09`), no supply channels observed.

## 6. Shipping methods and zones
- Zones: `europe` (GB, DE), `usa` (US).
- `standard-shipping` (default, active): rate **50000 cents = 500.00** in EUR, GBP (zone europe) and USD (zone usa); `freeAbove` 1,000,000 cents (**10,000.00**); tax category `standard-tax`.
- `express-shipping` (active): 75000 cents (**750.00**), no free-above.
- **Not grocery-appropriate**, and the key is `standard-shipping`, not `standard` as written in the specs.

## 7. Tax
One tax category `standard-tax`: DE 19% (included in price), GB 20% (included), **US 20% (included)**, NC 4.75% and NY 4% (not included). No food/non-food categories. All 117 products use `standard-tax`.

## 8. Custom types
**None** (`cart-delivery`, `line-substitution`, `substitution-proposal`, `order-final` all missing).

## 9. Recurrence policies
**None.**

## 10. Checkout applications and connectors
**Unknown** — the MCP request `/applications` returned "URI not found". The owner must check Merchant Center → Checkout (OA-05).

## 11. API clients and scopes
Not readable through the MCP (names only would be visible in Merchant Center).

## 12. Gap list and adaptation decisions
| # | Gap | Proposed resolution | Owner decision |
| --- | --- | --- | --- |
| 1 | Existing catalog is **home decor** (117 products, 3 product types, 29 categories), not grocery; D-011 assumed grocery data | See question to owner: seed grocery **alongside** and make the storefront show only grocery data (recommended), or replace | **Replace** (D-048): export, then delete decor, seed grocery (F-11) |
| 2 | No custom types | Seed 4 types (F-05) | — |
| 3 | No recurrence policies | Seed 3 policies (F-09) | — |
| 4 | Shipping rates 500.00 / free above 10,000.00; key `standard-shipping` | Add `standard` alongside; existing methods stay active (D-049); hosted Checkout will list them too | **Leave active** (accepted) |
| 5 | Single tax category, US 20% included | Add `food` and `non-food` categories (F-08); leave `standard-tax` untouched | — |
| 6 | Checkout applications unknown | Owner checks Merchant Center (OA-05) | — |
| 7 | Trial project ends 2026-11 | Owner awareness; plan for a permanent project before launch | — |
| 8 | Prices identical across currencies | Seed grocery prices with the planned EUR ≈ USD × 0.9 | — |
