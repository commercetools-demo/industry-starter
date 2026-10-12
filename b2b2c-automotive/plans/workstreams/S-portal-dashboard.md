<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream S: Portal dashboard

Status: DRAFT v2 (2026-10-12, owner scope applied: no buying from Malva, see section 4 "Owner scope changes"). Letters and dependencies: `plans/DEPENDENCY-PLAN.md`. `sp/` = `b2b2c-automotive/openspec/specs/seller-portal/`. Paths are relative to `b2b2c-automotive/` unless they start with `plans/`.

## 1. Goal

The page `portal/app/[locale]/(portal)/page.tsx` shows a reseller what needs attention today in **their own store**: one heads-up banner, four KPI cards, recent storefront orders, returns waiting for action, low stock per branch, subscriptions renewing soon, and (Admin only) the performance of the store. Every widget loads on its own; a failing source shows an error only in its widget and never blanks the page. There is nothing about purchasing from Malva on this page.

## 2. Depends on

| Workstream | Needed | Check |
| --- | --- | --- |
| R | Shell, session guard, `usePermissions`, `authorizeStore`, `sessionFor` test helper, `BusinessUnitContext`, `PlaceholderPage` for `/` | `npx vitest run lib/authz lib/portal` green; `/de-DE` shows the placeholder in the shell |
| E, F (via R) | A reseller store with at least two branch channels (supply channels with inventory, standalone prices on the store channel), a few storefront orders in mixed states (the seed creates **no orders or carts**: they are placed through the storefront after O; record which in Notes), at least one recurring order and one return if V's data exists (S tolerates their absence) | MCP read-backs in section 9 |

S does **not** depend on V or W. Returns, reviews and subscriptions are read here with plain queries; the return-item type `malva-return-item` is created by the seed (statuses `requested`, `in-transit`, `received`, `inspected`, `refunded`, `rejected`), while the review type `malva-review` is created by V; if V's data or the review type does not exist yet, those widgets show zero and an empty state, never an error. S creates no type of its own.

## 3. Specs and requirement ids implemented

`sp/design-dashboard/spec.md` (primary), adapted:

- Heads-up banner (one banner, source in decision 5)
- KPI row (four cards, new set in decision 3)
- Widgets are independent
- Recent orders and waiting list ("Waiting on you" becomes "Returns to handle")
- Store performance for the reseller (built here, now the main block)

Gaps in the spec: no date range and no chart widgets (chart tokens untouched); conversion is not shown (no analytics source).

## 4. Decisions already taken

### Owner scope changes (interview 2026-10-12)

| Spec text | What S does instead | Why |
| --- | --- | --- |
| KPIs "Awaiting your approval", "Outstanding balance", "Credit available" | Removed; replaced by Open returns, Active subscriptions, Unanswered reviews | Q-V01: buying from Malva (approvals, invoices, credit) is out of scope |
| Widgets "Outstanding invoices", "Saved lists", "Waiting on you" (approval tiers) | Removed; replaced by "Returns to handle", "Low stock by branch", "Subscriptions renewing" | same |
| Scenario "Finance system down" and the `?simulate=finance-down` switch | Replaced by `?simulate=orders-down` (dev only) with the same independence rule | no finance source exists |
| Heads-up about a price list | Heads-up about assortment parts with no stock in any branch | price lists are out of scope |
| Group "Purchases from Malva" | Removed; only the group "Your store" remains | Q-V01 |
| Any tile on price floor, territory, tailoring review | Never built | Q-T03, Q-O03, Q-T06 |
| Email KPIs (sent, opened) | Not built; no e-mail is ever sent | Q-P01 |

### Decisions

| # | Decision | Source |
| --- | --- | --- |
| 1 | Everything on the page is the signed-in reseller's own store. All reads use the **admin client** inside `app/api/seller/dashboard/**` and `lib/ct/seller/**` after `authorizeStore(session, session.storeKey, action)`; the store key comes from the session only. No as-associate buying chain is used on this page. | `sp/bootstrap-and-structure` "As-associate for buying, admin client for selling"; Q-V01 |
| 2 | Each widget has its own endpoint, SWR key and error state; the page itself never throws for a widget. | spec "Widgets are independent" |
| 3 | The four KPI cards and their data sources: **Open orders** = `in-store/key=<store>/orders` `where: orderState="Open"` (`limit 1`, `withTotal`); **Open returns** = orders in the store with `returnInfo is not empty`, counting return items whose custom field `status` (seed type `malva-return-item`) is `requested`, `in-transit`, `received` or `inspected` (words from `seed/src/data/custom-types.ts` and V's contract; native `shipmentState` Advised or Returned when a return item carries no custom fields); **Active subscriptions** = `recurringOrders` with `where: store(key="<store>") and recurringOrderState(type="Active")` (`withTotal`); **Unanswered reviews** = reviews with `custom(fields(storeKey="<store>"))` and no `replyText`, state published (`withTotal`). | owner Q-Q06 (subscriptions sold fully), Q-004 (no review gate) |
| 4 | Heads-up banner: derived, never stored. Count of parts assigned to the store's product selection whose inventory is 0 in **every** branch channel of the store (inventory read per supply channel of the store). Shown only when the count is above 0, text "{count} parts in your assortment are out of stock in every branch.", **Review** link `/catalog?tab=assortment&stock=none` (T builds the filter; the link must start with `/`). At most one banner. | Q-005 branch channels carry inventory |
| 5 | Branch channels carry both inventory and prices. The "Low stock by branch" widget lists, per branch channel (supply channel of the store), parts with `availableQuantity <= LOW_STOCK_THRESHOLD` (constant 5, in `lib/ct/seller/dashboard/stock.ts`), top five per branch, with branch name from the channel `name`. | Q-005 |
| 6 | Conversion is not shown (no analytics); store performance shows sales, orders, average order value and top five products over 30 days. | Q-S03 |
| 7 | Store performance is on by default, Admin only, controlled by the server env `PORTAL_STORE_PERFORMANCE` (`on` default, `off` hides it). | Q-S03 |
| 8 | Greeting is rendered on the server in the `Europe/Berlin` time zone so SSR and client match. | `design.md` decision 7 |
| 9 | Money is formatted with `Intl.NumberFormat(locale, { style: 'currency', currency })` from `centAmount / 10**fractionDigits`; never `(c/100).toFixed(2)`. | skill anti-pattern table |
| 10 | The dev-only query `?simulate=orders-down` is honoured only when `NODE_ENV !== 'production'`; a test proves it is ignored in production. | needed for the independence scenario |
| 11 | Names in fixtures are neutral ("Test Garage Nord", "Anna Test"); the prototype names never appear. | `design.md` section 9 |
| 12 | Payments are hosted commercetools Checkout with the Stripe connector (Q-012); order chips use `paymentState` as set by the connector. | Q-012 |

## 5. Role matrix for this page

Roles are Admin and Buyer only (Approver dropped, R section 5).

| Element | Admin | Buyer |
| --- | --- | --- |
| Heads-up banner, KPI row, Recent orders, Returns to handle, Low stock by branch, Subscriptions renewing | yes | yes |
| Store performance group ("Your store" sales block) | yes | no (not rendered, endpoint answers 403) |
| Primary page action | none | none |

Both roles may read the dashboard endpoints (`dashboard.view`); only Admin has `store.view-performance`.

## 6. Tasks

Work test-first (section 7). After each group run `cd b2b2c-automotive/portal && npm run check`.

### S-00 Preflight

1. R is done: `npx vitest run lib/authz lib/portal` green, `curl -s localhost:3001/api/health` ok.
2. Conventions from G and C: `adminRoot` is the admin client (`lib/ct/admin-client.ts`), route helpers `handle`, `ApiError`, `requireCustomer`, `requireBusinessUnit`, `parseJson` live in `lib/api.ts`, `getSession()` in `lib/session.ts`. `formatMoney(centAmount, currencyCode, locale)` and `getLocalizedString` come from `lib/utils.ts`; if `formatMoney` or a `withTimeout(promise, ms)` helper (rejects with `UpstreamTimeout`) is not there yet, add it to `lib/utils.ts` with a test.
3. Read the skill references `references/b2b/dashboard.md` and `references/b2b/data-loading.md` in the `commercetools-storefront` skill for the widget pattern (ignore the buying parts).
4. Add to R's `PortalAction` table: `dashboard.view` (Admin, Buyer) and `store.view-performance` (Admin).

### S-01 Order status mapping [SKILL: commercetools-storefront]

File `lib/mappers/order-status.ts`:

```ts
export type OrderChip = 'shipped' | 'processing' | 'payment-pending' | 'cancelled';
export function mapOrderStatus(order: Pick<Order, 'orderState' | 'shipmentState' | 'paymentState'>): OrderChip;
// first match wins: orderState Cancelled -> cancelled; shipmentState Shipped | Delivered -> shipped;
// paymentState Pending | BalanceDue | Failed -> payment-pending; otherwise processing
export const CHIP_TONE: Record<OrderChip, 'success' | 'info' | 'warning' | 'critical'>; // shipped success, processing info, payment-pending warning, cancelled critical
```

Chip components use the admin kit `*-subdued` fill with `--color-text` (badge 24 px), tokens only.

### S-02 Store reads [SKILL: commercetools-storefront] [SKILL: commercetools-platform]

Files under `lib/ct/seller/dashboard/` (server only, `import 'server-only'`, admin client):

```ts
export async function listRecentOrders(storeKey: string, limit = 5): Promise<DashboardOrder[]>;
export async function countOpenOrders(storeKey: string): Promise<number>;
export async function listReturnsToHandle(storeKey: string, limit = 5): Promise<ReturnRow[]>;
export async function countOpenReturns(storeKey: string): Promise<number>;
export async function countActiveSubscriptions(storeKey: string): Promise<number>;
export async function listRenewals(storeKey: string, days = 7, limit = 5): Promise<RenewalRow[]>;
export async function countUnansweredReviews(storeKey: string): Promise<number>;
export async function lowStockByBranch(storeKey: string): Promise<{ branch: { key: string; name: string }; parts: { sku: string; name: string; available: number }[] }[]>;
export async function countOutOfStockEverywhere(storeKey: string): Promise<number>;
```

- Orders: `adminRoot.inStoreKeyWithStoreKeyValue({ storeKey }).orders().get({ queryArgs: { sort: 'createdAt desc', limit, withTotal: true } })`. Open orders: `where: 'orderState="Open"'`, `limit: 1`, read `total`.
- Returns: orders `where: 'returnInfo is not empty'`, flatten items; "to handle" = status `requested` or `received` (the two states that wait for the reseller). Row: return number, order number, customer first name and initial only, items "2x Part name", status chip. Tolerate a missing custom type (fall back to the native `shipmentState`).
- Subscriptions: `adminRoot.recurringOrders().get({ queryArgs: { where: 'store(key="<store>") and recurringOrderState(type="Active")', expand: ['cart'], sort: 'nextOrderAt asc', limit: 50, withTotal: true } })` (confirm with the OAS tool `api-RecurringOrder` whether an in-store form exists and use it). Renewals = Active with `nextOrderAt` within `days`.
- Reviews: `adminRoot.reviews().get({ queryArgs: { where: 'custom(fields(storeKey="<store>")) and custom(fields(replyText is not defined))', withTotal: true, limit: 1 } })`; an absent type yields 0.
- Stock: read the store's channels (`adminRoot.stores().withKey({ key }).get({ queryArgs: { expand: ['supplyChannels[*]'] } })`), inventory per channel `where: 'supplyChannel(id="<id>") and availableQuantity <= 5'`, limit 100; part names from one batched product lookup (`where: 'masterData(current(masterVariant(sku in (...))))'` or product projections by SKU, 100 per call). Out of stock everywhere: SKUs of the store's selection with `sum(availableQuantity) = 0` across the branches (one inventory query per channel, merged in memory; no N+1).
- Wrap each exported function in `withTimeout(promise, 8000)`.

### S-03 Heads-up [SKILL: commercetools-storefront]

`lib/ct/seller/dashboard/heads-up.ts`: `getHeadsUp(storeKey): Promise<HeadsUp | null>` built from `countOutOfStockEverywhere` (decision 4); returns `null` for 0 or for any error (never throws). The banner component shows at most one banner, warning tint, with a **Review** link.

### S-04 Store performance [SKILL: commercetools-storefront]

Server: `lib/ct/seller/store-performance.ts` and `app/api/seller/dashboard/store-performance/route.ts`.

```ts
export interface StorePerformance { currency: string; periodDays: 30; sales: Money; orders: number; averageOrder: Money | null; topProducts: { sku: string; name: string; units: number; revenue: Money }[]; truncated: boolean; }
export async function loadStorePerformance(storeKey: string, days = 30): Promise<StorePerformance>;
```

- Handler: `const session = await getSession(); requireBusinessUnit(session); await authorizeStore(session, session.storeKey, 'store.view-performance')` **before** any commercetools call; then the admin client.
- Query: `adminRoot.inStoreKeyWithStoreKeyValue({ storeKey }).orders().get({ queryArgs: { where: 'createdAt >= :from and orderState != "Cancelled"', 'var.from': <ISO>, sort: 'createdAt desc', limit: 500, offset } })`, up to 5 pages; set `truncated` if more exist. Sum `totalPrice` of the store currency; aggregate `lineItems` by SKU; orders with `custom.fields.isTest = true` (`malva-checkout`) are excluded from sales and counts. Orders that contain a recurring order line count like any other.
- Cache: `unstable_cache` keyed `['store-performance', storeKey]`, revalidate 60 s.
- Add the admin scope `view_orders` to `.env.example` with the reason "store performance and recent orders on the dashboard", plus `view_recurring_orders`, `view_reviews`, `view_products` and `view_stores` where not yet present (run `check-secrets`).
- Required cross-store test `app/api/seller/dashboard/store-performance/route.cross-store.test.ts`.

### S-05 Route Handlers [SKILL: commercetools-storefront]

One handler per widget under `app/api/seller/dashboard/**` (all are seller routes, so each has a `route.cross-store.test.ts` and a `route-policy.ts` entry), `export const dynamic = 'force-dynamic'`, `Cache-Control: no-store`, session required (401), `authorizeStore(..., 'dashboard.view')` first, unexpected upstream failure returns 502 `{ error: 'unavailable' }` (no stack, no commercetools message):

| Route | Returns |
| --- | --- |
| `GET /api/seller/dashboard/kpis` | `{ openOrders, openReturns, activeSubscriptions, unansweredReviews }` (each key may be `null` when only that source failed) |
| `GET /api/seller/dashboard/recent-orders` | `DashboardOrder[]` |
| `GET /api/seller/dashboard/returns` | `ReturnRow[]` |
| `GET /api/seller/dashboard/stock` | low stock by branch |
| `GET /api/seller/dashboard/renewals` | `RenewalRow[]` |
| `GET /api/seller/dashboard/heads-up` | `HeadsUp | null` |
| `GET /api/seller/dashboard/store-performance` | `StorePerformance` |

The `simulate=orders-down` query parameter makes the recent-orders handler and the Open orders KPI fail with 502 outside production.

### S-06 Client hooks and widgets [SKILL: commercetools-storefront]

- `hooks/dashboard/*.ts`: `useDashboardKpis`, `useRecentOrders`, `useReturnsToHandle`, `useLowStock`, `useRenewals`, `useHeadsUp`, `useStorePerformance`. Every SWR key starts with the business unit and store key: `['dashboard-orders', businessUnitKey, storeKey]`. The page forwards `?simulate=` only when present.
- `components/portal/dashboard/`: `WidgetCard.tsx` (white card, radius 8, padding 24, title, optional action link; loading skeleton; error slot), `WidgetError.tsx` (critical-tinted block with title, message and **Retry** calling that widget's `mutate`; exact copy for orders: "Orders unavailable — We couldn't load your store orders. The rest of your dashboard is unaffected."), `KpiCard.tsx` (label, value 24 px bold, note; `state: 'loading' | 'ok' | 'unavailable'`, unavailable shows "Unavailable"), `RecentOrders.tsx` (number, date, customer, total, status chip), `ReturnsToHandle.tsx` (empty state "No returns need your attention."), `LowStockByBranch.tsx` (empty state "All branches are stocked."), `SubscriptionsRenewing.tsx` (empty state "No renewals in the next 7 days."), `HeadsUpBanner.tsx`, `StorePerformance.tsx`.
- KPI cards: Open orders (note "Placed on your storefront"); Open returns (note "Requested to inspected"); Active subscriptions (note "Recurring orders"); Unanswered reviews (note "Reply from the Reviews page").
- Page `app/[locale]/(portal)/page.tsx` (replace the R placeholder): server component computing the greeting and the subtitle "{store name} · {region} · {currency}", then the grid. Body max width 1100 px beside the rail; KPI grid `repeat(auto-fit, minmax(200px, 1fr))`; widget pairs `minmax(320px, 1fr)` stretched to equal height; 16 px gaps. Tokens only; `check-tokens` must pass. Group heading "Your store" (Admin only) above the performance block.
- Retry for a widget calls `mutate` on that widget's key (the Open orders KPI shares the orders key and refreshes with it; no other key).

### S-07 Messages

Both locale files, identical keys, under `dashboard.*`: greeting variants, subtitle, KPI labels and notes, widget titles, empty states, exact error copy above, chip labels (Shipped, Processing, Payment pending, Cancelled), group heading, "Unavailable", "Retry", "Review".

## 7. Test-first scenarios (vitest)

Run: `cd portal && npx vitest run lib/mappers lib/ct/seller/dashboard app/api/seller/dashboard components/portal/dashboard`.

| File › test name | Asserts |
| --- | --- |
| `lib/mappers/order-status.test.ts` › `shipped, processing, payment pending, cancelled map to success, info, warning, critical` | table |
| same › `cancelled wins over shipped state` | precedence |
| `lib/ct/seller/dashboard/orders.test.ts` › `reads use the in-store endpoint of the session store, never project-level orders` | spy on `adminRoot` |
| same › `open orders count reads total with limit 1` | query args |
| `lib/ct/seller/dashboard/returns.test.ts` › `counts open statuses, tolerates a missing custom type, one orders call for the whole list` | counts, call count 1 |
| `lib/ct/seller/dashboard/subscriptions.test.ts` › `active count and renewals within 7 days; paused excluded` | values |
| `lib/ct/seller/dashboard/reviews.test.ts` › `unanswered excludes replied and other stores; absent type gives 0` | values |
| `lib/ct/seller/dashboard/stock.test.ts` › `low stock top five per branch; out of stock everywhere counts only parts at 0 in every branch` | values |
| `lib/ct/seller/dashboard/heads-up.test.ts` › `0 gives null; error gives null; href starts with slash` | cases |
| `app/api/seller/dashboard/*/route.test.ts` › `401 without session`, `502 body has no stack or upstream message when commercetools fails` | each route |
| `app/api/seller/dashboard/*/route.cross-store.test.ts` › `forged storeKey in query or body is ignored; admin of A asking for store B data gets 403 with zero commercetools calls` | mock not called |
| `app/api/seller/dashboard/store-performance/route.test.ts` › `buyer 403 and admin 200` (role matrix) | status codes |
| `lib/ct/seller/store-performance.test.ts` › `sums, average, top five by revenue, truncated flag over five pages` | aggregation |
| `components/portal/dashboard/Dashboard.test.tsx` › `orders down: Open orders KPI reads Unavailable, orders widget shows the exact message with Retry, other widgets render normally` | DOM |
| same › `retry succeeds: only the orders key is revalidated` | SWR mutate spy |
| same › `one widget failing does not remove the others` for each widget | DOM |
| same › `status chips use the four tones` | class or token |
| same › `empty states for returns, stock, renewals` | text |
| same › `role matrix: Admin sees Your store; Buyer does not` | DOM |
| same › `greeting by hour in Europe/Berlin (07:00, 14:00, 20:00)` | fake timers |
| same › `simulate is ignored in production` | env |
| `lib/format.test.ts` › `formatMoney uses fraction digits and locale` for de-DE and en-US | strings |

## 8. Chrome DevTools MCP recipe

Preconditions: portal running on `http://localhost:3001` with seeded data; demo emails from `seed/README.md`. Screenshots to `plans/evidence/S/<nn>-<name>.png`. After each page load `list_console_messages` must show no errors.

1. Sign in as **Admin** (R's flow). `navigate_page http://localhost:3001/de-DE`. `resize_page` 1440 x 900. `take_snapshot`: greeting matching the time (en-US route: "Good ..."), subtitle with store, region, currency, four KPI cards, five widgets, "Your store" group. Screenshot `01-admin-1440.png`.
2. Layout assertions with `evaluate_script`: `document.querySelector('[data-testid=dashboard-body]').getBoundingClientRect().width <= 1100`; KPI cards each at least 200 px wide; the two widgets of a pair have equal `height`.
3. `navigate_page http://localhost:3001/de-DE?simulate=orders-down`: Open orders KPI reads "Unavailable", the orders widget shows the exact error copy and Retry, every other widget shows data. Screenshot `02-orders-down.png`. `list_network_requests`: `/api/seller/dashboard/recent-orders` is 502, the others 200.
4. Retry success: `evaluate_script: history.replaceState(null, '', '/de-DE')`, clear the network list, click Retry: the widget and the KPI show data and only the orders endpoint is re-requested.
5. **Buyer:** sign in as Buyer: the dashboard renders without the "Your store" group; `evaluate_script` `fetch('/api/seller/dashboard/store-performance').then(r => r.status)` returns 403 for Buyer and 200 for Admin. Screenshot `03-buyer.png`.
6. Status chips: in Recent orders confirm chip texts and computed background colours differ per tone (record the four `getComputedStyle` values in Notes). Place one order through the storefront checkout (G7 path) and reload: it appears at the top.
7. Dark mode screenshot `04-admin-dark.png`. Responsive: 1024 x 800 and 375 x 800: no horizontal scroll, KPI cards wrap to one column at 375. Screenshots `05-1024.png`, `06-375.png`.
8. Heads-up: set one part's inventory to 0 in every branch (MCP is read-only: ask for the seed fixture instead, or use the seed script flag `--scenario=stock-out`); the banner names the count and links to `/de-DE/catalog?tab=assortment&stock=none`; with stock restored, no banner. Low stock widget lists the part under each branch.
9. Switch store in the switcher (second reseller): all numbers change to that store's data.
10. Production build check: `npm run build && npm run start -- -p 3001`; `?simulate=orders-down` shows **no** unavailable state (ignored).

## 9. `b2b2c-automotive` MCP read-back checks

1. `read_orders` with `store(key="<storeA>")`: count of `orderState = Open` equals the Open orders KPI; count and sum of orders in the last 30 days (state not Cancelled) equal the Your store group; top product SKU equals the highest revenue SKU from the line items.
2. `read_orders` where `returnInfo is not empty` in the store: open item count equals the Open returns KPI.
3. `read_recurring_orders` where `store(key="<storeA>")`: Active count equals the KPI; renewals within 7 days equal the widget.
4. `read_reviews` where `custom(fields(storeKey="<storeA>"))`: those without `replyText` equal the Unanswered reviews KPI.
5. `read_stores` (channels of the store) and `read_inventory` per supply channel: low stock and out-of-stock-everywhere figures equal the widget and the banner count.

## 10. Manual items for `plans/TODO-MANUAL-TESTING.md` (never wait silently)

| ID | Needed by | Action | Expected |
| --- | --- | --- | --- |
| OA-01 (exists) | S-04 live | Admin client needs the extra scopes listed in S-04 (reasons in `.env.example`) | dashboard data returns |
| OA-12 (exists, merged from T) | S-04 live | Admin client scopes for the seller side are collected in one row | no 403 on dashboard reads |
| SO-01 (exists) | S-06 | Sign off the "Your store" block, the error copy, the greeting wording and the derived heads-up (not in the designs) | approved or change list |
| M-S-1 | S-07 | Compare the dashboard with `design/export/Malva Seller Portal.dc.html` page `dash` at 1440 px and 375 px, light and dark, noting the removed buying widgets | matches except documented changes |

## 11. Definition of done

- Every test in section 7 written first, failing, then passing; `npm run check` and `npm run build` green.
- Chrome recipe complete for Admin and Buyer; evidence saved; console clean.
- Numbers on screen equal the MCP read-backs.
- No widget shares a failure with another; retry touches only its own key.
- Simulation switch is inert in production (test and build check).
- No buying-from-Malva, approval, invoice, credit, price-floor, territory or e-mail element exists on the page.
- Scopes added are in `.env.example` with reasons; `scopes.test.ts` green.
- Q-S01 to Q-S03 in `plans/notes/questions-RSTU.md` updated by the lead (Q-S01 and Q-S02, about finance fields, are obsolete).

## 12. Evidence

`plans/evidence/S/01-admin-1440.png`, `02-orders-down.png`, `03-buyer.png`, `04-admin-dark.png`, `05-1024.png`, `06-375.png`, and the chip colour values and network summaries under "Notes".

## Seed requests

None. Everything S reads exists in the seed (store with branch supply channels and inventory, `malva-return-item`, `malva-checkout.isTest`) or is created by the app flows (orders, recurring orders) or by V (`malva-review`). The dashboard has no wholesale, credit or heads-up business-unit field: the earlier fields `creditLimit`, `paymentTerms` and `headsUp` are not read, and the banner is derived from stock (decision 4).

## Notes

(Fill in during the work.)
