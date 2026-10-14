<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence for workstream J (vehicle finder and garage)

Produced with the Chrome DevTools MCP against `npm run dev` (port 3013) and a throw-away fake of the commercetools endpoints (store, vehicle table custom objects, one customer) that is not in the repo. The specimen page is `/de-DE/mau-store-north/dev/vehicle` (`app/[locale]/[store]/dev/vehicle/page.tsx`, dev only). Fake data is synthetic.

| File | Proves |
| --- | --- |
| `storefront-finder-empty-1440.png` | Empty garage: tabs, four selects (Make first), Verify disabled, garage bar collapsed |
| `storefront-finder-saved-1440.png` | After Verify: chip in header, finder card and garage bar; fit-only listing shows only the Golf VII part and the universal part, each with the fit badge |
| `storefront-listing-nofit-1440.png` | `fit=0`: non-fitting parts show "Passt nicht" |
| `storefront-garage-five-vehicles-1440.png` | Five vehicles, active marked, cap notice, add form |
| `storefront-garage-dialog-375.png`, `storefront-finder-375.png` | 375 px: one column, no horizontal overflow, dialog scrolls |
| `storefront-plate-resolved-375.png`, `storefront-plate-error-375.png` | Mock plate lookup ("Demo lookup", confirm first) and the plain-language failure |
| `storefront-garage-two-vehicles-en-1440.png` | English page, garage restored |

Also observed (no screenshot): years run 2024 to 2012; year 2019 offers 1.4 TSI, 1.5 TSI and 2.0 TDI; the `garage` cookie is HTTP-only and absent from `document.cookie`; no selects on first paint with a saved vehicle; a sixth vehicle drops the oldest non-active one; unknown vehicle ids are 400; `HH-XY 99` asks for the engine and leaves the garage unchanged; a 16 character VIN shows the length message; VIN `WVWZZZAUZGW000001` resolves and saves; sign-in merge (account Audi and Astra plus anonymous Golf gives three vehicles, Golf active, cookie cleared) through `POST /api/garage/merge` with a minted session for the dummy secret; console clean; the browser only called the app's own `/api` routes.
