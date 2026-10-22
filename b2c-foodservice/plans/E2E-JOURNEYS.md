<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# End-to-end journeys (workstream Q)

Scripts for the whole shopper experience, written to be run step by step with the **Chrome DevTools MCP** on a **release build** (`cd storefront && npm run build && npm run start`, `http://localhost:3000`) against the seeded Malva Coffee project, with the owner rows OA-01, OA-02, OA-04 (full hosted Checkout with Stripe and test card) done. Claude (or a junior) runs them and reads the result back from commercetools with the commercetools MCP (OA-06) or `cd seed && npm run verify` / a read-only script. The owner is needed only for credential rows and real-device rows.

## How to run

1. Record each journey in `plans/evidence/Q/journeys.md`: journey id, date, build commit, per step `observation`, screenshot file, and the read-back values (ids and numbers only, no personal data, no secrets). Screenshots: `plans/evidence/Q/<journey>-<step>-<375|1440>.png`.
2. Tools: `navigate_page`, `take_snapshot` (gives the `uid`s to click), `click`, `fill`, `fill_form`, `press_key`, `wait_for`, `evaluate_script`, `list_network_requests` and `get_network_request`, `list_console_messages`, `resize_page`, `emulate`, `take_screenshot`, `new_page` (use a fresh isolated context for a second shopper so cookies are not shared).
3. After **every** step: console has no error, no network request failed (4xx and 5xx are only allowed where the step says so), no layout overflow (`evaluate_script`: `document.documentElement.scrollWidth <= window.innerWidth`).
4. Run each journey at 1440x900; run J1-US, J1-CA, J2, J3, J8 and J12 again at 375x812.
5. **Test data**: every record a journey creates is synthetic. Customers `tst-<yyyymmdd>-<n>@example.com`; free text carries the prefix `TST-` (gift note, review title, contact message). Add one row per record to `plans/evidence/Q/test-data.md` as `| kind | id | note |` (orders and carts cannot be deleted; customers, reviews, recurring orders and shopping lists can, through the seed cleanup only). Never type a password into a note, URL or evidence file.
6. A failed step goes to `plans/evidence/Q/fixes.md` with the journey and step number; fix (small, with a test) or hand to the owning workstream through the lead; rerun the journey.

## Fixtures

| What | Value |
| --- | --- |
| Seeded shoppers (password `SEED_DEMO_PASSWORD`, never printed) | US `maya.okonkwo@example.com`, `liam.carter@example.com`; Canada: the two Canadian demo customers listed by the seed package (SEED-PLAN section 13). Customers are created verified; there is no email step anywhere |
| Stores (supply channels) | Six stores, all in New York City, US market only (D-035; keys in SEED-PLAN section 5, e.g. `mcf-store-nyc-soho`). Canada has no stores and no collection |
| Out-of-stock fixtures | SEED-PLAN section 8: two products out of stock at one store each; Q-04 records which SKU and store (`plans/evidence/Q/data-sweep.md`) and the journeys use them |
| Discount codes | `WELCOME10`, `FREESHIP`, `COFFEE15` |
| Test card | The Stripe test card documented by OA-04 (never written into evidence); a declined-card number from the same documentation for J15 |
| Route placeholders | Resolved once in Q-00 into `plans/evidence/Q/routes.md`: `{PLP}`, `{PDP:pod}`, `{PDP:coffee}`, `{PDP:machine}`, `{PDP:accessory}`, `{SEARCH}`, `{ACCOUNT}` |
| Tax and prices expected | SEED-PLAN sections 2, 3 and 9: both markets tax-exclusive; coffee and pods 0% in the US and Canada, standard goods 8% US (NY 8.875%) and 5% GST Canada (D-036); Canada free shipping above 99 CAD, US above 75 USD |

## J0 Shell, market and store persistence

Specs: `design-storefront-shell`, `design-store-picker-and-locale`, `design-home-page`.

1. Fresh context. `navigate_page http://localhost:3000/`: redirected to `/en-US`. Snapshot: promise bar with the US shipping threshold, collection promise and returns window; header with `Malva Coffee` wordmark, five primary links (pods, Coffee, Machines, Accessories, Gifts), store pill `Choose a store` (US market only), market pill, search, account, cart (no badge).
2. Hover `Coffee`: mega menu opens after the pointer enters; move off: it closes after about 130 ms; re-enter within that time: stays open. Click one entry: the listing opens with that category and facet applied.
3. Click the store pill: the picker lists the six New York City `InventorySupply` channels, nearest first. Choose `Brooklyn`: pill reads `Collect at Brooklyn`. Reload: still chosen (session).
4. Market pill: choose Canada: URL `/en-CA`, prices in CAD, the store pill and the store picker are **absent** (Canada is delivery only), promise bar shows free shipping above 99 CAD and no collection promise; Brooklyn is forgotten. Switch back to the US: the pill returns as `Choose a store`.
5. At 375 px: menu toggle appears under 820 px, the slide-in navigation opens, a link closes it and navigates; footer columns stack.
6. Footer: enter an invalid email in the newsletter field and press `Join`: inline error, no silent failure; enter `tst-1@example.com`: confirmation toast (F built the form as a validated no-op, Q-F-07: record that nothing is stored).

Read-back: none (no data written).

## J1 Guest buys a pod box: collect in the US (J1-US) and delivery in Canada (J1-CA)

Specs: `fulfilment-and-availability-model` (collect line, shipping, tax), `design-product-detail-page`, `design-cart-drawer`, `design-checkout-page`, `checkout`, `design-order-confirmation-page`, `order-confirmation-page`.

Run twice, fresh context each time, **not signed in**. J1-US: `/en-US`, store Brooklyn, USD, **collect**. J1-CA: `/en-CA`, CAD, **ship only** (no store picker, no Collect card; the PDP offers Ship and Subscribe only). Collect journeys are US only because all stores are in New York City.

1. Open `{PDP:pod}` (an Original or Vertuo pod). Choose the machine system, the 50-capsule box. Snapshot: price and unit price per capsule. US: Collect card selected by default when a store is chosen, status dot and text `In stock at <store>` with readiness minutes. Canada: no Collect card, Ship selected.
2. US: choose a store (if not chosen) and press `Reserve for collection` (label includes the line total). Canada: press `Add to bag` (Ship). Toast `Added to bag`; header badge 1; the cart drawer opens (or the badge only, as designed).
3. Open `/<locale>/cart`. US: one group `Collect · <store>` with address and readiness; the line shows the `Collect` chip active; shipping `Free` for collect; `Estimated tax` (added). Canada: one group `Shipping to you`, standard carrier price in CAD (8.95 below the free threshold) and the free-above-99 CAD progress text, `Estimated tax` (GST).
4. Press `Checkout`, continue as **guest**, and complete the full hosted Checkout (address, shipping, payment all inside it, D-039). US: a state with and one without a state tax rate in two separate runs. Canada: a valid Canadian postcode and province; only the standard carrier method is offered. Email `tst-<n>@example.com` is entered only as a contact address; no email is sent.
5. Pay with the Stripe test card. Land on the confirmation page: order number, tracker at `Ordered`, US collection block with the store, hours and what to bring (Canada: delivery block, no collection), a `Create an account` prompt, no password in the URL, no sentence promising an email.
6. Open the confirmation link in a second isolated context without the link secret (if the page uses one): it must not show the order.

Read-back (MCP): the order exists with `customerEmail` the test address and no `customerId`; US: one line with `supplyChannel` = the store channel and `custom.fields.fulfilment = collect`, shipping method `mcf-collect` with price 0; Canada: line `fulfilment = delivery`, no `supplyChannel`, shipping method `mcf-ship-standard` in CAD, no `mcf-collect` anywhere; `orderState` `mcf-order-ordered`; `taxedPrice` present (US with the state or country-fallback rate and 0% on pods; Canada 0% on pods, 5% GST on standard goods per SEED-PLAN); payment `Success`; line prices equal the SEED-PLAN price table for the market. Inventory at the store channel decreased by the quantity (if the project decrements on order; record the observation either way).

## J2 Member buys a machine and capsules: one mixed bag (US)

Specs: `fulfilment-and-availability-model` (mixed bags), `design-cart-page`, `design-cart-drawer`, `cart-management`, `design-checkout-page`, `policy-pages` (consent link).

1. Sign in as `maya.okonkwo@example.com` (US). Empty the bag if it has lines.
2. Add `{PDP:machine}` (choose a colour; the bundle selector, where a machine has one, defaults to `Machine only`; a bean-to-cup machine has colours only), Ship card, `Add to bag`. Add `{PDP:pod}` capsules compatible with that machine (the `Goes well with` strip leads with compatible capsules; press its add button), Collect at Brooklyn.
3. `/en-US/cart`: two groups, `Collect · Brooklyn` and `Shipping to you`, each with its promise, and **every line sits inside its cluster with its fulfilment chip** (`Collect` or `Ship`) and its own line total; no line is outside a cluster; the starter-capsule nudge is absent because capsules are present (remove them and confirm the nudge appears, then add them back).
4. Apply `WELCOME10`: discount line; apply `FREESHIP` too (stackable): shipping shows `Free`. Remove `FREESHIP`.
5. Checkout (full hosted Checkout): saved address preselected; the shipping step shows the standard carrier for the ship group and collection for the collect group, each with its price; consent text links to Terms and Privacy and **opens in a new tab**; close it, the checkout state is intact.
6. Pay with the Stripe test card. Confirmation shows both groups, each line in its cluster (one order with multiple shipping, or two linked orders per the K-01 decision recorded in `PROJECT-FINDINGS.md`; a mixed bag must work either way, D-033). Repeat with a third line `subscribe` and confirm three clusters.

Read-back: order (or orders) with `shippingMode Multiple` or the documented fallback that still keeps every line in its cluster; machine line has no `supplyChannel` and `fulfilment delivery`; capsule line has the store channel and `fulfilment collect`; shipping methods per group; discount code applied on the cart; totals equal the sum of lines plus shipping minus discount; one payment, `Success`.

## J3 Subscribe: member buys a subscription

Specs: `subscriptions-and-recurring-orders`, `fulfilment-and-availability-model` (Subscriptions), `design-product-detail-page` (Subscribe), `design-cart-page` (Subscriptions group).

1. Signed in as `liam.carter@example.com`. Open `{PDP:pod}` that is subscribable. Subscribe card: interval select lists only policies with a price, `Save <n>%` chip, price lock sentence. A machine page shows no Subscribe card.
2. Choose `Every 2 months`, quantity 2, `Subscribe`. Cart: group `Subscriptions` (`Delivered on the schedule you chose`, the price-lock sentence, the line reads `Every 2 months` and the first delivery date). The bag has no interval select and no `Buy once instead`: the interval is changed in the account (J4). Add one ship accessory.
3. Checkout, pay. Confirmation says `Next delivery <date>, then every 2 months`.
4. `/en-US/account/subscriptions`: one card with the lines, interval, next date, per-delivery price and status `Active`.
5. Sign out; with a guest bag containing a subscribe line open `/en-US/checkout`: no guest option, sign-in prompt.

Read-back: the order has a line with `recurrenceInfo` (`priceSelectionMode Fixed`) and `fulfilment subscribe`; `recurring-orders` for the customer: one per distinct policy, `recurringOrderState Active`, `originOrder` = the order, `nextOrderAt` set; the recurring cart contains only the subscription lines.

## J4 Manage a subscription: skip, pause, resume, change interval, cancel

Specs: `subscriptions-and-recurring-orders`, `design-account-area` (Subscriptions).

On the card from J3: (1) `Change interval` to `Every month`: dialog, save, toast, same card updated in place (card id unchanged). (2) `Skip next`: toast, label `Next delivery skipped`, button disabled; while a skip is pending `Change interval` is off (the API answers 422 `invalid_state`), so the interval is changed first. (3) `Pause`: pill `Paused`, text `No further orders until you resume.` (4) `Resume`: pill `Active`, next date shown. (5) `Cancel`: dialog states the last order date or that none exists; confirm: pill `Canceled`, `Subscribe again`. Each action is one `PUT /api/recurring-orders/<id>` with 200.

Read-back after each step: `recurringOrderState` `Active` or `Paused` or `Canceled` (single l), `skipConfiguration` counter, `schedule` value, `nextOrderAt`. A renewal order (second order from the recurring order) is not expected within the run; the daily test policy check is `M-N-01`.

## J5 Review a product

Specs: `reviews-and-ratings`, `design-product-detail-page`, `design-product-card`. No moderation (D-037): a review is published and counted at once.

1. As a guest open a product with reviews: summary (average rounded to one decimal, count), distribution bars, list of 5 with `Show more`, sort Newest, Highest, Lowest. Choose Lowest: the 1-star review first. A product with no reviews: no star row on its card, `Be the first to review` on the page.
2. `Write a review` as a guest: sign-in prompt. Sign in as `liam.carter@example.com`, write a review with rating, title `TST-review-1` and text. The review appears immediately in the list for everyone (a second context sees it), with no pending label, and the summary count and average update at once.
3. **XSS payloads** in title and text of a second test review (as `maya.okonkwo@example.com`): `<img src=x onerror=window.__xss=1>`, `"><script>window.__xss=1</script>`, `[click](javascript:alert(1))`, a 5000-character string, an emoji and right-to-left text. After it is visible: `evaluate_script`: `window.__xss === undefined`, `document.querySelectorAll('img[src="x"]').length === 0`; the text is displayed as text.
4. Edit and delete the own review; try to edit another customer's review with `fetch` to `/api/reviews/<id>` (PATCH, DELETE): refused (403 or 404), no change.
5. Filter and sort by rating on the listing (J7 covers it): `4.5 and up`.

Read-back: `reviews` target product, `authorName` and `customer` correct, published at once (no pending state), `includedInStatistics` true, product `reviewRatingStatistics` equals the recomputed average and count (within rounding) of the included reviews.

## J6 Change market with a bag

Specs: `switching-region-or-language`, `design-store-picker-and-locale`, `server-architecture-and-data-flow` (market change).

1. Signed out, `/en-US`, store Brooklyn, add a pod (collect) and a machine (ship): bag of two lines in USD.
2. Switch to Canada (`/en-CA`): the page prices change to CAD; the bag is **empty or recreated in CAD** according to the rule (cart id reset, no cart with mixed currencies); no USD amount anywhere; the store pill and picker disappear and the old store is not selected; no collect line can exist in the bag; `list_network_requests` shows a single market-change request.
3. Switch back to the US (`/en-US`): country, currency and locale always change together (session fields); the store pill returns without a store chosen.
4. Sign in as a Canadian demo customer while the locale is `en-US`: the market follows the customer's default address country or asks, per J's rule; no mixed currency cart.
5. Visit `/fr-FR/coffee` and `/de-DE/coffee`: redirected to the default or cookie locale (French and German are not built).

Read-back: carts for the session customer: each has one currency; abandoned carts from before the switch are not the active cart.

## J7 Filters, sort, search and URL state

Specs: `design-product-listing-page`, `product-listing-page`, `design-product-card`, `search-results-page`, `discovery-and-browse`.

1. `{PLP}` pods: apply `Intensity 9 to 13`, then `Roast dark`: facet counts of each group are computed against the other active groups (a group's own selection does not hide its siblings); URL carries filters, sort and page; reload and back/forward restore them; share the URL in a second context: same result.
2. Sort `Price low to high`, then `Top rated`: order changes; ties stable; filter by `4.5 and up`.
3. Toggle `Available at my store` (US only, store Brooklyn; in `/en-CA` the toggle is absent): only products collectable there; cards show `In stock at Brooklyn` or `Low stock` (amber dot and text) or `Not available`.
4. Search `ristretto`: results with facets; search `zzzzzz`: empty state with suggestions, no blank page; search with an apostrophe and a very long string: no error.
5. At 375 px: the grid is two columns, filters open as a full-height sheet with `Apply` and `Clear`.
6. Pagination: page 2 and a page beyond the last (clamped or 404 per G).

Read-back: Product Search call counts and facet counts equal an independent Product Search query made with the MCP for the same filter set (record two cases).

## J8 Out of stock at the chosen store

Specs: `fulfilment-and-availability-model` (Availability per store), `design-product-detail-page` (Out of stock for collection), `design-cart-page` (Switch to ship, Merge), `design-product-card`.

1. Choose the store that holds zero of the fixture SKU (Q-04 lists it). Open its product page: Collect shows `Unavailable`, button reads `Unavailable for collection`; switch to Ship: the button is enabled and the line adds.
2. A variant that is out of stock at the store while Collect is chosen: that option is disabled with the title `Not available for collection at this store`.
3. Card on the listing: `Not available at <store>`, still openable.
4. Add the product as a collect line **from another store that has it** (change store), then change the store back to the empty one: the cart line shows the amber `Not in stock at <store>, try shipping`; press `Ship`: the line moves to `Shipping to you` and the warning disappears. Add the same SKU as another ship line first and switch again: quantities merge into one line.
5. Quick add of a coffee without a chosen grind: nothing is added, the page opens with the grind highlighted.

Read-back: inventory entries for the SKU: online (no channel) quantity above zero, store channel zero; the cart line `supplyChannel` before and none after the switch.

## J9 Account self-service

Specs: `account-sign-in`, `authentication-and-identity`, `account-and-self-service`, `address-book`, `payment-methods`, `saved-lists`, `design-account-area`.

1. Register `tst-<n>@example.com` with a password that meets the rule: weak password rejected inline; success signs the customer in at once (registration is auto-verified, no email is sent, D-032); a second sign-in with the same credentials works.
2. Save a product with the heart as a guest (sign-in prompt) and as the member: appears under Saved; remove: leaves the grid.
3. Addresses: add two, make the second default, delete the default: the next becomes default; delete the last: none.
4. Payment methods: saved cards are not built (Q-014); the account shows no card tab or the documented empty state; no card number appears anywhere in the DOM or network log of the storefront origin.
5. Profile: change phone; Settings: toggle a switch (saved immediately, 44x26 switch animates).
6. `Delete account` (on this test customer only): modal states what is erased and what is retained; confirm: session ends; sign-in with the deleted account fails with the generic message.

Read-back: customer, addresses (default flags), shopping list lines, no card data; after delete: customer gone or anonymised as designed.

## J10 Sign-in, cart merge and sign-out

Specs: `account-sign-in`, `authentication-and-identity`, `cart-management`, `home-landing-page` (expired session).

1. As a guest add a pod to the bag; sign in as `liam.carter@example.com` who has a saved cart: lines merge per `anonymousCartSignInMode`; header count updates; no duplicate lines of the same SKU and fulfilment.
2. Wrong password: generic error, no hint whether the email exists; ten rapid attempts: rate limited (J14).
3. There is no password reset (D-032): the sign-in page has no `Forgot password` link, and `/en-US/forgot-password` and `/en-US/reset-password` answer the localized 404.
4. Open `/en-US/account/orders` signed out: redirected to sign-in with the destination preserved (`next`), not to a forbidden page; after sign-in you land on the orders. A `next` of `https://evil.example` or `//evil.example` is ignored.
5. Sign out: session cleared; Back button does not show account data.

## J11 Orders, collection tracker and Buy again

Specs: `order-history`, `post-purchase-order-management`, `account-dashboard`, `fulfilment-and-availability-model` (Order states, Ready), `design-order-confirmation-page`, `design-account-area` (Orders, Collection).

1. Signed in as the J2 shopper, `Orders`: newest first; status pill and icon; thumbnails.
2. Advance the J1 or J2 collect order with the seed helper `cd seed && npm run seed:advance-order -- --order <orderNumber> --to preparing --confirm <projectKey>`, then `ready-for-collection` (the script exists only after Q-04; it refuses non-demo customers and keys other than the configured one). Reload: the card pill turns teal `Ready for collection`, the teal info block shows store, hours, bring ID and number, `Get directions` button; the confirmation page tracker reads `Ready`.
3. `collected`, then for a delivered order (advance a ship-only order if the project has a delivered state, otherwise record "no delivered state" in fixes) press `Buy again`: available lines added, an unavailable one listed and skipped.
4. New account with no orders: empty state with `Shop coffee`.
5. Collection tab: saved store, address, hours, phone, `Change store` opens the picker and updates availability site-wide.

Read-back: order state keys `mcf-order-*` after each advance; the cart after Buy again.

## J12 Errors and degraded behaviour

Specs: `error-pages`, `server-architecture-and-data-flow` (Errors), `about-us` (commerce degraded), `home-landing-page`.

1. `/en-US/does-not-exist`, `/en-CA/does-not-exist`, a product route with an unknown slug: localized 404 with shell, search field and category links; document status 404 (`get_network_request`); search from the page works.
2. `/api/nothing`: JSON 404 in the stable shape. Unauthenticated `GET /api/orders`: 401 with no body detail.
3. Second server on port 3002 with `CTP_API_URL=https://127.0.0.1:9` (separate env file, not committed; the SDK talks `https` only): About, Contact, FAQ, policies, Journal render completely; a listing shows the localized server-error page with `Try again` (no reference number today, idea in `IDEAS.md`); the header cart count reads 0 while the commerce tier is down (idea); the page never shows a stack trace or a commercetools message.
4. Kill the dev API briefly while checkout is open (same second server): checkout shows the retry state, the bag is intact after recovery.

## J13 Content pages and contact

Specs: `about-us`, `contact-us`, `faq`, `policy-pages`, `blog-resources`.

1. Footer links: every link lands on a real page in `en-US` and `en-CA`; there is no Impressum and no VAT text.
2. Contact: valid submit with the mock receiver (`scripts/dev/mock-contact-receiver.mjs`): confirmation with reference and channel; failing receiver: message preserved, phone and email offered; six rapid submits: the sixth is rate limited.
3. FAQ: `#question-<id>` and `?q=<id>` open the answer; feedback unreachable shows nothing.
4. Policies: effective date visible; draft banner visible until SO-01 is done.
5. Journal: two tags with no common article give the empty state with removable chips; the withdrawn slug redirects to its topic; the untagged article has no related block.

## J14 Isolation, 401 matrix and cookies

Specs: `server-architecture-and-data-flow` (Session, Route Handler table, Caching), `authentication-and-identity`.

Two isolated contexts, shopper A (`maya.okonkwo`) and B (`liam.carter`).

1. For each per-person route in the route table call it with no cookie: 401, no data, same body shape.
2. A reads one of A's order ids, address ids, recurring order id, review id, shopping list id; then B requests the same ids with `fetch` from B's page: 404 or 403, never A's data (the matrix is in Q-11).
3. Both shoppers load `/en-US` and `/api/cart` at the same time: each response contains only its own cart (`Two shoppers` scenario); no `Cache-Control: public` on any per-person response.
4. Tamper the session: `curl -s -H 'Cookie: malva-session=abc.def.ghi' http://localhost:3000/api/auth/me` and the same with a well-formed JWT signed with a random wrong secret (make it in a scratch Node script with `jose`, never with the real secret): both are treated as an empty session (401 or an anonymous response), with no error detail.
5. Read the `Set-Cookie` of login: the cookie `malva-session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 2592000 (30 days) and, on the release build behind HTTPS, `Secure`.

## J15 Payment declined and retry

Specs: `checkout`, `design-checkout-page`.

1. Bag with a ship line, signed in, full hosted Checkout: pay with the **declined** Stripe test card: the Checkout shows the failure, the bag and the entered details are intact, no order exists (`read_orders` for the customer shows none new).
2. Retry with the good test card: one order, one payment `Success`, no duplicate order after a double click on Pay.
3. Abandon the Checkout (close the tab), come back to `/en-US/cart`: the bag is still there.

## After the journeys

1. Cleanup dry run: `cd seed && npm run seed:cleanup-tests -- --register ../plans/evidence/Q/test-data.md` (created in Q-04) prints what it would delete; save the output as `plans/evidence/Q/purge-plan.txt`; the owner reads it (M-Q-04) before `--apply --confirm <projectKey>`.
2. Read `orders`, `carts` (state `Active`), `recurring-orders`, `reviews`, `customers` with `@example.com` created after the first journey: only the records listed in `test-data.md` may exist; the rest of the project equals `SEED-PLAN.md` (second `npm run seed` reports `0 change(s)`).
3. Anything left over goes to `plans/evidence/Q/leftovers.md` with the reason (orders cannot be deleted).

## Status

Run 2026-10-22 by workstream Q on commit `5584c8be` of branch `ws/q-quality`: J0 to J14 walked at 1440 px and, where the script asks, at 375 px, against a release build and the local mock commercetools (`plans/evidence/Q/journeys.md`, screenshots `J<n>-<step>-<width>.png`, test records in `test-data.md`). J15 (declined card) and the payment step of J1 to J3 need the hosted Checkout with Stripe, which the mock cannot run: the payment is simulated the way the platform does it and every journey says so. Defects found and fixed: `fixes.md` (QFX-01 to QFX-42); the rest is handed over in `plans/OWNER-HANDOFF.md` (live checks M-Q-03, M-Q-08, M-Q-09, device rows M-Q-01, M-Q-02).
