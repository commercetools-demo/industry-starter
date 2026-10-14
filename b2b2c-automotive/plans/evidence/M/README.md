<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence for workstream M (product detail page)

Produced with headless Chrome driven over the DevTools protocol (the Chrome DevTools MCP did not answer in this session, see Q-M09) against `next dev` (port 3016, `localhost`) and a throw-away fake of the commercetools endpoints kept outside the repo (store with three branches, categories, store projections with tailoring, master projections, standalone prices with branch, retail and base prices and a Product Discount, inventory, recurrence policies, reviews, orders, carts, one customer). Fake data is synthetic; no real commercetools call. Images are inline SVG stand-ins. The `storefront-` prefix marks these files as the offline run; the live run (rows M-M-2, M-M-3) will write `pdp-*` and `mcp-checks.md`.

| File | Proves |
| --- | --- |
| `storefront-pdp-novehicle-1440.png` | No vehicle: "Select your vehicle to check fit", no fit claim; tailored name, gallery, price, stock, specs, compatible vehicles, related, reviews |
| `storefront-pdp-fit-1440.png`, `storefront-pdp-compat-1440.png` | 2016 Golf active: success banner, "Your vehicle" row highlighted in the compatible list (two grouped rows, no filter box) |
| `storefront-pdp-nofit-1440.png`, `storefront-pdp-added-1440.png` | 2022 Golf: danger banner with "View fitting alternatives"; Add to cart stays enabled; after adding 5 the status panel carries "This part may not fit your ..." with Continue shopping and View cart, header "Cart · 5" |
| `storefront-pdp-storechange-1440.png` | Store changed from the page: stock and address of the new branch, quantity kept |
| `storefront-pdp-subscribe-1440.png` | "Subscribe and save" with "Deliver every" and the current-price line, after a store change, quantity 3 kept |
| `storefront-pdp-de-1440.png` | de-DE: German texts, EUR, struck-through old price and "Sie sparen 2,73 €" (exact difference) |
| `storefront-pdp-375.png`, `-768.png`, `-1024.png`, `-1440.png` | One column at 375 (gallery, identity, banner, price, stock, quantity, button, specs), two columns from 680 px; `scrollWidth` equals `innerWidth` at all four; smallest control 48 px |
| `storefront-pdp-tailored-storeA-1440.png`, `-storeB-1440.png` | Store A: tailored name, description and images; store B: master text and images; part number, specifications and compatible list identical |
| `storefront-pdp-reviewform-1440.png`, `storefront-pdp-reviews-1440.png` | Signed-in buyer: form; after submit the review is first in the list and "Thank you" shows; a second visit says "You have already reviewed this part." |

Also observed (no screenshot): unknown slug and a part withdrawn from the store answer HTTP 404 (`layout.tsx` check above `loading.tsx`, Q-M05); the subscribe post body is `{"sku":"MLV-OF-41014","quantity":3,"recurrencePolicyKey":"mau-rp-half-yearly"}`; a one-time add never carries a policy key; `GET /api/subscriptions/policies` 200 with the three names; a part without `recurring-eligible` has no subscribe radio; changing store from 9,75 € (Hamburg branch price) to 9,97 € (retail or base price) and the stock text, same navigation entry, quantity 4 kept; the JSON-LD `Product` parses and has `offers.priceCurrency`; console shows no errors except the 400 of a test script posting a north branch while the session was on the south store.

Note for whoever repeats this: under `next dev` open the app on `localhost`, not `127.0.0.1`.
