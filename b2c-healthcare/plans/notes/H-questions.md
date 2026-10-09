# Workstream H: questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | `CartSummary.itemCount` (G) is the sum of quantities, but the header count must be the number of LINES (Q-020). | Added `lineCount` to `CartSummary` (`lib/types.ts`) and to `getActiveCartSafe` (`lib/ct/cart-read.ts`, one test expectation updated). `itemCount` is kept. The header reads `lineCount`. |
| 2 | The layout fallback carries only `{ id }` for the user (G test), so initials are unavailable. | `lib/header-user.ts` (`getHeaderUser`, session + `getCustomerByIdCached`, id only on outage) feeds a nested `SwrProvider` in `app/[locale]/layout.tsx`; the header island still reads `useAccount()`. Fallback glyph is a middle dot when no name exists. |
| 3 | `components/**` may not import `lib/session`/`lib/ct`, so the "Header server shell" cannot read the session. | `Header` is a server-safe shell (logo, sticky bar); all per-visitor parts are client islands over SWR; the session is read in the locale layout only. A test asserts `Header.tsx` has no session or count reference. |
| 4 | Where does the active section / home variant come from in a server shell? | `HeaderClient` derives it from `usePathname()` (locale-stripped); an explicit `variant` prop overrides. Same for `Footer`. |
| 5 | `app/[locale]/_tokens` is a Next private folder (not routable). | Folder is `app/[locale]/%5Ftokens/`; the URL is `/en-US/_tokens` (verified in the browser). Production: `notFound()` (tested). |
| 6 | Sign-in route for the header and `RequireSignIn`. | `/login` (workstream J), `?next=<locale path>`; constant `SIGN_IN_HREF`. |
| 7 | Home footer "Company" column links (About, Contact) do not exist yet. | `FOOTER_COLUMNS` in `lib/nav.ts` has a `live` flag; About (`/about`) and Contact (`/contact`) are `live: false`, so the column is omitted. V flips the flags (its V-08). |
| 8 | Health journal link on the home header. | Shown only when `hasArticles` is true; the layout passes nothing (false) until V/M provide articles. |
| 9 | Pages and `<main>`. | The locale layout renders `<main id="main">` and a skip link; pages must not render their own `<main>`. |
| 10 | 1.5 px borders and the 900 px breakpoint have no Tailwind equivalent without raw px in TSX (design lint). | `@utility border-thick` and `--breakpoint-nav` in `app/globals.css`; `NAV_BREAKPOINT_PX` in `lib/nav.ts` for the matchMedia query. |
| 11 | Modal overlay click without a clickable div. | A `button` (tabindex -1, aria-hidden) behind the card closes it; Escape and the close button are the accessible routes. |
| 12 | `i18n/routing.test.ts` asserted the catalog has exactly `common` and `errors`. | Relaxed to "contains" (additive namespaces `ui`, `shell`). |
| 13 | Header bar height measures 73 px in the browser (72 px content + 1 px bottom border). | Kept (the prototype's nav also adds the border to its 72 px). |
