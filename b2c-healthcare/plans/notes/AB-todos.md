# Follow-up AB: live steps (need the project and an API client)

Commands run from `b2c-healthcare/site`.

1. After a seed, open `/en-US/medicine/mlv-med-ibuprofen-400-mg`: name, strength, form, pack, price $6.20, "Over the counter", HSA/FSA badge, limit 5, gallery from the product images (Pexels, once AC has stored them).
2. `/en-US/medicine/mlv-med-famotidine-20-mg`: stock date 2026-11-15; after 2026-10-16 the page says "Unavailable for now" (or "Short-dated" once a `mlv-short-dated` price exists).
3. `/en-US/medicine/mlv-med-alprazolam-0-5-mg`: the controlled notice is shown and the page still renders.
4. `/en-US/medicine/mlv-med-nope`: HTTP 404 with "Medicine not found."
5. Confirm the product projection read with `expand=masterVariant.prices[*].channel` and the inventory query return what `lib/ct/medicines.ts` expects (same assumptions as N-todos 4 and 5).
6. Region: with a second region and no price in its currency the page shows "Not available in this region" (W-todos 5).
7. Check DevTools Network on the page: no request carries a patient id or RX number; the page makes no call other than the document and images.
