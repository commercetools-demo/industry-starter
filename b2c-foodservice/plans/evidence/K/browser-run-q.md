<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# K browser recipe, run by workstream Q (closes M-K-07 except the hosted Checkout and Stripe)

2026-10-22, Chrome DevTools MCP, production build of `ws/q-quality` against the mock commercetools, 1440x900 and 375x812. Recipe: section 6 of `plans/workstreams/K-checkout-and-confirmation.md`. The hosted Checkout widget cannot run against the mock (its script URL is the mock origin, which the CSP blocks: console error `Loading the script 'https://localhost:9743/main.js' violates the following Content Security Policy directive`). Payment is simulated the way the platform does it (see `plans/evidence/Q/journeys.md`); R5 (the widget), R7 to R12 and R17 (hosted flow knowing the customer) are live rows (OA-K-a, M-K-01 to M-K-04).

| Step | Result |
| --- | --- |
| R1 | Guest bag with a machine (delivery) and a pod box (collect, Harlem): Review active in the step indicator, cluster `Pickup at Malva Coffee Harlem` and cluster `Delivery`, each line with its marker, summary with both lines. `K-R1-review-1440.png` |
| R2 | 375 px (journeys J1 and J2): one column, summary after the clusters, no horizontal scroll |
| R3 | Continue with the pickup name empty: `Enter the name of the person collecting.`, focus on `Pickup name`, no request made |
| R4 | `Someone else` with `<script>alert(1)</script>`: `Use letters, spaces, apostrophes, hyphens and full stops only (2 to 80 characters).`, no request; `Alex O'Neil-Smith` advances |
| R5 | `PUT /api/checkout/pickup` 200 then `POST /api/checkout/session` 200; the Pay stage opens (`Payment 1 of 2` for the mixed bag). The widget does not load against the mock (CSP, expected) |
| R6 | **Defect**: choosing another store from `Change` moved the collect lines (the cart answered 200) but the Review kept the old store until a reload. Fixed (QFX-20): the checkout state is read again after the move; test in `CheckoutPage.test.tsx` |
| R9 to R12 | Discount codes on the cart page: journeys J2 and the I recipe. Hosted discount field, delivery step, test cards: live |
| R13 | A guest order opens from its id in a second context (journey J1, step 6). A member order opened in a second context redirects to `/en-US/account/sign-in?redirect=%2Fcheckout%2Fconfirmation%2Ford-3` |
| R14 | Collect-only order: no delivery cluster, collection card with store, hours, `Pickup name: Pat Tester`, tracker with Ordered, no sentence about email or text |
| R15 | **Defect**: the open confirmation page never polled (SWR gave the interval function no data when only fallback data existed). Fixed (QFX-21). After the fix: order moved to Ready in the mock, 11 s into the next window the page read `/api/orders/ord-3` and the tracker went from `ordered` to `ready-for-collection`. `K-R15-ready-1440.png`. Polling stops at `collected`: unit test (`pollInterval`); the run to check it live was cut short when the browser restarted |
| R16 | Mixed orders (journey J2): clusters, two payments, linked orders. **Open question Q-Q-16**: with a code on a mixed bag the sum of the payments (.23 + .32) is higher than the total in the summary (.62), because the code goes on the first payment only (Q-K-02c). Manual live check M-Q-09 |
| R17 | Member checkout: `Pickup name` prefilled with `Maya Okonkwo` |
| R18 | Canada (journey J1-CA): no collect cluster, no store picker, `Free delivery on orders over $99.00`, shipping $8.95 below the threshold, order placed |
| R19 | Tab order from the Review heading: Change, the `It's me` tile, then (Right arrow) `Someone else` and back, the name field, Continue; every stop has `outline: solid 2px` and matches `:focus-visible` |
