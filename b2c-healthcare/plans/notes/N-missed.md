# Workstream N: gaps and things other workstreams must pick up

- **Not called yet (O, Q, S, T):** `validateRxSelection` (O: `POST /api/cart/rx-lines` and cart load re-check), `consumeAuthorization` (Q: once at order creation, pass the line limits from `SelectedLine`), `restoreAuthorization` (S: cancel before `mlv-packed-shipped`), `checkReplenishmentRun` (T: before each standing run, record `recordedAs` on the standing order), `buildLineRecord` / `toLineCustomFields` (Q: line item custom type needs the fields `rxNumber`, `rxLineRef`, `prescribedQty`, `dispensedQty`, `authorizationParams`, `suppliedLots`; the line custom type is not in the seed yet, E/Q), `withSuppliedLots` and `promiseStillMet` (F-08 `advance-order` at the `packed` step; not wired).
- **Cart-load re-check of a lowered ceiling** is provided as a function (`validateRxSelection`), not wired: O must call it when the cart loads and remove or report refused lines (the platform also removes lines that violate a lowered native limit on the next cart update).
- **Monthly ceiling race:** two concurrent orders can both pass the count check (the refill decrement is race-safe, the count is not serialized). A per-patient-month counter Custom Object with `version` would close it.
- **No API Extension:** direct API calls bypass prescription and monthly limits (D-028, README "Known gap").
- **Short-dated channel and price are not in the seed** (see N-todos 7); until then short-dated stock is excluded, not offered.
- **Seed gap:** no line-item custom type and no inventory supply-channel seed for lots; a lot is a text on the order line, the inventory entry holds one worst-case date (Q-039).
- **Per-account minimum shelf life and ceiling overrides** are B2C-excluded and not built.
- **`useCart().addRxLines`:** only the placeholder `useAddRxLines()` exists; the add-to-cart route 404s until O ships.
- **Quick-pick/medication data is rendered on a server page for the owner only;** if a CDN ever caches `/prescriptions` it would leak: the page reads the session so it is dynamic, but Y (Netlify) should keep `cache-control: private` on it.
- **Chrome DevTools MCP was unavailable:** browser verification was done with `curl` against `MALVA_FIXTURES=1` (HTML and API assertions), not a rendered check of the layout (select-all, disabled rows, toast); the component tests cover the behaviour, a visual check is still open.
