<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Portal keyboard recipes (task Y-03, K8 to K14, portal half)

Real key events through the DevTools protocol (`Input.dispatchKeyEvent`) in headless Chrome against the dev fixture server, `adminA`. After every stop the focused element, its focus indicator (`box-shadow` from the kit's `--shadow-focus`, or an outline), whether it is in the viewport and whether another element covers its centre (2.4.11) were read. The only stop ever reported without a ring, off screen or covered is `nextjs-portal`, the Next.js development overlay, which does not exist in a production build.

## Tab walks (focus order, visible focus, 2.4.7 and 2.4.11)

| Page and width | Stops | Result |
| --- | --- | --- |
| Returns, Customers, Product info, Store settings, Product import at 1440, `de-DE`, light | 1 skip link, 2 part search, 3 unit switcher, 4 palette button, 5 bell, 6 theme toggle, 7 account, 8 to 22 the 15 navigation links, then the page controls in reading order, last the Copilot launcher | Every stop has the kit focus ring (`box-shadow: 0 0 0 2px`), none is covered, the skip link is the first stop |
| Returns, Store settings, Catalog prices at 375, `en-US`, dark | 1 skip link, 2 menu button (44 x 44), 3 unit switcher, 4 bell, 5 theme toggle, 6 account, then the page controls, last the Copilot launcher | Same; no rail in the tab order under 700 px (the drawer holds the navigation); every control 24 px or more, buttons 44 px |

## Overlays (K8, K9, K12), real browser

| Recipe | Result |
| --- | --- |
| Palette: focus the palette button, Enter | Focus moves to the combobox (`role=combobox`, `aria-activedescendant` set); ArrowDown changes the active option; Escape closes and focus returns to the palette button; Cmd+K opens it from anywhere; Tab stays inside the dialog |
| Copilot: Enter on the launcher | Focus moves to the panel field; Escape closes and focus returns to the launcher (before this work focus was lost: the launcher was unmounted while the panel was open) |
| Record-return dialog (K12): Enter on "Record a return" | Focus enters the dialog; 25 Tab presses never leave it; Escape closes and focus returns to the button (before: focus fell to the page) |
| Drawer at 375 (K9): Enter on the menu button | Focus enters the drawer; 30 Tab presses never leave it; Escape closes and focus returns to the menu button |

Component tests that keep these true: `components/portal/Dialog.test.tsx` (dialog focus trap and return, modal, drawer and confirm dialog), `components/layout/Shell.a11y.test.tsx` (skip link first, combobox pattern, palette trap, Copilot focus, account disclosure, drawer return), `hooks/useTablist.test.tsx` and `components/customers/StateTabs.test.tsx` (arrow keys, one tab stop), `components/contentools/EditorBoundary.test.tsx` (K14: the chrome around the Contentools managers adds no trap and no tab stop).

## Not covered here

The managers' own content (third party) and a real screen reader: `plans/TODO-MANUAL-TESTING.md` M-Y-21 and M-Y-25.
