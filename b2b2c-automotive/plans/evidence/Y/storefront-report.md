<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream Y, storefront report (J27, 2026-10-12)

Method: production build of a scratchpad copy (`next build`, `next start` on 3180), fake commercetools (a copy of the workstream Q fake) and `tools/fake-contentools`, headless Chrome over the DevTools protocol (the Chrome DevTools MCP hangs, ENV-01), axe-core 4.x injected in the page (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice, colour contrast included). 26 pages (all inventory routes that exist), five widths (320, 375, 768, 1024, 1440), de-DE for all, en-US for the key pages. No live commercetools call. Hosted Checkout widget and Stripe are third party and were not exercised (the production build answers 503 for the session without an Application, so the error state with retry was checked).

Raw results: `storefront-sweep-before.txt` (first run), `storefront-sweep-after.txt` (after the fixes), `storefront-sweep-final-subset.txt` (re-run of the pages touched last), `storefront-contrast-before.txt` and `storefront-contrast-report.txt`, `storefront-bundle-report.txt`, `storefront-perf.json`, `storefront-keyboard-pdp-375.json`, `storefront-pass-notes.txt`, screenshots `storefront-<page>-<locale>-<width>.png`.

## Issues

| # | Page(s) | Defect | Fix (file) | Test |
| --- | --- | --- | --- | --- |
| 1 | all | Text colours below AA: success 600 on tint 3.82, danger 600 on tint 4.49, info, rating 2.34, subtle text and old price 3.72; input border 1.57 | `app/aa-layer.css`, `Field`, `Select`, `SearchField`, both `QuantityStepper`, `ReviewForm` (border-input) | `scripts/contrast-report.test.mjs` (54 pairs) |
| 2 | product (de-DE) | Related "Hinzufügen" button name did not contain its visible text (2.5.3) | `messages/de-DE.json` `addNamed` | `test/a11y/product.a11y.test.tsx` (label-in-name check) |
| 3 | garage, vehicle list (en-US), listing filter button | Same: "Set active", "Filters 1" | `messages/*.json` `setActiveLabel`, `openWithCount` | `test/a11y/account`, `listing` |
| 4 | home, PDP, cart, sign-in, register, forgot password, order detail | Links and checkboxes under 24 px (20 px rows, consent and return checkboxes squeezed to 16 px) | `inline-flex min-h-6/7 items-center` on the links, `shrink-0` on the checkboxes | sweep (before 17 distinct offenders, after only native radios inside 48 px labels) |
| 5 | all at 320 to 375 | Store name truncated to 3 letters next to Account and Cart | `components/shell/Header.tsx` (own row under 34rem) | screenshots 320, 375 |
| 6 | home at 320 | Hero grid 300 px minimum wider than the viewport, content clipped by 4 px | `AutomotiveHero.tsx` `minmax(min(18.75rem,100%),1fr)` | sweep overflow offenders |
| 7 | 404, account pages | Title "Malva" on the 404, "Mein Konto" on every account page (2.4.2) | `app/not-found.tsx`, `app/[locale]/not-found.tsx`, `lib/account/page-title.ts` and nine account pages | sweep titles |
| 8 | product, account (desktop) | CLS 0.118 and 0.023: the streamed skeleton was shorter than the viewport, so the footer jumped | `loading.tsx` of product, listing skeleton, account (`min-h-screen`) | `perf` runs: CLS 0 |
| 9 | skeletons | `animate-pulse` without a reduced-motion guard | `motion-safe:` everywhere, global `prefers-reduced-motion` rule in `globals.css` | `scripts/check-reduced-motion.test.mjs` |
| 10 | document | Seven font preloads including Inter, which only a theme can pick | `lib/fonts.ts` `preload: false` for Inter | review |

Accepted or not fixed: footer Terms, Privacy, Returns are 404 (MISSED-FEATURES); delivery radios 16 px inside a 48 px label and the 24 px fit chip button (24 px AA met; MISSED-FEATURES J row); home JS budget exception (Q-Y12); Lighthouse JSON not produced (M-Y-33).

## Checks with no defect found

axe: zero violations on every page, width and locale after the fixes (the only axe hit before was issue 2 plus the order confirmation test artefact). Reflow: no horizontal scroll at 320 on any page. 200 percent text and WCAG 1.4.12 text spacing: no scroll at 375 and 1440 on home, parts, product, cart, sign-in, checkout. Landscape 812x375: no scroll. Keyboard: skip link is the first stop on every page; 66 stops on the product page at 375, none covered by the sticky header or a banner, every stop has a visible outline; store picker, garage dialog and filter sheet take focus in and return it on Escape; the picker sheet fits the viewport at 375 and 768. Reduced motion rule present in the built CSS. Language and title per locale on every page. Network: every request of every page went to the storefront origin (no commercetools API host, no Contentools host; the Checkout, Stripe and OpenStreetMap exceptions did not occur because the widget and map were not mounted).

## Budgets (production build, fake backend; LCP is not representative, photos are placeholders)

| Page | JS transferred | Total | CLS | Budget |
| --- | --- | --- | --- | --- |
| home (published Puck page) | 332 KB | 477 KB | 0 | 220 KB, exception 380 KB (Q-Y12) |
| listing, product, cart | 191 KB | 337 to 343 KB | 0 | 220 KB, 1.2 MB |
| checkout, account | 187 to 188 KB | 330 KB | 0 to 0.012 | 260 KB, 1.0 MB |

`storefront-bundle-report.txt`: first-load JS per route from the build output, all 24 routes within their budget (product 218.7 of 220 KB, cart 218.1: no headroom, any new client dependency fails the gate).

Cache headers: pages are `private, no-cache, no-store, max-age=0, must-revalidate` (dynamic, session aware); `/_next/static` is immutable by Next default; the confirmation and reset routes are `private, no-store`. Images use `next/image` with the product loader (`CSP_IMG_HOSTS` names the photo hosts), the first gallery image has `priority`, thumbnails and cards lazy with fixed aspect boxes.
