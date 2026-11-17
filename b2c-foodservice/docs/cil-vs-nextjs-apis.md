# Commerce Integration Layer vs this app's Next.js APIs: possibilities and blockers

**Question.** What would we gain, and what would stop us, if the storefront called the commercetools Commerce Integration Layer (CIL, the Experience API) instead of its own Next.js Route Handlers (`storefront/app/api/*` → `lib/ct/*` → commercetools)?

**Scope (owner decision).** Included: all shopping-core use cases (A), all account use cases (B), all foodservice-specific use cases (C) and reviews (D1). Excluded and not assessed, positively or negatively: the shopping assistant, the contact, newsletter and FAQ endpoints, and the demo and ops plumbing routes. Cross-cutting topics (global limits, enrollment, migration effort) are out of scope except where one decides a specific use case.

## How to read this document

| Evidence tag | Meaning |
|---|---|
| **[Code]** | Read from this repository (route headers and `lib/ct/*`, `storefront/AGENTS.md`). |
| **[Docs]** | Stated in the CIL documentation (sources at the end). |
| **[Inference]** | My reading of the two; not confirmed by either. |
| **[Verify]** | Cannot be decided from the docs. The docs list operation *names* only. Argument shapes, behaviour and per-field coverage need `commercetools integration-layer schema fetch` against an enrolled Project. |

| Verdict | Meaning |
|---|---|
| ✅ Fits | Core schema has a documented equivalent. |
| 🟡 Fits with work | Needs a schema extension, a Managed API Extension, or client orchestration. |
| 🔴 Gap | No documented equivalent. Needs an extension that calls the commercetools HTTP API itself, or the Next.js route stays. |
| ❓ Unknown | Depends on a [Verify] item. |

## Two facts that shape every verdict

1. **Schema extensions have no commercetools client.** [Docs] A resolver gets `ctx.now()` and `ctx.config` only. It has no commercetools client, no Project credentials and no shopper session, locale, currency or country. Outbound `fetch` goes only to allowlisted hosts. [Inference] An extension that must write something the core schema lacks would have to call the commercetools HTTP API through `fetch` with its own API client credentials kept as a config secret. That recreates a small BFF inside the extension, without the shopper's identity.
2. **The session context is not changed through GraphQL.** [Docs] Presentment (locale, currency, country), Business Unit and Store are changed through REST identity endpoints (`PATCH /session`, `PUT /session/scope`, `PUT /session/business-unit`, `PUT /session/distribution-channel`). The browser holds a session token. An HttpOnly cookie needs a same-domain proxy. [Inference] So the Next.js server tier shrinks to a thin proxy and cookie holder rather than disappearing.

## Summary matrix

> **Superseded where tested.** The verdicts in this matrix and in the sections below come from the docs and the code. The section "Live experiment results" near the end replaces every [Verify] item with what the live API did, and gives the updated verdict per use case.

| ID | Use case | Verdict | One-line reason |
|---|---|---|---|
| A1 | Search, listing, facets | ❓ | `search` exists; brand scoping, availability filter and facet depth unverified. |
| A2 | Cart | 🟡 | Core mutations exist; per-line store, recurrence, bundles, modifiers and carry-over need work. |
| A3 | Hosted Checkout, mixed bags | 🟡/🔴 | `beginPayment` fits the simple path; the clone-cart strategy has no documented equivalent. |
| A4 | Orders, reorder, returns | 🟡 | `orders`, `reorder` and `requestReturn` exist; the combined status model and return window are custom. |
| B1 | Auth and session | 🟡 | Replaces the app's session cookie; demo login maps to the extension grant. |
| B2 | Profile, addresses, password, deletion | 🟡/🔴 | Mutations exist except account deletion; address policy is custom. |
| B3 | Saved payment methods | 🔴 | No account mutation or query for stored methods is documented. |
| B4 | Shopping lists | ✅ | Documented operations match the app's behaviour. |
| C1 | Recurring orders | ❓/🔴 | Entities exist; no pause, resume, skip or interval operations are documented. |
| C2 | Stores, availability, click-and-collect | ❓/🔴 | Store and channel scope exist in the session; per-store stock and store list are not documented. |
| C3 | In-store barcode scan | ❓ | SKU lookup is a catalog read; the docs steer in-store flows elsewhere. |
| C4 | Preset bundles, drink configurator | 🟡 | Server-side rules fit a Managed API Extension; pricing and child lines need verification. |
| C5 | Market switching with cart carry-over | 🟡 | `PATCH /session` changes presentment; carry-over and dropped-line reporting are custom. |
| D1 | Reviews | ❓/🔴 | `Review` is an extensible entity; no review operations are documented. |

---

## A. Shopping core

### A1. Search, listing and facets (`GET /api/search`, `lib/ct/search.ts`)

**Today.**
- [Code] The listing URL contract (`scope`, `brand`, `q`, `sort`, `page`, `avail=1`, `f_<facet>`) is parsed by `parseListingParams`.
- [Code] `buildSearchRequest` calls Product Search only (`products().search()`) and adds `productSelections = <id>` per brand.
- [Code] The category tree is derived from the brand's selection, and a product outside the brand's selection is a 404.
- [Code] Results are ids, then `getListingProjections` maps them with the shopper's price.

**Possible.**
- [Docs] A `search` query and `products`, `categories` and `category` queries exist. Prices and localized fields follow the session presentment, so the per-request price and locale plumbing in `lib/ct/products.ts` could go.
- [Docs] The schema is Project-specific (typed product-type attributes and Custom Fields), so `mapAttributes` and attribute-label handling could shrink.
- [Docs] Catalog has no mutations, so the read surface is simple.

**Blockers and risks.**
- [Verify] Brand scoping (Malva Coffee vs Malva Drinks via two product selections in one Project). The session scope holds Store and Channels, not product selections. If the schema cannot filter by selection, the brand rules in `lib/ct/product-selections.ts` have no home.
- [Verify] The `avail=1` filter (in stock for the shopper's store or channel). The docs only say the filter inputs (`ProductFilter`, `AttributeFilterInput`, `ProductSort`, `SearchQueryMode`) exist as SDL.
- [Docs] Facet options are capped at 10 per facet (most common kept, extras truncated). The app's facet configuration would have to be checked against this.
- [Docs] Product Search page size is 100 and the max offset for Product Variants and Inventory is 10000. This is probably fine for this catalogue (about 41 products in the mock seed); [Verify] against the real one.
- [Docs] There is no introspection on the public endpoint, so tooling and codegen run from the CLI SDL export.

### A2. Cart (`/api/cart`, `/api/cart/lines`, `/api/cart/bundles`, `/api/cart/count`)

**Today.**
- [Code] Lines carry the custom type `mcf-line-fulfilment` (`brand`, `fulfilment`).
- [Code] Collect lines set `supplyChannel` to a store. Subscribe lines set `recurrenceInfo` with a policy key. Drinks lines use the brand inventory channel.
- [Code] `addLine` validates SKU, quantity 1 to 99, store key, policy key and modifier ids against the drink's configuration.
- [Code] Errors are domain codes: `quantity_exceeds_stock`, `store_required`, `not_available_for_collection`, `collect_not_available_in_market`, `price_unavailable`, `line_not_found`.
- [Code] `GET /api/cart` re-prices shipping, runs a price check and rebuilds a cart whose shipping mode differs from `CART_SHIPPING_MODE`.
- [Code] The cart view groups lines per fulfilment and per brand (`lib/cart/plan.ts`, `lib/cart/brand-sections.ts`) and explains discounts (`discount-reasons.ts`).

**Possible.**
- [Docs] Documented operations cover `addCartLine(s)`, `updateCartLineQuantity`, `updateCartLineCustomFields`, `removeCartLine`, `clearCart`, `applyDiscountCode`, `removeDiscountCode`, `selectShippingMethod` and `shippingMethodsForCart`. This replaces most of the 45 KB `lib/ct/cart.ts`.
- [Docs] The active cart is resolved from commercetools on every request, so the `cartId` held in the session cookie would not be needed.
- [Docs] An extension can add computed fields to the `Cart` entity, for example the fulfilment grouping or brand sections, so the grouping logic could run server-side on top of the core cart.
- [Docs] A Managed API Extension can approve, modify or block cart writes for every client. Rules such as "drinks cannot be collected or subscribed" would then hold even outside the storefront.

**Blockers and risks.**
- [Docs] Channel scope in the session is set per session (`PUT /session/distribution-channel`, `PUT /session/scope`). [Code] The app sets the supply channel per line, so one bag can mix stores and delivery. Whether `addCartLine` accepts a per-line supply channel is [Verify].
- [Docs] The documented mutations list no recurrence input for a line. Whether `addCartLine` can set `recurrenceInfo` for subscribe lines is [Verify]. It matters for C1.
- [Docs] Managed API Extension handlers receive the resource only, with no session, shopper or presentment context. [Inference] Rules that depend on the shopper's market or store must derive them from the cart or its custom fields.
- [Docs] Managed API Extension timeouts default to about 2 seconds and chained handlers add up. [Docs] A schema-extension resolver calling out may take up to 30 seconds per call.
- [Docs] The documented line-level update is `updateCartLineCustomFields`. [Verify] Switching fulfilment on a line (delivery ↔ collect, `switchFulfilment`) and changing the collection store (`changeCollectionStore`) may need to be remove-and-add composed by the client or an extension.
- [Code] Domain error codes (`409 quantity_exceeds_stock { available }`, `store_required`) are part of the current client contract. CIL returns GraphQL errors. [Inference] The client error mapping must be rewritten, and stock-cap errors need an equivalent (Managed API Extension or a field).
- [Verify] `GET /api/cart/count` becomes a query; the existing SWR hooks (`useCart`, `useCartMutations`) would change to GraphQL documents.

### A3. Hosted Checkout (`/api/checkout`, `/pickup`, `/session`, `/complete`)

**Today.**
- [Code] `POST /api/checkout/session { expectedTotalCents, part }` creates a hosted Checkout Session for a cart named only by the server (session or pay cookie), never by the request body.
- [Code] Mixed bags are handled by cloning the bag into one Single cart per fulfilment group (`preparePayments`, `MIXED_STRATEGY = 'complete-per-group'`). Clone ids travel in the HttpOnly cookie `mcf_pay_carts`. Order numbers are deterministic (`orderNumberForCart(bagId)` plus `-A`, `-B`).
- [Code] `POST /api/checkout/complete` polls up to 5 times, 1 second apart, for the order, makes sure it has the `ordered` state and runs post-order hooks (`afterPlacement` removes paid lines and clears the bag after the last payment).
- [Code] The pickup person is validated and stored for collect groups. Guards such as `subscribeNeedsAccount` are registered in `EXTRA_BLOCKERS`.

**Possible.**
- [Docs] `beginPayment` creates a Checkout Session and returns `paymentTicket`, `projectKey`, `region` and `mode` (`COMPLETE` or `PAYMENT_ONLY`). `viewer.checkoutMode` says which Browser SDK method to prepare. [Code] `lib/checkout/hosted-sdk.ts` is the only SDK importer, so the client side of the hosted flow stays almost unchanged.
- [Docs] Checkout routing rules (ordered, by store and/or country, first match wins) are managed in Merchant Center or the CLI. This replaces any app-side routing and removes the raw `fetch` in `lib/ct/checkout-session.ts`.
- [Docs] Checkout creates the Order and processes payment, so the app's order-polling would be replaced by the CIL order query, or kept.

**Blockers and risks.**
- [Docs] The active cart is what CIL resolves per request. [Verify] A cart that is not the active cart (the per-group clone carts) cannot obviously be paid through `beginPayment`. This is the largest single risk for mixed bags.
- [Code] The deterministic order number and the `expectedTotalCents` guard have no documented counterpart on `beginPayment`. [Verify] arguments.
- [Code] Pickup person and delivery note are validated on the cart. The documented cart setters cover addresses, customer email, PO number and shipping method. Cart-level custom fields for pickup are not documented. [Verify]; otherwise a schema-extension mutation that calls the HTTP API is needed (see "Two facts").
- [Code] The post-order step (assign the `ordered` state, subscription-hook logging, clearing paid lines) has no documented hook. [Docs] A Managed API Extension can modify an order write. A reaction after the fact belongs to a Subscription, which is outside CIL.
- [Docs] If no routing rule matches, starting a Checkout flow fails, so a catch-all rule is needed.
- [Docs] `checkout`, `guestCheckout` and `placeOrder` do not collect payment, so they are not an alternative to the hosted flow here.
- [Docs] Refunds, captures, cancellations and reversals are not in the CIL schema. (Not used by this storefront today, so no change.)

### A4. Orders, reorder and returns (`/api/orders`, `/orders/[id]`, `/reorder`, `/returns`)

**Today.**
- [Code] One `OrderView` model serves the confirmation page, list and detail. It combines collection state and shipment state into `status` (`order-status.ts`) and adds `returnable` units per line, `canReturn`, a return window of `RETURN_WINDOW_DAYS`, parcels with tracking links and a collect timeline.
- [Code] Ownership is enforced server-side: a foreign and an unknown id both answer 404. Guest orders are readable by whoever holds the id.
- [Code] `POST /returns` validates the window and per-line remainder, then adds the return as shipment state `Advised`. The route comment says the My Orders API is read-only, so the write runs on the server.
- [Code] `POST /reorder` adds lines to the current bag and reports skipped lines with reasons (`unavailable`, `out_of_stock`, `not_found`, `price_missing`).

**Possible.**
- [Docs] `orders` and `order` queries, plus `reorder`, `requestReturn` and `cancelOrder` mutations exist. Reorder and returns could stop being custom code.
- [Docs] `Order` is an extensible entity. Computed fields (`status`, `returnable`, `canReturn`) could live in an extension via `@requires`.
- [Docs] Orders come with the session's identity, so the explicit ownership check disappears.

**Blockers and risks.**
- [Verify] `requestReturn` semantics: whether it enforces a return window, quantity limits and which shipment state it writes. The app's rules (window from `lastModifiedAt`, per-line remainder) would have to be reproduced in a Managed API Extension on order updates.
- [Verify] Whether `reorder` reports skipped lines with reasons. The app's UI depends on that list.
- [Verify] Guest order read by id after the hosted Checkout returns. CIL orders are session-scoped; the confirmation page for guests may need a session that can see the order.
- [Docs] The app's combined status relies on the order state (`ordered`, `preparing`, `ready-for-collection`, `collected`) and `ensureOrderState`. An extension resolver cannot read commercetools states by itself (see "Two facts").
- [Docs] Orders and Platform queries cap at 500 per page. The app's page size is at most 50, so this is fine.

---

## B. Account

### B1. Auth and session (`/api/auth/*`, `lib/session.ts`)

**Today.**
- [Code] A signed HS256 cookie `malva-session` (30 days) holds `cartId`, anonymous id, market (country, currency, locale), collection store, `customerId` and agent session state. `proxy.ts` reconciles the cookie to the URL market on every page request.
- [Code] Login returns the same error for unknown and wrong credentials, rate-limits (`429 too_many_attempts`, `retryAfterSeconds`) and merges the guest cart. Registration creates a verified customer and signs in immediately. A password policy runs before any commercetools call.
- [Code] Demo sign-in maps a key to a seeded email and a shared password held in the environment; neither reaches the browser.

**Possible.**
- [Docs] Sessions are stateless JWTs sealing the commercetools token. Anonymous mint needs no credentials, password sign-in upgrades the same session and merges the anonymous cart, `refresh` renews, `DELETE /session` revokes immediately. This replaces the home-built cookie, token signing and cart merge.
- [Docs] The shopper never handles a commercetools token, and the app's server-held `cartId` is not needed.
- [Docs] An `extension` grant (`onResolveLogin`, `onRevalidateSession` hooks) lets a Project-owned extension act as identity authority. [Inference] The demo-customer login could be built on it. An OIDC provider is supported through the `idp` grant if one is ever added.

**Blockers and risks.**
- [Docs] Sessions are created through a different REST host (`auth.integration-layer.{region}...`), not GraphQL. `register` creates the Customer via GraphQL, but the sign-in is a separate identity call.
- [Docs] An HttpOnly cookie needs a same-domain proxy; the cookie names and attributes are not specified. [Inference] The Next.js tier must keep some `/api/auth/*` proxy routes.
- [Docs] Each touchpoint must mint its own session; tokens are not shared across touchpoints.
- [Docs] The docs give no numeric session TTL. The app's 30-day session would need a refresh strategy (refresh a few minutes before `expires_in`).
- [Code] Rate limits (login, password change 5 per 10 minutes) and the `retryAfterSeconds` contract have no documented CIL equivalent. [Verify]
- [Code] Password policy before the commercetools call (J's policy) and the generic `registration_failed` response need a home: a Managed API Extension on customer create, or a proxy route. [Verify] what a Managed API Extension sees for a customer password.
- [Code] Market and store live in the cookie and are read in server components (`getMarket()`, `getSession()`). They would move to the session presentment and scope, set through REST calls from the proxy.

### B2. Profile, addresses, password, account deletion (`/api/account/*`)

**Today.**
- [Code] Profile: first name, last name, phone (stored on the default shipping address), default shipping address. Email is read-only.
- [Code] Addresses: add, patch, delete with `makeDefault` and `confirmed`. A verifier can answer `409 address_needs_confirmation`. On deleting the default, a promotion policy applies (`address-policy.ts`, `address-validate.ts` for US and CA formats).
- [Code] Password change: current password re-verified, 5 tries per 10 minutes, policy check first.
- [Code] Deletion: password re-verified, customer deleted with `dataErasure: false`, session cleared.

**Possible.**
- [Docs] `updateProfile`, `addAddress`, `updateAddress`, `removeAddress`, `setDefaultAddress` and `changePassword` exist, as do `changeEmail` and other setters. Most of `lib/ct/customer.ts` and `addresses.ts` could be dropped.
- [Docs] Customer is an extensible entity. Computed fields could be added without another route.

**Blockers and risks.**
- 🔴 [Docs] No account-deletion mutation is documented. The route, with password re-verification and `dataErasure: false`, has no replacement. [Inference] It would be a schema-extension mutation calling the HTTP API with its own credentials, or the Next.js route stays.
- [Code] The phone number is stored on the default shipping address, with `defaultShippingAddressId` in the profile. The documented setters do not include a phone field. [Verify]
- [Code] Address confirmation (`address_needs_confirmation`), US and CA validation and default-promotion on delete are app policy. They would move to a Managed API Extension on customer updates (block with errors), losing the "confirm and retry" dialogue unless the error shape allows it. [Verify]
- [Code] Password-change rate limiting is app-side. [Verify] whether `changePassword` has its own.

### B3. Saved payment methods (`/api/account/payment-methods*`)

**Today.**
- [Code] List, remove (set `Inactive`; the token at the payment service is not revoked) and set default. Cards are saved by the hosted Checkout and there is no add. The view never carries the token. Scopes are `view_payment_methods` and `manage_payment_methods`.

**Possible.**
- [Docs] A `paymentMethods` query exists in the Cart group. [Verify] whether it returns the shopper's saved methods or the methods available for a cart.

**Blockers and risks.**
- 🔴 [Docs] No Account query or mutation for stored payment methods, remove or set-default is documented.
- [Inference] A schema extension would need to call the commercetools HTTP API with credentials holding those scopes. That means holding broad credentials outside the shopper's sealed token.
- [Docs] Payment-side operations after checkout (refunds and similar) are explicitly outside the CIL schema, which suggests payment-method management may be as well. [Verify]

### B4. Shopping lists (`/api/shopping-lists`, `/add-to-cart`)

**Today.**
- [Code] One list per customer. Items newest first with a card (price in the shopper's market, read from the product). `view=ids` is a light read for the hearts. Add-all-to-cart adds every saved product as a delivery line, lists skipped products with a reason and leaves the list unchanged.
- [Code] Guests keep hearts in `sessionStorage`; they are merged at sign-in.

**Possible.**
- [Docs] `shoppingLists`, `shoppingList` and mutations `createShoppingList`, `addToShoppingList`, `addShoppingListLine`, `changeShoppingListLineQuantity`, `removeShoppingListLine`, `updateShoppingList`, `deleteShoppingList` exist. This is the closest one-to-one match in the whole app.
- [Docs] Prices follow the session presentment, matching today's "read from the product, not the list" behaviour.
- [Docs] GraphQL field selection makes the `view=ids` light read natural.

**Blockers and risks.**
- [Inference] "Add all to cart with skipped reasons" has no single operation. A client would compose `addCartLines` and read errors, or an extension adds a mutation. [Verify] whether `addCartLines` reports partial failures.
- [Code] The sign-in merge of guest hearts is client logic and would stay.

---

## C. Foodservice-specific

### C1. Recurring orders and recurrence policies (`/api/recurring-orders*`, `/api/recurrence-policies`)

**Today.**
- [Code] Read, `pause`, `resume`, `cancel`, `skip` (cumulative `Counter`) and `setInterval`, each as one update action. A schedule change is refused while a skip is pending. A foreign or unknown id answers the same 404. Policies are public and cached for 5 minutes. Scope is `manage_recurring_orders`.
- [Code] Subscribe lines set `recurrenceInfo` (Fixed price mode) on the cart line.

**Possible.**
- [Docs] `RecurringOrder` and `RecurrencePolicy` are extensible federation entities, so the core subgraph knows them.
- [Docs] Session identity would replace the app's ownership check.

**Blockers and risks.**
- 🔴 [Docs] None of the documented operation groups lists recurring-order queries or mutations (pause, resume, cancel, skip, set interval) or a recurrence-policy query. [Verify] by schema fetch; if absent, these need extension mutations calling the HTTP API, with `manage_recurring_orders` outside the shopper's token.
- [Verify] Whether `addCartLine` accepts a recurrence policy (see A2).
- [Code] Skip and schedule-change behaviour is documented as unverified live in this repo (Q-N-17, Q-N-18). Moving to CIL does not remove that uncertainty.
- [Code] A guest cannot check out with a subscribe line (`subscribeNeedsAccount`). That guard is app policy, so it would move to a Managed API Extension or stay client-side.

### C2. Stores, availability and click-and-collect (`/api/channels`, `/availability`, `/session/store`)

**Today.**
- [Code] `GET /api/channels?country=` returns stores sorted by city (none in Canada) with the session's selected store. `GET /api/availability?sku=` returns, per store of the session country, a state and quantity, read from inventory entries per supply channel, never `variant.availability`. `PUT /api/session/store` writes only `collectionStoreKey`.
- [Code] Store search and opening hours have their own helpers (`store-search.ts`, `hours.ts`, `geo.ts`).

**Possible.**
- [Docs] The session scope carries a Store and distribution/supply Channels, set with `PUT /session/scope`. The core schema's Product Variants and Inventory have a max offset of 10000, which implies inventory is readable. [Verify] fields.

**Blockers and risks.**
- 🔴 [Docs] There is no documented store or channel list query. `Channel` and `Inventory` are not in the list of extensible entities. [Inference] A root query extension calling the HTTP API would be needed for the store list with coordinates and hours.
- [Verify] Per-store stock by SKU (state and quantity per supply channel). The app deliberately avoids `variant.availability` because it is not per-store.
- [Docs] Session scope is changed through REST, not GraphQL. [Code] The app's `collectionStoreKey` is a pure preference that does not touch the cart; a session scope may have different semantics (for example Store-scoped pricing or carts). [Verify]
- [Code] Canada has no collection; that market rule is app policy and would stay as client or extension logic.

### C3. In-store barcode scan (`/api/instore/scan`)

**Today.**
- [Code] `GET /api/instore/scan?sku=` returns the product a scanned code leads to: image, name, variant attributes, price, availability, quantity limits. 400 if the text is not a SKU, 404 if the shop does not sell it.

**Possible.**
- [Docs] Catalog queries (`product`, `products`, `search`) can resolve a product. [Verify] lookup by SKU.

**Blockers and risks.**
- [Docs] The best-practices page says CIL is not for POS or in-store flows and points to InStore. [Inference] This feature is a web-store scan dialog, not a POS flow, but the guidance is worth confirming with the CIL team.
- [Verify] Availability and quantity limits come from the same per-store inventory question as C2.
- [Code] The SKU pattern validation before any lookup would stay client or extension-side.

### C4. Preset bundles and the ready-made coffee configurator (`/api/preset-bundles/[sku]`, `/api/cart/bundles`, modifiers on `/api/cart/lines`)

**Today.**
- [Code] Preset bundles have their own pricing (`lib/preset-bundle/pricing.ts`), selection rules and refusals (`bundle-refusals`), and add several lines at once. Ready-made coffee adds modifier product ids, checked against the drink's configuration by `addLine` (`drink-modifiers.ts`), at most 20 modifiers.
- [Code] These rules are server-side in the BFF today.

**Possible.**
- [Docs] `addCartLines` adds several lines in one call. A Managed API Extension can approve, modify or block cart writes for every client. The bundle and modifier validity rules fit that model and would then hold for all channels, not only this storefront.
- [Docs] `updateCartLineCustomFields` can carry modifier or bundle markers if they are Custom Fields.

**Blockers and risks.**
- [Docs] Handlers receive the resource only and are bound by a default of about 2 seconds, and by chaining limits (up to 5 dependencies, depth 3). Rules that must read product configuration may need to call out or run against cart custom fields.
- [Verify] Bundle pricing model (the repo notes a pricing model for preset bundles): whether it needs per-line price overrides, which the documented cart mutations do not mention.
- [Verify] Parent-child line relationships for modifiers. The app stores them in its own line structure.
- [Code] `GET /api/preset-bundles/[sku]` is a read model (bundle composition and price) with no documented counterpart. It would be a root query extension, likely with HTTP API calls for the product data it needs.

### C5. Market switching with cart carry-over (`PUT /api/session/market`)

**Today.**
- [Code] Country, currency and locale change together. A cart is bound to its currency, so on a currency change `rebuildCart` recreates the bag in the new market and returns `cartCarriedOver`, `droppedLines` and `droppedCodes`. The UI shows dropped lines. `proxy.ts` makes the URL locale win over a session in another market.

**Possible.**
- [Docs] `PATCH /session` changes presentment (locale, currency, country) on the same session. Price and locale-dependent fields then read the new context.

**Blockers and risks.**
- [Verify] What happens to the active cart on a presentment change. The docs say the cart is resolved from commercetools per request, but not how a currency change is handled.
- [Inference] The carry-over and dropped-line report would be client orchestration (read old cart, switch presentment, add lines to the new cart, collect rejections) or an extension, and the atomicity of today's `rebuildCart` would be lost.
- [Docs] A request that needs presentment and has none fails with `SESSION_MISSING_PRESENTMENT`; there is no default. [Code] The app currently derives the market from the URL on every request, so the proxy must set presentment before any query.
- [Code] The reconcile rule (URL market wins, cart id and store dropped, customer kept) would have to be re-expressed against the identity endpoints.

---

## D. Reviews

### D1. Reviews (`/api/reviews`, `/api/reviews/[id]`)

**Today.**
- [Code] Public read: five per page, sorted newest, highest or lowest, with the signed-in customer's own review marked. `?mine=1` lists own reviews with product cards. Create, edit and delete have no moderation (D-037). One review per customer and product (`uniquenessValue` plus a pre-check). Text is rendered as plain text. Responses carry no email or customer id. 30 writes per hour per customer.
- [Code] Writes use an isolated second API client (`lib/ct/review-client.ts`, D-027) so the review credentials are separate from the main client.

**Possible.**
- [Docs] `Review` is an extensible federation entity, so the core subgraph knows it. A Managed API Extension on review creation could enforce one-per-customer, rating range and text rules for every client.

**Blockers and risks.**
- 🔴/❓ [Docs] No review queries or mutations appear in the documented operation groups. [Verify] by schema fetch. If absent, reads and writes need extension fields that call the HTTP API with the isolated credentials.
- [Verify] Review list sorting, paging and rating statistics (`mapRatingStats`) in the catalog types.
- [Code] The "no email, no customer id" guarantee is currently tested by a key-list check. It would depend on the core schema's review type or an extension type that hides those fields.
- [Docs] Field visibility can hide fields from the public schema, but the docs warn against relying on it for confidentiality, and hidden fields still resolve through `@requires`.
- [Code] The 30-writes-per-hour limit is app-side. [Verify]

---

## Live experiment results (2026-11-17, project `spec-test-b2c-food`)

The sections above were written from the docs and the code. This section replaces every **[Verify]** item with what the live Experience API and the fetched core schema actually do. Where a result contradicts a statement above, this section wins.

**Method.** I fetched the core-subgraph SDL (`commercetools integration-layer schema fetch`, 5,684 lines, kept in `experiments/cil/core-schema.graphql`). Then I minted real sessions (anonymous, and a password sign-in as seeded demo customer Noah) and ran queries and mutations against `graphql.integration-layer.us-central1.gcp.commercetools.com`. Scripts are `experiments/cil/e01` to `e08`. For the extension gaps I ran a throwaway extension locally (`experiments/cil/ext/extensions/gap-probe`). **Nothing was pushed.** I added the commercetools API and auth hosts to the project's extension allowlist for the test, with your approval, and removed both afterwards (allowlist is empty again, no bundle stored). Test carts and one `reorder` call added lines to Noah's cart; the cart is test data.

### Verdicts after testing

| ID | Use case | Before | After | Evidence |
|---|---|---|---|---|
| A1 | Search, listing, facets | ❓ | 🟡 | **Works:** `search(first, after, filter: ProductFilter, sort: ProductSort, query, queryMode)` returned 79 products and 22 `facets { code label options { value label count } }`; `product(sku:)`, `categories`. **Not in the schema:** `ProductFilter` has only `categorySlug`, `onSale`, `priceMin`, `priceMax`, `attributes`, `attributeRanges`, so there is no brand, product-selection or availability field. `search` and `products` have no store or selection argument. |
| A2 | Cart | 🟡 | 🟡/🔴 | **Works:** `addCartLine(input: AddCartLineInput)`, `addCartLines(inputs)`, `applyDiscountCode`, `selectShippingMethod`, `shippingMethodsForCart`. **Not in the schema:** `AddCartLineInput` has only `sku`, `quantity`, `distributionChannelIdOverride`, so there is no `custom`, `supplyChannel` or `recurrenceInfo`. `UpdateCartLineCustomFieldsInput` has only `lineId`. No mutation sets `Cart.custom`, and `Cart.custom` is `OrderCustom`, a union with only `InstoreOrderTypeCustom`. **Behaviour:** `addCartLine` with `quantity: 5000` returned empty `userErrors`; `UserErrorCode.OUT_OF_STOCK` exists but was not returned. |
| A4 | Orders, reorder, returns | 🟡 | 🟡 | **Works:** `orders(first, filter, sort)` returned `OrderListItem` with `origin`, `orderState`, `shipmentState`, `paymentState`, `total`, `availableActions`; `order(id)` with `returns`, `deliveries`, `state { key name }`; `reorder(orderId)` returned `unavailable { sku reason }` and `cart`. |
| B1 | Auth and session | 🟡 | ✅/🟡 | **Works:** `POST /{project}/main/session` with `grant_type: "password"` returned `identity: "customer"` and kept the anonymous cart's lines; `me { id key firstName lastName email addresses }`. |
| B4 | Shopping lists | ✅ | ✅ | **Works:** `shoppingLists { id name lines { sku } }` returned the seeded "Saved items" list (3 SKUs). |
| C1 | Recurring orders | ❓/🔴 | 🟡 reads | **Not in the schema:** no `Query.recurringOrders` or `recurringOrder`, no `RecurringOrder` or `RecurrencePolicy` type, no recurrence input on `AddCartLineInput`. The only trace is the enum value `RECURRING_ORDER` on `Cart.origin` and `Order.origin`. **Works through an extension:** `Customer.probeRecurringOrderCount` (`@key(fields: "id")`, `@requires(fields: "_ctId")`) read `GET /recurring-orders` and returned 1 for Noah. |
| C2 | Stores, availability, collect | ❓/🔴 | 🟡 stores, 🔴 per-store stock | **Not in the schema:** no `Query.stores`, `channels` or `inventory`. `Store` has only `key`, `name`, `countries`, `languages` (no address, hours or coordinates). `Availability` has only `inStock` and `quantity` (no store or channel dimension). **Works through an extension:** `Query.probeStores` read `GET /channels` (role `InventorySupply`) and returned key, name, city and hours. |
| C3 | In-store scan | ❓ | 🟡 | **Works:** `product(sku: "NOPE")` returned `null`. **Not in the schema:** per-store quantity (`Availability` has only `inStock`, `quantity`). |
| C4 | Bundles, configurator | 🟡 | 🔴 as shipped | **Works (read):** `CartLine.custom` and `OrderLine.custom` are `LineItemCustom`, which includes `McfLineFulfilmentCustom { fulfilment brand parentId bundlePreset bundleMachineSku bundleDiscount bundleWasCents }`. **Not in the schema:** no `custom` (or `fields`) field on `AddCartLineInput` or `UpdateCartLineCustomFieldsInput`; `McfLineFulfilmentCustomInput` is defined but no field references it. |
| C5 | Market switching | 🟡 | 🟡 | **Works:** `PATCH /{project}/main/session` with `locale`, `currency`, `country`. **Behaviour:** `Query.cart` returned `null` on the CA/CAD session while the old US token still showed 2 lines. **Not in the schema:** no mutation or session option that carries lines from one currency's cart to another. |
| D1 | Reviews | ❓/🔴 | 🟡 reads | **Not in the schema:** no `Review` type, no `Query.reviews`, no `Product.reviews` or `Product.ratingStats`. Only `McfReviewCustom` (type for custom fields) exists. **Works through an extension:** `Product.probeReviewCount` (`@requires(fields: "_ctId")`) read `GET /reviews` and returned 12 for one product. |

### What the tests showed, by finding

1. **Search works and facets come for free.** `search` returned 79 products with 22 facets, each named by attribute code (`variants.attributes.roast`, `...intensity`, and so on). `ProductFilter` has category, sale, price range and attribute filters. `ProductSort` has relevance, price, name and newest. There is no brand filter and no availability filter. ([A1])
2. **Brand scoping needs Stores, and none are set up.** The docs say search covers "the Store's assortment". This project has one Store (`b2c-retail-store`) with no product selections attached. A session with no store and one scoped to it both return all 79 products, so Malva Coffee and Malva Drinks mix. [Inference, not tested] Two Stores, each with one brand's product selection, should scope the brands. Creating them changes the project, so I did not. ([A1])
3. **Availability is one number per variant, not per store.** Every `availability` field is `{ inStock, quantity }`. There is no store dimension and no `Inventory`, `Channel` or `Store` list type in the schema. The `Store` type only has key, name, countries and languages. ([C2], [C3])
4. **Line custom fields can be read but not written.** Reading works: `CartLine.custom` and `OrderLine.custom` are `LineItemCustom`, a union of `InstoreLineitemTypeCustom` and `McfLineFulfilmentCustom` (fulfilment, brand, parentId, bundle fields). Cart and order lines share that union. Writing does not work: `AddCartLineInput` has only `sku`, `quantity` and `distributionChannelIdOverride`, and `UpdateCartLineCustomFieldsInput` has only `lineId`. I tried `custom` (flat and wrapped in the type name), `customFields`, `fields` and `mcfLineFulfilment` on both inputs (`experiments/cil/e09-line-custom-write.mjs`). Each was rejected with "Field ... is not defined". The SDL defines `McfLineFulfilmentCustomInput` and `InstoreLineitemTypeCustomInput`, but no input field references them. This contradicts the docs: the `updateCartLineCustomFields` description says "The `custom` input has the same project-specific shape that `addCartLine` takes". I don't know why the field is missing; the project has no field-visibility rules (`field-visibility list` shows 0 rules), so it is not hidden on purpose. `supplyChannel` and `recurrenceInfo` are also rejected on `addCartLine`; `distributionChannelIdOverride` is a price channel, not a supply channel. So the app's per-line fulfilment, brand, store, bundle and modifier data cannot be written. ([A2], [C4], [C1])
5. **Cart-level custom fields are read-only and the app's type is missing.** `Cart.custom` and `Order.custom` are a union holding only `InstoreOrderTypeCustom`. There is no mutation that sets cart custom fields. Pickup person and delivery note have nowhere to go. ([A3])
6. **No stock cap.** `addCartLine` with quantity 5000 returned no error. `OUT_OF_STOCK` exists as an error code, but the add did not use it. The app's `quantity_exceeds_stock { available }` rule needs another home. ([A2])
7. **A line-item extension error loses its message.** The schema documents `LINE_ITEM_HOOK_FAILED`: the project's line item extension rejected the line, and "the message doesn't carry the extension's own error". A Managed API Extension can block a bad add, but the shopper only sees the generic code, not `available`. [Docs via SDL; I did not run a Managed API Extension.] ([A2], [C4])
8. **Market switch gives an empty cart in the new market.** `PATCH /session` to CA/CAD returned a session where `cart` is `null`. Going back to the old US token showed the 2-line cart again. Carts are separate per currency, so the app's `rebuildCart` carry-over and `droppedLines` report are still custom work. ([C5])
9. **`beginPayment` is not usable yet.** It returned `CHECKOUT_NOT_CONFIGURED` ("Payment is not available for this session") and `viewer.checkoutMode` is `null`. The docs say a checkout routing rule is required. Adding one changes the project, so I did not. Clone-cart payment (mixed bags) is untested. ([A3])
10. **Orders work.** Noah's three orders appear: two customer orders (`MC-WVR7ED2ER7`, `MC-WVR7ED2ER7-A`) and one with origin `RECURRING_ORDER`, which has no order number. Each shows `availableActions: [REORDER, CANCEL]`. `Order` carries `returns`, `deliveries`, `shipmentState`, `paymentState` and a workflow `state { key name }`; all were empty or null on these orders. The list type `OrderListItem` is light (no lines); lines are on `order(id)`. ([A4])
11. **`reorder` matches the app's behaviour.** It appended the order's lines to the current cart and returned `unavailable: [{ sku, reason }]` (empty here). `requestReturn` refuses an unknown order with `ORDER_NOT_FOUND`, and the schema says an order that has not shipped gets `RETURN_NOT_ALLOWED`. I did not write a return, so the return window and quantity rules are still unverified. ([A4])
12. **Sign-in and sessions behave as documented.** The password grant returned `identity: customer` and kept the anonymous cart. `expires_in` was 10,799 s (about 3 hours) for anonymous and 172,799 s (about 2 days) for a customer. A `register` mutation creates a customer without signing in; sign-in is the REST call. ([B1])
13. **Account gaps are real.** No `deleteAccount` mutation. No `Customer.paymentMethods`. `AddressBookInput` and `AddressInput` have name, line1, line2, city, state, region, postalCode, country but no phone, while `SavedAddress` can show phone. `paymentMethods` at the root returned `[]` and describes the project's accepted methods, not saved cards. `updateProfile` works. ([B2], [B3])
14. **Shopping lists work.** Noah's list of three SKUs reads through `shoppingLists`. ([B4])
15. **Recurring orders, reviews, stores and inventory are not in the schema.** `recurringOrders`, `reviews`, `ratingStats`, `stores`, `channels` and `inventory` are all unknown fields. The schema only mentions recurring orders as the origin of a cart or order. ([C1], [C2], [D1])
16. **An extension can fill the read gaps.** With client credentials in `ctx.config` and the hosts allowlisted, a local resolver returned the project's supply channels with city and opening-hours JSON (`probeStores`), 12 reviews for one product (`probeReviewCount`), and Noah's 1 recurring order (`probeRecurringOrderCount`). It composed with the live schema: `extend type Customer @key(fields: "id")` and `@requires(fields: "_ctId")` on the hidden `_ctId` field both worked. The resolver reached the commercetools hosts, so they are not on the read-only deny list. ([C1], [C2], [D1])
17. **Extensions cannot safely write for the shopper.** Anything that must act as the signed-in customer (pause or skip a recurring order, post or edit a review, delete the account, remove a saved card) would be a root `Mutation` field. Per the docs a resolver has no session or shopper identity, and a root resolver has no parent entity to read it from. A client-supplied id would be trusted blindly. In my local server the resolver context had extra request objects (`req`, `request`), which the deployed sandbox may not have, so I could not confirm this either way. [Inference] The safe pattern is read fields on `Customer` and `Product` entities, and writes stay in a server route. ([C1], [D1], [B2], [B3])
18. **Local tooling quirk.** The local federated gateway (`extension serve --gateway`) sent core queries to the auth host and got 404, with CLI 0.0.25 and integration-layer plugin 1.3.1. I tested the extension through its own subgraph endpoint instead.

### Still untested

- Brand scoping through two Stores with product selections (needs new Stores in the project).
- `beginPayment` with a routing rule, and paying a clone cart (needs a checkout rule, and a cart that is not the active one).
- `requestReturn` window and quantity rules, and `cancelOrder` (both write to order data that cannot be undone).
- A deployed Managed API Extension, and how its error reaches the shopper (needs a push, which replaces the project's one bundle).
- `extension` grant for the demo login, and rate limits on login and password change.
- Guest-order read after the hosted Checkout returns.

## Recommended next step

The write-side gaps decide the project: per-line custom data (finding 4), cart custom fields (5), and shopper-scoped writes from an extension (17). Ask the CIL team two questions before any migration work:

1. The docs say `addCartLine` and `updateCartLineCustomFields` take a project-specific `custom` input, but the live schema has no such field on either input, although the read side (`CartLine.custom`, `OrderLine.custom`) exists. Is that a bug, a missing setting, or not yet supported in this project?
2. Is there a supported way for an extension mutation to learn the signed-in customer, so shopper-scoped writes can live in an extension?

If both answers are no, the realistic shape is a hybrid: CIL for catalog search, shopping lists, orders, reorder, sign-in and profile, with the cart, checkout, recurring orders, reviews, saved cards and account deletion staying in the Next.js routes.

## Sources

- Code: `storefront/app/api/**`, `storefront/lib/ct/*`, `storefront/lib/session.ts`, `storefront/AGENTS.md`.
- CIL docs, https://docs.commercetools.com/commerce-integration-layer: `experience-api-overview`, `overview`, `hosts-and-authorization`, `development/get-started`, `development/checkout-integration`, `development/best-practices`, `development/writing-schema-extensions`, `development/writing-managed-api-extensions`, `development/extension-authentication`, `development/identity-providers`, `schema-extensions`, `managed-api-extensions`, `extension-types`, `graphql-federation`, `experience/*`.
- Not found in the docs: GA/beta status, supported regions, rate limits, caching, SLA and cart-specific numeric limits.
