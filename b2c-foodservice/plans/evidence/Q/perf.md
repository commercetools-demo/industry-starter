<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Performance and caching (Q-14)

Measured on 2026-10-22 on the release build (`next build`, `next start`, Next 16.4.2, Node 22.21.1) against the mock commercetools server, so server times are the storefront's own work and carry no network latency to commercetools. Two things are therefore **not** proven here and stay with the post-deploy smoke (Q-17, RELEASE-CHECKLIST section E, which repeats Lighthouse and a trace on the deployed URL): TTFB and API timing on the real host, and the real image endpoint (OA-03: the images in this run are a placeholder service, `placehold.co`).

Tools, all against `http://localhost:3100`:

| Tool | What it gave | Where |
| --- | --- | --- |
| Chrome DevTools MCP performance traces (reload, cache ignored): desktop 1440 x 900 without throttling; mobile 375 x 812 with CPU 4x slowdown and network "Fast 4G" (the closest option the tool offers) | LCP with its four parts, CLS, insights | table 1 (raw traces are 1 to 1.7 MB each, kept out of git; the recipe is repeatable) |
| Lighthouse CLI 13.5.0 (`npx lighthouse`; mobile = simulated slow 4G with 4x CPU, desktop = desktop preset) | performance score, LCP, TBT, CLS on 20 pages (40 runs) | `a11y/lighthouse-cli.json`, `a11y/lighthouse-core.json` (before) |
| Headless Chrome through `puppeteer-core` (cold cache, resource timing `encodedBodySize`) | request count, bytes per kind, `/_rsc` prefetch count, images lazy or not | `perf-after.json`, table 3 |
| `curl -D -` | response headers | table 5 |

## 1. Largest Contentful Paint and layout shift (traces)

| Page | Desktop LCP | Desktop CLS | Mobile LCP (4x CPU, Fast 4G) | Mobile CLS | LCP element and the longest part |
| --- | --- | --- | --- | --- | --- |
| Home | 103 ms | 0 | 552 ms | 0 | text (the trace shows no resource load, only render delay: 536 ms on mobile, the CPU slowdown) |
| Listing (Pods) | 116 ms | 0 | 625 ms | 0 | first card image; load delay 370 ms on mobile (the image is discovered with the HTML, then waits for the network) |
| Product page | 107 ms | 0 | 579 ms | 0 | main image; load delay 247 ms, load 261 ms on mobile |
| Cart | 108 ms | 0 | 547 ms | 0 | text; render delay |

Budget (D7): LCP at most 2.5 s on mobile and 1.8 s on desktop, CLS at most 0.1. **Met on every page of this table.** TTFB in the same traces: 11 to 21 ms (budget 400 ms for a local build).

Lighthouse is stricter on mobile (a simulated 1.6 Mbit/s link with 150 ms round trips): see table 2. Its LCP of 3.1 to 4.6 s comes from downloading the 1200 x 1440 placeholder PNG, which the placeholder service does not shrink, and is not a code problem. Question Q-Q-20 records it with the default "measure again with the real images"; owner row M-Q-05.

Insights the traces raised (none changes a budget): `ImageDelivery` says the pictures are 90 to 160 kB larger than their displayed size on the listing and product page (placeholder images again; idea in `plans/IDEAS.md` to check the `sizes` once the real endpoint exists); `LegacyJavaScript` 14 kB (the Next.js default polyfills, nothing to change in app code); `RenderBlocking` 0 to 55 ms (the stylesheet, 14 kB).

## 2. Lighthouse, before and after (CLI, performance category included)

Before = the first CLI run of this workstream (`a11y/lighthouse-core.json`, `lighthouse-d2.json` for the account page). After = the final build (`a11y/lighthouse-cli.json`, `final` block for the six pages measured last, `batch1` for the rest). Scores are performance / accessibility / best practices / SEO.

| Page | Device | Before | After | What changed |
| --- | --- | --- | --- | --- |
| Home | mobile | 92 / 100 / 100 / 100, LCP 3368 ms | 94 / 100 / 100 / 100, LCP 3067 ms | prefetch off (30 instead of 49 requests), fetch priority on the hero |
| Home | desktop | 99 / 100 / 100 / 100, LCP 867 ms | 99 / 100 / 100 / 100, LCP 867 ms | account button name (Lighthouse `label-content-name-mismatch` gone, QFX-03 and QFX-29) |
| Listing | mobile | 90 / 100 / 100 / 92, LCP 3670 ms | 84 / 100 / 100 / 100, LCP 4497 ms (91 in the first batch, LCP 3540 ms) | SEO 92 to 100 (meta description in the head, canonical); the performance number moves 84 to 91 between runs with the placeholder image |
| Listing | desktop | 99 / 100 / 100 / 92 | 97 / 100 / 100 / 100, LCP 1243 ms | same |
| Product (pod) | mobile | 92 / 100 / 100 / 92, LCP 3369 ms | 84 / 100 / 100 / 100, LCP 4640 ms | SEO 92 to 100; the LCP is the placeholder download |
| Product (pod) | desktop | 100 / 100 / 100 / 92 | 98 / 100 / 100 / 100, LCP 1098 ms | same |
| Cart | mobile | 92 / 100 / 100 / 54 | 87 / 100 / 100 / 54, LCP 4145 ms | SEO 54 is `noindex` on purpose (the cart is private) |
| Cart | desktop | 100 / 100 / 100 / 54 | 99 / 100 / 100 / 54 | same |
| Account, Orders | mobile | 93 / 96 / 100 / 45 | 90 / 100 / 100 / 54, CLS 0.072 | accessibility 96 to 100 (the account pages had no document title, QFX-19), SEO 45 to 54 (`noindex` by design; the missing title is gone) |
| Account, Orders | desktop | 100 / 96 / 100 / 45 | 100 / 100 / 100 / 54 | same |
| Account, Subscriptions | mobile / desktop | not measured (tab did not exist) | 90 / 100 / 100 / 54 and 99 / 100 / 100 / 54 | |

The performance score differences of a few points between runs on the same build are noise of the simulated throttling (the placeholder image dominates); read the LCP and request columns, not the score, when comparing. Accessibility is 100 on all 20 audited pages and best practices is 100 except checkout (96: the browser logs the 404 of `GET /api/checkout` when the page is opened without a bag, see `plans/IDEAS.md`). SEO is 100 on every public page and 54 to 58 on the private ones (`noindex` is the intended result: cart, checkout, confirmation, account, sign-in) and 66 on search (`noindex` on result pages, by design).

## 3. Requests and bytes per page (cold cache)

Before = browser measure at the start of Q (`perf-measures.json`, desktop). After = the same browser measure after the fixes (home 30, listing 31, product 36, cart 25, checkout 28, account 27 requests) and the headless-Chrome cross-check below (`perf-after.json`; 25 to 28 requests because it does not count the browser's own icon request).

| Page | Requests before | Requests after (headless) | `/_rsc` prefetches after | Script kB | Style kB | Font kB (desktop / mobile) | HTML kB | Budget |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 49 | 25 | 0 | 194.9 | 13.9 | 158 / 105 | 41.4 | 200 kB, 40 requests: met |
| Listing | 63 | 26 | 0 | 197.7 | 13.9 | 158 / 105 | 34.9 | 200 kB, 40 requests: met |
| Product | 54 | 28 | 0 | **212.3** | 13.9 | 158 / 105 | 37.3 | 200 kB: **over by 12 kB** (Q-Q-19, accepted, M-Q-05) |
| Cart | 60 | 25 | 0 | 195.9 | 13.9 | 158 / 105 | 29.0 | 200 kB: met |
| Checkout | 60 | 27 | 0 | 198.3 | 13.9 | 158 / 105 | 26.9 | 250 kB: met |
| Sign in | 47 | 26 | 0 | 193.3 | 13.9 | 158 / 105 | 26.8 | |
| About | n/a | 24 | 0 | 190.6 | 13.9 | 158 / 105 | 29.4 | |

The drop from 49 to 25 requests on the home page is one fix (QFX-05 and QFX-22: `0d4cf41a`, `64fc3289`, `02de3891`): Next.js links prefetched the page payload of every visible link (16 requests per page in the header and footer alone, 20 to 37 `Fetch` requests per page), which for a store whose pages are dynamic means 16 server renders per visit. `Link` in `i18n/routing.ts` now defaults to `prefetch={false}` (a link that should prefetch passes `prefetch` itself; none does today). Every route still loads the same shared script (React, the Next.js client, next-intl and SWR, about 190 kB over the wire; the biggest chunk is React DOM at 235 kB raw); the product page adds the gallery, the option buttons and the review form. No repeated request: each API call appears once per page (`/api/auth/me`, `/api/cart/count`, `/api/channels`, and on the product page `/api/reviews`).

Images: one image with a fetch-priority hint per page (the hero on home, the first card on the listing, the main image on the product page, one `<img fetchPriority="high">` and its preload link in the HTML of each of the three pages; none on the cart and about); every other image is `loading="lazy"` (home 8 of 9, listing 11 of 12, product page 7 of 8, cart and checkout all). Fonts: three families (Archivo, Roboto, Roboto Mono), `display: swap`, latin subset only, five files on the wire. The placeholder pictures cannot show the 150 kB hero budget or the 2x width rule; that check moves to Q-17 with the real images.

Total blocking time in Lighthouse: 0 to 14 ms on every page (budget 200 ms). INP was not measured by hand; with TBT this low the interactions that matter (filters, add to bag, quantity change) are bound by the network call, which the journeys time at under a second against the mock.

## 4. Server round trips

`rg "await "` in every `page.tsx` and `layout.tsx` under `app/`: the pages `await` only the route parameters and one data call (`getListing`, `loadProductPage`, `loadCart`, `getPageFigures`); the home page and the root layout use `Promise.all` for their independent calls; the sign-in and register pages read two cookies in sequence (`hasSignedInCustomer`, `readGuestEmail`), which are local reads, not network calls. No page awaits two independent commercetools calls one after the other.

## 5. Caching rules (D7), checked on the running build

| Data | Rule | Observed |
| --- | --- | --- |
| HTML pages | never shared at a CDN | `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` on home, listing, product, cart, about and FAQ (curl). The two-shopper check is journey J14 (two isolated contexts get different HTML) |
| Static assets | `public, max-age=31536000, immutable` | script chunk and font file: `public, max-age=31536000, immutable` |
| `/api/recurrence-policies` | `public, max-age=300` | `public, max-age=300` |
| `/api/channels` | plan says public | `no-store`, **on purpose**: the answer carries `selectedKey`, the shopper's own collection store, so it is personal. The store list itself is cached on the server for 60 s (`lib/ct/public-cache.ts`, `unstable_cache` with a tag) |
| Cart, session, orders, account, reviews write routes | never cached | every handled API answer is `Cache-Control: no-store` unless the handler sets its own (QFX-25, `e6cc495e`); curl on `/api/auth/me`, `/api/cart`, `/api/cart/count`: `no-store` |
| Category tree, stores, shipping methods, project config, policies | `unstable_cache`, 60 or 300 s, tagged | the only caller of `unstable_cache` is `lib/ct/public-cache.ts` (two TTLs, one tag each); nothing else in the app caches |
| Products and prices | not cached on the server | no `unstable_cache` around a product query (code search) |
| `robots.txt`, `sitemap.xml` | | `public, max-age=0, must-revalidate`, served from the Next.js cache |

## 6. Verdict

| Budget | Result |
| --- | --- |
| LCP at most 2.5 s mobile, 1.8 s desktop | met in the traces (0.55 to 0.63 s and 0.10 to 0.12 s); Lighthouse's slower simulation shows 3.1 to 4.6 s on mobile because of the placeholder image: **accepted for now, M-Q-05, re-measure with real images (Q-17)** |
| CLS at most 0.1 | met everywhere (0 to 0.072; the 0.072 is the account Orders page on mobile in Lighthouse only; the browser traces and the headless runs show 0 on the pages they cover) |
| TBT/INP at most 200 ms | met (TBT 0 to 14 ms) |
| TTFB at most 400 ms local | met (7 to 21 ms); the real figure on the host comes from Q-17 |
| First Load JS 200 kB for home, listing, product, cart; 250 kB checkout and account | met except the **product page at 212 kB** (Q-Q-19; idea: load the review form on demand) |
| Requests at most 40 on home and listing, none repeated | met (25 and 26) |
| Images and fonts | one priority image, the rest lazy, three families with swap: met; hero size and the 2x rule wait for real images |
| Caching | as designed, one documented deviation (`/api/channels`) |
