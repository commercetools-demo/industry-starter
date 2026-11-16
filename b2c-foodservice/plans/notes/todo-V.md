<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Owner items: workstream V (preset bundles)

Draft for the lead to merge into `TODO-MANUAL-TESTING.md`. No value goes into chat or git.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-V-a | Owner | Before V-21 (the junior works against the mock until then) | 1. In Merchant Center open Settings, Developer settings, Create new API client. 2. Tick the same scopes as the current storefront client (`CTP_SCOPES` in `storefront/.env.local`) **plus** `view_key_value_documents` (Custom Objects: View). 3. Put the new client id, secret and scope list into `storefront/.env.local` (`CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`). Never paste the values into chat or git. | The bundle product page loads its presets from the real project | TODO |
| OA-V-b | Owner | With OA-V-a, before the next deploy | In Netlify, Site configuration, Environment variables: replace `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET` and `CTP_SCOPES` with the OA-V-a values for every deploy context that serves the storefront. | The deployed bundle page shows its presets | TODO |
| OA-V-c | Owner | Optional, before showing the bundle in Canada | 1. In Merchant Center open the custom object `configurable-bundles_items` / `bundle--1794844737333` and fill the en-CA preset names. 2. Check that Vertuo Studio, Pod Plus Milk, Pod One Starter Gift, Pod Discovery Gift Set and Pod carousel holder have a CAD price for Canada. 3. Ask the developer to re-run `npm run seed -- --only preset-bundles`. | Both presets are sold in Canada with their own names | TODO |
| M-V-01 | Owner | After V-21 | 1. On the site add "Vertuo bundle" to the bag. 2. Check out with the hosted Checkout in test mode. 3. Note how the payment page lists the machine and pods ($0) and the bundle line. 4. Compare the order total with the bag. | Order total equals the bag total; the listing of $0 parts is acceptable (else answer Q-V-8) | TODO |
| M-V-02 | Owner | After M-V-01 | Open the order in Merchant Center: the bundle line has a key starting `bundle-` and the fields `bundlePreset`, `bundleDiscount`, `bundleWasCents`; each part has `parentId` equal to that key. | The order can be fulfilled from the parts | TODO |
| SO-V-a | Owner | After V-20 | Look at the screenshots in `plans/evidence/V/` (product page at 375 and 1440 px, bag, drawer) and sign off the design or list changes. | Design signed off | TODO |
