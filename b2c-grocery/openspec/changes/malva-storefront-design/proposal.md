## Why

The storefront has behavioral specs but no visual or interaction design contract. A design now exists in Claude Design (project "MALVA Luxury Decor App", `4174979d-389a-49a2-be07-5a9c6875a8eb`) covering the web storefront and a page-builder block library. Without capturing it as specs, implementers will rebuild layout, tokens and states from screenshots and drift from the design.

## What Changes

- Add a design-system capability (tokens, typography, shared components, motion, responsive rules) derived from the "Organic" system used by the design.
- Add one design capability per page area: homepage, product listing, product detail, cart, checkout and confirmation, account.
- Layer on top of the existing behavioral specs; no existing requirement is changed.
- Reference material is persisted in `design/` (source imports, `DESIGN.md`, per-page notes, `PLAN.md`); these specs are the normative form of it.

## Capabilities

### New Capabilities
- `storefront-design-system`: tokens, type, shared components, chrome (header/footer/toast), motion and responsive breakpoints.
- `homepage-design`: hero variants, category showcase, curated products, editorial, concierge strip.
- `plp-design`: filter rail, toolbar, product grid, applied filters, pagination, empty state.
- `pdp-design`: gallery, sticky buy box, options, availability, specs, related, reviews.
- `cart-design`: bag lines, summary, empty state, toast, saved items.
- `checkout-design`: single-page checkout form, delivery options, summary, order confirmation.
- `account-design`: dashboard, orders table, address and details cards, sub-page patterns.

### Modified Capabilities
<!-- None: behavioral requirements in openspec/specs/ are unchanged. -->

## Impact

- New specs only; no code exists yet in this repo.
- Drives the future storefront implementation (framework not yet chosen) and its component library.
- Design is a luxury home-decor shop while this repo is a grocery starter: grocery behaviors (delivery slots, weight pricing, substitutions, recently ordered) have no drawn design and are listed as open questions in `design.md`.
