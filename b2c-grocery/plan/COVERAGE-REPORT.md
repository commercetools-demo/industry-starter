# Coverage report (Z-01): every spec scenario to its test

Run on branch `ws/z1-coverage` (base: merge of `ws/w-subscriptions`). Every row was checked by opening the test, not only by its name. Test paths are relative to `site/`; the test name is quoted or abbreviated. **Status:** `Covered` (a unit test asserts it), `Covered (new)` (gap found, test written in this task), `Covered by manual test M-x-n` (needs real commercetools, the hosted checkout or visual fidelity; the owner's status of that row is in `TODO-MANUAL-TESTING.md`), `Not built` (knowingly dropped, see the section at the end).

Scope: the three changes `bootstrap-nextjs-storefront`, `malva-storefront-design`, `grocery-storefront-features` (179 scenarios; the task text said "about 180").

Z-02 (release verification summary) is not part of this report yet.

## Totals

| Result | Count |
| --- | --- |
| Covered by an existing unit test | 163 |
| Covered by a new unit test (gap closed in Z-01) | 10 |
| Covered by manual test (no unit test possible or sufficient) | 6 |
| Not built | 0 (one scenario only partly retired, see "Knowingly not built / deviations") |
| Missing features | 0 (findings and small fixes below) |

(163 + 10 + 6 = 179. Counted from the Status column, see the last section.)

## bootstrap-nextjs-storefront

### storefront-project-structure

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Scaffold complete | `test/structure.test.ts` "Scaffold complete: %s exists" (every directory of the spec); `npm run build` is a step of `verify` | Covered |
| Client importing server code | `eslint-rules.test.ts` "Client importing server code: a component importing @/lib/ct/cart errors", "a hook importing the session module errors" | Covered |
| SDK types in a component | `eslint-rules.test.ts` "SDK types in a component: importing @commercetools/platform-sdk errors", "app types from @/lib/types are fine in components" | Covered |
| Unknown product | `app/[locale]/p/[slug]/page.test.tsx` "unknown slug: calls notFound"; `app/[locale]/not-found.test.tsx` "Unknown product: has a locale-aware path back to the shop" | Covered |
| Redirect in try block | `eslint-rules.test.ts` "Redirect in try block: redirect() inside try with catch errors, outside is fine", "unstable_rethrow inside catch is fine" | Covered |
| Interactive control | `test/conventions.test.ts` "a file without "use client" never defines an inline event handler" (scans `app/` and `components/`) and the detector self-test | Covered (new) |

### storefront-data-loading

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Category page | `app/[locale]/shop/page.test.tsx` "A known category filters by its id..." (the page calls `searchProducts`/`getCategoryTree` directly; `lib/ct/search.test.ts` "uses products().search().post") | Covered |
| Cart in the header | `components/layout/BagButton.test.tsx` "Bag count..." and "Returning customer hydration" (reads the SWR cart); `app/[locale]/layout.test.tsx` "provider order: intl > SWR > Toast > Cart > chrome" | Covered |
| Page with category and tree | `app/[locale]/shop/page.test.tsx` "Parallel fetches: the category tree and the search both start before either resolves"; `lib/ct/listing.test.ts` "all searches start before any resolves" | Covered |
| Price display | `lib/utils.test.ts` "formats EUR for de-DE (NBSP normalised)"; `components/product/PriceBlock.test.tsx` "German locale: euro formatting with comma" | Covered |
| Cached function reads session | `lib/ct/no-session-in-cache.test.ts` "a file using unstable_cache does not import the session" (every file in `lib/ct`) and the detector self-test | Covered |
| Add to bag | `hooks/useCart.test.tsx` "Add mutation success: cache is updated from the response and nothing is refetched" | Covered |
| Mutation fails | `hooks/useCart.test.tsx` "Mutation fails: throws ApiError and the cache is unchanged"; `context/CartProvider.test.tsx` "Insufficient stock...", "Other failures: generic message" | Covered |
| Returning customer | `app/[locale]/layout.test.tsx` "Returning customer hydration: the server cart seeds the SWR fallback", "Signed-in session: the account fallback is seeded from the session fields"; `components/layout/AccountLink.test.tsx` "signed in: links to the dashboard and names the shopper" | Covered |
| Version conflict | `lib/ct/cart.test.ts` "Version conflict: refetches, retries once and returns the server cart", "second 409 throws (retries only once)"; `components/cart/CartView.test.tsx` "Increase quantity: PATCHes the line and shows the server totals" | Covered |
| Successful payment | `app/api/checkout/complete/route.test.ts` "Successful payment: remembers lastOrderId, drops cartId, confirms the booking"; `components/checkout/CheckoutFlow.test.tsx` "order-created message: completes on the server once, then opens the confirmation page"; `app/[locale]/checkout/confirmation/[orderId]/page.test.tsx` | Covered |
| Search call | `lib/ct/search.test.ts` "uses products().search().post, never productProjections()" | Covered |
| Over-ask | `app/api/cart/line-items/route.test.ts` "Over-ask: 409 INSUFFICIENT_STOCK with the available quantity, cart unchanged"; `app/api/cart/line-items/[lineId]/route.test.ts` "Ask for more than available: 409 with available, cart unchanged" | Covered |

### storefront-styling-foundation

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Build | `test/versions.test.ts` "No Tailwind v3 artifacts"; `app/globals.css.test.ts` "imports tailwind and the component classes"; `npm run build` in `verify` | Covered |
| Scaffold palette removed | `app/globals.css.test.ts` "Scaffold palette removed" | Covered |
| Network requests | `app/layout.test.tsx` "Network requests: no runtime Google fonts link"; M-C-1 (live, PASS) | Covered |
| Optimizer disabled | `next.config.test.ts` "Optimizer disabled", "allows storefront image hosts" | Covered |

### storefront-bff-and-session

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Client data flow | `hooks/useCart.test.tsx` "read default: no cart yields null" (SWR hook fetches `/api/cart`); `app/api/cart/route.test.ts` "returns the full mapped cart for an anonymous session" (route calls `lib/ct/cart`); `lib/ct/client.test.ts` | Covered |
| Unauthorized request | `lib/api/private-json.test.ts` "Unauthorized request: a private 401 with { error: "Unauthorized" }" (new title and body, see Findings); every account route test, e.g. `app/api/account/profile/route.test.ts` "Anonymous visitor: 401" | Covered (new) |
| Second builder | `eslint-rules.test.ts` "a second ClientBuilder import errors, lib/ct/client.ts may have it" | Covered |
| Secret in client bundle | `scripts/check-bundle-secrets.test.ts` "Secret in client bundle: a planted secret value fails"; `scripts/check-secrets.test.ts` rules a to d | Covered |
| Missing scopes | `lib/ct/checkout-session.test.ts` "token request fails: TOKEN_FAILED and no session call" covers the failure path only; the named-scope experience is manual: M-E-3 (DEFERRED by the owner) | Covered by manual test M-E-3 |
| Tampered cookie | `lib/session.test.ts` "Tampered cookie: a modified token yields an empty session", "an expired token yields an empty session" | Covered |
| Short secret in production | `lib/session.test.ts` "Short secret in production throws"; `lib/env.test.ts` "Short secret in production..." | Covered |
| Sign in with items in the bag | `app/api/auth/login/route.test.ts` "Sign in with items in the bag: passes the anonymous cart id and writes the merged cart id and identity"; `lib/ct/auth.test.ts` "uses login().post with merge mode and the anonymous cart" | Covered |
| Logout | `app/api/auth/session.test.ts` "Logout: clears the identity fields and the cart id"; `hooks/useAccount.test.tsx` "Logout: clears the account, cart, orders, addresses, wishlist, recurring and order caches" | Covered |
| Valid credentials | The health route was removed by plan in Y-02 (see deviations); its unit test went with it. Last run live: M-E-1 (PASS 2026-10-06). `scripts/check-release.test.ts` "Production build: fails while app/api/health exists" keeps it from coming back | Covered by manual test M-E-1 |
| No cart | `app/api/checkout/session/route.test.ts` "No cart (400): NO_CART and no session" | Covered |
| New cart | `lib/ct/cart-defaults.test.ts` "New cart: inventory None and platform tax"; `lib/ct/cart.test.ts` "anonymous cart has an anonymousId, inventory None..."; `app/api/cart/line-items/route.test.ts` "anonymous first add: creates the cart..." | Covered |

### storefront-locale-routing

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Add a market | `i18n/routing.test.ts` "Add a market: locales come from COUNTRY_CONFIG, default en-US, prefix always"; `messages/parity.test.ts`; `lib/utils.test.ts` "COUNTRY_CONFIG..." | Covered |
| Unsupported locale | `proxy.test.ts` "Unsupported locale: /xx-YY/page is treated as unprefixed and redirected under /en-US"; `app/[locale]/layout.test.tsx` "Unsupported locale: invalid locale calls notFound"; M-D-3 (live, PASS) | Covered |
| First visit | `proxy.test.ts` "First visit: / without cookie → 307 to /en-US" | Covered |
| Returning visitor | `proxy.test.ts` "Returning visitor: / with cookie de-DE → /de-DE" | Covered |
| Switch to Germany | `app/api/locale/route.test.ts` "Switch to Germany: updates all three fields together and removes cartId", "keeps cartId when the currency does not change" | Covered |
| Link preserves locale | `test/link.test.tsx` "Link preserves locale: renders the /de-DE prefix for de-DE"; `i18n/routing.test.ts` "Link preserves locale: getPathname adds the prefix"; `components/layout/Footer.test.tsx` "links are locale-aware" | Covered |

### storefront-delivery-quality

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Netlify build | `scripts/check-release.test.ts` "Netlify build config: base, command, publish and Node version" (`base = "site"`, so `openspec/` and `design/` are outside the build) | Covered |
| Failing typecheck | `test/conventions.test.ts` "npm run verify runs typecheck before the tests and the build" | Covered (new) |
| Missing variable | `lib/env.test.ts` "names the first missing variable", "Missing variable: CTP_CHECKOUT_APP_KEY is required"; `instrumentation.test.ts` "throws in production when a variable is missing" | Covered |
| Production build | `scripts/check-release.test.ts` "Production build: fails while app/api/health exists", "this repository (Y-02): passes the release check"; M-Y-2 (owner, TODO) | Covered |
| Unhandled server error | `app/[locale]/error.test.tsx` "Unhandled server error: shows generic text, never the raw error message", "Try again calls reset"; `app/global-error.test.tsx` | Covered |

### storefront-platform-stack

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Version check passes | `test/versions.test.ts` "Version check passes: Next.js 16 and next-intl 4" | Covered |
| Old framework rejected | `test/versions.test.ts` "Old framework rejected: no Next.js 15 range" | Covered |
| No Tailwind v3 artifacts | `test/versions.test.ts` "No Tailwind v3 artifacts" | Covered |
| SDK upgrade | A rule about a future change (typecheck, build and a smoke test in the same change). The pieces are `verify` (typecheck, build) and, for the live smoke test, M-E-2 and M-G-1 (the `/api/health` route no longer exists, see deviations) | Covered by manual test M-G-1 |
| Lockfile | A rule about commits. `scripts/check-lockfile.test.ts` "passes with only package-lock.json" plus `npm ci` in Z-02 prove the lock matches `package.json` | Covered by manual test M-A-1 |
| Wrong lockfile | `scripts/check-lockfile.test.ts` "Wrong lockfile: yarn.lock in site is rejected", "pnpm-lock.yaml in repo root is rejected", "missing package-lock.json is rejected" | Covered |
| Offline tests | `vitest.setup.ts` now replaces `fetch` with a function that throws; `test/offline.test.ts` "an unstubbed fetch fails at once instead of reaching the network". The whole suite (198 files, 1468 tests) passes with the guard | Covered (new) |

## malva-storefront-design

### plp-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Default listing | `app/[locale]/shop/page.test.tsx` "Default listing: heading "Everything", rail, toolbar count and the grid render" | Covered |
| Apply a filter | `components/product/FilterRail.test.tsx` "Apply a filter: selecting a band calls router.replace with price set and page removed" (`replace`, so no reload) | Covered |
| Clear all | `components/product/FilterRail.test.tsx` "Clear all resets to /shop"; `lib/listing-params.test.ts` "Defaults..." | Covered |
| Sort by price | `components/product/FilterRail.test.tsx` "Sort by price: selecting "Price ↑" updates the URL and keeps filters"; `lib/ct/search.test.ts` "sorts: relevance omits sort; newest; price asc and desc scoped to the market" | Covered |
| Save from the grid | `components/product/ProductTile.test.tsx` "Save from the grid: the heart toggles and the click does not navigate", "click on the heart does not bubble to the tile" | Covered |
| No results | `app/[locale]/shop/page.test.tsx` "No results: the empty state replaces the grid"; `components/product/Listing.test.tsx` "No results: heading, Clear filters and Contact us" | Covered |
| Back from product | Filters live in the URL (`lib/listing-params.test.ts` round trip); scroll restoration is the browser's: M-K-4 (PASS) | Covered by manual test M-K-4 |
| German price bands | `components/product/FilterRail.test.tsx` "German price bands: bands are shown in euros"; `lib/listing-view.test.ts` "German bands use the EUR configuration"; `lib/config/price-bands.test.ts` | Covered |
| Weighed product tile | `components/product/UnitPriceWiring.test.tsx` "Tile: 500 g bananas show the per-kg price; an Each item shows none" | Covered |

### pdp-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Scroll on desktop | `app/[locale]/p/[slug]/page.test.tsx` "Scroll on desktop (sticky): the buy box is sticky at desktop, in a 1.15fr/1fr grid" | Covered |
| Saving shown | `components/product/ProductTile.test.tsx` PriceBlock "Discount: the discounted price is current and the original is struck through"; `components/product/PriceBlock.test.tsx` "Discount: the unit line is based on the discounted amount" | Covered |
| Select an increment | `components/product/VariantSelectors.test.tsx` "choosing "1 kg" replaces the URL with ?sku= and does not scroll"; `app/[locale]/p/[slug]/page.test.tsx` "sku param selects that variant" | Covered |
| Unavailable option | `components/product/VariantSelectors.test.tsx` "a disabled option is not clickable"; `lib/config/variant-config.test.ts` "unavailable combination: the option is disabled" | Covered |
| Add three | `components/product/AddToBag.test.tsx` "Add three: the mutation is called once with quantity 3 and one toast appears" | Covered |
| Out of stock | `components/product/AddToBag.test.tsx` "Out of stock: the button is disabled with aria-disabled, the text says so, nothing is sent" | Covered |
| Out of stock variant | `components/product/BuyBoxParts.test.tsx` "Out of stock variant: says "Out of stock""; `app/[locale]/p/[slug]/page.test.tsx` "Out of stock variant: availability says so and add to bag is disabled" | Covered |
| Related click | `app/[locale]/p/[slug]/page.test.tsx` "Related click (qty reset): another product renders with quantity 1"; `components/product/RelatedAndReviews.test.tsx` "links to the other product pages" | Covered |
| Ask for more than available | `components/product/AddToBag.test.tsx` "Ask for more than available: units already in the bag count, nothing is sent and the limit is shown", "INSUFFICIENT_STOCK from the server" | Covered |

### checkout-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Ready cart | `components/cart/CartCheckout.test.tsx` "Ready cart: Checkout is enabled and opens /checkout"; `app/api/checkout/session/route.test.ts` "Ready cart: holds the slot for 15 minutes, then creates the session and returns the ids"; `app/[locale]/checkout/page.test.tsx` "renders the frame"; `components/checkout/CheckoutFlow.test.tsx` | Covered |
| Missing slot | `components/cart/CartCheckout.test.tsx` "Missing slot: Checkout is disabled and nothing is pushed"; `components/cart/CartSummary.test.tsx` "address but no slot: disabled, asks for a slot"; `app/api/checkout/session/route.test.ts` "Missing slot: 422 NO_SLOT without a hold" | Covered |
| Guest | App side: `app/[locale]/checkout/confirmation/[orderId]/page.test.tsx` "Guest: allowed through lastOrderId, no Track button..."; the session route needs no customer (`app/api/checkout/session/route.test.ts` runs without `customerId`). The hosted email step itself is Adyen/Checkout-owned: M-V-4 (BLOCKED by OA-05) | Covered |
| Empty session cart | `app/[locale]/checkout/page.test.tsx` "Empty session cart: no cart id redirects to the bag" | Covered |
| Slot filled | `app/api/checkout/session/route.test.ts` "Slot filled (handoff): clears the slot, answers 409 SLOT_FULL with fresh days, no session"; `components/cart/CartCheckout.test.tsx` error banner "SLOT_FULL" text "That delivery slot just filled..."; `components/checkout/CheckoutFlow.test.tsx` "session error SLOT_FULL: back to the bag with checkoutError" | Covered |
| Track order | `app/[locale]/checkout/confirmation/[orderId]/page.test.tsx` "Track order: the owner sees number, thank-you name, slot and the Track button", "Guest: ... no Track button" | Covered |
| Unknown order id | same file: "Unknown order id: not found", "Another customer's order: not found", "Anonymous visitor without lastOrderId: not found" | Covered |

### cart-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Desktop bag | `components/cart/CartView.test.tsx` "Desktop bag: heading, lines with price and stock tag, and the summary with server totals" and the new "Desktop bag (1440 px): lines and a sticky summary sit side by side in a 1.5fr / 1fr grid" | Covered (new) |
| Increase quantity | `components/cart/CartView.test.tsx` "Increase quantity: PATCHes the line and shows the server totals", "Increase quantity fails: reverts to the server quantity and shows the available stock" | Covered |
| Remove line | `components/cart/CartView.test.tsx` "Remove line: the line disappears and an undo toast is offered; Undo re-adds the sku and quantity" | Covered |
| Free delivery | `components/cart/CartView.test.tsx` "Free delivery: reads "Included""; `lib/mappers/cart.test.ts` "free shipping flag is set when the shipping price is 0"; `app/api/cart/address/route.test.ts` "free delivery follows the rate" (totals come from the server, so Included adds nothing) | Covered |
| Empty | `components/cart/CartView.test.tsx` "Empty: the last removed line shows the empty message and a browse link, and Checkout is gone", "Empty bag from the start (no cart)" | Covered |
| Out of stock line | `components/cart/CartView.test.tsx` "Out of stock line: inline notice, "Out of stock" tag and Checkout disabled with the reason"; `lib/cart-rules.test.ts` "out-of-stock line: blocked" | Covered |
| Move to bag | `components/account/SavedView.test.tsx` "Move to bag: a single in-stock variant is added to the bag" (toast comes from `CartProvider`: `context/CartProvider.test.tsx` "Add-to-bag toast...") | Covered |
| Incomplete delivery step | `components/cart/CartSummary.test.tsx` "no address: disabled, asks for an address", "address but no slot: disabled, asks for a slot"; `lib/cart-rules.test.ts` "no slot: blocked" | Covered |

### account-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Signed-in customer | `components/account/Account.test.tsx` "Signed-in customer: name as H1, kicker with the member-since year, both columns render"; `app/[locale]/account/(protected)/pages.test.tsx` "Signed-in customer: name, orders table and both cards render" | Covered |
| Anonymous visitor | `app/[locale]/account/(protected)/layout.test.tsx` "Anonymous visits orders: redirected to sign-in with the return path" | Covered |
| Status mapping | `components/account/Orders.test.tsx` OrderStatusTag `it.each` ('processing' gives `tag-accent`); `lib/mappers/order.test.ts` mapOrderStatus | Covered |
| No orders | `components/account/Orders.test.tsx` "No orders: "No orders yet" and a browse button" | Covered |
| Open addresses | `components/account/Account.test.tsx` "Open addresses: rows with their hrefs (locale prefixed)"; `app/[locale]/account/(protected)/addresses/page.test.tsx` | Covered |
| Edit address | `components/account/AddressBook.test.tsx` "Edit opens the dialog filled in and patches that address"; `components/ui/Dialog.test.tsx` "is a labelled modal..."; `components/ui/Field.test.tsx` "Input: label is associated with the control" | Covered |
| Shared cache | `app/api/account/private-responses.test.ts` (every `/api/account/*` route answers through `privateJson`); `lib/api/private-json.test.ts` "Shared cache: the response is private, no-store"; M-R-3 (PASS) | Covered |
| Another customer's order | `lib/ct/orders.test.ts` "Another customer's order: null"; `app/api/account/orders/route.test.ts` "Another customer's order: 404"; `hooks/useOrders.test.tsx` "Another customer's order: 404 sets notFound"; `components/account/OrderDetail.test.tsx` "Another customer's order: not-found UI with a link back, no order data" | Covered |

### homepage-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Editorial hero default | `app/[locale]/page.test.tsx` "Editorial hero default: every section renders with real data"; `lib/config/site.test.ts` "Editorial hero default: nothing set gives editorial with the contact strip on"; `components/home/Hero.test.tsx` | Covered |
| Magazine grid | `app/[locale]/page.test.tsx` "Magazine grid: HOME_LAYOUT=grid swaps only the hero"; `components/home/Hero.test.tsx` "Variant switch: exactly one hero renders and the other is absent" | Covered |
| Category click | `components/home/CategoryShowcase.test.tsx` "Category click: six cards, each linking to the filtered listing" | Covered |
| Product tile click | `components/home/NewIn.test.tsx` "Product tile click: four tiles, each linking to its product page" | Covered |
| Contact strip off | `app/[locale]/page.test.tsx` "Contact strip off: absent from the DOM"; `lib/config/site.test.ts` "contact strip off for false, 0 and off" | Covered |
| Anonymous visitor | `app/[locale]/page.test.tsx` "Anonymous visitor: shared content only, no cart, session or customer reads"; `components/layout/AccountLink.test.tsx` "anonymous: "Sign in" icon button linking to the sign-in page" | Covered |

### storefront-design-system

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Token used for color | `scripts/check-tokens.test.ts` "flags a hex colour in a component" (`check:tokens` is part of `verify`); `app/organic-components.css.test.ts` "uses no hex colours (tokens only)" | Covered |
| Accent as body text | `test/design-rules.test.ts` "the base accent is only about 3:1 on the ground and the 700 step passes 4.5:1", "component and global CSS never set a text colour to the base accent", "only the filled heart icon uses the base accent as a text colour in components" | Covered (new) |
| Product photo | `components/ui/Photo.test.tsx` "Product photo: wrapper is washed and rounded, image fills it"; `app/organic-components.css.test.ts` ".washed" class | Covered |
| Keyboard focus | `app/organic-components.css.test.ts` "keeps the focus ring and selection rules in globals" (`:focus-visible { outline: 2px solid var(--color-accent)`, offset 2 px); M-C-2, M-H-4 (PASS) | Covered |
| Disabled control | `components/ui/primitives.test.tsx` "Disabled control: has the disabled attribute and ignores clicks"; `test/design-rules.test.ts` "disabled controls render at 45% opacity" | Covered (new) |
| Product tile | `components/product/ProductTile.test.tsx` "shows image, name and price on one row, brand, and links to the product"; `test/design-rules.test.ts` ".lift raises the element by 4 px on hover" | Covered (new) |
| Bag count | `components/layout/BagButton.test.tsx` "Bag count: empty bag reads "Bag"", "two distinct lines read "Bag · 2"" | Covered |
| Add-to-bag toast | `components/ui/Toast.test.tsx` "Add-to-bag toast: auto-dismisses after exactly 2800 ms"; `context/CartProvider.test.tsx` "Add-to-bag toast: shows "Added to your bag" with a "View bag" link" | Covered |
| Reduced motion | `app/organic-components.css.test.ts` "Reduced motion: the media block covers .lift, .page-enter and the keyframe animations" | Covered |
| Tablet filters | `components/product/FiltersSheet.test.tsx` "Tablet filters: the button opens a dialog containing the filters"; `app/[locale]/shop/page.test.tsx` "Tablet filters (1000 px): the rail only shows from the desktop breakpoint (1200 px)..." | Covered (new) |

## grocery-storefront-features

### subscription-experience

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Subscribe | `app/api/cart/line-items/route.test.ts` "Subscribe: an eligible product with a valid key adds the line with that policy"; `lib/ct/cart.test.ts` "addLineItem with a recurrence policy key adds Dynamic recurrence info"; `components/product/RecurrenceSelector.test.tsx` "Subscribe: the selected cadence is sent with the add request"; `components/cart/RecurrenceBadge.test.tsx` "Subscribe: the cart line shows "Repeats every 2 weeks"..." | Covered |
| Ineligible product | `components/product/RecurrenceSelector.test.tsx` "Ineligible product: no selector is shown"; `app/[locale]/p/[slug]/page.test.tsx` "ineligible product: no selector and policies are not even read"; route "Ineligible product: 400 NOT_RECURRING_ELIGIBLE" | Covered |
| Notice shown | `components/product/RecurrenceSelector.test.tsx` "Notice shown: choosing a cadence shows the price notice, going back to one-time hides it"; `components/cart/RecurrenceBadge.test.tsx` (notice in the cart line) | Covered |
| Active recurring order | `components/account/Subscriptions.test.tsx` "Active recurring order: items, cadence, state and the next order date"; `lib/mappers/recurring-order.test.ts` | Covered |
| Change cadence | `components/account/Subscriptions.test.tsx` "Change cadence: the dialog saves on the same recurring order, the card shows the new schedule and next date"; `lib/ct/recurring-orders.test.ts` "Change cadence: setSchedule..."; `app/api/account/recurring/[id]/route.test.ts` | Covered |
| Cancel | `components/account/Subscriptions.test.tsx` "Cancel: the confirmation states the last order date; confirming cancels and removes the actions"; `lib/ct/recurring-orders.test.ts` "Cancel: setRecurringOrderState canceled; the summary carries the last order date" | Covered |
| Spike fails | `lib/config/features.test.ts` "Spike fails (flag off): only the string "false" switches subscriptions off"; page, route and selector flag-off tests; the owner question is Q-W-1..3 in `QUESTIONS.md` | Covered |

### weight-pricing-experience

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| 500 g pack | `lib/pricing.test.ts` "500 g pack: per-kg price"; `components/product/PriceBlock.test.tsx` "500 g pack: shows the per-kg price under the price"; `components/product/UnitPriceWiring.test.tsx` "Tile: 500 g bananas..." | Covered |
| Each item | `components/product/PriceBlock.test.tsx` "Each item: no unit line"; `lib/pricing.test.ts` "Each item: null" | Covered |
| Pick an increment | `components/product/VariantSelectors.test.tsx`; `components/product/UnitPriceWiring.test.tsx` "PDP BuyBox: the unit price sits with the price"; `app/[locale]/p/[slug]/page.test.tsx` "sku param selects that variant" | Covered |
| Approximate line present | `components/cart/ProvisionalNotice.test.tsx` "Approximate line present: "Total (provisional)" and the note"; `lib/mappers/cart.test.ts` "is provisional when any line is an approximate weight" | Covered |
| Exact lines only | `components/cart/ProvisionalNotice.test.tsx` "Exact lines only: plain "Total" and no note" | Covered |
| Final amount recorded | `components/cart/FinalAmount.test.tsx` "Final amount recorded higher: shows the amount and a positive difference"; `components/account/OrderDetail.test.tsx` "Final amount recorded: shows the final amount and the difference"; `lib/mappers/order.test.ts` "Slot and final total come from the custom fields" | Covered |

### address-book-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Default marked | `components/account/AddressBook.test.tsx` "Default marked: only the default shipping card shows the Default tag..."; `lib/mappers/address.test.ts` "Default marked" | Covered |
| Save address | `components/account/AddressBook.test.tsx` "Save address: valid data is posted and the list shows it; the dialog closes"; `hooks/useAddresses.test.tsx` "Save address: the list in the cache is the server answer" | Covered |
| Invalid postcode | `components/account/AddressBook.test.tsx` "Invalid postcode: inline error and nothing is saved"; `lib/address-validation.test.ts` "Invalid postcode: US accepts 5 digits and ZIP+4...", "DE accepts exactly 5 digits"; `app/api/account/addresses/route.test.ts` "Invalid postcode: 400 with field keys and nothing is saved" | Covered |
| Delete default | `components/account/AddressBook.test.tsx` "Delete default: the card goes and no address is marked default"; `lib/ct/addresses.test.ts` "Delete default: the answer has no default flag" | Covered |
| Pick saved address | `components/cart/DeliveryAddress.test.tsx` "Pick saved address: the default is preselected and applied to the cart" | Covered |

### saved-lists-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Anonymous heart click | `hooks/useSaved.test.tsx` "Anonymous heart click: remembers the product and opens sign-in with redirect (incl. save) and save"; `components/product/PendingSaveRunner.test.tsx` "Anonymous heart click, after sign-in: adds the product once..." | Covered |
| Toggle | `hooks/useSaved.test.tsx` "Toggle: a filled heart removes the product (DELETE)" | Covered |
| Empty list | `components/account/SavedView.test.tsx` "Empty list: the empty message and a browse button, no count" | Covered |
| Out of stock saved item | `components/account/SavedView.test.tsx` "Out of stock saved item: the button is disabled and labelled "Out of stock"" | Covered |
| Cached page | `hooks/useSaved.test.tsx` "Cached page: the heart state comes from the wishlist fetch, not from props" | Covered |

### substitution-experience

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Change preference | `components/cart/SubstitutionControl.test.tsx` "Change preference: shows the new choice at once and sends it"; `app/api/cart/line-items/[lineId]/substitution/route.test.ts` "Change preference: writes the preference..."; `lib/mappers/cart.test.ts` (read back after reload) | Covered |
| Preference on order | `components/account/OrderDetail.test.tsx` "lines table: ... and the preference text"; `lib/mappers/order.test.ts` "maps lines, totals, status and ownership fields" | Covered |
| Proposal exists | `components/account/OrderSubstitutions.test.tsx` "Proposal exists: notice with original, substitute, price difference, new total and both actions"; `lib/ct/order-edits.test.ts` "Proposal exists: pending proposal with names, price difference and new total from the preview" | Covered |
| Accept | `components/account/OrderSubstitutions.test.tsx` "Accept: posts to the accept endpoint, then refetches the order"; `lib/ct/order-edits-actions.test.ts` "Accept: applies with the edit version and the order version, then marks it applied"; `app/api/account/proposals/proposals-routes.test.ts` "Accept: applies for the session customer" | Covered |
| Stale version | `lib/ct/order-edits-actions.test.ts` "Stale version: a 409 from apply becomes ProposalConflictError"; `app/api/account/proposals/proposals-routes.test.ts` "Stale version: 409 STALE"; `components/account/OrderSubstitutions.test.tsx` "Stale version: explains, refetches and shows the current state" | Covered |
| Decline | `lib/ct/order-edits-actions.test.ts` "Decline: sets status declined and does NOT apply the edit"; `components/account/OrderSubstitutions.test.tsx` "Decline: the notice goes and the line shows "Removal requested"" | Covered |
| Order already shipped | `lib/ct/order-edits.test.ts` "Order already shipped: proposal is read-only"; `lib/ct/order-edits-actions.test.ts` "Order already shipped: NotEditable"; `components/account/OrderSubstitutions.test.tsx` "Order already shipped: read-only text and a contact link, no Accept or Decline"; route "Order already shipped: 422 NOT_EDITABLE" | Covered |

### catalog-data-model

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Existing matching resource | `scripts/seed/lib.test.ts` "Existing matching resource: reports ok and does not create" | Covered |
| Differing resource | `scripts/seed/lib.test.ts` "Differing resource: returns the difference and does not create", "Differing resource: stops at the first diff and runs nothing after it" | Covered |
| Weighed product | `scripts/seed/data.test.ts` "Weighed product: ≥8 weighed, each increment is a variant with a non-each unit"; "product type (F-06): has the specified attributes and types" | Covered |
| Fixed item | `scripts/seed/data.test.ts` "Fixed item: one variant, each, 1, not approximate" | Covered |
| Listing by category | `lib/ct/categories.test.ts` "finds a category by the slug of the locale", "slug of another locale or unknown: null" | Covered |
| German visitor | `scripts/seed/data.test.ts` "German visitor: every variant has USD/US and EUR/DE prices"; `lib/ct/search.test.ts` "price context: projection parameters carry currency and country"; M-F-2 (PASS) | Covered |
| Out of stock variant | `scripts/seed/data.test.ts` "Out of stock variant: quantity 0 for OOS products, 50 otherwise"; `components/product/AddToBag.test.tsx` "Out of stock..." and `app/api/cart/line-items/route.test.ts` "out of stock (no inventory): 409 with available 0" (the storefront refuses) | Covered |
| Cart with slot | `lib/ct/cart-delivery.test.ts` "sets the custom type once when the cart has none, then writes the four fields"; `lib/mappers/cart.test.ts` "maps the delivery slot from the cart-delivery custom fields" | Covered |
| Shipping methods for a cart | `scripts/seed/data.test.ts` "standard method: US $5.00 free above $50, DE €4.90 free above €45"; `lib/ct/cart-delivery.test.ts` "ensureShippingMethod: picks the key `standard`..."; the zone filtering itself is commercetools': M-F-1 (PASS) | Covered by manual test M-F-1 |
| Policy lookup | `scripts/seed/data.test.ts` "Policy lookup: three keys with schedules and both locales"; `lib/ct/recurrence-policies.test.ts` "Policies localized: names follow the locale and the order is weekly, every 2 weeks, monthly" | Covered |
| Listing page size | `scripts/seed/data.test.ts` "36 products, 6 per category (enough for two pages at 24)"; `lib/ct/search.test.ts` "pagination: page 2 starts at offset 24" | Covered |
| Indexing off | `scripts/seed/verify.test.ts` "Indexing off: the check fails and tells the owner to activate it (OA-04)", "missing searchIndexing settings fail the same way", "Indexing on: the check passes" | Covered (new) |

### delivery-slot-experience

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Full slot hidden | `lib/slots/stub-service.test.ts` "Full slot hidden: a window with no capacity is not listed"; `lib/slots/days.test.ts` "a day without capacity is listed with no slots" | Covered |
| Hold expires | `lib/slots/stub-service.test.ts` "Hold expires: capacity returns after 15 minutes" | Covered |
| Pick a slot | `app/api/cart/slot/route.test.ts` "Pick a slot: holds it for 15 minutes and writes the fields, returns the cart"; `components/cart/CartDeliveryStep.test.tsx` "Pick a slot: calls the endpoint and the card is selected"; `components/cart/CartSummary.test.tsx` "shows the delivery price from the shipping method and the chosen slot under it" | Covered |
| No capacity | `app/api/cart/slot/route.test.ts` "No capacity: 409 SLOT_FULL with fresh days, nothing written"; `components/cart/CartDeliveryStep.test.tsx` "No capacity: shows the message and the next available date"; `lib/slots/days.test.ts` "nextAvailableDate only when no slot has capacity" | Covered |
| New address outside area | `app/api/cart/address/route.test.ts` "undeliverable postcode: 422 UNDELIVERABLE, no shipping method, slot released and cleared"; `components/cart/CartDeliveryStep.test.tsx` "Slot cleared notice: an undeliverable postcode shows the error, the notice and hides the picker" | Covered |
| Slot filled before handoff | `app/api/checkout/session/route.test.ts` "Slot filled (handoff): clears the slot, answers 409 SLOT_FULL with fresh days, no session"; `components/cart/CartDeliveryStep.test.tsx` "Slot taken meanwhile: the list refreshes from the 409 answer and a message is shown"; M-V-5 (live, TODO) | Covered |
| Confirmation | `app/api/checkout/complete/route.test.ts` "Slot confirmation: a failing booking is tolerated and logged", "Successful payment: ... confirms the booking with the cart id"; `lib/slots/stub-service.test.ts` "confirmBooking: converts the hold into a booking"; confirmation page "Track order: ... slot" | Covered |
| Order with slot | `components/account/OrderDetail.test.tsx` "heading, date, status tag and slot"; `lib/mappers/order.test.ts` "Slot and final total come from the custom fields" | Covered |
| Below the threshold | `components/cart/CartSummary.test.tsx` "shows the delivery price from the shipping method and the chosen slot under it"; `app/api/cart/address/route.test.ts` "valid address: sets the address and the standard shipping method, returns the cart with the shipping line" | Covered |
| Above the threshold | `components/cart/CartSummary.test.tsx` "free delivery reads "Included""; `lib/mappers/cart.test.ts` "free shipping flag is set when the shipping price is 0" | Covered |

### search-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Empty search | `app/[locale]/search/page.test.tsx` "Empty search: heading, input and suggestion tags are shown and no search is made" | Covered |
| Matching query | `app/[locale]/search/page.test.tsx` "Matching query / Shared link: the count line, the grid and no suggestions", "de-DE: German copy, German suggestions and the EUR market"; `lib/ct/search.test.ts` "text: fullText and substring wildcard..." | Covered |
| No match | `app/[locale]/search/page.test.tsx` "No match: a message with a link to the shop" | Covered |
| Shared link | `app/[locale]/search/page.test.tsx` "Matching query / Shared link" (the server reads `q`) | Covered |

### auth-pages-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| Wrong password | `components/auth/SignInForm.test.tsx` "Wrong password: shows the generic message "Email or password is incorrect""; `app/api/auth/login/route.test.ts` "Wrong password and unknown email return the identical 401 body" | Covered |
| Return after sign-in | `components/auth/SignInForm.test.tsx` "Return after sign-in: ?redirect=/en-US/saved is honored"; `lib/safe-redirect.test.ts`; merge: `app/api/auth/login/route.test.ts` "Sign in with items in the bag..." | Covered |
| Register | `app/api/auth/register/route.test.ts` "Register: the customer is created (verified inside signUp), signed in with the anonymous cart merged"; `lib/ct/auth.test.ts` "creates the customer, then the email token, then confirms it, in order"; `components/auth/RegisterForm.test.tsx` | Covered |
| Duplicate email | `app/api/auth/register/route.test.ts` "Duplicate email: 409 ACCOUNT_EXISTS and nobody is signed in"; `components/auth/RegisterForm.test.tsx` "Duplicate email: says the account cannot be created and offers sign-in" | Covered |
| Unknown email | `app/api/auth/forgot-password/route.test.ts` "Unknown email: the same { ok: true } as a known email"; `components/auth/ForgotPasswordForm.test.tsx` "Unknown email: the same confirmation appears for any email" | Covered |
| Dev stub | `app/api/auth/forgot-password/route.test.ts` "Dev stub: in development the link is stored for the stub page", "in production nothing is stored or logged"; `app/[locale]/account/dev/reset-link/page.test.tsx` "outside development it is a 404" | Covered |
| Anonymous visits orders | `app/[locale]/account/(protected)/layout.test.tsx` "Anonymous visits orders: redirected to sign-in with the return path" | Covered |
| Validation error | `components/auth/SignInForm.test.tsx` "Validation error: empty fields show messages tied to the inputs with aria-describedby"; `components/auth/RegisterForm.test.tsx`, `ResetPasswordForm.test.tsx`; `components/ui/Field.test.tsx` "Input: error sets aria-invalid, aria-describedby points to the visible error text" | Covered |

### static-pages-design

| Scenario | Test file(s) and test name(s) | Status |
| --- | --- | --- |
| German About page | `app/[locale]/static-pages.test.tsx` "German About page: German title and content" | Covered |
| Toggle answer | `components/content/FaqList.test.tsx` "Toggle answer: aria-expanded becomes true and the answer shows" | Covered |
| Valid submit | `components/contact/ContactForm.test.tsx` "Valid submit: posts and shows the confirmation saying the message was received"; `app/api/contact/route.test.ts` "Valid submit: ok and the log has topic and length only (no PII)" | Covered |
| Invalid email | `components/contact/ContactForm.test.tsx` "Invalid email: inline error and nothing submitted"; `app/api/contact/route.test.ts` "Invalid email: 400 with the field error, nothing logged" | Covered |
| No reviews | `components/product/RelatedAndReviews.test.tsx` "No reviews (omitted): returns nothing, no heading and no gap"; `app/[locale]/p/[slug]/page.test.tsx` "No reviews (omitted): no reviews heading" | Covered |
| Contact strip | `app/[locale]/page.test.tsx` ContactStrip "heading, copy and a primary button to the contact page" (locale-aware `Button` link; `test/link.test.tsx`); `components/product/BuyBoxParts.test.tsx` ContactStrip "links to /contact" | Covered |

## Knowingly not built / deviations

None of the 179 scenarios is a casualty of D-044 (payment methods page), D-045 (no page builder) or D-046 (no slot price): the specs carry no scenario for them. D-046 is visible in "Below the threshold", which uses the shipping method rate, and is covered above.

| Item | Decision / source | Effect on scenarios |
| --- | --- | --- |
| `GET /api/health` is deleted (Y-02) | Planned in workstream E ("Dev only; deleted in Y") and Y-02; enforced by `check:release` | "Valid credentials" is covered by the earlier live run M-E-1 and its unit test is gone with the route; "SDK upgrade" loses its automatic smoke test. M-E-1 in `TODO-MANUAL-TESTING.md` still tells the tester to curl `/api/health` and can no longer be run (owner or orchestrator: mark it `PASS (route removed in Y-02)`). Suggestion: a decision row for the removal |
| D-042: the hosted Checkout creates the order, so the app cannot reject at order placement | `DECISIONS.md` D-042 | "Slot filled before handoff" is implemented at the hand-off (session route), not at order placement |
| Hosted checkout payment step | OA-05 reopened (`paymentMethods: []`) | M-V-3, M-V-4, M-V-6, M-V-7 are BLOCKED; unit tests cover the app side only |

## Missing features

None. Every scenario describes behavior that exists in the code or is covered by a decision. Smaller discrepancies found and fixed in this task:

1. **401 body**: spec says `{ "error": "Unauthorized" }`; `unauthenticated()` returned `{ error: 'UNAUTHENTICATED' }`. Changed to the spec text (nothing read the old code); tests updated.
2. **Accent as body text**: 14 to 15 px nav, footer, breadcrumb, account-rail and order-link text used the base accent on hover or when current, and the CSS classes `a`, `.btn-ghost`, `.card-kicker` (10 px), `.tag-outline`, `.nav a:hover` set `color: var(--color-accent)`. All now use `--color-accent-700`; only the filled heart icon keeps the base accent. `test/design-rules.test.ts` guards it. Visual impact: slightly darker link and kicker text, as the design system requires.

## Gaps closed in Z-01

| Scenario | New test |
| --- | --- |
| Interactive control, Failing typecheck | `test/conventions.test.ts` |
| Accent as body text, Disabled control, Product tile (lift) | `test/design-rules.test.ts` |
| Tablet filters (1000 px layout) | `app/[locale]/shop/page.test.tsx` |
| Desktop bag (sticky summary) | `components/cart/CartView.test.tsx` |
| Indexing off | `scripts/seed/verify.test.ts` |
| Offline tests | `vitest.setup.ts` (fetch guard) and `test/offline.test.ts` |
| Unauthorized request | `lib/api/private-json.test.ts` (new body) |

## How the totals were counted

`grep -c` over the Status column of this file:

```
Covered by manual test   : grep -c '| Covered by manual test M' plan/COVERAGE-REPORT.md
Covered (new)            : grep -c '| Covered (new) |' plan/COVERAGE-REPORT.md
Covered                  : grep -c '| Covered |' plan/COVERAGE-REPORT.md
```
