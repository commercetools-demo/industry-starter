# L — Product detail page (PDP)

**Specs:** `pdp-design` (all), `storefront-design-system` (Product tile parts reused), `storefront-data-loading` (React cache dedup, availability check on add)
**Depends on:** G, H, J, K · **Unblocks:** N, T, W · **Decisions:** D-021, D-023, D-039 (reviews placeholder)
**Skill refs:** `commercetools-storefront` `b2c/product-detail.md`, `b2c/variant-config.md`

## Goal
`/[locale]/p/<slug>` shows gallery, buy box with variant selectors generated from attributes, availability, quantity + add to bag, specs, related products — server-rendered.

## Design

### Route and data
`app/[locale]/p/[slug]/page.tsx` (Server): `const { slug } = await params;` product via `getProductBySlug` (React `cache`, shared by `generateMetadata` and the page); `null` → `notFound()` (outside try/catch). Selected variant from `?sku=` (default: first in-stock variant, else first). Related: `searchProducts({ categoryId: product.categoryIds[0], pageSize: 5 })` minus the current product, first 4. Parallel with `Promise.all`.
`generateMetadata`: title `${name} · MALVA`, description (first 160 chars), Open Graph image = first image.

### Variant configuration `lib/config/variant-config.ts`
```ts
export const VARIANT_CONFIG = { blocklist: ['approximateWeight', 'incrementValue', 'incrementUnit'], swatch: {} as Record<string, Record<string, string>>, sort: { packLabel: 'increment' } as Record<string, 'increment' | 'alpha'>, primary: 'packLabel' };
export function buildSelectors(product: Product): Selector[]; // pure
```
`Selector = { name: string; label: string; kind: 'segmented' | 'swatch' | 'radio'; options: { value: string; label: string; sku: string | null; disabled: boolean }[]; selected: string }`. Rule: attributes whose values vary across variants and are not blocklisted become selectors; `packLabel` first, sorted by `incrementValue` ascending (per `sort`); an option is `disabled` when no variant with that value + the other current selections exists, or that variant is out of stock **and** `disabled` only when no purchasable variant exists. Selecting an option navigates to `?sku=<variantSku>` (client island: `router.replace(`${pathname}?sku=${sku}`, { scroll: false })` with `usePathname`/`useRouter` from `@/i18n/routing` — never a bare query string).

### Components
- `ProductGallery` (server): primary image 600 px spanning 2 columns + two 290 px secondary images (use images 2 and 3, or repeat/omit if fewer — omit); `Photo` with `priority` on the primary.
- `BuyBox` (server) composing: identity (category + sku `Tag`s, H1 48px, brand line), `PriceBlock` (30px heading font), description, `VariantSelectors` (client), `AddToBag` (client), `Availability` (server: "In stock" / "Out of stock"), optional contact strip (`Questions? Contact us` → `/contact`), `SpecsTable` (Brand, Origin, Storage, Dietary, Allergens; only rows with data).
- `AddToBag` (client): `QuantityStepper` (min 1, max = `availability.availableQuantity` when known), primary "Add to bag" (disabled when out of stock), `SaveButton` (K). Calls `addItemWithToast(sku, qty)` from J; on `INSUFFICIENT_STOCK` shows an inline message "Only N available". Extension slot `<RecurrenceSelector product variant/>` (W) renders nothing in L.
- `RelatedProducts` (server): H2 "Pairs with", 4-column tile grid.
- `Reviews` (server): renders **only** if `product.reviews` exists (type `ProductReviews = { average: number; count: number; distribution: number[]; items: {…}[] }`, never populated in v1) — otherwise returns `null` (no heading, no gap).

## Tasks
- [x] L-01 Write `lib/config/variant-config.ts` + `buildSelectors` + tests: weighed product → one `packLabel` selector sorted 500 g, 1 kg, 2 kg; blocklisted attributes never appear; single-variant product → no selectors; unavailable combination → option disabled; selected option follows `sku`.
- [x] L-02 Write the page skeleton, `generateMetadata`, not-found handling, variant choice by `?sku=` + tests (mock `getProductBySlug`): unknown slug calls `notFound`; default variant is first in stock; `sku` param selects that variant; metadata title.
- [x] L-03 Write `ProductGallery` + tests (primary has `priority`; ≤3 images; alt text from product name).
- [x] L-04 Write `BuyBox` parts (`Availability`, `SpecsTable`, contact strip) + tests (out of stock text; specs rows omitted when empty; strip links to `/contact`).
- [x] L-05 Write `VariantSelectors` (client) + tests: choosing "1 kg" calls `router.replace(`${pathname}?sku=…`, { scroll: false })`; arrow keys on segmented; disabled option not clickable; swatch/radio kinds render via config.
- [x] L-06 Write `AddToBag` + tests: quantity min 1 and max; disabled when out of stock with `aria-disabled` and text; success calls mutation once and shows toast; `INSUFFICIENT_STOCK` shows "Only 3 available" and does not change the cart; heart present.
- [x] L-07 Write `RelatedProducts` and `Reviews` + tests (related excludes current product, max 4; reviews returns nothing without data).
- [x] L-08 Compose the page in two columns at `desktop` (`1.15fr/1fr`, gap ≈ 49 px), buy box sticky `top-[110px]`; single column at `<desktop`. Add message keys (both locales). Test breadcrumbs (Home / Shop / Category / Product).
- [x] L-09 Report manual tests M-L-1…M-L-4.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Scroll on desktop (sticky) | CSS class assertion `desktop:sticky` in L-08 |
| Saving shown (discount) | L-04/K-02 PriceBlock |
| Select an increment / Unavailable option | L-01, L-05 |
| Add three / Out of stock / Ask for more than available | L-06 |
| Out of stock variant (availability) | L-04 |
| Related click (qty reset) | page re-render with new slug (L-02) |
| No reviews (omitted) | L-07 |

## Manual tests to report
- M-L-1 (F done, OA-02): 1. `npm run dev`, open `http://localhost:3000/en-US/p/bananas` at 1440 px. 2. The "Pack size" selector shows two options in order `500 g`, `1 kg`; `1 kg` is selected (first in stock) and the URL has no `sku`. 3. Click `500 g`: the URL becomes `/en-US/p/bananas?sku=BANANAS-500G` without scrolling or a full reload, the option is marked, the sku tag and the price change (500 g is cheaper than 1 kg), the heading and gallery stay. 4. Reload the page: `500 g` is still selected. 5. Press Back: `1 kg` is selected again. 6. Open `/en-US/p/bananas?sku=NOPE`: falls back to the default variant. 7. Open `/de-DE/p/bananas-de`: German labels ("Packungsgröße"), prices in euro.
- M-L-2 (F done, OA-02): 1. Open `http://localhost:3000/en-US/p/cheddar` (out of stock). 2. Availability says "Out of stock", the "Add to bag" button is greyed out and cannot be clicked, a short "Out of stock" note sits under it, the quantity stepper is disabled. 3. Tab to the button: it is skipped or announced as unavailable. 4. Open `/en-US/p/sourdough-loaf`: same. 5. Open `/en-US/p/nope-nope`: the "not found" page (HTTP 404) with links to the shop and contact.
- M-L-3 (F done, OA-02): 1. Open `http://localhost:3000/en-US/p/whole-milk`. 2. Click `+` once (quantity 2), click "Add to bag": exactly one toast "Added to your bag" with "View bag" appears and the header shows `Bag · 1`. 3. Click "Add to bag" again while the toast is visible: still one toast per click, the line quantity in `/en-US/cart` is 4 after two adds. 4. Reload the PDP and the cart: the bag is kept. 5. Increase the quantity above the stock (stock is 100, bag has 4: set 98 with repeated `+` or add until the limit): the stepper stops at the available quantity; adding beyond the remaining stock shows "Only 100 available" under the button and the bag does not change. 6. Click the heart: nothing happens yet (saved lists arrive in T).
- M-L-4: 1. Compare `/en-US/p/bananas` with the design (`design/specs/pdp.md`, prototype `pdp`) at 1440 px: breadcrumbs `Home / Shop / <category> / Bananas`; gallery left (600 px primary spanning two columns, two 290 px photos below when the product has three images), buy box right sticky 110 px from the top while the page scrolls (the page is short, so check with a tall window or zoom 150%); tags, 48 px heading, brand line, 30 px price, description, selector, quantity + "Add to bag" + heart, availability, "Questions about this product? Contact us" strip linking `/en-US/contact`, specs table (Brand, Origin, Storage, Dietary; Allergens row only when data exists), "Pairs with" four tiles below, never the current product. No reviews block. 2. At 390 px: single column, gallery first, buy box below, related tiles in two columns, no horizontal scroll. 3. At 1000 px: single column, buy box not sticky. 4. Tab through selector, stepper, button, heart: visible focus ring. Review SO-01 breakpoints (the swipe carousel and sticky bottom bar proposed for mobile are not built, see IDEAS).

## Definition of done
Selectors come only from attributes (no hard-coded Finish/Size/Fitting); not-found path works; both locales; `verify` passes.

## Implementation notes (deviations, recorded by the developer)
- `buildSelectors(product, sku?)` takes the selected sku as an optional second argument (the plan's signature had none, but "selected option follows `sku`" needs it). `pickVariant(product, sku?)` (same file) is the one rule for the shown variant: that sku, else the first in stock, else the first. `VARIANT_CONFIG` gained a `radio: string[]` list (attributes shown as radios); the `swatch` mapping decides swatches. Selector `label` is a humanized attribute name; `VariantSelectors` prefers `pdp.options.<name>` (only `packLabel` = "Pack size" exists).
- An option is disabled when no variant matches (value + the other selectors' current values) or when none of the matching variants is in stock, except the currently selected option, which is never disabled. Its `sku` prefers an in-stock matching variant.
- `lib/market.ts` `marketFor(locale)` (the URL locale decides currency/country, the session is only a fallback, same rule as K and Q-K-1) is used by the PDP; the shop page keeps its own private copy (not touched).
- Page: `getProductBySlug` runs first (React-cached, shared with `generateMetadata`), then the category tree and the related search (`categoryIds[0]`, `pageSize` 5, current product removed, first 4) run in parallel. Failures of those two are swallowed (the section or the category tag is left out). `notFound()` is called outside any try/catch. The slug is `decodeURIComponent`-ed defensively.
- `Breadcrumbs` got optional `categoryHref` and `current` props (K usage unchanged): with `current` the category links to `/shop?category=<slug>` and the product is the last, non-link item. `findCategoryById` was added to `lib/listing-view.ts`.
- `AddToBag` stock rule: stepper max = the variant's `availableQuantity`; units of the same SKU already in the bag count against it, and a request that would exceed it is **not sent** and shows an inline "Only N available" (N = available quantity). The cart API's 409 (`INSUFFICIENT_STOCK`, a race) is still answered by `addItemWithToast` with the toast "Only N available right now." (J's behavior); the inline message does not show for that case because `addItemWithToast` only resolves `true/false`. `AddToBag` is keyed by the variant SKU in `BuyBox`, so the quantity resets for another product or variant ("Related click").
- Out of stock: the button is `disabled` and `aria-disabled="true"`, described by the visible note "Out of stock" under it; `Availability` says so too.
- `Product` got `reviews?: ProductReviews` (type only; the mapper never fills it, D-039). `Reviews` renders nothing without it. `RecurrenceSelector` (slot for W) lives in `components/product/RecurrenceSelector.tsx` and returns `null`; `AddToBag` renders it above the quantity row.
- Not built (not in the task list, see IDEAS): the mobile swipe carousel and the sticky bottom "price + Add to bag" bar proposed in `design/specs/pdp.md`, a loading skeleton, the "Write a review" button.
- Live check with `npm run dev` against the seeded project: `/en-US/p/bananas` 200, title "Bananas · MALVA", selector 500 g / 1 kg, breadcrumb with the category link; `/en-US/p/cheddar` 200 "Out of stock"; `/en-US/p/nope-nope` 404; `/de-DE/p/bananas-de?sku=BANANAS-1KG` 200.
- Message keys: all under `pdp.*` in both locales; German is a faithful machine translation (see IDEAS).
