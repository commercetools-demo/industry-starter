<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream R: Portal shell, navigation and auth

Status: DRAFT v1 (2026-10-12). Letters and dependencies: `plans/DEPENDENCY-PLAN.md`. Spec ids are shortened: `sp/` = `b2b2c-automotive/openspec/specs/seller-portal/`. All paths below are relative to `b2b2c-automotive/` unless they start with `plans/`.

## 1. Goal

A signed-in reseller user lands in the Partner Portal shell (dark top bar, floating sidebar rail, business unit and store switcher, search and command palette, notifications, customer-session banner, Copilot, light/dark) with navigation that changes by role (Admin, Buyer). Unauthenticated visitors can sign in, register (account stays pending until a Malva operator activates the business unit, OA-11), and request a password reset without anyone being able to tell which emails exist (no e-mail is ever sent in this project, so the reset link is shown on screen, see R-08). Every later portal workstream (S to Y) drops its page into this shell and reuses the authorization layer built here.

Gate to pass: **G8 after R** (`plans/DEPENDENCY-PLAN.md`): partner sign-in and role-based navigation for Admin and Buyer, checked in Chrome.

### Owner scope changes (interview 2026-10-12)

Buying from Malva is out of scope (Q-V01), so the shell does not build these parts of `sp/design-portal-shell-and-navigation`:

| Spec text | What the shell does instead |
| --- | --- |
| Navigation group "Shop from Malva" (Quick order, Cart & checkout, Orders, Quotes, Approvals, Invoices & billing, Price lists, Saved lists) | No group, no routes, no placeholders |
| Scenario "Approvals badge" | No badge; `badge` support is removed from `NavItem` |
| Scenario "Approver role" and the Approver role | Roles are Admin and Buyer only |
| "Roles & permissions" item | Not built (its spec `design-approvals-and-roles` is out of scope); Company group is Company & team, Account settings |
| Scenario "Disabled action" (Approve on an order) | Kept as the rule, shown on a still existing action (a Buyer opening Store settings by URL gets the forbidden page; a Buyer on Catalog sees price edit disabled with "Insufficient permissions to perform this task") |
| Switcher refreshing "carts, price lists and approvals" | Refreshes every unit-scoped SWR key that exists (dashboard, catalog, customers, returns) |
| Notifications "approval waiting", "quote counter-offer" | Not built; remaining sources: customer return received (V registers it), order shipped; empty state stays |
| Top bar "Quick order" button, search result target `/price-lists` | Removed; an exact SKU or OE match opens `/catalog?tab=assortment&sku=<sku>` (T builds the filter) |
| Associate role "Approver", approval rules, seeded wholesale store `mau-malva-wholesale`, contract groups | Not used by R; the seed carries only the Admin and Buyer associate roles |

Q-R01 is answered by this (Roles & permissions page dropped).

## 2. Depends on

| Workstream | What R needs from it | How to check before starting |
| --- | --- | --- |
| B | `portal/app/tokens.css` (admin kit) wired into Tailwind `@theme inline`, `npm run check-tokens` | `cd portal && npm run check-tokens` is green |
| F | Seeded business units (company, divisions), stores, associate roles, two demo associates (Admin, Buyer) per reseller, a second reseller | MCP `read_business_units`, `read_associate_roles`, `read_customers` (see section 9) |
| G | `lib/ct/client.ts` (`apiRoot`), `lib/ct/admin-client.ts` (`adminRoot`), `lib/ct/provisioning-client.ts` (`getProvisioningRoot()`), `lib/session.ts` (`getSession`, `updateSession`, `setSessionCookie`, `clearSessionCookie`, cookie `malva_portal_session`), `lib/session-core.ts` (`SESSION_KEYS`, `pickSession`, `applyBusinessContext`, `applyLocale`), `lib/api.ts` (`handle`, `ApiError`, `requireCustomer`, `requireBusinessUnit`, `parseJson`), `lib/env.ts`, `lib/scopes.ts`, `GET /api/health`, `proxy.ts` with locale redirect | `cd portal && npm run check && curl -s localhost:3001/api/health` |
| C (via G) | next-intl routing, `messages/de-DE.json`, `messages/en-US.json` with identical keys, `lib/utils.ts` (`COUNTRY_CONFIG`, `getLocalizedString`) | `npm run check-messages` |

If any file above is missing, stop and tell the owner in the workstream notes; do not re-implement another workstream's module. Naming rule for this plan: where a snippet below says "frontend client" it means `apiRoot`; "admin client" means `adminRoot`. Session changes go through `updateSession(patch)` and `applyBusinessContext(...)` (one write); R adds the extra session keys (R-06, R-15) to `SESSION_KEYS` and `pickSession` in the same commit, with the primitive types that allow-list requires (booleans and strings only).

## 3. Specs and requirement ids implemented

Primary specs (this workstream owns them):

1. `sp/design-portal-shell-and-navigation/spec.md`
   - Dark top bar and floating sidebar rail
   - Navigation groups
   - Navigation follows permissions
   - Business unit and store switcher
   - Global search and command palette
   - Notifications
   - Customer-session banner
   - Copilot that asks before changing
   - Light and dark
2. `sp/design-auth-screens/spec.md`
   - Sign in
   - Registration needs Malva approval
   - Password reset without enumeration
   - Layout

Parts of `sp/bootstrap-and-structure/spec.md` that R builds on top of G (G already did scaffolding, session core, clients):

- Permissions in two layers
- As-associate for buying, admin client for selling (R builds `authorizeStore`; the "admin client imported only from allowed folders" test)
- B2B session (R writes the session fields at login and on switch: "Switch business unit or store")
- Registration and provisioning
- Gates and tests (role tests Admin/Buyer against navigation and disabled actions)
- Route map check (`scripts/check-routes.mjs`, "Route map matches navigation")

Not R: Contentools JWT and proxy (U), Store settings (U), every page body behind the navigation (S to W; R ships placeholders).

## 4. Decisions already taken

| # | Decision | Source |
| --- | --- | --- |
| 1 | Portal keeps the admin kit; it is not reseller-themed. Inter only, top bar `--color-bg-topbar` in both themes. | `design.md` decisions 8 and 9; `sp/bootstrap-and-structure` "Styling from the admin kit" |
| 2 | Locales: `de-DE` (default, EUR, DE) and `en-US` only, `localePrefix: 'always'`. | `sp/bootstrap-and-structure` "Locale routing for two locales" |
| 3 | Session is a `jose` JWT cookie; the five business-unit/store fields are written together from the resolved store; locale fields together with `cartId` reset on currency change. | `sp/bootstrap-and-structure` "B2B session" |
| 4 | Buying operations use the as-associate chain; seller administration uses the admin client only inside `app/api/seller/**` after `authorizeStore`. | `sp/bootstrap-and-structure` "As-associate for buying, admin client for selling" |
| 5 | Registration creates a pending (inactive) business unit and its first administrator with the **provisioning client only**; a Malva operator activates it in the Merchant Center. Malva staff do not use this portal. | `sp/bootstrap-and-structure` "Registration and provisioning"; open question F default |
| 6 | The portal name shown is "Malva Partner Portal" (the design's name). | `sp/design-portal-shell-and-navigation` Gaps and `design.md` conflict 7 (copy lives in `messages/`, so a rename is a one-line change) |
| 7 | Password minimum is 12 characters everywhere (sign-in screens do not enforce it on login, registration and reset do). | `sp/design-auth-screens` Gaps; `sp/design-company-and-account` |
| 8 | Placeholder names from the prototype (e.g. "Hartmann", "Lena") never appear in code, seed or copy; fixtures in tests use neutral names ("Test Garage Nord"). | `design.md` section 9 risks |
| 9 | Seller-side role gating hides items a role can never use and disables the rest with "Insufficient permissions to perform this task". | `sp/design-portal-shell-and-navigation` "Navigation follows permissions" |
| 10 | Navigation matrix for roles in section 5 (Admin sees all; Buyer set from the spec scenario "Buyer role"). Approver, Roles & permissions and the Shop from Malva group do not exist. | spec scenarios; owner Q-V01 |
| 11 | No e-mail is ever sent (owner Q-P01). Password reset shows the reset link on screen after the same uniform delay (see R-08). | owner Q-P01 |
| 12 | Payments in the shopper flow are hosted commercetools Checkout with the Stripe connector (Q-012); nothing in R depends on it. | owner Q-012 |

Questions for this workstream are in `plans/notes/questions-RSTU.md` (Q-R01 to Q-R09). The defaults are used below.

## 5. Role matrix (build this first; every test cites it)

Role keys: the seed defines exactly two associate roles in `seed/src/data/org.ts` (`ROLE_KEYS`): `mau-role-admin` (permissions: view and update orders, add child units, update parent unit, update business unit details, update associates, view carts) and `mau-role-buyer` (`buyerAssignable`; view own and others' orders and carts, read only). Put them in one constant `ROLE = { admin: 'mau-role-admin', buyer: 'mau-role-buyer' }` in `lib/authz/permissions.ts` and confirm them with MCP `read_associate_roles`; the rest of this plan says `admin` and `buyer` for the logical roles. The sample associate roles that the seed cleanup leaves in the project (among them `approver`) are never mapped to a logical role: an associate holding only such a role has no logical role and the portal refuses it with the insufficient-permissions page. There is no Approver role: the remaining portal specs (`design-company-and-account`, `design-customers-and-subscriptions` and the rest) never use it.

| Navigation item (route) | Admin | Buyer |
| --- | --- | --- |
| Dashboard (`/`) | yes | yes |
| Catalog & pricing (`/catalog`) | yes | yes |
| Bundles (`/bundles`) | yes | **no** |
| Product import (`/import`) | yes | **no** |
| Store & channels (`/store`) | yes | **no** |
| Content (`/content`) | yes | **no** |
| Marketing (`/marketing`) | yes | **no** |
| Email (`/email`) | yes | **no** |
| Customers (`/customers`) | yes | **no** |
| Subscriptions (`/subscriptions`) | yes | **no** |
| Returns (`/returns`), Reviews (`/reviews`) | yes | yes |
| Brand partnership (`/partnership`) | yes | **no** |
| Company & team (`/company`) | yes | yes (read-only) |
| Account settings (`/account`) | yes | yes |

Bold cells are the ones the spec scenario "Buyer role" states explicitly. Disabled (not hidden) actions: store-changing actions on pages a Buyer can open (for example price edit on Catalog, user invite on Company) show the text "Insufficient permissions to perform this task". Shop as customer is Admin only (Q-W01).

## 6. Tasks

Work test-first: write the named tests (section 7), see them fail, then implement. Run `cd b2b2c-automotive/portal && npm run check` after each task group.

### R-00 Preflight

1. `cd b2b2c-automotive/portal && npm ci && npm run check && npm run build`. All green, else stop.
2. Confirm port: `npm run dev -- -p 3001` (the storefront uses 3000). Add `"dev": "next dev -p 3001"` to `portal/package.json` if G did not.
3. List demo users: open `seed/README.md`, note `DEMO_ADMIN_EMAIL`, `DEMO_BUYER_EMAIL` and the demo password variable name (never paste the password into plans or chat). Put the variable names in `portal/.env.example` as `DEMO_ADMIN_EMAIL=`, `DEMO_BUYER_EMAIL=`, `DEMO_PASSWORD=` with the comment "non-production only; enables the Use demo credentials button".

### R-01 Permissions model [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns]

File `lib/authz/permissions.ts` (read `references/b2b/permissions.md` and `custom-associate-roles.md` first).

```ts
export const ROLE = { admin: 'mau-role-admin', buyer: 'mau-role-buyer' } as const; // the seed keys (seed/src/data/org.ts ROLE_KEYS)
export type LogicalRole = keyof typeof ROLE;
export interface PortalPermissions { roles: LogicalRole[]; ctPermissions: string[]; }
export function logicalRoles(associateRoleKeys: string[]): LogicalRole[];
export function can(p: PortalPermissions, action: PortalAction): boolean;
export const INSUFFICIENT = 'Insufficient permissions to perform this task';
```

`PortalAction` is a string union (`'dashboard.view'`, `'store.view-performance'`, `'store.edit'`, `'catalog.edit'`, `'price.edit'`, `'discount.edit'`, `'content.edit'`, `'company.edit'`, ...). Map each action to the logical roles and, where a commercetools permission applies, to the permission string it needs (for example `catalog.edit` to `UpdateBusinessUnitDetails` is not meaningful: seller writes use the admin client after `authorizeStore`, so most actions map to roles only) in one table; S, T, U, V, W add rows as they need them. No approval actions exist. Keep the table in this file so a test can list every action.

### R-02 Navigation definition [SKILL: commercetools-storefront]

File `lib/portal/nav.ts`:

```ts
export interface NavItem { id: string; labelKey: string; href: string; icon: string; roles: LogicalRole[]; }
export interface NavGroup { id: 'my-store' | 'my-customers' | 'with-malva' | 'company'; labelKey: string; items: NavItem[]; }
export const NAV: { top: NavItem; groups: NavGroup[] };   // Dashboard on top, then 4 groups in the spec order (no Shop from Malva group)
export function visibleNav(roles: LogicalRole[]): { top: NavItem; groups: NavGroup[] }; // drops empty groups
export const ROUTE_ALLOW_LIST: string[]; // sub-routes not in the nav (sign-in, pending-approval, catalog/*, store/*)
```

Group order and items as in `sp/design-portal-shell-and-navigation` "Navigation groups" **minus** the Shop from Malva group and Roles & permissions: Dashboard; My store (Catalog & pricing, Bundles, Product import, Store & channels, Content, Marketing, Email); My customers (Customers, Subscriptions, Returns, Reviews); With Malva (Brand partnership, which only shows the fitment-claim review state, no price floor or territories); Company (Company & team, Account settings). Labels go to `messages/{de-DE,en-US}.json` under `nav.*` (both files, same keys). Icons: use the icon set G installed, otherwise inline SVGs under `components/ui/icons/` (do not add a new icon dependency).

`scripts/check-routes.mjs` (spec "Route map matches navigation"): parse `lib/portal/nav.ts` hrefs and walk `app/[locale]/(portal)/**/page.tsx`; fail if an item has no page or a page is neither in NAV nor in `ROUTE_ALLOW_LIST`. Also fail if a Route Handler under `app/api/seller/**` has no sibling `*.cross-store.test.ts` (bootstrap "New seller endpoint without ownership test"). Wire into `npm run check`.

### R-03 Placeholder pages

For every nav item create `app/[locale]/(portal)/<route>/page.tsx` that renders `<PlaceholderPage titleKey="..." />` (`components/portal/PlaceholderPage.tsx`: page header title 32/40, subtitle "This page is built in a later step."). Dashboard, catalog, store, content, company, account, customers, subscriptions, returns, reviews, marketing, email, bundles, import and partnership get their real bodies from S, T, U, V, W; those workstreams replace the placeholder. Never delete a route R created.

### R-04 Permissions endpoint and hooks [SKILL: commercetools-storefront]

- `lib/ct/associate.ts` (if G did not create it): `getAssociateRoles(session): Promise<{ roleKeys: string[]; ctPermissions: string[] }>`. Implementation: `apiRoot.asAssociate().withAssociateIdValue({ associateId: session.customerId }).inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: session.businessUnitKey }).get()` (confirm the exact builder name with `commercetools-oas-schemata` resource `api-BusinessUnit-read`), find the associate in `associates[]`, collect `associateRoleAssignments[].associateRole.key`; follow `inheritance: Enabled` roles from parent units; then load each role's `permissions`.
- `GET /api/business-units/current` returns `{ businessUnitKey, storeKey, roles: LogicalRole[], ctPermissions: string[] }` with `Cache-Control: no-store`.
- `hooks/usePermissions.ts`: SWR key `['permissions', businessUnitKey]`, returns `{ roles, can(action), isLoading }`.
- A 403 from commercetools anywhere is mapped by `lib/api.ts` (`handle`) to the message `INSUFFICIENT`.

### R-05 Authorization layer [SKILL: commercetools-storefront]

Files in `lib/authz/`:

```ts
// authorize-store.ts
export async function authorizeStore(session: Session, storeKey: string, action: PortalAction): Promise<void>;
// throws ForbiddenError (403) BEFORE any commercetools write when:
//  - session has no businessUnitKey, or
//  - storeKey is not the session store key nor a store of the session unit or its parents, or
//  - the user's logical roles do not allow `action` (permissions.ts)
// ownership.ts
export async function requireOwnership(session: Session, resource: { businessUnitKey?: string; storeKey?: string }): Promise<void>; // 404-style not-found for foreign resources
// test-helpers.ts (test only; T and U import it)
export function sessionFor(who: 'adminA' | 'buyerA' | 'adminB'): Session;
export function expectCrossStoreForbidden(handler: (req: Request) => Promise<Response>, build: (otherStoreKey: string) => Request): Promise<void>;
```

Test `lib/authz/admin-client-imports.test.ts`: scans `app/` and `lib/` for imports of `admin-client`; allowed only under `app/api/seller/**`, `lib/ct/seller/**`, `lib/contentools/jwt.ts`. Test `lib/authz/no-project-carts.test.ts` (ESLint rule or regex scan): `apiRoot.carts(` outside `lib/ct/admin*` fails (bootstrap "Project-level cart call").

### R-06 Sign-in [SKILL: commercetools-storefront] [SKILL: commercetools-commerce-patterns]

Read `references/b2b/customer-auth.md` and `references/core/customer-auth.md`. Files:

- `lib/ct/auth.ts`: `loginCustomer(email, password)` uses **`apiRoot.login().post({ body: { email, password } })`**, never `apiRoot.customers().login()`. On HTTP 400 `InvalidCredentials` (both unknown email and wrong password produce it) throw `AuthError('INVALID_CREDENTIALS')`; the route answers one fixed message.
- `lib/ct/business-units.ts`: `listAssociateUnits(customerId)`; for the chosen unit resolve the store (explicit store, else the nearest parent with one; set `storeMode: 'FromParent' | 'Explicit'` in the returned view) and `getStoreChannelData(storeKey)` returning `{ distributionChannelId, supplyChannelId, productSelectionId }` (skill `b2b/session-and-bu.md`).
- `POST /api/auth/login` (`app/api/auth/login/route.ts`): body `{ email, password }` validated with zod; empty fields are refused client side with "Fill in every field to continue." and server side with 400 `FIELDS_REQUIRED` (nothing sent to commercetools); on success write all session fields in one `updateSession(s => applyLocale(applyBusinessContext({ ...s, customerId }, ctx), locale))`: `customerId, businessUnitKey, storeKey, distributionChannelId, supplyChannelId, productSelectionId, accountGroupIds, cartId (reset), locale, currency, country` (country/currency from `COUNTRY_CONFIG` of the active locale). Wrap the handler in `handle(...)` and parse the body with `parseJson` from `lib/api.ts`. Choose the first active unit that has a store; remember the last used unit in a cookie `portal_last_bu` (not secret) to prefer on next login (Q-R08).
- If every unit of the customer is inactive (pending), write a **reduced session** with only `customerId` and `pending: true` (add `pending?: boolean` to the `Session` type in `lib/types.ts` and to `SESSION_KEYS`); respond `{ status: 'pending' }` and the UI goes to `/pending-approval`. No portal route is reachable with a reduced session (layout guard, R-12).
- `lastActiveAt` is a field of the seed's customer type `malva-customer` (DateTime, `seed/src/data/custom-types.ts`): after a successful login, set it with the admin client (`setCustomField` when the customer already has that custom type, else `setCustomType` with the type key `malva-customer` and `{ lastActiveAt }`; one update, retry once on 409; a failure is swallowed and never blocks the login). U's Users table reads it ("—" when absent). No other custom type is created or needed by R.
- `POST /api/auth/logout` clears the cookie and `Cache-Control: no-store`; `GET /api/auth/demo` returns `{ email, password }` from env **only when `NODE_ENV !== 'production'` and `DEMO_PASSWORD` is set**, otherwise 404.
- No rate limiter is built here: rate limiting and bot protection are out of scope for the whole project (workstream X decision D9). Note the gap in the route header comment so X's report can cite it.

### R-07 Registration and pending approval [SKILL: commercetools-commerce-patterns]

`lib/ct/registration.ts` `registerReseller(input: { companyName; name; email; password })`:

1. Validate (password 12+ characters, email format, company name 2 to 80 characters). Fields per the spec: company name, name, work email, password (Q-R06: no tax ID or country yet).
2. Create the Customer with the **Frontend client** (`apiRoot.customers().post`, `isEmailVerified: true` for this phase, Q-R02) then the Company business unit with the **provisioning client**: `unitType: 'Company'`, `key: 'rs-' + slug(companyName) + '-' + random4`, `status: 'Inactive'`, `storeMode: 'Explicit'`, no stores yet (a Malva operator assigns the reseller store when approving), `associates: [{ customer: { typeId:'customer', id }, associateRoleAssignments: [{ associateRole: { typeId:'associate-role', key: ROLE.admin }, inheritance: 'Disabled' }] }]`.
3. **Compensation:** if step 2 fails, delete the just-created customer (`DELETE /customers/{id}?version=`) with the provisioning client; never leave a half-created account. Idempotency key is the lower-cased email: a second concurrent call for the same email creates nothing (in-memory lock plus duplicate-email check; commercetools also rejects duplicate emails).
4. Respond with the exact text "Account created. Awaiting Malva approval of your business." Do **not** start a full session; sign in will reach the pending page.

A duplicate email answers 400 with the generic text "We couldn't create that account. Try signing in." (registration inherently reveals some existence information; note this trade-off in the route's header comment).

`app/[locale]/(auth)/pending-approval/page.tsx`: static explanation, business name, "Sign out" button, polls nothing. Operators activate the business unit and add its store in the Merchant Center (manual item OA-11).

### R-08 Password reset without enumeration [SKILL: commercetools-storefront]

- **No e-mail is sent** (owner Q-P01, drop emails; this also answers Q-R02). `POST /api/auth/reset-request` always responds 200 after a uniform delay (sleep to 400 ms total with jitter so timing does not reveal existence) with the **same body shape** for known and unknown emails: `{ message: 'If that account exists, continue below to choose a new password.', resetPath }`. For a known email call `apiRoot.customers().passwordToken().post({ body: { email, ttlMinutes: 15 } })` and return `resetPath = /${locale}/reset/${token}`; for an unknown email return a **decoy** `resetPath` with a random token of the same length (it fails at the reset step with the generic invalid-or-expired text), so the response does not reveal existence. The page then navigates to `resetPath` itself; no link is shown, logged or mailed. Because anyone who knows an email can then reset that account, the owner accepts this for the demo only: the whole on-screen flow is gated by the environment variable `DEMO_ONSCREEN_RESET` (same name as the storefront's, workstream Q; `on` in development and demo, absent or `off` makes the route answer 404 and the page show no reset form); it is recorded in Z's known gaps ("on-screen password reset: anyone who knows an email can reset that account; demo only"); the route header comment says so and X's report cites it. Add `DEMO_ONSCREEN_RESET` to `.env.example` with that reason and a test that the flag off gives 404. Remove `lib/mail.ts`, the `Mailer` interface and any `NoopMailer`: nothing in the portal imports a mail module.
- `POST /api/auth/reset` with `{ token, password }`: `apiRoot.customers().passwordReset().post({ body: { tokenValue, newPassword } })`; password rule 12+ characters; same error text for invalid or expired token.
- Page `app/[locale]/(auth)/reset/[token]/page.tsx` with two password fields and the live check from `sp/design-company-and-account` (strings: "Enter a new password", "Too short", "Passwords don't match", "Looks good").

### R-09 Auth screens [SKILL: commercetools-storefront]

Under `app/[locale]/(auth)/` (`sign-in`, `register`, `reset`, `pending-approval`) with a shared `components/portal/AuthCard.tsx`: centred 440 px card on the page canvas, logo mark, title, subtitle, fields 44 px, primary button 48 px, secondary link row (Create account, Forgot password?, Back to sign in). Use only tokens (`check-tokens`). Messages (both locales): "Fill in every field to continue.", the single wrong-credentials message ("Email or password is incorrect."), "Account created. Awaiting Malva approval of your business.", "If that account exists, continue below to choose a new password." (no "Check your inbox" text: nothing is mailed) The "Use demo credentials" button is rendered by a server component only when `process.env.NODE_ENV !== 'production'` and `/api/auth/demo` would answer; in production the element must not exist in the HTML.

### R-10 Business unit and store switcher [SKILL: commercetools-storefront]

- `GET /api/business-units` returns `{ company, divisions[], stores[] }` for the associate (`storeMode` per unit for the "From parent" / "Explicit store" caption).
- `POST /api/business-units/select` body `{ businessUnitKey, storeKey? }`: verify the unit belongs to the associate; recompute `getStoreChannelData`; write the five fields in **one** session write; clear `cartId`; respond the new label.
- `context/BusinessUnitContext.tsx` provides `{ current, units, switchTo }`. Every SWR key of unit-scoped data includes `businessUnitKey` (`['orders', businessUnitKey]`); switching calls `mutate(() => true, undefined, { revalidate: true })` for those keys and shows a toast ("Switched to {name}").
- Label format: `{unit name} · {store name}` (for example "Test Garage Nord · DACH Online").

### R-11 Shell layout [SKILL: commercetools-storefront]

`app/[locale]/(portal)/layout.tsx` (dynamic server layout; session guard):

- no session: `redirect('/sign-in?next=<path without locale>')` (the router adds the locale; outside any try/catch);
- reduced session (`pending`): `redirect('/pending-approval')`;
- every response in this group sends `Cache-Control: no-store`.

Components in `components/layout/`: `TopBar.tsx` (84 px, `--color-bg-topbar`, logo mark 40 px, search 44 px, switcher, command palette hint, bell, theme toggle, avatar menu with Sign out), `SidebarRail.tsx` (316 px, radius 32 px, sticky, active item white pill), `PageHeader.tsx` (title, subtitle, one primary action). Responsive: under 1024 px rail collapses to an 84 px icon rail; under 700 px it becomes a drawer opened from the top bar (`aria-expanded`, focus trap, Escape closes, focus returns to the button). Theme: `context/ThemeContext.tsx` sets `data-theme` on `<html>`, persisted in `localStorage('portal-theme')`, with an inline script in `app/layout.tsx` that applies it before paint (avoid a flash); the top bar stays dark in both themes (token only, no override).

### R-12 (dropped) Approvals badge

Removed with the approval workflow (owner Q-V01). No `lib/ct/approvals.ts`, no `/api/approvals/count`, no badge on any nav item, and S does not use it. The task number is kept so references stay stable; there is nothing to build.

### R-13 Global search and command palette [SKILL: commercetools-storefront]

- `GET /api/search/parts?q=` (frontend client, Product Search, store scoped): `apiRoot.inStoreKeyWithStoreKeyValue({ storeKey }).products().search().post({ body: { query: { or: [{ exact: { field: 'variants.sku', value: q } }, { exact: { field: 'variants.attributes.<OE_ATTRIBUTE>', value: q } }, { fullText: { field: 'name', language: 'de', value: q } }] }, limit: 8 } })`. The part attributes are `part-number` and `oem-numbers` (a set of text) of the seed product type `mau-pt-part` (`seed/src/data/product-types.ts`); keep them in `lib/portal/search.ts` as `PART_NUMBER_ATTRIBUTE = 'part-number'` and `OE_ATTRIBUTE = 'oem-numbers'` and match the exact value on both. Returns `{ parts: [{ sku, name, oe? }] }`; query shorter than 2 characters returns an empty list.
- Top bar field: Enter on an **exact** SKU or OE match navigates to `/catalog?tab=assortment&sku=<sku>` (T builds the page and the filter; until then the placeholder shows the part code); a 17-character VIN-shaped input (`/^[A-HJ-NPR-Z0-9]{17}$/`) shows an info toast "Vehicle lookup isn't enabled for this portal." (Q-R09); anything else with no exact match opens the palette prefilled.
- Palette (`components/portal/CommandPalette.tsx`): opens on Cmd+K or Ctrl+K, lists pages from `visibleNav(roles)` plus parts after two characters (200 ms debounce), arrow keys and Enter, Escape closes any overlay (shared `useOverlay` stack so Escape closes the top-most only).

### R-14 Notifications [SKILL: commercetools-storefront]

`lib/portal/notifications.ts`: `interface NotificationSource { id: string; load(session): Promise<Notification[]> }` and a registry. Sources shipped now: order shipped (store orders, read through the admin client in `lib/ct/seller/` after `authorizeStore`, with `shipmentState` Shipped changed in the last 7 days). "Approval waiting" and "quote counter-offer" are not built (Q-V01). Customer return received is a stub source that returns `[]` until V registers it. `GET /api/notifications`. Dismissals are stored per customer in `localStorage('portal-dismissed-' + customerId)` (Q-R04), so no server write is needed. Bell shows the unread count, panel lists items with link and a dismiss button, empty state "You're all caught up."

### R-15 Customer-session banner [SKILL: commercetools-storefront]

Session field `actingAs?: string` (the customer's display name; a string, so it passes the `SESSION_KEYS` allow-list; add it to `lib/types.ts`, `SESSION_KEYS` and `pickSession`). Workstream V (shop-as customer, Admin only, task V-06 in the split of the old W) sets it and keeps the impersonation record; R owns the display. `components/portal/CustomerSessionBanner.tsx` renders the warning-tinted bar "You are shopping as {customer}. Orders are placed on their behalf." with **Exit customer session**, which POSTs `/api/seller/impersonation/exit`. R creates that route (the path W uses) with only the session part: `updateSession(s => ({ ...s, actingAs: undefined }))`, no commercetools call; V-06 extends the same file to mark its record `ended`. The seller's own identity is untouched because the portal session keeps the seller's `customerId` throughout. Because the route sits under `app/api/seller/**`, give it a `route.cross-store.test.ts` that asserts it needs a session and never calls commercetools. R also adds a **development-only** `POST /api/dev/act-as { name }` (404 in production, test asserts it) so the banner can be tested before V (Q-R05).

### R-16 Copilot that asks before changing

No LLM (Q-R03). `lib/portal/copilot.ts`:

```ts
export interface CopilotAction {
  id: string;
  match(text: string): { params: Record<string, string> } | null;
  describe(params: Record<string, string>): string;           // exact change, e.g. Set 'Brake season promo' to inactive
  apply(session: Session, params: Record<string, string>): Promise<{ ok: boolean; message: string }>;
  permission: PortalAction;
}
export function registerCopilotAction(a: CopilotAction): void;
export function plan(text: string, session: Session, perms: PortalPermissions): { kind: 'answer'; text: string } | { kind: 'confirm'; actionId: string; params: Record<string,string>; summary: string };
```

`components/portal/CopilotPanel.tsx` shows the summary with **Confirm** and **Cancel**; only Confirm calls `POST /api/copilot/apply` which re-checks the permission and runs `apply`; the outcome is stated afterwards ("Done: ..." or the error). Built-in answers: "where is X" to the page link, using nav labels. T registers `set-discount-active` (pause or activate a discount by name) in task T-14; do not add it here.

### R-17 `proxy.ts` rules [SKILL: commercetools-storefront]

Extend G's `proxy.ts`: bare `/` redirects to `/de-DE`; a path under `(portal)` with no session cookie redirects to `/{locale}/sign-in?next=...` (return path validated: must start with a single `/` and not `//`, no scheme); sign-in page with a valid session redirects to `/`. Keep session verification in `lib/session-core.ts` (runs in both runtimes).

### R-17a Demo login [SKILL: commercetools-storefront] [SPEC: `seller-portal/design-demo-login`, all requirements]

Owner request 2026-10-12. It replaces the single "Use demo credentials" button of `seller-portal/design-auth-screens`. Files: `portal/lib/demo-login.ts`, `portal/app/api/auth/demo-accounts/route.ts` (GET), `portal/app/api/auth/demo-login/route.ts` (POST `{ customerId }`), `portal/components/auth/DemoLogin.tsx`, message keys `auth.demoLogin.*` in both locale files, `portal/scripts/check-no-demo-login.mjs` (added to `npm run check`).

1. `lib/demo-login.ts`: `isDemoLoginEnabled()` is true only when `DEMO_LOGIN_ENABLED === 'true'` and `NODE_ENV !== 'production'`. `listDemoAssociates()` reads with the **admin** root: customers `where: custom(fields(isDemo=true))`, then the business units that list them as associates (`expand: associates[*].customer`, role keys `mau-role-admin` and `mau-role-buyer`); returns `{ id, label, group }` only, label "Name · Role · Business unit", `group` = business unit name, ordered by business unit then Admin before Buyer. Never return email, password or other fields. `demoSignIn(customerId)` re-reads the list, refuses an id not in it (403, log `demo-login denied`), takes the password from `process.env.DEMO_LOGIN_PASSWORD` (server only) and runs the same server sign-in as the form route (G's `updateSession`, `applyBusinessContext`), so navigation and permissions equal a real sign-in.
2. Routes return 404 when disabled; GET is `no-store`; POST validates `{ customerId }` with zod.
3. `DemoLogin.tsx`: labelled `<select>` with `<optgroup>` per business unit, button "Sign in as demo user" disabled until selected, loading state, empty state "No demo accounts found. Run the seed.", inline `role="alert"` error "Demo sign-in failed. Try again."; admin-kit tokens only; 44 px field and 48 px button inside the 440 px card; placed between the form and the secondary link row.
4. `scripts/check-no-demo-login.mjs` as in Q-13a: fails a production build with the flag on, and fails if the demo password appears in `.next/static`.

Tests (write first): `lib/__tests__/demo-login.test.ts`: `disabled returns 404`, `list contains only seeded demo associates`, `list never exposes email or password`, `unlisted associate id is refused with 403 and no session`, `Admin demo sign-in gets Admin navigation`, `Buyer demo sign-in gets Buyer navigation` (uses the role matrix of section 5); `components/auth/DemoLogin.test.tsx`: `grouped by business unit`, `button disabled until selection`, `empty state`, `error announced`; `scripts/check-no-demo-login.test.ts`.

Chrome recipe: with `DEMO_LOGIN_ENABLED=true` open `/de-DE/sign-in`, assert grouped options, sign in as an Admin and as a Buyer (sign out between), assert the navigation of each matches the role matrix; unset the flag, assert the control and `/api/auth/demo-accounts` (404) are gone; confirm the password is absent from page source and responses; screenshots in `plans/evidence/R/`.

Seed dependency: `malva-customer.isDemo` (Boolean) true on the five seeded associates (row R in `plans/notes/seed-requests.md`). Fallback until then: key prefix `mau-cust-` plus `@example.com`, recorded in Notes. Add `DEMO_LOGIN_ENABLED` and `DEMO_LOGIN_PASSWORD` (same value as `SEED_DEMO_PASSWORD`) to `portal/.env.example` with no value.

### R-18 Verification and evidence

Run the Chrome recipe (section 8), the MCP read-back (section 9), save screenshots under `plans/evidence/R/`, write `plans/evidence/R/NOTES.md`-style notes inside the workstream file's "Notes" section (do not create other files in `plans/`).

## 7. Test-first scenarios (vitest, colocated `*.test.ts`)

Run: `cd portal && npx vitest run lib/portal lib/authz lib/ct app/api` then `npm run check`.

| Test file and name | Asserts |
| --- | --- |
| `lib/portal/nav.test.ts` › `nav matrix: admin sees every item` | `visibleNav(['admin'])` contains all items in section 5 |
| same › `nav matrix: buyer hides Brand partnership, Bundles, Email, Content, Marketing, Store & channels, Product import, Customers, Subscriptions` | exact absent list from the spec |
| same › `no Shop from Malva group, no Roles & permissions, no Approvals badge exist for any role` | group ids are my-store, my-customers, with-malva, company; no `badge` field |
| same › `nav groups keep spec order and drop empty groups` | group ids order |
| same › `every nav item has messages in both locales` | key sets |
| `lib/authz/permissions.test.ts` › `role matrix table: can(action) for admin, buyer` | table-driven for every `PortalAction` |
| same › `403 maps to the insufficient permissions message` | `lib/api.ts` `handle` mapping |
| `lib/authz/authorize-store.test.ts` › `rejects a store of another reseller before any commercetools call` | commercetools mock called 0 times |
| same › `rejects when role cannot perform the action` for buyer | 403 |
| same › `accepts own store and parent store` | no throw |
| `lib/authz/admin-client-imports.test.ts` › `admin client only imported from allowed folders` | scan |
| `app/api/auth/login/route.test.ts` › `unknown email and wrong password return the same body and status` | identical |
| same › `empty password: nothing sent to commercetools` | mock not called, message key |
| same › `writes all five business unit and store fields in one session update` | single `updateSession` call |
| same › `all units inactive gives reduced pending session` | `pending: true`, no BU fields |
| same › `uses login().post and never customers().login` | mock |
| `lib/ct/registration.test.ts` › `success creates customer, inactive company, admin association` | draft shape |
| same › `business unit failure deletes the customer` | compensation |
| same › `second concurrent call for same email creates nothing` | lock |
| same › `password shorter than 12 characters refused with the rule` | message |
| `app/api/auth/reset-request/route.test.ts` › `known and unknown email respond with the same status and body shape` | same keys, same lengths, `resetPath` present in both |
| same › `unknown email creates no token; the decoy path fails at reset with the generic text` | token mock not called; reset returns invalid-or-expired |
| `lib/no-mail.test.ts` › `no module under app/ or lib/ imports a mail provider` | scan |
| same › `response time does not depend on existence` | both within 400 to 600 ms with fake timers |
| `app/api/auth/demo/route.test.ts` › `404 in production` | env stub |
| `app/api/dev/act-as/route.test.ts` › `404 in production` | env stub |
| `app/api/business-units/select/route.test.ts` › `switch writes fields atomically, clears cartId` and `rejects unit that is not the user's` | session |
| `hooks/usePermissions.test.tsx` › `disabled edit action shows the insufficient permissions text` for buyer | rendering |
| `components/layout/Shell.test.tsx` › role matrix render for Admin, Buyer | `getAllByRole('link')` equals the table |
| same › `escape closes the top-most overlay only` | focus and state |
| `lib/portal/copilot.test.ts` › `plan returns confirm, apply not called until confirm` and `buyer without permission gets refusal text` | spy |
| `lib/portal/notifications.test.ts` › `dismiss drops the count from 3 to 2 and persists per customer` | localStorage stub |
| `lib/portal/search.test.ts` › `exact SKU navigates to the catalog filter, 1 character returns nothing, VIN shows info` | routing |
| `scripts/check-routes.test.mjs` › `fails for nav item without page; fails for seller route without cross-store test` | fixtures |

## 8. Chrome DevTools MCP recipe

Preconditions: seed done (G3), `portal/.env.local` has the frontend and admin clients (OA-01), `cd portal && npm run dev` on `http://localhost:3001`. Save screenshots as `plans/evidence/R/<nn>-<name>.png`. Use neutral naming in notes. Check `list_console_messages` after every page: **no errors, no hydration warnings**.

1. `navigate_page http://localhost:3001/` then `take_snapshot`. Assert final URL `http://localhost:3001/de-DE/sign-in` (bare path to locale to sign-in). Screenshot `01-sign-in-1440.png` at 1440 x 900 (`resize_page`).
2. `fill` email only, `click` Sign in. Assert text "Fill in every field to continue." and `list_network_requests` shows **no** call to `/api/auth/login`.
3. Wrong password for the demo admin email, then an unknown email. Assert both show the same sentence; compare the two `get_network_request` bodies (identical).
4. Click "Use demo credentials" (dev), sign in as **Admin**. Assert landing URL `/de-DE`, top bar background computed colour equals `--color-bg-topbar` (`evaluate_script: getComputedStyle(document.querySelector('[data-testid=topbar]')).backgroundColor`), sidebar groups in spec order, switcher label `{unit} · {store}`. Screenshot `02-admin-shell-1440.png`.
5. Toggle theme (moon button). Assert `document.documentElement.dataset.theme === 'dark'`, page canvas colour changed, top bar colour unchanged. Screenshot `03-admin-dark.png`. Toggle back.
6. Press `Control+K`: palette opens, type `bre` (2+ characters): a parts group appears; Escape closes it. Type an exact seeded SKU in the top field and press Enter: URL becomes `/de-DE/catalog?tab=assortment&sku=<sku>`.
7. Open the bell: panel shows notifications or "You're all caught up."; dismiss one, count drops by one; reload, it stays dismissed.
8. Open Copilot, type `Where is Returns?`: answer links to Returns. (The discount confirm scenario runs in T.) Customer-session banner (development build): `evaluate_script: fetch('/api/dev/act-as', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Test Driver' }) })`, reload: the banner reads "You are shopping as Test Driver. Orders are placed on their behalf."; click Exit customer session: the banner disappears and the next `GET /api/business-units/current` still answers as the seller. Screenshot `09-banner.png`.
9. Sign out. Repeat step 4 as **Buyer**: `evaluate_script` collect sidebar link texts and compare to section 5 (Buyer column). Open `/de-DE/store` directly: expect the forbidden page (not the placeholder). Assert no "Shop from Malva" group, no "Roles & permissions" and no badge exist for either role. Screenshot `04-buyer-nav.png`.
10. Switcher: as Admin choose another division: toast "Switched to ...", label changes, `list_network_requests` shows unit-scoped requests refetched, `document.cookie` does not expose the session (HTTP-only: `evaluate_script` returns no `session` entry).
11. Responsive: `resize_page` to 1000 x 800 (icon rail 84 px wide, check `getBoundingClientRect().width`), then 375 x 800 (drawer opens from the top bar button, Escape closes, focus returns). Screenshots `06-rail-1000.png`, `07-drawer-375.png`.
12. Register: `/de-DE/register` with `qa-r-<n>@example.com` and a new company name; assert the message "Account created. Awaiting Malva approval of your business."; sign in with it: lands on `/de-DE/pending-approval`, and `navigate_page /de-DE` redirects back to it. Clean up through the MCP read-back (section 9, item 6). Screenshot `08-pending.png`.
13. Reset: request for a known and an unknown email: the same status, same body keys and lengths, the page continues to a reset form in both cases; the unknown one fails at submit with the generic text; no e-mail is mentioned anywhere. Production build check: `npm run build && npm run start -p 3001`, repeat step 4: no "Use demo credentials" button in the DOM (`evaluate_script: !!document.body.innerText.match(/demo credentials/i)` is false).

## 9. `b2b2c-automotive` MCP read-back checks (read-only tools)

1. `read_associate_roles`: the Admin and Buyer roles exist and their `key`s equal the `ROLE` constant; no Approver role exists.
2. `read_business_units` where key = demo unit: the two demo customers are associates with the expected roles; the unit has an explicit or inherited store (`storeMode`).
3. `read_stores`: the store key in the session after login equals the unit's store (compare to the label).
4. `read_customers` for the two demo emails: `isEmailVerified` as seeded.
5. After step 10 of the recipe nothing in commercetools changed (switching writes only the cookie): `read_carts` shows no new cart for the demo customer.
6. After registration (recipe step 12): `read_business_units` key starting `rs-`: `status` is `Inactive`, one associate with the admin role, no stores; `read_customers` the new customer exists. **Delete** them through a throwaway script `scripts/dev-delete-test-company.mjs` that refuses any key or email not starting `rs-qa-` / `qa-r-` (admin client, run by the junior; never through MCP write tools). Re-run the reads: nothing remains.

## Seed requests

None. R uses what the seed has: associate roles `mau-role-admin` and `mau-role-buyer`, business units `mau-bu-*` with the demo associates (Admin and Buyer per reseller, `mau-cust-north-admin`, `mau-cust-north-buyer`, `mau-cust-south-admin`, `mau-cust-south-buyer`), stores with channels, the customer type `malva-customer` (field `lastActiveAt`) and the part attributes `part-number` and `oem-numbers`. A registered reseller's pending unit may carry `mau-business-unit-fields.kind = 'reseller'`; it is optional and not required by any read.

## 10. Manual items for `plans/TODO-MANUAL-TESTING.md` (never wait silently)

Claude does not ask in chat; add these rows and continue with the next task. Ids are final (merged into the TODO file by the lead).

| ID | Needed by | Action | Expected |
| --- | --- | --- | --- |
| OA-01 (exists) | R-06 live run | Seed/admin client and frontend client in `portal/.env.local` | login works live |
| OA-11 | R-07 | Define how a Malva operator approves a pending reseller: in the Merchant Center set the business unit to Active and assign the reseller store (steps written by Claude in the TODO file after R-07) | pending account can then sign in to the portal |
| SO-01 (exists) | R-09, R-11, R-13 to R-16 | Sign off the screens missing from the designs: pending-approval page, reset page, drawer, command palette, notification panel, Copilot panel | approved or change list |
| M-R-1 | R-18 | Compare shell, auth card, dark mode with `design/export/Malva Seller Portal.dc.html` at 1440 px and 375 px | matches except documented changes |
| M-R-2 | R-11 | Keyboard-only pass: Tab order top bar, rail, content; drawer focus trap; screen reader reads the active item and badge | no trap, labels present |

## 11. Definition of done

- All tests in section 7 exist, failed first, and pass; `npm run check` and `npm run build` green; `check-routes` and `check-tokens` pass.
- Chrome recipe run end to end for Admin and Buyer; G8 evidence stored; console clean.
- MCP read-backs recorded; test company removed.
- `.env.example` lists every variable and scope used here with a reason; `scopes.test.ts` passes.
- No placeholder prototype names in code or copy; both message files have identical keys.
- Questions Q-R01 to Q-R09 present in `plans/notes/questions-RSTU.md` with the defaults used.
- No decision left open: where the plan says "confirm", the confirmation is a recorded check in Notes, not a question to the owner.

## 12. Evidence

`plans/evidence/R/01-sign-in-1440.png`, `02-admin-shell-1440.png`, `03-admin-dark.png`, `04-buyer-nav.png`, `06-rail-1000.png`, `07-drawer-375.png`, `08-pending.png`, `09-banner.png`, plus the console and network summary lines pasted under "Notes" below.

## Progress

- 2026-10-12 J8: R-01 done (`lib/authz/permissions.ts`, role matrix test; `ROLE` and `logicalRoles` come from G's `lib/roles.ts`). R-02 done (`lib/portal/nav.ts`, `scripts/check-routes.mjs` nav/page/seller-test checks in `check` and `--static`). R-03 done (15 placeholder routes, server-side action guard, Forbidden view).
- R-04 done on the portal side (`GET /api/business-units/current`, `hooks/usePermissions.ts`); live roles come from G's `getAssociateRoles` through `lib/portal/live-ports.ts`.
- R-05 done (`authorizeStore`, `requireOwnership`, `test-helpers.ts`, admin-client fence test, no project-level cart test). Store check is "session store only" and runs before any commercetools call.
- R-06 done against ports with mocked tests (login route, logout, pending reduced session, `portal_last_bu` preference, locale triple via G's `applyLocale`/`applyBusinessContext`); `lastActiveAt` stamp in `lib/ct/seller/customer-activity.ts` (live check M-R-4). R-07 done (route + `registration.ts` with compensation, in `app/api/auth/register/`), pending page done. R-08 done (uniform delay, decoy token, `DEMO_ONSCREEN_RESET` 404). R-09 done (AuthCard, sign in, register, reset, pending).
- R-10, R-11 done (switcher, rail, drawer, theme, shell, `(portal)` guard). R-12 dropped. R-13 done (top search, palette, `/api/search/parts`; live scoping check M-R-3). R-14 done (bell, per-customer dismissals, sources registry; return source is a stub). R-15 done (banner, exit route with cross-store test, dev act-as). R-16 done (rule-based copilot, `/api/copilot/plan` and `/apply`, permission re-check).
- R-17: proxy rules are J7's and are in place (verified in Chrome: bare `/`, deep link to `?next=`, sign-in with a session). R-17a done (`lib/demo-login.ts`, routes, `DemoLogin.tsx`, `check-no-demo-login.mjs` in `check` and `verify:build`).
- R-18: Chrome run against the fixture ports (no credentials, OA-01): evidence in `plans/evidence/R/portal-*.png`. MCP read-backs (section 9) and live checks are open: M-R-3 to M-R-6.
- Gates: `npm run check` green except `scripts/gate.test.mjs` "Gate on a clean scaffold", which fails because J7's `app/api/health/route.ts` exists while that A-era test expects no health route in a release (not R; J7 or the lead reconciles). `npm run verify:build` green.

## Notes

- 2026-10-12, how it was verified: `PORTAL_DEV_FIXTURES=on DEMO_LOGIN_ENABLED=true DEMO_ONSCREEN_RESET=on` with dummy `CTP_*` and `SESSION_SECRET` values on the command line (never a file), dev server on port 3110. Fixture users (`lib/portal/dev-fixtures.ts`, neutral names) replace commercetools; the session cookie is G's real signed `malva_portal_session`, so proxy and layout guard run as in production. Role switch for checks: `GET /api/dev/session?as=adminA|buyerA|adminB|pending|none&next=/de-DE` (`route.dev.ts`, absent from production builds).
- Chrome results (1440 x 900 unless noted): `/` goes to `/de-DE/sign-in`; empty password sends no `/api/auth/login` request; demo picker grouped by unit, Admin sign-in gives the full navigation in spec order, top bar `rgb(48, 48, 48)` in light and dark while the page canvas changes (`rgb(26, 26, 26)` in dark); palette opens on Ctrl+K, lists parts after 2 characters, Escape closes top-most only and focus returns; bell shows 3, dismiss gives 2 and survives a reload (`localStorage portal-dismissed-<customerId>`); act-as banner appears, Exit removes it and `/api/business-units/current` still answers as the seller; the session cookie is HttpOnly (not in `document.cookie`); switching to a division shows the toast and the new label; Buyer sees 6 items and `/de-DE/store` shows the forbidden view; 1000 px: rail is 84 px wide (60 px inner); 375 px (emulated): drawer opens from the menu button, focus is inside, Escape closes and focus returns to the button, no horizontal overflow; pending session: every portal path redirects to `/de-DE/pending-approval`, and `/de-DE` redirects back to it. Console: no errors or hydration warnings on any page. Reset request: known and unknown email give the same status, keys and length and 450 to 570 ms; the decoy fails at reset with the generic text; registration answers the awaiting-approval text and a duplicate the generic failure.
- Production build (`next start`, flag `DEMO_LOGIN_ENABLED=true` set on purpose): no demo control in the HTML (`demo` prop is undefined), `/api/auth/demo-accounts` 404, `/api/dev/session` 404, reset routes 404 with `DEMO_ONSCREEN_RESET` off and the page shows the "not available" text, `/de-DE/catalog` redirects to `/de-DE/sign-in?next=%2Fcatalog`. The translated demo strings are still in the message payload (all messages are sent to the client); only the control is absent.
- Deviations: (1) session fields `pending` and `actingAs` were already in J7's `Session`; no edit to `lib/types.ts` or `session-core.ts` was needed. (2) Registration lives in `app/api/auth/register/registration.ts`, not `lib/ct/registration.ts`, because the ESLint fence allows the provisioning client only under that folder. (3) Avatar is 40 px (no 36 px spacing token). (4) The 440 px card width is composed from spacing tokens. (5) Breakpoint 700 px is `@custom-variant narrow` in `app/globals.css` written in rem (43.75rem) to keep the px lint green. (6) Sign in, sign out and demo login use a full page load (`hooks/navigate.ts`) because the client router cache otherwise showed the previous user's shell.
- Known gap for X and Z: no rate limit or bot protection on sign in (D9); on-screen reset lets anyone who knows an email reset that account (demo only, `DEMO_ONSCREEN_RESET`).
