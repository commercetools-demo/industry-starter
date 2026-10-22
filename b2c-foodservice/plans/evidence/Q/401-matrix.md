<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# 401 matrix: every Route Handler (Q-11, S5, S7, S10)

Written 2026-10-22 by workstream Q from the handlers in `storefront/app/api/**/route.ts` and from `storefront/app/api/api-matrix.test.ts`, at commit `e3bf8f29` (branch `ws/q-quality`).

## Count

- **45** `route.ts` files under `storefront/app/api` (find output, checked against the 45 keys of the table in `api-matrix.test.ts`).
- **62** exported handler functions in those files: 38 mutating (POST, PUT, PATCH, DELETE), 22 GET, 1 OPTIONS, 1 HEAD.
- Only the catch-all `[...rest]` (7 handlers, all answer 404 JSON) and `health` (1 GET) are not wrapped in `handle()`. The other 43 files wrap every handler: **34 of 34** mutating handlers outside the catch-all and 20 of 20 other GET handlers go through `handle()` in `lib/api.ts`, which runs the same-origin and content-type guard (`lib/http/guard.ts`) and adds `Cache-Control: no-store` unless the handler set its own.
- One more handler exists outside `app/api` and is not in the matrix test: `storefront/app/checkout/return/route.ts` (GET). It is listed as row 46.
- Auth classes in `api-matrix.test.ts`: 17 `customer`, 13 `public`, 12 `session`, 1 `owner-or-guest`, 2 `dev` (`dev/session`, `health`).

## Legend

| Word | Meaning |
| --- | --- |
| guest | No session needed. The answer holds no per-person data. |
| session | Works for guests and members. The cart, store and market come from the signed `malva-session` cookie, never from the body or the query. |
| customer | A signed-in shopper. `requireCustomer()` throws 401 `{ error: { code: 'unauthorized', message: 'Sign in required' } }` first, with no detail and no data. |
| owner-or-guest | The order id gates access. A member order is shown to its owner only (404 for anyone else). A guest order is shown to whoever holds the id (a UUID). |
| dev | Removed before the deploy by `npm run predeploy` (Q-15). |
| Guard | `yes` means the request goes through `guardRequest` (foreign `Origin` is 403 `forbidden_origin`, a form body type is 415 `unsupported_media_type`). Reads are never guarded, so `n/a` for GET. |
| Limit key | The first argument of the limiter. Every key is a SHA-256 hash of the route name plus the client address, the address plus the email, or the customer id (`hashKey` in `lib/rate-limit.ts`). The key is never logged. |
| Cache-Control | `no-store (default)` means the handler sets nothing and `handle()` adds `no-store` (commit e6cc495e). |

## Table

| # | Route | Methods | Auth | Guard | Limit key and limit | Cache-Control | Test that proves the 401 or 403 (or why there is none) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/api/[...rest]` | GET POST PUT PATCH DELETE OPTIONS HEAD | guest | none (not wrapped; every method answers 404 and changes nothing) | none | none set by the handler | `app/api/[...rest]/route.test.ts`: `unknown api path answers json 404 for every method` |
| 2 | `/api/account/addresses` | GET POST | customer | POST yes | none | no-store | `addresses-routes.test.ts`: `401 with no detail on every verb` |
| 3 | `/api/account/addresses/[id]` | PATCH DELETE | customer | yes | none | no-store | same test; `Address of another customer is 404, identical to an unknown one` |
| 4 | `/api/account/delete` | POST | customer | yes | `delete-account` + customer id, 5 per 10 min | no-store | `delete-route.test.ts`: `401 with no detail`; `is rate limited after five tries` |
| 5 | `/api/account/password` | POST | customer | yes | `password-change` + customer id, 5 per 10 min | no-store | `profile-routes.test.ts`: `401 with no detail` (covers PATCH profile and POST password); `Password change is rate limited, and the answer carries retryAfterSeconds` |
| 6 | `/api/account/payment-methods` | GET | customer | n/a | none | no-store | `payment-methods-routes.test.ts`: `401 with no detail` |
| 7 | `/api/account/payment-methods/[id]` | DELETE | customer | yes | none | no-store | **No 401 test (gap).** `requireCustomer()` is the first statement (`route.ts:16`). Foreign id: `remove and make default call the ct module for the session customer; a foreign method is 404` |
| 8 | `/api/account/payment-methods/[id]/default` | POST | customer | yes | none | no-store | **No 401 test (gap).** `requireCustomer()` is the first statement (`route.ts:12`). Foreign id: same test as row 7 |
| 9 | `/api/account/profile` | GET PATCH | customer | PATCH yes | none | no-store | `profile-routes.test.ts`: `401 with no detail` |
| 10 | `/api/account/summary` | GET | customer | n/a | none | no-store | `summary/route.test.ts`: `Unauthenticated account call returns 401 with no detail` |
| 11 | `/api/auth/demo-customers` | GET | guest (404 unless demo sign-in is on) | n/a | none | no-store | `demo.test.ts`: `Demo list has names and markets but no email or password`; `demo-login-gate.test.ts`: `Nothing sensitive in the page` |
| 12 | `/api/auth/demo-login` | POST | guest (404 unless `DEMO_LOGIN_ENABLED=true` and a password is set) | yes | `login` (address + email) 5 per 10 min, `login-ip` 30 per 10 min, shared with login | no-store (default) | `demo-login-gate.test.ts`: `Disabled: DEMO_LOGIN_ENABLED not true answers 404 on demo-login`; `demo.test.ts`: `Demo sign-in is rate limited like login` |
| 13 | `/api/auth/login` | POST | guest | yes | `login` (address + email) 5 per 10 min, `login-ip` 30 per 10 min | no-store (default) | `auth-routes.test.ts`: `Unknown and wrong are indistinguishable` (401 `invalid_credentials`); `Login is rate limited and still ambiguous` (429 `too_many_attempts` with `retryAfterSeconds` and `Retry-After`) |
| 14 | `/api/auth/logout` | POST | session (never 401: idempotent) | yes | none | no-store (default) | `auth-routes.test.ts`: `is idempotent without a session`; `Logout keeps market and store` |
| 15 | `/api/auth/me` | GET | session (never 401: `{ customer: null }`) | n/a | none | no-store (default) | `auth-routes.test.ts`: `me returns null not 401`; `Tampered cookie is an empty session` |
| 16 | `/api/auth/register` | POST | guest | yes | `register-ip` (client address) 5 per hour | no-store (default) | `register/route.test.ts`: `invalid input is a 400 and registrations are rate limited per ip` |
| 17 | `/api/availability` | GET | guest | n/a | none | no-store | `availability/route.test.ts`: `response is no-store`; `invalid sku is a 400 with the safe error body` |
| 18 | `/api/cart` | GET PATCH | session (a foreign cart is "no cart") | PATCH yes | `discount-code` (client address) 20 per 10 min, only for `applyDiscountCode` | no-store | `cart-routes.test.ts`: `foreign cart treated as none`; `Two shoppers see only their own cart`. No route test for the limiter (gap, see S10) |
| 19 | `/api/cart/count` | GET | session | n/a | none | no-store | `cart/count/route.test.ts`: `returns 0 without a cart` |
| 20 | `/api/cart/lines` | POST | session | yes | `cart-lines` (client address) 200 per 10 min | no-store | `cart/lines/route.test.ts`: `two shoppers get only their own cart`; `rejects quantity 0 and 100 and bad sku`. No route test for the limiter (gap, see S10) |
| 21 | `/api/cart/lines/[lineId]` | PATCH DELETE | session (the line must be in the session's cart) | yes | none | no-store | `cart-routes.test.ts`: `unknown line 404`; `quantity floor 1 and ceiling 99 and stock clamp` |
| 22 | `/api/channels` | GET | guest (`selectedKey` comes from the visitor's own session) | n/a | none | no-store (default) | `channels/route.test.ts`: `rejects an unknown country`. No per-person data |
| 23 | `/api/checkout` | GET | session | n/a | none | no-store | `checkout-routes.test.ts`: `Two shoppers get only their own cart` |
| 24 | `/api/checkout/complete` | POST | session (only an order of this bag changes the session) | yes | none | no-store | `placement-routes.test.ts`: `an order that is not this bag changes nothing` |
| 25 | `/api/checkout/pickup` | PUT | session | yes | none | no-store | `checkout-routes.test.ts`: `Cart id in the body is ignored`; `an unsigned-in subscription rule answers 401` |
| 26 | `/api/checkout/session` | POST | session (a guest bag with a subscribe line is 401 `sign_in_required`) | yes | none | no-store | `subscription-guest.test.ts`: `session handler answers 401 sign_in_required for a guest bag with a subscribe line`; `placement-routes.test.ts`: `Session is refused when the total moved` |
| 27 | `/api/contact` | POST | guest | yes, plus its own strict 415 for any body that is not JSON | `contact` (client address) 5 per 10 min | no-store (default) | `contact/route.test.ts`: `non-JSON body is 415`; `sixth submission in ten minutes is 429`; `contact route uses the shared limiter: resetting the shared store frees the sixth submission` |
| 28 | `/api/dev/session` | GET POST | dev (404 when `NODE_ENV` is production) | yes | none | no-store (default) | `dev/session/route.test.ts`: `Dev route is 404 in production`. Deleted by Q-15 |
| 29 | `/api/faq-feedback` | POST | guest | yes | `faq-feedback` (client address) 60 per 10 min | no-store (default) | `faq-feedback/route.test.ts`: `unknown question id is 400`; `no personal data is logged`. No route test for the limiter (gap, see S10) |
| 30 | `/api/health` | GET | dev (no auth, not wrapped, no guard) | n/a | none | none set by the handler | `predeploy-check.test.ts`: `Deploy gate fails while app/api/health/route.ts exists`. Deleted by Q-15. **Open (S18)** |
| 31 | `/api/newsletter` | POST | guest | yes | `newsletter` (client address) 10 per hour | no-store (default) | `newsletter/route.test.ts`: `newsletter route uses the shared limiter: the eleventh signup in an hour is 429 with Retry-After` |
| 32 | `/api/orders` | GET | customer | n/a | none | no-store | `orders/route.test.ts`: `401 without a session`; `Own orders only: a customerId in the query cannot override the session` |
| 33 | `/api/orders/[id]` | GET | owner-or-guest | n/a | none | no-store | `orders/[id]/route.test.ts`: `Member order needs the owning session` (404, not 401); `shows a guest order to whoever holds the id` |
| 34 | `/api/orders/[id]/reorder` | POST | customer | yes | none | no-store | `reorder/route.test.ts`: `401 without a session`; `Reorder of another customer's order is 404 and adds nothing` |
| 35 | `/api/orders/[id]/returns` | POST | customer | yes | none | no-store | `returns/route.test.ts`: `401 without a session`; `Return of another customer's order is 404, identical to an unknown order` |
| 36 | `/api/recurrence-policies` | GET | guest | n/a | none | `public, max-age=300` (stable data, no cookie in the answer) | `recurrence-policies/route.test.ts`: `recurrence policies endpoint is public cached` |
| 37 | `/api/recurring-orders` | GET | customer | n/a | none | `private, no-store` | `recurring-orders/route.test.ts`: `list without a session returns 401 with no detail` |
| 38 | `/api/recurring-orders/[id]` | GET PUT | customer | PUT yes, plus its own strict 415 | none | `private, no-store` | PUT: `401 without a session`; `non-JSON body is 415`. GET: **no 401 test (gap)**, `requireCustomer()` is the first statement (`route.ts:14`); `get of another customer's subscription is 404` (all in `recurring-orders/route.test.ts`) |
| 39 | `/api/reviews` | GET POST | GET guest (the list); `GET ?mine=1` and POST customer | POST yes | `reviews` + customer id: create 5 per hour | no-store | `reviews-routes.test.ts`: `Unauthenticated write returns 401 with no detail`; `Own list needs a session`; `Customer id in the body is ignored`; `Rate limit on create` |
| 40 | `/api/reviews/[id]` | PATCH DELETE | customer | yes | `reviews` + customer id: update and delete 30 per hour | no-store | `reviews-routes.test.ts`: `Unauthenticated write returns 401 with no detail` (PATCH and DELETE); `Two customers cannot edit or delete each other's review`; `30 writes per hour, the 31st is 429` |
| 41 | `/api/search` | GET | guest | n/a | none | no-store | `search/route.test.ts`: `invalid params 400`. No per-person data |
| 42 | `/api/session/market` | PUT | session | yes | none | no-store (default) | `session-routes.test.ts`: `tampered cookie is an empty session`; `unsupported market 400` |
| 43 | `/api/session/store` | PUT | session | yes | none | no-store (default) | `session-routes.test.ts`: `unknown store key is rejected` |
| 44 | `/api/shopping-lists` | GET POST DELETE | customer | POST and DELETE yes | none | no-store | `shopping-lists-routes.test.ts`: `401 with no detail on every verb` |
| 45 | `/api/shopping-lists/add-to-cart` | POST | customer | yes | none | no-store | same test (the `ADD_ALL` call) |
| 46 | `/checkout/return` (outside `app/api`) | GET | session (order id or number in the query gates it; only an order of the session's own bag changes the session) | n/a (GET) | none | no-store (default; 303 redirect) | `placement-routes.test.ts`: `an order that is not this bag changes nothing`; `Return route with unknown order lands on No recent order` |

## What proves what

1. **Every route has an entry.** `app/api/api-matrix.test.ts` has four tests, all passing at `e3bf8f29`: `a new route without a table entry fails`, `a table entry without a route fails`, `every customer route calls requireCustomer in each exported method, public routes never read the customer id`, `the dev routes are exactly the ones the deploy gate names`.
2. **The matrix test reads source text. It does not call the routes.** The 401 answers themselves are proven by the route tests named in the last column. Both layers passed in my run (Vitest, 69 files, 550 tests, security set).
3. **I checked each customer file by script.** In all 17 `customer` files the number of `requireCustomer(` calls equals the number of exported handlers (for example `shopping-lists/route.ts`: 3 handlers, 3 calls), and `reviews/route.ts` has 2 and 2 (GET only for `?mine=1`). So no customer method is missing its guard today.
4. **The matrix test is weaker than it looks.** For a customer route it only requires at least one call and at most two per handler (`api-matrix.test.ts:95-96`). If someone removed the call from one method of a multi-method route the test would still pass. Suggested fix: for the 17 `customer` routes require `guards >= handlers` (the test already has both numbers).
5. **Three 401 branches have no test** (rows 7, 8 and the GET of row 38). The code is correct (first statement of each handler). Add three one-line tests.
6. **The browser run with no cookie** is recorded in `journeys.md` J14 step 1 (20 per-person routes without a cookie: 401 `unauthorized` / `Sign in required`, one body shape, `Cache-Control: no-store`; a guest asking for an order by id gets the same 404 as an unknown id) and J12 step 2 (`GET /api/orders` 401, `/api/nothing` JSON 404, a cross-site `Origin` 403 `forbidden_origin`). I cite it and did not rerun it. J14 step 1 also notes that a PUT or PATCH to a route that does not take it is a plain 405 from Next.
7. `/api/shipping-methods` is named in the spec text for S5 but no such route exists. Shipping methods are read on the server (`lib/ct/shipping.ts`). Nothing to do.

## Notes on the guard (S7)

- A foreign `Origin` on a mutating call is 403 `forbidden_origin` before any auth check, so a cross-site call without a session gets 403, not 401.
- A request with no `Origin` header (curl, server to server) is allowed. The session cookie is `SameSite=Lax`, so a cross-site form post does not carry it either.
- The guard refuses form body types only (415). A body with `text/plain` or no content type is read by `req.json()` regardless. Every browser cross-site request carries an `Origin`, so it is already refused with 403. Two handlers (`contact`, `recurring-orders/[id]` PUT) add a strict JSON check of their own.
