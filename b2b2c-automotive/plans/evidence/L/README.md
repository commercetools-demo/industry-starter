<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence for workstream L (product listing and search)

Produced with the Chrome DevTools MCP against `next dev` (port 3014, `localhost`) and a throw-away fake of the commercetools endpoints (store with three branches, categories, Product Search evaluator, store projections, standalone prices, inventory, product type, carts, one customer, the vehicle table) kept outside the repo. Fake data is synthetic; no real commercetools call. Images are inline SVG stand-ins.

| File | Proves |
| --- | --- |
| `storefront-plp-novehicle-1440.png` | No vehicle: "Select your vehicle to check fit" on cards, count line with the branch city, Pickup, Brand with counts, sort select |
| `storefront-plp-fit-1440.png` | Vehicle active (2016 Golf 2.0 TDI): fit-only, 14 parts, every card "Fits your vehicle", Fits my vehicle toggle |
| `storefront-plp-nofit-1440.png` | `fit=0`: 30 parts, non-fitting cards say "Does not fit" and offer "View fitting alternatives" instead of Add to cart |
| `storefront-plp-empty-1440.png` | Dashed empty state with three removable chips and Clear all |
| `storefront-search-1440.png` | Search for a part number of a part that does not fit the active vehicle: it is shown (bypass), once, with "Does not fit" |
| `storefront-plp-1024.png`, `storefront-plp-768.png` | No horizontal overflow, 3 columns at 1024, 2 columns (229 px cards) at 768 beside the 230 px panel |
| `storefront-plp-375.png`, `storefront-filters-sheet-375.png` | Panel replaced by a 48 px "Filters" button; sheet with the same form and Apply |

Also observed (no screenshot): `sort=price-asc` prices ascending (24 of 24); brand click writes `brand=alpendyn` and keeps `fit` and `sort`; `?q=MLV-BP-41005` is first and `noindex`; `?q=brake` ordered by relevance ("Best match"); `?q=` shows the prompt and makes no search call; category `brake-pads` has the breadcrumb `Home > Brakes > Brake pads` with `aria-current`, an empty category answers the not-found page; `page=99` redirects to the last page and `rel="prev"` is emitted; two "Add to cart" presses read "Cart · 1" then "Cart · 2" without reload, `POST /api/cart/lines` 200, the fake's cart line has the retail channel as distribution channel and the Berlin branch as supply channel, the browser only called same-origin `/api` routes; changing the branch (`POST /api/store-context/branch`) switched the stock lines from Berlin to Hamburg and the pickup count to 22; `/de-DE` shows German texts, EUR prices ("24,43 €"), console clean (no errors or warnings).

Note for whoever repeats this: under `next dev` open the app on `localhost`, not `127.0.0.1` (dev resources answer 403 for other origins, so nothing hydrates).
