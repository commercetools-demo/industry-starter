# Evidence O

All browser checks ran against `scripts/mock-ct-server.mjs` (the seed catalogue, no live project), first with `next dev`, then
with `next build && next start` on port 3100. Console clean, no failed network request (recipe 6.1).

## FIX-1 header overflow (`scrollWidth` versus `clientWidth`)

| Viewport | Before | After |
| --- | --- | --- |
| 375 px | 467 vs 375 | 375 vs 375 |
| 320 px | worse | 320 vs 320 (emulated device, overlay scrollbar) |
| 900 px | 1021 vs 885 | fits |
| 1080 px | 1132 vs 1065 | fits |

Cause: the header row (wordmark, five links, store pill with a long store name, locale text, three icons) was wider than the
viewport. See `IDEAS.md`. Regression guard: `components/layout/header-fit.test.ts`.

## FIX-2 URL market wins

On `/en-CA` a cart was created (`count 1`), then `/en-US` was opened: `GET /api/cart/count` gave `0` and the market cookie
followed. Unit tests: `lib/session-reconcile.test.ts`.

## O recipe

| Step | Result | File |
| --- | --- | --- |
| 6.1 desktop | one `h1`; promise row `$75.00` (equals the shipping tier of the mock, USD 75), glass card with `$5.90`, four tiles, banner, four bestsellers, editorial, four new arrivals, subscribe strip | `6-1-home-1440.png` |
| 6.3 store | no store: `Collect in store, ready in minutes.` and `Choose a store`; picker opened by `Find your store`; after choosing Williamsburg and a reload: `Ready in 30 minutes at Malva Coffee Williamsburg.` (30 = the channel's `collectionMinutes`), buttons `Change store`, `Shop collect-eligible` (`/en-US/shop?avail=1`) | none |
| 6.4 markets | `/en-CA`: promise `Free shipping over $99.00` and `30-day returns` only, no banner, no `Find your store`, no store pill | none |
| 6.5 responsive | measured in iframes at 1440 to 320 px: no horizontal overflow after the hero glow was clipped; hero image column `display: none` at 900 and below; product grid 4 / 3 / 2 columns; tiles 4 / 2; side padding 32 / 20 px; at 375 px both hero buttons are 335 x 59 px (full width) | `6-5-home-375.png` |
| 6.6 empty sections | the seed has both badges, so empty sections are covered by `ProductSection.test.tsx` only (`No new products`) | |
| 6.7 subscribe | `Shop subscriptions` opens `/en-US/shop?f_collection=subscribable`: 19 cards | |
| 6.8 failure isolation | the mock server was stopped while the app ran: the page still rendered hero, tiles, banner and editorial; bestsellers, new arrivals, featured card and subscribe strip were omitted; the server logged one `home_section_failed` line per section (`featured`, `bestseller`, `new`, `subscribable`) | |
| 6.9 expired session | HttpOnly cookie, covered by `app/[locale]/page.test.tsx` (expired and tampered JWT built with `jose`); the sign-in and sign-out check was not run in the browser because the mock customers need the demo login env (`DEMO_LOGIN_ENABLED`); listed as `M-O-02` | |
| 6.10 reduced motion | CSS text assertion (`components/home/home-styles.test.ts`); keyboard order not walked by hand | |
| 6.11 Lighthouse (production build) | mobile: accessibility 100, best practices 100, SEO 100. Desktop: SEO 100, best practices 100, accessibility 100 with one failed audit `label-content-name-mismatch` on F's store pill and locale pill (aria-label differs from the visible text); not an O element, noted in `IDEAS.md`. LCP 249 ms (the headline: no hero image yet), CLS 0.00 | |

Note on 1080 px: media queries in the shared utilities use `width < 1080px`, so at exactly 1080 px the grids still have four
columns and switch to three at 1079 px and below (the same rule G's listing uses).
