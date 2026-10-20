<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# End-to-end journeys (workstream Q)

Scripts for the whole shopper experience, written to be run step by step with the **Chrome DevTools MCP** on a **release build** (`cd storefront && npm run build && npm run start`, `http://localhost:3000`) against the seeded Malva Coffee project, with the owner rows OA-01, OA-02, OA-04 (hosted Checkout and test card) done. Claude (or a junior) runs them and reads the result back from commercetools with the commercetools MCP (OA-06) or `cd seed && npm run verify` / a read-only script. The owner is needed only for credential rows and real-device rows.

## How to run

1. Record each journey in `plans/evidence/Q/journeys.md`: journey id, date, build commit, per step `observation`, screenshot file, and the read-back values (ids and numbers only, no personal data, no secrets). Screenshots: `plans/evidence/Q/<journey>-<step>-<375|1440>.png`.
2. Tools: `navigate_page`, `take_snapshot` (gives the `uid`s to click), `click`, `fill`, `fill_form`, `press_key`, `wait_for`, `evaluate_script`, `list_network_requests` and `get_network_request`, `list_console_messages`, `resize_page`, `emulate`, `take_screenshot`, `new_page` (use a fresh isolated context for a second shopper so cookies are not shared).
3. After **every** step: console has no error, no network request failed (4xx and 5xx are only allowed where the step says so), no layout overflow (`evaluate_script`: `document.documentElement.scrollWidth <= window.innerWidth`).
4. Run each journey at 1440x900; run J1 (US), J2, J3, J8 and J12 again at 375x812.
5. **Test data**: every record a journey creates is synthetic. Customers `tst-<yyyymmdd>-<n>@example.com`; free text carries the prefix `TST-` (gift note, review title, contact message). Add one row per record to `plans/evidence/Q/test-data.md` as `| kind | id | note |` (orders and carts cannot be deleted; customers, reviews, recurring orders and shopping lists can, through the seed cleanup only). Never type a password into a note, URL or evidence file.
6. A failed step goes to `plans/evidence/Q/fixes.md` with the journey and step number; fix (small, with a test) or hand to the owning workstream through the lead; rerun the journey.

## Fixtures

| What | Value |
| --- | --- |
| Seeded shoppers (password `SEED_DEMO_PASSWORD`, never printed) | US `maya.okonkwo@example.com`, `liam.carter@example.com`; DE `anna.schneider@example.com`, `jonas.weber@example.com`; GB `emma.clarke@example.com`, `oliver.hughes@example.com` |
| Stores (supply channels) | US `mcf-store-nyc-soho`, `mcf-store-brooklyn`; DE `mcf-store-berlin-mitte`, `mcf-store-munich`; GB `mcf-store-london-soho`, `mcf-store-manchester` |
| Out-of-stock fixtures | SEED-PLAN section 8: two products out of stock at one store each; Q-04 records which SKU and store (`plans/evidence/Q/data-sweep.md`) and the journeys use them |
| Discount codes | `WELCOME10`, `FREESHIP`, `COFFEE15` |
| Test card | The Checkout test card documented by OA-04 (never written into evidence); a declined-card number from the same documentation for J15 |
| Route placeholders | Resolved once in Q-00 into `plans/evidence/Q/routes.md`: `{PLP}`, `{PDP:pod}`, `{PDP:coffee}`, `{PDP:machine}`, `{PDP:accessory}`, `{SEARCH}`, `{ACCOUNT}` |
| Tax and prices expected | SEED-PLAN sections 2, 3 and 9: US prices tax-exclusive, DE and GB tax-inclusive; coffee and pods reduced or zero rated by market |

## J0 Shell, market and store persistence

Specs: `design-storefront-shell`, `design-store-picker-and-locale`, `design-home-page`.

1. Fresh context. `navigate_page http://localhost:3000/`: redirected to `/en-US`. Snapshot: promise bar with the US shipping threshold, collection promise and returns window; header with `Malva Coffee` wordmark, five primary links (pods, Coffee, Machines, Accessories, Gifts), store pill `Choose a store`, locale pill, search, account, cart (no badge).
2. Hover `Coffee`: mega menu opens after the pointer enters; move off: it closes after about 130 ms; re-enter within that time: stays open. Click one entry: the listing opens with that category and facet applied.
3. Click the store pill: the picker lists only `InventorySupply` channels of the US, nearest first. Choose `Brooklyn`: pill reads `Collect at Brooklyn`. Reload: still chosen (session).
4. Locale pill: choose Germany: URL `/de-DE`, German strings, prices in EUR with two decimals (`4,90 €` format), the store pill resets because Brooklyn is not in the market, the picker lists only German stores.
5. At 375 px: menu toggle appears under 820 px, the slide-in navigation opens, a link closes it and navigates; footer columns stack.
6. Footer: enter an invalid email in the newsletter field and press `Join`: inline error, no silent failure; enter `tst-1@example.com`: confirmation toast (F built the form as a validated no-op, Q-F-07: record that nothing is stored).

Read-back: none (no data written).

## J1 Guest buys a collect pod box, once in each market (J1-US, J1-DE, J1-GB)

Specs: `fulfilment-and-availability-model` (collect line, shipping, tax), `design-product-detail-page`, `design-cart-drawer`, `design-checkout-page`, `checkout`, `design-order-confirmation-page`, `order-confirmation-page`.

Repeat with: US `/en-US`, store Brooklyn, USD; DE `/de-DE`, store Berlin Mitte, EUR; GB `/en-GB`, store London Soho, GBP. Fresh context each time, **not signed in**.

1. Open `{PDP:pod}` (an Original or Vertuo pod). Choose the machine system, the 50-capsule box. Snapshot: price and unit price per capsule, Collect card selected by default when a store is chosen, status dot and text `In stock at <store>` with readiness minutes.
2. Choose store (if not chosen) in the picker. Press `Reserve for collection` (label includes the line total). Toast `Added to bag`; header badge 1; the cart drawer opens (or the badge only, as designed).
3. Open `/<locale>/cart`. One group `Collect · <store>` with address and readiness; line shows the `Collect` chip active; summary shows subtotal, shipping `Free` for collect, tax presentation per market: US `Estimated tax` (added), DE and GB `Includes <amount> VAT`.
4. Press `Checkout`, continue as **guest**, enter a synthetic address in the market (US: a state with and one without a state tax rate in two separate runs; DE and GB: valid postcode formats), email `tst-<n>@example.com`.
5. Pay in the hosted Checkout with the test card. Land on the confirmation page: order number, tracker at `Ordered`, collection block with the store, hours and what to bring, a `Create an account` prompt, no password in the URL.
6. Open the confirmation link in a second isolated context without the link secret (if the page uses one): it must not show the order.

Read-back (MCP): the order exists with `customerEmail` the test address and no `customerId`; one line with `supplyChannel` = the store channel and `custom.fields.fulfilment = collect`; shipping method `mcf-collect` with price 0; `orderState` `mcf-order-ordered`; `taxedPrice` present (US with the state or country-fallback rate; DE 7% on pods; GB per SEED-PLAN); payment `Success`; line prices equal the SEED-PLAN price table for the market. Inventory at the store channel decreased by the quantity (if the project decrements on order; record the observation either way).

## J2 Member buys a machine and capsules: one mixed bag

Specs: `fulfilment-and-availability-model` (mixed bags), `design-cart-page`, `design-cart-drawer`, `cart-management`, `design-checkout-page`, `policy-pages` (consent link).

1. Sign in as `maya.okonkwo@example.com` (US). Empty the bag if it has lines.
2. Add `{PDP:machine}` (choose a colour; bundle `machine only`), Ship card, `Add to bag`. Add `{PDP:pod}` capsules compatible with that machine (the `Goes well with` strip leads with compatible capsules; press its add button), Collect at Brooklyn.
3. `/en-US/cart`: two groups, `Collect · Brooklyn` and `Shipping to you`, each with its promise; the starter-capsule nudge is absent because capsules are present (remove them and confirm the nudge appears, then add them back).
4. Apply `WELCOME10`: discount line; apply `FREESHIP` too (stackable): shipping shows `Free`. Remove `FREESHIP`.
5. Checkout: saved address preselected; shipping step shows methods for the US only, each with its price; consent text links to Terms and Privacy and **opens in a new tab**; close it, the checkout state is intact.
6. Pay with the test card. Confirmation shows both groups (or two linked orders, per the decision K recorded in `PROJECT-FINDINGS.md`).

Read-back: order (or orders) with `shippingMode Multiple` or the documented fallback; machine line has no `supplyChannel` and `fulfilment ship`; capsule line has the store channel and `fulfilment collect`; shipping methods per group; discount code applied on the cart; totals equal the sum of lines plus shipping minus discount; one payment, `Success`.

## J3 Subscribe: member buys a subscription

Specs: `subscriptions-and-recurring-orders`, `fulfilment-and-availability-model` (Subscriptions), `design-product-detail-page` (Subscribe), `design-cart-page` (Subscriptions group).

1. Signed in as `liam.carter@example.com`. Open `{PDP:pod}` that is subscribable. Subscribe card: interval select lists only policies with a price, `Save <n>%` chip, price lock sentence. A machine page shows no Subscribe card.
2. Choose `Every 2 months`, quantity 2, `Subscribe`. Cart: group `Subscriptions` with `Delivered every 2 months`, interval select, `Buy once instead`. Add one ship accessory.
3. Checkout, pay. Confirmation says `Next delivery <date>, then every 2 months`.
4. `/en-US/account/subscriptions`: one card with the lines, interval, next date, per-delivery price and status `Active`.
5. Sign out; with a guest bag containing a subscribe line open `/en-US/checkout`: no guest option, sign-in prompt.

Read-back: the order has a line with `recurrenceInfo` (`priceSelectionMode Fixed`) and `fulfilment subscribe`; `recurring-orders` for the customer: one per distinct policy, `recurringOrderState Active`, `originOrder` = the order, `nextOrderAt` set; the recurring cart contains only the subscription lines.

## J4 Manage a subscription: skip, pause, resume, change interval, cancel

Specs: `subscriptions-and-recurring-orders`, `design-account-area` (Subscriptions).

On the card from J3: (1) `Skip next`: toast, label `Next delivery skipped`, button disabled. (2) `Change interval` to `Every month`: dialog, save, toast, same card updated in place (card id unchanged). (3) `Pause`: pill `Paused`, text `No further orders until you resume.` (4) `Resume`: pill `Active`, next date shown. (5) `Cancel`: dialog states the last order date or that none exists; confirm: pill `Canceled`, `Subscribe again`. Each action is one `PUT /api/recurring-orders/<id>` with 200.

Read-back after each step: `recurringOrderState` `Active` or `Paused` or `Canceled` (single l), `skipConfiguration` counter, `schedule` value, `nextOrderAt`. A renewal order (second order from the recurring order) is not expected within the run; the daily test policy check is `M-N-01`.

## J5 Review a product

Specs: `reviews-and-ratings`, `design-product-detail-page`, `design-product-card`.

1. As a guest open a product with reviews: summary (average rounded to one decimal, count), distribution bars, list of 5 with `Show more`, sort Newest, Highest, Lowest. Choose Lowest: the 1-star review first. A product with no reviews: no star row on its card, `Be the first to review` on the page.
2. `Write a review` as a guest: sign-in prompt. Sign in as `emma.clarke@example.com`, write a review with rating, title `TST-review-1` and text. Expected per the moderation decision of M: the review appears immediately or shows as pending to the author only; other shoppers (second context) do not see a pending review.
3. **XSS payloads** in title and text of a second test review (as `oliver.hughes@example.com`): `<img src=x onerror=window.__xss=1>`, `"><script>window.__xss=1</script>`, `[click](javascript:alert(1))`, a 5000-character string, an emoji and right-to-left text. After it is visible: `evaluate_script`: `window.__xss === undefined`, `document.querySelectorAll('img[src="x"]').length === 0`; the text is displayed as text.
4. Edit and delete the own review; try to edit another customer's review with `fetch` to `/api/reviews/<id>` (PATCH, DELETE): refused (403 or 404), no change.
5. Filter and sort by rating on the listing (J7 covers it): `4.5 and up`.

Read-back: `reviews` target product, `authorName` and `customer` correct, `state` as designed, `includedInStatistics`, product `reviewRatingStatistics` equals the recomputed average and count (within rounding) of the included reviews.

## J6 Change market with a bag

Specs: `switching-region-or-language`, `design-store-picker-and-locale`, `server-architecture-and-data-flow` (market change).

1. Signed out, `/en-US`, store Brooklyn, add a pod (collect) and a machine (ship): bag of two lines in USD.
2. Switch to Germany (`/de-DE`): the page language and prices change; the bag is **empty or recreated in EUR** according to the rule (cart id reset, no cart with mixed currencies); no USD amount anywhere; the old store is not selected; `list_network_requests` shows a single market-change request.
3. Switch to the UK (`/en-GB`), then switch language only (de-DE to en-US while staying in the same country if the chooser allows it): country, currency and locale always change together (session fields).
4. Sign in as `anna.schneider@example.com` (DE) while the locale is `en-US`: the market follows the customer's default address country or asks, per J's rule; no mixed currency cart.
5. Visit `/fr-FR/coffee`: redirected to the default or cookie locale.

Read-back: carts for the session customer: each has one currency; abandoned carts from before the switch are not the active cart.

## J7 Filters, sort, search and URL state

Specs: `design-product-listing-page`, `product-listing-page`, `design-product-card`, `search-results-page`, `discovery-and-browse`.

1. `{PLP}` pods: apply `Intensity 9 to 13`, then `Roast dark`: facet counts of each group are computed against the other active groups (a group's own selection does not hide its siblings); URL carries filters, sort and page; reload and back/forward restore them; share the URL in a second context: same result.
2. Sort `Price low to high`, then `Top rated`: order changes; ties stable; filter by `4.5 and up`.
3. Toggle `Available at my store` (store Brooklyn): only products collectable there; cards show `In stock at Brooklyn` or `Low stock` (amber dot and text) or `Not available`.
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

Specs: `account-sign-in`, `authentication-and-identity`, `email-verification`, `account-and-self-service`, `address-book`, `payment-methods`, `saved-lists`, `design-account-area`.

1. Register `tst-<n>@example.com` with a password that meets the rule: weak password rejected inline; success signs in (or asks for email verification per J; if verification needs real mail, record how the test verified it, `M-Q` row).
2. Save a product with the heart as a guest (sign-in prompt) and as the member: appears under Saved; remove: leaves the grid.
3. Addresses: add two, make the second default, delete the default: the next becomes default; delete the last: none.
4. Payment methods: only what the hosted Checkout supports (add and remove tokenised card per L's decision); no card number appears anywhere in the DOM or network log of the storefront origin.
5. Profile: change phone; Settings: toggle a switch (saved immediately, 44x26 switch animates).
6. `Delete account` (on this test customer only): modal states what is erased and what is retained; confirm: session ends; sign-in with the deleted account fails with the generic message.

Read-back: customer, addresses (default flags), shopping list lines, no card data; after delete: customer gone or anonymised as designed.

## J10 Sign-in, cart merge and password reset

Specs: `account-sign-in`, `authentication-and-identity`, `password-reset`, `cart-management`, `home-landing-page` (expired session).

1. As a guest add a pod to the bag; sign in as `jonas.weber@example.com` who has a saved cart: lines merge per `anonymousCartSignInMode`; header count updates; no duplicate lines of the same SKU and fulfilment.
2. Wrong password: generic error, no hint whether the email exists; ten rapid attempts: rate limited (J14).
3. Request a password reset for a seeded email and for an unknown email: identical response and timing class; follow the reset link (token in the URL **only** for the reset page; strip after load) and set a new password for a **test** customer only (not a seeded demo customer; otherwise reset it back through the seed script).
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

1. `/en-US/does-not-exist`, `/de-DE/does-not-exist`, a product route with an unknown slug: localized 404 with shell, search field and category links; document status 404 (`get_network_request`); search from the page works.
2. `/api/nothing`: JSON 404 in the stable shape. Unauthenticated `GET /api/orders`: 401 with no body detail.
3. Second server on port 3002 with `CTP_API_URL=http://127.0.0.1:9` (separate env file, not committed): About, Contact, FAQ, policies, Journal render completely; a listing shows the localized server-error page with `Try again` and a reference; the header cart count is unchanged; the page never shows a stack trace or a commercetools message.
4. Kill the dev API briefly while checkout is open (same second server): checkout shows the retry state, the bag is intact after recovery.

## J13 Content pages and contact

Specs: `about-us`, `contact-us`, `faq`, `policy-pages`, `blog-resources`.

1. Footer links: every link lands on a real page; the German and British variants render; fallback notice where text is English.
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

1. Bag with a ship line, signed in, hosted Checkout: pay with the **declined** test card: the Checkout shows the failure, the bag and the entered details are intact, no order exists (`read_orders` for the customer shows none new).
2. Retry with the good test card: one order, one payment `Success`, no duplicate order after a double click on Pay.
3. Abandon the Checkout (close the tab), come back to `/en-US/cart`: the bag is still there.

## After the journeys

1. Cleanup dry run: `cd seed && npm run seed:cleanup-tests -- --register ../plans/evidence/Q/test-data.md` (created in Q-04) prints what it would delete; save the output as `plans/evidence/Q/purge-plan.txt`; the owner reads it (M-Q-04) before `--apply --confirm <projectKey>`.
2. Read `orders`, `carts` (state `Active`), `recurring-orders`, `reviews`, `customers` with `@example.com` created after the first journey: only the records listed in `test-data.md` may exist; the rest of the project equals `SEED-PLAN.md` (second `npm run seed` reports `0 change(s)`).
3. Anything left over goes to `plans/evidence/Q/leftovers.md` with the reason (orders cannot be deleted).

## Status

Not run yet. Blocked by OA-01 (live project), OA-04 (hosted Checkout and test card), OA-02 (recurring orders), Chrome DevTools MCP availability, and workstreams A to P reaching `Done`.
