## Why

Malva Plumbing & Waste Management sells B2B plumbing and waste services to facilities managers, manufacturers, property / real-estate owners and healthcare providers. It has a Claude Design prototype (`design/malva/source/Malva.html`) but no specs, no defined page set beyond the prototype's five routes, and no plan to build it. Services are quoted, not priced, so the usual catalog → cart → checkout flow needs an explicit mapping before anyone builds it.

## What Changes

New capabilities (all prefixed `malva-` so they cannot collide with the existing manufacturing specs in `openspec/specs/`):

- `malva-homepage` — hero, two service pillars, service-level stats, audience cards, certifications and testimonials, quote CTA
- `malva-service-listing` — PLP: Plumbing (5 services) and Waste management (7 services)
- `malva-service-detail` — PDP: one page per service (not in the prototype; proposed)
- `malva-quote-list` — cart: the services a visitor wants quoted (proposed)
- `malva-request-a-quote` — checkout: 3-step request / contact form, no payment
- `malva-client-portal` — account area: sign-in, service visits, waste documents, invoices, quotes, sites, team (sign-in modal only in the prototype)
- `malva-about` — About page

Services (canonical):

- Plumbing: Pipe installation & repair · Drain cleaning & CCTV survey · Backflow & water testing · Boiler & hot water · Commercial fit-outs
- Waste: General waste collection · Recycling · Hazardous waste · Grease trap servicing · Medical / clinical waste · Liquid waste & tankering · Compliance reporting

Also persisted: the imported design (`design/malva/`), design-side specs per page, and a plan with open decisions.

## Capabilities

### New Capabilities

`malva-homepage`, `malva-service-listing`, `malva-service-detail`, `malva-quote-list`, `malva-request-a-quote`, `malva-client-portal`, `malva-about`

### Modified Capabilities

None.

## Impact

- **commercetools usage (none exists yet for Malva):** services as Products in two Categories without prices; the quote list as an anonymous-then-customer Cart; submission as a Quote Request (B2B quote lifecycle); client accounts as Business Units with Associates. Details and open questions in `design.md`. No existing commercetools code was surveyed because this is a new storefront; the existing specs in `openspec/specs/` belong to a different (manufacturing) storefront and are untouched.
- **Location:** `b2b-manufacturing/` (owner-confirmed). Owner decisions: services are commercetools Products; portal registration is open (replaces the approval-held registration of the manufacturing specs for Malva). Foundation: `openspec/changes/bootstrap-malva-storefront`.
- **Out of scope:** payments, online pricing, a CMS choice, real visit/waste-note/invoice integrations (decision D5), multi-language, the Merchant Center configuration, and the implementation itself.
