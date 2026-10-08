## Why

The Malva Healthcare storefront has behavior specs and a design (`design/PLAN.md` phase 1 "Foundation"), but no application code. Every later phase (shell, catalog, cart, checkout, account) depends on a project that exists, a server-only commercetools client, a session, locale routing and a data-loading convention. Deciding these once, from the `commercetools-storefront` skill's Next.js adapter, keeps later changes from each inventing their own.

## What Changes

- Scaffold the storefront in `b2c-healthcare/site/` on Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, next-intl v4, SWR and jose, following `/nextjs-setup-project`.
- Add the server tier: `lib/ct/client.ts` (`apiRoot` singleton), `lib/session.ts` (signed HTTP-only cookie), Route Handler shape for the BFF, `lib/mappers/` and `lib/types.ts` as the type boundary.
- Add locale routing: `COUNTRY_CONFIG`, `i18n/routing.ts`, `i18n/request.ts`, `proxy.ts`.
- Fix the data-loading rule: catalog server-rendered, per-patient state through SWR → Route Handler; `unstable_cache` only for public data.
- Wire the design token file, fonts and design lint into the scaffold as hooks only; their content is owned by `design-system-tokens`.
- Out of scope: any page, nav/footer, catalog modeling, cart, checkout, account, deploy (`/nextjs-deploy-vercel|netlify`), B2B and optional skill features (BOPIS, bundles, superuser).

## Capabilities

### New Capabilities
- `storefront-project-bootstrap`: repo layout, version gates, tooling, env files, quality gates.
- `storefront-bff-and-session`: commercetools client, secrets, session cookie, BFF boundary, type boundary, health check.
- `storefront-locale-routing`: locale-prefixed routes, country/currency/locale config, locale-aware navigation.
- `storefront-data-loading`: server-rendered vs client-fetched rule, caching, session-derived hydration.

### Modified Capabilities
None. Overlaps are handled by citation, not edit:
- `design-system-tokens` owns token parity, fonts and lint rules; bootstrap only provides the places they plug in.
- `switching-region-or-language` owns region-switch behavior (cart currency conflicts); this change provides the three-field locale session it relies on.
- `authentication-and-identity` and `health-data-minimization` own what identity and data may be kept; the session spec constrains the cookie to comply.
- `design-storefront-shell` owns header/footer; it consumes the session and cart hooks defined here.

## Impact

- New directory `b2c-healthcare/site/` (all code). No change to `design/` or existing specs.
- Requires a commercetools project and a Frontend (non-admin) API client; secrets stay in `.env.local`, never committed.
- Skill-pinned SDK majors (`@commercetools/platform-sdk ^8`, `@commercetools/ts-client ^4`) are older than the latest npm releases (9.x, 5.x); see design.md decision 3.
- commercetools surface survey: no existing code, so there is no prior platform usage to preserve.
