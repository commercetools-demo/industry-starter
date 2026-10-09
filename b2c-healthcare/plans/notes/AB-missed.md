# Follow-up AB: gaps

- **OTC add to cart is not built.** The cart (O) carries prescription-bound lines only (`addRxLines`, line custom fields `rxNumber`/`rxLineRef`, the cart validator `getCartValidated` re-checks every line against a prescription, and `CartLine` requires `rxNumber`). A non-prescription line needs: a cart line type without rx fields, validation that skips the authorization but keeps the per-order and monthly ceilings, shelf-life and credential checks, a quantity UI, checkout/order handling for lines with no prescription to consume (Q), and reorder/list handling. That is a redesign, so OTC shows "Order from your prescription". Decision needed from the owner.
- The medicine page shows no reviews, no substitutes and no "similar medicines".
- The short-dated price is read from the `mlv-short-dated` price channel; the seed has none (N-todos 7), so short-dated stock currently shows as "Unavailable for now".
- Sitemap does not list medicine pages (no catalog enumeration there).
- Stock is read from inventory without a supply channel (the same single worst-case date as N).
- Medicine images in fixtures mode are always the placeholder (no Pexels URLs in the seed data until AC adds them).
