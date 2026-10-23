<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream N (subscriptions)

Draft for the lead to consolidate into `QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | Open`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-N-1 | Fixed or Dynamic price selection, per product or project-wide? Is a link to subscription terms needed at the Subscribe card? | Fixed on every subscribe line, project-wide, stated in words ("Your price stays the same for every delivery"); no terms link | no | Open |
| Q-N-2 | Which recurrence policies are offered and on which products? | The four seeded `mcf-every-*` policies on products with `subscribable = true` that have recurring prices (pods and coffee) | no | Open |
| Q-N-3 | Who creates the recurring order: the platform (Order from Cart creates one per schedule) or the app (`POST /recurring-orders`)? | Platform. App code (N-09) only if spike N-02 shows none were created. Differs from the skill text, which says the app creates one per line | N-09 only | Open |
| Q-N-4 | May a guest pay for a subscription? | No: account required before payment, enforced in the UI and in the order handler | no | Open |
| Q-N-5 | How are renewal orders paid? Checkout recurring payments are public beta. | Not built. Renewals are created by commercetools; documented as a known gap; OA-N1 records the decision | live renewals only | Open |
| Q-N-6 | Skip: one pending skip at a time or several? | One pending skip; button disabled with "Next delivery skipped" | no | Open |
| Q-N-7 | Change interval: any policy? | Any seeded policy; price unchanged because mode is Fixed | no | Open |
| Q-N-8 | Quantity change of a live subscription (in the spec scenario, not in the account design)? | Built only if the spike shows `changeLineItemQuantity` works on the recurring cart (N-10), else not built | N-10 only | Open |
| Q-N-9 | Is cancel final, and is a cancellation reason asked? | Final, no reason | no | Open |
| Q-N-10 | Pause with a resume date or open-ended? | Open-ended, "Resume" button | no | Open |
| Q-N-11 | Free-shipping threshold on renewals (the recurring cart holds only subscription lines) and the scope of discount codes on renewals (`recurringOrderScope` on cart discounts)? | Note "Shipping is calculated for each delivery"; discounts untouched, flagged to workstream C | no | Open |
| Q-N-12 | Show Subscribe when the product is `subscribable` and a recurring price exists, or by price only (skill)? | Both must hold (H builds this gate; N verifies) | no | Open |
| Q-N-13 | Does the Frontend API client template include `view_recurrence_policies`? | Add it in OA-02 | N-01 live run | Open |
| Q-N-14 | Subscription reminder e-mails? | Removed by D-032: no email provider; no reminder toggle | no | Superseded (D-032) |
| Q-N-15 | German form of address (du or Sie) | Removed by D-030: German is dropped | no | Superseded (D-030) |
| Q-N-16 | Seed a demo subscription per demo customer and a daily test policy `mcf-test-daily` (seed request SR-N1, workstream C)? | Not yet; verify through the checkout journey | no | Open |
| Q-N-17 | Skip semantics of `Counter`: is `totalToSkip` cumulative, and does `nextOrderAt` move when the skip is set or when the order would have been created? Not documented (spike N-02, documentation pass) | Cumulative (`totalToSkip + 1`), `pendingSkips = totalToSkip - skipped`; no date computed in the browser: the card shows the platform's `nextOrderAt` and the label "Next delivery skipped" | live run (M-N-04) | Open |
| Q-N-18 | `setSchedule` is refused by the platform while a skip is pending (SDK doc). Should Change interval wait until the skip has passed? | Yes: the button is disabled with an explanation and the API answers `invalid_state` | no | Open |
| Q-N-19 | K's hosted flow has no "Continue as guest" control to hide (workstream plan D6). Where does the guest rule show? | On K's Review stage: a notice with Sign in and Create an account, and Continue disabled; the session and pickup handlers answer `401 sign_in_required` through K's `EXTRA_BLOCKERS` | no | Open |
| Q-N-20 | A recurring order whose origin order was deleted or never queried shows an order as "Subscription pending" forever (pending = one of the last 10 orders with recurring lines and no recurring order naming it as origin) | Accept; it appears only when the platform failed to create it | no | Open |
| Q-N-21 | Number of the plan tasks: this plan's task list is N-00..N-11 (the notes draft says N-09, N-10, N-13) | The workstream file is authoritative | no | Open |
