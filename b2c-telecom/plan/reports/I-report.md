# Workstream I report (design system primitives, shell, error pages)

Branch `ws/i-design-system-shell`. `npm run verify` passes (774 tests, build OK). Live smoke against `spec-test-b2c-telecom` (dev server, curl only): `/en-US` header renders wordmark, five category pills, "Log in", "My bundle · 0"; `/en-US/nope/x` is 404; `/de-DE/nope` shows the German 404 with search form and category buttons; `/en-US/unauthorized?ref=AB12-CD34` is 200; dev log had no errors or warnings. (A `SESSION_SECRET` was passed on the command line only, see E's Q1.)

## Done
I-01 … I-16. All nine scenario rows have tests named after the scenario titles (`lib/nav.test.ts`, `NavPill.test.tsx`, `AccountLink.test.tsx`, `AccountSlot.test.tsx`, `BundlePill.test.tsx`, `lib/bundle-count.test.ts`, `SiteHeader.test.tsx`, `SiteFooter.test.tsx`, `not-found.test.tsx`, `[...rest]/page.test.tsx`, `error.test.tsx`, `lib/auth/guards.test.ts`). `lib/contrast.test.ts` passes.

## Not done / blocked
Nothing. Chrome checks C-I-1 … C-I-16 were not run by me. C-I-13/14/15 wait for R, S, M; C-I-4 Support link waits for W.

## Questions for the owner
- The session cookie holds no first name (E stores references only), so the header greeting needs a customer read. I added `lib/ct/account-name.ts` (`getAccountFirstName(customerId)`, id from the signed session only, uncached, request-deduplicated with React `cache`, any failure gives "My account"). Costs one commercetools GET per page for signed-in buyers. Alternative: R puts `firstName` into the session; then drop this helper.
- Footer credit says "Photos from Pexels" (G's wording); G asked whether to change it (images are iStock).

## Missed features and deviations
- **Server reads live in `app/[locale]/_shell/`, not in `components/layout`**: B's lint and `check:boundaries` forbid anything under `components/` from reaching `lib/ct`. So `AccountLink`, `SiteHeader`, `SiteFooter`, `ErrorView` are presentational (props: `signedIn/firstName`, `items: NavItem[]`, `categories`), and the async readers are `_shell/AccountSlot.tsx` (session + name), `_shell/loadNavItems.ts` (cached category tree, try/catch, logs `[shell] category tree unavailable`). Tests for the "tree failure" case are in `loadNavItems.test.ts` and `SiteHeader/SiteFooter` with empty items.
- `SiteHeader` props are `{ items, account, bundle }` (no `locale`; it uses `useLocale`). `MobileDrawer` has no `bundle` prop (the pill stays in the header).
- D's hook is `useSwitchMarket` (not `useLocaleSwitch`); `LocaleSwitcher` shows the `region.cartEmptied/switched/error` toasts per D's report.
- Dev error trigger is `app/[locale]/dev/error/page.dev.tsx` (E's `.dev.tsx` convention, absent in production), still with the NODE_ENV guard.
- `lib/auth/next-url.ts` (new, pure: `sanitizeNext`, `loginUrl`, `unauthorizedUrl`, `isSafeReference`) is re-exported by `lib/auth/guards.ts`, which is `server-only` because of `requireSession`. Client code must import from `@/lib/auth/next-url`. `requireSession` redirects through D's `redirect({href, locale})`.
- Tailwind class names follow C's real tokens: `text-text-on-brand`, `text-text-on-pink` (never `text-neutral-0`, the token lint forbids it), `bg-overlay` for the drawer backdrop. Spacing uses Tailwind's default scale.
- Messages: new top-level namespace `shell` (plan §6), so `messages/parity.test.ts` expected namespace list now includes `shell`. All §6 keys added to both files in I-02.
- `app/[locale]/page.tsx`: `<main>` changed to `<div>` (the layout owns `main#main`); O will replace the page.
- `app/not-found.tsx` and `global-error.tsx` use a plain `<a href="/">` with an eslint-disable (no intl provider there).
- Drawer slide-in uses Tailwind `starting:` variant instead of an effect.
- `ToastProvider` is in `components/ui/Toast.tsx` and wired into `test/utils.tsx`; `useToast()` outside the provider throws.

## TODOs for other workstreams
- M: replace `<BundlePill count={0} />` in `app/[locale]/layout.tsx` with the connected pill (`countBundleLines`) and insert `CartProvider` at the marked comment.
- R: login page/route must call `sanitizeNext` (import from `@/lib/auth/next-url` on the client); decide on the first-name source (see questions).
- S/T: call `requireSession(locale, '/account/...')` at the top of each page.
- W: `/support` (footer link). P: `/search` (404 form action).
- N: the `/shop/<slug>` route; unknown slug must `notFound()`.

## Findings
- Next 16 build fetches Google fonts; one `npm run verify` build failed once with a font fetch error and passed on retry (network flake, not code).
- `no-restricted-imports` + `check:boundaries` mean server components under `components/` cannot call `lib/ct` at all.
- Live category tree has 5 roots (devices root exists); header and footer show all five.

## Manual tests added
None.

## Junior design choices
- Language switch: two pill buttons "EN"/"DE" (full names as aria-labels), dark pill = current; desktop right cluster, inside the drawer on mobile.
- Mobile drawer: right slide-in panel (88vw, max-w-sm, rounded left edge), dimmed backdrop, wordmark + close button on top, one full-width pill per category, hairline, account link, language switch; body scroll lock; focus trap.
- Toast: bottom-right on md+, bottom full-width on mobile, dark (success) / danger (error), pauses on hover/focus.
- Not-found page: search field and button, secondary small buttons per root category, home button; server page: retry + home; unauthorized: account + support buttons.
- Footer: Pexels credit link under the row (D-055 contract from G).
