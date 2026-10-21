<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream M

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-M-a | Owner | Before the live runs of M-03 to M-08 | 1. Create a second API client with scope `manage_products:<project key>` only (D-027). 2. Put its id and secret in `storefront/.env.local` as `CTP_REVIEWS_CLIENT_ID` and `CTP_REVIEWS_CLIENT_SECRET` (names only here). | Review writes succeed live; decision recorded | TODO |
| SO-M-a | Owner | Before release | 1. Read the review section and the messages at 375 and 1440 px. 2. Approve or change the wording (these screens are not in the VELA design). | Copy approved | TODO |
| M-M-01 | Owner | Before release | 1. On a real phone write a review with the on-screen keyboard. 2. Tap the stars. | Stars are easy to tap, keyboard does not hide the counter or submit button | TODO |
| M-M-02 | Owner | Only if M-09 was built | 1. After new reviews are posted run `npm run seed:ratings` (or ask the team to). 2. Check the listing rating filter. | Filter reflects the new averages | TODO |
| M-M-03 | Owner | After OA-01 and OA-M-a | 1. `cd seed && npm run seed -- --dry-run`, then run it: the `mcf-review` custom type is created; run again: `0 change(s)`. 2. `npm run verify` passes. 3. Run browser recipe R1 to R16 of `plans/workstreams/M-reviews-and-ratings.md` against the live project (only the mock was exercised: `plans/evidence/M/`). 4. Confirm a duplicate review POST fails with `DuplicateField` (Q-M-13) and that statistics update within seconds. 5. Place an order for a QA customer, review that product: the Verified purchase badge shows. | All pass; test reviews (`rev-` keys) listed for the cleanup manifest (D-019) | TODO |
| M-M-04 | Owner | Before release | Browser run in Chrome (the Chrome DevTools MCP was held by another session during M): open a product with reviews at 375 and 1440 px, check focus rings, the stars with the arrow keys, the sort select, Show more, and `/en-CA`. | Looks right, console clean | TODO |
