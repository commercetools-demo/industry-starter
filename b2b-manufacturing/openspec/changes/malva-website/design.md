## Context

Malva is a quoted-services B2B business. The visual design is final enough to build from for Home, Plumbing, Waste, About and Request a quote; PDP, quote list and the portal interior are proposed by derivation. See `design/malva/DESIGN.md` (tokens, components, gaps) and `design/malva/PLAN.md` (mapping and open decisions). Siblings in this monorepo use Next.js 16 on commercetools with a BFF; this design follows that.

## Goals / Non-Goals

**Goals:** a fast, accessible, SEO-friendly marketing site; a short path to a quote request from every page; a client portal that gives contracted clients their visits, waste documents and invoices.

**Non-Goals:** online payment, price display, self-service contract changes, a CMS product decision, translating the site.

## Decisions

### 1. Design system reuse
Tokens come from `design/malva/source/colors_and_type.css` unchanged and become CSS variables (and Tailwind v4 theme values if the Next.js stack adapter is used). Sharp buttons and inputs, 8px cards, navy as the only accent. Inter and Inter Display are self-hosted. **Why:** the design system is the source of truth; **alternative** — re-skinning — was not requested.

### 2. Services are commercetools Products with a hidden zero price
Two Categories (`plumbing`, `waste-management`) with the 5 and 7 services as Products of one ProductType `service` (attributes: audience sectors, frequency options, included items, compliance records produced, related services, FAQ). **Verified against the docs (2026-10-08):** a line item needs a Price matching the cart currency, and a variant without one cannot be added to a Cart ("price on request"). So every service variant carries one USD price of 0, never displayed; the real price comes from the Quote. *Alternative:* an `externalPrice` on each line item — rejected, it moves pricing logic into the BFF for no benefit. **Why:** the quote list becomes a real Cart and the Quote Request lifecycle applies, rather than a bespoke form store. **Decided (owner): commercetools Products.** The rejected alternative was content in a CMS plus a plain form posting to email. Foundation and store model: `openspec/changes/bootstrap-malva-storefront`.

### 3. Quote list is a Cart; submission is a Quote Request
Visitors get an anonymous Cart (totals never shown); signed-in clients use the BU-scoped cart through the associate API (`asAssociate().…inBusinessUnitKey()`), per the B2B storefront guidance. **Verified platform rules (docs, 2026-10-08):** a Quote Request cannot be created from an anonymous Cart, from a Cart with `shippingMode: Multiple`, or from a Cart with Discount Codes; the source Cart must have a `shippingAddress`; the buyer needs the `CreateMyQuoteRequestsFromMyCarts` permission. **Decided (owner): registration first.** Step 3 of Request a quote creates the account (open registration, auto-verified, no email), then the anonymous Cart is carried into the new Business Unit, the site address becomes the shipping address and the Quote Request is created; there is no separate lead object. Contact, sector, number of sites, frequency and waste details are custom fields on the Quote Request. Seller side (Staged Quote, Quote) is handled in the Merchant Center. Email: none in this release (owner decision); on-screen confirmations and the Merchant Center replace it.

### 4. Client accounts are Business Units
One Business Unit per client company, with sites as child units or addresses, and Associates with roles (Admin, Site contact, Finance). **Registration is open** (D4, owner-confirmed): the registrant becomes the company's first administrator; accounts are auto-verified because there is no email provider (owner decision), with the verified flag kept so real verification can be added; the abuse risk this creates is handled in `malva-client-portal` (rate limits, password rules). Open registration replaces the approval-held flow of the manufacturing specs. Sign-in uses the commercetools login endpoint from the BFF; the browser never holds commercetools credentials.

### 5. Portal data (visits, waste notes, invoices)
Source still open (D5). Decision for this release: seeded demo data stored as commercetools Custom Objects per company, read through an internal interface (`PortalDataSource`); real integration (ERP, waste-tracking system) is a follow-up change that swaps the implementation. **Why:** the portal's user value is defined by the lists and documents, not by where they come from.

### 6. Rendering
Marketing, listing and detail pages are server-rendered and cacheable with no per-user data; the nav's "Quote list (n)" count and portal state are client-resolved so pages stay cacheable. The portal is fully dynamic and `no-store`.

### 7. Accessibility fixes over the prototype
Real links/buttons for portal triggers, a proper dialog (focus trap, Escape, focus return, `role="dialog"`, labelled), live-region form errors, a mobile menu, skip link. These are requirements, not polish.

### 8. Locale
Two locales: en-US (US, USD) and de-DE (DE, EUR) (owner, Q-012). Copy exists in both languages.

## Risks / Trade-offs

- **Prototype gaps become guesses** (PDP, quote list, portal interior). Mitigation: each is flagged *proposed*; review them in Claude Design before P2.
- **Placeholder claims** (4 h response, 98.6%, 82%, 350+, certifications, testimonials) could go live unverified. Mitigation: content flagged; a launch checklist task blocks release until the owner confirms.
- **Service-as-Product modelling** may be heavier than needed. Mitigation: decision D2 and the behaviour-only specs.
- **Healthcare / hazardous waste has regulatory content** (permits, consignment notes). Mitigation: owner review of those pages; no legal claims invented.
- **Location:** these artifacts live in the manufacturing project (D9).

## Migration Plan

New site; no migration. Delivery in the phases of `design/malva/PLAN.md`. Rollback = do not release; nothing existing is modified.

## Open Questions

D1–D9 in `design/malva/PLAN.md`; the owner-facing ones are D2 (service modelling), D4 (portal access), D5 (portal data), D6 (real content), D7 (locale).
