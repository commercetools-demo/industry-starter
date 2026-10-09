## Context

Source of truth: the `commercetools-storefront` skill — Next.js adapter (`references/stack/nextjs/{overview,project-layout,concept-mapping,data-loading}.md`) and the B2B references (`b2b/session-and-bu.md`, `b2b/customer-auth.md`) — plus the `commercetools-platform` SDK setup. Behaviour lives in `openspec/changes/malva-website`; this change is the foundation under it.

Versions checked against npm on 2026-10-08: next 16.4.0 (latest), next-intl 4.14.9, `@commercetools/platform-sdk` 9.6.0, `@commercetools/ts-client` 5.1.0. Node 22 locally. Not re-checked today: react, tailwindcss, swr, jose, typescript (take the versions `create-next-app@^16` and npm resolve, subject to the gates in the spec).

Owner decisions already made: services are commercetools Products; portal registration is open; location is `b2b-manufacturing/`.

## Decisions

1. **Next.js `^16`, App Router, Route Handlers as the BFF.** The skill forbids 15.x. A server tier is a hard prerequisite for the BFF and secret rules, so no static export.
2. **Tailwind v4 via `@tailwindcss/postcss`, no config file; scaffold with `--tailwind=false`.** Passing `--tailwind` installs v3. Tokens enter through `:root` plus `@theme`.
3. **SDK pins follow the skill (`platform-sdk ^8`, `ts-client ^4`), not latest.** The skill's singleton and middleware snippets are written against these majors. Same choice as the `b2c-healthcare` bootstrap. Upgrading is a separate tested change. *Alternative:* start on 9 / 5 and adapt the snippets.
4. **Directory `site/`** at `b2b-manufacturing/site/` — matches the skill's examples and the repo convention (`site/` holds its own `netlify.toml`). Leaves room for a `connect.yaml` sibling later (email, ERP).
5. **Stateless BFF: jose-signed JWT in an HTTP-only cookie** (HS256, 30 days, `SESSION_SECRET` ≥ 32 chars). *Alternative:* server session store; not needed for B2B marketing + portal data of this sensitivity.
6. **Hard failure on missing or short `SESSION_SECRET`.** The skill's snippet falls back to a literal dev key, which is a forgeable-session bug in production.
7. **One public Store and ProductSelection (`malva-web`).** Anonymous visitors, prospects and clients all browse the same service Products, so every session carries `storeKey` and the resolved channel ids from the start. A signed-in client adds `businessUnitKey`. *Alternative:* one Store per client company (the skill's B2B default) — rejected: Malva has no per-client catalog or price, and per-client stores multiply setup for open registration. Revisit if contract-specific service sets appear.
8. **Open registration creates a Customer, a Business Unit (company) and an admin Associate in one flow.** The session then carries the BU. The registration screen and behaviour belong to `malva-website`; this change guarantees only that the session and BU context support a user with no BU yet (quote list, browsing) and one with a BU. **Verified (docs, 2026-10-08):** the My Business Units API creates the unit `Inactive` (changeable only by a project setting), and cannot manage stores, change status or assign associates, so a separate server-only *provisioning* client with narrow scopes (`CTP_PROV_*`) creates the Company, assigns the store and the `mpw-admin` association. It is built by the same builder in `lib/ct/client.ts` (so `new ClientBuilder(` still appears once). Plan: `plans/DECISIONS.md` D18, `plans/QUESTIONS.md` Q-019.
9. **Root layout does not read the session.** The skill's `SWRConfig fallback` example reads `cookies()` in `app/layout.tsx`, which opts every route into dynamic rendering. Malva's marketing, listing and detail pages must be cacheable and identical for every visitor (`malva-homepage`, `malva-service-listing`), so only the portal and API routes are dynamic; the nav's quote-list count and the sign-in state are fetched client-side with SWR after hydration, in space reserved to avoid layout shift. *Trade-off:* a brief empty state for those two elements.
10. **Locale model = BCP-47 key into `COUNTRY_CONFIG`** (`en-US` → US, USD; `de-DE` → DE, EUR). Two locales at launch (owner, Q-012), but `localePrefix: 'always'` and the three-field atomic write are in from day one because retrofitting prefixes breaks every link. *Alternative:* `as-needed` for a single-locale site; rejected to keep the skill's `proxy.ts` and cookie logic unchanged.
11. **Locale-aware links only** (`@/i18n/routing`); a lint rule bans `next/link`, and `next/navigation` redirects, in locale UI.
12. **`images.unoptimized: true`** kept: the commercetools CDN rejects the optimizer's query params. Marketing photography is served from `public/` or a CDN and sized at source.
13. **Product Search API for listings** (`apiRoot.products().search()`), never the deprecated `productProjections().search()`. Requires product search indexing to be enabled in the project (task 2.1).
14. **Fonts and tokens are not specified here.** `next/font` or `@font-face` for Inter / Inter Display and the token block come from `design/malva/source/colors_and_type.css`; the scaffold provides the places they plug in.
15. **Package manager: npm** with a committed lockfile.

## Target layout

```
b2b-manufacturing/
├── design/malva/  openspec/          (existing)
└── site/
    ├── app/
    │   ├── layout.tsx                root layout: fonts, providers that need no session
    │   ├── globals.css               @import 'tailwindcss'; tokens; @theme
    │   ├── [locale]/                 layout.tsx page.tsx error.tsx not-found.tsx
    │   └── api/{auth,account,cart,quote-requests,business-units}/   (empty until their changes)
    ├── lib/
    │   ├── ct/                       client.ts, stores.ts (+ per-namespace helpers, server-only)
    │   ├── mappers/                  commercetools → app types
    │   ├── session.ts  types.ts  cache-keys.ts  utils.ts
    ├── hooks/  context/  components/{ui,layout,service}/
    ├── i18n/{routing.ts,request.ts}  messages/en-US.json
    ├── proxy.ts  next.config.ts  postcss.config.mjs  tsconfig.json
    └── .env.example  .env.local (ignored)
```

`components/product/` from the skill becomes `components/service/` (Malva's products are services).

## Risks / Trade-offs

- Pinned older SDK majors lag on fixes; mitigated by a lockfile and a follow-up upgrade task.
- Deviating from the skill on the root layout (decision 9) means copied skill snippets for layout hydration must not be pasted as is; documented in `site/README.md`.
- One Store for everyone means no per-client service restriction; acceptable for now (decision 7).
- Open registration invites abuse (fake companies, spam accounts). Mitigations (email verification, rate limiting, no data exposure before verification) are requirements of the registration spec in `malva-website`, not of this bootstrap.
- `unstable_cache` and `proxy.ts` naming are Next 16 specifics; re-verify when bumping minors.

## Open Questions

- Q1: Real commercetools project key, region and API client for development (none is recorded in the repo).
- Q2: Locale and currency for launch (D7).
- Q3: Whether the Frontend API client can create Business Units and Associates (decision 8), or a second narrowly scoped client is needed.
- Q4: Hosting target (Vercel vs Netlify) — deferred; affects only root config files.
- Q5: Data sources for service visits, waste documents and invoices (D5): assumed commercetools holds Business Units, quote requests and orders only; the rest stays behind the seeded `PortalDataSource` interface until the owner names a source.
