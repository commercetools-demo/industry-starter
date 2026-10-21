<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# G browser recipe read-backs (mock upstream with the seed data)

Read with `evaluate_script` on the running app (`http://localhost:3010`). Ids and keys only.

| Recipe step | URL or action | Result |
| --- | --- | --- |
| 1 `/shop` | `/en-US/shop` | 41 products, 24 cards on page 1, 3 grid columns at 1440, groups: Category, Machine system, Intensity, Roast, Brew method, Origin, Decaf, Organic, Fairtrade, Color, Price, Rating, Collection; `<meta robots>` absent on the clean URL |
| 2 facets | `/en-US/category/pods?f_intensity=8` | H1 Pods, crumbs "Home > Pods", 2 products; intensity counts `4:1 5:2 6:2 7:2 8:2* 9:1 11:1 12:1`, 1/2/3/10/13 disabled; Price `p0:2 p2:2`; Rating `4.5:0 (disabled) 4.0:1` |
| 3 dead ends | same page | zero-count options render as disabled buttons; `?f_system=vertuo&f_decaf=true` gives the empty state with two chips and Clear all |
| 4 sort | `/en-US/shop?sort=price-asc` | `data-price` of the 24 cards: 570 570 590 590 620 650 790 790 820 830 850 890 1295 1395 ... 1795, ascending; select shows the option; `/en-CA/shop?sort=rating` first cards Drip Filter 10 (5.0, 3 reviews), Espresso Roma (4.9, 8), Organic Sumatra (4.8, 4), prices in CAD (`$108.25`), no "Choose a store" or "Available at" anywhere in the Canada page |
| 5 store | `PUT /api/session/store` (Williamsburg), `/en-US/shop?avail=1` | 39 products (Ember Ristretto and Pod One, the two seed products at 0 in that store, are gone); chip "Available at Malva Coffee Williamsburg" pressed; card lines "In stock / Low stock / Not available at Malva Coffee Williamsburg" (e.g. Ember Ristretto "Not available" on `/category/pods` without the toggle) |
| 6 rating | tested through the mock engine contract test (`scripts/mock-fixtures/mock-catalog.test.ts`: every result has `averageRating >= 4.5`) | pass |
| 7 search | `?q=mcf-pod-ember-50` | first card Ember Ristretto with "Matched SKU MCF-POD-EMBER-50"; `<meta name=robots content=noindex>`; sort options start with "Best match". `?q=yirgachefe` returns Ethiopia Yirgacheffe. `?q=zzzzqq`: no-results state, query editable and focused, "Browse by category" (5 roots) and 3 to 4 Bestsellers. Empty `?q=` shows the prompt (unit test: no search call) |
| 8 quick add | click Quick add on Ember Ristretto twice | header badge 1 then 2 without reload, toast "Added to bag", `GET /api/cart` `{count: 2, lines: [{sku: MCF-POD-EMBER-10, quantity: 2}]}` (the mock merges equal lines); Quick add on Ethiopia Yirgacheffe navigated to `/en-US/p/ethiopia-yirgacheffe/MCF-COF-YIRG-250-WB?choose=grind` and the count stayed 2 |
| 9 history | filter, filter, open a product, Back | URL `?f_organic=true&f_system=original`, "1 product", both chips, `scrollY` 400 restored |
| 10 pagination | `/en-US/shop?page=99&f_decaf=true` and `?page=99` | redirected to `?f_decaf=true` (2 products, no pager) and `?page=2` (17 cards, "Previous 1 2", `rel=prev` link in head) |
| 11 mobile | 500 px | 2 columns, sheet counts and Apply as in `G-04`; Filters badge shows the active count (2) |
| 12 keyboard | not walked by hand in this session | Quick add and heart are revealed by `group-focus-within`, tested by class assertions (`ProductCard.test.tsx`); tab order walk is row M-G-04 |
