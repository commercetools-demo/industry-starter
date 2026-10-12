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
| Q-O05 | Order number format? | Checkout creates the order, so the storefront assigns the number afterwards: `MA-` plus 8 Crockford base32 characters derived from the **order id** with `setOrderNumber` (idempotent, retry with salt on `DuplicateField`); if Checkout can set the number itself, that is used instead (O-00 check) | Number shown on the confirmation page and in the account; portal order search |
| Q-Q04 | Saved payment methods? | Page lists the customer's tokenised `PaymentMethod` resources created by Checkout and Stripe (for example for subscriptions) and allows delete; no Add button (methods are saved inside the hosted checkout); delete is blocked while a subscription uses the method | Payment methods page in Q-10 |

## Open (default taken, nothing waits)

| Id | Question | Default taken | What it blocks |
| --- | --- | --- | --- |
| Q-N01 | Where does "ships later" stock come from? Is there a Malva master inventory entry (the warehouse channel) behind each reseller branch entry? | Yes, as seeded: branch stock = inventory entry with the branch supply channel (about 70 % of carried items, 1 to 28 units); ships-later stock = the entry of the warehouse supply channel `mau-supply-malva-dc` (150 to 549 units, every priced master part; no channel-less entries, no warehouse stock for reseller-owned local parts); if neither covers the quantity the cart caps it | The stock line and quantity cap in N-05 |
| Q-N02 | Are the shipping methods `mau-ship-pickup` (rate 0), `mau-ship-standard` (zone rate with `freeAbove`: DE 5.90 EUR above 150, US 9.90 USD above 175) and `mau-ship-express` seeded? | Yes (project-wide, not per store); N reads fee and threshold from the matching rate and shows "No delivery option available" when none matches; Checkout shows the same matching methods | Delivery choice and free-shipping text in N-04 and the shell utility bar |
| Q-N03 | Should a cart line that no longer fits a changed vehicle block checkout? | Warn only (banner and line badge), never block (consistent with Q-M02) | Checkout button rule in N-12 |
| Q-O04 | Who creates the custom types `malva-checkout`, `malva-line`, `malva-customer`, `malva-return-item` (and `store-settings`, `branch-info`) and the state `ready-for-pickup`? | The seed (`seed/src/data/custom-types.ts`, `states.ts`; unprefixed keys are the documented exception Q-S14). O-01 and P-01 only verify them; none is created in the storefront. The seeded `malva-checkout` has a `mobile` field that no storefront workstream writes (no mobile alerts, Q-P01); it may be removed from the seed later | Cart and order custom fields, returns |
| Q-O06 (new) | Can the installed Stripe connector process recurring orders (Stored Payment Methods)? | Assumed yes; if OA-05 finds it cannot, `SUBSCRIPTIONS_PURCHASE_ENABLED=false` hides the subscribe option and the cart refuses subscription lines | Subscribe option (M), cart (N), checkout session (O) |
| Q-O07 (new) | Does the Checkout widget run in a cross-origin frame that the browser tool cannot drive? | Assumed possibly; then the test-card orders are placed by the owner or a developer (M-O01) and Claude verifies with the MCP read tools | O recipe steps 3 to 10 |
| Q-P04 | Source of the delivery window text on the confirmation page? | The order store's `store-settings.shipDaysMin` and `shipDaysMax` ("2-3 business days"; the seeded shipping methods have no `localizedDescription`); the sentence omits the window when absent | Shipping sentence in P-03 |
| Q-P05 | Must a guest verify the email before "Create account" attaches the order? | No; possession of the order link or the same browser is enough; the customer is created unverified | Claim route in P-05 |
| Q-Q02 | Invoice format? | Printable HTML page (print to PDF), reference = order number | Invoice page in Q-06 |
| Q-Q03 | How is "ready for pickup" represented? | Order state with key `ready-for-pickup` (seeded, `initial: false`, no transitions), set by the reseller in the portal | Account home notice and status chips in P and Q |
| Q-Q05 | Delete account retention behaviour? | Anonymise customer, lock credentials, cancel subscriptions, keep orders unchanged, sign out | Delete flow in Q-11 (legal check M-Q03) |
| Q-Q07 (new) | Which update action changes the frequency of an existing recurring order? | Confirmed from the OAS before coding (Q-12); if none exists the "Change frequency" action is hidden and the gap is reported | Change frequency in Q-12 |

## Removed as obsolete (owner answer Q-P01: no emails)

| Id | Was | Why removed |
| --- | --- | --- |
| Q-P02 | Where the portal stores editable email templates | No emails are sent, so no template contract exists; the portal keeps its Marketing and email screens but they never send (W) |
| Q-P03 | Store logo and favicon location for the email and header | The email use is gone; the header logo is Q-I03 (store settings) |
| Q-P06 | Links in emails: one origin or per-reseller domains | No emails |
