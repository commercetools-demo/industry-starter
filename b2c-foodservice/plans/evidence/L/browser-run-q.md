<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# L browser recipe, run by workstream Q (closes OA-L-c except the live project)

2026-10-22, Chrome DevTools MCP, production build against the mock (which holds a seeded customer with orders MCF-1001 to MCF-1015). 375x812 for the steps below; the rest were walked at 1440 in journeys J9 to J11. Recipe: A1 to A20 of `plans/workstreams/L-account-area.md`.

| Step | Result |
| --- | --- |
| A1 | Signed out `/en-US/account/orders` goes to `/en-US/account/sign-in?redirect=%2Faccount%2Forders`; after the demo sign-in the shopper is on Orders; the tab title is now `Orders: my account` (it had none: Q-F-19) |
| A2 | New customer and empty states: journey J9 (1440). At 375 the tab strip scrolls (the third tab is cut off, which signals more) and the active tab is in view; no overflow; no target under 24 px. `L-orders-375.png` |
| A3 to A5 | Orders list with pills, details, collect tracker, ready block with directions, Collected and Buy again: journey J11 |
| A6 | Buy again with a line that is out of stock (stock of `MCF-POD-EMBER-50` set to 0 in the mock): the available line was added to the bag (earlier line intact), a dialog `These items could not be added` lists `Ember Ristretto, Out of stock`. The dialog names the product but not the pack, so two packs of one product read alike (idea). `L-A6-buy-again-375.png` |
| A7 | MCF-1005 (two parcels): `Shipments`, `Parcel 1` with carrier and tracking, `Parcel 2` with `Tracking will appear here`, status Shipped. `L-A7-shipped-375.png` |
| A8 | MCF-1007 (delivered): the return dialog lists the item with a 24 x 24 checkbox; after `Start return` the order shows `Goods: Return announced`, `Refund: Refund pending`; set to Returned: `Goods received`; set to Refunded: `Refunded`; the two chips change independently. `L-A8-return-dialog-375.png`, `L-A8-return-refunded-375.png` |
| A9 | Another customer's order MCF-3001 and a made-up number MCF-9999: both HTTP 404, the same card, same response length, no name or email in the page |
| A10 to A17 | Collection, Saved, Addresses, Payment methods, Profile, Settings, Delete: journey J9 (1440) |
| A18 | Canadian customer `/en-CA/account/orders`: tabs Orders, Subscriptions, Saved, Addresses, Payment methods, Reviews, Profile, Settings (no Collection; `/en-CA/account/collection` is a 404), filters All, In progress, Completed, delivery orders only. `L-A18-ca-orders-375.png` |
| A19 | Focus ring on every control checked in the K recipe (R19) and in the dialogs (trap and return fixed, Q-F-14 and Q-F-15) |
| A20 | `/api/account/payment-methods` made to answer 503: the panel shows `Payment methods is unavailable right now.` with `Try again`, the rest of the account renders; after `Try again` the saved methods show. `L-A20-panel-error-375.png` |
