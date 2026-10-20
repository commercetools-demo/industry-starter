<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Owner items: workstream N (subscriptions)

Draft for the lead to merge into `TODO-MANUAL-TESTING.md`. `OA-02` already exists there; the other ids are placeholders the lead numbers (`OA-N1`, `SO-N1`, `SO-N2`).

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-02 (extend) | Owner | Before N-02 and every live N step | 1. Merchant Center, Settings, Developer settings, open the `storefront` API client. 2. Add `manage_recurring_orders:<project key>` and `view_recurrence_policies:<project key>` (the existing row lists only the first). 3. Put the scope names in `storefront/.env.local` `CTP_SCOPES` (names only). 4. Restart the dev server. | `GET /api/recurrence-policies` answers 200 with four policies | TODO |
| OA-N1 | Owner | Before the live renewal test (M-N-01); blocks nothing else | 1. Read https://docs.commercetools.com/api/recurring-orders-overview (section Payments). 2. Decide: renewals without payment collection (demo), Checkout recurring payments (public beta), or leave out. 3. Write it under Q-N-5 in `plans/QUESTIONS.md`. | Decision recorded | TODO |
| SO-N1 | Owner | Before release | 1. Read the keys `subscription.option.priceLock`, `subscription.dialog.*`, `subscription.account.*`, `subscription.cart.*` in `storefront/messages/en-US.json`. 2. Approve or correct the wording on price lock, cancel and pause; say if subscription terms must be linked (Q-N-1). | Written approval or corrections | TODO |
| SO-N2 | Owner | Before release | 1. Open `plans/evidence/N/6-1-pdp-subscribe-1440.png`, `6-3-cart-groups-1440.png`, `6-6-tab-1440.png`. 2. These screens have no design (design.md section 6 item 1); approve them or list changes. | Approval or change list | TODO |
| M-N-01 | Owner or Claude | After seed request SR-N1, one day after a subscribe order with `mcf-test-daily` | 1. Place a subscribe order with the daily test policy. 2. Next day open `/en-US/account/subscriptions`. 3. In the Merchant Center open Orders. | A new order exists from the recurring order; the card shows `Last order <date>` and a new next date | TODO |
| M-N-02 | Owner | After N-13 | 1. On a real phone open the Subscriptions tab (375 px). 2. Skip, change interval, pause, resume, cancel on a test subscription. | Every action reachable by thumb; dialogs and toasts do not overlap | TODO |
| M-N-03 | Owner or Claude | Only if the Fixed price check could not be automated in N-02 | 1. In the Merchant Center change the recurring price of a throwaway subscribable variant. 2. Read the recurring order's cart line price. | Price unchanged (`Fixed`) | TODO |
