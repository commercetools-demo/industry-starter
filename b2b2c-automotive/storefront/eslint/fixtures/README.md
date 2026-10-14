<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Lint rule fixtures

`*.bad.tsx` files break one lint rule each. `eslint/rules.test.mjs` lints them under a virtual file path and expects the rule to fire. They are excluded from `eslint .`, `tsc` and vitest.
