# J — Cart core: API, hooks, bag, availability, toast

**Specs:** `cart-design` (Bag layout, Bag lines, Summary, Empty bag, Unavailable lines), `storefront-design-system` (Bag count, Add-to-bag toast), `storefront-data-loading` (Client state hooks, Hydration, Cart concurrency and totals, Availability-aware cart mutations), `storefront-bff-and-session` (Inventory mode on carts)
**Depends on:** G, H · **Unblocks:** K, L, N, O, Q, R, U, W, V · **Decisions:** D-031, D-037 (guests)
**Skill refs:** `commercetools-storefront` `core/cart.md`

## Goal
A signed-in or anonymous visitor can add, change and remove cart lines; totals are always the server's; stock is checked by the app; the header shows the bag.

## Design

### Types (append to `lib/types.ts`)
```ts
export interface CartLine { id: string; productId: string; sku: string; name: string; slug: string; image?: string; quantity: number; unitPrice: Price; total: Money; increment: Increment; approximateWeight: boolean; substitutionPreference: 'allow-similar' | 'none'; recurrence?: { policyKey: string; priceSelectionMode: 'Fixed' | 'Dynamic' }; availableQuantity?: number; inStock: boolean }
export interface CartSlot { id: string; start: string; end: string; charge?: Money; holdExpires?: string }
export interface Cart { id: string; version: number; currencyCode: string; lines: CartLine[]; itemCount: number /* distinct lines */; subtotal: Money; shipping?: { name?: string; price: Money; free: boolean }; tax?: Money; total: Money; isProvisional: boolean; shippingAddress?: Address; slot?: CartSlot }
```
(`Address` is declared **here** (J owns it; S only uses it): `{ firstName?, lastName?, streetName?, additionalStreetInfo?, postalCode?, city?, country, phone?, email? }`; S extends usage.)

### `lib/mappers/cart.ts` — `mapCart(ctCart, ctx): Cart`
`isProvisional = lines.some(l => l.approximateWeight)`; `approximateWeight` and increment from the line's variant attributes; `substitutionPreference` from `line.custom.fields.substitutionPreference` (default `'none'`); `slot` from cart custom fields `cart-delivery`; `recurrence` from `line.recurrenceInfo`; `shipping.free` = shipping price is 0.

### `lib/ct/cart.ts` (`server-only`)
`getCart(id)` (returns `null` if not Active), `createCart(session)` (uses `newCartDraft` from E; sets `anonymousId` for anonymous), `addLineItem(cartId, version, {sku, quantity, recurrencePolicyKey?, substitutionPreference})` — the line is created with `custom: { type: { key: 'line-substitution', typeId: 'type' }, fields: { substitutionPreference } }`, `changeLineItemQuantity`, `removeLineItem`, `withCartRetry(cartId, fn)` (re-fetch + retry **once** on HTTP 409 `ConcurrentModification`).
`lib/ct/availability.ts`: `getAvailableQuantity(sku): Promise<number>` via the inventory endpoint (`where: sku="…"`), 0 if no entry; never cached.
Default substitution preference: `product.storage === 'chilled'` or category `fresh-produce`/`dairy-eggs`/`bakery` → `allow-similar`, otherwise `none` (function `defaultSubstitutionPreference(product)` in `lib/config/substitution.ts`).

### Routes (validate session → ct → JSON; always return the full mapped `Cart`)
- `GET /api/cart` — no cartId → `{ cart: null }`; non-Active cart → clear `cartId` in session, `{ cart: null }`.
- `POST /api/cart/line-items` `{ sku, quantity, recurrencePolicyKey? }` — quantity integer ≥ 1 else 400; the route loads the product with `getProductBySku` (G) to compute `defaultSubstitutionPreference(product)` and passes it to `addLineItem`; compute `requested = existing line quantity + quantity`; `getAvailableQuantity`; if `requested > available` → **409** `{ error: 'INSUFFICIENT_STOCK', available }`; create cart if none (anonymous allowed) and write `cartId` (and `anonymousId`) to the session.
- `PATCH /api/cart/line-items/[lineId]` `{ quantity }` (same availability rule), `DELETE /api/cart/line-items/[lineId]`.

### Client
- `hooks/useCart.ts` **(client)**: `useCart()` → `useSWR(KEY_CART, fetch /api/cart → cart|null, { revalidateOnFocus: true })`; `useCartMutations()` → `addItem(sku, qty, opts?)`, `setQuantity(lineId, qty)`, `removeLine(lineId)`; each mutation updates the cache from the response (`mutate(KEY_CART, cart, { revalidate: false })`) and **throws `ApiError`** on failure.
- `context/CartProvider.tsx`: exposes `useCart` values + `addItemWithToast` (adds then `toast.show({ message: t('cart.added'), actionLabel: t('cart.viewBag'), href: '/cart' })`; on `INSUFFICIENT_STOCK` shows a message with the available quantity).
- `app/[locale]/layout.tsx` (see D's provider order) fetches `getCart(session.cartId)` on the server and passes it as the `SWRConfig fallback` `{[KEY_CART]: initialCart}`; `CartProvider` sits inside `ToastProvider` and `NextIntlClientProvider`.
- `components/layout/BagButton.tsx` **(client)** (the `bag` slot of the header): primary button, label `Bag` when `itemCount === 0` else `Bag · N` (N = distinct lines, as in the prototype); links to `/cart`.
- Cart page `app/[locale]/cart/page.tsx` (client island inside a server page): H1 "Your bag" (52px); lines (150×180 `Photo`, name h3, line total, stock `Tag` ("In stock"/"Out of stock"), `QuantityStepper`, ghost Remove); sticky summary `Card` (subtotal, delivery with slot placeholder, total in heading font, `Checkout` button **disabled for now** — enabled by V), returns note; empty state; remove shows undo toast ("Removed — Undo" re-adds sku/qty). Extension points for later workstreams: `<CartDeliveryStep/>` (Q), `<SubstitutionControl line/>` (U), `<ProvisionalNotice/>` (N), `<RecurrenceBadge line/>` (W) — render nothing in J.

## Tasks
- [x] J-01 Append cart types; write `lib/mappers/cart.ts` + fixtures + tests (provisional when any approximate line; free shipping flag; default preference `none`; slot mapping; recurrence mapping).
- [x] J-02 Write `lib/ct/availability.ts` + tests (quantity from entry; no entry → 0; mocked root).
- [x] J-03 Write `lib/ct/cart.ts` (`getCart` Active check, `createCart`, `addLineItem` with custom substitution field, quantity/remove, `withCartRetry`) + tests: retry once on 409 then succeed; second 409 throws; non-Active returns null; anonymous cart has `anonymousId`.
- [ ] J-04 Write `lib/config/substitution.ts` (`defaultSubstitutionPreference`) + tests (chilled → allow-similar; ambient household → none).
- [ ] J-05 Write routes `GET /api/cart`, `POST /api/cart/line-items`, `PATCH/DELETE /api/cart/line-items/[lineId]` + tests per route: unauthorized-free (anonymous ok); 400 for bad quantity; 409 `INSUFFICIENT_STOCK` with `available`; cart created on first add and cookie updated; non-Active cart clears session.
- [ ] J-06 Write `hooks/useCart.ts` + tests (mock fetch): read default null; mutation updates cache without refetch; failure throws `ApiError` and cache unchanged.
- [ ] J-07 Write `CartProvider`, `BagButton`, and wire the header `bag` slot and the locale layout's `SWRConfig` fallback; tests: label "Bag"/"Bag · 2"; toast shown on add with "View bag"; insufficient stock message shows available quantity.
- [ ] J-08 Write the cart page UI (no checkout yet) + messages (both locales) + tests: renders lines/totals from the cart; stepper changes call mutation; remove shows undo toast and undo re-adds; empty state with browse link; Checkout disabled with explanation text key `cart.checkoutDisabled`.
- [ ] J-09 Report manual tests M-J-1…M-J-4 and sign-off SO-02 (partly, final in Q).

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Desktop bag / Increase quantity / Remove line / Empty | J-08 |
| Free delivery | J-01 mapper + J-08 summary |
| Out of stock line (inline notice, Checkout disabled) | J-08 (line `inStock:false` shows notice) |
| Bag count / Add-to-bag toast | J-07 |
| Add mutation success / fails | J-06 |
| Version conflict | J-03 |
| Returning customer hydration | J-07 (fallback seeds first paint) |
| Over-ask / Add three / Ask for more than available | J-05 |
| New cart (inventory None) | E-07 + J-03 |

## Manual tests to report
- M-J-1 (needs OA-02, F done): add Whole milk to the bag on `/en-US`; header shows "Bag · 1"; toast appears and disappears after ~3 s.
- M-J-2: Increase quantity above available stock (Cheddar is out of stock): message about availability; cart unchanged.
- M-J-3: Reload the page: bag persists (same browser); open a private window: empty bag.
- M-J-4: Switch to `de-DE` (currency changes): bag is empty (new currency) — expected per spec.

## Definition of done
Cart works end to end for anonymous visitors; totals come only from the server; `verify` passes.
