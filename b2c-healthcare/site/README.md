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

## Route Handler template (BFF)

Every handler under `app/api/` does three things: validate the session, call **one** function in `lib/ct/<namespace>.ts`, return JSON. No `apiRoot` or SDK import in the handler.

```ts
import { handle, requireCustomer } from '@/lib/api';
import { getOrders } from '@/lib/ct/orders';

export async function GET() {
  return handle(async () => {
    const { customerId } = await requireCustomer(); // 401 { error } before any commercetools call
    return getOrders(customerId);
  });
}
```

- `handle(fn)` returns the value as JSON and maps any thrown error to a safe `{ error }` (never the raw SDK error, request body or credentials). Throw `new ApiError(status, 'safe message')` for your own errors.
- Public endpoints (catalog) skip `requireCustomer()`.
- Tests: mock `@/lib/session` and `@/lib/ct/*`; use `expectUnauthenticated(handler, [ctMock])` and `expectSanitizedError(handler, ['secret text'])` from `@/test/api`. Session/JWT tests need `// @vitest-environment node` (jose does not accept jsdom `Uint8Array`).
- Session cookie: `malva_session` (HTTP-only, SameSite=Lax, 30 days) holds `customerId`, `cartId`, `country`, `currency`, `locale` only; use the helpers in `lib/session.ts` (`getSession`, `updateSession`, `setCustomer`, `setCart`, `clearCustomer`, `clearCart`, `setLocale`).

## Data loading: Server/Client boundary and cache TTLs

| Data | Where it loads | Cache |
| --- | --- | --- |
| Catalog (listing, detail, search results) | Server Component calls `lib/ct/*` directly; independent calls in `Promise.all` | none (prices depend on currency/country); per-request `cache()` via `getProductByKeyCached`, shared by `generateMetadata` and the page |
| Cart, account, orders, appointments, labs | `'use client'` SWR hook (`hooks/`) to Route Handler to `lib/ct/*` | none, never `unstable_cache` |
| First paint of cart and user | root layout seeds `SWRConfig fallback` (`KEY_CART`, `KEY_ACCOUNT`) from the session; a stale `cartId` is cleared and tolerated | none |

`unstable_cache` is for public data identical for every visitor only:

| Function | TTL |
| --- | --- |
| `getProjectSettings` (`lib/ct/project.ts`; also drives `getValidCountryConfig`) | 300 s |
| `getCategoryTree` (`lib/ct/categories.ts`) | 60 s |
| `getShippingMethods` (`lib/ct/shipping.ts`) | 60 s |

Never cache prices, carts, accounts, orders, availability or anything that receives `customerId`, `cartId` or a session (a test scans `lib/ct/*`).

Rules:
- Pass only serializable props from Server to Client Components; put handlers in a `'use client'` child.
- Client code uses hooks and the path constants in `lib/api-paths.ts` (a literal `fetch('/api/...')` fails lint). SWR keys live in `lib/cache-keys.ts`.
- `redirect()` and `notFound()` stay outside `try/catch` (or the catch calls `unstable_rethrow`); a test scans for it.
- Cart mutations run in `withCartRetry(fn)` (`lib/api-retry.ts`): `fn` refetches the cart itself, a 409 retries once.
- Sign-out calls `useClearPatientState()` (`hooks/sign-out.ts`), which writes `null` to both keys (SWR would otherwise fall back to the layout fallback).
- Region switching is atomic: `POST /api/locale { locale }` writes locale, country and currency from `COUNTRY_CONFIG` and clears `cartId` on a currency change.
- Search uses `searchProducts` (`lib/ct/search.ts`, Product Search API).
