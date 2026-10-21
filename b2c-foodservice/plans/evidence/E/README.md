<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Evidence: workstream E (design system)

Verified with the Chrome DevTools MCP against `npm run dev` on `/en-US/dev/design`.

- `E-kitchen-1440.jpg`: full-page screenshot of the kitchen sink at 1440 px (tokens, type, atoms, icons at 24 and 96 px, grid).
- `E-computed-styles.json`: computed styles, fonts, grid columns, drawer, modal, toast and focus checks (workstream recipe steps 3 to 7).
- `E-lighthouse.json`: Lighthouse accessibility summary, desktop and mobile, and what was fixed.

Not saved as files because the MCP screenshot tool only writes inside its own workspace roots: the icons-only, focus and 375 px screenshots. They were inspected inline; the numbers are in `E-computed-styles.json`. The MCP window cannot go below 500 px wide, so the two-column check ran at 500 px. See manual row `M-E-03` in `plans/notes/todo-E.md`.
