<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Accessibility evidence (Q-07, Q-08)

Read in this order: `checklist.md` (what was checked and what it found), `contrast.md`, `known-issues.md` (what stays and why). The raw output is next to them.

| File | What it is |
| --- | --- |
| `checklist.md` | the D4.2 table, one row per area, with the result and the evidence file; also the script for the VoiceOver pass (M-Q-02) |
| `contrast.md` | token decision, the runtime contrast audit (3971 text nodes, 0 failures), the gradient measure that found QFX-41, focus indicator contrast |
| `known-issues.md` | accepted items |
| `runtime-audit.json` | first contrast and structure audit, 19 public pages at 1440 and 500 px (Chrome DevTools MCP) |
| `account-audit.json`, `account-audit.mjs.txt` | the same audit plus target size, overflow, heading and name checks, signed in as a seeded demo customer, 23 pages at 1440 and 375 px; the script |
| `image-contrast.json`, `image-contrast.mjs.txt` | worst contrast behind text that sits on a gradient or picture; the script |
| `keyboard-checks.json`, `keyboard-checks.mjs.txt` | skip link, 209 Tab stops, focus not obscured, scroll padding, reduced motion, reflow at 640 and 320 px, text spacing; the script |
| `forms-checks.json`, `forms-checks.mjs.txt` | empty-submit errors on sign-in, register and contact, the Quick add status message, Tab order of cart and checkout |
| `dialogs.json`, `dialogs.mjs.txt` | focus trap, Escape and focus return for the five dialogs and drawers at 1440 and 375 px |
| `mega-menu-keyboard.log.txt`, `mega-menu-keyboard.mjs.txt` | ArrowDown opens the mega menu and moves focus into it |
| `lighthouse-cli.json` | Lighthouse 13.5.0 CLI, 20 pages, mobile and desktop: scores, LCP, TBT, CLS, failing audits (`lighthouse-core.json`, `lighthouse-after.json`, `lighthouse-d1.json`, `lighthouse-d2.json` are the earlier runs kept as the "before") |
| `text-spacing-pdp-1440.png` | the product page with the 1.4.12 text spacing override |

How to run again (release build up, mock or live project behind it): the `.mjs.txt` files are Node scripts that need `puppeteer-core` and a Chrome; rename to `.mjs`, set the base URL as the first argument. The Lighthouse runs are `npx lighthouse <url> --output=json --only-categories=performance,accessibility,best-practices,seo` with `--preset=desktop` for desktop.
