# Final report — Malva plumbing and waste management site (2026-10-09)

Nothing is committed. Everything is in the `b2b-manufacturing` worktree (`site/`, `seed/`, `plans/`, `openspec/`).

## What was built
A bilingual (en-US/USD, de-DE/EUR) Next.js 16 + commercetools site: homepage, plumbing and waste listings, 12 service pages, about, privacy, quote list, registration-first request a quote, sign-in, and a client portal (overview, quotes and requests with accept/decline/renegotiate, sites, team, service visits, waste documents, invoices, settings). Content is JSON-managed; catalogue, roles, stores and demo companies come from the seed scripts.

## Verified (evidence in `plans/evidence/`)
- `npm run check`: lint, typecheck, 522 unit tests, plan and spec checks green; `verify:build`: route table (public pages static/ISR), no secrets or commercetools host in the bundle, `npm audit --omit=dev` 0 vulnerabilities (Next 16.4.0).
- Accessibility (V): axe 0 violations on 40 pages in both locales; keyboard, contrast and 320 px reflow pass.
- Performance (W): Lighthouse mobile accessibility 100, SEO 100, CLS 0, measured LCP ≈ 0.8 s.
- SEO (X): 36 sitemap pages, 0 problems (`X/report.md`).
- Security (U): `notes/security-review.md`. This session added a cross-site write guard in `handle()` (403, tested and checked live); login rate limit gives 429 from the 11th bad attempt.
- Live journeys on the production build, each against throwaway data that was then deleted: registration and quote request; seller flow (staged quote, quote, send) through the MCP and client acceptance in the browser (R-06); site add, invite, colleague sign-in, removal (S-06); demo portal; locale switch keeping the page and re-creating the quote list in EUR with a notice.
- Every page in the sweep loads with no console or CSP errors (`Z/` screenshots).
- Data sweep through the MCP: only the two demo business units and demo customers remain; 0 carts, quote requests, orders; no `mpw-test-*` data.

## Not done, or needs the owner
- **Netlify deploy and preview smoke test (Y-02, Y-03, OA-05).** Needs the owner's Netlify site and variables.
- **API clients (OA-02, OA-04).** Dev runs on the seed client with `manage_project` (D25). Production must use the least-privilege Frontend and Provisioning clients; do not deploy with the seed client.
- **Real proof content (SO-04).** Stats, accreditations, testimonials, phone and email are samples, each marked "Sample content". `check:release` fails the production build until they are confirmed.
- **Screen-reader pass and visual comparison with the prototype (M-V-1, M-Y-1)** are manual.
- **de-DE copy** is an unverified translation (SO-03).

## Known gaps and deviations
- CSP allows `'unsafe-inline'` for scripts (D27).
- `unauthorized.tsx` / `forbidden.tsx` skipped.
- Mobile menu is built from the nav spec, not designed (SO-01).
- The invite form has no site picker; removed colleagues keep their customer record (`IDEAS.md`).
- Empty-list "General enquiry" line differs from the spec.
- Form control borders were darkened for contrast (Q-V1).
- Images are stored as clean URLs and sized at render time; third-party cookies from the image host lower best-practices to 77.
- Simulated Lighthouse performance is 85–92 on listing pages (below 90 on some) while measured LCP is under about 1 s.

## Re-running
`cd site && npm run check && npm run verify:build`; `cd seed && npm run seed` (see its README); `npm run delete-test-company -- mpw-test-<key>` removes a throwaway company with its quotes, requests, orders and customers.
