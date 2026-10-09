## 1. Foundations (P0)

- [ ] 1.1–1.3 Delivered by the `bootstrap-malva-storefront` change (scaffold, client, session, locale routing, tokens and fonts); complete it first
- [ ] 1.4 Build the shell: top bar, sticky nav with mobile menu, footer, skip link, active-section state
- [ ] 1.5 Build shared components: button (sharp), service card, audience card, stat, cert chip, testimonial, check list, CTA band, page header, stepper, option card, inputs, dialog (focus trap, Escape, focus return)
- [ ] 1.6 Resolve owner decisions D1–D9 in `design/malva/PLAN.md` before the phases they block (D2 blocks 2.x, D4/D5 block 5.x)

## 2. Catalog and content model (P1–P2)

- [ ] 2.1 Define the ProductType `service` and the categories `plumbing` and `waste-management`; seed the 5 + 7 services in the stated order [SKILL: commercetools-commerce-patterns]
- [ ] 2.2 Seed service copy verbatim from `design/malva/specs/plp.md`; author included items, steps, FAQ and audience tags per service with the owner
- [ ] 2.3 Add managed content for stats, accreditations and testimonials with a "verified" flag

## 3. Pages (P1–P2)

- [ ] 3.1 Homepage per `specs/malva-homepage` [SKILL: commercetools-storefront]
- [ ] 3.2 Plumbing and Waste listings per `specs/malva-service-listing`, using the Product Search API, server-rendered and cacheable [SKILL: commercetools-storefront]
- [ ] 3.3 Service detail page per `specs/malva-service-detail`, including `Service` structured data and related services [SKILL: commercetools-storefront]
- [ ] 3.4 About page per `specs/malva-about`
- [ ] 3.5 404 and error pages

## 4. Quote list and request (P2–P3)

- [x] 4.1 Verified (docs, 2026-10-08): no Quote Request from an anonymous Cart; registration-first path decided and recorded in `design.md` [SKILL: commercetools-commerce-patterns]
- [ ] 4.2 Quote list: anonymous cart, add / edit / remove, nav count, merge at sign-in, empty and unavailable states [SKILL: commercetools-storefront]
- [ ] 4.3 Request-a-quote form: stepper, validation, sector-specific fields, signed-in prefill [SKILL: commercetools-storefront]
- [ ] 4.4 Submission: account creation + Quote Request in one idempotent action (no half-created accounts), on-screen reference, no email, abuse protection [SKILL: commercetools-storefront]
- [ ] 4.5 Quote Request creation through the associate API, BU-scoped: single-shipping cart, site address as shipping address, no discount code, custom fields for sector/sites/frequency/waste details [SKILL: commercetools-storefront]

## 5. Client portal (P4)

- [ ] 5.1 Sign-in dialog and page; login through the commercetools login endpoint from the BFF; return path; sign-out [SKILL: commercetools-storefront]
- [ ] 5.2 Open registration: customer + Business Unit + admin association, email verification gate, abuse limits, no account enumeration; Associates and roles (Admin, Site contact, Finance) and invitations for colleagues [SKILL: commercetools-commerce-patterns]
- [ ] 5.3 Portal shell, overview and company switcher; `no-store` on every portal response [SKILL: commercetools-storefront]
- [ ] 5.4 `PortalDataSource` interface with a seeded implementation for visits, waste documents and invoices (D5) [SKILL: commercetools-platform]
- [ ] 5.5 Service visits, waste documents and invoices screens with filters and downloads, ownership enforced per company
- [ ] 5.6 Quotes and requests: list, accept, decline, ask a question; role gating [SKILL: commercetools-storefront]
- [ ] 5.7 Sites and team management with last-administrator protection

## 6. Hardening (P5)

- [ ] 6.1 Accessibility: keyboard and screen-reader pass of every spec scenario; live-region errors; contrast on hero overlay
- [ ] 6.2 SEO: titles, descriptions, canonical, breadcrumb and `Service` markup, sitemap
- [ ] 6.3 Performance: LCP image priority, no layout shift, Lighthouse run on Home, listing, detail, quote
- [ ] 6.4 Launch checklist: owner confirmation of every placeholder (stats, accreditations, registration number, phone numbers, email, testimonials); remove "Sample content" footer text
- [ ] 6.5 Optionally move this change and `design/malva/` into their own project directory (D9)
