# Final report: Malva Healthcare storefront (2026-10-08/09)

## Result in one paragraph
All 26 workstreams (A–Z) of the plan were implemented by junior agents and merged on branch `worktree-b2c-healthcare` (209 of 215 plan tasks ticked). The app is a Next.js 16 / React 19 storefront in `b2c-healthcare/site/` with unit tests (**2,212**, `npm run check`), a fixtures-mode Playwright suite (**29 e2e tests**, `npm run e2e`) and a green production build. **Nothing has run against a live commercetools project**: no API clients or PSP/hosting accounts existed (OA-01…OA-06). Everything live is queued in `LIVE-TODOS.md` (157 ordered steps).

## What shipped (by workstream)
| WS | Delivered |
| --- | --- |
| A | Scaffold, `npm run check`, lint restrictions, test helpers, bundle/secret scans |
| B | Verbatim design tokens + parity check, self-hosted fonts, design lint, contrast tests |
| C | `en-US` routing, `proxy.ts`, messages, `COUNTRY_CONFIG`, locale-aware navigation |
| D | commercetools client singleton, signed cookie session (ids only), BFF route shape, dev-only health route |
| E | Seed scripts: sample-data cleanup, product types/types/states/tax/shipping, 8 doctors, 20 medicines, Pexels image script (clean URLs), verify/reset |
| F | Scheduling (time-zone safe, create-once slot claim), bookings, reviews, rate limit, clinical stand-in (Custom Objects), demo patients |
| G | Data-loading rules, cached public reads, atomic locale write, Product Search wrappers, mappers |
| H | UI primitives, header/footer/mobile menu, sign-in prompt, smoke page |
| I | Error pages, redacting logger, env guard |
| J | Sign-in/registration (auto-verified email, no reset UI), anonymous-cart merge, rate limits |
| K | Doctor list, filters in the URL, availability badges, search |
| L | Doctor profile, booking panel/modal, guest bookings, confirmation page |
| M | Home page with only sourced claims |
| N | Prescription lookup, refill ledger, monthly ceiling, shelf-life promise (BFF-only enforcement) |
| O | Cart (prescription lines, replace-not-duplicate, platform totals) |
| P | Address book, profile |
| Q | Checkout, delivery options (same-day cut-off), `placeOrder` (idempotent, order number, consumption), payment seam (Checkout adapter + demo provider) |
| R | Account area: overview, labs (+PDF), appointments, guest-booking attach |
| S | Order page/timeline, history, reorder, cancel |
| T | Saved lists, auto-refill (recurring orders + scheduled gate), saved payment methods |
| U | Mock cost-share resolver, allowance ledger, restricted tender, credential-gated controlled medicines |
| V | FAQ, contact, about, policies, journal (content files) |
| W | Region switcher (hidden with one region), cart-clear on currency change |
| X | Privacy inventory, erase/subject-access/retention/audit scripts, static scans |
| Y | `netlify.toml`, CSP/headers, deploy doc, scheduled-function guards, release prune of dev routes |
| Z | Playwright e2e, axe sweep (fixes below), Lighthouse (dev), security review, this report |

## How it was verified
- **Unit/integration:** 2,212 Vitest tests; every OpenSpec scenario is ticked with a test or marked N/A with a reason in its workstream file (`node plans/verify-plan.mjs` → OK; 50 specs, `password-reset` intentionally omitted).
- **Fixtures e2e (Playwright, `MALVA_FIXTURES=1`):** guest booking; allowance checkout → order → cancel; DEMO-payment checkout incl. declined card; auto-refill; controlled-medicine refusals; account area incl. PDF and cross-patient 404; ~30 routes at 1440 px and 390 px with console/overflow/axe assertions; keyboard-only booking and checkout. Screenshots in `plans/evidence/`.
- **Lighthouse (dev server, mobile, fixtures):** accessibility 98–100; best practices 100; SEO 100 on public pages (private pages are `noindex`). Performance numbers are dev-only (53–95) and not representative.
- **Security review:** no finding at confidence ≥ 8/10; tracked-file secrets scan clean.
- **Not verified:** anything against live commercetools, Stripe/Checkout, Netlify, a real inbox/PSP card (M-Q-1, M-T-1).

## Known gaps (details: `MISSED-FEATURES.md`, 125 entries)
- **Limits are bypassable through the API** (D-028, no API Extension) and auto-refill runs cannot be intercepted, only gated ahead of time.
- Funding (cost-share, allowance, restricted tender, credentials) uses **mock resolvers**; prescriptions/labs are a **Custom-Object demo stand-in** for an EHR.
- No email is sent anywhere; no password reset (by decision).
- Seed must be re-run on a project after the custom-type changes of O, Q, T, U; `clinicName` must be made searchable **before the first live seed** (irreversible).
- Checkout CLS 0.62 / cart CLS 0.11; doctors page heading order (moderate).
- Chrome DevTools connector was unavailable for most of the session; Playwright replaced it.

## What you need to do next
1. Read **"Needs your decision"** in `QUESTIONS-RAISED.md` (30 items; top: Checkout payment-only vs order creation, API Extension, API client scopes, capture vs authorize, session revocation, retention periods, booking rules).
2. Do OA-01…OA-03 (and OA-04, OA-06 when ready) from `TODO-MANUAL-TESTING.md`; sign-offs SO-01…SO-04.
3. Run the `LIVE-TODOS.md` runbook top to bottom (seed → verify → live checks); say the word and I will run the Merchant-Center-side checks through the MCP.
4. Push decision: the branch is on `origin/worktree-b2c-healthcare`; pushing to `main` was denied by the session permissions, so it has not been done.
