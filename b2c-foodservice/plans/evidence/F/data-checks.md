<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Data checks, workstream F (mock upstream, keys only)

Upstream was `scripts/mock-ct-server.mjs`, not the live project (no credentials). Re-run against the live project is row M-F-03.

| Check | Result |
| --- | --- |
| `GET /api/channels?country=US` | 6 stores: `mcf-store-nyc-soho`, `-brooklyn`, `-upper-west`, `-chelsea`, `-williamsburg`, `-astoria` |
| `GET /api/channels?country=CA` | `{ stores: [], selectedKey: null }` |
| Promise bar US | `Free shipping over $75.00 · Free café collection, ready in 10 min · 30-day returns` (minimum over stores, no store chosen) |
| Promise bar CA | `Free shipping over $99.00 · 30-day returns` (no collection clause) |
| Store pill, locale pill, footer Collect column on /en-CA | all absent; locale pill `CA (CAD) \| EN` |
| `GET /api/availability?sku=POD-ORIG-10&country=US` | `Cache-Control: no-store`; ship `in`; astoria 0 `out`, brooklyn 3 `low`, chelsea 22 `in`, soho 0 `out`, upper-west 40 `in`, williamsburg 9 `in` |
| Store selection | Picked Brooklyn: pill `Collect at Malva Brooklyn`, toast `Collecting from Malva Brooklyn` gone after about 2.2 s, persisted across reload (HttpOnly cookie, not readable by script) |
| Switch to Canada | URL `/en-CA`, then `/api/channels?country=US` returned `selectedKey: null` (store cleared) |
| `GET /api/cart/count` fresh session | `{ count: 0 }` |
| Session cookie contents | Decoded in unit tests (`app/api/session/session-routes.test.ts`): market fields, `collectionStoreKey`, customer fields kept, no token or secret |
| Not checked live | project `countries/currencies/languages`, real inventory, real hours format (Q-F-16), cart count with a real cart |
