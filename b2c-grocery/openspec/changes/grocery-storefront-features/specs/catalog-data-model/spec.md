## ADDED Requirements

### Requirement: Verify before seeding

Before any page work, the project `spec-test-b2c` SHALL be inspected and its current product types, categories, shipping methods, tax categories, zones, custom types, recurrence policies and inventory recorded in `plan/PROJECT-FINDINGS.md` (without secrets). Any resource in this spec that is missing or different SHALL be listed as a gap and resolved by seeding or by adapting this spec with owner approval. Seed scripts SHALL be idempotent and keyed by resource `key`.

#### Scenario: Existing matching resource
- **WHEN** a product type with key `grocery-product` already has the required attributes
- **THEN** the seed script leaves it unchanged and reports "ok"

#### Scenario: Differing resource
- **WHEN** an existing attribute has a different type than specified
- **THEN** the seed script stops and reports the difference rather than overwriting data

### Requirement: Product type model

The project SHALL have a product type `grocery-product` with product-level attributes `brand` (text), `origin` (text), `dietary` (set of enum: vegan, vegetarian, gluten-free, organic), `storage` (enum: ambient, chilled, frozen), `allergens` (set of text), `substituteProducts` (set of reference to product), `recurringEligible` (boolean) and variant-level attributes `incrementValue` (number), `incrementUnit` (enum: g, kg, ml, l, each), `approximateWeight` (boolean), and `packLabel` (localized text, for example "500 g"). Only `packLabel` SHALL be localized (`en-US` and `de-DE`); `brand`, `origin` and `allergens` are plain text.

#### Scenario: Weighed product
- **WHEN** a product sold by weight is created
- **THEN** each sellable increment is its own variant with `incrementValue`, `incrementUnit`, `packLabel` and its own price

#### Scenario: Fixed item
- **WHEN** a product sold as a single unit is created
- **THEN** it has one variant with `incrementUnit = each`, `incrementValue = 1` and `approximateWeight = false`

### Requirement: Categories

The category tree SHALL have top-level categories Fresh Produce, Dairy & Eggs, Bakery, Pantry, Drinks and Household, each with a `key`, a slug and names in `en-US` and `de-DE`, and every product SHALL belong to at least one.

#### Scenario: Listing by category
- **WHEN** the storefront requests a category by slug
- **THEN** it resolves to one category with a localized name

### Requirement: Prices and currencies

Each variant SHALL have embedded prices for `USD` with country `US` and `EUR` with country `DE`. Prices SHALL be selected by country and currency; prices for weighed variants SHALL be per increment.

#### Scenario: German visitor
- **WHEN** the session country is DE and currency EUR
- **THEN** the variant shows its EUR/DE price

### Requirement: Inventory

Every variant SHALL have an inventory entry so `ProductVariantAvailability` can be read, with a mix of in-stock and out-of-stock demo items (at least 3 out of stock). Carts SHALL be created with `inventoryMode: 'None'`.

#### Scenario: Out of stock variant
- **WHEN** a variant has no available quantity
- **THEN** the storefront shows "Out of stock" and refuses to add it

### Requirement: Custom types

The project SHALL define custom types: `cart-delivery` for carts and orders (`slotId`, `slotStart`, `slotEnd`, `slotHoldExpires`), `order-final` for orders (`finalTotal` as money), `line-substitution` for line items (`substitutionPreference` enum `allow-similar` | `none`, default `allow-similar` for chilled and fresh products), and `substitution-proposal` for order edits (`originalLineItemId`, `substituteSku`, `status` enum `pending` | `declined` | `applied`, `note`).

#### Scenario: Cart with slot
- **WHEN** a slot is selected
- **THEN** the cart carries `cart-delivery` fields describing it

### Requirement: Shipping and tax

The project SHALL have zones for US and DE, a shipping method `standard` (tax category `non-food`) with rates in each zone and a free-above threshold stored in the rate, tax categories for food and non-food with country rates (DE 7% and 19%; US 0% placeholder per state-less demo), and `taxMode: 'Platform'` on carts.

#### Scenario: Shipping methods for a cart
- **WHEN** a cart has a German address
- **THEN** matching shipping methods return only those whose zone covers DE

### Requirement: Recurrence policies

The project SHALL have recurrence policies keyed `weekly`, `every-2-weeks` and `monthly`, named in both locales, and products SHALL be recurring-eligible only when their `recurringEligible` attribute is true.

#### Scenario: Policy lookup
- **WHEN** the storefront lists cadence options
- **THEN** it reads the three policies by key and displays localized names

### Requirement: Demo catalog

The seed SHALL create at least 36 products across the six categories, including at least 8 sold by weight with 2–3 increments, 6 with approximate weight, 3 out of stock, 6 with substitute sets, and 6 recurring-eligible, each with images (URLs) and descriptions in both locales.

#### Scenario: Listing page size
- **WHEN** the shop lists all products
- **THEN** there are enough products for two pages at 24 per page

### Requirement: Product search indexing

The project SHALL have product search indexing activated before storefront search and listing are built, and the seed verification SHALL report its status.

#### Scenario: Indexing off
- **WHEN** product search indexing is not activated
- **THEN** the verification fails with an instruction for the owner to activate it (OA-04)
