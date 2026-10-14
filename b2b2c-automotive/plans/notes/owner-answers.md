<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Owner answers (interview, 2026-10-12)

Source of truth until folded into `DECISIONS.md` and the workstream files. `Applied` says whether the plans and seed already match.

| Q | Answer (owner's words in quotes) | Impact | Applied |
| --- | --- | --- | --- |
| Q-010 | USD and US for `en-US`; EUR and DE for `de-DE` | none, matches current default | Yes |
| Q-012 | "Commercetools full checkout and stripe behind it": hosted commercetools Checkout (full flow) with the Stripe connector | O, P, W (refunds) change from the pay-at-pickup default; OA-05 becomes a real owner action (Stripe test account, connector install) | Yes (O, P, Q, V) |
| Q-002 | Mock plate/VIN provider only | none | Yes |
| Q-005 | "One store per reseller which supports both inventory and pricing": branches are channels that carry both stock and prices | answers Q-I04 (a branch can change price as well as stock); price selection by channel | Partly (check I, L, M, N, T) |
| Q-006 | No Malva-side screens | none | Yes |
| Q-003 | **All standalone prices** (Malva base price too) | seed currently embeds Malva prices; T, L, M price selection and Product Search price facets change | Partly (plans updated; Seed pending) |
| Q-I02 | OpenStreetMap with Leaflet for the store picker | I gains Leaflet and OSM tiles, CSP and attribution | Yes (I plan updated) |
| Q-J03 | Fitment as **year ranges** (make, model, year-from, year-to, engine) | J plan uses explicit vehicle ids; seed `fitment-keys` is already range shaped | Yes (J plan updated; seed shape already matches) |
| Q-P01 | "drop emails": no email sending at all | P loses the mail connector; no outbox; password reset and confirmation are on screen only | Yes |
| (follow-up) | Keep the Marketing and email screens in the portal but they never send | W keeps the screens, no sending | Yes |
| Q-T03 | **No MAP price floor** ("No map", confirmed twice: "no floor"). Resellers may set any price above zero | removes `malva-rules/map-floor`, `assertAboveFloor`, floor attack group A in X, floor checks in seed tests and T; Brand partnership page loses its floor rule; design.md decision 10 narrows to territory only | Partly (plans updated; Seed pending for floor tests) |
| Q-004 | No review gate for themes and pages (publish at once) | none | Yes |
| Q-T06 | Tailored text needs **no approval**; tailoring must **also support tailored images** | T and W drop the approve/reject script and review states; add image tailoring (product tailoring images, upload or URL) to T and the PDP/PLP image selection | Partly (plans updated; Seed pending for seed images) |
| Q-O03 | **No territory blocking** at checkout | removes territory block in O, group B attacks in X, store-countries rule in seed `south`/`north`; design.md decision 10 is void for both floor and territory | Partly (plans updated; Seed pending for store-countries rule) |
| Q-J04 | Signed-in garage is a customer custom field (max 5), anonymous garage a cookie | none | Yes |
| Q-M02 | Non-fitting part can be added to cart with a warning | none | Yes |
| Q-L02 | Exact part/OE number search bypasses fit-only | none | Yes |
| Q-V01 | **Wholesale buying from Malva is out of scope** ("when they pull from master catalog into their product selection, they already have it"). Dropped specs: `sp/design-quick-order-and-cart`, `sp/design-orders-quotes-invoices`, `sp/design-approvals-and-roles`, `sp/design-price-lists-and-saved-lists` | **workstream V is removed**; X, Y, Z, R nav matrix, seed (`mau-malva-wholesale` store, contract groups, approval rules, purchase-order data) and the Admin/Buyer/Approver role matrix shrink; the four design specs need an out-of-scope note and `verify-plan.mjs` must stop requiring them | Partly (plans updated; Seed pending for seed removal) |
| Q-Q06 | **Subscriptions are sold fully** (recurrence policies on selected parts, subscribe option on PDP, recurring orders through checkout, account and portal management) | Q, N, O, M, W change from fixtures/hidden to real; seed needs recurrence policies on parts; Stripe/Checkout must support recurring orders | Partly (plans updated; Seed pending for recurrence policies) |
| Q-U01, Q-001 | Logo and favicon uploaded through Contentools `upload-file`; clean URL stored in store settings | none | Yes (default) |
| Q-Q01 | Return window 30 days from delivery (portal sets `deliveredAt`) | none | Yes (default) |
| Q-W01 | "Shop as" customer: yes, Admin only | none | Yes (default) |
| Q-H02 | Puck SSR may fall back to client-only | none | Yes (default) |
| Q-L01 | Popular is a seeded flag/rank, Top rated uses review rating statistics | none | Yes (default) |
| rest | All other questions keep the default taken in their plan | none | Yes |
| Q-Z01 | Project stays in labs, not ct-builders | Z gate 0 recorded as not applicable | Yes |
