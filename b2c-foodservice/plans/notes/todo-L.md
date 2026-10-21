<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream L

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-L-a | Owner | Before L-10 and L-12 live runs | 1. Confirm the API clients supplied in `storefront/.env.local` (OA-01) have the scopes: the storefront API client scopes include `manage_customers`, `manage_orders`, `manage_shopping_lists`, `view_payments` and `manage_payments`. | Handlers work against the live project | TODO |
| OA-L-b | Owner | Before M-L-03 | 1. In the Checkout Application enable Stored Payment Methods. 2. Confirm the connector you installed supports them. | A checkout offers "save this card" | TODO |
| SO-L-a | Owner | Before release | 1. Read the Collection tiles (US market only) and the delete-account modal text in `/en-US/account/collection` and `/settings`. 2. Approve or change the wording, especially what is erased and what is kept. | Copy and legal text approved | TODO |
| SO-L-b | Owner | Before release | 1. Decide the returns window (days) and which items can be returned (consumables such as opened coffee?). 2. Tell the team the numbers. | Policy recorded; `RETURN_WINDOW_DAYS` and eligibility updated | TODO |
| M-L-01 | Owner | Before release | 1. On a real phone sign in and open each tab. 2. Swipe the tab strip. 3. Add an address with the on-screen keyboard. | No horizontal page scroll, active tab visible, keyboard does not hide fields | TODO |
| M-L-02 | Owner | Before release | 1. On a real phone with an order in "Ready for collection", tap "Get directions". | The phone's maps app opens at the store | TODO |
| M-L-03 | Owner | After OA-K-a and OA-L-b | 1. Check out and tick save card, pay with the PSP test card. 2. Open Payment methods. 3. Remove the card. | Card listed with a label and default flag, removal hides it, no card number shown anywhere | TODO |
| M-L-04 | Owner | Before release | 1. In the Merchant Center change an order to Ready for collection. 2. Open Orders in the account. | Pill and ready block update | TODO |
