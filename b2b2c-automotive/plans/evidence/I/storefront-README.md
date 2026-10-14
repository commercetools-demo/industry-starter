<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence I (offline run, `storefront-` prefix)

Setup: production build (`next build` and `next start -p 3012`, so the real CSP applied, no dev eval), `tools/fake-contentools` on 4031 (navy theme for north, green for south), a throw-away local fake of commercetools auth, `stores/key=`, categories, product search and in-store carts, and a local fake Nominatim (it logs each request). No live commercetools call, no secret. Servers stopped afterwards.

| File | Proves |
| --- | --- |
| `storefront-shell-north-1440.png`, `-1024`, `-768`, `-375` | Utility bar, header (store chip, search, garage slot, sign in, cart), category nav, footer on the navy theme; header is one row from 1280 px and wraps below it; at 375 px no horizontal overflow (`scrollWidth` 375), every header, nav and footer control is at least 44 px tall |
| `storefront-shell-south-1440.png` | South store: green theme, no Lighting link (facet count 0), pickup text of the default branch (Austin: "Ship to store") |
| `storefront-shell-single-1440.png` | Single-branch store: no "Your store" chip, utility bar names that branch |
| `storefront-picker-1440.png` | Picker opened by itself on a first visit: list, Leaflet map with OSM tiles (only `tile.openstreetmap.org`, status 200), "Leaflet \| (c) OpenStreetMap contributors" attribution, only the focused row shows "Shop at this store"; no CSP violation, console only shows 404s of link prefetches to pages other workstreams build |
| `storefront-picker-375.png` | Picker stacked on a phone: list above, map below |
| `storefront-picker-geocode-1440.png` | Typing "Lübeck": exactly one `GET /api/store-context/geocode`, the fake Nominatim saw one request with `User-Agent: malva-automotive-storefront/0.1.0 (ops@example.test)`, no cookie, no referer, `countrycodes=de`; list re-sorted by distance, map recentred |

Other checks run in Chrome without a screenshot: choosing a branch sent `POST /api/store-context/branch` (200), the chip changed, `GET branches`, `GET cart/summary` and an RSC refresh followed; reload keeps the choice and does not reopen the picker; Escape closes and focus returns to the chip; `/de-DE` shows "Deutschland (EUR €)", "Kostenloser Versand ab 99,00 €" and `--color-surface-utility` equal to the store theme's secondary (`#101828`); focus ring is 3 px in `--color-focus`. Not run: the MCP checks (M-I-3), the real phone check (M-I-2), geolocation (headless denied path is a unit test), step 12 (needs L, M, N).
