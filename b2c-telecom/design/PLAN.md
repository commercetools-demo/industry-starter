# Design implementation plan

Scope: turn the Malva Telecom Claude Design prototype (`source/`) into the Next.js storefront in `site/` (not yet created — see `openspec/specs/storefront-project-bootstrap`). Design detail is in `DESIGN.md` and `specs/`; behavior and commercetools modeling are in `openspec/specs/`.

## Spec mapping

| Design surface | `design/specs/` | OpenSpec capability |
| --- | --- | --- |
| Tokens, fonts, lint | `DESIGN.md` | `design-system-tokens` (new), `storefront-project-bootstrap` |
| Header, nav, footer | `shell.md` | `storefront-shell` (new) |
| Home | `homepage.md` | `home-landing-page` |
| Phone / wireless / cable PLPs | `plp.md` | `product-listing-page`, `plp-led-catalog-navigation` |
| Add-ons | `addons.md` | `offer-compatible-addons` |
| My bundle | `cart.md` | `cart-page`, `cart-management` |
| Log in | `login.md` | `account-sign-in` |
| My account | `account.md` | `account-dashboard` |
| Broadband Facts label | `broadband-label.md` | `broadband-facts-label` (new) |
| Not designed | — | `product-detail-page`, `search-results-page`, `checkout-page`, `order-confirmation-page`, `order-history`, `address-book`, `payment-methods`, `account-registration-request`, `password-reset`, `error-pages`, `faq`, `contact-us`, `about-us`, `policy-pages` |

## Phases

1. **Foundation** — scaffold (`/nextjs-setup-project`), tokens into `:root` + Tailwind `@theme`, `next/font` for Exo/Inter/Roboto, token parity check, design lint config from `_adherence.oxlintrc.json`. Exit: parity check green; a token-only demo page renders.
2. **Shell** — header, nav (from category tree), account/bundle slots (per-session), footer.
3. **Catalog UI** — plan card, filter chips, PLP template, add-on card, home (hero, promos, categories, popular add-ons). Needs the seeded catalog (`seed-catalog-data`, `telecom-catalog-model`).
4. **Bundle** — cart state in commercetools, line components, order summary, Broadband Facts label (requires label attributes in the catalog model).
5. **Account** — login, account dashboard (summary, contract table, labels).
6. **Gaps** — design the missing surfaces below, then build.

## Open decisions

| # | Decision | Default until decided |
| --- | --- | --- |
| D1 | Term: "bundle" vs "cart" in UI copy | Bundle in UI; cart in code and routes |
| D2 | Extend token scale for off-scale values (spacing 12/14/28/32/36/48/56/64; type 30/48/56; danger color) | Local "storefront extensions" block, flagged |
| D3 | Label data model: new attributes for typical speed/latency, ETF formula, equipment fee; store label at order time | Attributes added to `telecom-catalog-model` (the AT&T reference project, `plan/ATT-REFERENCE-MODEL.md`, has none of these); snapshot with order |
| D4 | Hero and category imagery | Pexels-sourced per `seed-product-images-pexels`; striped placeholder remains until then |
| D5 | Add-on logos (Spotify, Apple TV+, Netflix, Disney+ …) vs text banner; licensing | Text banner |
| D6 | Does "Choose plan" add to the cart immediately? | Yes (header count truthful) |
| D10 | Offer layer and handsets (decided 2026-10-07): `malva-offer` product type wraps sellable items; `malva-device` handsets in scope; plan card headline price = master variant; cable speed chips are `<= 500` / `> 500` Mbps bands | Specified in `telecom-catalog-model` and `seed-catalog-data` |
| D7 | Add-on incompatibility state (design has none; `offer-compatible-addons` requires it) | Design a disabled state with reason |
| D8 | Mobile layouts (none designed) | Fluid grids as in the prototype; collapse nav into a menu; design review before launch |
| D9 | Header search (none designed) vs `search-results-page` spec | Out of scope until designed |

## Known prototype defects not to copy

- `outline:none` on inputs with no focus style.
- Footer links and the footer "Support" are plain text.
- Raw `#fff`, `#a1262b` and off-scale px values (the design's own lint rules flag these).
- Client-side money arithmetic and fixture account data (account number, next bill date, contract rows).
- Cart note "label is shown on the left" does not match the layout.
- Hero is a placeholder; copy hard-codes prices.

## Re-sync procedure

Re-import with the DesignSync tool from project `d2b5e3bd-b378-4812-ba7f-800feef1257e` (files listed in `README.md`); diff `_ds/tokens.css` against the theme and run the parity check; update `DESIGN.md`/`specs/` where the prototype changed.
