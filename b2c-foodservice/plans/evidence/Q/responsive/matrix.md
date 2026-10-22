<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Responsive matrix (Q-05, Q-06)

24 page entries at 7 widths = 168 runs, 2026-10-22, release build at commit `5584c8be` against the mock. `ok` means: no horizontal overflow (`scrollWidth - innerWidth <= 0`), no element past the right edge that is not inside a scroller or clipped, no control under 24 px without the WCAG 2.5.8 spacing exception, one `h1`, no skipped heading level, every image with an `alt`, one `main` and one `footer`, HTTP 200 (404 on the not-found page) and no console error. The number in brackets is the product grid's column count where the page has one. Raw data: `results.json`; the runner is `matrix-runner.mjs.txt`.

| Page | 1440 | 1080 | 900 | 820 | 700 | 520 | 375 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home (`home`) | ok | ok | ok | ok | ok | ok | ok |
| Listing, Pods (`pods`) | ok (3 col) | ok (3 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Listing with a filter (intensity 9) (`pods-filtered`) | ok (3 col) | ok (3 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| All products (`shop`) | ok (3 col) | ok (3 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Search with results (`search`) | ok (3 col) | ok (3 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Search without results (`search-empty`) | ok (3 col) | ok (3 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Product, pod (`pdp-pod`) | ok (4 col) | ok (4 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Product, coffee (`pdp-coffee`) | ok (4 col) | ok (4 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Product, machine (`pdp-machine`) | ok (4 col) | ok (4 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Product, accessory (`pdp-accessory`) | ok (4 col) | ok (4 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Cart (bag of two lines) (`cart`) | ok | ok | ok | ok | ok | ok | ok |
| Checkout (`checkout`) | ok | ok | ok | ok | ok | ok | ok |
| Sign in (`sign-in`) | ok | ok | ok | ok | ok | ok | ok |
| Register (`register`) | ok | ok | ok | ok | ok | ok | ok |
| About (`about`) | ok | ok | ok | ok | ok | ok | ok |
| Contact (`contact`) | ok | ok | ok | ok | ok | ok | ok |
| FAQ (`faq`) | ok | ok | ok | ok | ok | ok | ok |
| Policy (shipping and returns) (`policy`) | ok | ok | ok | ok | ok | ok | ok |
| Journal list (`journal`) | ok | ok | ok | ok | ok | ok | ok |
| Journal article (`article`) | ok | ok | ok | ok | ok | ok | ok |
| 404 (status 404) (`notfound`) | ok | ok | ok | ok | ok | ok | ok |
| Home, en-CA (`home-ca`) | ok | ok | ok | ok | ok | ok | ok |
| Listing, en-CA (`pods-ca`) | ok (3 col) | ok (3 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |
| Product, pod, en-CA (`pdp-pod-ca`) | ok (4 col) | ok (4 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) | ok (2 col) |

Not a single cell failed. The earlier run of this matrix (before the fixes of this workstream) had two: the product page at 900 px overflowed by 2 px because the fulfilment card badge ran out of its card (QFX-01, `fab5b931`).

## Breakpoint behaviour against the spec

Measured with a probe at the widths on both sides of every breakpoint (a width, the width minus one).

| Width | Required | Observed |
| --- | --- | --- |
| above 1080 | four-column product grids, five-column footer, product page in two columns | home strip 4, product page strips 4, footer 5, product page two columns (gallery and buy box); listing 3 beside its sidebar |
| 1080 | grids to three columns | the wide layout still applies at exactly 1080 and the step happens at 1079: home strip 3, footer 3; listing 2; product page strips 2 (no 3-column step). Q-Q-21 |
| 900 | detail, cart and account grids in one column, hero image hidden | at 900 two product-page columns and the hero picture; at 899 one column and no hero picture. Q-Q-21 |
| 820 | mobile navigation, two-column product grid, 20 px side padding, filters as a sheet, section titles 27 px | at 820 the desktop bar and 34 px titles; at 819 the mobile menu button, 27 px titles, two-column grids, and the filter sheet and menu panel work as dialogs (`../a11y/dialogs.json`) |
| 700 | three-column grids become two | listing, search and strips are already two columns from 900 down; nothing is three at 700 |
| 520 | smaller wordmark (about 21 px) | 25 px above 1100 px, 21 px from 1100 px down, 16 px at 375 |
| 375 | everything reachable | no overflow on any of the 24 pages; controls as in `../a11y/checklist.md` |

## Screenshots

`<page>-1440.png`, `<page>-900.png`, `<page>-375.png` for every page of the matrix (72 files, full page, taken on the final build). Journey screenshots at 375 and 1440 px are in `../J<n>-<step>-<width>.png`.
