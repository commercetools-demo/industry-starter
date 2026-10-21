<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream I: Cart

## 1. Header

| Field | Value |
| --- | --- |
| ID | I |
| Name | Cart: API completion, drawer, page, fulfilment groups and switching, discount codes, stock and price notices, region-switch carry-over |
| Depends on | H (collect and subscribe add branches, `buildAddLineAction`), G (cart core `lib/ct/cart.ts`, `useCart`, `useAddToCart`, `CartSummary`), F (shell, store picker, availability, promise figures, `PUT /api/session/market`), plus C, D, E |
| Wave | 6 (alone) |
| Specs implemented (primary first) | `design-cart-drawer` (primary), `design-cart-page` (primary), `cart-management` (generated template, applies), `cart-page` (generated template, applies), `fulfilment-and-availability-model` (extended: "Fulfilment per line" cart side, "Mixed bags" data shape only, "Shipping by market" threshold on the cart, "Tax by market" display), `switching-region-or-language` (completes the cart half started in F) |
| Generated templates that apply | `cart-management`, `cart-page`, `switching-region-or-language` (cart half) |
| Owner prerequisites | OA-x1 (live API client, same as OA-01), SO-x1 (empty-state, nudge and notice copy), SO-x2 (minimum order value, if any). Seed requests (not owner items): `savedToLineItem` on the variant attributes the cart summary shows, and an optional line field `priceWas` (see 3.4 and Q-I-06, Q-I-07). Nothing blocks the build |
| Skills to load first | `commercetools-storefront` (`core/cart.md`, `b2c/optional/promotions.md`, `b2c/optional/bopis.md`), `commercetools-commerce-patterns` (discount stacking, shipping predicates, tax modes), `commercetools-platform` (optimistic concurrency) |
| App and paths | `storefront/` |

## 2. Goal and scope

**Goal.** The bag is where omnichannel becomes visible: one bag, lines grouped by how they reach the shopper (collect per store, shipping, subscriptions), each switchable between collect and ship, with a summary that tells the truth about shipping and tax. **Mixed bags are required (D-033):** one bag may hold collect, ship and subscribe lines at once, and every line is clearly marked inside its own fulfilment cluster (cluster heading, store or delivery line, and a per-line fulfilment badge), in the drawer as well as on the page. Delivery is by standard carrier only (D-034). Collection exists in the US market only (all six stores are in New York City, D-035); in the Canada market the bag has ship and subscribe clusters only and no Collect chip. **Every total shown is read back from the commerce engine after each write**; the storefront never re-computes a total, never patches a local copy and never uses optimistic totals.

**In scope**
- Complete the cart API: full `Cart` view type and mapper, `GET /api/cart`, `PATCH /api/cart` (discount codes, collection store, recalculation), `PATCH` and `DELETE /api/cart/lines/[lineId]` (quantity, fulfilment switch with merge, remove), shipping-method sync so the engine prices shipping, stock and price notices, ownership checks, concurrency retry.
- Cart drawer (440px) mounted in the locale layout and opened from the header cart button.
- Cart page `/[locale]/cart`: fulfilment groups, line rows, chips, warnings, order summary (sticky), discount code form and applied code chips, empty state, minimum order notice, machine and capsule nudge.
- Region-switch carry-over (`rebuildCart`) completing F's market switch, and the dropped-lines notice.
- Cart data shape ready for mixed-bag shipping (workstream K): group keys, per-line fulfilment and store, `shippingMode` constant.

**Explicitly out of scope**
- Choosing the mixed-bag shipping approach (Multiple shipping or one order per group): workstream K. I keeps `CART_SHIPPING_MODE` in `lib/shop-config.ts` and builds only what works in either mode (3.8).
- Checkout, addresses, shipping method choice by the shopper, payment, order creation, gift note storage (K). The summary's gift-note line is a prompt that links to checkout.
- Saved carts and saved items (L), cross-sell merchandising beyond the machine and capsule nudge, cost centres, quotes, purchase lists (B2B, excluded).
- Cart merge on sign-in (J).

## 3. Design

### 3.1 Files

| Path | Kind | Purpose |
| --- | --- | --- |
| `lib/types.ts` additions | types | `Cart`, `CartLine`, `CartGroup`, `AppliedCode`, `CartNotice` |
| `lib/ct/cart.ts` (G's file, I extends) | server-only | `getCartView`, `changeQuantity`, `removeLine`, `switchFulfilment`, `changeCollectionStore`, `applyDiscountCode`, `removeDiscountCode`, `syncShippingMethod`, `refreshPrices`, `rebuildCart` |
| `lib/ct/cart-enrich.ts` | server-only | Batched projection and inventory reads for lines |
| `lib/mappers/cart.ts` | pure | `mapCart(ctCart, enrichment, ctx): Cart` |
| `lib/cart/plan.ts` | pure | `planFulfilmentSwitch`, `planStoreChange`, `groupKeyOf`, `groupLines` |
| `lib/cart/summary.ts` | pure | `variantSummary`, `taxLabel`, `freeShipping`, `minimumOrder`, `blockers` |
| `lib/cart/discount-reasons.ts` | pure | Code state and error reason to i18n key |
| `app/api/cart/route.ts` (GET from G, add PATCH) | handler | |
| `app/api/cart/lines/[lineId]/route.ts` | handler | PATCH, DELETE |
| `hooks/useCart.ts` (G's, extend), `hooks/useCartMutations.ts` | client | |
| `components/cart/CartDrawer.tsx`, `DrawerLine.tsx`, `FreeShippingProgress.tsx` | client | Drawer |
| `components/cart/CartPage.tsx` (client), `app/[locale]/cart/page.tsx` (server, passes `initialCart`) | mix | Page |
| `components/cart/FulfilmentGroup.tsx`, `CartLineRow.tsx`, `FulfilmentChips.tsx`, `LineNotice.tsx`, `QuantityStepper.tsx` | client | Lines |
| `components/cart/OrderSummary.tsx`, `DiscountCodeForm.tsx`, `AppliedCodes.tsx`, `GiftNotePrompt.tsx` | client | Summary |
| `components/cart/EmptyCart.tsx`, `CompanionNudge.tsx`, `DroppedLinesNotice.tsx` | client | |
| `context/shell-ui-context.tsx` (F's), `app/[locale]/layout.tsx` | | Mount `CartDrawer`, implement `openCart/closeCart` |

### 3.2 `Cart` view type (what the UI and K read)

```ts
export type Fulfilment = 'collect' | 'delivery' | 'subscribe';
export type GroupKey = `collect:${string}` | 'delivery' | 'subscribe';   // collect:<storeKey>
export interface CartLine {
  id: string; sku: string; productId: string; slug: string; name: string;
  imageUrl?: string; imageAlt: string;
  variantSummary: string;                           // "Intensity 8 · 10 capsules", "250 g · Whole bean"
  quantity: number;
  unitPrice: Money; oldUnitPrice?: Money;          // engine line price, struck old when discounted
  total: Money;                                      // engine lineItem.totalPrice, verbatim
  fulfilment: Fulfilment;                            // custom field mcf-line-fulfilment.fulfilment (falls back to derivation)
  groupKey: GroupKey;
  store?: { key: string; id: string; name: string; addressLine: string; city: string; collectionMinutes: number };
  recurrence?: { policyId: string; label: string; firstDeliveryBy?: string };
  collectAtSessionStore?: { storeKey: string; state: AvailabilityState } | null;   // for ship lines, to enable the Collect chip
  notices: LineNotice[];                              // 'price-updated' | 'out-of-stock' | 'collect-unavailable' | 'quantity-exceeds-stock'
  maxQuantity: number;
}
export interface AppliedCode { id: string; code: string; name?: string; state: 'MatchesCart'|'NotActive'|'DoesNotMatchCart'|'MaxApplicationReached'|'ApplicationStoppedByPreviousDiscount'|'NotValid'; reasonKey?: string }
export interface Cart {
  id: string; version: number; currency: string; country: string; shippingMode: 'Single'|'Multiple';
  count: number;                                      // totalLineItemQuantity
  lines: CartLine[]; groups: CartGroup[];             // groups in display order: collect stores, ship, subscribe
  subtotal: Money;                                    // see 3.4: sum of engine line totals
  discount: Money | null;                             // positive amount saved (display), null when none
  shipping: { amount: Money; isFree: boolean } | null;   // engine shippingInfo.price, null before a method is set
  tax: { amount: Money; included: boolean } | null;      // engine taxedPrice.totalTax; included = price mode
  total: Money;                                       // engine total (taxedPrice.totalGross when present, else totalPrice)
  codes: AppliedCode[];
  freeShipping: { threshold: Money | null; remaining: Money | null; reached: boolean };
  minimumOrder: { value: Money | null; shortfall: Money | null };
  canCheckout: boolean; blockers: ('empty'|'below-minimum'|'out-of-stock'|'collect-unavailable'|'price-unavailable')[];
}
export interface CartGroup { key: GroupKey; kind: Fulfilment; store?: CartLine['store']; lineIds: string[] }
```

Shared with K: `groupKeyOf(line)` is the only definition of a fulfilment group; K assigns shipping methods per `GroupKey`.

### 3.3 commercetools calls (exact)

Docs: [carts](https://docs.commercetools.com/api/projects/carts), [cart preparation and review](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/cart-preparation-and-review), [carts and orders overview](https://docs.commercetools.com/api/carts-orders-overview), [pricing and discounts overview](https://docs.commercetools.com/api/pricing-and-discounts-overview), [shipping methods](https://docs.commercetools.com/api/projects/shippingMethods). [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns]. All writes: read the latest cart, verify ownership, post the update with its `version`, **render from the response**, retry once on `409` after re-reading (second conflict returns `409 conflict`).

| Operation | Call |
| --- | --- |
| Read | `apiRoot.carts().withId({ ID }).get({ queryArgs: { expand: ['discountCodes[*].discountCode'] } })`. Not `Active` or 404: clear `cartId` and return `null` (skill). Ownership: `cart.anonymousId === session.anonymousId` or `cart.customerId === session.customerId`, else treat as no cart (never leak another shopper's cart; test `Two shoppers`) |
| Enrichment (per view) | one `productProjections().get({ queryArgs: { where: 'id in (...)', staged: false, priceCurrency, priceCountry, localeProjection: [locale], limit } })` for the distinct `productId`s (attributes, slug, product type key via the cached product types, category, current selected price for the notice check) and one `inventory().get({ queryArgs: { where: 'sku in (...)', limit: 500 } })` (F's `getInventoryDetail`) for stock; both skipped for an empty cart; both run with `Promise.all` |
| Change quantity | `changeLineItemQuantity { lineItemId, quantity }` (quantity at least 1; removal is never a quantity of 0) |
| Remove | `removeLineItem { lineItemId }` |
| Switch to ship (no twin) | `setLineItemSupplyChannel { lineItemId }` (no `supplyChannel` field removes it; verify in I-00) plus `setLineItemCustomField { lineItemId, name: 'fulfilment', value: 'delivery' }` |
| Switch to collect (no twin) | `setLineItemSupplyChannel { lineItemId, supplyChannel: { typeId: 'channel', id } }` plus `setLineItemCustomField { ..., value: 'collect' }` |
| Switch with a twin (merge) | `changeLineItemQuantity { lineItemId: twin.id, quantity: twin.quantity + line.quantity }` plus `removeLineItem { lineItemId: line.id }` (one update, atomic, spec "Merge") |
| Discount code | `addDiscountCode { code }`; `removeDiscountCode { discountCode: { typeId: 'discount-code', id } }` |
| Shipping method sync | `setShippingMethod { shippingMethod: { typeId: 'shipping-method', key } }` where key is `mcf-ship-standard` when any line is `delivery` or `subscribe`, else `mcf-collect` (3.8) |
| Price refresh | `recalculate { updateProductData: true }` (docs: needed for variant prices to refresh) |
| Rebuild (region switch, mode change) | new cart through G's `createCart` (the market is fixed at creation), then `addLine` per old line, `addDiscountCode` per old code, then on the old cart `setDeleteDaysAfterLastModification { deleteDaysAfterLastModification: 1 }` |

A line with the same sku, same `supplyChannel`, same custom field values and same `recurrenceInfo` is merged by the platform on `addLineItem`; the switch logic never relies on that for `setLineItemSupplyChannel` (which does not merge), hence the explicit twin search in `planFulfilmentSwitch` (pure, tested): twin = another line with equal sku, equal target fulfilment, equal target supply channel (null for ship) and no `recurrenceInfo`.

### 3.4 Totals: read, never computed

- `total`: `cart.taxedPrice?.totalGross ?? cart.totalPrice` verbatim. `tax.amount`: `cart.taxedPrice.totalTax` verbatim. `shipping.amount`: `cart.shippingInfo.price` verbatim (taxed shipping per market is inside the engine figures).
- `subtotal` and `discount` are **display sums of engine line fields** (there is no cart-level subtotal field): `subtotal = Σ line.totalPrice` (after line and cart discounts allocated to lines by the engine) and `discount = Σ (line.price × quantity − line.totalPrice)`, integers in minor units, `null` when zero. They are not used for any decision and never sent back. A development-only assertion (`process.env.NODE_ENV !== 'production'`) logs when `subtotal + shipping` differs from the net/gross total by more than tax, so drift is noticed.
- **Tax presentation** (scenario "Tax presentation"): `tax.included` is `true` when the lines' tax rate has `includedInPrice` (not used in the US and Canada markets, which both use net prices, D-036; the branch stays for data that sets it); then the summary row reads `cart.summary.taxIncluded` ("Includes {tax} tax") and the total is the engine total; when prices are net (US and Canada), the row reads "Estimated tax" with the engine tax and the total includes it. `taxedPrice` is present because the cart is created with `shippingAddress: { country }` and the project has country-level fallback rates (D-008); when it is absent (should not happen) the row reads "Calculated at checkout" and the total is the engine `totalPrice`. VELA's flat 8.875% never appears.
- **Price and stock change marks** (spec "Stock and price changes"): `GET /api/cart` (drawer and page loads) compares each line's stored `price` with the freshly selected price of the enrichment read. If different, the server runs `refreshPrices` (`recalculate` with `updateProductData: true`), re-reads, and flags the line `price-updated` with the previous unit price; the line shows the new price, the text `cart.notice.priceUpdated` ("Price updated") and the totals are the engine's after recalculation. To keep the mark across reloads, the server writes the previous centAmount into the optional line field `priceWas` of type `mcf-line-fulfilment` (seed request; `setLineItemCustomField`) and clears it when the shopper changes that line's quantity or after 24 hours; if the field does not exist in the type, the mark shows only in the response that detected the change and the gap is recorded (Q-I-06). A line whose item has no online stock (ship/subscribe) or no stock at its store (collect) is flagged `out-of-stock` or `collect-unavailable` and never silently altered.
- **Discount re-evaluation** (templates): codes come from `cart.discountCodes[]` with expanded `discountCode`; the `state` is re-read after **every** mutation (the engine re-evaluates on every line change). Mapping in `discount-reasons.ts`: `MatchesCart` is active; any other state shows the code chip in a muted state with `cart.code.reason.<state>` text (scenario "Discount stops applying") and a Remove button; totals already exclude it.

### 3.5 Route handlers

All: session via `getSession()`; ownership check; errors `{ "error": { "code", "message", "details"? } }`; `Cache-Control: no-store`; writes set the session cookie only when `cartId` changes. Input validated with zod.

| Handler | Request | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/cart?count=1` | none | `200 { count }` (F's, unchanged) | |
| `GET /api/cart` | none | `200 { cart: Cart \| null }` (full view with enrichment and the price check of 3.4) | `502 upstream_unavailable` |
| `PATCH /api/cart` | `{ action: 'applyDiscountCode', code }` or `{ action: 'removeDiscountCode', id }` or `{ action: 'changeCollectionStore', storeKey }` | `200 { cart }` | `400 invalid_request`; `422 code_not_applied` with `details: { reason }` (`DoesNotExist`, `NotActive`, `NotValid`, `DoesNotMatchCart`, `MaxApplicationReached`, `ApplicationStoppedByPreviousDiscount`), cart unchanged and returned in `details.cart`; `409 not_available_for_collection` (per line list in `details.lines`); `400 unknown_store` |
| `PATCH /api/cart/lines/[lineId]` | `{ quantity }` or `{ fulfilment: 'delivery' }` or `{ fulfilment: 'collect', storeKey? }` | `200 { cart }` | `400 invalid_request` (quantity not an integer 1..99); `404 line_not_found`; `409 quantity_exceeds_stock` (`details.available`); `409 store_required` (no `storeKey` and none in the session: client opens the picker and retries); `409 not_available_for_collection`; `422 subscribe_line_not_switchable`; `409 conflict` |
| `DELETE /api/cart/lines/[lineId]` | none | `200 { cart }` (an empty cart returns `{ cart }` with `lines: []`; the session keeps `cartId` so the empty state renders) | `404 line_not_found` |
| `DELETE /api/cart` | not implemented (`405`); the Route Handler table lists it, discount codes are removed through `PATCH` (Q-I-14) | | |

`POST /api/cart/lines` stays G's and H's.

### 3.6 Drawer (spec `design-cart-drawer`)

`CartDrawer` (client, mounted once in `app/[locale]/layout.tsx`; open state in `ShellUiProvider`; `CartButton` calls `openCart`). Uses E's Drawer atom: right side, `width: min(440px, 100vw)`, overlay 42% ink, slide 320ms (none under reduced motion), `role="dialog"` `aria-modal="true"` `aria-labelledby` the title, focus moves to the close button, Tab is trapped, Escape and overlay click close, focus returns to the cart button, body scroll locked.

- **Header**: "Your bag ({count})" (Archivo 700 19px, count in units) and a close icon button (`aria-label` "Close").
- **Free-shipping block** (`FreeShippingProgress`, shared with the page): `freeShipping` from `Cart` (threshold from F's `getFreeShippingThreshold` for the session market, never a constant). Below: `cart.freeShipping.remaining` ("Add {remaining} for free shipping") on a `canvas-2` block, 12.5px, with a 5px teal progress bar (`role="progressbar"` with `aria-valuenow` and a text alternative); at or above: teal check and "You've unlocked free shipping" 13px 600. The progress counts only the lines that will ship (`delivery` and `subscribe` lines), because collection lines do not ship (Q-I-03); a bag with no shippable line hides the block. No threshold in the market (null): the block is not shown.
- **Lines** (`DrawerLine`): image 84x100 (radius 10px, `canvas-2`), name (Archivo 600 14.5px), line total right-aligned (600 14px), variant summary (12.5px `--ink-3`), the **fulfilment line** with icon: collect "Collect at {store}" (teal, store icon), ship "Ship to me" (truck icon, `--ink-3`), subscribe "Delivers every {interval}" (repeat icon), the stepper (pill, minus/plus 14px icons, 38px targets) and a "Remove" link-underline button. Quantity floor (scenario "Quantity floor"): at 1 the minus is `aria-disabled` and does nothing; removal only through Remove. Notices (`LineNotice`, 12.5px, amber for stock, `--ink-2` for price) under the fulfilment line: "Price updated", "Not in stock at {store}, try shipping" (with a Ship button), "Out of stock". While a mutation is pending the line is dimmed, controls `aria-disabled`, and the totals show their previous engine values until the response replaces them (no optimistic totals).
- **Footer** (`--surface`, 1px top border): Subtotal row (600) with `cart.subtotal`; primary lg block "View bag" (Link to `/cart`, closes the drawer); ghost block "Checkout" (Link to `/checkout`, disabled with the reason text when `!canCheckout`). When `blockers` includes `below-minimum` the Checkout button is replaced by the shortfall line.
- **Empty** (scenario "Last line removed"): centred bag icon 40px, "Your bag is empty", a "Start shopping" button (closes the drawer and goes to `/shop`); when the last line is removed the empty state replaces the list **without closing the drawer**.
- **Loading** (first open, no cached cart): three skeleton lines. **Error**: "We couldn't load your bag" with Retry (`mutate`). The count badge never blocks on this.

### 3.7 Cart page (spec `design-cart-page`)

Route `app/[locale]/cart/page.tsx` (server): reads the session, calls `getCartView(session)` and renders `CartPage` with `initialCart` (SWR fallback, no spinner flash); `robots: noindex`. Layout: breadcrumb `Home › Bag`, H1 "Your bag" (Archivo 800 38px, -0.025em), grid `minmax(0, 1.5fr) minmax(0, 0.8fr)`, gap 48px, `align-items: start`; one column at 900px and below with the summary after the lines.

**Groups** (`FulfilmentGroup`), in order, a group with no lines is omitted (scenario "Mixed bag": a machine to ship and capsules to collect render two groups):
- **Collect · {store}** (one group per distinct store key): icon store (accent), heading Archivo 600 17px, "Change store" link-underline (opens the picker; on select calls `PATCH /api/cart { action: 'changeCollectionStore', storeKey }`; lines out of stock at the new store keep their flag), line of address and readiness `cart.group.collectLine` ("{address} · ready in about {n} minutes", n from the store's `collectionMinutes`, F).
- **Shipping to you**: icon truck, heading, line `cart.group.shipLine` ("Free standard over {threshold} · {minDays} to {maxDays} business days", threshold from the market, days from `lib/shop-config.ts`).
- **Subscriptions** (new): icon repeat, heading, line `cart.group.subscribeLine`; each subscribe line shows "Delivers every {interval}" and "First delivery by {day}, then every {interval}" (`deliveryEstimate` from H, same rule as the PDP; Q-I-10).

**Per-line marking (D-033):** every `CartLineRow` and every drawer line carries a visible fulfilment badge (`cart.line.badge.collect` "Collect · {store}", `cart.line.badge.ship` "Ships to you", `cart.line.badge.subscribe` "Every {interval}") with icon and text (never colour alone), and sits inside its cluster; the drawer shows the same clusters with compact headings. In the Canada market the Collect chip, collect clusters and collect badge are never rendered.

**Line row** (`CartLineRow`, page variant): image 96x116, name (Archivo 600 15.5px), line total, variant summary, then the **chip pair** `FulfilmentChips`: Collect and Ship chips (`radiogroup`, active = ink fill, 12px, store/truck icons; hidden for `subscribe` lines, which are switched by changing the subscription on the product page, Q-I-10); stepper (floor 1) and Remove right. Chip behaviour: clicking the inactive chip calls `PATCH /api/cart/lines/[id] { fulfilment }`; the line **moves to the other group** when the response arrives and merges with an identical line when one exists (scenarios "Switch to ship", "Merge"): the merge is decided by the server plan, the UI just renders the response. Switching to Collect without a session store gets `409 store_required` and opens the picker, then retries with the chosen `storeKey`. The Collect chip is `aria-disabled` with the title "Not available for collection at {store}" when `collectAtSessionStore.state === 'out'`. A collect line out of stock at its store shows the amber notice "Not in stock at {store}, try shipping" and a visible Ship chip (scenario "Switch to ship": after switching, the line sits in Shipping and the warning is gone).

**Order summary** (`OrderSummary`): `card` atom (surface, 1px line, 16px radius, 24px padding), `position: sticky; top: 96px`. Title "Order summary" (Archivo 700 18px). Rows (14px, `--ink-2` label, `--ink` value): Subtotal, Discount (negative, teal, only when `discount`), Shipping ("Free" when `isFree`, the engine amount otherwise, "Calculated at checkout" when `shipping === null`), Tax row per 3.4, then a 1px divider and **Total** (700 17px) with the engine total. Then `DiscountCodeForm` (3.9), the **Checkout** button (ink lg block, Link to `/checkout`), the secure note ("Secure checkout", shield icon, 12px), and `GiftNotePrompt` (canvas-2 block, gift icon, "You can add a gift note at checkout" linking to checkout; no storage, K owns it, Q-I-11). When `blockers` has `below-minimum`: the Checkout button is **not rendered** and an amber block states `cart.minimum.shortfall` ("Add {shortfall} to reach the {minimum} minimum order") (template scenario "Below minimum order value"; commercetools does not enforce a minimum, so the rule lives in `lib/cart/summary.ts#minimumOrder` and in K's checkout guard through the same function; the minimum per currency is `MIN_ORDER_VALUE` in `lib/shop-config.ts`, default 0 meaning off, Q-I-02). When `blockers` has stock reasons the button is disabled with the first reason text.

**Empty** (scenarios "Removing the last line", "Empty cart", template "Empty cart"): the whole page body is replaced by a centred block: bag icon 48px, H1 "Your bag is empty", a short line "Let's find something to brew.", and a "Shop coffee" button to `/category/<coffee>` (key `mcf-cat-coffee`); **no summary block with zero totals** is rendered.

**Companion nudge** (`CompanionNudge`, spec "Machine and capsule nudge"): when the bag has at least one machine line whose `system` is `original` or `vertuo` and no pods line of the same system, a one-line canvas-2 strip above the summary: "{machine} needs capsules. Add starter capsules?" with an accent "Add" button; capsule choice comes from H's `getCompatibleCapsules(system, 1)` (the first compatible bestseller, smallest pack, default variant) evaluated on the server in `getCartView` and sent as `cart.nudge: { sku, name, price } | null`; the button calls `POST /api/cart/lines { sku, quantity: 1, fulfilment: 'delivery' }` and the totals update from the response in place (scenario "Starter capsules"). Machines with other systems and bags that already hold compatible capsules show nothing.

**Dropped lines notice** (`DroppedLinesNotice`, template scenario "Product not sellable in the new region"): after a market switch the response of `PUT /api/session/market` carries `droppedLines: { sku, name, reason: 'no-price' | 'unknown' }[]`; the client stores them in `sessionStorage` (`mcf-dropped-lines`) and shows a dismissible banner at the top of the page and the drawer: "{n} items could not be moved to your new region: {names}". Dismiss clears it.

### 3.8 Shipping method sync and the mixed-bag data shape

The engine only prices shipping once the cart has a shipping method. `syncShippingMethod(cart)` runs after every line mutation and uses the plan: any `delivery` or `subscribe` line gives `mcf-ship-standard`, otherwise `mcf-collect`. In `Single` mode this is a cart-level choice, so a mixed bag shows the standard rate for the whole bag and the free-above rule compares against the cart total, which does not match the "ship lines only" progress bar (known gap handled in K, Q-I-04). **I does not decide the mixed-bag approach.** What I guarantees for K: every line carries `fulfilment`, `groupKey` and its `store`; `CART_SHIPPING_MODE` (G, default `'Single'`) is a constant; docs: the shipping mode is set on the cart draft only (`Multiple` allows several methods and `setLineItemShippingDetails`), so changing it means a new cart, which is exactly `rebuildCart` (3.10). Under `Multiple` the summary reads `cart.shipping[]` instead of `shippingInfo`; `mapCart` already sums `shipping[].shippingInfo.price` when `shippingMode === 'Multiple'` (verbatim fields, tested), and `syncShippingMethod` becomes a no-op until K defines `addShippingMethod` calls per group.

### 3.9 Discount code form (`DiscountCodeForm`, applied chips)

Input (pill, label "Discount code", visually hidden label allowed), Apply button; Enter submits. Value trimmed and sent as typed (Q-I-08). Pending: button `aria-busy`. Success: input clears, chip appears, totals update from the response. Rejection (`422 code_not_applied`): inline `role="alert"` message `cart.code.error.<reason>` ("That code isn't valid", "That code has expired", "This code doesn't apply to your bag", "This code has already been used", fallback "We couldn't apply that code"), the cart is shown unchanged (scenario "Discount code rejected"; the server returns the unchanged cart in `details.cart` and the client replaces SWR data with it, so no stale total survives). Applied chips (`AppliedCodes`): code in Roboto Mono, optional name, a remove button `aria-label` "Remove code {code}", muted with the reason when not matching. The seeded codes (`WELCOME10`, `FREESHIP`, `COFFEE15`, SEED-PLAN section 12) are the test data. Code input and reasons never go to logs or analytics.

### 3.10 Region-switch carry-over (`rebuildCart`, completes F)

`rebuildCart(session, oldCart, { country, currency, locale, shippingMode? })` returns `{ cart, dropped }`:
1. New cart through `createCart` with the new market (new currency fixed at creation).
2. For each old line in cart order: **collect** lines keep their store only when that store channel is in the new country (F's channel list), otherwise they become **ship**; **subscribe** lines need a recurring price in the new currency and country for their policy (else dropped); **ship** lines as is. Each goes through `addLine` (G and H branches). `price_unavailable` or `unknown_sku` puts the line in `dropped` with its name and reason; nothing is dropped silently (template scenario).
3. Old discount codes are re-applied one by one; rejections are ignored without a message (codes are market-specific), listed in `dropped` as `{ code }` only when the code was valid in the old cart.
4. Old cart gets `setDeleteDaysAfterLastModification` of 1. The session gets the new `cartId`.
`PUT /api/session/market` (F) calls it when `CART_CARRY_OVER_ENABLED` is true and the old cart has lines, and returns `{ cartCarriedOver: true, droppedLines }`; F's dialog text switches to `locale.cartNotice` (the flag flips in task I-12). The same function migrates carts when `CART_SHIPPING_MODE` changes (K): `getCartForSession` treats an active cart whose `shippingMode` differs from the constant as stale and calls `rebuildCart` with the same market.

### 3.11 Session, cache keys, i18n, states

**Session**: reads `cartId`, `anonymousId`, `customerId`, `country`, `currency`, `locale`, `collectionStoreKey`; writes `cartId` (rebuild, stale clear). **Cache keys**: `KEY_CART` (full `Cart | null`), `KEY_CART_COUNT` (F), updated from every mutation response with `mutate(KEY_CART, cart, { revalidate: false })` and `mutate(KEY_CART_COUNT, { count })`. `useCart` revalidates on focus (skill), seeded with `initialCart` on the page. **Server cache**: none for cart, stock or price (per person); category tree and product types only.

**i18n keys** (two catalogues, identical): `cart.drawer.title` ("Your bag ({count})"), `cart.drawer.close`, `cart.drawer.view`, `cart.drawer.checkout`, `cart.drawer.subtotal`, `cart.drawer.loadError|retry`, `cart.progress.remaining` ("Add {amount} for free shipping"), `cart.progress.unlocked`, `cart.empty.title|line|drawerCta|pageCta`, `cart.page.title|breadcrumb`, `cart.group.collect` ("Collect · {store}"), `cart.group.collectLine`, `cart.group.changeStore`, `cart.group.ship`, `cart.group.shipLine`, `cart.group.subscribe`, `cart.group.subscribeLine`, `cart.line.fulfil.collect|delivery|subscribe`, `cart.line.chip.collect|delivery|collectDisabled`, `cart.line.qty.decrease|increase|label`, `cart.line.remove`, `cart.line.firstDelivery`, `cart.notice.priceUpdated|outOfStock|collectUnavailable|tryShipping`, `cart.notice.quantityLimit` ("Only {n} available"), `cart.summary.title|subtotal|discount|shipping|shippingFree|shippingLater|taxEstimated|taxIncluded|taxLater|total|checkout|secure|gift`, `cart.minimum.shortfall`, `cart.blocker.outOfStock|collectUnavailable|priceUnavailable`, `cart.code.label|apply|remove|chip|error.DoesNotExist|error.NotActive|error.NotValid|error.DoesNotMatchCart|error.MaxApplicationReached|error.ApplicationStoppedByPreviousDiscount|error.generic`, `cart.code.reason.<state>`, `cart.nudge.text|add|added`, `cart.dropped.title|item|dismiss`, `cart.error.conflict|generic|storeRequired`. Money always through `formatMoney`.

**States**: loading skeletons (drawer and page), empty (3.6, 3.7), error banners with retry, pending line dimming, `409 conflict` after the retry shows "Your bag changed, we've refreshed it" and the fresh cart. **Responsive**: 900px page to one column and summary below the lines; 820px padding 20px; at 520px the line row stacks (image, then details), chips wrap; drawer is full width under 440px. **Accessibility**: drawer dialog semantics; steppers have labelled buttons and an `output` with `aria-live="polite"` announcing the new quantity; chips are a `radiogroup`; progress bar semantics; every notice is `role="status"`, code errors `role="alert"`; focus after removing a line moves to the next line's remove button or the empty-state button; all targets at least 38px.

## 4. Tasks

Common rules as in G and H. `npm run check` after each task; commit `ws-i: I-0x ...`.

- [ ] **I-00 Preconditions and platform checks.** With the MCP and the running app verify on the live project: `setLineItemSupplyChannel` without a channel removes it; `addDiscountCode` with a bad code returns `DiscountCodeNonApplicable` with a `reason`; `discountCodes[].state` values; `shippingInfo` appears after `setShippingMethod` with `mcf-ship-standard` and respects `freeAbove`; `taxedPrice` exists for a US cart with `shippingAddress.country` only; whether the line custom type has `priceWas` and which attributes have `savedToLineItem`; `recalculate` with `updateProductData: true` updates a changed price. Record in `plans/evidence/I/mcp-checks.md`; surprises to `PROJECT-FINDINGS.md`; missing seed items to `plans/notes/seed-requests.md`. [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns]
- [ ] **I-01 Types, pure plans and summary rules.** `lib/types.ts`, `lib/cart/plan.ts`, `lib/cart/summary.ts`, `lib/cart/discount-reasons.ts`. Tests: `Switch to ship moves the line to the ship group`, `Merge combines quantities with an identical ship line` (spec "Merge"), `collect twin needs the same store`, `subscribe lines are not switchable`, `group order is collect stores then ship then subscribe`, `variant summary for pods coffee machine accessory` ("Intensity 8 · 10 capsules", "250 g · Whole bean"), `Threshold per market uses the market threshold and currency`, `progress counts only shippable lines`, `Below minimum order value states the shortfall amount`, `minimum zero means off`, `Tax presentation included versus estimated`, `blockers list`.
- [ ] **I-02 Enrichment and mapper.** `lib/ct/cart-enrich.ts`, `lib/mappers/cart.ts`. Tests: `Quantity changed: totals are the engine values verbatim` (total, tax, shipping equal the fixture fields, none recomputed), `subtotal and discount are sums of engine line fields`, `fulfilment read from the custom field and derived when missing`, `collect line gets the store and readiness`, `price-updated flag from price difference`, `out-of-stock and collect-unavailable flags`, `shipping from shippingInfo or from shipping[] in Multiple mode`, `taxedPrice absent gives null tax and engine total`, `one projection call and one inventory call for many lines`, `empty cart makes no enrichment calls`. [SKILL: commercetools-storefront]
- [ ] **I-03 Read, ownership, stale clearing.** `getCartView`, `GET /api/cart`, shipping method sync. Tests: `non active cart clears cartId`, `Two shoppers see only their own cart`, `foreign cart treated as none`, `price check recalculates once and flags the line`, `no check on the count endpoint`, `shipping method standard when any shippable line else collect`, `502 maps to upstream_unavailable`.
- [ ] **I-04 Line mutations.** `changeQuantity`, `removeLine`, `PATCH` and `DELETE /api/cart/lines/[lineId]`, concurrency retry. Tests: `Quantity changed re-reads totals from the cart not client side`, `quantity floor 1 and ceiling 99 and stock clamp`, `quantity_exceeds_stock carries available`, `Double click retries once on 409 and applies once`, `second conflict returns conflict`, `Last line removed returns an empty cart and keeps cartId`, `unknown line 404`.
- [ ] **I-05 Fulfilment switch and store change.** `switchFulfilment`, `changeCollectionStore`, `PATCH /api/cart` `changeCollectionStore`. Tests: `Switch to ship removes the supply channel and sets the field`, `Merge uses one update with quantity change plus remove`, `switch to collect needs a store and stock`, `store_required when no session store`, `change store moves collect lines and merges duplicates`, `lines out of stock at the new store keep the flag`, `ship twin and collect twin are never merged across fulfilment`. [SKILL: commercetools-storefront]
- [ ] **I-06 Discount codes.** `applyDiscountCode`, `removeDiscountCode`, expand of `discountCodes[*].discountCode`. Tests: `Discount code rejected tells why and leaves totals unchanged` (invalid, expired, predicate not met), `applying returns engine totals`, `Discount stops applying shows the reason after the line it depended on is removed`, `remove code`, `code state re-read after every mutation`, `code text never logged`. [SKILL: commercetools-commerce-patterns]
- [ ] **I-07 Hooks.** `hooks/useCartMutations.ts`, extend `useCart` (focus revalidation, `initialCart`). Tests: `mutations update KEY_CART from the response body without a refetch`, `mutations throw on error and keep the previous cart`, `count updated with the cart`, `pending flag per line`.
- [ ] **I-08 Drawer.** `CartDrawer`, `DrawerLine`, `FreeShippingProgress`, `QuantityStepper`, layout mount, `openCart`. Tests: `Below the threshold shows Add remaining for free shipping with a teal bar`, `Threshold reached shows unlocked line`, `Quantity floor keeps 1 and removal only through Remove`, `Last line removed shows empty state without closing`, `Price changed shows the new price with Price updated`, `fulfilment line text per fulfilment`, `focus trap and Escape`, `no optimistic totals while pending`, `empty drawer Start shopping`, `no axe violations`.
- [ ] **I-09 Cart page and groups.** `app/[locale]/cart/page.tsx`, `CartPage`, `FulfilmentGroup`, `CartLineRow`, `FulfilmentChips`, `LineNotice`. Tests: `Mixed bag with collect, ship and subscribe lines shows three clusters each with its own heading and promise`, `every line shows a fulfilment badge inside its cluster (page and drawer)`, `cluster order is collect stores then ship then subscribe`, `switching one line moves only that line between clusters`, `Canada bag has no Collect chip, no collect cluster and no collect badge`, `group per store`, `Switch to ship from a collect line out of stock moves it and clears the warning`, `Merge renders one line with the summed quantity`, `collect chip disabled with title when the session store is out`, `chips hidden for subscribe lines`, `store_required opens the picker and retries`, `initialCart renders without a spinner`.
- [ ] **I-10 Summary, codes, empty, minimum, nudge.** `OrderSummary`, `DiscountCodeForm`, `AppliedCodes`, `GiftNotePrompt`, `EmptyCart`, `CompanionNudge`. Tests: `Tax presentation shows Estimated tax for US and for Canada (GST 5%) and Includes tax only when the rate is included in price`, `Shipping reads Free or the engine amount or Calculated at checkout`, `Empty cart shows the empty state with no summary block`, `Removing the last line renders the empty state`, `Below minimum order value hides Checkout and states the shortfall`, `Starter capsules suggestion adds compatible capsules and totals update in place`, `no nudge for non-capsule machines or when capsules are present`, `sticky summary classes and mobile order`, `no axe violations`.
- [ ] **I-11 Cart-ready for K.** Export `groupKeyOf`, `groupLines`, `CART_SHIPPING_MODE` use, `rebuildCart` signature, document the contract in `lib/cart/README` header comment (not a markdown file: a block comment in `plan.ts`). Tests: `every line has fulfilment groupKey and store for collect`, `Multiple mode maps shipping from shipping[]`, `a bag with collect, ship and subscribe lines yields three groups with the lines assigned to the right group`, `a Canada session cannot create collect lines`.
- [ ] **I-12 Region switch carry-over.** `rebuildCart`, wire into `PUT /api/session/market`, flip `CART_CARRY_OVER_ENABLED` to true, `DroppedLinesNotice`. [SKILL: commercetools-commerce-patterns] Tests: `Region switched with a cart creates a new cart in the new currency and carries over lines with a price`, `Product not sellable in the new region is listed not dropped silently`, `collect lines from another country become ship`, `subscribe lines without a recurring price in the new currency are listed`, `codes re-applied or ignored`, `old cart gets short deletion time`, `Region switched before a cart exists changes nothing in cart`, `notice persists until dismissed`.
- [ ] **I-13 Messages and gates.** Catalogues for 3.11, parity test, `npm run check`, `npm run build` (cart and drawer are dynamic).

## 5. Scenarios checklist

`design-cart-drawer`:
- [ ] Below the threshold: `I-08` test of that name
- [ ] Threshold reached: `I-08`
- [ ] Quantity floor: `I-08`
- [ ] Last line removed: `I-08`
- [ ] Price changed: `I-08`, `I-02` `price-updated flag...`

`design-cart-page`:
- [ ] Mixed bag: `I-09` `Mixed bag shows two groups...`
- [ ] Switch to ship: `I-09`
- [ ] Merge: `I-01` and `I-09`
- [ ] Tax presentation: `I-10`
- [ ] Removing the last line: `I-10`
- [ ] Starter capsules: `I-10`

`cart-management` (template):
- [ ] Quantity changed: `I-04`
- [ ] Discount code rejected: `I-06`
- [ ] Empty cart: `I-10`

`cart-page` (template):
- [ ] Discount stops applying: `I-06`
- [ ] Empty cart: `I-10`
- [ ] Below minimum order value: `I-01`, `I-10`

`fulfilment-and-availability-model` (cart side): Threshold per market `I-01`; Collect line is shown with its store `I-09`; US address without state rate (cart has a tax portion): `I-02` plus browser step 10; Mixed bags data shape `I-11`.

`switching-region-or-language` (cart half): Region switched with a cart, Product not sellable in the new region: `I-12`.

`server-architecture-and-data-flow`: Cart concurrency `I-04`; Two shoppers `I-03`.

## 6. Browser recipe (Chrome DevTools MCP; base `http://localhost:3000`; evidence `plans/evidence/I/`)

Seeded project, viewports 375x812 and 1440x900; console and network clean after every step; no commercetools hosts in the network list. Use US unless stated.
1. Fresh session: header badge hidden. Add a pod (PDP, Ship), a coffee (grind chosen, Ship) and reserve a second pod for collection at Brooklyn. Badge reads the unit total. Click the cart button: drawer opens (440px), "Your bag (n)", progress block "Add {x} for free shipping" with the US threshold (75 per SEED-PLAN), three lines with fulfilment lines "Collect at Brooklyn", "Ship to me". Screenshot `I-01-drawer-1440.png`.
2. In the drawer press minus on a quantity-1 line: stays 1. Press plus: subtotal and line total change after the request returns (no flicker to a client-computed value; assert via `list_network_requests` that `PATCH /api/cart/lines/<id>` returned 200 and the DOM total equals the JSON `cart.total`). Press Remove on a line: it disappears; remove the rest: the empty state replaces the list and the drawer stays open. Screenshot `I-02-drawer-empty-1440.png`.
3. Re-add items until the subtotal of shippable lines passes the threshold: the block becomes "You've unlocked free shipping".
4. Open `/en-US/cart`: breadcrumb, H1, two groups ("Collect · Brooklyn" with address and readiness, "Shipping to you" with threshold and days), chips Collect/Ship active ink, summary sticky (scroll the page and assert `getBoundingClientRect().top` stays about 96). Screenshot `I-03-cart-1440.png`.
5. Switch a collect line to Ship: it moves groups; where the same SKU already existed as a Ship line the quantities merge into one line (read the line count before and after). Switch a ship line to Collect with no store chosen (clear the store cookie first): the store picker opens, choose Brooklyn, the line moves. Pick a store where the SKU is 0 (from the MCP): the Collect chip is disabled with its title. Make a collect line out of stock by changing the store through "Change store" to the empty store: the amber "Not in stock at ..., try shipping" notice shows; press Ship: warning gone. Screenshot `I-04-switch-1440.png`.
6. Discount code: apply `WELCOME10`: chip appears, totals change to the response values; apply `NOPE123`: inline error and totals unchanged; apply `COFFEE15` with a subtotal under the minimum (below 60): the error "doesn't apply to your bag"; add items until it matches, apply, then remove the item it depended on: the chip shows the "no longer applicable" reason and totals no longer include it. Screenshot `I-05-codes-1440.png`.
7. Tax: US shows "Estimated tax" with an amount greater than 0 (also for an address-less cart, country fallback); switch to `/en-CA/cart`: the row reads "Estimated tax" with the engine GST amount (5% on standard goods, 0% on zero-rated food) and totals are in CAD. Compare each total with the `read_carts` totals (section 7).
8. Machine nudge: add only a Vertuo machine: the nudge appears with an Add button; press Add: capsules appear, totals update in place and the nudge disappears. A bean-to-cup machine shows no nudge.
9. Empty page: remove everything on the cart page: "Your bag is empty", "Shop coffee" button, no summary card. Minimum order: set `MIN_ORDER_VALUE.USD` to 3000 in a temporary local override (not committed, `.env`-free: use the test hook `?__min=3000` available only when `NODE_ENV !== 'production'`) with a smaller cart: Checkout is not offered and the shortfall is stated. Screenshot `I-06-minimum-1440.png`.
10. Region switch: with a populated US bag open the locale chooser, choose Canada: dialog says the bag will be moved; confirm: `/en-CA`, the bag still holds the items that have CAD prices, collect lines became ship (the stores are in New York City and Canada is delivery only), no collect cluster is shown, cart page shows CAD totals; a product with no CAD price (if any, otherwise create the case with a price-less SKU from a seed request) is listed in the banner. Switch back with an empty bag: no dialog. Screenshot `I-07-region-1440.png`.
11. 375 viewport: drawer full width; the cart page is one column with the summary after the lines; line row stacks; chips wrap; no horizontal scroll; Tab order in the drawer stays inside. Screenshots `I-08-cart-375.png`, `I-09-drawer-375.png`.
12. Double click: press plus twice quickly: quantity ends at +2 (or +1 plus a refreshed message), never a version error shown; `/api/cart` responses are 200. Open the bag in two tabs and change both: the second shows the refreshed cart.

## 7. Self-verification with data

MCP or read-only script; trimmed results in `plans/evidence/I/mcp-checks.md`.
- After each browser step read the cart (`read_carts` by id from `GET /api/cart` or the session): `lineItems[].supplyChannel`, `custom.fields.fulfilment`, `quantity`, `totalPrice`, `taxedPrice.totalGross`/`totalTax`, `shippingInfo.price`, `discountCodes[].state` equal the UI (ids and amounts only).
- Totals: `cart.totalPrice` or `taxedPrice.totalGross` equals the summary Total in both markets; `shippingInfo.price` is 0 above the market threshold (US 75 USD, Canada 99 CAD) and the seeded standard rate (US 6.95 USD, Canada 8.95 CAD, minor units 695 and 895) below it, for a bag of shippable lines only.
- Tax: US and Canada lines `taxRate.includedInPrice = false`; US 0% food and 8% standard (NY 8.875%, country fallback for an address with no state rate), Canada 0% food and 5% GST standard (SEED-PLAN section 2, D-036).
- Discount codes exist as seeded and their predicates match the behaviour (COFFEE15 over 60 in the market currency).
- Fulfilment merge: after a merge the cart has one line for the SKU (quantity summed) and the removed line id no longer exists.
- Region switch: the new cart has the new currency; the old cart has `deleteDaysAfterLastModification` 1.
- Seed gaps found (missing `savedToLineItem`, `priceWas`, price-less SKU) go to `plans/notes/seed-requests.md`.

## 8. Manual testing and owner items

Rows (also in `plans/notes/todo-I.md`):

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| SO-x1 | Owner | Before release | 1. Read the `cart.*` strings (empty states, nudge, notices, gift note prompt) in `messages/en-US.json` and `messages/en-CA.json`. 2. Approve or edit. | Copy approved | TODO |
| SO-x2 | Owner | Before release | Decide whether a minimum order value applies (per currency, amount); default is none | Value set in `lib/shop-config.ts` or "none" confirmed | TODO |
| M-I-01 | Owner | After I | 1. On a real phone add a pod for collection and a machine to ship. 2. Open the bag, switch lines, apply `WELCOME10`. 3. Compare with `design/export/.../screenshots/cart.png`, `cart2.png`. | Groups, chips and totals read clearly | TODO |
| M-I-02 | Owner | After I | 1. In a real browser change country from US to Canada with a full bag including a collect line. | Bag moves, notice readable, prices in CAD, the collect line became a ship line | TODO |

## 9. Questions

Mirrored in `plans/notes/questions-I.md`.

1. **Q-I-01** Region switch with a populated bag (template open question; also Q-F-03). Default: carry over lines that have a price in the new market, convert collect lines of another country to ship, list everything that could not move.
2. **Q-I-02** Where is the minimum order value configured and is it per store, account or currency (template open question)? Default: a per-currency constant `MIN_ORDER_VALUE` in `lib/shop-config.ts`, 0 meaning off.
3. **Q-I-03** Does the free-shipping progress count collection lines? Default: no, only lines that ship (`delivery`, `subscribe`).
4. **Q-I-04** Single shipping mode prices the whole bag with one method, so a mixed bag shows the standard rate and the free-above rule against the full total. Default: sync `mcf-ship-standard` if any line ships else `mcf-collect`; K's spike K-01 decides how Multiple shipping is done inside the hosted Checkout; "no mixed bags" is not an option (D-033).
5. **Q-I-05** Default `CART_SHIPPING_MODE`. Default: `Single` for bags without a mixed fulfilment; because mixed bags are required (D-033) K clones into a `Multiple` cart when the bag has two or more clusters, or creates every cart as `Multiple` if spike K-01 says so (`rebuildCart` migrates existing carts).
6. **Q-I-06** How to keep "Price updated" across reloads? Default: optional line field `priceWas` (seed request); without it the mark is shown only on the response that detected the change.
7. **Q-I-07** The cart summary needs variant attributes on lines (`savedToLineItem` is false by default). Default: always enrich lines from one batched projection read; seed request to save `system`, `intensity`, `capsulesPerPack`, `sizeGrams`, `grind`, `colour`, `bundle` on the line.
8. **Q-I-08** Discount code casing. Default: send as typed after trim; verify case handling in I-00 and uppercase only if the project's codes are case-sensitive upper case.
9. **Q-I-09** Block checkout when a line is out of stock online or at its collect store? Default: yes, with a reason and the remedy (switch or remove); price changes never block.
10. **Q-I-10** Subscribe lines: no collect/ship chips; what "next date shown" means before the recurring order exists. Default: show the first delivery estimate then the interval; changing the schedule is done on the product page or later in the account (N).
11. **Q-I-11** Gift note: the design prompts for it in the summary. Default: static prompt linking to checkout; storage and cost in K.
12. **Q-I-12** Quantity ceiling per line. Default: 99, clamped to online stock for ship and subscribe and to the store stock for collect.
13. **Q-I-13** The template's "Save cart action" and cross-sell block. Default: not built (saved items are L; the machine/capsule nudge is the only cross-sell).
14. **Q-I-14** The Route Handler table lists `DELETE /api/cart`. Default: unused (405); discount codes use `PATCH /api/cart`; lead to adjust the table.
15. **Q-I-15** Switching to Collect when no store is chosen. Default: open the store picker and retry with the chosen store.

## 10. Definition of done

- I-00 to I-13 ticked with passing `npm run check`; `npm run build` passes; cart routes dynamic.
- Every scenario in section 5 has a named passing test or recorded evidence.
- Browser recipe walked at 375 and 1440 with evidence in `plans/evidence/I/` (screenshots named above, `mcp-checks.md`, `README.md`); console and network clean; UI totals equal the engine totals in both markets.
- No storefront-computed total: `grep -rn "centAmount \*\|reduce(" components/cart lib/mappers/cart.ts` shows only the documented subtotal and discount display sums; no `0.08875` or other tax constants anywhere.
- Exported and described for J, K, L, N: `Cart`, `CartLine`, `GroupKey`, `groupKeyOf`, `groupLines`, `getCartView`, `rebuildCart`, `minimumOrder`, `blockers`, `useCart`, `useCartMutations`, `CartDrawer`.
- `CART_CARRY_OVER_ENABLED` is true and F's market switch carries the bag over.
- SO-x1, SO-x2, M-I-01, M-I-02 in `plans/notes/todo-I.md`; questions Q-I-01 to Q-I-15 in `plans/notes/questions-I.md`; seed requests in `plans/notes/seed-requests.md`.
- `STATUS.md` set to `Ready for review`.
