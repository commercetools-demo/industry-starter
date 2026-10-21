<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream K

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-K-a | Owner | Before K-01 probes S6 to S8, S11 to S15 and K-12 | 1. In the Merchant Center create a Checkout **Application of type Complete Checkout** (D-039). 2. Install the Stripe payment connector in test mode and add it as a payment integration (OA-04). 3. Select countries US and CA, allow all origins for dev. 4. Put the Application key in `storefront/.env.local` as `CTP_CHECKOUT_APP_KEY` and give the API client `manage_sessions` and `manage_orders`. | Application and connector exist; the hosted steps of K are unblocked | TODO |
| OA-K-b | Owner | Before R11 and for redirect payment methods | 1. In the Application's general settings set the payment return URL `http://localhost:3000/checkout/return` (and the Netlify URL when hosting exists, OA-05). 2. Add the same origins to Origin URLs. | Return URL saved; only one per connector | TODO |
| OA-K-d | Owner | Before SO-K-b | 1. In the Application's texts and labels set the pay button text to "Place order". 2. Leave the Discount Code function off (promo codes live on the cart page). 3. Add the terms and privacy user agreements once P has the pages. 4. Enable the card method. | Hosted flow shows "Place order", a discount code field and the agreements | TODO |
| OA-K-e | Owner | Only if K-01 picks `payment-only-for-collect` | 1. Create a second Application in Payment Only mode with the same connector. 2. Put its key in `storefront/.env.local` as `CTP_CHECKOUT_PAYMENT_APP_KEY`. | Second Application exists | TODO |
| SO-K-a | Owner | Before release | 1. Read the delivery-time text and the collection "Ready in about N minutes". 2. Approve or change the copy (the days text comes from the shipping methods' descriptions, the minutes from the store data). | Copy approved | TODO |
| SO-K-b | Owner | Before release | 1. Compare the Review stage and the confirmation with `screenshots/checkout-step1.png`, `checkout-step2.png` at 375 and 1440 px. 2. Judge the hosted Checkout's look and its deviation from the prototype's three steps. | Fidelity accepted or changes listed | TODO |
| M-K-01 | Owner | Before release | 1. On a real phone place an order with the Stripe success test card in `/en-US` and another delivery order in `/en-CA`. 2. Note whether the keyboard hides the hosted fields. | Orders confirmed; fields usable | TODO |
| M-K-02 | Owner | Before release | 1. Pay with the Stripe 3-D Secure test card. 2. Complete the challenge. | Redirect returns to `/checkout/return` then our confirmation | TODO |
| M-K-03 | Owner | Only if the decline card cannot be automated | 1. Pay with the Stripe decline test card. 2. Retry with the success card in the same session. | Error shown, retry works, one order only | TODO |
| M-K-04 | Owner | Before release | 1. Pay with a wallet (Apple Pay or Google Pay) if the connector offers it. | Order confirmed or the method is hidden | TODO |
| M-K-05 | Owner | After the order exists | 1. In the Merchant Center open the order. 2. Change its state to Preparing, Ready for collection, Collected (Orders, Order details, State). 3. Reload the confirmation page. | The tracker follows each change | TODO |
| M-K-06 | Owner | Before release | 1. Place a mixed order (machine to ship, pods to collect, a subscribed coffee) in the US. 2. In the Merchant Center check payments, shipping entries and tax. 3. Confirm each cart line was marked in its cluster before payment. | Matches the decision recorded from K-01 | TODO |
