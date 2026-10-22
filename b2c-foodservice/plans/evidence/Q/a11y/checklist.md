<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Accessibility checklist (Q-08, D4.2)

WCAG 2.2 AA (question Q-Q-2). Run on 2026-10-22 on the release build against the mock server. The VoiceOver pass is a person's job (owner row M-Q-02); this file is also the script for it: take the "How" column and read it aloud.

`ok` = checked and passes; `fixed` = failed, fixed (id in `fixes.md`), then passed; `open` = see `known-issues.md`.

| Area | How it was checked | Result | Evidence |
| --- | --- | --- | --- |
| Landmarks | 168 page and width runs: one `main`, one `footer`, at least one `header`, labelled `nav`s; `lang` equals the locale (`en-US`, `en-CA`) | ok | `responsive/results.json`, `runtime-audit.json` |
| Skip link | first Tab on home, listing, product page, cart reads `Skip to content`, is visible, and Enter lands on `main#main-content` | ok | `keyboard-checks.json` |
| Headings | exactly one `h1`, no skipped level on 24 public pages at 7 widths and 23 signed-in pages at 2 widths | fixed QFX-40 (addresses went from level 2 to 4), then ok | `responsive/results.json`, `account-audit.json` |
| Names | no unnamed button, link or field (0 on every audited page); every `img` has `alt` (0 without); icon-only controls carry `aria-label`; the account button's name starts with its visible initials | fixed QFX-03, QFX-29, then ok | `account-audit.json`, Lighthouse accessibility 100 on 20 pages |
| Forms | submit empty on sign-in, register and contact: every invalid field has `aria-invalid="true"` and `aria-describedby` to a text ("This field is required."), the first invalid field takes focus; optional fields say `(optional)` in the label; `autocomplete` tokens `given-name`, `family-name`, `email`, `new-password`, `current-password`, `name` are set | ok | `forms-checks.json` |
| Focus visible | 209 Tab stops on home, listing and product page: each has a 2 px accent outline (4.5:1 or better on the surfaces it sits on, 3.55:1 on ink) | ok | `keyboard-checks.json`, `contrast.md` section 4 |
| Focus order | header, then main, then footer in document order; cart: item, Collect, Ship, Decrease, Increase, Remove for each line, then the code field, Apply, Checkout | ok | `forms-checks.json` (`keyboardOrder`) |
| Focus not obscured | `scroll-padding-top` is 88 px on `html` against a 73 px sticky header; none of the 209 stops below the header sat under it | fixed QFX-04, then ok | `keyboard-checks.json` |
| Dialogs | store picker, country and language, mobile menu, filter sheet, cart drawer: focus moves in on open, 25 Tab and 5 Shift+Tab presses never leave, Escape closes, focus returns to the opener, `role="dialog"`, `aria-modal`, a name | fixed QFX-14, QFX-15, QFX-39 (radio group), then ok | `dialogs.json` |
| Keyboard | mega menu opens with ArrowDown and focus moves into the panel, Escape closes it and returns to the link; steppers, option buttons, the code field, remove and the cart controls are reached in the order above; the FAQ uses native `details` | fixed QFX-42 (focus stayed on the link), then ok | `mega-menu-keyboard.log.txt`, `forms-checks.json` |
| Status messages | adding to bag from Quick add announces `Added to bag` in a `role="status"` live region without taking focus; listing result counts (`12 products`) are in a polite live region | ok | `forms-checks.json` (`status`) |
| Colour alone | availability dots always have text; rating stars have the value in text (`3.9 out of 5`); selected options use `aria-pressed` and a check, not colour only (component tests: `OptionButton.test.tsx` asserts `aria-pressed`, `Rating.test.tsx` the name `4.6 out of 5, 12 reviews`, `AvailabilityDot.test.tsx` the label) | ok | test files, journeys screenshots |
| Motion | with `prefers-reduced-motion: reduce` emulated: 0 running animations, 0 infinite animations after load; the only elements at opacity 0 are the Save hearts, which appear on hover or focus and are always visible on touch (`[@media(hover:none)]`) | ok | `keyboard-checks.json` (`reducedMotion`) |
| Zoom and reflow | 640 px (200 % of 1280) and 320 px (400 %) on home, listing, product, cart, sign-in, FAQ, contact and article: no horizontal scroll, no clipped content | ok | `keyboard-checks.json` (`reflow`) |
| Text spacing | line height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em injected on 6 pages at 1440 and 375: no horizontal scroll, no text cut off (the one hit, `Sort by` at 375 px, is a visually hidden label) | ok | `keyboard-checks.json` (`textSpacing`), `text-spacing-pdp-1440.png` |
| Target size | 168 page and width runs and 46 signed-in runs: every control under 24 px has no other control within a 24 px circle (WCAG 2.5.8 spacing exception) or is an inline link; the product name link stretches over its whole card; the quantity stepper is 38 px (question Q-Q-4: keep) | fixed QFX-07, QFX-10, then ok | `responsive/results.json`, `account-audit.json` |
| Images and media | no `video`, `audio` or autoplay anywhere; every `img` has an `alt` attribute (product pictures say `<name>, pack shot`) | ok | matrix, source |
| Language | `lang="en-US"` and `lang="en-CA"` on `html` match the URL locale in every run; validation messages are English | ok | `responsive/results.json` |
| Contrast | 3971 text nodes on 23 pages at 1440 and 375: 0 failures; text over the hero gradient measured pixel by pixel | fixed QFX-41, then ok | `contrast.md` |
| Lighthouse accessibility | 20 pages, mobile and desktop (40 runs), CLI 13.5.0: 100 on all of them; the 404 page by snapshot: 100 | ok | `lighthouse-cli.json` |
| Screen reader | VoiceOver over home, a product page, cart, checkout and the subscriptions tab | open: M-Q-02 | |
