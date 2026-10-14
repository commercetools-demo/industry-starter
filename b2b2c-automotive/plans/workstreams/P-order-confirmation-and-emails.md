<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream P: Order confirmation (on screen only, no emails)

Status: DRAFT v2 (2026-10-12, rewritten after the owner interview: Q-P01 "drop emails", Q-012). Primary spec: `cs/design-order-confirmation-page`. Storefront paths are relative to `b2b2c-automotive/storefront/`; `plans/...` is under `b2b2c-automotive/`. The file keeps its old name (`...-and-emails`) so links do not break; there are no emails in it any more.

## 1. Goal

After the hosted Checkout (O) creates the order, the shopper lands on a confirmation page that says the order exists, shows the real order number, what happens next (pickup or shipping), the order summary, the address or pickup details, a next-step timeline and, for subscription lines, the subscription details, and offers Continue shopping, View order (signed in) or Create account (guest, password only). **Nothing is emailed or texted, ever** (owner answer Q-P01): the page itself is the confirmation, a guest can copy a private link to it, and the order stays reachable from the account after Create account.

What is **removed** by the owner answers: the `order-mail-sender` Connect connector and everything under `connectors/`, the outbox, the template contract with the portal, the replay and cleanup scripts, the mail theme and logo code, `ORDER_ACCESS_SECRET` sharing with a connector, and the old email-provider owner action (no email provider).

## 2. Depends on

O (the return route `/checkout/return`, `resolveReturn`, `ensureOrderNumber`, custom types, `lib/order-access.ts` stub) and transitively N, M, L, J, I, G. Q depends on this workstream (`mapOrderStatus`, `lib/auth/password-policy.ts`, `createStoreCustomer`).

Owner prerequisites: none for building; live checks need an order, which needs OA-05 (O) or O's dev-only completion helper.

## 3. Specs and requirements implemented

Primary: `openspec/specs/consumer-storefront/design-order-confirmation-page/spec.md`

| Requirement title (verbatim) | Scenarios | Tasks |
| --- | --- | --- |
| Confirmation states the next step | Pickup; Shipping | P-03, P-04 |
| Order number comes from the order | Refresh | P-01, P-02, P-04, P-06 |
| Follow-up actions | Guest account offer | P-05 |
| Confirmation email | Email branded | **Out of scope by owner decision (Q-P01).** The spec requirement needs an out-of-scope note (the lead updates the spec); no task builds it. |

Gaps of that spec that are built here: order summary, address, next-step timeline, subscription block, copy-link for guests.

Related (read, do not re-implement): `openspec/specs/seller-portal/design-marketing-and-email/spec.md`: the portal keeps the Marketing and email screens, but they only store templates and never send anything. P reads no template.

## 4. Decisions already taken (do not reopen)

| # | Decision | Source |
| --- | --- | --- |
| D1 | Confirmation URL `/{locale}/{storeKey}/checkout/confirmation/{orderNumber}`; guests get `?t=<access token>`. The page is `force-dynamic`, `noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`. | spec "Order number comes from the order"; skill `core/checkout-page.md` Pattern 5 |
| D2 | Buyer-only rule: show the order only if (a) `session.customerId === order.customerId`, or (b) `session.anonymousId === order.anonymousId` (same browser; the order inherits the cart's `anonymousId`), or (c) a valid access token for this order and store. Otherwise the same 404 page as an unknown order (never 403). | spec scenario "Refresh" |
| D3 | Access token: `jose` HS256, audience `order-view`, claims `{ oid, sk }`, 30-day expiry, secret `ORDER_ACCESS_SECRET` (at least 32 characters, **not** `SESSION_SECRET`: a leaked order link must not be a session secret). Only the storefront uses it now (no connector). | bootstrap spec "Stateless session" |
| D4 | Delivery window text comes from the order's store: `store-settings.shipDaysMin` and `shipDaysMax` (seeded 2 and 3, "2-3 business days"), because the seeded shipping methods carry no `localizedDescription`; the express method (`mau-ship-express`) has no window of its own, so its sentence omits the window; when the store fields are absent the sentence omits the window. Question Q-P04. | spec "Shipping"; seed `tax-shipping.ts`, `org.ts` |
| D5 | The order was created by commercetools Checkout (O). Pickup or shipping is decided by the **order's shipping method key** (`mau-ship-pickup` is pickup; `mau-ship-standard` and `mau-ship-express` are shipping; seed keys), not by the cart preset (the shopper may have changed it in the hosted page). Pickup facts (store name, city, address, hours) come from the branch channel referenced by the order custom field `pickupBranchKey` (custom type `malva-checkout`, O writes it for every cart; hours from the channel's `branch-info` `openingHours` and `timezone`). Order status "ready for pickup" is the order state with key `ready-for-pickup` (seed-owned `OrderState`, `initial: false`, no `transitions`). Question Q-Q03 (Q file). | spec "Pickup"; O D9 |
| D6 | Guest "Create account": password only, email prefilled from the order. Server creates the customer **in the order's store**, sets the customer on the order (`setCustomerId`), signs in. If setting the customer fails the new customer is deleted again (no half-created account). Failure copy is generic. Question Q-P05. | spec scenario "Guest account offer"; precedent in `b2b-manufacturing` workstream N |
| D7 | Password policy lives in `lib/auth/password-policy.ts`: at least 10 characters and not in an embedded list of 200 common passwords. Q reuses it. | precedent `b2b-manufacturing` N-03 |
| D8 | **No emails at all** (owner answer Q-P01): no connector, no Subscription on `OrderCreated`, no outbox custom object, no ESP, no `STOREFRONT_ORIGIN` link building, no SMS. Shoppers who want to return later use the account (after Create account) or the copied private link. The confirmation page says so plainly ("We don't send emails. Keep this page's link or create an account to find your order later."). | owner-answers Q-P01 |
| D9 | The private link for a guest is the confirmation URL with `?t=`; a "Copy link" button (clipboard API with a text field fallback) and a "Print" button (`window.print()` with a print stylesheet made of tokens) replace the email. | this plan |
| D10 | Subscription lines (owner answer Q-Q06): the confirmation shows, per subscription line, the frequency (from the line's `recurrenceInfo` policy name) and the next delivery date taken from the order's recurring order when it exists (`recurring-orders where originOrder(id="...")`, created asynchronously by commercetools: when absent show "Your subscription is being set up" and no date, never a guessed date). Manage-links point to `/account/subscriptions`. | owner-answers Q-Q06; docs "Recurring Orders overview" |
| D11 | Only `de-DE` and `en-US` exist; the page locale is the route locale (the order's locale is only used by the return redirect, O). | bootstrap spec "Locale routing" |

## 5. Before you start (read-only; never wait silently)

1. `npm run check` green; O merged. `grep -n "signOrderAccessToken\|resolveReturn\|ensureOrderNumber" lib` shows O's pieces.
2. MCP: `read_types` for `malva-checkout`, `malva-customer`; `read_states` for the OrderState key `ready-for-pickup` (seed-owned; report if absent, never create it here); `read_stores` custom fields (`store-settings.returnWindowDays`, 30); `read_recurrence_policies`.
3. An order to look at: from OA-05's Checkout or from O's dev-only completion helper (`CHECKOUT_DEV_COMPLETE=true`, `@example.com` email). If neither exists, build offline and mark the live steps pending.

## 6. Files you will create or change

```
lib/order-access.ts                          # sign/verify token, canViewOrder (replaces O's stub)
lib/auth/password-policy.ts, lib/auth/common-passwords.ts
lib/ct/orders.ts                             # add getOrderForConfirmation (by number), getRecurringOrderForOrder, claimOrder
lib/ct/customers.ts                          # createStoreCustomer, deleteCustomer (server-only)
lib/mappers/order.ts                         # OrderView, mapOrderStatus, timeline, subscription block
app/[locale]/[store]/(shop)/checkout/confirmation/[orderNumber]/page.tsx
app/[locale]/[store]/(shop)/checkout/confirmation/page.tsx      # ?orderId= alias of O's return resolver
app/api/orders/[orderNumber]/claim/route.ts  # POST guest create account
components/confirmation/{ConfirmationPage,SuccessMark,OrderSummaryCard,DeliveryDetails,NextStepTimeline,SubscriptionBlock,FollowUpActions,GuestAccountForm,CopyLink}.tsx
messages/de-DE.json, messages/en-US.json     # keys under "confirmation.*"
.env.example                                 # ORDER_ACCESS_SECRET with reason
```
There is no `connectors/` directory in this project any more.

## 7. Tasks (tests first, red before green)

**P-01 Seed contract check** [SKILL: commercetools-platform] [SPEC: Confirmation states the next step]
Nothing is added to the seed: the order state `ready-for-pickup` (OrderState, `initial: false`, no `transitions`, a documented unprefixed key, Q-S14) and `store-settings.returnWindowDays` (30) already exist (`seed/src/data/states.ts`, `custom-types.ts`, `org.ts`). Read them back with MCP `read_states`, `read_stores` and record the result in `plans/evidence/P/P-mcp.txt`; a missing item goes to the D/F owners and `plans/QUESTIONS.md`. Test (storefront side): `mapOrderStatus` reads the state key `ready-for-pickup` from a constant shared with Q.

**P-02 Order access** [SPEC: Order number comes from the order]
`lib/order-access.ts`:
```ts
export async function signOrderAccessToken(i: { orderId: string; storeKey: string }): Promise<string>
export async function verifyOrderAccessToken(token: string, i: { orderId: string; storeKey: string }): Promise<boolean>
export function canViewOrder(s: { customerId?: string; anonymousId?: string }, o: { customerId?: string; anonymousId?: string; id: string; storeKey: string }, token?: string): Promise<boolean>
```
`lib/env.ts`: `ORDER_ACCESS_SECRET` at least 32 characters, startup fails with a clear message otherwise; `.env.example` reason "signs the private link of a confirmation page".
Tests `lib/__tests__/order-access.test.ts`: `token verifies for the same order and store`, `token for another order fails`, `token for another store fails`, `expired token fails`, `wrong audience fails`, `weak secret fails at startup`, `owner customer may view`, `same browser anonymous may view`, `stranger may not view`, `token holder may view`.

**P-03 Order view model and status** [SPEC: Confirmation states the next step]
`lib/ct/orders.ts` `getOrderForConfirmation(storeKey, orderNumber)`: in-store `orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: ['shippingInfo.shippingMethod', 'state', 'paymentInfo.payments[*]'] } })`; `null` on 404, never throws to the page; server-rendered, no client cache. `getRecurringOrderForOrder(orderId)` reads `recurring-orders` with `where: originOrder(id="<id>")` (null when none yet). `lib/mappers/order.ts`:
```ts
export type OrderStatus = 'placed' | 'ready-for-pickup' | 'shipped' | 'collected' | 'delivered' | 'cancelled';
export function mapOrderStatus(o: CtOrder): OrderStatus   // Cancelled orderState -> cancelled; state.key 'ready-for-pickup'; shipmentState Shipped -> shipped; Delivered -> collected for pickup orders else delivered; else placed
export function mapOrderView(o: CtOrder, ctx: { locale: string; branch: Branch | null; recurring: CtRecurringOrder | null }): OrderView
export function isPickupOrder(o: CtOrder): boolean       // shippingInfo.shippingMethod.key === 'mau-ship-pickup' (D5)
export function buildTimeline(view: OrderView): { steps: { key: string; state: 'done' | 'current' | 'upcoming' }[] }
// pickup: received, ready, collected. ship: received, shipped, delivered.
export function nextStepSentence(view: OrderView, t: (k: string, v?: object) => string): string
```
Sentences (message keys, English text): pickup "Ready when you are: collect it at {store} in {city}. Bring photo ID."; ship "Shipping from {store}, arriving in {window}." and without window "Shipping from {store}."; no "we'll text you" or "we'll email you" sentence exists any more (D8). Subscription block per D10.
Tests `lib/mappers/__tests__/order.test.ts`: `status placed for new order`, `status ready-for-pickup from state key`, `status shipped`, `delivered becomes collected for pickup orders`, `cancelled`, `pickup is decided by the shipping method key not the cart preset`, `timeline pickup has ready step`, `timeline ship has shipped step`, `pickup sentence names store and city`, `shipping sentence includes window from the store ship days`, `shipping sentence without window omits it`, `no sentence promises an email or a text message`, `totals come from taxedPrice`, `subscription line shows frequency and next date from the recurring order`, `subscription without a recurring order yet says being set up and shows no date`, `order number is the order's, never a literal` (a lint test greps `components/confirmation` for `AL-` and digits); `lib/ct/__tests__/orders-confirmation.test.ts`: `returns null for unknown number`, `uses the in-store endpoint`, `expands shipping method and state`, `recurring order lookup is by origin order`.

**P-04 Confirmation page UI** [SPEC: Confirmation states the next step; Order number comes from the order]
Server Component page: `await params`, read session, `getOrderForConfirmation`, `canViewOrder` (token from `searchParams.t`), else `notFound()`. Render, tokens only:
- `SuccessMark` (icon with `role="img"` and name), heading "Thanks, your order is in." (`h1`, focus target on load for screen readers), "Order {number}" (`font-variant-numeric` token), the next-step sentence, and the no-email note (D8).
- `OrderSummaryCard`: line image, brand, name, quantity, line total (a "Delivered every {frequency}" chip on subscription lines); Subtotal, savings (named), Delivery, tax label from the order's `taxedPrice` rate (never literal), Total.
- `DeliveryDetails`: pickup: branch name, address, hours, "Bring photo ID"; ship: the shipping address from the order.
- `NextStepTimeline` as an ordered list with `aria-current="step"`; `SubscriptionBlock` per D10.
- `CopyLink` (guests only: the private link with a Copy button and a Print button).
- `FollowUpActions`: Continue shopping (store home); signed in: View order to `/account/orders/{orderNumber}` (Q builds the target; until Q ships it returns 404, accepted); guest: `GuestAccountForm` (P-05).
- Layout: single column up to 680 px, two columns (details left, summary right) from 680 px. Print stylesheet hides the follow-up actions.
Tests `components/confirmation/__tests__/*.test.tsx`: `heading and order number render from props`, `pickup copy`, `shipping copy`, `no email or text promise anywhere on the page`, `no email note is shown`, `summary shows named savings and tax label`, `subscription chip and block render`, `pickup details show hours and ID reminder`, `shipping details show address`, `timeline marks current step`, `guest sees create account and copy link`, `signed in sees view order and no copy link`, `copy button copies the private link`, `axe clean in de-DE and en-US`, `no hard-coded currency or tax literal`. Page tests `app/[locale]/[store]/(shop)/checkout/confirmation/__tests__/page.test.tsx`: `other buyer gets 404`, `token holder sees order`, `refresh shows same order`, `unknown number gets 404`, `metadata is noindex and no-referrer`.

**P-05 Guest account creation** [SKILL: commercetools-storefront] [SPEC: Follow-up actions › Guest account offer]
`lib/ct/customers.ts` (server-only): `createStoreCustomer(storeKey, { email, password, firstName?, lastName? })` through `apiRoot.inStoreKeyWithStoreKeyValue({ storeKey }).customers().post(...)` with the seed's custom type `malva-customer` (never created here; fields `garage`, `preferredBranchKey`, `mobile`, `marketingConsent`, `marketingConsentAt`, `lastActiveAt`; the claim sets none of them, an empty garage is written only by J); `deleteCustomer(id, version)`. `claimOrder(storeKey, orderId, customerId)` sets `setCustomerId` through a retry on 409.
Route `POST /api/orders/[orderNumber]/claim` body `{ password, token? }`: authorize with `canViewOrder` (token or same browser); refuse when the order already has a `customerId` (409 generic); validate the password with `lib/auth/password-policy.ts` (message names the rule); create the customer in the order's store (name from the order's shipping address); `claimOrder`; on `claimOrder` failure call `deleteCustomer` and return 500 generic; then `signIn` (N) with the session `anonymousId`, write `customerId`, run `runSignInHooks`, respond `{ ok: true }`. Duplicate email in this store: generic 409 "We could not create the account. Try signing in." Rate limited like login.
Tests `app/api/orders/__tests__/claim.route.test.ts`: `creates customer in the order store and attaches order`, `only a password is required`, `weak password names the rule`, `order with a customer is refused generically`, `stranger without token is refused`, `duplicate email gives generic message and creates nothing`, `claim failure deletes the new customer`, `signs the shopper in and sets session`, `rate limited`. Policy tests `lib/auth/__tests__/password-policy.test.ts`: `rejects shorter than 10`, `rejects common password`, `accepts a long passphrase`.

**P-06 Return alias** [SKILL: commercetools-checkout] [SPEC: Order number comes from the order]
O owns the registered return URL `/checkout/return` (the Application has one). The store-scoped `confirmation/page.tsx` (no number segment) accepts `?orderId=` (or `?orderNumber=`) for the SDK's `checkout_completed` navigation and calls O's `resolveReturn`, then `redirect`s to the numbered URL; the buyer rule applies (token is absent, so (a) or (b) must hold). Tests `__tests__/return.test.ts`: `orderId redirects to numbered url`, `stranger gets 404`, `missing parameters gets 404`, `uses the same resolver as the return route`.

**P-07 Messages** [SPEC: all]
Keys under `confirmation.*` in both catalogs (German flagged for M-P02).

**P-08 Live verification** (sections 9 and 10).

## 8. Test-first scenario map

| Spec scenario | First failing test |
| --- | --- |
| Pickup | `pickup sentence names store and city`; component `pickup copy` |
| Shipping | `shipping sentence includes window from the store ship days`; component `shipping copy` |
| Refresh | `refresh shows same order`; `other buyer gets 404` |
| Guest account offer | `creates customer in the order store and attaches order`; `only a password is required` |
| Order number from the order | `order number is the order's, never a literal` |
| No emails (Q-P01) | `no sentence promises an email or a text message`; `no email or text promise anywhere on the page` |

## 9. Browser recipe (Chrome DevTools MCP; evidence under `plans/evidence/P/`)

Use order numbers created by O's recipe or O's dev-only completion helper (guest pickup `qa-p1@example.com`, guest ship `qa-p2@example.com`, signed-in pickup with the seeded shopper, one order with a subscription line). `{storeA}` from `read_stores`.

1. Confirmation immediately after the hosted checkout returns: heading "Thanks, your order is in.", order number equal to the URL, sentence with store name and city, the no-email note, summary, pickup details (address, hours, "Bring photo ID"), timeline with step 1 current, Continue shopping, Create account (email shown, password only), Copy link. Screenshots `P-01-pickup-<w>.png` for w in 375, 768, 1024, 1440.
2. Reload the page: same order. Open the URL in a second browser context (`new_page`, isolated) **without** the `?t=` token: 404 page. With the token from the guest's URL (Copy link): the order shows. Screenshots `P-02-stranger-404.png`, `P-02-token-ok.png`.
3. Shipping order: sentence says shipping from the store with the window text from the store ship days ("2-3 business days"); details show the address entered in the hosted checkout; timeline "Shipped" upcoming. A pickup order where the shopper switched to shipping in the hosted page shows the shipping view (D5). Screenshot `P-03-ship-<w>.png`.
4. Create account: enter a weak password (message names the rule), then a strong one: header shows signed in, the page now offers View order and no Copy link, and `/account` (Q) is reachable. MCP check below.
5. Signed-in order: View order link present, no Create account.
6. Subscription order: the line chip and the subscription block show the frequency; the next date appears once the recurring order exists (MCP `read_recurring_orders`), or "being set up" before.
7. Language and currency: `/de-DE/{storeA}/checkout/confirmation/...` German strings, euro formatting; en-US formatting per store configuration; no literal tax label.
8. Print preview (`emulate` print media if available, else screenshot and keep the unit test): follow-up actions hidden.
9. `list_console_messages` clean; `list_network_requests` shows no commercetools host calls and no request that sends mail.
Each viewport: no horizontal scroll, heading is the first focus target for a screen reader (`take_snapshot` shows `h1`), tab order sane.

## 10. `b2b2c-automotive` MCP checks (read only; excerpts to `plans/evidence/P/`)

1. `read_orders` by number: same number as on screen; `customerId` absent for a guest before step 4 and equal to the new customer after; `customerEmail`; `custom.pickupBranchKey`; `shippingInfo.shippingMethodName`.
2. `read_customers` for the claimed email: `stores` contains `{storeA}` only; `isEmailVerified` false; custom `malva-customer` present; the same email is **not** found for `{storeB}`.
3. `read_recurring_orders` for the subscription order: the policy equals the line's `recurrenceInfo`; `nextOrderAt` equals the date on the page.
4. `read_messages`: no assumption is made about messages; none is consumed by the storefront (there is no subscriber).
5. Cleanup: delete the test customers created by the claim flow through a small script `scripts/dev-delete-test-customers.ts` that refuses emails not ending in `@example.com` (tests: `refuses non example.com customers`, `deletes only customers of the given store`); orders are cleaned by O's script.

## 11. Definition of done

- [ ] Tasks P-01 to P-07 done; P-08 recorded or marked pending (no order available); every named test exists, was written first, passes.
- [ ] `npm run check` green in `storefront/`.
- [ ] No `connectors/` directory, no outbox, no mail provider code, no `STOREFRONT_ORIGIN` mail links, no text or email promise in any message catalog (`grep -rniE "email you|text you|we.ll email|we.ll text" messages components` returns nothing).
- [ ] Browser recipe 1 to 9 at 375, 768, 1024, 1440; console clean; screenshots saved.
- [ ] MCP read-back matches section 10; test data removed.
- [ ] G7 contributions: browse to cart to checkout to confirmation round trip works and the order exists in the project (with O).
- [ ] Questions in `plans/notes/questions-NOPQ.md`: Q-P01 answered (no emails), Q-P02, Q-P03, Q-P06 removed as obsolete, Q-P04 and Q-P05 kept; manual rows handed over.

## 12. Manual items (owner; Claude never waits on them)

For `plans/TODO-MANUAL-TESTING.md` (the lead merges these rows):

| Row id | Item | Owner action |
| --- | --- | --- |
| ~~email-provider action~~ | removed | No email provider is needed: the project sends no emails (Q-P01). |
| ~~M-P01~~ | removed | There is no connector to deploy. |
| M-P02 | Review de-DE strings under `confirmation.*` | Native speaker |
| ~~M-P03~~ | removed | There is no email to check in a mail client. |

## 13. Evidence to leave

`plans/evidence/P/`: screenshots named above, `P-mcp.txt` with excerpts, final `npm run check` summary line.

## Progress

- 2026-10-12 (J21): P-02 to P-07 built test first. `npm run check` (1709+ tests) and `npm run verify:build` (offline dummy env incl. `ORDER_ACCESS_SECRET`, fake `CTP_CHECKOUT_APP_KEY`) green. P-08 run offline with a headless Chrome over the DevTools protocol against a local stand-in (`plans/evidence/P/README.md`). P-01 (MCP read-back) and plan section 10 are pending (no live calls): `MISSED-FEATURES.md`.
- Done: `lib/order-access.ts` (replaces O's stub; `ORDER_ACCESS_SECRET`, audience `order-view`, claims `oid`/`sk`, signatures kept, plus `verifyOrderAccessToken`), `lib/env.ts` (`getOrderAccessSecret`, required at start), `lib/auth/{password-policy,common-passwords}.ts`, `lib/ct/orders.ts` (+`getOrderForConfirmation`, `getRecurringOrderForOrder`, `claimOrder`), `lib/ct/customers.ts` (`createStoreCustomer`, `deleteCustomer`, `DuplicateCustomerError`), `lib/mappers/order.ts` (+ pure `lib/order/next-step.ts`), `app/[locale]/[store]/checkout/confirmation/[orderNumber]/page.tsx`, `.../confirmation/route.ts` (alias), `app/api/orders/[orderNumber]/claim/route.ts`, `hooks/useClaimOrder.ts`, `components/order/*`, messages `order.*`, `next.config.ts` (private headers for the confirmation path), `.env.example`, README.
- Deviations: components live in `components/order/` and messages under `order.*` (lead's instruction); no `(shop)` group; the alias is a Route Handler (Q-P09); claim body has `store` (Q-P08); `ORDER_ACCESS_SECRET` is required by `validateEnv` (Q-P07); the order's `anonymousId` and the session's `anonymousId` match for the browser that placed it; `scripts/dev-delete-test-customers` (plan section 10 step 5) is not built (no live project in this run; M-P06 says to delete by hand); existing test `next.config.csp.test.ts` no longer asserts exactly one header rule.
- Tests: `lib/order-access.test.ts`, `lib/auth/password-policy.test.ts`, `lib/mappers/order.test.ts`, `lib/ct/orders-confirmation.test.ts`, `lib/ct/customers.test.ts`, `lib/order/no-mail.test.ts`, `components/order/order-components.test.tsx`, page, alias and claim route tests.
