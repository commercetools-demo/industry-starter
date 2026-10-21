<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence, workstream F

No live commercetools credentials existed, so the browser recipe ran against `storefront/scripts/mock-ct-server.mjs` (a local https stand-in for the auth and API hosts with the SEED-PLAN fixtures: six NYC stores, category tree, standard shipping with freeAbove 75 USD and 99 CAD, inventory with two stores at zero). The live re-run is row M-F-03 / OA-x1. Everything below is the real app code through the real SDK client; only the upstream is mocked. Chrome DevTools MCP, Chrome 156; the window cannot go below 500 px, so the "375" captures are at 500 px (below the 820 px breakpoint, so the mobile layout applies).

| File | Proves |
| --- | --- |
| `F-02-mega-1440.png` | Mega menu on hover over Coffee: feature links, shop list, more from Malva, promo tile (category name block, no image in the mock), brew strip, promise bar `Free shipping over $75.00 · Free café collection, ready in 10 min · 30-day returns`, wordmark, five links, store pill, locale pill `US (USD) \| EN`, search, account, cart |
| `F-03-store-picker-1440.png` | Store picker from the header: six NYC stores, address, hours, no availability lines, focus in the search field |
| `F-03b-store-picker-sku-1440.png` | Picker opened with a SKU (dev harness): one availability line per store (out at SoHo and Astoria, low at Brooklyn) |
| `F-04-locale-1440.png` | Locale drawer on /en-CA: current country CAD |
| `F-06-mobile-375.png` | Mobile header: menu toggle, icon-only pills, no horizontal scroll (scrollWidth 485 inside a 500 px window with scrollbar) |
| `F-07-mobile-nav-375.png` | Full-screen menu, accordion with one section open, focus on Close |
| `F-08-picker-375.png` | Store picker fits the narrow viewport |
| `data-checks.md` | Read-backs of the recipe steps and the API contracts |

Console: no errors apart from `GET /api/auth/me` 404 (workstream J builds it; the header treats it as a guest). No request left the app except same-origin `/api/*`.
