<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream M

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-M-a | Owner | Before the live runs of M-03 to M-08 | 1. Decide Q-M-02. 2. Either add `manage_products` to the storefront API client scopes, or provide a second restricted client and tell the team the env variable names (values only in `storefront/.env.local`). | Review writes succeed live; decision recorded | TODO |
| SO-M-a | Owner | Before release | 1. Read the review section and the messages at 375 and 1440 px. 2. Approve or change the wording (these screens are not in the VELA design). | Copy approved | TODO |
| M-M-01 | Owner | Before release | 1. On a real phone write a review with the on-screen keyboard. 2. Tap the stars. | Stars are easy to tap, keyboard does not hide the counter or submit button | TODO |
| M-M-02 | Owner | Only if M-09 was built | 1. After new reviews are posted run `npm run seed:ratings` (or ask the team to). 2. Check the listing rating filter. | Filter reflects the new averages | TODO |
