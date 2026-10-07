# Workstream D report (locale routing, messages, region and language switch)

## Done
D-01 … D-10. `npm run verify` passes (31 test files, 174 tests, build OK). All three scenario rows have tests named after them (`app/api/locale/route.test.ts`, `lib/market/server.test.ts`, `lib/market/switch.test.ts`, `hooks/useSwitchMarket.test.tsx`). Terminal smoke test against `next start` (port 3111) confirmed: `/` -> 307 `/en-US`; with cookie `malva-market=de-DE` -> `/de-DE`; `/de-DE` renders `<html lang="de-DE">` with the font variable classes and "Malva" / "Malva Telecom Shop"; `/fr-FR/x` -> `/en-US/fr-FR/x` 404; POST `/api/locale` de-DE returns the expected JSON and cookie; GET `/api/locale` 405; `/dev/nonexistent` 404 (not redirected).

## Not done / blocked
Nothing. Chrome checks were not run by me.

## Questions for the owner
None.

## Missed features and deviations
- D-06 to D-09 were verified together after D-07/D-08/D-09 were written, then committed as four separate commits (the tree state at each of them compiles; only the final state ran the full `npm run verify`).
- The root layout is now `async` (`getLocale()`), so `/[locale]` is built as dynamic (`ƒ`) rather than static; this follows the plan (the proxy provides `x-next-intl-locale`). `app/layout.test.tsx` now awaits the layout and mocks `next-intl/server`; C's font-variable test is kept.
- `lib/utils.ts` also exports `MARKET_COOKIE_MAX_AGE` (used by proxy and route). `cn` from ARCHITECTURE.md is not created (no dependency for it; H or whoever needs it appends).
- `proxy.ts` exports the function as `proxy` (Next 16 name) and `config`. The `/api/locale` route has no `server-only` import beyond what its seam has; the seam and `lib/market/server.ts` carry the marker as B required.
- The seam bodies use `void res;` to satisfy the unused-parameter lint until M replaces them.
- Stale `.next/types` after deleting `app/page.tsx` broke `tsc`; `rm -rf .next` fixes it (not a code issue).

## TODOs for other workstreams
- M: replace `lib/market/cartSeam.ts` bodies; treat a session cart whose currency/country differs from `getMarket()` as no cart.
- I: build `LocaleSwitcher` on `useSwitchMarket`; toast `region.cartEmptied` with `{market}` = `COUNTRY_CONFIG[locale].label`, `{lines}` = names joined by ", ", else `region.switched`; add `ToastProvider` between `SWRConfig` and the chrome in `app/[locale]/layout.tsx`.
- H: append `formatMoney` and `getLocalizedString` to `lib/utils.ts`. Pages should call `setRequestLocale(locale)` (as the home page does) before translations.
- E: `app/api/locale` writes the 400 error JSON literally; may switch to `errorResponse` later.
- Page-level metadata (title) is not set anywhere yet.

## Findings
- next-intl 4.14.9 with Next 16.2.6: the plugin and `x-next-intl-locale` header set by a hand-written `proxy.ts` work as designed; `getLocale()` in the root layout returns the URL locale.
- `NextResponse.cookies.set(... sameSite: 'lax')` serialises as `SameSite=lax` (lower-case); `next start` adds `Secure` because NODE_ENV is production (Chrome still accepts it on localhost).

## Manual tests added
None.

## Junior design choices
None (no UI beyond the placeholder home page).

## Chrome checks ready
C-D-1 … C-D-7 (run against `npm run dev` or `npm start`; for C-D-2, the HttpOnly cookie is only visible in the network panel).
