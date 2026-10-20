<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream M (reviews and ratings)

Draft for the lead to consolidate into `plans/QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | status`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-M-01 | Do new customer reviews need approval before they count? | Yes: `REVIEW_MODERATION: 'on'`, state `mcf-review-pending`, approved in the Merchant Center. One constant switches it off. | No | Open |
| Q-M-02 | The storefront API client needs `manage_products` to write reviews (no narrower scope exists). Accept, or provide a second restricted client? | Add the scope to the storefront client (`OA-M-a`); ownership is checked in code. | Blocks live write tests only | Open |
| Q-M-03 | Is the text required, or is a rating alone a valid review? | Rating required; title and text optional. | No | Open |
| Q-M-04 | Can a customer who never bought the product review it? | Yes; a "Verified purchase" badge is set only when the customer has an order with the product (checked at write time). | No | Open |
| Q-M-05 | Show reviews of every language in every locale? | Yes, as written, no filter, no translation. | No | Open |
| Q-M-06 | Edit of an approved review: return to pending or keep published? | Return to pending when moderation is on (spec). | No | Open |
| Q-M-07 | Delete by the author: allowed for approved reviews too? | Yes (spec lists delete). | No | Open |
| Q-M-08 | Rate limits? | 5 creates per hour, 30 edits or deletes per hour, per customer; in memory per instance (J's limiter, Q-J-12). | No | Open |
| Q-M-09 | How is the one-review-per-product rule enforced? | `uniquenessValue` of customer id and product id, plus a pre-check; M-03 confirms the field. | No | Open |
| Q-M-10 | Seeded reviews have no verified purchase (no orders in the seed). Add a custom field value to some seed reviews? | No; seed plan Q-C-04 stays. | No | Open |
| Q-M-11 | If Product Search cannot filter or sort on rating statistics, who refreshes the indexed rating attribute after moderation in the Merchant Center? | G's fallback attribute is refreshed by `seed:ratings` (M-09) run by the team or owner; a subscription-driven refresh is not built. | No | Open |
