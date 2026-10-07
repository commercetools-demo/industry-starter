## Why

The repo has behavioral specs and a visual design (`malva-storefront-design`) but no application. Before building pages we need one agreed foundation: framework and versions, folder structure, the commercetools BFF boundary, sessions, data-loading rules, locale routing and deploy shape. The `commercetools-storefront` skill (with its Next.js stack adapter) encodes a production-tested version of exactly this; capturing it as specs keeps implementers from re-deciding it per page and keeps secrets and per-user data out of the wrong tier.

## What Changes

- Bootstrap a Next.js 16 (App Router) + React 19 + next-intl 4 + Tailwind v4 storefront in `site/`, following the skill's `/nextjs-setup-project` layout.
- Adopt the skill's B2C surface and its non-negotiables: BFF-only commercetools access, server-managed sessions, type boundary via mappers, server-rendered catalog and client-fetched per-user state.
- Specify BCP-47 locale routing with `localePrefix: 'always'`, a single `COUNTRY_CONFIG`, and the locale-aware `Link`.
- Replace the scaffold's default theme with the Organic tokens from `malva-storefront-design`.
- Define deploy targets (Vercel/Netlify), quality gates and the health-check lifecycle.
- No page behavior is specified here; pages build on this foundation.

## Capabilities

### New Capabilities
- `storefront-platform-stack`: runtime, framework and library versions, scaffold command, dependency policy.
- `storefront-project-structure`: directory layout, path conventions, import and layering rules.
- `storefront-bff-and-session`: commercetools client singleton, env and secrets, signed-cookie session, Route Handler shape, health check.
- `storefront-data-loading`: server-rendered vs client-fetched rules, caching, SWR hydration, mappers and app types, cart and auth data flow.
- `storefront-locale-routing`: locales, proxy redirect, country/currency config, locale-aware navigation, messages.
- `storefront-styling-foundation`: Tailwind v4 setup, theme tokens, fonts, image handling.
- `storefront-delivery-quality`: deploy config, build/lint/type gates, environment handling, cleanup of dev-only routes.

### Modified Capabilities
<!-- None. Existing behavioral specs are unchanged; overlaps are mapped in design.md. -->

## Impact

- Creates `site/` and root deploy files (`vercel.json`, `netlify.toml`); no existing code is touched.
- Cross-cuts existing specs: `authentication-and-identity` (anonymous cart merge), `cart-management` and `checkout` (server-authoritative totals, payment via Checkout SDK), `switching-region-or-language`, `discovery-and-browse`, `error-pages`, `home-landing-page` (session-resolved context). Mapping in `design.md`.
- Depends on `malva-storefront-design` for tokens and chrome; informs its task groups 1–3.
- Requires a commercetools project with a Frontend B2C API client and (for payment) a Checkout application.
