<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream N: Subscriptions (subscribe and save, recurring orders, account management)

Read `plans/JUNIOR-GUIDE.md` first. Everything runs in `storefront/`. Dev URL assumed `http://localhost:3000`.

## 1. Header

| Field | Value |
| --- | --- |
| ID | N |
| Name | Subscriptions: recurring prices on the product page, subscribe lines in the bag, recurring orders after checkout, management in the account |
| Depends on | K (order placed, confirmation page, `checkoutBlockers`), L (account shell and the Subscriptions stub tab), and through them I (cart, Subscriptions group), H (product page, Subscribe block, `POST /api/cart/lines`, `GET /api/recurrence-policies`), G (product mapper, cart core), D (server core, cache keys), E (atoms), F (toast, shell) |
| Wave | 10 (parallel with O and P) |
| Specs implemented (primary first) | `subscriptions-and-recurring-orders` (primary); `fulfilment-and-availability-model` (requirement "Subscriptions" and its scenario; extends F and K); `design-account-area` (Subscriptions tab, scenario "Skip"; extends L); `design-product-detail-page` (Subscribe and save option; extends H); `design-cart-page` (Subscriptions group; extends I) |
| Overlap with other workstreams (read first) | **H already builds** the product page Subscribe block, `GET /api/recurrence-policies`, `hooks/useRecurrencePolicies.ts`, `formatInterval` and the `subscribe` branch of `POST /api/cart/lines` (body field `recurrencePolicyKey`, `priceSelectionMode: 'Fixed'`, `buildAddLineAction`). **I already builds** the cart Subscriptions group (no Collect or Ship chips on subscribe lines; the schedule is changed on the product page or in the account). **K already builds** `lib/checkout/guards.ts` (`checkoutBlockers`, N appends the guest rule) and `OrderSubscriptionCard` (N plugs `SubscriptionNote` into it). **L already builds** the account tab list and a stub `subscriptions/page.tsx` (N replaces it). **D already defines** the cache key `keyRecurringOrders(customerId)`, `KEY_RECURRENCE_POLICIES` and the TTLs. N **extends** these files and never duplicates them. |
| Generated template that applies | `subscriptions-and-recurring-orders` is a generated B2B template. It applies as written to a B2C shopper with these adaptations: owner is the **customer** (not a business unit), the buyer is the shopper, "payment details" are the saved payment methods of workstream L. The template's link to saved/requisition lists does not apply (B2B). |
| Owner prerequisites | OA-02 (scope `manage_recurring_orders`, see D2 below for one more scope), OA-04 (Checkout application, needed for a real subscribe order), OA-N1 (decide renewal payment, see Q-N-5), SO-N1 (subscription wording), seed request SR-N1 (see section 9). The lead numbers the `-N` placeholders. |
| Skills | `commercetools-storefront` (`references/core/optional/recurring-prices.md`, `recurring-orders.md`, `references/b2c/optional/recurring-prices.md`, `recurring-orders.md`, `stack/nextjs/*`), `commercetools-commerce-patterns` (recurring orders, recurrence policy, price selection mode). Every task touching commercetools carries `[SKILL: ...]`. |

## 2. Goal and scope

**Goal.** A shopper can choose "Subscribe and save" for a pod or coffee, pick how often, check out, and afterwards see, skip, pause, resume, re-time and cancel the subscription from `/account/subscriptions`, without ever re-creating it. The shopper is told in words, before paying, whether the price is locked or can change (Fixed or Dynamic).

**In scope**

1. Verify, with tests and the browser, what H and I built for subscribe lines, and add the **price-lock statement** (Fixed) in H's Subscribe block, I's Subscriptions group, and the account card.
2. The guest rule: a bag with a subscribe line needs a signed-in account before payment (appended to K's `checkoutBlockers`).
3. Recurring orders after the order: a spike to learn what the platform creates, then expose it; failure means "subscription pending" and never touches the order.
4. `GET /api/recurring-orders`, `GET /api/recurring-orders/[id]`, `PUT /api/recurring-orders/[id]` (pause, resume, cancel, skip, set interval).
5. The account Subscriptions tab (cards, empty, loading, error, pending), modals and toasts, replacing L's stub.
6. The "next delivery" note on the order confirmation page (`SubscriptionNote` inside K's `OrderSubscriptionCard`).
7. Tests, browser recipe, evidence.

**Out of scope**

- Ad-hoc "reorder" (that is `Buy again` in workstream L, a cart replication, never a recurring order: spec modeling note).
- Collecting payment for renewal orders (Checkout recurring payments are in **public beta**; Q-N-5 and OA-N1 record the decision; renewal orders are created by commercetools but the payment step is not built here).
- Machines and accessories never offer subscribe (spec).
- Sending any e-mail or SMS: there is no email provider (D-032), so no reminders, no renewal notices, no email promises in any copy (Q-N-14). L's Settings has no subscription-reminder toggle.
- Seller-side subscription management (no portal in this project).
- Editing quantities of an existing recurring order, unless the N-02 spike proves it is possible (task N-09 is conditional).

## 3. Design

### D1. Facts verified against the documentation (2026-10-19, Knowledge MCP)

Record any difference you meet in `plans/PROJECT-FINDINGS.md` and tell the lead.

| Fact | Source |
| --- | --- |
| A price is recurring when it carries `recurrencePolicy`. Embedded prices come back in `variant.recurrencePrices[]` of the product projection, no expand needed (project decision D-017: embedded). | https://docs.commercetools.com/api/recurring-orders-overview#prices |
| `addLineItem` takes `recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id }, priceSelectionMode: 'Fixed' | 'Dynamic' }`. If no price exists for that policy the platform silently falls back to the one-time price (so the UI must only offer policies that have a price). | https://docs.commercetools.com/api/projects/carts (LineItemRecurrenceInfo) and the overview above |
| `Fixed`: the price at creation is used for every later order. `Dynamic`: the current price is read when each order is generated. | https://docs.commercetools.com/api/recurring-orders-overview#define-a-price-selection-mode |
| **Creating an order from a cart with recurring line items makes the platform create the recurring orders itself**: one Recurring Order and one recurring Cart **per distinct schedule**, each holding only that group's lines. `originOrder` is set only in this case. | https://docs.commercetools.com/api/recurring-orders-overview#method-a-create-order-from-cart |
| `POST /recurring-orders` (Method B) needs a cart in which **all** lines are recurring with the same schedule, and a `cartVersion`: `RecurringOrderDraft = { key?, cart, cartVersion, startsAt?, expiresAt?, state?, custom? }`. | https://docs.commercetools.com/api/projects/recurring-orders (OpenAPI `RecurringOrderDraft`) |
| `RecurringOrder` fields we read: `id`, `version`, `cart`, `originOrder`, `startsAt`, `lastOrderAt`, `nextOrderAt`, `skipConfiguration` (`Counter { totalToSkip, skipped, lastSkippedAt }`), `recurringOrderState` (`Active`, `Paused`, `Expired`, `Canceled`, `Failed`), `schedule` (`standard { value, intervalUnit: Days|Weeks|Months }` or `dayOfMonth { day }`), `customer`, `customerEmail`. | OpenAPI `RecurringOrder` |
| Update actions we use: `setRecurringOrderState` (`recurringOrderState: { type: 'paused' | 'active' | 'canceled' }`, **single l**), `setOrderSkipConfiguration` (`skipConfigurationInputDraft: { type: 'Counter', totalToSkip }`), `setSchedule` (`recurrencePolicy: { typeId, id }`). A recurring order cannot be updated while it is processing an order (error `InvalidOperation`). Only `Expired` or `Canceled` recurring orders can be deleted. | https://docs.commercetools.com/api/projects/recurring-orders |
| Failed recurring orders do not retry; they stay `Failed` until set back to `Active`. | https://docs.commercetools.com/api/recurring-orders-overview#failed-recurring-orders |
| Scopes: `manage_recurring_orders:<project>` (view, create, update), `view_recurrence_policies:<project>` (read policies). | https://docs.commercetools.com/api/scopes#recurring-orders |
| Collecting payment before each renewal through Checkout is **public beta**. | https://docs.commercetools.com/api/recurring-orders-overview#payments |

### D2. Decisions taken in this plan (defaults for open questions in section 9)

1. **Price selection mode is `Fixed`** on every subscribe line (the skill's rule; Q-N-1). Copy tells the buyer: "Your price stays the same for every delivery." Dynamic is not offered.
2. **Platform-created recurring orders (Method A) are the default**. The hosted Checkout creates the order from the cart, so the platform creates the recurring orders. N does **not** call `POST /recurring-orders` unless spike N-02 proves the platform did not create them (then task N-09 applies). This differs from the skill text ("create one per subscribe line after checkout"): the skill's draft (`originOrder`, `customer`, `schedule` cast as unknown) is not in the documented `RecurringOrderDraft`. Reported to the lead.
3. One bag with two lines of the same schedule yields **one** recurring order with two lines (platform grouping). The account tab therefore shows one card per recurring order, listing its lines.
4. **Scopes**: the storefront client needs `manage_recurring_orders` (OA-02) and `view_recurrence_policies` (add to OA-02; Q-N-13 asks whether the Frontend template already includes it).
5. **All reads and writes are scoped to the session customer on the server.** `customerId` comes from `getSession()` only. For a recurring order read by id, the handler checks `recurringOrder.customer.id === session.customerId` and returns **404** (not 403) otherwise.
6. **Guests cannot pay for a subscribe line.** The bag may hold one; K's `checkoutBlockers` returns the blocker `sign_in_required` while a subscribe line exists and there is no customer, K's identity step hides "Continue as guest" and says why, and K's session handler answers `401 sign_in_required` (Q-N-4).
7. Subscribe is **ship only** (spec: "deliver every {interval}"); a subscribe line has no `supplyChannel`.
8. Eligibility to show Subscribe: `product.subscribable === true` (seed attribute) **and** the selected variant has at least one recurring price for the shopper's country and currency whose policy exists. Both must hold (spec says subscribable products; the skill says price only; Q-N-12). H builds this gate; N only tests that it holds.
9. Cancel is final (`canceled` cannot be resumed). Pause has no resume date picker; it resumes with "Resume".
10. Subscriptions do not expire (no `expiresAt`).

### D3. Types (`lib/types.ts`, additions)

H's `RecurrencePolicyView` (`{ id, key, name, schedule: { unit: 'Weeks' | 'Months', value } }`, from `GET /api/recurrence-policies`) and H's `formatInterval(schedule)` are reused: N-00 records their real names and file paths. If a recurring order carries a schedule `formatInterval` cannot label (`Days` or `dayOfMonth`, not seeded), the card shows the text `Custom schedule` (`subscription.account.customSchedule`).

```ts
export type SubscriptionState = 'active' | 'paused' | 'canceled' | 'expired' | 'failed';

export interface SubscriptionLine {
  lineId: string;
  sku: string;
  name: string;
  variantLabel: string;               // for example "50 capsules" or "1 kg, whole bean"
  imageUrl: string | null;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
}

export interface Subscription {
  id: string;
  version: number;
  state: SubscriptionState;
  policyId: string | null;            // derived from lines[*].recurrenceInfo.recurrencePolicy.id
  schedule: RecurrencePolicyView['schedule'] | null;   // null when it cannot be expressed (dayOfMonth, Days)
  nextOrderDate: string | null;       // ISO, mapped from nextOrderAt at the API layer
  lastOrderDate: string | null;       // mapped from lastOrderAt
  startedAt: string;
  pendingSkips: number;               // max(0, skipConfiguration.totalToSkip - skipConfiguration.skipped), 0 when absent
  priceSelectionMode: 'fixed' | 'dynamic' | null;
  lines: SubscriptionLine[];
  total: Money;
  originOrderId: string | null;
  originOrderNumber: string | null;
}

export interface PendingSubscription {   // an order with subscribe lines but no recurring order found
  orderId: string;
  orderNumber: string | null;
  placedAt: string;
  lines: Array<{ name: string; quantity: number; policyId: string }>;
}
```

`Money` is the existing `{ centAmount: number; currencyCode: string }`. Components import these from `lib/types.ts` only.

### D4. Files

| File | Purpose | New or extended |
| --- | --- | --- |
| `lib/ct/recurring-orders.ts` (server-only) | `listRecurringOrders(customerId)`, `getRecurringOrder(customerId, id)`, `applyRecurringAction(customerId, id, action)`, `listPendingSubscriptions(customerId, subs)` | new |
| `lib/mappers/recurring-order.ts` | `mapRecurringOrder(raw): Subscription` (D3, D8) | new |
| `app/api/recurring-orders/route.ts` | GET list (+ `?originOrderId=`) | new |
| `app/api/recurring-orders/[id]/route.ts` | GET one, PUT action | new |
| `hooks/useSubscriptions.ts` | SWR hook, key `keyRecurringOrders(customerId)` from D's `lib/cache-keys.ts` | new |
| `lib/checkout/guards.ts` | append the `sign_in_required` blocker for subscribe lines | extends K |
| K's identity step component | hide "Continue as guest" when the blocker is present | extends K (minimal) |
| H's `SubscribeBlock.tsx`, I's subscribe `FulfilmentGroup` content | add the price-lock statement | extends H, I (minimal) |
| `components/account/subscriptions/*` | `SubscriptionsTab.tsx`, `SubscriptionCard.tsx`, `StatusPill.tsx`, `ChangeIntervalDialog.tsx`, `CancelDialog.tsx`, `PendingSubscriptionCard.tsx`, `SubscriptionsSkeleton.tsx` | new |
| `app/[locale]/account/(shell)/subscriptions/page.tsx` | replaces L's stub; auth guard is L's `(shell)/layout.tsx` | replaces L's stub |
| `components/checkout/SubscriptionNote.tsx` | next-delivery note, rendered inside K's `OrderSubscriptionCard` | new |

Paths and names of files that belong to other workstreams (H's Subscribe block, `formatInterval`, `useRecurrencePolicies`, `buildAddLineAction`; I's group renderer; K's identity step and `OrderSubscriptionCard`; L's account layout; F's toast hook; E's modal and button atoms) are **not guessed**: task N-00 finds them with `grep` and records the real paths at the top of `plans/evidence/N/paths.md`; use those.

### D5. Product page and bag: what H and I build, what N adds

**Already built by H and I (N only verifies and tests the subscription parts):**

- Product page Subscribe block: shown only when `product.subscribable` and the shape is not a machine and the selected variant has recurring prices; interval `select` lists only policies that have a recurring price for the variant; saving percent computed from the recurring and one-time price; button label `Subscribe` with the line total.
- `POST /api/cart/lines` with `{ sku, quantity, fulfilment: 'subscribe', recurrencePolicyKey }`: resolves the policy by key, checks the recurring price exists for the market, and calls `buildAddLineAction` with `recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id }, priceSelectionMode: 'Fixed' }` and the line custom field `fulfilment = subscribe`. One-time lines omit `recurrenceInfo` entirely. Errors `400 unknown_policy`, `422 price_unavailable`.
- Cart: group `Subscriptions` with `Delivers every {interval}` and `First delivery by {day}, then every {interval}`; no Collect or Ship chips on subscribe lines (Q-I-10); the shipping method is `mcf-ship-standard` when any line is `delivery` or `subscribe`.

**What N adds (small, tested):**

1. **Price-lock statement.** The spec scenario "Catalog price moved" requires that the buyer is told which price applies. Add the key `subscription.priceLock` ("Your price stays the same for every delivery.") as one line in H's Subscribe block, in I's Subscriptions group (below the heading, together with `subscription.cart.shippingNote`: "Shipping is calculated for each delivery.", Q-N-11), and in the account card (D9). It is shown because every line is `Fixed` (Q-N-1); if the owner ever chooses Dynamic, the key text changes in the catalogues only.
2. **Verification that the mode is `Fixed`.** Test that `buildAddLineAction` for `subscribe` sets `priceSelectionMode: 'Fixed'` (H has its own test; N's test is the scenario-named duplicate that guards the copy) and that the line in the bag shows the lock text.
3. **Policy-key detail.** H's request carries `recurrencePolicyKey`, the recurring orders API uses policy **ids**; N never mixes them (the card derives `policyId` from the order lines).

N changes nothing else in the add-to-bag path. Changing the interval of an existing subscription is done in the account (D11), not in the bag (I, Q-I-10).

### D6. Checkout rule for guests (K's `checkoutBlockers`, minimal change)

`checkoutBlockers(cart, session)` (K, `lib/checkout/guards.ts`) returns an empty list in K. N appends one rule: when `cart.lineItems.some(l => l.recurrenceInfo)` and `!session.customerId`, add the blocker `{ code: 'sign_in_required' }`. K's handlers already turn the first blocker into `401 sign_in_required` (or `409 checkout_blocked`). In K's identity step, when the blocker list contains `sign_in_required`: hide `Continue as guest`, show `A subscription needs an account so you can manage it. Sign in or create one to continue.` (`subscription.checkout.needsAccount`) with the sign-in and register buttons (J's forms, return to `/checkout`). N adds the rule as a pure function `subscribeNeedsAccount(cart, session)` next to `checkoutBlockers` so it is unit tested alone.

### D7. Recurring orders after the order (spike first)

**N-02 is a spike. Do it before any other recurring-order code.** With OA-02 and OA-04 done: in the browser place a test order (Chrome recipe 6.1) with two subscribe lines (same policy), one subscribe line of a second policy, one ship line and one collect line. Then with a read-only script (`seed` package `npm run verify`-style, or the commercetools MCP) read `recurring-orders` where `customer(id=:customerId)` with `expand: ['originOrder','cart']` and record in `plans/evidence/N/spike.md` (ids, keys, states, no personal data):

| Question | What we need to learn |
| --- | --- |
| Did the platform create the recurring orders? How many (expected 2: one per policy)? How long after the order (seconds)? | Method A confirmed or not |
| Does `originOrder` come back, and does `cart.obj.lineItems` list only that group's lines? | Source of the card's lines (default: `cart.obj.lineItems`, fallback `originOrder.obj.lineItems` filtered by `recurrenceInfo.recurrencePolicy.id`) |
| `nextOrderAt` of a new one; `skipConfiguration` absent or `Counter`? | Next delivery date display |
| After `setOrderSkipConfiguration { type: 'Counter', totalToSkip: 1 }`: does `nextOrderAt` move by one interval now, or only when the order would be generated? What do `totalToSkip` and `skipped` read afterwards? A second skip: send 1 or 2? | Skip behaviour for D8; spec scenario "Skip" says the next date moves by one interval |
| After `setSchedule` to another policy: do `schedule`, `nextOrderAt` and the recurring cart line prices change? | Interval change behaviour and copy |
| After `setRecurringOrderState paused`, `active`, `canceled`: values of `recurringOrderState`, `nextOrderAt` (empty when paused per docs) | State mapping |
| Is `changeLineItemQuantity` accepted on `cart.id` of a recurring order? | Whether N-09 exists |
| Does the Checkout (hosted) path behave like a direct `POST /orders` for this? | Method A reached through the Checkout |
| `GET /recurrence-policies` with the storefront client: 200 or 403? | Scope list for OA-02 |

Record every surprise in `PROJECT-FINDINGS.md`. Decide with the lead if the answer to the first row is "no": then N-08 is built.

### D8. Route handler contracts

All JSON, `Content-Type: application/json`, no caching headers beyond `Cache-Control: private, no-store` on the per-person ones. Errors use the D-spec shape `{ "error": { "code": "...", "message": "..." } }`; never a commercetools body.

**`GET /api/recurrence-policies`** (session not required, `Cache-Control: public, s-maxage=300`)

```json
{ "policies": [ { "id": "…", "key": "mcf-every-month", "name": "Every month", "schedule": { "kind": "standard", "unit": "months", "value": 1 } } ] }
```

Calls `listRecurrencePolicies()`: `apiRoot.recurrencePolicies().get({ queryArgs: { limit: 20 } }).execute()` [docs](https://docs.commercetools.com/api/projects/recurrence-policies). Errors: `502 upstream_unavailable`.

**`GET /api/recurring-orders`** (session required; `401 unauthorized`, empty body detail)

Query: optional `originOrderId` (UUID) to filter to one order (used by the confirmation page).

```json
{
  "subscriptions": [ { "id": "…", "version": 3, "state": "active", "policyId": "…", "schedule": { "kind": "standard", "unit": "months", "value": 1 }, "nextOrderDate": "2026-11-19T08:00:00.000Z", "lastOrderDate": null, "startedAt": "2026-10-19T08:00:00.000Z", "pendingSkips": 0, "priceSelectionMode": "fixed", "lines": [ { "lineId": "…", "sku": "…", "name": "…", "variantLabel": "50 capsules", "imageUrl": "https://…", "quantity": 2, "unitPrice": { "centAmount": 2205, "currencyCode": "USD" }, "totalPrice": { "centAmount": 4410, "currencyCode": "USD" } } ], "total": { "centAmount": 4410, "currencyCode": "USD" }, "originOrderId": "…", "originOrderNumber": "MC-10042" } ],
  "pending": [ { "orderId": "…", "orderNumber": "MC-10043", "placedAt": "2026-10-19T08:02:00.000Z", "lines": [ { "name": "…", "quantity": 1, "policyId": "…" } ] } ]
}
```

Server: `apiRoot.recurringOrders().get({ queryArgs: { where: 'customer(id=:customerId)', 'var.customerId': customerId, expand: ['originOrder', 'cart'], sort: ['createdAt desc'], limit: 50 } }).execute()` [docs](https://docs.commercetools.com/api/projects/recurring-orders). Always the predicate variable form; never string-concatenate ids into a predicate. `pending` = orders of the customer (last 10, `sort createdAt desc`) that have at least one line with `recurrenceInfo` and whose id matches no `originOrder.id` in the list above (in-memory compare, because we have not verified that `originOrder` is queryable). Page size 50; more than 50 recurring orders is out of scope (documented limit).

**`GET /api/recurring-orders/[id]`**: `{ "subscription": Subscription }`. `404 not_found` when the id does not exist or belongs to another customer.

**`PUT /api/recurring-orders/[id]`** (session required, JSON only; `415 unsupported_media_type` otherwise)

Request, one of:

```json
{ "action": "pause" }
{ "action": "resume" }
{ "action": "cancel" }
{ "action": "skip" }
{ "action": "setInterval", "recurrencePolicyId": "<uuid>" }
```

Response `200 { "subscription": Subscription }` (the state after the change, mapped; the client puts it in the SWR cache). Errors: `400 invalid_request` (unknown action, missing or malformed policy id), `401 unauthorized`, `404 not_found`, `409 version_conflict` (second conflict), `422 invalid_state` (resume or skip on `canceled`, `expired`; pause on non-active; skip when `pendingSkips > 0`; cancel on `canceled`), `422 subscription_unavailable` (policy unknown), `502 upstream_unavailable`.

Server flow (read-then-write): `get` with `expand`; ownership check; state check; one `post` with the single action and the version just read; on 409 re-read and retry **once**. Actions map as D1. `skip` sends `{ action: 'setOrderSkipConfiguration', skipConfigurationInputDraft: { type: 'Counter', totalToSkip: <value decided by spike N-02> } }`. `setInterval` first verifies the policy exists in `listRecurrencePolicies()`. Never accept `version`, `customerId` or any commercetools field from the client.

Logging: on any failure log `{ route, action, recurringOrderId, correlationId, code }` server-side (no names, no emails).

### D9. Account tab (`design-account-area`, new design: needs sign-off SO-N2)

Route `/[locale]/account/subscriptions`. Auth guard comes from L's account layout (sends to sign-in with `next`); do not repeat it.

`SubscriptionsTab` (client): `const { subscriptions, pending, isLoading, error, mutate } = useSubscriptions()`.

States

| State | Rendering |
| --- | --- |
| Loading | `SubscriptionsSkeleton`: three card skeletons, `aria-busy="true"` on the list |
| Empty (no subscriptions, no pending) | Card with repeat icon, title `No subscriptions yet`, text `Subscribe & save on pods and coffee. Skip, pause or cancel any time.`, button `Shop coffee` (home listing of subscribable products, same URL as the home strip) |
| Error | Card `We could not load your subscriptions.` with `Try again` (calls `mutate()`) |
| Pending | `PendingSubscriptionCard` above the list: title `Subscription pending`, text `We placed your order MC-10043 and are still setting up the subscription. Check back shortly or contact us if it does not appear.`, link to the contact page (P) |
| Failed recurring order (`state === 'failed'`) | Card shows pill `Needs attention`, text `We could not create your last order.` and the Contact link; actions limited to Cancel |

`SubscriptionCard` (spec: product thumbnail, name and variant, interval, next delivery date, price, actions): left a 72x88 thumbnail of the first line (`+N more` badge when several lines), then name (Archivo 600) and variant line, a row `Every month`, `Next delivery 19 Nov 2026`, `Last order 19 Oct 2026` (only when set), the per-delivery total (Roboto Mono for amounts is **not** used; normal text, `formatMoney`), the price-lock line (`Fixed`: `Price stays the same for every delivery.`), status pill (`Active` violet, `Paused` grey, `Canceled` grey with strike-free text, `Needs attention` amber text on a light chip, all with text, never colour only). Actions as buttons: `Skip next`, `Change interval`, `Pause` or `Resume`, `Cancel`. Disabled rules: all disabled while a mutation for this card runs (`aria-busy`); `Skip next` disabled when `pendingSkips > 0` with the visible text `Next delivery skipped` (Q-N-6); paused or canceled cards show only `Resume` (paused) or `Subscribe again` (link to the first line's product page, canceled) and `Cancel` (paused only).

- **Skip**: `PUT { action: 'skip' }`, optimistic text not used; on success update the SWR cache from the response, toast `Next delivery skipped`. If the platform does not move `nextOrderDate` immediately (spike), show `nextOrderDate` plus one interval via `addInterval` and the label `Skipping {date}`. Never show a date computed in the browser unless the spike says it is needed.
- **Pause / Resume**: toasts `Subscription paused` / `Subscription resumed`; paused card shows `No further orders until you resume.`; resume shows the next date from the response.
- **Change interval** (`ChangeIntervalDialog`, modal atom 560 px): radio list of policies from `useRecurrencePolicies()` (current one preselected and marked `Current`), `Save` / `Cancel`; text `The new interval applies from your next order. Your price per delivery stays the same.` (Fixed). `PUT { action: 'setInterval', recurrencePolicyId }`. Toast `Interval updated`.
- **Cancel** (`CancelDialog`, modal): title `Cancel this subscription?`, text `No further orders will be created. Your last order was on {lastOrderDate}.` (when there was none: `No order has been created from it yet.`), buttons `Keep subscription` (focus starts here) and `Cancel subscription`. Toast `Subscription canceled. Your last order was on {date}.` Spec: the buyer is told when the last one was.
- Focus: modal traps focus, Escape closes, focus returns to the button that opened it. Toast does not take focus (E/F).
- Dates: `new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`, time zone UTC for date-only values so the date does not shift between server and browser.

Responsive: card is a 3-column grid (thumbnail, details, actions) above 900 px; under 900 px the actions wrap under the details; under 520 px buttons are full width, 44 px high.

### D10. Confirmation note (K's confirmation page, one component)

`SubscriptionNote` reads `GET /api/recurring-orders?originOrderId=<id>` through `useSubscriptions({ originOrderId })`. If a subscription exists: `Your subscription starts now. Next delivery {date}, then every {interval}. Manage it in your account.` If none yet (race, up to ~30 s): `We are setting up your subscription.` with one retry after 5 s and 15 s; after that `We could not confirm your subscription yet. It will appear in your account; contact us if it does not.` (this is the "subscription pending" case in the confirmation). The order itself is never affected (spec requirement "Subscriptions": failure never rolls back the order). Guest orders cannot contain subscribe lines (D2.6).

### D11. i18n keys (`messages/en-US.json`, `en-CA.json`; identical keys)

en-CA equals en-US (English only; no German, no French, D-030).

| Key | en-US |
| --- | --- |
| `subscription.priceLock` | Your price stays the same for every delivery. |
| `subscription.cart.shippingNote` | Shipping is calculated for each delivery. |
| `subscription.checkout.needsAccount` | A subscription needs an account so you can manage it. Sign in or create one to continue. |
| `subscription.account.customSchedule` | Custom schedule |
| `subscription.account.title` | Subscriptions |
| `subscription.account.empty.title` | No subscriptions yet |
| `subscription.account.empty.text` | Subscribe & save on pods and coffee. Skip, pause or cancel any time. |
| `subscription.account.empty.cta` | Shop coffee |
| `subscription.account.error` | We could not load your subscriptions. |
| `subscription.account.retry` | Try again |
| `subscription.account.pending.title` | Subscription pending |
| `subscription.account.pending.text` | We placed your order {orderNumber} and are still setting up the subscription. Check back shortly or contact us if it does not appear. |
| `subscription.account.failed` | We could not create your last order. |
| `subscription.account.next` | Next delivery {date} |
| `subscription.account.last` | Last order {date} |
| `subscription.account.skipping` | Skipping {date} |
| `subscription.account.skippedLabel` | Next delivery skipped |
| `subscription.account.pausedText` | No further orders until you resume. |
| `subscription.account.moreLines` | +{count} more |
| `subscription.status.active` / `paused` / `canceled` / `expired` / `failed` | Active / Paused / Canceled / Expired / Needs attention |
| `subscription.action.skip` / `changeInterval` / `pause` / `resume` / `cancel` / `subscribeAgain` | Skip next / Change interval / Pause / Resume / Cancel / Subscribe again |
| `subscription.dialog.interval.title` | Change interval |
| `subscription.dialog.interval.text` | The new interval applies from your next order. Your price per delivery stays the same. |
| `subscription.dialog.interval.current` | Current |
| `subscription.dialog.cancel.title` | Cancel this subscription? |
| `subscription.dialog.cancel.textLast` | No further orders will be created. Your last order was on {date}. |
| `subscription.dialog.cancel.textNone` | No further orders will be created. No order has been created from it yet. |
| `subscription.dialog.keep` / `confirmCancel` / `save` | Keep subscription / Cancel subscription / Save |
| `subscription.toast.skipped` / `paused` / `resumed` / `intervalUpdated` | Next delivery skipped / Subscription paused / Subscription resumed / Interval updated |
| `subscription.toast.canceled` | Subscription canceled. Your last order was on {date}. |
| `subscription.toast.error` | That did not work. Please try again. |
| `subscription.confirmation.active` | Your subscription starts now. Next delivery {date}, then every {interval}. Manage it in your account. |
| `subscription.confirmation.settingUp` | We are setting up your subscription. |
| `subscription.confirmation.late` | We could not confirm your subscription yet. It will appear in your account; contact us if it does not. |

H owns the interval and Subscribe block strings (`pdp.*`, `formatInterval`); L's `subscriptions.stub` key is removed from both catalogues when the stub page is replaced.

### D12. Cache and performance rules

- Recurrence policies: already cached by H and D (`unstable_cache` 300 s, tag `recurrence-policies`, SWR key `KEY_RECURRENCE_POLICIES`); the account dialog uses H's `useRecurrencePolicies()` and adds no second request.
- Recurring orders: **never** cached on the server; SWR key is D's `keyRecurringOrders(customerId)`; `revalidateOnFocus: true` (state can change in the platform), `dedupingInterval` 5 s.
- After every PUT, `mutate(key, { subscriptions: updated }, { revalidate: false })` from the response, then one background revalidate.

### D13. Security

Ownership and state checks happen only in the Route Handler. The id in the URL is a lookup key, not an authority: compare `customer.id` with the session. No commercetools identifiers appear in URLs the shopper can edit other than the recurring order id. Validate `action` against an allow-list; validate ids with a UUID regex before use. Mutating handlers accept `application/json` only (a cross-site form post cannot send it).

## 4. Tasks

Common rules: test first; `npm run check` before ticking; commit `ws-n: N-0x summary`; tokens only; both catalogues; no `any`; `import 'server-only'` in `lib/ct/*`. Tests live next to code and are named after the scenario. Tasks that extend H, I, K or L files change only what the task names.

- [x] **N-00 Preconditions and paths.** K and L are `Done` in `STATUS.md`. `grep` for the real names and paths of: H's `SubscribeBlock`, `formatInterval`, `useRecurrencePolicies`, `buildAddLineAction`, `RecurrencePolicyView`; I's subscribe group renderer; K's `lib/checkout/guards.ts`, the identity step and `OrderSubscriptionCard`; L's `subscriptions/page.tsx` stub and `(shell)/layout.tsx`; D's `keyRecurringOrders`; F's toast hook; E's modal and button atoms. Write them to `plans/evidence/N/paths.md`. Confirm OA-02 status; if not done, mark the live parts of N-02 to N-07 `blocked: OA-02` and carry on with the unit-testable parts. `npm run check` is green. [SKILL: commercetools-storefront]
- [x] **N-01 Price lock in H's Subscribe block and I's Subscriptions group.** Add the line `subscription.priceLock` to H's `SubscribeBlock` and to I's subscribe group (with `subscription.cart.shippingNote`), keys in both catalogues. Tests: `Catalog price moved: Subscribe block tells the price stays the same`, `Catalog price moved: Subscriptions group shows the price lock and shipping note`, `Subscribe line is added with priceSelectionMode Fixed` (asserts `buildAddLineAction`), `One-time line omits recurrenceInfo`, `Subscribe line never gets a supplyChannel`, `subscribe and one-time lines of one SKU stay separate lines`. [SKILL: commercetools-commerce-patterns]
- [ ] **N-02 (documentation pass done, live part `blocked: OA-02, OA-04`; see `plans/evidence/N/spike.md`) Spike: what the platform creates, skip, schedule, quantity.** Follow D7 exactly. Needs OA-02 and OA-04. Output `plans/evidence/N/spike.md` and `PROJECT-FINDINGS.md` entries; update this file's D2.2, D8 (`totalToSkip` value) and the status lines of N-08 and N-09 (`built` or `not needed`). If OA-02 or OA-04 is not done: write the question, mark `blocked`, continue with N-03 on the documented defaults and come back. [SKILL: commercetools-commerce-patterns]
- [x] **N-03 Recurring order server module and mapper.** `lib/ct/recurring-orders.ts` (list, get, apply action, pending detection) and `lib/mappers/recurring-order.ts` per D3 and D8 (`nextOrderAt` to `nextOrderDate`, `lastOrderAt` to `lastOrderDate`, lines from `cart.obj.lineItems` with the fallback, `policyId` derived from line `recurrenceInfo`, `pendingSkips`). Predicate variables only. Tests (fixtures, mocked `apiRoot`): `lines come from the recurring cart`, `lines fall back to the origin order filtered by policy`, `next order date is renamed at the API layer`, `pending skips derive from the counter`, `list query is scoped with a predicate variable`, `order with subscribe lines and no recurring order is pending`, `canceled maps to the canceled state with one l`, `unlabelable schedule maps to null`. [SKILL: commercetools-storefront]
- [x] **N-04 Route handlers and hook.** The three route files and `hooks/useSubscriptions.ts` per D8 and D12. Tests (import `GET` and `PUT`, call with `new Request`): `list without a session returns 401 with no detail`, `list returns only the session customer's subscriptions`, `get of another customer's subscription is 404`, `pause calls setRecurringOrderState paused`, `resume sends active`, `cancel sends canceled with one l`, `skip sends the counter draft`, `setInterval rejects an unknown policy`, `resume of a canceled subscription is invalid_state`, `second version conflict surfaces as version_conflict`, `a conflict is retried once`, `non-JSON body is 415`, `client supplied version and customer id are ignored`, `upstream 503 becomes upstream_unavailable`, `originOrderId filter narrows the list`. [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns]
- [x] **N-05 Account Subscriptions tab.** All components of D9, the page replacing L's stub, toasts, dialogs, the skeleton, removal of the `subscriptions.stub` keys. Tests: `Recurring order created: card shows interval and next delivery date`, `Skip: next date and toast`, `Skip disabled while a skip is pending`, `Paused: card says no further orders and offers Resume`, `Canceled: dialog states the last order date`, `Cancel with no order yet says so`, `Schedule changed in place: Change interval keeps the same card`, `Empty state offers Shop coffee`, `Error state offers Try again`, `Pending card links to contact`, `Failed state shows Needs attention`, `Fixed shows the price stays the same`, `focus returns to the opening button`, `buttons are 44px under 520`, `status is text not colour only`. [SKILL: commercetools-storefront]
- [x] **N-06 Guest rule.** `subscribeNeedsAccount`, the appended blocker in K's `checkoutBlockers`, K's identity step change per D6. Tests: `guest with a subscribe line gets the sign_in_required blocker`, `signed-in customer with a subscribe line has no blocker`, `bag without subscribe lines is unchanged`, `identity step hides Continue as guest and explains why`, `session handler answers 401 sign_in_required for a guest bag with a subscribe line`, `Mixed bag shows a Subscriptions group beside Shipping` (I's group, regression). [SKILL: commercetools-storefront]
- [x] **N-07 Confirmation note.** `SubscriptionNote` per D10 rendered inside K's `OrderSubscriptionCard`; retry timers with fake timers in tests. Tests: `confirmation shows next delivery when the subscription exists`, `confirmation says setting up then late message`, `no note on an order without subscribe lines`, `guest order never shows the note`. [SKILL: commercetools-storefront]
- [x] **N-08 `not built (documented Method A; reopen if M-N-04 shows no recurring orders were created)` (conditional on N-02) Create the recurring order ourselves.** Build **only if** the spike shows the platform did not create them. Replicate the order into a cart (`POST /carts/replicate`), remove non-recurring lines, group by policy, create one recurring order per group with `POST /recurring-orders { cart, cartVersion }` ([docs](https://docs.commercetools.com/api/projects/recurring-orders)); called from K's confirmation loader; on failure log `{ orderId, correlationId }`, never throw, never touch the order. If the spike says the platform created them, tick this task with `not needed (spike)` and a link to the evidence. Tests: `Recurring order creation fails: order stays and failure is logged with the order id`, `one recurring order per distinct policy`. [SKILL: commercetools-commerce-patterns]
- [x] **N-09 `not needed: not supported until the live spike shows it works (Q-N-8 stays open)` (conditional on N-02) Quantity change.** Only if `changeLineItemQuantity` on the recurring cart worked in the spike: add a stepper per line on the card and `{ "action": "setQuantity", "lineId", "quantity" }` to the PUT contract (update D8 first). Otherwise tick with `not needed: not supported (spike)`, keep Q-N-8 open and record the second half of scenario "Schedule changed in place" as `quantity: not possible` in section 5. Tests: `Schedule changed in place: quantity change keeps the recurring order id`. [SKILL: commercetools-commerce-patterns]
- [x] **N-10 Messages, a11y, responsive, gates.** All keys of D11 in both catalogues (identical keys, test exists from E); `npm run check`; `npm run build`; no raw hex or fonts; check at 375 and 1440. Tests: `catalogues have the same subscription keys`, `no hard coded strings in subscription components`.
- [ ] **N-11 (offline part done, browser and live parts `blocked: Chrome profile busy / OA-02`, rows M-N-04, M-N-05) Browser and data verification** (sections 6 and 7), evidence in `plans/evidence/N/`, owner rows added (section 8), `STATUS.md` `Ready for review`.

## 5. Scenarios checklist

Primary spec `subscriptions-and-recurring-orders`:

- [x] Recurring order created: `SubscriptionCard.test.tsx` `Recurring order created: card shows interval and next delivery date`; browser step 6.3; MCP check 7.2.
- [x] Schedule changed in place (quantity half: `not possible`, unverified, N-09 not built): `SubscriptionsTab.test.tsx` `Schedule changed in place: Change interval keeps the same card`; `route.test.ts` `setInterval rejects an unknown policy`; quantity half: `Schedule changed in place: quantity change keeps the recurring order id` (N-09) or `not possible` recorded from the spike.
- [x] Catalog price moved (behaviour itself of `Fixed` is documented, live proof is M-N-03): the buyer is told which price applies: `SubscribeBlock.test.tsx` `Catalog price moved: Subscribe block tells the price stays the same`, the I group test and `SubscriptionCard.test.tsx` `Fixed shows the price stays the same`; the behaviour itself (Fixed keeps the price) is proven by spike N-02 row and evidence `plans/evidence/N/fixed-price.md` (change a price in the seed copy of a throwaway product, read the recurring cart price before and after; if the spike cannot do this, record as M-N-03).
- [x] Paused or canceled: `SubscriptionCard.test.tsx` `Paused: card says no further orders and offers Resume`; `CancelDialog.test.tsx` `Canceled: dialog states the last order date`; `route.test.ts` `cancel sends canceled with one l`.

Extended specs:

- [x] `fulfilment-and-availability-model` / Subscriptions / Recurring order creation fails (pending detection and card tested; N-08 not built): `recurring-orders.test.ts` `order with subscribe lines and no recurring order is pending`, `Recurring order creation fails: order stays and failure is logged with the order id` (N-08, or `not needed (spike)`), `PendingSubscriptionCard.test.tsx` `Pending card links to contact`.
- [x] `design-account-area` / Subscriptions / Skip: `route.test.ts` `skip sends the counter draft`, `SubscriptionCard.test.tsx` `Skip: next date and toast`.
- [x] `design-cart-page` / Grouped by fulfilment / Mixed bag (subscription group part): `FulfilmentGroup.test.tsx` `Mixed bag shows a Subscriptions group beside Shipping` (I owns it; N adds the regression in N-06).
- [x] `design-product-detail-page` / Fulfilment choice (Subscribe card, no named scenario): H's tests `Subscribe appears only with subscribable and a recurring price` and `Machines never offer subscribe` (verified, not rewritten); N adds `Subscribe line is added with priceSelectionMode Fixed`.
- [ ] `design-home-page` / Subscribe and save strip belongs to workstream O (not N).

## 6. Browser recipe (Chrome DevTools MCP)

Base URL `http://localhost:3000`. Viewports 375x812 and 1440x900 (`resize_page`). After each step: `list_console_messages` shows no errors, `list_network_requests` shows no failed request. Evidence under `plans/evidence/N/` named `<step>-<what>-<375|1440>.png`, plus `README.md` (what each file proves). Test accounts: seeded demo customers (`maya.okonkwo@example.com` for US, a seeded Canadian customer for CA (see `SEED-PLAN.md`); password from `SEED_DEMO_PASSWORD`, never typed into evidence). Test card: the Checkout test card documented by OA-04.

1. **6.1 Subscribe on a pod (US).** `navigate_page /en-US/...` product page of a subscribable pod (find via the listing `?subscribable=true` or the home strip). `take_snapshot`: three fulfilment cards, the Subscribe card with an interval select listing only the seeded policies that have a price, the saving percentage (about 10%, from the seed prices), the lock sentence `Your price stays the same for every delivery.`. Pick `Every 2 months`, quantity 2, press `Subscribe`. Toast `Added to bag`; header count 2. Screenshot `6-1-pdp-subscribe`. Network: `POST /api/cart/lines` body has `fulfilment: "subscribe"` and `recurrencePolicyKey`; the cart read-back (section 7) shows the line with `recurrenceInfo` and `priceSelectionMode` `Fixed`.
2. **6.2 Machine has no subscribe.** Open a machine page: no Subscribe card. Open a coffee with no grind chosen: add button reads `Select a grind`; choose grind, subscribe card appears.
3. **6.3 Bag, mixed.** Add one ship line (accessory) and one collect line (pod box, any of the six NYC stores; US market only), sign in as Maya. `/en-US/cart`: groups `Collect`, `Shipping to you`, `Subscriptions`; the subscribe line shows `Delivers every 2 months`, the first-delivery estimate, **no** Collect or Ship chips, the price-lock sentence and `Shipping is calculated for each delivery.`; removing the subscribe line removes the group. Add it again from the product page. Screenshot `6-3-cart-groups`.
4. **6.4 Guest rule.** Sign out with a subscribe line in the bag, open `/en-US/checkout`: no guest option, sentence shown, sign-in button works and returns to checkout; `fetch('/api/checkout/session', { method: 'POST' })` from the console as a guest answers `401` with code `sign_in_required` (use the route K documents). Screenshot `6-4-guest-rule`.
5. **6.5 Pay and confirm.** Signed in, pay with the test card. Confirmation page: order number, `Next delivery <date>, then every 2 months`. Screenshot `6-5-confirmation`.
6. **6.6 Account tab.** `/en-US/account/subscriptions`: one card per schedule group (two cards if two policies), thumbnails, interval, next date, price, status `Active`. Screenshot `6-6-tab-375` and `-1440`.
7. **6.7 Actions.** Skip next: toast, `Next delivery skipped` label, button disabled. Change interval: dialog, choose another policy, save, toast, card text updates in place. Pause: pill `Paused`, text, only `Resume`. Resume. Cancel: dialog text with last order sentence (or none), confirm, pill `Canceled`, `Subscribe again`. After each action `list_network_requests` shows exactly one `PUT /api/recurring-orders/<id>` with the right body and a 200.
8. **6.8 States.** Sign in as a customer with no subscriptions: empty card with `Shop coffee`. With the network blocked for `/api/recurring-orders` (use `evaluate_script` to stub `fetch` once to reject, or run with `CTP_API_URL` pointing to an unreachable host in a second dev server on port 3002): error card and `Try again`.
9. **6.9 en-CA.** `/en-CA/...` as the seeded Canadian customer: the same English strings, CAD amounts with two decimals from the CAD recurring prices, dates in the Canadian English format, `Every 2 months`. Canada is delivery only: no Collect group exists, subscribe lines ship by the standard carrier.
10. **6.10 Isolation.** In a second browser context sign in as another customer: `/account/subscriptions` shows none of the first customer's cards; `evaluate_script` `fetch('/api/recurring-orders/<first customer's id>')` returns 404 with no detail.
11. **6.11 Keyboard and focus.** Tab through the tab; open and close each dialog with the keyboard; focus returns; rings visible. `lighthouse_audit` (mobile) on the tab: accessibility at least 95; save the report path in the README.
12. **6.12 Reduced motion.** Emulate `prefers-reduced-motion: reduce` (`emulate`): dialogs and cards appear without animation, all content visible.

## 7. Self-verification with data (no asking the owner)

1. **Commercetools MCP** (OA-06) or a read-only script (`cd seed && npm run verify` style): `recurrence-policies` returns the four `mcf-every-*` keys; a subscribable pod variant has `recurrencePrices` for each policy and each market at 10% below the one-time price (`SEED-PLAN` section 9); `inventory` has an online entry for the variant.
2. After step 6.5: `recurring-orders` where `customer(id=...)` returns the expected number (one per distinct policy), `recurringOrderState` `Active`, `originOrder` equals the order, `nextOrderAt` set. Record ids only in `plans/evidence/N/readback.md`.
3. After each action in 6.7: read the recurring order again and compare `recurringOrderState`, `skipConfiguration`, `schedule`, `nextOrderAt` with what the card shows.
4. Test data: every journey order and recurring order is test data for customers `@example.com`; orders cannot be deleted; canceled recurring orders can (`DELETE` with `version`, only in a seed script, listed in the cleanup manifest). Write the ids to `plans/evidence/N/test-data.md` so Q can clean up.
5. **Seed request SR-N1** (workstream C extension, lead decides): a dev-only script option `seed:subscriptions` that creates one active recurring order per demo customer from a replicated cart, plus a temporary recurrence policy `mcf-test-daily` (Days, 1) with a recurring price on one SKU, so the account tab and a real renewal can be exercised without a checkout every time. Default: build N without it, use the checkout journey, and ask the lead (Q-N-16).

## 8. Manual testing and owner items (also in `plans/notes/todo-N.md`)

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-02 | Owner | Before N-02 and every live step | 1. Merchant Center, Settings, Developer settings, open the `storefront` API client (or create a new one). 2. Add scopes `manage_recurring_orders:<project key>` and `view_recurrence_policies:<project key>`. 3. Update `storefront/.env.local` `CTP_SCOPES` (names only). 4. Restart `npm run dev`. | `GET /api/recurrence-policies` returns 200 with four policies; no 403 in the server log | TODO |
| OA-N1 | Owner | Before the live renewal test; blocks nothing else | 1. Read https://docs.commercetools.com/api/recurring-orders-overview (section Payments). 2. Decide: (a) renewals are created without payment collection (demo only), (b) enable Checkout recurring payments (public beta) for the project, (c) leave out. 3. Write the decision in `plans/QUESTIONS.md` under Q-N-5. | Decision recorded | TODO |
| SO-N1 | Owner | Before release | Approve the wording about price lock, cancel and pause (keys `subscription.priceLock`, `subscription.dialog.*`, `subscription.account.*` in `storefront/messages/en-US.json`) and confirm whether subscription terms need to be linked from the Subscribe card (Q-N-1). | Written approval or corrections | TODO |
| SO-N2 | Owner | Before release | Subscribe card, cart group, Subscriptions tab and dialogs are new designs (design.md section 6 item 1). Compare `plans/evidence/N/6-1-pdp-subscribe-1440.png`, `6-3-cart-groups-1440.png`, `6-6-tab-1440.png` with your intent. | Approval or change list | TODO |
| M-N-01 | Owner or Claude | After SR-N1, one day later | 1. With `mcf-test-daily` active, place the subscribe order. 2. Next day open `/account/subscriptions`. 3. Read orders in the Merchant Center. | A second order exists from the recurring order; the card shows `Last order <date>` and a new next date | TODO |
| M-N-02 | Owner | After N-11 | Open the tab on a real phone (375 px wide): tap targets, dialogs, toasts. | No overlap, every action reachable with a thumb | TODO |
| M-N-03 | Owner or Claude | N-02 if the Fixed price test could not be automated | Change the price of a throwaway subscribable variant in the Merchant Center; read the recurring cart line price. | Price unchanged for `Fixed` | TODO |

## 9. Questions (also in `plans/notes/questions-N.md`)

Format `Q-N-n | question | default built | blocks? | Open`. The table in the notes file is authoritative.

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-N-1 | Fixed or Dynamic price selection, per product or project-wide, and is a link to subscription terms needed at the Subscribe card? | Fixed for every subscribe line, project-wide, stated in words; no terms link | no |
| Q-N-2 | Which recurrence policies are offered and on which products? | The four seeded policies on products with `subscribable = true` that have recurring prices (pods and coffee) | no |
| Q-N-3 | Who creates the recurring order: the platform (Order from Cart) or the app? | Platform; app code only if spike N-02 shows none were created | N-08 |
| Q-N-4 | May a guest pay for a subscription? | No, account required before payment | no |
| Q-N-5 | How are renewal orders paid (Checkout recurring payments are public beta)? | Not built; renewals are created by commercetools; documented as a known gap; OA-N1 | live renewals only |
| Q-N-6 | Skip semantics: one pending skip, or several? | One pending skip at a time; button disabled with `Next delivery skipped` | no |
| Q-N-7 | May the shopper pick any policy when changing the interval? | Any seeded policy; price unchanged (Fixed) | no |
| Q-N-8 | Quantity change of a live subscription (spec scenario, not in the account design)? | Only if the spike proves it works (N-09) | N-09 |
| Q-N-9 | Is cancel final and is there a cancellation reason question? | Final, no reason asked | no |
| Q-N-10 | Pause with a resume date (`resumesAt`) or open-ended? | Open-ended pause with Resume | no |
| Q-N-11 | Free-shipping threshold on renewals (the recurring cart is only the subscription lines) and discount codes on renewals (`recurringOrderScope` of cart discounts)? | Shipping is calculated per delivery with a visible note; discounts untouched (seed `WELCOME10` applies as configured, flagged to workstream C) | no |
| Q-N-12 | Show Subscribe when the product is `subscribable` and a recurring price exists (both), or by price only (skill)? | Both | no |
| Q-N-13 | Does the Frontend API client template already include `view_recurrence_policies`? | Add it in OA-02 | N-04 live |
| Q-N-14 | Subscription reminder e-mails? | Removed by D-032: no email provider; L has no reminder toggle | no |
| Q-N-15 | German form of address (du or Sie)? | Removed by D-030: German is dropped | no |
| Q-N-16 | Seed a demo subscription and a daily test policy (SR-N1)? | Not yet; use the checkout journey | no |

## 10. Definition of done

- N-00 to N-11 ticked (N-08 and N-09 may close as `not needed` with spike evidence); each with a passing `check` commit; `npm run build` passes.
- Every scenario in section 5 has a named passing test or recorded evidence; the "Catalog price moved" behaviour is proven or has M-N-03.
- `plans/evidence/N/` holds `paths.md`, `spike.md`, `readback.md`, `test-data.md`, screenshots of recipe steps 6.1 to 6.12 at 375 and 1440, the Lighthouse report path and a `README.md`.
- Console and network clean in every recipe step; a customer can read, change and see only their own recurring orders (6.10).
- `PROJECT-FINDINGS.md` contains the spike results; D2 and D10 of this file match what was built.
- OA, SO and M rows are in `plans/notes/todo-N.md`; questions in `plans/notes/questions-N.md`.
- No `TODO` or `FIXME` in code without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
