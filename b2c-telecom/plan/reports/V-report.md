# Workstream V report (post-purchase: cancel and device return)

Branch `ws/v-post-purchase-cancel-and-device-return`. Live work ran against `spec-test-b2c-telecom` only (QA customer, QA orders, the seed client behind the allow-list guard, a dev server on port 3010 driven with curl). The Chrome checks were not run in a browser. All QA data was removed with `cleanup-qa.ts`.

## Done
V-01 … V-12 (ticked). `npm run verify` passes (full run after V-11; V-12 ran lint, typecheck and its tests). All four scenario rows have a test with the verbatim title; the D-040 tests exist.

Live results (QA customer):
- Return: `POST /api/orders/QA-9614B4/return` 200, `returnInfo` item `Advised` / `NonRefundable`, comment `defective: cracked`; the repeat call answers 400 `QUANTITY_TOO_HIGH`.
- Cancel: phone+device order refused 409 `NOT_CANCELLABLE` `SERVICE_STARTED`; a QA equipment order (service start in the future) cancelled: order `Cancelled`, `cancellation` record stored, its recurring order `Canceled` (checked with MCP), second call 200 with no new write; anonymous 401.
- Demo script: `--ship-two-parcels` gave "Partly shipped", Shipment 1 of 2 / 2 of 2, Parcel 1 of 2 / 2 of 2 / 1 of 1 with DP000111/222/333; `--seed-received-return` and `--refund` ran.

## Not done / blocked
- Chrome checks C-V-1 … C-V-14 were not run (ready, see below). OA-05 is not needed.

## Questions for the owner
- The order-number shape check is `^[A-Za-z0-9][A-Za-z0-9-]{0,39}$`, not U's `MLV-...` pattern, so QA orders (`QA-...`) can be tested; ownership is proven by the lookup. Confirm.
- The cancel window uses `serviceStartDate` as stored by U (U stores the LONGEST install lead, the plan said earliest).

## Missed features and deviations
- Components live in `components/orders/`; S's empty slot `components/account/OrderActions.tsx` was deleted and `OrderDetail` imports the new one. `OrderDetail` and the page get a `nowIso` prop (server clock via `postPurchaseNow()`).
- Stored formats are S/M's: `etfByLine` is built from `labelSnapshot` labels matched by SKU (`label.etf`), not `{ lineItemId: label }`.
- Order custom type is read with `expand=custom.type` (`obj.key`), because the plain reference has no key.
- `requestReturn(orderNumber, customerId, body, locale)` takes the raw body and validates it itself (needs the order's returnable lines); throws `ReturnInputError` (400 codes) or `ReturnNotAllowedError` (409). `cancelOrder` takes a `locale` argument too. "All units already requested" answers 400 `QUANTITY_TOO_HIGH` (per C-V-9), not 409.
- API codes beyond E's closed set (NOT_CANCELLABLE, CANCEL_FAILED, RETURN_FAILED, ORDER_NOT_FOUND, return codes) use T's `AccountRefusal` / `accountRoute` (shared helper `lib/api/order-actions-api.ts`); the client reads them with `accountRequest` (`AccountApiError`).
- The order pages are server-rendered, so there is no SWR order key consumer: the hook writes `keyOrder(n)` / `KEY_ORDERS` (new in `lib/cache-keys.ts`) and the dialogs call `router.refresh()`.
- Recurring orders are cancelled through the existing `getRecurringOrdersForOrder` / `setRecurringOrderState` of L (with its busy retry).
- Custom `Button` danger variant does not exist: the red confirm button is a local styled button.
- New top-level message namespace `orders` (both locales; parity test list updated); extra keys beyond the plan table (`actions.title`, `cancelled.titleNoDate`, counters, dialog errors). German strings are my translation: flag as machine-translated.

## TODOs for other workstreams
- S/M: `PriceSchedule` still says "Dates assume you order today" on order detail (unchanged).
- U: the confirmation page's own cancel check should use `cancelEligibility` if it should also respect shipped/return blocks.

## Findings
- `addDelivery` (with `parcels`, `trackingData`, parcel `items`) works, BUT the platform refuses it with 400 `InvalidOperation: Shipping method is not set.` on an order without a shipping method (plan-only, phone-only and QA-script orders). Orders from checkout with equipment have one. The demo script refuses ship flags on such orders with a clear message. There is no order action to set a shipping method.
- `addReturnInfo` item with `shipmentState: Advised` gets `paymentState: NonRefundable`; with `Returned` the platform sets `Initial` (script flags rely on it); `setReturnPaymentState` by `returnItemId` works.
- `setRecurringOrderState canceled` with a reason works; one recurring order per equipment-only order (two rental lines share one).
- `GET /orders/order-number=...?expand=custom.type` returns the type key in `custom.type.obj`.
- Dev-mode caveat: `Cache-Control` is `no-cache` in `next dev` (as before); `DEV_NOW_OFFSET_DAYS` only works in dev.

## Manual tests added
None.

## Junior design choices
Cancel and return boxes are bordered cards in one "Order actions" section; native `<dialog>` modals (`ModalDialog`), radio list for cancel reasons, select for return reasons, `QuantityStepper` 0..available per device, red pill confirm button, danger-bordered pink cancellation notice, shipment cards with parcel rows, returns with two labelled lines (Goods / Refund), tracking reference as selectable text (no mono font token).

## Chrome checks ready
C-V-1 … C-V-14 as written. Notes: orders must have a shipping method for C-V-7 (place through checkout with a router; the QA script orders cannot be shipped); phone-only and QA `devices` orders show "service has started"; use `place-test-order.ts --cart-id` or U's demo payment for orders; `npm run demo:advance-order -- --confirm-project spec-test-b2c-telecom --order <n> --ship-two-parcels|--ship-all|--deliver|--refund|--seed-received-return --line <id>`.
