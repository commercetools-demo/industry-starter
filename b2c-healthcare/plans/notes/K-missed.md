# Workstream K: gaps and things that may bite others

- The header has no search control, so "search from the header" is not wired. `components/search/SearchForm.tsx` is ready for H/M to place (a plain GET form; works without JS).
- `clinicName` is not searchable in the seed product type, so clinic names are not matched by text search (K-questions 3).
- Availability costs one Custom Object query per candidate per request (up to 50). Fine for 8 doctors; a larger catalog needs a short-TTL cache or a precomputed next-slot attribute.
- The doctor profile route `/doctor/:key` (workstream L) does not exist yet: card links 404 until then. The link key is the product key (`mlv-doc-...`), not the id; L must accept it.
- Medicine search hits have no detail page to link to.
- The "Next: Tue 14" date is assembled as "weekday day"; other locales may want another order.
- Facet counts are fetched but not displayed (K-questions 6).
- `/search` shows at most 8 hits per group; "See all matching doctors" goes to the remote list with the same text.
- G's enum field paths were corrected in `search-query.ts` (K-questions 2); owners of other search callers should re-check.
- The browser's `resize_page` did not narrow the viewport in this session, so the 390 px layout is covered by class tests only.
