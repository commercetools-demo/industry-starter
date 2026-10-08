## Context

Source of truth: `commercetools-storefront` skill, Next.js adapter (`references/stack/nextjs/*`, `core/ct-client.md`, `core/data-loading.md`) and `commercetools-platform` `sdk-setup.md`. The design plan (`design/PLAN.md`) fixes the phase order and open decisions D1–D13; this change is phase 1 plus the server foundation phase 2+ rely on.

Versions checked against npm on 2026-10-07: next 16.4.0, next-intl 4.14.9, react 19.3.0, tailwindcss 4.3.3, swr 2.5.1, jose 6.2.12, typescript 7.0.2, `@commercetools/platform-sdk` 9.6.0, `@commercetools/ts-client` 5.1.0. Node 22 locally.

## Decisions

1. **Next.js `^16`, App Router, Route Handlers as the BFF.** The skill forbids 15.x (known vulnerabilities). A server tier is a hard prerequisite for the BFF and secret rules, so static export is not allowed.
2. **Tailwind v4 via `@tailwindcss/postcss`, no config file; `create-next-app --tailwind=false`.** Passing `--tailwind` installs v3. Design tokens enter through `:root` plus `@theme` (owned by `design-system-tokens`).
3. **commercetools SDK pins follow the skill (`platform-sdk ^8`, `ts-client ^4`), not latest.** The skill's snippets are written against these majors; latest are 9 and 5. Upgrading is a separate, tested change. *Alternative:* start on latest and adapt the snippets — rejected for phase 1 because the singleton and middleware signatures are the one thing every later task copies.
4. **Directory name `site/`.** Matches the skill's examples, `vercel.json`/`netlify.toml` (`base = "site"`) and keeps room for a future `connect.yaml` sibling (payments, ERP). Lives at `b2c-healthcare/site/`.
5. **Stateless BFF: jose-signed JWT in an HTTP-only cookie** (HS256, 30 days, `SESSION_SECRET` ≥ 32 chars). *Alternative:* server session store keyed by an opaque id — better for health data because the cookie carries nothing, but adds infrastructure. Chosen default is stateless with a deliberately small payload (ids and locale only; no name or email in the cookie, unlike the skill's example), so a later move to a store changes storage only. Open: confirm with the owner of `health-data-minimization`.
6. **Hard failure on missing `SESSION_SECRET`.** The skill's snippet falls back to a literal dev key; that is a forgeable-session bug in production. The module throws at import when the secret is absent or short, in every environment except an explicit `NODE_ENV=test`.
7. **Locale model = BCP-47 key into `COUNTRY_CONFIG`** (`en-US` → country US, currency USD). v1 supports one region (en-US) but the structure, `localePrefix: 'always'` and three-field atomic switch are in from day one because retrofitting prefixes breaks every link.
8. **Locale-aware links only** (`@/i18n/routing`); a lint rule bans `next/link` and `next/navigation` redirects in locale UI.
9. **`images.unoptimized: true`** kept: the commercetools CDN rejects the optimizer's query params. Doctor and article imagery are placeholders (D9), so this is cheap.
10. **Fonts and tokens are not specified here.** `next/font` for Poppins/Lato/Roboto and the parity check belong to `design-system-tokens`; the scaffold exposes `app/globals.css` and `app/layout.tsx` for them and runs their checks in the gate.
11. **Package manager: npm** with a committed lockfile (the skill's commands and deploy files assume npm).

## Target layout

```
b2c-healthcare/
├── design/  openspec/              (existing)
└── site/
    ├── app/
    │   ├── layout.tsx              root layout, SWRConfig fallback
    │   ├── globals.css             @import 'tailwindcss'; tokens; @theme
    │   ├── [locale]/               layout.tsx page.tsx error.tsx not-found.tsx
    │   └── api/{auth,cart,checkout,account,shipping-methods}/   (empty until their changes)
    ├── lib/
    │   ├── ct/                     client.ts (+ per-namespace helpers, server-only)
    │   ├── mappers/                commercetools → app types
    │   ├── session.ts  types.ts  cache-keys.ts  utils.ts
    ├── hooks/  context/  components/{ui,layout}/
    ├── i18n/{routing.ts,request.ts}   messages/en-US.json
    ├── proxy.ts  next.config.ts  postcss.config.mjs  tsconfig.json
    └── .env.example  .env.local (ignored)
```

`components/product/` from the skill is not created: the healthcare domain has `doctor`, `medication` and `lab` surfaces (D1), named when their changes land.

## Risks / Trade-offs

- Pinned older SDK majors → security/feature lag; mitigated by a follow-up upgrade task and a lockfile.
- Skill adapter is B2C-generic; healthcare adds Rx-bound items, bookings and health data. This change deliberately models none of that, so no skill pattern is bent here.
- `unstable_cache` and `proxy.ts` naming are Next 16 specifics; re-verify against the Next docs when bumping minors.
- Cookie holds `customerId` and `cartId`: not health data, but linkable. Treated as personal data in the privacy notice owned by `policy-pages`.

## Open Questions

- Q1: Real commercetools project key/region and API client for development (needed for the health check; none is recorded in the repo).
- Q2: Supported regions beyond en-US for launch.
- Q3: Stateless vs stateful session (decision 5).
- Q4: Hosting target (Vercel vs Netlify) — affects only root config files, deferred.
