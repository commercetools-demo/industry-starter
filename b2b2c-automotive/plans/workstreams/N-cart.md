<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream N: Cart

Status: DRAFT v1 (2026-10-12). Primary spec: `cs/design-cart-page`. App: `b2b2c-automotive/storefront/`. All paths below are relative to `b2b2c-automotive/storefront/` unless they start with `plans/`.

## 1. Goal

A shopper (anonymous or signed in) can see their cart under `/{locale}/{storeKey}/cart`: lines with a quantity stepper, stock line, Remove and line total; a delivery choice (Pick up or Ship to me) with its consequences; named savings and a promo code; a summary with subtotal, delivery, tax and total; and a Checkout button. The cart survives sign-in (merge), belongs to the reseller's store, and takes currency, tax label and free-shipping threshold from commercetools configuration, never from literals.

N also delivers the **sign-in plumbing that the merge needs** (login route with anonymous-cart merge and store-bound login, `me` route, `useAccount`). Q builds the rest of the account area on top of it.

## 2. Depends on

M (product detail page and its Add to cart button), and transitively L, J, I, G, C, B, A. Read-only dependencies on F (seeded shipping methods, tax categories, cart discounts, discount code, inventory, recurrence policies) and I (session fields `storeKey`, `branchKey`, `productSelectionId`; `getBranchScope`; the store picker; the header cart count) and on L (`lib/ct/prices.ts`, `selectStandalonePrice`, `POST /api/cart/lines`).

Owner prerequisites: none. (OA-05 is for O.)

## 3. Specs and requirements implemented

Primary: `openspec/specs/consumer-storefront/design-cart-page/spec.md`

| Requirement title (verbatim) | Scenarios | Tasks |
| --- | --- | --- |
| Lines with editable quantity | Quantity change updates totals; Stock cannot cover quantity | N-01, N-02, N-03, N-05, N-09, N-10, N-11 |
| Delivery method with visible consequences | Pickup chosen; Shipping below threshold | N-04, N-07, N-11 |
| Named savings and promo code | Code that does not match | N-06, N-11 |
| Summary with tax and total | Tax label follows the store | N-07, N-11 |
| Empty cart | Empty | N-11 |

Added by owner answers (no spec text yet, tests are named in N-03, N-04b and N-11): subscription lines (Q-Q06) and branch re-scoping (Q-005). Also from the same spec: Gaps "no cart-level fit warning if the vehicle changes after items were added (needed: warn on lines that no longer fit)" is built here (N-12). Not built (explicitly out of scope, per the spec Gaps): save-for-later, mini-cart drawer, cross-sell.

Secondary (session and auth parts): `openspec/specs/consumer-storefront/bootstrap-and-structure/spec.md`, requirements "Stateless session", "Store resolved from the path", "BFF boundary and helpers", "Client state", "Environment and least privilege". And `consumer-storefront/design-account-area` › "Sign in, register, reset" › scenario "Anonymous cart and garage merge" (cart half only; the garage half is registered by Q, task Q-03).

## 4. Decisions already taken (do not reopen)

| # | Decision | Source |
| --- | --- | --- |
| D1 | Cart and order carry the reseller's store: create carts through the in-store endpoint `apiRoot.inStoreKeyWithStoreKeyValue({ storeKey }).carts()`. | cart spec "Platform notes"; design.md decision 6 and open question E |
| D2 | Currency, country and locale come from `COUNTRY_CONFIG[locale]` and the session, never from literals. Cart currency change resets `cartId`. | bootstrap spec "Locale routing", "Stateless session"; design.md decision 7 |
| D3 | Tax label and rate come from the cart's tax data (`taxedPrice.taxPortions`, line `taxRate`). Needs project setting "country tax rate fallback" so carts without an address are taxed by `cart.country` (checked at gate G2). | cart spec "Summary with tax and total"; DEPENDENCY-PLAN gate G2 |
| D4 | Free-shipping threshold is read from the matching shipping rate's `freeAbove`, so the utility bar, cart and checkout use one figure. | shell spec "Utility bar states commercial promises from configuration" |
| D5 | Three seeded shipping methods (project-wide, `seed/src/data/tax-shipping.ts`): `mau-ship-pickup` (rate 0, no address needed), `mau-ship-standard` (DE 5.90 EUR free above 150, US 9.90 USD free above 175; rate with `freeAbove`) and `mau-ship-express` (12.90 EUR / 24.90 USD). The cart presets pickup or standard; express is chosen in hosted Checkout (O). Cart has `shippingMode: 'Single'`. | skill `core/cart.md` checklist; BOPIS reference; seed |
| D6 | **A branch is one channel that carries both stock and price** (owner answer Q-005). Pickup branch = the branch chosen in the store picker, resolved by I's `getBranchScope(session, branches, retailChannelId)` (no session field `supplyChannelId` or `distributionChannelId` any more). Line items carry `supplyChannel` (the branch, when it has stock) and `distributionChannel` = the channel of the **standalone price** selected for the sku in the order **branch channel, store retail channel (`mau-dist-north` / `mau-dist-south`), Malva base price** (I D6, L's `selectStandalonePrice`); no distribution channel when the channel-less base price wins (Q-003). When the shopper changes branch with a cart, `rescopeCartToBranch` (N-04b) re-points every line and recalculates. Reference objects are `{ typeId: 'channel', id }`, never strings. | owner-answers Q-005, Q-003; skill `b2c/optional/bopis.md`; bootstrap spec "Store resolved from the path"; seed `prices.ts` |
| D7 | Discounts: product and cart discounts plus **discount codes only**. Never use Direct Discounts (they block codes). | cart spec "Platform notes"; skill `commercetools-commerce-patterns` |
| D8 | Anonymous carts carry `anonymousId` (a UUID kept in the session). Sign-in uses the login endpoint with `anonymousCart` + `anonymousCartSignInMode: 'MergeWithExistingCustomerCart'`. Never `customers().login()`. | skill `b2c/customer-auth.md`; `core/customer-auth.md` |
| D9 | Every cart write goes through `withCartRetry` (re-fetch version, retry on 409, max 3). | skill `core/cart.md` "Concurrency Notes" |
| D10 | The cart GET discards non-Active carts and clears `cartId` from the session. | skill `core/cart.md` Pattern 2 |
| D11 | Cart lines are re-priced with `recalculate` (`updateProductData: true`) after sign-in merge and when checkout starts, because carts snapshot prices. | skill `commercetools-commerce-patterns` |
| D12 | The fit warning on lines only warns; it never blocks checkout. Default taken (question Q-N03). Consistent with the PDP: a non-fitting part can be added with a warning (owner answer Q-M02). Fit is evaluated on year ranges (J `getFitState`). | cart spec Gaps; `design-vehicle-finder-and-garage`; owner-answers Q-M02, Q-J03 |
| D13 | `inventoryMode: 'TrackOnly'` on carts; stock cap is enforced by the app (N-06). Confirm the semantics in docs (task N-03 step 4) and record the result in section 12. | skill `b2c/optional/bopis.md` |
| D14 | "Ships later" quantity comes from the inventory entry of the Malva warehouse supply channel `mau-supply-malva-dc` (master stock; the seed writes no channel-less entries); branch stock comes from the branch's supply-channel entry. Default taken (question Q-N01). | cart spec "Stock cannot cover quantity" |
| D15 | Hooks only: components never call `fetch('/api/...')`; SWR key `KEY_CART` from `lib/cache-keys.ts`; update the cache from the mutation response, no refetch. | bootstrap spec "Client state"; skill `core/cart.md` Pattern 3 |
| D16 | No mini-cart, no save-for-later, no cross-sell (undesigned; SO-01 list). | design.md section 6 |
| D17 | **No price floor in the cart** (owner answer Q-T03: no MAP floor, resellers may set any price above zero): the cart, its mapper and its routes contain no floor, MAP or minimum-price logic and read no `map-floor-percent` attribute. A lint test fails if such logic appears. The only price rule is "never show or sell a zero price". | owner-answers Q-T03 |
| D18 | **Subscriptions are sold** (owner answer Q-Q06): a line may carry `recurrenceInfo { recurrencePolicy, priceSelectionMode }` (set by M's subscribe option through L's `POST /api/cart/lines`). One-time and subscription lines may share a cart; the cart shows the frequency on subscription lines and a note that they renew automatically; the recurring order itself is created by commercetools Checkout when the order is paid (O). Subscription lines are only accepted for products with `recurring-eligible = true` and a policy that exists (checked server-side). | owner-answers Q-Q06; docs "Recurring Orders in Checkout" |
| D19 | **The cart does not collect addresses or payment**: the delivery choice (pick up or ship) and the branch preset the cart for commercetools Checkout (`checkoutFlow`, O), which collects the address, shows the matching shipping methods and takes payment. | owner-answers Q-012 |

## 5. Before you start (read-only checks; never wait silently)

1. `cd b2b2c-automotive/storefront && npm ci && npm run check` is green. If not, stop and tell the coordinator.
2. Read what M and I left: `ls lib/ct components/cart context hooks app/api`. Keep the signatures of anything M created (for example an `addToCart` handler); extend, do not rewrite.
3. Use the `b2b2c-automotive` MCP (read tools only) to confirm the seed gave you: two stores (`read_stores`), shipping methods `mau-ship-pickup`, `mau-ship-standard`, `mau-ship-express` with zone rates and `freeAbove` on standard (`read_shipping_methods`), tax category `mau-tax-parts` with DE 19% (`read_tax_categories`), active cart discounts with a name containing a percentage (Malva welcome -5 % needs a code, north large order -3 % from 2,000 EUR, south brake code -5 %; `read_cart_discounts`), discount codes `MALVA-WELCOME5` and `SUEDKAMM-BRAKE5` (`read_discount_codes`), inventory entries per branch channel and the warehouse `mau-supply-malva-dc` (`read_inventory`), standalone prices with a base price, retail channel prices and at least one branch price (`read_standalone_prices`), recurrence policies `mau-rp-monthly`, `mau-rp-quarterly`, `mau-rp-half-yearly` (`read_recurrence_policies`), project `countryTaxRateFallbackEnabled` (`read_project`), custom types `malva-checkout` (cart fields) and `malva-line` (line fields).
4. Anything missing: append a row to `plans/QUESTIONS.md` naming the missing seed item, build against the default in section 4, and tell the coordinator in your report. The seed is extended in `seed/` (workstream F's framework), never by hand in the Merchant Center.

## 6. Files you will create or change

```
lib/types.ts                          # Cart, CartLine, CartSaving, DeliveryOption, PromoCodeState, CartTotals (extend)
lib/session-core.ts, lib/session.ts   # add anonymousId (small change; keep G's tests green)
lib/ct/cart.ts                        # server-only cart operations
lib/ct/cart-retry.ts                  # withCartRetry
lib/ct/delivery.ts                    # shipping methods, pickup branch, threshold
lib/ct/inventory.ts                   # per-line stock split
lib/ct/cart-discounts.ts              # savings aggregation, promo code states
lib/ct/auth.ts                        # signIn (store-bound, merge), signOut helper
lib/mappers/cart.ts, lib/mappers/customer.ts
lib/auth/sign-in-hooks.ts             # extension point used by Q (garage merge)
lib/cache-keys.ts                     # KEY_CART, KEY_ACCOUNT
app/api/cart/route.ts                 # GET (read/clean), POST (create on demand)
app/api/cart/items/route.ts           # POST add line
app/api/cart/items/[lineItemId]/route.ts   # PATCH quantity, DELETE
app/api/cart/delivery/route.ts        # PUT { mode: 'pickup' | 'ship' }
app/api/cart/discount-codes/route.ts  # POST apply, DELETE remove
app/api/auth/login/route.ts, logout/route.ts, me/route.ts
hooks/useCart.ts, hooks/cart-actions.ts, hooks/useAccount.ts
context/CartProvider.tsx              # replace the stub from I
components/cart/{CartPage,CartLine,QuantityStepper,DeliveryChoice,PromoCodeForm,OrderSummary,EmptyCart,FitWarning}.tsx
app/[locale]/[store]/(shop)/cart/page.tsx
messages/de-DE.json, messages/en-US.json   # keys under "cart.*" and "auth.*"
.env.example                          # new scopes with reasons
```

## 7. Tasks (do them in order; every task starts with its tests, red first)

Run a single test file with `npx vitest run <path>`; the whole gate with `npm run check`.

**N-01 Types, scopes, session** [SPEC: Lines with editable quantity]
1. Add to `.env.example`, each with a one-line reason: `view_cart_discounts` (name applied discounts), `view_discount_codes` (code state), `view_tax_categories` (tax labels), `view_products` (inventory entries), `view_shipping_methods` is already there. If a call later returns 403 the error names the missing scope; add exactly that one.
2. Extend `lib/types.ts`:
   ```ts
   export type CartLine = { id: string; sku: string; productSlug: string; brand: string | null; name: string; imageUrl: string | null;
     quantity: number; unitPrice: Money; listUnitPrice: Money | null; total: Money;
     stock: { fromStore: number; shipsLater: number; capped: boolean; branchName: string | null };
     fit: 'fits' | 'does-not-fit' | 'unknown';
     recurrence: { policyKey: string; policyName: string; priceMode: 'Fixed' | 'Dynamic' } | null };   // null for a one-time line
   export type CartSaving = { discountId: string; name: string; amount: Money };      // amount positive; UI shows minus sign
   export type DeliveryOption = { mode: 'pickup' | 'ship'; methodKey: string; fee: Money; freeAbove: Money | null;
     remainingForFree: Money | null; branch: { key: string; name: string; city: string; pickupPromise: string | null } | null };
   export type PromoCodeState = { code: string; id: string; state: 'applied' | 'not-applied'; reason: PromoReason | null };
   export type PromoReason = 'does-not-match' | 'not-active' | 'not-valid' | 'max-reached' | 'stopped-by-previous';
   export type CartTotals = { subtotal: Money; savings: CartSaving[]; delivery: Money; tax: { label: string; rate: number | null; amount: Money } | null; total: Money; pricesIncludeTax: boolean };
   export type Cart = { id: string; version: number; lines: CartLine[]; itemCount: number; delivery: { selected: 'pickup' | 'ship'; options: DeliveryOption[] };
     promoCodes: PromoCodeState[]; totals: CartTotals };
   ```
3. Session: add optional `anonymousId` (UUID) to the JWT payload type in `lib/session-core.ts`; `ensureAnonymousId(session)` returns the session with one set. Test `session-anonymous-id.test.ts`: created once, stable across reads, cleared by `clearSessionCookie`.

**N-02 `withCartRetry`** [SKILL: commercetools-storefront] [SPEC: Lines with editable quantity]
`lib/ct/cart-retry.ts`:
```ts
export async function withCartRetry<T>(storeKey: string, cartId: string,
  fn: (cart: Cart /* CT */) => Promise<T>, attempts = 3): Promise<T>
```
Loads the cart, calls `fn`, on `statusCode === 409` reloads (never reuses the failed version) and retries; throws after `attempts`. Tests `lib/ct/__tests__/cart-retry.test.ts`: `retries with the latest version after 409`, `gives up after three conflicts`, `does not retry a 400`.

**N-03 `lib/ct/cart.ts`** [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns]
All functions start the file with `import 'server-only'` and use `apiRoot.inStoreKeyWithStoreKeyValue({ storeKey })`.
```ts
export async function createCart(i: { storeKey; locale; anonymousId?: string; customerId?: string; customerEmail?: string }): Promise<CtCart>
// body: { currency, country, locale, shippingMode:'Single', taxMode:'Platform', taxRoundingMode:'HalfEven', taxCalculationMode:'LineItemLevel',
//         inventoryMode:'TrackOnly', deleteDaysAfterLastModification: 30, anonymousId | customerId,
//         shippingAddress: { country } }   // country-only address so shipping rates and tax resolve before checkout
export async function getCart(storeKey, cartId): Promise<CtCart | null>   // expands, see N-07; null + caller clears cartId when not Active or 404
export async function addLine(storeKey, cartId, i: { sku: string; quantity: number; branchChannelId: string; priceChannelId: string | null /* channel of the selected standalone price: branch, retail channel, or null for the base price (D6) */; supplyFromBranch: boolean; recurrencePolicyKey?: string; vehicle?: { fitmentKey: string; label: string; fit: 'fits' | 'not-fit' | 'unknown' } }): Promise<CtCart>
export async function setLineQuantity(storeKey, cartId, lineItemId, quantity: number): Promise<CtCart>   // quantity 0 is rejected here; use removeLine
export async function removeLine(storeKey, cartId, lineItemId): Promise<CtCart>
export async function recalculate(storeKey, cartId): Promise<CtCart>      // { action:'recalculate', updateProductData:true }
```
Rules: `addLine` uses `{ action: 'addLineItem', sku, quantity, distributionChannel?: { typeId:'channel', id: priceChannelId } /* omitted when priceChannelId is null */, supplyChannel?: { typeId:'channel', id: branchChannelId }, custom?: { type: { typeId:'type', key:'malva-line' }, fields: { vehicleFitmentKey, fit } } /* only when a vehicle is active; the seeded line type also has `vehicle` (JSON) and `parentLineItemId`, unused here */, recurrenceInfo?: { recurrencePolicy: { typeId:'recurrence-policy', key }, priceSelectionMode: SUBSCRIPTION_PRICE_MODE } }` (the `supplyChannel` only when `supplyFromBranch`; `recurrenceInfo` only when `recurrencePolicyKey` is given **and** the product is `recurring-eligible` and the policy exists, else the call is refused with 422 `not-subscribable`); adding a SKU already in the cart increases quantity (commercetools merges lines with the same variant, channels and recurrence). A one-time and a subscription line of the same SKU stay separate lines. Minimum quantity is 1 (spec). The unit price comes from the cart's own price selection over **standalone prices** for the line's distribution channel (the caller passes the channel of the winning price in the order branch, store retail channel, Malva base, D6); `MissingPrice` maps to 422 `price-unavailable`. Verify in the docs search (task step 4 below) that a standalone recurring price (if the seed has one) is selected for a recurring line; record in section 12.
`rescopeCartToBranch(storeKey, cartId, scope, stockByLine)` (N-04b; `scope` is I's `getBranchScope` result) lives in the same file.
Step 4 (docs): run the `commercetools-knowledge` documentation search for "InventoryMode TrackOnly ReserveOnOrder" and write the one-sentence result under section 12 of this file. If `TrackOnly` fails the intent (no stock decrement and no failure on low stock is acceptable), keep it and note why.
Tests `lib/ct/__tests__/cart.test.ts` (mock `@/lib/ct/client`): `createCart sends store, currency, country from COUNTRY_CONFIG`, `createCart anonymous sets anonymousId and no customerId`, `createCart signed-in sets customerId`, `addLine sends channel references as objects`, `addLine for existing sku does not create a second line`, `setLineQuantity rejects 0`, `getCart returns null for Ordered cart`, `getCart returns null on 404`, `recalculate sends updateProductData`, `addLine for a recurring-eligible product sends recurrenceInfo with the policy key`, `addLine refuses a policy for a product that is not recurring-eligible`, `addLine refuses an unknown policy`, `one-time and subscription lines of one sku stay separate`, `distribution channel is the channel of the selected price and absent for the base price`, `line custom malva-line carries the vehicle fitment key only with an active vehicle`, `MissingPrice maps to price-unavailable`, `no map floor or minimum price logic in lib/ct/cart.ts` (grep test, D17).

**N-04 Delivery** [SKILL: commercetools-commerce-patterns] [SPEC: Delivery method with visible consequences]
`lib/ct/delivery.ts`:
```ts
export async function getDeliveryOptions(storeKey: string, cart: CtCart, branchChannelId: string | null): Promise<DeliveryOption[]>
export async function setDelivery(storeKey, cartId, mode: 'pickup' | 'ship', branchChannelId: string | null): Promise<CtCart>
```
- Options come from `GET /shipping-methods/matching-cart?cartId=...` (SDK: `apiRoot.shippingMethods().matchingCart().get({ queryArgs: { cartId, expand: ['zoneRates[*].zone'] } })`), then keep methods keyed `mau-ship-pickup` and `mau-ship-standard` (`mau-ship-express` is offered by hosted Checkout, not in the cart). Fee = the first `shippingRates` entry with `isMatching: true` for the cart currency; `freeAbove` from the same rate. A method with no rate in the cart currency is dropped. `remainingForFree = freeAbove - sum(line totalPrice)` when positive.
- Pickup: `setShippingMethod` to `{ typeId:'shipping-method', key:'mau-ship-pickup' }`; also `setShippingAddress` to the branch address (country, city, postalCode, streetName from the channel) so the tax country is the branch's (Austin is a US branch, 0 % US tax placeholder). Ship: `setShippingMethod` key `mau-ship-standard`; keep the country-only address until O collects the real one.
- Single-branch store (picker hidden): the only branch is used; `branchChannelId` is that channel.
- A shipping-predicate error fails silently (skill warning), so one test hits a fixture where `matching-cart` returns zero methods and expects the cart page to show a plain "No delivery option available" state, not a crash.
Tests `lib/ct/__tests__/delivery.test.ts`: `pickup is free and names store city and time`, `ship below threshold adds fee and reports remaining`, `ship at or above threshold is free`, `method without rate in cart currency is dropped`, `pickup sets the branch address as shipping address`, `pickup records the branch key in the cart custom field pickupBranchKey`, `no matching methods yields empty options`.
The cart choice is a **preset** for commercetools Checkout (D19): hosted Checkout shows the cart's matching shipping methods and collects the address itself, so O reads the final shipping method from the order, and `pickupBranchKey` (set here with `setCustomType` key `malva-checkout` once, then `setCustomField`; the seed's type, shared by cart and order so the fields copy to the order; N never creates the type) tells P and the portal which branch to collect from. The cart never collects a street address.

**N-04b Branch re-scope** [SKILL: commercetools-commerce-patterns] [SPEC: owner answers Q-005, Q-I04]
`rescopeCartToBranch(storeKey, cartId, scope, stockByLine): Promise<CtCart>` in `lib/ct/cart.ts`, called by I's `POST /api/store-context/branch` and by the cart GET when a line's `supplyChannel` or `distributionChannel` differs from what the session branch implies: one update with, for every line, `setLineItemDistributionChannel` (the channel of the standalone price selected for the sku in the order new branch, store retail channel, base; none for the base price) and `setLineItemSupplyChannel` (the new branch when it has stock for the line, else removed), then `recalculate` (D11); pickup carts also get `setShippingAddress` of the new branch and `pickupBranchKey`. Recurrence info is kept. A line with no price in scope (no branch, retail or base price, for example a north-owned local part in USD) is reported in `repriceNotice.unpriced` instead of failing. Tests `lib/ct/__tests__/rescope.test.ts`: `every line points at the new branch supply channel and the selected price channel`, `supply channel dropped when the new branch has no stock`, `recalculate follows the update`, `pickup address and branch key follow the branch`, `subscription lines keep their recurrence`, `unpriced line is reported and not dropped`, `no call when all lines already match`.

**N-05 Stock per line** [SKILL: commercetools-commerce-patterns] [SPEC: Lines with editable quantity › Stock cannot cover quantity]
`lib/ct/inventory.ts`: `getLineStock(sku, branchChannelId): Promise<{ branchQty: number; masterQty: number }>` reading `apiRoot.inventory().get({ queryArgs: { where: 'sku="<sku>" and (supplyChannel(id="<id>") or supplyChannel(key="mau-supply-malva-dc"))' } })` (one call for all lines: `sku in (...)`; the seeded warehouse is the supply channel `mau-supply-malva-dc`, there is no channel-less inventory entry, so D14's master quantity is the warehouse entry; local parts have no warehouse stock, only branch stock of the owner); `splitStock(quantity, { branchQty, masterQty }) => { fromStore, shipsLater, capped }`:
- `fromStore = min(quantity, branchQty)`; `shipsLater = min(quantity - fromStore, masterQty)`; `capped = fromStore + shipsLater < quantity`; the cart route then sets the quantity to `fromStore + shipsLater` (spec: "caps the quantity if neither is possible").
Tests `lib/ct/__tests__/inventory.test.ts`: `all from store`, `part from store part later`, `none anywhere caps to zero and the line is flagged`, `one inventory call for many lines`.

**N-06 Named savings and promo codes** [SKILL: commercetools-commerce-patterns] [SPEC: Named savings and promo code]
`lib/ct/cart-discounts.ts`:
- `getCart` expands: `lineItems[*].price.discounted.discount`, `lineItems[*].discountedPricePerQuantity[*].discountedPrice.includedDiscounts[*].discount`, `discountOnTotalPrice.includedDiscounts[*].discount`, `shippingInfo.discountedPrice.includedDiscounts[*].discount`, `discountCodes[*].discountCode`.
- `collectSavings(ctCart, locale): CartSaving[]` merges by discount id, sums `discountedAmount * quantity` per `discountedPricePerQuantity` entry, adds product discounts (`list price - discounted price`, times quantity), the total-price discount and shipping discounts. Name = `getLocalizedString(discount.obj.name, locale)`, fallback `discount.obj.key`, last fallback `cart.savingFallback` message. Never invent a percentage: the name already says "Brake season −8%".
- `applyPromoCode(storeKey, cartId, code)` sends `{ action: 'addDiscountCode', code: code.trim() }`; the returned cart's `discountCodes[]` carries `state`. Mapping: `MatchesCart` is applied; `DoesNotMatchCart` is not-applied/does-not-match; `NotActive`, `NotValid`, `MaxApplicationReached`, `ApplicationStoppedByPreviousDiscount` map to the matching `PromoReason`. A code that does not exist throws `DiscountCodeNonApplicable`/400; map to `not-applied` with reason `not-valid` **without** adding anything, so totals do not change. `removePromoCode` sends `removeDiscountCode`.
- Same message for unknown and expired code is acceptable; the UI shows the reason text from `messages`.
Tests `lib/ct/__tests__/cart-discounts.test.ts` with fixtures in `lib/ct/__fixtures__/` (`cart-brake-season.json`, `cart-code-no-match.json`): `each discount is its own named line`, `same discount on two lines is merged`, `product discount is named from its expanded reference`, `savings fall back to key then generic text`, `code that matches is applied`, `code that does not match is not applied with reason and totals unchanged`, `unknown code does not mutate the cart`, `remove code`, `no direct discounts are ever sent` (assert no `setDirectDiscounts` action in any helper).

**N-07 Mapper and totals** [SPEC: Summary with tax and total]
`lib/mappers/cart.ts`: `mapCart(ct: CtCart, ctx: { locale: string; options: DeliveryOption[]; stock: Record<string, {branchQty;masterQty}>; branchName: string|null; fit: Record<string, FitState> }): Cart`.
Totals (no floor or MAP logic anywhere, D17; prices are the cart's standalone-price selection): `subtotal` = sum of list prices times quantity (before savings), recurring lines included at their current price; `recurringNote` is true when any line is a subscription (the summary then says "Subscription items renew automatically; manage them in your account."); `savings` from N-06; `delivery` = `shippingInfo.price` (zero for pickup); `tax.label` = `${taxRate.name} (${round(taxRate.amount*100)}%)` from the first tax portion's rate, e.g. "VAT (19%)"; if portions have different rates show the label "Tax" and the amount only; `tax = null` only when `taxedPrice` is absent (UI then shows "Calculated at checkout"). `pricesIncludeTax = lines[0].taxRate?.includedInPrice ?? false`. `total` = `taxedPrice.totalGross` when present else `totalPrice`.
Tests `lib/mappers/__tests__/cart.test.ts`: `tax line reads VAT (19%) for a German store`, `tax is null when taxedPrice is absent and the summary says Calculated at checkout`, `totals reconcile: subtotal minus savings plus delivery equals total when prices include tax`, `totals reconcile with net prices: total equals net plus tax`, `item count is the sum of quantities`, `recurring line maps its policy name and price mode`, `recurring note appears only with a subscription line`, `no floor or minimum price in the mapper` (D17 grep), `currency formatting uses store locale` (render "128,45 €" for de-DE and "$128.45" for en-US via `formatMoney`; no "$" or "HST" literal anywhere: a lint test greps `components/cart` and `lib/mappers/cart.ts` for `HST` and `\$` outside template strings).

**N-08 Sign-in with merge, store-bound** [SKILL: commercetools-storefront] [SPEC: bootstrap Stateless session; account-area Sign in, register, reset › Anonymous cart and garage merge]
`lib/ct/auth.ts`:
```ts
export async function signIn(i: { storeKey: string; email: string; password: string; anonymousCartId?: string; anonymousId?: string }):
  Promise<{ customer: CtCustomer; cart: CtCart | null }>
// apiRoot.inStoreKeyWithStoreKeyValue({ storeKey }).login().post({ body: { email, password,
//   ...(anonymousCartId && { anonymousCart: { typeId: 'cart', id: anonymousCartId }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' }),
//   ...(anonymousId && { anonymousId }) } })
// Confirm the exact field names with the `commercetools-oas-schemata` tool (resource api-Customer-write); the skill example still shows the older `anonymousCartId`.
```
- Uses the **login endpoint**, in the store scope, so a customer registered at another reseller gets `InvalidCredentials` here. Every failure (wrong password, unknown email, other store) is turned into one `AuthError('invalid-credentials')` so the message never reveals which.
- After success: `recalculate` the merged cart (D11), return its id; the route writes `customerId`, `cartId` into the session.
- `lib/auth/sign-in-hooks.ts` exports `registerSignInHook(fn)` and `runSignInHooks({ session, customerId })`; Q registers garage merge. Hooks run after the cart merge; a failing hook is logged and does not fail sign-in.
Routes: `POST /api/auth/login` (zod `{ email, password }`, rate limit: reuse the in-memory per-IP limiter interface from G if present else add `lib/rate-limit.ts` with a test double), `POST /api/auth/logout` (clears `customerId`, `cartId`, keeps `anonymousId` rotated to a fresh UUID, calls SWR clear on the client), `GET /api/auth/me` returning `{ customer: { id, email, firstName, lastName, mobile, addresses[], defaultShippingAddressId, defaultBillingAddressId } | null }`.
Tests `lib/ct/__tests__/auth.test.ts`: `uses login endpoint not customers login`, `passes anonymous cart with merge mode`, `no cart argument when session has no cart`, `wrong password and other-store customer give the same error`, `merged cart is recalculated`; `app/api/auth/__tests__/login.route.test.ts`: `sets session customerId and cartId from merged cart`, `400 on bad body`, `429 after limit`, `cookie is HttpOnly lax`; `hooks/__tests__/useAccount.test.tsx`: `null when signed out`, `customer when signed in`, `logout clears cart cache`.
Merge scenario (unit level): `merge keeps both lines without duplicates` using a fixture of the merged cart returned by the mock.

**N-09 Cart routes** [SKILL: commercetools-storefront] [SPEC: Lines with editable quantity]
Handlers only validate session and body (zod), call `lib/ct`, return `{ cart }` (mapped). Each route:
- `GET /api/cart`: no `cartId` returns `{ cart: null }`; load; if null (not Active or missing) clear `cartId` and return `{ cart: null }`; else map with options and stock.
- `POST /api/cart`: create on demand (also used by `POST /api/cart/items` when `cartId` is absent); writes `cartId` and `anonymousId` to the session cookie.
- `POST /api/cart/items`: `{ sku, quantity>=1, recurrencePolicyKey? }`; uses `getBranchScope` (I-04) for the branch channel; same handler as L's `POST /api/cart/lines` (one implementation, `lib/ct/cart.ts addLine`).
- `PATCH /api/cart/items/[lineItemId]`: `{ quantity>=1 }`; capped quantities return `{ cart, notice: 'capped' }`. `DELETE`: removes.
- `PUT /api/cart/delivery`, `POST|DELETE /api/cart/discount-codes` (body `{ code }` / `{ id }`).
- Cross-store safety: a `cartId` whose cart belongs to a different store than `session.storeKey` is treated as absent (test).
Tests (one file per route in `app/api/cart/**/__tests__`): `GET with no cart returns null`, `GET clears stale cartId`, `GET clears cartId of an ordered cart`, `POST items creates cart when absent and sets session`, `PATCH rejects quantity 0`, `PATCH capped quantity returns notice`, `DELETE removes line`, `delivery switch returns new fee and tax`, `cart of another store is ignored`, `no route imports from @commercetools/platform-sdk types` (type boundary test).

**N-10 Client state** [SPEC: Quantity change updates totals]
`hooks/useCart.ts` (SWR key `KEY_CART`, fetcher returns `null` when not ok, revalidate on focus, accepts `initialCart` fallback), `hooks/cart-actions.ts` (`addItem`, `setQuantity` with optimistic update, `removeLine`, `setDelivery`, `applyCode`, `removeCode`; each writes the response body into `KEY_CART` without refetch), `context/CartProvider.tsx` (exposes `cart`, `isLoading`, `itemCount`, actions; `useCartContext()` throws outside the provider; store layout passes the server-fetched `initialCart`). The header count from I reads `itemCount`: spec "Cart · 3" for 2+1 units.
Tests `hooks/__tests__/useCart.test.tsx`: `optimistic quantity updates line total and header count before the response`, `rollback on error`, `response replaces cache without a second GET`, `cart null after sign-out`; `context/__tests__/CartProvider.test.tsx`: `throws outside provider`, `count reads 3 for quantities 2 and 1`.

**N-11 UI** [SPEC: all five requirements]
Components in `components/cart/` use tokens only (no hex, px sizes via tokens; `npm run check` runs `check-tokens`). Layout: two columns from 680 px (lines span two, sticky summary), line grid 96 px image / flexible text / price; one column below 680 px. Elements:
- `CartLine`: image, brand, name, a "Delivered every {frequency}" chip for subscription lines (policy name from the line), stock line (Pickup today at {branch} / "{n} from {store}, {m} ships later" / "Only {n} available"), `QuantityStepper` (buttons 44 px, minimum 1, `aria-label` "Decrease quantity of {name}", live region announces the new total), Remove, line total (token `--color-text-price`).
- `DeliveryChoice`: radio group "Pick up · Free" (store name, city, pickup promise) and "Ship to me · {fee}" with "free over {threshold}" or "Add {remaining} more for free shipping"; selected border `--color-border-brand` and fill `--color-brand-50`.
- `PromoCodeForm`: input and Apply; result chip Applied or Not applied with reason text and a Remove button; announces via `role="status"`.
- `OrderSummary`: Subtotal, each saving as its own line in `--color-success` tone with a minus sign, Delivery (Free or fee), tax line, Total, Checkout button (links to `/checkout`; disabled with a message while any line is capped to 0).
- `EmptyCart`: dashed border panel, "Your cart is empty." and Browse parts (link to the listing); summary hidden.
- `app/[locale]/[store]/(shop)/cart/page.tsx`: Server Component; reads session; fetches `initialCart`; renders `CartPage` (no Puck content on this page). `generateMetadata` with `robots: { index: false }`.
Tests `components/cart/__tests__/*.test.tsx` (Testing Library + `jest-axe`): `CartLine shows stock split`, `CartLine shows the subscription frequency`, `OrderSummary shows the renewal note only for subscriptions`, `stepper minimum 1`, `stepper change calls action once`, `DeliveryChoice pickup shows Free and store`, `DeliveryChoice ship below threshold shows remaining`, `PromoCodeForm not applied shows reason and remove`, `OrderSummary lists each saving by name`, `OrderSummary tax label from props`, `EmptyCart hides summary`, `CartPage has no axe violations in de-DE and en-US`, `CartPage one column at 375` (class assertions, not pixels).

**N-12 Fit warning** [SPEC: Gaps (cart-level fit warning)] [SKILL: commercetools-storefront]
`lib/fit.ts` wraps J's `getFitState` (range based: the line's product `fitment-keys` and `universal-fit` against the active vehicle's make, model, year and engine; do not duplicate fit rules). `getLineFit(sku[], vehicle) -> Record<sku, 'fits'|'does-not-fit'|'unknown'>` (fitment attributes read from the master projection of the cart's products in one call); no active vehicle gives `unknown` for all and no warning. `FitWarning` renders a banner "{n} item(s) may not fit {vehicle}" and a per-line badge with the locked danger tint and glyph ✕ plus a link "View fitting alternatives" to the listing filtered to the line's category. Never blocks Checkout (D12).
Tests `lib/__tests__/fit-cart.test.ts`: `no vehicle means no warning`, `vehicle change flags a line that no longer fits`, `warning does not disable checkout`; `components/cart/__tests__/FitWarning.test.tsx`: `uses locked danger tokens and glyph`.

**N-13 Messages** [SPEC: all]
Add keys under `cart.*` and `auth.*` to both catalogs; German strings are translated by you and flagged for review (M-N01). `npm run check` includes `check-messages` (same keys in both files).

**N-14 Live verification** (section 9 and 10), then write evidence.

## 8. Test-first scenario map

| Spec scenario | Failing test to write first |
| --- | --- |
| Quantity change updates totals | `useCart.test.tsx` "optimistic quantity updates line total and header count before the response"; `cart.route` PATCH tests |
| Stock cannot cover quantity | `inventory.test.ts` "part from store part later", "none anywhere caps to zero..." |
| Pickup chosen | `delivery.test.ts` "pickup is free and names store city and time" |
| Shipping below threshold | `delivery.test.ts` "ship below threshold adds fee and reports remaining" |
| Code that does not match | `cart-discounts.test.ts` "code that does not match is not applied with reason and totals unchanged" |
| Tax label follows the store | `mappers/cart.test.ts` "tax line reads VAT (19%) for a German store" |
| Empty | `EmptyCart.test.tsx` "EmptyCart hides summary" |
| Anonymous cart and garage merge (cart half) | `auth.test.ts` "passes anonymous cart with merge mode", "merge keeps both lines without duplicates" |

## 9. Browser recipe (Chrome DevTools MCP; Claude runs it; evidence under `plans/evidence/N/`)

Start `npm run dev` in `storefront/`. Store keys are the two seeded resellers from the seed (call them `{storeA}` and `{storeB}`; read them with MCP `read_stores`). Use one fresh browser context so cookies start empty.

1. `navigate_page` `/en-US/{storeA}/cart` with no cart. `take_snapshot`: text "Your cart is empty." and a Browse parts link; no summary. Screenshot `N-01-empty-375.png`, `N-01-empty-1440.png` (`resize_page`).
2. Open a product (`/en-US/{storeA}/p/<slug>` from the listing), press Add to cart, land on the cart. Assert via `take_snapshot`: one line with image, brand, name, stock line, stepper at 1, Remove, line total; summary Subtotal, Delivery, tax line, Total; header reads "Cart · 1". `list_network_requests`: only same-origin `/api/...` calls, none to `*.commercetools.com`. Screenshots at 375, 768, 1024, 1440: `N-02-cart-<w>.png`.
3. Press + : within one interaction the line total, Total and header count change. Press - at 1: stays 1. Press + until the quantity passes the branch stock (read the stock with MCP `read_inventory` first) and assert the "ships later" or capped text. Never call commercetools from `evaluate_script`.
4. Select Pick up: Delivery "Free", store name, city, time shown inside the option. Select Ship to me: fee line appears; with subtotal below the threshold the option shows "Add {x} more for free shipping"; add lines until above the threshold: fee becomes Free. Screenshot `N-04-delivery-ship-<w>.png`.
5. Promo code: apply a code from the seed that matches (`MALVA-WELCOME5` on any cart: state Applied, a named discount line, total drops; `SUEDKAMM-BRAKE5` on store south with a brake part: Applied, on a cart without brakes: Not applied, "cart doesn't match") and a nonsense code (state Not applied with reason, Remove works, Total unchanged). Screenshot `N-05-promo.png`.
6. Named savings: the seeded discounts appear as their own lines with their names (product discounts such as the north brake week -8 % on brakes or the autumn filter promotion -10 % on filters; the north large order -3 % cart discount from 2,000 EUR).
7. Tax label: switch to `/de-DE/{storeA}/cart`: tax line reads "MwSt. (19%)" or the seeded rate name with 19%; prices in euro format. For `/en-US/...` the label and currency come from the store's configuration (no "HST", no CAD).
8. Merge: with a cart of 1 line as guest, sign in with the seeded shopper that already has a cart line (credentials from `seed/` README, never print them in evidence). Assert both lines present, no duplicate, header count matches. Then sign in a shopper registered at store B on `/en-US/{storeA}`: generic error message identical to a wrong password.
9. Vehicle change: select a vehicle through J's finder, add a part that fits, change the vehicle to one it does not fit (including a vehicle one year outside the part's year range): banner and line badge appear; Checkout stays enabled.
9b. Branch re-scope: with two lines in the cart choose another branch in the picker: the cart re-prices (a line whose sku has a branch price changes), `read_carts` shows every line's `supplyChannel` on the new branch (when it has stock) and `distributionChannel` equal to the channel of the price selected by D6 (branch, store retail channel, or none for the base price), the totals reconcile.
9c. Subscription: add a `recurring-eligible` part with "Subscribe and save" (M), the line shows "Delivered every {frequency}" and the summary shows the renewal note; add a one-time line of the same part: two separate lines; `read_carts` shows `recurrenceInfo` only on the subscription line.
9d. No floor: in the portal (or MCP read only) the cart never refuses a low reseller price: a line priced far below list shows its price and no floor message.
10. Two tabs: change quantity in both quickly; no error banner (409 retry). `list_console_messages`: no errors or warnings from the app.

At every viewport check: no horizontal scroll (`evaluate_script` reading `document.documentElement.scrollWidth <= innerWidth`), tap targets at least 44 px (`get_css_styles` on stepper buttons), focus visible when tabbing.

## 10. `b2b2c-automotive` MCP checks (read tools only; save outputs as text under `plans/evidence/N/`)

After step 2 and step 8: `read_carts` for the session's cart id: `store.key` equals the store, `currency` EUR (de-DE) or the configured en-US currency, `shippingMode` Single, `taxMode` Platform, `lineItems[].supplyChannel` is the branch, `distributionChannel` is the price channel, `anonymousId` set before sign-in and `customerId` set after; after merge the anonymous cart has state `Merged` and the customer's cart holds both lines. After step 4: `shippingInfo.shippingMethodName` / key matches the choice and `shippingInfo.price` matches the UI. After step 5: `discountCodes[].state`. After step 6: `lineItems[].discountedPricePerQuantity[].discountedPrice.includedDiscounts` shows the same discount the UI named. `read_inventory` for the SKU confirms the quantities used in the stock line. Record the cart ids in `plans/evidence/N/N-carts.txt`. Test carts are removed by `deleteDaysAfterLastModification: 30`; do not delete shared seed data.

## 11. Manual items (owner; Claude never waits on them)

For `plans/TODO-MANUAL-TESTING.md` (the coordinator adds these rows):

| Row id | Item | Owner action |
| --- | --- | --- |
| M-N01 | Review de-DE strings under `cart.*` and `auth.*` in `messages/de-DE.json` | Native speaker reads the cart page in de-DE and marks wording |
| SO-01 (existing) | Sign-off that mini-cart, save-for-later and the cart fit warning are undesigned | Owner confirms they stay out or commissions designs |

## 12. Notes to fill in while working

- Result of the `InventoryMode TrackOnly` docs check (commercetools docs, Inventory overview and "Manage inventory with the Cart", 2026-10-12): `TrackOnly` checks stock when a line is added but only updates it when the order is created, and it allows overselling; only `ReserveOnCart` stops a shopper from adding more than is available, so the app caps the quantity itself (`splitStock`, D13). Kept `TrackOnly`: no reservation, no failure on low stock.
- Exact login body field names confirmed from the OAS (`api-Customer-write`, schema `CustomerSignin`): `email`, `password`, `anonymousCart` (a `CartResourceIdentifier`, `{ typeId: 'cart', id }`), `anonymousCartSignInMode` (`MergeWithExistingCustomerCart` or `UseAsNewActiveCustomerCart`), `anonymousId`, `updateProductData`; `anonymousCartId` is the older spelling and is not used. The in-store endpoint is `POST /in-store/key={storeKey}/login`; the response is `{ customer, cart? }`. A customer of another store gets `InvalidCredentials` (400), indistinguishable from a wrong password.
- `recurrenceInfo` accepted by `addLineItem` (`api-Cart-write`, `LineItemRecurrenceInfoDraft`; both fields required): `{ recurrencePolicy: { typeId: 'recurrence-policy', key }, priceSelectionMode: 'Fixed' | 'Dynamic' }` (the storefront sends `Dynamic`, M's `SUBSCRIPTION_PRICE_MODE`). The line response carries `recurrenceInfo.recurrencePolicy` as a reference, so the cart read expands `lineItems[*].recurrenceInfo.recurrencePolicy` to get key and name. `setLineItemSupplyChannel` and `setLineItemDistributionChannel` with the channel left out remove it (used by the branch re-scope). Whether a standalone price with a `recurrencePolicy` exists and is selected for a recurring line cannot be checked offline (the seed has none): the normal standalone price is used; recorded as M-N03 step 2.
- Seed items that were missing and the question rows added: none could be checked offline (no credentials, no MCP project reads); the cart builds against the plan's defaults and degrades when an item is missing (no delivery option, stock 0, discount name falls back to its key). The live read-backs are M-N02 and M-N03. New questions Q-N04 to Q-N07 are in `plans/notes/questions-NOPQ.md`.

## 13. Definition of done

- [ ] Every task N-01 to N-13 done and N-14 (live verification) recorded; every test named above exists and passes; tests were written before the code (commit order or your notes show it).
- [ ] `npm run check` green (typecheck, lint, all gate scripts, vitest including `jest-axe`).
- [ ] No literal `HST`, `$`, `CAD` or `99` threshold in `components/cart` or `lib/mappers/cart.ts` (the lint test passes); no floor, MAP or `map-floor-percent` reference anywhere under `lib/ct/cart*.ts`, `lib/mappers/cart.ts`, `components/cart` (D17 grep test passes).
- [ ] Branch re-scope and subscription lines proven by tests and by recipe steps 9b and 9c.
- [ ] Browser recipe steps 1 to 10 done at 375, 768, 1024, 1440 with screenshots, console clean.
- [ ] MCP read-back of carts matches the UI (section 10).
- [ ] No commercetools SDK type imported in a component; no `fetch('/api/` in components.
- [ ] Questions Q-N01 to Q-N03 are in `plans/notes/questions-NOPQ.md`; M-N01 handed to the coordinator.
- [ ] Section 12 filled in.

## 14. Evidence to leave

`plans/evidence/N/`: screenshots named in section 9, `N-carts.txt` with cart ids and the MCP excerpts, the final `npm run check` summary line, and a short `N-notes.md` only if something deviated from this plan.

## Progress

- 2026-10-12 (J18): N-01 to N-13 built test first; `npm run check` (tsc, eslint, all script gates, 1450+ tests with jest-axe) and `npm run verify:build` (dummy env) green. N-14 (live verification) was run offline: headless Chrome over the DevTools protocol (the Chrome MCP browser is shared with other agents) against a throw-away fake of the commercetools endpoints, store `mau-reseller-north`, en-US and de-DE, 375/768/1024/1440, console clean; evidence in `plans/evidence/N/` (`storefront-` prefix, `N-carts.txt`, `README.md`). The live project read-back is M-N02 and M-N03.
- Done: cart read model with named savings (product, cart, total and shipping discounts merged by discount id) and totals that reconcile; quantity change (optimistic, capped by stock: branch plus warehouse `mau-supply-malva-dc`, `TrackOnly`) and remove; pickup or ship with fee, `freeAbove` and "Add {x} more" from the matching rate; promo code field (Applied or Not applied with reason, Remove, refused codes reported without touching the cart); tax label from the cart; empty state; subscription lines (`recurrenceInfo`, "Delivery: {frequency}", renewal note, refused with 422 `not-subscribable` for a part that is not eligible, a policy that is not `mau-rp-*` or when subscriptions are off); fit warning per line and banner (live from the garage, warn only, the vehicle is also written to the line as `malva-line`); `rescopeCartToBranch` (replaces I's seam, same three-argument signature and boolean answer; the cart read re-scopes too); sign-in with merge (`signIn`, `loginCustomer`, `POST /api/auth/login|logout`, `GET /api/auth/me`, `useAccount`), sign-in hook list with the garage merge registered, sign-in page `/{locale}/{store}/account/sign-in` with the demo slot; de-DE and en-US messages `cart.*` and `auth.*`.
- Deviations from the plan: (1) routes keep L's `POST /api/cart/lines` as the one add handler and `POST /api/cart/items` re-exports it (no `addLine` second implementation; `addLineToCart` of L is extended); (2) the cart page lives at `app/[locale]/[store]/cart/page.tsx` (this app has no `(shop)` group) and the sign-in page at `(auth)/account/sign-in`; (3) `CartProvider` wraps the cart page, not the layout (the header count follows the cart through `KEY_CART_SUMMARY`, kept in step by `useCart`); (4) pure mapping lives in `lib/mappers/cart.ts`, `lib/mappers/cart-savings.ts`, `lib/store/stock.ts` so no server-only module reaches a client bundle; (5) the plan's `getLineFit` is pure over the line attributes (no extra product call); (6) the subscription chip reads "Delivery: {frequency}" because the policy names ("Monthly", "Every 3 months") do not fit "Delivered every {frequency}"; (7) the sign-in `next` is a store-relative path (Q-N06).
- Contracts for O and Q: `lib/ct/cart.ts` (`getCart`, `postActions`, `setLineQuantity`, `removeLine`, `recalculate`, `createCart`, `rescopeCart`, `addLineToCart`), `lib/ct/cart-view.ts` (`loadCartView`, `buildCartView`), `lib/ct/delivery.ts` (`setDelivery`, pickup preset: shipping method, branch address, `custom.pickupBranchKey` on type `malva-checkout`), `lib/cart-route.ts`, `lib/ct/auth.ts` (`signIn`, `AuthError`), `lib/auth/login.ts` (`loginCustomer`, the function the demo login calls), `lib/auth` (`registerSignInHook`, `runSignInHooks`; importing the root registers the garage merge), `lib/auth/safe-next.ts`, `hooks/useAccount.ts`, `hooks/useCart.ts`, `context/CartProvider.tsx` (`useCartContext`), `components/auth/DemoLoginSlot.tsx` (Q fills it), `lib/cache-keys.ts` `KEY_ACCOUNT`, `KEY_CART`.
- Open: M-N02, M-N03 (live read-backs), M-N04 (owner look), M-N01 (German wording); Q-N04 to Q-N07; the header Account link still goes to `/account` (Q).

