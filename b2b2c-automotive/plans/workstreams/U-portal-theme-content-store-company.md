<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream U: Portal theme, content, store and channels, company and account

Status: DRAFT v1 (2026-10-12). Letters and dependencies: `plans/DEPENDENCY-PLAN.md`. `sp/` = `b2b2c-automotive/openspec/specs/seller-portal/`, `cs/` = `b2b2c-automotive/openspec/specs/consumer-storefront/`. Paths are relative to `b2b2c-automotive/` unless they start with `plans/`.

## Owner scope changes (interview 2026-10-12, binding)

| Owner answer | Effect on U |
| --- | --- |
| Q-V01 wholesale buying from Malva is out of scope | Dropped from `sp/design-company-and-account`: the requirement "Cost centres and budget" and its scenarios "Low remaining" and "Over budget order" (they exist only to cap purchases from Malva and trigger approval rules, which no longer exist). The Company page has tabs Users, Addresses, Profile; no Cost centres tab, no `costCentres` field, no `costCentre` order field, no budget maths. Roles are **Admin and Buyer only** (Approver dropped). |
| Q-O03 no territory blocking; Q-T03 no MAP floor | No store authorised-countries or territory field, no territory scenario and no floor reference in U. A store's `countries` stays only as the shipping and address country list. |
| Q-I02 OpenStreetMap with Leaflet | Branch screens use the same Leaflet map component as the storefront store picker (U-05). |
| Q-005 branch channels carry inventory and prices; Q-003 all prices standalone | Branch screens also show stock per branch and an optional per-branch price (U-05, calls T's `setStandalonePrice`). |
| Q-U01 logo and favicon through Contentools `upload-file` | Confirmed (decision 7); Q-U01 closed. |
| Q-P01 no emails at all | The invitation is not mailed: the Admin sees the one-time accept-invite link on screen and copies it (decision 16, U-09). |
| Q-004 no review gate | Themes and pages publish at once (nothing to change). |
| Q-Z01 project stays in labs | No effect. |

## 1. Goal

Four areas of the Partner Portal become real:

1. **Store & channels** (`/[locale]/store/...`, tabs Settings, Channels, Share, Theme): store name, logo and favicon, location, branches on an OpenStreetMap map with stock and price per branch (feeding the shopper store picker), channel statistics, attributed share links, and the Contentools `ThemeManager` with a real-page preview, "Reset to Malva default" and a saved-state toast.
2. **Content** (`/[locale]/content/...`): Contentools `PageManager` and `ContentManager` for the reseller's own pages and content blocks.
3. **Company & team** (`/[locale]/company/...`): users and invitations (Admin, Buyer), addresses, company profile.
4. **Account settings** (`/[locale]/account/...`): General, Security, Addresses, Business units.

The Contentools editors are embedded through a **hardened same-origin proxy**: the browser never holds the Contentools JWT, and a user of reseller A can never write reseller B's theme or pages. Prerequisite for the editors: owner action **OA-02** (the "multitenant contentools" Merchant Center app installed and connected so the JWT custom object exists).

## 2. Depends on

| Workstream | Needed | Check |
| --- | --- | --- |
| F | The seed (source of truth): stores `mau-reseller-north` and `mau-reseller-south` with distribution channels (retail channel plus branches), supply channels (warehouse plus branches) and `languages`; business units with associates (roles `mau-role-admin` and `mau-role-buyer` only); the merged custom types of section 5 (`store-settings`, `branch-info`, `malva-checkout`, `malva-customer`, `mau-business-unit-fields`); branch channels with `geoLocation`, stock and optional prices | MCP reads in section 12 |
| T | `setStandalonePrice(storeKey, sku, channelKey, cents)` and the assortment reader (`listAssigned(storeKey)`) used by the branch stock and price drawer | `plans/workstreams/T-*.md` |
| I | `components/store-picker/StoreMap` (Leaflet + OpenStreetMap) in the storefront, copied into the portal | `plans/workstreams/I-*.md` |
| H | Storefront theme adapter, the cache lifetime for theme reads (`THEME_TTL_SECONDS = 60` in H's `lib/contentools/theme.ts`), `default` namespace seeded with the Malva automotive theme in Contentools, `lib/contentools/theme.ts` loader | `plans/workstreams/H-*.md` done; note the cache lifetime in seconds (this plan uses `STOREFRONT_THEME_CACHE_SECONDS`, default 60) |
| R | Shell, `authorizeStore`, `sessionFor`, `expectCrossStoreForbidden`, `PortalAction` table, auth pages, `BusinessUnitContext`, placeholders for every route of this workstream | `npx vitest run lib/authz lib/portal` green |
| G | `lib/ct/admin-client.ts`, `lib/env.ts`, `scopes.ts`, rate limiter | `npm run check` green |
| OA-02 | Contentools connected (JWT custom object `contentools-configuration` / `contentools-jwt-token` exists) | MCP `read_custom_objects` container `contentools-configuration` |
| K, L, M, N, O (soft) | Storefront routes for the preview and the attribution contract (section 6) | `plans/workstreams/*.md`; if not done, the step is deferred with a TODO row, never blocked |

If the OA-02 JWT does not exist when U starts, build and test everything against a fake Contentools server (section 9, U-04), add the TODO row and continue; Claude re-runs the live steps when OA-02 is done.

## 3. Specs and requirement ids implemented

1. `sp/design-storefront-theme-and-branding/spec.md`
   - Theme tab under Store & channels
   - Presets limited to what the storefront supports
   - Storefront preview with real pages
   - Saving states when it takes effect
   - Reset to default
   - Email and invoice colours follow the theme (U delivers the loader contract `getStoreTheme` and `themePrimaryColour`; the template previews that consume it belong to W; no email is ever sent, Q-P01)
2. `sp/design-content-pages/spec.md`
   - Pages and content blocks use Contentools managers
   - Draft, published and history come from Contentools
   - Each reseller sees only its own content
   - Commerce blocks available in the editor (editor side; storefront rendering is K)
   - Not U: Storefront renders Puck documents (K, M), Mandatory elements are not content (M); U only cross-checks them in Chrome
3. `sp/design-store-and-channels/spec.md`
   - Store identity
   - Location
   - Branches
   - Channels table
   - Share links
4. `sp/design-company-and-account/spec.md`
   - Users
   - Addresses
   - Not built (owner, 2026-10-12, Q-V01): "Cost centres and budget" and its scenarios (see Owner scope changes)
   - Account settings
   - Company profile (later phase)
5. `sp/bootstrap-and-structure/spec.md`
   - Contentools JWT resolved on the server
   - Contentools editors through a hardened same-origin proxy
   - Isolated editor styling
   - No domain or tenant registry
   - Environment and least privilege (the part for Contentools and the scopes U adds)

Gaps left as gaps (not designed, not built): remove or deactivate user, role change UI, MFA, activity log, division management, data export, account deletion, legal pages, tax and payment settings, branch-level shipping rules.

## 4. Decisions already taken

| # | Decision | Source |
| --- | --- | --- |
| 1 | Theme, pages and content live in Contentools, edited with its own managers; the portal builds no editor and no version handling. | `design.md` section 2 and decision 2 |
| 2 | The browser calls Contentools only through `/api/contentools`. The proxy requires a portal session, rejects a store segment (or a `businessUnitKey` or `storeKey` in the query or JSON body) that is not the session `storeKey` (403 `PROXY_STORE_MISMATCH`, no upstream call; strict mode is the default, and `PROXY_STRICT_STORE=false` switches to rewriting the segment, honoured only outside production, for workstream X's test D02), injects `x-project-key`, attaches the server-resolved JWT on non-GET/HEAD requests, drops any client `Authorization`, `cookie`, `x-project-key` and `x-forwarded-*`, never follows redirects, and serves only an allow-list of routes (404 otherwise; malformed or traversal paths 400 `INVALID_PATH`). The managers receive a placeholder `jwtToken`. U builds the first version of these files and workstream X (X-07, attack catalogue D01 to D14) hardens the **same** files (`lib/contentools/allowlist.ts`, `lib/contentools/proxy-policy.ts`), so use exactly those names. | `sp/bootstrap-and-structure` hardened proxy; Contentools reads need only `x-project-key`, writes need the JWT (checked in `/Users/behnam/code/cms/service/src/routes/*.route.ts`); Q-U02 for the fallback |
| 3 | The JWT custom object value is a plain string at container `contentools-configuration`, key `contentools-jwt-token`; refresh is `POST {CONTENTOOLS_ORIGIN}/service/refresh-jwt` with `Authorization: Bearer <old>`, response `{ token }`, persisted back. | `b2b2c-starter/dealer/lib/contentools/jwt.ts`; skill `integrate-contentools` |
| 4 | Manager props: `projectKey` (`CTP_PROJECT_KEY`), `jwtToken` (placeholder), `baseURL` absolute (`window.location.origin` + `/api/contentools/service`), `businessUnitKey` = session `storeKey`, `locale`, `parentUrl`. `PageManager` additionally accepts `config` (Puck config), `backButton`, `messageOverrides`. Each manager mounts its own router with `basename = parentUrl`, so the Next routes must be catch-alls. | `/Users/behnam/code/cms/puck/packages/puck-page-manager/src/PageManager.tsx`, `puck-theme-manager/src/components/theme-editor.tsx`; reference `dealer/components/contentools/ContentoolsWrapper.tsx` |
| 5 | Presets: the ThemeManager has no prop to filter presets; it renders a native `<select id="theme-preset-select">`. The wrapper disables the options that the storefront does not honour (derived from `themePresets` by rule: `shadowStyle` neumorphic or clay, `surfaceBlur` not none, `backgroundStyle` gradient or noise) and appends " (Not supported on your storefront)". Today that is Neumorphism and Glassmorphism. | `cs/theming-design` "Locked tokens and unsupported theme fields"; `puck-theme-manager/src/presets.ts` |
| 6 | Content page has two tabs, "Pages" and "Content blocks". There is no Media tab: media is reached through the image picker inside the editors and is stored per store by Contentools. | `sp/design-content-pages` Gaps (default, Q-U10) |
| 7 | Logo and favicon: uploaded through the server to the Contentools object store (`POST {CONTENTOOLS_ORIGIN}/service/{storeKey}/upload-file`, multipart field `file`), URL stored on the store custom fields `logoUrl` and `faviconUrl` (clean URL, no query string). Owner confirmed 2026-10-12: Q-U01 closed. | `design.md` open question A; Q-U01 (answered) |
| 8 | One store per reseller. A branch is a channel with **both roles** `InventorySupply` and `ProductDistribution` (as the seed creates them), listed in the store's `supplyChannels` **and** `distributionChannels`, with native `address` and `geoLocation` and the custom type `branch-info` (seed fields `openingHours` JSON, `timezone`, `phone`, `pickupMode`, `storeKey`) that workstream I reads. A branch belongs to a store when it is in the store's channel lists and its `branch-info.storeKey` equals the store key (never by key prefix). The "Location" form edits the store's main location (fields of the seed type `store-settings`, which already has them). Removing a branch removes it from the store's supply and distribution channels (the channel itself stays, because channels in use cannot be deleted; the picker lists only the store's branch channels). Per owner Q-005 a branch channel carries **both inventory and prices**: stock is the inventory entries with `supplyChannel` = the branch; a branch price is a standalone price scoped to the branch channel (Q-003: all prices are standalone), written through T's `setStandalonePrice` with the seed key scheme `<sku>__<branchKey>` (`__usd` for USD); with no branch price the store channel price applies. | `design.md` open question E; `sp/design-store-and-channels`; `plans/workstreams/I-*.md` section 4; Q-U04; Q-005; Q-003 |
| 9 | Sales-channel attribution: share links carry `?ch=<channelId>`; the storefront stores it and writes the order custom field `salesChannel` (Enum `web`, `instagram`, `facebook`, `whatsapp`, `tiktok`, `in-store` of the seed type `malva-checkout`, one type on cart and order); the Channels table groups the store's last 30 days of orders by that field, with orders lacking it counted as "web (indicative)". Orders with `isTest = true` are excluded. | spec "Channels table"; Q-U05; `seed/src/data/custom-types.ts` |
| 10 | Channel list is a fixed constant: `web` and `instagram`, `facebook`, `whatsapp` (Live), `in-store` (Live, no share link; orders placed on a customer's behalf or at a branch), `tiktok` (Demo with deterministic synthetic figures labelled "Demo data"). | spec scenario "Demo channel" |
| 11 | The storefront address is read-only: `${STOREFRONT_ORIGIN}/${defaultLocale}/${storeKey}`, caption "Managed by Malva". No subdomain editing, no availability check, no domain or tenant records. | `sp/bootstrap-and-structure` "No domain or tenant registry" |
| 12 | Theme preview uses an iframe of the real storefront pages (Home, Listing, Product, Cart, Checkout) at Desktop and 375 px and shows the **saved** theme (reloaded after a successful save and by a Refresh button). The storefront must allow framing by the portal origin (Q-U06, hardening in X). | spec "Storefront preview with real pages" |
| 13 | Save toast: "Saved. {host} will show the change within {n} seconds." with host from `STOREFRONT_ORIGIN` and `n` = `STOREFRONT_THEME_CACHE_SECONDS`. | spec "Saving states when it takes effect" |
| 14 | Reset to Malva default deletes the store's theme (`DELETE /service/{storeKey}/configuration/theme` with the server JWT) after confirmation; Contentools falls back to the `default` namespace. | spec "Reset to default"; `cs/theming-design` |
| 15 | Mount isolation: the managers are mounted directly inside a boundary element with a light surface scope (`data-theme="light"`), because they ship their own Nimbus provider and hard-coded colours. If the style-leak assertions in the recipe fail, switch to the iframe embed route described in U-07b. | `sp/bootstrap-and-structure` "Isolated editor styling"; spec Gaps (dark mode) |
| 16 | Users are associates with role Admin or Buyer; invitation creates the customer (`isEmailVerified: false`, random password), adds the associate with the chosen role, and creates a password token; **no e-mail is sent** (Q-P01): the API returns the one-time accept-invite link once and the Admin sees it in a dialog with a Copy button and the note "Send this link to the invitee yourself. It is shown once." The link is never stored or logged. "Invited" = `isEmailVerified === false`; accepting sets the password and confirms the email. | `sp/design-company-and-account` "Users"; Q-R02 (obsolete); Q-P01 |
| 17 | Company addresses are business-unit addresses (Delivery, Delivery & billing, plus Billing for billing-only); the label is stored in `additionalAddressInfo`. Account settings addresses are the signed-in customer's personal addresses. | spec "Addresses"; plan decision |
| 18 | *(Removed, owner 2026-10-12 Q-V01: cost centres and budgets existed only for buying from Malva. The number is kept so the other decisions keep theirs. Q-U09 obsolete.)* | Q-V01 |
| 22 | Branch map: the same Leaflet + OpenStreetMap component as the storefront store picker (`components/store-picker/StoreMap` in I, copied to `portal/components/store/BranchMap.tsx`; both files listed in `scripts/check-shared-copies.mjs` so they cannot drift). No API key. Tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with the attribution "© OpenStreetMap contributors" visible on the map; CSP `img-src` allows `https://tile.openstreetmap.org`; Leaflet CSS and marker icons are imported from the npm package and bundled (no CDN). The public OSM tile servers have a usage policy (no heavy use, valid referrer, attribution): fine for the demo, a tile provider is needed for production traffic (note in Z). | Q-I02 |
| 19 | Password rules: minimum 12 characters; live messages exactly "Enter a new password", "Too short", "Passwords don't match", "Looks good"; the button reports "Fix the password first" when invalid. | `sp/design-company-and-account` |
| 20 | Company profile (reduced to what exists after Q-V01 and in the seed): fields are company name (business unit `name`), contact email (`contactEmail`), unit kind (`mau-business-unit-fields.kind`), store name and store key, region and currency (from `store-settings`: `defaultCountry`, `currency`). All read-only for everyone except Admin, who may edit display name and contact email; the store, region and currency fields are "Managed by Malva". Not built: tax ID, account number, credit limit, payment terms (wholesale items; the seed has no such fields, optional seed request). Non-admins see a note to contact an administrator. | spec "Company profile" (reduced); Q-U08; Q-V01 |
| 21 | Names in fixtures and seed-facing examples are neutral; "Hartmann" and other prototype names never appear. | `design.md` section 9 |

## 5. Data contract (must exist in the seed; checked in U-00; a gap becomes a row in `plans/notes/seed-requests.md`, never an edit of `seed/`)

U creates no custom type. The seed's merged types are the contract:

| Thing | Shape | Used by |
| --- | --- | --- |
| Store custom type `store-settings` | `ownerBusinessUnitKey`, `currency`, `taxLabel`, `freeShippingThresholdCent`, `defaultCountry`, `shipDaysMin`, `shipDaysMax`, `timezone`, `helpUrl`, `trackUrl`, `returnWindowDays`, and the location and identity fields `addressLine`, `postalCode`, `city`, `countryCode`, `latitude`, `longitude`, `logoUrl`, `faviconUrl` (all already in the seed type). U edits only the store name, `logoUrl`, `faviconUrl` and the location fields; the other fields stay as seeded | Settings, store picker (I) |
| Channel custom type `branch-info` | `openingHours` String (JSON `{"mon":["08:00","20:00"],"tue":[...]}`, a missing day means closed), `timezone` String (IANA), `phone` String, `pickupMode` Enum `same-day` / `next-day` / `ship-to-store`, `storeKey` String | Branches, store picker (I) |
| Business unit custom type `mau-business-unit-fields` | `kind` Enum `malva-global` / `malva-dach` / `reseller` / `branch`, `storeKey`, `channelKey`. There is no `reseller-company` type, no tax ID, account number, payment terms, credit limit or `headsUp`; the company profile uses the native unit fields (`name`, `contactEmail`, addresses) plus these (decision 20) | Company profile |
| Customer custom type `malva-customer` | `garage` (JSON), `preferredBranchKey`, `mobile`, `marketingConsent`, `marketingConsentAt`, `lastActiveAt` DateTime (R writes it at login). There is no `portal-customer` type and no `jobTitle` | Users list ("Last active") |
| Order and cart custom type `malva-checkout` | `salesChannel` Enum (`web`, `instagram`, `facebook`, `whatsapp`, `tiktok`, `in-store`), `isTest`, `deliveredAt`, `mobile`, `pickupBranchKey`, `fitVehicleLabel`, `placedOnBehalfBy`, `costCentre`. U reads `salesChannel` and `isTest` only; `costCentre` is in the seed type but is not used by anything (cost centres were dropped with wholesale) | Channels table, S |
| Branch inventory and prices | inventory entries (`sku`, `supplyChannel` = branch channel, `availableQuantity`; seed keys `mau-inv-<sku>-<channel suffix>`); standalone prices scoped to the branch channel, keys `<sku>__<branchKey>` (EUR) and `<sku>__<branchKey>__usd` (USD) (about one in seven carried items already has one in the seed) | Branch stock and price drawer, store picker, PDP |
| Contentools | JWT custom object; `default` namespace with the Malva automotive theme; per-store content namespace = store key | theme, pages |

Storefront contract owned by I/O (U depends on it, Q-U04, Q-U05): the store picker reads branches from the store's branch channels (supply and distribution) with the `branch-info` fields above (already the case in workstream I); `?ch=` allow-list is `web, instagram, facebook, whatsapp, tiktok`; the order gets `custom.fields.salesChannel`. Contract for I, L, M, N (owned by others, listed here so it is checked): when the shopper has chosen a branch, price selection uses that branch's channel (standalone price on the branch channel, falling back to the store channel price) and availability is read from the branch's inventory entry (Q-005). If the plan or code of I or O already defines other keys, **adopt theirs** (the reader defines the contract), update this table and Notes.

## 6. Role matrix for this workstream

Roles are Admin and Buyer only (Approver is dropped with the wholesale scope).

| Capability | Admin | Buyer |
| --- | --- | --- |
| Store & channels (all tabs, writes, branch stock and price) | yes | no (nav hidden; endpoints 403) |
| Theme tab (view and edit) | yes | no |
| Content (Pages, Content blocks) | yes | no |
| Company & team: view users, addresses, profile | yes | yes (read-only) |
| Company & team: invite (role Admin or Buyer), add or edit address, edit profile name and contact email | yes | no (disabled with "Insufficient permissions to perform this task"; endpoints 403) |
| Account settings (own profile, password, personal addresses, business units list) | yes | yes |

Add `PortalAction` entries to R's table: `store.edit`, `content.edit`, `company.view`, `company.edit`, `account.self` (Admin: all; Buyer: `company.view`, `account.self`).

## 7. Contentools proxy design (read before U-05)

Request path inside the proxy: `/api/contentools/service/{store}/{rest...}` maps to `{CONTENTOOLS_ORIGIN}/service/{store}/{rest...}`. Allow-list (anything else, including `refresh-jwt`, `authenticate-project`, `health`, `proxy-script`, generic `configuration` and `configurations` lists, header, footer and the other configuration keys: 404):

| Pattern after `service/{store}/` | Methods |
| --- | --- |
| `configuration/theme` | GET, POST, PUT, DELETE |
| `puck-pages`, `puck-pages/{key}`, `puck-pages/{key}/states`, `puck-pages/{key}/states/published`, `puck-pages/{key}/states/draft`, `puck-pages/{key}/versions` | GET, POST, PUT, DELETE |
| `published/puck-pages/{key}`, `preview/puck-pages/{key}`, `published/puck-pages/query`, `preview/puck-pages/query` | GET, POST |
| the same set for `puck-contents` | as above |
| `puck-templates`, `puck-templates/{key}` | GET, POST, PUT, DELETE |
| `upload-file` | POST |
| `media-library` | GET |
| `service/products/search` (no store segment) | GET, POST |

`{key}` matches `^[A-Za-z0-9._~-]+$`. Reject `..`, empty segments, encoded slashes (`%2f`, `%5c`), double encoding, NUL, tabs and backslashes before matching (400 `INVALID_PATH`). The pattern data lives in `lib/contentools/allowlist.ts` (`{ method, pattern }` with `:store` as the only placeholder) and the pure decision function in `lib/contentools/proxy-policy.ts` (`evaluateProxyRequest({ method, rawPath, query, bodyJson, sessionStoreKey }): { ok: true; upstreamPath: string } | { ok: false; status: 400 | 403 | 404 | 405; code: 'INVALID_PATH' | 'PROXY_STORE_MISMATCH' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' }`); workstream X hardens these two files, so keep these names. Methods other than the allow-listed ones answer 405 (`TRACE`, `CONNECT`); discover anything the managers need beyond it by running them with the proxy in log-only mode in development (`CONTENTOOLS_PROXY_LOG=1`), adding the route to the list with a test, never by relaxing a pattern to a wildcard (theme history, if the ThemeManager has it, is one to check).

Header rules: remove `host`, `cookie`, `authorization`, `x-forwarded-*`; set `x-project-key` to `CTP_PROJECT_KEY`; for methods other than GET and HEAD set `Authorization: Bearer <server JWT>` (503 `{ error: 'contentools_not_connected' }` if the JWT is null). Response: strip `content-encoding`, `content-length`, `transfer-encoding`, `connection`, `set-cookie`. Forward the body only for non-GET/HEAD, `redirect: 'manual'`: an upstream 3xx is answered with 502 and no `Location` header. An upstream 5xx is answered with `{ error: { code: 'UPSTREAM_ERROR' } }` only (never echo the upstream body, which could contain received headers); upstream 4xx bodies pass through (the editors show validation messages). Body limits: JSON writes at most 2 MB (413) and must be `application/json` (415); only `upload-file` accepts `multipart/form-data`, at most 11 MB. Unauthenticated requests get 401 before anything else. Export `GET POST PUT PATCH DELETE HEAD`; `OPTIONS` answers 204 with no CORS headers.

## 8. Tasks

Test-first (named tests in section 9). After each group `cd b2b2c-automotive/portal && npm run check`.

### U-00 Preflight and contract check

1. R done, tests green. Read the skill file `/Users/behnam/code/b2b2c-starter/.claude/skills/integrate-contentools/SKILL.md` completely, and in the `commercetools-storefront` skill `references/b2b/session-and-bu.md`, `references/b2b/permissions.md`, `references/b2b/customer-auth.md`; in `commercetools-commerce-patterns` `references/business-unit-hierarchy.md`, `custom-associate-roles.md`; in `commercetools-connect` `references/security.md` (secret and header hygiene).
2. Verify section 5 with the MCP reads of section 12; for a gap add a row to `plans/notes/seed-requests.md` (see "Seed requests"), never edit `seed/`.
3. Conventions from G and C: `apiRoot` is the frontend client, `adminRoot` the admin client (`lib/ct/admin-client.ts`; where a seller-side snippet in this file shows `apiRoot...` it means `adminRoot`); route helpers `handle`, `ApiError`, `parseJson`, `requireBusinessUnit` are in `lib/api.ts`; `getSession()`, `updateSession()` in `lib/session.ts`; the session cookie is `malva_portal_session`; scopes are documented in `lib/scopes.ts` as `{ scope, reason }` (U adds to `ADMIN_SCOPES`).
4. Check the installed manager packages: `cd portal && npm ls @commercetools-demo/puck-page-manager @commercetools-demo/puck-content-manager @commercetools-demo/puck-theme-manager` (all pinned exactly, bootstrap A installs them; if absent run `npm install --save-exact @commercetools-demo/puck-page-manager@<latest> ...` using the versions `npm view <pkg> version` reports). Read each package's `dist/*.d.ts` for the props and confirm `PageManager` has `config` (decision 4) and whether the ThemeManager declares `locale` (pass it through a spread if not, as the reference wrapper does).
5. Add to `.env.example` with a reason: `CONTENTOOLS_ORIGIN`, `STOREFRONT_ORIGIN` (read-only address, preview, share links), `STOREFRONT_THEME_CACHE_SECONDS` (default 60, must equal H's cache lifetime), optional `GEOCODER_USER_AGENT`. Admin client scopes for this workstream (determine exact strings from the docs with the Knowledge MCP `commercetools-documentation-search` per resource, do not guess): key-value documents (read and refresh the JWT), stores (manage), channels (manage), types (view), orders (view, channel statistics), inventory (manage, branch stock), standalone prices (manage, via T's helper; the scope may already be added by T), customers (manage, for invitation; frontend client already has `manage_customers`). Record the owner action OA-13 (section 13). Add the OpenStreetMap tile host to the portal CSP `img-src` (see decision 22).

### U-01 Contentools foundation [SKILL: commercetools-connect] [SKILL: commercetools-storefront]

- `lib/contentools/origin.ts` exports `CONTENTOOLS_ORIGIN` (env, default from `.env.example`, trailing slash trimmed) and `CONTENTOOLS_PROXY_BASE = '/api/contentools/service'`. Nothing else reads `process.env.CONTENTOOLS_ORIGIN`.
- `lib/ct/containers.ts`: `CONTENTOOLS_CONFIGURATION_CONTAINER = 'contentools-configuration'`, `CONTENTOOLS_JWT_TOKEN_KEY = 'contentools-jwt-token'`.
- `lib/contentools/jwt.ts` (admin client, allowed by the import test):

```ts
export function isJwtValid(token: string | null, nowMs = Date.now(), skewSeconds = 60): token is string;
export const getValidContentoolsJwt: () => Promise<string | null>;   // React cache(); null when absent or on any failure; never throws
```

Logic: read the custom object value (string); valid (exp more than 60 s ahead) returns it; absent returns `null`; expired calls `POST ${CONTENTOOLS_ORIGIN}/service/refresh-jwt` with `Authorization: Bearer <old>`, reads `{ token }`, validates it, upserts the custom object with the current version, returns it; any failure returns `null`. The token is never logged.

### U-02 Allow-list and proxy [SKILL: commercetools-connect]

Files `lib/contentools/allowlist.ts` (section 7 patterns), `lib/contentools/proxy-policy.ts` (pure, see section 7) and `app/api/contentools/[...path]/route.ts` wrapped with `handle` from `lib/api.ts`. Order inside the handler: session required (401) → `evaluateProxyRequest` (path hygiene 400, method 405, allow-list 404, store check 403 `PROXY_STORE_MISMATCH` including query and JSON body, no upstream call on any refusal; the `service/products/search` route has no store segment and is exempt) → size and content type (413, 415) → build headers → JWT for writes → fetch upstream → filter response headers and map 3xx and 5xx (section 7). Errors use the `{ error: { code, message? } }` shape of `lib/api.ts`. Add `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'`.

### U-03 Wrapper, boundary and states [SKILL: commercetools-storefront]

- `components/contentools/ContentoolsWrapper.tsx` (client): props `{ tab: 'pages' | 'items' | 'theme'; parentUrl: string; locale: string; storeKey: string | null; connected: boolean }`. Renders in order: no `storeKey` gives "Pick a store to edit its storefront."; `connected === false` gives "Contentools isn't connected — install the Merchant Center app and click Connect"; otherwise a 500 ms delayed mount (spinner meanwhile), then the manager with `projectKey` (passed from the server page as a prop; the key is not secret and the proxy injects it anyway, so there is no `NEXT_PUBLIC_` variable); `jwtToken="server-managed"`; `baseURL = window.location.origin + CONTENTOOLS_PROXY_BASE`; `businessUnitKey = storeKey`; `locale`; `parentUrl`.
- `components/contentools/EditorBoundary.tsx`: wrapper `div` with `data-theme="light"`, `isolation: isolate`, definite height (the managers render `height: 100%` flex columns and collapse without one; use `min-height: calc(100vh - 16rem)`), and `MutationObserver` hooks for the preset select (U-08).
- Placeholder token check (decision 2, Q-U02): first try `"server-managed"`. If a manager rejects or decodes it (console error, blank editor), use an unsigned JWT-shaped placeholder `header.payload.signature` whose payload has `exp` far in the future (helper `placeholderJwt()` in `lib/contentools/placeholder.ts`, no real claims, test asserts it contains no `sub`). If both fail, apply the fallback in Q-U02 (JWT to the browser plus the store check) and note it in Notes; do not silently choose.
- Server pages (RSC) compute `connected = (await getValidContentoolsJwt()) !== null` and pass booleans only; the token string never leaves the server.

### U-04 Fake Contentools server for tests [SKILL: commercetools-connect]

`scripts/fake-contentools.mjs` (Node `http`, port 4011; workstream X has its own recording stub `scripts/attack/stub-contentools.mjs` on 4010, do not reuse or rename it): implements the allow-listed routes in memory per store (GET and PUT theme, pages list, upload-file returning `{ url }`), requires `x-project-key`, requires `Authorization: Bearer` for writes (401 otherwise), and logs received headers. `CONTENTOOLS_ORIGIN=http://localhost:4011` for the proxy tests and for local runs before OA-02. Not shipped to production (excluded in `netlify.toml` and not imported).

### U-05 Store & channels pages [SKILL: commercetools-storefront]

Routes under `app/[locale]/(portal)/store/`: `layout.tsx` (page header and tabs Settings, Channels, Share, Theme), `settings/page.tsx`, `channels/page.tsx`, `share/page.tsx`, `theme/[[...slug]]/page.tsx`. `store/page.tsx` redirects to `store/settings`. Replace R's placeholder; add `store/*` to the allow-list in `lib/portal/nav.ts` if R did not.

**Settings (identity and location)** `lib/ct/seller/store-settings.ts` (admin client):

```ts
export interface StoreSettings { key: string; name: Record<string,string>; logoUrl?: string; faviconUrl?: string; location: { addressLine?: string; postalCode?: string; city?: string; countryCode?: string; latitude?: number; longitude?: number }; address: string /* read-only storefront address */ }
export async function getStoreSettings(storeKey: string): Promise<StoreSettings>;
export async function saveStoreSettings(storeKey: string, input: StoreSettingsInput): Promise<StoreSettings>;
```

Update shape (confirm builders with the OAS tool `api-Store-write`): `POST /stores/key=<k>` `{ version, actions: [ { action: 'setName', name: { 'de-DE': '…', 'en-US': '…' } }, { action: 'setCustomField', name: 'latitude', value: 48.137 }, … ] }`; if the store has no custom type yet, first `{ action: 'setCustomType', type: { typeId: 'type', key: 'store-settings' }, fields: {} }`. Retry on 409 with the latest version. Zod: name 2 to 80 chars per language; latitude -90..90, longitude -180..180 (both or neither); URLs must be `https:` or the Contentools origin. Routes `GET/PUT /api/seller/store/settings` (storeKey in query/body, `authorizeStore(…, 'store.edit')` first), `POST /api/seller/store/logo` and `.../favicon` (multipart; images validated with the same helper as T-08 `lib/catalog/image-rules.ts` if it exists, otherwise create `lib/images/validate.ts` with min 128 x 128 for the favicon and 600 px wide for the logo, JPG, PNG or WebP only (no SVG, which can carry script); uploaded through `ContentoolsImageStore` (same interface as T-08; if T-08 does not exist yet, create `lib/images/image-store.ts` with the interface, the Contentools implementation and a fake, and let T import it)). The storefront address is `${STOREFRONT_ORIGIN}/${defaultLocale}/${storeKey}` rendered read-only with "Managed by Malva" and no edit control, no availability check. Save shows "Location saved". Optional **Find coordinates** button calls `POST /api/seller/store/geocode { address }` (server-side OpenStreetMap Nominatim with `User-Agent` from env, 1 request per second, result cached 24 h; failure keeps manual input) (Q-U07).

**Branches** `lib/ct/seller/branches.ts` and routes `GET/POST /api/seller/store/branches`, `PUT/DELETE /api/seller/store/branches/[key]`:

```
POST /channels
{ "key": "mau-br-north-wandsbek", "roles": ["InventorySupply", "ProductDistribution"], "name": {"de-DE":"Wandsbek","en-US":"Wandsbek"},
  "address": { "country": "DE", "streetName": "Beispielstrasse", "streetNumber": "12", "postalCode": "22041", "city": "Hamburg" },
  "geoLocation": { "type": "Point", "coordinates": [10.0653, 53.5711] },
  "custom": { "type": { "typeId": "type", "key": "branch-info" }, "fields": { "openingHours": "{\"mon\":[\"08:00\",\"18:00\"],\"tue\":[\"08:00\",\"18:00\"]}", "timezone": "Europe/Berlin", "pickupMode": "same-day", "phone": "+49 40 0000000", "storeKey": "mau-reseller-north" } } }
POST /stores/key=mau-reseller-north   { "version": 7, "actions": [
  { "action": "addSupplyChannel", "supplyChannel": { "typeId": "channel", "key": "mau-br-north-wandsbek" } },
  { "action": "addDistributionChannel", "distributionChannel": { "typeId": "channel", "key": "mau-br-north-wandsbek" } } ] }
```

Branch keys follow the seed pattern `mau-br-<store suffix>-<slug>` (helper `branchKeyFor(storeKey, slug)`, suffix = the store key without `mau-reseller-`); the route sets `branch-info.storeKey` and refuses to touch any channel that is not in the session store's channel lists with `branch-info.storeKey` equal to the store key. Validation: `openingHours` is an object of weekday keys `mon` to `sun` with `["HH:MM","HH:MM"]` (close after open); a missing day means closed; `timezone` an IANA zone; `pickupMode` one of `same-day`, `next-day`, `ship-to-store`; `phone` optional, at most 30 characters. Delete removes the channel from the store's supply and distribution channels (`removeSupplyChannel`, `removeDistributionChannel`) and leaves the channel resource in place (channels in use cannot be deleted; its inventory and branch prices stay but are no longer reachable). "Add branch" shows it in the shopper store picker (I lists the store's branch channels).

**Branch map (Q-I02)** `components/store/BranchMap.tsx` (client, dynamic import with `ssr: false`, Leaflet and OpenStreetMap exactly as decision 22; a copy of I's `StoreMap` registered in `scripts/check-shared-copies.mjs`). The Branches tab shows the map with one marker per branch; the branch form shows a map where a click or a marker drag sets `geoLocation` (`[longitude, latitude]` in the request, Point order) and updates the two coordinate fields. Keyboard and screen-reader alternative: latitude and longitude text fields (always visible) whose changes move the marker; the marker has an accessible name (branch name); the map region has `aria-label` "Map of branches". Optional "Find coordinates" (the geocode route above) centres the map. The same map (single marker) is used for the store's main location on the Settings tab.

**Branch stock and prices (Q-005, Q-003)** `lib/ct/seller/branch-stock.ts` and routes `GET /api/seller/store/branches/[key]/stock`, `PUT /api/seller/store/branches/[key]/stock/[sku]` (body `{ availableQuantity?, priceCent? | null }`), Admin only, `authorizeStore` first, the branch must be one of the store's branches (decision 8), and the SKU must be in the store's assortment (T's assigned list; else 422). A drawer per branch lists the assigned parts with columns SKU, name, stock, branch price (empty means "Store price applies"). Stock writes are inventory entries on the branch supply channel (create when absent, else `changeQuantity` with the current version, retry on 409; quantity 0 to 100000 integer). A branch price is written with T's `setStandalonePrice(storeKey, sku, branchChannelKey, cents, currency)` (key `<sku>__<branchKey>` for EUR and `<sku>__<branchKey>__usd` for USD, as the seed does, so a branch price that already exists is changed, not duplicated; price greater than 0, at most 2 decimals; clearing it deletes that standalone price so the store channel price applies; the drawer shows the seeded branch prices). No MAP floor exists (Q-T03), so there is no lower bound other than greater than zero. Pagination 50 per page.

**Channels tab** `lib/ct/seller/channel-stats.ts`, `lib/ct/seller/order-pager.ts`:

```ts
export async function* pageOrders(storeKey: string, from: Date, pageSize = 500, maxPages = 5): AsyncGenerator<Order[]>;
export async function loadChannelStats(storeKey: string, days = 30): Promise<{ rows: { id: ChannelId; label: string; status: 'Live' | 'Demo'; orders: number; revenue: Money; sharePercent: number; indicative: boolean }[]; truncated: boolean }>;
```

Orders come from `inStoreKeyWithStoreKeyValue({ storeKey }).orders().get({ queryArgs: { where: 'createdAt >= :from and orderState != "Cancelled"', 'var.from': iso, limit, offset } })`. Group by `custom.fields.salesChannel`; missing counts as `web` with `indicative: true` for that share and a note "Attribution comes from the order's sales-channel field and is indicative where absent." Demo channel (`tiktok`) rows are synthetic and deterministic (`seededNumber(storeKey + channel)`), chip info-tinted, figures labelled "Demo data", excluded from real shares. Route `GET /api/seller/store/channels`.

**Share tab** `lib/portal/share-links.ts`:

```ts
export const CHANNEL_IDS = ['web', 'instagram', 'facebook', 'whatsapp', 'tiktok'] as const; // share links; the seed enum `salesChannel` also has 'in-store', which has no share link
export function shareLink(origin: string, locale: string, storeKey: string, channel: ChannelId): string; // `${origin}/${locale}/${storeKey}?ch=${channel}`
export function linkInBioLink(origin: string, locale: string, storeKey: string, channel: ChannelId): string; // `${origin}/${locale}/${storeKey}/links?ch=${channel}` unless K defines another path; read plans/workstreams/K-*.md
export function parseChannelParam(value: unknown): ChannelId | null;  // allow-list only
```

QR code: `npm install --save-exact qrcode @types/qrcode`; render `QRCode.toString(url, { type: 'svg', margin: 1 })` as an `<img src="data:image/svg+xml;utf8,…">` (never `dangerouslySetInnerHTML`). **Copy link** writes to the clipboard and toasts. The link-in-bio entry shows a notice "Create and publish a page with slug /link-in-bio in Content" until `GET /api/seller/store/link-in-bio-status?storeKey=` (server `POST {ORIGIN}/service/{storeKey}/published/puck-pages/query` with `x-project-key`, body `{ "query": "slug = \"/link-in-bio\"" }`, 404 means none) reports a published page.

### U-06 Theme tab [SKILL: commercetools-storefront]

`app/[locale]/(portal)/store/theme/[[...slug]]/page.tsx` (server): `authorizeStore`, compute `connected`, pass `storeKey`, `projectKey`, `locale`, `parentUrl = '/' + locale + '/store/theme'`. Client composition `components/portal/ThemeTab.tsx`: left card with `EditorBoundary` + `ContentoolsWrapper tab="theme"`, right card with the preview.

- **Presets**: `lib/contentools/theme-support.ts`: `isPresetSupported(tokens: ThemeTokens): boolean` and `UNSUPPORTED_PRESET_KEYS` computed from `themePresets` (exported by the package) by the rule in decision 5. `EditorBoundary` runs a `MutationObserver` that, when `select#theme-preset-select` appears, sets `disabled` on the `option` elements of unsupported presets and appends " (Not supported on your storefront)" to their text. If the select is not found within 3 s, show a static notice listing the unsupported options (never fail silently).
- **Preview**: `components/portal/StorefrontPreview.tsx`: page switcher (Home, Listing, Product, Cart, Checkout) and device toggle (Desktop 1280 wide scaled to the card, Phone 375 wide). URLs from `lib/portal/storefront-urls.ts` using `STOREFRONT_ORIGIN`, the locale, the store key, and the route shapes in `plans/workstreams/I-*.md`, `L-*.md`, `M-*.md`, `N-*.md`, `O-*.md` (read them; copy the path templates and cite the files in a comment). Product uses a real part from the store's assortment: `GET /api/store/preview-product` runs a store-scoped Product Search `limit: 1` with the frontend client. If a storefront route does not exist yet, the switcher entry is disabled with the text "Storefront page not available yet". The iframe `key` changes on **Refresh preview** and after a successful theme save, detected by `lib/contentools/save-observer.ts` which wraps `window.fetch` while the Theme tab is mounted and resolves when a `PUT` or `POST` to `${CONTENTOOLS_PROXY_BASE}/${storeKey}/configuration/theme` returns 2xx (restore the original `fetch` on unmount); the observer then shows the toast of decision 13.
- **Reset to Malva default**: button opens a confirmation dialog ("This deletes your theme. Your storefront will use the Malva default after the cache window."); on confirm `DELETE /api/seller/store/theme { storeKey }` (route: `authorizeStore(…, 'store.edit')`, server JWT, `DELETE {ORIGIN}/service/{storeKey}/configuration/theme`; 404 from upstream counts as success). The route is `app/api/seller/store/theme/route.ts` with a cross-store test.
- **Loader contract for emails and invoices**: `lib/contentools/theme.ts` exports `getStoreTheme(storeKey): Promise<ThemeTokens | null>` (plain `fetch` `GET {ORIGIN}/service/{storeKey}/configuration/theme` with `x-project-key`, React `cache()`, 404 returns `null`, fall back to namespace `default`) and `themePrimaryColour(theme: ThemeTokens | null): string` (sanitised with the same safe-CSS pattern as the storefront adapter, default maroon token value read from H's constant). P and W import these.

### U-07 Editor styling isolation check [SKILL: commercetools-storefront]

Run the style-leak assertions of the Chrome recipe (step 8). If any fails, do U-07b.

**U-07b (only on failure)**: add `app/[locale]/(embed)/contentools/[tab]/[[...slug]]/page.tsx` with a minimal layout (no shell, same session guard, `Cache-Control: no-store`), render the wrapper there, and replace the in-page mount by an `<iframe src="/…/embed/contentools/theme">` that fills the card (height set by `postMessage` `{ type: 'contentools-height', value }` from the embed page, origin-checked). Update the proxy tests unchanged (same endpoint) and note the switch in Notes.

### U-08 Content pages [SKILL: commercetools-storefront]

Routes: `app/[locale]/(portal)/content/[[...slug]]/page.tsx`, one page with two tabs "Pages" and "Content blocks" (decision 6). Each tab mounts its manager with a `parentUrl` of `/${locale}/content/pages` or `/${locale}/content/blocks`, so deep editor routes (`.../{key}/edit`) are served by the same catch-all (the segment after `content` selects the tab; unknown segment shows Pages). Reset the browser history to the tab root when switching tabs (`window.history.replaceState(null, '', parentUrl)`), as the reference wrapper does. `authorizeStore(…, 'content.edit')` in the server page.

Automotive blocks in the editor: `lib/contentools/puck-config.ts` exports `portalPuckConfig` = `defaultPuckConfig` from `@commercetools-demo/puck-editor` plus the automotive blocks (hero, vehicle finder, category tiles, popular products, promo banner, brand strip). Read the block contract that K defines in the storefront (look in `storefront/lib/puck/` and `plans/workstreams/K-*.md`): copy block type names and field schemas exactly (a shared `blocks-contract.ts`, copied not imported because there is no workspace), and give each block a lightweight preview render in the admin kit (label, placeholder image box), because the real components live in the storefront. Pass it as `config={portalPuckConfig}` to `PageManager`. If K has not defined the contract yet, ship `defaultPuckConfig` only, add TODO row `M-U-3`, and continue. A unit test compares the block type names against the storefront contract file when it exists.

### U-09 Company & team [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns]

Routes `app/[locale]/(portal)/company/` with tabs Users, Addresses, Profile (`company/[tab]`; `company/page.tsx` redirects to `users`). No Cost centres tab (Q-V01). Buying-side data goes through the as-associate chain (R-04 shows how to build it); the `lib/ct/company.ts` module never imports the admin client.

- **Users** `GET /api/company/users`: as-associate `GET business-unit` then `customers().get({ queryArgs: { where: 'id in (:ids)', 'var.ids': ids } })`; rows `{ name, email, role (associate role name), status: 'Active' | 'Invited', lastActive }` (`lastActive` is `custom.fields.lastActiveAt` of the seed type `malva-customer`, "—" when absent). **Invite** `POST /api/company/users/invite { email, firstName, lastName, roleKey }` (permission `company.edit`): create the customer (`apiRoot.customers().post({ body: { email, firstName, lastName, password: <random 24 chars>, isEmailVerified: false } })`), then as-associate BU update `{ action: 'addAssociate', associate: { customer: { typeId: 'customer', id }, associateRoleAssignments: [ { associateRole: { typeId: 'associate-role', key: roleKey }, inheritance: 'Disabled' } ] } }`, then `customers().passwordToken().post({ body: { email, ttlMinutes: 4320 } })` and the response `{ inviteLink: '${origin}/${locale}/accept-invite/${token}' }` is returned once (no e-mail is sent, Q-P01; the link is not persisted or logged; the UI dialog of decision 16 shows it with a Copy button). If the associate step fails, delete the just-created customer (compensation, like R-07). `roleKey` must be one of the two seeded roles, `mau-role-admin` or `mau-role-buyer` (from `ROLE` in R's `lib/authz/permissions.ts`; `GET /api/company/roles` returns exactly those; the sample roles that stay in the project, among them `approver`, are never offered); anything else gives 422. `app/[locale]/(auth)/accept-invite/[token]/page.tsx` and `POST /api/auth/accept-invite { token, password }`: `GET customers/password-token=<token>` to find the customer, `passwordReset`, then `POST /customers/email-token` and `POST /customers/email/confirm`; the row then reads Active. Same generic error for invalid or expired tokens.
- **Addresses**: list from the unit's `addresses` with `shippingAddressIds`, `billingAddressIds` and defaults; type "Delivery" (shipping only), "Delivery & billing" (both), "Billing" (billing only); default marker. Add and make default via as-associate BU update actions `addAddress`, `addShippingAddressId`, `addBillingAddressId`, `setDefaultShippingAddress`, `setDefaultBillingAddress`; the label goes into `additionalAddressInfo` (decision 17). Making one default makes checkout prefill it (O reads `defaultShippingAddressId`; verify only the unit's default fields here).
- **Profile** `GET /api/company/profile`: `{ name, contactEmail, kind, storeKey, storeName, region, currency }` (native unit fields, `mau-business-unit-fields.kind`, region and currency from the store's `store-settings`; no tax ID, account number, credit limit or terms, decision 20); decision 20 for editing (`PUT` changes `name` via `changeName` and `contactEmail` via `setContactEmail`). Non-admins: read-only inputs with the note "Contact an administrator to change these details."

### U-10 Account settings [SKILL: commercetools-storefront]

Routes `app/[locale]/(portal)/account/[tab]` (General, Security, Addresses, Business units). All self-service endpoints verify `customerId === session.customerId` and never accept a customer id from the body.

- **General** `PUT /api/account/profile { firstName, lastName, email }` with `customers().withId().post` actions `setFirstName`, `setLastName`, `changeEmail`; a duplicate email answers 409 "That email is already in use."
- **Security** `PUT /api/account/password { currentPassword, newPassword }` with `apiRoot.customers().password().post({ body: { id, version, currentPassword, newPassword } })`; wrong current password (400 `InvalidCurrentPassword`) answers "Current password is incorrect."; client and server enforce 12+ characters; live strings of decision 19 from `lib/account/password-check.ts` `checkPassword(next, repeat): 'enter' | 'tooShort' | 'mismatch' | 'ok'`.
- **Addresses** (personal): list, add, remove, make default via `customers` update actions `addAddress`, `removeAddress`, `setDefaultShippingAddress`.
- **Business units** `GET /api/account/business-units`: for every unit of the associate: unit name, type, role(s) in that unit, store with caption "Explicit store" or "From parent".

### U-11 Messages, tokens, routes

All strings in both locale files under `store.*`, `content.*`, `company.*`, `account.*` with identical keys; `check-tokens`, `check-routes` green (every new route is covered by the nav or the allow-list, every new `app/api/seller/**` route has a `*.cross-store.test.ts`).

### U-12 Gate and evidence

Run the Chrome recipe (section 10), the MCP read-backs (section 12), store evidence under `plans/evidence/U/`. Add the TODO rows of section 13 and continue; never wait.

## 9. Test-first scenarios (vitest unless noted)

Run: `cd portal && npx vitest run lib/contentools lib/ct/seller lib/company lib/account lib/portal app/api` and, for the fake server, `node scripts/fake-contentools.mjs &` is started by the test setup (`vitest.setup.ts`) on port 4011.

| File › test name | Asserts |
| --- | --- |
| `lib/contentools/jwt.test.ts` › `valid token is returned without a refresh call` | calls |
| same › `absent object returns null and does not refresh` | calls |
| same › `expired token refreshed via /service/refresh-jwt with Bearer old token, new token persisted with the current version, returned in the same call` | request and upsert |
| same › `refresh failure returns null and never throws; token never logged` | spy on logger |
| `lib/contentools/proxy-policy.test.ts` › table test for every row of section 7 (`evaluateProxyRequest` ok with the expected `upstreamPath`) and negative cases: `refresh-jwt`, `authenticate-project`, `configuration`, `configurations`, `configuration/header`, `proxy-script` (404); `..`, `%2f`, `%5c`, `%252e%252e`, NUL, empty segment, `//` (400 `INVALID_PATH`); `TRACE` (405); store only in query or JSON body (403); `PROXY_STRICT_STORE=false` rewrites outside production and is ignored in production | policy result |
| `app/api/contentools/[...path]/route.test.ts` › `401 without session` | status |
| same › `tampered store: PUT /service/{storeB}/configuration/theme from store A is 403 PROXY_STORE_MISMATCH and upstream mock is never called` | calls 0 |
| same › `upstream 3xx gives 502 without Location; upstream 5xx gives only UPSTREAM_ERROR; 2 MB plus JSON body 413; non JSON write 415; multipart only on upload-file` | responses |
| same › `write request gets Authorization Bearer <server JWT>; client Authorization and cookie are dropped` | upstream headers |
| same › `GET gets x-project-key and no Authorization` | headers |
| same › `other service routes return 404 and no upstream call` | status |
| same › `JWT null: write is 503 contentools_not_connected, GET still works` | status |
| same › `response strips content-encoding, content-length, transfer-encoding, connection, set-cookie` | headers |
| same › `forwards body only for non GET and HEAD; redirect manual passes 3xx through` | upstream call |
| same › `responses and bundles never contain the JWT (response body search for the token string)` | no match |
| same › `exports GET POST PUT PATCH DELETE HEAD and OPTIONS answers 204` | exports |
| `lib/contentools/theme-support.test.ts` › `neumorphism and glassmorphism unsupported; flat, material, brutalism, dark-moody supported` and `every themePresets entry is classified by the rule` | derived from package |
| `components/contentools/ContentoolsWrapper.test.tsx` › `no store shows pick a store, no managers mounted`; `not connected shows the exact message`; `managers get an absolute baseURL ending in /api/contentools/service, businessUnitKey equals storeKey, jwtToken is the placeholder` | DOM and props |
| same › `placeholder token contains no sub claim` | decode |
| `components/contentools/EditorBoundary.test.tsx` › `unsupported preset options get disabled and suffixed; missing select shows the static notice after 3 s` | jsdom |
| `lib/contentools/save-observer.test.ts` › `successful PUT on the theme URL resolves, fetch restored on unmount, other URLs ignored` | fetch spy |
| `app/api/seller/store/theme/route.test.ts` › `buyer 403, admin 200; upstream 404 is success; uses server JWT` and `route.cross-store.test.ts` | statuses |
| `lib/ct/seller/store-settings.test.ts` › `no edit of address field exists; latitude without longitude rejected; setCustomType before first custom field; 409 retried with latest version` | actions |
| `app/api/seller/store/**/route.test.ts` › role matrix: Admin 200, Buyer 403 for settings, logo, favicon, branches, branch stock, channels, geocode | statuses |
| `app/api/seller/store/**/route.cross-store.test.ts` (one per route) | `expectCrossStoreForbidden`, zero commercetools calls |
| `lib/ct/seller/branches.test.ts` › `new key follows mau-br-<store suffix>-<slug>; a channel whose branch-info.storeKey is another store is 404; openingHours, timezone and pickupMode validation; delete removes the channel from the store's supply and distribution channels and leaves the channel; create makes a channel with both roles and the branch-info fields (including storeKey) and adds it to both lists` | calls |
| `components/store/BranchMap.test.tsx` › `renders with fake tile URLs and the attribution text; marker drag and map click update geoLocation as [lng, lat] and the two fields; typing latitude and longitude moves the marker (keyboard path); marker has an accessible name; no request to a CDN for Leaflet assets` | jsdom with Leaflet stubbed tiles |
| `scripts/check-shared-copies.test.mjs` › `BranchMap and StoreMap are byte-identical (apart from the declared import line)` | script result |
| `lib/ct/seller/branch-stock.test.ts` › `stock writes an inventory entry on the branch supply channel (create then changeQuantity, 409 retried); branch price calls setStandalonePrice with the branch channel key and the seed key scheme (`<sku>__<branchKey>`, `__usd` for USD), changing an existing seeded price instead of creating a second one; clearing the price removes it; SKU outside the assortment 422; a branch of another store (branch-info.storeKey) refused; price 0 or negative 422; no floor check exists` | calls |
| `app/api/seller/store/branches/[key]/stock/route.cross-store.test.ts` | `expectCrossStoreForbidden`, zero commercetools calls |
| `lib/ct/seller/channel-stats.test.ts` › `groups by salesChannel (including in-store; isTest orders excluded); missing counts as web indicative; tiktok is Demo with deterministic figures; shares sum to 100 over live channels; pages up to 5 and flags truncated` | numbers |
| `lib/portal/share-links.test.ts` › `shareLink for instagram equals origin/locale/store?ch=instagram; parseChannelParam rejects unknown values; QR data URL has no script` | strings |
| `lib/ct/company.test.ts` › `invite: customer created, associate added, link returned once and nothing sent or stored; associate failure deletes the customer; role other than `mau-role-admin` or `mau-role-buyer` 422 (the sample `approver` role too); Buyer 403` | calls |
| same › `users: Invited when isEmailVerified false, lastActive dash when field absent` | rows |
| same › `addresses: type labels; default sets both default fields when delivery and billing` | actions |
| same › `company chain never imports admin client` | import scan (also covered by R's test) |
| `app/api/auth/accept-invite/route.test.ts` › `valid token sets password and confirms email; invalid and expired tokens answer the same error` | calls and body |
| `lib/account/password-check.test.ts` › `empty gives Enter a new password; 11 characters Too short; mismatch; 12 matching Looks good` | states |
| `app/api/account/*/route.test.ts` › `ignores customer id in body; wrong current password message; duplicate email 409; button message Fix the password first (component)` | behaviour |
| `components/portal/company/*.test.tsx` › role matrix render for Admin and Buyer: Buyer sees disabled Invite with the insufficient permissions message; no Cost centres tab; invite dialog shows the copyable link | DOM |
| `lib/contentools/puck-config.test.ts` › `block types equal the storefront contract when the contract file exists` | names |
| `lib/portal/storefront-urls.test.ts` › `urls built from origin, locale and store key; disabled when route unknown` | strings |

## 10. Chrome DevTools MCP recipe

Preconditions: portal on `http://localhost:3001`; storefront on `http://localhost:3000` if built; Contentools connected (OA-02) or `scripts/fake-contentools.mjs` with `CONTENTOOLS_ORIGIN=http://localhost:4011`; two seeded resellers `<storeA>` and `<storeB>`; demo users from `seed/README.md`. Screenshots to `plans/evidence/U/<nn>-<name>.png`. After each page `list_console_messages` shows no errors (Contentools manager warnings are listed in Notes if unavoidable, never errors).

**A. Store and branches**

1. Admin of A: `navigate_page http://localhost:3001/de-DE/store/settings` at 1440 x 900. Assert the storefront address shows `${STOREFRONT_ORIGIN}/de-DE/<storeA>` with "Managed by Malva" and **no** input or edit button next to it (`evaluate_script`: no `input` whose value equals the address). Edit name, enter latitude and longitude, Save: toast "Location saved". MCP item 1 shows the new values. Screenshot `01-settings.png`.
2. Upload a logo (valid PNG 800 x 400) and a favicon: the preview updates; MCP shows `logoUrl` and `faviconUrl` set on the store custom fields (URLs point at the Contentools object store host or the fake). A GIF and a 50 x 50 image are refused with the limit text.
3. Branches: add "Test Branch" with opening hours and pickup mode "same-day": by clicking on the OpenStreetMap map (tiles load, attribution "© OpenStreetMap contributors" visible, no Leaflet request to a CDN in the network list; dragging the marker updates the latitude and longitude fields; typing coordinates moves the marker): MCP item 2 shows the channel with both roles and the `branch-info` fields (including `storeKey`), `geoLocation` equal to the clicked point and the store's `supplyChannels` and `distributionChannels` both containing it; the storefront store picker (when I exists) lists it at the same place. Open the branch stock drawer: set stock 7 for one assigned part and a branch price: MCP item 10 shows the inventory entry on the branch channel and the standalone price with that channel; clear the price: it is gone; a SKU outside the assortment is refused. Remove it: the store's `supplyChannels` and `distributionChannels` no longer contain it and the picker no longer lists it (the channel resource remains). Screenshot `02-branches.png`.
4. Channels tab: table with Live and Demo chips, orders, revenue, share; TikTok row info-tinted and labelled "Demo data"; compare orders and revenue with MCP item 3. Screenshot `03-channels.png`.
5. Share tab: Instagram link equals `${STOREFRONT_ORIGIN}/de-DE/<storeA>?ch=instagram`; QR image present; Copy link toast and `navigator.clipboard.readText()` (granted via the DevTools permission or recorded in Notes). Attribution round trip (when O exists): open the link in the storefront, place an order, MCP item 3 shows `salesChannel = instagram`; otherwise `M-U-2`.

**B. Theme tab and the proxy**

6. `navigate_page http://localhost:3001/de-DE/store/theme`. With Contentools disconnected (fake server stopped or OA-02 pending): the exact "Contentools isn't connected" message and no editor. Connected: spinner then `ThemeManager`. Screenshot `04-theme-1440.png`.
7. Preset select: the Neumorphism and Glassmorphism options are disabled and suffixed " (Not supported on your storefront)" (`evaluate_script` over `#theme-preset-select option`). Apply the Material preset, change the primary colour, Save: the toast "Saved. <host> will show the change within <n> seconds." appears and the preview reloads. MCP item 4 shows `configuration/<storeA>-theme` with the new colour.
8. **Style leak**: before opening the Theme tab record from `/de-DE` the computed `font-family` and `font-size` of `body`, `h1`, the sidebar item, and the value of `--color-bg-page` on `:root`; open the Theme tab; compare again (all identical) and check `document.querySelectorAll('style').length` growth is attributable to the editor (note the count). Toggle the portal to dark: the editor card stays light, the shell is dark (screenshot `05-theme-dark.png`). A failing comparison triggers U-07b.
9. **Token never in the browser**: with the Theme tab loaded, `evaluate_script` runs: for every script from `performance.getEntriesByType('resource')` fetch its text and test `/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/` (must be false), same on `document.documentElement.outerHTML`, `JSON.stringify(localStorage)`, `JSON.stringify(sessionStorage)`, and `document.cookie`. `list_network_requests` then `get_network_request` for every `/api/contentools/...` call: request headers contain no `Authorization` carrying a real token (the placeholder is allowed) and no upstream origin appears in the page; the response headers have no `set-cookie`.
10. **Tampered store**: `evaluate_script`: `fetch('/api/contentools/service/<storeB>/configuration/theme', { method: 'PUT', headers: {'content-type':'application/json'}, body: JSON.stringify({ value: { colorPrimary: '#ff0000' } }) }).then(r => r.status)` returns 403. MCP item 4: `<storeB>-theme` `version` unchanged. Also `fetch('/api/contentools/service/refresh-jwt', {method:'POST'})` returns 404 and `fetch('/api/contentools/service/<storeA>/configuration')` returns 404. Screenshot of the network list `06-proxy-attacks.png`.
11. Preview: page switcher Home, Listing, Product (real part from the assortment), Cart, Checkout, Desktop and 375 px: each iframe shows the saved theme colour (`evaluate_script` inside the frame is not allowed cross-origin, so assert with screenshots and a computed-colour check via the storefront's own page opened in a second tab). Pages that do not exist are disabled with the stated text. Screenshot `07-preview-375.png`.
12. **Reset**: click "Reset to Malva default", confirm the dialog: MCP item 4 no longer has `<storeA>-theme` (or upstream 404), after at most the cache window the storefront for store A shows the default maroon theme while store B keeps its own; screenshot `08-reset.png`.
13. Buyer: `navigate_page /de-DE/store/theme` shows the forbidden page; `evaluate_script` fetch of `/api/contentools/service/<storeA>/configuration/theme` with PUT returns 403 (role check precedes the store check).

**C. Content**

14. `navigate_page http://localhost:3001/de-DE/content`: tabs "Pages" and "Content blocks". Create a page with slug `/test-landing`, add a block, Save draft, Publish (inside Contentools). MCP item 5 lists the page object under the store's key (note the container name in Notes). The storefront serves it at its landing route after the cache lifetime (when K exists). Reload the portal on a deep editor URL (`/de-DE/content/pages/<key>/edit`): the editor opens (catch-all route works). Screenshot `09-content-pages.png`.
15. Switch to store B's admin: store A's pages are not listed. The editor offers the automotive blocks when `portalPuckConfig` is wired (or the default blocks and `M-U-3` is open).
16. Storefront cross-check (when M exists): a product page with a page edit that removes all text still shows the fitment disclaimer and "sold and fulfilled by".

**D. Company and account**

17. Admin: `/de-DE/company/users`: columns name, email, role, status, last active; invite `qa-u-1@example.com` as Buyer (the role select offers only Admin and Buyer): row shows Invited; the dialog shows the one-time link and nothing is e-mailed (no mail request in the network list); copy it and open `/de-DE/accept-invite/<token>`, set a 12+ character password: row becomes Active; sign in as that user (Buyer nav). MCP item 6 shows customer and associate role; clean up with `scripts/dev-delete-test-user.mjs` (refuses emails not starting `qa-u-`) and re-read. Screenshot `10-users.png`.
18. Addresses: add "Test Depot" (Delivery & billing), make it default; MCP item 7 shows default shipping and billing ids; Billing-only entry reads "Billing".
19. The Company page has no Cost centres tab (dropped, Q-V01). Screenshot `11-company-tabs.png`.
20. Profile: Admin edits the display name and contact email (saved, MCP item 7); store, region and currency show "Managed by Malva"; no tax ID, account number, credit limit or terms field exists. As Buyer: inputs read-only with the contact-an-administrator note.
21. Account as every role: General (change last name, MCP check), Security: type 11 characters gives "Too short", mismatched repeat "Passwords don't match", Update password says "Fix the password first"; a valid change succeeds and sign-in with the new password works (use the test customer from step 17, not a demo user). Business units tab shows the role and store per unit with "Explicit store" or "From parent".
22. Role matrix: Buyer can open Company & team read-only, Invite disabled with the exact message, `evaluate_script` POST to `/api/company/users/invite` returns 403.
23. Viewports: 1024 and 375 for Store settings, Theme, Content and Company: no horizontal page scroll (tables scroll inside cards); screenshots `12-store-375.png`, `13-company-375.png`.

## 11. Order of work

Foundation first (U-00 to U-04: contract check, JWT, allow-list, proxy, wrapper, fake server), then Store & channels with Theme (U-05 to U-07), then Content (U-08), then Company and Account (U-09, U-10). Each group ends with its section 9 tests green and its Chrome steps run, so a failure is found next to the code that caused it.

## 12. `b2b2c-automotive` MCP read-back checks (read-only tools)

1. `read_stores` (`<storeA>`): `name`, `custom.fields` (`logoUrl`, `faviconUrl`, location fields) match the screen; `distributionChannels`, `supplyChannels`, `languages`, `countries` (shipping and address list only, no territory meaning) as the portal assumes; `read_types` shows `store-settings`.
2. `read_channels` (the store's branch keys `mau-br-<suffix>-*`): branch channels have `roles` `InventorySupply` and `ProductDistribution`, `address`, `geoLocation`, custom `branch-info` fields; the removed branch is no longer in the store's `supplyChannels` or `distributionChannels`.
3. `read_orders` (`store(key="<storeA>")`, last 30 days): counts and revenue per `custom.fields.salesChannel` equal the Channels table; after the attribution round trip the new order has the expected value.
4. `read_custom_objects` container `configuration`, key `<storeA>-theme` (and `<storeB>-theme`): colour and `version` as expected; absent after reset; B unchanged by the attacks. Container `contentools-configuration` exists (value not printed in Notes).
5. `read_custom_objects` without a container filter (limit 50): record the container(s) holding Contentools pages and content for the store key; the new page exists for `<storeA>` only.
6. `read_customers` (the invite test email) and `read_business_units` (unit key): associate with the chosen role, `isEmailVerified` false before and true after acceptance; removed by the cleanup script.
7. `read_business_units`: `addresses`, `shippingAddressIds`, `billingAddressIds`, defaults, `contactEmail`, `name` and `custom.fields` (`kind`, `storeKey`) match the screens.
8. `read_types`: `store-settings` (with the location fields), `branch-info`, `malva-checkout` (`salesChannel`), `malva-customer` (`lastActiveAt`), `mau-business-unit-fields` exist with the fields in section 5; none of `reseller-company`, `portal-customer`, `portal-order`, `portal-cart` exists.
9. `read_associate_roles`: only `mau-role-admin` and `mau-role-buyer` are offered by the invite form (the sample `approver` role stays in the project and is never offered).
10. `read_inventory` (branch channel) and `read_standalone_prices` (channel = branch channel): the stock and branch price set in the drawer; after clearing, the price is absent.

## Seed requests

The seed is the source of truth and is not edited from here. The same rows are in `plans/notes/seed-requests.md`.

| What | Why |
| --- | --- |
| Optional: `legalName`, `taxId`, `accountNumber` (String) on `mau-business-unit-fields`, with demo values on `mau-bu-north` and `mau-bu-south` | The design's Company profile lists them; U shows each of them only when present and otherwise omits the row. Credit limit and payment terms are not requested (wholesale, Q-V01) |
| Optional: `jobTitle` (String) on `malva-customer` | Only if the Users table should show a job title; without it the table shows name, email, role, status, last active |

## 13. Manual items for `plans/TODO-MANUAL-TESTING.md` (never wait silently)

Rename ids to the next free number when merging. Claude adds the rows and continues with the next task.

| ID | Needed by | Action | Expected |
| --- | --- | --- | --- |
| OA-02 (exists) | U-03, U-06, U-08 live steps | Install the "multitenant contentools" Merchant Center app and click Connect | JWT custom object exists; editors load |
| OA-13 (was OA-U-1) | U-00 | Add the scopes for U (key-value documents, stores, channels, types view, orders view, inventory, standalone prices) to the **admin** API client; Claude lists the exact strings in the TODO file after U-00 | writes succeed live |
| OA-14 (was OA-U-2) | U-06 | Make sure the storefront allows framing by the portal origin (`frame-ancestors`) in the hosting config; Claude documents the exact header in the TODO file (dev needs nothing) | preview iframe loads on the deployed site |
| SO-01 (exists) | U-03 to U-10 | Sign off undesigned screens: page chrome around the editors and the preview card, branches (map, stock and price drawer), accept-invite page, invite-link dialog, company tabs | approved or change list |
| M-U-1 | U-12 | Compare Store, Company and Account pages with `design/export/Malva Seller Portal.dc.html` pages `store`, `company`, `account` at 1440 px and 375 px, light and dark; judge the look of the editor card in dark mode | matches except documented changes |
| M-U-2 | U-05 | Attribution round trip on the storefront after O (only if not possible earlier) | order shows `salesChannel` |
| M-U-3 | U-08 | Add the automotive blocks to the editor once K publishes the block contract (only if it was missing) | blocks appear in the Puck editor |
| M-U-4 | U-05 | Real phone check: scan the QR code of the Instagram link | opens the storefront with `?ch=instagram` |

## 14. Definition of done

- Every test in section 9 written first, failing, then passing; `npm run check` and `npm run build` green; every `app/api/seller/**` route has a cross-store test; admin client import test green (JWT module only in allowed folders).
- Proxy proven: tampered store 403 with zero upstream calls (unit and Chrome), no JWT in bundle, HTML, storage, cookies or request headers (Chrome step 9), allow-list negative cases 404.
- Theme: preset restriction visible, save toast, preview, reset all work; MCP shows the theme object lifecycle; style isolation assertions pass or U-07b is implemented.
- Content: two tabs, deep editor routes work, content scoped per store.
- Store: address read-only, branches in the store's supply channels on an OpenStreetMap map (attribution, no CDN, CSP), branch stock and price round trip, channel numbers equal MCP, share links and QR correct.
- Company and account: invite (link shown, nothing sent), accept, addresses, profile, password rules as specified; no cost centres; role matrix (Admin, Buyer) proven in unit tests and Chrome.
- `.env.example` and `scopes.ts` list every variable and scope with a reason; no prototype names in code or copy; locale files have identical keys.
- Q-U01 to Q-U10 present in `plans/notes/questions-RSTU.md` with the defaults used.

## 15. Evidence

`plans/evidence/U/01-settings.png`, `02-branches.png`, `03-channels.png`, `04-theme-1440.png`, `05-theme-dark.png`, `06-proxy-attacks.png`, `07-preview-375.png`, `08-reset.png`, `09-content-pages.png`, `10-users.png`, `11-company-tabs.png`, `12-store-375.png`, `13-company-375.png`, and under "Notes": the Contentools container names found (step MCP 5), whether the placeholder token form needed the JWT-shaped variant, the style-leak measurements, the allow-list additions discovered, and the storefront route templates used for the preview.

## Notes

(Fill in during the work.)
