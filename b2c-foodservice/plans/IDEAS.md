<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Ideas (parked, not scheduled)

- Search suggestions and typo tolerance (Q-023).
- Recipes and brew guides content linked from products.
- Capsule recycling programme page and returns labels.
- Machine and capsule "starter bundles" as one product.
- Store pages with local events and live opening hours.
- Gift cards.
- French for the Canada market (`fr-CA`); provincial tax (HST/PST) for Canada (D-030, D-036).
- Transactional email (order confirmation, password reset, email verification, subscription reminders) once an email provider is chosen (D-032).
- Review moderation (D-037 removed it).
- Collection in Canada once Canadian stores exist (D-035).
- Replace `vite-tsconfig-paths` with Vite's native `resolve.tsconfigPaths` (vitest prints a deprecation hint); needs the spec's package list updated first (workstream A).
- `app/[locale]` routes are dynamic because the root layout reads the locale from request headers; static rendering would need `setRequestLocale` in a root-level layout (performance, workstream O/Q).
- (E) Replace the local rating rounding in `components/ui/Rating.tsx` with `roundRating` from `lib/utils.ts` once workstream D is merged.
- (E) Vitest globals are off, so Testing Library cleanup is registered in `test/setup.ts`; keep it if A's setup changes.
- (E) Give `ColorSwatch` a documented list of colour keys once the seed `COLOURS` enum is final (an unknown key falls back by CSS `var()` today).
- (F) Remove `app/[locale]/dev/store-picker` (dev harness) and `storefront/scripts/mock-ct-server.mjs` in workstream Q; the mock server is only a local aid for browser checks without credentials.
- (F) Footer links to /contact, /faq, /policies/*, /about, /journal and /account/orders go to `/` until P and J land; then add the paths to `BUILT_ROUTES` in `lib/nav/footer-config.ts`.
- (F) Pull the search icon pill input and suggestions into G once the search page exists; add axe-core to devDependencies (Q-F-13).
- (J) When workstream I lands: replace `AuthCart` with its `CartView`, mutate `KEY_CART` in `useAuthActions`, and add a real guest-bag browser check (B6) instead of the `/api/dev/session` simulation.
- (J) Rate limiter is per instance (`lib/rate-limit.ts`); move to a shared store when hosting runs several instances (Q-J-12, OA-05).
- (J) `scripts/mock-ct-server.mjs` now answers `POST /login`, `POST /customers`, `GET /customers/:id` (six demo customers, password `MOCK_DEMO_PASSWORD`, default `mock-demo-pass-1`); remove with the rest of the mock in Q.
- (P) Product and category entries in `sitemap.ts`; one shared rate limiter for J and P; the browser tool needs the repo path allowed so evidence screenshots can be saved

- (G) A `narrow` width option on the `Drawer` atom (min(360px, 90vw)) for the filter sheet (Q-G-19).
- (G) Cache the catalogue half of cards by `[locale, ids]` once performance work (Q) shows the id-first read is the cost (Q-G-10).
- (G) Search suggestions and a real "did you mean" need an external engine; the page only states that typo-tolerant matching is on (Q-G-08).
- (G) Add `axe-core` to devDependencies (used by every component test, Q-F-13) and zod if the lead wants schema validation in route handlers.
- (G) `storefront/scripts/mock-ct-server.mjs` now serves the seed catalogue and a Product Search engine; remove it with the dev harness in workstream Q. Re-generate `scripts/mock-fixtures/seed-fixtures.json` with `npx vitest run --config scripts/mock-fixtures/vitest.gen.config.mts` when `seed/src/data` changes.
- (G) A featuredRank number attribute in the seed would make "Featured" mean something (Q-G-04).
- (G) The prototype's hover shadow is on the image only; keyboard focus-within gets it too here.
- (O) FIX-1 horizontal overflow: the header row (wordmark, five links, store pill, locale pill, three icons) was wider than the viewport at 820-1100 px (store pill with a 230 px store name, locale text) and at 375 px (177 px wordmark). Fixed in the shell: store and locale pills are icon-only below 1100 px, primary links tighten, the wordmark shrinks at 1100, 420, 380 and 360 px, the store pill hides below 420 px and the locale pill below 380 px (both stay in the mobile menu). Revisit if the owner wants them in the header on small phones (needs a two-row header). Also fixed scripts/mock-ct-server.mjs, which did not start on develop (duplicate readBody after a merge).
- (O) Lighthouse desktop flags `label-content-name-mismatch` on the header store pill and locale pill (aria-label does not contain the visible text, for example "Collect at Malva Coffee Williamsburg" versus "Collection store: ..."). F owns it; fix by starting the aria-label with the visible text.
- (O) Hero, tile and editorial images are placeholders (SO-02). With real tile images check that white labels keep 4.5:1 over the gradient (Q).

- (H) Variant-level price tier support is in `effectiveUnitPrice` but no tier table is rendered (B2C); a market with tiers only needs a small table component.
- (H) The bundle 'with milk frother' of the spec is not in the seed `bundle` enum (Q-H-06): seed request for a third value, then it appears with no code change.
- (H) `tagline` text attribute on products (Q-H-19) and a sibling-system link by product key would let a pod page offer 'also for Vertuo' directly.
- (H) Mock server gained placeholder images from placehold.co (MOCK_IMAGES=0 to turn off); it also had a duplicate `readBody` that stopped it starting on develop, fixed.
- (M) Review helpful votes, photos and replies are out of scope. The rate limiter is per instance (Q-J-12); a shared store is needed on multi-instance hosting. A subscription on review created/deleted could revalidate product pages if H starts caching product reads.

- (I) Mock server now has a small cart engine plus POST /__mock/price and /__mock/stock hooks; a future K could reuse its reprice() for checkout totals.
- (I) Cart notice copy could show the previous price ("was $10.00") once priceWas exists; the notice already carries `previous`.
- (K) Order lines could show the variant summary on the confirmation if the cart saved the attributes on the line (Q-I-7) or the confirmation read the products.
- (K) `complete-per-group` could attach the second order to the first one with an order custom field instead of the shared number prefix.
- (K) The Checkout Browser SDK exposes `checkoutFlow({ shipping: { getShippingMethods, onShippingMethodSelected } })` (external shipping methods) and `forms` customisation; worth testing in S13/S14 as a route to a single hosted payment for collect plus delivery.

- (K, L) Reconciliation decisions (`ws/kl-reconcile`): the one order model is K's `OrderView` (confirmation, account list, account detail). The account order detail is fetched by id through `GET /api/orders/[id]` (K's handler: guest orders by id, member orders for the owning session only); the page `/account/orders/[orderNumber]` still looks the order up by number on the server with the ownership check. `deliveries` moved out of `ship` to the top level so multiple-shipping orders keep their parcels. The order list now maps full views (lines, totals, collect stores), which is more than a card needs; a slim projection or a `fields` parameter would help if histories grow. The detail shows Shipping when the order has a ship block and Tax when it is above zero (the old detail showed them whenever the order had shipping or tax data). Polling stops for a collect order with no state (K's rule); `loadAccountOrder` sets the `ordered` state first like the confirmation does. Test builders: `orderView` in `test/checkout.ts` (view shape) and `ctOrder` in `test/orders.ts` (commercetools shape) are the two kept; `ctLine` exists in `test/cart.ts` and `test/orders.ts` with different signatures and could be merged later.
- (N) Use `where=originOrder(id=:id)` (documented) for the pending check instead of comparing ids in memory, once a live run shows the predicate works with the storefront client.
- (N) `requestOrderNow` (documented update action) could back an "Order now" button on a subscription card.
- (N) A seeded demo subscription per customer (Q-N-16 / SR-N1) would let the tab be shown without a checkout; the mock already has `POST /__mock/recurring/seed`.
- (N) Localise the variant label of a subscription card ("50 capsules", "250 g") through the message catalogues; it is English text built in `lib/mappers/recurring-order.ts` (both markets are English today).
- (Q) Replace `'unsafe-inline'` in the CSP `script-src` with a per-request nonce set in `proxy.ts` (needs dynamic rendering of every page); narrow `https://*.commercetools.com` to the real Checkout hosts after M-Q-08.
- (Q) Product structured data (JSON-LD `Product` with price, availability and rating) on product pages and `BreadcrumbList` on listings; both use `components/content/JsonLd.tsx`.
- (Q) The Buy again dialog for skipped lines names the product but not the pack or variant, so two packs of one product read alike.
- (Q) The confirmation page shows `Shipping $0.00` where the cart says `Free`; use the same word.
- (Q) The header cart count shows 0 while the commerce tier is down; show the last known count or hide the badge.
- (Q) The listing error page has no reference number (journey J12 expects one).
- (Q) On a subscription card, say why `Change interval` is off while a skip is pending or the subscription is paused.
- (Q) The account tab strip shows a thin scrollbar at 375 px; hide the bar and keep the scroll (`scrollbar-width: none`).
- (Q) Load the review form and the sort control on demand to take the product page under 200 kB of JavaScript (Q-Q-19).
- (Q) Login limit per email across all client addresses, and a session version claim so a sign-out can revoke a copied token (security.md H2 and H10); a shared limiter store when the host runs several instances (same as J and M above).
- (Q) The remaining hardening items H1, H8, H9, H11, H12, H14 to H17 of `plans/evidence/Q/security.md`.
- (Q) `GET /api/checkout` answers 404 `cart_not_found` for a shopper with no bag (checkout opened by URL), so the browser logs a console error (Lighthouse best practices 96 on checkout). Answer 200 with an empty state or have the page skip the call without a bag cookie.
- (Q) Product images are larger than they are shown (trace insight `ImageDelivery`: 90 to 160 kB too many on the listing and the product page). Check the `sizes` of `CardImage` and the gallery once the real image endpoint exists (OA-03).
- (Q) Dev-dependency advisories (`npm audit` without `--omit=dev`: storefront 5 high in the `eslint-config-next` chain, seed 6 including `vitest` 2.x); none ships. Move to current releases of the lint and test toolchains when they fit the pinned stack (`plans/evidence/Q/npm-audit.txt` section 3).
