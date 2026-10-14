<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Malva Partner Portal

Next.js 16 app for resellers' staff: run a store (assortment, prices, theme, content). B2B surface, admin design kit (Inter, near-black action, light and dark). Not reseller-themed. Routes are `/[locale]/...`; the store is held in the session, never in the path. Locales: `de-DE` (default) and `en-US`.

Node 22 (`.nvmrc`). Install and run:

```
cp .env.example .env.local   # fill in values; never commit .env.local
npm ci
npm run dev                  # http://localhost:3000, or: npm run dev -- -p 3100
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run check` | The quality gate: typecheck, lint, then the gate scripts below, then tests |
| `npm run verify:build` | `next build`, then route, health-route and bundle-secret checks on the output. First it runs `scripts/check-build-env.mjs`: with `RELEASE=1` (or a production Netlify context) `STOREFRONT_ORIGIN` must be set in the BUILD environment as a bare https origin (next.config.ts bakes it into the CSP); other builds are not checked |
| `node scripts/ensure-w.mjs [--apply]` | W: verifies the seed types for marketing, bundles and local products; writes demo campaigns and e-mail templates only with `--apply` (see "Selling tools") |
| `node scripts/ensure-v.mjs [--apply]` | V: verifies the seed types for customers, returns and checkout fields; creates the review type `malva-review` and the review states only with `--apply` (see "Customers, subscriptions, returns and reviews") |

## Gates (`scripts/`)

- `check-versions`: next above 16.0.0, next-intl 4, platform-sdk 8, ts-client 4, react 19, `.nvmrc` starts with 22.
- `check-tailwind`: Tailwind v4 only (no config file, `@import 'tailwindcss'`, `@tailwindcss/postcss`).
- `check-secrets`: no `NEXT_PUBLIC_` on a secret, no tracked `.env*`, `.env.example` lists every variable empty, every scope has a `# <scope> : <reason>` line and no scope used in code is undocumented.
- `check-server-only`: `lib/ct/**`, `lib/session*.ts`, `lib/contentools/**` (except `origin.ts`) start with `import 'server-only'`; client code never imports them.
- `check-tokens`: components use tokens only (see below).
- `check-messages`: exactly `de-DE.json` and `en-US.json`, identical keys and ICU placeholders, no empty values, every `t('ns.key')` exists.
- `check-demo-reset`: `DEMO_ONSCREEN_RESET` is `true` or `false` (the one spelling of both apps, Q-X10; the old "on" fails); `true` in a production build also needs `DEMO_RESET_ACKNOWLEDGED=true`. The portal has no rate limiter by decision D9 (Q-X03); see `plans/notes/questions-VWXYZ.md` Q-X09.
- `check-build-env` (first step of `verify:build`): see the scripts table.
- `check-routes`, `check-no-dev-pages`, `check-no-health-in-release`, `check-bundle-secrets`: release hygiene. Dev pages are named `page.dev.tsx` and only exist outside production builds (`next.config.ts` `pageExtensions`); the health route must not exist when `RELEASE=1` or on the production context.
- Accessibility and performance (workstream Y): `contrast-report` (`node scripts/contrast-report.mjs`; the pairs of `scripts/contrast-pairs.json` in light and dark against WCAG AA, listed exceptions with reasons; it reads `app/tokens.css` and the AA text layer of `app/globals.css`), `check-reduced-motion` (one global `prefers-reduced-motion` rule, no unguarded animation or smooth scroll), `bundle-report` (after `next build`: first-load JavaScript per route, gzip, budgets 350 KB and 1.5 MB for the Content and Theme editor routes; part of `verify:build`). Tests: `components/**/*.a11y.test.*`, `components/tables.a11y.test.ts`, `lib/portal/page-title.test.ts` (every route has a locale-aware title). Browser evidence is in `plans/evidence/Y/portal-*`.
- ESLint rules (`eslint.config.mjs`, tests in `eslint/rules.test.mjs`): `new ClientBuilder` only in `lib/ct/client.ts`; commercetools SDK only in `lib/ct/**` and `lib/mappers/**`; no `fetch('/api/...')` in components and pages (hooks only); locale-aware navigation only (`@/i18n/routing`); no Puck value imports in Server Components; admin client importable only from `app/api/seller/**`, `lib/ct/seller/**`, `lib/contentools/jwt.ts`, provisioning client only from `app/api/auth/register/**`.

## Design tokens

Components use tokens only; see `scripts/check-tokens.mjs`. `app/tokens.css` is a copy of `../design/export/tokens.admin.css` without its Google Fonts `@import` (fonts are self-hosted by `next/font`, Q-B01); `check-tokens` fails when the copy drifts. The `@theme inline` block in `app/globals.css` between `theme:begin` and `theme:end` is generated: run `node scripts/gen-theme-block.mjs` after editing `app/tokens.css`. The default Tailwind scales are removed, so only token utilities exist (`bg-bg-surface`, `text-text`, `p-400`, `rounded-300`, `text-body-2`, `shadow-card`, `h-topbar`). Light and dark through `data-theme` on `<html>` (key `malva-portal-theme` in localStorage, applied before first paint); the top bar `--color-bg-topbar` is dark in both themes. Dev specimen: `/dev/tokens` (development only).

## Locales

Two locales only. Add a message key to both `messages/de-DE.json` and `messages/en-US.json` in the same commit. Never import `Link`, `redirect`, `useRouter` or `usePathname` from `next/link` or `next/navigation`; use `@/i18n/routing`. `/` redirects to the locale in the cookie `your-shop-country-locale`, else `de-DE` (no Accept-Language detection). A supported locale in the wrong case is redirected to the canonical case; an unsupported one is a 404. `proxy.ts` skips `/api`, `/_next`, files with an extension and, outside production, `/dev`.

## Puck manager peer set (A-02, Q-A01)

`@commercetools-demo/puck-page-manager`, `puck-content-manager` and `puck-theme-manager` are pinned to `0.8.1`. They install with `npm install` and no `--legacy-peer-deps`, together with React 19. The peers they declare, as resolved here (matching `b2b2c-starter/dealer`, whose ranges are `^3.36.0`, `^3.2.0`, `5.3.4`, `^10.1.14`):

| Peer | Declared by the managers | Installed |
| --- | --- | --- |
| `@chakra-ui/react` | `^3.36.0` | 3.37.0 |
| `@commercetools/nimbus` | `^3.2.0` | 3.6.0 |
| `@commercetools/nimbus-icons` | `^3.2.0` (page and content manager) | 3.6.0 |
| `react-router-dom` | `>=5.0.0 <6` | 5.3.4 |
| `react-intl` | `>=6.0.0` | 10.2.2 |
| `react`, `react-dom` | `>=19.0.0` | 19.2.4 |

`@emotion/react` ^11.14 is installed as the reference does. `puck-renderer` and `puck-editor` arrive transitively and are not installed explicitly. Test-runner note: `@vitejs/plugin-react` is on `^5` because v6 declares an optional peer on `@babel/core` 8, which conflicts with the nimbus dependency tree (`@babel/core` 7).

## Server tier (workstream G)

Environment: copy `.env.example` to `.env.local` and fill it in; `lib/env.ts` validates it (`instrumentation.ts` at server start, and on import of any client). A missing variable fails with `Missing environment variable <NAME>`, never with its value; `SESSION_SECRET` must be at least 32 characters. Every scope of every client is listed with a reason in `.env.example` and in `lib/scopes.ts`; `lib/scopes.test.ts` fails when the two differ.

Three clients, three credential sets, one `new ClientBuilder(` (in `lib/ct/client.ts`):

| Client | File | Credentials | Used for |
| --- | --- | --- | --- |
| Frontend `apiRoot` | `lib/ct/client.ts` | `CTP_*` | login, the as-associate chain (`lib/ct/associate.ts` `asAssociate(session)`), store, business unit and role reads |
| Seller-admin `adminRoot` | `lib/ct/admin-client.ts` | `CTP_ADMIN_*` | seller administration and the Contentools JWT object, only from `app/api/seller/**`, `lib/ct/seller/**`, `lib/contentools/jwt.ts`, and only after `authorizeStore` |
| Provisioning `getProvisioningRoot()` | `lib/ct/provisioning-client.ts` | `CTP_PROVISION_*` | the registration endpoint only (`app/api/auth/register/**`) |

Session: `lib/session.ts` (`getSession`, `updateSession`, `setSessionCookie`, `clearSessionCookie`, `getLocale`) over the pure `lib/session-core.ts` (sign, verify, `applyLocale`, `applyStore`, `applyBusinessContext`) that the proxy also uses. The cookie `malva_portal_session` is a HS256 JWT, HTTP-only, SameSite lax, 30 days, ids and flags only (`customerId`, the five business unit and store fields, `accountGroupIds`, `cartId`, the locale triple, `pending`, `actingAs`). To add a session field, extend `Session` in `lib/types.ts` and `SESSION_KEYS` plus `pickSession` in `lib/session-core.ts` in the same commit. Roles are `ROLE.admin` (`mau-role-admin`) and `ROLE.buyer` (`mau-role-buyer`) in `lib/roles.ts`.

Route Handler template (`lib/api.ts`): validate the session first, call `lib/ct`, return JSON; failures are `{ "error": "<safe message>" }` and never carry commercetools text.

```ts
export const POST = handle(async (request: Request) => {
  const session = await getSession();
  requireBusinessUnit(session);                      // 401 Not signed in, or 400 No active business unit
  const body = await parseJson(request, schema);     // 400 with the first zod issue
  return Response.json(await doTheWork(session, body)); // lib/ct/* makes the commercetools call
});
```

`npm run build` and `verify:build` import the clients while collecting page data, so they need the variables of `.env.example` (a real `.env.local`, or dummy values such as the set in `test/env.ts`); there is no fallback key.

`proxy.ts`: locale step, then a signed-out visitor outside `sign-in`, `register`, `reset`, `pending-approval` is redirected to `/{locale}/sign-in?next=<path>`; `sanitizeNext` in `lib/next-path.ts` validates the return path (use it again when sign-in redirects back). `/api/health` exists in development and test only (`check-no-health-in-release` keeps it out of a release).

## Selling tools (workstream W)

Marketing (`/marketing`), E-mail (`/email`), Bundles (`/bundles`), Product import (`/import`) and Brand partnership (`/partnership`) are Admin only. Server code is in `lib/ct/seller/{campaigns,email-templates,email-campaigns,audience-facts,bundles,local-products,product-import,partnership}.ts`, the pure rules in `lib/{email,bundles,marketing,import,partnership}/`, the routes in `app/api/seller/{campaigns,email,bundles,local-products,import,partnership}/`. Facts to keep:

- **No e-mail is ever sent.** Templates and campaigns are custom objects (`malva-email-templates`, `malva-email-campaigns`) that are stored and previewed; "Mark ready" stores a recipient count only. `lib/email/no-mail.test.ts` fails on a provider variable or a send function.
- **Prices are standalone prices** on the store's distribution channel, written only by `setStandalonePrice` of `lib/ct/seller/prices.ts` (bundles, local products). The CSV import writes the same prices through the Import API (`lib/import/import-api.ts`, the one file allowed to call the Import API host with `fetch`; the host is `CTP_API_URL` with `api.` replaced by `import.`; scope `manage_import_containers`).
- A local product with a fitment claim is created unpublished with `review-state=pending` and stays out of every selection; Malva approves it in the Merchant Center. A CSV import can never carry fitment.
- Dev fixture mode (`PORTAL_DEV_FIXTURES=on`, never production): `lib/portal/w-fixture-root.ts` extends T's in-memory commercetools client with products, custom object lists, orders, customers and an in-memory Import API; demo campaigns, vehicles, six customers per store and one stored template are seeded.

`node scripts/ensure-w.mjs [--apply] [--store <key>]` (needs `.env.local`; refuses any project but `spec-test-b2b2c-automotive`) verifies that the seed's custom types and the product types `mau-pt-local-part` and `mau-pt-bundle` exist with the attributes W uses, then (with `--apply`) writes only demo custom objects (`"demo": true`): two co-op campaigns and the default e-mail templates per store. It creates no type. Dry run without `--apply`.

## Customers, subscriptions, returns and reviews (workstream V)

- Pages `/customers` (+ `/customers/[id]`), `/subscriptions`, `/returns`, `/reviews`; routes under `app/api/seller/{customers,orders,subscriptions,returns,reviews}`; services in `lib/ct/seller/{customers,subscriptions,returns,reviews,impersonation}.ts` (pure parts in `lib/customers`, `lib/subscriptions`, `lib/contracts/return-item.ts`). Customers, Subscriptions, shop-as and Mark delivered are Admin only; Returns and Reviews can be read by a Buyer, every write is Admin only.
- Every read and write is scoped by the checked `storeKey` (orders and customers in-store; recurring orders by `store(key=...)` in the predicate; reviews by `custom.fields.storeKey`). A resource of another store is a 404.
- **Refunds go through commercetools Checkout and Stripe**: `lib/ct/checkout-payments.ts` posts the Payment Intents `refundPayment` action (one request token with the single scope `manage_checkout_payment_intents:<projectKey>`); the portal never writes a Payment transaction. A return becomes Refunded only when the Payment holds a matching Refund transaction in `Success` (checked when the list or the detail loads). No e-mail is sent anywhere.
- **Shop as customer**: `IMPERSONATION_SECRET` (32+ characters, the same value in the storefront) signs a 60 second handoff token that the browser POSTs in a form body to `<STOREFRONT_ORIGIN>/api/impersonate`. The storefront landing is not built yet (`plans/MISSED-FEATURES.md`, V rows).
- New admin scopes (`.env.example`, `lib/scopes.ts`): `manage_orders`, `view_payments`, `manage_checkout_payment_intents`, `manage_recurring_orders`, `view_states`.
- `node scripts/ensure-v.mjs [--apply]` (needs `.env.local`; refuses any project but `spec-test-b2b2c-automotive`) verifies the seed types `malva-checkout`, `malva-line`, `malva-return-item`, `malva-customer` and creates only the type `malva-review` and the states `review-published`, `review-hidden` with `--apply`.
- Dev fixture mode (`PORTAL_DEV_FIXTURES=on`, never production): `lib/portal/v-fixture-root.ts` is an in-memory client with shoppers, guests, orders (one undelivered, one past the window), returns, subscriptions and reviews per fixture store; a pending refund is confirmed on the second Payment read. Use `next dev --webpack` when other people change files under the repository root (Turbopack reloads the page on every foreign change).

## Deployment

`netlify.toml` is in this directory. In the Netlify UI set Base directory to `b2b2c-automotive/portal`. `AGENTS.md` is the block `next dev` writes; commit it as is. Shared code with the storefront is copied, not packaged (no workspace).
