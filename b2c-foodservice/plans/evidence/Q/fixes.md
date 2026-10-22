<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Defects found by Q and what happened to them

`| id | journey or check | symptom | owning workstream | fix |`. Every fix has a test that failed first (the test names are in the commit). The commit hash is the one that carries the fix; `open` means handed over or recorded as a known gap.

| id | journey or check | symptom | owning workstream | fix |
| --- | --- | --- | --- | --- |
| Q-F-01 | responsive 900 px, PDP | the fulfilment card badge ran out of its card | H | fixed: `ws-q: fix pdp fulfilment card badge overflow at 900 px` |
| Q-F-02 | Lighthouse SEO, listing pages | no meta description on listing, search, sign-in and register pages | G, J | fixed: `ws-q: fix seo and a11y names` |
| Q-F-03 | Lighthouse a11y, every page | the locale pill's accessible name did not contain its visible text (`label-content-name-mismatch`) | F | fixed: same commit |
| Q-F-04 | a11y checklist, focus not obscured (WCAG 2.4.11) | the sticky header could hide a focused element | F | fixed: `ws-q: fix a11y and performance: scroll padding under the sticky header` |
| Q-F-05 | performance, request counts | menu and footer links prefetched on every page (dozens of `_rsc` requests) | F | fixed: same commit (no prefetch of menu and footer links) |
