# Workstream H: todos

## Browser check (done on `PORT=3104 npm run dev` with placeholder env, killed afterwards)
- `/en-US` renders without console errors or warnings; header 72 px content, sticky, white 95%; primary button computed colour `rgb(16,40,81)` on `rgb(42,167,255)`, radius 8 px; badge text `rgb(6,122,5)` on `rgb(230,246,230)`; footer `rgb(27,60,116)`; font Poppins.
- 390 px: links collapse into the menu button; the panel opens (`plans/evidence/H-mobile-menu-390.png`); desktop home shot `plans/evidence/H-smoke-home-1440.png`.
- `/en-US/_tokens` renders. Lighthouse snapshot (desktop) on `/en-US`: accessibility 96, best practices 100, SEO 100.
- `take_screenshot` with a `filePath` inside the repo is still refused ("not within any of the configured workspace roots"); screenshots were taken inline and copied from the tool-results folder. The SO-01 white-vs-navy label PAIR was not captured: only the chosen navy-900 label is shown. Computed styles confirm navy-900 on azure.
- Not done: side-by-side comparison against `design/source/Malva App.html`, authenticated header (no sign-in yet; needs J), Tab-order walk in a real browser (covered by a jsdom test), mobile drawer keyboard walk (jsdom tests only).

## For other workstreams
- B's scenarios "Action color", "Green means available or free", "Radius by element" can now be tested/ticked in `B-design-tokens.md` (I did not edit it): Button/Badge/Card class assertions are in `components/ui/primitives.test.tsx`.
- J: sign-in page reads `?next=` with `sanitizeNext` / `splitLocalePath` (`lib/next-path.ts`) and redirects to the locale-less path; "after sign-in they land on /cart" is only proven for the link (`RequireSignIn` test), the redirect is J's. After login/logout call `mutate` on `KEY_CART`/`KEY_ACCOUNT` so the header updates; the account fetcher must return `firstName`/`lastName` for initials.
- Cart/account workstreams: the cart fetcher must return `lineCount`; `useCart`/`useAccount` are still the G placeholders (no fetch).
- V: flip `live` for About/Contact in `lib/nav.ts` `FOOTER_COLUMNS`; I: the unmatched-route 404 under `/en-US/...` shows Next's default page (no layout), because `not-found.tsx` under `[locale]` only renders for `notFound()` calls inside the segment; add `app/not-found.tsx` or a catch-all if the shell should appear.
- M: pass `hasArticles` to `Header` when journal articles exist; the home page needs no `variant` (detected from the path).
- Owner: SO-02 (mobile menu look and feel) and SO-01 (label colour) remain open.
