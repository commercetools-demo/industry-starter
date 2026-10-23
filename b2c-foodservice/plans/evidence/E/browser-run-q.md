<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# E: the kitchen sink at 375 px, run by workstream Q (closes M-E-03 except the real phone)

2026-10-22, a `next dev --webpack` server on port 3200 against the mock (the `/dev` routes answer 404 in a production build, by design). `/en-US/dev/design` at 375x812 (device emulation): page title 34 px, side padding 20 px, product grids with two columns (159.5 px each), no horizontal overflow, the drawer opens at full width (375) and closes with Escape. `E-design-375.png`. The dev server was stopped by its PID afterwards.
