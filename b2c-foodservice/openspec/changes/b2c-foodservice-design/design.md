<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Malva Coffee: design notes

Source: VELA Storefront Claude Design project `c7cfe639-1d97-4577-aeac-1cb662ea1acb`, read on 2026-10-19 from the handoff zip in `design/export/` (the design sync tool is blocked by the organization's ZDR policy).

Brand name: "Malva Coffee" (the brief spelled it "cofee"; corrected here, please confirm).

## 1. What VELA is

A single-page React prototype (Babel in the browser, state in `App`, localStorage `vela_*`). Fictional activewear brand, B2C with a B2B mode behind a tweak. Pages: home, listing and search, detail, cart, checkout (3 steps), confirmation, account. Chrome: top bar, sticky header with mega menu, store pill, locale pill, cart drawer, mobile nav, footer. Product imagery is generated SVG garments (`garments.jsx`).

## 2. VELA to Malva mapping

| VELA | Malva Coffee |
| --- | --- |
| Garment SVGs | Photography: pack shots and lifestyle per product; same aspect ratios (5:6 card, 4:5 tile, 4:4.4 hero) |
| Categories: leggings, bras, tops, outerwear, accessories | Nespresso pods, Coffee, Machines, Accessories, Gifts |
| Variants: colourway x size | By shape: pods (system x pack), coffee (size x grind), machines (colour x bundle), accessories |
| Facets: activity, colour, size | Machine system, intensity, roast, brew method, origin, decaf/organic/fairtrade, colour |
| Pickup (BOPIS), 2 hours | Collection at Malva stores, readiness time per store |
| Fulfilment: pickup or ship | Collect, ship, subscribe |
| Size guide | Compatibility guide (Original vs Vertuo) and grind guide |
| Account: orders, pickup, saved, profile, settings | Adds subscriptions, addresses, payment methods |
| B2B mode (units, quotes, approvals, lists) | Not carried over |
| `money()` rounds to whole units, flat 8.875% tax | Two-decimal minor-unit money, tax-inclusive display in EU markets |
| Eyebrow "VELA Move" points | Optional; depends on Q7 |

## 3. Coverage

| Prototype area | Spec | Status |
| --- | --- | --- |
| Tokens, atoms | design-tokens-and-components | Specified; palette TBD (D2) |
| Header, mega menu, mobile nav, footer | design-storefront-shell | Specified |
| Store picker, locale chooser | design-store-picker-and-locale | Specified; store search made functional |
| Cart drawer | design-cart-drawer | Specified |
| Home | design-home-page | Specified; subscribe strip new |
| Product card | design-product-card | Specified |
| Listing and search | design-product-listing-page | Specified; URL state new |
| Detail | design-product-detail-page | Specified; subscribe, reviews new |
| Cart | design-cart-page | Specified; subscription group new |
| Checkout | design-checkout-page | Specified; validation new |
| Confirmation | design-order-confirmation-page | Specified; delivery and subscription notes new |
| Account and dashboard | design-account-area | Specified; four tabs new |
| Not designed anywhere | sign-in, registration, password reset, error pages, policy pages, about, contact, FAQ, blog | Behavioural templates exist in `openspec/specs/`; no visual design (section 6) |

## 4. Decisions

- D1. Keep VELA's structure and interaction model. Departures are listed in section 2 and in each spec.
- D2. Keep VELA's token names and, until the owner decides, its values (commercetools navy, violet, teal on warm canvas). A coffee palette (for example espresso ink and crema accent) is a value swap in `design-tokens-and-components`; no spec changes.
- D3. Money is integer minor units rendered with two decimals; unit prices (per capsule, per 100 g) are shown where pack size matters.
- D4. Collection availability comes from per-store inventory, not a flag; "available at my store" is a first-class filter and card line.
- D5. B2B (business units, quotes, approvals, purchase lists, SKU lookup) is out of scope. The brief says B2C. If cafés or offices should buy on account, that is a separate design.
- D6. Payment uses the hosted commercetools Checkout component. The prototype's card fields are a visual placeholder; the step keeps its place and copy.
- D7. Filters, sort and page live in the URL.
- D8. Required variant choices (grind, machine colour) are never defaulted silently by quick add.

## 5. Open questions

- Q1. Spelling and legal brand name: "Malva Coffee"?
- Q2. Brand palette and type: keep commercetools tokens or re-skin (D2)?
- Q3. Countries, languages and currencies Malva sells in; VELA lists 25 countries as a placeholder.
- Q4. Does Malva sell Nespresso-brand capsules or Nespresso-compatible capsules? This changes naming, imagery and trademark use throughout.
- Q5. Free-shipping threshold, collection readiness time, return window (VELA: 75, 2 hours, 90 days).
- Q6. Timed delivery slots (as in grocery) or standard carrier delivery only?
- Q7. Loyalty points: offered or not?
- Q8. Which products are subscribable, and which intervals?
- Q9. Which stores collect, and do any have a café (seating, drinks), or collection only?
- Q10. Accessory and gift sets: bundles as one product or separate lines?

## 6. New designs needed (not in the VELA prototype)

1. Subscribe and save: PDP option, home strip, cart group, account tab with skip, pause, cancel.
2. Product reviews: summary, distribution, list, write a review.
3. Saved addresses and saved payment methods screens.
4. Store search with results and map or list toggle.
5. Compatibility guide and grind guide modals.
6. Coffee-specific PDP facts: intensity bar, flavour notes, origin, roast.
7. Delivery slot picker (if Q6 is yes).
8. Sign-in, registration, password reset, error and policy pages, content pages (about, FAQ, blog, contact).
9. Mobile specifics: sticky add bar on the PDP, bottom-sheet store picker.
10. Error and out-of-stock states for substitutions (the template `out-of-stock-substitutions` exists).

## 7. Prototype issues not to copy

- Money rounded to whole numbers; flat added tax; hard-coded threshold (75) and tax rate in components.
- Filters and route in memory only; no URL.
- Quick add silently picks size M or "One size".
- Checkout has no validation; payment is a mock card form.
- Store search field is static text.
- Newsletter and Join do nothing.
- Footer links all route to the shop.
- Account profile values are hard-coded to the demo user.
