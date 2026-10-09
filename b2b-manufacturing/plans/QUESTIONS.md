# Questions to the owner

Format: `Q-nnn` · spec(s) · **Question** · **Default** (what we build to if unanswered; the owner may overrule at any time) · **Blocking** (which workstream) · **Answer**.
Juniors add questions at the bottom (JUNIOR-GUIDE §8), id `Q-<letter>-<n>`.
Status: `Open` / `Answered (date)`.

## Round 1 — asked in chat on 2026-10-08, answered
### Q-001 · all (D10) — Answered 2026-10-08: use a different project
**Which commercetools project?** The `spec-b2c-health` MCP points at `spec-test-b2c-healthcare`, shared with the healthcare worktree. **Answer:** a separate project, reached through the `spec-b2b-manufacturing` MCP. **Follow-up:** that MCP was not connected in the planning session → OA-01. Nothing in the health project is touched.

### Q-002 · malva-request-a-quote, malva-client-portal (D11) — Answered 2026-10-08: registration first
**What happens when a visitor without an account submits Request a quote?** The platform forbids Quote Requests from anonymous carts. **Answer:** step 3 creates the account (open registration) and submits the request.

### Q-003 · malva-client-portal, malva-request-a-quote — Answered 2026-10-08: no email, auto-verify
**Email delivery.** **Answer:** none in v1; new accounts are auto-verified, confirmations are on screen, the team reads requests in the Merchant Center.

### Q-004 · malva-homepage, malva-about (D6) — Answered 2026-10-08: show, labelled sample
**Placeholder proof content on the demo site.** **Answer:** shown with a visible "Sample content" marker; the launch check fails while any remains.

### Q-005 · seed — Answered 2026-10-08 (owner instruction)
**Images.** Product and banner images are stored as clean URLs (no query string) in `seed/src/data`.

## Round 2 — defaults the owner can overrule (no answer needed to proceed)
### Q-010 · malva-homepage (proof content) · **Where does managed content live?** **Default:** JSON files in the repo (`site/content/*.json`) with a `sample` flag per item, validated by a schema test. Alternatives: commercetools custom objects, external CMS. **Blocking:** I. **Answer:** JSON — Answered 2026-10-08: JSON (`site/content/*.json`, per locale en-US and de-DE).
### Q-011 · malva-service-detail · **Who writes the long-form content of the 12 services** (included items, steps, records, FAQ)? **Default:** the seed contains realistic draft copy flagged `sample`; the owner replaces it later (SO-03). **Blocking:** L. **Answer:** In seed but no flag for sample. it should be realistic — Answered 2026-10-08: realistic copy in the seed, no sample flag (done: attribute removed, German copy added).
### Q-012 · malva-locale-routing (D7) · **Locale, country, currency.** **Default:** `en-GB`, GB, GBP (phone and registration formats in the design are UK-style). **Blocking:** C. **Answer:** [en-US, US, USD] and [de-DE, DE, EUR] — applied (default locale en-US). — Answered 2026-10-08: en-US/US/USD and de-DE/DE/EUR (applied to specs, plans, seed; default locale en-US).
### Q-013 · malva-service-listing · **Keep the sector filter?** **Default:** yes, `?sector=` on both listings, shown only when it changes the result (spec). **Blocking:** K. **Answer:** default
### Q-014 · malva-service-listing, malva-service-detail · **URL scheme.** **Default:** `/en-US/plumbing`, `/en-US/waste-management`, details at `/en-US/plumbing/<slug>` and `/en-US/waste-management/<slug>`; About `/en-US/about`; quote `/en-US/request-a-quote`; list `/en-US/quote-list`; portal `/en-US/account/...`. **Blocking:** C, K, L. **Answer:** default is ok
### Q-015 · malva-quote-list · **How long does a guest quote list live?** **Default:** 30 days (anonymous cart cookie lifetime = session cookie). **Blocking:** P. **Answer:** default
### Q-016 · malva-quote-list, malva-service-detail · **Which frequency options does each service offer?** **Default:** table in `SEED-PLAN.md` (e.g. CCTV survey: one-off, annual; grease trap: monthly, quarterly; general waste: weekly, fortnightly, monthly). **Blocking:** E, P. **Answer:** default
### Q-017 · malva-request-a-quote · **Several sites in one request?** **Default:** one Quote Request per site address; after the confirmation an "Add another site" action starts a new request with the services prefilled. (The platform needs one shipping address per cart.) **Blocking:** Q. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-018 · malva-request-a-quote · **Waste details fields.** **Default:** optional "Waste types" (free text) and "Permit or licence number", shown when hazardous, clinical or liquid waste is requested. **Blocking:** Q. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-019 · malva-business-unit-context, malva-client-portal (F, N) · **How are companies created at registration?** Verified: the My Business Units API creates the unit **Inactive**, cannot set status, assign stores or associates. **Default:** a server-only *provisioning* API client (`CTP_PROV_*`, scope limited to business units for this project) creates the Company, assigns store `mpw-web` and the administrator association in one step. **Blocking:** F, N. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-020 · malva-client-portal (D5) · **Where do visits, waste documents and invoices come from?** **Default:** seeded demo data stored as Custom Objects per company behind `PortalDataSource`; read-only; clearly labelled demo. **Blocking:** T. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-021 · malva-client-portal · **What is a "document" download?** **Default:** the BFF renders a simple PDF on the fly from the stored record (library `pdf-lib`), owner-checked; no files stored. **Blocking:** T. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-022 · malva-client-portal · **Inviting colleagues without email.** **Default:** the administrator creates the colleague's account; a one-time password is shown once on screen and must be changed at first sign-in. **Blocking:** S. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-023 · malva-client-portal · **Password reset without email.** **Default:** as specified: a one-time token shown on the page, 15 minutes, single use. **Blocking:** N. **Answer:** Remove the password reset option — applied. — Answered 2026-10-08: no password reset (scenario, route, link and task N-05 reworked into a guard).
### Q-024 · deployment · **Hosting.** **Default:** Netlify (the repo's `netlify.toml` was just moved into `site/`). **Blocking:** Y, OA-05. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-025 · all · **Analytics and cookie banner.** **Default:** none; only strictly necessary cookies (session), listed on the privacy page, so no consent banner is needed. **Blocking:** M, Y. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-026 · malva-request-a-quote, malva-about · **Privacy notice and terms.** **Default:** one privacy page with placeholder legal copy flagged `sample` (SO-02 sign-off); no terms page in v1. **Blocking:** M, Q. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-027 · malva-homepage · **Logo and brand assets.** **Default:** the design's CSS glyph + wordmark; no image asset. **Blocking:** H. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-028 · testing · **End-to-end test tool.** **Default:** unit tests (Vitest + Testing Library) in the quality gate; browser verification by Claude through the Chrome DevTools connector against `npm run dev`; no Playwright in v1 (IDEAS). **Blocking:** A. **Answer:** just unit tests — Answered 2026-10-08: unit tests only (browser checks stay manual-by-Claude, no Playwright).
### Q-029 · malva-business-unit-context · **Roles.** **Default:** three associate roles `mpw-admin`, `mpw-site-contact`, `mpw-finance` with the permission sets in `SEED-PLAN.md`; registrant = admin. **Blocking:** E, S. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")
### Q-030 · malva-service-listing, malva-homepage · **Search box.** **Default:** none (12 services; not in the design). **Blocking:** –. **Answer:** default (owner, 2026-10-08: "for the ones there is no answer, default is fine")

## Q-V1 Form control borders (raised 2026-10-09, workstream V)
The kit's default border `--border` (#D1D1D1) is 1.5:1 on white, below the 3:1 that WCAG 2.2 AA asks of a form control's edge. Inputs, selects and text areas therefore use `--fg3` (#707070, 4.9:1) for their border (`app/shell.css`); cards and tables keep the kit border. **Default if you do not answer:** keep the darker edge. If you prefer the lighter prototype look, delete the last rule in `app/shell.css`; the accessibility report will then list it as a known gap.
