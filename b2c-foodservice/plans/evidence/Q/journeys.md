<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# End-to-end journeys (Q-09)

Run 2026-10-22 by workstream Q with the Chrome DevTools MCP against a **production build** (`npm run build`, `next start -p 3100`) of branch `ws/q-quality`, talking to the **local mock commercetools** (`storefront/scripts/mock-ct-server.mjs`, project `mock-project`). There is no live project, Checkout Application or Stripe connector yet (OA-01, OA-04, OA-K-a), so:

- Everything the shopper sees in the storefront is verified here at 1440x900 and, where `E2E-JOURNEYS.md` asks, at 375x812 (`emulate` mobile, touch). The MCP window cannot be resized below 500 px; the 375 px views use device emulation.
- The **hosted Checkout widget and Stripe cannot run against the mock**: its script URL is the mock origin, which the CSP correctly blocks (a mock-only artefact). The pay step is simulated the way the platform does it: the storefront creates the payment session (`POST /api/checkout/session`), the mock plays the hosted Checkout finishing (`POST /__mock/place-order`, scratch helper outside the repository), the storefront finalises (`POST /api/checkout/complete`) and renders the confirmation. Steps that need the real widget are marked `blocked: OA-K-a` and are owner rows M-K-01 to M-K-04, M-Q-01.
- Mock limits to remember: flat 8% tax per country (so pods show tax that the real project zero-rates), no Product Search relevance, placeholder images (`1200 x 1440`), orders and carts live in memory only.
- Browser cookies on `localhost` are shared across ports (other dev projects on this machine set `NEXT_LOCALE`, `portal_last_bu`, ...); journeys use isolated browser contexts.
- Read-backs use the mock's debug routes (`GET /__mock/orders`, `/__mock/carts`), not the live project: ids and numbers only.

Screenshots are in this folder as `J<n>-<what>-<375|1440>.png`. Console and network were checked after each step: no console error and no failed request unless the step says so.

Defects found are listed in `fixes.md`.

## J0 Shell, market and store persistence: PASS

| Step | Observation |
| --- | --- |
| 1 | `/` redirects to `/en-US`. Promise bar `Free shipping over $75.00 · Free café collection, ready in 30 min · 30-day returns`; wordmark, five primary links (Pods, Coffee, Machines, Accessories, Gifts), store pill `Choose a store`, market pill `US (USD) \| EN`, search, sign in, cart `0 items`. |
| 2 | Hover on Coffee opens the mega menu (New in, Bestsellers, Sets; Shop coffee; More from Malva; brew-method strip). `J0-mega-1440.png`. |
| 3 | Store pill opens the picker with the six New York City stores; choosing Williamsburg gives the pill `Collect at Malva Coffee Williamsburg`; after a reload it is still chosen. `J0-store-picker-1440.png`. |
| 4 | Market pill: Canada goes to `/en-CA` (`lang="en-CA"`), CAD prices, **no store pill**, promise bar `Free shipping over $99.00 · 30-day returns` (no collection promise), exactly one `PUT /api/session/market` (200). Switching back to the US: pill is `Choose a store` (Williamsburg forgotten). |
| 5 | At 375 px the menu toggle appears, the slide-in navigation opens (16 px bold links; the first link has focus), Escape closes it, no horizontal overflow. `J0-mobile-nav-375.png`. |
| 6 | Newsletter: `not-an-email` gives the inline error `Enter a valid email address` (`aria-invalid`, `aria-describedby`); a valid address gives the toast `Thanks, you're on the list` (the form is a validated no-op, nothing is stored: Q-F-07). |

## J1 Guest buys a pod box

### J1-US (collect, `/en-US`, store Harlem): PASS (hosted payment simulated)

| Step | Observation |
| --- | --- |
| 1 | `Ember Ristretto` pod page: pack selector 10 sleeve, 50 box, 100 box; three cards (Collect in store, Delivery, Subscribe and save). With Williamsburg chosen the product is out of stock there: see J8. With Harlem chosen: `In stock at Malva Coffee Harlem`, `Ready today, in about 30 minutes`, button `Reserve for collection - $5.90`; the 50 box shows `$25.95` and `$0.52 per capsule`. `J1-ca-pdp-1440.png` is the Canada page (J1-CA). |
| 2 | `Reserve for collection - $25.95`: toast `Reserved for collection`, header `Cart, 1 item`, nothing opens (design Q-H-12). |
| 3 | `/en-US/cart`: group `Collect · Malva Coffee Harlem` with address and readiness, the line has the `Collect` chip active, shipping `Free`, `Estimated tax`. `J1-us-cart-1440.png`. |
| 4 | `/en-US/checkout`: Review stage, `Pickup at Malva Coffee Harlem`, `Who's picking up?`. Pressing Continue with an empty pickup name shows `Enter the name of the person collecting.` (field `Pickup name`, `autocomplete=name`, `aria-invalid`, `aria-describedby`, announced in `role=alert`). `J1-us-checkout-review-1440.png`. With a name the Pay stage opens; the hosted widget is the mock origin and is blocked by the CSP (expected, `blocked: OA-K-a`). |
| 5 | Payment simulated; `/api/checkout/complete` returns the order id; confirmation `Order confirmed`: order number, store, hours, `Ready in about 30 minutes`, tracker `Ordered, Preparing, Ready, Collected`, `Bring a photo ID and your order number.`, `Create an account with this order`; no password in the URL, no sentence that promises an email. `J1-us-confirmation-1440.png`. |
| 6 | The same confirmation URL in a second isolated context (no cookies) **shows the order**: the page is addressed by the order id only. Real order ids are UUIDs; the page is `no-store`, `noindex`, `Referrer-Policy: strict-origin-when-cross-origin`. Recorded as question Q-Q-15 (default: keep, an unguessable id is the capability). |

Read-back (mock): order `MC-RKSSNE2QGK` has no `customerId`, `customerEmail` is the test address, one line (`MCF-POD-EMBER-50`) with a supply channel and `fulfilment = collect`, shipping method `mcf-collect` price 0, state `mcf-order-ordered`, total 2803 USD cents (mock flat tax).

### J1-CA (delivery, `/en-CA`): PASS (hosted payment simulated)

`Ember Ristretto` in Canada shows Delivery and Subscribe only (no Collect card, no store pill); `Add to bag - $8.10`; bag group `Shipping to you`, `Free standard over $99.00 · 2 to 4 business days`, shipping `$8.95`, estimated tax; confirmation shows a `Delivery` block (`Standard`, estimated 2-4 business days, shipping address) and no collection block. `J1-ca-cart-1440.png`, `J1-ca-confirmation-1440.png`. Read-back: order `MC-10TR0AGZDF`, CAD, line `fulfilment = delivery`, no supply channel, shipping method `mcf-ship-standard`, no `mcf-collect`.

J1 was also run at 500 px (`J1-pdp-500.png`, `J1-drawer-500.png`, `J1-cart-500.png`, `J1-checkout-500.png`): one column, no overflow, the drawer is full width.

Defects found while running J1: the add-to-bag button crushed its padding at 375 px (QFX-11) and the store picker's search box lost its placeholder (QFX-17).

## J2 Member buys a machine and capsules: one mixed bag (US): PASS (hosted payment simulated)

Signed in as `maya.okonkwo` through the demo sign-in (D-040: a list of seeded customers, no email or password typed). The sign-in page lists customers by market and has no `Forgot password` link (D-032). `J2-signin-1440.png`, `J2-signin-375.png`.

| Step | Observation |
| --- | --- |
| 1 | After the sign-in the shopper lands on the page she came from. The bag merged with her saved bag (J10). |
| 2 | `Vertuo Studio` (machine page `J2-machine-pdp-1440.png`): colour and bundle selectors, `Machine only` is the default; Delivery card, no Subscribe card. A machine added to a bag without capsules shows the nudge `Vertuo Studio needs capsules. Add starter capsules?` with `Add`. Pods are added as `Collect` at Williamsburg. |
| 3 | `/en-US/cart`: two groups, `Collect · Malva Coffee Williamsburg` (address, `ready in about 30 minutes`, `Change store`) and `Shipping to you` (`Free standard over $75.00 · 2 to 4 business days`); every line sits inside its group with the `Collect` and `Ship` chips and its own total; no line is outside a group. `J2-cart-mixed-1440.png`, `J2-cart-mixed-375.png`. The nudge stays when the capsules in the bag are for the other machine system (Original pods and a Vertuo machine): correct, not a defect. |
| 4 | `WELCOME10`: discount line `-$17.04` (10% of the whole bag in the mock). `FREESHIP` on top: accepted, both listed as applied; removing it leaves `WELCOME10`. A code that does not exist and a code typed twice in another case answer `code_not_applied` with the reason, totals unchanged; the refusal text clears when the shopper edits the field (QFX-07). The summary shows `Subtotal` before the discount (it showed the amount after, QFX-06). The summary stays in view while scrolling at 1440 (it did not, QFX-18). `J2-cart-summary-fixed-1440.png`. |
| 5 | Checkout Review: `Pickup at Malva Coffee Williamsburg` with the `It's me` tile (name prefilled), then `Delivery` (`You enter the address next`); the summary lists both lines with their cluster; the consent text is part of the hosted flow (live row M-K-01). `J2-checkout-review-1440.png`. Pay stage: `Payment 1 of 2`. `J2-checkout-pay-375.png`. |
| 6 | Payments simulated one after the other: after the first the confirmation page `Order MC-...-A` shows the collection card and, below the items, `Also part of this purchase: Order MC-...-B, View in My Account`; after the second the session reports `next: null` and the bag is empty. **Defect QFX-12**: the lines of the last payment stayed in the old bag and came back at the next sign-in; fixed and checked (`cart-maya` has no lines after the last payment). `J2-confirmation-A-1440.png`, `J2-confirmation-375.png`. |

Read-back (mock): two orders (`-A` collect, 1 line with the store channel and `fulfilment collect`; `-B` machine, no store channel, `delivery`), two carts in state `Ordered`, one clone per fulfilment group (D-033).

**Open (question Q-Q-16, manual M-Q-09):** with a code on a mixed bag the Review shows `Total $165.63` but the two payments add up to `$182.80` (`$11.08` and `$171.72`): the code is only on the first payment (K's rule Q-K-02c, to respect usage limits). The summary and the money do not agree. Default: unchanged until the live project shows whether a second application of the code is refused; then K decides between putting the code on every part (percentage codes) and showing the real payments in the summary. Also noted: the confirmation shows `Shipping $0.00` where the cart says `Free` (wording, idea in IDEAS.md).

## J3 Subscribe: member buys a subscription: PASS (hosted payment simulated)

| Step | Observation |
| --- | --- |
| 1 | Signed in as `liam.carter`. `Ember Ristretto` has the Subscribe card with four intervals (`Every 2 weeks`, `Every month`, `Every 2 months`, `Every 3 months`; `GET /api/recurrence-policies` answers `public, max-age=300`), the `Save 10%` chip and the price-lock sentence. A machine cannot be subscribed (`POST /api/cart/lines` with a machine and `subscribe` answers 422 `price_unavailable`, and its page has no Subscribe card). `J3-subscribe-card-375.png`. |
| 2 | Bag after `Every 2 months`, quantity 2, and one delivery pod: groups `Shipping to you` and `Subscriptions` (`Delivered on the schedule you chose`, `Your price stays the same for every delivery. Shipping is calculated for each delivery.`, `Ember Ristretto $10.62`, `$5.31` each, `Every 2 months`, `First delivery by Wed, Oct 28, then every 2 months`). The subscription group has no interval select and no `Buy once instead` (the specs do not ask for them; the E2E script text is out of date and was corrected). `J3-cart-subscriptions-1440.png`, `J3-cart-subscriptions-375.png`. |
| 3 | One payment for the delivery and the subscription lines together (both ship). The confirmation says `Next delivery <date>, then every 2 months` and links to the subscriptions. `J3-confirmation-1440.png`, `J3-confirmation-375.png`. |
| 4 | `/en-US/account/subscriptions`: one card with lines, interval, next date (`2026-12-22`), per-delivery price (`$10.62`), pill `Active`. `J3-subscriptions-tab-1440.png`, `J3-subscriptions-tab-375.png`. |
| 5 | A guest with a subscribe line in the bag opens `/en-US/checkout`: `sign_in_required`, no guest option, a sign-in link that returns to the checkout. `J3-guest-sign-in-required-1440.png`. |

Read-back (mock): the order line has `recurrenceInfo` and `fulfilment subscribe`; one recurring order `active` with the policy `mcf-every-2-months`, `originOrderId` the order, `nextOrderDate` two months on, the locked unit price `$5.31`. Live check M-N-04 (real Recurring Orders offset) stays an owner row.

## J4 Manage a subscription: PASS

`PUT /api/recurring-orders/<id>` answers 200 with the state after the change each time.

| Step | Action | Result |
| --- | --- | --- |
| 1 | `Skip next` | pending skips 1, button disabled, label `Next delivery skipped`; a second skip answers 422 `invalid_state` |
| 2 | `Change interval` (while a skip is pending) | disabled in the card; the API answers 422 `invalid_state`. The script order (skip, then change interval) cannot be followed: the interval is changed first (`J4-interval-dialog-1440.png`, `J4-interval-dialog-375.png`, result `J4-subscriptions-interval-changed-1440.png`: same card id, `Every month`). Recorded as an idea (explain why the control is off) |
| 3 | `Pause` | pill `Paused`, `No further orders until you resume.`, no next date |
| 4 | `Resume` | pill `Active`, next date shown again |
| 5 | `Cancel` | dialog states the last order date or that there is none (`J4-cancel-dialog-375.png`); pill `Canceled`, `Subscribe again`. **Defect QFX-13**: the canceled card still said `Next delivery skipped`; fixed |

A resume on a canceled subscription is 422 `invalid_state`; another customer's subscription id is 404. A renewal order is not expected in the run (M-N-01).

## J5 Review a product: PASS

| Step | Observation |
| --- | --- |
| 1 | `Ember Ristretto` (12 reviews): summary `3.9 out of 5`, distribution bars 5 to 1 (3, 6, 2, 1, 0), list of 5 with `Show more`, sort `Newest`, `Highest rated`, `Lowest rated` (lowest first: 2, 3, 3, 4, 4 stars; the seed has no 1-star review). A product with no reviews (`Velvet Decaf`): no stars on its card, `Be the first to review` on its page. `J5-reviews-1440.png`. |
| 2 | Guest: `Sign in to write a review.` with a sign-in link that returns to the form (`J5-guest-1440.png`). As `liam.carter`: 4 stars, title `TST-review-1`: the review is first in the list at once, no pending label, `Thanks, your review is live`; the count went from 12 to 13 and the 4-star bar from 6 to 7 after the page read the product again. **Defect QFX-23**: the summary above the list stayed at 12 until a reload; the page now refreshes after a save. `J5-write-1440.png`, `J5-after-1440.png`. |
| 3 | XSS review by `maya.okonkwo`: title `<img src=x onerror=window.__xss=1>`, text `"><script>window.__xss=1</script> [click](javascript:alert(1)) emoji, Hebrew and Arabic text`. It is shown as text; `window.__xss` is undefined, no `img[src="x"]`, no script element and no link in the review. A 5000-character text answers 422 `validation_failed`. `J5-xss-text-1440.png`. |
| 4 | `PATCH` and `DELETE /api/reviews/<id>` of another customer's review: 404 both, the review unchanged. |
| 5 | Rating filter and sort on the listing: J7. |

Read-back (mock): the review is published at once with `includedInStatistics`; the product statistics changed (12 to 13). The live statistics lag is an owner row (Q-C-12, M-M-03).

## J6 Change market with a bag: PASS after a fix

Guest, `/en-US`, store Williamsburg, one pod (collect) and one machine (ship) in the bag, then `US (USD) | EN` and Canada: a dialog says `Your bag is priced in USD. Items will be moved to CAD where they are available; others will be listed.` (`J6-market-confirm-1440.png`), `Continue` makes exactly one `PUT /api/session/market` and opens `/en-CA/cart`: both lines are now `Ships to you`, prices in CAD, shipping `Free` over $99, no store pill, no `Collect` chip. `J6-ca-bag-moved-1440.png`. Back to the US: `Choose a store` (the old store is forgotten), the lines stay as shipping lines and offer `Collect` again; `/fr-FR/coffee` and `/de-DE/coffee` redirect to the default locale.

**Defect QFX-24 (serious, found and fixed here):** after the switch the bag was empty at the next request. The links of the old market in the page were prefetched again after the switch; the answer to that prefetch moved the session back to the US and dropped the cart (the proxy rewrites the session to the market of the URL). Next removes its prefetch headers before the proxy runs, so the fix reads `Sec-Fetch-Dest`: only a page load may move the session. After the fix the bag is there after a reload, in CAD. Test: `a prefetch or other background fetch of a page in the other market never sets a cookie`.

A Canadian demo customer signed in on `/en-US` keeps the market of the URL (US prices, USD bag, Collection tab shown); nothing mixes currencies. Recorded as a design note, not a defect.

## J7 Filters, sort, search and URL state: PASS

| Step | Observation |
| --- | --- |
| 1 | `Pods`: facets are links; `f_intensity=8` keeps all 13 intensity values listed (the group's own selection does not hide its siblings) and counts the other groups against it; several values are comma separated (`f_intensity=8%2C6`); a selection with no result shows `0` and a way back. The URL carries the state and a reload gives the same state. `J7-pods-1440.png`. |
| 2 | `Price: low to high` is ordered ($5.70, $5.70, $5.90, ...); `Top rated` starts with the best rated pod; `4.5 and up` leaves one pod. |
| 3 | `Available at my store` (US) and the cards' `In stock at ...`, `Low stock`, `Not available at <store>` are covered in J8; the toggle is absent in `/en-CA`. |
| 4 | `ristretto` finds one product; `zzzzzz`, a query with an apostrophe and quotes and a 3000-character query give HTTP 200, 0 products and the fallback products, no error; the title is cut to 100 characters. |
| 5 | At 375: two-column grid, the filters open as a full-height sheet with `Apply` and `Clear` (`J7-filter-sheet-375.png`). |
| 6 | `/en-US/shop?page=2` shows page 2; `page=999` answers 200 with a redirect to the last page (a meta refresh: the page streams, so the status cannot be 307; see Q-Q-18). |

## J8 Out of stock at the chosen store: PASS

Fixture: `Ember Ristretto` (`MCF-POD-EMBER-10` and the other pack sizes) has no stock at Williamsburg (`mcf-store-brooklyn-williamsburg`); recorded in `data-sweep.md`. At Williamsburg the page says `Unavailable` on the Collect card and the button `Unavailable for collection`; switching to Delivery enables `Add to bag`; adding the product as a collect line answers 409 `not_available_for_collection` (`J8-pdp-oos-1440.png`, `J8-pdp-oos-375.png`). The listing card says `Not available at <store>` and stays openable (`J8-listing-375.png`). A collect line bought at a store that has it and then moved with `Change store` to the empty store shows the amber `Not in stock at <store>, try shipping`; `Ship` moves it to `Shipping to you` and the warning goes (`J8-cart-not-in-stock-1440.png`, `J8-cart-not-in-stock-375.png`). A quick add of a coffee without a grind chosen adds nothing and opens the page with the grind highlighted (`J8-quick-add-grind-1440.png`, `J8-quick-add-grind-375.png`).

Not tested (mock): that the store inventory is decremented by an order (the mock does not model it); live row M-Q-03.

## J9 Account self-service: PASS

New customer `tst-20261022-9@example.com` (generated password, never written down). A weak password is refused before any call (422 `password_policy`, rules `min_length`, `digit`); a good one gives 201 and a signed-in session at once (no email, D-032); signing out and in again works; registering the same address again answers a generic 409. Saved: a guest gets 401 (the heart opens the sign-in prompt), a member saves and removes a product. Addresses: two added, the second made default, deleting the default makes the other the default, deleting the last leaves none; a phone number needs an address (`no_address`), and with one it is saved. Payment methods: `hostedOnly: true`, no cards, no card tab content (the hosted Checkout owns card data, D-039). Delete account: a wrong password is 400 `current_password_invalid`; with the right one 200, the session ends and signing in again fails with the generic message. `J9-account-menu-1440.png`, `J9-orders-empty-1440.png`. The settings tab has no switches (D-032), so the `Toggle` scenario is n/a (spec ledger).

## J10 Sign-in, cart merge and sign-out: PASS

A guest bag of two `Casa Espresso` and a saved bag with one `Ember Ristretto`: after the sign-in the bag has both lines, no duplicate, count 3. A wrong password and an unknown email answer the same 401 `invalid_credentials` with the same body. The sign-in page has no `Forgot password` link; `/en-US/forgot-password` and `/en-US/reset-password` are 404. A signed-out visit of `/en-US/account/orders` is a 307 to `sign-in?redirect=%2Faccount%2Forders`; a `redirect` of `//evil.example/x` is ignored (the shopper lands on the orders). Sign out ends the session; the account pages answer the sign-in redirect afterwards. Rate limit: J14.

## J11 Orders, collection tracker and Buy again: PASS (browser recipe L)

`J11-orders-1440.png` (newest first, status pills, thumbnails), `J11-order-detail-ready-1440.png` (the teal `Ready for collection` block with store, hours, ID and number, `Get directions`). The order was advanced with the mock's state route (the seed helper `seed:advance-order` needs the live project: owner row OA-01); the tracker on the confirmation page followed on its own after about 30 s (QFX-21). Buy again, the return and the collection tab are in `plans/evidence/L/browser-run-q.md`.

## J12 Errors and degraded behaviour: PASS (two deviations from the script)

| Step | Observation |
| --- | --- |
| 1 | `/en-US/does-not-exist`, `/en-CA/does-not-exist`, `/en-US/journal/nope`, `/en-US/policies/nope`: localized 404 with the shell, search and category links, HTTP 404 (`J12-404-375.png`). **An unknown product or category answers HTTP 200** with the not-found page and `noindex`, because the page streams under its `loading.tsx` (recorded as Q-Q-18, default: keep). |
| 2 | `/api/nothing`: JSON 404 `{ error: { code: 'not_found' } }`; `GET /api/orders` with no cookie: 401 `Sign in required`, no detail. A cross-site `Origin` is 403 `forbidden_origin`. |
| 3 | A second server (port 3002, stopped afterwards) with the commercetools URL dead (`https://127.0.0.1:9`; the script's `http://` URL is wrong because the SDK is `https` only): About, Contact, FAQ, policies and Journal render completely; the listing shows the localized error page with `Try again` (no reference number; the script says there should be one: idea), the checkout shows the retry state; the cart count shows 0 while the commerce tier is down (idea); no stack trace or commercetools message anywhere. A refused connection is now a 503 `upstream_unavailable` (was 500, QFX-16). `J12-degraded-listing-1440.png`, `J12-degraded-listing-375.png`, `J12-degraded-checkout-1440.png`, `J12-degraded-checkout-375.png`. |
| 4 | Recovery: with the server back, `Try again` loads the checkout and the bag is intact. |

Every error page now has a document title (QFX-08).

## J13 Content pages and contact: PASS

Footer links land on real pages in both locales; no Impressum, no VAT text. Contact with the mock receiver (`scripts/dev/mock-contact-receiver.mjs`, port 4010): a valid message shows the reference and the channel; with the receiver failing the message stays in the form with the phone and email shown (receiver log: one `OK`, one `FAIL`); the sixth submit in ten minutes is 429 (the route now uses the shared limiter, QFX-09). FAQ: `#question-<id>` and `?q=<id>` open the answer; an unreachable feedback endpoint shows nothing. Policies show the effective date and the draft banner. Journal: two tags with no common article give the empty state with removable chips. `J13-contact-375.png`, `J13-faq-375.png`, `J13-journal-375.png`, `J13-journal-empty-1440.png`.

## J14 Isolation, 401 matrix and cookies: PASS

1. 20 per-person routes without a cookie: 401 `unauthorized` / `Sign in required`, one body shape, `Cache-Control: no-store`; a guest asking for an order by id gets 404 `order_not_found` (the same as an unknown id). A PUT or PATCH to a route that does not take it is a plain 405 from Next.
2. `maya.okonkwo` reads her orders, address and profile; `liam.carter` asks for her order by id and by number, reorder and returns on it, and deletes her address id: 404 every time with the same body as an unknown id; his own addresses show none of hers. Another customer's review and subscription: 404.
3. Both shoppers load `/en-US`, `/en-US/cart`, `/api/cart` and `/api/auth/me` at the same time: each carts and profile are their own; every HTML page and API answer is `private, no-cache, no-store` (HTML) or `no-store` (API); no `public` on a per-person answer, no `cache-status` header; the home page HTML is the same bytes for both and holds no personal data.
4. `Cookie: malva-session=abc.def.ghi` and a well-formed token signed with another secret (made with `jose` in a scratch script, the real secret never used): `/api/auth/me` and `/api/cart` answer an empty session, `/api/orders` and `/api/account/profile` answer 401; no detail.
5. Login `Set-Cookie`: `malva-session=...; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=lax`.
6. Rate limit (run last): the sixth failed login for one email in ten minutes is 429 `too_many_attempts` with `Retry-After: 600` and `retryAfterSeconds`; attempts one to five answered 401. The server was restarted afterwards (the limiter is in memory).

## J15 Payment declined and retry: blocked: OA-K-a

Needs the hosted Checkout with the Stripe test mode (declined card). What the storefront does around it is covered: `Back to review` unmounts the widget and a new session is created on return, an order that already exists goes to its confirmation and never to a second session, a changed total is 409 `totals_changed` (`components/checkout/CheckoutPage.test.tsx`, `app/api/checkout/placement-routes.test.ts`). Live steps: owner rows M-K-01 to M-K-04 and `plans/OWNER-HANDOFF.md`.

## Cleanup and leftovers

See `test-data.md`. The seed cleanup needs the live project (owner row M-Q-04): `seed:cleanup-tests` was run only against its in-memory fake (dry run, guards) and the register above is its input. Everything created here lives in the in-memory mock and disappears with it; nothing was written to a live project.
