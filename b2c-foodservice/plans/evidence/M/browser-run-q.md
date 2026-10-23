<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# M browser run, run by workstream Q (closes M-M-04 except the real phone)

2026-10-22, production build against the mock. A product with reviews (Ember Ristretto, 12 reviews) at 375 and 1440: summary `3.9 out of 5`, `12 reviews`, distribution list, sort select (`Newest`, `Highest rated`, `Lowest rated`), five reviews and `Show more`, no overflow. `Sign in to write a review.` for a guest; for a member the form opens with five star radios of 44 x 44 px; the arrow keys move and check the stars and the focus ring is visible (`outline: solid 2px`). `/en-CA` shows the product page with its reviews (journey J1-CA). The submit, edit, delete, XSS payload and foreign-review checks are journey J5 and J14 (1440). Console: no error. `M-review-form-375.png`
