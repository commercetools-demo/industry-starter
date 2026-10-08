# Malva Healthcare storefront

Next.js 16 (App Router) + React 19 + Tailwind v4 + next-intl, backed by commercetools. Route Handlers under `app/api/` are the BFF.

## Run

```bash
npm ci
cp .env.example .env.local   # fill in values; never commit this file
PORT=3000 npm run dev
```

## Environment

All variables are listed, without values, in `.env.example`. They are server-only: none may carry a `NEXT_PUBLIC_` prefix. Seed scripts use `.env.seed.example` (copy to `.env.seed.local`).

## Quality gate

`npm run check` runs type-check, lint, the version gate, the token parity check and the unit tests. `npm run verify:build` runs the gate and then `npm run build`. A commit must pass the gate.

## Locale routing and navigation

- Every page lives under `/<locale>/...` (`localePrefix: 'always'`); `proxy.ts` redirects unprefixed or unsupported prefixes. Supported regions are the keys of `COUNTRY_CONFIG` in `lib/utils.ts`, the only place country, currency and language are written.
- Import `Link`, `redirect`, `usePathname`, `useRouter` and `getPathname` from `@/i18n/routing`. Lint fails on `next/link` and on anything but `notFound` from `next/navigation` in locale UI. There is no codemod: fix a flagged import by hand by changing the module path (the names are identical).
- Strings come from `messages/en-US.json` (`useTranslations` / `getTranslations`). A missing key is logged in development and shows default-locale text in production.
- `<html lang>` is set in `app/layout.tsx` from the active locale.

## Server versus client (rule stub)

- `lib/ct/**` and `lib/session.ts` are server-only (`import 'server-only'`); components, hooks and context never import them, only types from `lib/types.ts`.
- Client code talks to the BFF over `fetch('/api/...')` through hooks.
- Never put secrets or health data in URLs, logs or client bundles.
