<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront project: bootstrap and structure (Next.js 16, B2C, store by path)

## Purpose

The reseller storefront is one Next.js application that serves every reseller. The reseller is the commercetools **store** named in the URL path (`/[locale]/[store]/…`); there is no tenant registry in the app. Stores, product selections, channels and any domain routing are created and maintained by hand by an admin in the Merchant Center and at the hosting layer. This spec fixes how the project is created, laid out and gated, which commercetools and Contentools plumbing exists on day one, and what must work before feature work. It follows the `commercetools-storefront` skill (Next.js adapter, B2C surface), its `/nextjs-setup-project` command and the `integrate-contentools` skill; **Deviation** marks where this project differs.

Sources: skill `references/stack/nextjs/*`, `references/core/ct-client.md`, `references/b2c/overview.md`; `/Users/behnam/code/b2b2c-starter/.claude/skills/integrate-contentools/SKILL.md`; reference implementation `/Users/behnam/code/b2b2c-starter/customer` (Next 15, store resolved by `[dealer]` path segment; port its shapes, upgrade to Next 16); repo precedent `b2b-manufacturing/site` (gate scripts, env template).

## Requirements

### Requirement: Scaffold with the pinned stack

The system SHALL create the application in `b2b2c-automotive/storefront/` with `create-next-app@^16` using `--typescript --app --src-dir=false --tailwind=false --eslint --import-alias "@/*"`, and SHALL install `next@^16` (16.4.0 is latest on 2026-10-12), `react@19`, `next-intl@^4`, `@commercetools/platform-sdk@^8`, `@commercetools/ts-client@^4`, `swr`, `jose`, `zod`, `server-only`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `@commercetools-demo/puck-renderer`, `@commercetools-demo/puck-editor` (for `defaultPuckConfig`) and `@commercetools-demo/puck-types`, on Node 22 with an `.nvmrc`.

#### Scenario: Version gate
- **GIVEN** a fresh install
- **WHEN** `node scripts/check-versions.mjs` runs
- **THEN** it fails unless `next` is above 16.0.0, `next-intl` is 4.x, `platform-sdk` is 8.x and `ts-client` is 4.x

#### Scenario: Tailwind v3 guard
- **GIVEN** a `tailwind.config.*` file or the `--tailwind` scaffold flag
- **WHEN** `node scripts/check-tailwind.mjs` runs
- **THEN** it fails, because Tailwind v4 uses no config file

**Deviation / decision:** npm latest for `platform-sdk` is 9.7.0 and `ts-client` is 5.1.1; the skill and sibling project pin ^8 and ^4. Stay on the pins (open question J).

### Requirement: Directory structure

The system SHALL use this layout with the skill's portable conventions (`lib/ct/*`, `lib/mappers/*`, `lib/types.ts`, `lib/cache-keys.ts`, `hooks/*`, `context/*`):

```
b2b2c-automotive/storefront/
├── app/
│   ├── layout.tsx                  # root: SWRConfig fallback hydration, inline store theme <style>
│   ├── globals.css, tokens.css     # Tailwind v4 import; automotive tokens (copy of design-systems/automotive/tokens.css)
│   ├── [locale]/
│   │   ├── layout.tsx              # NextIntlClientProvider, providers
│   │   ├── [store]/                # the reseller (commercetools store key)
│   │   │   ├── layout.tsx          # store context, header, footer, CartProvider, GarageProvider
│   │   │   ├── page.tsx            # home (published Puck page, else default layout)
│   │   │   ├── (shop)/             # category/[slug], search, p/[slug], cart, checkout/*
│   │   │   ├── (account)/account/  # protected account area
│   │   │   └── [...slug]/page.tsx  # published Puck pages by slug
│   │   ├── error.tsx, not-found.tsx
│   ├── api/                        # BFF: auth, account, cart, checkout, garage, locale, store-context, contentools/[...path], health
│   ├── global-error.tsx, robots.ts, sitemap.ts
├── lib/
│   ├── ct/                         # server-only: client.ts, auth, cart, orders, categories, search, stores, vehicles
│   ├── contentools/                # origin.ts, puck.ts (published page), theme.ts (theme read)
│   ├── theme/                      # token adapter, sanitiser, font allow-list (see theming-design)
│   ├── mappers/, session.ts, session-core.ts, env.ts, errors.ts
│   ├── types.ts, cache-keys.ts, utils.ts    # COUNTRY_CONFIG, formatMoney, getLocalizedString
├── hooks/, context/
├── components/{ui,layout,product,vehicle,cart,checkout,account}/ and components/contentools/ContentoolsPage.tsx
├── i18n/{routing.ts,request.ts}, messages/{de-DE,en-US}.json
├── proxy.ts                        # locale + store-context middleware
├── next.config.ts, postcss.config.mjs, eslint.config.mjs, vitest.config.mts, tsconfig.json
├── scripts/                        # gate scripts
├── .env.example, .nvmrc, netlify.toml, AGENTS.md, CLAUDE.md, README.md
```

#### Scenario: Server-only boundary
- **GIVEN** a client component importing from `lib/ct/*` or the server reads in `lib/contentools/*`
- **WHEN** `node scripts/check-server-only.mjs` runs
- **THEN** it fails, and every file in `lib/ct` starts with `import 'server-only'`

### Requirement: Styling from the automotive tokens

The system SHALL load `app/tokens.css` (byte-identical to `design-systems/automotive/tokens.css`) and expose it to Tailwind through `@theme inline` so utilities resolve to CSS variables that the theme adapter overrides per store. The skill's placeholder palette (cream, charcoal, terra, sage) SHALL NOT be used.

#### Scenario: No raw values
- **GIVEN** a component with a raw hex colour, font name or px size
- **WHEN** `node scripts/check-tokens.mjs` runs
- **THEN** it fails and names the token to use

#### Scenario: Tokens in sync
- **GIVEN** `app/tokens.css` differs from `design-systems/automotive/tokens.css`
- **WHEN** the check runs
- **THEN** it fails with the diff

### Requirement: Locale routing for two locales

The system SHALL support exactly two locales, `de-DE` (default; EUR, country DE) and `en-US` (USD, country US), with next-intl v4, `localePrefix: 'always'`, `COUNTRY_CONFIG` keyed by BCP-47 locale (currency and country alongside), `Link`, `redirect`, `useRouter` and `usePathname` from `@/i18n/routing` only, and the choice kept in the `your-shop-country-locale` cookie; message catalogs are `messages/de-DE.json` and `messages/en-US.json`.

#### Scenario: Bare path
- **GIVEN** a request for `/` with no cookie
- **WHEN** the proxy runs
- **THEN** it redirects to `/de-DE`, and with the cookie set to `en-US` to `/en-US`

#### Scenario: Unsupported locale
- **GIVEN** a request for `/fr-FR/{store}`
- **WHEN** it is handled
- **THEN** it is treated as not found, and `check-messages` fails if the two catalogs have different keys

**Consequence to confirm:** the skill's flat config ties each locale to one currency and country, so `en-US` means USD and US. Prices in USD, US tax and US shipping must exist for the store, or `en-US` must be configured as English text with EUR and DE (open question K).

### Requirement: Store resolved from the path

The system SHALL treat the first path segment after the locale as the commercetools store key, resolve it in `proxy.ts` and `lib/ct/stores.ts` by reading the store (with its distribution channel, supply channel and product selection) through a short TTL cache, write `storeKey`, `distributionChannelId`, `supplyChannelId` and `productSelectionId` into the session together, and return the not-found page for an unknown store. The app SHALL NOT hold a tenant registry, custom-domain table or host mapping; domains and any host-to-path rewrite are set up manually at the hosting layer by an admin.

#### Scenario: Two resellers
- **GIVEN** stores `hartmann` and `lindner` created in the Merchant Center
- **WHEN** `/de-DE/hartmann` and `/de-DE/lindner` are opened
- **THEN** each shows its own assortment, prices, theme and published home page, and no data crosses

#### Scenario: Unknown store
- **GIVEN** `/de-DE/nope`
- **WHEN** it is requested
- **THEN** the response is 404 with no commercetools catalogue data

#### Scenario: No store segment
- **GIVEN** `/de-DE`
- **WHEN** it is requested
- **THEN** the not-found page shows (a dealer locator is out of scope)

#### Scenario: Store changes mid-session
- **GIVEN** a session written for store A
- **WHEN** the shopper opens store B's path
- **THEN** the four store fields update together and `cartId` is cleared

**Deviation:** the skill's proxy handles locale only. Path-based store resolution follows the `b2b2c-starter` customer app (`app/[locale]/[dealer]`).

### Requirement: BFF boundary and helpers

The system SHALL put one `apiRoot` singleton in `lib/ct/client.ts`, one function per commercetools operation in the matching `lib/ct/<namespace>.ts`, and Route Handlers that only validate the session, call `lib/ct`, and return JSON; the browser SHALL never call commercetools, and no secret SHALL use a public env prefix.

#### Scenario: Single client
- **GIVEN** `new ClientBuilder()` anywhere but `lib/ct/client.ts`
- **WHEN** lint runs
- **THEN** it fails

#### Scenario: Secret in the bundle
- **GIVEN** a production build
- **WHEN** `node scripts/check-bundle-secrets.mjs` scans `.next/static`
- **THEN** it fails if any env secret value appears

### Requirement: Stateless session

The system SHALL keep the session as a `jose`-signed JWT in an HTTP-only, `sameSite: lax`, `path: /` cookie (about 30 days) with `getSession`, `getLocale`, `createSessionToken`, `setSessionCookie` and `clearSessionCookie` in `lib/session.ts`, signed with `SESSION_SECRET` of at least 32 characters; the middleware and the Node layer SHALL read the same secret. The session carries `customerId`, `cartId`, `locale`, `currency`, `country` and the four store fields; locale, currency and country change together and `cartId` resets when currency changes.

#### Scenario: Weak secret
- **GIVEN** `SESSION_SECRET` shorter than 32 characters
- **WHEN** the app starts
- **THEN** startup fails with a clear message

#### Scenario: Customer bound to a store
- **GIVEN** a customer registered at store A
- **WHEN** they sign in under store B's path
- **THEN** sign-in is refused with the generic message (see `consumer-storefront/design-account-area`)

### Requirement: Client state

The system SHALL use SWR hooks in `hooks/*.ts` for mutable per-user data (cart, account, garage), cache keys in `lib/cache-keys.ts`, contexts in `context/*.tsx`, endpoint calls only inside hooks, and `SWRConfig` fallback in the root layout so first paint has no spinner flash.

#### Scenario: Hook-only fetching
- **GIVEN** a component calling `fetch('/api/...')` directly
- **WHEN** lint runs
- **THEN** it fails, requiring a hook

### Requirement: Contentools reads and the same-origin proxy

The system SHALL define `CONTENTOOLS_ORIGIN` (trailing slash trimmed) and `CONTENTOOLS_PROXY_BASE = '/api/contentools/service'` only in `lib/contentools/origin.ts`; SHALL fetch the published page for the store and slug in a Server Component with a plain `fetch` (`POST {origin}/service/{storeKey}/published/puck-pages/query`, header `x-project-key`, body `{ query: 'slug = "<slug>"' }`, `import type { PuckData }` only, React `cache()`), SHALL render it in a client component `ContentoolsPage` using `PuckApiProvider` and `PuckDataRenderer` with `defaultPuckConfig`, and SHALL render the fallback children when there is no published page; and SHALL expose a catch-all proxy `app/api/contentools/[...path]/route.ts` that injects `x-project-key` (the project key is `CTP_PROJECT_KEY`), deletes the `host` header, strips `content-encoding`, `content-length`, `transfer-encoding` and `connection` from the response, forwards the body only for non-GET/HEAD and uses `redirect: 'manual'`.

The storefront SHALL hold no Contentools JWT and SHALL restrict its proxy to read routes (GET, and the published-page query POST); any write method or other route returns 404.

#### Scenario: Published page
- **GIVEN** a published Puck page at the home slug for the store
- **WHEN** the home page is requested
- **THEN** the page is in the initial HTML, with no client fetch for the page itself

#### Scenario: No page
- **GIVEN** a store with no published page
- **WHEN** the home page is requested
- **THEN** the default layout renders

#### Scenario: createContext footgun
- **GIVEN** a Server Component importing a Puck package or `puck-api`
- **WHEN** lint runs
- **THEN** it fails; only `import type` from Puck packages is allowed outside `'use client'` files

#### Scenario: Write through the storefront proxy
- **GIVEN** a PUT to `/api/contentools/service/{store}/configuration/theme`
- **WHEN** the proxy handles it
- **THEN** it returns 404

**Deviation:** the reference proxy is method-agnostic; the storefront restricts it because it never needs writes.

### Requirement: Theme read, sanitised, applied at first paint

The system SHALL read the store's theme in `lib/contentools/theme.ts` (`GET {origin}/service/{storeKey}/configuration/theme` with `x-project-key`, React `cache()`, `null` when absent), sanitise every value against a safe-CSS pattern before it enters CSS, and apply it through the adapter in `consumer-storefront/theming-design` as an inline `<style id="store-theme">` in the root layout's head after the `@theme` defaults, so the first paint is correct.

#### Scenario: Hostile value
- **GIVEN** a theme value containing `;}</style><script>`
- **WHEN** the adapter builds the style block
- **THEN** the value is dropped or replaced by the default and no markup is injected

### Requirement: Environment and least privilege

The system SHALL document every variable and every API-client scope with a one-line reason in `.env.example`, use a frontend (non-admin) API client, and keep secrets out of version control. Variables: `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `SESSION_SECRET`, `CONTENTOOLS_ORIGIN`. Initial scopes (extend per feature, each with a reason): `view_project_settings`, `view_published_products`, `view_categories`, `view_stores`, `view_product_selections`, `view_shipping_methods`, `view_types`, `create_anonymous_token`, `manage_customers`, `manage_orders`.

#### Scenario: Undocumented scope
- **GIVEN** a scope in `CTP_SCOPES` with no comment in `.env.example`
- **WHEN** `node scripts/check-secrets.mjs` runs
- **THEN** it fails

### Requirement: Gates and tests

The system SHALL provide `npm run check` running typecheck, lint, the gate scripts (`check-versions`, `check-tailwind`, `check-secrets`, `check-server-only`, `check-bundle-secrets`, `check-tokens`, `check-messages`, `check-routes`, `check-no-dev-pages`, `check-no-health-in-release`) and `vitest` with Testing Library and `jest-axe`; scripts SHALL be ported from `b2b-manufacturing/site/scripts` where generic, dropping plumbing-specific ones (`check-sample-content`).

#### Scenario: Release without health route
- **GIVEN** a release build
- **WHEN** `check-no-health-in-release` runs
- **THEN** it fails while `app/api/health/route.ts` exists

### Requirement: Deployment config

The system SHALL keep `netlify.toml` in `storefront/` (Node 22, base directory set in the Netlify UI, as the reference and sibling projects do) and SHALL commit the `AGENTS.md` block that `next dev` writes.

#### Scenario: Preview versus production
- **GIVEN** a preview deploy
- **WHEN** it builds
- **THEN** it may show sample data, and the production context fails the build while sample data remains

### Requirement: Bootstrap acceptance

The system SHALL meet these before feature work starts: with a store created in the Merchant Center and the Contentools Merchant Center app connected, `/de-DE/{store}` and `/en-US/{store}` render the shell with the default theme from tokens only; `/api/health` confirms commercetools credentials; `npm run check` passes.

#### Scenario: Smoke
- **GIVEN** a seeded store and valid env
- **WHEN** the dev server starts and `/de-DE/{store}` is opened
- **THEN** the shell renders, the cart count is 0 and no console errors appear

## Gaps and decisions

- Garage persistence is specified in `consumer-storefront/design-vehicle-finder-and-garage`; bootstrap reserves `lib/ct/vehicles`, `hooks/useGarage.ts` and `GarageProvider`.
- Per-reseller domains are not part of the app. The design's "your own domain" is delivered by admin hosting configuration (for example a host rewrite to `/{locale}/{store}`) and is outside these specs.
- Shared code with the portal (types, `COUNTRY_CONFIG`, product mappers, Contentools origin module) is copied, not packaged: the repo has no workspace.
