<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream M (reviews and ratings)

Draft for the lead to consolidate into `plans/QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | status`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-M-01 | Do new customer reviews need approval before they count? | Removed by D-037: no moderation; reviews are published on creation and counted at once. | No | Superseded (D-037) |
| Q-M-02 | The storefront API client needs `manage_products` to write reviews (no narrower scope exists). Accept, or provide a second restricted client? | Decided by D-027: a second isolated server-only client (`lib/ct/review-client.ts`, env names `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, optional `CTP_REVIEWS_SCOPES`, default `manage_products:<project key>`); the main client keeps its scopes; ownership is checked in code. | Blocks live write tests only (OA-M-a) | Built to default |
| Q-M-03 | Is the text required, or is a rating alone a valid review? | Rating required; title and text optional. | No | Open |
| Q-M-04 | Can a customer who never bought the product review it? | Yes; a "Verified purchase" badge is set only when the customer has an order with the product (checked at write time). | No | Open |
| Q-M-05 | Show reviews of every language in every locale? | Yes, as written, no filter, no translation. | No | Open |
| Q-M-06 | Edit of a published review: does it need approval again? | No (D-037): the edit is live at once. | No | Superseded (D-037) |
| Q-M-07 | Delete by the author: allowed for approved reviews too? | Yes (spec lists delete). | No | Open |
| Q-M-08 | Rate limits? | 5 creates per hour, 30 edits or deletes per hour, per customer; in memory per instance (J's limiter, Q-J-12). | No | Open |
| Q-M-09 | How is the one-review-per-product rule enforced? | `uniquenessValue` of customer id and product id, plus a pre-check; M-03 confirms the field. | No | Open |
| Q-M-10 | Seeded reviews have no verified purchase (no orders in the seed). Add a custom field value to some seed reviews? | No; seed plan Q-C-04 stays. | No | Open |
| Q-M-11 | If Product Search cannot filter or sort on rating statistics, who refreshes the indexed rating attribute after new reviews are posted? | G's fallback attribute is refreshed by `seed:ratings` (M-09) run by the team or owner; a subscription-driven refresh is not built. | No | Open |
| Q-M-12 | Workstream L (account shell) is not built, so there is no Reviews stub to replace. | M created `app/[locale]/account/(shell)/reviews/page.tsx` (guarded by `requireCustomerPage`, no layout). L adds `(shell)/layout.tsx` and the tab link; the page stays. | No | Open |
| Q-M-13 | The duplicate `uniquenessValue` error code is assumed to be `DuplicateField` (documented for unique fields). | `isDuplicate` checks `errors[].code === 'DuplicateField'`; the pre-check `findMyReview` also catches the normal case. Confirm live (M-M-03). | No | Open |
| Q-M-14 | Review titles are single line. | Newlines in a title are replaced by spaces; the text keeps its line breaks. | No | Open |
| Q-M-15 | Review text counts characters as Unicode code points (an emoji is one). | Yes; the input `maxLength` counts UTF-16 units, so the browser can stop a few emoji earlier than the server limit. | No | Open |
