<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Z-01 plan and spec consistency (J28, 2026-10-12)

| Check | Result |
| --- | --- |
| `node plans/verify-plan.mjs --sync --strict` | OK: 26 workstreams, 31 specs (180 requirements), manual-testing rows unique, every `OA-nn` and `SO-nn` named in a plan has a row, no cycles. Part of `node plans/release-gates.mjs`. |
| `node plans/verify-manual.mjs --structure` | OK: 0 structural errors (two malformed rows fixed, Q-Z07). Open rows are reported, not failed; strict mode (gate G11) fails while any is open. |
| `openspec validate b2b2c-automotive-design --strict` | **Fails by design, not a spec error:** "Change must have at least one delta". The design change keeps its specs as flat spec directories under `openspec/specs/{consumer-storefront,seller-portal}/design-*` rather than ADDED/MODIFIED delta files. `verify-plan.mjs` checks them instead (headings, owners, out-of-scope markers). |
| `openspec validate --specs --strict` | "No items found to validate" in this checkout (the CLI does not discover the flat spec folders). Not a pass; the heading-level check is in `plans/spec-coverage.mjs` (requirements and scenarios parsed for all 31 specs). |

Open: if the owner wants a green `openspec validate`, the specs need converting to delta form (a design decision, not done here).
