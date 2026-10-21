# P-00 paths found (develop at start of P)

| Need | Where | State |
| --- | --- | --- |
| Footer link config | `storefront/lib/nav/footer-config.ts` (`FOOTER_COLUMNS`, `FOOTER_LEGAL`, `BUILT_ROUTES`, `footerHref`) | exists; P adds its routes to `BUILT_ROUTES` |
| Promise figures | `storefront/lib/ct/promise.ts` `getPromiseFigures(market, storeKey)` | exists (server-only, each part fails alone) |
| Store picker opener | `useCollectionStore().open()` (`hooks/useCollectionStore.ts`), button `components/layout/FooterStoreButton.tsx` | exists; P reuses `FooterStoreButton` |
| Search route (G) | not built yet | 404 page search form targets `/search` through `lib/routes.ts` `searchHref()` (default, Q-P-16) |
| Checkout consent links (K) | not built yet | P-12 second part blocked on K; recorded in `todo-P.md` |
| Account guard (L) | not built yet | expired-session scenario cannot be tested until L; recorded |
| Product not-found (H) | not built yet | status check in the recipe is limited to the catch-all route |
| Rate limiter (J) | `lib/rate-limit.ts` not built yet | P ships `lib/contact/rate-limit.ts` with the same call shape `rateLimit(key, { limit, windowMs })`; unify later (Q-P-4) |
| Account/auth routes | not built | stay out of `BUILT_ROUTES` (J and L enable them) |
