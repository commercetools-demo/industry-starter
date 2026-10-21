<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream K: Checkout and confirmation

Paths are relative to `storefront/` unless they start with `plans/` or `seed/`. Read `plans/JUNIOR-GUIDE.md` first. Real exports used (see `plans/workstreams/D-server-core.md`, `F-shell-and-pickers.md`, `G-browse.md`, `J-auth-and-session.md`): D `handle`, `jsonError`, `requireCustomer`, `getSession`, `createSessionToken`, `setSessionCookie`, `updateWithRetry` (`lib/ct/retry.ts`), `keyOrder`, `fetchJson`; F `todayHours` (`lib/hours.ts`), `useStorePicker`, `useCollectionStore`, `lib/ct/inventory.ts`; G `lib/ct/cart.ts` (`getCartForSession`, `createCart`, `addLine`), `CART_SHIPPING_MODE` in `lib/shop-config.ts` (default `'Single'`), `CartSummary`, `useCart`; J `domainError` (`lib/api-domain.ts`), `useAccount`, `AppCustomer`, `AppAddress`, `requireCustomerPage`. Workstream I (cart page) is planned separately: its cart view type is called `CartView` here; use I's real name. Markets are US and Canada only (D-030). If a real export differs, use the real one and say so in your hand-off.

## 1. Header

| Field | Value |
| --- | --- |
| ID | K |
| Name | Checkout and confirmation: review by fulfilment cluster, complete hosted Checkout (address, delivery, payment with Stripe), order states, confirmation |
| Depends on | I (cart, groups, discount codes), J (session, `useAccount`, auth guards) |
| Wave | 8 |
| Primary spec | `design-checkout-page` |
| Also implements | `design-order-confirmation-page`, `checkout`, `checkout-page`, `order-confirmation-page`, `fulfilment-and-availability-model` (mixed bags, order states for collection, shipping by market, tax by market) |
| Read for context | `design-cart-page`, `design-cart-drawer` (what the bag looks like when it arrives), `server-architecture-and-data-flow`, `bootstrap-and-structure`, `design-tokens-and-components` |
| Generated templates that apply | `checkout`, `checkout-page`, `order-confirmation-page`. Excluded for B2C by the templates themselves: purchase order number, cost centre, approval routing. Not applicable: `delivery-slot-booking` (D-022, D-034: standard carrier only, no slots) |
| Skills | `[SKILL: commercetools-checkout]` (read `references/payment-only-mode.md` fully first: it holds the architecture, the Sessions API route, the `checkoutFlow` and `paymentFlow` entry points, styling, the `<div data-ctc />` mount note and the return-URL rule; the full hosted flow is `checkoutFlow` there and in the Browser SDK docs, https://docs.commercetools.com/checkout/browser-sdk; then run the skill's `scripts/docs-search.mjs` for "Complete Checkout", "checkoutFlow", "skipPaymentSuccessPage" before coding), `[SKILL: commercetools-storefront]` (`core/checkout-page.md`, `b2c/checkout.md`, `core/cart.md`), `[SKILL: commercetools-commerce-patterns]` (shipping, tax, discounts) |
| Owner prerequisites (lead numbers the rows) | `OA-K-a` a commercetools Checkout **Application of type Complete Checkout** (D-039) with the Stripe connector in test mode (OA-04), its key in `CTP_CHECKOUT_APP_KEY`, countries US and CA, "Allow all origins" for dev. `OA-K-b` register the payment return URL (`<site>/checkout/return`, one per connector; localhost for dev, the Netlify URL later) and the Netlify origin. `OA-K-c` the storefront API client needs scopes `manage_orders`, `manage_sessions`, `view_shipping_methods`, `manage_customers` (already for J), and for L `manage_payments`; confirm with the lead. `OA-K-d` Application texts, user agreements and the Discount Code toggle. `OA-K-e` only if the spike picks `payment-only-for-collect`: a second Application in Payment Only mode. `SO-K-a` delivery-time and collection-time copy. Until OA-K-a/b are done the spike and the hosted step are `blocked: OA-K-a`, everything else is built and tested with mocks |

## 2. Goal and scope

**Goal.** A shopper (guest or member) turns the bag into a paid order in two stages: our **Review** step (the bag shown by fulfilment cluster, every line marked as collect, delivery or subscription, with the pickup person chosen) and the **complete hosted commercetools Checkout** (`checkoutFlow`, D-039) connected to Stripe, which owns contact, shipping and billing address, delivery method, discount code entry and payment. Card data never touches the storefront. The totals we show are always read back from the commercetools cart, and the shopper lands on a confirmation page rendered from the stored order, showing the order's real state and, for collection, a four-step tracker. Markets are US (collect or ship) and Canada (ship only, D-035); the carrier is standard only, no slots (D-034). There is no email (D-032): nothing says a message was sent.

**First, the spike (K-01).** Mixed bags are required (D-033): one bag may hold collect, ship and subscribe lines (D-021) and the shopper must be able to pay for all of it. Whether the complete hosted Checkout can take a cart with `shippingMode: Multiple` is **not** established: the Checkout documentation's multiple-shipping section lists Payment Only mode as the prerequisite "because the Complete Checkout mode handles shipping configuration internally" (https://docs.commercetools.com/learning-implement-checkout/implement-commercetools-checkout/extend-checkout-functionality). Also unknown: whether the hosted flow can accept a collect cart whose address is the store (it asks for addresses itself). K-01 decides the mechanism and the fallback; "refuse mixed bags" is not an option (D-033). Nothing in K is built past the contracts until K-01 writes its finding.

**In scope**
- Page `/[locale]/checkout` with two stages: Review (clusters, pickup person, summary) and Pay (hosted `checkoutFlow` mounted in the page).
- Cart preparation on the server before the session: fulfilment groups, collect group addresses and `mcf-collect` method, standard delivery for the ship group, discount codes already on the cart. Every change re-reads the cart.
- Checkout session route (Sessions API, the one documented non-SDK call), order finalisation (order state, session cleanup), return route for redirect payment methods.
- Order lookup by id, order states (`mcf-order-*`) and the tracker, the confirmation page `/[locale]/checkout/confirmation/[orderId]` (our own page: the hosted success page is skipped with `skipPaymentSuccessPage`).
- Dev tooling to move an order through the states (seed script).
- The mixed-bag mechanism and fallback chosen by the spike.

**Out of scope**
- Cart page and drawer (I). Subscriptions: creating recurring orders and managing them (N). K only leaves a hook (3.12).
- Account order history, returns, reorder (L).
- Our own address, contact, delivery and card forms (the hosted flow owns them; they exist only as the `payment-only-for-collect` fallback, K-14c), saved cards management, express payment buttons.
- Delivery slots, express carrier choice beyond what the hosted flow lists, gift note, invoice or PO payment, B2B quotes, approvals.
- Email: there is no email provider (D-032). No order email is sent and no copy claims one.

## 3. Design

### 3.1 Files

| File | Purpose |
| --- | --- |
| `lib/checkout/validate.ts` | Pure shared validators: pickup name and promo code format (3.6) |
| `lib/checkout/fulfilment-plan.ts` | Pure: `planGroups(cart)` (clusters), `buildFulfilmentActions(cart, plan)` |
| `lib/checkout/summary.ts` | Pure: `buildSummary(cart)`, `codeSavings(cart)` |
| `lib/checkout/shipping-price.ts` | Pure: `priceFor(method, cart)` (flat rate and `freeAbove`, per market) |
| `lib/checkout/order-number.ts` | Pure: `orderNumberForCart(cartId)` |
| `lib/checkout/strategy.ts` | `MIXED_STRATEGY: 'complete-multiple' \| 'complete-per-group' \| 'payment-only-for-collect'` (the spike's result) |
| `lib/checkout/finalize.ts` | Server only: `finalizeOrder({ orderId?, orderNumber? })` idempotent |
| `lib/checkout/post-order.ts` | `postOrderHooks: Array<(order: OrderView) => Promise<void>>` (N registers its hook; empty here) |
| `lib/ct/checkout.ts` | Server only: all cart preparation calls |
| `lib/ct/checkout-session.ts` | Server only: Sessions API call |
| `lib/ct/orders.ts`, `lib/mappers/order.ts` | Server only: order reads, `ensureOrderState`; `OrderView` mapper. L extends these files |
| `app/api/checkout/route.ts` | GET state |
| `app/api/checkout/pickup/route.ts` | PUT pickup person and prepare the cart for the hosted flow |
| `app/api/checkout/session/route.ts`, `complete/route.ts` | POST |
| `app/checkout/return/route.ts` | GET, outside `[locale]`; add `checkout/return` to the exclusions of the `proxy.ts` matcher (A owns `proxy.ts`: make that one-line matcher change in K-07 and say so in the hand-off) |
| `app/api/orders/[id]/route.ts` | GET one order (L adds list) |
| `app/[locale]/checkout/page.tsx`, `app/[locale]/checkout/confirmation/[orderId]/page.tsx`, `app/[locale]/checkout/confirmation/page.tsx` | Pages (last one is the "No recent order" state) |
| `components/checkout/*` | `CheckoutPage`, `StepIndicator` (two steps), `FulfilmentCluster`, `ClusterLine`, `PickupLocationCard`, `DeliveryNote`, `HostedCheckout`, `OrderSummary`, `FieldError`, `CheckoutIssues` |
| `components/order/OrderStatusTrack.tsx`, `CollectionCard.tsx`, `ShippingNote.tsx`, `OrderSubscriptionCard.tsx`, `OrderItems.tsx`, `lib/checkout/guards.ts` (`checkoutBlockers(cart, session)`: empty list in K; N-06 appends its rule that a bag with a subscribe line needs a signed-in customer; K's session handler returns the first blocker as `401 sign_in_required` or `409 checkout_blocked`) | Confirmation parts (L reuses `OrderStatusTrack`) |
| `hooks/useCheckout.ts`, `hooks/useOrderStatus.ts` | SWR hooks |
| `lib/cache-keys.ts` | Append `keyCheckout(customerId: string \| null)` = `['checkout', customerId ?? 'guest']`. Order status uses D's `keyOrder(customerId ?? 'guest', orderId)` |
| `seed/src/scripts/order-ops.ts` + `package.json` script `seed:order` | Dev tool, subcommand `state` (L adds more) |
| `messages/*.json` | Namespaces `checkout`, `order` (3.10), catalogues `en-US` and `en-CA` |
| `.env.example` | Add names only: `CTP_CHECKOUT_APP_KEY`, `PUBLIC_SITE_URL` (J added it) |

### 3.2 Visual design (from `pages-checkout.jsx` `CheckoutPage`, `ConfirmationPage` and `styles.css`)

Read the JSX and CSS; tokens only, never the prototype's raw colours or fonts. Screenshots to compare: `design/export/b2b2c-retailer-design/project/screenshots/checkout-step1.png`, `checkout-step2.png`, `checkout-guest.png`, `01-checkout-promo.png`, `01-checkout-identity.png`. D-039 replaces the prototype's three steps (Details, Fulfilment, Payment) with Review then the hosted Checkout: the prototype is followed for layout, summary card and confirmation only, and the owner judges the hosted part separately (SO-K-b). Record the deviation in `plans/PROJECT-FINDINGS.md`.

**Checkout layout.** `main.wrap`, bottom padding 80px. Header row: H1 "Checkout" (Archivo 800, 30px, `-0.02em`) left, `StepIndicator` right (two steps: Review, Pay), wraps on small screens. Body grid: columns `minmax(0,1.5fr) minmax(0,0.8fr)`, gap 48px, `align-items:start`; at 900px and below one column with the summary **after** the stage (class `cart-grid` behaviour in `styles.css`).

**`StepIndicator`** (`Steps` atom): props `{ steps: {id: 1|2, label: string}[]; current: 1|2; onGoTo(id) }`. Numbered circle 24px; active ink fill, done teal fill with check icon, later step grey. The done step is a `button` (go back to Review; the hosted widget unmounts and a new session is created on return); the later step is not focusable (`aria-disabled`). `nav aria-label` "Checkout steps", `aria-current="step"` on the active one.

**Stage 1 Review.** One `FulfilmentCluster` `Card` per fulfilment group present in the bag, in this order: collect (one per store; with six NYC stores a bag may in principle hold lines for more than one), delivery, subscription. Every cart line appears **inside its cluster** as a `ClusterLine` with a visible marker: store icon teal "Collect at {store}", truck "Delivery", repeat icon "Every {interval}". A line is never shown outside a cluster and never in two (D-033).
- Collect cluster (US market only): store icon, H3 "Pickup at {store name}", "{n} item(s) ready for collection.", the store row (address, "Open today {hours} · {phone}" from F's `todayHours(store, now, timeZone)`, teal line "Ready in about {n} minutes" from the channel field `collectionMinutes`), a "Change" link-button calling `useStorePicker().open()` (F), then "Who's picking up?" with two `fulfill-opt` tiles: "It's me" and "Someone else". A pickup name is always asked (`Pickup name`, prefilled from the member's name; a guest types it), because the hosted flow collects the contact later and the store needs the name on the pickup address (Q-K-07).
- Delivery cluster: truck icon, H3 "Delivery", "{n} item(s) shipping to you. You enter the address next." and, from the market data, the line "Free delivery on orders over {threshold}" (US 75 USD, Canada 99 CAD, read from the zone rate `freeAbove`, D-029) and the delivery-days text when the seed provides it. Standard carrier only; the hosted flow lists the matching method(s).
- Subscription cluster: repeat icon, H3 "Subscription", each line with "Delivers every {interval}", shipped to the delivery address. Needs a signed-in customer (N-06 via `checkoutBlockers`).
- Canada market: only the delivery and subscription clusters exist; there is no collect cluster, no store picker and no pickup person (F hides them, D-035). A collect line cannot be in a Canada bag; if one is (market switch), `CheckoutIssues` shows `collect_not_available` and links to `/cart`.
- Primary button "Continue to secure checkout" (`Button ink lg block`), 20px above. It saves the pickup person, prepares the cart, requests the session and moves to stage 2.

**Stage 2 Pay.** The hosted Checkout (`checkoutFlow`) mounts inline in `HostedCheckout`: a `Card` region (`aria-label` "Secure checkout", skeleton while loading, min height 480px so nothing jumps) with the mount `<div data-ctc />` (confirm in K-01 whether `checkoutFlow` needs the mount or renders full screen). It shows contact, shipping and billing address, delivery method, discount code (if the Application toggle is on, OA-K-d) and Stripe payment, with its own pay button (label via Application texts, OA-K-d). Above it our line "Encrypted and secure. Card details are entered in the secure payment form and never reach Malva Coffee." and below an error region and a ghost "Back to review" button. The success and error pages of the hosted flow are skipped (`skipPaymentSuccessPage: true`, `skipPaymentErrorPage: true`): we react to `onInfo`/`onError` and show our own confirmation and our own error region. The bag is not cleared until the order exists.

**Summary card** (sticky, `top: 96px`, `Card`; stays visible in both stages when there is room): H3 "{n} items" (sum of quantities); scrollable line list, `max-height: 200px`: 48x58 image (radius 8, `--canvas-2` background, image through the `thumbnail` transform of `lib/ct/image-config.ts`), name 13px weight 600, "variant · x{qty}" 11.5px `--ink-3`, the same fulfilment marker as the cluster line, price at the right. Totals rows 13.5px: Subtotal, Discount (teal, negative, only when above 0, with the code pills read back from the cart), Shipping ("Free" teal or amount; "Calculated in secure checkout" before an address exists), Tax row (3.5), Total (16px bold, hairline above). Labels are `dl` rows for screen readers. Numbers update from the last cart response only. There is no promo input on our page: codes are entered in the hosted flow (or in the cart, workstream I) and read back.

**Responsive.** Under 900px one column; tiles stack; buttons stay 100% wide. The widget container never overflows horizontally.

**Confirmation** (from `ConfirmationPage`): `main.wrap`, `max-width: 760px`, bottom padding 80px. Header block centred: 64px teal circle with a white check (icon `aria-hidden`), H1 "Order confirmed" (Archivo 800, 32px), line "Order **{number}** · {email}" (never a claim that an email was sent, D-032) with the number in Roboto Mono. Cards stacked 18px apart: collection card (when any collect line), shipping card (when any ship line), subscription card (when any subscribe line), items card, then buttons "View in My Account" (ink lg) and "Keep shopping" (ghost lg) centred. Guest: an extra card "Create an account with this order" with a button to `/account/register` (email pre-filled from the cookie, 3.7).

**`OrderStatusTrack`**: props `{ state: 'ordered'|'preparing'|'ready-for-collection'|'collected'|null; labels: Record<...,string> }`. `ol` of four nodes, each flex 1, column, centred, 30px ring (2px `--line-2` border) and 11.5px weight 600 label; connector bar 2px between rings (teal when the node on its right is done or active... the bar to the **left** of a node is teal when that node is done). Rules: with `i` the index of the current state (0 to 3): nodes before `i` are **done** (teal fill, white check); node `i` is **active** (accent ring with a 12px accent dot) except when `i` is 3, where all four are done; `null` renders nothing. Each node carries `aria-label="{label}: done|current|upcoming"`; the list is `aria-label` "Collection progress". This follows the spec (`ordered` active, earlier done). The prototype shows "Ordered" done and "Preparing" active the moment the order is placed; do not copy that (Q-K-12).

### 3.3 Data contracts (add to `lib/types.ts`; components import only from there)

```
type FulfilmentKind = 'collect' | 'delivery' | 'subscribe'
type FulfilmentGroup = { key: string /* 'delivery' or 'collect-<storeKey>' */; kind: 'collect' | 'delivery'; storeKey: string | null; lineIds: string[] }
type CheckoutStage = 'review' | 'pay'
type CheckoutIssue = { code: 'line_unavailable' | 'collect_out_of_stock' | 'collect_not_available' | 'price_changed' | 'currency_mismatch'; lineId: string }
type DiscountCodeView = { code: string; label: string | null; state: 'applied' | 'not_applicable' | 'pending'; reason: string | null; savingCents: number | null }
type SummaryView = { currency: 'USD' | 'CAD'; subtotalCents: number; discountCents: number; shippingCents: number | null; shippingFree: boolean; taxCents: number | null; totalCents: number; version: number }
type CheckoutLineView = { id: string; name: string; variantSummary: string; quantity: number; imageUrl: string | null; fulfilment: FulfilmentKind; groupKey: string; storeName: string | null; recurrenceLabel: string | null; linePriceCents: number }
type CheckoutState = {
  cartId: string; version: number; stage: CheckoutStage
  lines: CheckoutLineView[]          // every line carries its groupKey: the UI renders lines only inside their cluster
  groups: FulfilmentGroup[]
  strategy: 'complete-multiple' | 'complete-per-group' | 'payment-only-for-collect'
  pickup: { storeKey: string; storeName: string; address: string; hoursToday: string | null; phone: string | null; readyMinutes: number | null; pickupName: string | null } | null   // null in Canada and when nothing is collected
  deliveryNote: { freeAboveCents: number | null; days: string | null } | null
  codes: DiscountCodeView[]          // read back from the cart
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
  totals: { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number }
}
```

Money is integer minor units; display only through `formatMoney(centAmount, currency, locale)`. Prices are tax-exclusive in both markets (`COUNTRY_CONFIG[country].pricesIncludeTax` is false for US and CA); tax is added at checkout (US state rates, Canada 5% GST on standard goods, 0% on food, D-036).

### 3.4 Route handler contracts

All handlers: `dynamic = 'force-dynamic'`, no caching, wrapped in D's `handle(route, fn)`, session via D (`getSession`; `requireCustomer()` where a signed-in customer is needed), errors `{ "error": { "code", "message" } }`: unexpected failures through D, domain codes (`validation_failed` with `"fields": { "<name>": "<code>" }`, `totals_changed`, ...) through J's `domainError(code, status, extra)`; commercetools bodies and stack traces never returned, correlation id logged. Every handler reads the cart **only** from `session.cartId`; nothing in a request body names a cart or a customer. A missing cart returns `404 cart_not_found`. A version conflict is retried once after a re-read with D's `updateWithRetry`; a second conflict returns `409 cart_conflict`.

| Handler | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/checkout` | none | `200 CheckoutState` (after `ensureCheckoutCart`, 3.5) | `404 cart_not_found`, `409 cart_empty` |
| `PUT /api/checkout/pickup` | `{ person: 'me' \| 'other'; pickupName: string }` (required when a collect group exists; ignored otherwise) | `200 CheckoutState` with `stage: 'pay'` ready: the cart now carries the group addresses and methods (3.5) | `422 validation_failed` with `fields`, `409 collect_out_of_stock`, `409 collect_not_available` (Canada session) |
| `POST /api/checkout/session` | `{ expectedTotalCents: number }` | `200 { sessionId, projectKey, region, orderNumber, expiresAt }` | `409 totals_changed` (cart total differs from `expectedTotalCents`; client re-reads), `409 checkout_not_ready` with `missing: ('pickup'\|'lines')[]`, `409 order_exists` with `orderId` (an order with this cart's number already exists), `401 sign_in_required`, `502 upstream_unavailable` |
| `POST /api/checkout/complete` | none | `200 { orderId }` (calls `finalizeOrder` for the session cart's order number; polls up to 5 times 1 s apart) | `404 order_not_found` (client shows the retry path of 3.7), `502` |
| `GET /checkout/return?orderId=<id>` or `?orderNumber=<n>` | query set by the hosted Checkout | `303` to `/<order locale>/checkout/confirmation/<orderId>` after `finalizeOrder` | `303` to `/<default locale>/checkout/confirmation` ("No recent order") when the order is not found |
| `GET /api/orders/[id]` | none | `200 { order: OrderView }`; guest orders by id, member orders only for the owning session | `404 order_not_found` (also for another customer's order, identical body) |

Contact, address and delivery method writes are made by the hosted Checkout (discount codes are applied earlier on the cart page) against the cart, not by our handlers; our `GET /api/checkout` reads the result back. Redirect target locale is `order.locale` only when it is in `COUNTRY_CONFIG`, else the default locale; never taken from the query.

### 3.5 Exact commercetools calls (server only, `lib/ct/checkout.ts`)

Load `[SKILL: commercetools-checkout]`, `[SKILL: commercetools-storefront]`, `[SKILL: commercetools-commerce-patterns]`; confirm each call with the skill's `scripts/docs-search.mjs` (or the Knowledge MCP) before coding, and record any difference in `plans/PROJECT-FINDINGS.md`.

**Cart read.** `apiRoot.carts().withId({ ID }).get({ queryArgs: { expand: ['discountCodes[*].discountCode', 'lineItems[*].supplyChannel', 'lineItems[*].recurrenceInfo.recurrencePolicy', 'shipping[*].shippingInfo.shippingMethod'] } })`. After each write the update response is the new cart; map it (no refetch). Mapping lives in `lib/mappers`; reuse I's cart mapper and extend. The hosted Checkout also writes to this cart (addresses, method, codes), so every read is fresh and no copy is kept.

**Preparation before the session.** Checkout does not create or fix carts (https://docs.commercetools.com/learning-implement-checkout/implement-commercetools-checkout/intro-to-commercetools-checkout): the cart must exist, belong to the session, and be ready. `PUT /api/checkout/pickup` writes only what the hosted flow cannot ask the shopper: the collect group (store address as the group address with the pickup name, `mcf-collect` method). The delivery address, contact email, billing address and the delivery method are left to the hosted flow (standard carrier only; for a ship-only cart `setShippingMethod` is not pre-set).

**Fulfilment groups.** `planGroups(cart)` is pure: `delivery` and `subscribe` lines form the group `delivery` (subscribe lines deliver to the address); `collect` lines form one group per `supplyChannel` store, key `collect-<storeKey>` (normally one). Line fulfilment is read from the line custom field `fulfilment` (`mcf-line-fulfilment`), falling back to `supplyChannel`/`recurrenceInfo` presence. `FulfilmentGroup.lineIds` is what the Review step uses to place each line inside exactly one cluster.

**Mixed-bag strategies** (`lib/checkout/strategy.ts`, set by K-01; D-033 forbids refusing mixed bags):
1. `complete-multiple`: one cart with `shippingMode: Multiple`, one payment, one order, in the complete hosted flow. `buildFulfilmentActions` returns, in this order, so that references are always valid: clear `setLineItemShippingDetails` on lines that have it; `removeShippingMethod { shippingKey }` for each key in `cart.shipping`; `removeItemShippingAddress { addressKey }` for each key in `cart.itemShippingAddresses`; `addItemShippingAddress { address }` for the collect group (key = group key; `firstName`/`lastName` = pickup name, `company` "Malva Coffee", street, city, postal code, country from the store channel `address`, `additionalAddressInfo` = "Collection at {store name}", `email` when known); `addShippingMethod { shippingKey: <group key>, shippingMethod: { typeId: 'shipping-method', key: 'mcf-collect' }, shippingAddress }`; `setLineItemShippingDetails` for the collect lines. Whether the hosted flow then collects the delivery address and method for the ship lines and allocates them is exactly what probes S13 and S14 test. With Multiple, `taxedPrice` is only calculated once every line quantity is allocated. Docs: https://docs.commercetools.com/api/shipping-delivery-overview#multiple-shipping-methods and https://docs.commercetools.com/guides/multiple-shipping-addresses-methods#use-multiple-shipping-methods (verify the target field is `shippingMethodKey` in the installed SDK type `ItemShippingTarget`).
2. `complete-per-group`: one bag in the UI, but the bag is split at pay time into one `Single` cart per fulfilment group; each is paid in the complete hosted flow in sequence (section 4.1). A mixed bag therefore means two payments and two linked orders, with every line still shown inside its cluster before and after.
3. `payment-only-for-collect`: carts with a collect group use a second Application in **Payment Only** mode and our own address and delivery steps (K-14c), where Multiple shipping is documented to work; ship-only carts keep the complete hosted flow. Needs `OA-K-e`.

**Single group.** Cart `shippingMode` is **immutable** after creation (https://docs.commercetools.com/api/shipping-delivery-overview). G's `CART_SHIPPING_MODE` stays `Single`. `ensureCheckoutCart(session)`: if the strategy is `complete-multiple` or `payment-only-for-collect` and there is more than one group and `cart.shippingMode === 'Single'`, create a replacement cart with `apiRoot.carts().post({ body })`: `currency`, `country`, `locale`, `customerId` or `anonymousId`, `shippingMode: 'Multiple'`, `itemShippingAddresses: []`, `lineItems` copied as `{ sku, quantity, supplyChannel: { typeId: 'channel', id }, custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment } }, recurrenceInfo? }` (workstream I owns the exact draft shape; reuse its `toLineItemDraft`), and `discountCodes` re-applied with `addDiscountCode`; write the new `cartId` into the session. The old cart stays (no deletes, JUNIOR-GUIDE rule 10). A collect-only cart in the US sets the store as the shipping address and `setShippingMethod { key: 'mcf-collect' }`.

**Delivery pricing (display only).** The hosted flow lists and prices the methods; our Review step only shows the market line "Free delivery on orders over {threshold}". `priceFor(method, cart)` is the rate for the cart currency in the zone of the cart country, `0` when the goods total (after discounts) is at or above that rate's `freeAbove` (US 75 USD, Canada 99 CAD, from the zone rates, D-029); flat rates only. The authoritative price after the hosted step is always the cart's `shippingInfo.price` (or `discountedPrice`). Delivery days text: `ShippingMethod.localizedDescription` in the session locale (Q-K-11); absent means no days text. `mcf-collect` is never offered to the shopper and never in Canada (no store zone for CA).

**Discount codes (read back).** Codes are entered on the cart page (I); the hosted Checkout takes the cart as is and does not offer code entry. K reads `cart.discountCodes[]`: `state` `MatchesCart` is shown as applied, every other state (`DoesNotMatchCart`, `NotActive`, `NotValid`, `MaxApplicationReached`, `ApplicationStoppedByPreviousDiscount`) as `not_applicable` with its own i18n reason. Saving per code: the sum of `lineItems[*].discountedPricePerQuantity[*].discountedPrice.includedDiscounts[*].discountedAmount` (times the quantity of that entry) for cart discount ids listed in the expanded `discountCode.cartDiscounts`, plus the same on `shipping[*].shippingInfo.discountedPrice.includedDiscounts` for shipping discounts. Keep `WELCOME10`, `FREESHIP`, `COFFEE15` from SEED-PLAN as your test data.

**Summary** (`buildSummary(cart)`): `subtotalCents` = sum over lines of (unit price from `lineItem.price` x quantity) before cart discounts; `discountCents` = sum of cart-level line discounts (not shipping); `shippingCents` = sum over `cart.shipping[*]` (or `cart.shippingInfo`) of `discountedPrice.value` when present else `price`, or `null` when no method is set; `taxCents` = `taxedPrice.totalTax` (null without `taxedPrice`); `totalCents` = `taxedPrice.totalGross` when present else `totalPrice` plus shipping. Tax row: "Tax {amount}"; with no `taxedPrice` yet render "Calculated in secure checkout". Never a constant rate.

**Order number and session** (`lib/checkout/order-number.ts`, `lib/ct/checkout-session.ts`): `orderNumberForCart(cartId)` = `'MC-'` + first 10 characters of the base32 (Crockford) of SHA-256(cartId), upper case. Deterministic, so a retry for the same cart can never create a second order (a duplicate `orderNumber` is rejected by commercetools: https://docs.commercetools.com/checkout/installing-checkout#set-a-custom-order-number) and the placement-unknown case can look the order up. Sessions API (not in the SDK, the one allowed raw call; add the lint exception with a comment naming this task): get a client-credentials token from `CTP_AUTH_URL` with scope `manage_sessions:{projectKey}`, then `POST https://session.{region}.commercetools.com/{projectKey}/sessions` with body `{ cart: { cartRef: { id: cartId } }, metadata: { applicationKey: CTP_CHECKOUT_APP_KEY, futureOrderNumber } }`; region derived from `CTP_API_URL` as the skill shows. Return `{ id, expiryAt }`. Session expiry: create it late (when the shopper presses "Continue to secure checkout"). Browser: `checkoutFlow({ projectKey, region, sessionId, locale, onInfo, onError, styles, skipPaymentSuccessPage: true, skipPaymentErrorPage: true })` from `@commercetools/checkout-browser-sdk`; confirm the option names in the Browser SDK page (https://docs.commercetools.com/checkout/browser-sdk#configuration-properties).

**Order reads** (`lib/ct/orders.ts`): `apiRoot.orders().withId({ ID }).get({ queryArgs: { expand: ['state', 'lineItems[*].supplyChannel', 'lineItems[*].recurrenceInfo.recurrencePolicy', 'shipping[*].shippingInfo.shippingMethod'] } })` and `apiRoot.orders().withOrderNumber({ orderNumber }).get(...)`. Docs: https://docs.commercetools.com/api/projects/orders. `subscriptions` carries only the interval from the expanded policy; N plugs its `SubscriptionNote` (next date, "setting up your subscription") into `OrderSubscriptionCard` (N's file `components/checkout/SubscriptionNote.tsx`). Mapper reads deliveries from `order.shipping[*].shippingInfo.deliveries` and from `order.shippingInfo.deliveries` (Single mode). `state` maps from `order.state.obj.key`: `mcf-order-ordered` to `ordered` etc.; anything else is `null`.

**Order state.** The hosted Checkout creates the order without any `state`. `ensureOrderState(order)`: if `order.state` is absent, `apiRoot.orders().withId({ ID }).post({ body: { version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: 'mcf-order-ordered' } }] } })`. Called from `finalizeOrder` and, as a safety net, from `GET /api/orders/[id]`; idempotent (a conflict re-reads and re-checks). Docs: https://docs.commercetools.com/api/projects/orders#transition-state. State changes after that are made by the store (Merchant Center) or by the dev script (K-08). Order `state` tracks **collection** progress; shipped progress is `shipmentState` and `deliveries`. A ship-only order stays at `ordered` and the confirmation shows no tracker (Q-K-12).

### 3.6 Validation (`lib/checkout/validate.ts`, pure, used by the forms and by every handler)

Contact, address and card validation belong to the hosted Checkout; we only validate what we collect. Each validator returns `null` or an error code; each code has an i18n message `checkout.errors.<code>`.

| Field | Rule | Codes |
| --- | --- | --- |
| pickupName | required when the bag has a collect group; trimmed, 2 to 80 chars, Unicode letters, spaces, `'`, `-`, `.` only | `pickup_name_required`, `pickup_name_invalid` |
| person | `me` or `other` | `person_invalid` |
| code (promo, display only) | after normalisation (trim, upper case) `^[A-Z0-9_-]{2,32}$` | `code_malformed` |

Client behaviour: validate on blur and on Continue; on Continue with errors, block, show the message beside the field (`FieldError`: 12.5px `--ct-danger`, x icon, `id` referenced by `aria-describedby`, `aria-invalid="true"`), and move focus to the field. The server runs the same function and returns `422 validation_failed` with `fields`. Names are personal data: never logged, never in URLs.

### 3.7 Behaviour rules

- **Totals are a projection.** `OrderSummary` renders `CheckoutState.summary` only. After the pickup step, and whenever the hosted flow reports a change (`onInfo`), the hook re-reads `GET /api/checkout` and replaces its data.
- **Stage guard.** The current stage is client state (`useCheckout` plus `useState`); the server validates prerequisites: the session needs a pickup name when a collect group exists, no blocking issue, and `checkoutBlockers` empty. Going back to Review unmounts the widget; the next Continue creates a new session.
- **Mixed bag clusters.** Lines render only inside their cluster with the marker of 3.2. A bag with collect, delivery and subscription lines shows three clusters and each line once. Under `complete-per-group` the Pay stage says "Payment 1 of 2" and names the cluster being paid.
- **Canada.** `GET /api/checkout` returns no collect group or `pickup` for a Canada session; delivery and subscription clusters only. No store picker is reachable from checkout.
- **Totals moved.** The session is created with `expectedTotalCents = summary.totalCents`. If the cart changes while the shopper is in Review (a code), the stage re-reads. The server refuses a session when the cart total differs from `expectedTotalCents` (`409 totals_changed`). Inside the hosted flow the Checkout prices the cart it holds (confirm in spike probe S11 that a new session pays the new total).
- **Placement.** `onInfo` with `code === 'checkout_completed'` (verify the code in S12) calls `POST /api/checkout/complete`, then `router.replace` to the confirmation. For redirect payment methods the browser lands on `/checkout/return`, which does the same on the server. The bag clears when `finalizeOrder` removes `cartId` from the session; the cart in commercetools is already `Ordered`.
- **Payment failure.** `onError` shows our error region (`role="alert"`) with a mapped message (`checkout.payment.declined` for payment errors, `checkout.payment.generic` otherwise; never the raw SDK payload) and keeps the shopper in the hosted flow for a retry. The bag is untouched.
- **Placement outcome unknown** (error after submit, network loss, `complete` returns `order_not_found`): before showing any retry, `POST /api/checkout/session` first looks the order up by `orderNumberForCart(cartId)` and answers `409 order_exists`; the client then goes to the confirmation. If no order exists, the page shows `checkout.placement.retry` with one button that re-reads the state and re-creates the session (same order number, so no second order).
- **Last-moment failure** (tax or discount changed, code no longer valid): the hosted flow reports an error; the page calls `GET /api/checkout`, shows what changed from `issues` and `codes`, and offers the same retry.
- **Cart issues.** `GET /api/checkout` raises `issues` from I's line warnings (unavailable item, collect out of stock at the store, price changed). `line_unavailable`, `collect_out_of_stock` and `collect_not_available` block Continue with a banner linking to `/cart`; `price_changed` shows a notice and continues.
- **Store change in Review.** F's picker updates the session store; K then calls `PUT /api/checkout/pickup` again; collect lines not available at the new store return `409 collect_out_of_stock`.
- **Confirmation access.** Server-rendered, `dynamic = 'force-dynamic'`, `Cache-Control: no-store`. Order with `customerId`: only when `session.customerId` matches, else redirect to `/account/sign-in?redirect=<this path>`. Guest order (no `customerId`): shown for anyone holding the id (a UUID) and hides phone numbers and the full billing address. The page never reads the cart. `/checkout/confirmation` without an id and an unknown id both render "No recent order" with a Shop button (HTTP 200).
- **Guest account offer.** After a guest order `finalizeOrder` sets the HTTP-only cookie `mcf_guest_email` (value the order email, `Max-Age` 3600, `SameSite=Lax`); `/account/register` reads and deletes it (J-11). Registration is verified automatically (D-032) and passes the session `anonymousId`, so the guest order attaches to the new account.
- **No email.** The header line is always "Order {number} · {email}"; for collection orders the note `order.collect.keepNumber` ("Keep this number; you will need it to collect your order."). There is no SMS and no email: the status text is `order.collect.checkLater` ("Check this page or your account for status."). No string says "sent", "emailed" or "we'll text you" (Q-K-13).
- **Blockers.** `GET /api/checkout` and `POST /api/checkout/session` call `checkoutBlockers`; N adds its guest rule there without touching K's flow.
- **Hook for subscriptions.** The hosted Checkout creates the recurring orders itself from recurring lines (N's finding); `finalizeOrder` runs `postOrderHooks` after `ensureOrderState`, each in its own `try/catch`; a failing hook is logged with the order id and never fails the order.
- **Mixed-bag strategy.** `MIXED_STRATEGY` decides (3.5). `GET /api/checkout` returns it so the UI can adapt.

### 3.8 Session fields

K adds none to the signed JWT. It reads `cartId`, `customerId`, `country`, `currency`, `locale`, `collectionStoreKey`, `anonymousId`, and clears `cartId` in `finalizeOrder`. The only new storage is the short cookie `mcf_guest_email` (3.7).

### 3.9 Widget theming

`lib/checkout/theme.ts` (client) reads the computed values of `--font-body`, `--ink`, `--accent`, `--accent-press`, `--line-2`, `--surface` and the pill and field radii via `getComputedStyle(document.documentElement)` and passes them in the SDK `styles` option under the variable names Checkout documents (https://docs.commercetools.com/checkout/customizing-checkout, https://docs.commercetools.com/checkout/custom-style); no hex literal appears in code. Locale mapping to the SDK: both `en-US` and `en-CA` map to `en` or `en-US` (the SDK supports `en`, `en-US`, `de`, and falls back to `en`); record which is used for `en-CA` in K-01 S12. The Application's countries are US and CA only.

### 3.10 i18n keys (namespaces `checkout` and `order`; `en-CA` equals `en-US` except spelling choices the owner confirms, and money is formatted by `formatMoney`)

| Key | en-US |
| --- | --- |
| `checkout.title` | Checkout |
| `checkout.steps.review` / `.pay` / `checkout.stepsLabel` | Review / Pay / Checkout steps |
| `checkout.cluster.collect` / `.delivery` / `.subscribe` | Pickup at {store} / Delivery / Subscription |
| `checkout.cluster.lineCollect` / `.lineDelivery` / `.lineSubscribe` | Collect at {store} / Delivery / Every {interval} |
| `checkout.cluster.collectCount` / `.deliveryCount` | {count} item(s) ready for collection. / {count} item(s) shipping to you. You enter the address next. |
| `checkout.delivery.freeOver` | Free delivery on orders over {threshold} |
| `checkout.pickup.change` / `.ready` / `.open` | Change / Ready in about {minutes} minutes / Open today {hours} |
| `checkout.pickup.who` / `.me` / `.meHelp` / `.other` / `.otherHelp` / `.name` | Who's picking up? / It's me / Bring a photo ID and your order number / Someone else / Add an alternate pickup person / Pickup name |
| `checkout.continue` / `.backToReview` | Continue to secure checkout / Back to review |
| `checkout.payment.secure` / `.loading` | Encrypted and secure. Card details are entered in the secure payment form and never reach Malva Coffee. / Loading secure checkout… |
| `checkout.payment.declined` / `.generic` | Your payment was not accepted. Check your details or try another card. / Something went wrong with the payment. Your bag is unchanged, please try again. |
| `checkout.payment.partOf` | Payment {n} of {total}: {cluster} (only under `complete-per-group`) |
| `checkout.placement.retry` / `.retryButton` | We could not confirm your order. Check your bag and try again. / Review and try again |
| `checkout.summary.items` / `.subtotal` / `.discount` / `.shipping` / `.tax` / `.total` | {count} items / Subtotal / Discount / Shipping / Tax / Total |
| `checkout.summary.free` / `.nextStep` | Free / Calculated in secure checkout |
| `checkout.promo.reasons.DoesNotMatchCart` / `.NotActive` / `.NotValid` / `.MaxApplicationReached` / `.ApplicationStoppedByPreviousDiscount` | Your bag doesn't meet this offer yet. / This offer isn't active. / This offer isn't valid. / This offer has been used up. / A better offer already applies. |
| `checkout.issues.review` / `.unavailable` / `.collectOut` / `.collectNotAvailable` / `.priceChanged` | Review your bag / {name} is no longer available. / {name} is not in stock at {store}. / {name} can only be collected in the US market. Remove it or switch market. / The price of {name} changed. |
| `checkout.empty.title` / `.cta` | Nothing to check out / Shop coffee |
| `checkout.errors.<code>` | one message per code of 3.6, for example `pickup_name_required`: Enter the name of the person collecting. |
| `order.confirmed` / `.numberLine` | Order confirmed / Order {number} · {email} |
| `order.track.label` / `.ordered` / `.preparing` / `.ready` / `.collected` | Collection progress / Ordered / Preparing / Ready / Collected |
| `order.track.done` / `.current` / `.upcoming` | done / current / upcoming |
| `order.collect.title` / `.bring` / `.keepNumber` / `.checkLater` | Collect at {store} / Bring a photo ID and your order number. / Keep this number; you will need it to collect your order. / Check this page or your account for status. |
| `order.ship.title` / `.estimate` / `.noTracking` / `.track` | Delivery / Estimated {window} / Tracking will appear here / Track parcel |
| `order.subscription.title` / `.every` / `.manage` | Subscription / Delivers every {interval} / Manage |
| `order.items` / `.total` / `.viewAccount` / `.keepShopping` | Your items / Total / View in My Account / Keep shopping |
| `order.guest.title` / `.cta` | Create an account with this order / Create account |
| `order.none.title` / `.cta` | No recent order / Shop coffee |

### 3.11 Accessibility

One H1 per page; steps in a `nav` with `aria-current="step"`; each cluster is a `section` with an H3 and a list of its lines; the pickup tiles are a radio group with roving tabindex; every error tied to its field and announced (`role="alert"`); focus moves to the first invalid field and, on stage change, to the new stage's heading (`tabIndex={-1}`); the summary totals are a `dl`; the hosted widget sits in a region with `aria-label` "Secure checkout" (its internal accessibility is the Checkout's, noted in SO-K-b); the tracker is an `ol` with state text, not colour only; the confirmation header icon is `aria-hidden` and the H1 is focused on load.

### 3.12 Caching

Nothing here is cached on the server (`dynamic = 'force-dynamic'`; no `unstable_cache` for cart, order or checkout). SWR keys: `keyCheckout(customerId)` (revalidate only by mutation, never on focus), `keyOrder(customerId ?? 'guest', orderId)` (refresh every 30 s while the state is not `collected`, stop on `collected`; the interval must be cleared on unmount). After `finalizeOrder` the client evicts the cart keys (G's `KEY_CART` and `keyCart(customerId)`) and `keyCheckout`.

## 4. Tasks

Branch `ws/k-checkout-and-confirmation`. Commit `ws-k: K-nn summary`. Each task is under half a day except the spike, which is time-boxed (4 hours). Run `npm run check` before ticking; `npm run build` before the last task.

- [x] **K-01 SPIKE: can the complete hosted Checkout (`checkoutFlow`, Stripe) take a mixed bag with `shippingMode: Multiple`, and a collect-only cart?** `[SKILL: commercetools-checkout]` `[SKILL: commercetools-storefront]` `[SKILL: commercetools-commerce-patterns]`. **Time-box: 4 hours.** Stop at the box, write what you have, mark the rest UNKNOWN.
  - Context already established by the documentation (re-verify, do not trust): the Checkout page "Extend the Checkout functionality" says multiple Shipping Methods need Payment Only mode "because the Complete Checkout mode handles shipping configuration internally"; the cart must be created with `shippingMode: Multiple` and `shippingMode` cannot be changed after creation; Checkout only initialises for carts created with the Carts API and does not create carts; a custom order number goes in `metadata.futureOrderNumber`; Complete Checkout creates the order itself when payment succeeds and `skipPaymentSuccessPage` / `skipPaymentErrorPage` hand the post-payment screens to the host. So the expected result for S13 is FAIL; the spike proves or disproves it and picks the fallback. What no page says: whether the hosted flow accepts a cart that already has `itemShippingAddresses`, how it prices, taxes and splits per group, what the created Payment and Order look like, and how free-shipping thresholds and discount codes behave.
  - Method: a script `storefront/scripts/spike-k.mts` run as `node --env-file=.env.local --experimental-strip-types scripts/spike-k.mts` (no new packages; it uses `lib/ct/client` through a relative import). The script and the cart and order ids it prints (ids only) are saved under `plans/evidence/K/spike/`. Test data: one US address and one Canada address (synthetic, `@example.com`), a collect line at `mcf-store-nyc-<one of the six NYC stores in SEED-PLAN>`, a ship line, and a subscribe line if the seed has one. Carts and orders cannot be deleted; they stay (D-019), tell the lead the ids.
  - Probes (record PASS, FAIL or UNKNOWN and the facts for each; a probe needing the Checkout Application is `blocked: OA-K-a` and is run as soon as it exists):

| # | Probe | PASS means | Record |
| --- | --- | --- | --- |
| S1 | Create a cart with `shippingMode: 'Multiple'`, add the two lines, `addItemShippingAddress` for the collect group, `addShippingMethod` with `mcf-collect`, `setLineItemShippingDetails` for the collect line (check the field `shippingMethodKey` exists on the target type) | No error; `cart.shipping` has the entry with price 0 | cart id, spelled field names |
| S2 | Tax: US address (state rate) and Canada address (5% GST standard, 0% food); read `taxedPrice`, `taxedShippingPrice`, `lineItems[*].perMethodTaxRate`, `taxedPricePortions` | `taxedPrice.totalGross` equals the sum of line gross plus shipping; collect shipping is 0 | numbers per market; what happens with a US address with no state rate (D-018, `changeCountryTaxRateFallbackEnabled`) |
| S3 | `shippingMethods().matchingCart()` on the Multiple cart and on a Canada Single cart | Returns `mcf-ship-*` for the ship address; record whether `mcf-collect` is returned for a store address; Canada returns no collect | the keys returned |
| S4 | Free-shipping threshold (`freeAbove`: US 75 USD, Canada 99 CAD) on a Multiple cart | Record whether the threshold is compared to the whole cart or to the group's lines | which |
| S5 | Discount codes `WELCOME10`, `FREESHIP`, `COFFEE15` on the cart | Record how `FREESHIP` applies to shipping entries and where `includedDiscounts` appear | per-entry result |
| S6 | `POST` Sessions API for (a) a ship-only Single cart, (b) a collect-only Single cart, (c) the Multiple cart (`futureOrderNumber` set) | 201 with an id | status, error body if not |
| S7 | Browser, ship-only cart (US and Canada): `checkoutFlow` with the session; fill the address, pick the delivery method, pay with the Stripe test card (K-16 explains how) | Hosted flow shows the addresses, standard delivery with the right price (free above the threshold), tax and amount equal to the cart; payment succeeds; exactly one `Payment` with `amountPlanned` equal to the total; order created | payment id, amount |
| S8 | The created Order of S7 | `orderNumber` equals `futureOrderNumber`, `taxedPrice` equal to the cart's, `shippingInfo` kept, `paymentState` | which fields are lost or changed |
| S9 | `transitionState` on that order from "no state" to `mcf-order-ordered`, then `preparing`, `ready-for-collection`, `collected` | All accepted in order; the first one works from no state | errors |
| S10 | Clone path: `shippingMode` of an existing Single cart cannot be changed; create a replacement `Multiple` cart from its lines (`sku`, `quantity`, `supplyChannel`, custom `fulfilment`) and re-apply codes. Also: sign-in merge of a Multiple anonymous cart into a Single customer cart (coordinate with J-14e) | Replacement cart equals the original in totals; merge keeps all lines | what the merge does to `shippingMode` |
| S11 | Re-create the session after a code is added in the hosted flow or the cart | The new session pays the new total (no stale amount) | amount paid |
| S12 | Hosted flow controls: `onInfo` and `onError` codes (log the `code` values only, never payloads with card or personal data), is the `<div data-ctc />` mount needed or is it full screen, do `skipPaymentSuccessPage` and `skipPaymentErrorPage` work, how Application texts relabel the pay button, which SDK locale works for `en-CA`, whether the Application can limit to the market's country | List of event codes and answers | codes |
| S13 | **Mixed bag in the complete hosted flow**: the Multiple cart of S1 (collect group pre-addressed to the store, ship lines unallocated) opened with `checkoutFlow`; does the flow collect the delivery address and method for the ship lines, allocate them, tax and charge once | Hosted flow completes with one payment; the Order keeps `shippingMode: Multiple`, `shipping[]` with both entries, `lineItems[*].shippingDetails` | what the hosted page does with the existing collect shipping entry (hides, overwrites, errors) |
| S14 | **Collect-only cart in the complete hosted flow** (US): store address and `mcf-collect` pre-set on a Single cart | Hosted flow does not force a different address or method, or the store address stays | what the shopper sees; whether the address form can be skipped or is prefilled |
| S15 | Payment Only Application (`paymentFlow`) with the Multiple cart of S1 plus an address and the standard method for the ship group, as the documentation describes | 201 session, payment succeeds, Order keeps both shipping entries | the `payment-only-for-collect` fallback evidence |

  - **Written finding:** add to `plans/PROJECT-FINDINGS.md` a section `F-K-01 Mixed bags and the hosted Checkout (<date>)` with the table above filled in, the exact request and response shapes you used (no secrets, ids only), the SDK type names and the Checkout documentation URLs checked, and the **decision** by this rule (D-033: a mixed bag must always be payable; there is no "refuse" outcome):

| Outcome | Decision (`MIXED_STRATEGY`) |
| --- | --- |
| S13 PASS (and S14 PASS or the collect cart works through the same Multiple path) | `complete-multiple`: one order, one payment, complete hosted flow for everything, as D-021 targets |
| S13 FAIL, S14 PASS, S7 PASS, and `complete-per-group` is estimated at one day or less | `complete-per-group`: the bag is split at pay time into one cart per fulfilment group, each paid in the complete hosted flow in sequence (section 4.1) |
| S14 FAIL (collect cart cannot keep the store address in the complete flow), or the box ran out before S13 and S14 | `payment-only-for-collect`: carts with a collect group use a second Payment Only Application and our own address and delivery steps (K-14c, needs OA-K-e); ship-only carts keep the complete hosted flow. Requires S15 PASS |
| S15 also FAIL | Stop and write `Q-K-02` to the lead with the evidence; do not ship a restriction on mixed bags |
| S2 FAIL for tax only (taxed price missing or wrong) with the flow otherwise PASS | Keep the chosen strategy if the cause is a data gap you can fix in the seed (tell the lead, write Q-K-02b); otherwise move to the next row |

  Do not edit `DECISIONS.md`. Set `lib/checkout/strategy.ts` to the result, write `Q-K-02` with the evidence, tell the lead in your hand-off, and continue with the chosen strategy. If OA-K-a is not done, finish S1 to S5, S9, S10 and mark S6 to S8, S11 to S15 `blocked: OA-K-a`; set the strategy to `complete-per-group` provisionally (the documentation predicts S13 FAIL) and keep K-14 open.
  - Tests: none (research). Evidence: `plans/evidence/K/spike/README.md` stating what each file proves.
- [x] **K-02 Types and validators.** Files: `lib/types.ts` additions (3.3), `lib/checkout/validate.ts`, tests. Tests: `Pickup name is required when something is collected`, `Pickup name accepts accents and apostrophes`, `Pickup name rejects markup`, `Pickup person must be me or other`, `Promo code is normalised and checked`, `Canada currency and country pair is accepted`.
- [x] **K-03 Fulfilment plan and cart actions (pure).** `[SKILL: commercetools-storefront]` `[SKILL: commercetools-commerce-patterns]`. Files: `lib/checkout/fulfilment-plan.ts`, `lib/checkout/strategy.ts`, tests with cart fixtures. Tests: `Mixed bag makes a ship group and a collect group`, `Every line belongs to exactly one cluster`, `Subscribe lines join the ship group`, `Lines from two stores make two collect groups`, `Canada bag has no collect group`, `Multiple actions run in a safe order`, `Every collect line quantity is allocated to a target`, `Collect group address is the store with the pickup name`, `Single group uses setShippingMethod`, `Collect only uses mcf-collect`, `Existing shipping entries are removed before new ones are added`, `Split plan creates one Single cart per group` (used by `complete-per-group`).
- [x] **K-04 Checkout cart module.** `[SKILL: commercetools-storefront]` `[SKILL: commercetools-checkout]`. Files: `lib/ct/checkout.ts`, `lib/mappers/checkout.ts`, `lib/checkout/summary.ts`, `lib/checkout/shipping-price.ts`, tests with a mocked `apiRoot`. Implements 3.5 (cart read, pickup preparation, `ensureCheckoutCart`, delivery note, `assertCheckoutReady`). Tests: `Address change moves tax` (summary uses the new `taxedPrice` after the hosted flow wrote an address), `Free above threshold gives price zero per market` (US 75 USD, Canada 99 CAD fixtures), `Threshold per market`, `US address without state rate has a tax portion`, `Canada food is zero rated and standard goods carry GST`, `Summary never uses a constant tax rate`, `Summary has no included-tax line in either market`, `ensureCheckoutCart clones a Single cart into a Multiple cart when the strategy needs it`, `Version conflict is retried once`, `assertCheckoutReady names what is missing`, `Collect-only cart in the US gets the store address and mcf-collect`, `Canada session never gets mcf-collect`.
- [x] **K-05 Discount codes (read back).** `[SKILL: commercetools-commerce-patterns]`. Files: `lib/ct/checkout.ts` (add), `lib/checkout/summary.ts` (`codeSavings`), tests. Codes are entered on the cart page (I), not in the hosted flow (see OA-K-d) or the cart (I); K shows them. Tests: `Free shipping code` (FREESHIP makes Standard free), `Code attached but not applicable is shown with its reason`, `Per code saving is summed from included discounts`, `Codes stack`, `Code applied in the cart is shown in the checkout summary`.
- [x] **K-06 Checkout handlers.** `[SKILL: commercetools-storefront]`. Files: `app/api/checkout/route.ts`, `pickup/route.ts`, tests calling `GET`/`PUT` with `new Request`. Tests: `Pickup is required when something is collected`, `Pickup is ignored in a Canada session`, `Validation failures return field codes`, `Cart id in the body is ignored`, `Handlers return no commercetools body on 5xx`, `Unauthenticated guest can check out`, `Two shoppers get only their own cart`, `Collect out of stock returns 409`, `State returns every line with its group key`.
- [ ] **K-07 Order number, session, complete, return, finalise.** `[SKILL: commercetools-checkout]`. Files: `lib/checkout/order-number.ts`, `lib/ct/checkout-session.ts`, `lib/checkout/finalize.ts`, `lib/checkout/post-order.ts`, `app/api/checkout/session/route.ts`, `complete/route.ts`, `app/checkout/return/route.ts`, `proxy.ts` matcher, `.env.example`, tests (mock `fetch` for the Sessions API only). Tests: `Order number is deterministic per cart`, `Session is refused when the total moved` (409 `totals_changed`), `Session is refused when the pickup is missing` (`checkout_not_ready`), `Existing order is reported instead of a second session` (`order_exists`), `Placement outcome unknown looks the order up by number`, `Finalize is idempotent`, `Finalize clears the cart id and sets the order state`, `Failing post-order hook does not fail the order`, `Return route redirects to the order locale`, `Return route ignores a locale in the query`, `Return route with unknown order lands on No recent order`, `Guest email cookie is HttpOnly and short`, `Session body names the Application key and the future order number`. Mark live behaviour `blocked: OA-K-a`.
- [x] **K-08 Orders module and dev state tool.** `[SKILL: commercetools-storefront]`. Files: `lib/ct/orders.ts`, `lib/mappers/order.ts`, `app/api/orders/[id]/route.ts`, `seed/src/scripts/order-ops.ts` and its `package.json` script, tests. The seed script: `npm run seed:order -- state --order-number MC-... --to preparing|ready-for-collection|collected --dry-run`, refuses a project key other than `EXPECTED_PROJECT_KEY` (`spec-test-b2c-food`), only transitions along the seeded state chain, prints the new state. Tests: `Ready` (mapper turns `mcf-order-ready-for-collection` into `ready-for-collection`), `Unknown state key maps to null`, `Mixed order has collect and ship parts`, `Shipped line with no tracking has an estimate and no parcel`, `Subscription line shows the interval`, `Revisited later` (mapper works from the order alone), `Order of another customer returns 404 identical to unknown`, `ensureOrderState sets ordered once`, seed script `order-ops refuses a foreign project key`, `order-ops refuses skipping a state`.
- [ ] **K-09 Checkout hook and summary UI.** Files: `hooks/useCheckout.ts`, `lib/cache-keys.ts` (append `keyCheckout`), `components/checkout/OrderSummary.tsx`, `FieldError.tsx`, tests. Tests: `Summary is a projection of the last response`, `Applied code pills are read from the cart`, `Free shipping shows Free`, `Shipping says calculated in secure checkout before an address exists`, `Summary shows tax as its own row and no included-tax line`, `Summary line list scrolls at 200px` (class check), `Each summary line carries its fulfilment marker`.
- [ ] **K-10 Review stage UI.** Files: `components/checkout/StepIndicator.tsx`, `FulfilmentCluster.tsx`, `ClusterLine.tsx`, `CheckoutPage.tsx` (shell and Review stage), `app/[locale]/checkout/page.tsx`, messages. Tests: `Mixed bag shows one cluster per fulfilment group and each line inside its cluster`, `Each line shows the collect, delivery or subscription marker`, `No line appears outside a cluster or in two clusters`, `Going back` (done stage is a button), `Later stage is not clickable`, `Collect only` (no delivery cluster), `Delivery only (no collect cluster)`, `Canada bag shows no collect cluster and no store picker`, `Canada free delivery line says 99 CAD and US says 75 USD`, `Empty bag shows Nothing to check out`, `Subscription cluster shows the interval`.
- [ ] **K-11 Pickup card and issues UI.** Files: `PickupLocationCard.tsx`, `DeliveryNote.tsx`, `CheckoutIssues.tsx`, tests. Tests: `Someone else collects` (pickup name required), `Pickup name is prefilled for a member`, `Change store re-checks collect lines`, `Ready minutes come from the store data`, `Collect out of stock blocks Continue`, `Collect line in a Canada session shows collect_not_available`, `Missing pickup name focuses the field`.
- [ ] **K-12 Pay stage: hosted Checkout.** `[SKILL: commercetools-checkout]`. Files: `components/checkout/HostedCheckout.tsx`, `lib/checkout/theme.ts`, `package.json` (add `@commercetools/checkout-browser-sdk`, listed in the checkout skill), tests with the SDK mocked. Tests: `Payment failure` (error region, bag untouched, retry possible), `Placement` (completed event calls complete and routes to the confirmation), `Totals moved before the session` (a changed total requests a new session, `totals_changed` handled), `Placement outcome unknown shows one retry path`, `Hosted success and error pages are skipped`, `Widget mount point exists`, `Locale is mapped for the SDK for en-US and en-CA`, `Theme reads tokens, no hex in code`, `Back to review unmounts the widget and a new session is created on return`, `Pay stage under complete-per-group names the payment n of total`.
- [ ] **K-13 Confirmation page.** Files: `app/[locale]/checkout/confirmation/[orderId]/page.tsx`, `confirmation/page.tsx`, `components/order/*`, `hooks/useOrderStatus.ts`, messages, tests. Tests: `Order placed` (reference, totals and next steps from the order, not the cart), `Guest` (email shown, account offer), `Status progress` (each state gives done and active nodes; `collected` gives four done), `Shipped line` (estimate and "Tracking will appear here"), `No recent order`, `Revisited later`, `Member order needs the owning session`, `Confirmation never claims an email or text was sent`, `Canada order shows the delivery card and no tracker`, `Polling stops at collected`.
- [ ] **K-14 Mixed-bag mechanism for the spike result** (do only the one the spike chose; if `complete-multiple`, tick as not needed and note it).
  - **K-14a `complete-multiple`**: wire `buildFulfilmentActions` and the S13 findings (what the hosted page does with the pre-set collect entry). Tests: `Mixed order under complete-multiple pays once for both clusters`, `Collect entry survives the hosted address step`.
  - **K-14b `complete-per-group`**: `lib/checkout/split.ts` creates one cart per group (Single mode, group lines, copied codes only on the first cart, Q-K-02c), order numbers `<base>-A`, `<base>-B`; Pay stage shows "Payment 1 of 2" with the amount per order and names the cluster; `finalizeOrder` for each; confirmation shows all linked orders by the shared base number, each line still under its cluster. Tests: `Mixed order under the fallback creates two linked orders`, `Second payment failure leaves the first order intact and says so`, `Retry never duplicates an order`, `Every line stays in its cluster on the confirmation`.
  - **K-14c `payment-only-for-collect`**: for carts with a collect group, own steps Details (contact, address when shipping), Delivery (standard method, pickup person) and the Payment Only widget (`paymentFlow`) of the second Application (`CTP_CHECKOUT_PAYMENT_APP_KEY`, OA-K-e); the earlier version of this plan (git history of this file before 2026-10-21, sections 3.2 to 3.6) holds the step designs, validators (US and Canada address rules: ZIP `^\d{5}(-\d{4})?$`, Canadian postal code `^[A-Z]\d[A-Z] ?\d[A-Z]\d$`, states and provinces lists) and tests to reuse. Tests: `Mixed order under payment-only-for-collect pays once`, `Ship-only cart still uses the complete hosted flow`, `Canadian postal code is checked`, `Province is required for Canada`.
- [ ] **K-15 Catalogue parity.** Files: `messages/*.json`. A script-free check: the `en-US` and `en-CA` catalogues have identical keys for `checkout` and `order` (the existing lint rule fails otherwise). Tests: `Catalogues have the same keys`.
- [ ] **K-16 Browser run with a test card, evidence, hand-off.** Run sections 6 and 7; if the card step cannot be automated record why and rely on the M rows; save evidence; add todo rows; `npm run build`; set `Ready for review`. `blocked: OA-K-a` for the hosted parts until the Checkout Application exists.

### 4.1 Fallback behaviour (for K-14)

`complete-per-group`: the bag is one bag in the UI; the split happens at the Pay stage only; the Review stage is identical. Payment runs per group in sequence with its own session (`futureOrderNumber` `<base>-A` and `-B`), the collect group first. If payment A succeeds and B fails, order A stands, the page says "Your collection order is placed. Your delivery order still needs payment" and offers B again; the bag then holds only group B. `payment-only-for-collect`: no split; the same bag is paid once through the Payment Only Application with our own steps. In every strategy a mixed bag can be paid; none is an error state.

## 5. Scenarios checklist

Tick only with the named test or recorded evidence. "Browser" means a recorded check in section 6.

`design-checkout-page`
- [ ] Going back: `Going back` (K-10)
- [ ] Collect only (US): `Collect only` (K-06, K-10)
- [ ] Someone else collects: `Someone else collects` (K-11)
- [ ] Free shipping code: `Free shipping code` (K-05)
- [ ] Payment failure: `Payment failure` (K-12); browser R12 with the decline card (or M-K-03)
- [ ] Placement: `Placement` (K-12, K-07); browser R11
- [ ] Mixed bag marked by cluster: `Mixed bag shows one cluster per fulfilment group and each line inside its cluster`, `No line appears outside a cluster or in two clusters` (K-10); browser R16
- [ ] Canada is delivery only: `Canada bag shows no collect cluster and no store picker` (K-10), `Canada session never gets mcf-collect` (K-04); browser R18
- [ ] Hosted Checkout owns address, delivery and payment (D-039): `Hosted success and error pages are skipped` (K-12); browser R10
- [ ] Place order is the only commit action (the hosted pay button): `Widget mount point exists` (K-12)
- Removed by D-039: the prototype's own Details, Fulfilment and Payment steps, our address and promo forms (promo code entry stays on the cart page, I; K only reads the result back, K-05).

`design-order-confirmation-page`
- [ ] Guest: `Guest` (K-13)
- [ ] Status progress: `Status progress` (K-13); browser R15
- [ ] Shipped line: `Shipped line` (K-13)
- [ ] No recent order: `No recent order` (K-13)
- [ ] No email claim (D-032): `Confirmation never claims an email or text was sent` (K-13)

`checkout`
- [ ] Address changes the total: `Address change moves tax` (K-04); browser R7
- [ ] Totals moved before the session: `Totals moved before the session` (K-12, K-07)
- [ ] Placement fails at the last moment: `Placement outcome unknown shows one retry path` (K-12), `Retry never duplicates an order` / `Existing order is reported instead of a second session` (K-07, K-14b)

`checkout-page`
- [ ] Address change moves tax: `Address change moves tax` (K-04)
- [ ] Delivery price per market: `Free above threshold gives price zero per market` (K-04)

`order-confirmation-page`
- [ ] Order placed: `Order placed` (K-13)
- [ ] Placement outcome unknown: `Placement outcome unknown looks the order up by number` (K-07)
- [ ] Revisited later: `Revisited later` (K-08, K-13)

`fulfilment-and-availability-model` (parts owned by K)
- [ ] Mixed order: `Mixed order has collect and ship parts` (K-08) plus spike evidence S13 and S8 (or K-14b / K-14c tests)
- [ ] Ready: `Ready` (K-08), `Status progress` (K-13), browser R15
- [ ] Threshold per market: `Threshold per market` (K-04)
- [ ] US address without state rate: `US address without state rate has a tax portion` (K-04); browser R8
- [ ] Canada tax: `Canada food is zero rated and standard goods carry GST` (K-04)

## 6. Browser recipe (Chrome DevTools MCP)

Prerequisites: `npm run dev`, live credentials in `storefront/.env.local`, the strategy chosen in K-01, `OA-K-a` for R9 onwards. Test shoppers: a guest, and a member you register through J (`qa-k-<date>@example.com`, synthetic password; registration is verified automatically, no email). Data: US market (`/en-US`), one NYC store from SEED-PLAN (use the first); Canada market (`/en-CA`) is delivery only. Evidence: `plans/evidence/K/<step>-<what>-<375|1440>.png`. For every step take a snapshot and check `list_console_messages` (no errors) and `list_network_requests` (no failed requests; the only allowed 4xx are the deliberate ones named below). Never save card data or personal data in evidence: crop screenshots before the card field is filled or capture only after the widget shows the masked value.

| Step | Do | Expect |
| --- | --- | --- |
| R1 | Add one machine (ship) and one pod box (collect at the NYC store) as a guest using the I UI; open `/en-US/checkout` at 1440x900 | Step indicator with Review active; a Pickup cluster holding the pod box and a Delivery cluster holding the machine, each line with its marker; summary with two lines |
| R2 | Same at 375x812 | One column, summary after the clusters, no horizontal scroll |
| R3 | Press "Continue to secure checkout" with the pickup name empty | Pickup name error, focus on the field; no request to the session route |
| R4 | Choose "Someone else" and type a name with markup characters | Specific message; with a valid name the stage advances |
| R5 | Valid pickup name, Continue | `PUT /api/checkout/pickup` 200, then `POST /api/checkout/session` 200; the hosted Checkout loads in the Pay stage with no console errors |
| R6 | Change the store with the picker while in Review | Pickup card shows the new store; lines re-checked; a line out of stock there shows the banner |
| R7 | In the hosted flow enter a US address, then go back to Review and forward again with another state | Summary tax and total change with the address (compare the numbers; save both screenshots) |
| R8 | Use a US address in a state without a seeded rate (for example Wyoming) | Tax row is non-zero from the country rate (D-018) |
| R9 | Apply `WELCOME10` in the hosted flow (or the cart), then `FREESHIP` with a delivery bag | Discount row and code pill after the read-back; shipping Free |
| R10 | Pay stage on a ship-only cart | Hosted flow shows address, standard delivery with the price (free at or above 75 USD), payment; back to review works |
| R11 | Pay with the Stripe success test card (see K-16 notes) | Our confirmation opens (hosted success page skipped), header "Order confirmed", number `MC-...` in mono, totals equal the summary; bag empty on reload of `/cart` |
| R12 | Repeat with the decline test card | Our error region, hosted flow still usable, bag intact |
| R13 | Reload the confirmation URL; open it in a private window (guest order) and, for the member order, in a private window | Guest order renders from the order; member order asks to sign in |
| R14 | Place a collect-only order (US) | No delivery cluster; confirmation has the collection card, tracker with Ordered active; no sentence about email or text |
| R15 | Run `npm run seed:order -- state --order-number <n> --to ready-for-collection` (then `collected`); reload the confirmation and wait 30 s on the open page | Tracker: Ready active with Ordered and Preparing done; later all four done; polling stops |
| R16 | Mixed order with collect, ship and subscribe lines (strategy from K-01), signed in | Three clusters, every line once and marked; payment(s) per strategy; confirmation shows collection and delivery cards; read the order(s) back (section 7) |
| R17 | Member checkout | Pickup name prefilled from the account; the hosted flow knows the customer where the Checkout supports it |
| R18 | Sign out, switch to `/en-CA`, add a ship line, open checkout | No collect cluster, no store picker, delivery note "Free delivery on orders over $99.00 CAD" style from data; hosted flow in Canada: CAD amounts, GST on standard goods, 0% on food; a delivery bag at or above 99 CAD shows free standard delivery; one order placed |
| R19 | Tab through the Review stage | Visible focus ring on each control; pickup tiles arrow-navigable; step buttons correct |

## 7. Self-verification with data

No owner involvement.
- After R11, R14, R16, R18 read the orders back with the commercetools MCP (project `spec-test-b2c-food`, server `food-service`) or a read-only script (ids, keys and numbers only): `orderNumber` equals the displayed number, `paymentState`, `taxedPrice` equals the summary total, `shippingMode`, `shipping[*].shippingKey`, `lineItems[*].custom.fields.fulfilment`, `lineItems[*].supplyChannel.id` for collect lines, `state.obj.key` is `mcf-order-ordered`, the collect address carries the pickup name, the Canada order has `country` CA and currency CAD with no collect line. Save as `plans/evidence/K/order-<n>.json` (no email, no address lines beyond country and city).
- Compare each summary shown in the browser with the cart read through the API (numbers equal).
- Read the payment for the order and check one payment with `amountPlanned` equal to the total (mixed order under `complete-per-group`: one payment per order).
- Run `cd seed && npm run verify` (still passes) and the state tool in `--dry-run` first.
- Confirm no card, email or address text appears in the dev server log (`grep` for the test email and `4242`; save "0 matches").
- Write `plans/evidence/K/README.md` saying what each file proves.

## 8. Manual testing and owner items

Rows are also in `plans/notes/todo-K.md`. First automate what you can: the card fields live in a cross-origin iframe, so first try `take_snapshot` (it may list the card inputs and you can `fill` them); if it does not, click the payment area to focus, use `press_key` Tab to reach the card number field, and `type_text` the digits, Tab, expiry, Tab, CVC, Tab, postcode. Give this 30 minutes, then record the outcome in `PROJECT-FINDINGS.md`. 3-D Secure challenges and real wallets are not automatable; those are the M rows.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-K-a | Owner | Before K-01 probes S6 to S8, S11 to S15 and K-12 | 1. In the Merchant Center create a Checkout **Application of type Complete Checkout** (D-039). 2. Install the Stripe payment connector in test mode and add it as a payment integration (OA-04). 3. Select countries US and CA, allow all origins for dev. 4. Put the Application key in `storefront/.env.local` as `CTP_CHECKOUT_APP_KEY` and give the API client `manage_sessions` and `manage_orders`. | Application and connector exist; the hosted steps of K are unblocked | TODO |
| OA-K-b | Owner | Before R11 and for redirect payment methods | 1. In the Application's general settings set the payment return URL `http://localhost:3000/checkout/return` (and the Netlify URL when hosting exists, OA-05). 2. Add the same origins to Origin URLs. | Return URL saved; only one per connector | TODO |
| OA-K-d | Owner | Before SO-K-b | 1. In the Application's texts and labels set the pay button text to "Place order". 2. Leave the Discount Code function off (promo codes live on the cart page). 3. Add the terms and privacy user agreements once P has the pages. 4. Enable the card method. | Hosted flow shows "Place order", a discount code field and the agreements | TODO |
| OA-K-e | Owner | Only if K-01 picks `payment-only-for-collect` | 1. Create a second Application in Payment Only mode with the same connector. 2. Put its key in `storefront/.env.local` as `CTP_CHECKOUT_PAYMENT_APP_KEY`. | Second Application exists | TODO |
| SO-K-a | Owner | Before release | 1. Read the delivery-time text and the collection "Ready in about N minutes". 2. Approve or change the copy (the days text comes from the shipping methods' descriptions, the minutes from the store data). | Copy approved | TODO |
| SO-K-b | Owner | Before release | 1. Compare the Review stage and the confirmation with `screenshots/checkout-step1.png`, `checkout-step2.png` at 375 and 1440 px. 2. Judge the hosted Checkout's look and its deviation from the prototype's three steps. | Fidelity accepted or changes listed | TODO |
| M-K-01 | Owner | Before release | 1. On a real phone place an order with the Stripe success test card in `/en-US` and another delivery order in `/en-CA`. 2. Note whether the keyboard hides the hosted fields. | Orders confirmed; fields usable | TODO |
| M-K-02 | Owner | Before release | 1. Pay with the Stripe 3-D Secure test card. 2. Complete the challenge. | Redirect returns to `/checkout/return` then our confirmation | TODO |
| M-K-03 | Owner | Only if the decline card cannot be automated | 1. Pay with the Stripe decline test card. 2. Retry with the success card in the same session. | Error shown, retry works, one order only | TODO |
| M-K-04 | Owner | Before release | 1. Pay with a wallet (Apple Pay or Google Pay) if the connector offers it. | Order confirmed or the method is hidden | TODO |
| M-K-05 | Owner | After the order exists | 1. In the Merchant Center open the order. 2. Change its state to Preparing, Ready for collection, Collected (Orders, Order details, State). 3. Reload the confirmation page. | The tracker follows each change | TODO |
| M-K-06 | Owner | Before release | 1. Place a mixed order (machine to ship, pods to collect, a subscribed coffee) in the US. 2. In the Merchant Center check payments, shipping entries and tax. 3. Confirm each cart line was marked in its cluster before payment. | Matches the decision recorded from K-01 | TODO |

## 9. Questions

Each is also in `plans/notes/questions-K.md` (format `Q-K-n | question | default | blocks? | Status`). The default is built.

| ID | Question | Default built | Blocks? |
| --- | --- | --- | --- |
| Q-K-01 | The complete hosted Checkout (D-039) has its own pay button and pages; the design's three steps and "Place order" button are replaced. Accept? | Answered by D-039: Review stage ours, the rest hosted; the pay button is labelled "Place order" through Application texts (OA-K-d); the owner judges fidelity in SO-K-b. | No |
| Q-K-02 | Mixed bags (required, D-033): which mechanism after the spike? Should G/I create every cart as `shippingMode: Multiple`? | Mechanism from K-01's rule (`complete-multiple`, `complete-per-group`, `payment-only-for-collect`). G's `CART_SHIPPING_MODE` stays `'Single'`; K clones into a `Multiple` cart when the strategy needs it. Reason: with `Multiple` the cart page shows no tax estimate until every quantity is allocated, which would break `design-cart-page` Tax presentation. | Blocks K-03 to K-07 detail only |
| Q-K-02b | If only tax fails under Multiple: fix data or fall back? | Fix data in the seed and keep the strategy. | No |
| Q-K-02c | Under `complete-per-group`, on which order do discount codes apply? | First order only. | No |
| Q-K-03 | Can the hosted pay button be hidden or triggered from our page? | Not assumed; probe S12. | No |
| Q-K-04 | Order number format? | `MC-` plus 10 base32 characters derived from the cart id (deterministic, so retries cannot duplicate). | No |
| Q-K-05 | What if an order exists but `transitionState` to `mcf-order-ordered` fails? | Log, show the order with no tracker, retry on the next read. | No |
| Q-K-06 | May the shipping country differ from the market? | No: the shipping country is the session country (cart currency and prices depend on it); the Application is limited to the market's country if S12 shows it can be. | No |
| Q-K-07 | Billing address and pickup identity for collect orders? | We ask a pickup name on Review; the hosted flow collects the rest. | No |
| Q-K-08 | Should "Check out as guest" detach the order from the signed-in customer? | Not applicable under the hosted flow: a signed-in cart stays the customer's; guests use a guest cart. | No |
| Q-K-09 | Save a new checkout address to the account? | Whatever the hosted flow does; L's address book is the place to manage addresses. | No |
| Q-K-10 | Where does a guest's email travel to the register page? | HTTP-only cookie `mcf_guest_email`, 1 hour, deleted on read. Never a URL. | No |
| Q-K-11 | Where do delivery-day texts come from? | `ShippingMethod.localizedDescription` for `en-US` and `en-CA` (seed change): "2-4 business days" style for standard. No text if absent. | No |
| Q-K-12 | Tracker mapping for `ordered`, and for ship-only orders? | `ordered` = Ordered active (spec, not the prototype). Ship-only orders (all Canada orders) show no tracker, only the delivery card. | No |
| Q-K-13 | Notification promises (emailed receipt, SMS when ready)? | None anywhere (D-032); copy says check the page or account. Answered. | No |
| Q-K-14 | Guest order page access? | Anyone holding the order id sees it with phone and billing hidden; member orders need the owning session. | No |
| Q-K-15 | Idempotency on the placement path if `complete` is called twice? | `finalizeOrder` is idempotent by order number. | No |
| Q-K-16 | Express delivery: does the hosted flow offer it next to standard? D-034 says standard carrier only. | Seed standard and express as methods; the hosted flow lists what matches; no carrier choice, no slots. Owner may drop express from the seed. | No |

## 10. Definition of done

- K-01 finding written in `plans/PROJECT-FINDINGS.md`, strategy set in `lib/checkout/strategy.ts`, the decision told to the lead; probes that were blocked are listed with `blocked: OA-K-a`.
- All tasks ticked, each with a passing `check` commit; `npm run build` passes.
- Every scenario in section 5 ticked with a named test or recorded evidence.
- Browser recipe verified at 375 and 1440 px in `/en-US` and `/en-CA`, console and network clean, evidence and `README.md` in `plans/evidence/K/`. One order placed end to end through the hosted Checkout with the Stripe test card (or the reason it could not be automated recorded, with the M rows in place), and a mixed bag paid under the chosen strategy. This closes the gate "After wave 8".
- Section 7 read-backs saved; no card, email or address text in logs.
- Owner rows in `plans/notes/todo-K.md`, questions in `plans/notes/questions-K.md`.
- `seed:order` works and refuses a foreign project key.
- No `TODO` or `FIXME` without an `IDEAS.md` entry; `node plans/verify-plan.mjs` passes; `STATUS.md` shows `Ready for review`.
