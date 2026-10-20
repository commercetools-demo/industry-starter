<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream K: Checkout and confirmation

Paths are relative to `storefront/` unless they start with `plans/` or `seed/`. Read `plans/JUNIOR-GUIDE.md` first. Real exports used (see `plans/workstreams/D-server-core.md`, `F-shell-and-pickers.md`, `G-browse.md`, `J-auth-and-session.md`): D `handle`, `jsonError`, `requireCustomer`, `getSession`, `createSessionToken`, `setSessionCookie`, `updateWithRetry` (`lib/ct/retry.ts`), `keyOrder`, `fetchJson`; F `todayHours` (`lib/hours.ts`), `useStorePicker`, `useCollectionStore`, `lib/ct/inventory.ts`; G `lib/ct/cart.ts` (`getCartForSession`, `createCart`, `addLine`), `CART_SHIPPING_MODE` in `lib/shop-config.ts` (default `'Single'`), `CartSummary`, `useCart`; J `domainError` (`lib/api-domain.ts`), `useAccount`, `AppCustomer`, `AppAddress`, `requireCustomerPage`. Workstream I (cart page) is planned separately: its cart view type is called `CartView` here; use I's real name. If a real export differs, use the real one and say so in your hand-off.

## 1. Header

| Field | Value |
| --- | --- |
| ID | K |
| Name | Checkout and confirmation: details, fulfilment, hosted payment, order states, confirmation |
| Depends on | I (cart, groups, discount codes), J (session, `useAccount`, auth guards) |
| Wave | 8 |
| Primary spec | `design-checkout-page` |
| Also implements | `design-order-confirmation-page`, `checkout`, `checkout-page`, `order-confirmation-page`, `fulfilment-and-availability-model` (mixed bags, order states for collection, shipping by market, tax by market) |
| Read for context | `design-cart-page`, `design-cart-drawer` (what the bag looks like when it arrives), `server-architecture-and-data-flow`, `bootstrap-and-structure`, `design-tokens-and-components` |
| Generated templates that apply | `checkout`, `checkout-page`, `order-confirmation-page`. Excluded for B2C by the templates themselves: purchase order number, cost centre, approval routing. Not applicable: `delivery-slot-booking` (D-022; the design's slot picker is conditional on `design.md` Q6, default no slots) |
| Skills | `[SKILL: commercetools-checkout]` (read `references/payment-only-mode.md` fully first), `[SKILL: commercetools-storefront]` (`core/checkout-page.md`, `b2c/checkout.md`, `core/cart.md`), `[SKILL: commercetools-commerce-patterns]` (shipping, tax, discounts) |
| Owner prerequisites (lead numbers the rows) | `OA-K-a` a commercetools Checkout **Application in Payment Only mode** and a **payment connector in test mode** (OA-04), with its key in `CTP_CHECKOUT_APP_KEY`. `OA-K-b` register the return URL (`<site>/checkout/return`, one per connector; localhost for dev and the deployed one later). `OA-K-c` the storefront API client needs scopes `manage_orders`, `manage_sessions`, `view_shipping_methods`/`manage_shipping_methods` read, `manage_customers` (already for J), and for L `manage_payments`; confirm with the lead. `SO-K-a` delivery-time and collection-time copy. Until OA-K-a/b are done the spike and the payment step are `blocked: OA-K-a`, everything else is built and tested with mocks |

## 2. Goal and scope

**Goal.** A shopper (guest or member) turns the bag into a paid order in three steps (Details, Fulfilment, Payment) with the totals always read back from the commercetools cart, pays inside the hosted commercetools Checkout widget (card data never touches the storefront, D-016), and lands on a confirmation page rendered from the stored order, showing the order's real state and, for collection, a four-step tracker.

**First, the spike (K-01).** One bag may hold collect, ship and subscribe lines (D-021). Whether the hosted payment-only Checkout can take a cart with `shippingMode: Multiple` was never verified (the `fulfilment-and-availability-model` spec says workstream J; the plan puts it here). Nothing in K is built past the contracts until K-01 writes its finding.

**In scope**
- Page `/[locale]/checkout` with the step indicator, three steps, sticky summary, promo codes.
- Cart preparation on the server: contact, shipping and billing address, fulfilment groups, shipping methods, discount codes. Every change re-reads the cart.
- Hosted payment (`paymentFlow`), payment session route, order finalisation (order state, session cleanup), return route for redirect payment methods.
- Order lookup by id, order states (`mcf-order-*`) and the tracker, the confirmation page `/[locale]/checkout/confirmation/[orderId]`.
- Field validation (shared module used by the browser and the server).
- Dev tooling to move an order through the states (seed script).
- The fallback for mixed bags chosen by the spike.

**Out of scope**
- Cart page and drawer (I). Subscriptions: creating recurring orders and managing them (N). K only leaves a hook (3.12).
- Account order history, returns, reorder (L).
- Custom payment form, saved cards management (L shows what the connector stores), express payment buttons.
- Delivery slots, gift note, invoice or PO payment, B2B quotes, approvals.
- Emails (no email infrastructure is decided, `plans/QUESTIONS.md`): no order email is sent. The confirmation copy must not claim one was.

## 3. Design

### 3.1 Files

| File | Purpose |
| --- | --- |
| `lib/checkout/validate.ts` | Pure shared validators (3.6) |
| `lib/checkout/countries.ts` | `US_STATES`, postcode patterns per country (reads `COUNTRY_CONFIG` for the list of markets) |
| `lib/checkout/fulfilment-plan.ts` | Pure: `planGroups(cart)`, `buildFulfilmentActions(cart, plan)` |
| `lib/checkout/summary.ts` | Pure: `buildSummary(cart)`, `codeSavings(cart)` |
| `lib/checkout/shipping-price.ts` | Pure: `priceFor(method, cart)` (flat rate and `freeAbove`) |
| `lib/checkout/order-number.ts` | Pure: `orderNumberForCart(cartId)` |
| `lib/checkout/strategy.ts` | `MIXED_STRATEGY: 'multiple-shipping' \| 'order-per-group' \| 'restrict'` (the spike's result) |
| `lib/checkout/finalize.ts` | Server only: `finalizeOrder({ orderId?, orderNumber? })` idempotent |
| `lib/checkout/post-order.ts` | `postOrderHooks: Array<(order: OrderView) => Promise<void>>` (N registers its hook; empty here) |
| `lib/ct/checkout.ts` | Server only: all cart preparation calls |
| `lib/ct/checkout-session.ts` | Server only: Sessions API call (the one documented non-SDK call) |
| `lib/ct/orders.ts`, `lib/mappers/order.ts` | Server only: order reads, `ensureOrderState`; `OrderView` mapper. L extends these files |
| `app/api/checkout/route.ts` | GET state |
| `app/api/checkout/details/route.ts`, `fulfilment/route.ts` | PUT |
| `app/api/checkout/discount-codes/route.ts`, `discount-codes/[code]/route.ts` | POST, DELETE |
| `app/api/checkout/session/route.ts`, `complete/route.ts` | POST |
| `app/checkout/return/route.ts` | GET, outside `[locale]`; add `checkout/return` to the exclusions of the `proxy.ts` matcher (A owns `proxy.ts`: make that one-line matcher change in K-07 and say so in the hand-off) |
| `app/api/orders/[id]/route.ts` | GET one order (L adds list) |
| `app/[locale]/checkout/page.tsx`, `app/[locale]/checkout/confirmation/[orderId]/page.tsx`, `app/[locale]/checkout/confirmation/page.tsx` | Pages (last one is the "No recent order" state) |
| `components/checkout/*` | `CheckoutPage`, `StepIndicator`, `ContactCard`, `ShippingAddressCard`, `PickupOnlyCard`, `PickupLocationCard`, `DeliveryMethodCard`, `PaymentCard`, `OrderSummary`, `PromoCodes`, `FieldError`, `CheckoutIssues` |
| `components/order/OrderStatusTrack.tsx`, `CollectionCard.tsx`, `ShippingNote.tsx`, `OrderSubscriptionCard.tsx`, `OrderItems.tsx`, `lib/checkout/guards.ts` (`checkoutBlockers(cart, session)`: empty list in K; N-06 appends its rule that a bag with a subscribe line needs a signed-in customer; K's session handler returns the first blocker as `401 sign_in_required` or `409 checkout_blocked`) | Confirmation parts (L reuses `OrderStatusTrack`) |
| `hooks/useCheckout.ts`, `hooks/useOrderStatus.ts` | SWR hooks |
| `lib/cache-keys.ts` | Append `keyCheckout(customerId: string \| null)` = `['checkout', customerId ?? 'guest']`. Order status uses D's `keyOrder(customerId ?? 'guest', orderId)` |
| `seed/src/scripts/order-ops.ts` + `package.json` script `seed:order` | Dev tool, subcommand `state` (L adds more) |
| `messages/*.json` | Namespaces `checkout`, `order` (3.10) |
| `.env.example` | Add names only: `CTP_CHECKOUT_APP_KEY`, `PUBLIC_SITE_URL` (J added it) |

### 3.2 Visual design (from `pages-checkout.jsx` `CheckoutPage`, `ConfirmationPage` and `styles.css`)

Read the JSX and CSS; tokens only, never the prototype's raw colours or fonts. Screenshots to compare: `design/export/b2b2c-retailer-design/project/screenshots/checkout-step1.png`, `checkout-step2.png`, `checkout-guest.png`, `01-checkout-promo.png`, `01-checkout-identity.png`.

**Checkout layout.** `main.wrap`, bottom padding 80px. Header row: H1 "Checkout" (Archivo 800, 30px, `-0.02em`) left, `StepIndicator` right, wraps on small screens. Body grid: columns `minmax(0,1.5fr) minmax(0,0.8fr)`, gap 48px, `align-items:start`; at 900px and below one column with the summary **after** the steps (class `cart-grid` behaviour in `styles.css`).

**`StepIndicator`** (`Steps` atom): props `{ steps: {id: 1|2|3, label: string}[]; current: 1|2|3; onGoTo(id) }`. Numbered circle 24px; active ink fill, done teal fill with check icon, later steps grey. Done steps are `button`s (go back, entries kept); later steps are not focusable (`aria-disabled`, no button). `nav aria-label` "Checkout steps", `aria-current="step"` on the active one.

**Step 1 Details.**
- Guest (or member who chose guest): `ContactCard`, a `Card` titled "Contact", helper "We'll use this for your receipt and order updates." (copy must not promise email delivery while no mail adapter is enabled: use the `mailEnabled` flag from `GET /api/checkout`, see 3.10), fields Email, First name, Last name (two-column row at 520px and up). A "Use my account" link at the right of the title only when a session exists. A "Sign in" link (to `/account/sign-in?redirect=/checkout`) when there is none.
- Member: confirmation `Card` with a 40px teal-tint circle and check icon, "Signed in as {first}", email muted and truncated, and a link-style button "Check out as guest" at the right.
- `ShippingAddressCard` when any line ships (or subscribes): truck icon in `--accent`, H3 "Shipping address", helper "{n} item(s) shipping to you. Choose a delivery speed next." Member with saved addresses: radio rows (`.store-opt` pattern: 20px radio, label as H4, a "Default" pill (10.5px uppercase, accent tint), name, line, phone) plus a last row "+ Use a new address". Selected row has accent border and inset 1px accent. Rows are `role="radio"` in a `role="radiogroup"` with roving tabindex, arrow keys move, Space/Enter select. When "new" is chosen, or for guests, the address form shows with a 10px upward fade-in (disabled under reduced motion): Street address, optional second line, City, then State (only when the country needs it: US) and ZIP/postcode in one row, Phone. Country is not editable: it is the session country (Q-K-06) and is shown as a read-only line "Shipping to {Country}".
- `PickupOnlyCard` when everything is collected: store icon, H3 "Pickup only, no address needed", text "We'll set up your pickup details next." (no email or text promise).
- Primary button "Continue to fulfilment" (`Button ink lg block`), 20px above.

**Step 2 Fulfilment.**
- `PickupLocationCard` when anything is collected: store icon, H3 "Pickup location", "{n} item(s) ready for collection." One selected row (`.store-opt sel`, not clickable): store name H4, "{address} · {distance if known}", "Open today {hours} · {phone}" (hours from F's `todayHours(store, now, timeZone)`, in the session locale), teal line with clock icon "Ready in about {n} minutes" where `n` is the channel field `collectionMinutes`, and a "Change" link-button that calls `useStorePicker().open()` (F). If the store changes, the cart lines are re-checked (3.5). Below: "Who's picking up?" two `fulfill-opt` tiles: "It's me" (user icon, "Bring a photo ID and your order number") and "Someone else" (gift icon, "Add an alternate pickup person"). Choosing "Someone else" shows the "Alternate pickup name" field (required).
- `DeliveryMethodCard` when anything ships: truck icon, H3 "Delivery method", recap "Shipping to {street}, {city} {postcode}" with pin icon, then the methods from `matching-cart` as `fulfill-opt` tiles in a row (wrap at 520px): name, price (formatted with `formatMoney`, "Free" when zero) and the days text. The Standard tile shows "code applied" in teal when a free-shipping code made it free. No methods: the card shows the empty state `checkout.fulfilment.noMethods` with a button "Change address" (back to step 1), and Continue is disabled (scenario "No delivery method for address").
- Back (ghost) and "Continue to payment" (ink, flex fill).

**Step 3 Payment.** `Card` with H3 "Payment", a shield icon line "Encrypted and secure. Card details are entered in the secure payment form and never reach Malva Coffee." (the prototype says "This is a demo, no real charge": drop it), then the hosted widget mount `<div data-ctc />` with a skeleton while it loads (min height 240px so nothing jumps), an error region, and a Back (ghost) button. The pay button is rendered by the hosted widget (Q-K-03); its label is customised to "Place order" and the amount through Checkout's texts-and-labels customisation (`OA-K-d`) and styled through `styles` from tokens (3.9). The bag is not cleared until the order exists.

**Summary card** (sticky, `top: 96px`, `Card`): H3 "{n} items" (sum of quantities); scrollable line list, `max-height: 200px`: 48x58 image (radius 8, `--canvas-2` background, image through the `thumbnail` transform of `lib/ct/image-config.ts`), name 13px weight 600, "variant · x{qty}" 11.5px `--ink-3`, fulfilment line 11px (store icon teal "Pickup" or truck "Delivery" or repeat icon "Every {interval}"), price at the right. Then `PromoCodes` between hairlines: label "Promo codes", an input (uppercase, pill 10px 12px padding) with Add button; Enter submits; error row 12px `--ct-danger` with an x icon, `role="alert"`; applied codes as stacked teal pills (mono code 12.5px weight 700, label, saving "-$6.00" teal, 24px remove button `aria-label="Remove {code}"`). A code that is attached but does not apply to the cart (state not `MatchesCart`) is an amber pill with the reason text. Totals rows 13.5px: Subtotal, Discount (teal, negative, only when above 0), Shipping ("Free" teal or amount; "Calculated at the next step" before a method exists), Tax row (3.5), Total (16px bold, hairline above). Labels are `dl` rows for screen readers. Numbers update from the last cart response only.

**Responsive.** Under 900px one column; under 520px the contact and address two-column rows collapse to one; delivery tiles stack; buttons stay 100% wide. The widget container never overflows horizontally.

**Confirmation** (from `ConfirmationPage`): `main.wrap`, `max-width: 760px`, bottom padding 80px. Header block centred: 64px teal circle with a white check (icon `aria-hidden`), H1 "Order confirmed" (Archivo 800, 32px), line "Order **{number}** · {email line}" with the number in Roboto Mono. Cards stacked 18px apart: collection card (when any collect line), shipping card (when any ship line), subscription card (when any subscribe line), items card, then buttons "View in My Account" (ink lg) and "Keep shopping" (ghost lg) centred. Guest: an extra card "Create an account with this order" with a button to `/account/register` (email pre-filled from the cookie, 3.7).

**`OrderStatusTrack`**: props `{ state: 'ordered'|'preparing'|'ready-for-collection'|'collected'|null; labels: Record<...,string> }`. `ol` of four nodes, each flex 1, column, centred, 30px ring (2px `--line-2` border) and 11.5px weight 600 label; connector bar 2px between rings (teal when the node on its right is done or active... the bar to the **left** of a node is teal when that node is done). Rules: with `i` the index of the current state (0 to 3): nodes before `i` are **done** (teal fill, white check); node `i` is **active** (accent ring with a 12px accent dot) except when `i` is 3, where all four are done; `null` renders nothing. Each node carries `aria-label="{label}: done|current|upcoming"`; the list is `aria-label` "Collection progress". This follows the spec (`ordered` active, earlier done). The prototype shows "Ordered" done and "Preparing" active the moment the order is placed; do not copy that (Q-K-12).

### 3.3 Data contracts (add to `lib/types.ts`; components import only from there)

```
type FulfilmentKind = 'collect' | 'ship' | 'subscribe'
type FulfilmentGroup = { key: string /* 'ship' or 'collect-<storeKey>' */; kind: 'collect' | 'ship'; storeKey: string | null; lineIds: string[] }
type CheckoutStep = 'details' | 'fulfilment' | 'payment'
type CheckoutIssue = { code: 'line_unavailable' | 'collect_out_of_stock' | 'price_changed' | 'currency_mismatch'; lineId: string }
type DiscountCodeView = { code: string; label: string | null; state: 'applied' | 'not_applicable' | 'pending'; reason: string | null; savingCents: number | null }
type SummaryView = { currency: string; subtotalCents: number; discountCents: number; shippingCents: number | null; shippingFree: boolean; taxCents: number | null; taxIncluded: boolean; totalCents: number; version: number }
type ShippingOption = { key: string; name: string; description: string | null; priceCents: number; free: boolean; codeApplied: boolean; selected: boolean }
type CheckoutState = {
  cartId: string; version: number; step: CheckoutStep
  mailEnabled: boolean
  lines: CheckoutLineView[]          // id, name, variantSummary, quantity, imageUrl, fulfilment, storeName, recurrenceLabel, linePriceCents
  groups: FulfilmentGroup[]
  strategy: 'multiple-shipping' | 'order-per-group' | 'restrict'
  contact: { email: string; firstName: string; lastName: string } | null
  shippingAddress: AppAddress-like | null
  member: { id: string; firstName: string; email: string; addresses: AppAddress[]; defaultShippingAddressId: string | null } | null
  pickup: { storeKey: string; storeName: string; address: string; hoursToday: string | null; phone: string | null; readyMinutes: number | null; person: 'me' | 'other'; altName: string | null } | null
  shippingOptions: ShippingOption[]   // empty when no ship group or no methods
  hasShippingOptions: boolean
  codes: DiscountCodeView[]
  summary: SummaryView
  issues: CheckoutIssue[]
}
type OrderState = 'ordered' | 'preparing' | 'ready-for-collection' | 'collected'
type OrderView = {
  id: string; orderNumber: string; createdAt: string; email: string | null; locale: string; currency: string; customerId: string | null
  state: OrderState | null; paymentState: string | null; shipmentState: string | null
  lines: OrderLineView[]             // id, name, variantSummary, quantity, imageUrl, fulfilment, storeKey, recurrenceLabel, priceCents
  collect: { storeKey: string; storeName: string; address: string; hours: string | null; phone: string | null; readyMinutes: number | null; pickupName: string | null }[]
  ship: { methodName: string; estimate: string | null; address: string; deliveries: { id: string; trackingId: string | null; trackingUrl: string | null; carrier: string | null; lineIds: string[] }[] } | null
  subscriptions: { lineId: string; interval: string }[]   // next delivery date and "setting up" states are workstream N's SubscriptionNote
  totals: { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; taxIncluded: boolean; totalCents: number }
}
```

Money is integer minor units; display only through `formatMoney(centAmount, currency, locale)`.

### 3.4 Route handler contracts

All handlers: `dynamic = 'force-dynamic'`, no caching, wrapped in D's `handle(route, fn)`, session via D (`getSession`; `requireCustomer()` where a signed-in customer is needed), errors `{ "error": { "code", "message" } }`: unexpected failures through D, domain codes (`validation_failed` with `"fields": { "<name>": "<code>" }`, `code_invalid`, `totals_changed`, ...) through J's `domainError(code, status, extra)`; commercetools bodies and stack traces never returned, correlation id logged. Every handler reads the cart **only** from `session.cartId`; nothing in a request body names a cart or a customer. A missing cart returns `404 cart_not_found`. A version conflict is retried once after a re-read with D's `updateWithRetry`; a second conflict returns `409 cart_conflict`.

| Handler | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/checkout` | none | `200 CheckoutState` (after `ensureCheckoutCart`, 3.5) | `404 cart_not_found`, `409 cart_empty` |
| `PUT /api/checkout/details` | `{ contact?: {email, firstName, lastName}; addressId?: string; address?: { firstName, lastName, streetName, additionalStreetInfo?, city, state?, postalCode, phone }; saveAddress?: boolean }` (`contact` required for guests; `addressId` or `address` required when a ship group exists) | `200 CheckoutState` with `step: 'fulfilment'` | `422 validation_failed` with `fields`, `404 address_not_found` (an `addressId` not on the session customer's address list) |
| `PUT /api/checkout/fulfilment` | `{ pickup?: { person: 'me'\|'other'; altName?: string }; shippingMethodKey?: string }` | `200 CheckoutState` (totals re-read) with `step: 'payment'` when everything needed is set | `422 validation_failed`, `409 no_shipping_method` (no method matches), `409 method_not_available`, `409 collect_out_of_stock` |
| `POST /api/checkout/discount-codes` | `{ code: string }` | `200 CheckoutState` | `400 code_malformed`, `404 code_invalid` (unknown), `409 code_already_applied`, `409 code_not_applicable` (known but not active or exhausted) |
| `DELETE /api/checkout/discount-codes/[code]` | none | `200 CheckoutState` | `404 code_invalid` |
| `POST /api/checkout/session` | `{ expectedTotalCents: number }` | `200 { sessionId, projectKey, region, orderNumber, expiresAt }` | `409 totals_changed` (cart total differs from `expectedTotalCents`; client re-reads), `409 checkout_not_ready` with `missing: ('email'\|'address'\|'shipping'\|'tax')[]`, `409 order_exists` with `orderId` (an order with this cart's number already exists), `502 upstream_unavailable` |
| `POST /api/checkout/complete` | none | `200 { orderId }` (calls `finalizeOrder` for the session cart's order number; polls up to 5 times 1 s apart) | `404 order_not_found` (client shows the retry path of 3.7), `502` |
| `GET /checkout/return?orderId=<id>` or `?orderNumber=<n>` | query set by the hosted Checkout | `303` to `/<order locale>/checkout/confirmation/<orderId>` after `finalizeOrder` | `303` to `/<default locale>/checkout/confirmation` ("No recent order") when the order is not found |
| `GET /api/orders/[id]` | none | `200 { order: OrderView }`; guest orders by id, member orders only for the owning session | `404 order_not_found` (also for another customer's order, identical body) |

Redirect target locale is `order.locale` only when it is in `COUNTRY_CONFIG`, else the default locale; never taken from the query.

### 3.5 Exact commercetools calls (server only, `lib/ct/checkout.ts`)

Load `[SKILL: commercetools-checkout]`, `[SKILL: commercetools-storefront]`, `[SKILL: commercetools-commerce-patterns]`; confirm each call with `scripts/docs-search.mjs` (or the Knowledge MCP) before coding, and record any difference in `plans/PROJECT-FINDINGS.md`.

**Cart read.** `apiRoot.carts().withId({ ID }).get({ queryArgs: { expand: ['discountCodes[*].discountCode', 'lineItems[*].supplyChannel', 'lineItems[*].recurrenceInfo.recurrencePolicy', 'shipping[*].shippingInfo.shippingMethod'] } })`. After each write the update response is the new cart; map it (no refetch). Mapping lives in `lib/mappers`; reuse I's cart mapper and extend.

**Update calls.** `apiRoot.carts().withId({ ID }).post({ body: { version, actions } })`. Docs: https://docs.commercetools.com/api/projects/carts#update-actions.

**Details step** (all in one request): `setCustomerEmail { email }`; `setShippingAddress { address }` (the main address used for taxation and to match methods; for a collect-only cart it is the store address, see below); `setBillingAddress { address }` (same as shipping for ship carts; for collect-only the contact name, email and the store's country, Q-K-07). For a member, `addressId` is resolved from the session customer's addresses on the server and copied into an `AddressDraft` (without `id`). `saveAddress` writes to the customer afterwards through the same call as workstream L (`addAddress`, then `addShippingAddressId` and `addBillingAddressId` by `addressKey`), only after the cart write succeeded.

**Fulfilment groups.** `planGroups(cart)` is pure: `ship` and `subscribe` lines form the group `ship` (subscribe lines deliver to the address); `collect` lines form one group per `supplyChannel` store, key `collect-<storeKey>` (normally one). Line fulfilment is read from the line custom field `fulfilment` (`mcf-line-fulfilment`), falling back to `supplyChannel`/`recurrenceInfo` presence.

**Multiple strategy** (`MIXED_STRATEGY === 'multiple-shipping'`; adjust to the spike result). `buildFulfilmentActions` returns, in this order, so that references are always valid:
1. for every line with `shippingDetails`: `setLineItemShippingDetails { lineItemId }` with no `shippingDetails` (clears it);
2. `removeShippingMethod { shippingKey }` for each key in `cart.shipping`;
3. `removeItemShippingAddress { addressKey }` for each key in `cart.itemShippingAddresses`;
4. `addItemShippingAddress { address }` for each group (address `key` = group key; collect group address = the store: `firstName`/`lastName` = pickup person (the contact name for "It's me", the alternate name for "Someone else"), `company` "Malva Coffee", street, city, postal code, country from the store channel `address`, `additionalAddressInfo` = "Collection at {store name}", `email` = contact email; ship group address = the customer's address with key `ship`);
5. `addShippingMethod { shippingKey: <group key>, shippingMethod: { typeId: 'shipping-method', key: 'mcf-collect' | chosenKey }, shippingAddress: <the same address, same key> }`;
6. `setLineItemShippingDetails { lineItemId, shippingDetails: { targets: [{ addressKey: <group key>, quantity: line.quantity, shippingMethodKey: <group key> }] } }` for every line.
Docs: https://docs.commercetools.com/api/shipping-delivery-overview#multiple-shipping-methods and the working example https://docs.commercetools.com/guides/multiple-shipping-addresses-methods#use-multiple-shipping-methods. Verify in the spike (K-01) that the target field is spelled `shippingMethodKey` in the installed SDK type `ItemShippingTarget`. With Multiple, `taxedPrice` is only calculated once every line quantity is allocated: `assertCheckoutReady` fails with `missing: ['tax']` otherwise.

**Single strategy** (one group, any strategy): `setShippingMethod { shippingMethod: { typeId: 'shipping-method', key } }` (`mcf-collect` for a collect-only cart, the chosen method otherwise). Cart `shippingMode` is **immutable** after creation (https://docs.commercetools.com/api/shipping-delivery-overview). So `ensureCheckoutCart(session)`: if there is more than one group and `cart.shippingMode === 'Single'`, create a replacement cart with `apiRoot.carts().post({ body })`: `currency`, `country`, `locale`, `customerId` or `anonymousId`, `customerEmail`, `shippingMode: 'Multiple'`, `itemShippingAddresses: []`, `lineItems` copied as `{ sku, quantity, supplyChannel: { typeId: 'channel', id }, custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment } }, recurrenceInfo? }` (workstream I owns the exact draft shape; reuse its `toLineItemDraft`), and `discountCodes: [code strings]` re-applied with `addDiscountCode`; write the new `cartId` into the session. The old cart stays (no deletes, JUNIOR-GUIDE rule 10). If `CART_SHIPPING_MODE` in `lib/shop-config.ts` is ever flipped to `'Multiple'` (Q-K-02) this branch is dead code and a test documents it; read the cart-page tax caveat in Q-K-02 before flipping it.

**Shipping methods.** `apiRoot.shippingMethods().matchingCart().get({ queryArgs: { cartId, expand: ['zoneRates[*].zone'] } })`. Show only keys `mcf-ship-standard`, `mcf-ship-express` in the delivery card (`mcf-collect` is applied automatically, never offered). Price per option: `priceFor(method, cart)` = the rate for the cart currency in the zone of the shipping address country; `0` when the cart's goods total (after discounts) is at or above that rate's `freeAbove`; flat rates only (tiered rate types are not seeded; an unsupported tier falls back to applying the method and reading `shippingInfo.price`). The authoritative price after selection is always the cart's `shippingInfo.price` (or `discountedPrice`). Delivery days text: `ShippingMethod.localizedDescription` in the session locale (seed must write it, Q-K-11); absent means no days text, never a constant.

**Discount codes.** Lookup: `apiRoot.discountCodes().get({ queryArgs: { where: 'code=:code', 'var.code': code, limit: 1 } })`; zero results is `code_invalid`; `isActive: false` is `code_not_applicable`. Apply: `addDiscountCode { code }`. Remove: `removeDiscountCode { discountCode: { typeId: 'discount-code', id } }` with the id from the cart's `discountCodes`. Duplicate is checked against `cart.discountCodes` before the call. Each `cart.discountCodes[]` has `state`: `MatchesCart` is shown as applied, every other state (`DoesNotMatchCart`, `NotActive`, `NotValid`, `MaxApplicationReached`, `ApplicationStoppedByPreviousDiscount`) as `not_applicable` with its own i18n reason. Saving per code: the sum of `lineItems[*].discountedPricePerQuantity[*].discountedPrice.includedDiscounts[*].discountedAmount` (times the quantity of that entry) for cart discount ids listed in the expanded `discountCode.cartDiscounts`, plus the same on `shipping[*].shippingInfo.discountedPrice.includedDiscounts` for shipping discounts. Code strings are normalised (trim, upper case, pattern `^[A-Z0-9_-]{2,32}$`) before any call. Keep `WELCOME10`, `FREESHIP`, `COFFEE15` from SEED-PLAN section 12 as your test data.

**Summary** (`buildSummary(cart)`): `subtotalCents` = sum over lines of (discounted-or-base unit price from `lineItem.price` x quantity) before cart discounts; `discountCents` = sum of cart-level line discounts (not shipping); `shippingCents` = sum over `cart.shipping[*]` (or `cart.shippingInfo`) of `discountedPrice.value` when present else `price`, or `null` when no method is set; `taxCents` = `taxedPrice.totalTax` (null without `taxedPrice`); `taxIncluded` = `cart.taxMode === 'Platform'` and the market is tax-inclusive (derive from `lineItem.priceMode`/`price.value` vs `taxedPrice` by comparing: when `taxedPrice.totalGross` equals the sum of line `totalPrice` plus shipping, prices were inclusive; or read `COUNTRY_CONFIG[country].pricesIncludeTax`, which D defines from D-017: US false, DE and GB true); `totalCents` = `taxedPrice.totalGross` when present else `totalPrice` plus shipping. Tax row: when `taxIncluded` render "Includes {tax} VAT" (i18n `checkout.summary.taxIncluded`), else "Tax {amount}"; with no `taxedPrice` yet render "Calculated at the next step". Never a constant rate (the prototype's 8.875% is a placeholder).

**Order number and session** (`lib/checkout/order-number.ts`, `lib/ct/checkout-session.ts`): `orderNumberForCart(cartId)` = `'MC-'` + first 10 characters of the base32 (Crockford) of SHA-256(cartId), upper case. Deterministic, so a retry for the same cart can never create a second order (a duplicate `orderNumber` is rejected by commercetools: https://docs.commercetools.com/checkout/installing-checkout#set-a-custom-order-number) and the placement-unknown case can look the order up. Sessions API (not in the SDK, the one allowed raw call; add the lint exception with a comment naming this task): get a client-credentials token from `CTP_AUTH_URL` with scope `manage_sessions:{projectKey}`, then `POST https://session.{region}.commercetools.com/{projectKey}/sessions` with body `{ cart: { cartRef: { id: cartId } }, metadata: { applicationKey: CTP_CHECKOUT_APP_KEY, futureOrderNumber } }`; region derived from `CTP_API_URL` as the skill shows. Return `{ id, expiryAt }`. Session expiry: create it late (step 3 only).

**Order reads** (`lib/ct/orders.ts`): `apiRoot.orders().withId({ ID }).get({ queryArgs: { expand: ['state', 'lineItems[*].supplyChannel', 'lineItems[*].recurrenceInfo.recurrencePolicy', 'shipping[*].shippingInfo.shippingMethod'] } })` and `apiRoot.orders().withOrderNumber({ orderNumber }).get(...)`. Docs: https://docs.commercetools.com/api/projects/orders. `subscriptions` carries only the interval from the expanded policy; N plugs its `SubscriptionNote` (next date, "setting up your subscription") into `OrderSubscriptionCard` (N's file `components/checkout/SubscriptionNote.tsx`). Mapper reads deliveries from `order.shipping[*].shippingInfo.deliveries` and from `order.shippingInfo.deliveries` (Single mode). `state` maps from `order.state.obj.key`: `mcf-order-ordered` to `ordered` etc.; anything else is `null`.

**Order state.** The hosted Checkout creates the order without any `state`. `ensureOrderState(order)`: if `order.state` is absent, `apiRoot.orders().withId({ ID }).post({ body: { version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: 'mcf-order-ordered' } }] } })`. Called from `finalizeOrder` and, as a safety net, from `GET /api/orders/[id]`; idempotent (a conflict re-reads and re-checks). Docs: https://docs.commercetools.com/api/projects/orders#transition-state. State changes after that are made by the store (Merchant Center) or by the dev script (K-08). Order `state` tracks **collection** progress; shipped progress is `shipmentState` and `deliveries`. A ship-only order stays at `ordered` and the confirmation shows no tracker (Q-K-12).

### 3.6 Validation (`lib/checkout/validate.ts`, pure, used by the forms and by every handler)

Each validator returns `null` or an error code; each code has an i18n message `checkout.errors.<code>`.

| Field | Rule | Codes |
| --- | --- | --- |
| email | trimmed, 3 to 254 chars, `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` | `email_required`, `email_invalid` |
| firstName, lastName | trimmed, 1 to 60 chars, Unicode letters, spaces, `'`, `-`, `.` only | `name_required`, `name_invalid`, `name_too_long` |
| streetName | trimmed, 3 to 100 | `street_required`, `street_too_short`, `street_too_long` |
| additionalStreetInfo | optional, up to 100 | `line2_too_long` |
| city | trimmed, 2 to 60, letters, spaces, `'`, `-`, `.` | `city_required`, `city_invalid` |
| state | required when the country is `US` and one of `US_STATES` (50 plus DC); not collected for DE and GB | `state_required`, `state_invalid` |
| postalCode | US `^\d{5}(-\d{4})?$`; DE `^\d{5}$`; GB `^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$` case-insensitive; normalise (trim, collapse spaces, upper case GB) | `postal_required`, `postal_invalid` |
| phone | required for a shipping address, optional otherwise; strip spaces, `()`, `-`, `.`; optional leading `+`; 7 to 15 digits | `phone_required`, `phone_invalid` |
| altName | required when pickup person is `other`; trimmed, 2 to 80, same character set as names | `altname_required`, `altname_invalid` |
| country | must equal the session country | `country_mismatch` |
| code (promo) | after normalisation `^[A-Z0-9_-]{2,32}$` | `code_malformed` |

Client behaviour: validate on blur and on Continue; on Continue with errors, block, show the message beside each field (`FieldError`: 12.5px `--ct-danger`, x icon, `id` referenced by `aria-describedby`, `aria-invalid="true"`), and move focus to the first invalid field. The server runs the same functions and returns `422 validation_failed` with `fields`, which the form maps to the same messages (so a bypassed client check never reaches commercetools). Names, addresses and phone numbers are personal data: never logged, never in URLs.

### 3.7 Behaviour rules

- **Totals are a projection.** `OrderSummary` renders `CheckoutState.summary` only. After every successful step or code change the hook replaces its data with the response.
- **Step guard.** The current step is client state (`useCheckout` plus `useState`) and the server only validates prerequisites: step 2 requires contact (guests) and address (when shipping); step 3 requires a pickup person choice (when collecting) and a shipping method (when shipping), and `assertCheckoutReady`. Going back keeps entries (state is kept in the hook; the server also stores them on the cart).
- **Guest switch.** "Check out as guest" clears the contact and address fields and switches the cards to the guest forms (spec scenario). The order stays attached to the signed-in customer's cart (Q-K-08). "Use my account" restores the member's data.
- **Totals moved.** Step 3 creates the Checkout session with `expectedTotalCents = summary.totalCents`. If anything changes the cart while on step 3 (a promo code), the `PaymentCard` is re-keyed by `cart.version`, which unmounts the widget and creates a new session. The server refuses a session when the cart total differs from `expectedTotalCents` (`409 totals_changed`). Payment is created by the hosted Checkout at pay time for the cart's current total, so a stale authorisation cannot be placed (confirm in spike probe S11).
- **Placement.** `onInfo` with `code === 'checkout_completed'` calls `POST /api/checkout/complete`, then `router.replace` to the confirmation. For redirect payment methods the browser lands on `/checkout/return`, which does the same on the server. The bag clears when `finalizeOrder` removes `cartId` from the session; the cart in commercetools is already `Ordered`.
- **Payment failure.** `onError` shows an error region (`role="alert"`) with a mapped message (`checkout.payment.declined` for payment errors, `checkout.payment.generic` otherwise; never the raw SDK payload) and keeps the user on step 3 with the widget usable for a retry. The bag is untouched.
- **Placement outcome unknown** (error after submit, network loss, `complete` returns `order_not_found`): before showing any retry, `POST /api/checkout/session` first looks the order up by `orderNumberForCart(cartId)` and answers `409 order_exists`; the client then goes to the confirmation. If no order exists, the page shows `checkout.placement.retry` ("We could not confirm your order. Check your bag and try again.") with one button that re-reads the state and re-creates the session (same order number, so no second order).
- **Last-moment failure** (tax or discount changed, code no longer valid): the widget reports an error; the page calls `GET /api/checkout`, shows what changed from `issues` and `codes` states, and offers the same retry.
- **Cart issues.** `GET /api/checkout` raises `issues` from I's line warnings (unavailable item, collect out of stock at the store, price changed). `line_unavailable` and `collect_out_of_stock` block Continue with a banner linking to `/cart`; `price_changed` shows a notice and continues.
- **Store change in step 2.** F's picker updates the session store; K then calls `PUT /api/checkout/fulfilment` again; collect lines not available at the new store return `409 collect_out_of_stock` and the issue banner appears.
- **Confirmation access.** Server-rendered, `dynamic = 'force-dynamic'`, `Cache-Control: no-store`. Order with `customerId`: only when `session.customerId` matches, else redirect to `/account/sign-in?redirect=<this path>`. Guest order (no `customerId`): shown for anyone holding the id (a UUID) and hides phone numbers and the full billing address. The page never reads the cart. `/checkout/confirmation` without an id and an unknown id both render "No recent order" with a Shop button (HTTP 200).
- **Guest account offer.** After a guest order `finalizeOrder` sets the HTTP-only cookie `mcf_guest_email` (value the order email, `Max-Age` 3600, `SameSite=Lax`); `/account/register` reads and deletes it (J-11). Registration passes the session `anonymousId`, so the guest order attaches to the new account.
- **Order email claim.** Header line: when `mailEnabled` (J), "Order {number} · confirmation sent to {email}"; otherwise "Order {number} · {email}" with the note `order.noEmailNote` ("Keep this number; you will need it to collect your order."). The same applies to the Pickup text "We'll text you when it's ready": there is no SMS, so the text is `order.collect.checkLater` ("Check this page or your account for status.") (Q-K-13).
- **Blockers.** `GET /api/checkout` and `POST /api/checkout/session` call `checkoutBlockers`; N adds its guest rule there without touching K's flow.
- **Hook for subscriptions.** The hosted Checkout creates the recurring orders itself from recurring lines (N's finding); `finalizeOrder` runs `postOrderHooks` after `ensureOrderState`, each in its own `try/catch`; a failing hook is logged with the order id and never fails the order (`fulfilment-and-availability-model`, Subscriptions).
- **Mixed-bag strategy.** `MIXED_STRATEGY` decides: `multiple-shipping` (3.5), `order-per-group` (K-14a) or `restrict` (K-14b). `GET /api/checkout` returns it so the UI can adapt.

### 3.8 Session fields

K adds none to the signed JWT. It reads `cartId`, `customerId`, `country`, `currency`, `locale`, `collectionStoreKey`, `anonymousId`, and clears `cartId` in `finalizeOrder`. The only new storage is the short cookie `mcf_guest_email` (3.7).

### 3.9 Widget theming

`lib/checkout/theme.ts` (client) reads the computed values of `--font-body`, `--ink`, `--accent`, `--accent-press`, `--line-2`, `--surface` and the pill and field radii via `getComputedStyle(document.documentElement)` and passes them in the SDK `styles` option under the variable names Checkout documents (https://docs.commercetools.com/checkout/customizing-checkout, https://docs.commercetools.com/checkout/custom-style); no hex literal appears in code. Locale mapping to the SDK: `en-US` to `en-US`, `de-DE` to `de`, `en-GB` to `en` (the SDK supports `en`, `en-US`, `de`, and falls back to `en`).

### 3.10 i18n keys (namespaces `checkout` and `order`; en-GB equals en-US unless noted)

| Key | en-US | de-DE |
| --- | --- | --- |
| `checkout.title` | Checkout | Kasse |
| `checkout.steps.details` / `.fulfilment` / `.payment` | Details / Fulfilment / Payment | Angaben / Lieferung & Abholung / Zahlung |
| `checkout.stepsLabel` | Checkout steps | Kassenschritte |
| `checkout.contact.title` / `.help` | Contact / We'll use this for your receipt and order updates. | Kontakt / Wir nutzen dies für Ihren Beleg und Bestellupdates. |
| `checkout.contact.email` / `.firstName` / `.lastName` | Email / First name / Last name | E-Mail-Adresse / Vorname / Nachname |
| `checkout.contact.useAccount` / `.signIn` | Use my account / Sign in | Mein Konto verwenden / Anmelden |
| `checkout.member.signedInAs` / `.asGuest` | Signed in as {first} / Check out as guest | Angemeldet als {first} / Als Gast bestellen |
| `checkout.address.title` / `.help` | Shipping address / {count} item(s) shipping to you. Choose a delivery speed next. | Lieferadresse / {count} Artikel werden geliefert. Wählen Sie danach die Lieferart. |
| `checkout.address.street` / `.line2` / `.city` / `.state` / `.postal.us` / `.postal.de` / `.postal.gb` / `.phone` | Street address / Apartment, suite (optional) / City / State / ZIP code / Postal code / Postcode / Phone | Straße und Hausnummer / Adresszusatz (optional) / Stadt / Bundesstaat / ZIP-Code / Postleitzahl / Postleitzahl / Telefon |
| `checkout.address.default` / `.useNew` / `.useNewHelp` / `.shippingTo` / `.save` | Default / Use a new address / Ship to a different location / Shipping to {country} / Save this address to my account | Standard / Neue Adresse verwenden / An einen anderen Ort liefern / Lieferung nach {country} / Adresse in meinem Konto speichern |
| `checkout.pickupOnly.title` / `.text` | Pickup only, no address needed / We'll set up your pickup details next. | Nur Abholung, keine Adresse nötig / Als Nächstes legen wir die Abholung fest. |
| `checkout.continueFulfilment` / `.continuePayment` / `.back` | Continue to fulfilment / Continue to payment / Back | Weiter zu Lieferung & Abholung / Weiter zur Zahlung / Zurück |
| `checkout.pickup.title` / `.count` / `.change` / `.ready` / `.open` | Pickup location / {count} item(s) ready for collection. / Change / Ready in about {minutes} minutes / Open today {hours} | Abholort / {count} Artikel zur Abholung. / Ändern / In etwa {minutes} Minuten bereit / Heute geöffnet {hours} |
| `checkout.pickup.who` / `.me` / `.meHelp` / `.other` / `.otherHelp` / `.altName` | Who's picking up? / It's me / Bring a photo ID and your order number / Someone else / Add an alternate pickup person / Alternate pickup name | Wer holt ab? / Ich selbst / Bitte Ausweis und Bestellnummer mitbringen / Jemand anderes / Abholperson angeben / Name der Abholperson |
| `checkout.delivery.title` / `.recap` / `.codeApplied` / `.free` | Delivery method / Shipping to {address} / code applied / Free | Liefermethode / Lieferung an {address} / Code angewendet / Kostenlos |
| `checkout.fulfilment.noMethods` / `.changeAddress` | We can't deliver to this address yet. Change the address or choose collection in a store. / Change address | Wir können diese Adresse derzeit nicht beliefern. Ändern Sie die Adresse oder wählen Sie Abholung im Geschäft. / Adresse ändern |
| `checkout.payment.title` / `.secure` / `.loading` | Payment / Encrypted and secure. Card details are entered in the secure payment form and never reach Malva Coffee. / Loading secure payment form… | Zahlung / Verschlüsselt und sicher. Kartendaten werden im geschützten Zahlungsformular eingegeben und erreichen Malva Coffee nie. / Sicheres Zahlungsformular wird geladen… |
| `checkout.payment.declined` / `.generic` | Your payment was not accepted. Check your details or try another card. / Something went wrong with the payment. Your bag is unchanged, please try again. | Ihre Zahlung wurde nicht akzeptiert. Prüfen Sie Ihre Angaben oder nutzen Sie eine andere Karte. / Bei der Zahlung ist etwas schiefgelaufen. Ihr Warenkorb ist unverändert, bitte versuchen Sie es erneut. |
| `checkout.placement.retry` / `.retryButton` | We could not confirm your order. Check your bag and try again. / Review and try again | Wir konnten Ihre Bestellung nicht bestätigen. Prüfen Sie Ihren Warenkorb und versuchen Sie es erneut. / Prüfen und erneut versuchen |
| `checkout.summary.items` / `.subtotal` / `.discount` / `.shipping` / `.tax` / `.total` | {count} items / Subtotal / Discount / Shipping / Tax / Total | {count} Artikel / Zwischensumme / Rabatt / Versand / Steuer / Gesamt |
| `checkout.summary.free` / `.nextStep` / `.taxIncluded` | Free / Calculated at the next step / Includes {tax} VAT | Kostenlos / Wird im nächsten Schritt berechnet / Inkl. {tax} MwSt. |
| `checkout.promo.label` / `.placeholder` / `.add` / `.remove` | Promo codes / Add a code / Add / Remove {code} | Aktionscodes / Code hinzufügen / Hinzufügen / {code} entfernen |
| `checkout.promo.errors.code_malformed` / `.code_invalid` / `.code_already_applied` / `.code_not_applicable` | That is not a valid code. / "{code}" isn't a valid code. / That code is already applied. / This code can't be used right now. | Das ist kein gültiger Code. / „{code}“ ist kein gültiger Code. / Dieser Code ist bereits angewendet. / Dieser Code kann derzeit nicht verwendet werden. |
| `checkout.promo.reasons.DoesNotMatchCart` / `.NotActive` / `.NotValid` / `.MaxApplicationReached` / `.ApplicationStoppedByPreviousDiscount` | Your bag doesn't meet this offer yet. / This offer isn't active. / This offer isn't valid. / This offer has been used up. / A better offer already applies. | Ihr Warenkorb erfüllt dieses Angebot noch nicht. / Dieses Angebot ist nicht aktiv. / Dieses Angebot ist nicht gültig. / Dieses Angebot ist aufgebraucht. / Es gilt bereits ein besseres Angebot. |
| `checkout.issues.review` / `.unavailable` / `.collectOut` / `.priceChanged` | Review your bag / {name} is no longer available. / {name} is not in stock at {store}. / The price of {name} changed. | Warenkorb prüfen / {name} ist nicht mehr verfügbar. / {name} ist bei {store} nicht vorrätig. / Der Preis von {name} hat sich geändert. |
| `checkout.empty.title` / `.cta` | Nothing to check out / Shop coffee | Nichts zur Kasse / Kaffee entdecken |
| `checkout.errors.<code>` | one message per code of 3.6, for example `email_required`: Enter your email address. | e.g. Geben Sie Ihre E-Mail-Adresse ein. |
| `order.confirmed` / `.numberLine` / `.sentTo` / `.noEmailNote` | Order confirmed / Order {number} · {email} / Order {number} · confirmation sent to {email} / Keep this number; you will need it to collect your order. | Bestellung bestätigt / Bestellung {number} · {email} / Bestellung {number} · Bestätigung gesendet an {email} / Bewahren Sie diese Nummer auf; Sie benötigen sie zur Abholung. |
| `order.track.label` / `.ordered` / `.preparing` / `.ready` / `.collected` | Collection progress / Ordered / Preparing / Ready / Collected | Abholstatus / Bestellt / In Vorbereitung / Abholbereit / Abgeholt |
| `order.track.done` / `.current` / `.upcoming` | done / current / upcoming | erledigt / aktuell / folgt |
| `order.collect.title` / `.bring` / `.checkLater` | Collect at {store} / Bring a photo ID and your order number. / Check this page or your account for status. | Abholung bei {store} / Bitte Ausweis und Bestellnummer mitbringen. / Den Status finden Sie auf dieser Seite oder in Ihrem Konto. |
| `order.ship.title` / `.estimate` / `.noTracking` / `.track` | Delivery / Estimated {window} / Tracking will appear here / Track parcel | Lieferung / Voraussichtlich {window} / Die Sendungsverfolgung erscheint hier / Sendung verfolgen |
| `order.subscription.title` / `.every` / `.manage` | Subscription / Delivers every {interval} / Manage | Abonnement / Lieferung alle {interval} / Verwalten |
| `order.items` / `.total` / `.viewAccount` / `.keepShopping` | Your items / Total / View in My Account / Keep shopping | Ihre Artikel / Gesamt / In Mein Konto ansehen / Weiter einkaufen |
| `order.guest.title` / `.cta` | Create an account with this order / Create account | Konto mit dieser Bestellung erstellen / Konto erstellen |
| `order.none.title` / `.cta` | No recent order / Shop coffee | Keine aktuelle Bestellung / Kaffee entdecken |

### 3.11 Accessibility

One H1 per page; steps in an `nav` with `aria-current="step"`; radio groups with roving tabindex; every error tied to its field and announced (`role="alert"`); focus moves to the first invalid field and, on step change, to the new step's heading (`tabIndex={-1}`); the summary totals are a `dl`; the hosted widget sits in a region with `aria-label` "Secure payment"; the tracker is an `ol` with state text, not colour only; the confirmation header icon is `aria-hidden` and the H1 is focused on load. Reduced motion disables the fade-in.

### 3.12 Caching

Nothing here is cached on the server (`dynamic = 'force-dynamic'`; no `unstable_cache` for cart, order or checkout). SWR keys: `keyCheckout(customerId)` (revalidate only by mutation, never on focus), `keyOrder(customerId ?? 'guest', orderId)` (refresh every 30 s while the state is not `collected`, stop on `collected`; the interval must be cleared on unmount). The shipping-method list may reuse the public cached list from D if present; the matching call is per cart and uncached. After `finalizeOrder` the client evicts the cart keys (G's `KEY_CART` and `keyCart(customerId)`) and `keyCheckout`.

## 4. Tasks

Branch `ws/k-checkout-and-confirmation`. Commit `ws-k: K-nn summary`. Each task is under half a day except the spike, which is time-boxed (4 hours). Run `npm run check` before ticking; `npm run build` before the last task.

- [ ] **K-01 SPIKE: can the hosted Checkout (payment-only) take `shippingMode: Multiple`?** `[SKILL: commercetools-checkout]` `[SKILL: commercetools-storefront]` `[SKILL: commercetools-commerce-patterns]`. **Time-box: 4 hours.** Stop at the box, write what you have, mark the rest UNKNOWN.
  - Context already established by the documentation (re-verify, do not trust): the Checkout installation page states that Payment Only mode supports multiple Shipping Methods and tells you to create the cart with `shippingMode: Multiple` (https://docs.commercetools.com/checkout/installing-checkout#multiple-shipping-methods). It also says `shippingMode` cannot be changed after creation, that Checkout only initialises for carts created with the Carts API, and that a custom order number goes in `metadata.futureOrderNumber`. What no page says: how the hosted widget prices, taxes and splits per group, what the created Payment and Order look like, and how discount codes, free-shipping thresholds and cart merge behave with `Multiple`.
  - Method: a script `storefront/scripts/spike-k.mts` run as `node --env-file=.env.local --experimental-strip-types scripts/spike-k.mts` (no new packages; it uses `lib/ct/client` through a relative import). The script and the cart and order ids it prints (ids only) are saved under `plans/evidence/K/spike/`. Test data: one US and one DE address (synthetic, `@example.com`), a collect line at `mcf-store-nyc-soho` or `mcf-store-berlin-mitte`, a ship line, and a subscribe line if the seed has one. Carts and orders cannot be deleted; they stay (D-019), tell the lead the ids.
  - Probes (record PASS, FAIL or UNKNOWN and the facts for each; a probe needing the Checkout Application is `blocked: OA-K-a` and is run as soon as it exists):

| # | Probe | PASS means | Record |
| --- | --- | --- | --- |
| S1 | Create a cart with `shippingMode: 'Multiple'`, add the two lines, `addItemShippingAddress` x2 (keys `ship`, `collect-<store>`), `addShippingMethod` with `mcf-ship-standard` and `mcf-collect`, `setLineItemShippingDetails` per line (check the field `shippingMethodKey` exists on the target type) | No error; `cart.shipping` has two entries with prices | cart id, spelled field names |
| S2 | Tax: US address (tax-exclusive prices) and DE address (inclusive); read `taxedPrice`, `taxedShippingPrice`, `lineItems[*].perMethodTaxRate`, `taxedPricePortions` | `taxedPrice.totalGross` equals the sum of line gross plus both shipping prices; collect shipping is 0 | numbers per market; what happens with a US address with no state rate (D-018) |
| S3 | `shippingMethods().matchingCart()` and `matchingCartAndCountry` on the Multiple cart | Returns `mcf-ship-*` for the ship address; record whether `mcf-collect` is returned for a store address | the keys returned |
| S4 | Free-shipping threshold (`freeAbove`) on a Multiple cart | Record whether the threshold is compared to the whole cart or to the group's lines | which |
| S5 | Discount codes `WELCOME10`, `FREESHIP`, `COFFEE15` on the Multiple cart | Record how `FREESHIP` applies to the two shipping entries and where `includedDiscounts` appear | per-entry result |
| S6 | `POST` Sessions API for the Multiple cart (`futureOrderNumber` set) | 201 with an id | status, error body if not |
| S7 | Browser: `paymentFlow` with that session; pay with the PSP test card (K-16 explains how) | Widget shows methods and the amount equal to `taxedPrice.totalGross`; payment succeeds; exactly one `Payment` with `amountPlanned` equal to the total | payment id, amount |
| S8 | The created Order | `shippingMode` Multiple, `shipping[]` kept with its keys and prices, `lineItems[*].shippingDetails` kept, `taxedPrice` equal to the cart's, `orderNumber` equals `futureOrderNumber`, `paymentState` | which fields are lost or changed |
| S9 | `transitionState` on that order from "no state" to `mcf-order-ordered`, then `preparing`, `ready-for-collection`, `collected` | All accepted in order; the first one works from no state | errors |
| S10 | Clone path: `shippingMode` of an existing Single cart cannot be changed; create a replacement `Multiple` cart from its lines (`sku`, `quantity`, `supplyChannel`, custom `fulfilment`) and re-apply codes. Also: sign-in merge of a Multiple anonymous cart into a Single customer cart (coordinate with J-14e) | Replacement cart equals the original in totals; merge keeps all lines | what the merge does to `shippingMode` |
| S11 | Remount: add a promo code while the widget is mounted, re-create the session, remount | The new session pays the new total (no stale amount) | amount paid |
| S12 | Widget controls: where is the pay button, can the host page hide, trigger or label it, what does `onInfo` and `onError` emit (log the `code` values only, never payloads with card or personal data) | List of event codes; label customisation route | codes |

  - **Written finding:** add to `plans/PROJECT-FINDINGS.md` a section `F-K-01 Mixed bags and the hosted Checkout (<date>)` with the table above filled in, the exact request and response shapes you used (no secrets, ids only), the SDK type names and the Checkout documentation URLs checked, and the **decision** by this rule:

| Outcome | Decision (`MIXED_STRATEGY`) |
| --- | --- |
| S1, S2, S6, S7, S8 all PASS (S4 and S5 may differ from expectation, record them) | `multiple-shipping`: one order, one payment, as D-021 targets |
| S1 to S3 PASS but S6, S7 or S8 FAIL (Checkout cannot take or keep the Multiple cart), and the fallback below is estimated at one day or less | `order-per-group`: split the bag into one cart per fulfilment group, pay in sequence (section 4.1) |
| Anything else, or the box ran out before S6 to S8 | `restrict`: a mixed bag cannot be checked out in one go; the bag shows "Check out collection items first" (section 4.1). This is the cheapest and always works |
| S2 FAIL for tax only (taxed price missing or wrong) with S6 to S8 PASS | Still `multiple-shipping` if the cause is a data gap you can fix in the seed (tell the lead, write Q-K-02b); otherwise `order-per-group` |

  Do not edit `DECISIONS.md`. Set `lib/checkout/strategy.ts` to the result, write `Q-K-02` with the evidence, tell the lead in your hand-off, and continue with the chosen strategy. If OA-K-a is not done, finish S1 to S5, S9, S10 and mark S6 to S8, S11, S12 `blocked: OA-K-a`; set the strategy to `multiple-shipping` provisionally and keep K-14 open.
  - Tests: none (research). Evidence: `plans/evidence/K/spike/README.md` stating what each file proves.
- [ ] **K-02 Types, validators, countries.** Files: `lib/types.ts` additions (3.3), `lib/checkout/validate.ts`, `lib/checkout/countries.ts`, tests. Tests: `Missing email shows the email error`, `Invalid email is refused`, `US needs a state, DE and GB do not`, `Postal code is checked per country`, `GB postcode is normalised`, `Phone is required for shipping and optional for pickup`, `Someone else needs an alternate name`, `Names accept accents and apostrophes`, `Names reject markup`, `Country must match the market`, `Promo code is normalised and checked`.
- [ ] **K-03 Fulfilment plan and cart actions (pure).** `[SKILL: commercetools-storefront]` `[SKILL: commercetools-commerce-patterns]`. Files: `lib/checkout/fulfilment-plan.ts`, `lib/checkout/strategy.ts`, tests with cart fixtures. Tests: `Mixed bag makes a ship group and a collect group`, `Subscribe lines join the ship group`, `Lines from two stores make two collect groups`, `Multiple actions run in a safe order`, `Every line quantity is allocated to a target`, `Collect group address is the store with the pickup person name`, `Single group uses setShippingMethod`, `Collect only uses mcf-collect`, `Existing shipping entries are removed before new ones are added`.
- [ ] **K-04 Checkout cart module.** `[SKILL: commercetools-storefront]` `[SKILL: commercetools-checkout]`. Files: `lib/ct/checkout.ts`, `lib/mappers/checkout.ts`, `lib/checkout/summary.ts`, `lib/checkout/shipping-price.ts`, tests with a mocked `apiRoot`. Implements 3.5 (cart read, details, fulfilment, `ensureCheckoutCart`, matching methods, `assertCheckoutReady`). Tests: `Address change moves tax` (summary uses the new `taxedPrice`), `Shipping options come from matching-cart only`, `Free above threshold gives price zero per market`, `Threshold per market` (US, DE, GB fixtures), `US address without state rate has a tax portion`, `Tax included market shows included tax`, `Summary never uses a constant tax rate`, `ensureCheckoutCart clones a Single cart into a Multiple cart when there are two groups`, `Version conflict is retried once`, `assertCheckoutReady names what is missing`.
- [ ] **K-05 Discount codes.** `[SKILL: commercetools-commerce-patterns]`. Files: `lib/ct/checkout.ts` (add), `lib/checkout/summary.ts` (`codeSavings`), tests. Tests: `Invalid code`, `Duplicate code`, `Remove a code`, `Free shipping code` (FREESHIP makes Standard free and flags `codeApplied`), `Code attached but not applicable is shown with its reason`, `Per code saving is summed from included discounts`, `Codes stack`.
- [ ] **K-06 Checkout handlers.** `[SKILL: commercetools-storefront]`. Files: `app/api/checkout/route.ts`, `details`, `fulfilment`, `discount-codes`, `discount-codes/[code]`, tests calling `GET`/`PUT`/`POST`/`DELETE` with `new Request`. Tests: `Member with saved addresses` (state lists them, default id set), `Address id of another customer is refused`, `Collect only needs no address`, `Validation failures return field codes`, `Cart id in the body is ignored`, `Handlers return no commercetools body on 5xx`, `Unauthenticated guest can check out`, `Two shoppers get only their own cart`, `No delivery method for address` (409 and empty options).
- [ ] **K-07 Order number, session, complete, return, finalise.** `[SKILL: commercetools-checkout]`. Files: `lib/checkout/order-number.ts`, `lib/ct/checkout-session.ts`, `lib/checkout/finalize.ts`, `lib/checkout/post-order.ts`, `app/api/checkout/session/route.ts`, `complete/route.ts`, `app/checkout/return/route.ts`, `proxy.ts` matcher, `.env.example`, tests (mock `fetch` for the Sessions API only). Tests: `Order number is deterministic per cart`, `Session is refused when the total moved` (409 `totals_changed`), `Session is refused when nothing is set` (`checkout_not_ready`), `Existing order is reported instead of a second session` (`order_exists`), `Placement outcome unknown looks the order up by number`, `Finalize is idempotent`, `Finalize clears the cart id and sets the order state`, `Failing post-order hook does not fail the order`, `Return route redirects to the order locale`, `Return route ignores a locale in the query`, `Return route with unknown order lands on No recent order`, `Guest email cookie is HttpOnly and short`. Mark live behaviour `blocked: OA-K-a`.
- [ ] **K-08 Orders module and dev state tool.** `[SKILL: commercetools-storefront]`. Files: `lib/ct/orders.ts`, `lib/mappers/order.ts`, `app/api/orders/[id]/route.ts`, `seed/src/scripts/order-ops.ts` and its `package.json` script, tests. The seed script: `npm run seed:order -- state --order-number MC-... --to preparing|ready-for-collection|collected --dry-run`, refuses a project key other than `EXPECTED_PROJECT_KEY`, only transitions along the seeded state chain, prints the new state. Tests: `Ready` (mapper turns `mcf-order-ready-for-collection` into `ready-for-collection`), `Unknown state key maps to null`, `Mixed order has collect and ship parts`, `Shipped line with no tracking has an estimate and no parcel`, `Subscription line shows the interval`, `Revisited later` (mapper works from the order alone), `Order of another customer returns 404 identical to unknown`, `ensureOrderState sets ordered once`, seed script `order-ops refuses a foreign project key`, `order-ops refuses skipping a state`.
- [ ] **K-09 Checkout hook, summary and promo UI.** Files: `hooks/useCheckout.ts`, `lib/cache-keys.ts` (append `keyCheckout`), `components/checkout/OrderSummary.tsx`, `PromoCodes.tsx`, `FieldError.tsx`, tests. Tests: `Summary is a projection of the last response`, `Enter adds a code`, `Invalid code shows an inline message and changes nothing`, `Duplicate code message`, `Applied code can be removed and totals recompute`, `Free shipping shows Free`, `Tax included shows the included line`, `Summary line list scrolls at 200px` (class check), `Remove button has an accessible name`.
- [ ] **K-10 Step 1 UI.** Files: `components/checkout/StepIndicator.tsx`, `ContactCard.tsx`, `ShippingAddressCard.tsx`, `PickupOnlyCard.tsx`, `CheckoutPage.tsx` (shell and step 1), `app/[locale]/checkout/page.tsx`, messages. Tests: `Going back` (completed step is a button, entries retained), `Later steps are not clickable`, `Member with saved addresses` (default preselected, form hidden), `Guest switch` (fields clear), `Collect only` (no address card), `Missing email focuses the email field`, `State field only for US`, `Empty bag shows Nothing to check out`.
- [ ] **K-11 Step 2 UI.** Files: `PickupLocationCard.tsx`, `DeliveryMethodCard.tsx`, `CheckoutIssues.tsx`, tests. Tests: `Someone else collects` (alt name required), `Free shipping code` (Standard shows code applied), `No delivery method for address` (message, Continue disabled), `Change store re-checks collect lines`, `Ready minutes come from the store data`, `Collect out of stock blocks Continue`.
- [ ] **K-12 Step 3 UI.** `[SKILL: commercetools-checkout]`. Files: `PaymentCard.tsx`, `lib/checkout/theme.ts`, `package.json` (add `@commercetools/checkout-browser-sdk`, listed in the checkout skill), tests with the SDK mocked. Tests: `Payment failure` (error region, stays on step 3, bag untouched), `Placement` (completed event calls complete and routes to the confirmation), `Totals moved after authorization` (promo change re-keys the widget and requests a new session), `Placement outcome unknown shows one retry path`, `Place order is the only commit action` (no quote button, no second submit), `Widget mount point exists`, `Locale is mapped for the SDK`, `Theme reads tokens, no hex in code`.
- [ ] **K-13 Confirmation page.** Files: `app/[locale]/checkout/confirmation/[orderId]/page.tsx`, `confirmation/page.tsx`, `components/order/*`, `hooks/useOrderStatus.ts`, messages, tests. Tests: `Order placed` (reference, totals and next steps from the order, not the cart), `Guest` (email shown, account offer), `Status progress` (each state gives done and active nodes; `collected` gives four done), `Shipped line` (estimate and "Tracking will appear here"), `No recent order`, `Revisited later`, `Member order needs the owning session`, `Confirmation header does not claim an email without a mail adapter`, `Polling stops at collected`.
- [ ] **K-14 Fallback for the spike result** (do only the one the spike chose; if `multiple-shipping`, tick as not needed and note it).
  - **K-14a `order-per-group`**: `lib/checkout/split.ts` creates one cart per group (Single mode, group lines, copied codes only on the first cart, Q-K-02c), order numbers `<base>-A`, `<base>-B`; page shows "Payment 1 of 2" with the amount per order; `finalizeOrder` for each; confirmation shows all linked orders by the shared base number. Tests: `Mixed order under the fallback creates two linked orders`, `Second payment failure leaves the first order intact and says so`, `Retry never duplicates an order`.
  - **K-14b `restrict`**: `GET /api/checkout` returns `issues` code `mixed_bag` (add to `CheckoutIssue`); the page shows `checkout.mixed.title` and two buttons that set one group aside (`Check out collection items first`, `Check out delivery items first`) through I's fulfilment switch; the other group stays in the bag. i18n added in three catalogues. Tests: `Mixed bag is stopped with a clear choice`, `Choosing a group leaves the other lines in the bag`.
- [ ] **K-15 German review and catalogue parity.** Files: `messages/*.json`. A script-free check: the three catalogues have identical keys for `checkout` and `order` (the existing lint rule fails otherwise). Tests: `Catalogues have the same keys`.
- [ ] **K-16 Browser run with a test card, evidence, hand-off.** Run sections 6 and 7; if the card step cannot be automated record why and rely on the M rows; save evidence; add todo rows; `npm run build`; set `Ready for review`. `blocked: OA-K-a` for the payment parts until the Checkout Application exists.

### 4.1 Fallback behaviour (for K-14)

`order-per-group`: the bag is split at the payment step only; steps 1 and 2 are identical. Payment runs per group in sequence with its own session (`futureOrderNumber` `<base>-A` and `-B`). If payment A succeeds and B fails, order A stands, the page says "Your collection order is placed. Your delivery order still needs payment" and offers B again; the bag then holds only group B. `restrict`: no splitting, the shopper chooses which group to check out first; both outcomes are first-class, not errors.

## 5. Scenarios checklist

Tick only with the named test or recorded evidence. "Browser" means a recorded check in section 6.

`design-checkout-page`
- [ ] Going back: `Going back` (K-10)
- [ ] Member with saved addresses: `Member with saved addresses` (K-06, K-10)
- [ ] Guest switch: `Guest switch` (K-10)
- [ ] Collect only: `Collect only` (K-06, K-10)
- [ ] Someone else collects: `Someone else collects` (K-11)
- [ ] Free shipping code: `Free shipping code` (K-05, K-11)
- [ ] Payment failure: `Payment failure` (K-12); browser R12 with the decline card (or M-K-03)
- [ ] Placement: `Placement` (K-12, K-07); browser R11
- [ ] Invalid code: `Invalid code` (K-05, K-09)
- [ ] Duplicate code: `Duplicate code` (K-05, K-09)
- [ ] Remove a code: `Remove a code` (K-05, K-09)
- [ ] Missing email: `Missing email focuses the email field` (K-10)
- [ ] B2C (Place order is the only commit action): `Place order is the only commit action` (K-12)

`design-order-confirmation-page`
- [ ] Guest: `Guest` (K-13)
- [ ] Status progress: `Status progress` (K-13); browser R15
- [ ] Shipped line: `Shipped line` (K-13)
- [ ] No recent order: `No recent order` (K-13)

`checkout`
- [ ] Address changes the total: `Address change moves tax` (K-04); browser R7
- [ ] Totals moved after authorization: `Totals moved after authorization` (K-12, K-07)
- [ ] Placement fails at the last moment: `Placement outcome unknown shows one retry path` (K-12), `Retry never duplicates an order` / `Existing order is reported instead of a second session` (K-07)

`checkout-page`
- [ ] Address change moves tax: `Address change moves tax` (K-04)
- [ ] No delivery method for address: `No delivery method for address` (K-06, K-11)

`order-confirmation-page`
- [ ] Order placed: `Order placed` (K-13)
- [ ] Placement outcome unknown: `Placement outcome unknown looks the order up by number` (K-07)
- [ ] Revisited later: `Revisited later` (K-08, K-13)

`fulfilment-and-availability-model` (parts owned by K)
- [ ] Mixed order: `Mixed order has collect and ship parts` (K-08) plus spike evidence S7/S8 (or `Mixed order under the fallback creates two linked orders`, K-14)
- [ ] Ready: `Ready` (K-08), `Status progress` (K-13), browser R15
- [ ] Threshold per market: `Threshold per market` (K-04)
- [ ] US address without state rate: `US address without state rate has a tax portion` (K-04); browser R8

## 6. Browser recipe (Chrome DevTools MCP)

Prerequisites: `npm run dev`, live credentials, the strategy chosen in K-01, `OA-K-a` for R9 onwards. Test shoppers: a guest, and a member you register through J (`qa-k-<date>@example.com`, synthetic password). Data: US market (`/en-US`), store `mcf-store-nyc-soho`; repeat R1 to R10 once in `/de-DE` with store `mcf-store-berlin-mitte`. Evidence: `plans/evidence/K/<step>-<what>-<375|1440>.png`. For every step take a snapshot and check `list_console_messages` (no errors) and `list_network_requests` (no failed requests; the only allowed 4xx are the deliberate ones named below). Never save card data or personal data in evidence: crop screenshots before the card field is filled or capture only after the widget shows the masked value.

| Step | Do | Expect |
| --- | --- | --- |
| R1 | Add one machine (ship) and one pod box (collect at the NYC store) as a guest using the I UI; open `/en-US/checkout` at 1440x900 | Step indicator with 1 active, Contact card, Shipping address form, summary with two lines (Pickup and Delivery tags), no address asked for the pickup |
| R2 | Same at 375x812 | One column, summary after the steps, no horizontal scroll |
| R3 | Press Continue with everything empty | Errors beside email, names, street, city, state, zip, phone; focus on email |
| R4 | Enter bad values one by one (email without domain, zip `1234`, phone `abc`) | Specific message for each; no commercetools calls in the network list (only our `/api` PUT answering 422 if the client check was bypassed) |
| R5 | Fill valid data and Continue | Step 1 shows teal check; request `PUT /api/checkout/details` 200; summary tax and shipping shown or "Calculated at the next step" |
| R6 | Step 2: pickup card shows store, hours, "Ready in about N minutes" from data; choose "Someone else" and Continue empty | Alt name error; then valid name continues |
| R7 | Switch the address to another ZIP or state (US) and back (use Back, then the step 1 link) | Summary tax and total change after each change (compare the numbers; save both screenshots) |
| R8 | Use a US address in a state without a seeded rate (for example Wyoming) | Tax row is non-zero from the country rate (D-018) |
| R9 | Promo: `NOPE` (red message, no change), `WELCOME10` (pill, Discount row), `WELCOME10` again (already applied), `FREESHIP` (Standard shows "code applied", shipping Free), remove `WELCOME10` (totals recompute), `COFFEE15` under 60 (amber not-applicable pill) | As listed; each response `200` or the named `4xx` |
| R10 | Step 3 | Widget loads inside the Payment card, summary stays, no console errors; Back works and keeps entries |
| R11 | Pay with the PSP success test card (see K-16 notes) | Confirmation opens, header "Order confirmed", number `MC-...` in mono, totals equal the summary; bag empty on reload of `/cart` |
| R12 | Repeat with the decline test card | Error region on step 3, widget still usable, bag intact |
| R13 | Reload the confirmation URL; open it in a private window (guest order) and, for the member order, in a private window | Guest order renders from the order; member order asks to sign in |
| R14 | Place a collect-only order | No address card in step 1; confirmation has the collection card, tracker with Ordered active |
| R15 | Run `npm run seed:order -- state --order-number <n> --to ready-for-collection` (then `collected`); reload the confirmation and wait 30 s on the open page | Tracker: Ready active with Ordered and Preparing done; later all four done; polling stops |
| R16 | Mixed order (strategy `multiple-shipping`) | One payment, confirmation shows collection and delivery cards; read the order back (section 7) |
| R17 | Member checkout | "Signed in as", saved default address preselected, "Check out as guest" clears the fields |
| R18 | Sign out, repeat R1 to R5 in `/de-DE` | German copy, EUR formatting `4,90 €`, "Inkl. MwSt." row, postcode rule `\d{5}` |
| R19 | Tab through all steps | Visible focus ring on each control; radio groups arrow-navigable; step buttons correct |

## 7. Self-verification with data

No owner involvement.
- After R11, R14, R16 read the orders back with the commercetools MCP or a read-only script (ids, keys and numbers only): `orderNumber` equals the displayed number, `paymentState`, `taxedPrice` equals the summary total, `shippingMode`, `shipping[*].shippingKey`, `lineItems[*].custom.fields.fulfilment`, `lineItems[*].supplyChannel.id` for collect lines, `state.obj.key` is `mcf-order-ordered`, the collect address carries the pickup person name. Save as `plans/evidence/K/order-<n>.json` (no email, no address lines beyond country and city).
- Compare each summary shown in the browser with the cart read through the API (numbers equal).
- Read the payment for the order and check one payment with `amountPlanned` equal to the total (mixed order: also one only).
- Run `cd seed && npm run verify` (still passes) and the state tool in `--dry-run` first.
- Confirm no card, email or address text appears in the dev server log (`grep` for the test email and `4242`; save "0 matches").
- Write `plans/evidence/K/README.md` saying what each file proves.

## 8. Manual testing and owner items

Rows are also in `plans/notes/todo-K.md`. First automate what you can: the card fields live in a cross-origin iframe, so first try `take_snapshot` (it may list the card inputs and you can `fill` them); if it does not, click the "Pay" area to focus, use `press_key` Tab to reach the card number field, and `type_text` the digits, Tab, expiry, Tab, CVC, Tab, postcode. Give this 30 minutes, then record the outcome in `PROJECT-FINDINGS.md`. 3-D Secure challenges and real wallets are not automatable; those are the M rows.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-K-a | Owner | Before K-01 probes S6 to S8, S11, S12 and K-12 | 1. In the Merchant Center create a Checkout **Application** in Payment Only mode. 2. Install and configure a payment connector in test mode (PSP chosen by you, OA-04). 3. Put the Application key in `storefront/.env.local` as `CTP_CHECKOUT_APP_KEY` and add `manage_sessions` and `manage_orders` to the API client. | Application and connector exist; the payment steps of K are unblocked | TODO |
| OA-K-b | Owner | Before R11 and for redirect payment methods | 1. In the Application's payment settings register the return URL `http://localhost:3000/checkout/return` (and the deployed URL when hosting exists). | Return URL saved; only one per connector | TODO |
| OA-K-d | Owner | Before SO-K-b | 1. In the Application's texts and labels set the pay button text to "Place order" (en and de) and enable the card method. | Widget button reads "Place order" | TODO |
| SO-K-a | Owner | Before release | 1. Read the delivery-time text on the shipping method tiles and the collection "Ready in about N minutes". 2. Approve or change the copy (the days text comes from the shipping methods' descriptions, the minutes from the store data). | Copy approved | TODO |
| SO-K-b | Owner | Before release | 1. Compare checkout steps 1 to 3 and the confirmation with `screenshots/checkout-step1.png`, `checkout-step2.png` at 375 and 1440 px. 2. Judge the hosted widget's look inside the Payment card. | Fidelity accepted or changes listed | TODO |
| M-K-01 | Owner | Before release | 1. On a real phone place an order with the PSP success test card. 2. Note whether the keyboard hides the widget fields. | Order confirmed; fields usable | TODO |
| M-K-02 | Owner | Before release | 1. Pay with the PSP 3-D Secure test card. 2. Complete the challenge. | Redirect returns to `/checkout/return` then the confirmation | TODO |
| M-K-03 | Owner | Only if the decline card cannot be automated | 1. Pay with the PSP decline test card. 2. Retry with the success card in the same session. | Error shown on step 3, retry works, one order only | TODO |
| M-K-04 | Owner | Before release | 1. Pay with a wallet (Apple Pay or Google Pay) if the connector offers it. | Order confirmed or the method is hidden | TODO |
| M-K-05 | Owner | After the order exists | 1. In the Merchant Center open the order. 2. Change its state to Preparing, Ready for collection, Collected (Orders, Order details, State). 3. Reload the confirmation page. | The tracker follows each change | TODO |
| M-K-06 | Owner | Before release | 1. Place a mixed order (machine to ship, pods to collect). 2. In the Merchant Center check one payment, both shipping entries, tax. | Matches the decision recorded from K-01 | TODO |

## 9. Questions

Each is also in `plans/notes/questions-K.md` (format `Q-K-n | question | default | blocks? | Open`). The default is built.

| ID | Question | Default built | Blocks? |
| --- | --- | --- | --- |
| Q-K-01 | Hosted Checkout payment-only (D-016) cannot place the design's own "Place order" button; the widget has its own pay button. Accept? | Yes: the widget button, labelled "Place order" through Checkout's text customisation (OA-K-d), sits in the Payment card under the security note; Back stays ours. | No |
| Q-K-02 | Mixed bags: which strategy after the spike? And should G/I create every cart as `shippingMode: Multiple`? | Strategy from K-01's rule. G's `CART_SHIPPING_MODE` stays `'Single'`; K clones into a `Multiple` cart at checkout when there are two groups. Reason: with `Multiple` the cart page shows no tax estimate until every quantity is allocated to an address, which would break `design-cart-page` Tax presentation. | Blocks K-03 to K-07 detail only |
| Q-K-02b | If only tax fails under Multiple: fix data or fall back? | Fix data in the seed and keep Multiple. | No |
| Q-K-02c | Under `order-per-group`, on which order do discount codes apply? | First order only. | No |
| Q-K-03 | Can the pay button be hidden or triggered from our page? | Not assumed; probe S12. | No |
| Q-K-04 | Order number format? | `MC-` plus 10 base32 characters derived from the cart id (deterministic, so retries cannot duplicate). | No |
| Q-K-05 | What if an order exists but `transitionState` to `mcf-order-ordered` fails? | Log, show the order with no tracker, retry on the next read. | No |
| Q-K-06 | May the shipping country differ from the market? | No: the shipping country is the session country (cart currency and prices depend on it). | No |
| Q-K-07 | Billing address for collect-only orders? | Contact name and email with the store's country; the hosted widget collects any extra fields the PSP needs. | No |
| Q-K-08 | Should "Check out as guest" detach the order from the signed-in customer? | No: fields clear only (spec); the order stays on the account. | No |
| Q-K-09 | Save a new checkout address to the account? | Checkbox, off by default, members only. | No |
| Q-K-10 | Where does a guest's email travel to the register page? | HTTP-only cookie `mcf_guest_email`, 1 hour, deleted on read. Never a URL. | No |
| Q-K-11 | Where do delivery-day texts come from? | `ShippingMethod.localizedDescription` per locale. Request to workstream B: write "2-4 business days" style text per language for standard and express (seed change). No text if absent. | No |
| Q-K-12 | Tracker mapping for `ordered`, and for ship-only orders? | `ordered` = Ordered active (spec, not the prototype). Ship-only orders show no tracker, only the delivery card. | No |
| Q-K-13 | Notification promises (emailed receipt, SMS when ready)? | Not shown while no mail adapter is enabled and never for SMS; copy says check the page or account. | No |
| Q-K-14 | Guest order page access? | Anyone holding the order id sees it with phone and billing hidden; member orders need the owning session. | No |
| Q-K-15 | Idempotency on the placement path if `complete` is called twice? | `finalizeOrder` is idempotent by order number. | No |

## 10. Definition of done

- K-01 finding written in `plans/PROJECT-FINDINGS.md`, strategy set in `lib/checkout/strategy.ts`, the decision told to the lead; probes that were blocked are listed with `blocked: OA-K-a`.
- All tasks ticked, each with a passing `check` commit; `npm run build` passes.
- Every scenario in section 5 ticked with a named test or recorded evidence.
- Browser recipe verified at 375 and 1440 px in `/en-US` and `/de-DE`, console and network clean, evidence and `README.md` in `plans/evidence/K/`. One order placed end to end with the test card (or the reason it could not be automated recorded, with the M rows in place). This closes the gate "After wave 8".
- Section 7 read-backs saved; no card, email or address text in logs.
- Owner rows in `plans/notes/todo-K.md`, questions in `plans/notes/questions-K.md`.
- `seed:order` works and refuses a foreign project key.
- No `TODO` or `FIXME` without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
