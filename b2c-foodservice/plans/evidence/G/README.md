<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence, workstream G (Browse)

The project is not seeded and no live credentials exist, so the browser recipe ran against the real app and the real SDK client with the upstream replaced by `storefront/scripts/mock-ct-server.mjs`. In G that script serves the seed package's data (`scripts/mock-fixtures/seed-fixtures.json`, generated from `seed/src/data`): 41 products with prices in USD and CAD, per-store stock, review statistics, the real category tree, six stores, and a Product Search engine for the request shape `lib/search/build.ts` produces. Start it and the app as described in the header of the script (use `NODE_EXTRA_CA_CERTS=<printed certificate path>`; with `NODE_TLS_REJECT_UNAUTHORIZED=0` next/font failed to load in dev here; Turbopack dev also failed on fonts in this sandbox, `next dev --webpack` worked, `next build` is fine). The live re-run is rows OA-G-a and M-G-03. Chrome DevTools MCP, window minimum width 500 px, so the "375" captures are at 500 px (below the 900 px sheet breakpoint, so the mobile layout applies).

| File | Proves |
| --- | --- |
| `G-01-shop-1440.png` | `/en-US/shop`: 13 facet groups with seed counts, toolbar, 3-column grid, count line "41 products" (equals the mock engine total and the seed product count), cards with category, name, rating, "From $5.90", "$0.59 per capsule", intensity label, "Choose a store" |
| `G-02-pods-filtered-1440.png` | `/en-US/category/pods?f_intensity=8`: breadcrumb Home > Pods, intensity button grid with 8 selected and the Intensity group's own counts intact (4:1 5:2 6:2 7:2 8:2 9:1 ...), zero-count options disabled, other groups recomputed (Category 1/1, Machine system 1/1), removable chip and Clear all, 2 products (Casa Espresso, Gran Lungo Reserve = the two intensity 8 pods in the seed) |
| `G-03-plp-375.png` | 500 px: 2 columns, no horizontal scroll (checked `scrollWidth <= innerWidth`), Filters button, availability chip with the chosen store, sort select, quick add clipped inside the image |
| `G-04-filter-sheet-375.png` | Filter sheet: draft selection (Machine system Original, Organic), button reads "Show 1 result" from the countOnly call; Apply navigated once to `?f_organic=true&f_system=original` and closed the sheet (Andes Organic) |
| `G-05-empty-375.png` | `?f_system=vertuo&f_decaf=true`: "No products match these filters.", both chips removable, Clear all filters |
| `data-checks.md` | Read-backs for the other recipe steps (sort, CAD, store availability, search, quick add, pagination, history) |

Console: no errors apart from `GET /api/auth/me` 404 (workstream J builds it) and Chrome's preload warnings for fonts. No request left the app except same-origin `/api/*` (the dev server reached the mock, never a commercetools host).
