# Malva — plan

Behaviour specs, design and tasks: `../../openspec/changes/malva-website/` (`proposal.md`, `design.md`, `tasks.md`, `specs/`). This file holds the design-side plan and open decisions.

## Mapping: requested pages → design

The request names Homepage, PLP, PDP, Cart, Checkout, Account. The prototype is a marketing site for a quoted-services business, so each maps as follows:

| Requested | Malva meaning | In the prototype? | Design spec |
| --- | --- | --- | --- |
| Homepage | Home | Yes (`#home`) | `specs/homepage.md` |
| PLP | Plumbing services / Waste management services | Yes (`#plumbing`, `#waste`) | `specs/plp.md` |
| PDP | Service detail | **No** (cards link to `#quote`) | `specs/pdp.md` (proposed) |
| Cart | Quote list | **No** | `specs/cart.md` (proposed) |
| Checkout | Request a quote / contact (3 steps) | Yes (`#quote`) | `specs/checkout.md` |
| Account | Client portal | Sign-in modal only | `specs/account.md` (proposed) |
| About | About | Yes (`#about`) | covered in `homepage.md` patterns; see openspec `malva-about` |

## Phases

1. **P0 Foundations** — tokens, Inter fonts, layout shell (top bar, nav, footer, mobile menu), content model for services.
2. **P1 Content pages** — Home, Plumbing, Waste, About.
3. **P2 Service detail and quote list** — PDP, add to quote list.
4. **P3 Request a quote** — 3-step form, submission to sales, confirmation email.
5. **P4 Client portal** — sign-in, overview, visits, waste documents, invoices, quotes, sites, team.
6. **P5 Hardening** — accessibility pass, Lighthouse, SEO, analytics, launch content sign-off.

## Open decisions (owner input needed)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Stack: the monorepo siblings use Next.js 16 + commercetools | Same: Next.js App Router, BFF to commercetools |
| D2 | Services as commercetools **Products** (no price) vs CMS-only content | **Decided: Products** in two categories, so the quote list is a real Cart and quotes use the Quote Request lifecycle; long-form content in product attributes or a CMS |
| D3 | Guest quote list allowed? | Yes (anonymous cart), merged at sign-in |
| D4 | Portal access: self-registration vs invited | **Decided: open registration.** Registration creates customer + company (Business Unit) + admin association; email verification gates all data; abuse limits (see `malva-client-portal`) |
| D5 | Source of visits, waste notes, invoices | **Open.** Assumed: commercetools holds Business Units, quote requests, quotes and orders only; visits, waste documents and invoices stay behind a seeded `PortalDataSource` interface until the owner names a source |
| D6 | Real stats, testimonials, registration number, phone numbers, email | **Decided:** show as sample, labelled "Sample content"; launch check fails while any remains |
| D10 | Commercetools project | **Decided:** a separate project reached through the `spec-b2b-manufacturing` MCP (the health project is not used). *Not connected in the session that wrote this plan.* |
| D11 | Prospects without an account | **Decided:** registration first (platform forbids Quote Requests from anonymous carts); auto-verified, no email |
| D12 | Services without a price | **Verified:** a variant needs a price to enter a cart; services carry a hidden USD 0 price |
| D7 | Locale / region | Phone formats and "Reg. no." suggest UK; confirm English-only, GB |
| D8 | Photography | 12 service images, hero, team/fleet, CCTV survey; commission or licence |
| D9 | Where this lives | **Decided: `b2b-manufacturing/`** (owner-confirmed). Foundation specs: `openspec/changes/bootstrap-malva-storefront` |

## Shot list

Hero (technician at an industrial plant) · Plumbing pillar · Waste pillar · one image per service (12) · CCTV drain survey · team and fleet.
