<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream B (Seed foundation)

Format: `Q-<L>-<n> | question | default | blocks? | status`.

Q-B-1 | The spec lists a custom type for order notes; the seed has none. | Add `mcf-order-notes` (resource `order`, field `note`), listed in `CONTRACT_KEYS` | no | Open
Q-B-2 | `SEED-PLAN.md` section 1 and D-019 say orders and carts cannot be deleted through the API; the docs say they can (`manage_orders`: Delete Order, Delete Cart). Does cleanup remove sample orders and carts? | No: the seed never touches orders or carts (needs no `manage_orders`); the lead corrects the plan text | no | Open
Q-B-3 | Seed client scopes: a precise list or `manage_project`? | The precise least-privilege list of B-08, one reason per scope in `seed/.env.example` | OA-01 | Open
Q-B-4 | US food tax and GB food tax rates. | 0 and 0 (Q-010); owner or accountant confirms | no | Open
Q-B-5 | New York state rate. | Include 8.875% for `NY`; every other US state uses the 8% country rate (fallback on) | no | Open
Q-B-6 | Free-shipping threshold representation. | `freeAbove` on the standard zone rate (not price tiers); F and I read it from the shipping method | no | Open
Q-B-7 | `mcf-collect` price and tax category. | 0 in each currency; tax category `mcf-tax-standard` | no | Open
Q-B-8 | Store channel name format. | `Malva Coffee <area>` in all languages | no | Open
Q-B-9 | Live `reset`. | Dry run only in B; a real `reset --confirm` only on a lead instruction | no | Open
Q-B-10 | Wait for indexing `Activated`. | Poll every 5 s, time out after 15 minutes | no | Open
Q-B-11 | Node version of the seed (`engines >=20`) versus the project (Node 22). | Align the seed to `>=22` and add `seed/.nvmrc` `22` | no | Open
Q-B-12 | Seed files that must be git-ignored. | `.env*` except `.env.example`, and `cleanup-manifest.json` | no | Open
Q-B-13 | Product type attribute constraints are irreversible. Confirm `SameForAll` for product facts and `CombinationUnique` for the variant dimensions before the first live run. | As seeded; the lead confirms in writing before B-14 | B-14 | Open
Q-B-14 | `verify` before C has run: it fails on the catalogue and people sections. | Accepted; B reads back with the MCP or a throwaway read-only script | no | Open
Q-B-15 | The sample project may contain customers and shopping lists; cleanup deletes them if the manifest lists them. | They are listed; the owner removes any entry to keep (OA-07) | OA-07 | Open
