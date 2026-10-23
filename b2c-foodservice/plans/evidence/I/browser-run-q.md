<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# I browser recipe, run by workstream Q (closes OA-I-b except the live project)

2026-10-22, Chrome DevTools MCP, production build of `ws/q-quality` against the mock commercetools. Steps are those of section 6 of `plans/workstreams/I-cart.md`; 1440x900 and 375x812. Screenshots in this folder.

| Step | Result |
| --- | --- |
| 1 Drawer | Fresh session: the header label reads `Cart, 0 items` and no badge. After a delivery pod, a delivery coffee and a collect pod (Williamsburg): `Cart, 4 items`; the drawer is 440 px wide, `Your bag (4)`, progress `Add $55.35 for free shipping` (75 minus the 19.65 of shippable lines; the collect line does not count), a Collect cluster (`Collect at Malva Coffee Williamsburg`) and a Shipping cluster (`Ship to me`). Focus lands on the close button. `I-01-drawer-1440.png` |
| 2 Quantity and remove | Minus is disabled at 1. Plus: one `PATCH /api/cart/lines/<id>` answered 200, the drawer subtotal `45.00` equals the API subtotal, the line total `$27.90` follows the response. Removing the last line shows `Your bag is empty` and `Start shopping` inside the open drawer, focus on that button. `I-02-drawer-empty-1440.png` |
| 3 Free shipping | With 8 units: `You've unlocked free shipping` |
| 4 Cart page | Two groups (`Collect · Malva Coffee Williamsburg`, `Shipping to you`), chips Collect and Ship with the active one pressed. **Defect found**: the summary was `position: sticky; top: 96px` but sat inside a wrapper as tall as itself (grid with `items-start`), so it scrolled away (top 249, -51, -351, -651 for scroll 0, 300, 600, 900). The checkout summary, a direct grid item, sticks correctly (215, 96, 96). Fixed (QFX-18): the wrapper is the sticky box. `I-03-cart-1440.png` |
| 5 Switch and merge | Done in journey J8 at 1440 and 375: the collect line out of stock at the chosen store shows `Not in stock at Malva Coffee Williamsburg, try shipping` and `Ship instead`; shipping merged two lines of the same SKU into one line of 3; checkout is blocked with `Ship the items that aren't in stock at your store to check out` |
| 6 Codes | `WELCOME10` applied (journey J2); `NOPE123`: `That code isn't valid`, totals unchanged; `COFFEE15` on a $5.70 bag: `This code doesn't apply to your bag`, totals unchanged; with $61.50 of goods it applies (`Subtotal $61.50`, `Discount -$9.22`); removing the coffee leaves the chip with `No longer applies to your bag` and totals without the discount. The mock applies `COFFEE15` to the whole cart, the real code targets coffee. `I-05-codes-1440.png` |
| 7 Tax | US: `Estimated tax` greater than zero for a bag without an address; Canada (journey J1-CA): `Estimated tax $2.23` on `$35.55 + $8.95`. The mock taxes everything at one flat rate per country, so the zero rating of coffee and pods cannot be seen here (live row) |
| 8 Machine nudge | A Vertuo machine alone: `Vertuo Studio needs capsules. Add starter capsules?` with `Add`; pressing it adds one Vertuo capsule line, the total changes in place and the nudge disappears. A bean-to-cup machine: no nudge (the page has no `companion-nudge`) |
| 9 Empty page | `Your bag is empty`, `Let's find something to brew.`, `Shop coffee`, no summary; focus on the button. The minimum order check uses a hook that only exists outside production (`?__min=`): not testable on a release build, covered by unit tests |
| 10 Region switch | Journey J6 (dialog, bag moved to CAD, collect line became delivery, bag was not carried back) |
| 11 375 px | Drawer is full width (375), `Your bag (3)`, no horizontal scroll, close button focused, 18 focusable controls, Tab stays inside. `I-09-drawer-375.png`. Cart page at 375 in journeys J1 to J3: one column, summary after the lines |
| 12 Double click | Two clicks on plus sent two `PATCH` requests, both 200; the quantity went from 1 to 2 (one of the two clicks counted), no error shown. Two tabs: not run (one context); the version conflict path is covered by `lib/ct` tests |
