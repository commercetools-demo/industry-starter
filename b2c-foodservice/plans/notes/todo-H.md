<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items draft, workstream H

Row format from JUNIOR-GUIDE section 5. The lead numbers the OA and SO placeholders and consolidates into `plans/TODO-MANUAL-TESTING.md`. Only the owner sets DONE, PASS, FAIL or WAIVED.

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x2 | Owner | Before images appear on the page | As OA-03: provide IMAGE_SOURCE_URL, then run seed:images | Gallery shows photos instead of the placeholder | TODO |
| SO-x1 | Owner | Before release | 1. Read pdp.guide.*, pdp.care.*, pdp.trust.*, pdp.priceOnRequest in en-US and de-DE. 2. Confirm the compatibility table (Original vs Vertuo; no capsules for bean-to-cup, espresso, filter) and the grind to brew table. | Copy and facts approved | TODO |
| SO-x2 | Owner | Before release | Decide the delivery estimate rule: cut-off hour (default 14:00 local), 2 to 4 business days, weekends skipped | Rule confirmed or changed in lib/shop-config.ts | TODO |
| M-H-01 | Owner | After H | 1. On a real phone open a pod, a coffee and a machine page. 2. Compare with design/export/.../screenshots/pdp.png and 01-pdp2.png. 3. Check the add button is reachable and guide modals read well. | Visual fidelity and flow acceptable | TODO |
| M-H-02 | Owner | After H | 1. On a real phone choose a store, reserve a pod for collection, then switch the same product to Ship and add. 2. Open the bag. | Two separate lines (completed by I) | TODO |
