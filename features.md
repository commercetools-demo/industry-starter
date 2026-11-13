# Features

Code-derived inventory of what this repo implements. Bullets and key file paths —
the mechanism lives in `docs/how-it-works.md`, the walkthrough in `docs/demo-script.md`.

_Last generated: 2026-11-10 by feature-doc._

What each project in this repository contains, and how far along it is. Derived from each project's `openspec/specs/`, `plan(s)/STATUS.md` and the routes and `lib/ct/` modules under its app directory. Build state is as recorded in the project's `STATUS.md` at the time of writing; the plan, not this file, is the source of truth.

This repo is a monorepo of six industry starter storefronts plus shared design systems, built from scratch (not a fork of a commercetools starter), so rows carry no provenance tags. `docs/demo-script.md` and `docs/how-it-works.md` at the root cover the Malva Coffee demo only.

All projects are **commercetools-labs** reference code: MIT, freely available, AS IS and UNSUPPORTED (see [SUPPORT.md](SUPPORT.md)). Every project is a self-contained Next.js 16 (App Router) storefront on commercetools with locale routing, a server-side BFF (`lib/ct/*` plus Route Handlers) and a seed package or seed workstream for the commercetools project.

## b2c-grocery

MALVA grocery storefront. App: `b2c-grocery/site`. Plan: `b2c-grocery/plan/`. Specs: `b2c-grocery/openspec/specs/`.

**State:** workstreams A to V and X are marked done in `plan/STATUS.md` (2026-10-06). Subscriptions (W), Netlify deployment (Y) and release readiness (Z) have no completion date yet.

| Feature | What it does | Where |
| --- | --- | --- |
| Catalog browse and PDP | Category listing, product detail, home page, search results | `app/[locale]/shop`, `p/[slug]`, `search`; `lib/ct/listing.ts`, `search.ts`, `categories.ts` |
| Weight-based pricing | Per-kilogram prices with a provisional total, since picked weight is approximate | spec `weight-based-pricing`; workstream N |
| Delivery slot booking | Slot capacity checked at selection and again at order placement | spec `delivery-slot-booking`; `lib/ct/cart-delivery.ts`, `availability.ts` |
| Out-of-stock substitutions | Per-line substitution preference and an auditable post-placement record | spec `out-of-stock-substitutions`; workstream U |
| Saved lists | Named lists convertible to a cart in one action | `app/[locale]/account/(protected)/saved`; `lib/ct/shopping-lists.ts` |
| Subscriptions and recurring orders | Standing orders on commercetools recurrence policies | `account/(protected)/subscriptions`; `lib/ct/recurrence-policies.ts`, `recurring-orders.ts` |
| Order history and post-purchase edits | Order list and detail, order edits after placement | `account/(protected)/orders`; `lib/ct/orders.ts`, `order-edits.ts` |
| Account | Register, sign-in, password reset, address book | `app/[locale]/account/*`; `lib/ct/auth.ts`, `addresses.ts` |
| Hosted checkout | Checkout session and order confirmation page | `app/[locale]/checkout`; `lib/ct/checkout-session.ts` |
| Content pages | About, contact, FAQ, journal, policies | `app/[locale]/about`, `contact`, `faq`, `journal`, `policies/[slug]` |

## b2c-healthcare

MALVA Healthcare storefront: medicines, doctor booking, prescriptions and benefit allowances. App: `b2c-healthcare/site`. Plan: `b2c-healthcare/plans/`. Specs: `b2c-healthcare/openspec/specs/`.

**State:** workstreams are marked "Ready for review (live checks pending)" in `plans/STATUS.md`.

| Feature | What it does | Where |
| --- | --- | --- |
| Doctor search and booking | Doctor list, profile, slot booking, booking confirmation, appointments in the account | `app/[locale]/doctors/[mode]`, `doctor/[key]`, `booked/[ref]`; `lib/ct/doctors.ts`, `doctor-slots.ts`, `bookings.ts`, `scheduling.ts` |
| Medicine catalog | Medicine detail, search across medicines and doctors | `app/[locale]/medicine/[key]`, `search`; `lib/ct/medicines.ts`, `search-all.ts` |
| Prescription-bound supply | A prescription is a depleting quantity with a closing window, not a flag | spec `prescription-bound-supply`; `lib/ct/prescriptions.ts`, `dispense-ledger.ts` |
| Dispensing quantity limits | Ceilings that block exceeding a clinical supply limit | spec `dispensing-quantity-limit`; `lib/ct/ceilings.ts` |
| Credentialed purchase scope | The right to buy is granted by an outside authority, for a period and a scope | spec `credentialed-purchase-scope`; `lib/ct/credentials.ts` |
| Benefit allowance drawdown | A sponsor-funded allowance acts as a tender, not a discount | `account/allowance`; `lib/ct/allowance.ts`, `tender.ts`, `cart-funding.ts` |
| Eligible-item tender restriction | An allowance only pays for qualifying items | spec `eligible-item-tender-restriction` |
| Payer and patient cost share | Price is split between a scheme and the recipient | spec `payer-and-patient-cost-share`; `lib/ct/orders-funding.ts` |
| Expiry-dated supply | Shelf life is part of what is bought | spec `expiry-dated-supply`; `lib/ct/shelf-life.ts` |
| Health data minimization | The order record itself is treated as sensitive | spec `health-data-minimization`; `lib/ct/health.ts` |
| Auto-refill and recurring | Scheduled refills with a run log | `account/auto-refill`; `lib/ct/auto-refill.ts`, `auto-refill-run.ts`, `refill-log.ts` |
| Labs, lists, payment methods | Lab results, shopping lists, stored payment methods | `account/labs`, `lists`, `payment-methods`; `lib/ct/account-labs.ts`, `shopping-lists.ts`, `stored-methods.ts` |
| Orders | Cart, checkout, order history, cancel, reorder | `(protected)/cart`, `checkout`, `order/[id]`; `lib/ct/orders*.ts`, `order-cancel.ts` |
| Design system | Tokens, design lint and token-parity check | `design-systems/healthcare`; specs `design-*` |

## b2c-telecom

MALVA Telecom storefront: configurable connectivity offers. App: `b2c-telecom/site`. Plan: `b2c-telecom/plan/`. Specs: `b2c-telecom/openspec/specs/`.

**State:** all workstreams A to Z carry a completion date of 2026-10-07 in `plan/STATUS.md`.

| Feature | What it does | Where |
| --- | --- | --- |
| Configurable offers and compatibility | Plan, term, add-ons and equipment, with incompatible combinations blocked | spec `configurable-offers-and-compatibility`; `lib/ct/offers-api.ts`, `bundle.ts`, `holdings.ts` |
| Mutually exclusive offers | Conflicts a general catalog cannot express | spec `mutually-exclusive-offers` |
| Eligibility-gated offers | Offers visible only where the network, customer type or channel allows | spec `eligibility-gated-offer`; `lib/ct/serviceability.ts`, `visible-offers.ts`, `buyer-context.ts`, `customer-groups.ts` |
| Introductory-period and term-phased prices | Free or reduced opening periods and prices that step down over a contract | specs `introductory-period-price`, `term-phased-price-schedule`; `lib/ct/pricing-preview.ts` |
| Device acquisition mode | The same handset bought outright, on instalments or leased | spec `device-acquisition-mode`; `lib/ct/devices.ts`, `device-bundle.ts` |
| Broadband Facts label | A standardized disclosure per plan | spec `broadband-facts-label`; `app/[locale]/bundle` |
| Discount-activating offer prompt | Tells the customer which added offer reduces their bill and by how much | spec `discount-activating-offer-prompt`; `lib/ct/prompts.ts` |
| Agent redemption quota | A shared discount code rationed per agent | spec `agent-redemption-quota` |
| Coordinated offer release | A new offer, its prices and promotion, and the withdrawal of the old one appear at one moment | spec `coordinated-offer-release` |
| Plan finder, shop, search | Plan finder, category listings, search | `app/[locale]/plan-finder`, `shop/[slug]`, `search` |
| Checkout and post-purchase | Hosted checkout, confirmation, cancel and device return | `app/[locale]/bundle/checkout`, `order-confirmation/[orderNumber]`; `lib/ct/post-purchase.ts` |
| Account | Orders, addresses, payment methods, saved lists | `app/[locale]/account/*` |

## b2b-manufacturing

MALVA plumbing and waste-management website with a B2B customer portal. App: `b2b-manufacturing/site`. Seed: `b2b-manufacturing/seed`. Plan: `b2b-manufacturing/plans/`. Specs: `b2b-manufacturing/openspec/specs/`.

**State:** workstreams A to X and Z are marked Done in `plans/STATUS.md`. Deployment (Y) is ready but blocked on an owner action (OA-05). Several design sign-offs are open.

| Feature | What it does | Where |
| --- | --- | --- |
| Service listings and details | Plumbing and waste-management services by sector, with detail pages | `app/[locale]/plumbing`, `waste-management`, `.../sector/[sector]`, `.../[slug]`; `lib/ct/services.ts` |
| Quote list and request a quote | Buyers collect services and submit a quote request | `app/[locale]/quote-list`, `request-a-quote`; `lib/ct/quote-list.ts`, `quote-requests.ts` |
| Company registration and sign-in | Company account setup, registration, change password | `app/[locale]/account/register`, `sign-in`; `lib/ct/registration.ts`, `auth.ts` |
| Business-unit context | Per-company context and company switch | `lib/ct/business-units.ts`, `associate.ts`, `ownership.ts` |
| Portal: quotes and requests | Quote list and detail inside the account | `account/(portal)/quotes`; `lib/ct/portal-quotes.ts` |
| Portal: sites and team | Sites per company, team members and roles | `account/(portal)/sites`, `team`; `lib/ct/sites.ts`, `team.ts` |
| Portal: visits, documents, invoices | Service visits, waste documents, invoices | `account/(portal)/visits`, `documents`, `invoices` |
| Seed | Project configuration, catalog, roles, images | `b2b-manufacturing/seed/src` |
| Hardening and performance | Rate limiting, security headers, caching and SEO audits | workstreams U, W, X |

The `openspec/specs/` directory also holds specs for wider B2B behaviour (approval workflows, agreement pricing by site, installed-base register, minimum-charge floor, order decomposition, provisional orders). Check `SPEC-COVERAGE.md` for which of these the plan implements; a spec existing does not mean the feature is built.

## b2b2c-automotive

MALVA B2B2C automotive: a reseller storefront for drivers and workshops, and a partner portal for resellers. Apps: `b2b2c-automotive/storefront` and `b2b2c-automotive/portal`. Seed: `b2b2c-automotive/seed`. Plan: `b2b2c-automotive/plans/`. Specs: `b2b2c-automotive/openspec/specs/{consumer-storefront,seller-portal}`.

**State:** earliest of the five. `plans/STATUS.md` reports 47 of 177 tasks done, with most workstreams marked Not started. Listing and search, product detail, portal marketing and import, and part of security hardening are the furthest along. Treat the rest as planned.

| Feature | What it does | Where |
| --- | --- | --- |
| Per-reseller stores | Each reseller gets a store with its own theme, assortment and prices | `storefront/app/[locale]/[store]`; `lib/ct/stores.ts`, `resellers.ts`, `in-store.ts` |
| Parts catalog and fitment | Parts listing, category pages, product detail, parts search | `.../[store]/parts`, `category/[slug]`, `p/[slug]`; `lib/ct/malva-catalog.ts`, `products.ts`, `search.ts` |
| Vehicle finder and garage | Saved vehicles used to filter fitment | `.../account/garage`; `lib/ct/vehicles.ts` |
| Bundles and cart discounts | Bundles in the cart, cart and product discounts | `lib/ct/bundles.ts`, `cart-bundles.ts`, `cart-discounts.ts` |
| Checkout, orders, returns, invoices | Checkout, confirmation, order detail, returns and invoice | `.../checkout`, `account/orders/[orderNumber]/return`, `invoice` |
| Subscriptions | Recurring parts orders | `.../account/subscriptions`; `lib/ct/account-subscriptions.ts` |
| Customer-service impersonation | Staff view as a customer | `storefront/lib/ct/impersonation.ts` |
| Partner portal: catalog | Assortment, price overrides, priority, product info, cart and product discounts | `portal/app/[locale]/(portal)/catalog/*` |
| Partner portal: store | Settings, theme, share and channels | `portal/.../store/*` |
| Partner portal: customers and service | Customers, subscriptions, returns, reviews | `portal/.../customers`, `subscriptions`, `returns`, `reviews` |
| Partner portal: growth | Marketing, bundles, product import, brand partnership | `portal/.../marketing`, `bundles`, `import`, `partnership` |
| Portal onboarding | Register, approval, invite acceptance, password reset | `portal/app/[locale]/(auth)/*` |
| Seed | Platform model, parts catalog, stores, business units, roles, customers, discounts | `b2b2c-automotive/seed/src` |

## b2c-foodservice

MALVA storefront with two brands, Malva Coffee and Malva Drinks, sharing one bag. Malva Coffee is a B2C coffee retailer selling pods, beans, machines and accessories in the US and Canada, with store collection, delivery and subscriptions. Malva Drinks sells sparkling water, delivered only. App: `b2c-foodservice/storefront`. Seed: `b2c-foodservice/seed`. Plans: `b2c-foodservice/plans/`. Specs: `b2c-foodservice/openspec/specs/`. Docs: `docs/` (demo script and how it works). Live: <https://omni-industry-starter.netlify.app/en-US>.

**State:** workstreams A to Q are "Ready for review" in `plans/STATUS.md` (2026-10-21); live Checkout, Stripe and recurring-order checks are listed as open owner actions in `plans/OWNER-HANDOFF.md`. The multibrand change (`add-multibrand-malva-drinks`, 38 of 38 tasks) was archived on 2026-11-03. The site is deployed on Netlify and reads a seeded commercetools project.

| Feature | What it does | Where |
| --- | --- | --- |
| Multiple brands | Brand switcher above the header, URLs of the form `/{brand}/{locale}`, `/` and `/{locale}` redirect to `/malva-coffee/{locale}` | specs `multibrand-routing-and-switcher`, `brand-catalog-scoping`; `lib/brands.ts`, `i18n/navigation.tsx`, `components/layout/BrandSwitcher.tsx`, `proxy.ts` |
| Per-brand catalog | Each brand has a product selection that scopes Product Search, the category tree and the header | `lib/ct/product-selections.ts`, `search.ts`, `categories.ts` |
| Malva Drinks | Own home page, product page with size options, colour tokens and delivery-only fulfilment; drinks stock sits on its own inventory channel | spec `malva-drinks-storefront`; `components/home/DrinksHome.tsx`, `lib/ct/channels.ts`, `inventory.ts` |
| One bag, two brands | Cart lines are grouped by brand in the UI from a `brand` field on the line custom type; one checkout and one shipment | specs `cart-management`, `cart-page`; `lib/cart/brand-sections.ts`, `components/cart/BrandHeading.tsx` |
| Catalog browse and search | Category tree, facets with counts, search, per-capsule unit prices | `app/[brand]/[locale]/(listing)`; `lib/ct/products.ts`, `search.ts`, `categories.ts` |
| Product page | Variants, and a Collect, Ship or Subscribe choice per product | `app/[brand]/[locale]/p/[slug]`; `lib/ct/product-detail.ts`, `subscription-plan.ts` |
| Mixed bag | Collect, ship and subscribe lines in one cart, each in its own cluster | spec `fulfilment-and-availability-model`; `lib/ct/cart.ts`, `cart-enrich.ts` |
| Store collection and per-store stock | Six New York stores, stock per store, collection tracker | `lib/ct/channels.ts`, `inventory.ts`; `account/(shell)/collection` |
| Two markets | `en-US` (USD) and `en-CA` (CAD) with their own tax, shipping and thresholds | `lib/ct/market.ts`, `proxy.ts` |
| Discount codes | `WELCOME10`, `FREESHIP`, `COFFEE15`, stackable | `lib/ct/cart.ts` |
| Subscriptions and recurring orders | Four intervals; skip, pause, change interval, cancel | `account/(shell)/subscriptions`; `lib/ct/recurring-orders.ts` |
| Reviews and ratings | Written by signed-in shoppers, counted at once | `lib/ct/reviews.ts`, `review-client.ts` |
| Hosted checkout | commercetools Checkout with Stripe | `app/[brand]/[locale]/checkout`; `lib/ct/checkout-session.ts` |
| Account | Orders, addresses, saved items, payment methods, demo sign-in | `app/[brand]/[locale]/account/*`; `lib/ct/auth.ts`, `orders.ts` |
| Demo gate and tracker | Password gate and visitor analytics | `app/gate`, `app/api/gate`, `app/api/tracker`; `lib/gate.ts` |
| Seed | Project settings, catalog, stores, customers, discounts, reviews, brand selections, the drinks catalogue and its reduction script | `b2c-foodservice/seed/src`, `scripts/reduce-drinks.ts`; spec `multibrand-seed` |

### b2c-foodservice: conversational shopping assistant

A docked assistant panel (launcher in the header, never a modal) on the website experience for both brands and both markets. Ported from Anthropic's reference commerce agent (`github.com/anthropics/commerce-agents`, Apache-2.0). Workstreams T and T2 (`plans/STATUS.md`): T2 is Ready for review; the real-model proof (U-13) is blocked on the owner confirming the Anthropic spend cap (OA-T-a). Specs: `openspec/changes/add-shopping-assistant/`.

- Storefront-backed agent: the assistant's `StorefrontBackend` calls the storefront's own `lib/ct/*` modules with the shopper's cookie session, so the assistant's cart is the shopper's bag with no second cart and no adopt step (`lib/ct/assistant-backend.ts`, `assistant-cart.ts`, `lib/mappers/assistant.ts`).
- Tools: product search and detail, cart read/add/update/remove, order list and order status of the signed-in shopper, and load-skill (`lib/agent/shopping/tools/registry.ts`). No tool places an order or moves money; the shopper pays in the hosted Checkout.
- Trust and safety gates between model and shopper: fenced storefront text, cart provenance (a cart write accepts only product ids that catalogue or order tools returned this session), an options gate for products with variants, a line-quantity cap, and server-side grounding (`lib/agent/shopping/gates.ts`, `fencing.ts`, `grounding.ts`, `enrichment.ts`).
- Streaming turn loop over server-sent events with a heartbeat and an optional buffered transport (`ASSISTANT_TRANSPORT=buffered`); request body carries the message only, the transcript is server-owned (`app/api/assistant/turn/route.ts`, `lib/agent/host/sessions.ts`).
- Server-side session store on Netlify Blobs with compare-and-set, with an in-memory store for development (`lib/agent/store/`); rate limiting and an assistant on/off switch (`lib/agent/http/guard.ts`).
- Six generative cards: products carousel, comparison grid, plan checklist, guide, order status, checkout summary; card clicks add to the bag through a server-composed card route (`components/assistant/cards/`, `app/api/assistant/card/add`, `card/product`).
- Four markdown skills the model loads on demand: customer care, planning goals, purchase research, search discovery (`lib/agent/skills/`).
- Plain-language activity line per tool call, quoted-as-data rendering and suggestion chips (`components/assistant/activity.ts`, `QuotedAsData.tsx`, `Suggestions.tsx`).
- Card showcase page rendering every card from fixtures (`app/[brand]/[locale]/assistant-showcase`, `components/assistant/fixtures.ts`).
- Not built by decision: policies search, fulfilment options, web search, long-term memory and any order-placing tool.

### b2c-foodservice: In-store companion

The same build switched into a phone-sized in-store companion by one server variable, `APP_MODE=instore` (workstream R, "Ready for review"; recorded as not yet pushed or deployed in `plans/STATUS.md`).

- App-mode switch: anything other than `instore` is the website, so a typo never turns the shop into the companion (`lib/app-mode.ts`).
- Restricted route set (home, category `/c`, product `/p`, bag, checkout); every other path redirects to home (`lib/app-mode.ts` `instoreRedirect`, `proxy.ts`).
- Barcode scan resolves a SKU to a product with image, variant attributes, price, availability and quantity limits; 404s on the website (`app/api/instore/scan/route.ts`, `lib/ct/instore-scan.ts`, `lib/instore/scanner-engine.ts`, `components/instore/scan/`).
- Companion screens: home, category, product, bag, bottom bar and stock line; shows only categories flagged for in-store (`components/instore/*`, `lib/instore/category.ts`).
- Web manifest, noindex metadata and viewport-fit cover for an installable companion (`app/instore.webmanifest`, `lib/instore/manifest.ts`).

## design-systems

Shared design-system packages, one per industry: `design-systems/admin`, `automotive`, `healthcare`, `telecom`.

- Tokens as CSS and JSON (`tokens.css`, `tokens.json`) with foundations documentation per system.
- Reference component pages as standalone HTML (admin: button, table, sidebar, top bar, charts, date picker, form fields, overlays and more under `admin/components/`) and a dashboard layout (`admin/layouts/dashboard.html`).
- Healthcare has a design lint and token-parity check (specs `design-*`).

