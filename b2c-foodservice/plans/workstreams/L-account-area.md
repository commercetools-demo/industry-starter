<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream L: Account area

Paths are relative to `storefront/` unless they start with `plans/` or `seed/`. Read `plans/JUNIOR-GUIDE.md` first. Real exports of other workstreams are used as written in their plan files (`D-server-core.md`, `F-shell-and-pickers.md`, `G-browse.md`, `J-auth-and-session.md`, `K-checkout-and-confirmation.md`). If a real export differs from this plan, use the real one and say so in your hand-off. Workstream I (cart page) is planned separately; its cart module is reached through G's `lib/ct/cart.ts` (`getCartForSession`, `createCart`, `addLine`) until I's names are known (task L-00 writes the real ones to `plans/evidence/L/paths.md`).

## 1. Header

| Field | Value |
| --- | --- |
| ID | L |
| Name | Account area: shell, orders, order detail, collection, saved items, addresses, payment methods, profile, settings |
| Depends on | J (sign-in, `useAccount`, `requireCustomerPage`, `domainError`), K (`OrderView`, `lib/ct/orders.ts`, `OrderStatusTrack`, `seed:order`) |
| Wave | 9 (parallel with M) |
| Primary spec | `design-account-area` |
| Also implements | `account-dashboard`, `account-and-self-service`, `address-book`, `order-history`, `saved-lists`, `post-purchase-order-management`, `payment-methods` (all generated templates, adapted to B2C as stated here) |
| Read for context | `design-tokens-and-components`, `server-architecture-and-data-flow`, `fulfilment-and-availability-model` (order states, stores), `design-product-card` (saved grid) |
| Excluded for B2C by the templates themselves | pending approvals, outstanding invoices, quick order (dashboard); sharing a list with other users (saved-lists); net terms and credit line (payment-methods) |
| Not applicable | the "tokenization form" half of `payment-methods` (D-039: card entry only inside the hosted Checkout); `subscriptions-and-recurring-orders` (N); address validation service (no service chosen, Q-L-05; an adapter is built) |
| Skills | `[SKILL: commercetools-storefront]` (`core/shopping-lists.md`, `b2c/wishlists.md`, `core/customer-auth.md`), `[SKILL: commercetools-checkout]` (`stored-payment-methods` facts), `[SKILL: commercetools-platform]` (customers, orders, payment methods) |
| Owner prerequisites (lead numbers the rows) | `OA-L-a` scopes on the storefront API client: `manage_customers` (already for J), `manage_orders` (already for K), `manage_shopping_lists` (or the Frontend template's equivalent), `view_payments`/`manage_payments` for payment methods. `OA-L-b` stored payment methods enabled in the Checkout Application and supported by the chosen connector (only needed for L-10 live proof). `SO-L-a` copy of the Collection tiles and the delete-account text (legal). `SO-L-b` returns policy and window |

## 2. Goal and scope

**Goal.** A signed-in shopper sees their current orders and collection status first, and can manage everything about themselves without support: saved collection store, saved items, addresses, saved payment methods (as far as the hosted Checkout offers them), profile and account deletion. There is no email, so no notification preferences (D-032). The Collection tab and the collect parts of orders exist for the US market only; in the Canada market (delivery only) the Collection tab is hidden (D-035). Every panel loads and fails on its own and has an explicit empty state.

**In scope**
- Account shell with eyebrow, H1 "Hi, {first}", a status line, vertical tab list (horizontal scroller under 900px), sign out; auth guard with the destination preserved.
- Tabs: Orders (+ order detail with deliveries and returns, Buy again), Collection (US market only), Subscriptions (stub, N fills it), Saved, Addresses, Payment methods, Reviews (a link slot; M fills it), Profile, Settings.
- Server saved items (replaces G's session-storage `useSavedItems` implementation) with add-all-to-bag.
- Address book with default handling, checkout integration (K reads it).
- Handlers `/api/orders` (list), `/api/orders/[id]` (extended), `/api/orders/[id]/reorder`, `/api/orders/[id]/returns`, `/api/shopping-lists`, `/api/account/*`.
- Dev tooling to move an order through shipped, delivered, returned states (`seed:order` subcommands).

**Out of scope**
- Subscriptions content (N), reviews content (M), loyalty (not offered, `design.md` Q7), SMS alerts (no provider), a payment method **add** form (hosted Checkout only), net terms, B2B, order cancellation, invoice PDFs, store-side tools to mark orders ready (Merchant Center).
- Address validation by a third-party service (adapter only).

## 3. Design

### 3.1 Files

| File | Purpose |
| --- | --- |
| `app/[locale]/account/(shell)/layout.tsx` | Server layout: `requireCustomerPage(pathname)`, renders `AccountShell`. The route group `(shell)` keeps J's pages (`/account/sign-in`, ...) outside the guard; URLs are unchanged |
| `app/[locale]/account/(shell)/page.tsx` | `redirect` to `/account/orders` |
| `.../(shell)/orders/page.tsx`, `orders/[orderNumber]/page.tsx` | Orders list, order detail |
| `.../(shell)/collection/page.tsx`, `subscriptions/page.tsx` (stub, N replaces), `saved/page.tsx`, `addresses/page.tsx`, `payment-methods/page.tsx`, `reviews/page.tsx` (stub, M replaces), `profile/page.tsx`, `settings/page.tsx` | Tabs |
| `components/account/AccountShell.tsx`, `AccountTabs.tsx`, `AccountHeader.tsx`, `PanelState.tsx` (loading, empty, error wrappers) | Shell parts |
| `components/account/orders/OrderCard.tsx`, `OrderStatusPill.tsx`, `OrderList.tsx`, `OrderFilters.tsx`, `OrderDetail.tsx`, `DeliveryList.tsx`, `ReturnDialog.tsx`, `ReturnList.tsx` | Orders |
| `components/account/CollectionTab.tsx`, `SavedTab.tsx`, `AddressesTab.tsx`, `AddressCard.tsx`, `AddressForm.tsx`, `AddressVerifyDialog.tsx`, `PaymentMethodsTab.tsx`, `ProfileForm.tsx`, `PasswordForm.tsx`, `SettingsTab.tsx`, `DeleteAccountDialog.tsx` | Tabs |
| `lib/account/order-status.ts` | Pure: `deriveOrderStatus(order)`, `canReturn(order, now)` |
| `lib/account/address-policy.ts` | Pure: `DEFAULT_ADDRESS_AFTER_DELETE`, `afterDeleteDefault(addresses, deletedId)` |
| `lib/account/address-verifier.ts` | Adapter port `AddressVerifier`, `noopVerifier` |
| `lib/ct/orders.ts` (extend K's), `lib/mappers/order.ts` (extend) | List, detail with deliveries and returns, returns write |
| `lib/ct/customer.ts`, `lib/ct/addresses.ts` | Profile, password, delete; address book |
| `lib/ct/shopping-lists.ts`, `lib/mappers/shopping-list.ts` | Saved items |
| `lib/ct/payment-methods.ts`, `lib/mappers/payment-method.ts` | Stored payment methods |
| `lib/ct/reorder.ts` | Pure plan plus server execution of Buy again |
| `app/api/orders/route.ts`, `orders/[id]/reorder/route.ts`, `orders/[id]/returns/route.ts` | Handlers |
| `app/api/shopping-lists/route.ts`, `shopping-lists/add-to-cart/route.ts` | Saved items |
| `app/api/account/summary/route.ts`, `profile/route.ts`, `password/route.ts`, `addresses/route.ts`, `addresses/[id]/route.ts`, `payment-methods/route.ts`, `payment-methods/[id]/route.ts`, `delete/route.ts` | Account handlers |
| `hooks/useOrders.ts`, `useOrder.ts`, `useAddresses.ts`, `useSavedItems.ts` (replaces G's implementation, same exported API), `usePaymentMethods.ts`, `useProfile.ts`, `useAccountSummary.ts` | SWR hooks |
| `lib/cache-keys.ts` | Append `keyAccountSummary(customerId)`, `keyPaymentMethods(customerId)`; D already has `keyOrders`, `keyOrder`, `keyAddresses`, `keySavedItems` (add filter and page as extra tuple elements) |
| `seed/src/...` | Extend `seed/src/scripts/order-ops.ts` (K) with `ship`, `deliver`, `return` subcommands (L-14) |
| `messages/*.json` | Namespace `account` (3.10) |

### 3.2 Visual design (from `AccountPage` in `pages-account.jsx`, `styles.css`; screenshot `screenshots/account.png`)

Tokens only; ignore the prototype's raw colours and its hard-coded "Maya", "VELA Move", "1,240 points".

- **Shell.** `main.wrap`, bottom padding 80px, header block padding `28px 0 24px`: eyebrow "My account" (11px uppercase `--ink-3`), H1 "Hi, {first}" (Archivo 800, 36px, `-0.025em`), one status line in `--ink-3`: "{n} open orders · {m} ready for collection" (each count is its own panel: shows "Orders unavailable" when that query failed, "No open orders" at zero). The loyalty text is omitted (Q-L-06).
- **Grid.** `220px 1fr`, gap 40px, `align-items: start`; under 900px one column, gap 24px.
- **Tabs** (`AccountTabs`, a `nav` with `aria-label` "Account"): links with icon (18px) and label, padding `12px 14px`, 10px radius, 14px weight 500 `--ink-2`; hover tint `rgba(25,23,65,.05)` via token alpha; active: `--ink` fill, white text, `aria-current="page"`. Order: Orders, Collection, Subscriptions, Saved, Addresses, Payment methods, Reviews, Profile, Settings, then Sign out (muted, `button`, top margin 8px). Under 900px: `flex-direction: row`, `overflow-x: auto`, gap 6px, scroll-snap, the active tab scrolled into view on mount (`scrollIntoView({inline:'center', block:'nearest'})`), no wrapping, 44px minimum target height.
- **Cards** use the `Card` atom (16px radius, 24px padding, 1px `--line`). Section H2 22px Archivo 700 above content, 18px bottom margin.
- **Order card** (`OrderCard`, props `{ order: OrderListItem; onReorder(id): void; onDirections?(): void }`): top row: number in Archivo 700 (link to detail), date and total 12.5px `--ink-3`; right: `OrderStatusPill` (pill, 12.5px weight 600, 6px 12px padding, 13px icon: store icon for collect orders, truck for ship; colours: `ready` teal on teal-tint, `completed` `--ink-2` on `--canvas-2`, all others `--accent` on accent-tint). Below: 52x62 thumbnails (radius 8, `--canvas-2`), up to 5 plus "+n". When `ready`: a teal-tint block with store icon: "Ready at {store} · {hours}. Bring your ID and this order number." Buttons: "View details" (ghost), "Buy again" (ghost, when `completed`), "Get directions" (accent, when `ready`, external link `rel="noopener noreferrer"` `target="_blank"`, URL built from the store's `geoLocation`: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`).
- **Order detail**: breadcrumb "Orders / {number}", the number as H1 (mono), `OrderStatusTrack` (from K) when the order has collect lines, `CollectionCard` like K's, `DeliveryList` (3.3), items list, totals, returns block.
- **Address card** (`AddressCard`): the `.store-opt` pattern as in checkout (radio-looking, but selection means "default"): label H4 (nickname), "Default" pill, name, line, phone, actions Edit, Delete (link buttons), "Make default" when not default.
- **Modal** (E atom): 560px, 24px radius, focus trap, Escape closes, returns focus to the opener.
- **375px**: single column, cards full width, buttons wrap to full width under 520px; tab strip scrolls.

### 3.3 Contracts

Types (add to `lib/types.ts`; reuse K's `OrderView`, J's `AppAddress`, `AppCustomer`):

```
type OrderStatusKind = 'ordered' | 'preparing' | 'ready' | 'shipped' | 'completed' | 'cancelled'
type OrderListItem = { id: string; orderNumber: string; createdAt: string; totalCents: number; currency: string
  status: OrderStatusKind; hasCollect: boolean; hasShip: boolean
  thumbs: { imageUrl: string | null; name: string }[]; itemCount: number
  collect: { storeName: string; hours: string | null; lat: number | null; lng: number | null } | null }
type OrderDetailView = OrderView & { status: OrderStatusKind
  deliveries: { id: string; createdAt: string; carrier: string | null; trackingId: string | null; trackingUrl: string | null; items: { lineId: string; name: string; quantity: number }[] }[]
  returns: { id: string; createdAt: string; trackingId: string | null
             items: { id: string; lineId: string; name: string; quantity: number; reason: string | null; shipmentState: 'Advised'|'Returned'|'BackInStock'|'Unusable'; paymentState: 'NonRefundable'|'Initial'|'Refunded'|'NotRefunded' }[] }[]
  canReturn: boolean; returnWindowEndsAt: string | null }
type SavedItem = { productId: string; variantId: number | null; lineItemId: string; addedAt: string; product: ProductSummary }   // G's ProductSummary
type PaymentMethodView = { id: string; version: number; label: string; method: string; isDefault: boolean }
```

Handlers (all `handle(route, fn)`, `dynamic = 'force-dynamic'`, `requireCustomer()` first: no session gives D's 401 with no detail; ownership checked in code against `session.customerId`; unknown and foreign resources both answer `404 not_found` with the identical body; domain codes through J's `domainError`):

| Handler | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/account/summary` | none | `200 { openOrders: number\|null, readyForCollection: number\|null, savedItems: number\|null }`, each `null` when its own query failed or exceeded 2 s (three independent promises) | none (partial failure is data) |
| `GET /api/orders?filter=all\|in-progress\|ready\|completed&limit=10&offset=0` | query | `200 { orders: OrderListItem[], total, limit, offset }` newest first, whole history paged (limit 1 to 50) | `400 bad_request` |
| `GET /api/orders/[id]` | none | `200 { order: OrderDetailView }` (extends K's handler) | `404 not_found` |
| `POST /api/orders/[id]/reorder` | none | `200 { added: {sku,name,quantity,fulfilment}[], skipped: {sku,name,reason:'unavailable'\|'out_of_stock'\|'not_found'\|'price_missing'}[], cart: CartSummary }` | `404` |
| `POST /api/orders/[id]/returns` | `{ items: { lineId: string, quantity: number, reason?: string }[] }` | `200 { order: OrderDetailView }` | `409 return_window_closed`, `409 not_returnable`, `422 validation_failed` |
| `GET /api/shopping-lists` | none | `200 { list: { id: string, version: number, items: SavedItem[] } \| null }` | |
| `POST /api/shopping-lists` | `{ productId: string, variantId?: number }` or `{ fromCart: true }` or `{ merge: string[] }` (product ids from the guest `sessionStorage`) | `200 { list }` | `422 validation_failed`, `409 list_full` (250 lines) |
| `DELETE /api/shopping-lists?productId=<id>` | query | `200 { list }` | |
| `POST /api/shopping-lists/add-to-cart` | none | `200 { added: [...], skipped: [{ productId, name, reason }], cart: CartSummary }` (list unchanged) | `409 list_empty` |
| `GET /api/account/addresses` | none | `200 { addresses: AppAddress[] }` | |
| `POST /api/account/addresses` | `{ address: AddressInput, makeDefault?: boolean }` | `201 { addresses }` | `422 validation_failed` with `fields`, `409 address_needs_confirmation` with `{ unresolved: string[], suggestion?: AddressInput }` (verifier said no) |
| `PATCH /api/account/addresses/[id]` | `{ address: AddressInput, makeDefault?: boolean }` | `200 { addresses }` | `404`, `422`, `409` as above |
| `DELETE /api/account/addresses/[id]` | none | `200 { addresses, promotedId: string\|null }` | `404` |
| `GET /api/account/profile` | none | `200 { profile: { firstName, lastName, email, phone: string\|null, defaultShippingAddressId: string\|null } }` | |
| `PATCH /api/account/profile` | `{ firstName?, lastName?, phone?, defaultShippingAddressId? }` | `200 { profile }` | `422` |
| `POST /api/account/password` | `{ currentPassword, newPassword }` | `200 { ok: true }` | `422 password_policy` `{failed}`, `400 current_password_invalid`, `429 rate_limited` |
| `GET /api/account/payment-methods` | none | `200 { methods: PaymentMethodView[], hostedOnly: true }` | `502 upstream_unavailable` |
| `DELETE /api/account/payment-methods/[id]` | none | `200 { methods }` | `404` |
| `POST /api/account/payment-methods/[id]/default` | none | `200 { methods }` | `404` |
| `POST /api/account/delete` | `{ confirmPassword: string }` | `200 { ok: true }` and the session is cleared | `400 current_password_invalid`, `429` |

`AddressInput` is K's address shape plus `label` (nickname). All address fields are validated with K's `lib/checkout/validate.ts` functions (import them, do not copy), phone optional here.

### 3.4 Exact commercetools calls (server only)

Load `[SKILL: commercetools-storefront]`, `[SKILL: commercetools-platform]` (and `[SKILL: commercetools-checkout]` for L-10) and confirm each call with `scripts/docs-search.mjs` or the Knowledge MCP; record differences in `plans/PROJECT-FINDINGS.md`. Update calls use D's `updateWithRetry`.

**Orders list.** `apiRoot.orders().get({ queryArgs: { where: 'customerId=:id', 'var.id': customerId, sort: 'createdAt desc', limit, offset, withTotal: true, expand: ['state', 'lineItems[*].supplyChannel'] } })`. Docs https://docs.commercetools.com/api/projects/orders#query-orders. Filters add predicates (ids of the four `mcf-order-*` states come from a public cached lookup `getOrderStateIds()` in `lib/ct/orders.ts`, `cachedPublic('project', ...)`; do not hard-code ids): `ready` = `state(id="<readyId>")`; `completed` = `(state(id="<collectedId>") or shipmentState="Delivered")`; `in-progress` = `not(state(id="<collectedId>")) and not(shipmentState="Delivered") and orderState!="Cancelled"`. The orders endpoint is project-wide, so the `customerId` predicate is mandatory and tested; the detail read checks `order.customerId === session.customerId` and returns 404 otherwise. Guest orders attached by J (`anonymousId`) carry the customer id after sign-in and appear.

**Order detail.** `apiRoot.orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: [...K's expands] } })`; mapper adds `deliveries` from `order.shipping[*].shippingInfo.deliveries` or `order.shippingInfo.deliveries` (each `Delivery`: `id`, `items: [{ id /* line item id */, quantity }]`, `parcels[*].trackingData`: `trackingId`, `carrier`, `provider`) and `returns` from `order.returnInfo[*]` (`returnTrackingId`, `returnDate`, `items[*]`: `id`, `quantity`, `lineItemId`, `comment`, `shipmentState`, `paymentState`). Docs https://docs.commercetools.com/api/projects/orders#delivery, https://docs.commercetools.com/api/projects/orders#returninfo. Partial shipment (two deliveries with different `items`) renders one block per delivery.

**Start a return.** `apiRoot.orders().withId({ ID }).post({ body: { version, actions: [{ action: 'addReturnInfo', returnTrackingId?, returnDate: <now ISO>, items: [{ quantity, lineItemId, comment: reason, shipmentState: 'Advised' }] }] } })`. Docs https://docs.commercetools.com/api/projects/orders#add-returninfo. The My Orders API is read-only, so this runs on the server after the ownership check; quantity may not exceed the line quantity minus already returned quantity (computed from `returnInfo`). The two state machines are shown as two chips and are never merged into one status.

**Eligibility** (`canReturn`): `status === 'completed'` (collected, or `shipmentState === 'Delivered'`), at least one line with returnable quantity, and `now - completedAt <= RETURN_WINDOW_DAYS` where `completedAt` is `order.lastModifiedAt` (approximation, recorded in findings) and `RETURN_WINDOW_DAYS` is a named constant in `lib/shop-config.ts` (append, default 30, Q-L-08).

**Reorder / Buy again** (design wins over the template: lines are added to the current bag, not a replacement cart, Q-L-09). For each order line: skip when the SKU is no longer purchasable (product unpublished or not found: `apiRoot.productProjections().withId().get()` / by SKU lookup through G's search wrapper), has no price for the session market (`price_missing`), or is out of stock for its fulfilment (online inventory for `ship`, the **current** collection store's inventory for `collect` using F's `lib/ct/inventory.ts`; `out_of_stock`). Add the rest with G's `addLine` (quantity as ordered, same fulfilment, `collect` lines use the current `collectionStoreKey`; a `collect` line with no store chosen is added as `ship` and reported as `fulfilment` in `added`). Subscribe lines are re-added as `ship` (one-off), never as recurring (N owns subscriptions). The response lists `added` and `skipped`; the UI toast says how many were added and a dialog names every skipped line with its reason.

**Saved items** (B2C wishlist pattern, skill `b2c/wishlists.md`): one default list per customer, name `{ 'en-US': 'Saved items', 'en-CA': 'Saved items' }`, key `mcf-saved-<customerId>` (the seed's `mcf-saved-maya` is the same pattern; read it, do not duplicate it: find the customer's list with `apiRoot.shoppingLists().get({ queryArgs: { where: 'customer(id=:c)', 'var.c': customerId, expand: ['lineItems[*].variant'], limit: 1 } })`). Create: `apiRoot.shoppingLists().post({ body: { name, key, customer: { typeId: 'customer', id } } })` with no `store` field. Add: `addLineItem { productId, variantId?, quantity: 1 }`; remove: `removeLineItem { lineItemId }`. Ownership check after every single read (`list.customer?.id === customerId`, else 404). The list holds at most 250 line items (`409 list_full`). Products for display come from G's product reads by the list's product ids (price in the session market), not from the list (a list line carries no price). **Merge**: on sign-in the client posts the guest `sessionStorage` ids (`{ merge: [...] }`); duplicates are ignored. G's `useSavedItems` keeps its exported API; the signed-out implementation stays `sessionStorage`. **Add all to bag**: one call per line to G's `addLine` (default fulfilment `delivery`; the list's `addShoppingList` cart action is not used because it cannot set the line's `fulfilment` custom field or check stock); lines that fail are collected as `skipped` with a reason and the others stay in the bag; the list is unchanged. **Create a list from the bag**: `{ fromCart: true }` adds each bag line's product (empty list case only).

**Addresses.** Add: `apiRoot.customers().withId({ ID }).post({ body: { version, actions: [{ action: 'addAddress', address: { ...draft, key: 'addr-<random>', additionalAddressInfo: label } }, { action: 'addShippingAddressId', addressKey }, { action: 'addBillingAddressId', addressKey }, ...(makeDefault ? [{ action: 'setDefaultShippingAddress', addressKey }, { action: 'setDefaultBillingAddress', addressKey }] : [])] } })` in **one** update, so no partially saved state is visible and the address is a legal delivery target (an address absent from `shippingAddressIds` is not). Change: `changeAddress { addressId, address }`. Delete: `removeAddress { addressId }`. Default after deleting the default: `lib/account/address-policy.ts` exports `DEFAULT_ADDRESS_AFTER_DELETE: 'promote' | 'none'` (default `'promote'`, Q-L-02) and `afterDeleteDefault(addresses, deletedId)`; when `promote`, the handler appends `setDefaultShippingAddress { addressId: <next> }` (and billing) to the same update and returns `promotedId`; when `none`, no default remains. Both branches are unit-tested. Docs https://docs.commercetools.com/api/projects/customers#add-address and the My Profile equivalents https://docs.commercetools.com/api/projects/me-profile. The nickname lives in `additionalAddressInfo` (Q-L-03). Checkout (K) preselects `isDefaultShipping`.

**Profile.** `setFirstName`, `setLastName` (and `changeEmail` is not offered, Q-L-04). Phone is not a Customer field; it is a field of the address, so Profile edits the **default shipping address' phone** with `changeAddress` (disabled with a hint when there is no address). "Default address" is a select over the address book calling `setDefaultShippingAddress`. **Password**: `apiRoot.customers().password().post({ body: { id, version, currentPassword, newPassword } })` after J's `validatePassword` passes; commercetools error `InvalidCurrentPassword` maps to `current_password_invalid`.

**No preferences.** There is no email or SMS provider (D-032), so there are no notification toggles and no `mcf-customer-prefs` custom type; Settings holds only Delete account.

**Delete account.** Re-verify the password with `apiRoot.login().post(...)` (without any anonymous cart fields), then `apiRoot.customers().withId({ ID }).delete({ queryArgs: { version, dataErasure: false } })`; clear the session. Orders stay, as the modal states (retained for legal reasons, Q-L-10). Never test this on a seeded customer.

**Payment methods.** The hosted Checkout stores cards (when enabled and when the connector supports it) as `PaymentMethod` resources owned by the cart's customer. Read: `apiRoot.paymentMethods().get({ queryArgs: { where: 'customer(id=:c) and paymentMethodStatus="Active"', 'var.c': customerId, limit: 20 } })` (confirm the SDK namespace exists in `@commercetools/platform-sdk` ^8; if not, record it and show the hosted-only empty state). A `PaymentMethod` has `method`, `name`, `token`, `default`, `paymentMethodStatus`, `paymentInterface`, `interfaceAccount` but **no card brand or last four** as defined fields; task L-10 reads one real record after a test checkout and records which field the connector fills (probably `name` or `custom`). Display `label` = localized `name` when present, else the `method` key translated (`account.payments.method.card` = "Card"). **Remove** = `setPaymentMethodStatus { paymentMethodStatus: 'Inactive' }` (history stays readable, spec modeling note; the token at the PSP is not revoked: say so in `PROJECT-FINDINGS.md`). **Set default** = `setDefault { default: true }` on the chosen record and `setDefault { default: false }` on the current default (two updates; do the second first). No add form: tokenisation happens only inside the hosted Checkout (D-039); the tab explains this and links to the shop. Docs https://docs.commercetools.com/api/projects/payment-methods and https://docs.commercetools.com/checkout/stored-payment-methods (cards only; automated reversals are impossible for payments made with a stored method).

### 3.5 Order status derivation (`deriveOrderStatus`, pure)

`collectDone = !hasCollect || state === 'collected'`; `shipDone = !hasShip || shipmentState === 'Delivered'`.

| Order | Status |
| --- | --- |
| `orderState === 'Cancelled'` | `cancelled` |
| `collectDone && shipDone` | `completed` (label: "Collected" collect only, "Delivered" ship only, "Completed" mixed) |
| `hasCollect && state === 'ready-for-collection'` | `ready` |
| `hasShip && shipmentState` in `Shipped`, `Partial` | `shipped` |
| `hasCollect && state === 'preparing'` | `preparing` |
| otherwise | `ordered` |

Pill colours: `ready` teal, `completed` grey, everything else violet (spec). The icon is the store icon when the order has collect lines and no ship lines, the truck otherwise.

### 3.6 Behaviour rules

- **Guard.** `(shell)/layout.tsx` calls `requireCustomerPage(currentPath)`; no data is rendered without a valid session; the destination is preserved (`/account/sign-in?redirect=/account/orders`). Expired session while on a page: the SWR hooks get 401 and the shell `router.replace`s to sign-in with the current path. N's pages (`/account/subscriptions`) sit inside the same group and inherit the guard.
- **Per-panel isolation.** Every tab and the header counts use their own hook and render `PanelState`: skeleton while loading, an explicit empty state, and an error state ("{panel} is unavailable right now" + Retry) that never hides the other panels. Handlers use their own 2-second budgets where they fan out (`/api/account/summary`).
- **Empty states** (never a blank panel): Orders "No orders yet" + "Shop coffee"; Saved "Nothing saved yet. Tap the heart on any product." + "Browse" (+ "Save items from my bag" when the bag has lines); Addresses "No saved addresses" + "Add address"; Payment methods "No saved cards" + explanation; Subscriptions stub "No subscriptions yet" + "Shop coffee".
- **Orders.** Filter chips (`Chip` atom) All, In progress, Ready for collection, Completed; page size 10 with Previous and Next (`aria-label`, disabled at the ends), URL query `?filter=&page=` so the state survives reload.
- **Buy again.** Button shows pending state; result toast; skipped lines in a dialog (`role="dialog"`, list with reason text); then a "View bag" button.
- **Change store.** The Collection tab's button calls `useStorePicker().open()` (F); the choice persists in the session (`collectionStoreKey`, F) and updates availability site-wide. "Saved" collection store is per browser session cookie (30 days), not per account (Q-L-11).
- **Collection tiles**: (1) "Fast collection": minutes from the store's `collectionMinutes` (hidden when absent); (2) "Free shipping over {threshold}" from F's promise figures (`getPromiseFigures`, never a constant); (3) "Subscribe and save" linking to Subscriptions. The prototype's "in-store returns" and "member perks" tiles are not carried over (in-store operations are a separate system, D-001; no loyalty, Q-L-06; copy sign-off `SO-L-a`).
- **Address book.** Add and edit use K's validators; an address the verifier cannot resolve opens `AddressVerifyDialog` naming the unresolved fields and the suggestion, and the shopper decides (Use suggestion, Keep mine, Edit); nothing is stored before the decision. With the default `noopVerifier` this dialog never opens; its tests use a fake verifier. Delete asks for confirmation; when the default is deleted the dialog states which address becomes the default (or that none will).
- **Delete account.** Modal lists what is erased (profile, addresses, saved items, saved cards) and what is retained (order records for legal and tax reasons), requires the password, and is a destructive `Button` variant with muted red text (`--ct-danger`).
- **Order access.** A foreign or unknown order number renders the not-found card ("We couldn't find that order") with HTTP 404 and no order data.
- **Reviews tab.** A stub page with an empty state and a link slot that M replaces.

### 3.7 Session fields

L reads `customerId`, `collectionStoreKey`, `cartId`, `country`, `currency`, `locale`. Writes: `cartId` through G's cart functions on Buy again and add-all; clears everything on account deletion with `clearSessionCookie`. No new fields.

### 3.8 Caching

Nothing here is cached on the server except the public order-state id lookup (`cachedPublic('project', ...)`, tag `project`). SWR keys: `keyOrders(customerId)` extended with `[filter, page]`, `keyOrder(customerId, orderId)`, `keyAddresses(customerId)`, `keySavedItems(customerId)`, `keyAccountSummary`, `keyPaymentMethods`, `keyPreferences`; every key contains the customer id so two customers never share an entry. Mutations invalidate exactly their own key tuple (never the whole cache). Order detail polls every 30 s only while a collect order is not `collected` (reuse K's `useOrderStatus`).

### 3.9 Accessibility

One H1 (the greeting) and H2 per tab; tab links are an `nav` with `aria-current`; filter chips have `aria-pressed`; radio-like address cards are buttons with `aria-pressed` for "default"; toggles are `role="switch"`; dialogs trap focus and return it; every icon-only control has an `aria-label`; error and success messages use `role="alert"` or `role="status"`; status pills carry text, not colour alone; the horizontal tab strip is keyboard reachable and announces the current tab.

### 3.10 i18n keys (namespace `account`; en-CA equals en-US)

| Key | en-US |
| --- | --- |
| `eyebrow` / `greeting` | My account / Hi, {first} |
| `status.open` / `status.openNone` / `status.ready` / `status.unavailable` | {count} open orders / No open orders / {count} ready for collection / Orders unavailable |
| `tabs.label` / `tabs.orders` / `.collection` / `.subscriptions` / `.saved` / `.addresses` / `.payments` / `.reviews` / `.profile` / `.settings` / `.signOut` | Account / Orders / Collection / Subscriptions / Saved / Addresses / Payment methods / Reviews / Profile / Settings / Sign out |
| `panel.unavailable` / `panel.retry` / `panel.loading` | {panel} is unavailable right now. / Try again / Loading… |
| `orders.title` / `.empty` / `.emptyCta` | Order history / No orders yet. / Shop coffee |
| `orders.filter.all` / `.inProgress` / `.ready` / `.completed` | All / In progress / Ready for collection / Completed |
| `orders.pill.ordered` / `.preparing` / `.ready` / `.shipped` / `.collected` / `.delivered` / `.completed` / `.cancelled` | Ordered / Preparing / Ready for collection / Shipped / Collected / Delivered / Completed / Cancelled |
| `orders.readyBlock` / `.details` / `.buyAgain` / `.directions` / `.more` | Ready at {store} · {hours}. Bring your ID and this order number. / View details / Buy again / Get directions / +{count} more |
| `orders.prev` / `.next` / `.page` | Previous / Next / Page {page} of {pages} |
| `orders.notFound` / `.notFoundHelp` | We couldn't find that order. / Check the number or go back to your orders. |
| `orders.reorder.added` / `.skippedTitle` / `.reason.unavailable` / `.reason.out_of_stock` / `.reason.not_found` / `.reason.price_missing` / `.viewBag` | {count} items added to your bag. / These items could not be added / No longer available / Out of stock / No longer in our range / No price in your country |
| `orders.detail.deliveries` / `.parcel` / `.tracking` / `.noTracking` / `.items` | Shipments / Parcel {n} / Track parcel / Tracking will appear here / Items |
| `orders.return.start` / `.title` / `.reason` / `.reasons.damaged` / `.reasons.wrong` / `.reasons.notAsDescribed` / `.reasons.changedMind` / `.submit` / `.closed` | Start a return / Which items are you returning? / Reason / Damaged / Wrong item / Not as described / Changed my mind / Start return / The return window for this order has closed. |
| `orders.return.shipment.Advised` / `.Returned` / `.BackInStock` / `.Unusable` | Return announced / Goods received / Back in stock / Cannot be resold |
| `orders.return.payment.Initial` / `.Refunded` / `.NotRefunded` / `.NonRefundable` | Refund pending / Refunded / Not refunded / Not refundable |
| `collection.title` / `.help` / `.change` / `.none` / `.chooseStore` | Your collection store / We use this store for live availability and collection orders. / Change store / No store chosen yet. / Choose a store |
| `collection.tile.fast` / `.fastText` / `.shipping` / `.shippingText` / `.subscribe` / `.subscribeText` | Fast collection / Ready in about {minutes} minutes / Free delivery / Free shipping over {threshold} / Subscribe and save / Never run out of coffee |
| `saved.title` / `.empty` / `.browse` / `.fromBag` / `.addAll` / `.added` / `.skippedTitle` / `.remove` | Saved items / Nothing saved yet. Tap the heart on any product. / Browse / Save items from my bag / Add all to bag / {count} items added to your bag. / These items could not be added / Remove from saved |
| `addresses.title` / `.empty` / `.add` / `.edit` / `.delete` / `.makeDefault` / `.default` / `.label` | Addresses / No saved addresses. / Add address / Edit / Delete / Make default / Default / Name this address (Home, Work) |
| `addresses.deleteConfirm` / `.deleteDefaultPromote` / `.deleteDefaultNone` / `.deleted` | Delete this address? / This is your default address. {label} will become your default. / This is your default address. You will have no default until you choose one. / Address deleted. |
| `addresses.verify.title` / `.unresolved` / `.suggestion` / `.useSuggestion` / `.keepMine` / `.edit` | Check this address / We couldn't confirm: {fields}. / Did you mean: {address} / Use suggestion / Keep what I typed / Edit |
| `payments.title` / `.empty` / `.emptyHelp` / `.hostedOnly` / `.default` / `.remove` / `.makeDefault` / `.method.card` | Payment methods / No saved cards. / Cards you choose to save while paying appear here. / Card details are only ever entered in our secure payment form at checkout. / Default / Remove / Make default / Card |
| `profile.title` / `.firstName` / `.lastName` / `.email` / `.emailHelp` / `.phone` / `.phoneHelp` / `.defaultAddress` / `.save` / `.saved` | Profile / First name / Last name / Email / To change your email, contact us. / Phone / Used for your default delivery address. / Default address / Save changes / Changes saved. |
| `password.title` / `.current` / `.new` / `.submit` / `.changed` / `.wrongCurrent` | Change password / Current password / New password / Update password / Password updated. / Your current password is incorrect. |
| `settings.title` / `.saveFailed` | Settings / Could not save. Try again. |
| `delete.button` / `.title` / `.erased` / `.retained` / `.password` / `.confirm` / `.cancel` | Delete account / Delete your account? / This erases your profile, addresses, saved items, preferences and saved cards. / Order records are kept for legal and tax reasons. / Enter your password to confirm / Delete my account / Keep my account |
| `subscriptions.stub` / `reviews.stub` | No subscriptions yet. / No reviews yet. |

## 4. Tasks

Branch `ws/l-account-area`. Commit `ws-l: L-nn summary`. Each task is under half a day. Run `npm run check` before ticking; `npm run build` before the last task. Tests call handlers with `new Request(...)` and mock `lib/ct/*`.

- [x] **L-00 Preconditions and paths.** J and K are `Done` in `STATUS.md`. `grep` and write the real paths and names to `plans/evidence/L/paths.md`: K's `OrderView`, `lib/ct/orders.ts`, `OrderStatusTrack`, `seed:order`; J's `requireCustomerPage`, `domainError`, `useAccount`; G's `addLine`, `useSavedItems`, `ProductCard`; F's `useStorePicker`, `getPromiseFigures`, `lib/ct/inventory.ts`; E's `Modal`, `Chip`, `Button`; I's cart module (if I is `Done`). No code.
- [x] **L-01 Shell, tabs, guard, header counts.** `[SKILL: commercetools-storefront]`. Files: `app/[locale]/account/(shell)/layout.tsx`, `page.tsx`, stub pages for `subscriptions` and `reviews`, `components/account/AccountShell.tsx`, `AccountTabs.tsx`, `AccountHeader.tsx`, `PanelState.tsx`, `app/api/account/summary/route.ts`, `hooks/useAccountSummary.ts`, messages. Tests: `Not signed in` (guard redirects with the path preserved), `Session no longer valid` (401 from a hook sends to sign-in with the path), `Loyalty not offered` (no points text), `Nothing yet on the account` (header says no open orders, panels show empty text), `One backing service down` (summary handler returns `null` for the failed count and a number for the others; header shows "Orders unavailable" next to a working count), `Tab strip has aria-current on the active tab`, `Two customers never share an account summary key`, `Unauthenticated account call returns 401 with no detail`.
- [x] **L-02 Order status and order list.** `[SKILL: commercetools-storefront]`. Files: `lib/account/order-status.ts`, `lib/ct/orders.ts` (extend), `lib/mappers/order.ts` (extend), `app/api/orders/route.ts`, `hooks/useOrders.ts`, tests. Tests: `Own orders only` (predicate contains the session customer id; a request cannot override it), `History is paged across all orders` (offset and total), `Filter ready uses the ready state id`, `Status table` (one test per row of 3.5), `Ready for collection` (mapper gives `ready` and the collect block), `Mixed order status prefers ready over shipped`, `State ids come from the cached lookup not constants`.
- [x] **L-03 Orders tab UI.** Files: `app/.../orders/page.tsx`, `components/account/orders/OrderCard.tsx`, `OrderStatusPill.tsx`, `OrderList.tsx`, `OrderFilters.tsx`. Tests: `Ready for collection` (card shows store, hours and "Get directions"), `No orders` (empty state with "Shop coffee"), `Directions link opens a new tab safely`, `Pill colours per status`, `Filter and page survive reload via the query string`, `Orders panel error does not hide the header`.
- [ ] **L-04 Order detail, deliveries, returns (read).** Files: `app/.../orders/[orderNumber]/page.tsx`, `app/api/orders/[id]/route.ts` (extend K's), `OrderDetail.tsx`, `DeliveryList.tsx`, `ReturnList.tsx`, mapper additions. Tests: `Detail of an order not theirs` (404, identical body for unknown, page shows the not-found card, no data), `Shipment state visible` (delivery with tracking id and link), `Partial shipment` (two deliveries, items distinguishable), `Refund state visible` (goods received and refund are separate chips), `Two state machines are never merged`, `Shipped line with no tracking shows the placeholder`.
- [ ] **L-05 Start a return.** `[SKILL: commercetools-storefront]`. Files: `app/api/orders/[id]/returns/route.ts`, `lib/ct/orders.ts` (`addReturn`), `ReturnDialog.tsx`, `RETURN_WINDOW_DAYS` in `lib/shop-config.ts`, tests. Tests: `Return started` (the update action carries the line ids, quantities, `Advised`, and the shopper cannot return more than remains), `Return window closed is refused`, `Order not completed is not returnable`, `Return of another customer's order is 404`, `Return dialog needs at least one item and a quantity within range`.
- [ ] **L-06 Reorder.** `[SKILL: commercetools-storefront]`. Files: `lib/ct/reorder.ts`, `app/api/orders/[id]/reorder/route.ts`, `OrderCard`/`OrderDetail` button wiring, tests. Tests: `Buy again` (available lines added, unavailable listed and skipped), `Reorder with an unavailable item` (reasons per line), `Collect line uses the current store and is skipped when out of stock there`, `Subscribe lines are re-added as one-off ship lines`, `Reorder never replaces the existing bag`, `Reorder of another customer's order is 404`.
- [ ] **L-07 Collection tab.** Files: `app/.../collection/page.tsx`, `CollectionTab.tsx`. Tests: `Change store` (button calls the picker; the new store key is read back from the session), `Tiles read figures from data` (minutes from the store, threshold from the promise figures), `No store chosen shows the choose button`, `Collection tab and nav entry are hidden in the Canada market` (delivery only, D-035).
- [ ] **L-08 Address book server.** `[SKILL: commercetools-storefront]`. Files: `lib/ct/addresses.ts`, `lib/account/address-policy.ts`, `lib/account/address-verifier.ts`, `app/api/account/addresses/route.ts`, `[id]/route.ts`, `hooks/useAddresses.ts`, tests. Tests: `Address added and defaulted` (one update with `addAddress`, both id lists and both defaults; default pointer uses the key), `Default preselected for a new order` (K's checkout state exposes `isDefaultShipping`; test against K's mapper), `Last address removed` (no default left, no error), `Default address removed` (policy `promote`: next address becomes default and `promotedId` returned), `Default address removed under policy none` (no default remains), `Validation cannot resolve the address` (fake verifier: 409 with unresolved fields and the suggestion, nothing written), `Address of another customer is 404`, `Invalid postcode is refused with field codes`.
- [ ] **L-09 Address book UI.** Files: `app/.../addresses/page.tsx`, `AddressesTab.tsx`, `AddressCard.tsx`, `AddressForm.tsx`, `AddressVerifyDialog.tsx`. Tests: `Delete default` (dialog states which address becomes default, or none), `Verify dialog lets the shopper decide before anything is stored`, `State field only for US`, `Add address focuses the first invalid field`, `Address cards expose default as pressed state`.
- [ ] **L-10 Payment methods.** `[SKILL: commercetools-checkout]` `[SKILL: commercetools-storefront]`. Files: `lib/ct/payment-methods.ts`, `lib/mappers/payment-method.ts`, `app/api/account/payment-methods/*`, `hooks/usePaymentMethods.ts`, `PaymentMethodsTab.tsx`, tests. First verify the SDK namespace and, when OA-K-a and OA-L-b are done, read one real `PaymentMethod` after a test checkout that saved a card; write which fields the connector fills into `plans/PROJECT-FINDINGS.md`. Tests: `Card tokenized then listed` (mapper shows a label and the default flag only; the token value never leaves the server; covered live by M-L-03), `Default method removed` (no default remains, nothing is promoted silently), `No methods saved` (explanation and no add button, no blank table), `Token value is never in any response`, `Remove sets Inactive and does not delete`, `Payment panel failure does not affect the addresses panel`. Mark live parts `blocked: OA-K-a / OA-L-b`.
- [ ] **L-11 Profile and password.** `[SKILL: commercetools-storefront]`. Files: `lib/ct/customer.ts`, `app/api/account/profile/route.ts`, `password/route.ts`, `ProfileForm.tsx`, `PasswordForm.tsx`, tests. Tests: `Profile saves names with the right actions`, `Phone edits the default address`, `Phone disabled with no address`, `Email is read-only`, `Password change checks the policy first`, `Wrong current password gives the specific message`, `Password change is rate limited`.
- [ ] **L-12 Delete account.** `[SKILL: commercetools-platform]`. Files: `lib/ct/customer.ts` (delete), `app/api/account/delete/route.ts`, `SettingsTab.tsx`, `DeleteAccountDialog.tsx`, tests. Settings has no email toggles (D-032). Tests: `Delete account` (modal states erased and retained; wrong password gives 400 and deletes nothing; success clears the session and calls delete with `dataErasure: false`), `Delete account refuses without a password`, `Settings offers no email or notification control`.
- [ ] **L-13 Saved items server and tab.** `[SKILL: commercetools-storefront]`. Files: `lib/ct/shopping-lists.ts`, `lib/mappers/shopping-list.ts`, `app/api/shopping-lists/route.ts`, `add-to-cart/route.ts`, `hooks/useSavedItems.ts` (keep G's exported API; signed-in uses the server, signed-out keeps `sessionStorage`; on sign-in merge), `SavedTab.tsx`, tests. Tests: `Remove` (heart off leaves the grid), `List converted in one operation` (twelve lines all added, list unchanged), `Line no longer purchasable` (others added, the excluded one named with its reason), `No lists yet` (plain empty state and the from-bag path), `Merge of guest saved ids ignores duplicates`, `Other customer's list is 404`, `List over 250 lines is refused`, `List prices come from the product read, not the list`.
- [ ] **L-14 Dev order tooling.** Files: `seed/src/scripts/order-ops.ts` (extend K's): `ship --order-number <n> [--partial]` (`addDelivery` with `items: [{ id, quantity }]` and a parcel with `trackingData`, then `changeShipmentState` to `Shipped`), `deliver --order-number <n>` (`changeShipmentState` `Delivered`), `return --order-number <n> --set Returned|BackInStock|Unusable|Refunded|NotRefunded` (`setReturnShipmentState` / `setReturnPaymentState` on the first return item). `--dry-run` everywhere, refuses a foreign project key, refuses invalid transitions. Tests: `ship partial creates two deliveries over two runs`, `deliver needs shipped`, `return states follow the machine`, `foreign project key refused`.
- [ ] **L-15 Catalogue parity.** Messages in both catalogues (`en-US`, `en-CA`) for namespace `account`. Test `Catalogues have the same keys`.
- [ ] **L-16 Browser run, evidence, hand-off.** Run sections 6 and 7; `npm run build`; todo and question rows; `Ready for review`.

## 5. Scenarios checklist

`design-account-area`
- [ ] Not signed in: `Not signed in` (L-01)
- [ ] Loyalty not offered: `Loyalty not offered` (L-01)
- [ ] Ready for collection: `Ready for collection` (L-02, L-03)
- [ ] Buy again: `Buy again` (L-06)
- [ ] No orders: `No orders` (L-03)
- [ ] Change store: `Change store` (L-07)
- [ ] Skip: belongs to workstream N (`Skip` test there); L provides the tab and its stub only
- [ ] Remove (saved): `Remove` (L-13)
- [ ] Delete default: `Delete default` (L-09) and `Default address removed` (L-08)
- [ ] Delete account: `Delete account` (L-12)

`account-dashboard`
- [ ] Nothing yet on the account: `Nothing yet on the account` (L-01)
- [ ] One backing service down: `One backing service down` (L-01), `Payment panel failure does not affect the addresses panel` (L-10)
- [ ] Session no longer valid: `Session no longer valid` (L-01)

`account-and-self-service`
- [ ] Address added and defaulted: `Address added and defaulted` (L-08)
- [ ] Last address removed: `Last address removed` (L-08)

`address-book`
- [ ] Default preselected for a new order: `Default preselected for a new order` (L-08, K-06)
- [ ] Validation cannot resolve the address: `Validation cannot resolve the address` (L-08, L-09)
- [ ] Default address removed: `Default address removed under policy none` (L-08) for the template's behaviour; the design's behaviour (`promote`) is the default (Q-L-02), tested by `Default address removed`

`order-history`
- [ ] Own orders only: `Own orders only` (L-02)
- [ ] Detail of an order not theirs: `Detail of an order not theirs` (L-04)
- [ ] Reorder with an unavailable item: `Reorder with an unavailable item` (L-06; adds lines to the bag, not a new cart, Q-L-09)

`saved-lists`
- [ ] List converted in one operation: `List converted in one operation` (L-13)
- [ ] Line no longer purchasable: `Line no longer purchasable` (L-13)
- [ ] No lists yet: `No lists yet` (L-13)

`post-purchase-order-management`
- [ ] Shipment state visible: `Shipment state visible` (L-04)
- [ ] Partial shipment: `Partial shipment` (L-04)
- [ ] Return started: `Return started` (L-05)
- [ ] Refund state visible: `Refund state visible` (L-04)

`payment-methods`
- [ ] Card tokenized then listed: `Card tokenized then listed` (L-10) plus the live proof `M-L-03` (the tokenisation itself is the hosted Checkout's, D-039)
- [ ] Default method removed: `Default method removed` (L-10)
- [ ] No methods saved: `No methods saved` (L-10)

## 6. Browser recipe (Chrome DevTools MCP)

Prerequisites: `npm run dev`, live credentials. Use a QA customer registered through J (`qa-l-<date>@example.com`, synthetic password) and orders you place through K's flow (collect-only, ship-only, mixed; collect and mixed are US-market orders at the six NYC stores, the Canada market only has ship-only orders). State changes with `npm run seed:order` (K-08 and L-14). Evidence `plans/evidence/L/<step>-<what>-<375|1440>.png`. For every step: snapshot, console without errors, network without failed requests (deliberate 4xx named below only).

| Step | Do | Expect |
| --- | --- | --- |
| A1 | Signed out, open `/en-US/account/orders` | Redirect to `/en-US/account/sign-in?redirect=/account/orders`; after signing in you land on the orders tab |
| A2 | New account (no orders) at 1440 | Header "Hi, {first}", "No open orders", every tab shows an explicit empty state, none blank; at 375 the tab strip scrolls and the active tab is in view |
| A3 | Place a collect-only order (K), open Orders | Card with number, date, total, violet "Ordered" pill, thumbnails; "View details" opens the detail with the tracker |
| A4 | `seed:order -- state ... --to ready-for-collection`, reload | Teal "Ready for collection" pill, ready block with store and hours, "Get directions" opens a maps link in a new tab |
| A5 | `state ... --to collected` | Grey "Collected" pill and "Buy again" appears |
| A6 | Buy again on an order that includes a product you made unavailable (for example set a line's stock to 0 through the seed tooling, or use a collect line at a store with no stock) | Available lines in the bag, a dialog names the skipped line with its reason; the bag's earlier lines are intact |
| A7 | Ship-only order: `ship` (partial) then `ship` again then `deliver` | Detail shows one block per parcel with its items and tracking; status goes Shipped then Delivered |
| A8 | Start a return on a delivered order for one item; then `return --set Returned`, then `--set Refunded` | Return listed with the two chips changing independently ("Goods received" then "Refunded") |
| A9 | Open an order number of another customer (second QA customer) and a made-up number | Not-found card, HTTP 404, no order data in the network response; both bodies identical |
| A10 | Collection tab: Change store | Picker opens; the new store shows on the card, the header pill, and PDP availability |
| A11 | Saved: heart a product as a guest, sign in, open Saved | Product is there (merged); remove with the heart; empty state appears; "Add all to bag" with two saved products adds both and the list is unchanged |
| A12 | Addresses: add (valid and invalid values), make default, add a second, delete the default | Field errors beside fields; default tag moves; delete dialog names the next default; after deletion the next is default; delete the last: empty state |
| A13 | Checkout as that member | Default address is preselected (K) |
| A14 | Payment methods | Explanation and no add button; after a saved-card test checkout (M-L-03) the card appears with its label; Remove hides it |
| A15 | Profile: change names, phone, default address; change password (wrong current, weak new, valid) | Saved toast; messages as specified |
| A16 | Settings | Only Delete account is offered; no email or notification toggles |
| A17 | Delete account with a throwaway customer | Modal text, wrong password refused, correct password signs out and a later sign-in fails |
| A18 | Repeat A1 to A5 at `/en-CA` as the seeded Canadian customer | CAD formatting; the Collection tab is hidden and orders show delivery only |
| A19 | Tab through every tab | Focus ring on all controls, dialogs trap and return focus, tab links reachable |
| A20 | Make one panel fail (block `/api/account/payment-methods` with the browser's network blocking or by stopping the connector in dev) | That panel shows "unavailable" with Retry; the others still render |

## 7. Self-verification with data

No owner involvement.
- Read back through the commercetools MCP or a read-only script (keys, ids and counts only, no personal data): the customer's address ids lie in both `shippingAddressIds` and `billingAddressIds`, `defaultShippingAddressId` is correct after each step; the shopping list has the expected line items; the order has `returnInfo` with the expected `shipmentState` and `paymentState`; after A17 the customer no longer exists and the orders still do. Save as `plans/evidence/L/readbacks.json`.
- Compare the Orders tab list with `orders().get` for the customer (same numbers, same order, same total).
- Verify the foreign order check at the API level (`fetch` from the page for another customer's order id): 404 and the identical body as for a made-up id.
- Verify that no response contains a payment token value (`grep` saved responses for `token`; save "0 matches").
- `cd seed && npm run check` passes with the new custom type and scripts; the type seed is idempotent (second run reports `0 change(s)`).
- Write `plans/evidence/L/README.md`.

## 8. Manual testing and owner items

Same rows are in `plans/notes/todo-L.md`.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-L-a | Owner | Before L-10 and L-12 live runs | 1. Confirm the storefront API client scopes include `manage_customers`, `manage_orders`, `manage_shopping_lists`, `view_payments` and `manage_payments`. | Handlers work against the live project | TODO |
| OA-L-b | Owner | Before M-L-03 | 1. In the Checkout Application enable Stored Payment Methods. 2. Confirm the connector you installed supports them. | A checkout offers "save this card" | TODO |
| SO-L-a | Owner | Before release | 1. Read the Collection tiles and the delete-account modal text in `/en-US/account/collection` and `/settings`. 2. Approve or change the wording, especially what is erased and what is kept. | Copy and legal text approved | TODO |
| SO-L-b | Owner | Before release | 1. Decide the returns window (days) and which items can be returned (consumables such as opened coffee?). 2. Tell the team the numbers. | Policy recorded; `RETURN_WINDOW_DAYS` and eligibility updated | TODO |
| M-L-01 | Owner | Before release | 1. On a real phone sign in and open each tab. 2. Swipe the tab strip. 3. Add an address with the on-screen keyboard. | No horizontal page scroll, active tab visible, keyboard does not hide fields | TODO |
| M-L-02 | Owner | Before release | 1. On a real phone with an order in "Ready for collection", tap "Get directions". | The phone's maps app opens at the store | TODO |
| M-L-03 | Owner | After OA-K-a and OA-L-b | 1. Check out and tick save card, pay with the PSP test card. 2. Open Payment methods. 3. Remove the card. | Card listed with a label and default flag, removal hides it, no card number shown anywhere | TODO |
| M-L-04 | Owner | Before release | 1. In the Merchant Center change an order to Ready for collection. 2. Open Orders in the account. | Pill and ready block update | TODO |

## 9. Questions

Each is also in `plans/notes/questions-L.md` (format `Q-L-n | question | default | blocks? | Open`). The default is built.

| ID | Question | Default built | Blocks? |
| --- | --- | --- | --- |
| Q-L-01 | Which saved payment methods does the hosted Checkout and the chosen connector actually store, and which fields identify them? | Show what the connector writes (label, default flag); no add form; the rest is "not applicable" with an explanation (D-039). Finding from L-10. | No |
| Q-L-02 | Deleting the default address: promote the next (design-account-area) or leave none (address-book template)? | Promote; one constant `DEFAULT_ADDRESS_AFTER_DELETE` switches it, both tested. | No |
| Q-L-03 | Where is the address nickname (Home, Work) stored? | `additionalAddressInfo` of the address. | No |
| Q-L-04 | Can customers change their email? | No; shown read-only with "contact us" (no email verification exists, D-032). | No |
| Q-L-05 | Is there an address validation service? | No; format checks only; the `AddressVerifier` adapter and dialog exist and are tested with a fake. | No |
| Q-L-06 | Loyalty points and member perks? | Not offered; text and tile omitted (`design.md` Q7). | No |
| Q-L-07 | SMS alerts toggle? | Hidden; no SMS provider. | No |
| Q-L-08 | Returns window and eligible items? | 30 days from the order's last modification, all lines eligible (`RETURN_WINDOW_DAYS`); `SO-L-b` decides. | No |
| Q-L-09 | Buy again: new cart (order-history template) or add to the current bag (design)? | Add to the current bag (design); unavailable lines listed. | No |
| Q-L-10 | Account deletion: erase personal data of orders too? | No: `dataErasure: false`; order records retained and the modal says so. | No |
| Q-L-11 | Is the collection store saved per customer or per browser? | Per browser session cookie (30 days). A per-customer default would need a custom field. | No |
| Q-L-12 | Where do notification preferences live? | Removed by D-032: no email, no preferences. | No |
| Q-L-13 | Who owns the heart and saved-list server API: G and H built the heart on `sessionStorage`. | L implements `/api/shopping-lists` and swaps `useSavedItems` (as G's plan states). | No |
| Q-L-14 | Payment method "Remove": delete or deactivate? | Deactivate (`Inactive`), keeps history; the PSP token is not revoked. | No |
| Q-L-15 | Order-completed time for the returns window? | `order.lastModifiedAt` (approximation); a real delivered date needs the store tooling. | No |

## 10. Definition of done

- All tasks ticked, each with a passing `check` commit; `npm run build` passes.
- Every scenario of section 5 ticked with a named test or recorded evidence; the Skip scenario is N's.
- Browser recipe A1 to A20 verified at 375 and 1440 px (and `/en-CA`), console and network clean, evidence and `README.md` in `plans/evidence/L/`.
- Section 7 read-backs saved; no payment token in any response.
- `PROJECT-FINDINGS.md` has the L-10 payment method finding and the SDK namespace check.
- Owner rows in `plans/notes/todo-L.md`; questions in `plans/notes/questions-L.md`.
- `seed:order` subcommands work and are idempotent.
- No `TODO` or `FIXME` without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
