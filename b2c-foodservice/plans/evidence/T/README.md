<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

> **Void after workstream T2 (decision D-055, 2026-11-05).** The answers below were for the Shopper MCP, which is removed; the spikes and fixtures they describe are gone. Kept as history. The T2 proof is `plans/evidence/T/` from U-13 onward.


# Evidence: workstream T (shopping assistant)

## T-00 baseline (2026-11-04, branch `ws/t-shopping-assistant`, before any code)

`cd storefront && npm run check`: lint and typecheck green, 249 of 250 test files pass (2144 tests). One **pre-existing** failure, not caused by this workstream:

- `app/tokens.test.ts` reads `../styles.css` (the Malva Drinks colour source from the multibrand change), which is not in the repository. Owner action: add the file or change the test to read a checked-in copy. Reproduces on `main` without any T changes.

## Verbatim check of the tool contracts (T-09)

`UPSTREAM_DIR=<clone of github.com/anthropics/commerce-agents> npx vitest run lib/agent/shopping/tools` compares every description, enum value and schema text the TypeScript builder emits with the upstream `registry.py` source and the status line with `execution.py`, as text. No upstream code is executed. Run it again whenever the clone is updated. Result on upstream commit fd4d59224ab96b43c6dc6888207c67b3bd5a24cf: passed.
