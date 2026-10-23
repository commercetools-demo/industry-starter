<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions draft, workstream H

Format `Q-<L>-<n> | question | default | blocks? | Open`. The lead consolidates into `plans/QUESTIONS.md`.

Q-H-1 | Default fulfilment on load? | Collect when a store is chosen and the variant is in stock there, else ship (prototype defaults to pickup) | No | Open
Q-H-2 | Delivery estimate before a cart exists (template open question)? | Market-wide rule (cut-off hour, 2 to 4 business days) in lib/shop-config.ts, same for every address | No | Open
Q-H-3 | Datasheets and safety data sheets (template open question)? | Not applicable to a B2C coffee shop; none shown | No | Open
Q-H-4 | Spec shows Machine system as a pod selector but each seeded pod product has one system | Read-only fact plus a link to the sibling product when one exists; no selector | No | Open
Q-H-5 | Price tiers: template requires the scenario, B2C excludes the tier table, seed has no tiers | Implement tier-aware unit price and total without a table; test with fixtures | No | Open
Q-H-6 | Spec lists bundle 'with milk frother' but the seed bundle enum has machine-only and starter-capsules only | Show the enum values that exist; seed request for the third value | No | Open
Q-H-7 | Subscribe saving percentage: computed or fixed copy? | Computed per variant from recurring vs one-time price, shown only when positive | No | Open
Q-H-8 | Quantity limits on the PDP? | Honour inventory minCartQuantity and maxCartQuantity, otherwise 1 to 99 | No | Open
Q-H-9 | Image order: lifestyle and pack shot | First image is the pack shot; seed assigns images round-robin so order is not curated (OA-03) | No | Open
Q-H-10 | Selection in the query string: replaceState or push a history entry per option? | replaceState (back leaves the page) | No | Open
Q-H-11 | Product with no price in the market: show the PDP with 'Price on request' or 404? | Show it (template scenario); lists hide such products | No | Open
Q-H-12 | Should adding a line open the cart drawer? | No, toast only (spec) | No | Open
Q-H-13 | Is the capsule compatibility rule (Original with Original, Vertuo with Vertuo, others none) final? | Yes as stated; owner confirms in SO-x1 | No | Open
Q-H-14 | The reviews slot: what shows before M ships? | Nothing (REVIEWS_ENABLED=false in lib/shop-config.ts); the rating summary section with the #reviews anchor stays. M swaps the body of components/pdp/ReviewsSlot.tsx and flips the flag | M | Open
Q-H-15 | ErrorCode (D) is closed but the product page must tell collect failures apart | Domain codes in lib/api-domain.ts (same envelope as J, Q-J-13): not_available_for_collection (409, with `available`), collect_not_available_in_market (400), unknown_store (400), unknown_policy (400), price_unavailable (422). G's delivery no-price answer stays validation_failed 422 (the UI maps both to one text) | No | Open
Q-H-16 | loading.tsx makes the route stream, so the HTTP status of an unknown SKU is 200 (page says not found, noindex) and the canonical-slug redirect is a streamed 308 (meta refresh plus Next redirect marker) instead of a status line | Kept the skeleton the spec asks for. If real 404 and 308 statuses matter for SEO, drop loading.tsx or resolve the product in a layout before streaming | No | Open
Q-H-17 | Q-H-04 (system selector): no seeded pod has a sibling for the other system | Read-only system fact plus a link "Looking for Vertuo capsules?" to the other system's pod category; the compatibility guide links to both | No | Open
Q-H-18 | productType is not expanded by default, so the shape would always read as an accessory | getProductBySku expands `productType` (the shape comes from its key). Other readers of mapProduct have the same gap if they need the type key | No | Open
Q-H-19 | Tagline source: products have no tagline field | First sentence of the description; the full description stays in Details. A `tagline` text attribute is a seed request if the owner wants distinct copy | No | Open
Q-H-20 | Selectors are real buttons with `aria-pressed` and arrow-key focus movement, not a roving-tabindex radiogroup (OptionButton is an atom of E); disabled reasons are in `title` only, not `aria-describedby` | Accept; colour swatches and fulfilment cards are true radiogroups | No | Open
Q-H-21 | Delivery cut-off uses the market time zone (America/New_York, America/Toronto) | As SO-x2 default (14:00, 2 to 4 business days, weekends skipped, no holidays) | No | Open
