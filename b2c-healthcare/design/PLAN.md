# Design implementation plan

Scope: turn the Malva Healthcare Claude Design prototype (`source/`) into the Next.js storefront (not yet created). Visual detail is in `DESIGN.md`; behavior and commercetools modeling are in `openspec/specs/`.

## Spec mapping

| Design surface | OpenSpec design capability (new) | Existing behavior capabilities it composes |
| --- | --- | --- |
| Tokens, fonts, lint | `design-system-tokens` | — |
| Nav, footer, sign-in slot, cart count | `design-storefront-shell` | `authentication-and-identity`, `switching-region-or-language` |
| Home | `design-home-page` | `home-landing-page`, `discovery-and-browse` |
| Doctor list + prescription lookup | `design-plp` | `product-listing-page`, `search-results-page`, `prescription-bound-supply` |
| Doctor profile + booking, booking confirmation | `design-pdp` | `product-detail-page`, `credentialed-purchase-scope` |
| Cart | `design-cart` | `cart-page`, `cart-management`, `dispensing-quantity-limit`, `prescription-bound-supply` |
| Checkout + order confirmation | `design-checkout` | `checkout-page`, `checkout`, `order-confirmation-page`, `payment-methods` |
| Sign-in, account, labs, appointments, orders | `design-account-area` | `account-sign-in`, `account-dashboard`, `order-history`, `post-purchase-order-management`, `health-data-minimization` |
| Not designed | — | `address-book`, `payment-methods` (UI), `account-registration-request`, `password-reset`, `error-pages`, `faq`, `contact-us`, `about-us`, `policy-pages`, `blog-resources`, `saved-lists`, `subscriptions-and-recurring-orders` |

The `design-*` capabilities own *what it looks like and how the surface behaves*; the existing capabilities own domain rules. Where a `design-*` requirement overlaps one, the `design-*` text cites it rather than restating it.

## Phases

1. **Foundation** — scaffold (`/nextjs-setup-project`), tokens into `:root` + Tailwind `@theme`, `next/font` for Poppins/Lato/Roboto, token parity check, design lint from `_adherence.oxlintrc.json`. Exit: parity check green; token-only demo page renders.
2. **Shell** — nav (with mobile menu), footer, sign-in/avatar slot, cart count (per session).
3. **Catalog UI** — doctor card, filter bar, doctor list (remote/office), medication row, prescription lookup, home. Needs the seeded catalog: doctors as bookable offerings with schedules, medications with Rx binding.
4. **Booking and cart** — doctor profile, slot picker, booking modal/confirmation; cart, summary.
5. **Checkout** — address, delivery, payment widget, order confirmation and tracking.
6. **Account** — sign-in/up, overview, lab list/detail, appointments, orders.
7. **Gaps** — design the undesigned surfaces (see `DESIGN.md`), mobile layouts, then build.

## Open decisions

| # | Decision | Default until decided |
| --- | --- | --- |
| D1 | What is a "product"? Doctor consultation (service with slots), medication (Rx-bound), lab test | Doctors modeled as bookable offerings outside the cart (booking pays at visit); medications are cart line items; lab tests read-only in v1 |
| D2 | Container: tokens say 1440px, prototype uses 1200px + 32px padding | 1200px (what was designed) set as `--container-content`; keep `--container-width` token verbatim |
| D3 | Off-system status text colors (`#067a05`, `#8a5d00`, `#0a6f8c`, `#b3402a`) | Add `*-700` tokens in a flagged "storefront extensions" block |
| D4 | White on `brand-500` fails AA (~2.6:1) | Keep azure fill, use `--color-navy-900` label text for primary buttons until the design owner confirms |
| D5 | Booking payment: prototype says "pay at the visit" | Honour it; no payment step for bookings in v1 |
| D6 | Guest booking vs health data: guest "reason for visit" is health data | Allow guest booking; collect reason, apply `health-data-minimization` retention, show consent line |
| D7 | Prescription verification: RX number alone vs also DOB/patient match | RX number lookup requires sign-in and the RX must belong to the signed-in patient; see `prescription-bound-supply` |
| D8 | Same-day delivery cut-off and fee ($5.00) | Shipping method with rate from the platform; show only if the cut-off allows |
| D9 | Hero/blog/doctor imagery (placeholders in design) | Placeholders remain until photography is supplied; avatars stay initials-on-peach |
| D10 | Mobile layouts (only a 900px collapse; nav hidden, no menu) | Fluid grids as prototyped; add a menu; design review before launch |
| D11 | Header search on home is non-functional | Wire to `search-results-page`; scope doctor name/specialty/medicine |
| D12 | Lab tests: who orders, can a patient book one? Home promises "book tests at home or at a lab" but no booking UI exists | Out of scope; results viewing only |
| D13 | Mental health, Second opinion, Health journal links (`#`) | Hide until designed |

## Re-sync procedure

Re-import with the DesignSync tool from project `f22d9608-5e56-499a-99b0-82b84cda2b28` (files listed in `README.md`); diff `source/_ds/tokens.css` against the theme and run the parity check; update `DESIGN.md` and the `design-*` specs where the prototype changed.
