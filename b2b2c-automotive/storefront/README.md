<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Malva storefront

The shopper storefront of the Malva automotive reseller demo: one Next.js 16 app that serves every reseller. The reseller is the commercetools store named in the URL path, `/[locale]/[store]`. Stack: Next.js 16, React 19, TypeScript strict, Tailwind v4 (no config file), next-intl 4, Vitest and Testing Library. Node 22 (`.nvmrc`).

## Run

```
cp .env.example .env.local   # names only in the example; fill the values locally, never commit them
npm ci
npm run dev                  # http://localhost:3000/de-DE/<store>
```

All eight variables in `.env.example` are required to start the server (`instrumentation.ts` validates them and a missing or weak one, for example `SESSION_SECRET` under 32 characters, stops the server with a message naming the variable, never its value). `npm run build` and `npm run verify:build` import the server modules too, so they need the variables as well: either `.env.local` or, for a credential-free gate run, dummy values (see `test/env.ts` for a set that works offline).

## Server layer (workstream G)

| Piece | File |
| --- | --- |
| Environment validation | `lib/env.ts` (`validateEnv`, `getSessionSecret`) |
| The one commercetools client (`apiRoot`, `createApiRoot` with client-credentials, anonymous and password flows) | `lib/ct/client.ts`; store scoped requests `lib/ct/in-store.ts` |
| Store lookup with channels, 60 s cache (10 s for "not found", stale on outage) | `lib/ct/stores.ts`, `lib/ttl-cache.ts`, `lib/mappers/store.ts` |
| Session: signed JWT (`jose`, HS256) in the HTTP-only cookie `malva_session`, ids only | pure `lib/session-core.ts` (also used by `proxy.ts`), `lib/session.ts` |
| Route Handler helpers | `lib/api.ts` (`handle`, `ApiError`, `requireCustomer`, `parseJson`) |
| Scope registry (must match `.env.example`) | `lib/scopes.ts` |
| Store from the path | `proxy.ts`: first segment after the locale is the store key; unknown store is a 404 rewrite to `/<locale>`, outage is 503, a found store writes the four store fields to the session together and clears `cartId` when the store changes; sets request header `x-store-key` |
| Dev only health check | `GET /api/health` returns `{"ok":true,"projectKey":"..."}`; 404 in production; the file must not exist in a release build |

The default branch pair of a store is the first distribution and the first supply channel by ascending key (Q-G03); the store picker (workstream I) overrides it.

Route Handler template (validate session, call `lib/ct`, return JSON; the browser never calls commercetools):

```ts
import { z } from 'zod';
import { handle, parseJson, requireCustomer } from '@/lib/api';
import { getSession } from '@/lib/session';
import { doThing } from '@/lib/ct/thing';

const body = z.object({ sku: z.string().min(1, 'SKU is required') });

export const POST = handle(async (request: Request) => {
  const session = await getSession();
  requireCustomer(session); // 401 before any commercetools call
  const { sku } = await parseJson(request, body); // 400 with the first zod message
  return Response.json(await doThing(session.customerId, sku));
});
```

Errors leave as `{ "error": "<safe message>" }` (401 `Not signed in`, 403, 404 `Not found`, 409 `Conflict, please retry`, anything else 500 `Something went wrong`); SDK messages are never returned or logged.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run check` | the whole quality gate (below) |
| `npm run verify:build` | `next build`, then route, health-route and bundle-secret checks |

## Gate (`npm run check`)

- `tsc --noEmit` and `eslint .` (lint rules: single `ClientBuilder`, SDK only in `lib/ct` and `lib/mappers`, no `fetch('/api/...')` in components, locale-aware navigation only, no Puck value imports in Server Components).
- `check-versions`: next above 16.0.0, next-intl 4, platform-sdk 8, ts-client 4, react 19, `.nvmrc` 22.
- `check-tailwind`: no `tailwind.config.*`, v4 import and PostCSS plugin.
- `check-secrets`: no `NEXT_PUBLIC_` secret, no tracked env file, `.env.example` complete, every scope has a `# <scope> : <reason>` line.
- `check-server-only`: `lib/ct`, `lib/session*`, `lib/contentools` (except `origin.ts`) start with `import 'server-only'`; client code never imports them.
- `check-tokens`: no raw hex, font name, px size or Tailwind arbitrary value; unknown `var(--x)`; `app/tokens.css` equals the design source; the generated `@theme` block is current.
- `check-messages`: only `de-DE.json` and `en-US.json`, same keys and placeholders, no empty values, every used key exists.
- `check-routes`, `check-no-dev-pages`, `check-no-health-in-release`: release builds (`RELEASE=1`, or `NODE_ENV=production` with `CONTEXT=production`) contain no `/dev` route and no `app/api/health/route.ts`.
- `check-bundle-secrets` (in `verify:build`): no secret value in `.next/static`.

## Design tokens

Components use tokens only; see `scripts/check-tokens.mjs`. `app/tokens.css` is a copy of `design/export/tokens.automotive.css` without the Google Fonts `@import` line (fonts are self-hosted through `next/font`, see `lib/fonts.ts`). The `@theme inline` block in `app/globals.css` is generated: after changing `tokens.css` run `node scripts/gen-theme-block.mjs`. Utilities map to variables, for example `bg-brand-700`, `text-text`, `p-4` (16px), `p-5` (24px), `rounded-md`, `font-display`, `shadow-card`. The default Tailwind palette is removed. A dev-only specimen lives at `/dev/tokens`.

## Locales

Exactly two: `de-DE` (default, EUR, DE) and `en-US` (USD, US), always in the URL: `/de-DE/<store>`. The choice is kept in the cookie `your-shop-country-locale`. A bare path (`/`, `/hartmann`) goes to the cookie locale or `de-DE`; there is no Accept-Language detection. `/fr-FR/...` is not found. `/de-DE` without a store is not found.

- A first path segment shaped like `xx-xx` is always read as a locale, so a store key of that shape is reserved.
- Add a message key to **both** `messages/de-DE.json` and `messages/en-US.json` in the same commit; `check-messages` fails otherwise.
- Use `Link`, `redirect`, `useRouter`, `usePathname` from `@/i18n/routing`, never `next/link` or `next/navigation` in locale UI (lint enforces it).
- Prices through `formatMoney(centAmount, currency, locale)`, localized text through `getLocalizedString`, both in `lib/utils.ts`.

## Theming and Contentools

Data flow: `Server Component -> {CONTENTOOLS_ORIGIN}/service/{store}/configuration/theme` (header `x-project-key`, no token) for the theme and `.../published/puck-pages/query` for pages; the browser only talks to the same-origin, read-only `/api/contentools/service/*` proxy.

- Theme: `app/layout.tsx` reads `x-store-key` (set by `proxy.ts` only), `lib/contentools/theme.ts` returns the raw theme, `lib/theme/adapter.ts` (`parseTheme`, `buildThemeCss`) sanitises it and emits `<style id="store-theme">` with `:root:root{...}`. Only variables that differ from `lib/theme/default-theme.json` are emitted, so the default theme gives an empty block. Locked tokens (status, fit, spacing, neutrals) are never emitted. Fonts come from `lib/fonts-registry.ts` only.
- Fallback order: fresh cache (60 s TTL per server instance), last good value, built-in default theme. A missing theme and failures never break the page; failures are not cached. Request timeout 2 s.
- Secondary button variables `--btn-secondary-*` exist only when the theme changes the button style: write `var(--btn-secondary-bg, var(--color-action))`.
- Proxy allow-list: `lib/contentools/proxy-policy.ts` (theme read, published page and content reads, `datasource`, `products/search`, and the two published query POSTs). Everything else answers 404 with no upstream request; cookies and `Authorization` are never forwarded. Add a read route there with a test when a Puck block needs it.
- Puck blocks: `components/contentools/render-config.ts`; renderer wiring is client-only code (`ContentoolsPage`), page JSON is fetched on the server. SSR of the renderer works (see `plans/evidence/H/spike-ssr.md`).
- Dev previews (not in release builds): `/dev/theme/<store>` and `/dev/contentools/<store>`.
- Publishing a theme (developer tool, needs OA-02): `node scripts/contentools-theme.mjs get|put|delete --store <key> [--file x.json]`. `put` and `delete` accept only `default` and `qa-*` stores; QA fixtures are in `scripts/fixtures/themes/`. Never prints a token or secret.

## Deployment

`netlify.toml` is in this directory. In the Netlify UI set **Base directory** to `b2b2c-automotive/storefront`. Node 22.

Shared code with the other app (the portal) is copied, not packaged (no workspace).
