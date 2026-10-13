<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream X — Security hardening (roles, IDOR, CSRF, Contentools proxy, JWT leakage, order/return/review integrity)

Status: DRAFT v2 (2026-10-12, owner interview applied). Cross-cutting: `b2b2c-automotive/portal/` and `b2b2c-automotive/storefront/`. Dev URLs assumed: portal `http://localhost:3001`, storefront `http://localhost:3000`. All attacks run against a **production build** (`npm run build && npm run start`), never `next dev`, because dev mode relaxes headers and source maps.

## Owner scope changes (owner interview 2026-10-12)

| Removed from X | Why | Effect |
| --- | --- | --- |
| MAP price floor: attack group A on the floor, `malva-rules/map-floor`, `computeFloor`, `assertAboveFloor`, `BELOW_MAP_FLOOR`, `audit-floor.mjs`, floor flags | Q-T03: no MAP floor; a reseller may set any price above zero | Group A becomes **price and money integrity** (valid money shape, above zero, own store and own branch channel only, mass assignment, batch atomicity). The floor rule of `seller-portal/design-brand-partnership` is void; the spec file only carries an out-of-scope note. |
| Territory blocking: attack group B, `lib/rules/territory.ts`, store-countries rule, `MALVA_TERRITORIES` | Q-O03: no territory blocking at checkout | Group B becomes **checkout, cart and payment integrity** (re-check from the persisted cart, payment state never from the client). Native shipping zones stay as ordinary commerce data, not as a security control. |
| Wholesale buying from Malva: approval queue, approver role, quotes, price lists, contract groups, `mau-malva-wholesale` store, purchase-order attacks | Q-V01: out of scope | Roles are **Admin and Buyer** only. Role matrix, attacks C01 to C07 and F06 are rewritten or removed. |
| E-mail sending, outbox, mail header injection | Q-P01: no emails | Only stored-template XSS (preview escaping) stays. |
| design.md decision 10 (MAP floor and territories enforced on the server) | Q-T03 and Q-O03 | Void for both parts; X proves the remaining server rules instead. |

## Goal

Prove, with repeatable attacks, that the access model and the data integrity rules hold **on the server**, even when the portal or storefront screens are bypassed:

1. No role can do what its associate role forbids (Admin versus Buyer), and no user can reach another reseller's data (stores, branches, customers, orders, returns, reviews, subscriptions).
2. The Contentools proxy cannot be used to read or write another store's theme, pages or content, and never leaks the Contentools JWT.
3. Prices, carts, orders, payments, returns, refunds, reviews, subscriptions and tailored content cannot be tampered with from the client; payment state is never trusted from the browser.
4. Cross-site request forgery, header spoofing, session forgery and web hygiene gaps are closed.

X also finishes the shared rule modules, adds the route policy gate and writes the security report. Nothing in X is a new feature screen.

## Depends on

O (checkout, Checkout app and order creation), T (price write paths on the store channel, tailoring text and images, discount write paths), U (Contentools proxy of the portal and storefront, store and branch channel settings, logo upload), V (customers, shop-as, subscriptions, returns, reviews), W (marketing, bundles, product import, brand partnership). Y runs in parallel.

## Specs and requirements verified (and finished where noted)

Paths under `b2b2c-automotive/openspec/specs/`.

| Spec | Requirement (exact title) | What X proves or finishes |
| --- | --- | --- |
| `seller-portal/design-price-overrides-and-margin/spec.md` | write paths for prices | prices written only through the validated path (A01 to A12); the "Price floor from Malva" requirement is **void** (Q-T03) |
| `seller-portal/design-discounts-and-priority/spec.md` | Safe discounts | discount values validated, no result price at or below zero (A06, A07) |
| `seller-portal/design-bundles-and-product-import/spec.md` | Bundle rules; Local products cannot claim fitment | A05, F03, F11 |
| `seller-portal/design-brand-partnership/spec.md` | Rules enforced server-side | only the remaining rule (local fitment claims stay unpublished until Malva approves) is attacked (F11); floor and territory scenarios are void |
| `seller-portal/design-returns-and-reviews/spec.md` | Return lifecycle; Reviews | F01 to F06 |
| `seller-portal/design-customers-and-subscriptions/spec.md` | Shop as customer; Privacy; Subscriptions | C20, C21, F07 to F09 |
| `seller-portal/bootstrap-and-structure/spec.md` | As-associate for buying, admin client for selling; Permissions in two layers; Contentools editors through a hardened same-origin proxy; Contentools JWT resolved on the server; Gates and tests | C01 to C20, D01 to D14, E01 to E09; finishes the route policy gate |
| `consumer-storefront/bootstrap-and-structure/spec.md` | Contentools reads and the same-origin proxy; Store resolved from the path; Stateless session; BFF boundary and helpers | D09 to D14 (storefront proxy), C16, C17, E09 |
| `design.md` | Risks "server-side rules" (reduced to the access model and integrity rules) | whole workstream |

X has no primary spec in `DEPENDENCY-PLAN.md` (cross-cutting).

## Decisions already taken (do not reopen)

| # | Decision | Source |
| --- | --- | --- |
| D1 | The browser never calls commercetools. The only credentials that can write are in the BFFs (`CTP_*`, `CTP_ADMIN_*`, `CTP_PROVISION_*`), server only. So "a direct API call" in this project means a direct HTTP call to **our** BFF endpoints (curl with a valid or forged session, no browser), which is what the attacks do. | both `bootstrap-and-structure` specs |
| D2 | Price rule (replaces the floor rule): `assertValidPrice(price: unknown, currency: string)` accepts only `{ type: 'centPrecision', currencyCode, centAmount: integer > 0, fractionDigits: 2 }` in the store currency; anything else is refused with 400 `INVALID_MONEY`. There is no minimum other than above zero (Q-T03). Prices are written as **standalone prices** on the store's distribution channel or on one of the store's own branch channels (Q-003, Q-005); the channel key must belong to the session store, otherwise 404 `CHANNEL_NOT_FOUND`. | Q-T03, Q-003, Q-005 |
| D3 | Payment trust: the storefront never accepts a payment status, amount, currency, payment id or order total from the client. Orders are created only from the persisted cart after the commercetools Checkout session reports completion (server-side read of the payment and checkout state, or the connector's order creation). Webhook signature checking and idempotency of the Stripe connector are the connector's responsibility; X verifies the storefront's own side (no trust in the redirect query string, order creation is idempotent per cart). Refunds go through the Payment and the Stripe connector; the portal only adds a `Refund` transaction through the validated return path. | Q-012 |
| D4 | No territory or country rule exists (Q-O03). Shipping methods and zones remain native commerce data; a shipping method must be one returned for the cart (`matching-cart`), never an id supplied by the client. Pickup uses a branch address read from the store's channel record, never one supplied by the client. | Q-O03 |
| D5 | All state-changing routes (POST, PUT, PATCH, DELETE) require same-origin (`Origin` header host equals `Host`, or `Sec-Fetch-Site` is `same-origin`/`none`); otherwise 403. Content type must be `application/json` unless the route is a documented multipart upload. No CSRF tokens (cookie is `SameSite=Lax`, HTTP-only; the Origin check is the second layer). | OWASP guidance; decided here |
| D6 | Every route has an entry in `lib/authz/route-policy.ts` (route pattern, methods, requirement: `public`, `session`, `customer`, `permission:<name>`, `role:admin`, `seller-store`), and a generated test checks 401 for no session, 403 for the wrong role (Buyer on an Admin route), and 403/404 for the wrong store. `check-routes` fails for a route without an entry. Portal roles are **Admin and Buyer** only. | portal spec "Gates and tests"; Q-V01 |
| D7 | The Contentools proxy (portal) requires a session, rewrites the store segment to the session store (never trusts the path), attaches the server-resolved JWT only on write requests, never forwards client `authorization`, `cookie`, `x-project-key` or `x-forwarded-*` headers, never follows redirects, and serves only an allow-list of routes decided after decoding and normalising the path. The managers get a placeholder `jwtToken`. The `upload-file` route (logo, favicon and tailored images, Q-U01, Q-T06) is on the allow-list for POST only, multipart, with content-type and size limits. The storefront proxy is read only (GET and the published-page query POST). | portal spec "hardened same-origin proxy"; design.md section 2; Q-X02, Q-U01 |
| D8 | Security decisions are logged as one JSON line to stdout (`{ ts, rule, decision, route, actor }`, no JWT, no cookie, no e-mail, no body) through `lib/security/audit-log.ts`; the attack harness uses these lines as proof that the refusal came from the server rule. | decided here |
| D9 | No rate limiting or bot protection is built in this project (out of scope; recorded in the report as a known gap). | Q-X03 |
| D10 | Test data prefix `TST-X-`. | Z |
| D11 | Returns: window is **30 days from delivery** (`deliveredAt`, set by the portal, Q-Q01); refunds never exceed the paid gross of the returned lines. Tailored text and images publish at once with no approval (Q-T06), so the protection is output encoding and an image URL allow-list, not a review gate. | Q-Q01, Q-T06 |
| D12 | Shop as customer is Admin only (Q-W01). | Q-W01 |

## Prerequisites (task X-00)

Write `plans/evidence/X/route-inventory.md` listing every Route Handler of both apps with its policy (generated by `node scripts/list-routes.mjs`, created in X-01) and note any route that T, U, V or W named differently from this plan; use the real names when running the attacks below (the examples show the intended names). Check with the `b2b2c-automotive` MCP:

| Need | Tool | Expect |
| --- | --- | --- |
| Two resellers A and B with their stores, branch channels and business units | `read_stores`, `read_channels`, `read_business_units` | different stores, different product selections, branches with inventory and prices |
| Demo associates: Admin and Buyer for A; Admin for B | `read_business_units`, `read_customers` | role assignments present |
| One part assigned to both with a known standalone price on each store channel | `read_products`, `read_standalone_prices` | prices known |
| A delivered order, an undelivered order, a guest order and a recurring order for A; an order for B | `read_orders`, `read_recurring_orders` | present, else create `TST-X-` ones |
| Reviews and a return for A and B | `read_reviews`, `read_orders` | present or created through the app |
| Shipping zones and methods | `read_zones`, `read_shipping_methods` | for the test carts |

Contentools: the proxy attacks run against a **local stub upstream** (X-06), so they do not need OA-02. Only attack E (JWT leakage with the real service) and M-X-02 need OA-02. Payment attacks run against the commercetools Checkout test setup (OA-05: Stripe test account, connector, Checkout app); the unit twins run without it.

## Tasks

A task is done when its tests pass and `npm run check` is green in the app it touches. Write the test first.

### A. Foundations

- [x] **X-01** Route policy gate in both apps. Create `portal/lib/authz/route-policy.ts` (extend R's if it exists) and `storefront/lib/authz/route-policy.ts`: `export const ROUTE_POLICY: { pattern: string; methods: ('GET'|'POST'|'PUT'|'PATCH'|'DELETE')[]; requires: 'public'|'session'|'customer'|`permission:${string}`|'role:admin'|'seller-store'|'cron'; note?: string }[]`. Create `scripts/list-routes.mjs` (walks `app/api/**/route.ts`, converts folders to patterns) and extend `scripts/check-routes.mjs` to fail when a route file has no policy entry or a policy entry has no route file. Create `lib/authz/route-policy.test.ts` that generates, for every entry and every persona, the expected status (401, 403, 200-class) and runs the handler directly with a mocked session (no network). Portal personas: anonymous, Admin A, Buyer A, Admin B. The storefront has no portal roles, so its personas are anonymous, customer of the path store, customer of another store, impersonated customer.
- [ ] **X-02** Finish the price rule module (T created the first version; do not duplicate, edit it): `portal/lib/rules/price.ts` with `assertValidPrice(price: unknown, currency: string)` per D2 (throws `RuleViolation({ code: 'INVALID_MONEY' })`, HTTP 400), `assertStoreChannel(storeKey, channelKey)` (the channel is the store's distribution channel or one of its branch channels, read from the store record, never from the client), `assertDiscountValue(value)` (relative permyriad 1 to 10000, absolute amounts above zero in the store currency; a discount can never produce a price at or below zero). A shared HTTP mapper `lib/rules/to-response.ts` turns these errors into `Response.json({ error: { code, message } }, { status })`. There is **no** floor module, no `malva-rules` object and no `ensure-x.mjs`. [SKILL: commercetools-platform]
- [ ] **X-03** `storefront/lib/rules/checkout-integrity.ts`: pure guards used by the checkout code of O: `assertShippingMethodAllowed(methodId, matchingMethodIds)`, `assertPickupFromBranch(store, branchKey)`, `assertPaymentCompleted(checkoutState)` (order creation refused unless the server-side read of the Checkout session or payment shows completion), `assertCartMatchesSession(cart, session)` (store key, customer, currency). `placeOrder` re-reads the persisted cart and ignores any totals or address in the request body. Idempotency: a second place call for the same cart returns the first order. Document how the Stripe connector and Checkout app deliver payment results (webhook handled by the connector) and keep the storefront free of any webhook secret.
- [x] **X-04** Single chokepoint lint. Create `scripts/check-rule-callers.mjs` in the portal: fail if any file other than `lib/ct/seller/prices.ts`, `lib/ct/seller/discounts.ts`, `lib/ct/seller/bundles.ts`, `lib/ct/seller/local-products.ts`, `lib/import/import-api.ts` contains the price write actions (`standalonePrices().post`, `addPrice`, `changePrice`, `setPrices`, `setDiscountedPrice`, `product-drafts/import-containers`) and fail if a listed file contains one without importing `assertValidPrice` (or, for discounts, `assertDiscountValue`). Add `scripts/check-admin-client-imports.mjs` (admin client only from `app/api/seller/**`, `lib/ct/seller/**`, `lib/contentools/jwt.ts`) if A/R did not already. Add a unit test for each script with a fixture file that violates it.
- [x] **X-05** `portal/lib/security/origin.ts` `assertSameOrigin(req: Request)` (D5) and `portal/lib/security/route.ts` `withRoute(policyKey, handler)` wrapper that runs: session, policy, same-origin, content-type, zod parse (strict), handler, error mapping, `logDecision`. Convert **every** mutating route to use it (the route policy test fails for a mutating route that does not). Same for the storefront (`storefront/lib/security/*`, copies). `lib/security/audit-log.ts` exports `logDecision(entry)` that writes one JSON line and drops any key named like `token|authorization|cookie|password|email|jwt`.

### B. Contentools proxy hardening

- [x] **X-06** `portal/scripts/attack/stub-contentools.mjs`: a plain Node HTTP server on port 4010 that answers 200 JSON for any path and **records** every request (method, URL, selected headers: `authorization`, `x-project-key`, `cookie`, `host`, `content-type`, `content-length`) in memory and exposes `GET /__log` and `DELETE /__log`. Run the apps with `CONTENTOOLS_ORIGIN=http://localhost:4010` and a canary JWT (X-12). Same script is reused by the storefront attacks.
- [x] **X-07** `portal/lib/contentools/proxy-policy.ts` (pure, no network) and `proxy-policy.test.ts`. First open `/Users/behnam/code/cms/service/src/routes/configuration.route.ts`, `puck-page.route.ts`, `puck-content.route.ts` and the `upload-file` route, and list the routes the `ThemeManager`, `PageManager` and `ContentManager` actually call plus the upload route used for logo, favicon and tailored images; write them as data in `lib/contentools/allowlist.ts` (`{ method, pattern }` with `:store` as the only variable segment) and keep the list in `plans/evidence/X/proxy-allowlist.md`. Functions: `normalisePath(rawPath)` (decode percent-encoding **exactly once**, reject a path that still contains `%` after decoding (double encoding), reject `\`, `//`, `..`, `.`, NUL, control characters, non-ASCII, a trailing dot or slash, and anything longer than 300 characters); `matchAllowlist(method, path)`; `rewriteStore(path, sessionStoreKey)` (replace the `:store` segment; if the incoming segment differs from the session store, the proxy rejects with 403 instead of rewriting when `PROXY_STRICT_STORE=true`, default true in production, so tampering is visible in logs); `sanitizeRequestHeaders(headers)` (drop everything except `content-type`, `accept`, `accept-language`; add `x-project-key`; add `authorization: Bearer <jwt>` only for POST, PUT, PATCH, DELETE); `sanitizeResponseHeaders` (drop `set-cookie`, `content-encoding`, `content-length`, `transfer-encoding`, `connection`, `www-authenticate`, `location`); `checkUpload(headers, size)` (multipart only on the upload route, image types `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` refused unless sanitised by Contentools, size at most 5 MB, otherwise 415/413 before forwarding).
- [x] **X-08** Rewrite `portal/app/api/contentools/[...path]/route.ts` to use X-07 and `withRoute` (session required, 401 otherwise). Body rules: only JSON up to 1 MB (multipart up to 5 MB on the upload route only); if the JSON body contains `businessUnitKey` or `storeKey` fields at any depth they must equal the session store (else 403) or are overwritten with it; unknown methods (`TRACE`, `CONNECT`, `OPTIONS` other than a fixed 204) are 405; `fetch(..., { redirect: 'manual' })`; upstream status 3xx becomes 502; upstream error bodies are replaced by `{ error: { code: 'UPSTREAM_ERROR' } }` for status >= 500 (never echo upstream text); the `jwtToken` the managers receive is the literal `'placeholder'` (`ContentoolsWrapper.tsx`), and the proxy ignores any `Authorization` the client sent. Storefront `storefront/app/api/contentools/[...path]/route.ts`: GET only, plus POST only to `/service/<store>/published/puck-pages/query`; the store segment must equal the session or path store; everything else 404. [SKILL: commercetools-integrations] (read the `integrate-contentools` shapes already ported in H and U; do not change the proxy contract the managers rely on)

### C. Attack harness

- [ ] **X-09** `portal/scripts/attack/lib.mjs` and `storefront/scripts/attack/lib.mjs`: a small `fetch` wrapper with a cookie jar kept **in memory only** (never written to disk), `loginAs(personaKey)` (reads credentials from `seed/.env.local` or env `ATTACK_<PERSONA>_EMAIL` and `_PASSWORD`; never printed; calls the app's sign-in route, which R and Q built: portal `POST /api/auth/login`, storefront `POST /api/auth/login`; if the route differs, use the real one), `req(method, path, { as, headers, body, raw })`, `expect(res, { status, code })`, and a recorder that appends `{ id, request, status, code, sideEffectProof, logLine }` to `plans/evidence/X/attack-results.json`. `scripts/attack/run.mjs` loads `scripts/attack/*.attack.mjs` (one file per group) and prints a table. npm scripts `attack` in both apps. The harness reads the server log (the app is started with output to `plans/evidence/X/server-<app>.log`, redacted by D8) and checks for the matching `decision: "deny"` line per attack.
- [ ] **X-10** Write the attack files (details and exact requests are in the catalogue below): `price.attack.mjs` (A01 to A12), `checkout.attack.mjs` (B01 to B10), `roles.attack.mjs` (C01 to C21), `proxy.attack.mjs` (D01 to D14), `jwt.attack.mjs` (E01 to E09), `integrity.attack.mjs` (F01 to F15), `web.attack.mjs` (G01 to G10). Each attack also has a **unit-level twin** under `lib/**/attacks.test.ts` that calls the handler with the UI absent and asserts the mocked admin or associate client was **not called** (`expect(client).not.toHaveBeenCalled()`), which is the proof that the refusal is a server rule and cheap to rerun in `npm run check`.
- [x] **X-11** Detective control `portal/scripts/audit-prices.mjs` (read only, uses the admin client): lists every standalone price in the project whose `centAmount <= 0`, whose currency differs from the store currency, or whose channel belongs to a branch that is not in the store of the price's owner (via the product selection and channel records); exit code 1 if any exists. Run it in X and in Z.
- [x] **X-12** JWT canary: environment variable `CONTENTOOLS_JWT_CANARY` (honoured **only** when `NODE_ENV !== 'production'` **or** `ATTACK_MODE=1`; guarded by a test that the production build ignores it without `ATTACK_MODE`). `lib/contentools/jwt.ts` returns it instead of the custom object value. Value shape `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9.CANARY-SIGNATURE-0123456789` (a three-part string that looks like a JWT but is not valid), so a leak is greppable. Extend `scripts/check-bundle-secrets.mjs` (created by A-08; the one script name for bundle scanning in X, Y and Z) to also fail on `/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/` in `.next/static` and `public/`. Create `scripts/check-no-attack-mode.mjs` in **both** apps (the one script name for the release switch; Z-gate 4 runs it): it fails when `ATTACK_MODE` or `CONTENTOOLS_JWT_CANARY` appears in any release configuration file (`netlify.toml`, `vercel.json`, `.env.production`, `.env.example` values other than empty, `next.config.*`, CI workflow env blocks) or is set to a truthy value in `process.env` when run with `NODE_ENV=production`. `ATTACK_MODE` is the one name of the attack-harness switch everywhere (never `ATTACK` or `ATTACK_ON`); add the test `scripts/check-no-attack-mode.test.mjs` (fixture `netlify.toml` containing `ATTACK_MODE=1` fails) and wire both scripts into `npm run verify:build`.
- [ ] **X-13** Execute the whole catalogue (curl-level harness plus the Chrome recipe), fix what fails, rerun until all pass, save evidence.
- [ ] **X-14** Run the `security-review` skill on the branch diff and write `plans/notes/security-review.md` (each finding: severity, fixed or accepted with reason). `npm audit --omit=dev` in both apps: no high or critical, exceptions in `plans/notes/audit.md`.
- [ ] **X-15** Final report `plans/evidence/X/report.md`: attack table with pass/fail and proof, list of controls, known gaps (D9, Merchant Center users are trusted, no MAP floor and no territory rule by owner decision, no e-mail sending, and the on-screen password reset: anyone who knows an email can reset that account, demo only, gated by `DEMO_ONSCREEN_RESET` in the storefront and the portal; accepted by the owner, listed in Z's known gaps).

## Attack catalogue (concrete)

Conventions: personas `adminA`, `buyerA`, `adminB`; storefront personas `shopperA` (customer of store A), `shopperB`. `PRICE_ROUTE` is T's price write route (intended `PUT /api/seller/prices/{sku}` with `{ "amountCents": <int>, "channelKey"?: "<branch>" }`); use the real one from `route-inventory.md`. Every request carries `Origin: http://localhost:3001` (portal) or `http://localhost:3000` (storefront) and `Content-Type: application/json` unless the attack is about those headers.

**Proof of server-side refusal, three parts for every attack:** (P1) the HTTP status and error code are exactly as listed; (P2) no side effect, shown by the MCP read named in the row (version unchanged, no record) or by `GET` through the app; (P3) the server log contains `{"rule":"<rule>","decision":"deny"}` for that request and the unit twin asserts the commercetools client mock was not called.

### A. Price and money integrity (rule `price`)

There is no floor: any valid price above zero is accepted (control A02).

| ID | Attack | Expected | Proof of no effect (P2) |
| --- | --- | --- | --- |
| A01 | `PUT PRICE_ROUTE` as `adminA` with amount `0`, then `-1` | 400 `INVALID_MONEY` | `read_standalone_prices`: store A price unchanged, version same |
| A02 | same with amount `1` (one cent) and with a normal amount (control: no floor) | 200 | price now equals the amount; restore afterwards |
| A03 | bulk route with 50 rows, row 37 invalid (amount 0) | 422 for the **whole batch**, body lists row 37; zero rows applied | all 50 SKUs unchanged (read 3 sample SKUs incl. one valid row) |
| A04 | CSV bulk with the same invalid row | 422, same | unchanged |
| A05 | bundle (W) with `discountPercent` 0, 51, -5, `NaN`, string; components 1 and 9; quantity 21 | 400 / 422 per bundle rules; never 500 | `read_products` key `bundle-<A>-...` absent |
| A06 | product discount of 150 percent or absolute amount larger than the price | 422 `INVALID_DISCOUNT` | `read_product_discounts` unchanged |
| A07 | co-op or cart discount with `permyriad` 0, 10001, negative, non-integer | 422 `INVALID_DISCOUNT` | `read_cart_discounts` no such key |
| A08 | price in `USD` on the EUR store (and the reverse); `currencyCode: "eur"` | 400 `INVALID_MONEY` | unchanged |
| A09 | money abuse: `{"type":"highPrecision","preciseAmount":83155,"fractionDigits":3}`; `8315.5`; `"8316"` (string); `null`; `NaN`; `1e308`; `9007199254740993` | each 400 `INVALID_MONEY` (never 500) | unchanged |
| A10 | price for a SKU not assigned to store A; for store B's local product; `storeKey: "<B>"` in body and query | 404 or 422 `SKU_NOT_ASSIGNED`; the foreign key is ignored | B's prices unchanged (`read_standalone_prices` for B's SKU) |
| A11 | mass assignment: add `validFrom`, `customerGroup`, `tiers`, `channel`, `staged`, `key` to the body | 400 `UNKNOWN_FIELD` (strict schema) | unchanged |
| A12 | branch channel abuse (Q-005): write a price with `channelKey` of **store B's branch**, of a channel that is not a branch, and of an unknown key; stock write for a branch of B (inventory route of T/U) | 404 `CHANNEL_NOT_FOUND` | `read_standalone_prices`, `read_inventory` unchanged for B |
| A13 | race: 20 parallel requests alternating valid and invalid (0) amounts; poll the price every 50 ms during the burst | final price equals a valid amount; no poll ever observed 0 or a negative value | poll log in the evidence file |
| A14 | the admin client or its secret reachable from the browser | `scripts/check-bundle-secrets.mjs` finds no `CTP_ADMIN_` value, `client_secret` or JWT shape in `.next/static`; `check-admin-client-imports` green; `audit-prices` exits 0 | script output saved |

### B. Checkout, cart and payment integrity (rules `integrity`, `payment`)

Storefront persona `shopperA` (customer of A, cart with one part). Routes intended: `PUT /api/checkout/address`, `POST /api/checkout/shipping`, `POST /api/checkout/place`, Checkout return route (use real names). There is no territory rule; these attacks target trust in client input.

| ID | Attack | Expected | P2 |
| --- | --- | --- | --- |
| B01 | place order with a body containing `total`, `amount`, `currency`, `paymentId`, `paymentState: "Paid"`, `orderState` | 400 `UNKNOWN_FIELD` (strict) | `read_orders`: none from this request |
| B02 | open the Checkout return/confirmation URL with `?status=success` (or the connector's success marker) without paying | no order; the server reads the payment/checkout state itself and answers 409 `PAYMENT_NOT_COMPLETED` | `read_orders`, `read_payments`: no order, no `Success` transaction |
| B03 | change the cart (add a line, change quantity, apply a code) after the Checkout session was created, then complete payment | order creation refused or the session is invalidated and re-created; the paid amount equals the order total (`AMOUNT_MISMATCH` otherwise) | order total equals payment amount |
| B04 | time of check versus time of use: set an address, then change the cart through the saved-address path and call place | the persisted cart is used; the body address is ignored | orders carry the persisted address only |
| B05 | place twice in parallel (10 requests) for the same cart | exactly one order (idempotent per cart) | `read_orders`: count 1 |
| B06 | address id of another customer or another store's saved address | 404 | cart unchanged |
| B07 | pickup method with an attacker-supplied address; branch key of another store | supplied address ignored (or 400 for a client address on pickup); other store's branch is 404 | `read_carts`: shipping address equals the branch of the session store |
| B08 | body fields `shippingMode: "Multiple"`, `shippingMethod: { id: "<non-matching method>" }`, `setCustomShippingMethod` | 400 `UNKNOWN_FIELD` or 422 `SHIPPING_METHOD_NOT_ALLOWED` | cart unchanged |
| B09 | cart created under `/de-DE/<A>`, then `POST` the place route under `/de-DE/<B>` with the same cookie | cart cleared per the "Store changes mid-session" scenario; 409 `CART_NOT_FOUND`; no cross-store order | `read_orders`: none |
| B10 | subscription checkout (Q-Q06) tamper: `recurrencePolicy` key not on the part, interval from the body, `recurringOrderScope` in the body, subscribe flag on a part without policies | 400 `UNKNOWN_FIELD` / 422 `POLICY_NOT_ALLOWED`; the policy comes only from the part's configured policies | `read_recurring_orders`: none created |

### C. Roles, ownership, sessions, CSRF (rules `authz`, `ownership`, `session`, `origin`)

| ID | Attack | Expected | P2 |
| --- | --- | --- | --- |
| C01 | `buyerA` against every `app/api/seller/**` route (generated from the policy) | 403 before any commercetools call | `adminClient` mock not called |
| C02 | `buyerA`: customers, notes, shop-as, subscriptions, returns, reviews, marketing, bundles, import, partnership routes (named) | 403 | no record |
| C03 | `buyerA`: price write, assortment withdraw, tailoring write, discount write | 403 | prices, selections unchanged |
| C04 | `buyerA`: role assignment `{ customerId: <self>, businessUnitKey, roleKeys: ["mau-role-admin"] }` (seed keys `mau-role-admin`, `mau-role-buyer`); mass assignment `{ role: "mau-role-admin" }` on any user or profile update route | 403 / 400 | `read_business_units`: buyer's role assignments unchanged |
| C05 | `adminA`: invite or assign a role in a business unit of reseller B | 403 before any call | B's unit unchanged |
| C06 | `adminA`: change the role of the last Admin of A to Buyer, or assign a role key other than `mau-role-admin` and `mau-role-buyer` | 409 `LAST_ADMIN` / 400 `UNKNOWN_ROLE` | `read_associate_roles` and unit assignments unchanged |
| C07 | edit or delete system role keys `mau-role-admin`, `mau-role-buyer` through any route | 403 / 404 | `read_associate_roles`: system roles unchanged (compare version) |
| C08 | session forgery: (a) cookie with changed `storeKey`/`businessUnitKey`/`customerId` claims and the original signature; (b) `alg: none`; (c) HS256 signed with a guessed secret; (d) truncated; (e) empty; (f) expired `exp` | all 401 and the cookie is cleared; never 200 | n/a |
| C09 | spoofed headers: `x-preview-role: admin`, `x-business-unit-key: <other>`, `x-store-key: <B>`, `x-forwarded-for`, `x-middleware-subrequest: middleware` (Next.js bypass family) as `buyerA` against an Admin route | headers ignored; 403 | n/a |
| C10 | IDOR orders: `GET /api/seller/orders/<id or number of store B>` as `adminA`; storefront `GET /api/account/orders/<id of another customer>` as `shopperA` | 404 (identical body for a random id) | n/a |
| C11 | IDOR customers, returns, reviews, recurring orders, notes of store B (GET, PATCH, DELETE, transition) as `adminA` | 404 for all | records unchanged |
| C12 | IDOR channels and inventory: another store's branch id on read and write routes | 404 | unchanged |
| C13 | IDOR products and selections: assign or withdraw another store's SKU in the selection; tailoring (text and image) for a product or store of B | 404 / 422 | selections and tailoring unchanged (`read_product_selection_assignments`, `read_product_tailoring`) |
| C14 | query overrides: `?businessUnitKey=<other>`, `?storeKey=<B>`, `?associateId=<other>` on read and write routes | ignored; data is the session's | n/a |
| C15 | `adminA` calling seller routes with store B in body, query and path variants | session store used; B untouched | B's data unchanged |
| C16 | storefront: customer registered at store A signs in under `/de-DE/<B>` | 401 with the generic message, no session cookie | n/a |
| C17 | storefront account IDOR: order by id and by number, address ids, garage, recurring orders, returns of another customer | 404 | n/a |
| C18 | every route whose policy is not `public` with **no cookie** (generated) | 401 | n/a |
| C19 | CSRF: from a page on `http://localhost:4020` (served by `scripts/attack/evil-server.mjs`) run `fetch('http://localhost:3001/api/...', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({...}) })` against two mutating routes (also a storefront cart route); also curl with `Origin: http://evil.test` and with no `Origin` and no `Sec-Fetch-Site` | 403 `CROSS_ORIGIN`; text/plain bodies 415; Chrome does not even send the Lax cookie | records unchanged |
| C20 | shop-as misuse: replay a used token; token older than 60 s; token for a customer of B; token minted by `buyerA` (route refuses; Admin only, Q-W01); token in a query string; token with another `aud`; idle session older than 2 minutes | each ends in the generic not-found page, no session cookie set, no `Set-Cookie` header | `read_custom_objects` `malva-impersonation`: record `active` once only |
| C21 | impersonated session abuse: while impersonating, change password or e-mail, delete the account, save a payment method, or reach the portal | refused (403 `IMPERSONATION_RESTRICTED`); order placed carries `placedOnBehalfBy` from the session only | customer unchanged |

### D. Contentools proxy (rule `proxy`)

Run with the stub upstream on port 4010. For every row the **stub log** (`GET http://localhost:4010/__log`) is part of P2: it must show no request path containing store B's key, and no `authorization` header on a GET. `S` = session store key of `adminA` (store A); `B` = store B. Base: `/api/contentools/service/...` (portal).

| ID | Attack | Expected (portal) | Expected (storefront) |
| --- | --- | --- | --- |
| D01 | `PUT /api/contentools/service/<B>/configuration/theme` as `adminA` | 403 `PROXY_STORE_MISMATCH` (strict mode) and stub log empty | 404 (write) |
| D02 | same with `PROXY_STRICT_STORE=false` (rewrite mode, test only) | forwarded as `<S>`; stub saw `/service/<S>/configuration/theme` only | n/a |
| D03 | path traversal: `/service/<S>/..%2f<B>/configuration/theme`, `/service/<S>/%2e%2e/<B>/...` | 400 `INVALID_PATH`; stub log empty | 404 |
| D04 | double encoding `%252e%252e`, backslash `%5c`, `//`, NUL `%00`, tab `%09`, unicode dots `%u002e`, overlong UTF-8 `%c0%ae` | 400 `INVALID_PATH` | 404 |
| D05 | case and dot tricks: `/Service/<S>/...`, `/service/<S>./configuration/theme`, `/service/<S>/configuration/theme/`, `/service/<S>/configuration/theme/../../puck-pages` | 404 (not in allow-list) or 400 | 404 |
| D06 | store only in query/body: `?businessUnitKey=<B>`, JSON body `{ "businessUnitKey": "<B>" }` or nested `{ "page": { "storeKey": "<B>" } }` on a page save | 403 `PROXY_STORE_MISMATCH` (or overwritten to `<S>` with the stub showing `<S>`) | n/a |
| D07 | client headers: `Authorization: Bearer attacker`, `X-Project-Key: other`, `Cookie: <session>`, `X-Forwarded-Host`, `X-HTTP-Method-Override: DELETE` | stub log shows the proxy's own `x-project-key`, a JWT only on writes and **never** the client's value, **no** `cookie`, no override header | same (read only) |
| D08 | routes outside the allow-list: `/service/<S>/health`, `/service/refresh-jwt`, `/service/<S>/admin/...`, `/service/<S>/custom-objects`, absolute URL path `/api/contentools/http://169.254.169.254/` | 404 | 404 |
| D09 | storefront write attempts: `POST`, `PUT`, `PATCH`, `DELETE` anywhere; `POST /service/<S>/published/puck-pages/query` with a body containing a `query` for another store (`slug = "x"` with `businessUnitKey` field) | n/a | write methods 404; the query POST forwarded with the store forced to the session/path store |
| D10 | unauthenticated: no cookie on the portal proxy | 401, stub log empty | read routes allowed (public pages), writes 404 |
| D11 | methods: `TRACE`, `CONNECT`, `OPTIONS` (non-fixed) | 405 | 405 |
| D12 | redirect abuse: stub answers `302 Location: http://169.254.169.254/` for one path | proxy returns 502 and never follows; no `Location` header leaked | same |
| D13 | upstream error echo: stub answers 500 with body containing the received `Authorization` header | client receives `{ error: { code: 'UPSTREAM_ERROR' } }` only | same |
| D14 | oversized body (2 MB JSON, 6 MB upload) and non-JSON content type on write; upload of `text/html`, `application/x-msdownload`, a `.svg` with a script, a file whose bytes do not match its declared type, to the logo, favicon and tailoring image upload route | 413 / 415 before forwarding; stub log empty | n/a |

### E. JWT leakage (rule `jwt`)

Start the portal production build with `ATTACK_MODE=1 CONTENTOOLS_JWT_CANARY=<canary> CONTENTOOLS_ORIGIN=http://localhost:4010`. Sign in as `adminA`, open Store, Theme, Content and Pages tabs (the managers load), perform a theme save through the managers so the proxy forwards a write (stub log must show `authorization: Bearer <canary>` **on the server-to-stub hop only**). The canary regex is `eyJhbGciOiJIUzI1NiJ9\.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9|CANARY-SIGNATURE`.

| ID | Check | Method | Expected |
| --- | --- | --- | --- |
| E01 | client bundle | `grep -rE '<regex>' portal/.next/static portal/public`; `check-bundle-secrets` | no match |
| E02 | HTML and RSC payload of every portal page and the Store/Theme/Content pages | Chrome: `evaluate_script` `document.documentElement.outerHTML` and `JSON.stringify(self.__next_f || [])` tested with the regex; also `curl` of the page HTML | no match; the manager prop `jwtToken` equals `placeholder` |
| E03 | every network response and request header while using the editors (including logo upload) | `list_network_requests` then `get_network_request` for each `/api/contentools/` call; regex over request headers, response headers and bodies | no match; the browser's requests carry no `Authorization` |
| E04 | cookies and storage | `evaluate_script`: `document.cookie`, `Object.entries(localStorage)`, `Object.entries(sessionStorage)`, `indexedDB.databases()`; and the `Set-Cookie` headers | no match; session cookie is HTTP-only (not in `document.cookie`) |
| E05 | error paths | force upstream 500 (stub echoes headers) and 401; trigger `error.tsx`, `global-error.tsx`, a 404 under the proxy | bodies and pages show no token and no upstream text |
| E06 | server logs | grep `plans/evidence/X/server-portal.log` | no match (D8 redaction) |
| E07 | source maps | `curl` a `.js.map` from `/_next/static/...`; `productionBrowserSourceMaps` is `false` | 404 |
| E08 | placeholder is not derived from the real token | unit test: the placeholder is a constant string | pass |
| E09 | storefront holds no JWT | repeat E01 to E04 for the storefront with the same canary; its proxy is read only | no match |

### F. Integrity of carts, returns, reviews, subscriptions and content (rule `integrity`)

| ID | Attack | Expected | P2 |
| --- | --- | --- | --- |
| F01 | add to cart with `unitPrice`, `price`, `externalPrice`, `custom`, `totalPrice` fields | 400 `UNKNOWN_FIELD` | `read_carts`: no such line |
| F02 | quantity `-1`, `0`, `1.5`, `"5"`, `100000`, above stock | 400 or capped with the stock message; never a negative line | cart lines |
| F03 | bundle child spoof: add a SKU with `custom.parentLineItemId` of a real parent and `externalPrice` 0; edit or delete a child line id | 400 / 422 `BUNDLE_CHILD_LOCKED` | no zero-price line without a parent |
| F04 | `cartId`, `orderId`, `customerId`, `businessUnitKey` in a body | ignored (session wins) | n/a |
| F05 | discount code: 500 characters, `'; DROP`, `%00`, lower case, spaces, a store B code | 400 `INVALID_CODE` or "Not applied"; only the store's own suffixed code applies | cart `discountCodes` |
| F06 | returns: other store's order; quantity above purchased minus returned; refund above paid; return after 30 days from `deliveredAt` (and before delivery); `status` jump `requested` to `refunded`; client-supplied `shipmentState` or `paymentState`; refund of a return twice | 404 / 422 / 422 / 422 `RETURN_WINDOW_CLOSED` / 422 / ignored / 409 | `read_orders`: `returnInfo` unchanged; `read_payments`: no second `Refund` transaction |
| F07 | refund execution: refund amount or currency from the body that differs from the server-computed value; transaction `state: "Success"` sent by the client; refund on an order with no Stripe payment | server value used / ignored / "settle manually" without a transaction | `read_payments`: transaction state `Initial` until the connector confirms |
| F08 | reviews: reply to or hide a review of store B; reply as `buyerA`; reply 1,001 characters; reply containing `<img onerror>`; review by a customer who did not buy the part; second review of the same part; rating 0 and 6; review for store B's product with a store A session | 404 / 403 / 400 / stored as text and escaped on render (Chrome check: no script runs, text visible literally) / 403 `NOT_A_BUYER` / 409 / 400 / `storeKey` taken from the session | `read_reviews` unchanged |
| F09 | subscriptions (Admin portal and shopper account): pause, resume, cancel, change schedule on store B's recurring order; as `buyerA`; shopper acting on another customer's recurring order; schedule values outside the part's policies | 404 / 403 / 404 / 422 `POLICY_NOT_ALLOWED` | `read_recurring_orders` unchanged (version equal) |
| F10 | tailored text (publishes at once, no approval, Q-T06): `<script>`, `<img onerror>`, `javascript:` links, 100 KB text, markdown with raw HTML; set on a product of store B; as `buyerA` | stored as text and escaped on the PDP and PLP (Chrome check shows literal text); 413 above limit; 404; 403 | `read_product_tailoring` unchanged for B |
| F11 | tailored images and logo: URL with `javascript:`, `data:`, `http://169.254.169.254/`, `file:`, a host outside the Contentools upload host and the allowed image hosts; image set for another store's product; SVG with a script | 400 `IMAGE_URL_NOT_ALLOWED` / 404 / refused or sanitised | `read_product_tailoring`, store settings unchanged |
| F12 | CSV export or import with cells `=HYPERLINK(...)`, `+1`, `-1`, `@x` | exported with a leading `'`; imported as text | downloaded file inspected |
| F13 | email template editor (stored only, never sent, Q-P01): `{{ constructor }}`, `{{__proto__}}`, `<script>` body, 100 KB body | unknown variable 422; body stored as text; preview escapes; size limit 413 | `read_custom_objects` template unchanged |
| F14 | import: 3 MB file, 3,000 rows, BOM and CRLF, formula cells, a `publish` column, category not in the store, key collision with an existing product key; local product claiming fitment with `publish: true` | 413 / 413 / parsed / kept as text / Unmapped / row error / row error / 400 and unpublished | `read_products`: nothing created by refused rows; claim product `published: false` |
| F15 | customer search across stores (`GET /api/seller/customers?q=<email of B's customer>` as `adminA`); notes, campaign names with HTML/markdown | no result; stored as text, Chrome check shows literal text | n/a |

### G. Web hygiene (rule `headers`)

| ID | Check | Expected |
| --- | --- | --- |
| G01 | response headers of a page and an API route (`curl -I`) | `Content-Security-Policy` (no `unsafe-eval`; `unsafe-inline` only if documented for the Contentools editors; `img-src` and `connect-src` allow the Leaflet/OSM tile host on the storefront only, Q-I02), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY` and `frame-ancestors 'none'` (except where the portal preview frames the storefront, then only the portal origin) |
| G02 | session cookie attributes | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV=production` over HTTPS |
| G03 | `x-powered-by` | absent (`poweredByHeader: false`) |
| G04 | release build contains no dev pages and no `/api/health` | `check-no-dev-pages`, `check-no-health-in-release` green; `curl` gives 404 |
| G05 | error pages | no stack trace or file path in any 4xx/5xx body |
| G06 | `npm audit --omit=dev` | no high or critical |
| G07 | CSP violations during normal use | Chrome `list_console_messages` shows none on all pages and with the editors open |
| G08 | open redirect | the sign-in `next` parameter accepts only same-origin relative paths (`//evil.test`, `https://evil.test`, `/\evil.test` refused) |
| G09 | HTTP methods on pages | `TRACE` and `PUT` on a page route give 405 |
| G10 | `robots`: the portal is `noindex` | `X-Robots-Tag: noindex` and `robots.txt` disallow all |

## Tests (named; write first; unit twins run in `npm run check`)

| Test (name) | File | Asserts |
| --- | --- | --- |
| `price validation` | `portal/lib/rules/price.test.ts` | 1 cent accepted; 0, negative, non-cent money, other currency, string, NaN, huge all `INVALID_MONEY`; store channel and branch channel accepted, foreign channel `CHANNEL_NOT_FOUND`; discount value bounds |
| `every price write path validates` | `portal/scripts/check-rule-callers.test.mjs` | fixture file with `standalonePrices().post` and no import fails; allowed files pass |
| `attacks price twin A01 to A13` | `portal/lib/ct/seller/attacks.test.ts` | each attack calls the handler with a mocked admin client: expected status and code, `adminClient` not called, one `deny` log entry |
| `bulk is atomic` | `portal/lib/ct/seller/prices.test.ts` | one invalid row means zero writes |
| `checkout trusts nothing from the client` | `storefront/lib/rules/checkout-integrity.test.ts` | B01 to B10 twins: body totals and payment fields refused; payment not completed refuses order creation; amount mismatch refused; idempotent place; shipping method must match the cart |
| `place order uses persisted cart` | `storefront/lib/ct/checkout.test.ts` | body address ignored; branch address from the store |
| `route policy completeness` | `portal/lib/authz/route-policy.test.ts`, `storefront/lib/authz/route-policy.test.ts` | each route has an entry; generated 401/403/404 per persona |
| `mutating routes use withRoute` | same | a mutating handler that bypasses `withRoute` fails |
| `origin check` | `portal/lib/security/origin.test.ts` | matrix of `Origin`, `Host`, `Sec-Fetch-Site`; missing both is 403 for mutating |
| `session forgery` | `portal/lib/session.test.ts`, `storefront/lib/session.test.ts` | cases C08 a to f |
| `ignored spoof headers` | `portal/lib/security/headers.test.ts` | C09 headers have no effect on `getSession` or policy |
| `proxy path normalisation` | `portal/lib/contentools/proxy-policy.test.ts` | every D03 to D05 string rejected; legal paths accepted; allow-list data matches the CMS routes |
| `proxy header and body rules` | `portal/lib/contentools/proxy.test.ts` | D06, D07, D12, D13, D14 with a fake fetch; `redirect: 'manual'` set; JWT only on writes; client authorization never forwarded; upload type and size limits |
| `storefront proxy read only` | `storefront/lib/contentools/proxy.test.ts` | write methods 404; query POST forced to the session store |
| `jwt canary ignored in production` | `portal/lib/contentools/jwt.test.ts` | without `ATTACK_MODE` the env canary is ignored in production |
| `no jwt shape in bundle` | `portal/scripts/check-bundle-secrets.test.mjs` | fixture bundle with the canary fails |
| `audit log redacts` | `portal/lib/security/audit-log.test.ts` | keys named token, authorization, cookie, password, email, jwt are dropped |
| `role matrix v and w` | `portal/lib/authz/v-role-matrix.test.ts`, `w-role-matrix.test.ts` (from V and W) | must pass unchanged under `withRoute` for Admin and Buyer |
| `return window and refund bounds` | `portal/lib/ct/seller/returns.test.ts` | F06 and F07: 30 days from `deliveredAt`, refund at most paid, transitions in order, no client payment state |
| `review and subscription scope` | `portal/lib/ct/seller/reviews.test.ts`, `subscriptions.test.ts` | F08 and F09: store scoping, Admin only, verified buyer only |
| `tailoring output encoding and image allow-list` | `storefront/lib/tailoring/render.test.ts`, `portal/lib/ct/seller/tailoring.test.ts` | F10 and F11: text escaped, image URL scheme and host allow-list |
| `audit prices` | `portal/scripts/audit-prices.test.mjs` | fixture with a zero price or foreign branch channel exits 1 |

## Role matrix (X additions)

X re-runs V's and W's role matrices through the real HTTP layer. Roles: **Admin and Buyer** (no Approver, Q-V01). Expected results for Admin A, Buyer A, Admin B (cross-store) against:

| Target | Admin A | Buyer A | Admin B |
| --- | --- | --- | --- |
| Own store seller routes (`/api/seller/**`) | allow | 403 | 403 or 404 (not their store) |
| Shop as customer | allow | 403 | 403 or 404 |
| Returns, reviews, subscriptions actions | allow | 403 | 403 or 404 |
| Price, assortment, tailoring, discount writes | allow | 403 | 403 or 404 |
| Company and team (users, addresses) | allow | read own profile only | 403 or 404 |
| Contentools proxy | own store only | 401 or 403 | own store only (their own store) |

## Browser recipe (Chrome DevTools MCP; Claude runs it)

Production builds running: portal `:3001`, storefront `:3000`, stub `:4010`, evil page server `:4020` (`node scripts/attack/evil-server.mjs`, serves `evil.html` with buttons that fire the C19 requests). Screenshots to `plans/evidence/X/X-<id>.png`.

1. **Sign in as buyerA** (portal). `navigate_page` to an Admin page. Run in the console via `evaluate_script`: `fetch('/api/seller/customers',{method:'GET'}).then(r=>r.status)` and a POST to a returns transition. Expect 403 (C01, C02). Screenshot the missing navigation (UI) next to the 403 (server) in the evidence.
2. **Preview-as-role is display only.** As `adminA` set preview Buyer, then `evaluate_script` an Admin-only call: still 200 for Admin (the server ignores preview); as `buyerA` set a forged `x-preview-role: admin` header through `fetch`: 403 (C09).
3. **Prices.** As `adminA` open Catalog, Price overrides: type `0` in the UI: refused; then the same with `fetch` to the real route (A01, A09 variants); a price of `0,01` is accepted (A02) and restored. `take_screenshot` of both. Branch price for another store's branch id via `fetch` (A12): 404.
4. **Checkout.** Storefront `/de-DE/<A>/checkout`: start Checkout, then `fetch` the place route with a forged `paymentState` body (B01) and open the return URL without paying (B02); no order appears.
5. **CSRF.** `new_page` `http://localhost:4020/evil.html` while signed in to the portal in another tab; click each button; `list_network_requests` shows requests without the session cookie or refused with 403 `CROSS_ORIGIN`; MCP shows no record change (C19).
6. **Proxy.** In the portal open Store, Theme; with the stub running, use `evaluate_script` to call D01, D03 to D08 and D11 to D14 against `/api/contentools/...`; then `fetch('http://localhost:4010/__log')` from the **server side** is not possible from the browser, so read the log with `curl -s http://localhost:4010/__log` in the shell and save it. Assert the log has no store B path and no client header values.
7. **JWT leakage.** With the canary active, open every portal page and every editor tab; run the E02 to E04 `evaluate_script` snippets; walk `list_network_requests` and `get_network_request` for each contentools call; save the result table.
8. **XSS text.** Create a customer note, review reply, tailored product text, email template text and campaign name containing `<img src=x onerror=alert(1)>`; open the pages and the storefront PDP; `list_console_messages` shows no dialog or error and `take_snapshot` shows the literal text (F08, F10, F13, F15).
9. **Headers and cookies.** `list_network_requests` for the main document; `get_network_request` for headers (G01, G02); `evaluate_script` `document.cookie` does not contain the session.
10. **Shop-as replay.** (C20) After a successful hand-off, resubmit the same form body from `evaluate_script`; expect the not-found page.
11. **Returns and refunds.** (F06, F07) With `fetch` as `adminA`, try a return on a delivered-35-days-ago order and a refund above paid; both 422.

## MCP read-back checks (`b2b2c-automotive` MCP; read tools)

After each group (names as in the P2 columns): `read_standalone_prices` / `read_products` (prices unchanged, versions equal to those noted before the attack), `read_carts` (address and lines unchanged), `read_orders` (no order with the `TST-X-` marker from refused attacks), `read_payments` and `read_transactions` (no unexpected `Success` or `Refund`), `read_business_units` and `read_associate_roles` (assignments and role versions unchanged), `read_custom_objects` (`malva-impersonation`), `read_cart_discounts`, `read_product_discounts`, `read_reviews`, `read_recurring_orders`, `read_product_tailoring`, `read_channels`, `read_inventory`, `read_shopping_lists`. Record the version number of each resource **before** the group and **after**; equal versions are the proof of no write.

## Manual items (rows for `plans/TODO-MANUAL-TESTING.md`; never wait silently)

If a row blocks a task, mark that task `BLOCKED-ON-OWNER` in `plans/STATUS.md`, keep working on the next unblocked task.

| ID | Type | What the owner does | Blocks |
| --- | --- | --- | --- |
| M-X-01 | review | Read `plans/evidence/X/report.md` (roles, IDOR, CSRF, proxy, JWT, order/return/review integrity) and add attacks the owner thinks are missing; Claude adds them to the catalogue | closing X |
| M-X-02 | live check after OA-02 | With the real Merchant Center Contentools app connected, run E01 to E04 again with the real JWT, including a logo upload (Claude does it; the owner only connects the app, OA-02) and confirm the managers work with the placeholder token (open question I). If they do not, the fallback in Q-X02 applies and X-08/E change | proof E with the real token; decides the fallback |
| M-X-03 | review | A security-minded person other than the author reads `plans/notes/security-review.md` and signs it | G10 sign-off |
| M-X-04 | after deploy | Confirm at the host: HTTPS only, HSTS, `Secure` cookies, no preview deployments with production credentials (Claude checks `curl -I` on the deployed URL in Z) | Z |

References: OA-02 (Contentools), OA-05 (Stripe test account, connector, Checkout app, needed for the live payment attacks B02 and B03), OA-08 to OA-10 (API clients and `SESSION_SECRET`), SO-01.

## Definition of done

1. All tasks X-01 to X-15 ticked; all unit twins and named tests pass; `npm run check` and `npm run build` green in both apps.
2. The whole catalogue (A01 to G10) executed against production builds: every row passes with P1, P2 and P3 evidence in `plans/evidence/X/attack-results.json` and `attack-matrix.md`.
3. `check-routes` fails for any route without a policy entry, and for a mutating route not wrapped by `withRoute`.
4. `audit-prices` exits 0; no `TST-X-` record remains except those listed in `plans/evidence/X/test-data.md`.
5. `plans/notes/security-review.md` has no open high finding; `npm audit` has no high or critical.
6. Gate G10 of `DEPENDENCY-PLAN.md` is met: role, IDOR and CSRF attacks fail server-side; the proxy never leaks the JWT; order, return and review integrity attacks fail.

## Evidence (all under `plans/evidence/X/`)

`route-inventory.md`, `proxy-allowlist.md`, `attack-results.json`, `attack-matrix.md` (ID, request, status, code, P2 proof, log line), `server-portal.log` and `server-storefront.log` (redacted), `stub-log-<group>.json`, `jwt-leak-scan.md` (E01 to E09 outputs), `X-<id>.png` screenshots, `versions-before-after.md` (MCP version numbers), `test-data.md`, `report.md`.

## Route table

The table of every route, its guard and its test is generated into `plans/evidence/X/route-inventory.md` from `lib/authz/route-policy.ts` in both apps (portal 107 routes lines, storefront 44).

## Deferred to after Q (apply only once J23's workstream Q is committed; re-read the files first)

Attack C21 and Q-V25: while `session.impersonatedBy` is set (a seller shops as a customer) the account routes must refuse writes and must not return personal data. All twelve account routes of the storefront (`app/api/account/**`) are wrapped by `accountHandle` in `lib/account/errors.ts`, so one guard covers the writes. Patch 1, in `accountHandle`, before `fn` runs:

```ts
// shop-as (Q-V25, workstream X C21): a seller shopping as a customer may look, never change the account.
const request = args[0];
if (request instanceof Request && request.method !== 'GET' && request.method !== 'HEAD') {
  const session = await getSession();
  if (session.impersonatedBy) throw new AccountError('impersonation-restricted', 403);
}
```

Patch 2 (reads), mask what `/api/auth/me` already masks: in `GET /api/account/profile` and `GET /api/account/addresses` return `maskAccountCustomer(customer)` (from `lib/impersonation/state.ts`) and an empty address list when `session.impersonatedBy` is set; `GET /api/account/payment-methods` returns `[]`. The server-rendered account pages under `(account)` must apply the same masking (they read through `lib/ct/account-*.ts`; put the check in the loader the pages share, not in each page). Tests to add next to `route-policy.test.ts`: for every non-GET account route, a session with `impersonatedBy` gets 403 `impersonation-restricted` and the commercetools trap count stays 0; the three GET routes above return no e-mail, phone, address or card data. Then tick M-X-08 and remove this section's "deferred" wording.

## Progress

J24, 2026-10-12. Gates: `npm run check` and `npm run verify:build` (dummy environment, run in copies of the apps) green in portal and storefront. Evidence in `plans/evidence/X/`. Everything is unit or curl level (no commercetools project, Chrome MCP hanging, ENV-01).

- X-00 done: `route-inventory.md`; real names equal the plan's intended names where the plan used them (hosted Checkout replaced the place-order routes).
- X-01 done: `lib/authz/route-policy.ts` in both apps, `scripts/list-routes.mjs`, `scripts/check-route-policy.mjs` (wired through `check-routes.mjs --static`), generated tests `lib/authz/route-policy.test.ts` (portal personas: anonymous, Admin A, Buyer A, Admin B; storefront personas: anonymous, shopper; the impersonated persona waits for the Q patch). SDK clients and `fetch` are trapped: a refusal only counts with zero calls.
- X-02 done by T: `lib/rules/price-money.ts` (`assertValidPrice`) and `setStandalonePrice` already implement D2; X added `attacks.test.ts` (A01 to A13) and did not duplicate the module.
- X-03 not needed as written: the hosted Checkout (O) has no place-order route or client body; see MISSED-FEATURES and `attack-matrix.md` group B.
- X-04 done as tests: `lib/ct/seller/rule-callers.test.ts` (callers of the chokepoint, raw price actions, Import API client) beside T's `prices.single-writer.test.ts` and R's `admin-client-imports.test.ts`.
- X-05 done differently: one gate in both `proxy.ts` (`lib/security/{origin,api-gate,headers,audit-log}.ts`, identical copies enforced by `check-shared-copies` in the storefront) instead of `withRoute` on each route; includes the page method gate and the cross-origin exemption for the storefront shop-as hand-off.
- X-06 done: the fake Contentools server of J4 (`tools/fake-contentools`, record and override features) replaces `stub-contentools.mjs`; the attack tests start it as a child process.
- X-07 and X-08 done: proxy policy by U was already strict; X added image-only upload by magic bytes with a 5 MB cap, and hardened the storefront proxy (header allow-list, 502 for 3xx and 5xx). `proxy-allowlist.md` lists the routes against the CMS source.
- X-09 and X-10 partly: the attacks are automated tests, not `scripts/attack/*.attack.mjs`; groups A, C (except C21), D, E (server side), G are covered, B by design, F by the owning workstreams' tests (`attack-matrix.md`).
- X-11 done: `scripts/audit-prices.mjs` (+ test with fixtures); live run is M-X-07.
- X-12 done: JWT canary (`jwt.ts`, ignored in production without `ATTACK_MODE=1`), `check-no-attack-mode.mjs` in both apps (check and verify:build), JWT-shape scan in `check-bundle-secrets.mjs` over `.next/static` and `public/`.
- X-13 partly: the curl half ran against production builds (`headers-*.txt`, `csrf-curl.txt`, `methods-and-leaks-curl.txt`); the Chrome and live-data halves are M-X-05, M-X-06.
- X-14 partly: `plans/notes/security-review.md` (manual review; run the `security-review` skill after the lead commits) and `plans/notes/audit.md` (no critical; one documented high, build-time only).
- X-15: report text delivered in the hand-off (J24's final answer); the harness refused a report file.
- New: `check-demo-reset.mjs` for the portal; `PORTAL_ORIGIN` for the storefront framing rule; `app/robots.ts`. Questions Q-X06 to Q-X15, manual items M-X-05 to M-X-08.
- Open: C21 (patch above, one high finding), the browser, Stripe and live-data attacks.
