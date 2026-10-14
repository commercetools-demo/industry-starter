# Workstream V browser recipe log (J19, 2026-10-12)

Driver: a throw-away headless Chrome over the DevTools protocol (kept outside the repo). The Chrome DevTools MCP did not answer
(`list_pages`: no response for 1800 s, ENV-01). Server: portal `next dev --webpack -p 3160` with `PORTAL_DEV_FIXTURES=on` (in-memory
fixture client `lib/portal/v-fixture-root.ts`, dummy environment, no commercetools call). Turbopack was tried first and reloaded the page
continuously because other juniors change files under the shared repository root. Sessions: `/api/dev/session?as=adminA|buyerA|adminB`.
Nothing here ran against the live project (see M-V-05 to M-V-12).

## Recipe 1 and 2: navigation, customers
- Admin A navigation shows Customers, Subscriptions, Returns, Reviews; no "Shop from Malva" group: true.
- List shows the e-mail masked (`a***@e***.com`) and no full address: true. Guests tab: only guest rows, caption "Checked out without an account": true.
- `fetch('/api/seller/customers/<id of store B>?storeKey=<A>')` -> 404. Forged `storeKey` of store B in the query -> 403. Cancel of a store B subscription with A's session -> 404.
- Customer detail: full e-mail, garage vehicle "2016 Volkswagen Golf · 2.0 TDI", consent shown. "Mark delivered" on an undelivered order: the date chip shows. Note `TST-V-note` added and listed.
- Admin B sees only its own shopper (no store A shopper).

## Recipe 3: shop as customer (portal side)
- "Shop as customer": the form handoff is a POST, target `_blank`, token in a hidden field; `location.href` and the form action carry no token (`network-shop-as.txt`). Portal banner "You are shopping as Cem Probe. Orders are placed on their behalf." shows with "Exit customer session"; exit -> 200. The storefront landing is deferred (MISSED-FEATURES, V rows), so the storefront half was not exercised.

## Recipe 4: subscriptions
- Pause (toast "Subscription paused"), Paused tab shows the warning chip and "-" for the next renewal, Resume, Skip next ("Next renewal skipped"), History drawer lists the action ("Pause: Active to Paused" style lines), Cancel with confirmation (final: every action of a canceled row is disabled with its reason text).

## Recipe 5: returns
- List: Open tab with chips Inspected + "Refund failed", Requested, Received; KPIs Open returns, Return rate (last 90 days), Refunded this month.
- Drawer of an inspected return with a failed Refund transaction: "Retry refund" -> refund dialog (amount default = the largest possible, text "The refund is sent to Stripe through commercetools Checkout and is final when Stripe confirms.") -> "Refund requested". The fixture connector confirms a pending refund on the second Payment read, so the next load shows the return under Closed as Refunded.
- Record a return: an order delivered 45 days ago -> "The return window for this order has closed."; an undelivered order -> "has not been delivered yet"; an unknown order -> "Order not found."; a delivered order (30 day text and the delivery date shown) -> toast "Return RET-MLV-103-2 created, tracking RT-20261013-81FR3".
- Wrong-fit return drawer: chip "Wrong fit", "Vehicle at purchase: 2016 Volkswagen Golf · 2.0 TDI", "Fit result then: Does not fit"; disallowed moves are disabled with their reason text.

## Recipe 6: reviews
- KPIs Average rating, This month, Unanswered; reply to the 2-star review -> toast "Reply posted", Unanswered drops by one; hide and show through the action button.

## Buyer (persona buyerA)
- `/customers` shows "You don't have access to this page"; the navigation has no Customers or Subscriptions (Returns and Reviews stay, read only: R's table); `GET /api/seller/subscriptions` -> 403; `POST /api/seller/returns/<n>/transition` -> 403; the Returns page has no "Record a return" button.

## Quality
- Console errors on every page: none. Failed requests: only the deliberate 403 and 404 probes above.
- Screenshots at 1440, 1024 and 375 (`portal-<page>-<width>.png`) for customers, customer detail, subscriptions, returns, reviews; de-DE returns at 1440. jest-axe passes for the list and detail components (unit tests); the Lighthouse audit is part of M-V-12.
