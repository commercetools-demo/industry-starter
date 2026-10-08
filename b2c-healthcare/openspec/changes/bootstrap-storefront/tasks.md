## 1. Project scaffold

- [ ] 1.1 Run `/nextjs-setup-project` into `b2c-healthcare/site/` (`create-next-app@^16 --app --typescript --tailwind=false`, then Tailwind v4, next-intl v4, swr, jose) and confirm versions meet the gate [SKILL: commercetools-storefront]
- [ ] 1.2 Add `server-only` and the commercetools packages `@commercetools/platform-sdk@^8`, `@commercetools/ts-client@^4`; commit `package-lock.json` [SKILL: commercetools-platform]
- [ ] 1.3 Create the directory layout from `design.md`; keep unused `app/api/*` folders out until their changes land
- [ ] 1.4 `.gitignore` (`.env*`, `.next/`), `.env.example` with all `CTP_*` and `SESSION_SECRET` names and scope rationale, README for `site/`
- [ ] 1.5 `npm run check` = `tsc --noEmit` + lint + version gate + unit tests; build fails on type errors
- [ ] 1.6 Lint rules: no `lib/ct`/`lib/session` import from client code, no `@commercetools/platform-sdk` outside `lib/ct` and `lib/mappers`, no `next/link` in locale UI, no raw `fetch` to commercetools or to `/api` in components

## 2. commercetools client and session

- [ ] 2.1 `lib/ct/client.ts`: `apiRoot` singleton with env validation that names the missing variable [SKILL: commercetools-platform]
- [ ] 2.2 Create the Frontend API client in the Merchant Center (B2C template + `manage_sessions`, `manage_orders`); record scope justification in `.env.example` [SKILL: commercetools-platform]
- [ ] 2.3 `lib/session.ts`: jose HS256 token, ids + locale only, `Secure` outside dev, hard failure on short/missing secret; unit tests for tamper, expiry, no-fallback [SKILL: commercetools-storefront]
- [ ] 2.4 `lib/types.ts`, `lib/mappers/` skeleton, `lib/utils.ts` (`getLocalizedString`, `formatMoney`) with tests
- [ ] 2.5 Route Handler template and a test helper asserting 401 without session and sanitized errors [SKILL: commercetools-storefront]
- [ ] 2.6 `app/api/health/route.ts` returning project key, 404 in production; verify with `curl` against the dev project [SKILL: commercetools-platform]

## 3. Locale routing

- [ ] 3.1 `COUNTRY_CONFIG` with `en-US` and `DEFAULT_LOCALE`; `lib/ct/locale-validation.ts` with `unstable_cache` (300 s) [SKILL: commercetools-storefront]
- [ ] 3.2 `i18n/routing.ts`, `i18n/request.ts`, `messages/en-US.json`, `next.config.ts` plugin plus `images.unoptimized` and remote patterns
- [ ] 3.3 `proxy.ts` with matcher `['/((?!api|_next|favicon|.*\\..*).*)', '/']`; tests for unprefixed, excluded and unsupported-locale paths
- [ ] 3.4 Atomic locale write helper (all three fields, reset `cartId` on currency change) with tests; leave region-switch UI to `switching-region-or-language`

## 4. Data loading

- [ ] 4.1 `lib/cache-keys.ts` (`KEY_CART`, `KEY_ACCOUNT`) and root layout `SWRConfig` fallback from session; stale-cart tolerance [SKILL: commercetools-storefront]
- [ ] 4.2 Placeholder `hooks/` for cart and account (no commercetools calls until their changes), sign-out clears both keys
- [ ] 4.3 Document the server-vs-client rule and the cache TTL table in `site/README.md`

## 5. Design hooks and smoke test

- [ ] 5.1 `app/globals.css` with `@import 'tailwindcss'` and placeholders for the token block and `@theme` that `design-system-tokens` fills; `next/font` slots in the root layout
- [ ] 5.2 Wire the token parity check and design lint into `npm run check` (implementation lives in `design-system-tokens` tasks)
- [ ] 5.3 `/[locale]` placeholder page, `error.tsx`, `not-found.tsx` shells; verify in a browser at `/en-US` with no console errors
- [ ] 5.4 Dry run: clean clone → `npm ci` → `npm run check` → `npm run build`
