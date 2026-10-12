<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions from workstreams N, O, P, Q

Updated 2026-10-12 after the owner interview (`notes/owner-answers.md`, binding). Only questions that change the build. Answered questions are in the first table; open ones keep the default the workstream follows, so nothing waits. The coordinator merges these rows into `plans/QUESTIONS.md`.

## Answered by the owner

| Id | Question | Answer (binding) | Workstream files updated |
| --- | --- | --- | --- |
| Q-O01 | Payment approach (OA-05): offline provider, or a PSP through commercetools Checkout? Which PSP? | **commercetools Checkout, full hosted flow (`checkoutFlow`), with the Stripe connector behind it** (owner answer Q-012). No offline or pay-at-pickup default, no payment provider interface. OA-05 is a real owner action: Stripe test account, Stripe connector installed in the project, Complete Checkout Application configured, `CTP_CHECKOUT_APP_KEY` supplied. | O (rewritten), P (D5), N (D19), M (D13) |
| Q-O03 | What defines the territory a reseller may deliver to? | **No territory blocking at checkout** (owner answer Q-O03). The only country limit is the Application's configured countries (owner configuration), not storefront logic. | O (D7), N |
| Q-P01 **Answered 2026-10-12** | Email provider? (the old OA-06 is removed) | **No emails at all** (owner answer Q-P01): no mail connector, no outbox, no replay script, no OA-06. The confirmation page and password reset work on screen only (reset via the commercetools password token shown and consumed in the app, demo only, acknowledged by M-Q02). | P (rewritten), Q (D4, Q-04) |
| Q-Q01 | Return window length and eligibility basis? | **30 days from delivery**; the portal sets `custom.deliveredAt` (owner-confirmed default). | Q (D6, Q-07) |
| Q-Q06 | Are recurring items sold in this phase? | **Yes, subscriptions are sold fully** (owner answer Q-Q06): recurrence policies on selected parts, subscribe option on the product page, recurring order through hosted Checkout and Stripe where the connector supports it (else the subscribe option is switched off by `SUBSCRIPTIONS_PURCHASE_ENABLED=false`), account management (skip, pause, resume, change frequency, cancel), recurrence policies `mau-rp-*`. | M (D13), N (D18), O (D8), Q (D10, Q-12), W (portal side) |

## Revised by the owner answers (default updated)

| Id | Question | Default taken now | What it blocks |
| --- | --- | --- | --- |
| Q-O02 | Billing address, express wallets, order-review step, terms checkbox: any wanted? | The hosted Checkout collects what it collects; no billing address of our own, no wallets (`expressPayment` unused), no review step; terms are a mandatory **user agreement** configured in the Checkout Application (replaces our own checkbox) | OA-05 configuration; M-O03 terms text |
| Q-O05 **Resolved by O-00 (J20, 2026-10-12)** | Order number format? | **Checkout sets the number itself**: the Sessions API accepts `metadata.futureOrderNumber`, stored as `Order.orderNumber`. The storefront sends `MA-` plus 8 Crockford base32 characters derived from the **cart id** (the order id does not exist yet; one order per cart, so it is stable and unique). `ensureOrderNumber` (`setOrderNumber`, salt on `DuplicateField`) stays only as a fallback for an order that arrives without a number | Number shown on the confirmation page and in the account; portal order search |
| Q-Q04 | Saved payment methods? | Page lists the customer's tokenised `PaymentMethod` resources created by Checkout and Stripe (for example for subscriptions) and allows delete; no Add button (methods are saved inside the hosted checkout); delete is blocked while a subscription uses the method | Payment methods page in Q-10 |

## Open (default taken, nothing waits)

| Id | Question | Default taken | What it blocks |
| --- | --- | --- | --- |
| Q-N01 | Where does "ships later" stock come from? Is there a Malva master inventory entry (the warehouse channel) behind each reseller branch entry? | Yes, as seeded: branch stock = inventory entry with the branch supply channel (about 70 % of carried items, 1 to 28 units); ships-later stock = the entry of the warehouse supply channel `mau-supply-malva-dc` (150 to 549 units, every priced master part; no channel-less entries, no warehouse stock for reseller-owned local parts); if neither covers the quantity the cart caps it | The stock line and quantity cap in N-05 |
| Q-N02 | Are the shipping methods `mau-ship-pickup` (rate 0), `mau-ship-standard` (zone rate with `freeAbove`: DE 5.90 EUR above 150, US 9.90 USD above 175) and `mau-ship-express` seeded? | Yes (project-wide, not per store); N reads fee and threshold from the matching rate and shows "No delivery option available" when none matches; Checkout shows the same matching methods | Delivery choice and free-shipping text in N-04 and the shell utility bar |
| Q-N03 | Should a cart line that no longer fits a changed vehicle block checkout? | Warn only (banner and line badge), never block (consistent with Q-M02) | Checkout button rule in N-12 |
| Q-O04 | Who creates the custom types `malva-checkout`, `malva-line`, `malva-customer`, `malva-return-item` (and `store-settings`, `branch-info`) and the state `ready-for-pickup`? | The seed (`seed/src/data/custom-types.ts`, `states.ts`; unprefixed keys are the documented exception Q-S14). O-01 and P-01 only verify them; none is created in the storefront. The seeded `malva-checkout` has a `mobile` field that no storefront workstream writes (no mobile alerts, Q-P01); it may be removed from the seed later | Cart and order custom fields, returns |
| Q-O06 (new) | Can the installed Stripe connector process recurring orders (Stored Payment Methods)? | Assumed yes; if OA-05 finds it cannot, `SUBSCRIPTIONS_PURCHASE_ENABLED=false` hides the subscribe option and the cart refuses subscription lines | Subscribe option (M), cart (N), checkout session (O) |
| Q-O07 (J20 finding) | Does the Checkout widget run in a cross-origin frame that the browser tool cannot drive? | **Partly.** SDK 1.7.5 is not an iframe: it injects `https://app.checkout.{region}.commercetools.com/main.js` into the page and renders into `<div data-ctc>` in the same document, so the address, shipping and agreement fields can be driven. Stripe's own card fields are Stripe frames (cross-origin), so the card number cannot be typed by the browser tool: M-O01 (owner or developer places the test-card orders) stays | O recipe steps 3 to 10 |
| Q-P04 | Source of the delivery window text on the confirmation page? | The order store's `store-settings.shipDaysMin` and `shipDaysMax` ("2-3 business days"; the seeded shipping methods have no `localizedDescription`); the sentence omits the window when absent | Shipping sentence in P-03 |
| Q-P05 | Must a guest verify the email before "Create account" attaches the order? | No; possession of the order link or the same browser is enough; the customer is created unverified | Claim route in P-05 |
| Q-Q02 | Invoice format? | Printable HTML page (print to PDF), reference = order number | Invoice page in Q-06 |
| Q-Q03 | How is "ready for pickup" represented? | Order state with key `ready-for-pickup` (seeded, `initial: false`, no transitions), set by the reseller in the portal | Account home notice and status chips in P and Q |
| Q-Q05 | Delete account retention behaviour? | Anonymise customer, lock credentials, cancel subscriptions, keep orders unchanged, sign out | Delete flow in Q-11 (legal check M-Q03) |
| Q-Q07 (new) | Which update action changes the frequency of an existing recurring order? | Confirmed from the OAS before coding (Q-12); if none exists the "Change frequency" action is hidden and the gap is reported | Change frequency in Q-12 |

## Added by workstream N (J18, 2026-10-12; default taken, nothing waits)

| Id | Question | Default taken | What it blocks |
| --- | --- | --- | --- |
| Q-N04 | The seeded tax rate names are "DE VAT 19%" and "US sales tax placeholder 0%"; the spec wants "VAT (19%)". Can the seed carry a plain localized rate name (for example "VAT" and "MwSt.")? | The cart page derives the label: rate name without country prefix, repeated percentage and the word "placeholder", then the rate (`taxLabel` in `lib/mappers/cart.ts`): "VAT (19%)" (also in de-DE) and "Sales tax (0%)" | The German label reads "VAT" not "MwSt."; M-N03 |
| Q-N05 | Where does "ships later" arrive in days? | Not shown: the line says "Ships later" (or "{n} from {branch}, {m} ships later"); the delivery option has no business-day text because the shipping methods have no localized description | Wording of the stock line, Q-P04 |
| Q-N06 | The `next` address after sign-in: store relative (`/cart`) or full? | Store relative path without locale and store key (`safeNext`), the form adds the store key; Q's account area and Checkout use the same form (`/{store}/cart`, `/account/orders`) | Q-03 redirects, O return links |
| Q-N07 | Does the storefront need `view_shipping_methods`, `view_inventory`-type scopes beyond the list in the plan? | Reads use the existing client scopes of `.env.example` plus those the plan N-01 names; a 403 names the missing scope and the cart degrades (empty delivery options, stock 0) instead of failing | First live run (M-N02) |

## Added by workstream O (J20, 2026-10-12; default taken, nothing waits)

| Id | Question | Default taken | What it blocks |
| --- | --- | --- | --- |
| Q-O08 | N's cart mapper and `planRescope` read the presence of the cart field `pickupBranchKey` as "pickup mode". The plan (D9) wanted O to write it on every cart. | O does **not** write it on the cart (that would turn a ship cart into a pickup cart). The hosted Checkout lets the shopper change the preset method, so on the return route the **order** is reconciled: a pickup order keeps or receives `pickupBranchKey` (the session branch), any other method clears it. P and the portal read it from the order | P delivery details, portal pickup queue |
| Q-O09 | The Checkout locale `de-DE` is unknown to Checkout (it falls back to English). | The route locale is mapped: `de-DE` gives `de`, `en-US` stays `en-US` (`lib/checkout/locale.ts`); `currencyLocale` is the route locale | German hosted page |
| Q-O10 | The Browser SDK injects a script from `app.checkout.{region}.commercetools.com`, calls `checkout.{region}...` and mounts Stripe frames: the strict CSP (G, I) would block all of it. | `lib/csp.ts` adds exactly those hosts plus `js.stripe.com`, `api.stripe.com` and `hooks.stripe.com` only when `CTP_CHECKOUT_APP_KEY` is set and the region derives from `CTP_API_URL`, **at build time** (headers are fixed by `next build`). Confirm the list against the connector's own documentation at OA-05 (a Stripe connector version may need more hosts) | First live check (M-O01) |
| Q-O11 | Which query parameters does Checkout append to the payment return URL? Unknown without a live Application. | `/checkout/return` accepts `orderId` or `orderNumber`; a return without either (cancel or expiry) goes back to `/{locale}/{store}/checkout?status=cancelled` for a shopper with a store in the session, else 404. If the Application sends a different parameter name, only the route changes | Redirect-based payment methods |
| Q-O12 | Guest access to the confirmation page. | The return route mints P's token (`lib/order-access.ts`, a stub of O with P's signatures) and redirects to `.../confirmation/{number}?t=<token>` for anyone who is not the signed-in owner; the owner customer gets the plain URL. P replaces the stub (own secret `ORDER_ACCESS_SECRET`) | P-01 |
| Q-O13 | The Sessions API has no entry in the platform SDK. | One raw `fetch` in `lib/checkout/session.ts` (the lint rule against raw commercetools fetches is satisfied because the URL is built in a variable; the OAuth token comes from the same client credentials with `manage_sessions:{projectKey}`). The scope `manage_sessions` is added to `.env.example` and `lib/scopes.ts`; the owner adds it to the API client (OA-05 step 4) | Live session creation |
| Q-O14 | Recurring order for a subscription cart: Checkout creates it after the first payment (docs). The dev helper cannot pay. | The dev helper creates the order and then, best effort, one Recurring Order from the ordered cart (`recurring-orders` POST with `cart` and `cartVersion`); a failure is logged and never rolls the order back. Q verifies subscription management against this; the live shape is confirmed at M-O01 | Q-12 before OA-05 |
| Q-O15 | Stored Payment Methods (needed for a subscription's renewals) require a `customerId` on the cart, so a **guest** cannot start a subscription through Checkout. | The cart and the checkout still allow a guest with a subscription line (the plan does not forbid it); decide at the first live check (M-O05, with the real connector) whether to require sign-in before a subscription checkout (a redirect to the sign-in page with `next=/checkout`, N's `safeNext`) | Subscription purchase by guests, Q-12 |

## Removed as obsolete (owner answer Q-P01: no emails)

| Id | Was | Why removed |
| --- | --- | --- |
| Q-P02 | Where the portal stores editable email templates | No emails are sent, so no template contract exists; the portal keeps its Marketing and email screens but they never send (W) |
| Q-P03 | Store logo and favicon location for the email and header | The email use is gone; the header logo is Q-I03 (store settings) |
| Q-P06 | Links in emails: one origin or per-reseller domains | No emails |
