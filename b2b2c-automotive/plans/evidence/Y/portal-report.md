<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream Y, portal half: accessibility, responsive, performance (J26, 2026-10-12)

Scope: `b2b2c-automotive/portal/` only. No commercetools call was made (dev fixture mode, `PORTAL_DEV_FIXTURES=on`); the Chrome DevTools MCP was not used (it hangs). Browser runs used headless Chrome over the DevTools protocol against `next dev --webpack` on port 3170 in a scratchpad copy of the app; scripts stayed outside the repo. Production-build numbers come from `npm run verify:build` in a second scratchpad copy.

## Result in one table

| Check | Before | After |
| --- | --- | --- |
| axe-core (WCAG 2.0 to 2.2 A and AA plus best practice), every portal route, `adminA` and `buyerA`, `de-DE` and `en-US`, light and dark | 216 page runs: 1237 violating nodes (colour contrast 844, label in name 336, heading order 32, scrollable region 16, target size 9) | 232 page runs: **0** (`portal-axe-before.json`, `portal-axe-after.json`) |
| Lighthouse accessibility, 58 reports (29 pages x 375 and 1440) | not run before the fixes | **100 on all 58**; best practices 92 to 100 (see below) |
| `<title>` per route | one title, `Malva Partner Portal`, on every route and in both locales | 49 and 47 distinct titles per persona sweep, locale-aware, most specific part first |
| Reflow at 320, 375, 768, 1024, 1440 px (23 routes, light `de-DE` and dark `en-US`) | no overflow on any route; targets under 24 px: dashboard "Prüfen" links (20 px), customer name links (17 px), Leaflet pins (16 px) | 0 horizontal overflow, 0 targets under 24 x 24 outside the inline Leaflet attribution links |
| 200 percent text and text spacing (WCAG 1.4.12) at 1440 and 375 | not run | no overflow, nothing clipped except the intentional `sr-only` elements (screenshots `portal-adminA-*-text200-*`, `*-spacing-*`) |
| Contrast pairs, `node scripts/contrast-report.mjs` | 18 failing pairs | 0 failing, 10 listed exceptions (`portal-contrast-before.txt`, `portal-contrast-after.txt`) |
| First-load JavaScript per route (gzip, `scripts/bundle-report.mjs`) | not measured | 155 to 208 KB outside the editor routes (budget 350 KB), Content and Theme 529 to 533 KB (budget 1.5 MB) (`portal-bundle-report.txt`) |
| Gates | | `npm run check` green (280 test files, 2128 tests), `npm run verify:build` green in a scratchpad copy |

## Defects found and fixed (each with the test that now catches it)

| # | Defect | SC | Fix (file) | Test |
| --- | --- | --- | --- | --- |
| 1 | Muted, link and status text colours below AA (3.45 to 2.16:1; dark 3.6 to 4.0) on 171 + 20 uses | 1.4.3 | AA layer in `app/globals.css` (Q-Y03), tokens.css untouched | `scripts/contrast-report.test.mjs` (every pair, cascade, dark parity) and axe sweep |
| 2 | Input, select, textarea and toggle borders 1.4:1 | 1.4.11 | `--color-border-input` role, used by the shared input classes (`components/portal/kit.ts`, `components/catalog/ui.ts`, auth, copilot, palette, local textareas, discount toggle) | contrast pairs |
| 3 | Every route had the same page title | 2.4.2 | `lib/portal/page-title.ts`, `generateMetadata` on every route that renders content, title template in `app/layout.tsx` | `lib/portal/page-title.test.ts` (every page exports one, keys exist in both catalogues) |
| 4 | Dialogs and Copilot did not give focus back to their trigger; the Copilot launcher was unmounted while its panel was open; the Copilot panel did not take focus | 2.4.3 | `hooks/useFocusTrap.ts` restores focus, `components/portal/CopilotPanel.tsx` keeps the launcher mounted and focuses the field | `components/portal/Dialog.test.tsx`, `Shell.a11y.test.tsx`; real browser in `portal-keyboard.md` |
| 5 | Command palette had no focus trap (Tab left the modal) and an empty-state `li` inside the listbox | 2.1.2, 1.3.1 | `components/portal/CommandPalette.tsx` | `Shell.a11y.test.tsx` (combobox pattern, trap, no-result state) |
| 6 | Account control was `role=menu` without arrow keys; palette and account buttons failed label-in-name | 4.1.2, 2.5.3 | `components/portal/UserMenu.tsx` (disclosure), `components/layout/TopBar.tsx` | `Shell.a11y.test.tsx` |
| 7 | Tab strips (customers, subscriptions, returns, reviews, e-mail, import, preview) without arrow keys | 2.1.1 | `hooks/useTablist.ts` (one tab stop, arrows, Home, End, disabled skipped) | `hooks/useTablist.test.tsx`, `components/customers/StateTabs.test.tsx` |
| 8 | KPI tiles used `h3` straight under the `h1` | 1.3.1 | `components/dashboard/KpiCard.tsx`, `components/customers/shared.tsx` | `components/dashboard/KpiHeadings.test.tsx` |
| 9 | 16 tables had no caption or name, 10 had column headers without `scope`; sideways-scrolling table wrappers were not focusable | 1.3.1, 1.4.10 | captions and `scope="col"`, `role="group" tabIndex=0` with a label on every `tableScroll` wrapper (about 20 components) | `components/tables.a11y.test.ts` |
| 10 | Copy, stock and price buttons whose `aria-label` did not contain the visible text | 2.5.3 | `messages/*.json` (`stockFor`, `copyFor`, `copyBioFor`) | `components/store/Store.test.tsx` |
| 11 | Tailored images could be published without alt text (the plan requires it) | 1.1.1 | `components/tailoring/ImagePanel.tsx`, `ProductInfoPanel.tsx`, messages | `components/catalog/catalog-components.test.tsx` "tailoring image alt required" (refused, error tied to the field, focus, axe) |
| 12 | Locked discount rows and discount list used opacity (contrast 2.8:1) | 1.4.3 | `PriorityLists.tsx`, `DiscountList.tsx` | axe sweep |
| 13 | Contentools surface messages used theme tokens on an always-light surface (white on white in dark) | 1.4.3 | `components/contentools/ContentoolsWrapper.tsx` | `ContentoolsWrapper.test.tsx` |
| 14 | Dashboard, customer and heads-up links 17 to 20 px high; Leaflet pins 16 px | 2.5.8 | `min-h-600` on the links, 24 px pin element in `components/store/BranchMap.tsx` | target-size sweep |
| 15 | Focused control could sit under the fixed Copilot launcher | 2.4.11 | `html { scroll-padding-bottom }` in `app/globals.css` | `scripts/globals-a11y.test.mjs` |
| 16 | No reduced-motion rule although 15 components use transitions | 2.3.3 | global rule in `app/globals.css`, `scripts/check-reduced-motion.mjs` in `npm run check` | `scripts/check-reduced-motion.test.mjs` |
| 17 | Lazy thumbnails without dimensions | perf, CLS | `loading="lazy"`, width and height in `ImagePanel.tsx` | review |
| 18 | `lang` and skip link had no test | 3.1.1, 2.4.1 | tests only | `app/layout.test.tsx` (`lang` follows locale), `Shell.a11y.test.tsx` (skip link first, targets `main`) |

New tests that need no fix: status chips carry text (`components/portal/Chip.test.tsx`), tab walks and overlays in a real browser (`portal-keyboard.md`), Contentools chrome adds no trap (`EditorBoundary.test.tsx`), axe for the shell in both locales, both themes and both roles (`Shell.a11y.test.tsx`) and for the catalog, account, company and Contentools states (their component test files).

## Accepted, third party or open (all in `plans/MISSED-FEATURES.md`)

- Lighthouse best practices below 100: Content and Theme pages 92 (the managers request `https://rsms.me/inter/inter.css`, refused by the CSP, and their own proxy calls answer 502 because no Contentools is connected in fixture mode); `en-US` pages 96 because the Lighthouse static cookie header returned 401 on two API calls (a real browser session shows no failing request, `portal-network-audit.md`); `valid-source-maps` is a dev-server artefact. Not portal defects.
- Performance metrics (LCP, CLS, INP): need a signed-in production build, which fixtures cannot give: M-Y-23. Code review found no layout-shift source: fonts are `next/font` (one family, `display: swap`, self-hosted), user images have fixed sizes, skeletons keep their size, the theme script runs before first paint.
- Client JavaScript: every portal screen is a client island over server route wrappers by design (SWR); no component could be converted to the server without moving its data hooks. The whole message catalogue (19 KB gzip) travels in every document (Q-Y05).
- Toast auto-dismiss (3.5 s), filter tab strips without a tabpanel, server-side alt requirement (Q-Y04): see MISSED-FEATURES.
- Real screen reader, real devices, owner visual review: M-Y-21, M-Y-22, M-Y-24, M-Y-25.

## Evidence files

`portal-pages.md`, `portal-axe-before.json`, `portal-axe-after.json`, `portal-contrast-before.txt` (the `border-input` rows read `--color-border` there because the role did not exist yet), `portal-contrast-after.txt`, `portal-bundle-report.txt`, `portal-keyboard.md`, `portal-network-audit.md`, `lighthouse/portal-*.json` (trimmed), `portal-*.png` (320, 375, 768, 1024, 1440; light `de-DE` and dark `en-US`; text-size and text-spacing runs), `plans/notes/questions-VWXYZ.md` (Q-Y03 to Q-Y07).
