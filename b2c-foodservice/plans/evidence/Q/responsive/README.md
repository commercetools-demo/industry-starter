<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Responsive evidence (Q-05, Q-06)

| File | What it is |
| --- | --- |
| `matrix.md` | the page by width table (24 pages, 1440, 1080, 900, 820, 700, 520, 375: 168 runs, all `ok`), the breakpoint behaviour against the spec, and what the screenshots are |
| `results.json` | the raw result of every run: width, overflow in pixels, offending elements, controls under 24 px without the spacing exception, `h1` count, heading skips, images without `alt`, landmarks, product grid columns, `lang`, title, HTTP status, console errors, failed requests |
| `matrix-runner.mjs.txt` | the script that produced it (Node with `puppeteer-core` and Chrome; rename to `.mjs`; first argument the base URL, second the output file). It adds a bag with two delivery lines in a fresh browser context so cart and checkout show real content, and visits the `en-CA` pages last because a page in the other market starts a new bag by design |
| `<page>-1440.png`, `-900.png`, `-375.png` | full-page screenshots of every page of the matrix (72 files) on the final build |

The assertion of D3 (`overflowPx`, `offenders`, `smallTargets`, grid) is in the runner with two refinements, both explained in `../a11y/checklist.md`: a control under 24 px passes when no other control is within a 24 px circle (the WCAG 2.5.8 spacing exception), and the product name link, which is stretched over its whole card with `::after`, counts as the size of the card. Elements outside the right edge only count when no scroller or clip contains them (the decorative glows of the hero are clipped by their section).

Journey screenshots at 375, 500 and 1440 px are in `../J<n>-<step>-<width>.png` (the browser window of the MCP cannot go under 500 px; the 375 px views use device emulation). The 1080, 820, 700 and 520 px widths were measured but not photographed: no run changed layout in a way the numbers in `matrix.md` do not already show.
