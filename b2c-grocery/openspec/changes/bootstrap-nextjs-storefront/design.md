## Context

Source of the patterns: the `commercetools-storefront` skill (v0.34.1) — `references/stack/nextjs/*`, `core/*`, `b2c/*` — and the `/nextjs-setup-project` command. Versions were checked against npm on 2026-10-06: `next` 16.3.8, `react` 19.3.0, `next-intl` 4.14.9, `tailwindcss` 4.3.3, `swr` 2.5.1, `jose` 6.2.12, `@commercetools/platform-sdk` 9.6.0, `@commercetools/ts-client` 5.1.0. `.nvmrc` pins Node 22.

The repo already holds 33 behavioral specs (partly B2B-flavored: 18 mention business units or companies) and the `malva-storefront-design` change. This change is the technical foundation under both.

## Goals / Non-Goals

**Goals:**
- One reproducible scaffold and layout every page follows.
- Hard boundaries that prevent secret leaks, cross-user cache leaks and SDK types reaching components.
- Locale, currency and session handled once, centrally.

**Non-Goals:**
- Page implementations, product search/facets, checkout UI, account pages (separate changes).
- B2B surface (as-associate chain, business units, quotes, approvals). Not selected; existing B2B scenarios stay out of scope.
- Optional B2C features (BOPIS, bundles, superuser, recurring orders) unless a later change adds them.
- Connect connectors and payment-provider setup.

## Decisions

- **Framework: Next.js `^16`, never 15.x.** The skill treats 15.x as a security gate. Latest stable is 16.3.8. React 19, App Router, Server Components by default. Alternative Nuxt 4 rejected: the design/skill pairing is Next-first here; the user asked for Next.js.
- **App root is `site/`**, repo root stays for `openspec/`, `design/` and future Connect apps. The skill's deploy files assume `site/`. Alternative (app at repo root) rejected: collides with a future `connect.yaml` monorepo layout.
- **B2C surface only.** Matches repo name and the design; anonymous cart merge is required on login.
- **Stateless BFF session:** `jose` HS256 JWT in an HTTP-only, `sameSite=lax` cookie, 30-day expiry, `SESSION_SECRET` ≥ 32 chars. Alternative stateful store (Redis) deferred until a requirement (e.g. server-side revocation) appears.
- **Data loading split:** catalog (category, PDP, search) is server-rendered and calls `lib/ct/*` directly; cart, account, orders, wishlist are SWR → Route Handler → `lib/ct/*`. Per-user data never enters `unstable_cache`.
- **Type boundary:** SDK responses are mapped in `lib/mappers/` to app types in `lib/types.ts`; components import only app types.
- **Locale model:** BCP-47 keys (`en-US`, `de-DE`) everywhere (URL, cookie, `COUNTRY_CONFIG`, commercetools). `proxy.ts` (Next 16's rename of middleware) handles the redirect.
- **Theme override:** the scaffold's cream/terra/Inter theme is replaced by the Organic tokens (`design/source/_ds/styles.css`) mapped into Tailwind `@theme`. Caprasimo and Figtree are self-hosted.
- **`images.unoptimized: true`** is kept; the commercetools CDN rejects Next's optimizer query params.
- **SDK versions:** the skill's command installs `platform-sdk@^8` / `ts-client@^4`, but npm latest is 9.6.0 / 5.1.0. Start on the skill-verified majors; upgrading is a tracked task, not an assumption.

## Overlap with existing specs

| Existing spec | How this change touches it |
| --- | --- |
| `authentication-and-identity` | Session cookie, login endpoint (`apiRoot.login().post()`), anonymous cart merge (`MergeWithExistingCustomerCart`) are implemented by `storefront-bff-and-session`; uniform error messages remain that spec's rule |
| `cart-management`, `cart-page` | Cart state is client-fetched and server-authoritative; no client-computed totals — `storefront-data-loading` |
| `checkout`, `checkout-page`, `payment-methods` | Payment step is the Checkout SDK; it creates the order, the app clears `cartId` then redirects — `storefront-data-loading` |
| `switching-region-or-language` | Locale/currency/country updated atomically, `cartId` reset on change — `storefront-locale-routing` |
| `discovery-and-browse`, `product-listing-page` | Server-rendered with Product Search API (never `productProjections().search()`) — `storefront-data-loading` |
| `home-landing-page` | Session-resolved bag/account via SWR fallback, shared content cacheable — `storefront-data-loading` |
| `error-pages` | `error.tsx`, `not-found.tsx`, and no `redirect()` inside `try/catch` — `storefront-project-structure` |
| B2B-flavored scenarios in many specs | Out of scope until a B2B surface is chosen |

## Risks / Trade-offs

- [Skill pins older SDK majors] → Install verified versions first; upgrade as an isolated task with typecheck and smoke tests.
- [`unstable_cache` is a shared cache] → Whitelist cached data (project config 300s, category tree 60s, shipping methods 60s); lint/review rule: no session reads inside cached functions.
- [Secret exposure through `NEXT_PUBLIC_*`] → Env schema check in CI rejects any `NEXT_PUBLIC_CTP_*` or session secret.
- [Dev fallback session secret] → Production build fails if `SESSION_SECRET` is missing or short; the skill's literal dev fallback is not used.
- [Existing specs assume B2B] → Mapping above; decide B2C/B2B scope per capability when each page is implemented.

## Open Questions

- Answered (`plan/DECISIONS.md`): project `spec-test-b2c` us-central1.gcp (D-001); `en-US`/USD and `de-DE`/EUR (D-002, D-012); Netlify (D-003); Vitest unit tests only, no CI (D-004, D-013); npm (D-023); hosted Complete Checkout with Adyen (D-035).
- Still open (owner TODO): Frontend B2C API client credentials, Checkout application key and Adyen connector setup.
