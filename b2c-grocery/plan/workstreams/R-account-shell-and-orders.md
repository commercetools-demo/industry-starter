# R — Account shell, orders list and order detail

**Specs:** `malva-storefront-design/account-design` (Dashboard layout, Orders table, Address and details cards, Order detail, Account data is never shared), `grocery-storefront-features/weight-pricing-experience` (Final amount), `delivery-slot-experience` (Slot display on orders); `storefront-data-loading` (Order placement and confirmation — fetch by id, server side)
**Depends on:** G, J, N, O, Q · **Unblocks:** S, U, W, V · **Decisions:** D-041 · **Sign-off:** SO-11

## Goal
A signed-in customer sees their dashboard, a list of their orders, and an order detail with slot, lines, totals and extension points for substitutions.

## Design

### Types (append to `lib/types.ts`)
```ts
export type OrderStatus = 'processing' | 'packing' | 'on-its-way' | 'delivered' | 'cancelled' | 'unknown';
export interface OrderLine { id: string; name: string; sku: string; image?: string; quantity: number; unitPrice: Price; total: Money; increment: Increment; approximateWeight: boolean; substitutionPreference: 'allow-similar' | 'none'; substitute?: { sku: string; name: string } }
export interface Order { id: string; orderNumber?: string; createdAt: string; status: OrderStatus; statusRaw: string; lines: OrderLine[]; subtotal: Money; shipping?: Money; tax?: Money; total: Money; isProvisional: boolean; finalTotal?: Money; shippingAddress?: Address; slot?: CartSlot; inventoryMode: string; version: number; customerId?: string }
export interface OrderListItem { id: string; orderNumber?: string; createdAt: string; status: OrderStatus; total: Money; itemSummary: string /* "Whole milk, Bananas +2" */ }
```
### Status mapping (`lib/mappers/order.ts`, pure, tested)
`orderState === 'Cancelled'` → `cancelled`; `shipmentState === 'Delivered'` → `delivered`; `'Shipped'` → `on-its-way`; `'Ready'` → `packing`; `orderState` `Open`/`Confirmed` with `shipmentState` `Pending`/undefined → `processing`; anything else → `unknown` (`statusRaw` kept). Tag tones: processing → accent; packing, on-its-way → accent-2; delivered, cancelled, unknown → neutral.

### `lib/ct/orders.ts` (`server-only`)
`getCustomerOrders(customerId, {limit, offset})` (sorted `createdAt desc`), `getOrderById(id)`, `getOrderForCustomer(id, customerId)` (returns `null` when `order.customerId !== customerId`). **Ownership is enforced here**; routes must use `getOrderForCustomer`.

### Routes
`GET /api/account/orders?page=` → `{ orders: OrderListItem[], total }` (401 if anonymous); `GET /api/account/orders/[orderId]` → `{ order }` (404 when not owned).

### Pages (`(protected)` group from O)
- Layout `components/account/AccountShell`: H1 = customer name, kicker "Member since {year}" (`customer.createdAt`), 2-col grid `1.6fr/1fr` at `desktop`.
- `/account` dashboard: left "Orders" `Table` with columns Items, Order number, Placed, Total, Status (right-aligned `Tag`), each row a link to `/account/orders/<id>`; empty state "No orders yet" + browse button; right column: default-address `Card` (from `/api/account/profile`; empty state when none; "Member since" from `createdAt`) (kicker, address lines, ghost Edit → `/account/addresses`) and "Details" `Card` with rows Orders, Addresses, Saved lists, Subscriptions, Contact us (trailing →, hover accent).
- `/account/orders` full list with pagination 10 per page.
- `/account/orders/[orderId]`: heading "Order <number>", date, status `Tag`, slot (`Delivery: Tue 10:00–12:00`), lines table (image, name, increment label, quantity, unit price, line total, substitution preference text "Allow similar"/"No substitution"), totals with `ProvisionalNotice` (N) and `FinalAmount` (N) when `finalTotal`, shipping address. Extension slot `<OrderSubstitutions order/>` (U) renders nothing here.
- Hooks `useOrders()` / `useOrder(id)` (SWR, `KEY_ORDERS`, `keyOrder(id)`); the account pages are **client-fetched** (per-user data, never cached).

## Tasks
- [x] R-01 Append order types; write `lib/mappers/order.ts` + fixtures + tests (status mapping table incl. unknown fallback; item summary text; provisional flag; slot and `finalTotal` from custom fields).
- [ ] R-02 Write `lib/ct/orders.ts` + tests (ownership: other customer's order → null; sorted desc; mocked root).
- [ ] R-03 Write `lib/api/private-json.ts` (`privateJson(body, init?)` sets `Cache-Control: private, no-store`), `lib/ct/customer.ts` (`getCustomer(customerId)`), `GET /api/account/profile` (`{ createdAt, firstName, lastName, email, defaultShippingAddress? }`), `GET /api/account/orders` and `[orderId]` + tests (401 anonymous; 404 for another customer's order; pagination params).
- [ ] R-04 Write hooks `useOrders`, `useOrder` + tests (cache keys; safe defaults).
- [ ] R-05 Write `AccountShell` + dashboard cards + tests (name/kicker; details rows and hrefs; default address shown or empty state).
- [ ] R-06 Write the orders table + empty state + status `Tag` tones + tests (each status → tone; row link; "No orders yet").
- [ ] R-07 Write the order detail page + tests (slot text; lines; totals; provisional notice only when flagged; final amount block only when `finalTotal`; preference text; 404 UI for not owned).
- [ ] R-08 Messages (both locales); `Cache-Control: private, no-store` on all `/api/account/*` responses (helper `privateJson()` + test); report manual tests M-R-1…M-R-4, sign-off SO-11.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Signed-in customer / Anonymous visitor | O-09 + R-05 |
| Status mapping / No orders | R-01, R-06 |
| Open addresses (details card link) | R-05 |
| Another customer's order | R-02, R-03, R-07 |
| Shared cache (non-cacheable) | R-08 |
| Order with slot / Final amount recorded | R-07 |

## Manual tests to report
- M-R-1: After V (or by creating a test order in Merchant Center for your customer): dashboard lists it with the right status tag.
- M-R-2: Open another customer's order id in the URL: not-found page.
- M-R-3: Response headers of `/api/account/orders` include `Cache-Control: private, no-store`.
- M-R-4: Compare dashboard/order detail with the design at 1440 px and 390 px.

## Definition of done
Ownership enforced in one place; no cacheable account responses; `verify` passes; SO-11 requested.
