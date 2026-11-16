<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream V: Preset bundles (a machine plus pods at a bundle discount)

Read these first, in this order: `plans/JUNIOR-GUIDE.md`, then `storefront/AGENTS.md` (sections "Product detail", "Cart", "Checkout and confirmation", "Orders and the account area"), then this whole file **before** writing any code.

Load these skills before the tasks that name them: `commercetools-commerce-patterns` (its `references/bundle-modeling.md` is the pattern this plan follows), `commercetools-storefront` and `commercetools-platform`. Do not guess update actions or endpoints; check them in the skill or with the commercetools Knowledge MCP.

> **Why the letter V?** Workstream T2 already uses task IDs `U-00` to `U-13`. To keep IDs unique this workstream is `V`.

> **Owner answers of 2026-11-16 override the text below** (Q-V-1 to Q-V-16 in `plans/QUESTIONS.md`; decisions D-056 to D-059):
> - Bundles can be **collected** in a US store, with every part at that store. They cannot be **subscribed** to. Canada is delivery only (D-056). This replaces "delivery only" everywhere below.
> - The shopper picks a **variant of the machine** in the preset; the pods use their master variant. The machine child and the price follow that variant (D-059, field `bundleMachineSku`).
> - Bundles are **returnable like other orders** (Q-V-7). The return dialog offers the bundle as one row and returns every part at the same quantity.
> - The price is **locked** when the bundle is added. `repricePresetBundles` (D7) is parked in `plans/IDEAS.md`. The existing `ExternalPrice` skip in `detectPriceChanges` stays, because without it every load reports a price change (Q-V-9).
> - The **owner sets up `fast-forward`** in Merchant Center (OA-V-d). Seed step `preset-bundles` (V-04, D10) is **withdrawn** (Q-V-12, D-057). V-03 (the category) stays.
> - Q-V-17 to Q-V-21 are readings the build depends on. Q-V-17 (can the bundle parent carry a store channel?) is decided by probe V-01 (6).

## 1. Header

| Field | Value |
| --- | --- |
| ID | V |
| Name | Preset bundles: a "Bundles" category, a product page where the shopper picks one preset (machine plus pods) with a radio button, and a bag line that carries the preset discount |
| Depends on | C (seed catalogue), F (header nav), G (listing, cart core), H (product page), I (cart), K (checkout clone), L (orders, reorder). All are `Ready for review` or better |
| Wave | 15 (after T2; a catalogue feature, not part of the release gate of Q) |
| Specs implemented | none new. This workstream reuses the behaviour of `design-product-detail-page`, `design-cart-page` and `design-product-listing-page`; the acceptance list in section 5 is the contract |
| Owner prerequisites | OA-V-a: a new API client that can read custom objects (`view_key_value_documents`). Until it exists, work against the mock server (V-05). OA-V-b: the new client's values in Netlify |
| Skills | `commercetools-commerce-patterns` (bundle modelling), `commercetools-storefront` (cart, PDP), `commercetools-platform` (custom objects, custom types, product updates) |
| Estimated effort | 7 to 10 days for a junior, one task per commit |
| Branch | `ws/v-preset-bundles` |
| Commit format | `ws-v: V-nn <summary>` |

## 2. Goal and scope

**Goal.** The owner built a bundle product in Merchant Center. A shopper opens it from a new **Bundles** category and sees one radio card per **preset**: the machine's image, the names of every product in the preset, the bundle price and what they save. They pick one preset and add it to the bag. In the bag the bundle is **one row**. Its price is the sum of the parts minus the preset's discount (a percentage). The machine and the pods are listed under it.

### What exists in the project today (read it, do not recreate it)

All of this was read from project `spec-test-b2c-food` on 2026-11-16. The two custom objects are also in `bundles.har` at the repository root.

| Thing | Value |
| --- | --- |
| Bundle product | id `0e44e6d5-2936-419b-9ad9-802b1d79d9d5`, key `fast-forward`, name `Fast forward` (en-US only), slug `fast-forward`, master SKU `998674532`, one variant. Today it has **no price, no image, no category and no tax category** |
| Product type | key `malva-coffee-machine-bundle` (id `f892b74e-…`), one attribute `bundle-ref`: a `reference` to `key-value-document` (a custom object), `SameForAll`, `savedToLineItem: true` |
| `bundle-ref` value on the bundle | custom object id `9790d294-a6c3-4a54-9391-841b1a7ab85a` |
| Bundle custom object | container `configurable-bundles_items`, key `bundle--1794844737333`. `value.mainProductReference.id` is the bundle product. `value.bundleType.value` is `schema--1794837340439`. `value.bundleConfiguration.presets[]` has two presets (below) |
| Schema custom object | container `configurable-bundles_schemas`, key `schema--1794837340439`, name `Promo bundle machine+pods`. It says a preset has `name` (LocalizedString), `coffeeMachine` (product reference), `pods` (set of product references) and `presetDiscount` (Number) |
| Line item custom type | `mcf-line-fulfilment` already has `fulfilment`, `brand` **and `parentId` (String)**. The owner added `parentId` in Merchant Center; the seed does not know it yet |
| Categories | No "Bundles" category exists |

The two presets:

| # | Name (en-US; en-CA is `""`) | Machine | Pods | `presetDiscount` |
| --- | --- | --- | --- | --- |
| 0 | Vertuo bundle | Vertuo Studio (`mcf-p-vertuo-studio`, master SKU `MCF-MAC-VERTUO-BLA-M`, $159.00) | Pod One Starter Gift (`MCF-GFT-STARTER`, $179.00), Pod Discovery Gift Set (`MCF-GFT-DISCOVERY`, $49.95) | 0.1 |
| 1 | Pod plus | Pod Plus Milk (`mcf-p-pod-plus-milk`, master SKU `MCF-MAC-PODPLUS-WHI-M`, $219.00) | Pod Discovery Gift Set ($49.95), Pod One Starter Gift ($179.00), Pod carousel holder (`MCF-ACC-CAROUSEL-BLA`, $24.95) | 0.12 |

The "pods" are products of any type (gift sets, an accessory). Treat them as "included products", not as capsules.

### In scope

1. Seed: the "Bundles" category, the new line fields, and the owner's bundle product made sellable (category, tax category, selection, image, a "from" price).
2. Server: read the bundle configuration, price each preset for the shopper's market, add a bundle to the bag, and keep the bundle's lines together.
3. Product page: a dedicated bundle layout with radio cards.
4. Bag (drawer and page), checkout clone, order views (confirmation and account), reorder and region switch.
5. Header nav entry "Bundles" (Malva Coffee only).

### Out of scope (park in `plans/IDEAS.md`)

- Subscriptions for bundles (D-056: a bundle cannot be subscribed to).
- Variants of the pods (the master variant is used; D-059).
- The shopping assistant and the in-store companion adding bundles. They get a clear refusal (V-09) and nothing more.
- Editing bundles: the owner does that in Merchant Center.

## 3. Design

### D1. Do not copy the code in the `/bundles` skill

`.claude/skills/bundles/SKILL.md` explains the idea, but its code is for a different app. Use this table to translate it:

| The skill says | In this repo |
| --- | --- |
| Paths under `site/` | Paths under `storefront/` |
| `productProjections().search()` to resolve a SKU | **Forbidden** (AGENTS.md). Use `getProductBySku` (Product Search) or `productProjections().get({ where })` for known ids |
| A second line type `line-item-additional-info` with `parentKey` | **Impossible**: a line has one custom type. Reuse `mcf-line-fulfilment`; the field is `parentId` (D3) |
| `uuid` dependency | Not needed. Use `crypto.randomUUID()` (Node 22) |
| `fetch('/api/cart/items')` in a component | Forbidden. Component → hook in `hooks/` → Route Handler → `lib/ct` |
| Bundle = a product attribute `bundled-products` (set of references) | Here the attribute `bundle-ref` points to a **custom object** that holds several **presets** |
| No discount | Each preset has `presetDiscount` (D2) |
| `cartVersion` parameters, raw `apiRoot.carts()...post` | Use `mutateCart` / `updateWithRetry` in `lib/ct/cart.ts` (ownership check, one retry on 409) |
| Child line price from the catalogue | Child lines are $0 with `externalPrice`; the parent carries the price (D2) |

### D2. Pricing (decision, Q-V-1)

This follows `commercetools-commerce-patterns` → `references/bundle-modeling.md` ("Ensure a fixed bundle price: set the price of the child lineItems to $0 using externalPrice").

- **Parent line** = the bundle product (`998674532`). Its unit price is `externalPrice = round(wasCents × (1 − presetDiscount))`.
- **Child lines** = the machine and each pod, quantity equal to the parent's quantity, `externalPrice = 0`. They exist so that stock, fulfilment and order export see the real SKUs.
- `wasCents` = the sum of each component's **effective** unit price in the shopper's market: the product-discounted price (`price.discounted.value`) when there is one, else `price.value`. Use the chosen variant of the machine (D-059; the master variant when none is chosen) and the master variant of each pod.
- Money is integer minor units. Round **once**, with `Math.round`, after multiplying the sum. Never round per component.
- `presetDiscount` is a **fraction**: `0.1` means 10 %. A value that is not a finite number, or is `< 0` or `>= 1`, makes the preset invalid. An invalid preset is not shown, and the event is logged once with the preset's index only (Q-V-2).
- A preset is **unavailable** in a market when any component has no price in that market's currency and country, or when any component's stock is below the quantity in the bundle's channel (online for delivery; the store's stock for collect, D3). An unavailable preset is shown disabled with its reason. A preset whose components cannot be read (a deleted product) is not shown.
- The server always recomputes the price. The browser sends only `{ sku, preset, quantity }` and never a price.

Worked example in the US (use it as a unit test):

| Preset | wasCents | × (1 − d) | Unit price | Saves |
| --- | --- | --- | --- | --- |
| Vertuo bundle | 15900 + 17900 + 4995 = 38795 | × 0.9 = 34915.5 | **34916** ($349.16) | 3879 ($38.79) |
| Pod plus | 21900 + 4995 + 17900 + 2495 = 47290 | × 0.88 = 41615.2 | **41615** ($416.15) | 5675 ($56.75) |

Platform facts this depends on (prove them in V-01):
- Product Discounts do not apply to externally priced lines. That is fine, because the effective price is already used in `wasCents`.
- Setting `externalPrice` needs the `manage_orders` scope. The storefront client already has it.

### D3. How the lines are linked (decision, Q-V-14)

- The parent line gets a line-item **`key`**: `bundle-<crypto.randomUUID()>`.
- Each child line has the custom field **`parentId` = the parent's `key`** (not the parent's line id). Line ids change when checkout clones the bag into a new cart (K's `preparePayments`), and the order is placed from the clone. A key survives because the clone copies it (V-15). The field name is the owner's; it holds a key. Record this in D-058.
- New fields on `mcf-line-fulfilment` (seeded in V-02, all optional):

| Field | Type | On | Meaning |
| --- | --- | --- | --- |
| `parentId` | String | child | The parent line's `key` (already in the project) |
| `bundlePreset` | String | parent | The preset's position in `presets[]`, as text: `"0"`, `"1"` (Q-V-3) |
| `bundleDiscount` | Number | parent | The `presetDiscount` used, for example `0.1` |
| `bundleWasCents` | Number | parent | `wasCents` per unit, for the struck-through price |
| `bundleMachineSku` | String | parent | The SKU of the machine variant the shopper chose (D-059). Dedupe and reorder use it |

- Every bundle line (parent and children) also has `brand = malva-coffee` as usual, and the same `fulfilment` on all of them: `delivery`, or `collect` with the same store `supplyChannel` on every line (US only, D-056). A child line therefore never merges with a shopper's own line of the same SKU, because their custom fields differ.
- Helpers (pure, in `lib/mappers/bundle-lines.ts`): `isBundleParent(l)`, which is true when `l.key` starts with `bundle-`; `isBundleChild(l)`, which is true when `parentId` is set; `isBundleLine(l)` (either); `childrenOf(lines, parent)`; `bundlePresetOf(l)`. **Every other file uses these helpers.** Never test the fields by hand.

### D4. Naming: "preset bundle", never just "bundle"

Machines already have a `bundle` variant attribute (`machine-only`, `starter-capsules`), a `bundle` selector and `bundleOffered()` in `lib/product/compatibility.ts`. To avoid confusion:
- the new product shape is `'presetBundle'` (append to `ProductShape` in `lib/types.ts`; map the type key `malva-coffee-machine-bundle` to it in `PRODUCT_TYPE_SHAPE`);
- the code folders are `lib/preset-bundle/` and `components/preset-bundle/`;
- the message namespace is `presetBundle`.

Do not touch the machine `bundle` selector.

### D5. Server: the BFF chain (six-file rule for the new resource)

The custom object is a new commercetools resource, so it gets the six files from AGENTS.md:

1. `lib/ct/preset-bundles.ts` (server-only)
   - `getBundleConfig(customObjectId)`. Validate the id with a UUID regex **before** putting it in a predicate. Then `apiRoot.customObjects().get({ queryArgs: { where: \`id="${id}"\`, limit: 1 } })`. The config is public, so wrap the read in `cachedPublic('presetBundleConfig', ['preset-bundle-config'], fetchBundleConfig)`. The id is passed when the cached function is called, as `getRecurrencePolicies(locale)` does; key parts are fixed strings. `kind` must be a key of `TTL` in `lib/cache-keys.ts`, so add `presetBundleConfig: 60` there.
   - `getBundleView(projection, market)`. Read `bundle-ref` from the master variant (`{ typeId: 'key-value-document', id }`) and then the config. Read all component projections in **one** call: `productProjections().get({ queryArgs: { where: 'id in (…)', priceCurrency, priceCountry, localeProjection: [locale], expand: [discount expansions as in getProductBySku], limit: 50 } })`. This read is **not cached**, because prices depend on the market. Read stock with `getInventoryDetail(skus)`. Finish with the pure `mapBundleView`.
2. `lib/mappers/preset-bundle.ts` (pure). It holds a zod schema of the custom object `value` (zod is already a dependency). `parseBundleConfig(value)` returns `BundleConfig | null` (null when the schema does not match; log `preset_bundle_config_invalid` with no values). `mapBundleView(config, components, inventory, ctx)` returns `BundleView`. Localized names use `getLocalizedString` but treat `""` as missing and fall back to `en-US` (the preset names have `"en-CA": ""`).
3. Types in `lib/types.ts` (append only): `BundleComponentView { productId, sku, name, slug, imageUrl?, imageAlt, role: 'machine' | 'item', unitPrice: Money | null, inStock: boolean }`, `BundlePresetView { index, name, discountPercent, components, was: Money | null, price: Money | null, save: Money | null, available: boolean, unavailableReason?: 'no-price' | 'out-of-stock' }`, `BundleView { productId, sku, presets }`. Append `bundle?: BundleView | null` to `ProductPageData`.
4. Route `app/api/preset-bundles/[sku]/route.ts` (`GET`, uses `handle`, session market). It returns `{ bundle }`, or `404 not_found` for a SKU that is not a preset bundle.
5. Hook `hooks/usePresetBundle.ts` (SWR, `fallbackData` = the server-rendered view; revalidate on focus off).
6. Cache key `keyPresetBundle(sku)` in `lib/cache-keys.ts`.

The **add** goes through the cart namespace (no new resource):
- `POST /api/cart/bundles` in `app/api/cart/bundles/route.ts`. Copy the shape of `app/api/cart/lines/route.ts`: the same body parsing style (`sku` matches `SKU_PATTERN`, `preset` is an integer 0 to 19, `quantity` is an integer 1 to 99), the same session cookie handling and the same response `{ cart }`.
- Hook `useAddPresetBundle()` in `hooks/useAddPresetBundle.ts`. Model it on `useAddToCart`: it writes `KEY_CART` and `KEY_CART_COUNT` from the response.
- `addPresetBundle(session, market, input)` in `lib/ct/cart.ts`, next to `addLine`, because it needs `createRawCart` and `getActiveCart`. The pure action builder is `buildPresetBundleActions(...)` in `lib/ct/preset-bundle-cart.ts`, exported for tests.

### D6. Every place that touches cart or order lines

Each row is a task below. If you find another place that reads `lineItems`, add a row and a question; do not skip it.

| Where | What must change | Task |
| --- | --- | --- |
| `addLine` (`lib/ct/cart.ts`) | Refuse a product of shape `presetBundle` with the new domain code `bundle_requires_preset` (422). Otherwise the bundle SKU could be added at its anchor price with no parts, through `POST /api/cart/lines`, the assistant or the in-store scan | V-09 |
| `changeQuantity` | A child line: refuse `bundle_line_locked` (409). The parent: check every child's online stock when raising, then send `changeLineItemQuantity` for the parent **and** every child in one update | V-10 |
| `removeLine` | A child: `bundle_line_locked`. The parent: remove the parent and all its children in one update | V-10 |
| `switchFulfilment` | A child: `bundle_line_locked`. The parent: move the parent and every child in one update, to delivery or to a US store (stock of every part checked) | V-10 |
| `planLines` (`lib/ct/cart.ts`) | Leave bundle lines out, so the switch and store-change plans never merge a child into a shopper's own line | V-10 |
| `detectPriceChanges` (`lib/mappers/cart.ts`) | Skip lines with `priceMode === 'ExternalPrice'` (otherwise every load reports a price change) | V-11 |
| `getCartView` | Re-price parents (D7) | V-11 |
| `mapCartSummary` count | Do not count child lines (the badge shows "1" for one bundle) | V-12 |
| `mapCart` | Hide child lines from `lines` and `groups`; give the parent a `bundle` block (D8) | V-12 |
| `CartLineRow`, `DrawerLine`, `CompanionNudge`, `FulfilmentChips` | Render the bundle block; no fulfilment chips or collect chip on a bundle line; no companion nudge for it | V-13 |
| `lineDraft` and `sameLine` (`lib/ct/checkout.ts`) | The clone of a bundle line copies `key`, `externalPrice` (the line's `price.value`) and **all** custom fields. `sameLine` also compares `key` and `parentId` | V-15 |
| `rebuildCart` (region switch) | Skip children. Re-add each parent through `addPresetBundle` in the new market with its `bundlePreset` and `bundleMachineSku`. A collect parent falls back to delivery when the new market offers no collection, like any collect line; it is dropped only when delivery fails too (Q-V-20). If the re-add fails, the parent becomes a `DroppedLine` | V-16 |
| `mapOrder` (`lib/mappers/order.ts`) and its views | Group children under the parent (by `key` and `parentId`); the line gets the same `bundle` block. `returnable` is keyed on the parent: the children are not listed, and returning the parent returns every child at the same quantity (Q-V-7) | V-17 |
| `planReorder` / `lib/ct/reorder.ts` | Parent → `addPresetBundle` with its preset; children skipped. Unavailable → the existing skip reason | V-17 |

### D7. Re-pricing a bundle in the bag (Q-V-9)

The existing cart re-prices lines on a page or drawer load (`getCartView`, price check). Bundles must behave the same way. After the existing price check, `repricePresetBundles(ct, market)` (in `lib/ct/cart.ts`) does this for each parent line:
- it reads the config and the components (as in D5) and finds the preset by `bundlePreset`;
- it checks that the parent's children are exactly the preset's component SKUs. If not, or if the preset is gone or unavailable, it leaves the line as it is and marks it with the notice the cart already uses for a line that cannot be bought (find it in `noticesOf`; the cart then blocks checkout with `price-unavailable` or `out-of-stock`);
- when the unit price differs, it sends one update with `setLineItemPrice` (`externalPrice`) and `setLineItemCustomField` (`bundleWasCents`), and passes the old price into `previousPrices`, so the existing `price-updated` notice shows.

One update per cart load at most: collect the actions for every parent first, then send them in one `postUpdate`.

### D8. The bag view of a bundle

Append to `CartLine` in `lib/types.ts`:

```ts
/** Set on a preset bundle's parent line; child lines are not in `lines`. */
bundle?: {
  presetName: string;          // from the config; falls back to "Bundle" when the config cannot be read
  discountPercent: number;     // 10 for 0.1
  wasUnitPrice?: Money;        // from bundleWasCents
  items: { sku: string; name: string; imageUrl?: string; role: 'machine' | 'item' }[];
};
```

- The parent's `imageUrl` is the machine child's image, or the bundle product's image when there is no machine child.
- `name` stays the product name ("Fast forward"). The row shows `presetName` as the variant summary.
- `maxQuantity` is the smallest `maxQuantity` among the children and the cart maximum.
- Stock notices of any child are copied onto the parent.
- `total` is still the engine's line total, verbatim. **Never add up the children.** They are $0.

### D9. Product page layout (make it nice)

`ProductDetail` renders `PresetBundleDetail` instead of `PdpProvider`, `Gallery` and `BuyBox` when `product.shape === 'presetBundle'`. Breadcrumbs, `RatingSummary`, `ReviewsSlot` and the related strip stay. The page must not render its own `<main>`. Use tokens and atoms only (no hex, no raw fonts, no inline radius).

```
Desktop (≥ 900 px)                                   Mobile (< 820 px): the same blocks stacked
┌──────────────────────────────┬─────────────────────────────┐
│                              │ eyebrow  BUNDLE             │
│   [ machine image of the     │ Fast forward                │  (page-title)
│     selected preset, large ] │ Pick a set. Everything      │
│   ┌──────────┐               │ ships together.             │
│   │ Save 10% │ (Badge)       │                             │
│   └──────────┘               │ Choose your bundle (legend) │
│                              │ ┌─────────────────────────┐ │
│  What's in the box           │ │(●) Vertuo bundle  -10%  │ │  ← PresetCard, selected:
│  [img] Vertuo Studio         │ │    Vertuo Studio        │ │    border-ink, ring, bg-surface
│  [img] Pod One Starter Gift  │ │    + Pod One Starter…   │ │
│  [img] Pod Discovery Gift…   │ │    + Pod Discovery…     │ │
│                              │ │    $349.16  ~~$387.95~~ │ │
│                              │ │    You save $38.79      │ │
│                              │ └─────────────────────────┘ │
│                              │ ┌─────────────────────────┐ │
│                              │ │( ) Pod plus       -12%  │ │
│                              │ │    …                    │ │
│                              │ └─────────────────────────┘ │
│                              │ [ - 1 + ]  [ Add bundle to bag · $349.16 ] │
│                              │ Delivery only · TrustRow    │
└──────────────────────────────┴─────────────────────────────┘
```

Components (in `components/preset-bundle/`, each with a test):
- `PresetBundleDetail.tsx` (client). It holds the selected index. The first selection is `?preset=<n>` when that preset is valid and available; otherwise it is the first available preset. When the shopper changes the selection, update the query with `router.replace` from `@/i18n/routing` (no scroll, no history entry). This matches "selection lives in the query" (workstream H).
- `BundleHero.tsx`. It shows the selected preset's **machine image** with `transformDetailImageUrl`, a soft cross-fade on change (opacity transition with a `--dur-*` token; switched off under `prefers-reduced-motion`) and a `Badge` "Save 10%". The alt text is the machine name.
- `BundleContents.tsx`. "What's in the box" lists **the names of all products** in the selected preset, each with a 48 px thumbnail and a link to its own product page.
- `PresetPicker.tsx`. A `<fieldset>` with a `<legend>`. Each card is a **native radio input** (`type="radio"`, `name="preset"`, visually hidden with `sr-only peer`) inside a `<label>`, so arrow keys, Space and screen readers work without extra code. The focus ring is visible on the card (`peer-focus-visible:`).
- `PresetCard.tsx`. It shows the name, a discount badge, the machine name, `+ <pod name>` per item, the price with the old price struck through, and "You save $X". When the preset is unavailable, the input is `disabled` and the card shows the reason ("Not available in Canada" / "Out of stock").
- `BundleAddToBag.tsx`. It contains a `Stepper` (1 to `min(stock, 99)`) and `Button variant="accent" size="lg" block`, labelled "Add bundle to bag · $349.16" (the total for the chosen quantity). The button shows `loading` while the request runs. On success it opens the cart drawer (`useShellUi().openCart`) and shows a toast. On error it shows the message for the domain code.
- Money is formatted with `formatMoney` (or the hook the PDP already uses). Never format in the mapper.

Below the add button, show one line "Delivered or collected together." and `TrustRow`. Show the delivery and collect choice with the existing collect block (US only, as for other products). Do not show `SubscribeBlock`. The machine variant selector (D-059) sits above the preset cards and uses the same atoms as the machine product page.

Listing card: `mapProductSummary` sets `price.fromIsRange = true` for shape `presetBundle`, so the card reads "From $349.16" (the anchor price, D10). Add a "Bundle" badge if the card's `badge` field allows it; otherwise park the badge in IDEAS.

### D10. Seed: make the owner's product sellable (decision D-057)

> **Withdrawn for V (owner, 2026-11-16, Q-V-12; D-057).** The owner does this in Merchant Center (OA-V-d); items 1 to 7 below are the steps for that row. No seed step and no reset un-apply is built. The rest of this section is reference only.

The owner made `fast-forward`, its product type and the custom objects. Ground rule 8 says resources without `mcf-` are not ours. **D-057** makes a narrow exception: the seed step `preset-bundles` may **update** the products listed in `OWNER_BUNDLE_PRODUCT_KEYS = ['fast-forward']`, found by key. It never creates them and never deletes them, and `reset` and `cleanup` never touch them. If the product is missing, the step logs `skip` and succeeds.

The step does these things, each only when needed (idempotent, `--dry-run` prints the actions):
1. Adds the category `mcf-cat-bundles`.
2. Sets the tax category `mcf-tax-standard` (all current components are standard-rated; Q-V-10).
3. Copies the en-US name and slug to `en-CA` when en-CA is empty.
4. Adds an image when the product has none: the clean URL of the first valid preset's machine master image.
5. Writes an **anchor price** per market: one embedded price `USD`/`US` and one `CAD`/`CA`, each equal to the cheapest **available** preset's unit price (D2). Skip a market where no preset can be priced. Without a price the product is invisible in listings, because `marketClause` in `lib/search/build.ts` requires one. The anchor is a display price only; the bag never uses it.
6. Adds the product to `mcf-selection-malva-coffee`. Without that, `isInBrandSelection` makes the product page a 404.
7. Publishes.

Re-run the step when component prices change; the anchor is not live (Q-V-12).

**Reset must undo this first.** `seed/src/reset.ts` deletes the seed's own tax categories and categories. `fast-forward` is never deleted but will reference `mcf-tax-standard`, `mcf-cat-bundles` and `mcf-selection-malva-coffee`, so those deletes can be refused or leave a dangling reference. Before reset deletes anything, it runs an "un-apply" for each `OWNER_BUNDLE_PRODUCT_KEYS` product: unset the tax category, remove the category, remove the selection membership, remove the anchor prices, then publish. It leaves the owner's image and en-CA name in place.

**The seed client can read custom objects.** Its scope is `manage_project` (`SEED_CTP_SCOPES`), so V-04 needs no owner action.

## 4. Tasks

Common rules: test first, then code. Run `cd storefront && npm run check` (and `cd seed && npm run check` for seed tasks) before ticking. One task per commit: `ws-v: V-nn <summary>`. Run `npm run build` before V-21. Never call the real API in a unit test. **Never write to the commercetools project except through the seed (V-04) and the probe in V-01.**

- [ ] **V-00 Record the plan.** Files: `plans/DECISIONS.md`, `plans/notes/questions-V.md`, `plans/notes/todo-V.md`, `plans/STATUS.md` (row V, set it to `In progress`). Do:
  - Add D-056 "Preset bundles: a parent line carries `round(sum × (1 − presetDiscount))` as `externalPrice`; child lines are $0 externally priced lines; bundles are delivery only (D2)".
  - Add D-057 "The seed step `preset-bundles` may update, never create or delete, the owner products in `OWNER_BUNDLE_PRODUCT_KEYS` (D10)".
  - Add D-058 "Child lines link to the parent through `parentId` = the parent line's `key` (D3)".
  - The V rows of `notes/questions-V.md` and `notes/todo-V.md` are already copied into `QUESTIONS.md` and `TODO-MANUAL-TESTING.md` (2026-11-16). **Do not run `node plans/consolidate-notes.mjs`** on `main`: the T notes files are not on this branch, so it deletes the Q-T and OA-T rows. If you edit a V note, copy the changed row by hand.
  - Run `node plans/verify-plan.mjs --strict --questions --manual`.

  Done when the rows exist and the checker reports nothing about V. Today it already fails for reasons outside V: four multibrand specs are missing from `SPEC-COVERAGE.md`, and T2 is missing some headings.
- [ ] **V-01 Probe the platform (read-only plus one throw-away cart).** File: `plans/evidence/V/probe.mts`; run it with `npx tsx` from `storefront/` so it uses the storefront client. It creates one cart (`deleteDaysAfterLastModification: 1`). Record the answers in `plans/PROJECT-FINDINGS.md` as F-V-01 to F-V-05:
  - (2) to (4) use a **component** SKU (`MCF-GFT-DISCOVERY`) so the result does not depend on the bundle product:
    - (2) two adds of the same SKU with `externalPrice` and different custom fields (one with `parentId`) stay two lines;
    - (3) `recalculate` with `updateProductData: true` keeps the external price;
    - (4) `setLineItemPrice` changes an external price;
  - (5) reading the custom object with the storefront client fails with 403. That is expected until OA-V-a;
  - (1) `addLineItem` with `key` and `externalPrice` for the **bundle** SKU `998674532`, which has no price. **Expected to fail now** with a tax error, because the product has no tax category in a `Platform` tax-mode cart. Record the error code. Re-run only (1) after OA-V-d, because the owner sets the tax category there (the probe takes `--only 1`). It must then succeed, and that result is the real F-V-01. **(6)** Q-V-17: add the bundle SKU `998674532` with a store `supplyChannel` and `externalPrice`, then try to create an order from that cart in the test mode (no payment). Record whether the platform accepts it. If it refuses, record the error and switch D3 to "only the children carry the store channel" before V-09.

  Delete nothing; the cart expires on its own. Evidence is the trimmed output (ids only) in `plans/evidence/V/V-01-probe.txt`.
- [x] **V-02 Seed: line fields.** Files: `seed/src/data/custom-types.ts` and the type update planner (find `planTypeUpdate`; R-02 extended it for enum values). Add `parentId`, `bundlePreset`, `bundleMachineSku` (String) and `bundleDiscount`, `bundleWasCents` (Number) to `mcf-line-fulfilment`. Make sure the planner **adds** a missing field definition (`addFieldDefinition`) and never removes or changes an existing one. Tests: "missing bundle fields are added", "an existing parentId is left alone", "a second run plans no actions". Run `cd seed && npm run seed -- --only types --dry-run`, then for real; read the type back with the MCP into the evidence.
- [x] **V-03 Seed: the Bundles category.** File: `seed/src/data/categories.ts`. Add `C('mcf-cat-bundles', undefined, 'Bundles', 'bundles', 'A machine and its pods, together for less.')` after Gifts; its order hint sorts after Gifts. Give it `instoreVisibility = onlyOnline` the same way the other top-level categories get it (`seed/src/data/instore.ts`). If category pages show a category image, use the Vertuo Studio master image URL (clean). Add the key to the reset list the other categories use. Tests: the existing category data tests, plus "bundles category is top level and online only".
- [ ] **V-04 WITHDRAWN (Q-V-12, D-057): no seed step, no reset un-apply.** The owner does OA-V-d. The original steps follow as reference only: Files: `seed/src/preset-bundles.ts` (pure planning plus the step), `seed/src/data/preset-bundles.ts` (`OWNER_BUNDLE_PRODUCT_KEYS`), and a new entry in `STEPS` in `seed/src/seed.ts` with `requires` on `categories`, `tax`, `product-selections` and `products`. Reuse D2's pricing: put the pure price function in `seed/src/preset-bundle-price.ts` with the same worked-example test; the seed is its own package and cannot import the storefront. Also add the reset "un-apply" from D10 to `seed/src/reset.ts`, so it runs before any delete. Tests against `fake-api.ts`:
  - every action of D10 once;
  - nothing on a second run;
  - a missing product skips;
  - a preset whose component lacks a CAD price is ignored for CA;
  - "reset un-applies D10 on fast-forward, then deletes its own keys, and never deletes fast-forward".

  Run it with `--dry-run`, then for real. Read the product back into the evidence (categories, taxCategory, prices, image, selection). Then re-run V-01 probe (1).
- [x] **V-05 Mock server fixtures.** Files: `storefront/scripts/mock-fixtures/preset-bundle.json` (the bundle product as a projection with the attribute and the D10 data, plus the two custom object documents; copy only the `value` objects from `bundles.har`, never the HAR's request data), `storefront/scripts/mock-ct-server.mjs` (serve `GET /custom-objects?where=id="…"`, the bundle in Product Search and projections, and the components; `addLineItem` with `key` and `externalPrice`; `setLineItemPrice`; `setLineItemCustomField` for the new fields), and `storefront/test/fake-carts.ts` (the same three cart behaviours for route tests). Test: the mock returns the bundle for its SKU; a fake-cart add with `externalPrice` keeps that price.
- [x] **V-06 Types, shape and pure helpers.** Files: `lib/types.ts` (D5 and D8 types, the `'presetBundle'` shape), `lib/product/variant-config.ts` (`PRODUCT_TYPE_SHAPE`; empty `SHAPE_SELECTORS` and `PDP_INFO_ATTRIBUTES` entries), `lib/preset-bundle/pricing.ts` (`presetPrice(componentCents, discount)` returns `{ was, price, save } | null`; `isValidDiscount`), `lib/mappers/bundle-lines.ts` (D3 helpers). Tests: the worked example; discounts `-0.1`, `1`, `NaN` and `"0.1"` are invalid; `0` is valid (no saving); helpers on parent, child and normal lines.
- [x] **V-07 Read the bundle (six files, D5).** Files: `lib/ct/preset-bundles.ts`, `lib/mappers/preset-bundle.ts`, route, hook, cache key. Tests:
  - mapper: the HAR presets map to two `BundlePresetView`s with the worked-example prices;
  - an en-CA empty name falls back to en-US;
  - a component without a price makes the preset `no-price`;
  - an out-of-stock component makes it `out-of-stock`;
  - a schema mismatch returns null;
  - a non-UUID id never reaches the API;
  - route: 200 with the view, 404 for a normal SKU.
- [x] **V-08 Load it on the product page.** File: `lib/pdp/load.ts`. For shape `presetBundle`, load `getBundleView` in the existing `Promise.all`. A failure logs `pdp_bundle_failed` and sets `bundle: null`. Do not load policies for this shape. Test: bundle data present for the bundle SKU; `bundle: null` on a failed read; other shapes unchanged.
- [x] **V-09 Add a bundle to the bag.** Files: `lib/ct/preset-bundle-cart.ts` (`buildPresetBundleActions`), `lib/ct/cart.ts` (`addPresetBundle`, and the refusal in `addLine`), `app/api/cart/bundles/route.ts`, `hooks/useAddPresetBundle.ts`, `lib/api-domain.ts` (`bundle_requires_preset`, `bundle_preset_unavailable`, `bundle_line_locked`, `bundle_not_subscribable`, with safe messages), and `messages/*.json` (`errors.<code>` in both catalogues).

  Body: `{ sku, preset, quantity, machineSku?, fulfilment: 'delivery' | 'collect', storeKey? }`. The browser sends no price. Refusals: `subscribe` is not accepted (`bundle_not_subscribable`, 422); collect outside the US is `collect_not_available_in_market`; a `machineSku` that is not a variant of the preset's `coffeeMachine` product is `bundle_preset_unavailable` (422). The price comes from the chosen machine variant (D-059).

  `addPresetBundle` does this:
  - re-reads the view for the session market and the chosen machine variant;
  - refuses an invalid or unavailable preset (`bundle_preset_unavailable`, 422, with `reason`);
  - checks each component's online stock against the quantity;
  - when the bag already has a parent with the same preset, `bundleMachineSku`, fulfilment and store (Q-V-19), raises that bundle's quantity (parent plus children) instead of adding a second one;
  - otherwise sends parent plus children plus `orderTypeCartActions` in **one** update through `updateWithRetry`.

  Tests:
  - the action list for preset 0 (parent `key`, `externalPrice` 34916, fields, three children at 0 with `parentId`);
  - the same preset twice raises the quantity;
  - an unavailable preset is refused with no update;
  - `POST /api/cart/lines` with the bundle SKU answers `bundle_requires_preset`;
  - the route rejects a body with a `price` field or a bad preset.
- [x] **V-10 Keep the lines together.** File: `lib/ct/cart.ts` (`changeQuantity`, `removeLine`, `switchFulfilment`, `planLines`, per D6). Tests:
  - the parent quantity change cascades;
  - raising it above a child's stock is refused with `available`;
  - removing the parent removes the children;
  - a child cannot be changed, removed or switched (`bundle_line_locked`);
- switching the parent to collect moves every child to the same store, and switching it back moves every child to delivery;
  - switching a shopper's own machine line to collect and back never touches the bundle's machine child.
- [x] **V-11 Prices stay right.** Files: `lib/mappers/cart.ts` (`detectPriceChanges` skips external prices), `lib/ct/cart.ts` (`repricePresetBundles` in `getCartView`, D7). Tests: an externally priced line is never "price-updated" by the old check; a component price change re-prices the parent and shows `price-updated` with the old price; a removed preset blocks checkout; at most one update per load.
- [x] **V-12 Bag view.** File: `lib/mappers/cart.ts` (`mapCart`, `mapCartSummary`; D8). Tests:
  - one bundle plus one pod line gives `lines.length === 2` and count = bundle quantity + pod quantity;
  - children are not in any group;
  - the bundle block lists the three names with the machine first;
  - `oldUnitPrice`/`wasUnitPrice` comes from `bundleWasCents`;
  - `maxQuantity` is the children's minimum;
  - a child's out-of-stock notice appears on the parent.
- [x] **V-13 Bag UI.** Files: `components/cart/CartLineRow.tsx`, `DrawerLine.tsx`, a new `components/cart/BundleLineItems.tsx`, `FulfilmentChips.tsx`, `CompanionNudge.tsx`, `messages/*.json`. The row shows the machine image, "Fast forward", the preset name, a "Bundle · save 10%" `Badge`, an "Includes" list with the item names, the engine total with the was price struck through, the stepper and remove. Both act on the parent. There are no fulfilment chips. Tests: rendering (names, badge, prices); stepper and remove call the parent id; no collect chip on a bundle row; an axe check (`test/axe.ts`).
- [ ] **V-14 Product page UI (D9).** PARTIAL (2026-11-16): built and tested: the preset cards, `?preset`, the machine variant picker, the hero, the contents, the add button with its messages, the Ship or Collect choice (US, with the chosen store), the focus move for `?choose=preset`, the axe check. NOT built: the arrow-key test (native radios; not exercised in jsdom) and the existing collect block's store picker is reused only through `useCollectionStore().open`. Left unticked until the arrow-key check is done. Files: `components/preset-bundle/*`, `components/pdp/ProductDetail.tsx` (the branch), `app/[brand]/[locale]/p/[slug]/[sku]/page.tsx` (read `?preset`), `messages/*.json` (`presetBundle.*`; en-CA spellings), `components/ui/icons.ts` if a new icon is needed. Tests:
  - the machine variant selector changes the machine child's SKU and the price (D-059);
- two radio cards with names, prices and savings;
  - `?preset=1` selects the second;
  - an unavailable preset is disabled with its reason, and a `?preset` pointing at it falls back to the first available;
  - changing the radio changes the hero image `src` and the names list, and updates the query;
  - the arrow keys move the selection (native radios);
  - add calls `useAddPresetBundle` with `{ sku, preset, quantity }` only and opens the drawer;
  - an error code shows its message;
  - no preset available shows "This bundle is not available right now" and no button;
  - axe passes.
- [x] **V-15 Checkout clone.** File: `lib/ct/checkout.ts` (`lineDraft`, `sameLine`; D6). Tests: a mixed bag (one collect line and one bundle) clones the bundle with `key`, `externalPrice` and every custom field; `afterPlacement` removes exactly the paid bundle lines and not a shopper's own line of the same SKU.
- [x] **V-16 Region switch.** File: `lib/ct/cart.ts` (`rebuildCart`). Tests: US to CA re-adds the bundle at the CAD price; a preset with no CAD price comes back as a `DroppedLine`; children are never re-added on their own.
- [x] **V-17 Orders and reorder.** Files: `lib/mappers/order.ts` (group children, the `bundle` block on the order line, bundle lines out of `returnable`), the order line components under `components/order/` and `components/account/orders/` (show the "Includes" list; the return dialog offers the bundle as one row and returns every part at the same quantity, Q-V-7), `lib/ct/reorder.ts`. Tests: confirmation and account views show one bundle row with its items; `returnable` lists the parent, not the children; reorder re-adds the bundle once and skips the children.
- [x] **V-18 Navigation and listing.** Files: `lib/nav/mega-config.ts` (a `bundles` entry in `PRIMARY_NAV` after `gifts`, `hasMenu: false`, category key `mcf-cat-bundles`; widen the `more` type and add `'bundles'` where `'gifts'` is listed), `messages/*.json` (`shell.nav.bundles`), and `lib/mappers/product-summary.ts` (`fromIsRange` for the shape, D9). Also set **`requiredChoice: 'preset'`** for the shape. Widen the union in `lib/types.ts` to `'grind' | 'colour' | 'preset' | null`. With it, the card's `QuickAdd` (`components/product/QuickAdd.tsx`) opens the product page with `?choose=preset` instead of adding a line that V-09 would refuse. The assistant's mapper then also treats the bundle as "needs a choice". `PresetBundleDetail` moves focus to the picker's legend when `choose=preset`. The nav is Malva Coffee only. Tests:
  - the nav test lists Bundles with the right href;
  - a drinks brand shows no Bundles entry;
  - the summary of the bundle reads "from" and has `requiredChoice: 'preset'`;
  - QuickAdd on the bundle card navigates and does not call the add hook.
- [x] **V-19 Assistant and in-store guard.** No new feature. Check that the assistant's cart tool and the in-store scan turn `bundle_requires_preset` into their normal "cannot add" answer (read how they map `LineRejected`). Tests: one per surface, asserting the refusal, not a crash. Anything larger goes into IDEAS.
- [ ] **V-20 Browser verification against the mock.** Run section 6 at 375 px and 1440 px. Save screenshots and a short README in `plans/evidence/V/`.
- [ ] **V-21 Live verification and handover.** Only after OA-V-a. Set the new client in `storefront/.env.local` (names only in `.env.example`; `CTP_SCOPES` gains `view_key_value_documents`). Run section 6 again against the real project, place one order in the hosted Checkout test mode (M-V-01 lists what only the owner can check), run `npm run build`, update `FEATURES.md`, and set `STATUS.md` to `Ready for review`.

## 5. Scenarios checklist

No spec owns this feature. The list below is the acceptance contract; each line must name its test (backticks) when ticked.

- [ ] The Bundles category exists, is top level, online only, and lists the bundle at "From $349.16" in the US.
- [ ] The product page of SKU `998674532` shows one radio card per valid preset with the machine name, the names of all included products, the price, the old price and the saving.
- [ ] Changing the preset changes the large image to that preset's machine and the "What's in the box" names.
- [ ] `?preset=1` opens with the second preset selected; an invalid or unavailable index falls back to the first available.
- [ ] A preset with a component out of stock is disabled with "Out of stock"; a preset without a price in the market is disabled with "Not available in Canada".
- [ ] Adding preset 0 puts one bundle row in the bag at $349.16 per unit, with the struck-through $387.95 and the three item names; the badge count rises by the quantity, not by four.
- [ ] Adding the same preset again raises the quantity of the existing bundle.
- [ ] Changing the bundle quantity changes every part; removing the bundle removes every part.
- [ ] A bundle part cannot be changed, removed or switched on its own (`bundle_line_locked`).
- [ ] The bundle SKU cannot be added through `POST /api/cart/lines` (`bundle_requires_preset`).
- [ ] A component price change re-prices the bundle on the next bag load and shows "Price updated".
- [ ] The browser never sends a price; a request with a price field is refused.
- [ ] Checkout of a bag with a collect line and a bundle keeps the bundle's price and parts in the clone and clears exactly those lines after payment.
- [ ] Switching from the US to Canada re-prices the bundle in CAD or lists it as a dropped line.
- [ ] The confirmation and the account order page show the bundle as one row with its parts; the return dialog offers it as one row and returns every part.
- [ ] A bundle can be collected at one US store: every part carries that store. A Canadian shopper gets delivery only (`collect_not_available_in_market`).
- [ ] A bundle cannot be subscribed to (`bundle_not_subscribable`).
- [ ] The shopper picks the machine variant; the price and the saving follow that variant.
- [ ] Reorder of a past bundle adds the bundle once.
- [ ] Discount 0.1 means 10 %; an invalid discount hides the preset.
- [ ] Preset names fall back to en-US when the en-CA name is empty.
- [ ] Seed steps `types` and `categories` are idempotent, and reset never deletes or writes `fast-forward`.
- [ ] Keyboard only: Tab reaches the picker, the arrow keys change the preset, Enter on the button adds; axe reports nothing on the bundle product page and in the bag.

## 6. Browser recipe (Chrome DevTools MCP)

Mock upstream first: `node scripts/mock-ct-server.mjs` (read its header; `NODE_EXTRA_CA_CERTS` with the printed certificate), then `npm run dev`. Viewports 375x812 and 1440x900.

1. `/en-US`: the header shows "Bundles" after Gifts. Open it: the category page lists "Fast forward" with "From $349.16" and the machine image. Screenshot `V-20-category-375.png` and `-1440.png`.
2. Open the card. Check the breadcrumb, the hero image (Vertuo Studio), two radio cards, "What's in the box" with three names, and "Add bundle to bag · $349.16". Screenshot.
3. Click "Pod plus": the image becomes Pod Plus Milk, there are four names, the price is $416.15, the saving $56.75, and the URL has `?preset=1`. Reload: still preset 1. Use the keyboard only: Tab to the picker, then the arrow keys. Screenshot.
4. Set the quantity to 2 and add. The drawer opens with one bundle row at $832.30, "Includes" lists four names, and the badge shows 2. Check `GET /__mock/carts`: one parent (key `bundle-…`, `externalPrice` 41615) and four children (`externalPrice` 0, `parentId` = the key). Screenshot.
5. Bag page: raise to 3 and lower to 1; remove. The mock cart is empty after the remove.
6. Add preset 0 twice from the product page: one row with quantity 2.
7. `POST /__mock/price` raises Vertuo Studio by $10. Reload the bag: the bundle shows "Price updated" and $358.16.
8. `POST /__mock/stock` sets Pod One Starter Gift to 0. The product page shows both presets disabled "Out of stock"; the bag row blocks checkout.
9. Switch to Canada (`/en-CA`): the bundle is re-priced or listed as dropped (depending on the fixture's CAD prices). The preset names are not blank.
10. Checkout with a collect line plus the bundle (mock flow `plans/evidence/K/mock-flow.mjs`): the confirmation shows the bundle row with its parts.
11. Console clean, no failed requests, no hydration warning. Run Lighthouse accessibility on the bundle product page and the bag at mobile size.

## 7. Self-verification with data (no asking the owner)

- Seed results are read back with the commercetools MCP (`read_products` key `fast-forward`, `read_types` key `mcf-line-fulfilment`, `read_categories` key `mcf-cat-bundles`) and trimmed into `plans/evidence/V/` (ids and keys only).
- Until OA-V-a, every storefront check runs against the mock server, and the probe (V-01) proves the cart facts on the real project.
- After OA-V-a, repeat section 6 against the real project and compare the prices with the worked example (they match while the catalogue prices are unchanged).

## 8. Manual testing and owner items (also in `plans/notes/todo-V.md`)

- **OA-V-a**: create an API client with the storefront's current scopes plus `view_key_value_documents`. Existing clients cannot change scopes. Put its values in `storefront/.env.local`.
- **OA-V-b**: the same values in Netlify, for production and any branch deploy.
- **OA-V-c** (optional): fill the en-CA preset names, and check that every component has a CAD price, so both presets are sold in Canada.
- **OA-V-d**: the owner sets up `fast-forward` in Merchant Center (tax, category, selection, image, anchor price). Replaces the seed step (Q-V-12).
- **M-V-03**: collect a bundle in a US store (every part at that store).
- **M-V-01**: a hosted Checkout test payment with a bundle. Check how the payment page lists the $0 parts and confirm the order total.
- **M-V-02**: open the order in Merchant Center. The parts carry `parentId` and the parent its key and fields.
- **SO-V-a**: sign off the product page and bag design (screenshots in `plans/evidence/V/`).

## 9. Questions (also in `plans/notes/questions-V.md`)

Q-V-1 to Q-V-21. The owner answered Q-V-1 to Q-V-16 on 2026-11-16. Q-V-17 to Q-V-21 are readings of those answers that the build depends on, each with its default. The most important: Q-V-1 (pricing model), Q-V-7 (returns), Q-V-8 (how the hosted Checkout lists $0 parts), Q-V-10 (tax).

## 10. Definition of done

- V-00 to V-21 ticked (V-04 withdrawn, Q-V-12), each with a passing `npm run check` commit; `npm run build` passes.
- Every line in section 5 names a passing test or evidence.
- Section 6 done at 375 and 1440 px against the mock, and again against the real project after OA-V-a; console and network clean; Lighthouse accessibility recorded.
- Owner rows exist; `node plans/verify-plan.mjs --strict` prints `plan ok`.
- No push, no deploy; `STATUS.md` row V is `Ready for review`.

## 11. Risks to watch

- **A merge you did not expect.** If V-01 shows the platform merges lines despite different keys or fields, stop and write a question. Do not work around it in the UI.
- **The anchor price is a display price.** If anyone adds the bundle SKU through `addLine`, the shopper pays the anchor price without the parts. V-09's refusal is the guard; keep its test.
- **Stale configuration.** `getBundleConfig` is cached. When the owner edits a preset, the product page can be up to the cache TTL behind; the bag re-prices on load (D7), so the shopper never pays an old price.
- **Hosted Checkout display.** The parts show at $0 on the payment page (M-V-01). If the owner dislikes it, the alternative is Q-V-1 option B (the parts carry the discounted prices).
- **Collect on the parent (Q-V-17).** If the platform refuses a store channel on the parent line, the design changes (D3). Probe V-01 (6) decides it before V-09.
- **`bundles.har` at the repository root** is a browser capture. Do not commit it. V-05 copies only the two `value` objects into a fixture.
