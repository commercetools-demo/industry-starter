<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream C (draft)

Existing OA-01, OA-03 (image source) and SO-04 (catalogue review) are referenced, not redefined.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x (C1) | Owner | Before the first manual sign-in test (workstream J onwards); does not block seeding | 1. On your own machine open `seed/.env.local` (git-ignored). 2. Read the value of `SEED_DEMO_PASSWORD` (never paste it in chat or a file in git). 3. Or replace it with your own password of at least 10 characters and tell the lead to run `cd seed && npm run seed -- --only customers`. | You can sign in as `maya.okonkwo@example.com` once the sign-in page exists | TODO |
| SO-x (C1) | Owner or legal | Before release (does not block building) | 1. Read one pod description in `seed/src/data/products.ts`: "Compatible with Nespresso Original machines (not affiliated with Nespresso)" and the en-CA equivalent. 2. Approve the wording, or send replacement wording for product and category texts (D-005: compatible, never the brand as a product name). | Approval or replacement wording | TODO |
| M-C-01 | Owner | Optional, after C-18 | 1. Open the Merchant Center for the Malva project. 2. Products: 41 products; open one pod: prices in USD and CAD, recurring prices for the four policies, images (after OA-03). 3. Open one product with reviews: rating shown. | Matches `plans/evidence/C/README.md` | TODO |
