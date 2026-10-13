<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream V: names as built (J19, 2026-10-12)

The plan's intended names against the real files. Where a file differed from the plan, the file won. Portal side only; the `[STOREFRONT]` tasks are deferred (see `MISSED-FEATURES.md`, rows V-01 to V-07).

| Plan | Built | Note |
| --- | --- | --- |
| `lib/authz/route-policy.ts` | does not exist (Q-W17); every route names an action of `lib/authz/permissions.ts` (`authorizeSeller` / `authorizedBody`) and `lib/authz/v-role-matrix.test.ts` scans every V route file | `check-routes --static` still enforces a `route.cross-store.test.ts` next to every seller route |
| Role matrix "Admin and Buyer: absent, 403" for Returns and Reviews | R's table (`returns.view`, `reviews.view` = both roles) stays: a Buyer may READ the two lists, every write is Admin only | Q-V11 |
| `lib/ct/admin-client.ts` in V code | `vRoot()` in `lib/ct/seller/v-root.ts` (admin client, or the V fixture client with `PORTAL_DEV_FIXTURES=on`; tests use `setVRootForTest`) | same idea as `wRoot()` |
| `lib/customers/aggregate.ts`, `mask.ts` | as planned (`aggregate(customers, orders, query?)`, `maskEmail`, `maskCustomer(customer, role)`) | search is applied before masking, the e-mail never leaves the server |
| `lib/ct/seller/customers.ts` `listCustomers`, `listGuests` | `listCustomers(storeKey, { tab, q, offset, limit })` reads customers and orders itself (up to 1,000 customers and 2,500 orders, `truncated` says when more exist) and derives guests; no `listGuests` | no `unstable_cache` (a shared cache in front of the store check would be a leak risk, and the fixture mode must show writes at once) |
| `lib/ct/seller/garage.ts` | `parseGarage(raw)` returns `{ id, label }[]` (max 5, malformed entries dropped) | same shape guard as `storefront/lib/vehicles/garage.ts` |
| Notes `malva-customer-notes` | `addCustomerNote`, notes listed inside the customer detail; key `<storeKey>--<customerId>`, value carries `storeKey` | max 1,000 characters, max 200 notes |
| `portal/lib/impersonation/token.ts` | `signHandoff`, `verifyHandoff`, constants (`IMPERSONATION_AUDIENCE`, `HANDOFF_TTL_SECONDS`, `IMPERSONATION_IDLE_SECONDS`, `IMPERSONATION_ABSOLUTE_SECONDS`) | the storefront needs an equal verifier |
| Shop-as route `/api/seller/customers/[id]/shop-as` | as planned, plus `lib/ct/seller/impersonation.ts` (`startShopAs`, `endShopAs`) | `endShopAs` is called by R's exit route (`app/api/seller/impersonation/exit/route.ts`), best effort, found by `value(actorId=...)` so no session key was added |
| `lib/ct/seller/subscriptions.ts` `pauseSubscription` etc. | one function `runSubscriptionAction(storeKey, id, action, actorId)` with `action` in `pause|resume|cancel|skip`, plus `listSubscriptions`, `listAudit` | the pure model is `lib/subscriptions/model.ts` (`mapSubscription`, `monthlyCents`, `canSubscriptionTransition`, `actionTarget`, `summarize`) |
| `components/subscriptions/SubscriptionActions.tsx` | as planned; announces in a `role="status"` region, disabled actions carry their reason text (`aria-describedby`) | Y cites this path |
| `lib/contracts/return-item.ts` + storefront copy + `check-shared-copies.mjs` | portal copy built (`lib/contracts/return-item.ts`, with `RETURN_WINDOW_DAYS`, `canTransition`, `withinReturnWindow`, `returnWindowProblem`, `nativeStates`); storefront copy and the check script are deferred | MISSED-FEATURES V-02 |
| `lib/ct/seller/returns.ts` `listReturns`, `createReturn`, `transitionReturn`, `reconcileRefund` | as planned; also `getReturn`, `getOrderForReturn`, `markDelivered` | `markDelivered` lives here, the route is `app/api/seller/orders/[number]/delivered` |
| `lib/ct/checkout-payments.ts` `refundPayment(paymentId, { currencyCode, centAmount })` | `refundPayment(paymentId, { centAmount, currencyCode })`, returns `{ outcome }` | the file is exempt from the raw-http lint rule like `lib/import/import-api.ts` |
| HTTP 422 codes (`RETURN_WINDOW_CLOSED`, `NOT_DELIVERED`, `QUANTITY_EXCEEDS_PURCHASED`, `REFUND_EXCEEDS_PAID`) | 409 for state refusals (`NOT_DELIVERED`, `RETURN_WINDOW_CLOSED`, `INVALID_TRANSITION`, `NOT_ACTIVE`, `CAPTURE_REQUIRED`, `REFUND_PENDING`) and 400 for bad values (`QUANTITY_EXCEEDS_PURCHASED`, `REFUND_EXCEEDS_PAID`, `REASON_REQUIRED`) | `lib/api.ts` answers any other status with 500 (same as Q-W13); the machine `code` is unchanged |
| `components/returns/ReturnActions.tsx`, `StatusChip.tsx` | as planned | Y cites `ReturnActions` |
| Return detail page `returns/[number]/page.tsx` | a drawer on the list page (`components/returns/ReturnDrawer.tsx`), no extra route | the customer detail page `customers/[id]` is a route and is on `ROUTE_ALLOW_LIST` |
| `lib/ct/seller/reviews.ts` `list`, `reply`, `setVisibility` | `listReviews`, `replyToReview`, `setVisibility` | `replyBy` holds the store's display name, which the storefront shows ("Reply from {replyBy ?? store}") |
| `scripts/ensure-v.mjs` | as planned; the seed already has `refundRequestedAt`, so step 2 is a no-op | |

Containers V uses: `malva-customer-notes` (`<storeKey>--<customerId>`), `malva-subscription-audit` (`<storeKey>--<recurringOrderId>--<n>`, created with `version: 0`), `malva-impersonation` (`<jti>`). Custom type created by V: `malva-review` (and states `review-published`, `review-hidden`) by `ensure-v.mjs`. No other type.

## Verified with the commercetools docs tools (2026-10-12)

| Unverified in the plan | Finding |
| --- | --- |
| Recurring order update actions | Pause, resume and cancel are `setRecurringOrderState` (not `setState`) with `recurringOrderState: { type: 'paused' | 'active' | 'canceled' }` (`RecurringOrderStateDraft`; `active` may carry `resumesAt`, `canceled` a `reason`; `expired` exists but is system set). Skip is `setOrderSkipConfiguration` with `skipConfigurationInputDraft: { type: 'Counter', totalToSkip }` (optional `updatedExpiresAt`). The state field is `recurringOrderState` (`Active`, `Paused`, `Expired`, `Canceled`, `Failed`); a `Failed` order can be set back to `Active`. Updates fail with `InvalidOperation` while the order is being processed (V answers 409 `BUSY`). |
| In-store endpoint for recurring orders | None: the OAS has `/{projectKey}/recurring-orders` only. Reads and writes are scoped by `store(key="...")` in the predicate; the order is fetched with `id="..." and store(key="...")` first. |
| Skip semantics | `totalToSkip` of the Counter is a number of upcoming orders to skip and `skipped` counts them; the docs do not say whether a second call adds or replaces. V sends `totalToSkip: 1` only when none is pending (409 `SKIP_PENDING` otherwise). Live check M-V-09. |
| Refund through Checkout | `POST https://checkout.<region>.commercetools.com/<projectKey>/payment-intents/<paymentId>` with `{ actions: [{ action: 'refundPayment', amount: { centAmount, currencyCode }, transactionId?, merchantReference? }] }`, ONE action per request, answer `{ outcome: 'approved' | 'rejected' | 'received' }` (`received` = processed asynchronously). Errors: `MultipleActionsNotAllowed`, `RequiredField`, `ResourceNotFound`, `ConnectorTimeout` (30 s). Scope `manage_checkout_payment_intents:<projectKey>`. |
| Refund transaction shape | The Payment gets a Transaction of `type: 'Refund'` whose `state` is `Initial`/`Pending` first and `Success`/`Failure` after the connector is notified. The response of the Payment Intents call carries no transaction id, so V matches by type, amount and a timestamp not older than the request (`refundRequestedAt` minus 60 s). Live check M-V-08. |
| Return shapes | `addReturnInfo` items accept `shipmentState` and `custom`; `setReturnItemCustomField`, `setReturnShipmentState` (`Advised`, `Returned`, `BackInStock`, `Unusable`) and `setReturnPaymentState` (`NonRefundable`, `Initial`, `Refunded`, `NotRefunded`) are used as in D5. |
