# F — Catalog data model: inspect, seed, verify

**Specs:** `grocery-storefront-features` → `catalog-data-model` (all requirements)
**Depends on:** A · **Unblocks:** G, N, Q, U, W (and every page against real data)
**Decisions:** D-011, D-012, D-030, D-031, D-034 · **Owner prerequisites:** OA-01 (MCP), OA-03 (seed client), OA-04 (project settings)
**Skill refs:** `commercetools-commerce-patterns` (catalog architecture), `commercetools-platform` (SDK)

## Goal
`spec-test-b2c` contains exactly the data the storefront needs, proven by a read-only verify script and recorded in `PROJECT-FINDINGS.md`.

## Process (follow in order)
1. **Inspect first (F-01, F-02).** Claude (or the junior with the owner) reads the current project via the commerce MCP and fills `plan/PROJECT-FINDINGS.md`. The project already has products and categories (D-011) — they may not match this model.
2. **Decide gaps with the owner (F-02).** For each gap: *seed it*, *adapt the spec/mappers to what exists*, or *ask*. Never overwrite existing data.
3. **Seed idempotently (F-03…F-10).** Scripts in `site/scripts/seed/` create only what is missing, keyed by `key`.
4. **Verify (F-11).** `npm run seed:verify` reads everything back and prints a pass/fail table.

## Design

### Scripts (`site/scripts/seed/`, run with `npx tsx`)
- `lib.ts`: `getAdminRoot()` reads `CTP_SEED_CLIENT_ID`, `CTP_SEED_CLIENT_SECRET`, `CTP_SEED_SCOPES` + the same `CTP_PROJECT_KEY/AUTH_URL/API_URL` from `site/.env.seed` (gitignored; **never** `.env.local`). Helpers: `ensureType(draft)`, `ensureProductType`, `ensureCategory`, `ensureTaxCategory`, `ensureZone`, `ensureShippingMethod`, `ensureRecurrencePolicy`, `ensureProduct`, `ensureInventory`. Each returns `'created' | 'ok' | { diff: string }`; a diff **stops** the run (exit 1) and prints the difference.
- `data/*.json`: `product-type.json`, `categories.json`, `types.json`, `shipping-tax.json`, `recurrence.json`, `products.json`.
- `seed.ts` orchestrates in order: types → product type → categories → tax → zones → shipping → recurrence → products (+ prices + inventory) → publish. `verify.ts` read-only.
- `package.json` scripts: `seed`, `seed:verify` (not part of `verify`; they need credentials). Unit tests cover only the pure parts: data validation (`data/*.json` against local zod-free validators) and the diff logic with a mocked admin root.
- Required admin scopes (list only; owner creates the client in OA-03): `manage_products manage_categories manage_types manage_product_types manage_shipping_methods manage_tax_categories manage_project_settings view_project_settings manage_recurrence_policies` (verify exact names against Merchant Center scope list; record corrections in findings).

### Data to create (matches `catalog-data-model` spec)
- **Project settings (verify only):** countries US, DE; currencies USD, EUR; languages en-US, de-DE; **product search indexing activated** (`searchIndexing.products`); if not, ask owner (OA-04) — indexing takes minutes.
- **Custom types** (`key`): `cart-delivery` (resourceTypeIds `cart` and `order`, so values are copied to the order) fields `slotId` String, `slotStart` String (ISO), `slotEnd` String (ISO), `slotHoldExpires` String (ISO); `order-final` (resourceTypeId `order`) field `finalTotal` Money; `line-substitution` on `line-item` field `substitutionPreference` Enum(`allow-similar`,`none`); `substitution-proposal` on `order-edit` fields `originalLineItemId` String, `substituteSku` String, `status` Enum(`pending`,`declined`,`applied`), `note` String.
- **Product type** `grocery-product`: product-level `brand` text, `origin` text, `dietary` set(enum vegan|vegetarian|gluten-free|organic), `storage` enum ambient|chilled|frozen, `allergens` set(text), `substituteProducts` set(reference product), `recurringEligible` boolean; variant-level `incrementValue` number, `incrementUnit` enum g|kg|ml|l|each, `approximateWeight` boolean, `packLabel` ltext. Only `packLabel` is localized (ltext with `en-US` and `de-DE`); `brand`, `origin` and `allergens` are plain text.
- **Categories** (key = slug): `fresh-produce`, `dairy-eggs`, `bakery`, `pantry`, `drinks`, `household` with names en-US / de-DE (Fresh Produce/Frisches Obst & Gemüse, Dairy & Eggs/Milch & Eier, Bakery/Backwaren, Pantry/Vorrat, Drinks/Getränke, Household/Haushalt).
- **Tax:** categories `food` (DE 7%, US 0%), `non-food` (DE 19%, US 0%); zones `US`, `DE`.
- **Shipping:** method `standard` (default, `taxCategory` = `non-food`) with zone rates US ($5.00, free above $50.00) and DE (€4.90, free above €45.00); the free-above values live in the shipping rate's `freeAbove`.
- **Recurrence policies** keys `weekly` (every 1 week), `every-2-weeks`, `monthly` — names en-US/de-DE.
- **Products (36):** 6 per category. Each has en-US/de-DE `name`, `slug`, `description`, `metaTitle`; images (stable URLs, e.g. `https://picsum.photos/seed/<sku>/800/800` — placeholder, see M-F-3); variants (weighed ones have 2–3 increments). Prices for every variant: USD/US and EUR/DE (EUR ≈ USD × 0.9, rounded to cents; weighed prices are per increment). Inventory entry for every SKU: quantity 50, except the out-of-stock items = 0.

| Category | Products (flag key: W weighed · A approximate weight · OOS out of stock · R recurring-eligible · S substitute) |
| --- | --- |
| fresh-produce | Bananas (W A, 500 g/1 kg; S→Apples), Roma tomatoes (W A, 500 g/1 kg), Gala apples (W A, 1 kg/2 kg), Strawberries (W A, 250 g/500 g), Potatoes (W A, 1 kg/2 kg), Carrots (W A, 500 g/1 kg) |
| dairy-eggs | Whole milk 1 L (R S→Oat drink), Oat drink 1 L (R), Free-range eggs 12 (R), Greek yogurt 500 g, Cheddar block (W exact 200 g/400 g, OOS), Salted butter 250 g |
| bakery | Sourdough loaf (OOS S→Wholemeal bread), Wholemeal bread (R), Croissants 4, Bagels 6, Rye bread, Brioche buns 6 |
| pantry | Basmati rice (W exact 1 kg/2 kg, R), Spaghetti 500 g (R), Olive oil 500 ml, Rolled oats 1 kg (R), Chickpeas can, Peanut butter 340 g |
| drinks | Sparkling water 6×1 L (R), Orange juice 1 L (OOS S→Apple juice), Green tea 20 bags, Ground coffee 250 g, Apple juice 1 L, Kombucha 330 ml |
| household | Dish soap 500 ml, Paper towels 4 rolls (R), Laundry liquid 1.5 L, Sponges 6, Trash bags 20, Beeswax wraps |

  Totals required by the spec: ≥8 weighed (Bananas, Tomatoes, Apples, Strawberries, Potatoes, Carrots, Cheddar, Basmati = 8 ✓), 6 approximate (first six produce ✓), ≥3 out of stock (Cheddar, Sourdough, Orange juice ✓), ≥6 with substitutes (Milk, Oat drink→Milk, Sourdough, Orange juice, Bananas, Apples→Bananas ✓), ≥6 recurring-eligible (Milk, Oat, Eggs, Wholemeal, Rice, Spaghetti, Oats, Sparkling water, Paper towels ✓). Non-weighed variants: `incrementUnit='each'`, `incrementValue=1`. `storage`: produce/dairy/bakery chilled or ambient as sensible; `dietary` as sensible.
  The existing 117 home-decor products are **replaced** (D-048): task F-11 exports then deletes decor products, product types `furniture-and-decor`, `bedding-bundle`, `product-sets`, the 29 decor categories and their inventory, **before** F-06/F-07 run. Shipping methods and `standard-tax` are **not** touched (D-049); `standard` is created with `isDefault: false`.

## Tasks
- [ ] F-01 (Claude with MCP, or junior with owner) Inspect `spec-test-b2c` and fill every section of `plan/PROJECT-FINDINGS.md` (no secrets).
- [ ] F-02 Write the gap list (section 12) with a resolution for each gap and get **owner approval** in `plan/QUESTIONS.md`/chat. If the model must change, update `openspec/changes/grocery-storefront-features/specs/catalog-data-model/spec.md` first.
- [ ] F-03 Write `scripts/seed/lib.ts` (admin client, `ensure*` helpers, diff stop) with tests using a mocked admin root: existing equal resource → `'ok'`; missing → `'created'`; different attribute type → returns diff and the runner stops.
- [ ] F-04 Write `scripts/seed/verify-settings.ts`: read-only check of countries/currencies/languages/search indexing; prints a table; test with mocked project.
- [ ] F-05 Write `data/types.json` + seeding of the four custom types (`cart-delivery`, `line-substitution`, `substitution-proposal`, `order-final`). Test the data shape (keys, field names, enum values exactly as above).
- [ ] F-06 Write `data/product-type.json` + seeding. Test attribute names/types/localization.
- [ ] F-07 Write `data/categories.json` (+ en/de names) and seeding. Test unique keys and both locales present.
- [ ] F-08 Write `data/shipping-tax.json` (zones, tax, `standard` method) and seeding. Test rates and free-above values.
- [ ] F-09 Write `data/recurrence.json` and seeding of the three policies. Test keys and schedules.
- [ ] F-10 Write `data/products.json` (36 products per the table), generate prices/inventory, seeding with publish. Test with a validator: 36 products, 6 per category, ≥8 weighed, 6 approximate, ≥3 OOS, ≥6 substitutes, ≥6 recurring, both locales on name/description/slug, each variant has USD/US and EUR/DE prices, weighed variants have `incrementUnit` ≠ `each`.
- [ ] F-11 Write `scripts/seed/export-decor.ts` (read-only dump of decor products, product types, categories, inventory to gitignored `plan/backup/`) and `scripts/seed/remove-decor.ts` (deletes only keys listed in PROJECT-FINDINGS §2–§5; refuses to run without `--confirm` and without a backup file; unpublish → delete products, then inventory, categories deepest first, product types last). Tests with mocked admin root: dry run deletes nothing; missing backup → exit 1; deletion order; unknown keys never touched. **Run only after the owner says go in chat (D-048); order: F-11 before F-06.**
- [ ] F-12 Write `verify.ts` (read back everything; pass/fail table; non-zero exit on failure), run it after seeding, paste the **non-secret** summary into `PROJECT-FINDINGS.md`, report manual tests M-F-1…M-F-4. Wait for Gate 1.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Existing matching resource / Differing resource | F-03 |
| Weighed product / Fixed item | F-10 validator |
| Listing by category | F-07 (+ G) |
| German visitor (prices) | F-10 validator; live M-F-2 |
| Out of stock variant | F-10 validator; live M-F-2 |
| Cart with slot (types exist) | F-05 |
| Shipping methods for a cart | F-08; live M-F-1 |
| Policy lookup | F-09 |
| Listing page size (≥ 2 pages) | F-10 validator (36 > 24) |

## Manual tests to report
- M-F-1: Merchant Center → Settings → Shipping methods: `standard` with US and DE zone rates.
- M-F-2: Merchant Center → Products: 36 products; open Bananas: variants 500 g/1 kg with USD and EUR prices; Cheddar shows 0 stock.
- M-F-3: Product images load (placeholder service reachable); owner decides whether to replace with real images.
- M-F-4: Merchant Center → Custom types: the four types; Recurrence policies: weekly/every-2-weeks/monthly; Settings → search indexing active.

## Definition of done
`npm run seed:verify` all green; findings file complete; Gate 1 approved by the owner.
