<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream Q (quality and release)

Draft for the lead to consolidate into `QUESTIONS.md`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-Q-1 | Is a clean-clone `npm ci` run required on the release commit, besides the working-tree run? | Yes, once, before the deploy | no | Open |
| Q-Q-2 | Accessibility target | WCAG 2.2 AA (the token spec says AA) | no | Open |
| Q-Q-3 | Token value changes for contrast (`--ink-3`, `--teal-text`, `--danger-text`) | Already decided by workstream E (Q-E-1, M-E-02); Q only verifies that the pages use them | no | Open |
| Q-Q-4 | Stepper targets are 38 px in the token spec (below the 44 px touch guideline, above the WCAG 2.2 minimum of 24 px) | Keep 38 px, record it, enlarge on touch viewports only if cheap | no | Open |
| Q-Q-5 | Add `scroll-padding-top` so the sticky header never hides a focused element (F already adds the skip link; neither is in the shell spec) | Yes, small fix in Q-08 | no | Open |
| Q-Q-6 | Use the `__Host-` cookie prefix for the session cookie? | No (needs Secure also in development); add `Secure` in production only | no | Open |
| Q-Q-7 | In-memory rate limits are per instance on serverless hosting | Ship the in-memory limiter, recommend host WAF or rate-limit rules in the deploy notes | no | Open |
| Q-Q-8 | The six demo customers share one known password: keep them on a public deployment? | Keep for a demo site, documented in the README; SO-Q2 decides | deploy | Open |
| Q-Q-9 | Performance budgets | LCP 2.5 s mobile and 1.8 s desktop, CLS 0.1, INP or TBT 200 ms, First Load JS 200 kB (250 kB checkout and account), hero image 150 kB | no | Open |
| Q-Q-10 | Sitemap entries for products and categories before launch? | Content pages only (P); products parked in `IDEAS.md` | no | Open |
| Q-Q-11 | CSP enforce or report-only for the first deploy? | Enforce; report-only only if the hosted Checkout needs origins that cannot be listed | no | Open |
| Q-Q-12 | May Q fix defects itself? | Yes if under half a day and one area, with a failing test first and a `fixes.md` entry; otherwise back to the owning workstream via the lead | no | Open |
| Q-Q-13 | Real-card test through the hosted Checkout before launch? | No, test mode only; owner decides separately | deploy | Open |
| Q-Q-14 | Post-deploy smoke on a preview URL first or on production? | Preview first, then production | deploy | Open |
| Q-Q-15 | The guest order confirmation page is addressed by the order id only (a link, no sign-in). Is that link a capability? | Yes: the id is a random UUID, the page is `no-store`, `noindex`, with a strict referrer policy and no password in the URL; a member's order sends other visitors to sign-in. Option for later: show email and address only to the session that placed the order (security.md H9) | no | Open |
| Q-Q-16 | A mixed bag with a discount code: the Review shows the discount on the whole bag, but the code is only on the first payment (K, Q-K-02c), so the payments add up to more than the Review total. | Unchanged until the live project answers (M-Q-09); then K picks: code on every payment, or the Review shows the real payments | deploy | Open |
| Q-Q-17 | Journey J2 says "choose a colour; bundle machine only" for every machine. Machines without bundles (bean-to-cup) have colour variants only. | Keep: a bundle selector appears only where the product has bundles; the journey text is corrected | no | Open |
| Q-Q-18 | An unknown product or category URL answers HTTP 200 with the not-found page and `noindex` (the page streams under its `loading.tsx`, so the status cannot change), and a page number past the last page answers 200 with a redirect to the last page. | Keep: `noindex` is Next's documented answer; dropping `loading.tsx` would give real 404 and 307 but remove the instant skeleton on navigation | no | Open |
| Q-Q-19 | The product page loads 212 kB of JavaScript against the 200 kB budget (Q-Q-9). | Accept; idea: load the review form and sort on demand (IDEAS.md). Owner accepts with M-Q-05 | no | Open |
| Q-Q-20 | Mobile Lighthouse LCP is 3.1 to 4.6 s against the 2.5 s budget because the largest image is a placeholder (`placehold.co`, a 1200 x 1440 PNG that ignores the width parameter). | Accept for now; measure again with the real image endpoint (OA-03, OA-S-03) and sized images | no | Open |
| Q-Q-21 | Breakpoints against the spec text (`design-tokens-and-components`: "at 1080 px grids go to 3 columns, at 900 px detail, cart and account grids to one column and the hero image is hidden, at 820 px mobile navigation and a two-column product grid"). Every breakpoint token is a min-width, so the wide layout still applies at the exact width and the narrow one starts one pixel lower: 1080 px has four columns (1079 three), 900 px has the hero and two product-page columns (899 one), 820 px has the desktop bar (819 the mobile menu and two columns). Also measured: the home strip is 4, 3, 2 columns (1080, 820), the listing 3 then 2 (1080), the product page strips 4 then 2 (1080; no 3-column step). | Keep: only a window of exactly that width differs and the spec text can be read both ways; if the owner wants the max-width reading, change the five tokens in `app/tokens.css` by one pixel | no | Open |
