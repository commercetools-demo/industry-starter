<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items draft, workstream I

Row format from JUNIOR-GUIDE section 5. The lead numbers the OA and SO placeholders and consolidates into `plans/TODO-MANUAL-TESTING.md`. Only the owner sets DONE, PASS, FAIL or WAIVED.

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| SO-x1 | Owner | Before release | 1. Read cart.* strings (empty states, nudge, notices, gift note prompt) in en-US and en-CA. 2. Approve or edit. | Copy approved | TODO |
| SO-x2 | Owner | Before release | Decide whether a minimum order value applies (per currency, amount); default none | Value set in lib/shop-config.ts or 'none' confirmed | TODO |
| M-I-01 | Owner | After I | 1. On a real phone add a pod for collection and a machine to ship. 2. Open the bag, switch lines, apply WELCOME10. 3. Compare with design/export/.../screenshots/cart.png and cart2.png. | Groups, chips and totals read clearly | TODO |
| M-I-02 | Owner | After I | 1. In a real browser change country from US to Canada with a full bag including a collect line. | Bag moves, notice readable, prices in CAD, the collect line became a ship line | TODO |
