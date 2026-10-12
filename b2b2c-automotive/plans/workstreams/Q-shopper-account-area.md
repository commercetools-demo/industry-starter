<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream Q: Shopper account area

Status: DRAFT v2 (2026-10-12, updated after the owner interview: no emails Q-P01, subscriptions sold Q-Q06, Stripe through Checkout Q-012, garage Q-J04, returns Q-Q01). Primary spec: `cs/design-account-area`. App: `b2b2c-automotive/storefront/`. Paths are relative to `b2b2c-automotive/storefront/` unless they start with `plans/`. There is no connector in this project.

## 1. Goal

A signed-in shopper has one place for their orders, garage, addresses, payment methods, subscriptions, returns and profile under `/{locale}/{storeKey}/account`. Shoppers can register, sign in and reset a password (**on screen only: the project sends no emails**); each account belongs to the reseller store where it was created; the anonymous cart and garage merge at sign-in without duplicates; subscriptions bought on the product page are managed here (skip, pause, change frequency, cancel). The area is **not in the supplied designs**: you build it in the same visual system (tokens, 44 px fields, Archivo links, bordered white panels) from the layout in the spec, and the owner signs the screens off through SO-01.

## 2. Depends on

G, I, P (as in DEPENDENCY-PLAN), and through them N (login with cart merge, `useAccount`, `signIn`, `registerSignInHook`), O (custom types, `deliveredAt` field, Checkout-created orders and recurring orders), P (`mapOrderStatus`, `lib/auth/password-policy.ts`, `createStoreCustomer`), J (garage hooks and vehicle components, max 5 vehicles).

Owner prerequisites: none to build. Live subscription checks need an order with a subscription line, which needs OA-05 (O); until then the subscription pages are tested with fixtures and, where O's dev-only completion helper made a recurring cart, with that order. There is no email-provider owner action (no email provider exists).

## 3. Specs and requirements implemented

Primary: `openspec/specs/consumer-storefront/design-account-area/spec.md`

| Requirement title (verbatim) | Scenarios | Tasks |
| --- | --- | --- |
| Sign in, register, reset | Account bound to a reseller; Anonymous cart and garage merge | Q-02, Q-03, Q-04 |
| Account home | Order ready | Q-05 |
| Orders and returns | Return request | Q-06, Q-07 |
| Garage | Last vehicle removed | Q-08 |
| Addresses, payment methods, profile, security | Default address | Q-09, Q-10, Q-11 |
| Subscriptions | Skip (plus pause, change frequency, cancel by owner answer Q-Q06) | Q-12 |

Secondary: `bootstrap-and-structure` requirements "Stateless session", "Store resolved from the path" (customer bound to a store), "Client state"; `design-vehicle-finder-and-garage` › "Garage persists across sessions" › scenario "Merge at sign-in" (hook registered here; storage is J's); `seller-portal/design-returns-and-reviews` › "Record a return" and "Return lifecycle" and `design-customers-and-subscriptions` › "Subscriptions" (read to match the data the portal expects; V builds the portal side, see `DEPENDENCY-PLAN.md`).

## 4. Decisions already taken (do not reopen)

| # | Decision | Source |
| --- | --- | --- |
| D1 | Customers are created and signed in **in the store scope** (`inStoreKeyWithStoreKeyValue({ storeKey }).customers().post(...)` and `.login()`), so a customer of reseller A cannot sign in at B. Every sign-in failure returns one generic message. | spec "Account bound to a reseller"; bootstrap "Customer bound to a store"; N task N-08 |
| D2 | Account pages are protected by a **server-side** guard in the account layout (`getSession()`, redirect to `/account/sign-in?next=<locale-less path>`), plus `useAccount` for UI state. Auth pages live outside the protected layout in the route group `(auth)`. | skill `b2c/customer-auth.md` (protected layout), adapted to server guard |
| D3 | Every account query is scoped by `customerId` from the session and the store; never from the request. Cross-customer access returns 404. | skill `b2c/optional/recurring-orders.md` scoping rule |
| D4 | **Password reset is on screen only** (owner answers Q-P01 and the follow-up: no emails, reset via the commercetools password token shown and consumed in the app, for the demo). The forgot-password route calls the in-store password-token endpoint (`ttlMinutes: 30`) and **returns the reset link in the response**; the page shows it as "Demo: no email is sent. Open this link to choose a new password." For an unknown email the route returns a response of the same shape with a random look-alike token (same length and format) that fails on use with the generic invalid-token message, so the response shape does not reveal whether an account exists. **Security trade-off, owner-acknowledged (M-Q02):** anyone who knows an email address can reset that account's password in this demo; therefore the behaviour is behind `DEMO_ONSCREEN_RESET=true` (default true outside production) and a production build with it on also needs `DEMO_RESET_ACKNOWLEDGED=true` (build gate `scripts/check-demo-reset.mjs`, prints a notice), and the page always carries the demo notice. No connector, no Subscription, no outbox. | owner-answers Q-P01; spec "do not reveal whether an email exists" (kept at response-shape level) |
| D5 | Registration collects email, password (P's policy), first and last name and an unchecked marketing-consent box; it signs in immediately with cart merge, then runs the sign-in hooks (garage merge). | skill `b2c/customer-auth.md` "Register" |
| D6 | Return request uses the order update action `addReturnInfo` (item `shipmentState: 'Advised'`, generated `returnTrackingId` `RT-` plus 8 characters, and the seeded custom type `malva-return-item` on each item with `custom.fields` `returnNumber` (the same `RT-` value), `status: 'requested'` and `reason`; `refundCents` and `rejectReason` are written by the portal, W/V; status values `requested`, `in-transit`, `received`, `inspected`, `refunded`, `rejected`). Window **30 days from delivery** (owner-confirmed default, Q-Q01): `store-settings.returnWindowDays` of the order's store (seeded 30; default 30 when absent), counted from order `custom.deliveredAt` (type `malva-checkout`, the portal sets it), fallback `lastModifiedAt`. Eligible orders: status `delivered` or `collected` (P's `mapOrderStatus`). Refunds are made by the portal against the Stripe payment (W), not here. | spec "Return request"; portal returns spec; owner-answers Q-Q01 |
| D7 | "Ready for pickup" is order state key `ready-for-pickup` (seed-owned; P-01 only checks it); the account home notice is driven by it. Question Q-Q03. | spec "Order ready" |
| D8 | Invoice download is a printable HTML page (`@media print`), invoice reference equals the order number; no PDF library. Question Q-Q02. | spec "invoice download" |
| D9 | Saved payment methods: the page lists the customer's commercetools `PaymentMethod` resources (tokenised only, created by Checkout and the Stripe connector when a payment method is stored, for example for a subscription) and allows delete. There is no Add button: methods are saved inside the hosted checkout (O). The empty state says so. Deleting a method that backs an active subscription is blocked with a message when the recurring order exposes its payment method (Q-12 checks which field does), otherwise a warning text is shown before delete. Question Q-Q04. | skill `commercetools-commerce-patterns` `payments.md` (PaymentMethod); docs "Recurring Orders in Checkout" |
| D10 | **Subscriptions are sold and managed here** (owner answer Q-Q06): customers subscribe on the product page (M) and pay through hosted Checkout (O); the account lists their recurring orders with status, frequency (recurrence policy), next renewal date and items, and offers **skip, pause, resume, change frequency and cancel**. The menu item is always shown when subscriptions are purchasable (`SUBSCRIPTIONS_PURCHASE_ENABLED`) or the customer has recurring orders; the empty state says "You have no subscriptions yet. Look for Subscribe and save on eligible parts." | owner-answers Q-Q06; skill `b2c/optional/recurring-orders.md` |
| D11 | Delete account anonymises (name, email, addresses, custom fields; locks credentials; cancels subscriptions; clears garage) and signs out; orders are retained, as the reseller's retention rules need. Question Q-Q05; legal check M-Q03. | spec "delete account with the reseller's retention rules" |
| D12 | Profile email change uses `changeEmail`; mobile and marketing consent are custom fields of the seeded type `malva-customer` (`mobile`, `marketingConsent`, `marketingConsentAt`; the same type also holds `garage`, `preferredBranchKey`, `lastActiveAt`, which profile writes never touch except `preferredBranchKey` and `lastActiveAt` set by the storefront); consent change writes `marketingConsentAt`. Consent is recorded for the portal's Marketing screens, which never send anything (no emails in this project), so the profile text says "We do not send marketing email in this demo; your choice is saved." | portal marketing spec "Consent"; owner-answers Q-P01 |
| D13 | Menu: Overview, Orders, Garage, Addresses, Payment methods, Subscriptions, Returns, Profile; a `select` replaces the menu under 700 px. | spec "Layout (proposed)" |
| D14 | Hooks only in components; SWR keys in `lib/cache-keys.ts`; types from `lib/types.ts`; no SDK types in components. | bootstrap spec |
| D15 | Locale-less `next` return path validated by `safeNext()` (same-site, no `//`, no scheme, no backslash). | precedent `b2b-manufacturing` workstream N-06 |

## 5. Before you start (read-only; never wait silently)

1. `npm run check` green; N and P merged. `grep -rn "registerSignInHook\|mapOrderStatus\|password-policy\|createStoreCustomer" lib` shows all four.
2. Read J's garage module: `ls hooks components/vehicle lib/ct/vehicles.ts` and note its API (`useGarage()` shape). You need `vehicles`, `active`, `add`, `remove`, `rename`, `setActive`. If `rename` is missing, add it **inside J's module with its test** and say so in your report.
3. MCP read-only: `read_types` (`malva-customer`, `malva-return-item`, `malva-checkout` including `deliveredAt`; all seed-owned, report any missing field to the D/F owners, never add it from here), `read_states` (`ready-for-pickup`), `read_stores` (`store-settings.returnWindowDays`, 30), `read_recurrence_policies` (`mau-rp-monthly`, `mau-rp-quarterly`, `mau-rp-half-yearly`), `read_recurring_orders`, `read_customers`.
4. Designs are missing (SO-01). Build from the spec layout; do not wait; record screenshots for the owner.

## 6. Files you will create or change

```
lib/types.ts                                  # AccountCustomer, OrderListItem, ReturnRequestInput, Address, SubscriptionView
lib/ct/customers.ts                           # add: registerCustomer, updateProfile, changePassword, requestPasswordReset, resetPassword, anonymiseCustomer
lib/ct/addresses.ts                           # list/add/change/remove/setDefault
lib/ct/account-orders.ts                      # listOrders, getOrder, requestReturn, listReturns
lib/ct/payment-methods.ts                     # list, delete
lib/ct/subscriptions.ts                       # list, get, skip, pause, resume, cancel
lib/ct/states.ts                              # getStateId(key) cached
lib/auth/safe-next.ts
lib/auth/garage-merge-hook.ts                 # registers the garage merge sign-in hook
app/[locale]/[store]/(auth)/account/{sign-in,register,forgot-password,reset-password}/page.tsx
app/[locale]/[store]/(account)/account/layout.tsx          # server guard and two-column shell
app/[locale]/[store]/(account)/account/page.tsx            # overview
app/[locale]/[store]/(account)/account/orders/page.tsx, orders/[orderNumber]/page.tsx, orders/[orderNumber]/return/page.tsx, orders/[orderNumber]/invoice/page.tsx
app/[locale]/[store]/(account)/account/{garage,addresses,payment-methods,subscriptions,returns,profile}/page.tsx
app/api/auth/{register,forgot-password,reset-password}/route.ts      # login, logout, me exist from N
app/api/account/{orders,orders/[orderNumber]/return,returns,addresses,addresses/[id],payment-methods,payment-methods/[id],subscriptions,subscriptions/[id],profile,password,delete}/route.ts
hooks/{useOrders,useAddresses,useReturns,usePaymentMethods,useSubscriptions,useProfile}.ts
components/account/{AccountShell,AccountMenu,OverviewPanel,PickupReadyNotice,OrderList,OrderDetail,ReturnForm,InvoicePrint,AddressBook,AddressForm,PaymentMethodsPanel,SubscriptionList,ProfileForm,PasswordForm,DeleteAccountPanel,AuthForm}.tsx
lib/auth/demo-reset.ts                                               # decoy token generator, flag helpers (D4)
scripts/check-demo-reset.mjs                                         # production build gate for the on-screen reset (D4)
lib/ct/recurrence-policies.ts                                        # (from M) read for the change-frequency select
messages/de-DE.json, messages/en-US.json                             # keys under "account.*"
```

## 7. Tasks (tests first, red before green)

**Q-01 Account shell, guard, menu** [SKILL: commercetools-storefront] [SPEC: Layout; Account home]
`(account)/account/layout.tsx`: Server Component; `getSession()`; no `customerId` redirects to sign-in with `next` (locale-less, via `safeNext`); signed in renders `AccountShell` (two columns from 700 px: menu left, panels right; below 700 px the menu becomes a labelled `select` that navigates). The Subscriptions menu item shows when `GET /api/account/subscriptions` says `offered` (D10: purchasable or the customer has recurring orders). `lib/auth/safe-next.ts`: `safeNext(value: string | null): string` returns `/account` for anything unsafe.
Tests `lib/auth/__tests__/safe-next.test.ts`: `accepts /account/orders`, `rejects //evil.example`, `rejects https://evil.example`, `rejects backslash tricks`, `rejects empty`. `components/account/__tests__/AccountMenu.test.tsx`: `menu lists the eight items in order`, `select replaces menu under 700`, `current page has aria-current`, `subscriptions item shown when purchasable`, `subscriptions item hidden when not purchasable and no recurring orders`. Layout test: `signed out redirects with next`, `signed in renders children`.

**Q-02 Sign-in page and store-bound login** [SKILL: commercetools-storefront] [SPEC: Sign in, register, reset › Account bound to a reseller]
Page `(auth)/account/sign-in`: `AuthForm` (email, password, Sign in, links to Register and Forgot password); `next` handled with `safeNext`; error text is one string for all failures; focus moves to the error. N's `POST /api/auth/login` already does the merge; here add UI and extend N's tests with the scenario.
Tests: `components/account/__tests__/AuthForm.test.tsx`: `sign-in shows one generic error`, `error receives focus`, `labels and autocomplete attributes`, `axe clean`; `app/api/auth/__tests__/login-store-binding.test.ts`: `customer of another store gets the generic message` (mock `inStoreKey.login` to return InvalidCredentials), `message equals wrong-password message`.

**Q-03 Register** [SKILL: commercetools-storefront] [SPEC: Sign in, register, reset]
`lib/ct/customers.ts` `registerCustomer(storeKey, input)`: P's `createStoreCustomer` + `signIn` with `anonymousCartId`/`anonymousId` (N) in one function; consent writes custom fields `marketingConsent` and `marketingConsentAt`. Route `POST /api/auth/register` (zod; password policy from P; rate limit). Duplicate email in this store: generic body "We could not create the account. Try signing in." (same as P-06) and nothing created. After success: session `customerId`, `cartId` set; `runSignInHooks`.
Tests `lib/ct/__tests__/customers-register.test.ts`: `creates the customer in the store`, `signs in with anonymous cart and id`, `consent unchecked writes false and no date`, `consent checked writes date`, `duplicate email creates nothing and gives generic message`, `weak password names the rule`; route tests: `sets session`, `rate limited`, `400 on bad body`.

**Q-04 Password reset, on screen only** [SKILL: commercetools-storefront] [SPEC: Sign in, register, reset]
Routes: `POST /api/auth/forgot-password` `{ email }`: when `DEMO_ONSCREEN_RESET` is on, calls in-store `customers/password-token` with `ttlMinutes: 30` and answers 200 `{ ok: true, resetPath: '/{locale}/{store}/account/reset-password?token=<value>', demo: true }`; for an unknown email, another store's customer or a rate-limit hit it answers the **same shape and status** with a decoy token from `lib/auth/demo-reset.ts` (random, same length and alphabet as a real token, never valid; log internally without the email or token). When the flag is off the route answers `{ ok: true }` and nothing else (no reset is possible; the page says "Password reset is not available"). `POST /api/auth/reset-password` `{ token, password }`: in-store `customers/password/reset`; invalid, decoy or expired token returns one generic 400; password policy applies; on success redirect to sign-in with a notice (so a leaked link cannot create a session). Pages `forgot-password` (shows the returned link as a button and the notice "Demo: no email is sent. Open this link to choose a new password.") and `reset-password?token=` (page sets `Referrer-Policy: no-referrer`, `noindex`). `scripts/check-demo-reset.mjs` fails a production build with `DEMO_ONSCREEN_RESET=true` unless `DEMO_RESET_ACKNOWLEDGED=true` and prints a notice when both are set; `.env.example` lists both with reasons. The token is never logged and never written to a cookie or URL of the forgot page.
Tests: `forgot-password known email returns a reset path with a real token`, `forgot-password unknown email returns the same shape and status with a decoy`, `decoy has the length and alphabet of a real token`, `decoy token fails on reset with the generic message`, `forgot-password calls in-store token endpoint with ttl 30`, `forgot-password rate limited per email returns the same shape`, `flag off returns no reset path`, `reset with bad token gives generic 400`, `reset weak password names rule`, `reset success redirects to sign-in`, `reset page is noindex no-referrer`, `token never appears in logs` (spy on logger), `demo notice is rendered on the forgot page`; gate script tests: `production with the flag and no acknowledgement fails`, `production with both passes and prints a notice`, `development passes`.

**Q-05 Garage merge hook and account home** [SKILL: commercetools-storefront] [SPEC: Anonymous cart and garage merge; Account home › Order ready]
`lib/auth/garage-merge-hook.ts` registers with N's `registerSignInHook` a hook that calls J's `mergeGarageOnSignIn` (account garage = `malva-customer.garage` JSON `{ vehicles: [{ id, make, model, year, engine, fitmentKey }], activeId }` plus the anonymous garage cookie of the same shape, without duplicates, previously active vehicle stays active, at most 5). Import it once from the root of the BFF (`lib/auth/index.ts`) so it is always registered. Overview `OverviewPanel`: greeting with first name, active vehicle chip (J) with Change link, latest order status line from `mapOrderStatus`, quick links to Orders, Garage, Addresses, and `PickupReadyNotice` (store name, hours, order number) for orders whose state key is `ready-for-pickup` (query by state id from `lib/ct/states.ts`, scoped by `customerId`).
Tests: `lib/auth/__tests__/garage-merge-hook.test.ts`: `anonymous garage merges into account without duplicates`, `previously active vehicle stays active`, `hook failure does not fail sign-in`; `components/account/__tests__/OverviewPanel.test.tsx`: `greets by first name`, `shows active vehicle`, `shows latest order status`, `no vehicle shows prompt to choose one`, `ready order shows top notice with store hours and number`, `no ready order shows no notice`.

**Q-06 Orders list, detail, invoice** [SKILL: commercetools-storefront] [SPEC: Orders and returns]
`lib/ct/account-orders.ts`: `listOrders(storeKey, customerId, { page, pageSize = 10 })` using in-store `orders().get({ queryArgs: { where: \`customerId="${customerId}"\`, sort: 'createdAt desc', limit, offset, withTotal: true } })` (build the predicate with a helper that rejects ids not matching `^[0-9a-f-]{36}$`); `getOrder(storeKey, customerId, orderNumber)` returns null when the order's customer differs. Orders list page with status chip (`mapOrderStatus`), number, date, total, pagination (previous and next links, `aria-label`). Detail page: lines (subscription lines show their frequency), delivery or pickup block (reuse P's `DeliveryDetails`), totals, payment line ("Paid by card" with the brand and last four when the Stripe payment carries them, else "Paid online"; no "pay at pickup" or "invoice" wording exists), Download invoice link, Request a return button (only when eligible, Q-07). Invoice page `/account/orders/[orderNumber]/invoice`: seller (store name, branch address), buyer, lines, tax breakdown from `taxedPrice`, total, a Print button (`window.print()`), print stylesheet with tokens, `noindex`.
Tests: `lib/ct/__tests__/account-orders.test.ts`: `list is scoped by customer and store`, `list sorts newest first`, `predicate rejects a malformed id`, `detail of another customer is null`; component tests: `OrderList renders status chips`, `pagination links`, `OrderDetail shows pickup info`, `OrderDetail shows invoice link`, `InvoicePrint shows tax label from order`, `no hard-coded currency or tax literal in components/account`; page test: `detail of another customer gives 404`.

**Q-07 Returns** [SKILL: commercetools-commerce-patterns] [SPEC: Orders and returns › Return request]
`requestReturn(storeKey, customerId, orderNumber, { items: [{ lineItemId, quantity, reason, comment? }] })`: loads the order (customer-scoped), checks eligibility (D6: status, window, quantity not above ordered minus already returned or advised), then order update `addReturnInfo` with `returnTrackingId`, `returnDate` now, items `{ lineItemId, quantity, comment, shipmentState: 'Advised', custom: { type: { typeId: 'type', key: 'malva-return-item' }, fields: { returnNumber: <the returnTrackingId>, status: 'requested', reason } } }` through version retry (the type is seed-owned and must exist; the seed lists it as unverified against the live API for `order-return-item`, so Q-14 records the first live result). Reasons (message keys): `wrong-fit`, `defective`, `not-needed`, `other`. `listReturns(customerId)` flattens `returnInfo` of the customer's orders. `ReturnForm`: select lines and quantities, reason, comment, submit; confirmation "Return {tracking} requested". The Returns page lists them with status mapped from item `shipmentState` and the order link. A `wrong-fit` return also keeps the order's `custom.fitVehicleLabel` visible to the portal (O writes it; nothing to do here beyond a test that it is untouched).
Tests `lib/ct/__tests__/account-returns.test.ts`: `return of one line records reason and quantity`, `outside the window is refused`, `not delivered is refused`, `quantity above remaining is refused`, `second identical request for the full quantity is refused`, `other customer's order is refused`, `tracking id format`, `addReturnInfo uses type malva-return-item with returnNumber, status requested and reason`, `window reads store-settings returnWindowDays with default 30`, `window counts from deliveredAt (30 days from delivery)`, `day 31 after delivery is refused and day 30 is allowed`; form tests: `needs at least one line`, `reason required`, `shows tracking after success`.

**Q-08 Garage page** [SKILL: commercetools-storefront] [SPEC: Garage]
Page uses J's `useGarage()` and vehicle components: list vehicles with active marker, Add vehicle (J's selector or plate/VIN as J ships them), rename (inline, 40 characters; stored as the optional `nickname` key of the vehicle entry in the `malva-customer.garage` JSON, J's `GarageVehicle`, so no seed change; the anonymous cookie holds the same key), set active, remove with confirm. Removing the last vehicle leaves the app in the no-vehicle state (listing shows "Select your vehicle to check fit"). Signed-in storage is J's; this task only builds the page and the tests.
The garage holds at most 5 vehicles (J, Q-J04); Add vehicle is disabled with the message "Your garage is full. Remove a vehicle to add another." at five. Tests `components/account/__tests__/GaragePage.test.tsx`: `lists vehicles and marks active`, `sixth vehicle is refused with the full message`, `rename saves`, `set active changes chip`, `remove asks to confirm`, `last vehicle removed returns no-vehicle state` (assert `active` is null and the listing hint renders via the shared component), `empty garage shows add prompt`.

**Q-09 Addresses** [SKILL: commercetools-storefront] [SPEC: Addresses... › Default address]
`lib/ct/addresses.ts`: `listAddresses`, `addAddress` (actions `addAddress` then `addShippingAddressId` and optionally `setDefaultShippingAddress` with the new `addressId` found by diffing address ids), `changeAddress`, `removeAddress`, `setDefaultAddress`. Limit 20 addresses. Country restricted to `store.countries`; postal validation with O's `lib/address.ts`. `AddressBook` and `AddressForm`; the default address carries a chip.
Tests `lib/ct/__tests__/addresses.test.ts`: `add sets shipping id`, `set default uses setDefaultShippingAddress`, `removing default clears default`, `limit 20`, `country outside store refused`, `postal validated`; checkout integration (extends O's route test): `state preselects the default address after it is changed` (call `GET /api/checkout/state` with a customer fixture whose default is the second address).

**Q-10 Payment methods** [SKILL: commercetools-commerce-patterns] [SPEC: Addresses, payment methods, profile, security]
`lib/ct/payment-methods.ts`: `listPaymentMethods(customerId)` via `apiRoot.paymentMethods().get({ queryArgs: { where: 'customer(id="<id>")' } })` and `deletePaymentMethod(id, customerId)` that first checks ownership. Panel shows brand and last four if present in the token data, otherwise the method name; empty state: "No saved payment methods. Methods saved during checkout, for example for a subscription, appear here." (no Add button: methods are saved inside the hosted checkout). Delete is blocked, with a message, for a method used by an active subscription when the recurring order exposes it (D9).
Tests: `lists only own methods`, `delete refuses other customer`, `empty state has no add button`, `list never exposes raw token fields` (assert the mapper returns only id, label, last4, expiry), `delete of a method used by an active subscription is blocked`.

**Q-11 Profile and security** [SKILL: commercetools-storefront] [SPEC: Addresses, payment methods, profile, security]
`updateProfile` (actions `setFirstName`, `setLastName`, `changeEmail`, `setCustomField` mobile and consent with date), `changePassword` (in-store `customers/password` with `id`, `version`, `currentPassword`, `newPassword`; policy from P; wrong current password gives one message), `anonymiseCustomer(customerId)` for D11 (actions: `changeEmail` to `deleted+<8 chars>@deleted.invalid`, names to a neutral placeholder, `removeAddress` for each, clear custom fields; lock credentials by issuing a password token and resetting to a random 64-character value; cancel recurring orders; clear the session; clear the account garage via J). Route `POST /api/account/delete` requires the current password and the typed word from `messages` (`DELETE` localised) before acting; then signs out and redirects home with a notice.
Tests `lib/ct/__tests__/profile.test.ts`: `profile update sets names and mobile`, `consent change writes date`, `email change uses changeEmail and is rejected for taken email generically`, `wrong current password gives one message`, `weak new password names rule`, `anonymise removes addresses and email and keeps orders untouched` (assert no order update calls), `anonymise cancels subscriptions`, `anonymise requires current password`, `delete route signs out`.

**Q-12 Subscriptions (sold and managed)** [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns] [SPEC: Subscriptions]
`lib/ct/subscriptions.ts` per the B2C recurring-orders reference: list `where: customer(id="<id>") and store(key="<storeKey>")`, `expand: ['originOrder']`, fall back to `originOrder.obj.lineItems` when `lineItems` is empty, normalise `nextOrderAt` to `nextOrderDate` in the mapper, show the frequency from the recurrence policy of the line items (policy name localized, from `lib/ct/recurrence-policies.ts`), single `PUT /api/account/subscriptions/[id]` dispatching `action`: `skip` (`setOrderSkipConfiguration` with `skipConfigurationInputDraft: { type: 'Counter', totalToSkip: 1 }`), `pause`, `resume`, `cancel` (`setRecurringOrderState`), and `change-frequency` (body `{ action: 'change-frequency', policyKey }` with a key from the seeded policies `mau-rp-*`). **Before coding** confirm with the `commercetools-oas-schemata` tool (resource `api-RecurringOrder-write`) and the docs search the exact action names and state value shapes (including `'canceled'` single-l), and **which update action changes the recurrence policy or schedule of an existing recurring order** (candidates: `setSchedule`, an action that sets the policy reference); write them under section 13. If the API has no such action, `change-frequency` is hidden in the UI and the finding is recorded as a question row for the coordinator (never emulate it by cancelling and re-buying: that would need a new payment). `offered` is true when subscriptions are purchasable or the customer has recurring orders (D10). Page lists subscriptions with status badge, frequency, next renewal, items, and the actions Skip next delivery, Pause, Resume, Change frequency (select of the seeded policies, with confirm), Cancel (with confirm); a `Failed` recurring order (payment failure, see docs) shows a plain "Payment failed. Update your payment method, then resume." with a link to Payment methods and a Resume action.
Tests `lib/ct/__tests__/subscriptions.test.ts` (fixtures): `list is scoped by customer and store`, `line items fall back to origin order`, `nextOrderAt normalised`, `frequency comes from the recurrence policy name`, `skip sends counter skip of 1`, `pause resume cancel send state actions`, `change frequency sends the confirmed action with the policy`, `change frequency refuses an unknown policy key`, `other customer's subscription gives 404`, `offered is true when purchasable and false when disabled with no orders`, `skip moves displayed next date to the value returned by the API`, `failed order shows the payment message and a resume action`; component tests: `SubscriptionList shows status frequency and next renewal`, `skip and pause need no confirm, change frequency and cancel do`, `empty state invites to subscribe on eligible parts`.

**Q-13 States, copy, accessibility** [SPEC: Gaps (empty and error states)]
Every account page has loading (skeleton), empty and error states with plain messages and a retry; headings in order; `aria-live` for success banners; focus to page `h1` on navigation; forms use `autocomplete` tokens; messages under `account.*` in both catalogs (German flagged M-Q01).
Tests: `each account page renders an empty state` (table-driven over the eight pages), `each account page renders an error state with retry`, `axe clean for every page in de-DE and en-US`.

**Q-13a Demo login** [SKILL: commercetools-storefront] [SPEC: `consumer-storefront/design-demo-login`, all requirements]
Owner request 2026-10-12. Files: `storefront/lib/demo-login.ts`, `storefront/app/api/auth/demo-accounts/route.ts` (GET), `storefront/app/api/auth/demo-login/route.ts` (POST `{ customerId }`), `storefront/components/account/DemoLogin.tsx`, message keys `account.demoLogin.*` in `messages/de-DE.json` and `messages/en-US.json`, `scripts/check-no-demo-login.mjs` (build gate, added to `npm run check`).
1. `lib/demo-login.ts`: `isDemoLoginEnabled()` is true only when `DEMO_LOGIN_ENABLED === 'true'` and `NODE_ENV !== 'production'`. `listDemoShoppers(storeKey)` reads with the **admin** root: customers `where: stores(key="<storeKey>") and custom(fields(isDemo=true))`, limit 50, sorted by last name; returns `{ id, label }` only, label = "Name · Make Model Year" from `malva-customer.garage.vehicles[activeId]` (no email, no password, no custom fields). `demoSignIn(customerId, storeKey)` re-reads the same list, refuses an id not in it (403, log `demo-login denied`), reads the password from `process.env.DEMO_LOGIN_PASSWORD` (server only), and calls N's store-scoped `login` (the same function the form route uses, including the anonymous cart merge and J's garage merge hook), then sets the session exactly as a normal sign-in.
2. Routes: both return 404 when `isDemoLoginEnabled()` is false. GET has `Cache-Control: no-store`. POST validates the body with zod and takes `storeKey` from the URL path, never from the body.
3. `DemoLogin.tsx`: a labelled native `<select>` (`aria-describedby` for the error) and a button, below the email and password form on the sign-in page; button disabled until an option is chosen; loading text while the list loads; empty state "No demo accounts found. Run the seed."; inline `role="alert"` error "Demo sign-in failed. Try again."; theme tokens only; after success go to `next` (validated path) or the account overview.
4. `scripts/check-no-demo-login.mjs`: fails the build when `DEMO_LOGIN_ENABLED=true` and `NODE_ENV=production` or `VERCEL_ENV=production`, and when `DEMO_LOGIN_PASSWORD` appears in any file under `.next/static` (client bundle).
Tests (write first): `lib/__tests__/demo-login.test.ts`: `disabled flag returns 404 from both routes`, `list is scoped to the store`, `list never contains email or password`, `unlisted customer id is refused with 403 and no session`, `listed id signs in through the shared login and merges the cart`; `components/account/DemoLogin.test.tsx`: `button disabled until selection`, `empty state`, `error state announced`, `de-DE labels`; `scripts/check-no-demo-login.test.ts`: `fails in production with the flag`, `passes without the flag`.
Chrome recipe: with `DEMO_LOGIN_ENABLED=true` open `/en-US/<storeKey>/account/sign-in` at 375 and 1440 px, assert the dropdown lists only that store's shoppers, pick one with a saved vehicle, press the button, assert the account overview shows that shopper and the garage chip shows the vehicle; unset the flag, reload, assert the control and `GET /api/auth/demo-accounts` (404) are gone; grep the page source and the accounts response for the demo password (must be absent); save screenshots in `plans/evidence/Q/`.
Seed dependency: `malva-customer.isDemo` (Boolean) set true on the seeded shoppers: see `plans/notes/seed-requests.md` (row Q). Until the seed has it, fall back to key prefix `mau-cust-` plus email domain `@example.com` and record that in this file's notes.
Environment: add `DEMO_LOGIN_ENABLED` and `DEMO_LOGIN_PASSWORD` (the same value as the seed's `SEED_DEMO_PASSWORD`) to `storefront/.env.example` with no value.

**Q-14 Live verification** (sections 9 and 10).

## 8. Test-first scenario map

| Spec scenario | First failing test |
| --- | --- |
| Account bound to a reseller | `customer of another store gets the generic message` |
| Anonymous cart and garage merge | `passes anonymous cart with merge mode` (N) and `anonymous garage merges into account without duplicates` |
| Order ready | `ready order shows top notice with store hours and number` |
| Return request | `return of one line records reason and quantity` |
| Last vehicle removed | `last vehicle removed returns no-vehicle state` |
| Default address | `state preselects the default address after it is changed` |
| Skip | `skip sends counter skip of 1`; `skip moves displayed next date to the value returned by the API` |
| Subscriptions sold (Q-Q06): pause, change frequency, cancel | `pause resume cancel send state actions`; `change frequency sends the confirmed action with the policy` |
| Reset on screen (Q-P01) | `forgot-password unknown email returns the same shape and status with a decoy`; `decoy token fails on reset with the generic message` |

## 9. Browser recipe (Chrome DevTools MCP; evidence under `plans/evidence/Q/`)

`{storeA}` and `{storeB}` from `read_stores`. Fresh context first. Test emails `qa-q<n>@example.com`. Screenshots at 375, 768, 1024, 1440 named `Q-<step>-<page>-<w>.png`.

1. **Register** on `/en-US/{storeA}/account/register` after adding one part to the cart and selecting a vehicle as an anonymous shopper. Weak password: message names the rule. Valid: you land signed in on `/account`; header cart count still shows the part; the vehicle chip shows the vehicle (merge).
2. **Bound to a reseller**: sign out; on `/en-US/{storeB}/account/sign-in` use the same credentials: the generic message, identical to a wrong password. On `{storeA}` it works.
3. **Merge with existing data**: sign out, as anonymous add a different part and a second vehicle, sign in: cart shows both parts without duplicates, garage shows both vehicles, active vehicle unchanged.
4. **Reset (on screen)**: `/account/forgot-password` with the registered email and with an unknown email: both show the demo notice and a reset link of the same shape (compare lengths with `evaluate_script`; do not save the tokens in evidence). Open the real link, set a new password, redirect to sign-in, sign in with it. The same link again gives the generic invalid message; the decoy link from the unknown email gives the same generic message. `list_network_requests`: no request that sends mail exists.
5. **Overview**: greeting, active vehicle, latest order status, quick links. Set an order to `ready-for-pickup` through the MCP update tool only if a write tool is allowed in your session; otherwise use a seeded order already in that state; the top notice shows store, hours and number. If neither exists, record that fact and rely on the unit test (flag in report).
6. **Orders**: list with status chips, pagination (create 11 test orders is not required; verify paging with the unit test), detail with pickup block, invoice page printable (`emulate` print media in the screenshot via `emulate` colorScheme/media if available, otherwise screenshot the page and keep the unit test).
7. **Return**: use a delivered seeded or test order (set `shipmentState` Delivered through the portal later; if none exists mark this step "needs delivered order" and ask the coordinator through `plans/QUESTIONS.md`); request a return for one line with reason `wrong-fit`: tracking id shown; second attempt for the same quantity refused.
8. **Garage**: add, rename, set active, remove all vehicles; the listing then shows "Select your vehicle to check fit".
9. **Addresses**: add two, set the second default, open checkout with items in the cart: the second is preselected. Delete one.
10. **Payment methods**: empty state text and no Add button; after a subscription purchase through hosted Checkout (O, needs OA-05) the stored method is listed and its delete is blocked while the subscription is active.
11. **Profile and security**: change name and mobile; toggle marketing consent; change password with a wrong current password (one message) and a right one. Delete account on a throwaway account: signed out, signing in again fails generically, order still exists (MCP).
12. **Subscriptions**: with a subscription bought on the product page and paid through hosted Checkout (needs OA-05; else a recurring order from fixtures or O's dev helper), the page lists it with frequency and next renewal; Skip moves the date to the value from the API; Pause shows paused and Resume restores; Change frequency (when the API supports it) changes the policy; Cancel (confirm) shows cancelled. A customer with no subscriptions sees the invite empty state. Screenshots `Q-12-subscriptions-<w>.png`.
13. `list_console_messages` clean on every page; `list_network_requests` shows no commercetools hosts. At every viewport: no horizontal scroll, menu becomes a select under 700 px, tap targets at least 44 px, visible focus ring, keyboard-only pass through the menu and one form.

## 10. `b2b2c-automotive` MCP checks (read only; excerpts to `plans/evidence/Q/`)

1. `read_customers` for the registered email: `stores` has only `{storeA}`; `isEmailVerified` false; `custom.malva-customer` has `marketingConsent` as chosen; after step 9 `addresses` has the expected count and `defaultShippingAddressId` points to the second; after step 11 profile fields match.
2. `read_customers` for the same email in `{storeB}`: none.
3. `read_carts` after sign-in: the merged cart in `{storeA}` for the customer with both lines; the anonymous cart state `Merged`.
4. `read_messages`: a `CustomerPasswordTokenCreated` for the forgot-password call and none for the unknown email (the decoy never touches commercetools); no email-related object exists in the project (`read_custom_objects` has no `malva-email-*` container).
5. `read_recurring_orders` after each subscription action: `Skip` leaves `nextOrderAt` moved by one period and a skip configuration; pause gives the paused state, resume active, cancel the cancelled state; change frequency (if supported) shows the new policy.
6. `read_orders` after the return: `returnInfo[0].items[0]` has `shipmentState` `Advised`, `quantity`, `custom.fields.reason` `wrong-fit`, `custom.fields.status` `requested`, `custom.fields.returnNumber` equal to `returnTrackingId` and to the UI.
7. After account deletion: customer email replaced, addresses empty, orders still reference the customer id and are unchanged.
8. Cleanup: remove throwaway customers and orders through P's `scripts/dev-delete-test-customers.ts` and O's `scripts/dev-delete-test-orders.ts`; both refuse non-test data.

## 11. Definition of done

- [ ] Tasks Q-01 to Q-13 done, Q-14 recorded; every named test exists, was written first and passes.
- [ ] `npm run check` green in `storefront/` (no connector exists).
- [ ] Browser recipe 1 to 13 at 375, 768, 1024, 1440 with screenshots; console clean; steps that need data you could not create are listed in the report with the coordinator row added to `plans/QUESTIONS.md`.
- [ ] MCP read-back matches section 10; test data removed.
- [ ] No account query without `customerId` and store scope (grep test `no unscoped account query`: every `lib/ct/account-*.ts` function takes `customerId`).
- [ ] The on-screen reset returns the same shape for known and unknown emails (decoy tests), no token appears in logs, the production gate for `DEMO_ONSCREEN_RESET` passes, and the project sends no email of any kind.
- [ ] Subscriptions: skip, pause, resume, cancel (and change frequency if the API supports it, else recorded) proven by tests and, with an order available, by recipe step 12 and MCP check 5.
- [ ] No raw colour, font or px value in `components/account` (`check-tokens`).
- [ ] Questions Q-Q01 to Q-Q06 in `plans/notes/questions-NOPQ.md`; manual rows handed over.

## 12. Manual items (owner; Claude never waits on them)

For `plans/TODO-MANUAL-TESTING.md` (coordinator adds new rows):

| Row id | Item | Owner action |
| --- | --- | --- |
| SO-01 (existing) | Sign-off of the account screens built without a design | Owner reviews the screenshots in `plans/evidence/Q/` and approves or commissions designs |
| M-Q01 | Review de-DE strings under `account.*` | Native speaker |
| M-Q02 (**changed**) | Acknowledge the demo password reset | Owner confirms that the on-screen reset (the reset link is shown in the app, no email) lets anyone who knows an email address reset that account's password, and that this is acceptable for the demo only; the production build gate `DEMO_RESET_ACKNOWLEDGED=true` is set by the owner to deploy it. Replaces the old "real inbox check" row (no email provider action, no email exists). |
| M-Q03 | Legal read of the delete-account behaviour (anonymise, keep orders) and the privacy text on the profile page | Owner or legal |

## 13. Notes to fill in while working

- Exact recurring-order action names and state values confirmed from the OAS, including the action (if any) that changes the recurrence policy or schedule: _(write them)_.
- Which recurring order field exposes the payment method (for the delete-block rule in D9): _(write it)_.
- J's garage API names used: _(list)_; anything added to J's module: _(list)_.
- Steps of section 9 that could not run for lack of data (delivered or ready-for-pickup order): _(list)_.

## 14. Evidence to leave

`plans/evidence/Q/`: screenshots named above, `Q-mcp.txt` with excerpts, `Q-notes.md` only if you deviated, final `npm run check` summary line.
