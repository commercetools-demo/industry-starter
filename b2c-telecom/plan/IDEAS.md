# Ideas and parked work

Anything out of scope noticed while working. One bullet each: `- (workstream, task) idea`. Machine-translated German keys are listed here for review.
- (W, W-09) German copy needs native review: all `site/content/de-DE/**` files (about, faq, support, blog, legal) and the `content.*` keys in `messages/de-DE.json` are machine-translated (D-004). The German policy files are placeholder text like the English ones.
- (W, W-02) Content pages could get a sitemap.xml and per-article hreflang in a sitemap; not in the v1 plan.
- (T, T-15) German copy is machine-translated and needs native review: every key under `account.addresses.*`, `account.paymentMethods.*` and `account.lists.*` in `messages/de-DE.json` (formal Sie-form; H1 words "Zahlungsmethoden" and "Gespeicherte Listen" follow the T plan while the account navigation (S) says "Zahlungsarten" and "Merklisten": pick one wording).
- (T, T-14) "Save for later" for anonymous visitors only links to sign-in; the offer is not saved automatically after sign-in. A follow-up could remember the offer key in the return URL.
- (T, T-13) `DashboardExtras` (S's slot for a saved-lists preview on the dashboard) is still empty.
- (U, U-16) German copy of `checkout.*` and `confirmation.*` in `messages/de-DE.json` is machine-translated and needs native review (formal Sie-form).
- (Y, Y-01) No Content-Security-Policy header in v1 (the other security headers are set in `next.config.ts` and `netlify.toml`); a CSP needs nonces for Next inline scripts, the hotlinked image hosts and the Checkout browser SDK.
- (Z, Z-03) `npm audit` reports high and critical findings in the transitive dependency tree (first noted by A); triage before any public release.
- (Z, Z-03) In-memory rate limits (`lib/rate-limit.ts`) are per server instance and not reliable on serverless hosting; move to a shared store if abuse protection matters.
