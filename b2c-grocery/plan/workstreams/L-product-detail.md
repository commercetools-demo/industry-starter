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
- [ ] L-07 Write `RelatedProducts` and `Reviews` + tests (related excludes current product, max 4; reviews returns nothing without data).
- [ ] L-08 Compose the page in two columns at `desktop` (`1.15fr/1fr`, gap ≈ 49 px), buy box sticky `top-[110px]`; single column at `<desktop`. Add message keys (both locales). Test breadcrumbs (Home / Shop / Category / Product).
- [ ] L-09 Report manual tests M-L-1…M-L-4.

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
- M-L-1: Bananas: selector shows 500 g / 1 kg; picking 1 kg changes price and URL `?sku=`.
- M-L-2: Cheddar (out of stock): "Out of stock", Add to bag disabled.
- M-L-3: Add 2 Whole milk: toast, header count updates; reload keeps the bag.
- M-L-4: Compare to design at 1440 px and 390 px (stacked, gallery first).

## Definition of done
Selectors come only from attributes (no hard-coded Finish/Size/Fitting); not-found path works; both locales; `verify` passes.
