# G — Catalog model, seed data and images

**Specs:** `telecom-catalog-model` (all), `seed-catalog-data` (all), `seed-product-images-pexels` (all, method changed by D-055)
**Depends on:** F · **Unblocks:** H, J, K, L, X (and every page that reads the catalog) · **Decisions:** D-010, D-011, D-012, D-013, D-014, D-015, D-016, D-017, D-018, D-019, D-020, D-021, D-025, D-026, D-027, D-043, D-044, D-054, D-055, D-056, D-058
**Owner prerequisites:** OA-03, OA-04 (F-15 must have run: furniture removed) · **Skill refs:** `commercetools-commerce-patterns` (catalog architecture, recurring prices, cart discounts), `commercetools-platform` (Product Types, Product Search)

## Goal
After `npm run seed -- --confirm-project spec-test-b2c-telecom --with-demo`, the project holds the six Malva product types, the category tree, 25 descriptive products, 27 offers with USD and EUR prices (monthly prices tied to `malva-monthly`, one-time prices where a line is not recurring), equipment and handset inventory, cart discounts, customer groups, demo customers with orders, the serviceability table and images; Product Search returns the offers; `npm run seed:verify` is green; the findings (inventory mode, search lag, predicate syntax) are recorded.

## Design

### File layout (G owns every file under `site/scripts/seed/data/**` except the six F files named in workstream F)
```
site/scripts/seed/
  update-images.ts            images.ts            experiments/platform-checks.ts
  checks/catalog.ts           reconcilers/customObject.ts   reconcilers/demoCustomer.ts   reconcilers/demoOrder.ts
  data/
    catalog-types.ts          # TS types: LocalizedString, PriceSpec, VariantManifest, ProductManifest, OfferManifest, ...
    shared/enums.ts           shared/attributes.ts            # shared attribute definitions (one definition per name)
    product-types/internet-plan.ts  phone-plan.ts  addon.ts  equipment.ts  device.ts  offer.ts  index.ts
    custom-types/line-item.ts  order.ts  cart.ts  customer.ts  index.ts
    categories.ts
    recurrence-devices.ts     # the four device-financing policies (F owns recurrence.ts with malva-monthly)
    prices.ts                 # price table, term rules, EUR rule, price builders
    products/plans-cable.ts  plans-wireless.ts  plans-phone.ts  addons.ts  equipment.ts  devices.ts  index.ts
    offers/plans-cable.ts  plans-wireless.ts  plans-phone.ts  addons.ts  equipment.ts  devices.ts  special.ts  index.ts
    relations.ts              # derived: conflicts-with, included-offers, exception lists; pure, tested
    inventory.ts
    cart-discounts.ts         discount-codes.ts
    serviceability.ts         # Custom Object rows
    demo/customers.ts  demo/orders.ts
    image-terms.ts            product-images.json     # lock file, committed
    index.ts                  # export const MANIFEST: SeedManifest (merges F's data files and G's)
  *.test.ts next to each file (see Unit tests)
```
Everything is typed TypeScript; money is always `centAmount` integers; every `LocalizedString` has `en-US` **and** `de-DE`.

### Rules that apply to every resource
- Keys: `malva-` prefix (customer groups excepted, D-058). SKUs match `^MLV-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+(-[A-Z0-9]+)*$`; the pattern is `MLV-<family>-<tier>-<term>` with the **tokens below**; descriptive products end in `-BASE`; none depends on a generated id.
- Family tokens: `CBL` cable, `AIR` home wireless, `PHN` phone, `ADD` add-on, `EQP` equipment, `DEV` handset. Term tokens: `M2M` month-to-month, `12M`, `24M`, `MTH` monthly add-on, `RENT`, `BUY`, `BASE` (descriptive product).
- Every product is **published** (`publish: true`), every product has tax category `malva-telecom-services`, every variant has `key` = lower-cased SKU.
- Attribute `level` is `Variant` for every attribute (Planner default: no Product-level attributes; the sample project and Product Search both handle Variant-level best); facts that are the same for every variant use `attributeConstraint: SameForAll`, facts that differ per variant use `None`.
- **Same attribute name = same definition in every product type** (the platform rejects conflicting definitions of one name). `shared/attributes.ts` exports each shared definition once; a test groups all definitions by name and asserts deep equality of `type`, `attributeConstraint`, `level`, `isSearchable`, `savedToLineItem` (labels may differ).
- Enum **keys** are English and stable; labels are `lenum` `{ 'en-US', 'de-DE' }` where the buyer sees them, plain `enum` labels (English only) for internal vocabulary.

### Shared enum vocabulary (`shared/enums.ts`)
| Name | Kind | Keys → labels (en-US / de-DE) |
| --- | --- | --- |
| `technology` | lenum | `cable` Cable / Kabel · `fixed-wireless` Home wireless / Heim-Funk |
| `contract-term` | lenum | `month-to-month` Month-to-month / Monatlich kündbar · `12-months` 12 months / 12 Monate · `24-months` 24 months / 24 Monate |
| `charge-type` | lenum | `monthly` Monthly / Monatlich · `monthly-rental` Monthly rental / Monatliche Miete · `one-time` One-time / Einmalig |
| `network-generation` | lenum | `4g` LTE / LTE · `5g` 5G / 5G |
| `badge` | lenum | `most-popular` Most popular / Am beliebtesten |
| `addon-kind` | lenum | `streaming` Streaming / Streaming · `security` Security / Sicherheit · `protection` Protection / Schutz |
| `addon-tag` | lenum | `music` Music / Musik · `video` Video / Video · `extras` Extras / Extras |
| `color` | lenum | `black` Black / Schwarz · `silver` Silver / Silber · `violet` Violet / Violett |
| `memory-gb` | enum | `128` 128 GB · `256` 256 GB · `512` 512 GB |
| `equipment-kind` | enum | `router`, `modem`, `extender`, `gateway` |
| `wifi-standard` | enum | `none`, `wifi-5`, `wifi-6`, `wifi-7` |
| `os` | enum | `android`, `ios` |
| `offer-kind` | enum | `base-package`, `addon`, `equipment`, `device`, `bundle` |
| `existing-customer` | enum | `any`, `existing`, `new` |
| set element `families` | enum | `internet`, `phone` |
| set element `audience` | enum | `consumer`, `small-business`, `employee` |
| set element `required-addon-kinds` | enum | `installation`, `equipment` |

Planner default: `color` is a **lenum** (spec says text) so German visitors see "Schwarz" (D-004).

### Product types (exact definitions)
Columns: name · type · constraint · required · searchable · saved-to-line-item. "SFA" = `SameForAll`. `ltext` = localized text, `set<…>` = set. Every definition has `level: 'Variant'`, `inputHint: 'SingleLine'` (`MultiLine` for `highlights` and `early-termination-fee`), a `label` in both locales (English label = Title-cased attribute name, German label supplied in the data file; German labels are listed in the file, none is a placeholder).

**1. `malva-internet-plan`** — name "Malva internet plan", description "Descriptive facts of a home internet plan. Sold through offers (`malva-offer`)."
| Attribute | Type | Constraint | Req | Search | Line item |
| --- | --- | --- | --- | --- | --- |
| `technology` | lenum (shared) | SFA | yes | yes | no |
| `downstream-mbps` | number | SFA | yes | yes | no |
| `upstream-mbps` | number | SFA | yes | yes | no |
| `contract-term` | lenum (shared) | None | yes | no | no |
| `charge-type` | lenum (shared) | None | yes | no | no |
| `network-generation` | lenum (shared) | SFA | no | yes | no |
| `typical-download-mbps` | number | SFA | yes | no | no |
| `typical-upload-mbps` | number | SFA | yes | no | no |
| `typical-latency-ms` | number | SFA | yes | no | no |
| `data-gb` | number (`-1` = unlimited) | SFA | yes | yes | no |
| `price-lock-months` | number (`0` = none) | SFA | yes | no | no |
| `activation-fee` | number: whole currency units, **same number in USD and EUR** (the EUR=USD rule) | SFA | yes | no | no |
| `early-termination-fee` | ltext (may be a formula) | SFA | yes | no | no |
| `badge` | lenum (shared) | SFA | no | yes | no |
| `label-plan-id` | text (the Broadband Facts "unique plan ID") | SFA | yes | no | no |
| `bundle-discount-text` | ltext (label "Discounts & Bundles") | SFA | yes | no | no |
| `included-addons` | set<text> (add-on **product** keys) | SFA | no | no | no |
| `conflicts-with` | set<text> (offer keys; kept for the spec, authoritative list lives on offers) | SFA | no | no | no |
| `required-equipment-kinds` | set<enum equipment-kind values> | SFA | no | no | no |
| `required-addon-kinds` | set<enum installation, equipment> | SFA | no | no | no |
| `highlights` | set<ltext> (card bullets, in order) | SFA | no | no | no |

**2. `malva-phone-plan`** — same shared definitions of `contract-term`, `charge-type`, `network-generation`, `typical-download-mbps`, `typical-upload-mbps`, `typical-latency-ms`, `data-gb`, `price-lock-months`, `activation-fee`, `early-termination-fee`, `badge`, `label-plan-id`, `bundle-discount-text`, `included-addons`, `conflicts-with`, `highlights` (identical definitions to type 1), plus: `lines-included` number SFA required (always `1`, D-014: per line), `hotspot-gb` number SFA required (`0` none, `-1` unlimited). `network-generation` required here (`5g`).

**3. `malva-addon`** — name "Malva add-on".
| Attribute | Type | Constraint | Req | Search | Line item |
| --- | --- | --- | --- | --- | --- |
| `addon-kind` | lenum (shared) | SFA | yes | yes | no |
| `addon-tag` | lenum (shared; the design's Music / Video / Extras filter) | SFA | yes | yes | no |
| `provider` | text | SFA | yes | no | no |
| `applies-to-families` | set<enum families> | SFA | yes | yes | no |
| `applies-to-technologies` | set<enum cable, fixed-wireless> | SFA | no | yes | no |
| `charge-type` | lenum (shared) | None | yes | no | no |
| `trial-days` | number | SFA | no | no | no |
| `highlights` | set<ltext> | SFA | no | no | no |

**4. `malva-equipment`** — name "Malva equipment".
| Attribute | Type | Constraint | Req | Search | Line item |
| --- | --- | --- | --- | --- | --- |
| `equipment-kind` | enum | SFA | yes | yes | no |
| `max-downstream-mbps` | number | SFA | yes | yes | no |
| `supported-technologies` | set<enum cable, fixed-wireless> | SFA | yes | yes | no |
| `wifi-standard` | enum | SFA | yes | no | no |
| `charge-type` | lenum (shared) | `Unique` (variants differ: rental vs purchase) | yes | no | no |
| `incompatible-with` | set<text> (offer keys, exceptions only) | SFA | no | no | no |
| `highlights` | set<ltext> | SFA | no | no | no |

**5. `malva-device`** — name "Malva handset".
| Attribute | Type | Constraint | Req | Search | Line item |
| --- | --- | --- | --- | --- | --- |
| `brand` | text (`Malva`) | SFA | yes | no | no |
| `color` | lenum (shared) | None | yes | no | no |
| `memory-gb` | enum (shared) | None | yes | no | no |
| `os` | enum | SFA | yes | no | no |
| `network-generation` | lenum (shared) | SFA | yes | no | no |
| `compatible-plan-families` | set<enum phone> | SFA | yes | no | no |
| `highlights` | set<ltext> | SFA | no | no | no |
Variants differ by `color` × `memory-gb` only; the acquisition mode is **not** a variant (D-015). Variant constraint for the pair: `CombinationUnique` is **not** used (its all-variants rule is fragile); a test asserts uniqueness of the pair per product instead.

**6. `malva-offer`** — name "Malva offer". The offer is what the storefront lists, prices and puts in the bundle (D-010, D-011).
| Attribute | Type | Constraint | Req | Search | Line item |
| --- | --- | --- | --- | --- | --- |
| `offer-kind` | enum (shared) | SFA | yes | yes | **yes** (shipping and discount predicates) |
| `offer-family` | text: `cable`, `fixed-wireless`, `phone`, `addon`, `equipment`, `device` | SFA | yes | yes | **yes** (discount predicates) |
| `anchors` | set<text> (descriptive product keys) | SFA | yes | no | no |
| `included-offers` | set<text> (offer keys) | SFA | no | no | no |
| `compatible-addons` | set<text> (offer keys; **exceptions only**) | SFA | no | no | no |
| `compatible-equipment` | set<text> (offer keys; exceptions only) | SFA | no | no | no |
| `conflicts-with` | set<text> (offer keys; evaluated symmetrically) | SFA | no | no | no |
| `audience` | set<enum audience> | SFA | yes | yes | no |
| `existing-customer` | enum (shared) | SFA | yes | yes | no |
| `channels` | set<text> (sales-channel keys such as `online`; **empty set = every channel**; no commercetools Channel resources are created) | SFA | no | yes | no |
| `start-time` | datetime (offer purchasable from this instant; X reads it) | SFA | no | yes | no |
| `end-time` | datetime (added by G for X: offer no longer purchasable from this instant) | SFA | no | yes | no |
| `contract-term` | lenum (shared) | None | yes | yes | no |
| `charge-type` | lenum (shared) | None | yes | yes | no |
| `technology`, `downstream-mbps`, `data-gb`, `network-generation`, `badge` | shared definitions, **denormalised copies** of the anchor plan's facts (Planner default: lets Product Search facet and filter offers without a second read; a seed test asserts the copy equals the anchor) | SFA | no | yes | no |
| `addon-tag` | lenum (shared; copy of the add-on's tag) | SFA | no | yes | no |
| `color` | lenum (shared) | None | no | no | no |
| `memory-gb` | enum (shared) | None | no | no | no |
| `intro-free-months` | number (introductory-period example, read by L and by the cart discount predicate) | SFA | no | no | **yes** |
| `price-steps` | text: JSON `[{"fromMonth":0,"percentOff":20},…]` (term-phased example, read by L; validated by `parsePriceSteps`) | SFA | no | no | no |

Attribute count per type stays far below the 50-per-level Product Search limit. Offers are the only type whose attributes are `isSearchable` (plus the add-on and equipment facets above); descriptive products are never listed or searched.

### Custom types (`custom-types/`)
Both `malva-cart` and `malva-order` use `resourceTypeIds: ['order']` (the commercetools resource type id that covers Carts and Orders; **verified live in G-18**). A resource carries one type, so `malva-order` is a superset: it repeats every `malva-cart` field so values survive the cart-to-order handover.
| Type key | `resourceTypeIds` | Fields (name: type, required) |
| --- | --- | --- |
| `malva-line-item` | `line-item`, `custom-line-item` | `parentLineItemId`: String (D-026); `acquisitionMode`: Enum `outright`, `installments`, `lease`; `acquisitionTermMonths`: Number; `offerKey`: String; `autoAdded`: Boolean (system-added required equipment, D-025; G addition) — all optional |
| `malva-cart` | `order` | `postalCode`: String; `serviceableCable`, `serviceableWireless`, `serviceablePhone`: Boolean; `demoMarker`: String — all optional |
| `malva-order` | `order` | `serviceStartDate`: Date; `priceSchedule`: String (JSON array, written by L); `labelSnapshot`: String (JSON, M); `cancellation`: String (JSON `{reason, at}`, V); `returnRequest`: String (JSON, V); plus `postalCode`, `serviceableCable`, `serviceableWireless`, `serviceablePhone`, `demoMarker` — all optional |
| `malva-customer` | `customer` | `accountNumber`: String (e.g. `MV-48210-7`); `creditApproved`: Boolean (the stub credit decision flag, D-015); `demoMarker`: String — all optional |
Interface for U (checkout): before creating the order, switch the cart's type with `setCustomType` from `malva-cart` to `malva-order`, copying the field values (G-18 records whether `OrderFromCartDraft.custom` makes this unnecessary). Types are created with `name`/`description` in both locales and `inputHint: 'SingleLine'`.

### Categories (`categories.ts`) — order hints are decimal strings
| Key | Parent | Name en-US / de-DE | Slug en-US / de-DE | Order hint |
| --- | --- | --- | --- | --- |
| `malva-cat-phone-plans` | — | Phone plans / Handytarife | `phone-plans` / `handytarife` | `0.1` |
| `malva-cat-devices` | — | Phones & devices / Handys & Geräte | `phones-and-devices` / `handys-und-geraete` | `0.2` |
| `malva-cat-home-wireless` | — | Wireless internet / Funk-Internet | `home-wireless-internet` / `funk-internet` | `0.3` |
| `malva-cat-cable-internet` | — | Cable internet / Kabel-Internet | `cable-internet` / `kabel-internet` | `0.4` |
| `malva-cat-add-ons` | — | Add-ons / Zusatzangebote | `add-ons` / `zusatzangebote` | `0.5` |
| `malva-cat-streaming` | add-ons | Streaming & entertainment / Streaming & Unterhaltung | `streaming-entertainment` / `streaming-unterhaltung` | `0.1` |
| `malva-cat-protection` | add-ons | Security & protection / Sicherheit & Schutz | `security-and-protection` / `sicherheit-und-schutz` | `0.2` |
| `malva-cat-equipment` | add-ons | Routers & equipment / Router & Zubehör | `routers-and-equipment` / `router-und-zubehoer` | `0.3` |
Descriptions (en-US / de-DE): phone "Pick the data you need. No contracts, no hidden fees, keep your number." / "Wählen Sie das Datenvolumen, das Sie brauchen. Keine Vertragsbindung, keine versteckten Kosten, Rufnummer mitnehmen."; wireless "Plug in, connect, go. Home internet over our 5G network with no installation visit." / "Einstecken, verbinden, loslegen. Heim-Internet über unser 5G-Netz ohne Installationstermin."; cable "Fiber-grade cable speeds with a locked price and professional installation." / "Kabel-Internet auf Glasfaser-Niveau mit festem Preis und Profi-Installation."; add-ons "Streaming, music and extras, billed with your Malva plan. Works with phone, wireless and cable." / "Streaming, Musik und Extras, abgerechnet mit Ihrem Malva-Tarif. Funktioniert mit Handy, Funk und Kabel."; devices "Malva phones, with outright purchase, installments or lease." / "Malva-Handys zum Kauf, auf Raten oder zur Miete."; subcategories: one short sentence each (data file). `categoryOrderHints` on products reference these keys. Category images are `assets` (one `AssetDraft` per category from the lock file, name = category name).

### Recurrence policies
`malva-monthly` (F) is the policy for **every monthly service line, add-on and equipment rental** (D-012). Device financing needs a price per term, but a price can only be tied to one policy per scope, so **Planner default:** four extra policies in `data/recurrence-devices.ts`, all `{ type: 'standard', value: 1, intervalUnit: 'Months' }`: `malva-device-installment-12`, `malva-device-installment-24`, `malva-device-installment-36`, `malva-device-lease-24` (names en-US "Installment, 12 months" … de-DE "Raten, 12 Monate", "Miete, 24 Monate"). Workstream Q reads the policy by key from the chosen mode and term. The platform falls back **silently** to the one-time price when a recurring line has no price for its policy (docs: <https://docs.commercetools.com/api/recurring-orders-overview#prices>), so `checks/catalog.ts` asserts that every recurring variant has a price for each policy it is sold with.

### Price rules (`prices.ts`) — the single price table
- USD amounts are the source; **EUR = USD rounded to whole euros** (table rule, no FX): `eurCents = Math.round(usdCents / 100) * 100` (half rounds up). Country `US` for USD prices, `DE` for EUR prices; every price has a `key` `<sku>.<currency>.<policyKey|once>`.
- Monthly price: `{ value, country, recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-monthly' } }`. One-time price: no `recurrencePolicy`. No price is zero.
- Term rule: committed terms are **cheaper per month** than month-to-month.

| Offer | Variant SKU → term → USD cents (EUR = rule) |
| --- | --- |
| `malva-offer-cable-100` (master 24M) | `MLV-CBL-100-24M` 3999 · `MLV-CBL-100-12M` 4499 · `MLV-CBL-100-M2M` 4999 (EUR 4000 / 4500 / 5000) |
| `malva-offer-cable-500` (master 24M) | `MLV-CBL-500-24M` 5999 · `-12M` 6499 · `-M2M` 6999 (EUR 6000 / 6500 / 7000) |
| `malva-offer-cable-gig` (master 24M) | `MLV-CBL-GIG-24M` 7999 · `-12M` 8499 · `-M2M` 8999 (EUR 8000 / 8500 / 9000) |
| `malva-offer-wireless-lite` (master 12M) | `MLV-AIR-LITE-12M` 4500 · `-M2M` 5000 |
| `malva-offer-wireless-5g` (master 12M) | `MLV-AIR-5G-12M` 5500 · `-M2M` 6000 |
| `malva-offer-wireless-5g-plus` (master 12M) | `MLV-AIR-5GPLUS-12M` 7500 · `-M2M` 8000 |
| `malva-offer-phone-essential` (master M2M) | `MLV-PHN-ESS-M2M` 2500 · `-12M` 2300 |
| `malva-offer-phone-plus` (master M2M) | `MLV-PHN-PLUS-M2M` 3500 · `-12M` 3300 · `-24M` 3100 |
| `malva-offer-phone-unlimited` (master M2M) | `MLV-PHN-UNL-M2M` 5000 · `-12M` 4800 · `-24M` 4600 |
| `malva-offer-phone-unlimited-max` (master M2M) | `MLV-PHN-UNLMAX-M2M` 6500 · `-12M` 6300 · `-24M` 6100 |
| `malva-offer-cable-existing-customer` (one variant) | `MLV-CBL-500-EXIST-24M` 4999 |
| `malva-offer-phone-online-only` (one variant) | `MLV-PHN-UNL-ONLINE-M2M` 4500 |
| Add-ons (one variant each, term `month-to-month`, charge `monthly`) | `MLV-ADD-SPOTIFY-MTH` 1000 · `MLV-ADD-APPLETV-MTH` 1000 · `MLV-ADD-APPLEMUSIC-MTH` 1100 · `MLV-ADD-NETFLIX-MTH` 800 · `MLV-ADD-DISNEY-MTH` 800 · `MLV-ADD-CLOUD200-MTH` 300 · `MLV-ADD-DEVCARE-MTH` 1200 · `MLV-ADD-SECURE-MTH` 500 (Secure is not in the design; $5 is the Planner default) |
| Equipment (rental variant monthly, purchase variant one-time) | AC1200: `MLV-EQP-AC1200-RENT` 500 monthly, `MLV-EQP-AC1200-BUY` 7999 once · AX3000: `-RENT` 800, `-BUY` 12999 · BE9300: `-RENT` 1200, `-BUY` 24999 · DOCSIS31: `-RENT` 600, `-BUY` 9999 · 5G gateway: `MLV-EQP-5GGW-RENT` 1000 only |
| Handsets (every color × memory variant) | outright (one-time): Nova 5G 128 GB 49900, 256 GB 54900 · Nova Pro 256 GB 79900, 512 GB 89900 |
Handset financing prices (recurring, tied to the device policies, per variant, USD cents then the EUR rule): installments `monthlyCents = Math.round(outrightCents / term)` for term 12, 24, 36 (policies `malva-device-installment-12/24/36`); lease `Math.round(outrightCents * 0.04)` per month (policy `malva-device-lease-24`). Example Nova 5G 128 GB: 4158 / 2079 / 1386 / 1996. All values come from the function, none is typed by hand.
Master variants (the term the design shows, D-011; the listing card reads the master): cable 24M, wireless 12M, phone M2M, add-ons the single variant, equipment RENT, handsets first variant (black, smallest memory). Variant order in the manifest is master first, then M2M, 12M, 24M (those that exist).

### Descriptive products (25) — exact facts
Keys, SKUs and attribute values. All have categories `[]` (descriptive products are not categorised, D-010), tax category `malva-telecom-services`, one master variant (devices: one variant per color × memory) with SKU `…-BASE` (devices `…-<COLOR>-<GB>-BASE`), no prices, no images.

| Key | SKU | Facts |
| --- | --- | --- |
| `malva-cable-100` | `MLV-CBL-100-BASE` | technology cable · 100 down / 10 up · typical 104 / 11 / 16 ms · data -1 · lock 24 · activation 25 · ETF "$10 x months remaining" / "10 € x verbleibende Monate" · label id `MLV-CA-100` · required equipment `modem` · term `24-months`, charge `monthly` |
| `malva-cable-500` | `MLV-CBL-500-BASE` | cable · 500 / 50 · 525 / 48 / 13 · -1 · 24 · 25 · same ETF · `MLV-CA-101` · badge `most-popular` · modem |
| `malva-cable-gig` | `MLV-CBL-GIG-BASE` | cable · 1000 / 60 · 940 / 60 / 11 · -1 · 24 · 25 · same ETF · `MLV-CA-102` · modem · `included-addons` `[malva-appletv]` |
| `malva-wireless-lite` | `MLV-AIR-LITE-BASE` | fixed-wireless · 50 / 10 · 42 / 8 / 45 · data 300 · lock 12 · activation 0 · ETF "$0" / "0 €" · `MLV-WI-100` · netgen `4g` · required equipment `gateway` · term `12-months` |
| `malva-wireless-5g` | `MLV-AIR-5G-BASE` | fixed-wireless · 200 / 30 · 190 / 25 / 30 · -1 · 12 · 0 · "$0" · `MLV-WI-101` · `5g` · badge `most-popular` · gateway |
| `malva-wireless-5g-plus` | `MLV-AIR-5GPLUS-BASE` | fixed-wireless · 500 / 70 · 470 / 60 / 22 · -1 · 12 · 0 · "$0" · `MLV-WI-102` · `5g` · gateway |
| `malva-phone-essential` | `MLV-PHN-ESS-BASE` | data 5 · lines 1 · hotspot 0 · `5g` · typical 80 / 12 / 38 ms · ETF "None" / "Keine" · lock 0 · activation 0 · `MLV-PH-100` · term `month-to-month` |
| `malva-phone-plus` | `MLV-PHN-PLUS-BASE` | 20 · 1 · hotspot 10 · 120 / 18 / 34 · `MLV-PH-101` |
| `malva-phone-unlimited` | `MLV-PHN-UNL-BASE` | data -1 · 1 · hotspot 30 · 220 / 35 / 28 · `MLV-PH-102` · badge `most-popular` · `included-addons` `[malva-spotify]` |
| `malva-phone-unlimited-max` | `MLV-PHN-UNLMAX-BASE` | -1 · 1 · hotspot -1 · 380 / 50 / 24 · `MLV-PH-103` · `included-addons` `[malva-spotify, malva-cloud-200]` |
| `malva-spotify` | `MLV-ADD-SPOTIFY-BASE` | kind streaming · tag music · provider "Spotify" · families `[internet, phone]` · charge monthly |
| `malva-appletv` | `MLV-ADD-APPLETV-BASE` | streaming · video · "Apple" · `[internet]` |
| `malva-applemusic` | `MLV-ADD-APPLEMUSIC-BASE` | streaming · music · "Apple" · `[internet, phone]` |
| `malva-netflix` | `MLV-ADD-NETFLIX-BASE` | streaming · video · "Netflix" · `[internet]` |
| `malva-disneyplus` | `MLV-ADD-DISNEY-BASE` | streaming · video · "Disney" · `[internet]` |
| `malva-cloud-200` | `MLV-ADD-CLOUD200-BASE` | protection · extras · "Malva" · `[internet, phone]` |
| `malva-device-protect` | `MLV-ADD-DEVCARE-BASE` | protection · extras · "Malva" · `[phone]` |
| `malva-secure` | `MLV-ADD-SECURE-BASE` | security · extras · "Malva" · `[internet]` |
| `malva-router-ac1200` | `MLV-EQP-AC1200-BASE` | router · max 300 · techs `[cable, fixed-wireless]` · wifi-5 |
| `malva-router-ax3000` | `MLV-EQP-AX3000-BASE` | router · 1000 · both · wifi-6 · `incompatible-with` `[malva-offer-wireless-lite]` (the deliberate exception) |
| `malva-mesh-be9300` | `MLV-EQP-BE9300-BASE` | router · 2500 · both · wifi-7 |
| `malva-modem-docsis31` | `MLV-EQP-DOCSIS31-BASE` | modem · 2000 · `[cable]` · none |
| `malva-5g-gateway` | `MLV-EQP-5GGW-BASE` | gateway · 500 · `[fixed-wireless]` · wifi-6 |
| `malva-phone-nova-5g` | `MLV-DEV-NOVA5G-<BLK or SLV>-<128 or 256>-BASE` | brand Malva · os android · `5g` · families `[phone]` · colors black, silver · memory 128, 256 |
| `malva-phone-nova-pro` | `MLV-DEV-NOVAPRO-<BLK, SLV or VLT>-<256 or 512>-BASE` | android · `5g` · colors black, silver, violet · memory 256, 512 |
Highlights (card bullets, en-US / de-DE) are copied verbatim from the design prototype and translated: Essential "5GB high-speed data / Unlimited talk & text / Wi-Fi calling" ⇄ "5 GB High-Speed-Daten / Unbegrenzt telefonieren & SMS / WLAN-Telefonie"; Plus "20GB high-speed data / Unlimited talk & text / Hotspot 10GB / Roaming in Canada & Mexico" ⇄ "20 GB High-Speed-Daten / Unbegrenzt telefonieren & SMS / Hotspot 10 GB / Roaming in Kanada & Mexiko"; Unlimited "Unlimited 5G data / Hotspot 30GB / Roaming in 40+ countries / 1 add-on included" ⇄ "Unbegrenzte 5G-Daten / Hotspot 30 GB / Roaming in über 40 Ländern / 1 Zusatzangebot inklusive"; Max "Unlimited premium 5G data / Unlimited hotspot / International calling / 2 add-ons included" ⇄ "Unbegrenzte Premium-5G-Daten / Unbegrenzter Hotspot / Telefonate ins Ausland / 2 Zusatzangebote inklusive"; Air Lite "Up to 50 Mbps / 300GB monthly data / Free router" ⇄ "Bis zu 50 Mbit/s / 300 GB Datenvolumen pro Monat / Router kostenlos"; Air 5G "Up to 200 Mbps / Unlimited data / Wi-Fi 6 router / Self-install in minutes" ⇄ "Bis zu 200 Mbit/s / Unbegrenztes Datenvolumen / WLAN-6-Router / Selbstinstallation in Minuten"; Air 5G Plus "Up to 500 Mbps / Unlimited data / Wi-Fi 6E router + extender / Priority network access" ⇄ "Bis zu 500 Mbit/s / Unbegrenztes Datenvolumen / WLAN-6E-Router + Repeater / Bevorzugter Netzzugang"; Cable 100 "100 Mbps download / Unlimited data / Modem included" ⇄ "100 Mbit/s Download / Unbegrenztes Datenvolumen / Modem inklusive"; Cable 500 "500 Mbps download / Unlimited data / Wi-Fi 6 gateway / Free professional install" ⇄ "500 Mbit/s Download / Unbegrenztes Datenvolumen / WLAN-6-Gateway / Kostenlose Profi-Installation"; Cable Gig "1 Gbps download / Unlimited data / Whole-home mesh Wi-Fi / Free professional install" ⇄ "1 Gbit/s Download / Unbegrenztes Datenvolumen / Mesh-WLAN für das ganze Zuhause / Kostenlose Profi-Installation".
`bundle-discount-text` (en-US ⇄ de-DE): phone "Add a second line for $10 off. Bundle with cable or wireless for $5 off monthly." ⇄ "Zweite Leitung für 10 € weniger. In Kombination mit Kabel oder Funk 5 € monatlich sparen."; wireless "Bundle with a phone plan for $5 off monthly." ⇄ "In Kombination mit einem Handytarif 5 € monatlich sparen."; cable "Bundle with a phone plan for $5 off monthly." ⇄ same German sentence. (The prototype's "Autopay saves $5" is dropped: no autopay exists.)
Names and descriptions (en-US ⇄ de-DE): names equal the brand names in the design ("Essential 5GB", "Plus 20GB", "Unlimited", "Unlimited Max", "Air Lite", "Air 5G", "Air 5G Plus", "Cable 100", "Cable 500", "Cable Gig", "Spotify", "Apple TV+", "Apple Music", "Netflix", "Disney+", "Cloud 200GB", "Device Care", "Malva Secure", "Malva WiFi 5 Router AC1200" ⇄ "Malva WLAN-5-Router AC1200", "Malva WiFi 6 Router AX3000" ⇄ "Malva WLAN-6-Router AX3000", "Malva WiFi 7 Mesh BE9300" ⇄ "Malva WLAN-7-Mesh BE9300", "Malva DOCSIS 3.1 Modem", "Malva 5G Home Gateway" ⇄ "Malva 5G-Heim-Gateway", "Nova 5G", "Nova Pro"). Add-on descriptions are the design's: Spotify "Spotify Premium, ad-free music on all devices." ⇄ "Spotify Premium, werbefreie Musik auf allen Geräten."; Apple TV+ "Award-winning originals, streamed anywhere." ⇄ "Preisgekrönte Originals, überall streamen."; Apple Music "Over 100 million songs, ad-free." ⇄ "Über 100 Millionen Songs, werbefrei."; Netflix "Netflix Standard with ads, on your Malva bill." ⇄ "Netflix Standard mit Werbung, auf Ihrer Malva-Rechnung."; Disney+ "Disney, Pixar, Marvel and Star Wars." ⇄ "Disney, Pixar, Marvel und Star Wars."; Cloud 200GB "Back up photos and files securely." ⇄ "Fotos und Dateien sicher sichern."; Device Care "Screen and damage cover for one device." ⇄ "Display- und Schadenschutz für ein Gerät."; Malva Secure "Network security and malware protection for every device on your home network." ⇄ "Netzwerksicherheit und Malware-Schutz für jedes Gerät in Ihrem Heimnetz." Plan, equipment and handset descriptions are written in the data files (one en-US and one de-DE sentence each, derived from the highlights; equipment: "Entry-level Wi-Fi 5 router for plans up to 300 Mbps." etc.; handsets: "Malva Nova 5G: a 6.1-inch 5G phone with a 128 GB or 256 GB option." and "Malva Nova Pro: a 6.7-inch flagship 5G phone with a 256 GB or 512 GB option." plus German). The same text is used on the descriptive product and its offer. Slugs: offers `<key without malva-offer->` (e.g. `cable-500`, same in both locales); descriptive products `<offer slug>-details`.

### Offers (27) — exact wiring
Every offer: product type `malva-offer`, tax category `malva-telecom-services`, `existing-customer: any`, `channels: []`, `audience: [consumer, small-business, employee]`, `start-time` and `end-time` unset (X sets them for campaigns), `charge-type` monthly (or per variant for equipment), published. Attribute copies (`technology`, `downstream-mbps`, `data-gb`, `network-generation`, `badge`, `addon-tag`) are generated from the anchor by `offers/*.ts`.
| Offer key | Anchors | Categories (order hint in each) | `offer-kind` / `offer-family` | Included offers | Extras |
| --- | --- | --- | --- | --- | --- |
| `malva-offer-cable-100` | `malva-cable-100` | cable-internet 0.1 | base-package / cable | `malva-offer-modem-docsis31` | `intro-free-months: 1` |
| `malva-offer-cable-500` | `malva-cable-500` | cable-internet 0.2 | base-package / cable | modem | badge most-popular |
| `malva-offer-cable-gig` | `malva-cable-gig` | cable-internet 0.3 | base-package / cable | modem, `malva-offer-appletv` | `price-steps` `[{"fromMonth":0,"percentOff":20},{"fromMonth":12,"percentOff":10},{"fromMonth":24,"percentOff":0}]` |
| `malva-offer-cable-existing-customer` | `malva-cable-500` | cable-internet 0.4 | base-package / cable | modem | `existing-customer: existing`, `audience: [consumer, small-business]`; name "Cable 500, existing customers" ⇄ "Cable 500 für Bestandskunden" |
| `malva-offer-wireless-lite` | `malva-wireless-lite` | home-wireless 0.1 | base-package / fixed-wireless | `malva-offer-5g-gateway` | — |
| `malva-offer-wireless-5g` | `malva-wireless-5g` | home-wireless 0.2 | base-package / fixed-wireless | 5g-gateway | `intro-free-months: 1`, badge most-popular |
| `malva-offer-wireless-5g-plus` | `malva-wireless-5g-plus` | home-wireless 0.3 | base-package / fixed-wireless | 5g-gateway | — |
| `malva-offer-phone-essential` | `malva-phone-essential` | phone-plans 0.1 | base-package / phone | — | — |
| `malva-offer-phone-plus` | `malva-phone-plus` | phone-plans 0.2 | base-package / phone | — | — |
| `malva-offer-phone-unlimited` | `malva-phone-unlimited` | phone-plans 0.3 | base-package / phone | `malva-offer-spotify` | badge most-popular |
| `malva-offer-phone-unlimited-max` | `malva-phone-unlimited-max` | phone-plans 0.4 | base-package / phone | spotify, `malva-offer-cloud-200` | `price-steps` `[{"fromMonth":0,"percentOff":15},{"fromMonth":12,"percentOff":10},{"fromMonth":24,"percentOff":0}]`; `compatible-addons: [malva-offer-netflix]` (positive exception: Netflix is internet-only by attributes, allowed on this plan) |
| `malva-offer-phone-online-only` | `malva-phone-unlimited` | phone-plans 0.5 | base-package / phone | spotify | `channels: [online]`; name "Unlimited, online only" ⇄ "Unlimited, nur online" |
| `malva-offer-spotify` | `malva-spotify` | streaming 0.1, add-ons 0.1 | addon / addon | — | tag music |
| `malva-offer-appletv` | `malva-appletv` | streaming 0.2, add-ons 0.2 | addon / addon | — | video |
| `malva-offer-applemusic` | `malva-applemusic` | streaming 0.3, add-ons 0.3 | addon / addon | — | music |
| `malva-offer-netflix` | `malva-netflix` | streaming 0.4, add-ons 0.4 | addon / addon | — | video |
| `malva-offer-disneyplus` | `malva-disneyplus` | streaming 0.5, add-ons 0.5 | addon / addon | — | video |
| `malva-offer-cloud-200` | `malva-cloud-200` | protection 0.3, add-ons 0.6 | addon / addon | — | extras |
| `malva-offer-device-protect` | `malva-device-protect` | protection 0.2, add-ons 0.7 | addon / addon | — | extras |
| `malva-offer-secure` | `malva-secure` | protection 0.1, add-ons 0.8 | addon / addon | — | extras |
| `malva-offer-router-ac1200` | `malva-router-ac1200` | equipment 0.1 | equipment / equipment | — | variants RENT (master) and BUY |
| `malva-offer-router-ax3000` | `malva-router-ax3000` | equipment 0.2 | equipment / equipment | — | RENT, BUY |
| `malva-offer-mesh-be9300` | `malva-mesh-be9300` | equipment 0.3 | equipment / equipment | — | RENT, BUY |
| `malva-offer-modem-docsis31` | `malva-modem-docsis31` | equipment 0.4 | equipment / equipment | — | RENT, BUY |
| `malva-offer-5g-gateway` | `malva-5g-gateway` | equipment 0.5 | equipment / equipment | — | RENT only |
| `malva-offer-phone-nova-5g` | `malva-phone-nova-5g` | devices 0.1 | device / device | — | 4 variants |
| `malva-offer-phone-nova-pro` | `malva-phone-nova-pro` | devices 0.2 | device / device | — | 6 variants |
Offer SKUs are the ones in the price table; handset offer SKUs are `MLV-DEV-NOVA5G-<BLK or SLV>-<128 or 256>` and `MLV-DEV-NOVAPRO-<BLK, SLV or VLT>-<256 or 512>`. Add-on offers use `contract-term: month-to-month`. Equipment RENT variants `charge-type: monthly-rental`, BUY `one-time`. Plan offers: `charge-type: monthly`.

Derived relations (`relations.ts`, pure, unit-tested):
- **Conflicts (symmetric, Planner default):** every home-internet offer (the four cable offers and three wireless offers) conflicts with **every other** home-internet offer (so a buyer holds at most one; the design replaces the selection). Phone offers conflict with nothing (several lines allowed, D-014). The function builds the lists from the offer table; the test asserts `a ∈ conflicts(b) ⇔ b ∈ conflicts(a)`.
- **Included offers** as in the table above; every included key must be an existing offer; `included-addons` on the anchor plan must equal the included **add-on** offers' anchors (cable-gig: appletv; unlimited: spotify; max: spotify, cloud-200). Required equipment kinds are satisfied by included equipment (modem for cable, gateway for wireless), so the buyer is not charged for them; optional extra equipment is still compatibility-checked. **Cross-workstream contract for J:** `required-equipment-kinds` is satisfied when an offer in `included-offers` is equipment of that kind.
- **Exceptions (J cases):** `malva-router-ax3000.incompatible-with = [malva-offer-wireless-lite]` (negative exception); `malva-offer-phone-unlimited-max.compatible-addons = [malva-offer-netflix]` (positive exception; the same add-on is compatible with this offer and not with the other phone offers).
- **Serviceability / eligibility copies** are not on offers (D-020 stub).

### Inventory (`inventory.ts`) — equipment and handsets only
One `InventoryEntry` per **offer** variant SKU (the SKU the cart adds), key `malva-inv-<sku>`: the nine equipment SKUs (`MLV-EQP-AC1200-RENT`, `-BUY`, `MLV-EQP-AX3000-RENT`, `-BUY`, `MLV-EQP-BE9300-RENT`, `-BUY`, `MLV-EQP-DOCSIS31-RENT`, `-BUY`, `MLV-EQP-5GGW-RENT`) with `quantityOnStock: 500`, and the ten handset SKUs with `quantityOnStock: 200` **except** `MLV-DEV-NOVAPRO-VLT-512` = `0` (the out-of-stock case). Services (plans, add-ons) carry **no** InventoryEntry (D-019); descriptive `-BASE` SKUs carry none. 19 entries in total.

### Cart discounts and codes (`cart-discounts.ts`, `discount-codes.ts`)
All with `isActive: true`, `stackingMode: 'Stacking'`, `requiresDiscountCode: false` (except the welcome discount), names/descriptions in both locales, unique `sortOrder` strings. Predicates use backtick-escaped attribute names (proven in G-18; fallback in the F design). Docs: cart discounts <https://docs.commercetools.com/api/projects/cartDiscounts>, predicates <https://docs.commercetools.com/api/projects/predicates>, buy-and-get patterns <https://docs.commercetools.com/api/pricing-and-discounts-overview#buy-and-get-discount-examples>. Multi-buy targets can only be relative, so absolute amounts use the **pattern** target.
| Key | sortOrder | Effect | `cartPredicate` | `target` | `recurringOrderScope` |
| --- | --- | --- | --- | --- | --- |
| `malva-cd-second-line-10` | `0.1` | absolute `{USD 1000, EUR 1000}`, `applicationMode: IndividualApplication` | `true` | `` `{ type: 'pattern', triggerPattern: [{ type: 'CountOnLineItemUnits', predicate: 'attributes.`offer-family` = "phone"', minCount: 1, maxCount: 1 }], targetPattern: [{ type: 'CountOnLineItemUnits', predicate: 'attributes.`offer-family` = "phone"', minCount: 1, maxCount: 4 }], maxOccurrence: 1, selectionMode: 'Cheapest' }` (first line pays full price, lines 2 to 5 get $10 off each; D-014) `` | `AnyOrder` |
| `malva-cd-bundle-5` | `0.2` | absolute `{USD 500, EUR 500}` | `` lineItemExists(attributes.`offer-family` = "phone") = true and lineItemExists(attributes.`offer-family` in ("cable","fixed-wireless")) = true `` | `` { type: 'lineItems', predicate: 'attributes.`offer-family` in ("cable","fixed-wireless")' } `` | `AnyOrder` |
| `malva-cd-intro-free-month` | `0.3` | relative `permyriad: 10000` | `true` | `` lineItems`, predicate `attributes.`intro-free-months` > 0 `` | `NonRecurringOrdersOnly` (first order only) |
| `malva-cd-tier-year1-20` | `0.4` | relative `2000` | `true` | `lineItems`, predicate `sku = "MLV-CBL-GIG-24M"` | `NonRecurringOrdersOnly` |
| `malva-cd-tier-year1-15` | `0.5` | relative `1500` | `true` | `lineItems`, predicate `sku = "MLV-PHN-UNLMAX-24M"` | `NonRecurringOrdersOnly` |
| `malva-cd-welcome-10` | `0.6` | absolute on `{ type: 'totalPrice' }` `{USD 1000, EUR 1000}` | `true` | `totalPrice` | `NonRecurringOrdersOnly`; `requiresDiscountCode: true` |
Discount code `malva-dc-welcome10`: code `WELCOME10`, `cartDiscounts: [malva-cd-welcome-10]`, `isActive: true`, no limits, name "Welcome offer" ⇄ "Willkommensangebot". The year-1 discounts equal `price-steps[0].percentOff` of their offer (a test asserts it); the later steps live in the order's `priceSchedule` (L, D-013): the platform cannot step a price by period. The introductory-period and tiered examples are therefore data for L, not a promise that the platform ends the period.

### Customer groups and demo data
Customer groups are F's. Demo data (`demo/*.ts`; kinds `demoCustomer`, `demoOrder`; only with `--with-demo`; every record carries `demoMarker: 'malva-demo'`). Password for all demo customers = env `SEED_DEMO_PASSWORD` (never committed; `seed --with-demo` stops with exit 3 if it is unset).
| Customer key | Email | Name | Group | Country, address | Account no. | Orders |
| --- | --- | --- | --- | --- | --- | --- |
| `malva-demo-alex-rivera` | `alex.rivera@example.com` | Alex Rivera | `existing-customer` | US, 245 Peachtree St NE, Atlanta GA 30309 | `MV-48210-7` | `MLV-DEMO-0001`, `MLV-DEMO-0002` |
| `malva-demo-jo-kim` | `jo.kim@example.com` | Jo Kim | `existing-customer` | US, 1 Market St, San Francisco CA 94105 | `MV-51002-3` | `MLV-DEMO-0003` |
| `malva-demo-sam-carter` | `sam.carter@example.com` | Sam Carter | `small-business` | US, 600 Congress Ave, Austin TX 78701 | `MV-53117-1` | none |
| `malva-demo-pat-lee` | `pat.lee@example.com` | Pat Lee | `employee` | US, 350 Fifth Ave, New York NY 10118 | `MV-54420-9` | none |
| `malva-demo-lena-weber` | `lena.weber@example.de` | Lena Weber | `consumer` | DE, Unter den Linden 10, 10115 Berlin | `MV-55001-4` | none |
`isEmailVerified: true` (D-031), `creditApproved: true` for all except Sam (`false`, exercises the stub decline). Orders (holdings, D-021) are created from carts with `orderNumber`, `orderState: 'Confirmed'`, custom type `malva-order` (`serviceStartDate`, `priceSchedule` JSON with the monthly amount, `demoMarker`), line custom type `malva-line-item` (`offerKey`), `recurrenceInfo` `{ recurrencePolicy: malva-monthly, priceSelectionMode: 'Fixed' for 12M/24M, 'Dynamic' for M2M }`, cart key `malva-demo-cart-000N`:
| Order number | Customer | Lines (SKU, qty) | `serviceStartDate` |
| --- | --- | --- | --- |
| `MLV-DEMO-0001` | Alex | `MLV-CBL-500-24M` ×1 | `2026-03-12` |
| `MLV-DEMO-0002` | Alex | `MLV-PHN-UNL-M2M` ×1, then `MLV-ADD-SPOTIFY-MTH` ×1 with `parentLineItemId` = the plan line's id | `2025-06-03` |
| `MLV-DEMO-0003` | Jo | `MLV-AIR-5G-12M` ×1 | `2026-05-20` |
(The design's account page shows these three contracts for Alex: Cable 500 24 months, Unlimited, Spotify.) Orders are immutable: an existing `orderNumber` is `unchanged`. Creating an order with a recurring line makes the platform create a Recurring Order in the background; G-18 checks it and, if not, G-19 falls back to `POST /recurring-orders` with the cart. Reset (F) removes demo data by the marker.

### Serviceability table (`serviceability.ts`, D-020)
Seeded as **Custom Objects**, container `malva-serviceability`, key = postal code, value `{ "country": "US", "city": "…", "state": "…", "services": { "cable": true, "fixed-wireless": true, "phone": true } }`. Rows: US `10118` New York NY all true · `30309` Atlanta GA all true · `94105` San Francisco CA all true · `27517` Chapel Hill NC all true · `60601` Chicago IL cable true, wireless false, phone true · `78701` Austin TX cable false, wireless true, phone true · `59001` Absarokee MT cable false, wireless false, phone true · DE `10115` Berlin all true · `20095` Hamburg all true · `80331` München cable true, wireless false, phone true · `01067` Dresden cable false, wireless true, phone true. **A postal code absent from the table is not served at all** (use `00000` in tests). The reconciler `customObject` upserts by container+key. **Interface for K:** the stub reads these objects (cached 5 minutes, D-020). The storefront API client (OA-02) needs the scope `view_key_value_documents`, which is **not** in the OA-02 list today; the seed client (OA-03) needs `manage_key_value_documents`. Both are reported to the owner; until OA-02 is extended K falls back to a built-in copy generated from this file by `scripts/seed/export-serviceability.ts` (G-14 writes it to `site/lib/offers/serviceability-table.json`, K owns the file name; the test asserts both agree).

### Images (D-055) — `update-images.ts`, `images.ts`
Method = the grocery `update-images.ts` (read `../b2c-grocery/site/scripts/seed/update-images.ts`): the public JSON endpoint behind pexels.com search `https://www.pexels.com/en-us/api/v3/getty-media/photos/<term>?number=<count+2>&page=1`, headers `{ accept, 'content-type': 'application/json', 'x-client-type': 'react', 'pexels-client-id': process.env.PEXELS_CLIENT_ID ?? '<the public id the pexels.com web app sends, copied from the grocery script>', 'user-agent': 'malva-seed' }`, no account, no API key. **Risks accepted by D-055 and recorded in `PROJECT-FINDINGS.md`:** (1) the endpoint is undocumented and may change or be restricted; (2) in the grocery project (2026-10) every returned URL was on **`media.istockphoto.com`**, not `images.pexels.com`, and stock-photo licences may not allow hotlinking in a public site: acceptable for a demo only (D-066: Claude inspects the hosts and licence/credit info during the image run and records it in `PROJECT-FINDINGS.md`), revisit before any non-demo use; (3) a response may be an empty list or HTTP 401/429.
- Lock file `data/product-images.json`, committed: `{ "<manifest key>": { "term": "<search term>", "images": [{ "url": "<clean url, no query string>", "dimensions": { "w": 612, "h": 408 }, "photographer": "<name or null>" }] } }`. Keys are offer keys and category keys (descriptive products have no images). `photographer` is read from the response only if present (record the real response shape in `PROJECT-FINDINGS.md` during G-15 and fix the fixture); otherwise `null`.
- Terms (`image-terms.ts`, generic, no brands): cable `cable internet router home`; wireless `home wifi router 5g`; phone plans `family phone call`; add-ons streaming `streaming entertainment couch`; protection `phone security protection`; equipment `wifi router modem`; devices `smartphone`; per-offer overrides for offers whose category term is not specific (e.g. `malva-offer-spotify` `music headphones`, `malva-offer-netflix` `watching tv couch`, `malva-offer-disneyplus` `family movie night`, `malva-offer-appletv` `living room tv`, `malva-offer-applemusic` `listening to music`, `malva-offer-cloud-200` `cloud storage laptop`, `malva-offer-device-protect` `smartphone screen protector`). Selection rule: the first `count` (default 2) distinct URLs in response order, never random.
- Attach: category `assets` (`setAssetSources`/`addAsset`), offer variants `images` for **every variant** of the offer via the product reconciler (`addExternalImage` with `label`). The image `label` is `Photo: <photographer> via Pexels` when known, else `Photo via Pexels` (it doubles as the alternative-text source: the credit requirement).
- `seed` never calls the network for images: it reads the lock. `npm run seed:images` (`update-images.ts [--dry-run] [--only <key>] [--count 2] [--max-lookups 40]`) refreshes the lock: only keys without an entry, or whose `term` changed, are looked up (**"Photo replaced deliberately"**: delete the lock entry or edit the term). Stops looking up on HTTP 429/403, on a `x-ratelimit-remaining` header below 5 (when present), or after `--max-lookups`; prints the keys left without images; waits 400 ms between lookups; never retries in a loop. A key with no entry and no lookup result is seeded **without an image** and listed as `missing image` in the report (the storefront shows its placeholder, owner I/N).
- Host allow-list: `IMAGE_HOSTS = ['images.pexels.com', 'media.istockphoto.com']` in `site/lib/config/images.ts` (new, G's area), used by the seeder (`assertAllowedImageHost(url)` throws on any other host or non-https URL) and by `next.config.ts` `images.remotePatterns` (G appends the two hosts there; A owns the file, append only). The credit link constant `PEXELS_URL = 'https://www.pexels.com'` is in the same file; message key `footer.photoCredit` (en-US "Photos from Pexels", de-DE "Fotos von Pexels") is appended by G to both messages files (D owns them). **Contract for I:** `SiteFooter` renders a link to `PEXELS_URL` with that text whenever any image is shown (always, in v1).

### Verify checks (`checks/catalog.ts`, registered in `checks/index.ts`)
Counts: 6 product types; 4 custom types; 8 categories; 25 descriptive + 27 offers = 52 products, all published; 19 inventory entries; 6 cart discounts + 1 code; 5 policies in total (`malva-monthly` + 4 device); 11 serviceability objects; every offer variant has USD/US and EUR/DE prices and every recurring variant has a price for its policy; every key referenced by an offer exists; `price-steps` parse; year-1 discounts equal the first step; image coverage (reports missing, does not fail); search: `waitForSearchIndex` finds all 27 offer keys. Each check has a unit test against the fake.

### Search index (D-056)
Offers are the searchable products; searchable attributes are marked above. The seed ends with `waitForSearchIndex({ expectedKeys: <27 offer keys> })` (F). Measured lag goes into `PROJECT-FINDINGS.md`. Changing a product type later triggers a full reindex (about 15 minutes).

### Findings recorded by G (`PROJECT-FINDINGS.md`)
1. **Inventory mode (D-019)** by experiment (G-18): a throwaway US/USD cart with a service line (`MLV-ADD-SPOTIFY-MTH`, no InventoryEntry) and `inventoryMode` `None`, `TrackOnly`, `ReserveOnOrder`; result per mode (accepted or the error code). Rule: if `None` accepts the line and an order can be created from it, cart/order mode stays `None` (D-019 default); otherwise record the mode that works and tell the owner.
2. Predicate syntax (backticks) and the discount and shipping outcomes.
3. Custom field String size (4 KB value), `malva-cart` → `malva-order` handover, recurring-order auto-creation.
4. Search index lag, response shape of the image endpoint, scopes needed.

### Pitfalls
- A recurring line without a price for its policy is charged the one-time price silently; checks assert the pairings.
- Prices are embedded (not standalone) so Product Search can facet and sort on them; one embedded price per currency/country/policy scope per variant.
- Changing an attribute's type later is a conflict, not a delete-and-recreate (F). Add attributes instead.
- Slugs are unique per language across all products and categories; the sample categories had colliding slugs such as `furniture`, which is one more reason the cleanup runs first.
- `isSearchable: true` on set-of-text attributes is allowed but unnecessary; do not mark anchors, relations or JSON text as searchable.
- Do not put secrets, the demo password or customer data in the repository; demo emails use `example.com` / `example.de`.
- The offer's `start-time` is a **read-side** gate (X); seeded offers have none and are purchasable immediately.

### Planner defaults (owner may overrule)
1. Descriptive plan/add-on/equipment/device products carry one master variant (no term variants, no prices); terms and prices live on the offer (D-011 reading of the spec's "tier is one product, each term is a variant"). The scenario "Term changes the price" is tested on the offers.
2. All attributes are Variant-level; `color` is a lenum; `activation-fee` is a number of whole units (same in USD and EUR); `end-time`, `offer-family`, `intro-free-months`, `price-steps`, `addon-tag`, `label-plan-id`, `bundle-discount-text` and denormalised plan facts on offers are G additions.
3. Four device-financing recurrence policies besides `malva-monthly`.
4. Equipment included with plans (modem for cable, gateway for wireless) through `included-offers`; plan labels therefore keep "Equipment: $0".
5. Home-internet offers conflict with each other (same family included); phone offers do not.
6. The bundle discount applies to cable **and** wireless with a phone line (the design's label text), not only cable.
7. Add-on offers are in their leaf category **and** `malva-cat-add-ons`; equipment only in `malva-cat-equipment`.
8. Activation fee is a typed attribute, not a one-time price on the plan variants (a one-time price on a recurring variant would be the silent fallback price).
9. Serviceability table in Custom Objects plus a generated JSON copy for K.
10. Secure add-on priced $5; existing-customer cable offer $49.99; online-only phone $45.

## Tasks
- [x] G-01 Create `data/catalog-types.ts`, `data/shared/enums.ts`, `data/shared/attributes.ts` (one factory per shared attribute, German labels for all) and `checks/` helpers; create `data/catalog-validate.ts` (SKU pattern, `malva-` keys, locale completeness, shared-definition equality, price completeness, reference existence). [SKILL: commercetools-commerce-patterns] Tests `data/shared/attributes.test.ts`: shared names have identical definitions across all types, enum keys unique, every `lenum` label has both locales.
- [x] G-02 Create `data/product-types/internet-plan.ts` and `phone-plan.ts` exactly as in "Product types" 1 and 2. [SKILL: commercetools-commerce-patterns] Tests `data/product-types/product-types.test.ts` → "Internet plan described by typed attributes: …" (technology lenum, `downstream-mbps`/`upstream-mbps` number, `contract-term` lenum), and "Plan carries the facts the storefront shows: …" (all label and card attributes exist with the specified types, including `activation-fee`, `label-plan-id`, `price-lock-months`, `badge`).
- [x] G-03 Create `product-types/addon.ts`, `equipment.ts`, `device.ts`, `offer.ts`, `index.ts` as specified (offer attributes `offer-kind` and `offer-family` `savedToLineItem: true`). [SKILL: commercetools-commerce-patterns] Tests (same file): "Equipment declares what it can carry: …", "Add-on declares where it applies: …", "Sellable offer separate from the thing sold: …" (offer type has audience, channels, start-time, end-time, included/conflict/compatible sets), "Handset is one product with its options as variants: …" (device type variants only color and memory-gb, no acquisition attribute).
- [x] G-04 Create `data/custom-types/*.ts` (four types, field lists above, both locales). [SKILL: commercetools-platform] Tests `data/custom-types/custom-types.test.ts`: keys, `resourceTypeIds`, exact field names and types, enum keys of `acquisitionMode`, `malva-order` repeats every `malva-cart` field.
- [x] G-05 Create `data/categories.ts` (tree, slugs, hints, descriptions) and `data/recurrence-devices.ts`. [SKILL: commercetools-commerce-patterns] Tests `data/categories.test.ts`: 8 unique keys, parents exist, slugs unique per locale, both locales on name and slug, `malva-cat-devices` present with slug `phones-and-devices`; device policies are monthly schedules with the four keys.
- [x] G-06 Create `data/prices.ts` (price table, `eurFromUsd`, `monthlyPrices`, `oneTimePrices`, `financedPrices`, price keys). [SKILL: commercetools-commerce-patterns] Tests `data/prices.test.ts`: EUR rule examples (3999→4000, 4499→4500, 12999→13000), committed-term price lower than month-to-month for every plan, financed amounts for Nova 5G 128 GB (4158, 2079, 1386, 1996), price keys unique.
- [x] G-07 Create `products/plans-cable.ts`, `products/plans-wireless.ts`, `offers/plans-cable.ts`, `offers/plans-wireless.ts` with all facts from the tables (en-US and de-DE copy). [SKILL: commercetools-commerce-patterns] Tests `data/plans.test.ts`: values equal the design prototype data (name, price of the master variant, label id, typical speeds, activation fee 25 for cable and 0 for wireless).
- [x] G-08 Create `products/plans-phone.ts`, `offers/plans-phone.ts` (four plans, quantity-per-line semantics: `lines-included` 1). [SKILL: commercetools-commerce-patterns] Tests (same file): phone prices 25, 35, 50, 65 on the M2M master, ETF "None", hotspot values.
- [x] G-09 Create `products/addons.ts`, `offers/addons.ts` (eight add-ons, descriptions en/de). [SKILL: commercetools-commerce-patterns] Tests `data/addons.test.ts`: tag filters Music has 2, Video 3, Extras 3 add-ons; prices 10, 10, 11, 8, 8, 3, 12, 5; families as specified.
- [x] G-10 Create `products/equipment.ts`, `offers/equipment.ts` (RENT/BUY variants), `data/inventory.ts` for equipment. [SKILL: commercetools-commerce-patterns] Tests `data/equipment.test.ts`: speeds and technologies as specified, 5G gateway has only RENT, nine equipment inventory entries with quantity 500.
- [x] G-11 Create `products/devices.ts`, `offers/devices.ts` (color × memory, outright + four financed price sets per variant), extend `data/inventory.ts` (ten handset entries, one at 0). [SKILL: commercetools-commerce-patterns] Tests `data/devices.test.ts`: Nova 5G 4 variants, Nova Pro 6, variants differ only by color and memory, every variant has outright and four recurring prices per currency, VLT-512 stock 0.
- [x] G-12 Create `offers/special.ts` (existing-customer cable offer, online-only phone offer), `data/relations.ts` (conflicts, included offers, exceptions), `offers/index.ts`, `products/index.ts`, `data/index.ts` (`MANIFEST`). [SKILL: commercetools-commerce-patterns] Tests `data/relations.test.ts`: conflict symmetry, every referenced key exists, `included-addons` consistent with `included-offers`, denormalised copies equal the anchor, exceptions present.
- [x] G-13 Create `data/cart-discounts.ts`, `data/discount-codes.ts`. [SKILL: commercetools-commerce-patterns] Tests `data/discounts.test.ts`: sort orders unique, year-1 percentages equal the first `price-steps` entry, predicates only use attributes defined with `savedToLineItem: true` (via F's validator), pattern target shape for the second-line discount.
- [x] G-14 Create `data/serviceability.ts`, `reconcilers/customObject.ts` (register in F's `registry.ts`), `scripts/seed/export-serviceability.ts` writing `site/lib/offers/serviceability-table.json`. [SKILL: commercetools-platform] Tests `data/serviceability.test.ts`: rows, absent code not served, JSON export equals the data.
- [x] G-15 Create `images.ts`, `update-images.ts`, `data/image-terms.ts`, empty `data/product-images.json` (`{}`), `lib/config/images.ts`, append image hosts to `next.config.ts` and `footer.photoCredit` to both messages files; wire the lock file into the product and category reconcilers (images and assets). [SKILL: commercetools-platform] Tests `scripts/seed/images.test.ts` and `lib/config/images.test.ts` (scenario rows below), plus `next.config.test.ts` addition: both hosts present.
- [x] G-16 Create `checks/catalog.ts`, register it, write the case-table suite `data/catalog.cases.test.ts` (one test per `seed-catalog-data` scenario and the remaining `telecom-catalog-model` ones; loads `MANIFEST` and asserts) and `data/catalog.model.test.ts`. [SKILL: commercetools-commerce-patterns] Tests: see the scenario table; `npm run seed -- --plan` against the fake prints only creates.
- [x] G-17 **Live (needs OA-03, F-15 done):** `npm run seed -- --plan`, then `npm run seed -- --confirm-project spec-test-b2c-telecom` (without `--with-demo`), then `npm run seed:verify`; record the product-type creation results and the **search index lag** (minutes) in `PROJECT-FINDINGS.md`. [SKILL: commercetools-platform]
- [x] G-18 Create `scripts/seed/experiments/platform-checks.ts` (`npm run seed:experiments -- --confirm-project spec-test-b2c-telecom`) and run it live: (1) inventory mode per D-019, (2) discount and shipping predicate smoke tests (second line, bundle, intro month, tier, welcome code; `matching-cart` for an add-on-only cart and a mixed cart; backtick escape), (3) 4 KB value in `malva-order.labelSnapshot`, (4) `malva-cart` → `malva-order` handover and whether `OrderFromCartDraft.custom` is needed, (5) recurring-order auto-creation after order creation. Every throwaway cart/order is deleted afterwards (marker `demoMarker` as fallback); write results to `PROJECT-FINDINGS.md`; if any result contradicts this file, stop and ask (Q-nnn). [SKILL: commercetools-commerce-patterns]
- [x] G-19 Create `reconcilers/demoCustomer.ts`, `reconcilers/demoOrder.ts`, `data/demo/customers.ts`, `data/demo/orders.ts` (shape per the experiment results; fallback `POST /recurring-orders` if G-18 shows no auto-creation), register them. [SKILL: commercetools-commerce-patterns] Tests `data/demo/demo.test.ts` with the fake: customers created with group and marker, orders unchanged on second run, parent link set on the add-on line, missing `SEED_DEMO_PASSWORD` exits 3.
- [x] G-20 **Live:** `npm run seed -- --confirm-project spec-test-b2c-telecom --with-demo`, `npm run seed:images` (writes the lock; during this run Claude inspects the hosts returned by the public Pexels search endpoint and the credit info, and records the host list and any licence concern in `PROJECT-FINDINGS.md` under "G: image hosts"; a host that is not Pexels/Getty-hosted is flagged in `QUESTIONS.md`; no owner action, D-066), `npm run seed -- --confirm-project spec-test-b2c-telecom` again (attaches images; second pass changes only images), `npm run seed:verify`; run `npm run verify`; fill the Chrome check results prerequisites. [SKILL: commercetools-platform]

## Unit tests (scenario → test)
Paths are relative to `site/scripts/seed/` unless they start with `scripts/` or `lib/` (relative to `site/`).
| Scenario (exact title from the spec) | Capability | Test (file → `it(...)` name) |
| --- | --- | --- |
| Internet plan described by typed attributes | `telecom-catalog-model` | `data/product-types/product-types.test.ts` → "Internet plan described by typed attributes: technology, speeds and term are typed and numeric" |
| Equipment declares what it can carry | `telecom-catalog-model` | `data/product-types/product-types.test.ts` → "Equipment declares what it can carry: max speed and technologies are attributes" |
| Add-on declares where it applies | `telecom-catalog-model` | `data/product-types/product-types.test.ts` → "Add-on declares where it applies: families and charge type are attributes" |
| Card is one product, selectors are variants | `telecom-catalog-model` | `data/catalog.model.test.ts` → "Card is one product, selectors are variants: each plan offer is one product with one variant per term" |
| Keys and SKUs are predictable | `telecom-catalog-model` | `data/catalog.model.test.ts` → "Keys and SKUs are predictable: malva- keys, MLV- SKUs, no generated ids" |
| Sellable offer separate from the thing sold | `telecom-catalog-model` | `data/product-types/product-types.test.ts` → "Sellable offer separate from the thing sold: audience, channel, start time and relations live on the offer" |
| Handset is one product with its options as variants | `telecom-catalog-model` | `data/devices.test.ts` → "Handset is one product with its options as variants: color and memory only" |
| Plan carries the facts the storefront shows | `telecom-catalog-model` | `data/product-types/product-types.test.ts` → "Plan carries the facts the storefront shows: every card and label fact is a typed attribute" |
| Design filters derive from attributes | `telecom-catalog-model` | `data/catalog.model.test.ts` → "Design filters derive from attributes: chips computed from data-gb, network-generation and downstream-mbps each match a plan" |
| Editable in the Merchant Center | `telecom-catalog-model` | `data/catalog.model.test.ts` → "Editable in the Merchant Center: a changed router speed is a plain attribute update" |
| Every category has offers | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Every category has offers: each leaf and top-level category lists at least two" |
| Router unable to carry the top tier | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Router unable to carry the top tier: AC1200 max speed is below Cable Gig downstream" |
| Add-on that applies to one family only | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Add-on that applies to one family only: one internet-only and one phone-only add-on" |
| Extra included at no charge | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Extra included at no charge: Cable Gig includes Apple TV+ which is also sold" |
| Two home internet services that cannot coexist | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Two home internet services that cannot coexist: cable and wireless offers name each other" |
| Term changes the price | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Term changes the price: committed terms are cheaper per month than month-to-month" |
| Prices exist for the seeded market | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Prices exist for the seeded market: USD/US and EUR/DE on every variant, none zero" |
| Offers wrap what is sold | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Offers wrap what is sold: every sellable item has an offer, one existing-customer, one channel offer, all keys resolve" |
| Handsets seeded | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Handsets seeded: two handsets with several color and memory variants in the devices category" |
| Design prototype fully demonstrable | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Design prototype fully demonstrable: names, prices, tags and every filter chip match the prototype data" |
| Broadband Facts label data present | `seed-catalog-data` | `data/catalog.cases.test.ts` → "Broadband Facts label data present: label inputs complete on every plan, cable fee 25, others 0" |
| First seed selects and records | `seed-product-images-pexels` | `scripts/seed/images.test.ts` → "First seed selects and records: one lookup per entry, first results in order, recorded in the lock file" |
| Re-seed uses the lock file | `seed-product-images-pexels` | `scripts/seed/images.test.ts` → "Re-seed uses the lock file: no network call and identical images" |
| Photo replaced deliberately | `seed-product-images-pexels` | `scripts/seed/images.test.ts` → "Photo replaced deliberately: changing the term or removing the entry re-selects only that entry" |
| Rate limit approached | `seed-product-images-pexels` | `scripts/seed/images.test.ts` → "Rate limit approached: stops looking up, completes with the lock, reports entries without images, no retry loop" |
| No key and no lock entry | `seed-product-images-pexels` | `scripts/seed/images.test.ts` → "No key and no lock entry: the product is seeded without an image and listed as missing" |
| Credit shown to the buyer | `seed-product-images-pexels` | `lib/config/images.test.ts` → "Credit shown to the buyer: image labels name the photographer or Pexels and footer.photoCredit exists in both locales" |
| Image URL not trusted blindly | `seed-product-images-pexels` | `lib/config/images.test.ts` → "Image URL not trusted blindly: only allow-listed https hosts pass, seeder and next.config agree" |
The "Credit shown to the buyer" scenario also requires the footer link; that render test belongs to workstream I (`SiteFooter` → link to `PEXELS_URL`), G supplies the constant and message key.

## Chrome verification (run by Claude)
No page exists yet; checks use the commerce MCP read tools (REST equivalents shown) and one browser navigation for images.
- C-G-1 (needs OA-03, F): MCP `read_product_types` → exactly the six keys `malva-internet-plan`, `malva-phone-plan`, `malva-addon`, `malva-equipment`, `malva-device`, `malva-offer`; `malva-offer` has `offer-kind` and `offer-family` with `savedToLineItem: true`; `read_types` → four custom types with the specified fields.
- C-G-2 (needs OA-03, F): MCP `read_categories` → eight `malva-cat-*` categories, parent links as in the tree, slugs `phones-and-devices`, `cable-internet`, `home-wireless-internet`, `phone-plans`, `add-ons` and the three children in `en-US`, German slugs in `de-DE`.
- C-G-3 (needs OA-03, F): MCP `read_product_projections` with `where=productType(id="<malva-offer id>")&staged=false` (page by 10) → 27 offers, all published; `malva-offer-cable-500` master variant SKU `MLV-CBL-500-24M` has prices `5999 USD US recurrencePolicy malva-monthly` and `6000 EUR DE recurrencePolicy malva-monthly`; `malva-offer-router-ax3000` BUY variant has a one-time `12999` USD price without recurrence policy.
- C-G-4 (needs OA-03, F): MCP `read_products` total is 52; no product references a deleted furniture type; `read_inventory` total is 19, SKU `MLV-DEV-NOVAPRO-VLT-512` has `quantityOnStock: 0`; no inventory for any plan or add-on SKU.
- C-G-5 (needs OA-03, F): MCP `read_cart_discounts` → six `malva-cd-*` discounts with the rank order 0.1 to 0.6; `read_discount_codes` → `WELCOME10`; the furniture discount and `BOGO` are gone; `read_recurrence_policies` → `malva-monthly` and the four device policies.
- C-G-6 (needs OA-03, F): MCP `read_customers` → five `malva-demo-*` customers with the right groups and `demoMarker`; `read_orders` → `MLV-DEMO-0001` to `-0003` with `custom.fields.serviceStartDate`; `read_recurring_orders` → recurring orders linked to those orders (or the recorded fallback).
- C-G-7 (needs OA-03, F): MCP `read_custom_objects` container `malva-serviceability` → 11 objects; key `59001` has phone true only.
- C-G-8 (needs OA-03, F): MCP `read_product_search` with `{ "query": { "exact": { "field": "key", "value": "malva-offer-cable-500" } } }` → `total: 1`; a second query with the 27 keys joined by `or` → `total: 27`; `read_project` → `searchIndexing.products.status: Activated`.
- C-G-9 (needs OA-03, F): `cd site && npm run seed:verify` → `All checks passed.`; `npm run seed -- --plan` → only `unchanged`; `npm run seed:images -- --dry-run` → prints nothing to look up when the lock is complete.
- C-G-10 (needs OA-03, F): Chrome navigate to the first `url` of any entry in `site/scripts/seed/data/product-images.json` (copy it from the file) → the photograph renders (HTTP 200, `Content-Type: image/*`), console shows no error; resize window to 375 px → still renders; record the host of that URL in the log.
- C-G-11 (needs OA-03, F): open `PROJECT-FINDINGS.md` in the repo → sections for inventory mode, predicate smoke tests, custom field size, cart-to-order handover, recurring-order auto-creation, search index lag and image endpoint response shape are filled, with no secret values.
- C-G-12 (needs OA-03, F): run `npm run seed:images -- --dry-run`, list the distinct image hosts and the credit fields → expected: findings recorded in `PROJECT-FINDINGS.md` under "G: image hosts"; if a host is not a Pexels/Getty-hosted image Claude flags it in `QUESTIONS.md` (D-066, no owner action).

## Manual tests (owner only)
- M-G-1 (needs OA-03): owner opens Merchant Center → Products and opens five offers across the categories → the images are acceptable for a demo (subjective visual sign-off); if not, the owner names the entries and G edits `image-terms.ts` and re-runs `seed:images`.

## Excluded
- Spec text that Pexels API keys and the `images.pexels.com` host are used: D-055 replaces the API key with the public search endpoint and widens the host allow-list (scenario titles above are still implemented and tested, adapted: the "key" in "No key and no lock entry" becomes "no lookup possible").
- Store `malva-us`, product selection `malva-all-offers` (D-058).
- B2B items (per-company prices, call-center price below web price, channel-scoped price): D-005.
- Agent-mode data for `agent-redemption-quota`: deferred, D-022.

## Definition of done
- [ ] All tasks ticked, `npm run verify` passes.
- [ ] Every scenario row above has a passing test.
- [ ] C- and M- lines present; STATUS set to `Ready for review`.
- [ ] `npm run seed:verify` green on `spec-test-b2c-telecom` with the catalog, demo data and images; Gate 1 satisfied (seeded catalog visible through the commerce MCP, furniture data removed).
- [ ] `PROJECT-FINDINGS.md` contains the inventory-mode finding (D-019), predicate syntax result, search index lag and the image endpoint shape; the owner has seen the new scope requirements (`manage_key_value_documents`, `view_key_value_documents`).
