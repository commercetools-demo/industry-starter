<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream C: Locale routing and messages (de-DE, en-US)

**Depends on:** A.
**Parallel with:** B, D. B owns `app/layout.tsx` font/theme wiring; C edits that file only for the `lang` attribute (task C-07).
**Owner prerequisites:** none. No commercetools call.
**Branch:** `ws/c-locale-routing-and-messages`. Commit per task: `ws-C: C-03 <summary>`.
**Skills:** `commercetools-storefront` (Next.js adapter: `project-layout.md`, `concept-mapping.md`; `references/core/add-country.md` for `COUNTRY_CONFIG`). No commercetools API is called, so no `[SKILL:]` tags.

## 1. Goal

Both apps (`storefront/`, `portal/`) serve exactly two locales, `de-DE` (default) and `en-US`, always prefixed in the URL, with one `COUNTRY_CONFIG`, one navigation module, two message catalogs with identical keys, and a proxy that redirects bare paths using the `your-shop-country-locale` cookie. Unsupported locales are 404. Helper functions `formatMoney` and `getLocalizedString` exist and are tested (G and later workstreams import them).

## 2. Specs and requirement ids implemented

`b2b2c-automotive/openspec/specs/consumer-storefront/bootstrap-and-structure/spec.md`
- **Locale routing for two locales**: scenarios `Bare path`, `Unsupported locale`.
- **Directory structure**: files `i18n/{routing.ts,request.ts}`, `messages/{de-DE,en-US}.json`, `proxy.ts` (locale part), `lib/utils.ts` (`COUNTRY_CONFIG`, `formatMoney`, `getLocalizedString`), `app/[locale]/{layout.tsx,error.tsx,not-found.tsx}`.
- **Gates and tests**: the real `check-messages`.
- The scenario **No store segment** (`/de-DE` is the not-found page) is implemented here as the `[locale]/page.tsx` of the storefront; store resolution itself is G.

`b2b2c-automotive/openspec/specs/seller-portal/bootstrap-and-structure/spec.md`
- **Locale routing for two locales**: scenario `Bare path` (the locale half: `/` goes to `/de-DE`; the redirect on to sign-in is added by workstream R).
- **Directory structure** (same files).

## 3. Design decisions already taken

| Decision | Source |
| --- | --- |
| Exactly `de-DE` (default; EUR, DE) and `en-US` (USD, US) | both bootstrap specs "Locale routing for two locales"; `design.md` section 8 question K ("Locales are decided") |
| next-intl v4, `localePrefix: 'always'` | same |
| `COUNTRY_CONFIG` keyed by BCP-47 locale, currency and country alongside | same; skill `references/core/add-country.md` |
| `Link`, `redirect`, `useRouter`, `usePathname` only from `@/i18n/routing` | same; lint rule from A-07 |
| Choice kept in cookie `your-shop-country-locale` (value is the BCP-47 locale) | storefront spec |
| Catalogs `messages/de-DE.json`, `messages/en-US.json`; `check-messages` fails on key mismatch | storefront spec scenario "Unsupported locale" |
| `/fr-FR/{store}` is not found | storefront spec scenario "Unsupported locale" |
| `/de-DE` with no store is the not-found page (no dealer locator) | storefront spec scenario "No store segment" |
| Prices are always `formatMoney` from `centAmount`, text always `getLocalizedString` | skill anti-pattern table; `design.md` decision 7 (currency from configuration) |

Defaults chosen by this plan (the specs are silent):
1. **No Accept-Language detection.** Bare path: cookie if it holds a supported locale, otherwise `de-DE`. So `localeDetection: false` in `defineRouting` and our own redirect logic (next-intl's detection would pick `en-US` from a browser header, contradicting the scenario).
2. Locale-shaped first segment = `^[a-z]{2}-[a-z]{2}$` (case-insensitive). A supported locale in the wrong case (`/de-de/x`) redirects to the canonical case; an unsupported one (`/fr-FR/x`) passes through untouched so `app/[locale]/layout.tsx` can call `notFound()`. A store key shaped like `xx-xx` is therefore reserved; document it in the storefront README.
3. The proxy writes the cookie when a prefixed path has a locale different from the cookie (max-age one year, `path=/`, `SameSite=Lax`, not HttpOnly). G's `/api/locale` route also updates the session triple.
4. `proxy.ts` skips `/api`, `/_next`, any path with a file extension, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`, and `/dev` when `NODE_ENV !== 'production'` (B's specimen pages).
5. `<html lang>` comes from the request header `x-next-intl-locale` set by the proxy (fallback `de-DE`), so the root layout stays the single `<html>` owner.
6. `en-US` uses USD and country US exactly as the skill's flat config implies (question Q-C01 asks the owner to confirm; it blocks the seed prices only, not this build).

## 4. Tasks

### C-01 Constants and `lib/utils.ts` [SPEC: Locale routing for two locales]
Create `i18n/config.ts` (pure, no Next imports):
```ts
export const LOCALES = ['de-DE', 'en-US'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE_KEY: AppLocale = 'de-DE';
export const LOCALE_COOKIE = 'your-shop-country-locale';
export const isAppLocale = (v: unknown): v is AppLocale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
```
`lib/utils.ts` (same file in both apps, copied):
```ts
export interface CountryConfig { locale: AppLocale; currency: 'EUR' | 'USD'; country: 'DE' | 'US'; label: string; }
export const COUNTRY_CONFIG: Record<AppLocale, CountryConfig> = {
  'de-DE': { locale: 'de-DE', currency: 'EUR', country: 'DE', label: 'Deutschland' },
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States' },
};
export const DEFAULT_LOCALE = COUNTRY_CONFIG[DEFAULT_LOCALE_KEY];
export function formatMoney(centAmount: number, currencyCode: string, locale: string, fractionDigits?: number): string;
export function getLocalizedString(value: Record<string, string> | null | undefined, locale: string): string;
```
`formatMoney`: build `Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })`, take `resolvedOptions().maximumFractionDigits` (or `fractionDigits` for high-precision prices), divide `centAmount` by `10 ** digits`. Never `toFixed`. `getLocalizedString` order: exact key, then same language (`de` for `de-DE`, any `de-*`), then `de-DE`, then `en-US`, then the first value, then `''`. Never throws on `null`.
Tests first (`lib/utils.test.ts`): `COUNTRY_CONFIG has exactly the two locales`, `de-DE is EUR and DE`, `en-US is USD and US`, `formatMoney de-DE EUR` (`formatMoney(1999,'EUR','de-DE')` contains `19,99` and `€`), `formatMoney en-US USD` (`$19.99`), `formatMoney zero-decimal currency` (`formatMoney(1500,'JPY','de-DE')` contains `1.500`), `formatMoney high precision` (`formatMoney(123456,'EUR','de-DE',4)` contains `12,3456`), `getLocalizedString exact`, `getLocalizedString language match` (`{ de: 'Hallo' }` for `de-DE`), `getLocalizedString falls back to de-DE then en-US then first`, `getLocalizedString null returns empty string`.

### C-02 Routing module [SPEC: Locale routing for two locales]
`i18n/routing.ts`:
```ts
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { LOCALES, DEFAULT_LOCALE_KEY, LOCALE_COOKIE } from './config';
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE_KEY,
  localePrefix: 'always',
  localeDetection: false,
  localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' },
});
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```
`i18n/request.ts`:
```ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
```
`next.config.ts`: wrap the config with `createNextIntlPlugin('./i18n/request.ts')` (keep `images.unoptimized` out; the project sets image config in its own workstream). Tests (`i18n/routing.test.ts`): `Routing has two locales and always-prefix`, `Locale detection is off`, `Cookie name is your-shop-country-locale`.

### C-03 Message catalogs and the real `check-messages` [SPEC: Unsupported locale (catalogs half), Gates and tests]
1. `messages/de-DE.json` and `messages/en-US.json`, same keys, minimal and real (German first):
```json
{
  "common": {
    "appName": "Malva",
    "placeholder": "Hier entsteht der Shop {store}.",
    "loading": "Wird geladen",
    "tryAgain": "Erneut versuchen",
    "backHome": "Zur Startseite"
  },
  "errors": {
    "genericTitle": "Etwas ist schiefgelaufen",
    "genericBody": "Bitte versuchen Sie es erneut.",
    "notFoundTitle": "Seite nicht gefunden",
    "notFoundBody": "Diese Adresse gibt es nicht."
  }
}
```
English: "The {store} shop is being built here.", "Loading", "Try again", "Back to home", "Something went wrong", "Please try again.", "Page not found", "This address does not exist." Portal `common.placeholder` is "Partner-Portal" / "Partner portal" without `{store}`; the portal catalogs are separate files with the same rule. Other workstreams only add keys (to both files in the same commit).
2. Replace the pass-through `scripts/check-messages.mjs` with a port of `b2b-manufacturing/site/scripts/check-messages.mjs` (read it): `flatten`, `usedKeys`, `checkMessages(root)`. Rules: both `de-DE.json` and `en-US.json` exist and **no other file** in `messages/`; identical flat key sets (report `missing in en-US: a.b`); every `t('ns.key')` used in `app/`, `components/`, `lib/` (declared with `useTranslations('ns')` or `getTranslations({ namespace: 'ns' })`) exists in `en-US.json`; no empty string values; the set of ICU placeholders (`{store}`, `{count}`) is identical for a key in both catalogs.
3. Tests (`scripts/check-messages.test.mjs`): `Catalogs with different keys fail`, `Third catalog fails`, `Used key missing in catalog fails`, `Empty value fails`, `Placeholder mismatch fails`, `Namespace translators are resolved`, `Passes on the real catalogs`.

### C-04 Proxy (locale half) [SPEC: Bare path, Unsupported locale]
`lib/locale-redirect.ts` (pure, testable, no Next imports) exports:
```ts
export type LocaleDecision =
  | { kind: 'skip' }
  | { kind: 'redirect'; location: string }          // 307
  | { kind: 'pass'; locale: AppLocale; setCookie: boolean }
  | { kind: 'passUnsupported' };                    // the layout will 404
export function decideLocale(input: { pathname: string; search: string; cookieLocale?: string; nodeEnv: string }): LocaleDecision;
```
Rules in order: skip list (default 4); first segment matches `^[a-z]{2}-[a-z]{2}$`i: exact supported -> `pass` with `setCookie` when it differs from the cookie, supported in wrong case -> `redirect` to canonical case keeping the rest and the query, unsupported -> `passUnsupported`; otherwise `redirect` to `/${cookieLocaleIfSupported ?? 'de-DE'}${pathname === '/' ? '' : pathname}${search}`.
`proxy.ts` (Next 16 file name; export `proxy` and `config.matcher = ['/((?!_next|api|.*\\..*).*)', '/']`) turns the decision into `NextResponse.redirect` / `NextResponse.next({ request: { headers } })` with header `x-next-intl-locale: <locale>`, and the cookie via `response.cookies.set(LOCALE_COOKIE, locale, { maxAge, path: '/', sameSite: 'lax' })`.
Tests first. `lib/locale-redirect.test.ts`: `Bare path without cookie`, `Bare path with en-US cookie`, `Bare path with an unsupported cookie value`, `Bare path keeps the query string`, `Path without locale is prefixed` (`/hartmann` to `/de-DE/hartmann`), `Wrong case is canonicalised`, `Unsupported locale passes through`, `Prefixed path with a different cookie asks to set the cookie`, `API and static paths are skipped`, `Dev path is skipped outside production`, `Dev path is not skipped in production`. `proxy.test.ts` (use `new NextRequest(url)` and `makeRequest` from A-09): `Bare path redirects to /de-DE`, `Cookie en-US redirects to /en-US`, `Prefixed path sets x-next-intl-locale`, `Prefixed path updates the cookie`.
Portal `proxy.test.ts` uses the same expectations; add a comment in `proxy.ts`: `// R adds the authenticated redirect to sign-in after the locale step.`

### C-05 Layouts, pages, not-found and error [SPEC: Directory structure; Unsupported locale; No store segment]
Both apps:
- `app/[locale]/layout.tsx`: `generateStaticParams` returns `routing.locales.map((locale) => ({ locale }))`; `export default async function LocaleLayout({ children, params })`: `const { locale } = await params; if (!hasLocale(routing.locales, locale)) notFound(); setRequestLocale(locale);` return `<NextIntlClientProvider>{children}</NextIntlClientProvider>` (messages come from `getMessages()`).
- `app/[locale]/error.tsx` (`'use client'`, `useTranslations('errors')`, button `common.tryAgain` calling `reset`), `app/[locale]/not-found.tsx` (translated title and body with a `Link` to `/`), `app/not-found.tsx` (root fallback for unsupported locales, static German and English text without next-intl: "Seite nicht gefunden / Page not found"), `app/global-error.tsx` (static, minimal, `'use client'`).
- Storefront: `app/[locale]/page.tsx` calls `notFound()` (no store segment). `app/[locale]/[store]/page.tsx` shows `t('common.placeholder', { store })` inside `<main>`; G's store resolution and I's shell replace it later.
- Portal: `app/[locale]/page.tsx` shows `t('common.placeholder')` inside `<main>`.
Tests (`app/[locale]/layout.test.tsx` etc., render with `renderWithProviders`): `Unsupported locale is not found` (call the layout with `locale: 'fr-FR'`, expect `notFound` thrown: mock `next/navigation`), `Supported locale renders children`, `No store segment is not found` (storefront), `Placeholder renders in German and English`, `Error boundary offers retry` (click calls `reset`), `Not-found page has a link home`.

### C-06 Skip `/dev` and cookie sync verified with B
Confirm `/dev/tokens` (B-06) still loads when `NODE_ENV=development` (no redirect to `/de-DE/dev/tokens`). If B is not merged yet, make this a note in the PR and tick when B lands.

### C-07 Root layout `lang` [SPEC: Locale routing for two locales]
In `app/layout.tsx` (A/B file): `import { headers } from 'next/headers'`; `const locale = (await headers()).get('x-next-intl-locale'); <html lang={isAppLocale(locale) ? locale : DEFAULT_LOCALE_KEY} ...>` (layout becomes `async`). Test: `Root layout sets lang from the proxy header`.

### C-08 Documentation
`storefront/README.md` and `portal/README.md`: locales section (two locales, the reserved `xx-xx` store-key shape, how to add a message key to both catalogs, never `next/link`). Run `npm run check && npm run verify:build` in both apps.

## 5. Test-first scenarios (unit and component tests)

| Test name | File | Spec scenario |
| --- | --- | --- |
| `Bare path without cookie`, `Bare path with en-US cookie`, `Bare path redirects to /de-DE`, `Cookie en-US redirects to /en-US` | `lib/locale-redirect.test.ts`, `proxy.test.ts` | Bare path (both specs, locale half) |
| `Unsupported locale passes through`, `Unsupported locale is not found`, `Third catalog fails`, `Catalogs with different keys fail` | proxy, layout and check-messages tests | Unsupported locale |
| `No store segment is not found` | `app/[locale]/page.test.tsx` (storefront) | No store segment |
| `COUNTRY_CONFIG has exactly the two locales`, `en-US is USD and US`, ... | `lib/utils.test.ts` | Locale routing for two locales |
| `Routing has two locales and always-prefix`, `Cookie name is your-shop-country-locale` | `i18n/routing.test.ts` | Locale routing for two locales |
| `Used key missing in catalog fails`, `Placeholder mismatch fails` | `scripts/check-messages.test.mjs` | Gates and tests |

Portal-only scenarios from its spec that are not here: sign-in redirect after `/de-DE` (R).

## 6. Browser verification recipe (Chrome DevTools MCP, run by Claude)

Terminal first (Bash, `npm run dev` running on 3000, portal on 3001): `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/` expects `307 http://localhost:3000/de-DE`; with `-H 'Cookie: your-shop-country-locale=en-US'` expects `.../en-US`; `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/fr-FR/hartmann` expects `404`; `/de-DE` expects `404`; `/de-DE/hartmann` expects `200`. Save the output to `plans/evidence/C/curl-storefront.txt` and `curl-portal.txt` (portal: `/` 307 to `/de-DE`, `/de-DE` 200, `/fr-FR` 404).

Chrome, storefront:
1. `navigate_page` `http://localhost:3000/` -> final URL `/de-DE`, which is the not-found page (German "Seite nicht gefunden"). Screenshot `plans/evidence/C/storefront-bare-notfound.png`.
2. `navigate_page` `http://localhost:3000/de-DE/hartmann`: German placeholder text, `document.documentElement.lang === 'de-DE'`. `evaluate_script` `document.cookie` contains `your-shop-country-locale=de-DE`. Screenshot `storefront-de.png`.
3. `navigate_page` `http://localhost:3000/en-US/hartmann`: English text, `lang === 'en-US'`, cookie now `en-US`. Screenshot `storefront-en.png`.
4. `navigate_page` `http://localhost:3000/`: lands on `/en-US` (cookie respected, not-found page in English). Screenshot `storefront-cookie-redirect.png`.
5. `navigate_page` `http://localhost:3000/fr-FR/hartmann`: not-found page; `list_network_requests` shows document status 404.
6. `list_console_messages`: no errors on any page.
Chrome, portal: `http://localhost:3001/` -> `/de-DE` German placeholder; `/en-US` English; `/fr-FR` 404; screenshots `portal-de.png`, `portal-en.png`.

## 7. Project-data checks (MCP `b2b2c-automotive`)
None. Locale work does not touch commercetools. (Whether USD, US tax and US shipping exist is asked in Q-C01 and checked by workstreams D and E, not here.)

## 8. Manual items for `plans/TODO-MANUAL-TESTING.md`
| ID | Workstream | What to do | Expected | Needs | Status |
| --- | --- | --- | --- | --- | --- |
| M-C-1 | C | Read the German strings in `storefront/messages/de-DE.json` and `portal/messages/de-DE.json` and correct any wording. (Later workstreams add more; this row covers the starter set.) | Natural German | C merged | TODO |
Also add to section 2 (sign-offs) only if the owner answers Q-C01 with "en-US must be EUR/DE": `| SO-C1 | C | Confirm en-US currency decision | TODO |`.

## 9. Definition of done
- `npm run check` and `npm run verify:build` green in both apps with the real `check-messages`.
- All tests in section 5 pass; the curl table in section 6 matches exactly.
- No `next/link`, `redirect` or `useRouter` from `next/navigation` in `app/[locale]/**` or `components/**` (lint proves it).
- `lib/utils.ts` exports `COUNTRY_CONFIG`, `DEFAULT_LOCALE`, `formatMoney`, `getLocalizedString` (G imports them).
- M-C-1 row exists; Q-C01 is in `plans/notes/questions-ABCGH.md`.

## 10. Evidence to record
`plans/evidence/C/`: `curl-storefront.txt`, `curl-portal.txt`, `storefront-bare-notfound.png`, `storefront-de.png`, `storefront-en.png`, `storefront-cookie-redirect.png`, `portal-de.png`, `portal-en.png`, and the final `npm run check` tail for each app (`check-storefront.txt`, `check-portal.txt`).

## Progress

Storefront (J2). Portal tasks are tracked by the portal junior.

- C-01 storefront: done
- C-02 storefront: done
- C-03 storefront: done (real `check-messages`)
- C-04 storefront: done (`lib/locale-redirect.ts`, `proxy.ts`)
- C-05 storefront: done (layout, error, not-found, root not-found, global-error, `[locale]` page is not-found, `[store]` placeholder)
- C-06 storefront: done (`/dev/tokens` answers 200 without redirect in dev)
- C-07 storefront: done (see Q-J2-02)
- C-08 storefront: partial (README locales section done; fresh-clone `check` and `verify:build` left to the lead)

Evidence in `plans/evidence/C/`: `curl-storefront.txt`, `storefront-bare-notfound.png`, `storefront-de.png`, `storefront-en.png`, `storefront-cookie-redirect.png`, `check-storefront.txt`. Browser checks ran on port 3010: placeholder renders in both locales, `lang` and cookie correct, no console errors (the 404 document of `/fr-FR/hartmann` is the only logged resource error, as expected).

Portal (J3):
- C-01 portal: done (`i18n/config.ts`, `lib/utils.ts`; 11 tests)
- C-02 portal: done (`i18n/routing.ts`, `i18n/request.ts`, `next.config.ts` with the next-intl plugin; 3 tests)
- C-03 portal: done (catalogs `common.*` and `errors.*`, plus `common.signedOut`; real `check-messages`, 8 tests)
- C-04 portal: done (`lib/locale-redirect.ts`, `proxy.ts` with the comment for R; 11 plus 5 tests)
- C-05 portal: done (`app/[locale]/{layout,page,error,not-found}.tsx`, `app/not-found.tsx`, `app/global-error.tsx`; tests in `app/[locale]/pages.test.tsx`; the page is the signed-out placeholder)
- C-06 portal: done (`/dev/tokens` answers 200 in development without a redirect)
- C-07 portal: done (async root layout reads `x-next-intl-locale`; `app/layout.test.tsx`)
- C-08 portal: partial (README locales section done; fresh-clone `check` and `verify:build` left to the lead)

Evidence in `plans/evidence/C/`: `curl-portal.txt`, `portal-de.png`, `portal-en.png`, `portal-fr-notfound.png`, `check-portal.txt`, `portal-README.md`. Browser checks ran on port 3100: both locales render with tokens applied, `lang` and cookie correct, bare `/` with the `en-US` cookie lands on `/en-US`, `/fr-FR` is 404, no console errors. The sign-in redirect after `/de-DE` is R's.
