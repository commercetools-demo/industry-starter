# Workstream W: gaps and things other workstreams must pick up

- **Not wired into URL validation:** `routing.locales` and `proxy.ts` still use the unfiltered `COUNTRY_CONFIG` (G-missed). A region the project does not enable is hidden from the switcher and refused by `POST /api/locale`, but `/de-DE/...` still renders if someone types it (with the session region unchanged). Decide with the first real second region.
- **Cleared cart is known only from the session:** `cartCleared` is true when the session held a `cartId`. A signed-in patient whose session has no `cartId` but who has an old-currency Active cart gets no toast (the cart is ignored silently by the cart module).
- **Old carts are never deleted:** they stay Active until commercetools expires them. No job.
- **Product pages for medications do not exist yet** (no medication PDP in this repo), so only the doctor profile shows the "not available" card. `NotAvailableInRegion` and `Medication.sellableInRegion` are ready for the medication page; the cart add path is already protected because a prescription line with no price fails validation and the platform refuses a line without a price in the cart currency.
- **Doctor list, home page and search page read `fees`:** they exclude unpriced doctors through the search filter, but fixtures (`MALVA_FIXTURES=1`) do not model currencies.
- **Mobile menu has no region entry** (hidden under the `nav` breakpoint); H's `MobileMenu` should get one when a second region exists.
- **Currency filter in search is unproven live** (W-todos 4).
- **A shared test fake changed:** `test/fake-carts.ts` now honours a `var.currency` query variable and keeps the cart currency when recalculating (O's cart tests unchanged otherwise).
- `lib/types.ts`, `messages/en-US.json` (`region`), `Header*`, `app/[locale]/layout.tsx`, `app/api/cart/*` (pass the session currency), `lib/ct/cart.ts` and `lib/ct/search-query.ts` were edited additively.
