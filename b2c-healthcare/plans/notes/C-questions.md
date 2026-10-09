# Workstream C: questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | The task says `app/[locale]/layout.tsx` sets `<html lang>`, but Next allows `<html>` only in the root layout and `app/layout.tsx` (fonts, B) is the root. | `app/layout.tsx` stays the only root and sets `lang` from `await getLocale()` (next-intl; falls back to the default locale on excluded paths). `app/[locale]/layout.tsx` validates the segment (`hasLocale` else `notFound`), calls `setRequestLocale` and wraps the provider. B and others must keep `<html lang={locale}>` when editing the root layout. |
| 2 | `proxy.ts` via plain `createMiddleware(routing)` would turn `/fr-FR/x` into `/en-US/fr-FR/x`. | Own logic: supported prefix goes through the next-intl middleware (sets locale header/cookie); otherwise redirect (307) to cookie-or-default locale, stripping a leading locale-shaped segment (`xx-XX`). Short routes such as `/faq` are not treated as locales. |
| 3 | Missing-key handlers are functions and cannot be passed from a Server Component to `NextIntlClientProvider`. | Client wrapper `i18n/IntlProvider.tsx`. Server side uses the same handlers via `i18n/request.ts`. Production shows default-locale text (catalog is also deep-merged under the active one), and `''` if absent everywhere; development logs `[i18n] ...key...` and renders the dotted key. |
| 4 | Root `app/page.tsx` (A's placeholder) is unreachable because the proxy redirects `/`. | Deleted it; added a minimal `app/[locale]/page.tsx` (heading from `common.brand`) so `/en-US` renders for the browser recipe. H-10 replaces it. |
| 5 | next-intl cookie name. | `localeCookie: { name: 'your-shop-country-locale' }` (constant `LOCALE_COOKIE` in `lib/utils.ts`) so next-intl and the spec use the same cookie. |
| 6 | vitest cannot resolve `next/navigation` imported by next-intl. | `server.deps.inline: ['next-intl']` added to `vitest.config.mts` (additive). |
