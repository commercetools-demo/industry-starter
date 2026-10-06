# Ideas (out of scope, parked)

Juniors: add unrelated ideas here instead of changing code outside your task. Format: `- [WS-letter] idea`.

## From orchestrator browser tests (2026-10-06)
- `/favicon.ico` returns 404 (no icon yet). Add `app/icon.*` (brand mark) — small, any workstream after H.
- [H] `hooks/useLocaleSwitch.ts` calls `fetch('/api/locale')` directly because `lib/fetcher.ts` (G-02) is not merged yet; switch it to `sendJson` once G is merged.
- [H] Footer shop links hold per-locale category slugs in `messages/*.json` (`footer.slugs.*`) to avoid a data call in the footer; when G-08/K expose the category tree, derive the links (and labels) from it.
- [H] Machine-translated German keys to review: `common.announcement`, `nav.searchPill/menu/closeMenu/primary/home`, `footer.*`, `a11y.language`.
- [H] Announcement bar text is generic ("Fresh groceries ... delivered to your door") because delivery thresholds must not be hard-coded (D-021, D-049); owner may want a different message.
- [H] Header on compact widths hides the search pill and saved icon below `tablet` (they are in the menu drawer); revisit when SO-01 is reviewed.
- [G] Migrate `unstable_cache` (category tree, project locale settings) to the `use cache` directive if Cache Components is enabled later; Next 16 docs mark `unstable_cache` as replaced.
- [G] `products().search()` projections need the deprecated `productProjectionParameters`; revisit when commercetools offers a non-deprecated way to get scoped prices in search results.
- [G] German `fullText` search is token based ("milch" does not find "Vollmilch"); consider a `wildcard` query for P (search) if compound words matter.
- [G] Listing without text and sort has no explicit tiebreaker; if pagination ever shows duplicates add a secondary sort (e.g. `createdAt`).

## From workstream J
- [J] `hooks/useLocaleSwitch.ts` still calls `fetch('/api/locale')` directly (G-02 `sendJson` now exists); switching it is a tiny follow-up in H's area.
- [J] German keys to review (machine-translated): `nav.bagCount`, all of `cart.*`.
- [J] A line's name is not a link to the PDP yet (the PDP route comes with L); add the link (and a thumbnail link) when `/product/[slug]` exists.
- [J] `getAvailableQuantity` is one inventory call per add/change; a batch `getAvailableQuantities(skus)` would help if the cart page ever revalidates stock per line.
- [J] Undo after Remove re-adds with the default substitution preference (the removed line's preference is not restored).

## From workstream K
- [K] Loading skeleton (`app/[locale]/shop/loading.tsx`) with tile-height placeholders and an inline retry card (design "States") are not built.
- [K] Optional category description under the H1 (`showDescription`) once categories carry descriptions.
- [K] German keys to review (machine-translated): all of `plp.*`.
- [K] `SaveButton` and `useSaved` are stubs until T; T must replace `hooks/useSaved.ts` only.
- [K] Quick add-to-bag on tiles (not drawn) could use `useCartContext().addItemWithToast`.
- [L] German keys to review (machine-translated): all of `pdp.*`.
- [L] Mobile PDP from `design/specs/pdp.md` ("Responsive (proposed)"): the swipe carousel with dots and the sticky bottom bar (price + Add to bag) below 768 px are not built; the page stacks gallery and buy box instead.
- [L] `addItemWithToast` could return `{ ok, available }` (or take an `onInsufficient` callback) so the PDP can show the inline "Only N available" for a server-side 409 too, not only for the client-side check.
- [L] `marketFor(locale)` (`lib/market.ts`) duplicates the private helper in `app/[locale]/shop/page.tsx`; switch the shop page to it, or fix the root cause in Q-K-1.
- [L] "Pairs with" shows the first 4 other products of the first category; it could use `substituteProductIds` or an explicit pairing attribute later.
- [K] Facet counts cost up to 3 extra lean searches when category, price and stock are all active; cache or merge if search latency becomes an issue.
