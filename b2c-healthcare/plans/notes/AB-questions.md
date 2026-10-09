# Follow-up AB (medicine page): questions and the defaults chosen

| # | Question | Default chosen |
| --- | --- | --- |
| 1 | OTC "Add to cart": can the cart (O) carry a non-prescription line? | No. `addRxLines` / `POST /api/cart/rx-lines` only add lines bound to a prescription (rxNumber, rxLineRef, prescribed quantity, ceilings from the authorization). OTC therefore shows "Order from your prescription" (link to `/prescriptions`) and the gap is in AB-missed.md. |
| 2 | Order lines need the SKU to link the medicine name, but the privacy inventory test said an order line is exactly name, quantity, eligible, settledBy. | Added the catalog SKU (`OrderLineView.sku`, optional) and changed the allowlist in `scripts/privacy/inventory.test.ts`. A SKU adds nothing beyond the medication name the line already shows. Owner may veto: the order cards would then show plain names. |
| 3 | Product key from a SKU. | Seed convention `MED-<slug>` -> `mlv-med-<slug>` (`lib/medicine-key.ts`). Search hits use the product key directly. |
| 4 | Is the sitemap extended? | No: doctors are not listed either, and listing medicines needs a catalog read in the sitemap. The route-manifest test now asserts `/medicine/[key]` exists. Pages are indexable (canonical + hreflang through `pageMetadata`). |
| 5 | JSON-LD (optional). | Not added. |
| 6 | E2E port. | `playwright.config.ts` and `e2e/helpers.ts` read `E2E_PORT` (default 3120); the AB run used 3122. |
| 7 | Home prescription block link. | Not linked: the block names no particular medicine (it links to the prescription lookup). |
| 8 | Cacheability. | Same as the doctor page: React `cache()` per request. The page reads the session only for currency/country (the price context), never the customer. A CDN cache would need a per-region key; not done. |
