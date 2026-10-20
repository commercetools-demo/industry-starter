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
