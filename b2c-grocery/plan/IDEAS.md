# Ideas (out of scope, parked)

Juniors: add unrelated ideas here instead of changing code outside your task. Format: `- [WS-letter] idea`.
- [G] Migrate `unstable_cache` (category tree, project locale settings) to the `use cache` directive if Cache Components is enabled later; Next 16 docs mark `unstable_cache` as replaced.
- [G] `products().search()` projections need the deprecated `productProjectionParameters`; revisit when commercetools offers a non-deprecated way to get scoped prices in search results.
- [G] German `fullText` search is token based ("milch" does not find "Vollmilch"); consider a `wildcard` query for P (search) if compound words matter.
- [G] Listing without text and sort has no explicit tiebreaker; if pagination ever shows duplicates add a secondary sort (e.g. `createdAt`).
