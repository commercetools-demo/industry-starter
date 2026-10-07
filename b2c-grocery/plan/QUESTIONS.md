# Questions to the owner

Juniors: add a question when you must stop and ask (see JUNIOR-GUIDE §7). Format:

## Q-001 (workstream X, task X-03)
**Question:** ...
**Blocking:** yes/no
**Answer (owner):**

## Q-H-1 (workstream H, task H-08/H-10)
**Question:** The announcement bar text (`common.announcement`) is "Fresh groceries from growers we trust, delivered to your door." because the delivery threshold must not be hard-coded (D-021, D-049). Do you want different copy, or should the bar be hidden until a real message exists? Also: the header's bag and account controls are plain placeholder links until J/O fill the slots.
## Q-G-001 (workstream G, task G-08)
**Question:** G-08 says to change `app/[locale]/layout.tsx` to pass `getValidMarkets()` to `LocaleSwitcher`, but `LocaleSwitcher`, the header and footer are created in H-09/H-10 (after G; H's own text says "G-08 switches the layout to `getValidMarkets()`"). Done in G: `lib/ct/locale-validation.ts` (`getValidCountryConfig`, `getValidMarkets`, TTL 300) and `POST /api/locale` rejects markets not valid for the project (400, tested). Proposed: H composes the layout with `markets = await getValidMarkets()` and adds the test "a market missing from the project is not offered" (Header/LocaleSwitcher level). I edited neither H's file nor the layout.
**Blocking:** no
**Answer (owner):**

## Q-J-1 (workstream J, task J-04)
**Question:** `defaultSubstitutionPreference(product)` takes only the product but the rule needs category keys, and `Product` only has `categoryIds`. Implemented as `defaultSubstitutionPreference(product, categoryKeys = [])` plus `categoryKeysOf(product, tree)` (resolved from the cached category tree in the add route). Chilled storage always wins. OK?
**Blocking:** no
**Answer (owner):**

## Q-J-2 (workstream J, task J-05)
**Question:** The add route returns 404 `UNKNOWN_SKU` for a SKU that is not in the catalog (the plan did not say). Also quantity must be an integer >= 1 for PATCH too (removing is DELETE). OK?
**Blocking:** no
**Answer (owner):**

## Q-ORCH-1 (found by orchestrator while testing J)
**Question:** The cart/currency comes from the *session* market, the page language from the *URL* locale. A visitor whose session says `de-DE`/EUR who opens `/en-US` directly sees English text but an EUR cart (and the catalog price currency follows the session too). Should the proxy/layout sync the session market to the URL locale on every request (recommended: yes, same rule as the locale switch: currency change drops the cart), or keep the explicit switch only?
**Blocking:** no (default for now: explicit switch only; see IDEAS)
## Q-K-1 (workstream K, task K-05)
**Question:** The market (currency/country) comes from the session or the `your-shop-country-locale` cookie, but the proxy does not set it when someone opens `/de-DE/...` directly, so the cart layout (J) and `getMarket()` would give USD under a German URL. K avoids it by deriving currency/country from the URL locale (`COUNTRY_CONFIG[locale]`). Should `proxy.ts`/`getMarket()` do this for everyone (L, M, P, cart), or is the locale switcher the only intended way to change market?
## Q-O-1 (workstream O, tasks O-01..O-06)
**Question:** Live checks show commercetools answers HTTP 400 (not 401/409) for wrong credentials (`InvalidCredentials`) and duplicate email (`DuplicateField`), and 404 for unknown email on password token and for used/expired reset tokens (details in `PROJECT-FINDINGS.md` section 15). I map them to the plan responses (401 INVALID_CREDENTIALS, 409 ACCOUNT_EXISTS, 400 INVALID_TOKEN). Also: sign-in retries without the anonymous cart if the first attempt fails for a non-credential reason, so a stale cart cannot block login. OK?
**Blocking:** no
**Answer (owner):**

## Q-O-2 (workstream O, task O-09)
**Question:** `/en-US/account` and `/en-US/account/orders` do not exist until R, so after register, sign-in without `redirect` or password reset the shopper lands on a 404 page for now. Should the default landing be changed (for example to `/`) until R merges? I kept `/account` as specified.
**Blocking:** no
**Answer (owner):**

## Q-P-1 (workstream P, task P-04)
**Question:** P-04 asked for fullText on name plus a SKU OR clause. Live, fullText misses German compounds ("milch" vs "Vollmilch") and partial words, so I also OR a case-insensitive `wildcard *q*` on name (substring match, wildcards in user input escaped). Any query of 4+ letters/digits/hyphens also adds the exact-SKU clause (so "milk" does too, harmlessly). Trade-off: wildcard scans the name of every product (fine for a small catalog; revisit for very large ones). OK?
**Blocking:** no
**Answer (owner):**

## Q-L-1 (workstream L, task L-06)
**Question:** The plan says AddToBag calls `addItemWithToast` and shows an inline "Only N available" on `INSUFFICIENT_STOCK`, but J's `addItemWithToast` swallows the error (toast only, resolves `true/false`). I check stock on the client (stepper max = available quantity; units already in the bag count) and show the inline message from that check; a server-side 409 (race) still gets J's toast "Only N available right now." Should J's helper expose the available quantity so the PDP can show the inline message for the 409 too (see IDEAS)?
## Q-M-1 (workstream M, task M-05)
**Question:** The plan says the page uses `getMarket()` for the market. As in K and P I used the URL locale's market (`COUNTRY_CONFIG`) and fall back to `getMarket()` only for unknown locales, because `getMarket()` reads the session cookie and a fresh visit to `/de-DE` would show USD. Result: the homepage reads no session at all. OK?
## Q-Q-1 (workstream Q, task Q-04)
**Question:** A live check (`PROJECT-FINDINGS.md` section 16) shows commercetools rejects a shipping address whose country has no `standard` rate in the cart currency (USD cart, DE address: HTTP 400 `InvalidOperation`). `PUT /api/cart/address` therefore answers 422 `COUNTRY_MISMATCH` when the address country differs from the cart's market, and the country select in the cart only works for the active market's country (the other option shows "switch the region in the header"). Is that acceptable, or should choosing the other country switch the market (and drop the cart, like the header switch)?
**Blocking:** no
**Answer (owner):**

## Q-Q-2 (workstream Q, task Q-04)
**Question:** The plan says an undeliverable address answers 422 and also clears the slot. I save the undeliverable address on the cart anyway (so the cart is truthful and `canCheckout` blocks), release and clear the slot, set no shipping method, and answer 422 `UNDELIVERABLE` with `{ cart, slotCleared }`. OK?
**Blocking:** no
**Answer (owner):**

## Q-Q-3 (workstream Q, task Q-07/Q-08)
**Question:** The slot hold lives only in process memory but the slot fields live on the cart, so after a restart the cart still shows a slot whose capacity was never re-reserved (until the 15-minute `slotHoldExpires` passes). The UI treats a slot as chosen only while `slotHoldExpires` is in the future, and V must re-hold at session creation (D-042). OK to keep this behaviour for v1?
**Blocking:** no
**Answer (owner):**

## Q-N-1 (workstream N, task N-05)
**Question:** `FinalAmount` is built and tested but not wired anywhere because the order detail (R) does not exist yet. R should render `<FinalAmount provisional={order.total} final={order.finalTotal} />` and `<ProvisionalNotice />` (no `cart` prop) for orders with approximate lines, and the order mapper must read custom field `finalTotal` (type `order-final`) into a `Money`. Please confirm R owns this wiring and the mapper change.
**Blocking:** no
**Answer (owner):**

## Q-T-1 (workstream T, task T-02)
**Question:** `privateJson()` was planned in R-03 but R is not merged, so T created `site/lib/api/private-json.ts` with the planned signature. Merging R will give an add/add conflict on that file (and its test); both copies behave the same, keep either. Also, the plan's `addProduct(listId, version, productId)` could not skip duplicates without the line items, so it takes the loaded `ShoppingList` instead. OK?
## Q-R-1 (workstream R, task R-07)
**Question:** The plan says an order that is not the customer's shows a "not-found page", but the account pages are client-fetched, so the order page itself answers HTTP 200 and shows an inline "We could not find that order" state (the API answers 404). Is that enough, or should the page be a server component that checks ownership and calls `notFound()` (real 404 status, one more commercetools read per order view)?
**Blocking:** no
**Answer (owner):**

## Q-R-2 (workstream R, task R-08)
**Question:** `cart-delivery` (slot fields) and `order-final` (`finalTotal`) are both custom types for resource `order`, but an order can carry only ONE custom type. An order created from a cart keeps `cart-delivery`; `setCustomType` to `order-final` (what staff would do after weighing) replaces it and the slot fields disappear from the order (and `setCustomField finalTotal` on a `cart-delivery` order should fail: field not defined; not verified live). The order mapper reads `finalTotal` and the slot from whatever custom fields exist, so it works with either. Proposal: add a `finalTotal` (Money) field definition to `cart-delivery` through the seed script (`addFieldDefinition`) so one type carries both; V/Merchant Center staff then use `setCustomField`. Owner decision (touches project data, so not done by R).
**Blocking:** no
**Answer (owner):**

## Q-R-3 (workstream R, task R-08)
**Question:** The R developer could not read `site/.env.seed` (copying it into the worktree was refused), so `scripts/seed/create-qa-order.ts`, the extended `cleanup-qa.ts` and the order `Money` custom field shape were never run against the project. Please run `npx tsx scripts/seed/create-qa-order.ts --status packing` once from a checkout that has `.env.seed`, then `cleanup-qa.ts`, and record any error in `PROJECT-FINDINGS.md`.
**Blocking:** no
**Answer (owner):**

## Q-R-2 resolution (orchestrator, 2026-10-06)
Resolved by D-051: `finalTotal` added to the `cart-delivery` custom type (live project updated). `order-final` is now unused.

## Q-U-1 (workstream U, tasks U-01, U-03, U-08)
**Question:** The U developer had no live access, so the Order Edit calls (`orders().edits()` list/get/post/apply, custom fields on the edit, preview in a GET by id, `removeLineItem` + `addLineItem` staged actions) follow the OAS and docs only and `scripts/seed/create-qa-substitution.ts` was never run. Please run `npx tsx scripts/seed/create-qa-substitution.ts` once from a checkout that has `.env.seed`, then M-U-2 to M-U-5, and record differences in `PROJECT-FINDINGS.md` section 18. Also confirm for OA-07 that the API recipe (`plan/recipes/create-substitution-proposal.md`) is acceptable because Merchant Center has no screen for proposals with a custom type.
## Q-V-1 (workstream V, task V-04/V-07)
**Question:** The hand-off to our app after payment depends on the browser: the hosted checkout creates the order on commercetools' side, our page then calls `POST /api/checkout/complete` (sets `lastOrderId`, drops `cartId`, confirms the slot booking). If the shopper closes the tab between the payment and that call, the order exists but the booking is never confirmed (the hold expires after 15 minutes: SO-12 oversell risk) and a guest has no way back to the confirmation page; the stale `cartId` is harmless (the cart is no longer Active and is dropped on the next cart read). A server-side path (commercetools Subscription on `OrderCreated`, or a Connect job) would close it but is out of v1 (D-042). Do you accept this for v1?
**Blocking:** no
**Answer (owner):**

## Q-V-2 (workstream V, task V-05)
**Question:** The hosted checkout lists every applicable shipping method (D-049), so the old 500.00 / 750.00 methods are visible next to `standard`, and the shopper may pick one there even though the cart summary on our page shows the `standard` cost. Our summary is a snapshot taken when the page loads. Accepted for v1 (Z-05 checklist), or should the cart totals refresh on our side after the hosted step (not possible without a message from the SDK)?
**Blocking:** no
**Answer (owner):**

## Q-ORCH-2 (OA-05 incomplete: no payment integration)
**Question:** The Checkout application used by the storefront (`demo-commercetools-checkout-taxes`) is a sample PaymentOnly app for GB/US and the project has zero payment integrations, so a card payment cannot complete. Please create a Complete-checkout application for US and DE with an Adyen test integration (details in TODO-MANUAL-TESTING.md, OA-05) and give me its key. I will then run M-V-3..M-V-8 myself in the browser.
**Blocking:** yes for the payment part of v1 acceptance only
## Q-Y-1 (workstream Y, task Y-05)
**Question:** Y-05 (record the Netlify site URL in `site/README.md`) needs your report of a successful deploy and the public URL (OA-06 only says the site exists). Please run M-Y-1 to M-Y-5 and send the URL. Also, `/api/health` is gone now, so the PASS of M-E-1 cannot be repeated; it stays valid as history.
**Blocking:** no
**Answer (owner):**

## Q-ORCH-1 resolution (orchestrator, 2026-10-06)
Resolved by D-052 (MarketSync). Verified in the browser: an EUR cart on /de-DE, then opening /en-US/shop directly, ends with the en-US cookie, no cart and an empty bag.
## Q-W-1 (workstream W, task W-01)
**Question:** The spike (Gate 3) passed at API level (live: order from a cart with a `recurrenceInfo` line created one Recurring Order, see `PROJECT-FINDINGS.md` §19) but the developer did not run the hosted Checkout hand-off in a browser with Adyen. Please confirm it with M-W-3 (a subscribed line, pay, check Merchant Center, Orders, Recurring orders) and tell the orchestrator if no Recurring Order appears (then set the `FEATURE_SUBSCRIPTIONS` default to false).
**Blocking:** no
**Answer (owner):**

## Q-W-2 (workstream W, task W-05)
**Question:** A guest can choose a cadence and pay in the hosted checkout. The Recurring Order is then created without a customer (only `customerEmail`), so it can never be listed or managed on `/account/subscriptions`. W did not block guests (the plan does not say to). Should "Repeat" require a signed-in customer (for example a "Sign in to subscribe" note instead of the selector for guests), or should guest subscriptions be allowed and managed by e-mail link later?
**Blocking:** no
**Answer (owner):**

## Q-W-3 (workstream W, task W-06)
**Question:** The repeat orders are created by commercetools with the recurring cart as it is: there is no stock check, no new delivery slot (the recurring cart inherits the first cart's configuration, so the slot custom fields are probably copied and every repeat order would carry the first order's slot; not verified) and no step for substitution choices. Is that acceptable for v1 (the grocery flow would normally ask for a slot per delivery)?
**Blocking:** no
**Answer (owner):**

## Q-ORCH-3 (accessibility finding from Lighthouse, home page, 2026-10-06)
**Question:** Lighthouse accessibility is 90. Remaining failures: (1) **colour contrast** of `.btn-primary` (cream `#f5ead8` on terracotta `#c67139` is about 3.3:1, below the 4.5:1 for 14 px text) and the selected `.seg-opt`; (2) footer headings use `h6` directly after `h1` (heading order). Both come from the Claude Design tokens. Options: darken the primary button background to `accent-600 #b2622d` (about 4.2:1) or `accent-700 #8c491a` (about 6.3:1), or enlarge button text to 18.7 px bold (large text rule, 3:1). Recommend `accent-700` hover-state look for the resting state or `accent-600` with 16 px text; footer headings can become `p` with the same class. Decision needed because it changes the approved look.
**Blocking:** no
**Answer (owner):**
