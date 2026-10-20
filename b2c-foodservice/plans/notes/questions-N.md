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
| Q-N-14 | Subscription reminder e-mails (toggle in the account Settings, L): in scope? | No; toggle is saved, nothing is sent | no | Open |
| Q-N-15 | German form of address (du or Sie) | Follow E and F (draft uses du) | no | Open |
| Q-N-16 | Seed a demo subscription per demo customer and a daily test policy `mcf-test-daily` (seed request SR-N1, workstream C)? | Not yet; verify through the checkout journey | no | Open |
