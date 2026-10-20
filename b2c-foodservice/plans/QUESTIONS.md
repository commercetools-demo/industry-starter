<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions for the owner

Nothing here blocks work: each row has the **default being built**. Answer by editing the `Answer` column (or tell the lead); the team then changes the default if needed. Juniors add rows (`Q-<letter>-<n>`); the lead consolidates the per-workstream drafts from `plans/notes/questions-*.md` below the table of project-level questions.

## Project-level questions (lead)

| ID | Question | Default being built | Blocks | Status | Answer |
| --- | --- | --- | --- | --- | --- |
| Q-001 | Which commercetools project (key and region) is Malva Coffee? | Project key and region come from `.env.local`; nothing hard-coded | Live runs of A, B, C, D | Open | |
| Q-002 | Should the site send email (order confirmation, password reset, email verification, subscription reminders)? Which provider? | **No email infrastructure.** Demo customers are seeded verified; reset and verification are specified behind a mail adapter that logs in dev. No email is promised in the UI copy | J, K, N | Open | |
| Q-003 | Mixed bags: one order with collect and ship lines (multiple shipping), or one order per fulfilment group? | One order using multiple shipping if the hosted Checkout supports it (spike K-01); otherwise one order per group paid in sequence | K | Open | |
| Q-004 | Timed delivery slots (as in grocery) or standard carrier delivery only? | **Standard carrier only**, no slots (`delivery-slot-booking` not applicable) | K | Open | |
| Q-005 | Loyalty points programme? | **No loyalty**; the points text of the prototype is removed | L | Open | |
| Q-006 | Which products are subscribable and which intervals? | All pods and coffees; intervals 2 weeks, 1, 2 and 3 months; 10% saving | N, C | Open | |
| Q-007 | Which stores, and collection readiness time per store? | Six invented stores (2 per market) per `SEED-PLAN.md`, 30 minutes ready time, read from channel data | C, F | Open | |
| Q-008 | Free-shipping thresholds and delivery prices per market? | US 75 USD, DE 60 EUR, GB 50 GBP; standard 6.95 / 4.90 / 3.95; express 14.95 / 12.90 / 9.95 | C, I | Open | |
| Q-009 | Returns window and policy? | 30 days for unopened items; shown in the promise bar and PDP; the prototype's 90 days is dropped | H, P | Open | |
| Q-010 | Tax rates (food, standard) per market? | US 0% food, 8% standard (NY 8.875%); DE 7% / 19%; GB 0% / 20%. The owner or an accountant confirms before real use | B, K | Open | |
| Q-011 | Review moderation: publish immediately or approve first? | **Approve first** (`mcf-review-pending` until approved in the Merchant Center); seeded reviews are approved | M | Open | |
| Q-012 | Blog and resources content? | Out of the first release; `blog-resources` planned in P as a thin article route fed by static markdown if time allows | P | Open | |
| Q-013 | German copy: who translates? | The team writes German catalogue and product text; a native speaker reviews (SO-03) | E, C | Open | |
| Q-014 | Saved payment methods in the account? | **Not built**; the hosted Checkout and the payment provider own card data. The tab is hidden until a provider supports it | L | Open | |
| Q-015 | Hosting target: Vercel or Netlify? | Vercel via `/commercetools:nextjs-deploy-vercel`; decided before Q | Q | Open | |
| Q-016 | Payment provider for the hosted Checkout? | Stripe test mode through the commercetools Stripe connector | K | Open | |
| Q-017 | Guest checkout allowed? | Yes (the design has it) | K | Open | |
| Q-018 | Cookie consent and analytics? DE and UK law requires consent for non-essential cookies | Essential cookies only (session, locale, store); no analytics; a consent banner is added when analytics are chosen | Q, P | Open | |
| Q-019 | Legal pages: Impressum (Germany), privacy, terms, cookie policy; who supplies the text? | Placeholder pages marked "draft" with effective date; SO-01 | P | Open | |
| Q-020 | Product names, descriptions, origins and prices in the seed: invented or supplied? | Invented but realistic (never real third-party brand names); replaceable by editing `seed/src/data` | C | Open | |
| Q-021 | Are "Gifts" a top-level category? | Yes (design nav has Gifts) with gift sets | C, F | Open | |
| Q-022 | Wordmark, logo, favicon and photography rights | Text wordmark in Archivo as the prototype; photography from the image endpoint (OA-03) | E, C | Open | |
| Q-023 | Search behaviour: typo tolerance, synonyms (espresso/ristretto), suggestions? | Product Search default relevance; no synonyms; suggestions after the browse works | G | Open | |
| Q-024 | Product Search cannot sort or filter on `reviewRatingStatistics`? | G verifies; fallback is an indexed `ratingAverage` attribute maintained by the seed and a review hook | G, M | Open | |

## Workstream questions

Generated from `plans/notes/questions-*.md` by `node plans/consolidate-notes.mjs` (re-run after editing a note; edit the **notes**, not this block). The `Answer` column is filled in the notes file by the lead when the owner answers.

<!-- BEGIN WORKSTREAM-QUESTIONS -->
| ID | Question | Default being built | Blocks | Status | Answer |
| --- | --- | --- | --- | --- | --- |
| Q-J-01 | Is SSO or federated sign-in required? | No. No SSO control or route is built. | No | Open | |
| Q-J-02 | Are customers global or store-scoped? | Global customers, global `/login`, no `in-store` calls. | No | Open | |
| Q-J-03 | Which email provider (if any) sends verification and reset mails, and who owns the templates? | `MailAdapter` port: `outbox` in dev (in memory, read at `/api/dev/outbox`, never logged), `disabled` in production. No provider code. | No | Open | |
| Q-J-04 | What may an unverified customer do? | Everything, with a banner. Verification only affects password recovery. | No | Open | |
| Q-J-05 | Does registration reveal that an email already exists? | No. Generic refusal text pointing to sign-in and reset. | No | Open | |
| Q-J-06 | Must a password reset end sessions in other browsers? | Not possible with a cookie that holds no commercetools token; only the resetting browser is signed out. Option: "sessions valid from" Custom Object (scope `manage_key_value_documents`). | No | Open | |
| Q-J-07 | Reset spec (no disclosure) conflicts with identity spec (state what is required for an unverified account). Which wins? | Both: generic on-screen answer; the emailed message tells an unverified owner to verify first. | No | Open | |
| Q-J-08 | Where are the terms and privacy pages linked from the register form? | `/${locale}/terms` and `/${locale}/privacy`; P may rename. | No | Open | |
| Q-J-09 | Token validity for reset and verification? | 60 minutes both; `invalidateOlderTokens` true for reset. | No | Open | |
| Q-J-10 | Password policy? | 10 to 128 characters, one letter, one digit, not the email. | No | Open | |
| Q-J-11 | Cart merge mode when the customer already has an active cart? | `MergeWithExistingCustomerCart`. | No | Open | |
| Q-J-12 | Rate limiting on more than one server instance? | In-memory per instance now; shared store when hosting needs it (OA-05). | No | Open | |
| Q-J-13 | D's error envelope is closed (fixed `ErrorCode`, body exactly code and message). Field-level and domain codes need extra properties. May the envelope carry extras? | Yes: `domainError(code, status, extra)` in `lib/api-domain.ts` keeps `{ error: { code, message, ...extra } }`, never commercetools text. | No | Open | |
| Q-K-01 | Payment-only hosted Checkout cannot take the design's own "Place order" button; the widget has its own pay button. Accept? | Yes: widget button labelled "Place order" via Checkout text customisation (OA-K-d), inside the Payment card; Back stays ours. | No | Open | |
| Q-K-02 | Mixed bags: which strategy after the K-01 spike? Should G/I create every cart as `shippingMode: Multiple` (the mode is immutable after creation)? | Strategy from the K-01 decision rule. G's `CART_SHIPPING_MODE` stays `'Single'`; K clones into a `Multiple` cart at checkout when there are two groups (a `Multiple` cart shows no tax estimate on the cart page until every quantity is allocated). | K-03 to K-07 detail | Open | |
| Q-K-02b | If only tax fails under Multiple, fix data or fall back? | Fix data in the seed and keep Multiple. | No | Open | |
| Q-K-02c | Under the `order-per-group` fallback, on which order do discount codes apply? | First order only. | No | Open | |
| Q-K-03 | Can the hosted pay button be hidden, triggered or labelled from our page? | Not assumed; spike probe S12. | No | Open | |
| Q-K-04 | Order number format? | `MC-` plus 10 base32 characters derived from the cart id (deterministic, so retries cannot create a second order). | No | Open | |
| Q-K-05 | If the order exists but the `transitionState` to `mcf-order-ordered` fails? | Log, show the order without tracker, retry on the next read. | No | Open | |
| Q-K-06 | May the shipping country differ from the market? | No: shipping country is the session country. | No | Open | |
| Q-K-07 | Billing address for collect-only orders? | Contact name and email with the store's country; the widget collects any extra fields the PSP needs. | No | Open | |
| Q-K-08 | Should "Check out as guest" detach the order from the signed-in customer? | No: fields clear only (spec); the order stays on the account. | No | Open | |
| Q-K-09 | Save a new checkout address to the account? | Checkbox, off by default, members only. | No | Open | |
| Q-K-10 | How does a guest's email reach the register page after an order? | HTTP-only cookie `mcf_guest_email`, 1 hour, deleted on read; never a URL. | No | Open | |
| Q-K-11 | Where do delivery-day texts ("2-4 business days") come from? | `ShippingMethod.localizedDescription` per locale; request to workstream B to write them in the seed; no text when absent. | No | Open | |
| Q-K-12 | Tracker mapping for `ordered`, and ship-only orders? | `ordered` = Ordered active (spec, not the prototype); ship-only orders show no tracker, only the delivery card. | No | Open | |
| Q-K-13 | Notification promises (emailed receipt, SMS when ready)? | Not shown while no mail adapter is enabled; never for SMS; copy says to check the page or account. | No | Open | |
| Q-K-14 | Who may open a guest order's confirmation? | Anyone holding the order id; phone and billing hidden. Member orders need the owning session. | No | Open | |
| Q-K-15 | Behaviour if `complete` is called twice? | `finalizeOrder` is idempotent by order number. | No | Open | |
| Q-L-01 | Which saved payment methods does the hosted Checkout and the chosen connector actually store, and which fields identify them? | Show what the connector writes (label, default flag); no add form; the rest is "not applicable" with an explanation (D-016). Finding from L-10. | No | Open | |
| Q-L-02 | Deleting the default address: promote the next (design-account-area) or leave none (address-book template)? | Promote; one constant `DEFAULT_ADDRESS_AFTER_DELETE` switches it, both tested. | No | Open | |
| Q-L-03 | Where is the address nickname (Home, Work) stored? | `additionalAddressInfo` of the address. | No | Open | |
| Q-L-04 | Can customers change their email? | No; shown read-only with "contact us" (the verification-on-change flow is undecided). | No | Open | |
| Q-L-05 | Is there an address validation service? | No; format checks only; the `AddressVerifier` adapter and dialog exist and are tested with a fake. | No | Open | |
| Q-L-06 | Loyalty points and member perks? | Not offered; text and tile omitted (`design.md` Q7). | No | Open | |
| Q-L-07 | SMS alerts toggle? | Hidden; no SMS provider. | No | Open | |
| Q-L-08 | Returns window and eligible items? | 30 days from the order's last modification, all lines eligible (`RETURN_WINDOW_DAYS`); `SO-L-b` decides. Note DE consumers normally have 14 days minimum by law. | No | Open | |
| Q-L-09 | Buy again: new cart (order-history template) or add to the current bag (design)? | Add to the current bag (design); unavailable lines listed. | No | Open | |
| Q-L-10 | Account deletion: erase personal data of orders too? | No: `dataErasure: false`; order records retained and the modal says so. | No | Open | |
| Q-L-11 | Is the collection store saved per customer or per browser? | Per browser session cookie (30 days). A per-customer default would need a custom field. | No | Open | |
| Q-L-12 | Where do notification preferences live? | Customer custom type `mcf-customer-prefs` created by the seed in L-12. Nothing is sent yet (no email infrastructure). | No | Open | |
| Q-L-13 | Who owns the heart and saved-list server API: G and H built the heart on `sessionStorage`. | L implements `/api/shopping-lists` and swaps `useSavedItems` (as G's plan states). | No | Open | |
| Q-L-14 | Payment method "Remove": delete or deactivate? | Deactivate (`Inactive`), keeps history; the PSP token is not revoked. | No | Open | |
| Q-L-15 | Order-completed time for the returns window? | `order.lastModifiedAt` (approximation); a real delivered date needs the store tooling. | No | Open | |
| Q-M-01 | Do new customer reviews need approval before they count? | Yes: `REVIEW_MODERATION: 'on'`, state `mcf-review-pending`, approved in the Merchant Center. One constant switches it off. | No | Open | |
| Q-M-02 | The storefront API client needs `manage_products` to write reviews (no narrower scope exists). Accept, or provide a second restricted client? | Add the scope to the storefront client (`OA-M-a`); ownership is checked in code. | Blocks live write tests only | Open | |
| Q-M-03 | Is the text required, or is a rating alone a valid review? | Rating required; title and text optional. | No | Open | |
| Q-M-04 | Can a customer who never bought the product review it? | Yes; a "Verified purchase" badge is set only when the customer has an order with the product (checked at write time). | No | Open | |
| Q-M-05 | Show reviews of every language in every locale? | Yes, as written, no filter, no translation. | No | Open | |
| Q-M-06 | Edit of an approved review: return to pending or keep published? | Return to pending when moderation is on (spec). | No | Open | |
| Q-M-07 | Delete by the author: allowed for approved reviews too? | Yes (spec lists delete). | No | Open | |
| Q-M-08 | Rate limits? | 5 creates per hour, 30 edits or deletes per hour, per customer; in memory per instance (J's limiter, Q-J-12). | No | Open | |
| Q-M-09 | How is the one-review-per-product rule enforced? | `uniquenessValue` of customer id and product id, plus a pre-check; M-03 confirms the field. | No | Open | |
| Q-M-10 | Seeded reviews have no verified purchase (no orders in the seed). Add a custom field value to some seed reviews? | No; seed plan Q-C-04 stays. | No | Open | |
| Q-M-11 | If Product Search cannot filter or sort on rating statistics, who refreshes the indexed rating attribute after moderation in the Merchant Center? | G's fallback attribute is refreshed by `seed:ratings` (M-09) run by the team or owner; a subscription-driven refresh is not built. | No | Open | |
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
| Q-N-14 | Subscription reminder e-mails (toggle in the account Settings, L): in scope? | No; toggle is saved, nothing is sent | no | Open | |
| Q-N-15 | German form of address (du or Sie) | Follow E and F (draft uses du) | no | Open | |
| Q-N-16 | Seed a demo subscription per demo customer and a daily test policy `mcf-test-daily` (seed request SR-N1, workstream C)? | Not yet; verify through the checkout journey | no | Open | |
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
| Q-O-11 | Which product is the hero's featured product? | First seeded Original pod that has a price in all three markets | no | Open | |
| Q-O-12 | Is the "returns" figure in the promise row the same in all markets? | Same source as the promise bar (F configuration) | no | Open | |
| Q-P-1 | Where does page content live (the templates say CMS, edits published without a deployment)? | Repository content modules behind one seam (`lib/content`); a correction needs a deploy. The About scenario "without a storefront deployment" is recorded as partial | no | Open | |
| Q-P-2 | Routes and slugs of the content pages | `/about`, `/contact`, `/faq`, `/policies/{shipping-returns,terms,privacy,accessibility,imprint}`, `/journal`, `/journal/{slug}` | no | Open | |
| Q-P-3 | Where do contact enquiries go and who answers them? | A webhook receiver chosen by the owner (OA-P1); until then the form reports "not sent" honestly (503) | live contact only | Open | |
| Q-P-4 | Rate limiting is per server instance on serverless hosting | J's shared in-memory limiter now (5 per 10 minutes per client); shared store or host WAF decided in Q's security review | no | Open | |
| Q-P-5 | Does a signed-in shopper's enquiry carry the customer id? | No; only a prefilled name and email the shopper can edit | no | Open | |
| Q-P-6 | Cookie or consent banner, and a chat widget? | Neither (no third-party scripts, no analytics); SO-P4 asks the owner and legal | release | Open | |
| Q-P-7 | Who owns FAQ "unhelpful" votes? | The server log is the collector until the owner names a receiver and an owner of record | no | Open | |
| Q-P-8 | Which statements on About are legally controlled (certifications, sourcing, recycling)? | None claimed; the owner adds claims with sign-off | release | Open | |
| Q-P-9 | Is an imprint required (German seller) and which entity data goes in it? | Page exists with placeholders; owner and legal confirm | release | Open | |
| Q-P-10 | Do policies differ by market, or only by language? | By language only (US and GB share the English text) | release | Open | |
| Q-P-11 | Re-consent for subscribers after a material change of terms? | Not built, out of scope | no | Open | |
| Q-P-12 | A retired product linked from an old email: hard 404 or soft redirect to its category? | Hard 404 page with search and category links | no | Open | |
| Q-P-13 | Name of the blog section | "Journal" at `/journal` | no | Open | |
| Q-P-14 | Where are superseded policy versions kept so the text in force on an order date can be produced? | Git history; no public archive page | no | Open | |
| Q-P-15 | The footer newsletter (design-storefront-shell) needs a receiver and a route that is not in the route table | F made it a validated no-op (Q-F-07); not built in P | no | Open | |
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
| Q-S-1 | Tax rates: is US food 0% and GB food (zero-rated) 0% right, and DE reduced 7%? (SEED-PLAN marks US and GB food 0% as default; related to Q-B-03.) | `mcf-tax-food` US 0%, DE 7%, GB 0%; `mcf-tax-standard` US 8% country fallback plus NY 8.875%, DE 19%, GB 20%. Only NY has a state rate; every other US state falls back to 8%. | No (a rate change is one seed edit and a re-run: `planTaxUpdate` replaces changed rates) | Open | |
| Q-S-2 | Embedded `recurrencePrices`: the SDK 8 typing of `PriceDraft` has no `recurrencePolicy`, the documentation (commerce-patterns skill, `addPrice` with `recurrencePolicy`) says an embedded price accepts it. Does the live API accept it in a product draft and in `setPrices`? | The seed sends recurrence prices as `prices[]` entries with `recurrencePolicy: { typeId: 'recurrence-policy', key }` (typed loosely), in `setPrices` of the `prices` step. The read-side planner and `verify` accept the entries both in `prices` and in `recurrencePrices`. | Yes for the first live `prices` step (cannot be proven offline). If rejected: switch to `addPrice` per recurrence price in `src/sync.ts` and `src/data/prices.ts` | Open | |
| Q-S-3 | Product attributes use the constraints `SameForAll` (product level) and `CombinationUnique` (variant selectors). Both are irreversible after the first product exists. OK? | Product-level attributes are `SameForAll` and set on every variant; `capsulesPerPack`, coffee `sizeGrams` + `grind`, machine and accessory `colour` + `bundle` are `CombinationUnique`. | Only before the first live seed (a later change needs a new product type) | Open | |
| Q-S-4 | The spec wants 3 to 12 reviews per top product written by the demo customers, but there are six customers and one review per customer and product. | Reviews 1 to 6 of a product come from the six customers (each at most once), reviews 7 to 12 have no `customer` and a synthetic `authorName` (for example "Sam T."). `uniquenessValue` is the review key. | No | Open | |
| Q-S-5 | SEED-PLAN lists the machine `system` values original, vertuo, bean-to-cup, espresso, filter; the grinder (category `mcf-cat-machines-grinders`) needs a value. | Added `grinder` to the `system` enum of `mcf-machine` (add-only). | No | Open | |
| Q-S-6 | `FREESHIP`: "free standard shipping". Can a cart predicate restrict a shipping cart discount to the standard method? | Target `shipping`, value 100% relative, `cartPredicate` `true` (applies to whichever method the cart has). Restricting to `mcf-ship-standard` needs a verified predicate on the chosen shipping method. | No | Open | |
| Q-S-7 | `COFFEE15` "15 off over 60": thresholds per market. | Absolute 15 in each currency (USD, EUR, GBP); minimum 60 USD, 55 EUR, 50 GBP in the `cartPredicate` (three `or` clauses). | No | Open | |
| Q-S-8 | Seasonal sale on selected machines: which machines and how much? | Automatic product discount `mcf-discount-seasonal-machines`, 15% on Pod One, Lever Espresso 15 and Drip Filter 10, predicate `sku in (...)`. The SEED-PLAN asks for "a few variants with a product discount price"; this is done by the discount (the price draft's `discounted` field is for external discounts only). | No | Open | |
| Q-S-9 | Order of the `prices` step: products are created without prices and `prices` sets them per product (so `--only products,prices` is meaningful), costing 41 extra updates. Acceptable, or create products with prices in one request? | Two steps as specified in the step list. | No | Open | |
| Q-S-10 | The `seed:cleanup` manifest also lists inventory entries (not in the SEED-PLAN list), because inventory entries of a sample channel block the channel delete. Standalone prices, stores, product selections, orders and carts are not listed. | Inventory is inventoried and deleted before products; sample orders and carts stay (D-019). | No | Open | |
| Q-S-11 | Review keys follow the contract literally: `mcf-review-<sku>-<n>` with the master SKU, so keys read `mcf-review-mcf-pod-ember-10-1`. | Kept literal. | No | Open | |
| Q-S-12 | The images script needs the real endpoint shape: `download_link` has no query in the sample, `large` has one. Stock photos are matched to products by the words in `description` (capsule, machine, cup, else coffee); with few photos the same photo is reused. | Round-robin by tag, fall back to all photos. | Blocks real images only (OA-03) | Open | |
<!-- END WORKSTREAM-QUESTIONS -->
