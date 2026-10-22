<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Defects found by Q and what happened to them

`| id | where found | symptom | owning workstream | fix |`. The ids are `QFX-nn` (Q fix) so they cannot be mistaken for the questions of workstream F (`Q-F-nn`). Every fix has a test that failed first (the test names are in the commit); where the symptom can only be seen in a browser the journey is named. The commit hash carries the fix. Hashes are those of branch `ws/q-quality` (`git log --oneline --grep=ws-q`).

## Fixed

| id | where found | symptom | owning workstream | fix |
| --- | --- | --- | --- | --- |
| QFX-01 | responsive 900 px, product page | the fulfilment card badge ran out of its card | H | `fab5b931` |
| QFX-02 | Lighthouse SEO, listing, search, sign-in, register | no meta description | G, J | `96691d3e` |
| QFX-03 | Lighthouse accessibility, every page | the locale pill's accessible name did not contain its visible text | F | `96691d3e` |
| QFX-04 | accessibility, focus not obscured (WCAG 2.4.11) | the sticky header could hide a focused element | F | `0d4cf41a` (`scroll-padding-top`) |
| QFX-05 | performance, request counts | menu and footer links prefetched on every page | F | `0d4cf41a` |
| QFX-06 | J2 cart | the summary's `Subtotal` was the amount after the discount, so the discount line subtracted twice in the reader's head | I | `aae08d1a` |
| QFX-07 | J2 cart | a refused code kept its error text while the shopper typed another; the remove-code control was 20 px | I | `aae08d1a` |
| QFX-08 | accessibility, WCAG 2.4.2 | error pages (listing, product, global) had no document title | P, G, H | `607f0755` |
| QFX-09 | security S10, J13 | the contact route had its own limiter copy | P | `ef628004` (shared limiter, 5 per 10 minutes) |
| QFX-10 | target size, WCAG 2.5.8 | the footer store button, the contact consent box and the address and return checkboxes were 20 px | F, P, L | `6d98968c` |
| QFX-11 | J1 at 375 px | the add-to-bag button crushed its padding (`min-w-[200px]` beside the stepper) | H | `566128f2` |
| QFX-12 | J2 | after the last payment of a mixed bag its lines stayed in the old bag and came back at the next sign-in | K | `5f84233b` |
| QFX-13 | J4 | a canceled subscription still said `Next delivery skipped` | N | `9d700d86` |
| QFX-14 | L recipe at 375 | a dialog did not return focus to the control that opened it when the browser does not focus buttons on click (Safari, touch) | E | `6bd458c3` |
| QFX-15 | L recipe, console | `Blocked aria-hidden on an element because its descendant retained focus` when a dialog closed | E | `6bd458c3` |
| QFX-16 | J12 | a refused or timed out connection to commercetools answered 500 `internal_error` instead of 503 `upstream_unavailable` (the SDK nests the error) | D | `9b45b132` |
| QFX-17 | J1 at 375 | the store picker's search box lost its placeholder (the location button took the row) | F | `88005e4e` |
| QFX-18 | J2 at 1440 | the cart summary was not sticky (the box inside the wrapper was) | I | `cfca8e9c` |
| QFX-19 | accessibility 2.4.2, Lighthouse | the account pages had no document title and were indexable | L | `6ba41b2a` |
| QFX-20 | K recipe R6 | the checkout Review kept the old store after `Change store` until a reload | K | `a7180808` |
| QFX-21 | K recipe R15 | the open confirmation page never polled the order (SWR gave the interval function no data when only fallback data existed) | K | `aff676e6` |
| QFX-22 | performance, request counts | 16 prefetch requests on every page, 49 on home, 60 on the cart; links of the header, account menu and breadcrumbs, then every other link | F, all | `64fc3289`, then `02de3891`: `Link` of `i18n/routing.ts` does not prefetch unless asked (home 49 to 30 requests, listing 63 to 31, cart 60 to 25, product 54 to 36) |
| QFX-23 | J5 | after saving a review the average, count and bars above the list stayed old until a reload | M | `70f34305` |
| QFX-24 | J6 (serious) | a market switch with a bag lost the bag: the old-market links of the page were prefetched after the switch and the answer to the prefetch moved the session back and dropped the cart | F, I | `12eb5cf4` (first attempt, headers that Next strips before the proxy), `48f0ad13` (reads `Sec-Fetch-Dest`: only a page load moves the session) |
| QFX-25 | security S4, J14 | API answers without `Cache-Control` (`auth/me`, session routes, error answers) | D | `e6cc495e` |
| QFX-26 | J8 | the product page showed `Only N available` beside a disabled button | H | `30ab9e22` |
| QFX-27 | data, copy | seed copy `a espresso`, `a original` (grammar) | C | `7ffe95d2` |
| QFX-28 | Lighthouse SEO, listing and product | the title and meta description were streamed into the body for browsers (no `head` metadata for audits and link previews) | G, H | `22ea28d6` (`htmlLimitedBots: /.*/`) |
| QFX-29 | Lighthouse accessibility, signed in | the account button's name (`Account menu`) did not contain its visible initials | F | `70f34305` (`MO, Account menu`) |
| QFX-30 | bootstrap, missing secret | `next start` with a bad environment printed the error and stayed up answering 500 | A | `eeacce1b` (exits with 1 in production) |
| QFX-31 | security S4 | the guest email cookie and the pay cookie were set without `Secure` | K | `02de3891` |
| QFX-32 | security S10 | the review rate limit answered 429 without `Retry-After` | M | `02de3891` |
| QFX-33 | Lighthouse SEO, listing | no canonical address on category and all-products pages (then a relative one, which crawlers reject) | G | `18bd5f15`, `46d79193` (`metadataBase`) |
| QFX-34 | performance, LCP | the first listing card image was lazy although the page waits for it; the hero and the first gallery image had no fetch-priority hint | G, H, O | `02de3891`, `46d79193` |
| QFX-35 | security hardening H3 | an error thrown by the commercetools SDK could carry the `Authorization` header | D | `46d79193` (`maskSensitiveHeaderData: true`, test over every client) |
| QFX-36 | security hardening H7 | the bundle scan did not read the `.rsc` payloads the browser receives on navigation | A | `46d79193` |
| QFX-37 | security hardening H6 | the deploy gate did not fail on `CTP_SESSION_URL`, an `http://` receiver URL or a reviews client with another scope | A | `46d79193` |
| QFX-38 | security hardening H4 | no `Strict-Transport-Security` header | F | `46d79193` (production only, `max-age=31536000`) |
| QFX-39 | accessibility, keyboard run of the dialogs | Tab left the store picker for the page behind it: the trap treated the last radio of the store list as the last stop, but a radio group is one tab stop | F | `1afc53f2` (`tabStops()` in `use-dialog.ts`; the test fails without the fix) |
| QFX-40 | accessibility, signed-in audit of the account pages | the addresses page jumped from a level 2 section title to level 4 address names | L | `1afc53f2` (level 3) |
| QFX-41 | accessibility, contrast behind the hero gradient (pixel measure) | the hero eyebrow `The Autumn Edit` (11 px, `--accent`) was 4.43:1 at 1440 and 4.49:1 at 375 on the warm glow, under the 4.5 AA minimum; axe cannot see text on a gradient | O | `5584c8be` (`--accent-press`, 7.4:1; test) |
| QFX-42 | accessibility, keyboard run of the mega menu | ArrowDown on `Pods`, `Coffee`, `Machines` or `Accessories` opened the panel but left focus on the link (the panel fades in with a `visibility` transition and a hidden element takes no focus) | F | `7c881d4a` (focus is retried for up to ten frames; test fails without it) |
| QFX-43 | performance, Lighthouse mobile on the account Orders page | the footer was on screen while the list was still loading and jumped down when it arrived: layout shift 0.07 to 0.21 against the 0.1 budget | L | `b1d41659` (the frame is a screen tall; test; CLS 0 in three runs) |
| QFX-44 | clean-clone run with the build environment | two SEO tests (`sitemap lists content pages in both locales`, `robots disallows ...`) failed in a shell that has `NEXT_PUBLIC_SITE_URL` set, so `npm run check` was not independent of the environment | P | `aca6adcd` (the tests set the site origin variables themselves) |

44 fixed. The two files of `plans/evidence/Q/` that tell the story are `journeys.md` (symptoms in context) and `perf.md` (the numbers).

## Open or handed over

| id | where found | symptom | owner of the next step | status |
| --- | --- | --- | --- | --- |
| QO-01 | J2, mixed bag with a code | the Review total and the sum of the payments differ because the code is on the first payment only (question Q-Q-16) | K, after the live check M-Q-09 | open, blocks launch of discount codes on mixed bags |
| QO-02 | J12, J7 | an unknown product or category answers HTTP 200 (with `noindex`) and a page past the last answers 200 with a redirect (question Q-Q-18) | the lead | open, default keep |
| QO-03 | perf | mobile LCP 3.1 to 4.6 s (simulated slow 4G) against 2.5 s, and the product page 212 kB of script against 200 kB (questions Q-Q-19, Q-Q-20) | owner after OA-03 (real images), M-Q-05 | open, accepted for now |
| QO-04 | security S18 | `app/api/health`, `app/api/dev`, `app/[locale]/dev` still exist; `npm run predeploy` fails until they are removed (this is by design until the hand tests end) | owner, `plans/DEPLOY-NETLIFY.md` section 3 | open by design |
| QO-05 | security S17 | the six demo customers share one known password (SO-Q2, question Q-Q-8) | owner | open |
| QO-06 | J12 | the listing error page has no reference number; the cart count reads 0 while commerce is down; the confirmation says `Shipping $0.00` where the cart says `Free`; the Buy again dialog names no pack | G, I, K, L | parked in `plans/IDEAS.md` |
| QO-07 | recipes | live-only checks: hosted Checkout, Stripe, J15, the CSP origins, live statistics lag, live recurring orders | owner | rows in `plans/OWNER-HANDOFF.md` |
