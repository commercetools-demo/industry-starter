# design/

Design artifacts imported from Claude Design project **Malva Telecom website design** (`d2b5e3bd-b378-4812-ba7f-800feef1257e`), which uses the **Telecom** design system project (`82a17f5a-491a-496f-8d92-5152f6f7e349`).

- `DESIGN.md` — tokens, typography, component inventory, page inventory, copy/data observed in the prototype
- `PLAN.md` — build phases, open decisions, mapping to `openspec/specs/`
- `specs/` — per-surface design specs: `shell.md`, `homepage.md`, `plp.md`, `addons.md`, `cart.md`, `login.md`, `account.md`, `broadband-label.md`
- `source/` — raw imports (reference only)
  - `Malva Telecom.dc.html` — the full prototype (home, PLPs, add-ons, login, bundle/cart, account)
  - `BroadbandLabel.dc.html` — FCC-style "Broadband Facts" label component
  - `support.js` — Claude Design `dc` runtime (generated; needed only to open the `.dc.html` files)
  - `_ds/` — `tokens.css` (source of truth), `README.md`, `_adherence.oxlintrc.json`, `_ds_manifest.json`, `_ds_bundle.js`

The `.dc.html` files render in a browser via `support.js` (they load `_ds/tokens.css` relative to themselves). `_ds_manifest.json` has its token list trimmed (identical to `tokens.css`) and `_adherence.oxlintrc.json` has the token allow-list trimmed for the same reason.

Not imported (present in the Telecom DS project, not requested): `foundations/*.html`, `components/*.html` preview cards and `tokens.json`. The prototype is the authority where it and the DS cards differ.

Re-import from Claude Design when the design changes; `tokens.css` is the only file whose changes must be propagated to the storefront (see `PLAN.md`).
