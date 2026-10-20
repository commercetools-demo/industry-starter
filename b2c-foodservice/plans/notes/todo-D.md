<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream D (draft)

Existing OA-01 (API clients) is referenced, not redefined.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x (D1) | Owner | Before workstream M (reviews write). Blocks only the write path of reviews | 1. Read https://docs.commercetools.com/api/projects/reviews (Create Review: scope `manage_products`). 2. Decide: (a) a second server-only API client with `manage_products` used only for creating reviews (default), (b) add `manage_products` to the storefront client, (c) no customer-written reviews. 3. For (a) create client `storefront-reviews` in the Merchant Center and put `CTP_REVIEWS_CLIENT_ID` and `CTP_REVIEWS_CLIENT_SECRET` in `storefront/.env.local` (names added to `.env.example` by M). | Written decision; for (a) the two names filled in `.env.local` | TODO |
| M-D-01 | Owner | Optional, any time after D is Ready for review | 1. Open one product image URL from the seed (`seed/src/data/images.json`) in a browser with `?auto=compress&fit=crop&w=600&h=720` appended. 2. Compare with the plain URL. | The image is resized and cropped (or the host ignores the parameters; then tell the lead so `image-config.ts` changes) | TODO |
