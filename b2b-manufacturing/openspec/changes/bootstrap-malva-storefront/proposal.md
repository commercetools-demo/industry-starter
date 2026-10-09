## Why

The Malva website has a design and behaviour specs (`openspec/changes/malva-website`) but no application code. Every page, the quote list and the client portal depend on a project that exists, a server-only commercetools client, a session that carries the business-unit context, locale routing and a data-loading rule. Deciding these once, from the `commercetools-storefront` skill's Next.js adapter and its B2B references, stops each later change from inventing its own.

## What Changes

- Scaffold the storefront in `b2b-manufacturing/site/` on Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, next-intl v4, SWR and jose, following `/nextjs-setup-project`.
- Add the server tier: `lib/ct/client.ts` (`apiRoot` singleton), `lib/session.ts` (signed HTTP-only cookie carrying the B2B fields), the Route Handler shape for the BFF, `lib/mappers/` and `lib/types.ts` as the type boundary.
- Add the B2B context: one default commercetools Store and ProductSelection for the public site, store-channel resolution, and the Business Unit session fields written together.
- Add locale routing: `COUNTRY_CONFIG`, `i18n/routing.ts`, `i18n/request.ts`, `proxy.ts`.
- Fix the data-loading rule: catalog and marketing pages are server-rendered and cacheable, per-visitor state (quote list, account, business unit) is client-fetched; **deviation from the skill:** the root layout does not read the session, so public pages stay cacheable.
- Wire the design tokens and fonts from `design/malva/source/colors_and_type.css` as hooks only.
- Out of scope: any page content, nav and footer, catalog seeding, quote list, request form, registration and portal screens (they are `malva-website` tasks), deploy, optional skill features (BOPIS, bundles, superuser, recurring orders, approvals).

## Capabilities

### New Capabilities
- `malva-project-bootstrap`: repo layout, version gates, tooling, env files, quality gate, smoke test.
- `malva-bff-and-session`: commercetools client, least-privilege API client, session cookie, BFF boundary, type boundary, health check.
- `malva-business-unit-context`: default store and selection, channel resolution, atomic B2B session fields, business-unit selection and clearing.
- `malva-locale-routing`: locale-prefixed routes, country/currency/locale config, locale-aware navigation.
- `malva-data-loading`: server-rendered vs client-fetched rule, caching, cacheable public pages, client-state keys.

### Modified Capabilities
None. This change does not edit any existing spec. Overlaps with specs already in `openspec/specs/` (they belong to the manufacturing storefront) are handled by citation:
- `authentication-and-identity` — same intent (anonymous work carried into a signed-in session, no account enumeration); the Malva session fields here are what satisfy it. The sign-in behaviour itself lands in `malva-client-portal`.
- `account-registration-request` and `company-account-setup` — both hold a new account until the seller activates it. **Malva uses open registration** (owner decision), so they do **not** apply to Malva; registration is specified in `malva-website` and is out of scope here. The session and Business Unit foundation in this change supports it.
- `switching-region-or-language` — not needed in the first release (single locale); the three-field atomic locale write is provided so it can be added without rework.
- `error-pages` and `policy-pages` — own the 404/error content and policy copy; this change provides only the `error.tsx` / `not-found.tsx` shells.
- `home-landing-page`, `product-listing-page`, `product-detail-page`, `cart-page`, `checkout` — manufacturing behaviours; Malva's equivalents are the `malva-*` specs. Not touched.

## Impact

- New directory `b2b-manufacturing/site/` (all code); no change to `design/` or existing specs. The `malva-website` change is updated for open registration and the products decision (D2, D4).
- Requires a commercetools project, a Frontend (non-admin) API client, a Store and a ProductSelection; secrets stay in `.env.local`.
- Skill-pinned SDK majors (`@commercetools/platform-sdk ^8`, `@commercetools/ts-client ^4`) are older than npm latest (9.6.0, 5.1.0); see design decision 3.
- commercetools surface survey: no existing Malva code, so no prior platform usage to preserve.
