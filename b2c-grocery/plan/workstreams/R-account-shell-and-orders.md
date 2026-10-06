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
- [x] R-02 Write `lib/ct/orders.ts` + tests (ownership: other customer's order → null; sorted desc; mocked root).
- [x] R-03 Write `lib/api/private-json.ts` (`privateJson(body, init?)` sets `Cache-Control: private, no-store`), `lib/ct/customer.ts` (`getCustomer(customerId)`), `GET /api/account/profile` (`{ createdAt, firstName, lastName, email, defaultShippingAddress? }`), `GET /api/account/orders` and `[orderId]` + tests (401 anonymous; 404 for another customer's order; pagination params).
- [x] R-04 Write hooks `useOrders`, `useOrder` + tests (cache keys; safe defaults).
- [x] R-05 Write `AccountShell` + dashboard cards + tests (name/kicker; details rows and hrefs; default address shown or empty state).
- [x] R-06 Write the orders table + empty state + status `Tag` tones + tests (each status → tone; row link; "No orders yet").
- [x] R-07 Write the order detail page + tests (slot text; lines; totals; provisional notice only when flagged; final amount block only when `finalTotal`; preference text; 404 UI for not owned).
- [x] R-08 Messages (both locales); `Cache-Control: private, no-store` on all `/api/account/*` responses (helper `privateJson()` + test); report manual tests M-R-1…M-R-4, sign-off SO-11.

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
- M-R-1: In `site/` run `npx tsx scripts/seed/create-qa-order.ts --status packing --orders 3` (prints a `qa-*@example.com` email, the fixed password `Qa-Throwaway-9Xq!` and the order ids; needs `site/.env.seed`). Sign in at `/en-US/account/sign-in` with them: you land on `/en-US/account` with the H1 "Qa Tester", the kicker "Member since 2026", an Orders table (3 rows: items "Bananas, Whole milk 1 L", order number `QA-…`, placed date, total, right-aligned tag "Packing" in the olive accent-2 style) and on the right the default address card (Qa Tester, 1 Main St, 10001 New York, US) and the Details card (Orders, Addresses, Saved lists, Subscriptions, Contact us with trailing arrows turning orange on hover). Click a row: the order detail opens. Each run creates a new customer, so run the script once per status to see the other tags: `--status processing` (orange), `on-its-way` (olive), `delivered` and `cancelled` (neutral grey). A brand new account from `/en-US/account/register` shows "No orders yet" and a "Browse the shop" button. Clean up with `npx tsx scripts/seed/cleanup-qa.ts`.
- M-R-2: With two QA customers A and B (run the script twice), sign in as A and open `/en-US/account/orders/<B's order id>` (the id the script printed): the page says "We could not find that order" with an "All orders" button, no order data. A random id shows the same. In a private window (anonymous) the same URL redirects to sign-in with `?redirect=`.
- M-R-3: Signed in, open DevTools, Network, reload `/en-US/account`: the XHRs `/api/account/profile` and `/api/account/orders?page=1` both have the response header `Cache-Control: private, no-store`. Without the cookie `curl -i http://localhost:3000/api/account/orders` answers 401 `{"error":"UNAUTHENTICATED"}` with the same header.
- M-R-4: Compare `/en-US/account`, `/en-US/account/orders` and an order detail with `design/specs/account.md` at 1440 px and 390 px (and `/de-DE/...`): at 1440 px the 1.6fr / 1fr grid with the table left and cards right; at 390 px a single column with the cards first and every order shown as a stacked block (small label on the left, value on the right, tag last), no horizontal scroll. Create `--orders 12` for pagination: `/en-US/account/orders` shows 10 rows with "Page 1 of 2" and a Next link, page 2 shows 2 rows; the dashboard shows 5 rows and an "All orders" link.
- M-R-5: Order detail of an order created with `--status packing`: heading "Order QA-…", the date, tag, "Delivery: <tomorrow>, 10:00–12:00", lines with image placeholder, increment label, quantity, unit price (Bananas "$1.49" with "$2.98 / kg"), line total and "Allow similar" / "No substitution", totals with "Total (provisional)" and the note because Bananas are approximate-weight, and the delivery address card. Then `npx tsx scripts/seed/create-qa-order.ts --final-cents 1100` (the order keeps its lines but loses its slot, see Q-R-2): the detail shows "Final amount $11.00 · difference ..." under the total.

## Definition of done
Ownership enforced in one place; no cacheable account responses; `verify` passes; SO-11 requested.

## Implementation notes (deviations, recorded by the developer)
- **No live commercetools check was possible in this worktree** (`site/.env.seed` was not available to the agent, copying it was refused). Everything is unit-tested against fixtures derived from the cart fixture and the SDK types; `scripts/seed/create-qa-order.ts` and the extended `cleanup-qa.ts` are unit-tested for their pure parts (drafts, status actions, argument parsing, call order against a mocked client) but **have not been run against the project**. The first person with `.env.seed` should run `npx tsx scripts/seed/create-qa-order.ts` once and report differences in `PROJECT-FINDINGS.md` (see Q-R-3). The order mapper reads `finalTotal` as a `Money` object (`{ centAmount, currencyCode, ... }`, the shape commercetools uses for Money custom fields) and ignores anything else.
- Data layer: `lib/ct/orders.ts` takes the locale and returns **mapped** values (`getCustomerOrders(customerId, { limit, offset, locale })` → `{ orders: OrderListItem[], total }`, `getOrderById(id, locale)`, `getOrderForCustomer(id, customerId, locale)` → `Order | null`); a guest order (no `customerId`) is nobody's. `lib/mappers/order.ts` reuses `mapLine`/`mapSlot`/`mapAddress` from the cart mapper (now exported). `lib/ct/customer.ts` returns the SDK customer; `lib/mappers/customer.ts` (`mapProfile`) is what the route sends (never the password hash or the raw address list). `AccountProfile` was added to `lib/types.ts`.
- API: `lib/api/private-json.ts` exports `privateJson(body, init?)` **and `unauthenticated()`** (private 401 `{ error: 'UNAUTHENTICATED' }`). S, T, V, W use both. `GET /api/account/orders?page=` answers `{ orders, total, page, pageSize }` (page size 10, `lib/orders-paging.ts`; a bad `page` is page 1); errors are `ORDER_NOT_FOUND` (404), `ORDERS_ERROR`, `PROFILE_ERROR`, `CUSTOMER_NOT_FOUND`. `app/api/account/private-responses.test.ts` scans **every** `app/api/account/**/route.ts` (including S, T, V, W routes once merged) and fails when a route uses a bare `NextResponse.json`/`Response`, does not use `privateJson`, or does not call `getSession()`.
- Hooks (`hooks/useOrders.ts`): `useOrders(page = 1)` (page 1 key is `KEY_ORDERS`, later pages `keyOrdersPage(n)` = `orders:<n>`), `useOrder(id)` (`order`, `notFound`), `useProfile()` (`KEY_PROFILE = 'profile'`). 4xx answers are not retried. `useAuthMutations().logout` now also clears `KEY_PROFILE` and every `orders:<n>` key (additive change in `hooks/useAccount.ts` and `lib/cache-keys.ts`).
- UI: `components/account/{AccountShell,AddressCard,DetailsCard,OrdersList,OrdersTable,OrderStatusTag,OrderDetail,OrderSubstitutions,format}`. `AccountShell({ main, aside })` is the dashboard frame only (kicker from the profile, H1 from the session user so the name shows immediately). `DetailsCard({ current })` doubles as the sub-page rail (S, T, W should render it with their key: `addresses | saved | subscriptions`; it links to `/account/saved` for the saved-lists page that T builds). `OrderSubstitutions({ order })` is U's extension slot and renders nothing. The dashboard shows the 5 newest orders and an "All orders" link; `/account/orders?page=N` shows 10 per page with Previous/Next. Below `tablet` the table stacks (CSS only, `data-label` per cell). The whole row is a link through a stretched link in the Items cell.
- **Order detail not-found is an inline page state, not Next's `notFound()`**: the page is client-fetched (plan), so HTTP status of the page itself stays 200; the API answers 404 and the UI shows "We could not find that order" with an "All orders" button (`data-testid="order-not-found"`). A foreign order and a missing one look identical.
- Order detail shows `ProvisionalNotice` and the "Total (provisional)" label whenever the order has an approximate-weight line, **also after `finalTotal` is recorded**, and `FinalAmount` below the total (provisional vs final side by side), as the plan says. The slot line reads "Delivery: Tue, Oct 13, 10:00–12:00" (day via `dayLabel`, UTC). Dates are formatted in UTC (`formatDate`).
- Used `text-text/60` for muted text: the existing `text-muted` class used in J/N components is **not defined** in the theme (it renders as inherited colour). See `plan/IDEAS.md`.
- Messages: the whole `account` namespace (both locales); German is a faithful machine translation (see IDEAS). The `account` namespace had been an empty object since A.
- Q-N-1 (who wires `FinalAmount` and the `finalTotal` mapping): R did, as N asked. M-N-3 is covered by M-R-5.
- `scripts/seed/create-qa-order.ts` options: `--status processing|packing|on-its-way|delivered|cancelled`, `--orders N` (each run is a **new** customer; N orders for it), `--final-cents N`. `cleanup-qa.ts` now also deletes the QA customers' orders and carts first.
- Sign-off SO-11 is owner-only; not set.
