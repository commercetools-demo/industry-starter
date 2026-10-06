# N — Weight pricing experience

**Specs:** `grocery-storefront-features` → `weight-pricing-experience` (all); touches `plp-design` (unit price on tiles), `pdp-design`, `cart-design`
**Depends on:** F, J, K, L · **Unblocks:** R, V · **Decisions:** D-030 · **Sign-off:** SO-14

## Goal
Weighed goods show an increment price and a per-kg/per-litre price; carts with approximate-weight lines label the total "provisional"; the order detail can show a recorded final amount.

## Design

### `lib/pricing.ts` (client-safe, pure)
```ts
export interface UnitPrice { money: Money; per: 'kg' | 'l' }
export function unitPrice(price: Price | undefined, inc: Increment): UnitPrice | null;
```
Rules: `inc.unit === 'each'` → `null`; `g` → per kg: `centAmount × (1000 / inc.value)`; `kg` → per kg: `centAmount / inc.value`; `ml` → per l: `centAmount × (1000 / inc.value)`; `l` → per l: `centAmount / inc.value`. Round to nearest cent (`Math.round`). Uses the **discounted** amount when present. `price` undefined → `null`. Examples: €2.40 / 500 g → €4.80 per kg; $3.00 / 1 kg → $3.00 per kg; $1.00 / 250 ml → $4.00 per l.

### UI changes
- `PriceBlock` (K): add second line `€4.80 / kg` (muted 12 px, message `pricing.perKg` / `pricing.perL`) when `unitPrice` is non-null. Pass `increment` prop from tile/PDP/cart.
- PDP (L): increment selector already exists; unit price displays beside the price.
- Cart line (J): show increment label ("500 g") and unit price under the name.
- `components/cart/ProvisionalNotice.tsx` (server-safe): `variant: 'inline' | 'total'`; text `pricing.provisionalNote` ("The final amount depends on the weight we pick."). Replace J's extension point `<ProvisionalNotice/>` in the cart summary: total label becomes "Total (provisional)" (`pricing.totalProvisional`) when `cart.isProvisional`.
- Order detail (R) and confirmation (V) reuse `ProvisionalNotice`; R shows the final amount when order custom field `finalTotal` (Money, custom type `order-final` from F) exists: component `FinalAmount({ provisional: Money, final?: Money })` here in N, rendering "Final amount €X · difference +€Y" (difference = final − provisional with sign). Not rendered when `final` is undefined.
- Quantity is always an integer count of increments (existing stepper behavior).

## Tasks
- [x] N-01 Write `lib/pricing.ts` + tests: all unit conversions above, discounted price used, `each` → null, undefined price → null, rounding half-up on cents.
- [x] N-02 Extend `PriceBlock` to render the unit line + tests (500 g example; `each` shows none; EUR/de-DE formatting).
- [x] N-03 Pass `increment` through tile, PDP and cart line; tests assert the unit price appears in each (render with fixture product).
- [x] N-04 Write `ProvisionalNotice` and wire into the cart summary (total label + note); tests: approximate line → "Total (provisional)" + note; exact lines → "Total", no note.
- [x] N-05 Write `FinalAmount` + tests (difference sign, equal amounts → "No difference", absent → renders nothing).
- [x] N-06 Message keys (both locales); report manual tests M-N-1…M-N-3 and sign-off SO-14.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| 500 g pack / Each item | N-01, N-02 |
| Pick an increment | L-05 + N-03 |
| Approximate line present / Exact lines only | N-04 |
| Final amount recorded | N-05 (+ R integration) |

## Manual tests to report
- M-N-1: Open /en-US/p/bananas (500 g selected) and /en-US/shop: Bananas 500 g shows the price and a muted "€x.xx / kg" line (also on the tile and after switching to 1 kg); Whole milk (each) shows no unit line. Repeat on /de-DE/p/bananas-de: "4,80 € / kg" style.
- M-N-2: Cart with Bananas: summary shows "Total (provisional)" and note; remove Bananas: plain "Total".
- M-N-3 (after R): set order custom field `finalTotal` in Merchant Center/API on a test order: order detail shows final amount and difference.

## Definition of done
`unitPrice` covered; notice appears only for approximate lines; German formatting verified; `verify` passes.

## Implementation notes (deviations, recorded by the developer)
- `UnitPriceLine({ price, increment })` is exported from `components/product/PriceBlock.tsx` next to `PriceBlock`; `PriceBlock` takes an optional `increment` and renders `UnitPriceLine` below the price (the root is now an `inline-flex flex-col`; the tile passes `items-end` so the line right-aligns with the price). The cart line row uses `UnitPriceLine` directly (a cart line has no `PriceBlock`): increment label, then the unit line, under the name. Test id `unit-price` on the line.
- `unitPrice` also returns `null` for a non-positive increment value (guards division by zero); the plan did not list it.
- `ProvisionalNotice({ cart?, variant = 'inline' | 'total' })`: `inline` is the note paragraph, `total` is the label "Total (provisional)". With `cart` it renders only when `cart.isProvisional`; without `cart` (order detail R, confirmation V) it always renders, the caller decides. `CartSummary` shows the `total` variant in place of "Total" for provisional carts.
- `FinalAmount({ provisional, final? })` lives in `components/cart/FinalAmount.tsx` (it was committed together with N-04 by mistake; its tests are in N-05). Difference is shown as `+€1.30` / `-€0.60` (ASCII minus), "No difference" when equal. It assumes both amounts share a currency. Not wired into any page (R owns the order detail and reads the `finalTotal` custom field); the cart mapper does not map `finalTotal` (it is an order field). See Q-N-1.
- Message keys: new top-level namespace `pricing` (`perKg`, `perL`, `provisionalNote`, `totalProvisional`, `finalAmount`, `difference`, `noDifference`) in both locales; `messages/parity.test.ts` lists it in the required namespaces (additive; merges may conflict on that line). German is a faithful machine translation (see IDEAS).
- Existing `plp.*`/`cart.*` keys are untouched. Tests: `lib/pricing.test.ts`, `components/product/{PriceBlock,UnitPriceWiring}.test.tsx`, `components/cart/{ProvisionalNotice,FinalAmount}.test.tsx`; one tile test regex was anchored (`/^2,96\s€$/`) because the tile now also shows a unit line.
- Sign-off SO-14 is owner-only; not set.
