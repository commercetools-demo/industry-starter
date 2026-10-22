<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Accessibility: known issues and accepted items

Everything an automated tool or a keyboard run flagged is either fixed (see `checklist.md` and `../fixes.md`) or listed here with the reason. There is no open failure of WCAG 2.2 AA that the checks can see; what is left needs a person, a real device or the real images.

| # | Item | Why it stays | Next step |
| --- | --- | --- | --- |
| 1 | Lighthouse SEO is 54 to 58 (and 66 on search) on cart, checkout, confirmation, account, sign-in and search | `noindex` is the design: those pages are private or result pages. The two audits it names are `is-crawlable` and `meta-description` | none; public pages score 100 |
| 2 | Lighthouse best practices 96 on checkout: one console error | `GET /api/checkout` answers 404 `cart_not_found` when checkout is opened by URL with no bag; the browser logs a failed fetch. Not seen by a shopper who comes from the cart | idea in `plans/IDEAS.md` (answer 200 with an empty state) |
| 3 | The quantity stepper targets are 38 px, under the 44 px touch guideline and above the 24 px WCAG minimum | the token spec fixes them; question Q-Q-4, default keep | owner may ask for 44 px on touch |
| 4 | About 900 small targets (under 24 px) across the matrix: breadcrumb and footer links, chips, swatches, the Save heart on small cards | each has no other target inside a 24 px circle, which is the WCAG 2.5.8 spacing exception; the script lists every one that does not and finds none | none |
| 5 | The page has two `nav` landmarks called `Main` (the desktop bar and the mobile panel) | only one is rendered at a time (the desktop bar is `display: none` under 820 px, the mobile panel is inert and `aria-hidden` while closed), so no reader meets both | none |
| 6 | The Save heart is invisible (opacity 0) until hover or focus on pointer devices | it is always visible on touch (`hover: none`), appears on keyboard focus, and has an accessible name (`Save <product>`); the design asks for it | none |
| 7 | `LegacyJavaScript` 14 kB in every trace | the default Next.js polyfills | none |
| 8 | Text over real photographs: the home tiles and any hero photograph | the placeholder pictures are flat colours; the scrim decides the contrast with a real picture | look again when OA-03 delivers the images (M-Q-02 covers home) |
| 9 | The hosted Checkout and the Stripe form | the provider's pages are outside this code; the storefront only links to them | owner journey J15 (M-Q-08) |
| 10 | VoiceOver and a real phone | needs a person | M-Q-02 (VoiceOver), M-Q-01 (phone) |
| 11 | A window of exactly 1080, 900 or 820 px gets the wide layout (four columns, hero and two product columns, desktop bar); the spec text reads like a max-width | every breakpoint token is a min-width (question Q-Q-21); only that one pixel differs | owner decides |
