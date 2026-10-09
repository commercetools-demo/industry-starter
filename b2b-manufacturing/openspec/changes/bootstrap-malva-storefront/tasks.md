## 1. Project scaffold

- [ ] 1.1 Run `/nextjs-setup-project` into `b2b-manufacturing/site/` (`create-next-app@^16 --app --typescript --tailwind=false`, then Tailwind v4, next-intl v4, swr, jose) and confirm versions meet the gate [SKILL: commercetools-storefront]
- [ ] 1.2 Add `server-only`, `@commercetools/platform-sdk@^8` and `@commercetools/ts-client@^4`; commit `package-lock.json` [SKILL: commercetools-platform]
- [ ] 1.3 Create the layout from `design.md`; `components/service/` instead of `components/product/`; no empty `app/api/*` folders
- [ ] 1.4 `.gitignore` (`.env*`, `.next/`), `.env.example` with `CTP_*`, `CTP_DEFAULT_STORE_KEY`, `SESSION_SECRET` and scope rationale, `site/README.md`
- [ ] 1.5 `npm run check` = `tsc --noEmit` + lint + version gate + unit tests; the build fails on type errors
- [ ] 1.6 Lint rules: no `lib/ct`/`lib/session` import from client code, no platform SDK outside `lib/ct` and `lib/mappers`, no `next/link` or `next/navigation` redirects in locale UI, no raw `fetch` to commercetools or to `/api` inside components

## 2. commercetools client, session and B2B context

- [ ] 2.1 In the dev project: create the Store `malva-web` and a ProductSelection with all services, enable product search indexing, record project key and region [SKILL: commercetools-platform]
- [ ] 2.2 Create the Frontend API client with the B2B template scopes; verify whether it can create Business Units and associates, otherwise add the second narrowly scoped server-only client; record every extra scope in `.env.example` [SKILL: commercetools-platform]
- [ ] 2.3 `lib/ct/client.ts`: `apiRoot` singleton with env validation that names the missing variable [SKILL: commercetools-platform]
- [ ] 2.4 `lib/session.ts`: jose HS256 token with the Session fields from `malva-bff-and-session`, `Secure` outside dev, hard failure on short or missing secret, no fallback key; unit tests for tamper, expiry and missing secret [SKILL: commercetools-storefront]
- [ ] 2.5 `lib/ct/stores.ts` `getStoreChannelData` with instance cache and no failure caching; default-store session initialisation; atomic business-context write [SKILL: commercetools-storefront]
- [ ] 2.6 Business Unit discovery after sign-in (`getBusinessUnitsForAssociate`) and `POST /api/business-units/select` skeleton; tests for no BU and several BUs [SKILL: commercetools-storefront]
- [ ] 2.7 `lib/types.ts`, `lib/mappers/` skeleton, `lib/utils.ts` (`COUNTRY_CONFIG`, `getLocalizedString`, `formatMoney`) with tests
- [ ] 2.8 Route Handler template and a test helper asserting 401 without session, 400 without Business Unit and sanitized errors [SKILL: commercetools-storefront]
- [ ] 2.9 `app/api/health/route.ts` returning the project key and reporting missing search indexing; 404 in production; verify with `curl` against the dev project [SKILL: commercetools-platform]

## 3. Locale routing

- [ ] 3.1 `COUNTRY_CONFIG` with `en-US` and `DEFAULT_LOCALE`; `lib/ct/locale-validation.ts` with `unstable_cache` (300 s) [SKILL: commercetools-storefront]
- [ ] 3.2 `i18n/routing.ts`, `i18n/request.ts`, `messages/en-US.json`, `next.config.ts` with the next-intl plugin, `images.unoptimized` and remote patterns
- [ ] 3.3 `proxy.ts` with matcher `['/((?!api|_next|favicon|.*\\..*).*)', '/']`; tests for unprefixed, excluded and unsupported-locale paths
- [ ] 3.4 Atomic locale write helper that resets `cartId` on currency change, with tests

## 4. Data loading

- [ ] 4.1 `lib/cache-keys.ts` (`KEY_CART`, `KEY_ACCOUNT`, `KEY_BUSINESS_UNITS`); root and locale layouts that do **not** read the session; `SWRConfig` provider without a session fallback [SKILL: commercetools-storefront]
- [ ] 4.2 Placeholder `hooks/` for quote list, account and business units (no commercetools calls until their changes); sign-out clears all three keys; reserved-space nav slots for count and sign-in state
- [ ] 4.3 React `cache()`-wrapped fetch helper pattern and an `unstable_cache` example with the TTL table; `Cache-Control: no-store` on API responses and portal layout
- [ ] 4.4 A build check that fails when a public route is dynamic (for example by asserting the route table of `next build`) [SKILL: commercetools-storefront]
- [ ] 4.5 Document the server-vs-client rule, TTLs and the root-layout deviation in `site/README.md`

## 5. Design hooks and smoke test

- [ ] 5.1 `app/globals.css` with `@import 'tailwindcss'`, the token block and `@theme` from `design/malva/source/colors_and_type.css`
- [ ] 5.2 Self-host Inter 18pt and 28pt (fetch the TTFs; they were not imported) and wire `@font-face` or `next/font/local` in the root layout
- [ ] 5.3 `/[locale]` placeholder page, `error.tsx`, `not-found.tsx` shells; verify in a browser at `/en-US` with no console errors
- [ ] 5.4 Dry run: clean clone, `npm ci`, `npm run check`, `npm run build`, and the route table shows the placeholder page as static
