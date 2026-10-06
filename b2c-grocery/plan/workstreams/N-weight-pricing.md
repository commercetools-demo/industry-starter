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
- [ ] N-04 Write `ProvisionalNotice` and wire into the cart summary (total label + note); tests: approximate line → "Total (provisional)" + note; exact lines → "Total", no note.
- [ ] N-05 Write `FinalAmount` + tests (difference sign, equal amounts → "No difference", absent → renders nothing).
- [ ] N-06 Message keys (both locales); report manual tests M-N-1…M-N-3 and sign-off SO-14.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| 500 g pack / Each item | N-01, N-02 |
| Pick an increment | L-05 + N-03 |
| Approximate line present / Exact lines only | N-04 |
| Final amount recorded | N-05 (+ R integration) |

## Manual tests to report
- M-N-1: Bananas 500 g shows price and "/ kg"; Whole milk shows no unit line.
- M-N-2: Cart with Bananas: summary shows "Total (provisional)" and note; remove Bananas: plain "Total".
- M-N-3 (after R): set order custom field `finalTotal` in Merchant Center/API on a test order: order detail shows final amount and difference.

## Definition of done
`unitPrice` covered; notice appears only for approximate lines; German formatting verified; `verify` passes.
