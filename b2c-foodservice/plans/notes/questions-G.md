<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions draft, workstream G

Format `Q-<L>-<n> | question | default | blocks? | Open`. The lead consolidates into `plans/QUESTIONS.md`.

Q-G-1 | reviews-and-ratings expects a fallback if Product Search cannot filter or sort on rating statistics; docs show both exist | Use reviewRatingStatistics.averageRating filter, ranges facet and sort directly; spec fallback not built | No | Open
Q-G-2 | Which fulfilment does Quick add use ('default fulfilment')? | Ship (collect needs a store and stock, subscribe needs an interval) | No | Open
Q-G-3 | Badge precedence when several flags apply? | Bestseller, Limited edition, New, Subscribe & save | No | Open
Q-G-4 | What does 'Featured' sort mean (no popularity data in the seed)? | Newest first (createdAt desc) then name; proposal: seed a featuredRank number attribute | No | Open
Q-G-5 | Price bands per market? | Under 10, 10 to 24.99, 25 to 99.99, 100 to 249.99, 250 and up in every currency | No | Open
Q-G-6 | Spec lists Brew method for machines and accessories but the seed defines brewMethods on coffee only | Facet defined for all three, shown only where buckets exist; optional seed request for machines | No | Open
Q-G-7 | Exact SKU matching several products (template open question)? | All matching products listed, boosted first, each card names the matched SKU; no redirect | No | Open
Q-G-8 | Is a real 'did you mean' in scope? | No (needs an external engine); page states typo tolerance is on and claims no correction | No | Open
Q-G-9 | Grid columns: spec says 3 beside the sidebar and tokens say 3 at 1080px, prototype CSS is 3 above 1080 and 2 below | 3 columns above 1080px, 2 at 1080px and below | No | Open
Q-G-10 | Cache the catalogue half of cards by [locale, ids] (template modeling note)? | No in v1; per-request reads only; revisit in Q | No | Open
Q-G-11 | Who curates the no-results fallback content, per category or global? | Global, derived (root categories plus bestsellers); no CMS | No | Open
Q-G-12 | Guest saved items: sessionStorage or cookie? | sessionStorage; L moves it to shopping lists and merges on sign-in | No | Open
Q-G-13 | Products with no price in the market: hidden from lists or shown as 'No price available'? | Hidden by the market filter in the query; card state exists for the race case | No | Open
Q-G-14 | Error codes: the plan names unknown_sku, price_unavailable, invalid_request, not_implemented, unsupported_language but ErrorCode (D) is closed | Mapped onto the existing codes with the planned statuses: unknown SKU = not_found 404, no price = validation_failed 422, bad input = validation_failed 400, collect and subscribe until H = bad_request 501, unsupported language (API) = validation_failed 422; no zod (not in package.json, Q-F-13), validation is hand written | No | Open
Q-G-15 | The listing follows the URL market (as the shell does, Q-F-15) while the cart is created from the session market; opening /en-CA with a US session shows CAD prices and adds to a USD cart | Listing prices and stores follow the URL locale; POST /api/cart/lines uses the session market. Lead or the proxy should reconcile URL and session market on first visit | No | Open
Q-G-16 | The plan's keys plp.facet.collection.bestseller and plp.facet.rating.4_5 collide with the group labels plp.facet.collection and plp.facet.rating (a string cannot also be an object) | Group labels stay plp.facet.<name>; option labels moved to plp.facetValue.collection.*, plp.facetValue.rating.*, plp.facetValue.price.*, plp.facetValue.intensity | No | Open
Q-G-17 | Pages live in a route group app/[locale]/(listing)/ so loading.tsx and error.tsx are shared; URL paths are unchanged (/category/[slug], /shop, /search) | Built that way (the plan allows it) | No | Open
Q-G-18 | Origin facet values are free text and some seed values contain a comma ("Brazil, Colombia") while f_origin is a comma list | A value may contain ", " (comma and space); the list separator is a bare comma; the origin pattern allows at most four parts of letters, digits, space, dot, apostrophe and hyphen | No | Open
Q-G-19 | The filter sheet is 440 px wide (the Drawer atom's default) instead of min(360px, 90vw) | Used the existing Drawer (E owns it); a narrow width option would be an E change | No | Open
Q-G-20 | Availability on a card is the default variant's indexed stock at the chosen store, while the "Available at" toggle matches any variant in stock there, so a card can read "Not available" with the toggle on | Accepted (indexed availability lags inventory, the PDP and cart re-read stock); a variant-aware card line would need the matched variant | No | Open
Q-G-21 | Product Search `limit: 0` for the mobile sheet count (the MCP tool minimum is 1) | Built with limit 0 as the plan says; one-line change to 1 in lib/ct/search.ts if the live API rejects it (row OA-G-a) | No | Open
Q-G-22 | Category scope uses the cached category tree for slug and key lookups instead of a where=slug query per request | Cached tree (60 s); an unpublished or renamed category can be stale for up to a minute | No | Open
