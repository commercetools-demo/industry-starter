# AT&T demo project as a telecom data-model reference

Read through the `at_t` MCP server (read-only tools) on 2026-10-07. Project `att-poc-61` ("ATT POC"): US / USD / en, created 2018, last modified 2026-06. Search indexing is deactivated, no stores, one tax category, one shipping method. It is a reference for *shape*; do not copy ids, content or the project's age-related quirks.

## Inventory

| Resource | Count | Notes |
| --- | --- | --- |
| Product types | 8 | `service-base`, `service-add-on`, `offer`, `equipment-addon`, `device`, `wirelessplantype`, `mobilephone`, `SeatOpt` |
| Categories | 9 | Subscription, DVR, Hardware, Concurrent Streams, DTV Now (+ Base offerings, Add-ons), Wireless (+ Device). Mostly empty: products are rarely categorized (only devices and equipment) |
| Products | 65 | offer 17, service-add-on 19, service-base 13, equipment-addon 4, mobilephone 4, device 1, wirelessplantype 1, SeatOpt 1, plus others |
| Cart discounts | 15 | Free trials, tiered first/second/third-year percentages, bundle and geo-scoped offers, prepayment gifts |
| Custom types | 4 | `custom-cart` (Order), `custom-line-item`, `custom-price` (product-price), `custom-cart-discount` |
| Channels | 6 | `retail`, `online`, `kiosk`, `call-center` (ProductDistribution + InventorySupply), two warehouse channels |
| Customer groups | 4 | one meaningful: `existingCust` ("Premium Customer") |
| Tax / shipping | 1 / 1 | `standard` (US 0%, NC 0%, included in price), `ups-ground` |

## Product types

**`service-base`** (13 products): the thing the customer subscribes to. Attributes: `serviceType` (lenum internet / streaming / mobile, searchable), `uniqueInCart` (boolean), `requiredAddonTypes` (set of lenum: installation, equipment, streaming-amount, streaming-channel, protection-plan), `requiredProducts` (set of product references), display/marketing text (`displayName`, `longDescription`, `shortDescriptionforServices`, `numberOfChannels`, `congratsMessage`), `warranty_required`. Example: `internet-tier-1…4-residential` each require installation + equipment; the streaming packages (Go Big, Gotta Have It, Just Right) require a streaming-amount add-on.

**`service-add-on`** (19): `addonType` (required lenum: installation, equipment, streaming-amount, streaming-channel, other, protection-plan), `serviceType`, `requiredProducts`, `negatedProducts` (products removed from the cart when this one is added), display text, disclosure messages per sales channel (`myATTDisclosureMsg`, `OPUSDisclosureMsg`). Examples: `internet-installation-diy`, `internet-installation-technician`, HBO / Cinemax / Showtime / cloud DVR / extra streams.

**`offer`** (17): the sellable commercial wrapper around one or more service products. `offerType` (basePackage / addon / equipment / bundle, required), `products` (anchor service products), `includedOffers`, `compatibleAddons`, `compatibleEquipment`, `conflictingOffers`, `dependentOffers`, `eligibility` (set of text: state codes and ZIPs such as `NC`, `97201`), `custType` (consumer / smallBusiness / employee), `existingCust` (boolean), `channels` (references to channels), `startTime` (datetime). The offer carries the price; the service product carries the description.

**`equipment-addon`** (4): only `equipmentSKU` (text) mapping to an external hardware SKU: Apple TV, AT&T TV, Roku stick, Wi-Fi gateway. No speed or technology attributes, so equipment/plan compatibility is by explicit `compatibleEquipment` lists, not computed.

**`device` / `mobilephone`** (1 / 4): handsets. `mobilephone` variants combine `Color` (text), `Memory` (enum 256 / 512 GB), `PaymentPeriod` (enum One-off / 12 / 24 / 36 months) and `ServicePlan` (text), with `basePriceForDisplay` (money). Example: Samsung Galaxy S23+ has 6 variants (3 plans × outright/12 months). A channel-scoped price (call center) undercuts the web price on one variant. `device.lob` references a category; `compatibleRatePlans` is free text. Other products: a Polycom desk phone and a Hosted PBX calling plan with 1-, 3- and 5-year variants.

**`wirelessplantype`** (1): `DataTotal` (GB), `Province`, `requiresMSISDN`. Unlimited plan, 3 variants, $24.90.

**`SeatOpt`** (1): B2B seat licences with `MinPurch` and `PurchBlock` (minimum quantity and block size).

## Custom types

- `custom-price` on prices: `chargeType` (ongoing / onetime), `additionalChargeType`, `additionalChargeAmount`: lets one price carry a monthly amount and a one-time fee.
- `custom-cart-discount`: `prepaymentType` (absolute / numOfBillingCycles), `prepaymentAmount`, `daysUntilValid`, `daysUntilExpired` (offsets from *service start*, not the calendar), `discountType` (ongoing / onetime), `displayForServices`, `isFutureFree`. These drive the storefront's promo messaging and phased discounts.
- `custom-cart` (on Order): `dueNow`, `onGoingRate`, `custType`, `existCust`, `eligibility`, `flags`, `additionalInformation`: the cart summary a billing system needs.
- `custom-line-item`: `parentLineItemId` (add-on belongs to a plan line), `externalId`.

## Discount patterns worth reusing

| Pattern | AT&T example | Malva mapping |
| --- | --- | --- |
| Free trial from service start | "7 Days Free" on base packages and add-ons (`absolute` $0, `daysUntilExpired: 7`) | `introductory-period-price` |
| Stepped term price | 40% / 30% / 20% off years 1-3 (`daysUntilValid` 0 / 365 / 730) | `term-phased-price-schedule` |
| Bundle discount | "Bundle Tier 1 Internet & Just Right: $15 off Internet" (`lineItemExists(...)` for both products) | cable + phone bundle ($5 off) in design label text |
| Add-on discounted when base present | "$ off HBO when Gotta Have It in cart" with `lineItemExists` | `offer-compatible-addons`, `discount-activating-offer-prompt` |
| Audience-gated | `attributes.existingCust = true`, `StopAfterThisDiscount` so existing-customer deals do not stack | `eligibility-gated-offer` |
| Geo-gated | `attributes.eligibility contains any ("NC","97201")` | `eligibility-gated-offer` (serviceability is not a catalog fact) |
| Free gift on prepayment | "Free Roku with 2 months prepayment" (100% off, `numOfBillingCycles: 2`) | optional |
| Conditional free shipping | inactive "free shipping over $200" | out of scope |

Note: these predicates match on `attributes.*` of the line item (hence `savedToLineItem: true` on every attribute) and on hard-coded product ids. Malva should predicate on keys/attributes, never ids.

## Compatibility rules the AT&T data expresses

- Plan → add-on: explicit `compatibleAddons`; plan → equipment: explicit `compatibleEquipment`; `conflictingOffers` (one-sided in the data: Gotta Have It lists Go Big, Go Big lists nothing, which is the defect `mutually-exclusive-offers` warns about); `includedOffers` for bundled extras; `requiredAddonTypes` as checkout blockers; `negatedProducts` for auto-removal.
- Several AT&T products have no price or tax category (`hbo-free`): free items are modelled as products with no price. Malva's seed requires a price on every variant ($0 where deliberately free).

## Data-model gaps in the AT&T project relative to Malva's needs

| Need | AT&T | Malva |
| --- | --- | --- |
| Speed / technology / latency attributes for compatibility and the Broadband Facts label | none | typed attributes (`telecom-catalog-model`) |
| Computed equipment compatibility | explicit lists only | computed from `max-downstream-mbps` and `supported-technologies` |
| Contract term as a variant with its own price | only on Hosted PBX (MTM / 3 / 5 yr) | variant per term |
| Prices in a market | USD, no country scoping, no stores | single `en-US` / `USD` market |
| Categorization | products mostly uncategorized | every product in the tree |
| Keys | missing on several products; many numeric ids as keys | `malva-` prefixed keys, predictable SKUs |

## What was taken into the specs

- `telecom-catalog-model`: reference-model section (adopted / adapted / not copied), label and filter attributes, plus the decided `malva-offer` layer and `malva-device` handset type.
- `seed-catalog-data`: design-aligned plan and add-on set; label data scenario.
- Existing specs already align with the patterns above (`mutually-exclusive-offers`, `introductory-period-price`, `term-phased-price-schedule`, `eligibility-gated-offer`, `device-acquisition-mode`, `offer-compatible-addons`); the AT&T data is a source of seed ideas for those cases.

## Useful MCP reads for later seeding work

`read_product_types`, `read_types`, `read_cart_discounts`, `read_channels`, `read_customer_groups`, `read_product_projections` (large: the products dump with variants is ~400 KB for 60 products; page by 5-10 or filter by `productType(id=…)`). Orders, customers and carts were not read.
