## 1. Prerequisites

- [ ] 1.1 Confirm commercetools project, region and a Frontend B2C API client (scopes include `manage_sessions`, `manage_orders`)
- [ ] 1.2 Confirm initial locales and currencies, deployment target, and test stack (see design Open Questions)
- [ ] 1.3 Create `.env.example` and add `.env*` to `.gitignore`

## 2. Scaffold

- [ ] 2.1 Run `/nextjs-setup-project` (or equivalent steps) to create `site/` with `create-next-app@^16`, TypeScript, App Router, ESLint, `@/*` alias, no Tailwind flag
- [ ] 2.2 Install `@commercetools/platform-sdk@^8`, `@commercetools/ts-client@^4`, `next-intl@^4`, `swr`, `jose`, `tailwindcss`, `@tailwindcss/postcss`, `postcss`
- [ ] 2.3 Verify `next` > 16.0.0 and `next-intl` 4.x with `npm list --depth=0`
- [ ] 2.4 Create the directory structure from `storefront-project-structure`

## 3. Styling foundation

- [ ] 3.1 Add `postcss.config.mjs` and `globals.css` with `@import 'tailwindcss'` and the column-span safelist
- [ ] 3.2 Map Organic tokens into `@theme`/`:root`; remove the scaffold cream/terra/Inter palette
- [ ] 3.3 Self-host Caprasimo and Figtree and expose `--font-heading` / `--font-body`
- [ ] 3.4 Configure `next.config.ts` with `createNextIntlPlugin` and `images.unoptimized: true`

## 4. Locale routing

- [ ] 4.1 Write `COUNTRY_CONFIG`, `DEFAULT_LOCALE`, `formatMoney`, `getLocalizedString` in `lib/utils.ts`
- [ ] 4.2 Write `i18n/routing.ts`, `i18n/request.ts`, seed `messages/<locale>.json`
- [ ] 4.3 Write `proxy.ts` with the documented matcher and cookie redirect
- [ ] 4.4 Add `app/[locale]/layout.tsx` with `NextIntlClientProvider` and `<html lang>`

## 5. BFF and session

- [ ] 5.1 Write `lib/ct/client.ts` singleton from env
- [ ] 5.2 Write `lib/session.ts` (jose, 30-day cookie) with production secret guard
- [ ] 5.3 Add `app/api/health/route.ts` and verify `{"ok":true}`
- [ ] 5.4 Write `lib/types.ts`, `lib/mappers/`, `lib/cache-keys.ts`
- [ ] 5.5 Implement `lib/ct/auth.ts` and `app/api/auth/*` with login via `apiRoot.login().post()` and anonymous cart merge
- [ ] 5.6 Implement `lib/ct/cart.ts`, `app/api/cart/*`, SWR cart hook, `CartProvider`, 409 retry
- [ ] 5.7 Seed `SWRConfig fallback` in the root layout

## 6. Data loading

- [ ] 6.1 Implement `lib/ct/categories.ts` and `lib/ct/search.ts` using Product Search API
- [ ] 6.2 Wrap category tree, project locale validation and shipping methods in `unstable_cache` with the documented TTLs
- [ ] 6.3 Add React `cache()` dedup for metadata + page fetches

## 7. Quality and delivery

- [ ] 7.1 Add lint rules for client→`lib/ct` imports, SDK types in components, extra `ClientBuilder`, `redirect` in `try/catch`
- [ ] 7.2 Add env validation and a CI check rejecting `NEXT_PUBLIC_` secrets
- [ ] 7.3 Add `error.tsx`, `not-found.tsx`, `global-error.tsx` per locale
- [ ] 7.4 Add CI workflow: install, lint, typecheck, build
- [ ] 7.5 Add `vercel.json` and `netlify.toml`; document removal of `/api/health` before deploy
- [ ] 7.6 Track SDK major upgrade (platform-sdk 9 / ts-client 5) as a separate verified task

## 8. Handoff

- [ ] 8.1 Update `malva-storefront-design` tasks 1.2, 2.1 and 3.x to reference this change
- [ ] 8.2 Write `site/README.md` with run, env and structure instructions
