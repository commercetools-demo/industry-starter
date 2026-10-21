<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Malva Coffee rules

Online-only coffee store for the US (`en-US`, USD) and Canada (`en-CA`, CAD). Stack: Next.js 16, React 19, Tailwind v4, next-intl 4, commercetools SDK 8 and ts-client 4.

## Commands

- `npm run dev` starts the app on port 3000.
- `npm run check` runs lint, typecheck and tests (including the version gate and the secret checks). It must pass before every commit.
- `npm run build` must pass before the last task of a workstream. `npm run verify:build` also scans the client bundle for secret values.
- `npm run predeploy` fails while `app/api/health/route.ts` exists.

## Architecture (the BFF chain)

Component, then SWR hook (`hooks/`), then Route Handler (`app/api/...`), then `lib/ct/<namespace>.ts`, then commercetools. A browser never talks to commercetools.

A new commercetools resource adds exactly six files and changes nothing else in the tree:

1. `lib/ct/<namespace>.ts` (server-only calls)
2. `lib/mappers/<namespace>.ts` (SDK type to app type)
3. a type in `lib/types.ts`
4. a Route Handler in `app/api/<namespace>/route.ts`
5. a SWR hook in `hooks/`
6. a cache key in `lib/cache-keys.ts`

## Lint rules that enforce this

- No `lib/ct/*`, `lib/session` or `@commercetools/*` import from a `'use client'` file (the BFF boundary).
- No `@commercetools/*` import outside `lib/ct` and `lib/mappers`; `new ClientBuilder()` only in `lib/ct/client.ts`.
- Locale-aware navigation comes from `@/i18n/routing` (`Link`, `redirect`, `useRouter`, `usePathname`). Never import `next/link`, or `redirect`, `useRouter`, `usePathname` from `next/navigation`, in locale UI (`notFound` is allowed).
- No `any`. No raw hex colours or Tailwind arbitrary hex values in components; use design tokens, no raw fonts.

## Rules

- Version gates: next 16.x (never 15), next-intl 4, platform-sdk 8, ts-client 4, Node 22.
- Use Product Search only (`products().search()`), never `productProjections().search()`.
- Server modules start with `import 'server-only'`.
- Secrets live only in git-ignored `storefront/.env.local`. `.env.example` has names only. Never read credentials from the home directory, never use `NEXT_PUBLIC_` for a secret.
- Strings come from `messages/<locale>.json` through `useTranslations`; both catalogues have identical keys. Markets come from `COUNTRY_CONFIG` in `lib/utils.ts`; the market cookie is `malva-locale`.
- Money is integer minor units, formatted with `formatMoney`.
- Anything only the owner can do or test goes into `plans/TODO-MANUAL-TESTING.md`. Questions go into `plans/QUESTIONS.md` with the default you built to.
- Load the matching `commercetools-*` skill before any commercetools task; do not guess endpoints or update actions.

## Server core API (workstream D)

Import these; do not rewrite them.

- `lib/types.ts`: `Money`, `Price`, `ImageRef`, `AttributeValue`, `Variant`, `RatingStats`, `Product`, `Category`, `LocaleKey`, `ApiErrorBody`. Append, never rename.
- `lib/utils.ts`: `formatMoney(centAmount, currency, locale)`, `roundRating`, `getLocalizedString` (server side only, never in components), `isLocaleKey`, `marketForLocale`, `marketForCountry`, `COUNTRY_CONFIG` (each market has `collection`: true for US, false for Canada).
- `lib/errors.ts`: `AppError`, `ErrorCode`, `SAFE_MESSAGES`, `toAppError`, `errorResponse`. The body is always `{error:{code,message}}`; the UI maps `code` to `errors.<code>`.
- `lib/api.ts`: `handle(route, fn)` wraps every Route Handler; `requireCustomer()` throws 401; `jsonError(code, status)`.
- `lib/session.ts` (server-only): `getSession`, `getMarket`, `createSessionToken`, `verifySessionToken`, `setSessionCookie`, `clearSessionCookie`, `setMarketCookie`, `changeMarket` (resets `cartId`), `ensureAnonymousId`, `sanitizeSession`. Cookie `malva-session`, HS256, 30 days.
- `lib/cache-keys.ts`: `KEY_CART`, `KEY_CART_COUNT`, `KEY_ACCOUNT`, scoped `keyOrders(customerId)` and friends, `TAG`, `TTL`.
- `lib/ct/public-cache.ts`: `cachedPublic(kind, keyParts, fn)`, the only `unstable_cache` call; public data only. `lib/ct/project.ts`: `getMarkets`.
- `lib/ct/retry.ts`: `updateWithRetry(read, write)`, one re-read on a 409, then `conflict`. Use it for every versioned update.
- `lib/ct/image-config.ts`: `cleanImageUrl`, `transformListingImageUrl`, `transformDetailImageUrl`, `transformThumbnailImageUrl`. Also callable from client components. Stored URLs stay clean.
- `lib/mappers/*`: `mapProduct`, `mapVariant`, `mapPrice`, `pickPrice`, `mapAttributes`, `mapRatingStats`, `mapImages`, `mapCategory`, `buildCategoryTree`, `mapMoney`.
- `hooks/fetcher.ts`: `fetchJson`, `jsonFetcher`, `ApiError`. No `fetch('/api/...')` in components.

Route Handler shape:

```ts
export const GET = handle('/api/orders', async () => {
  const session = await requireCustomer();
  const orders = await getCustomerOrders(session.customerId); // one lib/ct call
  return Response.json({ orders });
});
```

To change the session: `setSessionCookie(NextResponse.json(body), await createSessionToken({ ...session, cartId }))`.

New resource checklist (six files): `lib/ct/<namespace>.ts` (starts with `import 'server-only'`), `lib/mappers/<namespace>.ts`, a type in `lib/types.ts`, `app/api/<namespace>/route.ts` using `handle`, an SWR hook in `hooks/`, and a key in `lib/cache-keys.ts`.

`app/api/dev` and `app/api/health` are throwaway routes; `npm run predeploy` fails while they exist.
