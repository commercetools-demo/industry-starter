# design/

Design artifacts imported from the Claude Design project **Malva Healthcare** (`f22d9608-5e56-499a-99b0-82b84cda2b28`, files `Malva App.html` and `Malva Healthcare.html`), which uses the **Healthcare** design system project (`8f4e291a-5553-4159-8816-b4c3f0f7742c`, mirrored in `../../design-systems/healthcare/`).

- `DESIGN.md` — tokens, typography, component inventory, route/page inventory, data and copy observed in the prototype, defects not to copy
- `PLAN.md` — build phases, open decisions, mapping to `openspec/specs/`
- `source/` — raw imports (reference only)
  - `Malva Healthcare.html` — marketing home page (static HTML/CSS)
  - `Malva App.html` + `app-core.jsx`, `app-doctors.jsx`, `app-rx.jsx`, `app-account.jsx`, `app.css` — the hash-routed React prototype (doctor search and booking, prescriptions, cart, checkout, order, account, labs)
  - `_ds/` — `tokens.css` (source of truth; identical to `design-systems/healthcare/tokens.css`), `README.md`, `_adherence.oxlintrc.json`, `_ds_manifest.json`, `_ds_bundle.js`

The HTML files load React/Babel from unpkg and `_ds/healthcare-8f4e291a-…/tokens.css`; to open them locally, place `_ds/` content under `_ds/healthcare-8f4e291a-5553-4159-8816-b4c3f0f7742c/` next to the HTML. `_ds_manifest.json` has its token list trimmed (identical to `tokens.css`) and `_adherence.oxlintrc.json` has its token allow-list trimmed for the same reason; the lint rules themselves are verbatim.

The design-system preview cards (`foundations/*.html`, `components/*.html`) live in `design-systems/healthcare/`, not here. Where the prototype and the DS cards differ, the prototype is the authority.

Behavioral specs for each surface are OpenSpec capabilities named `design-*` in `../openspec/specs/` (see `PLAN.md`).

Re-import from Claude Design when the design changes; `tokens.css` is the only file whose changes must be propagated to the storefront.
