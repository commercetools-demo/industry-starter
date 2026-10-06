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
- Product Search field names and price-filter shape: **verified 2026-10-06 against the grocery catalog (workstream G, task G-05)**; see section 4a.

### 4a. Product Search API (`products().search()`), verified live (read-only, grocery catalog)
- **Projection:** results only contain `productProjection` when `productProjectionParameters: { priceCurrency, priceCountry }` is sent (that field is marked deprecated in the SDK but is the only way to get the projection in the same call; the plan mandates it). With it, `masterVariant.price`/`variants[].price` are the scoped price and `availability` is present.
- **Fields that work:** `name` (fullText, `language` accepts `en-US` and `de-DE`), `categoriesSubTree` (exact, value = category id), `slug` (exact with `language`), `variants.sku` (exact), `id` (exact; `values: [...]` also works), `createdAt` (sort), `variants.prices.centAmount|currencyCode|country`, `variants.availability.isOnStock` (boolean, `exact` works without `fieldType`).
- **fullText is token based:** `milk` matches "Whole milk 1 L"; German `milch` returns 0 for "Vollmilch 1 l" (no substring match), `Vollmilch` matches.
- **Substring search (workstream P, verified live):** `wildcard` on `name` with `language` and `caseInsensitive: true` matches substrings of the whole name: `*milch*` finds "Vollmilch 1 l" and `*mil*` finds "Whole milk 1 L" (`fullText` finds neither). Without `caseInsensitive` it is case-sensitive. `*` and `?` are wildcards and a backslash escapes them. `exact` on `variants.sku` also accepts `caseInsensitive: true` (`bananas-500g` finds `BANANAS-500G`). The storefront text search is therefore `or[fullText, wildcard *q*, exact sku (only when SKU-like)]`.
- **Price band filter:** `and: [exact currencyCode, exact country, range centAmount {gte, lt}]` matches the same price object (counts equal an independent client-side computation for EUR/DE and USD/US). The plain `range` on `centAmount` alone mixes currencies and over-counts (10 vs 9).
- **Availability:** in stock = `exact isOnStock true`; out of stock = `{ not: [ exact isOnStock true ] }` (3 products: Cheddar, Sourdough loaf, Orange juice). A product is "in stock" when any variant is.
- **Facets:** `distinct` on `categories` with `fieldType: 'reference'` (direct categories only; `categories.id` is an unknown field); price bands via a `ranges` facet on `variants.prices.centAmount` (`fieldType: 'long'`, bucket `key` = band id) with `filter` = single `and` expression of currency and country, otherwise buckets mix currencies; availability via two `count` facets with a `filter` (the `count` facet takes `filter`, not `query`; result is `{ name, value }`). Facets are computed over the main query result.
- **Sort:** `createdAt desc`; price: `{ field: 'variants.prices.centAmount', order, mode: 'min', filter: and(currency, country) }`. Without `sort` and text the order is not meaningful relevance but was stable across pages.
- **Other reads verified with the storefront client (read-only):** `GET /{project}` (project settings: countries, currencies, languages) works, so `getValidCountryConfig()` needs no extra scope; `categories().get({ sort: 'orderHint asc' })` returns the 6 grocery roots in order (all are root categories, no children yet).
- Next.js 16 marks `unstable_cache` as replaced by `use cache` (Cache Components). It still works without that flag and is what the plan prescribes; migration is parked in `IDEAS.md`.
- Localized slugs can differ per locale (`bananas` en-US, `bananas-de` de-DE); the PDP must look up with the locale's language.

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

## 13. After seeding (2026-10-06, `npm run seed:verify`: all 25 checks PASS)
- Decor catalog removed (D-048) after export to gitignored `plan/backup/decor-backup.json`: 117 products, 134 inventory entries, 29 categories, 3 product types.
- Created: custom types `cart-delivery`, `order-final`, `line-substitution`, `substitution-proposal`; product type `grocery-product`; 6 categories; tax categories `food`, `non-food`; shipping method `standard` (not default); recurrence policies `weekly`, `every-2-weeks`, `monthly`; 36 published products (substitutes linked); inventory for every SKU (CHEDDAR, SOURDOUGH-LOAF, ORANGE-JUICE = 0).
- Corrections to the plan found while seeding: (1) commercetools has no `cart` custom-type resource id — `order` covers carts and orders; (2) a country can only be in one zone, so the seed reuses the existing zones `usa` and `europe` (GB, DE); (3) product-level (SameForAll) attributes must be present on every variant; (4) `substituteProducts` is set with `setAttributeInAllVariants`; (5) `.env.seed` uses `CTP_SEED_CLIENT_ID/SECRET/AUTH_URL/PROJECT_KEY/API_URL` (no scopes variable).
- Existing `standard-shipping` (500.00) and `express-shipping` (750.00) remain active (D-049).

## 14. Cart API, verified live by workstream J (2026-10-06, throwaway anonymous carts)
- A cart created with `inventoryMode: 'None'`, `taxMode: 'Platform'`, `country: 'US'`, an `anonymousId` and `addLineItem` by `sku` works; the line carries `variant.availability` (`isOnStock`, `availableQuantity`), `variant.attributes` (increment, packLabel, approximateWeight), `variant.images`, `productSlug` (localized) and `price.value`, so the cart mapper needs no extra product or inventory call.
- `custom: { type: { key: 'line-substitution', typeId: 'type' }, fields: { substitutionPreference } }` on `addLineItem` works (type has one field, resource type `line-item`).
- `addLineItem` with `recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', key: 'weekly' }, priceSelectionMode: 'Dynamic' }` works; with `expand: ['lineItems[*].recurrenceInfo.recurrencePolicy']` the reference has `obj.key`.
- A stale version gives an error object with `statusCode: 409` and `code: 'ConcurrentModification'`.
- Inventory endpoint: `where: sku="X"` and `sku in (...)` work; entries expose `availableQuantity`. A cart without shipping address has no `shippingInfo` (no delivery price), so "Delivery" shows "Calculated at checkout" until Q sets the address and shipping method.
- Carts with zero lines stay `Active`; the UI treats them as empty. One throwaway cart from the manual API smoke test (id 7458529a-d35d-4b04-bf8e-4686ad69165c, anonymous, empty or one Bananas line) was left in the project; carts are deleted automatically after 90 days.

## 15. Customer auth API, verified live by workstream O (2026-10-06, throwaway customer `qa-*@example.com`, deleted afterwards)
- `customers().post({ body: draft })` returns `{ customer }` (no token); `isEmailVerified` is `false`. A duplicate email is **HTTP 400** with error code `DuplicateField` (field `email`), not 409; the route maps it to 409 `ACCOUNT_EXISTS`.
- `customers().emailToken().post({ body: { id, version, ttlMinutes: 5 } })` returns a token with `value`; `customers().emailConfirm().post({ body: { tokenValue } })` returns the customer with `isEmailVerified: true`. Shapes match the plan; pass the version from the sign-up response.
- `login().post({ body: { email, password, anonymousCart: { id, typeId: 'cart' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' } })` returns `{ customer, cart }`. For a customer without a cart the anonymous cart is adopted (same id, `customerId` set, `Active`, lines kept). Without `anonymousCart` the response still contains the customer's existing Active cart when there is one.
- Wrong password and unknown email are both **HTTP 400 `InvalidCredentials`** (identical), not 401; the route returns 401 `INVALID_CREDENTIALS`.
- `customers().passwordToken().post({ body: { email, ttlMinutes: 60 } })` returns `{ value, ... }`; unknown email is **404 `ResourceNotFound`**.
- `customers().passwordReset().post({ body: { tokenValue, newPassword } })` returns a bare `Customer`. A token that was already used, or a bogus token, is **404 `ResourceNotFound`** (mapped to `InvalidToken`).

## 16. Delivery address, shipping method and `cart-delivery` fields, verified live by workstream Q (2026-10-06, throwaway anonymous US cart, deleted afterwards)
- `shippingMethods().matchingCart().get({ queryArgs: { cartId } })` (cart with a US shipping address and one line) returns all three active methods: `standard-shipping` (the default), `express-shipping` and `standard`. The storefront must pick key `standard` explicitly (D-049).
- `setShippingMethod` with `{ typeId: 'shipping-method', id }` works. For `standard` in USD: price 5.00, `freeAbove` 50.00 (rate on `shippingInfo.shippingRate`); `taxedPrice` and `totalPrice` include the shipping price immediately. Before an address and method are set the cart has no `shippingInfo`.
- Changing the shipping address (even to a postcode we consider undeliverable) keeps `shippingInfo` and the selected method on the cart.
- `setCustomType` with key `cart-delivery` on a cart works and yields empty `fields`. **Applying `setCustomType` again with the same type resets (empties) all fields**, so it is only sent when `cart.custom` is absent.
- `setCustomField` with a string value works for `slotId`, `slotStart`, `slotEnd`, `slotHoldExpires`. **`setCustomField` without a value on a field that is not set is HTTP 400 `InvalidOperation`** ("Cannot remove custom field ... because it does not exist"), so clearing removes only the fields present on the cart. The custom type stays on the cart after fields are removed.
- **A shipping address in another country than the cart's currency market is rejected when a shipping method is already set:** a USD cart with method `standard` and `setShippingAddress` country DE fails with HTTP 400 `InvalidOperation` ("Shipping method ... does not contain a shipping rate for zone ... and currency 'USD'"). `standard` has rates for the `usa` zone in USD and the `europe` zone in EUR only, so the address country must equal the cart's market country. The address route answers 422 `COUNTRY_MISMATCH` before calling commercetools (see Q-1 in `QUESTIONS.md`).

## 17. Orders and customers, workstream R (NOT verified live)
- No live call was possible for R (no admin credentials available to the agent). The order and customer mappers follow the platform SDK types and the cart fixture; the open points are tracked in `QUESTIONS.md` Q-R-2 and Q-R-3.
- Expected from the commercetools API docs and to confirm with `scripts/seed/create-qa-order.ts`: an order created from a cart copies `custom` (type `cart-delivery` and the slot fields) and line item custom fields; `GET /orders?where=customerId="..."&sort=createdAt desc&withTotal=true` returns `total`; a `Money` custom field comes back as `{ type: "centPrecision", centAmount, currencyCode, fractionDigits }`; an order has only one custom type, so setting `order-final` replaces `cart-delivery` on that order.

## 18. Customer addresses, verified live by workstream S (2026-10-06, throwaway customer `qa-*@example.com`)
- `addAddress` with a `key` followed by `setDefaultShippingAddress` with `addressKey` (same update call) works: the id of a new address is not known before the call, so the first address is made default by its key. The customer response lists addresses with `id` and `key`.
- `setDefaultShippingAddress` + `setDefaultBillingAddress` by `addressId` in one update call works; the new `defaultShippingAddressId` and `defaultBillingAddressId` come back in the response (the previous default has neither).
- **`removeAddress` on the default address clears `defaultShippingAddressId` / `defaultBillingAddressId` by itself** (checked: the remaining address has no default afterwards; no extra action is needed). Removing the default does not promote another address.
- `changeAddress` keeps the default flags of the address.
- The dashboard profile (`GET /api/account/profile`) follows the default shipping address immediately.
