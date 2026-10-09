# Decisions

Source of truth for choices already made. If a task conflicts with a decision, stop and ask (JUNIOR-GUIDE §8). Owner decisions are marked **(owner)**; verified platform facts **(verified)** with the date and how.

| ID | Decision | Why / evidence |
| --- | --- | --- |
| D1 | Next.js `^16` App Router (npm latest 16.4.0 on 2026-10-08), next-intl `^4`, Tailwind v4, SWR, jose, npm | `bootstrap-malva-storefront/design.md` |
| D2 | Services are commercetools **Products** **(owner)** | proposal |
| D3 | Guest quote list = anonymous cart, merged at sign-in | `malva-quote-list` |
| D4 | **Open registration** **(owner)**; registrant becomes company admin | `malva-client-portal` |
| D5 | Portal data = seeded Custom Objects behind `PortalDataSource` (demo) | Q-020 default |
| D6 | Proof content shown, labelled "Sample content" **(owner)** | Q-004 |
| D7 | Two locales: `en-US` (US, USD, default) and `de-DE` (DE, EUR) | Q-012, owner |
| D9 | Everything lives in `b2b-manufacturing/` **(owner)**; Malva specs are prefixed `malva-` | proposal |
| D10 | A **separate** commercetools project via the `spec-b2b-manufacturing` MCP **(owner)**; the health project is never touched | Q-001 |
| D11 | Registration first; no Quote Request from anonymous carts **(owner; verified)** | docs, "The B2B Cart", 2026-10-08 |
| D12 | Every service variant has one hidden 0 price per launch currency (USD and EUR) **(verified)**: a line item needs a matching price; without it the variant cannot enter a cart ("price on request") | docs, "Price selection", 2026-10-08 |
| D13 | No email in v1; accounts auto-verified; confirmations on screen **(owner)** | Q-003 |
| D14 | Seed lives in its own package `b2b-manufacturing/seed/` (not `site/scripts/seed/`) | `create-next-app` refuses a non-empty directory with conflicting files; the seed needs only the SDK and `tsx`, and can run before `site/` exists. Same scripts and conventions as the grocery sibling |
| D15 | All seeded keys carry the prefix `mpw-`; the cleanup script deletes only an **explicit allowlist** of the known sample resources, never "everything else" | safety; shared-project incident avoided |
| D16 | Image URLs are stored **clean** (no query string, no fragment) **(owner)**; chosen images are committed in `seed/data/*.json` | grocery `cleanUrl()` |
| D17 | Project settings the seed enforces: Product Search indexing (`ProductsSearch` mode) enabled, `countryTaxRateFallbackEnabled` true **(owner)**; `searchIndexing.productsSearch` was already Activated and the fallback already true on the health project when read on 2026-10-08, the new project must be checked | `seed/src/configure-project.ts` |
| D18 | Companies at registration are created by a **provisioning client** (server-only, minimal scopes), because the My Business Units API creates `Inactive` units and cannot assign stores, status or associates **(verified)** | docs, "My Business Units", 2026-10-08; Q-019 |
| D19 | Associate role permissions are taken only from the `Permission` enum **(verified)** against the OpenAPI schema `api-AssociateRole` on 2026-10-08 | `SEED-PLAN.md` |
| D20 | The root and locale layouts never read the session, so public pages stay static/ISR | `malva-data-loading` |
| D21 | Specs that talk about "SHALL NOT show a price" mean: never rendered; the zero price exists in commercetools only (D12) | `malva-bff-and-session` |
| D22 | Fonts are self-hosted WOFF2 Latin subsets of Inter 4.1 declared with `@font-face` in `globals.css` (not `next/font/local`), so the design tokens stay byte-identical to the kit; SIL OFL licence kept in `site/app/fonts/` | Workstream B, 2026-10-09 |
| D23 | Seeding and cleanup run through `seed/` with the owner-provided `seed/.env`; the MCP is used for reads/verification. `seed/.env.local` (git-ignored) overrides `.env` and holds the synthetic demo password | Owner, 2026-10-09 |
| D25 | Local development runs with the seed client (it can only request `manage_project`) in `site/.env.local`, git-ignored; the least-privilege Frontend and provisioning clients (OA-02, OA-04) remain deployment prerequisites and `lib/scopes.ts` lists what they need. This hides missing-scope bugs until the real clients exist | Owner gave seed credentials only, 2026-10-09 |
| D26 | Images are stored as clean originals; `sizedImage()` adds `?auto=compress&cs=tinysrgb&w=<width>` at render time (never sends a 5000 px photo to a phone) | Workstream J/W |
| D27 | The Content Security Policy allows `'unsafe-inline'` scripts because a nonce would force dynamic rendering of every page and defeat D20; everything else is locked to self and the three image hosts | `lib/security-headers.ts` |
| D28 | `next` return paths are locale-less (`/account/quotes`); the router adds the locale, and `safeNextPath` strips a prefix and rejects anything off-site | Workstream N |
| D29 | Proof content stays flagged `sample: true` with a visible "Sample content" marker until SO-04; `npm run check:release` (production context on Netlify) fails while any remains | Workstreams I, Y |

