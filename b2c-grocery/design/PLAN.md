# Implementation plan — MALVA storefront design

Inputs: `DESIGN.md`, `specs/*.md`, behavioral specs in `openspec/specs/`. Stack is not yet chosen in this repo
(`.nvmrc` only); the commercetools skills `nextjs-setup-project` / `nuxtjs-setup-project` scaffold either.

## Open decisions (block Phase 0)
1. **Skin vs. product**: MALVA is a luxury-decor design; the repo is a grocery starter. Confirm MALVA is the intended skin, and who designs the grocery-only pieces (slot picker, weight pricing, substitutions, recently ordered).
2. **Framework**: Next.js (>16) or Nuxt 4.
3. **Mobile**: web prototype is desktop only; `MALVA App.dc.html` exists in the design project. Confirm responsive web is enough or the app design governs small screens.
4. **Data truth**: "Made to order", finish/size/fitting options and reviews need real data models (product types / attributes).

## Phases

| # | Phase | Output | Depends on |
| --- | --- | --- | --- |
| 0 | Scaffold + decisions | Project, locale routing, lint | decisions 1–2 |
| 1 | Design tokens | `styles.css` tokens as CSS vars / Tailwind v4 theme; Caprasimo + Figtree loaded with `font-display: swap`; `.washed` image wrapper | 0 |
| 2 | Primitives | Button, Tag, Field/Input, Radio, Segmented, Card, Table, Dialog, Toast, Quantity stepper, Heart, Blob, Section heading, Product tile, Image placeholder | 1 |
| 3 | Chrome | Announcement bar, header (sticky blur, nav, search, saved, bag, account), compact nav, footer | 2 |
| 4 | Catalog pages | PLP (filters/sort/grid/pagination/empty), PDP (gallery, buy box, options, specs, related, reviews) | 2–3, commerce data |
| 5 | Homepage | Hero variants, category showcase, curated products, editorial, concierge; block renderer for the 7 content blocks | 2–3 |
| 6 | Bag + checkout | Cart page + toast + header count; checkout form, delivery, payment (Checkout/PSP), confirmation | 4 |
| 7 | Account | Sign-in/register/reset, dashboard, orders, addresses, payment methods, saved | 3, 6 |
| 8 | Hardening | Responsive pass, a11y audit, Lighthouse, visual regression vs. design source | all |

Phases 4 and 5 can run in parallel after 3; 6 needs 4.

## Block renderer (Canvas)
Pages are assembled from the 43 registry blocks. Build a registry keyed by block `type` (`hero`, `listing/grid`, `pdp/price`, `chrome/bagIndicator`, …)
with the field schemas in `DESIGN.md`. Resolver-driven blocks (listing/pdp/chrome) read page context; palette blocks read authored fields. Do this in phase 5 for content blocks, and expose listing/pdp blocks when 4 is stable.

## Responsive (proposal — not in the designs)
| Name | Width | Rules |
| --- | --- | --- |
| desktop | ≥1200 | as drawn, max 1360 |
| tablet | 768–1199 | rails collapse to sheets, grids 2-col, hero stacks |
| mobile | <768 | single column, compact nav + collapsed search, sticky purchase bars, tables → cards |

## Mapping to behavioral specs
| Design spec | OpenSpec capability |
| --- | --- |
| homepage | `home-landing-page`, `about-us`, `blog-resources` (journal) |
| plp | `product-listing-page`, `discovery-and-browse`, `search-results-page` |
| pdp | `product-detail-page`, `weight-based-pricing`, `out-of-stock-substitutions` |
| cart | `cart-page`, `cart-management`, `saved-lists` |
| checkout | `checkout-page`, `checkout`, `payment-methods`, `delivery-slot-booking`, `order-confirmation-page` |
| account | `account-dashboard`, `order-history`, `address-book`, `account-sign-in`, `password-reset`, `email-verification`, `subscriptions-and-recurring-orders` |

## Definition of done (per page)
Matches design at 1440 within token tolerance · no hard-coded hex/px that a token carries · keyboard and screen-reader pass · states from the spec implemented · session-specific data not cached · behavioral spec scenarios pass.

## Risks
Copy and images in the prototype are placeholders (captioned shots) — need an asset/copy source. Prototype business rules (free delivery > €800, MTO rule, €45/€12 prices) must not leak into production. Fonts from Google CDN: self-host for privacy/perf.
