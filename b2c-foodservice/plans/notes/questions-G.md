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
