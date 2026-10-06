# P — Search

**Specs:** `grocery-storefront-features` → `search-design` (all); existing behavior `search-results-page`
**Depends on:** G, H, K · **Unblocks:** — · **Sign-off:** SO-09

## Goal
`/[locale]/search?q=…&page=N` finds products by name, shows suggestions when empty, and paginates at 24.

## Design
- Route `app/[locale]/search/page.tsx` (Server): reads `q` (trimmed, max 100 chars) and `page`; `q` empty → suggestions only (no search call); else `searchProducts({ text: q, page, pageSize: 24, … })`. Result label `search.found` ("{count} found for “{query}”"); zero results message with link to `/shop`.
- Input `components/search/SearchInput.tsx` **(client)**: 58 px high, 20 px font, pill, padding-inline 24 px; updates `?q=` via `router.replace(`${pathname}?${qs}`)` (`usePathname`/`useRouter` from `@/i18n/routing`) **debounced 300 ms** (`lib/useDebouncedCallback.ts`); `type="search"`, `aria-label` from messages; Enter submits immediately.
- Suggestions `search.suggestions` array in messages as outline `Tag` links to `?q=<term>` (en-US: Fresh, Vegan, Bakery, Organic, Gifts, "Under $5"; de-DE: Frisch, Vegan, Backwaren, Bio, Geschenke, "Unter 5 €"); the "Under" term is a plain text search, not a filter.
- Results reuse `ProductGrid` and `Pagination` from K (pagination base path `/search` with `q` preserved).
- Header search pill (H) already links to `/search`.
- Text search uses `fullText` on `name` in the active locale (G); also exact match on SKU if `q` matches `^[A-Za-z0-9-]{4,}$` (OR clause) — documented in `buildSearchRequest`.

## Tasks
- [x] P-01 Write `lib/useDebouncedCallback.ts` + tests (fake timers: 300 ms; latest call wins; cancel on unmount).
- [x] P-02 Write `SearchInput` + tests: typing updates URL once after 300 ms; Enter updates immediately; accessible name present.
- [x] P-03 Write the page + suggestions + messages (both locales) + tests (mock `searchProducts`): empty query shows tags and does not call search; query shows label/count and grid; no match shows message and shop link; `page=2` passes page 2; `q` longer than 100 chars is truncated.
- [x] P-04 Extend `buildSearchRequest` (G) for the SKU-OR clause with tests; keep K's tests green.
- [x] P-05 Report manual tests M-P-1…M-P-3 and sign-off SO-09.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Empty search | P-03 |
| Matching query / No match | P-03 |
| Shared link | P-03 (server reads `q`) |

## Manual tests to report
- M-P-1: Search "milk": Whole milk and Oat drink appear; count line correct.
- M-P-2: Search "zzzz": no-match message with link to shop.
- M-P-3: Open `/de-DE/search?q=milch` (if German names seeded): results appear; suggestions are German.

## Definition of done
Debounce verified; URL is the state; both locales; `verify` passes.

## Implementation notes (deviations, recorded by the developer)
- **Text search is broader than the plan's `fullText` + SKU** (`lib/ct/search.ts` `textQuery`): `or[fullText name, wildcard "*q*" on name (caseInsensitive, `*?\` escaped), exact variants.sku (caseInsensitive, only when `^[A-Za-z0-9-]{4,}$`)]`. Reason (verified live, PROJECT-FINDINGS 4a): `fullText` is token based, so German `milch` finds nothing for "Vollmilch 1 l" and `mil` finds nothing for "Whole milk"; the wildcard gives substring matching in both locales, `fullText` keeps whole-word matching. Combined with other filters by AND (K's listing is unaffected: it passes no `text`). See Q-P-1.
- Names only are searched (plus SKU), so "milk" finds "Whole milk 1 L" but not "Oat drink 1 L"; M-P-1 was corrected accordingly.
- `useDebouncedCallback(cb, ms)` returns the tuple `[debounced, cancel]` (a function with a `cancel` property failed the React-compiler lint rule `react-hooks/refs`).
- `lib/search-query.ts` holds `MAX_QUERY_LENGTH`, `parseSearchQuery` (trim, 100 chars) and `parseSearchPage`; they are shared by the page (Server) and `SearchInput` (client) and cannot live in either (a Next page may not export extras; constants exported from a client module are not values on the server).
- `SearchInput` keeps its text in local state and syncs from `initialQuery` only when the URL `q` changed from outside (a suggestion tag link), never for its own navigations, so a slow render cannot overwrite typing. Any input change drops `page` (only `q` is written).
- The page uses the URL locale's market (as K's shop page, D-012). A `page` beyond the last page redirects to the last page (like `/shop`). Result count is in a `role="status"` paragraph. Not built: relevance sort controls, filters on search results (not in the plan).
- Message keys added (both locales): `search.{inputLabel,kicker,title,suggestionsLabel,suggestions[],found,none.title,none.body,none.browse}`. German is machine-translated (see IDEAS).
