# API run against the local mock (2026-10-21)

Setup: `node scripts/mock-ct-server.mjs 9553`, `next dev -p 3114` with the mock env (mock project key, mock demo password; no real credentials), customer Maya (mock `cust-1`).

| Step | Result |
| --- | --- |
| `GET /api/recurring-orders` before any order | `{"subscriptions":[],"pending":[]}` |
| `POST /api/cart/lines` subscribe, `mcf-every-month`, qty 2; again `mcf-every-2-weeks`, qty 1 | two subscribe lines in the bag |
| Mock hosted Checkout places the order (`POST /__mock/place-order`) | platform-style creation: **two** recurring orders (one per schedule), `originOrderNumber` = the order, `priceSelectionMode` `fixed`, state `active`, next order one interval later |
| `PUT skip` | `pendingSkips` 1, version 2 |
| `PUT skip` again; `PUT setInterval` while a skip is pending | `422 invalid_state` (documented: no schedule change with an active skip) |
| mock processes the skip, `PUT setInterval` 2 months | schedule `Months 2`, same recurring order id, skips 0 |
| `PUT setInterval` unknown policy | `422 subscription_unavailable` |
| `PUT pause` / `PUT resume` | `paused` with no next date / `active` with a new next date |
| `PUT cancel`, then `PUT resume` | `canceled`; resume `422 invalid_state` |
| Liam reads Maya's recurring order id | `404 not_found`, and his own list is empty |
| Guest `GET /api/recurring-orders` | `401 unauthorized`, no detail |

Not covered here (needs a browser or a live project): the rendered tab, dialogs, toasts, 375 and 1440 screenshots, Lighthouse, the hosted Checkout, real `skipConfiguration` semantics.
