<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions for the owner

Nothing here blocks work: each row has the **default being built**. Answer by editing the `Answer` column (or tell the lead); the team then changes the default if needed. Juniors add rows (`Q-<letter>-<n>`); the lead consolidates the per-workstream drafts from `plans/notes/questions-*.md` below the table of project-level questions.

## Project-level questions (lead)

| ID | Question | Default being built | Blocks | Status | Answer |
| --- | --- | --- | --- | --- | --- |
| Q-001 | Which commercetools project (key and region) is Malva Coffee? | Project key and region come from `.env.local`; nothing hard-coded | Live runs of A, B, C, D | Answered | spec-test-b2c-food; API clients supplied in .env (2026-10-21) |
| Q-002 | Should the site send email (order confirmation, password reset, email verification, subscription reminders)? Which provider? | **No email infrastructure.** Demo customers are seeded verified; reset and verification are specified behind a mail adapter that logs in dev. No email is promised in the UI copy | J, K, N | Answered | No email provider. Registrations verified automatically. No password reset (D-032) |
| Q-003 | Mixed bags: one order with collect and ship lines (multiple shipping), or one order per fulfilment group? | One order using multiple shipping if the hosted Checkout supports it (spike K-01); otherwise one order per group paid in sequence | K | Answered | Yes, mixed bags; cart lines clearly marked in their clusters (D-033) |
| Q-004 | Timed delivery slots (as in grocery) or standard carrier delivery only? | **Standard carrier only**, no slots (`delivery-slot-booking` not applicable) | K | Answered | Standard carrier (D-034) |
| Q-005 | Loyalty points programme? | **No loyalty**; the points text of the prototype is removed | L | Answered | Default accepted (2026-10-21) |
| Q-006 | Which products are subscribable and which intervals? | All pods and coffees; intervals 2 weeks, 1, 2 and 3 months; 10% saving | N, C | Answered | Default accepted (2026-10-21) |
| Q-007 | Which stores, and collection readiness time per store? | Six invented stores (2 per market) per `SEED-PLAN.md`, 30 minutes ready time, read from channel data | C, F | Answered | Six stores, all in NYC (D-035) |
| Q-008 | Free-shipping thresholds and delivery prices per market? | US 75 USD, DE 60 EUR, GB 50 GBP; standard 6.95 / 4.90 / 3.95; express 14.95 / 12.90 / 9.95 | C, I | Answered | US as proposed (75 USD, standard 6.95, express 14.95); DE and GB dropped (D-030); Canada free above 99 CAD, standard 8.95 and express 19.95 CAD (plan values, standard carrier only D-034) |
| Q-009 | Returns window and policy? | 30 days for unopened items; shown in the promise bar and PDP; the prototype's 90 days is dropped | H, P | Answered | Default accepted (2026-10-21) |
| Q-010 | Tax rates (food, standard) per market? | US 0% food, 8% standard (NY 8.875%); DE 7% / 19%; GB 0% / 20%. The owner or an accountant confirms before real use | B, K | Answered | Defaults fine; also enable Search API and changeCountryTaxRateFallbackEnabled in project config (D-036) |
| Q-011 | Review moderation: publish immediately or approve first? | **Approve first** (`mcf-review-pending` until approved in the Merchant Center); seeded reviews are approved | M | Answered | No moderation (D-037) |
| Q-012 | Blog and resources content? | Out of the first release; `blog-resources` planned in P as a thin article route fed by static markdown if time allows | P | Answered | Default accepted (2026-10-21) |
| Q-013 | German copy: who translates? | The team writes German catalogue and product text; a native speaker reviews (SO-03) | E, C | Answered | Markets are US and Canada only (D-030); German dropped |
| Q-014 | Saved payment methods in the account? | **Not built**; the hosted Checkout and the payment provider own card data. The tab is hidden until a provider supports it | L | Answered | Default accepted (2026-10-21) |
| Q-015 | Hosting target: Vercel or Netlify? | Vercel via `/commercetools:nextjs-deploy-vercel`; decided before Q | Q | Answered | Netlify (D-038) |
| Q-016 | Payment provider for the hosted Checkout? | Stripe test mode through the commercetools Stripe connector | K | Answered | commercetools complete Checkout connected to Stripe (D-039) |
| Q-017 | Guest checkout allowed? | Yes (the design has it) | K | Answered | Default accepted (2026-10-21) |
| Q-018 | Cookie consent and analytics? DE and UK law requires consent for non-essential cookies | Essential cookies only (session, locale, store); no analytics; a consent banner is added when analytics are chosen | Q, P | Answered | Default accepted (2026-10-21) |
| Q-019 | Legal pages: Impressum (Germany), privacy, terms, cookie policy; who supplies the text? | Placeholder pages marked "draft" with effective date; SO-01 | P | Answered | Default accepted (2026-10-21) |
| Q-020 | Product names, descriptions, origins and prices in the seed: invented or supplied? | Invented but realistic (never real third-party brand names); replaceable by editing `seed/src/data` | C | Answered | Default accepted (2026-10-21) |
| Q-021 | Are "Gifts" a top-level category? | Yes (design nav has Gifts) with gift sets | C, F | Answered | Default accepted (2026-10-21) |
| Q-022 | Wordmark, logo, favicon and photography rights | Text wordmark in Archivo as the prototype; photography from the image endpoint (OA-03) | E, C | Answered | Default accepted (2026-10-21) |
| Q-023 | Search behaviour: typo tolerance, synonyms (espresso/ristretto), suggestions? | Product Search default relevance; no synonyms; suggestions after the browse works | G | Answered | Default accepted (2026-10-21) |
| Q-024 | Product Search cannot sort or filter on `reviewRatingStatistics`? | G verifies; fallback is an indexed `ratingAverage` attribute maintained by the seed and a review hook | G, M | Answered | Default accepted (2026-10-21) |

## Workstream questions

Generated from `plans/notes/questions-*.md` by `node plans/consolidate-notes.mjs` (re-run after editing a note; edit the **notes**, not this block). The `Answer` column is filled in the notes file by the lead when the owner answers.

<!-- BEGIN WORKSTREAM-QUESTIONS -->
| ID | Question | Default being built | Blocks | Status | Answer |
| --- | --- | --- | --- | --- | --- |
| Q-J-01 | Is SSO or federated sign-in required? | No. No SSO control or route is built. | No | Open | |
| Q-J-02 | Are customers global or store-scoped? | Global customers, global `/login`, no `in-store` calls. | No | Open | |
| Q-J-03 | Which email provider sends verification and reset mails? | Removed by D-032: no email provider, no mail adapter. | No | Superseded (D-032) | |
| Q-J-04 | What may a new customer do? | Everything; registration is verified automatically (D-032). | No | Superseded (D-032) | |
| Q-J-05 | Does registration reveal that an email already exists? | No. Generic refusal text pointing to sign-in (no reset exists). | No | Open | |
| Q-J-06 | Must a password reset end sessions in other browsers? | Removed by D-032: no password reset. | No | Superseded (D-032) | |
| Q-J-07 | Reset and identity specs conflict on unverified accounts. | Removed by D-032: `password-reset` and `email-verification` are not applicable. | No | Superseded (D-032) | |
| Q-J-08 | Where are the terms and privacy pages linked from the register form? | `/${locale}/terms` and `/${locale}/privacy`; P may rename. | No | Open | |
| Q-J-09 | Token validity for reset and verification? | Removed by D-032: no tokens. | No | Superseded (D-032) | |
| Q-J-10 | Password policy? | 10 to 128 characters, one letter, one digit, not the email. | No | Open | |
| Q-J-11 | Cart merge mode when the customer already has an active cart? | `MergeWithExistingCustomerCart`. | No | Open | |
| Q-J-12 | Rate limiting on more than one server instance? | In-memory per instance now; shared store when hosting needs it (OA-05). | No | Open | |
| Q-J-13 | D's error envelope is closed (fixed `ErrorCode`, body exactly code and message). Field-level and domain codes need extra properties. May the envelope carry extras? | Yes: `domainError(code, status, extra)` in `lib/api-domain.ts` keeps `{ error: { code, message, ...extra } }`, never commercetools text. | No | Open | |
| Q-J-14 | The register page reads the HTTP-only `mcf_guest_email` cookie but a Server Component cannot delete a cookie. Where is it deleted? | The register route clears it on success (`Max-Age=0`). If the shopper never registers it stays until K's own expiry. | No | Open | |
| Q-J-15 | Workstream I has not shipped `CartView`. What does `cart` in the login and register responses hold? | `AuthCart { id, lineCount, quantity }` (in `lib/types.ts`). Follow-up for I: switch to its `CartView` and call `mutate(KEY_CART, cart, false)` in `useAuthActions.adopt`; today it revalidates `KEY_CART_COUNT` only. | No | Open | |
| Q-J-16 | The plan says `502 upstream_unavailable`; D's `handle()` maps upstream failures to `503`. | Keep D's `503 upstream_unavailable` (the UI maps the code, not the status). | No | Open | |
| Q-J-17 | D-040 says `DEMO_LOGIN_ENABLED` defaults true; the spec says the control is absent unless it is `true`. | Code treats only the literal `true` as on and also needs `DEMO_LOGIN_PASSWORD`; the owner sets `DEMO_LOGIN_ENABLED=true` in `.env.local` for the demo project. | No | Open | |
| Q-J-18 | The "bag was added" toast: plan says when the merged bag has more lines than the guest bag. | Shown when the guest had a bag (units from the header count) and the merged bag has more units; no toast for an empty guest bag. | No | Open | |
| Q-K-01 | The complete hosted Checkout (D-039) has its own pay button and pages; the design's three steps and "Place order" button are replaced. Accept? | Answered by D-039: Review stage ours, the rest hosted; the pay button is labelled "Place order" through Application texts (OA-K-d); the owner judges fidelity in SO-K-b. | No | Answered | |
| Q-K-02 | Mixed bags (required, D-033): which mechanism after the spike? Should G/I create every cart as `shippingMode: Multiple`? | Mechanism from K-01's rule (`complete-multiple`, `complete-per-group`, `payment-only-for-collect`). G's `CART_SHIPPING_MODE` stays `'Single'`; K clones into a `Multiple` cart when the strategy needs it. Reason: with `Multiple` the cart page shows no tax estimate until every quantity is allocated, which would break `design-cart-page` Tax presentation. | Blocks K-03 to K-07 detail only | Open | |
| Q-K-02b | If only tax fails under Multiple: fix data or fall back? | Fix data in the seed and keep the strategy. | No | Open | |
| Q-K-02c | Under `complete-per-group`, on which order do discount codes apply? | First order only. | No | Open | |
| Q-K-03 | Can the hosted pay button be hidden or triggered from our page? | Not assumed; probe S12. | No | Open | |
| Q-K-04 | Order number format? | `MC-` plus 10 base32 characters derived from the cart id (deterministic, so retries cannot duplicate). | No | Open | |
| Q-K-05 | What if an order exists but `transitionState` to `mcf-order-ordered` fails? | Log, show the order with no tracker, retry on the next read. | No | Open | |
| Q-K-06 | May the shipping country differ from the market? | No: the shipping country is the session country (cart currency and prices depend on it); the Application is limited to the market's country if S12 shows it can be. | No | Open | |
| Q-K-07 | Billing address and pickup identity for collect orders? | We ask a pickup name on Review; the hosted flow collects the rest. | No | Open | |
| Q-K-08 | Should "Check out as guest" detach the order from the signed-in customer? | Not applicable under the hosted flow: a signed-in cart stays the customer's; guests use a guest cart. | No | Open | |
| Q-K-09 | Save a new checkout address to the account? | Whatever the hosted flow does; L's address book is the place to manage addresses. | No | Open | |
| Q-K-10 | Where does a guest's email travel to the register page? | HTTP-only cookie `mcf_guest_email`, 1 hour, deleted on read. Never a URL. | No | Open | |
| Q-K-11 | Where do delivery-day texts come from? | `ShippingMethod.localizedDescription` for `en-US` and `en-CA` (seed change): "2-4 business days" style for standard. No text if absent. | No | Open | |
| Q-K-12 | Tracker mapping for `ordered`, and for ship-only orders? | `ordered` = Ordered active (spec, not the prototype). Ship-only orders (all Canada orders) show no tracker, only the delivery card. | No | Open | |
| Q-K-13 | Notification promises (emailed receipt, SMS when ready)? | None anywhere (D-032); copy says check the page or account. Answered. | No | Answered | |
| Q-K-14 | Guest order page access? | Anyone holding the order id sees it with phone and billing hidden; member orders need the owning session. | No | Open | |
| Q-K-15 | Idempotency on the placement path if `complete` is called twice? | `finalizeOrder` is idempotent by order number. | No | Open | |
| Q-K-16 | Express delivery: does the hosted flow offer it next to standard? D-034 says standard carrier only. | Seed standard and express as methods; the hosted flow lists what matches; no carrier choice, no slots. Owner may drop express from the seed. | No | Open | |
| Q-K-17 | Strategy before the live spike: which mechanism is built? | `complete-per-group` (documentation predicts S13 FAIL). Built: the bag is cloned at pay time into one Single cart per group (each collect store, then delivery plus subscription), paid in sequence as orders `<base>-A`, `-B`. `lib/checkout/strategy.ts` is the one switch; `buildFulfilmentActions` and `ensureCheckoutCart` exist for `complete-multiple`. | Re-run S13 to S15 live (OA-K-a) | Open | |
| Q-K-18 | Where do the clone cart ids live between the Review stage and payment? | A short HTTP-only cookie `mcf_pay_carts` (ids, labels and display amounts; every use re-checks ownership), not a new session field, because the session token format is shared with the proxy. | No | Open | |
| Q-K-19 | Order lines carry no attribute labels (attributes are not saved on lines, Q-I-7), so the confirmation shows name and quantity without the variant summary. | Empty `variantSummary` on orders; follow-up: enrich from a product read or save the attributes on the line. | No | Open | |
| Q-K-20 | `seed:order` file location: the plan says `seed/src/scripts/order-ops.ts`. | `seed/src/order-ops.ts`, next to the other scripts (the seed has no `scripts` folder). L adds subcommands there. | No | Open | |
| Q-K-21 | Which SDK locale for `en-CA` and `en-US`? | Both `en`; the page locale goes in `currencyLocale` for money formatting. Probe S12 confirms live. | No | Open | |
| Q-K-22 | A redirect payment (3-D Secure) of the first of two payments. | `/checkout/return` finalises it and sends the shopper to `/<locale>/checkout?resume=1&part=<n>`, which opens the next payment. | No | Open | |
| Q-K-23 | The mock needs the Sessions API. | Optional `CTP_SESSION_URL` (base URL) overrides the session host; unset in every real environment. | No | Open | |
| Q-K-24 | Guest order access (Q-K-14) shows the shipping address to whoever holds the order id (a UUID). | Kept: no customer phone or billing address is in the view at all. | No | Open | |
| Q-L-01 | Which saved payment methods does the hosted Checkout and the chosen connector actually store, and which fields identify them? | Show what the connector writes (label, default flag); no add form; the rest is "not applicable" with an explanation (D-039). Finding from L-10. | No | Open | |
| Q-L-02 | Deleting the default address: promote the next (design-account-area) or leave none (address-book template)? | Promote; one constant `DEFAULT_ADDRESS_AFTER_DELETE` switches it, both tested. | No | Open | |
| Q-L-03 | Where is the address nickname (Home, Work) stored? | `additionalAddressInfo` of the address. | No | Open | |
| Q-L-04 | Can customers change their email? | No; shown read-only with "contact us" (no email verification exists, D-032). | No | Open | |
| Q-L-05 | Is there an address validation service? | No; format checks only; the `AddressVerifier` adapter and dialog exist and are tested with a fake. | No | Open | |
| Q-L-06 | Loyalty points and member perks? | Not offered; text and tile omitted (`design.md` Q7). | No | Open | |
| Q-L-07 | SMS alerts toggle? | Hidden; no SMS provider. | No | Open | |
| Q-L-08 | Returns window and eligible items? | 30 days from the order's last modification, all lines eligible (`RETURN_WINDOW_DAYS`); `SO-L-b` decides. | No | Open | |
| Q-L-09 | Buy again: new cart (order-history template) or add to the current bag (design)? | Add to the current bag (design); unavailable lines listed. | No | Open | |
| Q-L-10 | Account deletion: erase personal data of orders too? | No: `dataErasure: false`; order records retained and the modal says so. | No | Open | |
| Q-L-11 | Is the collection store saved per customer or per browser? | Per browser session cookie (30 days). A per-customer default would need a custom field. | No | Open | |
| Q-L-12 | Where do notification preferences live? | Removed by D-032: no email, no preferences, no custom type. | No | Superseded (D-032) | |
| Q-L-13 | Who owns the heart and saved-list server API: G and H built the heart on `sessionStorage`. | L implements `/api/shopping-lists` and swaps `useSavedItems` (as G's plan states). | No | Open | |
| Q-L-14 | Payment method "Remove": delete or deactivate? | Deactivate (`Inactive`), keeps history; the PSP token is not revoked. | No | Open | |
| Q-L-15 | Order-completed time for the returns window? | `order.lastModifiedAt` (approximation); a real delivered date needs the store tooling. | No | Open | |
| Q-L-16 | K's `OrderView`, `lib/ct/orders.ts`, `lib/mappers/order.ts`, `/api/orders/[id]` and `seed:order` against L's own order code. | Done in `ws/kl-reconcile`: one order model. K's `OrderView` is canonical and carries what the account needs (`status`, `hasCollect`, `hasShip`, `collect[].lat/lng`, `deliveries`, `returns`, `canReturn`, `returnWindowEndsAt`, `returnable`, line `sku`, `storeName`, `unitCents`). L's `account-orders.ts`, `account-order.ts`, `/api/orders/number/[orderNumber]`, `OrderStatusTracker`, `useOrder` and `seed:order-ship` are deleted; the account list, detail, returns and reorder routes use `lib/ct/orders.ts` (`listOrders`, `countOrders`, `getCustomerOrderBy*`, `addReturn`), `mapOrder`, `OrderStatusTrack` and `useOrderStatus`; `seed:order` has the subcommands `state`, `ship`, `deliver`, `return`. The K-06 default-address preselect test no longer exists (the hosted Checkout owns the address step), so nothing to swap. | No | Answered | |
| Q-L-17 | Which address validation rules? | Done in `ws/kl-reconcile`: `lib/account/address-validate.ts` keeps the US and CA postal, state and phone formats (K has none) and now takes the name rule (`NAME_PATTERN`) and the country list (`SHOP_COUNTRIES`) from K's `lib/checkout/validate.ts`. | No | Answered | |
| Q-L-18 | Small defaults taken | Canada has no State field; the first address becomes default; reorder caps quantity to stock; a delivery stock entry that is absent means out of stock; saved list read as `?view=ids` for hearts; tracking links only for known carriers; Subscriptions tab is a stub page for N; collection hours shown as `07:00-18:00`; the Ready chip is hidden in Canada. | No | Open | |
| Q-M-01 | Do new customer reviews need approval before they count? | Removed by D-037: no moderation; reviews are published on creation and counted at once. | No | Superseded (D-037) | |
| Q-M-02 | The storefront API client needs `manage_products` to write reviews (no narrower scope exists). Accept, or provide a second restricted client? | Decided by D-027: a second isolated server-only client (`lib/ct/review-client.ts`, env names `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, optional `CTP_REVIEWS_SCOPES`, default `manage_products:<project key>`); the main client keeps its scopes; ownership is checked in code. | Blocks live write tests only (OA-M-a) | Built to default | |
| Q-M-03 | Is the text required, or is a rating alone a valid review? | Rating required; title and text optional. | No | Open | |
| Q-M-04 | Can a customer who never bought the product review it? | Yes; a "Verified purchase" badge is set only when the customer has an order with the product (checked at write time). | No | Open | |
| Q-M-05 | Show reviews of every language in every locale? | Yes, as written, no filter, no translation. | No | Open | |
| Q-M-06 | Edit of a published review: does it need approval again? | No (D-037): the edit is live at once. | No | Superseded (D-037) | |
| Q-M-07 | Delete by the author: allowed for approved reviews too? | Yes (spec lists delete). | No | Open | |
| Q-M-08 | Rate limits? | 5 creates per hour, 30 edits or deletes per hour, per customer; in memory per instance (J's limiter, Q-J-12). | No | Open | |
| Q-M-09 | How is the one-review-per-product rule enforced? | `uniquenessValue` of customer id and product id, plus a pre-check; M-03 confirms the field. | No | Open | |
| Q-M-10 | Seeded reviews have no verified purchase (no orders in the seed). Add a custom field value to some seed reviews? | No; seed plan Q-C-04 stays. | No | Open | |
| Q-M-11 | If Product Search cannot filter or sort on rating statistics, who refreshes the indexed rating attribute after new reviews are posted? | G's fallback attribute is refreshed by `seed:ratings` (M-09) run by the team or owner; a subscription-driven refresh is not built. | No | Open | |
| Q-M-12 | Workstream L (account shell) is not built, so there is no Reviews stub to replace. | M created `app/[locale]/account/(shell)/reviews/page.tsx` (guarded by `requireCustomerPage`, no layout). L adds `(shell)/layout.tsx` and the tab link; the page stays. | No | Open | |
| Q-M-13 | The duplicate `uniquenessValue` error code is assumed to be `DuplicateField` (documented for unique fields). | `isDuplicate` checks `errors[].code === 'DuplicateField'`; the pre-check `findMyReview` also catches the normal case. Confirm live (M-M-03). | No | Open | |
| Q-M-14 | Review titles are single line. | Newlines in a title are replaced by spaces; the text keeps its line breaks. | No | Open | |
| Q-M-15 | Review text counts characters as Unicode code points (an emoji is one). | Yes; the input `maxLength` counts UTF-16 units, so the browser can stop a few emoji earlier than the server limit. | No | Open | |
| Q-N-1 | Fixed or Dynamic price selection, per product or project-wide? Is a link to subscription terms needed at the Subscribe card? | Fixed on every subscribe line, project-wide, stated in words ("Your price stays the same for every delivery"); no terms link | no | Open | |
| Q-N-2 | Which recurrence policies are offered and on which products? | The four seeded `mcf-every-*` policies on products with `subscribable = true` that have recurring prices (pods and coffee) | no | Open | |
| Q-N-3 | Who creates the recurring order: the platform (Order from Cart creates one per schedule) or the app (`POST /recurring-orders`)? | Platform. App code (N-09) only if spike N-02 shows none were created. Differs from the skill text, which says the app creates one per line | N-09 only | Open | |
| Q-N-4 | May a guest pay for a subscription? | No: account required before payment, enforced in the UI and in the order handler | no | Open | |
| Q-N-5 | How are renewal orders paid? Checkout recurring payments are public beta. | Not built. Renewals are created by commercetools; documented as a known gap; OA-N1 records the decision | live renewals only | Open | |
| Q-N-6 | Skip: one pending skip at a time or several? | One pending skip; button disabled with "Next delivery skipped" | no | Open | |
| Q-N-7 | Change interval: any policy? | Any seeded policy; price unchanged because mode is Fixed | no | Open | |
| Q-N-8 | Quantity change of a live subscription (in the spec scenario, not in the account design)? | Built only if the spike shows `changeLineItemQuantity` works on the recurring cart (N-10), else not built | N-10 only | Open | |
| Q-N-9 | Is cancel final, and is a cancellation reason asked? | Final, no reason | no | Open | |
| Q-N-10 | Pause with a resume date or open-ended? | Open-ended, "Resume" button | no | Open | |
| Q-N-11 | Free-shipping threshold on renewals (the recurring cart holds only subscription lines) and the scope of discount codes on renewals (`recurringOrderScope` on cart discounts)? | Note "Shipping is calculated for each delivery"; discounts untouched, flagged to workstream C | no | Open | |
| Q-N-12 | Show Subscribe when the product is `subscribable` and a recurring price exists, or by price only (skill)? | Both must hold (H builds this gate; N verifies) | no | Open | |
| Q-N-13 | Does the Frontend API client template include `view_recurrence_policies`? | Add it in OA-02 | N-01 live run | Open | |
| Q-N-14 | Subscription reminder e-mails? | Removed by D-032: no email provider; no reminder toggle | no | Superseded (D-032) | |
| Q-N-15 | German form of address (du or Sie) | Removed by D-030: German is dropped | no | Superseded (D-030) | |
| Q-N-16 | Seed a demo subscription per demo customer and a daily test policy `mcf-test-daily` (seed request SR-N1, workstream C)? | Not yet; verify through the checkout journey | no | Open | |
| Q-N-17 | Skip semantics of `Counter`: is `totalToSkip` cumulative, and does `nextOrderAt` move when the skip is set or when the order would have been created? Not documented (spike N-02, documentation pass) | Cumulative (`totalToSkip + 1`), `pendingSkips = totalToSkip - skipped`; no date computed in the browser: the card shows the platform's `nextOrderAt` and the label "Next delivery skipped" | live run (M-N-04) | Open | |
| Q-N-18 | `setSchedule` is refused by the platform while a skip is pending (SDK doc). Should Change interval wait until the skip has passed? | Yes: the button is disabled with an explanation and the API answers `invalid_state` | no | Open | |
| Q-N-19 | K's hosted flow has no "Continue as guest" control to hide (workstream plan D6). Where does the guest rule show? | On K's Review stage: a notice with Sign in and Create an account, and Continue disabled; the session and pickup handlers answer `401 sign_in_required` through K's `EXTRA_BLOCKERS` | no | Open | |
| Q-N-20 | A recurring order whose origin order was deleted or never queried shows an order as "Subscription pending" forever (pending = one of the last 10 orders with recurring lines and no recurring order naming it as origin) | Accept; it appears only when the platform failed to create it | no | Open | |
| Q-N-21 | Number of the plan tasks: this plan's task list is N-00..N-11 (the notes draft says N-09, N-10, N-13) | The workstream file is authoritative | no | Open | |
| Q-O-1 | Where do hero, editorial and announcement copy live (the template asks which system owns it)? | Typed module `storefront/content/home.ts` plus the message catalogues; replaceable by a CMS later | no | Open | |
| Q-O-2 | Category tiles at 1080 px: the token spec sends grids to 3 columns, which leaves a 3 + 1 layout for four tiles | Two columns at 1080 px and below | no | Open | |
| Q-O-3 | Are the capsule-recycling and sourcing claims true? Should the editorial strip be about recycling (pods) or sourcing (coffee)? | Placeholder recycling text, marked draft in the content file | release | Open | |
| Q-O-4 | Where does "Shop the edit" lead? | The listing filtered to bestsellers | no | Open | |
| Q-O-5 | The hero image is hidden under 900 px but a `priority` image still downloads | Accept one download; Q checks the performance budget | no | Open | |
| Q-O-6 | Statically cache the home page (ISR) with per-person parts as client islands? | No: dynamic render; shared cache only for the category tree and channel list | no | Open | |
| Q-O-7 | Show a saving percent on the subscribe strip? | No number (varies by product, avoids a dependency on N) | no | Open | |
| Q-O-8 | Bestsellers: only products badged `bestseller`, or fill to four by rating? | Badge only, no fill | no | Open | |
| Q-O-9 | "Buy again" or recently viewed strip for signed-in shoppers (the B2B template has "recently ordered")? | Not built; parked in `IDEAS.md` | no | Open | |
| Q-O-10 | Label of the pods tile: the spec says "Nespresso pods" but D-005 forbids the brand as a product name | Use the platform category name; recommend "Compatible pods" with the line "Nespresso-compatible" | no | Open | |
| Q-O-11 | Which product is the hero's featured product? | First seeded Original pod that has a price in both markets (US USD, Canada CAD) | no | Open | |
| Q-O-12 | Is the "returns" figure in the promise row the same in all markets? | Same source as the promise bar (F configuration) | no | Open | |
| Q-O-13 | Resolves Q-F-15 and Q-G-15: which market wins when the URL and the session disagree? | The URL locale. The proxy rewrites the session market (country, currency, locale) and the market cookie to the URL locale on every page request, drops the cart and collection store (as `changeMarket`), keeps customer fields; never creates a session. Shipped in FIX-2 (`lib/session-reconcile.ts`, `proxy.ts`) | no | Open | |
| Q-P-1 | Where does page content live (the templates say CMS, edits published without a deployment)? | Repository content modules behind one seam (`lib/content`); a correction needs a deploy. The About scenario "without a storefront deployment" is recorded as partial | no | Open | |
| Q-P-2 | Routes and slugs of the content pages | `/about`, `/contact`, `/faq`, `/policies/{shipping-returns,terms,privacy,accessibility}`, `/journal`, `/journal/{slug}` | no | Open | |
| Q-P-3 | Where do contact enquiries go and who answers them? | A webhook receiver chosen by the owner (OA-P1); until then the form reports "not sent" honestly (503) | live contact only | Open | |
| Q-P-4 | Rate limiting is per server instance on serverless hosting | J's shared in-memory limiter now (5 per 10 minutes per client); shared store or host WAF decided in Q's security review | no | Open | |
| Q-P-5 | Does a signed-in shopper's enquiry carry the customer id? | No; only a prefilled name and email the shopper can edit | no | Open | |
| Q-P-6 | Cookie or consent banner, and a chat widget? | Neither (no third-party scripts, no analytics); SO-P4 asks the owner and legal | release | Open | |
| Q-P-7 | Who owns FAQ "unhelpful" votes? | The server log is the collector until the owner names a receiver and an owner of record | no | Open | |
| Q-P-8 | Which statements on About are legally controlled (certifications, sourcing, recycling)? | None claimed; the owner adds claims with sign-off | release | Open | |
| Q-P-9 | Removed (D-030): no German seller, so no imprint page | None | no | Answered | |
| Q-P-10 | Do policies differ by market, or only by language? | By language only (en-US and en-CA share the English text) | release | Open | |
| Q-P-11 | Re-consent for subscribers after a material change of terms? | Not built, out of scope | no | Open | |
| Q-P-12 | A retired product linked from an old bookmark or page: hard 404 or soft redirect to its category? | Hard 404 page with search and category links | no | Open | |
| Q-P-13 | Name of the blog section | "Journal" at `/journal` | no | Open | |
| Q-P-14 | Where are superseded policy versions kept so the text in force on an order date can be produced? | Git history; no public archive page | no | Open | |
| Q-P-15 | The footer newsletter (design-storefront-shell) needs a receiver and a route that is not in the route table | F made it a validated no-op (Q-F-07); not built in P | no | Open | |
| Q-P-16 | The contact and feedback codes of the spec (`invalid_request`, `contact_unavailable`, `unsupported_media_type`) are not in D's closed `ErrorCode` union | Kept the body shape `{ error: { code, message } }` and used the spec codes in P's own responses; no change to `lib/errors.ts`. FAQ feedback uses D's `bad_request` and `upstream_unavailable` | no | Open | |
| Q-P-17 | Search route for the 404 page form | `GET /{locale}/search?q=` (G's route); the link goes to a 404 until G merges | no | Open | |
| Q-P-18 | Rate limiter: J's `lib/rate-limit.ts` did not exist when P was built | P ships `lib/contact/rate-limit.ts` with the same call shape; merge into J's when both are on develop | no | Open | |
| Q-P-19 | Next 16.3+ passes `retry` (refetch) to error boundaries besides `reset` | Error pages call `retry` when present, else `reset` | no | Open | |
| Q-P-20 | Content routes cannot be static: the locale layout reads the session for the shell | Left dynamic; content is still plain server content. Revisit if F makes the shell cacheable | no | Open | |
| Q-P-21 | Token figures carry their unit (`30 minutes`, `30 days`) so the neutral fallback phrase reads right | Tokens `{{collectMinutes}}` and `{{returnDays}}` include the unit | no | Open | |
| Q-Q-1 | Is a clean-clone `npm ci` run required on the release commit, besides the working-tree run? | Yes, once, before the deploy | no | Open | |
| Q-Q-2 | Accessibility target | WCAG 2.2 AA (the token spec says AA) | no | Open | |
| Q-Q-3 | Token value changes for contrast (`--ink-3`, `--teal-text`, `--danger-text`) | Already decided by workstream E (Q-E-1, M-E-02); Q only verifies that the pages use them | no | Open | |
| Q-Q-4 | Stepper targets are 38 px in the token spec (below the 44 px touch guideline, above the WCAG 2.2 minimum of 24 px) | Keep 38 px, record it, enlarge on touch viewports only if cheap | no | Open | |
| Q-Q-5 | Add `scroll-padding-top` so the sticky header never hides a focused element (F already adds the skip link; neither is in the shell spec) | Yes, small fix in Q-08 | no | Open | |
| Q-Q-6 | Use the `__Host-` cookie prefix for the session cookie? | No (needs Secure also in development); add `Secure` in production only | no | Open | |
| Q-Q-7 | In-memory rate limits are per instance on serverless hosting | Ship the in-memory limiter, recommend host WAF or rate-limit rules in the deploy notes | no | Open | |
| Q-Q-8 | The six demo customers share one known password: keep them on a public deployment? | Keep for a demo site, documented in the README; SO-Q2 decides | deploy | Open | |
| Q-Q-9 | Performance budgets | LCP 2.5 s mobile and 1.8 s desktop, CLS 0.1, INP or TBT 200 ms, First Load JS 200 kB (250 kB checkout and account), hero image 150 kB | no | Open | |
| Q-Q-10 | Sitemap entries for products and categories before launch? | Content pages only (P); products parked in `IDEAS.md` | no | Open | |
| Q-Q-11 | CSP enforce or report-only for the first deploy? | Enforce; report-only only if the hosted Checkout needs origins that cannot be listed | no | Open | |
| Q-Q-12 | May Q fix defects itself? | Yes if under half a day and one area, with a failing test first and a `fixes.md` entry; otherwise back to the owning workstream via the lead | no | Open | |
| Q-Q-13 | Real-card test through the hosted Checkout before launch? | No, test mode only; owner decides separately | deploy | Open | |
| Q-Q-14 | Post-deploy smoke on a preview URL first or on production? | Preview first, then production | deploy | Open | |
| Q-S-1 | Tax rates: US food 0%, standard 8% (NY 8.875%); Canada food 0% (zero-rated), standard 5% GST. Answered by the owner (D-036); HST/PST are not modelled. | `mcf-tax-food` US 0%, CA 0%; `mcf-tax-standard` US 8% country fallback plus NY 8.875%, CA 5% GST. Only NY has a state rate; every other US state falls back to 8%. | No (a rate change is one seed edit and a re-run: `planTaxUpdate` replaces changed rates) | Open | |
| Q-S-2 | Embedded `recurrencePrices`: the SDK 8 typing of `PriceDraft` has no `recurrencePolicy`, the documentation (commerce-patterns skill, `addPrice` with `recurrencePolicy`) says an embedded price accepts it. Does the live API accept it in a product draft and in `setPrices`? | The seed sends recurrence prices as `prices[]` entries with `recurrencePolicy: { typeId: 'recurrence-policy', key }` (typed loosely), in `setPrices` of the `prices` step. The read-side planner and `verify` accept the entries both in `prices` and in `recurrencePrices`. | Yes for the first live `prices` step (cannot be proven offline). If rejected: switch to `addPrice` per recurrence price in `src/sync.ts` and `src/data/prices.ts` | Open | |
| Q-S-3 | Product attributes use the constraints `SameForAll` (product level) and `CombinationUnique` (variant selectors). Both are irreversible after the first product exists. OK? | Product-level attributes are `SameForAll` and set on every variant; `capsulesPerPack`, coffee `sizeGrams` + `grind`, machine and accessory `colour` + `bundle` are `CombinationUnique`. | Only before the first live seed (a later change needs a new product type) | Open | |
| Q-S-4 | The spec wants 3 to 12 reviews per top product written by the demo customers, but there are six customers and one review per customer and product. | Reviews 1 to 4 of a product come from the demo customers (each at most once), reviews 5 to 12 have no `customer` and a synthetic `authorName` (for example "Sam T."). `uniquenessValue` is the review key. | No | Open | |
| Q-S-5 | SEED-PLAN lists the machine `system` values original, vertuo, bean-to-cup, espresso, filter; the grinder (category `mcf-cat-machines-grinders`) needs a value. | Added `grinder` to the `system` enum of `mcf-machine` (add-only). | No | Open | |
| Q-S-6 | `FREESHIP`: "free standard shipping". Can a cart predicate restrict a shipping cart discount to the standard method? | Target `shipping`, value 100% relative, `cartPredicate` `true` (applies to whichever method the cart has). Restricting to `mcf-ship-standard` needs a verified predicate on the chosen shipping method. | No | Open | |
| Q-S-7 | `COFFEE15` "15 off over 60": thresholds per market. | Absolute 15 in each currency (USD, CAD); minimum 60 USD and 80 CAD in the `cartPredicate` (two `or` clauses). | No | Open | |
| Q-S-8 | Seasonal sale on selected machines: which machines and how much? | Automatic product discount `mcf-discount-seasonal-machines`, 15% on Pod One, Lever Espresso 15 and Drip Filter 10, predicate `sku in (...)`. The SEED-PLAN asks for "a few variants with a product discount price"; this is done by the discount (the price draft's `discounted` field is for external discounts only). | No | Open | |
| Q-S-9 | Order of the `prices` step: products are created without prices and `prices` sets them per product (so `--only products,prices` is meaningful), costing 41 extra updates. Acceptable, or create products with prices in one request? | Two steps as specified in the step list. | No | Open | |
| Q-S-10 | The `seed:cleanup` manifest also lists inventory entries (not in the SEED-PLAN list), because inventory entries of a sample channel block the channel delete. Standalone prices, stores, product selections, orders and carts are not listed. | Inventory is inventoried and deleted before products; sample orders and carts stay (D-019). | No | Open | |
| Q-S-11 | Review keys follow the contract literally: `mcf-review-<sku>-<n>` with the master SKU, so keys read `mcf-review-mcf-pod-ember-10-1`. | Kept literal. | No | Open | |
| Q-S-12 | The images script needs the real endpoint shape: `download_link` has no query in the sample, `large` has one. Stock photos are matched to products by the words in `description` (capsule, machine, cup, else coffee); with few photos the same photo is reused. | Round-robin by tag, fall back to all photos. | Blocks real images only (OA-03) | Open | |
<!-- END WORKSTREAM-QUESTIONS -->
