<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream K

Draft rows for the lead to merge into `plans/TODO-MANUAL-TESTING.md` (the lead numbers OA and SO). Only the owner sets DONE, PASS, FAIL or WAIVED.

| ID | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-K-a | Owner | Before K-01 probes S6 to S8, S11, S12 and task K-12 | 1. In the Merchant Center create a Checkout Application in Payment Only mode. 2. Install and configure a payment connector in test mode (OA-04). 3. Put the Application key in `storefront/.env.local` as `CTP_CHECKOUT_APP_KEY` and add `manage_sessions` and `manage_orders` to the API client. | Application and connector exist; payment steps unblocked | TODO |
| OA-K-b | Owner | Before R11 and for redirect payment methods | 1. In the Application's payment settings register the return URL `http://localhost:3000/checkout/return` (and the deployed URL later). | Return URL saved (one per connector) | TODO |
| OA-K-d | Owner | Before SO-K-b | 1. In the Application's texts and labels set the pay button text to "Place order" (en, de). 2. Enable the card method. | Widget button reads "Place order" | TODO |
| SO-K-a | Owner | Before release | 1. Read the delivery-time text on the shipping tiles and "Ready in about N minutes". 2. Approve or change the copy. | Copy approved | TODO |
| SO-K-b | Owner | Before release | 1. Compare checkout steps 1 to 3 and the confirmation with `screenshots/checkout-step1.png` and `checkout-step2.png` at 375 and 1440 px. 2. Judge the hosted widget inside the Payment card. | Fidelity accepted or changes listed | TODO |
| M-K-01 | Owner | Before release | 1. On a real phone place an order with the PSP success test card. 2. Note whether the keyboard hides the widget fields. | Order confirmed; fields usable | TODO |
| M-K-02 | Owner | Before release | 1. Pay with the PSP 3-D Secure test card. 2. Complete the challenge. | Return to `/checkout/return`, then the confirmation | TODO |
| M-K-03 | Owner | Only if the decline card cannot be automated | 1. Pay with the PSP decline test card. 2. Retry with the success card in the same session. | Error on step 3, retry works, one order | TODO |
| M-K-04 | Owner | Before release | 1. Pay with Apple Pay or Google Pay if the connector offers it. | Order confirmed or the method is hidden | TODO |
| M-K-05 | Owner | After an order exists | 1. In the Merchant Center open the order. 2. Change its state to Preparing, Ready for collection, Collected. 3. Reload the confirmation page. | The tracker follows each change | TODO |
| M-K-06 | Owner | Before release | 1. Place a mixed order (machine to ship, pods to collect). 2. In the Merchant Center check payments, shipping entries and tax. | Matches the decision recorded from K-01 | TODO |
