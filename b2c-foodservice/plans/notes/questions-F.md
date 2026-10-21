<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions draft, workstream F

Format `Q-<L>-<n> | question | default | blocks? | Open`. The lead consolidates into `plans/QUESTIONS.md`.

Q-F-1 | How should postcode or town search with distance sorting work without a geocoder? | Client-side match against the six stores plus opt-in browser geolocation; no external service | No | Open
Q-F-2 | Each market has one language (D-030: US and Canada, English only) but the spec expects a language select with several; what does it show? | Select present but disabled with one option; component supports several languages per country | No | Open
Q-F-3 | Region switch with a populated bag: carry over or start empty (template open question; same as Q-I-01)? | Carry over lines that have a price (built in I-12); F ships reset plus an explicit dialog first | No | Open
Q-F-4 | Where do the promise-bar return days come from and what is the value (VELA says 90)? | RETURN_DAYS = 30 in lib/shop-config.ts, flagged for the owner; no commercetools field exists | No | Open
Q-F-5 | Low-stock threshold for 'Low stock at {store}'? | 5 units or fewer, one constant LOW_STOCK_THRESHOLD | No | Open
Q-F-6 | Is collection readiness minutes per store or global? | Per store (channel field collectionMinutes); bar shows chosen store, else the market minimum, else hides the clause | No | Open
Q-F-7 | Newsletter: where do addresses go? | Validated no-op returning 202, no storage, no logging of the address, no confirmation email (D-032); provider is future work | No | Open
Q-F-8 | Primary nav label for pods without using Nespresso as a product brand (D-005)? | 'Pods' with sub-line 'Compatible with Nespresso Original and Vertuo' in the mega menu | No | Open
Q-F-9 | Route Handler table lacks PUT /api/session/store, PUT /api/session/market, GET /api/cart/count, POST /api/newsletter | Build them as named; lead adds them to the table in server-architecture-and-data-flow | No | Open
Q-F-10 | Time zone per store for 'Open today'? | Derived from the store's country in COUNTRY_CONFIG (New_York; all six stores are in NYC and Canada has no stores); channel field is future work | No | Open
Q-F-11 | Mega menu promo tile content (headline, line, image)? | Category image plus catalogue strings; copy approved in SO-x1 | No | Open
Q-F-12 | Does the cart button open the drawer on every page or navigate on small screens? | Open the drawer everywhere; the cart page is reached from 'View bag' | No | Open
