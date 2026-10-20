<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream B (draft)

Existing OA-01 (API clients) and OA-07 (manifest review) are referenced, not redefined.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x (B1) | Owner | With OA-01, before the first live run (B-10) | 1. Open `seed/.env.example` (task B-08) and read the `SEED_CTP_SCOPES` block. 2. When creating the `seed-admin` API client in the Merchant Center, grant exactly those scopes for the project (no wildcard, no `manage_orders`). 3. Put the client values in `seed/.env.local`. | The live dry runs connect and no write returns 403 | TODO |
| SO-x (B1) | Owner or accountant | Before release (does not block building) | 1. Read the tax table in `plans/SEED-PLAN.md` section 2. 2. Confirm or correct: food US 0%, DE 7%, GB 0%; standard US 8% (NY 8.875%), DE 19%, GB 20%. 3. Confirm that US prices are shown tax-exclusive and DE and GB tax-inclusive. | Written confirmation or a corrections list | TODO |
| SO-x (B2) | Owner | Before release | Open `seed/src/data/stores.ts`; confirm that the six invented store addresses, phone numbers and opening hours are acceptable as demo data (streets are invented, cities real). | Approval or replacements | TODO |
| M-B-01 | Owner | Optional, after B-14 is done | 1. Open the Merchant Center for the Malva project. 2. Settings, Project settings, Storefront Search: indexing is active. 3. Settings, Shipping methods: 3 methods (standard, express, collect). 4. Products, Categories: 20 categories under Pods, Coffee, Machines, Accessories, Gifts. | Matches `plans/evidence/B/README.md` | TODO |
