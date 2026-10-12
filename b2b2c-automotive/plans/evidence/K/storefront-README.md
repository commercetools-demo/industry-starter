<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream K storefront evidence (against fakes, no live calls)

Setup: `tools/fake-contentools` on 4010 (fixtures), a throw-away stand-in for the commercetools endpoints on 4020 (kept outside the repo: stores with branches, categories, 10 ranked parts, standalone prices, vehicle table), `next dev -p 3015` with env pointing at both. All servers stopped afterwards. Chrome could not go below 500 px wide, so the "375" shot is 500 px wide (single column).

| File | Proves |
| --- | --- |
| `storefront-home-1440.png` | north, published page: navy hero band with finder card, eyebrow, H1, pickup line, "Shop all parts"; five tiles; promo "Brake week"; 8 popular cards (In stock · Berlin, Ships in 2–3 days, old price); brand strip |
| `storefront-home-south-1440.png` | south, published page: green theme, hero without finder, standalone finder block, 4 popular cards |
| `storefront-home-default-1440.png` | `qa-nopage` (no published page): default layout (hero with finder, tiles, popular) |
| `storefront-home-contentools-down-1440.png` | `FAIL_MODE 500` on a cold cache: default layout, no console errors or warnings |
| `storefront-home-375.png`, `-768.png`, `-1024.png` | responsive; `scrollWidth` below viewport width at 500 and 1024 |
| `storefront-home-saved-vehicle-de-1440.png` | de-DE with a saved Golf: chip shown on first paint, no selects, popular shows only the 5 fitting parts, EUR prices |

Also checked: no console errors, browser fetches only `/api/cart/summary`, `/api/store-context/branches`, `/api/garage` (no Contentools, no commercetools call). MCP checks need credentials: row M-K-2.
Note: a warm Next fetch cache keeps serving the last published page while Contentools is down (stale on revalidate); the default layout shows on a cold cache.
