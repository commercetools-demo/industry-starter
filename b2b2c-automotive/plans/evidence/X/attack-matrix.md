<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Attack matrix (workstream X)

Proof kinds. P1 status and code, P3 the commercetools clients were never called (trapped SDK or mocked service) and, for the proxy, the fake Contentools request log is empty or free of the attacker's values. P2 (a live read-back of versions) needs the real project and is M-X-06. `T` = automated test run by `npm run check`; `C` = curl against a production build (files in this folder); `L` = needs the live project or Chrome (not run here); `D` = deferred. Tests live in `portal/` unless prefixed `sf:`.

| ID | Result | Proof |
| --- | --- | --- |
| A01 zero and negative price | T pass | `lib/ct/seller/attacks.test.ts` (400 INVALID_MONEY, zero price writes) |
| A02 one cent accepted (no floor) | T pass | same file |
| A03 and A04 batch with a bad row is refused whole | T pass | same file, `prices.test.ts` (bulk and CSV share `publishPrices`) |
| A05 bundle values | T (W's tests) | `lib/bundles/rules.test.ts`; not re-attacked here; L for the product read-back |
| A06 and A07 discount values | T pass for relative and absolute bounds, thresholds, code format | `attacks.test.ts` (Q-X08: 100 percent and absolute above price are accepted by design) |
| A08 wrong currency | T pass | `attacks.test.ts` |
| A09 money abuse (string, object, highPrecision, 8315.5, 1e308, 2^53+1, NaN) | T pass | `attacks.test.ts` (route schema 400, service INVALID_MONEY) |
| A10 SKU of another store, foreign storeKey | T pass; L for the read-back | `attacks.test.ts`, `route.cross-store.test.ts` |
| A11 mass assignment | T pass | `attacks.test.ts` (strict schemas) |
| A12 branch channel abuse | T pass (price); stock route in `route.cross-store.test.ts` and `route-policy.test.ts` | `attacks.test.ts`, `branch-stock.test.ts` |
| A13 race of valid and invalid writes | T pass | `attacks.test.ts` (never 0 or negative at any poll) |
| A14 admin client or secret in the browser | T and gate pass | `admin-client-imports.test.ts`, `rule-callers.test.ts`, `check-bundle-secrets.mjs` in `verify:build` (output in `portal-verify-build` summary of the report); `audit-prices.mjs` L (M-X-07) |
| B01 to B10 | partly by design | hosted Checkout: no place route and no client body (`POST /api/checkout/session` takes none, delivery takes an enum); return route tests `sf:app/checkout/return/route.test.ts`, `sf:lib/checkout/return.test.ts`; B02, B03, B05 need Stripe (L, M-X-06) |
| C01 to C03 Buyer on Admin routes | T pass, 79 generated cases | `lib/authz/route-policy.test.ts` (403, zero commercetools calls) |
| C04 to C07 role assignment, last admin, system roles | T (R's tests) | `lib/authz/permissions.test.ts`, `app/api/company/**` tests; L for the unit read-back |
| C08 session forgery | T pass | `lib/session-forgery.test.ts`, `sf:lib/session-forgery.test.ts`; C `misc-curl.txt` (forged cookie is 401) |
| C09 spoofed headers | T and C pass | `route-policy.test.ts` ignores them by construction; `misc-curl.txt` (x-preview-role, x-business-unit-key, x-middleware-subrequest: 401) |
| C10 to C13 IDOR | T for scoping (75 cross-store tests, store key from the session or refused 403); L for real records | `route.cross-store.test.ts` per seller route, `sf:lib/ct/account-*.test.ts`; M-X-06 |
| C14 and C15 query and body overrides | T pass | generated "other store in query or body" cases (80) |
| C16 sign-in under another store | T (Q's) | `sf:app/api/auth/login-store-binding.test.ts` |
| C17 storefront account IDOR | T pass for the 401 rule; scoping by design (`customerId` and store in every query, `safeId`) | `sf:lib/authz/route-policy.test.ts`, `sf:lib/ct/account-*.test.ts` |
| C18 no cookie on non-public routes | T pass (117 portal cases, 19 storefront) and C | `route-policy.test.ts`, `misc-curl.txt`, `headers-storefront.txt` |
| C19 CSRF | T and C pass | `lib/security/origin.test.ts`, `proxy.api-gate.test.ts`, `csrf-curl.txt` (403 CROSS_ORIGIN, 415 for text/plain, deny lines in `server-*-deny-lines.txt`); L: the evil page in Chrome |
| C20 shop-as misuse | T (V's tests) | `sf:app/api/impersonate/route.test.ts`, `lib/impersonation/token.test.ts`; storefront cross-origin hand-off is the one exempt route |
| C21 impersonated session abuse | D | patch in the workstream file, M-X-08 |
| D01 to D08, D10 to D14 proxy | T pass against the fake Contentools request log | `app/api/contentools/[...path]/route.attacks.test.ts`, `route.test.ts` |
| D09, D11, D12, D13, D14 storefront proxy | T pass | `sf:app/api/contentools/[...path]/route.attacks.test.ts` |
| E01 client bundle | T and C pass | `check-bundle-secrets.jwt.test.mjs`, `methods-and-leaks-curl.txt` (0 files with the canary in `.next/static`, 0 source maps) |
| E02 to E04 HTML, RSC, network, storage | E02 C pass for the sign-in page; the rest L | `methods-and-leaks-curl.txt`; M-X-05, M-X-02 |
| E05 error paths | T pass | `route.attacks.test.ts` (D13: no token, no upstream text) |
| E06 server logs | T pass | `origin.test.ts` (audit log drops token, authorization, cookie, password, email, jwt keys); `server-*-deny-lines.txt` |
| E07 source maps | C pass | 0 `.map` files, `productionBrowserSourceMaps: false` |
| E08 placeholder token constant | T pass | `components/contentools/placeholder.ts` is a literal; `jwt.canary.test.ts` for the canary rule |
| E09 storefront holds no JWT | T pass | `sf:route.attacks.test.ts` (no authorization is ever sent), no JWT code in the storefront |
| F01 to F05 cart integrity | T (L's and M's tests) | `sf:app/api/cart/*` tests: strict schema `{ sku, quantity 1..99, recurrencePolicyKey }`, ids from the session |
| F06 and F07 returns, refunds | T (V's tests) | `lib/ct/seller/returns.test.ts` |
| F08 reviews | T (V's and M's tests) | `lib/ct/seller/reviews.test.ts`, `sf:lib/ct/reviews.test.ts` |
| F09 subscriptions | T (V's and Q's tests) | `lib/ct/seller/subscriptions.test.ts` |
| F10 and F11 tailoring text and images | T | `lib/catalog/image-url.test.ts`, `image-rules.test.ts`; React escapes text; no `dangerouslySetInnerHTML` of user text (review) |
| F12 to F15 CSV, template, import, search | T (W's tests) | `lib/import/*.test.ts`, `lib/email/render.test.ts` |
| G01 headers | C pass | `headers-portal.txt`, `headers-storefront.txt`, `sf:next.config.headers.test.ts`, `lib/csp.test.ts` |
| G02 cookie flags | T and C pass | `session-forgery.test.ts`, `csrf-curl.txt` (`Secure; HttpOnly; SameSite=lax; Path=/`) |
| G03 x-powered-by | C pass | `methods-and-leaks-curl.txt` |
| G04 no dev pages and no health in release | T and gate pass | `check-no-dev-pages`, `check-no-health-in-release`; storefront `/api/health` is 404 (`headers-storefront.txt`) |
| G05 error pages | C pass | no stack in the 401, 404 and 405 answers captured here |
| G06 npm audit | exception documented | `plans/notes/audit.md` |
| G07 CSP violations in use | L | M-X-05 |
| G08 open redirect | T pass | `lib/next-path.test.ts`, `sf:lib/auth/safe-next.test.ts` |
| G09 page methods | C pass for PUT, DELETE (405); TRACE answers a generic 500 from Next | `methods-and-leaks-curl.txt` |
| G10 portal noindex | C pass | `headers-portal.txt` (`X-Robots-Tag`, `robots.txt` disallows all) |
