<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Partner portal project: bootstrap and structure (Next.js 16, B2B)

## Purpose

The partner portal is a second Next.js application for resellers' staff: they run their store (assortment, prices, theme, content) and buy from Malva. It is a B2B surface: associates act for business units through the as-associate API chain and permissions come from associate roles. Seller-side administration (assortment, prices, discounts, store data) needs elevated access, so it runs through a separate server-only client behind an ownership check. The reseller's store is the **content and data namespace** (`storeKey`), as in the reference starter. There is no tenant or domain registry in the app: stores, domains and the Contentools connection are set up manually in the Merchant Center.

Sources: skill `references/stack/nextjs/*`, `references/b2b/{overview,session-and-bu,permissions,dashboard,add-api}.md`, `references/core/ct-client.md`; `/Users/behnam/code/b2b2c-starter/.claude/skills/integrate-contentools/SKILL.md`; reference implementation `/Users/behnam/code/b2b2c-starter/dealer` (Next 15; port its shapes, upgrade to Next 16); repo precedent `b2b-manufacturing/site` (`lib/ct/associate.ts`, `ownership.ts`, `scopes.ts`, gate scripts).

## Requirements

### Requirement: Scaffold with the same pinned stack

The system SHALL create the application in `b2b2c-automotive/portal/` with the same scaffold command, Node version and package pins as `consumer-storefront/bootstrap-and-structure` (Next 16, React 19, next-intl 4, platform-sdk 8, ts-client 4, swr, jose, zod, server-only, Tailwind v4), plus `@commercetools-demo/puck-page-manager`, `puck-content-manager` and `puck-theme-manager`, and SHALL NOT install Tailwind v3.

#### Scenario: Version gate
- **GIVEN** a fresh install
- **WHEN** `node scripts/check-versions.mjs` runs
- **THEN** it applies the same limits as the storefront

### Requirement: Directory structure

The system SHALL use this layout:

```
b2b2c-automotive/portal/
├── app/
│   ├── layout.tsx, globals.css, tokens.css      # admin kit tokens (copy of design/export/tokens.admin.css)
│   ├── [locale]/
│   │   ├── (auth)/                              # sign-in, register, reset, pending-approval (public)
│   │   └── (portal)/                            # authenticated: top bar + sidebar rail
│   │       ├── page.tsx                         # dashboard
│   │       ├── catalog/                         # assortment, price-overrides, product-info, discounts, priority
│   │       ├── bundles/, import/, store/ (settings, theme, channels, share), content/, marketing/, email/
│   │       ├── customers/, subscriptions/, returns/, reviews/, partnership/
│   │       ├── quick-order/, cart/, orders/, quotes/, approvals/, invoices/, price-lists/, lists/
│   │       └── company/, roles/, account/
│   ├── api/                                     # BFF: auth, account, business-units, cart, orders, quotes, approvals, seller/*, contentools/[...path], health
│   ├── error.tsx, not-found.tsx, forbidden.tsx, unauthorized.tsx, global-error.tsx
├── lib/
│   ├── ct/                                      # server-only
│   │   ├── client.ts                            # frontend API client (apiRoot)
│   │   ├── admin-client.ts                      # seller-admin API client (separate credentials)
│   │   ├── provisioning-client.ts               # registration only
│   │   ├── associate.ts, business-units.ts, stores.ts, carts.ts, orders.ts, quotes.ts, approvals.ts
│   │   ├── containers.ts                        # CONTENTOOLS_CONFIGURATION_CONTAINER, CONTENTOOLS_JWT_TOKEN_KEY
│   │   └── seller/                              # assortment, prices, discounts, tailoring, store settings
│   ├── contentools/                             # origin.ts, jwt.ts (getValidContentoolsJwt)
│   ├── authz/                                   # permissions.ts, authorize-store.ts, ownership.ts
│   ├── portal/                                  # nav definition, role gating, command palette index
│   ├── mappers/, session.ts, session-core.ts, env.ts, errors.ts, types.ts, cache-keys.ts, utils.ts, scopes.ts
├── hooks/                                       # SWR hooks, usePermissions, useBusinessUnit
├── context/                                     # BusinessUnitContext, PortalDialog, Theme (light/dark)
├── components/{ui,layout,portal,catalog,orders,approvals}/ and components/contentools/ContentoolsWrapper.tsx
├── i18n/, messages/{de-DE,en-US}.json, proxy.ts, next.config.ts, postcss.config.mjs, eslint.config.mjs, vitest.config.mts
├── scripts/, .env.example, .nvmrc, netlify.toml, AGENTS.md, CLAUDE.md, README.md
```

#### Scenario: Route map matches navigation
- **GIVEN** the navigation groups in `seller-portal/design-portal-shell-and-navigation`
- **WHEN** `node scripts/check-routes.mjs` runs
- **THEN** every navigation item has a route and every route is in the navigation or an allow-list

### Requirement: Styling from the admin kit

The system SHALL load `app/tokens.css` (the admin tokens) and expose them to Tailwind through `@theme inline`, with light and dark through `data-theme`, Inter as the only font, and the top bar dark in both themes. The portal SHALL NOT be reseller-themed.

#### Scenario: Dark mode
- **GIVEN** `data-theme="dark"` on the root
- **WHEN** the shell renders
- **THEN** surfaces use the dark tokens and the top bar stays `--color-bg-topbar`

#### Scenario: No raw values
- **GIVEN** a raw hex, px or non-Inter font in a component
- **WHEN** `check-tokens` runs
- **THEN** it fails

### Requirement: Locale routing for two locales

The system SHALL support exactly `de-DE` (default, EUR, DE) and `en-US` (USD, US) with next-intl v4, `localePrefix: 'always'`, `COUNTRY_CONFIG` keyed by BCP-47 locale, navigation primitives only from `@/i18n/routing`, and identical key sets in `messages/de-DE.json` and `messages/en-US.json`.

#### Scenario: Bare path
- **GIVEN** an unauthenticated request for `/`
- **WHEN** the proxy runs
- **THEN** it redirects to `/de-DE` and then to sign-in

### Requirement: B2B session

The system SHALL keep a `jose`-signed JWT session cookie (HTTP-only, lax, `SESSION_SECRET` of at least 32 characters, shared by middleware and Node layer) carrying `customerId`, `businessUnitKey`, `storeKey`, `distributionChannelId`, `supplyChannelId`, `productSelectionId`, `accountGroupIds`, `cartId`, and `locale`/`currency`/`country`; the five business-unit and store fields SHALL be written together from the resolved store, and locale fields together with `cartId` reset on currency change. The `storeKey` is also the Contentools namespace.

#### Scenario: Switch business unit or store
- **GIVEN** a user switching in the top bar
- **WHEN** the switch endpoint runs
- **THEN** all fields update in one session write, `cartId` clears and unit-scoped SWR keys refetch

### Requirement: As-associate for buying, admin client for selling

The system SHALL route every user-facing buying operation (carts, orders, quotes, approvals, lists, company) through `apiRoot.asAssociate().withAssociateIdValue(...).inBusinessUnitKey...`, and SHALL route seller-side administration (assortment, prices, discounts, tailoring, store settings) through `admin-client.ts` only inside Route Handlers that first call `authorizeStore(session, storeKey)`, which confirms the store belongs to the signed-in user's business unit (or its parents) and the user's role permits the action; the clients SHALL use different credentials and scopes, and the admin client SHALL NOT be imported outside `app/api/seller/**`, `lib/ct/seller/**` and `lib/contentools/jwt.ts`.

#### Scenario: Cross-store write
- **GIVEN** a user of reseller A sending a price override for a part in reseller B's store
- **WHEN** the seller endpoint runs
- **THEN** it returns 403 before any commercetools call, and a test covers this for each seller endpoint

#### Scenario: Project-level cart call
- **GIVEN** `apiRoot.carts()` used for a signed-in buyer
- **WHEN** lint runs
- **THEN** it fails, requiring the as-associate chain

### Requirement: Permissions in two layers

The system SHALL hide navigation items a role can never use and disable actions with "Insufficient permissions to perform this task" through `usePermissions()` and `lib/portal`, and SHALL rely on commercetools' as-associate enforcement plus `authorizeStore` on the server; a 403 from commercetools SHALL show the same message.

#### Scenario: Buyer role
- **GIVEN** a Buyer
- **WHEN** the shell renders
- **THEN** the items listed for Buyer in `seller-portal/design-portal-shell-and-navigation` are absent

### Requirement: Contentools JWT resolved on the server

The system SHALL resolve the Contentools JWT on the server only: read the custom object in container `contentools-configuration`, key `contentools-jwt-token` (written by the "multitenant contentools" Merchant Center app when an operator clicks Connect), decode its `exp`, return it if comfortably in the future, call `POST {CONTENTOOLS_ORIGIN}/service/refresh-jwt` with `Authorization: Bearer <old token>` when expired and persist the new token back to the custom object, and return `null` when absent or on any failure (React `cache()` per request). A `null` token SHALL show a "Contentools isn't connected — install the Merchant Center app and click Connect" state, not an error.

#### Scenario: Never connected
- **GIVEN** no JWT custom object
- **WHEN** the Content or Theme tab opens
- **THEN** the not-connected message shows and nothing crashes

#### Scenario: Expired token
- **GIVEN** a stored token past `exp`
- **WHEN** a page needing it renders
- **THEN** it is refreshed through `/service/refresh-jwt`, stored, and used, within the same request

**Deviation from the skill:** the integrate-contentools skill passes the JWT to the browser as a prop and lets the manager send it. See the next requirement.

### Requirement: Contentools editors through a hardened same-origin proxy

The system SHALL embed `PageManager`, `ContentManager` and `ThemeManager` in client components (`ContentoolsWrapper`, tabs: Content Pages, Content Items, Theme) with `projectKey` = `CTP_PROJECT_KEY`, `businessUnitKey` = the session `storeKey`, the active `locale`, a `parentUrl`, and an **absolute** `baseURL` (`window.location.origin` + `CONTENTOOLS_PROXY_BASE`), and SHALL refuse to render them until a store is selected. The catch-all proxy `app/api/contentools/[...path]/route.ts` SHALL export every HTTP method, inject `x-project-key`, delete `host`, strip `content-encoding`, `content-length`, `transfer-encoding` and `connection` from responses, forward the body only for non-GET/HEAD, use `redirect: 'manual'`, and in addition: (1) require a portal session, (2) rewrite the store segment of the path to the session `storeKey` (or reject a mismatch), (3) attach the server-resolved JWT as `Authorization` on write requests so the browser never holds it (the managers receive a placeholder `jwtToken`), and (4) allow only the theme, page and content routes the managers use.

The reason: a Contentools JWT carries only the project key (`sub`) and the store comes from the URL, so a project-wide token in the browser lets any signed-in user write any store's theme or pages.

#### Scenario: Tampered store
- **GIVEN** a user of reseller A calling `/api/contentools/service/{store-B}/configuration/theme` with PUT
- **WHEN** the proxy runs
- **THEN** the request is rewritten to store A (or rejected) and store B's theme is unchanged

#### Scenario: Token never in the browser
- **GIVEN** the editor page
- **WHEN** its network traffic and bundle are inspected
- **THEN** no Contentools JWT is present

#### Scenario: Other service routes
- **GIVEN** a request outside the allow-list
- **WHEN** the proxy runs
- **THEN** it returns 404

**Deviation / decision:** following the skill exactly (JWT in the browser) is simpler but weaker. Confirm that the managers accept a placeholder `jwtToken` and that the proxy's server-side `Authorization` is enough; if not, fall back to the skill's design plus the store rewrite (open question I).

### Requirement: Isolated editor styling

The system SHALL mount Contentools components inside a boundary component that supplies their own provider (they ship a Nimbus provider) and prevents their styles from altering the admin kit, with a short mount delay to avoid a flash of empty content.

#### Scenario: Style leak
- **GIVEN** the Theme tab open
- **WHEN** the rest of the shell is inspected
- **THEN** fonts, spacing and colours of the shell are unchanged

### Requirement: No domain or tenant registry

The system SHALL NOT write domains, hosts or tenant records; the Store settings screen SHALL show the store's address as a read-only value (the path segment and any host set up by an admin) and SHALL NOT offer subdomain editing or availability checks.

#### Scenario: Store settings
- **GIVEN** a user opening Store settings
- **WHEN** the page renders
- **THEN** name, logo and location are editable, and the storefront address is shown read-only with "Managed by Malva"

### Requirement: Registration and provisioning

The system SHALL use a separate provisioning client, used only by the registration endpoint, to create a pending reseller business unit and its first administrator, and SHALL leave the unit inactive until a Malva operator approves it in the Merchant Center.

#### Scenario: Pending
- **GIVEN** a newly registered business
- **WHEN** its administrator signs in
- **THEN** they reach a pending-approval page and no portal route

### Requirement: Environment and least privilege

The system SHALL document every variable and scope with a reason in `.env.example`, with three credential sets: frontend client (`CTP_*`), seller-admin client (`CTP_ADMIN_*`), provisioning client (`CTP_PROVISION_*`), plus `SESSION_SECRET` and `CONTENTOOLS_ORIGIN`; the Contentools project key is `CTP_PROJECT_KEY` and no other Contentools credential exists in the app. Initial frontend scopes: `view_project_settings`, `view_published_products`, `view_categories`, `view_stores`, `view_product_selections`, `view_associate_roles`, `view_types`, `manage_customers`, `manage_orders`, `manage_quotes`, `manage_quote_requests`, `view_quotes`. The seller-admin client additionally needs `manage_key_value_documents` (to read and refresh the JWT custom object) and, feature by feature, the assortment, price, discount and tailoring scopes, each with a reason and reviewed against the price-model decision (open question C); provisioning scopes include `manage_business_units`.

#### Scenario: Scope drift
- **GIVEN** a scope used by code but missing from `.env.example`, or the reverse
- **WHEN** `check-secrets` and `scopes.test.ts` run
- **THEN** they fail

### Requirement: Gates and tests

The system SHALL provide `npm run check` as in the storefront spec plus role tests (Admin, Buyer, Approver against navigation and disabled actions), a cross-store test for every `app/api/seller/**` route and for `/api/contentools`, and a test that the admin client is imported only from allowed folders.

#### Scenario: New seller endpoint without ownership test
- **GIVEN** a Route Handler under `app/api/seller/**` with no cross-store test
- **WHEN** `check-routes` runs
- **THEN** it fails

### Requirement: Deployment config

The system SHALL keep `netlify.toml` in `portal/` (Node 22, base directory set in the Netlify UI) and SHALL commit the `AGENTS.md` block `next dev` writes.

#### Scenario: Release
- **GIVEN** a production build
- **WHEN** gates run
- **THEN** no dev pages and no health route remain

### Requirement: Bootstrap acceptance

The system SHALL meet these before feature work starts: with the Contentools Merchant Center app connected, sign-in with a seeded demo associate reaches an empty dashboard inside the shell for each of Admin, Buyer and Approver with the correct navigation; the store switcher changes the label; the Theme tab loads Contentools' `ThemeManager` through the proxy for the user's store only; `npm run check` passes.

#### Scenario: Smoke
- **GIVEN** seeded associates and valid env
- **WHEN** the dev server starts and each role signs in
- **THEN** navigation matches the role, and `/api/health` confirms credentials

## Gaps and decisions

- No design for the editor loading and not-connected states; the admin kit needs them.
- Whether Malva operators use this portal or work only in the Merchant Center is open question F.
- Shared modules with the storefront are copied, not packaged (no workspace in the repo).
