<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream O: Checkout (commercetools Checkout, full hosted flow, Stripe behind it)

Status: DRAFT v2 (2026-10-12, rewritten after the owner interview: Q-012). Primary spec: `cs/design-checkout-page`. App: `b2b2c-automotive/storefront/`. Paths are relative to `b2b2c-automotive/storefront/` unless they start with `plans/`.
Skills for this workstream: `commercetools-checkout` (read it fully first, `references/payment-only-mode.md`; it documents `paymentFlow` in depth and `checkoutFlow` by pointer, so confirm every `checkoutFlow` detail with its docs-search script before coding), `commercetools-storefront`, `commercetools-platform`, `commercetools-integrations` (Stripe payment connector section), `commercetools-commerce-patterns` (recurring orders).

## 1. Goal

The cart's Checkout button opens `/{locale}/{storeKey}/checkout`, a thin page that creates a **commercetools Checkout session** for the cart and mounts the **complete hosted checkout** (`checkoutFlow` from `@commercetools/checkout-browser-sdk`). commercetools Checkout collects contact details, addresses, the shipping method (from the cart's matching methods) and payment through the **Stripe connector**, shows the user agreements, creates the **order** itself and redirects to one registered return URL. The storefront then resolves the order, gives it its number, and sends the shopper to the confirmation page (P). Subscription lines in the cart become **recurring orders** through the same flow where the connector supports it (Q-Q06). The storefront never sees card data, never creates orders for shoppers, and has no payment provider of its own.

What is **removed** by the owner answers: the pay-at-pickup and invoice-placeholder default, the offline provider and the `PAYMENT_PROVIDER` switch, our own contact, delivery, address and payment sections, the territory block (Q-O03: no territory blocking at checkout), and any SMS or email (Q-P01: no mobile alerts are sent, so no "Mobile (pickup alerts)" field).

## 2. Depends on

N (cart, delivery preset, `rescopeCartToBranch`, subscription lines, sign-in, `useAccount`), I (`getBranchScope`), and transitively M, L, J, G. P consumes the order created here.

Owner prerequisite: **OA-05, now a real owner action** (section 11): Stripe test account, Stripe connector installed in the commercetools project, Complete Checkout Application configured, `CTP_CHECKOUT_APP_KEY` given to Claude. This plan does not wait for it: everything except live hosted checks is built and tested against mocks, and a dev-only completion helper (O-08) lets P and Q be verified before OA-05 is `DONE`.

## 3. Specs and requirements implemented

Primary: `openspec/specs/consumer-storefront/design-checkout-page/spec.md`. Because checkout is hosted, most scenarios are delivered by commercetools Checkout and verified live, not by our own components. The spec text needs a deviation note (the lead updates it): the three numbered sections and the "Place order · {total}" button are the hosted widget's own layout, themed through the SDK `styles` option.

| Requirement title (verbatim) | Scenarios | How it is met | Tasks |
| --- | --- | --- | --- |
| Single page, three numbered sections | Incomplete section | The hosted `checkoutFlow` page validates before payment; verified live. Our page adds the pickup panel and a Back to cart link. | O-04, O-10 |
| Contact | Guest checkout | Hosted page collects email for guests; signed-in customers' email and saved addresses are used by the session when the Sessions API supports it (O-00 check), else the shopper re-enters. | O-03, O-10 |
| Delivery by pickup or shipping | Pickup details; Address validation | The cart presets pickup or ship (N-04); Checkout shows the matching methods and validates addresses; our page shows the branch's address, hours and "Bring photo ID" for pickup. | O-03, O-04, O-10 |
| Payment | Declined payment | Stripe through the connector; a declined card leaves the cart `Active` and shows the hosted error; verified with the Stripe test decline card. | O-10 |
| Summary and placement | Total on the button; Double submit | Hosted. Exactly-once order creation is Checkout's; our return handler is idempotent (O-05) and is unit tested. | O-05, O-10 |

Gaps decided here: no billing address of our own, no express wallets (`expressPayment` is not used), no order-review step, terms are a **user agreement** configured in the Application (mandatory checkbox) instead of our `TermsCheckbox`.

Secondary: `bootstrap-and-structure` ("BFF boundary and helpers", "Client state", "Environment and least privilege"); `design-account-area` › "Addresses..." › "Default address" (prefill is best effort, see Contact).

## 4. Decisions already taken (do not reopen)

| # | Decision | Source |
| --- | --- | --- |
| D1 | **Checkout mode is `checkoutFlow` (complete hosted checkout) with the Stripe connector behind it** (owner answer Q-012). Not `paymentFlow`, not `expressPayment`. | owner-answers Q-012 |
| D2 | **No payment provider interface.** The offline, invoice and decline doubles are deleted from the plan; the only seams are `lib/checkout/session.ts` (Sessions API, mocked with `fetch` in tests) and `lib/checkout/return.ts`. `PAYMENT_PROVIDER` does not exist. Nothing in the repo may create a Payment object for a shopper (`grep -rn "payments().post" lib app` is empty). | owner-answers Q-012 |
| D3 | The session is created server-side: `POST https://session.{region}.commercetools.com/{projectKey}/sessions` with `cart.cartRef.id` and `metadata.applicationKey = CTP_CHECKOUT_APP_KEY`, bearer token with the `manage_sessions` scope, region derived from `CTP_API_URL` (no `CT_REGION`). `projectKey` and `region` go to the browser in the route response, so the client needs no `NEXT_PUBLIC_*` variable. The session is created as late as possible (when the page mounts or the shopper presses Retry), because sessions expire. | skill `commercetools-checkout` `payment-only-mode.md` |
| D4 | The widget mounts in `<div data-ctc />` through a dynamic import of `checkoutFlow`, with a single `useEffect` guard against double init, `locale` from the route (never hard-coded), `onInfo` code `checkout_completed` navigating to `/checkout/return?orderId=...` when the SDK gives an order id (else Checkout's own redirect does it), `onError` showing a plain message. Styling uses the SDK `styles` CSS variables filled **at runtime from the store's computed theme tokens** (`getComputedStyle(document.documentElement)` of `--color-action`, `--font-ui`, `--radius-md`, ...), so no raw colour or font appears in the code and the reseller theme reaches the hosted page. | skill `commercetools-checkout` Step 2, Step 5; design.md decision 9 |
| D4a | **One payment return URL for the whole Application**, because the Application and the connector hold only one: `https://<origin>/checkout/return` (locale-less, store-less). The route `app/checkout/return/page.tsx` reads `?orderId=` (or `?orderNumber=`), loads the order with the project client, takes `order.store.key` and `order.locale`, and redirects to `/{locale}/{store}/checkout/confirmation/{orderNumber}`. `proxy.ts` (G) must let `/checkout/return` through without locale redirect: add the path to its matcher exclusions with a test (report it in the PR). | skill ("`paymentReturnUrl` must be registered", one per Connector) |
| D5 | **The order is created by commercetools Checkout, not by the storefront.** There is no `createOrderFromCart`. The storefront's job after the redirect is idempotent: load the order, apply the buyer rule (P), make sure it has an order number, mint the guest access token, clear `cartId`. | skill ("order is created by commercetools automatically") |
| D6 | **Order number** (changes Q-O05): if the order has `orderNumber` use it; otherwise `ensureOrderNumber(order)` assigns `MA-` plus 8 Crockford base32 characters of `sha256(orderId)` with the order update action `setOrderNumber` (version retry; `DuplicateField` retries with salt 1, 2); reading it again is a no-op. Confirm at O-00 with `commercetools-oas-schemata` (`api-Order-write`) that `setOrderNumber` is allowed on an order without a number, and with the docs whether Checkout can set the number itself; if Checkout can, use that and delete `ensureOrderNumber`. | this plan; Q-O05 |
| D7 | **No territory blocking** (owner answer Q-O03). No `assertCartDeliverable`, no `store.countries` check, no `COUNTRY_NOT_SERVED`, no per-line "still in the selection" check at checkout. The only country limit is the Application's configured country list (owner configuration in OA-05, not storefront logic). Withdrawn products are already absent from the store (L, M), and the cart removes lines it can no longer price (N). | owner-answers Q-O03 |
| D8 | **Subscriptions are sold through the same hosted flow** (owner answer Q-Q06). A cart with recurring lines is a "recurring cart": Checkout charges the first payment, stores the payment method (needs the Stripe connector's Stored Payment Methods capability) and commercetools creates the Recurring Order. Session creation is refused with 422 `subscriptions-unavailable` when the cart has a recurring line and `SUBSCRIPTIONS_PURCHASE_ENABLED=false` (set at OA-05 time when the installed connector cannot do recurring); the cart then explains it. Docs: "Recurring Orders in Checkout" (gift cards and split payments are not available for recurring orders, only one payment method is charged, automated reversals need the original Checkout application). | owner-answers Q-Q06; docs |
| D9 | Cart preparation before the session (`prepareCartForCheckout`): reload the cart, refuse empty or capped-to-zero carts, `recalculate` (D11 of N), write cart custom fields `pickupBranchKey` (the selected branch, always), `fitVehicleLabel` (when a vehicle is active, label from J) and, outside production, `isTest = true` (custom type `malva-checkout`, seed-owned, shared by cart and order so the fields are copied to the order). The cart's delivery choice stays a preset (N D19). | N D19; this plan |
| D10 | **Custom types are owned by the seed** (`seed/src/data/custom-types.ts`, workstream D/F; O creates, alters and re-creates none, never ad hoc). Used here: `malva-checkout` (resources `cart` and `order`, one type so cart fields copy to the order: `pickupBranchKey` String, `fitVehicleLabel` String, `isTest` Boolean, `deliveredAt` DateTime set later by the portal and read by Q for the 30-day return window; also `mobile`, `salesChannel`, `costCentre`, `placedOnBehalfBy`, which other workstreams use). `malva-line` (line item: `vehicleFitmentKey`, `vehicle`, `fit`, `parentLineItemId`, written by N). Also seeded for P, Q, W: `malva-customer` (`garage`, `preferredBranchKey`, `mobile`, `marketingConsent`, `marketingConsentAt`, `lastActiveAt`) and `malva-return-item` (resource `order-return-item`: `returnNumber`, `status`, `reason`, `refundCents`, `rejectReason`). **`mobile` exists on `malva-checkout` in the seed but O never writes it**: no mobile alerts are sent (Q-P01), so the hosted checkout has no pickup-alert field of ours (unresolved against the seed, see the report; the seed field may stay unused). Question Q-O04. | seed `custom-types.ts`; skill `commercetools-platform`; owner-answers Q-P01 |
| D11 | Orders created from a non-production environment carry `custom.isTest = true` (D9); `scripts/dev-delete-test-orders.ts` refuses anything without it. | precedent `b2b-manufacturing` cleanup scripts |
| D12 | Hooks only in components; the Checkout SDK is imported only in `components/checkout/CheckoutWidget.tsx`; secrets stay server-only; the token for the Sessions API is never logged. | bootstrap spec |
| D13 | Refunds are not a storefront feature: the portal (W) refunds through the Checkout Transactions API or the Merchant Center against the Stripe payment (note for W; nothing here). | owner-answers Q-012 |
| D14 | Hosted Checkout is a cross-origin widget: Chrome DevTools MCP may not be able to fill it. If the browser recipe cannot drive the widget, Claude records that, the owner or a developer runs the test-card order (M-O01), and Claude verifies the result with the MCP read tools. | this plan |

## 5. Before you start (read-only; never wait silently)

1. `npm run check` green; N is merged (cart page, `rescopeCartToBranch`, subscription lines, `/api/auth/login`).
2. **O-00 docs and schema checks (write the findings in section 12):** run the `commercetools-checkout` docs-search script for (a) `checkoutFlow` options (`projectKey`, `region`, `sessionId`, `locale`, `styles`, `onInfo`, `onWarn`, `onError`, any logo or order-confirmation option) and the `<div data-ctc />` rule, (b) what a Sessions API body for the complete checkout accepts beyond `cart` and `metadata` (customer email, addresses), (c) how a preset shipping method and address on the cart are shown, (d) Checkout Application settings for Complete Checkout (countries, origin URLs, payment return URL, discount code toggle, user agreements), (e) Stripe connector setup and the recurring-orders capability (Stored Payment Methods), (f) `setOrderNumber` on Orders. Use `mcp__plugin_commercetools_commercetools-knowledge__commercetools-oas-schemata` for `api-Order-write` and the `checkout-Application` resource.
3. MCP read-only: `read_project` (`messages.enabled` true for `OrderCreated`), `read_types` for `malva-checkout`, `malva-line`, `malva-customer`, `malva-return-item` (seed-owned; if missing, report to the D/F owners, never create them here), `read_shipping_methods` for `mau-ship-pickup`, `mau-ship-standard`, `mau-ship-express`, `read_states` for `ready-for-pickup`, `read_applications` and `read_payment_integrations` (empty until OA-05).
4. Missing OA-05 answer or configuration: not a blocker; build to O-09, mark live steps pending with the rows in section 11 present.

## 6. Files you will create or change

```
lib/types.ts                                 # CheckoutSessionResult, CheckoutPageState, ReturnResolution
lib/env.ts                                   # CTP_CHECKOUT_APP_KEY (required in production), SUBSCRIPTIONS_PURCHASE_ENABLED, CHECKOUT_DEV_COMPLETE
lib/checkout/region.ts                       # deriveRegion(CTP_API_URL)
lib/checkout/session.ts                      # getSessionsToken, createCheckoutSession
lib/checkout/prepare.ts                      # prepareCartForCheckout (D9, D8 guard)
lib/checkout/return.ts                       # resolveReturn(orderId, session): order, store, locale, number, access path
lib/checkout/styles.ts                       # pure: map computed token values to the SDK styles object
lib/ct/orders.ts                             # getOrderById, deriveOrderNumber, ensureOrderNumber
app/api/checkout/session/route.ts            # POST: prepare + create session
app/api/dev/checkout/complete/route.ts       # dev-only (O-08), 404 in production
app/checkout/return/page.tsx                 # locale-less return URL (D4a)
app/[locale]/[store]/(shop)/checkout/page.tsx
components/checkout/{CheckoutPage,CheckoutWidget,PickupPanel,CheckoutError,DevCompletePanel}.tsx
hooks/useCheckoutSession.ts
proxy.ts                                     # G's file: exclude /checkout/return from locale routing (with a test)
scripts/dev-delete-test-orders.ts
messages/de-DE.json, messages/en-US.json     # keys under "checkout.*"
.env.example                                 # CTP_CHECKOUT_APP_KEY, SUBSCRIPTIONS_PURCHASE_ENABLED, CHECKOUT_DEV_COMPLETE with reasons; scope manage_sessions
```
`@commercetools/checkout-browser-sdk` is installed in O-04 and imported dynamically from `CheckoutWidget` only.

## 7. Tasks (tests first, red before green)

**O-01 Custom type check and scopes** [SKILL: commercetools-platform] [SPEC: Delivery by pickup or shipping]
The custom types are seed-owned (D10): this task adds none. Read them back with MCP `read_types` (`malva-checkout` on `cart` and `order` with `pickupBranchKey`, `fitVehicleLabel`, `isTest`, `deliveredAt`; `malva-line`; `malva-customer`; `malva-return-item`) and record the result in section 12; anything missing goes to the D/F owners and `plans/QUESTIONS.md`. Add scope `manage_sessions` to the storefront client scopes in `.env.example` with the reason "create Checkout sessions" and `manage_orders` only if O-00 shows `setOrderNumber` needs it beyond the existing scope (reason "assign the order number after Checkout creates the order"). Tests (storefront side): `lib/checkout/__tests__/types-contract.test.ts` `custom field names used by checkout exist in the contract list` (a constant list of the field names O writes: `pickupBranchKey`, `fitVehicleLabel`, `isTest`), `checkout never writes mobile`.

**O-02 Environment and region** [SKILL: commercetools-checkout]
`lib/checkout/region.ts`: `deriveRegion('https://api.us-central1.gcp.commercetools.com') === 'us-central1.gcp'` and `eu-central-1.aws`; invalid URL throws a clear error. `lib/env.ts`: `CTP_CHECKOUT_APP_KEY` (pattern `^[A-Za-z0-9_-]{2,256}$`; required when `NODE_ENV=production`, optional elsewhere so a developer without OA-05 can run the app), `SUBSCRIPTIONS_PURCHASE_ENABLED` (boolean, default true), `CHECKOUT_DEV_COMPLETE` (boolean, default false, refused when `NODE_ENV=production`). Tests: `region from eu and us urls`, `bad url throws`, `app key required in production`, `app key optional in development`, `dev complete refused in production`.

**O-03 Session and cart preparation** [SKILL: commercetools-checkout] [SKILL: commercetools-storefront] [SPEC: Contact; Delivery by pickup or shipping; Payment]
`lib/checkout/prepare.ts`: `prepareCartForCheckout(storeKey, cartId, scope): Promise<CtCart>` per D9 and D8 (through N's `withCartRetry`); throws typed errors `EmptyCart`, `LinesUnavailable(lineItemIds)` (any line capped to zero), `SubscriptionsUnavailable`. `lib/checkout/session.ts`: `createCheckoutSession({ cartId }): Promise<{ sessionId, projectKey, region }>` posting to the Sessions API (D3) with a token fetched by `getSessionsToken()` (client credentials with the client's own scopes; token cached in memory until 60 s before expiry; never logged); a non-2xx answer becomes `CheckoutUnavailable` carrying the status only. `app/api/checkout/session/route.ts` `POST`: needs `cartId` in the session (else 409 `cart-missing`), calls prepare then session, returns `{ sessionId, projectKey, region }`; maps `EmptyCart` 409, `LinesUnavailable` 422 with line ids, `SubscriptionsUnavailable` 422, `CheckoutUnavailable` 502; no store or cart id from the request body (session only). Missing `CTP_CHECKOUT_APP_KEY` returns 503 `checkout-not-configured`.
Tests `lib/checkout/__tests__/session.test.ts` (`fetch` mocked): `body has cartRef and application key`, `url uses the derived region and project key`, `token is cached and not logged`, `non 2xx becomes CheckoutUnavailable without the body`, `response carries project key and region`; `prepare.test.ts`: `writes pickupBranchKey for the selected branch in pickup and ship carts`, `writes fitVehicleLabel only with an active vehicle`, `isTest true outside production and absent in production`, `recalculates before the session`, `empty cart is refused`, `capped line is refused with its id`, `recurring line refused when subscriptions are disabled`, `recurring line allowed when enabled`, `no territory or store countries check exists` (grep test, D7); route tests: `409 without a cart in the session`, `503 without an application key`, `cart id comes from the session not the body`, `no commercetools type in the JSON`.

**O-04 Checkout page and widget** [SKILL: commercetools-checkout] [SPEC: Single page, three numbered sections; Delivery by pickup or shipping › Pickup details]
`app/[locale]/[store]/(shop)/checkout/page.tsx` (Server Component, `noindex`, `force-dynamic`): reads the session, redirects to `/cart` when the cart is empty or any line is capped to zero, and renders `CheckoutPage` with the pickup facts (branch name, address from the channel, hours from the `branch-info` fields `openingHours` and `timezone` via I's `mapBranch`, "Bring photo ID") when the cart's delivery preset is pickup (shipping method `mau-ship-pickup`). `components/checkout/CheckoutWidget.tsx` (`'use client'`): `useCheckoutSession()` calls `POST /api/checkout/session` once on mount (and again on Retry), then `const { checkoutFlow } = await import('@commercetools/checkout-browser-sdk')` and mounts it per D4 into `<div data-ctc />`; states `loading` (skeleton with the page geometry, `aria-busy`), `ready`, `error` (plain message from `messages`, a Retry button, a Back to cart link; `422 subscriptions-unavailable` and `503 checkout-not-configured` have their own texts). `lib/checkout/styles.ts` maps computed token values to the SDK `styles` (names from the Checkout theming docs, confirmed in O-00). `CheckoutError.tsx` shows `onError` payloads as text only (never HTML). Install the SDK here (`npm install @commercetools/checkout-browser-sdk`), pinned.
Tests `components/checkout/__tests__/*.test.tsx` (SDK mocked): `mounts data-ctc exactly once under double render`, `passes locale project key region and session id to checkoutFlow`, `retry creates a new session`, `error states render plain text`, `onError payload is rendered as text not html`, `redirects to cart when the cart is empty`, `pickup panel shows address hours and ID reminder`, `ship preset shows no pickup panel`, `no card number or cvv input exists in components/checkout` (grep test), `styles are built from computed tokens without raw values` (`styles.test.ts`: input is a fake `getComputedStyle`, output keys present, no literal hex in `lib/checkout/styles.ts`), `axe clean in de-DE and en-US for the page chrome`.

**O-05 Return, order number and idempotency** [SKILL: commercetools-checkout] [SPEC: Summary and placement › Double submit]
`lib/ct/orders.ts`: `getOrderById(orderId)` (project client, expand `store`, `shippingInfo.shippingMethod`), `deriveOrderNumber(orderId, salt = 0)` = `MA-` plus 8 Crockford base32 characters of `sha256(`${orderId}:${salt}`)`, `ensureOrderNumber(order)` (D6). `lib/checkout/return.ts`: `resolveReturn(orderId, session)`: unknown or malformed id (not a UUID) returns `{ status: 'not-found' }`; applies P's `canViewOrder` without a token (the shopper must be the same customer or the same browser, `anonymousId` equal), otherwise `not-found`; ensures the number; returns `{ status: 'ok', locale, storeKey, orderNumber, accessToken? }` (guest token from P's `signOrderAccessToken`; until P lands use the stub `lib/order-access.ts`). `app/checkout/return/page.tsx` redirects to the confirmation path, clears `cartId` from the session (the cart is `Ordered`), sets `Referrer-Policy: no-referrer`, and answers the same 404 for every failure. Calling it twice returns the same number and the same path.
Tests `lib/ct/__tests__/orders.test.ts`: `order number is deterministic for an order id`, `format is MA- plus 8 Crockford characters`, `salt changes the number`, `existing number is kept and nothing is written`, `missing number is set once with setOrderNumber`, `duplicate number retries with the next salt`; `lib/checkout/__tests__/return.test.ts`: `owner customer is redirected`, `same browser guest is redirected with a token`, `stranger gets not-found`, `malformed id gets not-found`, `second call returns the same path`, `cartId is cleared`, `unknown order gets not-found`; page test: `return page redirects to the numbered confirmation`, `return route is excluded from locale routing` (proxy test), `response has no-referrer`.

**O-06 Messages** [SPEC: all] Keys under `checkout.*` in both catalogs (page chrome only: heading, loading, retry, back to cart, pickup panel, the three error texts); German translated by you and flagged (M-O02).

**O-07 Cleanup script** [SPEC: Double submit (live check)]
`scripts/dev-delete-test-orders.ts`: finds orders with `custom.isTest = true` (optional `--before <date>`), cancels recurring orders created from them (`recurring-orders` with `originOrder`), deletes the orders (`orders().withId().delete({ queryArgs: { version } })`) and then the payments referenced by `paymentInfo.payments` **only if** the order was a test order; Stripe-side test data is left alone. Refuses anything without the flag. Test `scripts/__tests__/dev-delete-test-orders.test.ts`: `skips orders without isTest`, `deletes the payments of a test order`, `cancels the recurring order of a test order`, `refuses a payment of a non test order`.

**O-08 Dev-only completion helper (not a payment path)** [SPEC: Summary and placement]
So that P and Q can be verified before OA-05 is `DONE`: `app/api/dev/checkout/complete/route.ts` `POST`, active only when `CHECKOUT_DEV_COMPLETE=true` **and** `NODE_ENV !== 'production'` (404 otherwise, enforced twice), requires the session cart and a `customerEmail` ending in `@example.com` in the body; sets `customerEmail` and a country-only shipping address if missing, runs `prepareCartForCheckout`, creates the order with the in-store orders endpoint (`orderState: 'Open'`, `paymentState: 'Pending'`, no payment object), tags `isTest`, and returns the same redirect path as O-05. `DevCompletePanel` renders on the checkout page only when the flag is on and the Application key is missing or `?dev=1`. It creates no Payment, ever (D2 grep test stays green).
Tests: `route is 404 in production even with the flag`, `route is 404 without the flag`, `needs an example.com email`, `creates one order tagged isTest`, `creates no payment`, `panel hidden by default`.

**O-09 Flag rehearsal (no live PSP)** [SKILL: commercetools-checkout]
With a fake `CTP_CHECKOUT_APP_KEY=test` and no network, run `npm run build`; confirm the build passes, `POST /api/checkout/session` returns the controlled 502 `checkout-unavailable` when the Sessions API cannot be reached or the Application does not exist, and 503 when the key is absent. Record in `plans/evidence/O/O-09-flag.txt`. Do **not** install or configure a connector (OA-05 is the owner's).

**O-10 Live verification** (sections 9 and 10). Needs OA-05 `DONE`; if not, record the pending rows and finish O-01 to O-09.

## 8. Test-first scenario map

| Spec scenario | First failing test or check |
| --- | --- |
| Incomplete section | live: hosted page refuses an empty email and creates no order (recipe 2; MCP `read_orders` unchanged) |
| Guest checkout | live: guest pays with a test card (recipe 3); unit: `same browser guest is redirected with a token` |
| Pickup details | `pickup panel shows address hours and ID reminder`; `writes pickupBranchKey for the selected branch ...` |
| Address validation | live: hosted validation (recipe 4) |
| Declined payment | live: Stripe decline card keeps the cart `Active` (recipe 6) |
| Total on the button | live: hosted button total equals the cart total (recipe 8) |
| Double submit | `second call returns the same path`; live: two returns for one order give one order (recipe 7) |
| No territory blocking (Q-O03) | `no territory or store countries check exists` |
| Subscription purchase (Q-Q06) | `recurring line refused when subscriptions are disabled`; live: `read_recurring_orders` (recipe 9) |

## 9. Browser recipe (Chrome DevTools MCP; evidence under `plans/evidence/O/`; needs OA-05)

Dev server running with the Application key in `.env.local`. Use `{storeA}` from `read_stores`. Test emails `qa-<n>@example.com`. Stripe test cards: success `4242 4242 4242 4242`, decline `4000 0000 0000 0002`, any future expiry, any CVC.

1. As a guest add a part, go to cart, press Checkout. Assert the page chrome, the loading state then the hosted widget (take_snapshot; if it is a cross-origin frame the MCP cannot read, say so, take screenshots only and switch the payment steps to M-O01, D14). Screenshots `O-01-checkout-<w>.png` for w in 375, 768, 1024, 1440 (`resize_page`). `list_network_requests`: one `POST /api/checkout/session` 200, no browser call to `api.*.commercetools.com`.
2. Try to pay with an empty email: the hosted page blocks it, no order exists (MCP).
3. Pickup preset: fill email, pay with the success card. The browser lands on `/checkout/return` and then on the confirmation (P) with an `MA-` number. Screenshot `O-03-pickup-done.png`.
4. Ship preset: enter an invalid postal code (the hosted validation message), fix it, pay, land on confirmation.
5. Branch: change the branch in the picker before checkout; the cart re-prices (N) and the pickup panel shows the new branch.
6. Declined: use the decline card: hosted error, cart still present (`/cart` shows the lines), no order for that cart (MCP). Screenshot `O-06-declined.png`.
7. Double return: open `/checkout/return?orderId=<id>` twice in the same browser: same confirmation path, one order (MCP). In a second isolated context: not-found.
8. Totals: the hosted total equals the cart total in the same currency format; `de-DE` shows euro formatting.
9. Subscription: with `recurring-eligible` part added through "Subscribe and save", complete the flow with the success card; the order exists and a recurring order exists (MCP). With `SUBSCRIPTIONS_PURCHASE_ENABLED=false` the session is refused and the cart explains why.
10. Signed in: sign in with the seeded shopper, open checkout: email prefilled if the Sessions API supports it (O-00), else the shopper types it; saved addresses behave as O-00 found.
11. `list_console_messages`: clean. No card field in our DOM. At each viewport: no horizontal scroll, widget container fills the column, focus order sane.

## 10. `b2b2c-automotive` MCP checks (read only; excerpts to `plans/evidence/O/`)

1. `read_applications` (Checkout): the Application key equals `CTP_CHECKOUT_APP_KEY`, type complete checkout, countries DE and US, payment return URL `<origin>/checkout/return`, origin URLs include `http://localhost:3000`; `read_payment_integrations`: a Stripe integration, active.
2. `read_orders` by order number from steps 3, 4: `store.key` is `{storeA}`; `orderNumber` matches `MA-XXXXXXXX`; `cart` reference present; `customerEmail`; `custom.pickupBranchKey`; `custom.isTest` true; `shippingInfo.shippingMethodName` and key; `shippingAddress`; `taxedPrice` present with the rate used in the cart; `paymentState` Paid (Stripe success); `orderState` Open.
3. `read_payments` for the order's payment: `paymentMethodInfo.paymentInterface` is the Stripe connector's, `amountPlanned` equals `taxedPrice.totalGross`, a `Charge` transaction in state `Success`, `interfaceId` set by the PSP; `read_transactions` (Checkout Transactions) shows the same; the storefront created none of them.
4. `read_carts` for the cart id: `Ordered` after success; `Active` after the declined run (step 6) with no order for it; custom fields as D9.
5. Double return (step 7): `read_orders` where cart id: exactly one result.
6. `read_messages`: one `OrderCreated` for the order (P consumes it).
7. Subscription (step 9): `read_recurring_orders` shows one for the customer with the chosen policy and `nextOrderAt`; `read_payment_methods` shows the stored method (token fields not copied to evidence).
8. Cleanup: `npx tsx scripts/dev-delete-test-orders.ts` then `read_orders` shows none with `isTest`.

## 11. Manual items (owner; Claude never waits on them)

For `plans/TODO-MANUAL-TESTING.md` (the lead merges these rows):

| Row id | Item | Owner action |
| --- | --- | --- |
| OA-05 (**rewritten, real**) | Stripe through commercetools Checkout | 1) Create a Stripe account in **test mode**; keep the publishable and secret test keys. 2) In the Merchant Center install the **Stripe payment connector** from the Connect marketplace into this project (create the API client the connector asks for with the scopes in its documentation; set the Stripe keys, the webhook secret and, for subscriptions, enable **Stored Payment Methods** and recurring support; register the Stripe webhook endpoint of the deployed connector). 3) Create a **Complete checkout Application** (Checkout > Add application): key `malva-automotive-checkout`, countries DE and US, origin URLs `http://localhost:3000` and the deployed storefront origin (or Allow all origins for testing), payment return URL `<origin>/checkout/return`, logo URL, discount code function on, a mandatory user agreement "Terms" linking to the store terms page, and a Stripe payment integration (activate it and the agreement; both are inactive by default). 4) Put `CTP_CHECKOUT_APP_KEY` in `storefront/.env.local` and tell Claude. If the connector cannot process recurring orders, say so: Claude sets `SUBSCRIPTIONS_PURCHASE_ENABLED=false` and the subscribe option is hidden. |
| M-O01 | Test-card order | Only if the hosted widget cannot be driven by the browser tool: owner or developer places one pickup order and one ship order with `4242 4242 4242 4242` and one declined order with `4000 0000 0000 0002`, then tells Claude the emails used; Claude verifies with section 10. |
| M-O02 | Review de-DE strings under `checkout.*` (page chrome) | Native speaker |
| M-O03 | Terms and withdrawal wording | Owner supplies the text of the Application's user agreement and the `/terms` page |
| M-O04 | Hosted checkout look | Owner compares `O-01-checkout-*.png` with `Reseller Storefront.dc.html` view `checkout` and accepts the hosted layout (spec deviation: not the designed three-section page) |
| ~~M-O01 (old)~~ | removed | The old "live PSP test only if OA-05 chose Checkout" row is replaced by OA-05 and the new M-O01. |

## 12. Notes to fill in while working

O-00 findings (J20, 2026-10-12; commercetools docs MCP, SDK `@commercetools/checkout-browser-sdk` 1.7.5 read from `node_modules`):

- **`checkoutFlow` options** (`CheckoutFlowData`): `projectKey`, `sessionId`, `region` (required; the SDK also accepts a full URL where it expects a region, which the dev rehearsal uses), `locale`, `currencyLocale`, `styles`, `languageOverrides`, `forms` (address form fields), `tax: { display, hideTaxName, cartItemPriceDisplay, shippingPriceDisplay }`, `skipPaymentSuccessPage`, `skipPaymentErrorPage`, `showExtensionErrorMessages`, `shipping` (external shipping methods), `onInfo`, `onWarn`, `onError`, `logInfo|Warn|Error`, `order.verification.timeoutInMs`. With `<div data-ctc />` in the page the widget renders inline (no header, no Leave checkout button); without it, full screen. Used here: `locale`, `currencyLocale`, `tax.display`, `skipPaymentSuccessPage: true` (our confirmation page, P, replaces it), `styles`, handlers. `checkout_completed` arrives through `onInfo` with `payload.order.id`; `close()` and `retryOrderVerification()` are exported methods.
- **Locales**: `de` and `en-US` exist; `de-DE` does not (falls back to English), so `lib/checkout/locale.ts` maps the route locale.
- **Sessions API** `POST https://session.{region}.commercetools.com/{projectKey}/sessions`, bearer token with `manage_sessions:{projectKey}`: body `cart.cartRef.id` (or key), `metadata.applicationKey` (id or key), optional `metadata.futureOrderNumber`. **No customer, email or address fields**: prefill happens through the cart (`customerEmail`, `shippingAddress`). A cart must belong to the caller (the docs warn about IDOR): the id comes from the signed session cookie only.
- **Preset shipping and address**: the preset method and address stay on the cart; the hosted address and delivery steps start from what the cart holds and may change it, so the order can end with another method than the preset (hence the pickup reconciliation on the order, Q-O08).
- **Application settings** (Merchant Center): key, name, logo URL, countries, origin URLs (`http://localhost:3000` allowed for development, or "Allow all origins" for tests), payment return URL, discount code toggle, user agreements (mandatory checkbox option), payment integrations (inactive until activated). Recorded for OA-05 / M-O06.
- **Theming**: only `--font-family` and ten colour variables (`--button`, `--button-outline`, `--button-hover`, `--button-text`, `--button-disabled`, `--button-disabled-text`, `--input-field-focus`, `--checkbox`, `--radio`, `--spinner`); everything else is ignored. `lib/checkout/styles.ts` fills them from the store's computed tokens at runtime.
- **Order number**: **Checkout can set it**: `metadata.futureOrderNumber` becomes `Order.orderNumber`; a duplicate stops the order, so the number must be unique (derived from the cart id). `setOrderNumber` exists as an Orders update action; kept only as the fallback `ensureOrderNumber` (D6 said to delete it if Checkout can; it stays as a tested safety net for an order that arrives without a number, one function).
- **Widget and the browser tool**: not an iframe. The SDK injects `https://app.checkout.{region}.commercetools.com/main.js` and renders in the page; Stripe's card fields are Stripe frames. Needs CSP hosts (Q-O10). Details in Q-O07.
- **Recurring orders with Checkout** ("Recurring Orders in Checkout"): Checkout in both modes pays the first order, tokenises the payment method (Stored Payment Methods, card payments only, requires `customerId` on the cart, i.e. a signed-in shopper) and the shopper triggers the Recurring Order by paying; no gift cards and no split payments for recurring orders; automated reversals only when the original order was paid through Checkout and the same Application stays in use. A **guest** with a subscription line therefore cannot be tokenised for renewals: open item for OA-05 (the plan did not forbid guest subscriptions; the cart currently allows them): decide at the first live check whether to require sign-in before a subscription checkout.
- **Stripe connector version and Stored Payment Methods / recurring**: not available in this environment (OA-05). Q-O06 stays open; `SUBSCRIPTIONS_PURCHASE_ENABLED` is the switch.
- **Seed contract (read from `seed/src/data`, no live read)**: `malva-checkout` on cart and order has `pickupBranchKey`, `fitVehicleLabel`, `isTest`, `deliveredAt`, `salesChannel` (enum web, instagram, facebook, whatsapp, tiktok, in-store), `mobile` (unused), `costCentre`, `placedOnBehalfBy`. O writes `fitVehicleLabel`, `isTest`, `salesChannel = web` on the cart and `pickupBranchKey` on the order. The shipping methods are `mau-ship-pickup`, `mau-ship-standard`, `mau-ship-express`.
- `read_*` MCP checks of the live project (O-01 read-back, section 10) are not done in this run (offline, by instruction).

## 13. Definition of done

- [ ] Tasks O-01 to O-09 done, O-10 recorded or marked pending OA-05 with the rows of section 11 present; every named test exists, was written first, and passes.
- [ ] `npm run check` green, including `check-tokens`, `check-server-only`, `check-bundle-secrets`, `check-messages`.
- [ ] No card field, PAN or CVV input exists in the repo (`grep -rniE "card.?number|cvv|cvc" components app lib` returns nothing outside test names); no Payment is created by the storefront (`grep -rn "payments().post" lib app` empty); no `PAYMENT_PROVIDER`, `offline` provider, `malva-offline`, territory or `store.countries` checkout code remains.
- [ ] The SDK is imported only in `CheckoutWidget.tsx` and dynamically.
- [ ] Browser recipe 1 to 11 done at 375, 768, 1024, 1440 (or the payment steps replaced by M-O01 with the reason recorded); screenshots saved; console clean.
- [ ] MCP read-back matches section 10; test orders removed.
- [ ] Questions in `plans/notes/questions-NOPQ.md`: Q-O01, Q-O03 answered, Q-O02 and Q-O05 revised, Q-O04 kept.

## 14. Evidence to leave

`plans/evidence/O/`: screenshots named above, `O-orders.txt` (order numbers and MCP excerpts), `O-09-flag.txt`, final `npm run check` summary line.

## Progress

- 2026-10-12 (J20): O-01 to O-09 built test first (about 130 new tests); `npm run check` (1579 tests) and `npm run verify:build` (offline dummy env, fake `CTP_CHECKOUT_APP_KEY`) green. O-10 was run offline against local stand-ins (`plans/evidence/O/README.md`); everything that needs the real Application and Stripe is OA-05 and the rows M-O05 to M-O08, the project MCP read-backs (section 10) are pending.
- Done: `lib/checkout/{env,region,locale,order-number,session,return,styles}.ts`, `lib/ct/{checkout-prepare,checkout-customer,orders}.ts`, `lib/order-access.ts` (stub with P's signatures), `POST /api/checkout/session`, `GET /checkout/return` (a Route Handler, not a page: it must write the session cookie), dev-only `POST /api/dev/checkout/complete`, checkout page and components (`CheckoutWidget` is the only SDK importer, dynamic), hooks `useCheckoutSession` and `useDevComplete`, CSP for the Checkout and Stripe hosts, `scripts/dev-delete-test-orders.mjs`, messages `checkout.*`, `.env.example` (`CTP_CHECKOUT_APP_KEY`, `CHECKOUT_DEV_COMPLETE`, `CHECKOUT_DEV_*_URL`, scope `manage_sessions`).
- Deviations from the plan: (1) the order number is sent as `futureOrderNumber` from the cart id (Checkout sets it); `ensureOrderNumber` stays only as a fallback (Q-O05); (2) `pickupBranchKey` is not written on the cart (N reads its presence as pickup) but reconciled on the order at return (Q-O08); (3) `prepare` lives in `lib/ct/checkout-prepare.ts` (the SDK is only allowed in `lib/ct`) and the cleanup script is `.mjs` (no `tsx` in the storefront); (4) the return is a Route Handler `app/checkout/return/route.ts`; (5) the checkout page is `app/[locale]/[store]/checkout/page.tsx` (no `(shop)` group); (6) the Checkout locale for de-DE is `de` (Q-O09); (7) the CSP gains the Checkout and Stripe hosts (Q-O10), fixed at build time; (8) a dev-only rehearsal hook (`CHECKOUT_DEV_SESSIONS_URL` and `CHECKOUT_DEV_APP_URL`, ignored in production) lets a local stand-in replace the Sessions API and the hosted script so the widget wiring can be verified before OA-05.
