# Malva B2B2C automotive: design

Source: Claude Design project `3293b298-0f79-4816-a58f-e98365f58842` (read on 2026-10-12 through the design sync tool).

## What is stored

`export/` holds verbatim copies of the project files:

| File | What it is |
| --- | --- |
| `Reseller Storefront.dc.html` | Shopper storefront prototype (home, listing, product, cart, checkout, confirmation, store picker) |
| `Malva Seller Portal.dc.html` | Partner/seller portal prototype (about 28 pages and overlays) |
| `tokens.automotive.css` | Storefront tokens; identical to `design-systems/automotive/tokens.css` |
| `tokens.admin.css` | Portal tokens (admin design system) |
| `admin-design-system.README.md` | Admin kit principles |
| `github.md` | Sync note: portal screens were derived from `commercetools-demo/b2b2c-starter` `FEATURES.md` |
| `support.js` | Prototype runtime (`dc-runtime`), needed to open the `.dc.html` files |

Not stored: `_ds_bundle.js` (empty placeholder), `_ds_manifest.json` and `_adherence.oxlintrc.json` (generated token indexes and a lint config, rebuildable from the token files), `styles.css` (one `@import`), and `Canvas.dc.html` (empty). The automotive kit's component files live in `design-systems/automotive/`.

To view a prototype, serve this folder over HTTP and open the file. They expect `_ds/<kit>/tokens.css` paths, so copy the matching token file there, or edit the `<link>` to `tokens.automotive.css` / `tokens.admin.css`.

## Specs

Design specs are in `../openspec/specs/`:
`consumer-storefront/theming-design`, `consumer-storefront/design-*`, `seller-portal/design-*`. The plan and decisions are in `../openspec/changes/b2b2c-automotive-design/` (`proposal.md`, `design.md`, `tasks.md`).
