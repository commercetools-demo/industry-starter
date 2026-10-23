<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Contrast (Q-07)

Target: WCAG 2.2 AA, 4.5:1 for text under 24 px (or under 18.66 px bold), 3:1 for larger text and for the focus indicator.

## 1. What E decided, and that the pages use it

Token values and the decision are workstream E's (Q-E-1, owner row M-E-02): `--ink-3` is `#6E6B67`, `--teal-text` is `#08746F`, `--danger-text` is `#C62F35`; `--teal`, `--ct-amber-500` are for dots, icons and fills only; `--accent` text never sits on `--ink`. `app/tokens.test.ts` and E's `test/contrast.ts` check the pairs and run in `npm test` (1931 tests green). Q checked the other half: **the rendered pages really paint their text with those tokens.**

## 2. Runtime audit

Method: the D4.1 script (every text node, its computed colour against the first opaque background up the tree, large text at 24 px or 18.66 px bold) run in the page. Two runs:

| Run | Pages | Widths | Text nodes read | Failures |
| --- | --- | --- | --- | --- |
| First (Chrome DevTools MCP, `a11y/runtime-audit.json`) | 19 pages (home in `en-US` and `en-CA`, listing, search, four product pages, cart, checkout, sign-in, register, About, Contact, FAQ, policy, Journal list and article, 404) | 1440, 500 | not counted | 0 |
| Final (headless Chrome signed in as a seeded demo customer, `a11y/account-audit.json`; script `a11y/account-audit.mjs.txt`) | the 10 account pages (orders, one order, subscriptions, saved, reviews, addresses, payment methods, profile, settings, collection) and home, listing, two product pages, cart, checkout, about, contact, FAQ, policy, journal, article, 404 | 1440, 375 | 3971 | **0** |

No component paints small text in teal, amber, danger red or the old muted colour: availability text, error text, meta text, the subscription status pills and the order status badges all pass. (The numeric audit found nothing to fix, so there is no per-component commit for Q-07 from it; the one defect came from the gradient measure in section 3. The plan's tests for this already exist in the suite: `app/tokens.test.ts` for every token pair, `Field.test.tsx` for error text (`text-danger-text`), `OrdersTab.test.tsx` for the ready status text (`text-teal-text`).)

## 3. Text over images and gradients

The script cannot compute a colour against a gradient or a photo and lists those texts as notes: 8 text nodes on the home page (the hero eyebrow, the two-line headline, the strapline, `Find your store` and the three promise lines), at 1440 and at 375. Q measured them differently: `a11y/image-contrast.mjs.txt` makes the text transparent, takes a screenshot, reads every pixel behind each text box and reports the worst ratio against the text colour (`a11y/image-contrast.json`; the same run over the listing, a product page, About and the Journal found no text on a background image).

| Text | Colour | Worst ratio 1440 / 375 | Needs |
| --- | --- | --- | --- |
| Hero eyebrow `The Autumn Edit` (11 px) | `--accent-press` | 7.35 / 7.46 | 4.5 |
| Headline (80 and 44 px) | `--ink` | 15.4 / 15.7 | 3 |
| Strapline (18 px) | `#4F4F99` | 6.53 / 6.62 | 4.5 |
| `Find your store` | `--ink` | 15.18 / 15.18 | 4.5 |
| Promise lines (13.5 px) | `#4F4F99` | 6.45 / 6.35 | 4.5 |

**This found a defect (QFX-41):** the eyebrow used `--accent` and measured 4.43:1 at 1440 and 4.49:1 at 375 on the warm glow behind the hero, just under 4.5 for 11 px text. Axe and Lighthouse cannot see it (a gradient makes the check "needs review"). It now uses `--accent-press` (commit `5584c8be`, with a test).

By eye (screenshots `responsive/home-1440.png`, `home-900.png`, `home-375.png` and the lower half of the page): the category tile labels are white on a dark indigo scrim, and the collection banner's text is white or light grey on `--ink` with an indigo glow that sits behind the right-hand cards; both are high contrast on the placeholder pictures. With real photographs the tile scrim decides it; look at the tiles once more when the real images arrive (OA-03, listed in `known-issues.md`).

## 4. Focus indicator

The focus ring is `2px solid rgb(99, 89, 255)` (the accent) on every control that took focus in the keyboard run (209 stops over home, listing and product page, none without a ring: `a11y/keyboard-checks.json`). Accent on the page background is 4.54:1 and on the light card background 4.77:1, above the 3:1 needed for a non-text indicator. On the dark footer the accent on ink is 3.55:1, still above 3:1.

## 5. Not covered here

Pages behind the hosted Checkout (not runnable against the mock) and the Stripe form, which are the provider's. Real photographs, see section 3.
