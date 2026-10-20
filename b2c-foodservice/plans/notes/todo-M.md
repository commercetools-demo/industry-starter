<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream M

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-M-a | Owner | Before the live runs of M-03 to M-08 | 1. Decide Q-M-02. 2. Either add `manage_products` to the storefront API client scopes, or provide a second restricted client and tell the team the env variable names (values only in `.env.local`). | Review writes succeed live; decision recorded | TODO |
| SO-M-a | Owner | Before release | 1. Decide whether new reviews need approval (Q-M-01). 2. Read the review section and the messages at 375 and 1440 px. 3. Approve or change the wording (these screens are not in the VELA design). | Moderation policy and copy approved | TODO |
| M-M-01 | Owner | After R6 | 1. In the Merchant Center open Products, then the product, then its Reviews (or Customers, Reviews). 2. Find the pending review and change its state to Approved. 3. Reload the product page. | Review appears and the average and count change | TODO |
| M-M-02 | Owner | Before release | 1. On a real phone write a review with the on-screen keyboard. 2. Tap the stars. | Stars are easy to tap, keyboard does not hide the counter or submit button | TODO |
| M-M-03 | Owner | Only if M-09 was built | 1. After approving reviews in the Merchant Center run `npm run seed:ratings` (or ask the team to). 2. Check the listing rating filter. | Filter reflects the new averages | TODO |
