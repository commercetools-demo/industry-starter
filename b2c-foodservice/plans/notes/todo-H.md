<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items draft, workstream H

Row format from JUNIOR-GUIDE section 5. The lead numbers the OA and SO placeholders and consolidates into `plans/TODO-MANUAL-TESTING.md`. Only the owner sets DONE, PASS, FAIL or WAIVED.

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x2 | Owner | Before images appear on the page | As OA-03: provide IMAGE_SOURCE_URL, then run seed:images | Gallery shows photos instead of the placeholder | TODO |
| SO-x1 | Owner | Before release | 1. Read pdp.guide.*, pdp.care.*, pdp.trust.*, pdp.priceOnRequest in en-US and en-CA. 2. Confirm the compatibility table (Original vs Vertuo; no capsules for bean-to-cup, espresso, filter) and the grind to brew table. | Copy and facts approved | TODO |
| SO-x2 | Owner | Before release | Decide the delivery estimate rule: cut-off hour (default 14:00 local), 2 to 4 business days, weekends skipped | Rule confirmed or changed in lib/shop-config.ts | TODO |
| M-H-01 | Owner | After H | 1. On a real phone open a pod, a coffee and a machine page. 2. Compare with design/export/.../screenshots/pdp.png and 01-pdp2.png. 3. Check the add button is reachable and guide modals read well. | Visual fidelity and flow acceptable | TODO |
| M-H-02 | Owner | After H | 1. On a real phone choose a store, reserve a pod for collection, then switch the same product to Ship and add. 2. Open the bag. | Two separate lines (completed by I) | TODO |
| OA-H-a | Owner | After OA-01 and the seed run | 1. With the commercetools MCP or a read-only script check the five items at the end of `plans/evidence/H/mcp-checks.md` (Product Search exact on `variants.sku`, `recurrencePrices` in the projection, `addLineItem` with `supplyChannel` and with `recurrenceInfo` Fixed, the four recurrence policies). 2. Record the results in that file and any difference in `plans/PROJECT-FINDINGS.md`. | All five behave as the workstream states | TODO |
| M-H-03 | Owner | After H (the browser was busy, so H could not drive it) | 1. `node scripts/mock-ct-server.mjs 9453`, then run the dev server as in the mock header. 2. Walk recipe steps 1 to 10 of `plans/workstreams/H-product-detail.md` at 375 and 1440 px: pods pack change, store choice, coffee grind, machine colour and bundle, subscribe, reserve, guide modals, related strip. 3. Save screenshots to `plans/evidence/H/`. | Console and network clean, layout as the design | TODO |
| M-H-04 | Owner | After H | Check keyboard order (gallery, selectors, cards, button) and a screen reader on the fulfilment radiogroup and the guide dialogs | Usable without a mouse | TODO |
