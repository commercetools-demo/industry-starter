# P — Search

**Specs:** `grocery-storefront-features` → `search-design` (all); existing behavior `search-results-page`
**Depends on:** G, H, K · **Unblocks:** — · **Sign-off:** SO-09

## Goal
`/[locale]/search?q=…&page=N` finds products by name, shows suggestions when empty, and paginates at 24.

## Design
- Route `app/[locale]/search/page.tsx` (Server): reads `q` (trimmed, max 100 chars) and `page`; `q` empty → suggestions only (no search call); else `searchProducts({ text: q, page, pageSize: 24, … })`. Result label `search.found` ("{count} found for “{query}”"); zero results message with link to `/shop`.
- Input `components/search/SearchInput.tsx` **(client)**: 58 px high, 20 px font, pill, padding-inline 24 px; updates `?q=` via `router.replace` **debounced 300 ms** (`lib/useDebouncedCallback.ts`); `type="search"`, `aria-label` from messages; Enter submits immediately.
- Suggestions `search.suggestions` array in messages as outline `Tag` links to `?q=<term>` (en-US: Fresh, Vegan, Bakery, Organic, Gifts, "Under $5"; de-DE: Frisch, Vegan, Backwaren, Bio, Geschenke, "Unter 5 €"); the "Under" term is a plain text search, not a filter.
- Results reuse `ProductGrid` and `Pagination` from K (pagination base path `/search` with `q` preserved).
- Header search pill (H) already links to `/search`.
- Text search uses `fullText` on `name` in the active locale (G); also exact match on SKU if `q` matches `^[A-Za-z0-9-]{4,}$` (OR clause) — documented in `buildSearchRequest`.

## Tasks
- [ ] P-01 Write `lib/useDebouncedCallback.ts` + tests (fake timers: 300 ms; latest call wins; cancel on unmount).
- [ ] P-02 Write `SearchInput` + tests: typing updates URL once after 300 ms; Enter updates immediately; accessible name present.
- [ ] P-03 Write the page + suggestions + messages (both locales) + tests (mock `searchProducts`): empty query shows tags and does not call search; query shows label/count and grid; no match shows message and shop link; `page=2` passes page 2; `q` longer than 100 chars is truncated.
- [ ] P-04 Extend `buildSearchRequest` (G) for the SKU-OR clause with tests; keep K's tests green.
- [ ] P-05 Report manual tests M-P-1…M-P-3 and sign-off SO-09.

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
