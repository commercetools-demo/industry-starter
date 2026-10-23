<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Test data created by workstream Q

Format of `seed:cleanup-tests`: `| kind | id | note |` (ids only). **Every record below lives only in the in-memory mock commercetools server** (`storefront/scripts/mock-ct-server.mjs`), which loses them when it restarts (it was restarted several times during the run). **No record was written to a live project**, so the register for a live cleanup is empty: nothing to purge there. When the live journeys are run (owner rows OA-01, OA-04, OA-K-a), add their rows here before the dry run.

Customers use `tst-<yyyymmdd>-<n>@example.com`; free text carries the prefix `TST-`.

| kind | id | note |
| --- | --- | --- |
| customer | tst-20261022-9@example.com | J9 registration, deleted in the same journey (mock only) |
| review | `TST-review-1` on `MCF-POD-EMBER-10` (Liam Carter, seeded demo customer) | J5, mock only; live: remove with the seed cleanup if it was created live |
| review | XSS payload review on `MCF-POD-EMBER-10` (Maya Okonkwo, seeded demo customer) | J5, mock only |
| order | `MC-` numbers printed by the mock (`/__mock/orders`) | J1, J2 (two linked orders), J3, K, L; orders cannot be deleted; mock only |
| recurring order | one `Active` then `Canceled` on `mcf-every-2-months` for Liam Carter | J3 and J4, mock only |
| shopping list | Noah Patel, one product added and removed | J9, mock only |

Demo customers (`mcf-customer-*`) are seed data, not test data: the cleanup refuses any key that starts with `mcf-`.
