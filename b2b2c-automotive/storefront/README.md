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

No commercetools call happens yet; the placeholder home needs no credentials.

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

## Deployment

`netlify.toml` is in this directory. In the Netlify UI set **Base directory** to `b2b2c-automotive/storefront`. Node 22.

Shared code with the other app (the portal) is copied, not packaged (no workspace).
