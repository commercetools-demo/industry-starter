# Workstream S report (account shell, dashboard and order history)

Branch `ws/s-account-shell-dashboard-orders`. Live work ran against `spec-test-b2c-telecom` only: reads with the storefront client, the QA script and its cleanup with the seed client behind the allow-list guard. A dev server on port 3217 was driven with curl (login as a QA customer, the account pages, three reorders); the Chrome checks C-S-1 … C-S-15 were not run in a browser.

## Done
S-01 … S-12. `npm run verify` passes (also run after S-01, S-05, S-08 and S-11; the other commits ran lint, typecheck and the affected tests). `node plan/verify-plan.mjs`: 0 uncovered scenarios; its only error is the STATUS count (orchestrator runs `--sync`). All 8 scenario rows have a test with the verbatim title.

Live results (curl, QA customer):
- Dashboard: bill $184.98 for six contract rows (design rows plus the QA add-on), next bill date from the recurring orders, recent orders, contract table, one stored label per plan (Unlimited, Cable 500).
- Order detail of the design order: lines, "Part of Cable 500", totals, three-period schedule, stored label; devices scenario: "Nova Pro 256 GB, Black", "Installments, 24 months · Final payment Sep 7, 2028", $42.00/mo.
- Reorder: complete order 200 with `unavailable: []`, recurring kept (`Fixed`/`Dynamic`), new cart is the session cart; order with the unpublished QA add-on reports it and removes it; unknown number 404 `ORDER_NOT_FOUND`.
- `cleanup-qa.ts` removed 4 QA customers (mine plus R's `chrome-r-*` test customer) with their recurring orders, orders, carts and the temporary product; second run finds nothing.

## Not done / blocked
- Chrome checks C-S-1 … C-S-15 (need a browser; ready to run, see below). Print preview (C-S-12) and the 375 px layout (C-S-13) are untested visually.
- `STATUS.md` untouched (orchestrator).

## Questions for the owner
- The QA `design-demo` schedule fixture has an intro month ($29.99) and a step to $64.99 in the last year, while the order lines are priced $59.99 (the cart cannot carry the intro). After April 2027 the dashboard bill of that QA customer would show $64.99: expected, fixture only.
- Bill and contract rows count every non-cancelled order whose recurring orders are not all Expired/Canceled. A recurring order stays `Active` after a term ends (it becomes month-to-month), as in L's model. Confirm.

## Missed features and deviations
- **Stored formats are L's and M's, not the plan's**: `labelSnapshot` is M's `LabelSnapshot` v1 (`{ v, takenAt, locale, currencyCode, labels: [{ sku, offerKey, label }] }`, matched to lines by SKU), not `{ lineItemId: label }`; `priceSchedule` is `{ v: 1, schedules: [...] }` (a schedule per plan line, matched by SKU). The mapper uses M's `parseLabelSnapshot` and L's `parseSchedules` (wrapped in `lib/mappers/order.ts` as `parseLabelSnapshot` / `parseSchedule`, never throwing).
- **Term of a line**: `contract-term` is NOT saved to line items (only `offer-kind`, `offer-family`, and `intro-free-months`), see Findings. Term comes from the order's schedule (by SKU), else the SKU suffix (`-24M`, `-12M`, `-M2M`, `-MTH`), else `null` ("—"). Device lines take the term from `acquisitionTermMonths`.
- **`acquisitionEndDate` does not exist** in G's `malva-line-item` type. The mapper reads it when a line has it (Q may add it) and otherwise computes the end: installments final payment = service start + (term - 1) months, lease return-by = start + term months. The QA `devices` scenario therefore does not set it.
- **Orders cache wrapper**: `getCustomerOrdersCached` / `getRecurringSummariesCached` live in `lib/ct/orders.ts` (React `cache`), the dashboard reads up to 100 newest orders (`DASHBOARD_ORDERS_LIMIT`). `getRecurringSummaries` is S's own light read (does not use L's `getRecurringOrdersForCustomer`, which expands the cart).
- **Mappers**: `mapOrder(order, locale)` and `mapOrderListItem(order)` (takes the mapped `Order`). Test fixtures are in `test/fixtures/orders.ts` (the boundary check forbids a `.ts` fixture without `server-only` inside `lib/mappers`).
- **Reorder**: Replicate Cart **keeps** a line whose product was unpublished (verified live), so the SKU comparison alone is not enough: `replicateOrderToCart` also reads the published projections (`key in (...)`) and removes lines whose SKU is not sold any more (`planReorder(order, cart, publishedSkus)` in `lib/ct/reorder.ts`). Replicate copies the order's custom fields and the stale `parentLineItemId` ids; both are repaired (`ORDER_ONLY_FIELDS` cleared, parents re-pointed). Error `ORDER_NOT_FOUND` is `NOT_FOUND` with `details.reason` (E's code set is closed). A different currency than the market gives 409 `MARKET_MISMATCH`.
- **"Buy again" feedback**: a toast ("We created a new bundle from this order.") plus navigation to `/bundle`, instead of a `?reordered=<n>` banner (M's bundle page is not edited). Unavailable items open a dialog with a "Continue to My bundle" button.
- **Cache headers**: `next.config.ts` gets `Cache-Control: private, no-store` for `/:locale/account/:path*` (test updated). In dev Next answers `no-cache, must-revalidate` (as R found); verify with `next start` in Chrome C-S-7.
- **No layout-level guard** (R): each page calls `requireCustomerPage`; the account layout renders `AccountShell` only. Order list/detail/dashboard `generateMetadata` is `noindex`.
- **Dashboard panels** are async server components in `app/[locale]/account/_panels/` (BillPanel, RecentOrdersPanel, ContractPanel, PlansPanel), each in its own Suspense, with `attempt()` (try/catch + 4 s timeout) so JSX is never built inside try/catch (React lint rule). `PanelUnavailable` is a plain `role="status"` paragraph; the heading stays visible.
- **Account/Delivery address cards** use the customer R's guard already read (no second customer query); a failed orders read cannot affect them.
- **Contract sort**: start date descending, plans before add-ons, then name (the design lists Cable 500, Unlimited, Spotify; with the Apple TV+ line of the same order the result is Cable 500, Apple TV+, Unlimited, Spotify).
- **Account number**: `customerNumber`, else the custom field `accountNumber` (demo customers), else an em dash.
- **QA script**: needs `--confirm-project spec-test-b2c-telecom` (F's framework rule); `cleanup-qa.ts` also takes `--confirm-project` and `--dry-run`. Variants are found by attributes (`contract-term`, or `color` + `memory-gb`), recurring prices by the recurrence policy id. The temporary add-on is a published `malva-addon` product with one recurring USD price, unpublished after its order; it is a plain product (not a `malva-offer`), so its line shows as "Other".
- `account.order.itemsLabel`, `account.contract.months`, `account.orders.*` extra keys beyond the plan table were added (both locales).
- Two "Log out" buttons on the dashboard (navigation rail and honey card), both from the plan.

## TODOs for other workstreams
- **M**: `PriceSchedule` shows the cart sentence "Dates assume you order today; they are fixed when you place the order." also on an order detail. A prop (for example `placed`) to drop that sentence would fix it; S cannot edit M's component.
- **T**: fill `components/account/DashboardExtras.tsx`; account links `/account/addresses`, `/account/payment-methods`, `/account/lists` exist in the navigation and 404 until T ships. `mapAddress` (in `lib/mappers/order.ts`) is available for the address cards.
- **V**: fill `components/account/OrderActions.tsx` (receives the mapped `Order`); the order detail hides "Buy again" for cancelled orders; `Order.status` and the raw `orderState`/`shipmentState` are on the type.
- **U**: write `labelSnapshot`/`priceSchedule` through M's `stampOrderPricing` (S reads exactly that format); order lines should carry `offerKey`, and device lines `acquisitionMode`/`acquisitionTermMonths` (and `acquisitionEndDate` if Q adds the field).
- **Q**: add `acquisitionEndDate` to `malva-line-item` if wanted; S reads it when present.

## Findings
(for `PROJECT-FINDINGS.md`)
- `GET /orders?where=recurringOrder is not defined` is accepted live (3 demo orders returned); `origin="RecurringOrder"` also valid (0 results, no generated order yet). `apiRoot.recurringOrders()` exists in `@commercetools/platform-sdk` 8.27.
- Order lines carry the variant attributes saved to line items: `offer-kind`, `offer-family` (cable, fixed-wireless, phone, addon, ...), `intro-free-months` (where set). **`contract-term` and `charge-type` are not saved**: the term must come from the SKU, the schedule or the line's acquisition fields. `offer-kind` / `offer-family` values are enum `{ key, label }`.
- Line custom fields on demo/QA orders: `offerKey`, `parentLineItemId`, and for devices `acquisitionMode`, `acquisitionTermMonths`.
- Replicate Cart (`POST /carts/replicate { reference: { typeId: 'order', id } }`) returns 201 with an Active cart that keeps `customerId`, currency, country, the shipping address, `recurrenceInfo` (policy and price selection mode) and line custom fields, **copies the order's custom type and fields** (`serviceStartDate`, `priceSchedule`, `labelSnapshot`, `demoMarker`, ...), keeps `parentLineItemId` pointing at the **order's** line ids, and **keeps a line whose product has been unpublished** (price from the old line).
- Orders created from a cart with a recurring line get an Active Recurring Order within seconds; an order cancelled by `changeOrderState` works for QA cleanup; deleting recurring orders needs `setRecurringOrderState canceled` first (cleanup does this).
- `cleanup-qa.ts` removes recurring carts too (carts by `customerId`).
- QA script differences from the plan: no `acquisitionEndDate` field (not in the type); `--confirm-project` required; the order state stays `Open` (status "Placed").

## Manual tests added
None.

## Junior design choices
- Dashboard: summary cards are bordered white cards with a small caps label; the delivery address card (undrawn) lists name, street, city/state/ZIP/country, and "Manage addresses" (or "No address saved yet." + "Add an address"); Recent orders as rows (number link + date, status tag, total); empty states are one sentence plus a "Browse plans" button.
- Account navigation: pill links (brand-950 when current) in a vertical rail from 1024 px, a horizontal scrollable row below, "Log out" last.
- Order list: status chips as real buttons that change the query string; table that stacks into labelled blocks below 640 px; Previous / "Page n of m" / Next with disabled spans at the ends.
- Order detail: heading block with placed date, status tag and service start; items table with sub-lines (acquisition mode and end date, "Part of {plan}"); a bordered totals card with per-mode lines only for mixed modes; delivery address plus status tag; actions row (Buy again, Print receipt, V's slot). Print: `receipt.css` hides the site header/footer (`body > div > header|footer`) and `[data-print="hide"]`, shows "Receipt for order {number}" and "Customer: {name}".
- "Buy again" dialog: native `<dialog>` with the unavailable names and one "Continue to My bundle" button.

## Chrome checks ready
C-S-1 … C-S-15. Setup: `cd site && npx tsx scripts/seed/create-qa-order.ts --confirm-project spec-test-b2c-telecom [--scenario ...] [--discontinued]` prints the QA email and a one-time password; clean up with `npx tsx scripts/seed/cleanup-qa.ts --confirm-project spec-test-b2c-telecom`. Notes for the checker: the design-demo bill is the sum of the contract rows ($129.98 without the QA add-on: 59.99 + 10.00 + 50.00 + 10.00); "Account no. —" for QA customers; C-S-11 "lands on /bundle" has a toast, not a `?reordered` banner; C-S-12 needs `next start` or an emulated print media.
