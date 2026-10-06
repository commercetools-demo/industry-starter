# D — Locale routing and messages

**Specs:** `storefront-locale-routing` (Single country configuration, Locale-prefixed routing, Locale proxy, Locale-aware links and messages; "Atomic market switch" is finished in E)
**Depends on:** A, B · **Unblocks:** G, H, X · **Decisions:** D-002, D-012

## Goal
Every page lives under `/en-US/…` or `/de-DE/…`; the visitor is redirected to the right prefix; translations load per locale.

## Design

### `lib/utils.ts` (no `server-only`; used by client too)
```ts
export type CountryConfig = { locale: string; currency: string; country: string; label: string };
export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States' },
  'de-DE': { locale: 'de-DE', currency: 'EUR', country: 'DE', label: 'Deutschland' },
};
export const DEFAULT_LOCALE: CountryConfig = COUNTRY_CONFIG['en-US'];
export const LOCALE_COOKIE = 'your-shop-country-locale';
export function formatMoney(centAmount: number, currencyCode: string, locale = 'en-US'): string; // Intl.NumberFormat currency, centAmount/100 (fractionDigits 2 only)
export function getLocalizedString(obj: Record<string,string> | undefined, locale: string): string; // locale → language → first value → ''
```
`formatMoney` is the **only** place that divides by 100.

### i18n
- `i18n/routing.ts`: as in the `/nextjs-setup-project` command (`defineRouting` with `locales: Object.keys(COUNTRY_CONFIG)`, `defaultLocale: 'en-US'`, `localePrefix: 'always'`; export `Link, redirect, usePathname, useRouter, getPathname` from `createNavigation`).
- `i18n/request.ts`: `getRequestConfig` — unknown locale → default; messages `await import('../messages/${locale}.json')`.
- `next.config.ts`: wrap with `createNextIntlPlugin('./i18n/request.ts')`.
- `proxy.ts` (Next 16 name; replaces middleware): behavior per spec; matcher `['/((?!api|_next|favicon|.*\\..*).*)', '/']`. Export `proxy(request)` and `config`. **Hand-written — do not use next-intl's `createMiddleware`** (its Accept-Language / `NEXT_LOCALE` detection would override the cookie rule). Redirects use status 307. For every non-redirect response set the request headers `x-next-intl-locale` and `x-pathname` (full pathname) with `NextResponse.next({ request: { headers } })`; server layouts read `x-pathname` (used by O's protected layout).
- `app/[locale]/layout.tsx`: server component; `params` is a Promise (`const { locale } = await params`); `setRequestLocale(locale)`; if locale not in `routing.locales` → `notFound()`; `generateStaticParams` returns both locales; wraps children with `NextIntlClientProvider` (messages from `getMessages()`).
- Root `app/layout.tsx` renders `<html lang={locale}>` (using `getLocale()` from `next-intl/server`), fonts and `<body>` only.
- **Provider order (binding for all later workstreams):** `app/[locale]/layout.tsx` = `NextIntlClientProvider` > `SWRConfig` (fallback seeded in J) > `ToastProvider` (H) > `CartProvider` (J) > chrome (H) > `children`. Server data for the fallback is fetched in this layout.
- Messages: `messages/en-US.json` and `messages/de-DE.json`, top-level namespaces `common, nav, footer, home, plp, pdp, cart, checkout, account, auth, search, static, errors, a11y`. Seed only `common.brand = "MALVA"`, `nav.shop`, `nav.new`, `nav.journal`, `nav.search`, `nav.saved`, `nav.bag`, `nav.account`, `errors.title`. Other workstreams add their keys to **both** files.
- A key-parity test (below) fails if the files differ in keys.

### Test helper
Extend `test/utils.tsx`: `renderWithProviders(ui, { locale = 'en-US' })` wraps in `NextIntlClientProvider locale messages` (import the JSON) plus the SWR provider from A.

## Tasks
- [x] D-01 Write `lib/utils.ts` as designed. Tests: `formatMoney(480, 'USD', 'en-US')` → "$4.80"; `formatMoney(480, 'EUR', 'de-DE')` normalises NBSP and equals "4,80 €"; `getLocalizedString` fallback chain (exact, language-only `en`, first value, undefined → '').
- [x] D-02 Write `i18n/routing.ts`, `i18n/request.ts` and wrap `next.config.ts` with the plugin. Test `routing.locales` equals `['en-US','de-DE']`, default `en-US`.
- [x] D-03 Write `messages/en-US.json` and `messages/de-DE.json` (seed keys above) and `messages/parity.test.ts` asserting identical key sets (deep) in both files.
- [x] D-04 Write `proxy.ts`. Tests (`proxy.test.ts`, node env, build `NextRequest`s): `/` no cookie → 307 to `/en-US`; `/` cookie `de-DE` → `/de-DE`; `/de-DE/shop` passes through with headers `x-next-intl-locale: de-DE` and `x-pathname: /de-DE/shop`; `/api/cart`, `/_next/x`, `/logo.png` untouched; `/xx-YY/page` → redirected to `/en-US/xx-YY/page` (treated as unprefixed path).
- [x] D-05 Add `app/[locale]/layout.tsx`, `app/[locale]/page.tsx` (renders `t('common.brand')`) and update root `layout.tsx` to set `<html lang>`. Tests: layout with locale `de-DE` provides German message; invalid locale calls `notFound` (mock `next/navigation`).
- [x] D-06 Extend `test/utils.tsx` with the intl provider. Add a sample test using `Link` from `@/i18n/routing` rendering `/de-DE/…` when locale is `de-DE` (use `createNavigation`'s `getPathname` to assert).
- [x] D-07 Report M-D-1…M-D-3.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Add a market | D-02/D-03 (config drives routing; parity test) |
| Unsupported locale | D-04, D-05 |
| First visit / Returning visitor | D-04 |
| Link preserves locale | D-06 |
| Atomic market switch | **E** |

## Manual tests to report
- M-D-1: Open `http://localhost:3000/` → lands on `/en-US`. Open `/de-DE` → German title/language attribute `de-DE`.
- M-D-2: Set cookie `your-shop-country-locale=de-DE`, open `/` → `/de-DE`.
- M-D-3: Visit `/fr-FR/x` → redirected under `/en-US/…` and shows a 404 (the localized not-found page arrives in I).

## Definition of done
Both locales route; parity test green; `formatMoney` is the only `/100`; `verify` passes.
