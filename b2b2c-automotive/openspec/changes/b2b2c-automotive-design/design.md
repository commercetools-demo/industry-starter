<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Design: Malva B2B2C automotive

## 1. The two sites

| Site | Who uses it | Design file | Design system | Themed by reseller? |
| --- | --- | --- | --- | --- |
| **Malva Partner Portal** (Supplier + Seller portal; one app) | Resellers' staff: assign catalog, set retail prices, run store, serve customers (buying from Malva is out of scope, owner 2026-10-12) | `design/export/Malva Seller Portal.dc.html` | Admin kit (`tokens.admin.css`, Inter, near-black action, light/dark) | No |
| **Reseller storefront** (one per reseller) | Drivers and workshops | `design/export/Reseller Storefront.dc.html` | Automotive kit (`tokens.automotive.css`, Poppins/Archivo/Public Sans, Garage Maroon) | Yes, through Contentools (`consumer-storefront/theming-design`) |

Names: the brief says "Malva Supplier" and "Malva Seller(s)"; the design calls the portal "Partner Portal". Treat Supplier as Malva's side (master catalog, base pricing, content review, campaigns) and Seller as the reseller side. The prototype shows only the reseller side of the portal; Malva staff screens are not designed (see 5).

## 2. Content and theme architecture (decided 2026-10-12)

Contentools (`/Users/behnam/code/cms`) is the lightweight CMS for both sites' reseller-facing content.

- **Storage:** everything is commercetools custom objects scoped by business unit key, written by the Contentools service API with the store key as namespace (`service/src/routes/configuration.route.ts`, `puck-page.route.ts`, `puck-content.route.ts`). Theme is `configuration` container, key `{businessUnitKey}-theme`.
- **Editing:** the portal embeds Contentools' own React components (`ThemeManager`, `PageManager`, `ContentManager`). The portal builds no theme or page editor.
- **Rendering:** the customer-facing storefront renders Puck documents with `PuckRenderer` / `PuckDataRenderer` and reads the theme with `buildCssVars`. Header, footer and commerce pages (listing, product, cart, checkout, account) are application components that read the same theme through a token adapter.
- **Only the theme:** the storefront reads nothing else from Contentools configuration (`header`, `footer`, `facet`, `site-metadata`, `category-listing`, `translations` are not used). Store name, logo and favicon are store settings in the portal.
- **History:** theme history is handled by Contentools.
- **Tenancy:** the reseller is a commercetools store; the store key (from the URL path) is the Contentools namespace for theme, pages and content, and all branches share it. Contentools falls back to a `default` namespace only, so `default` holds the Malva automotive theme. There is no tenant or domain registry in the apps; stores and domains are set up by hand in the Merchant Center and at hosting.
- **Credentials:** the Contentools JWT is global to the project, written to a custom object by the Merchant Center app (`contentools-configuration` / `contentools-jwt-token`) and resolved and refreshed on the server. The browser calls Contentools only through a same-origin `/api/contentools` proxy that injects `x-project-key`; the portal's proxy also rewrites the store key and keeps the JWT server-side (hardening beyond the `integrate-contentools` skill).
- **Auth:** reads need the project key; writes need a JWT and project validation.

## 3. How the commitments map to screens

| Commitment | Shopper side | Seller portal side |
| --- | --- | --- |
| Catalog inheritance | Listing only shows assigned products | `seller-portal/design-catalog-assortment` |
| Vehicle-first browsing | `consumer-storefront/design-vehicle-finder-and-garage`, fit badge, fit filter, product fit banner | Fitment is locked master data (`seller-portal/design-product-info-tailoring`) |
| Layered pricing | Price, old price, named savings in cart | `seller-portal/design-price-overrides-and-margin`, `seller-portal/design-discounts-and-priority` (wholesale build-up in `design-price-lists-and-saved-lists` is out of scope) |
| Seller theming | Contentools theme through the token adapter | `seller-portal/design-storefront-theme-and-branding` hosts `ThemeManager` |

Installation (fitting) services are **out of scope** (decision 2026-10-12) and removed from all specs.

## 4. Decisions

1. **Specs are flat OpenSpec capabilities** in `openspec/specs/` (`consumer-storefront/theming-design`, `consumer-storefront/design-*`, `seller-portal/design-*`) so the CLI sees them; the plan lives in this change. The pre-existing `consumer-storefront/` and `seller-portal/` template specs are not edited (lockfile).
2. **Theme and content in Contentools** (section 2). Theme is mapped onto the automotive tokens by an adapter. Theme history is handled by Contentools; there is no contrast checking.
3. **Margin, not commission.** Resellers set their own retail prices and keep the margin. The prototype's Earnings page is removed; Brand partnership remains as the guardrails page.
4. **No fitting service** in this project.
5. **Fit-only by default** once a vehicle is selected. The prototype shows non-fitting parts with the filter off.
6. **Store picker lists the reseller's branches**, not other resellers.
7. **Currency, tax label, shipping threshold and country come from store configuration.** The prototype hard-codes CAD, HST 13%, "$99"; the portal uses EUR, 19% VAT, DACH.
8. **Portal is not reseller-themed**; it keeps the admin kit.
9. **Design tokens only in components.** The prototype storefront uses raw hex; implementation must not.
10. ~~**MAP floor and territories are enforced on the server**, not only in the portal.~~ **VOID (owner, 2026-10-12).** Q-T03: there is no MAP price floor (resellers may set any price above zero). Q-O03: there is no territory blocking at checkout. Nothing in this decision is built; the server still enforces roles, store scoping and price sanity (greater than zero), see workstream X.

### 4.1 Owner decisions of 2026-10-12 (interview; binding, see `plans/DECISIONS.md` D-028 to D-049)

| Topic | Decision |
| --- | --- |
| Wholesale buying from Malva (Q-V01) | **Out of scope.** Resellers pull parts from the master catalog into their product selection, so they already have them. Specs `seller-portal/design-quick-order-and-cart`, `design-orders-quotes-invoices`, `design-approvals-and-roles`, `design-price-lists-and-saved-lists` carry the marker `<!-- OUT-OF-SCOPE -->`, are not implemented and are not required by `plans/verify-plan.mjs`. The portal roles are Admin and Buyer; Approver is dropped. |
| Prices (Q-003, Q-005) | All prices are standalone prices, Malva's base price too. One store per reseller; branches are channels that carry inventory and prices. |
| MAP and territories (Q-T03, Q-O03) | No MAP floor, no territory blocking (decision 10 void). Brand partnership keeps only the fitment-claim review state. |
| Tailoring (Q-T06, Q-004) | Tailored text and tailored images publish at once, no approval; no review gate for themes and pages either. |
| Payment (Q-012) | Hosted commercetools Checkout (full flow) with the Stripe connector. Refunds go through the payment and the connector. OA-05 is a real owner action. |
| Subscriptions (Q-Q06) | Sold fully: recurrence policies on selected parts, subscribe option on the PDP, recurring orders through Checkout, account and portal management. |
| Email (Q-P01) | No email is sent anywhere. The portal keeps the Marketing and Email screens, which store templates and campaigns but never send. |
| Store picker map (Q-I02) | OpenStreetMap with Leaflet; the portal branch screens reuse the same map component. |
| Fitment (Q-J03) | Year ranges (make, model, year-from, year-to, engine). |
| Defaults confirmed | Logo and favicon through Contentools `upload-file` (Q-U01); returns window 30 days from delivery (Q-Q01); shop-as is Admin only (Q-W01); mock plate and VIN provider (Q-002); project stays in labs (Q-Z01). |

## 5. Conflicts between brief and designs

| # | Item | Brief | Design | Treatment |
| --- | --- | --- | --- | --- |
| 1 | Brand per reseller | Own domain and branding | One brand "Autoline", many businesses in picker | Decision 6; store name and logo from store settings |
| 2 | Fit visibility | Only fitting parts shown | Non-fitting shown unless filtered | Decision 5 |
| 3 | Vehicle input | Plate, VIN or make/model/year | Year/make/model/engine only | Added to `consumer-storefront/design-vehicle-finder-and-garage` |
| 4 | Commercial model | Reseller sets retail price | Earnings page pays commission | Resolved: margin; Earnings removed |
| 5 | Currency and region | European | CAD in storefront, EUR in portal | Decision 7 |
| 6 | Theming | Sellers adapt via tokens | Only name, subdomain, logo | Resolved: Contentools theme and `ThemeManager` |
| 7 | Portal naming | Supplier/Seller | Partner Portal | Confirm |
| 8 | CMS choice | none | Contentools or Sanity | Resolved: Contentools only |
| 9 | Wholesale buying | Resellers hold Malva's catalog in their selection | Portal designs quick order, orders, quotes, approvals, price lists | Resolved (owner 2026-10-12): four specs out of scope, no Approver role |
| 10 | Brand guardrails | none | Portal design shows MAP floor, territories, tailored-text review | Resolved (owner 2026-10-12): no floor, no territory blocking, no tailoring approval; decision 10 void |
| 11 | Payment and email | none | Checkout shows pay at pickup, invoice, order e-mails | Resolved (owner 2026-10-12): hosted commercetools Checkout with Stripe; no e-mail sent |

## 6. Screens missing from the designs (to commission)

Shopper: mobile navigation and mini-cart, search suggestions and results states, vehicle plate/VIN flows and errors, account area (all), pagination and filter sheet, order confirmation detail, error and empty states.
Seller portal: page chrome around embedded Contentools managers (Theme, Pages, Content blocks, Media), branch management, custom domain, discount and rule editors, bulk price edit, assortment bulk actions and line-level assignment, order detail, return detail, Malva-side screens (reseller onboarding approval, master catalog, content review, price lists, campaigns, regional withdrawal), mobile layout.

## 7. Coverage matrix

| Screen | Design file view | Spec | Status |
| --- | --- | --- | --- |
| Shell | storefront header/footer | `consumer-storefront/design-storefront-shell` | Designed |
| Home | `home` | `consumer-storefront/design-home-page` | Designed (Puck-rendered) |
| Listing and search | `plp` | `consumer-storefront/design-product-listing-page` | Designed (no search results) |
| Product | `pdp` | `consumer-storefront/design-product-detail-page` | Designed |
| Cart | `cart` | `consumer-storefront/design-cart-page` | Designed |
| Checkout | `checkout` | `consumer-storefront/design-checkout-page` | Designed |
| Confirmation | `done` | `consumer-storefront/design-order-confirmation-page` | Partial |
| Store picker | picker overlay | `consumer-storefront/design-store-picker` | Designed |
| Vehicle finder, garage | home card, listing bar | `consumer-storefront/design-vehicle-finder-and-garage` | Partial |
| Account area | none | `consumer-storefront/design-account-area` | Missing |
| Portal shell, overlays | shell | `seller-portal/design-portal-shell-and-navigation` | Designed |
| Portal auth | auth overlay | `seller-portal/design-auth-screens` | Designed |
| Dashboard | `dash` | `seller-portal/design-dashboard` | Designed (purchasing only) |
| Catalog tabs | `catalog` | `seller-portal/design-catalog-assortment`, `seller-portal/design-price-overrides-and-margin`, `seller-portal/design-product-info-tailoring`, `seller-portal/design-discounts-and-priority` | Designed (lists) |
| Theme | none | `seller-portal/design-storefront-theme-and-branding` | Missing chrome (editor is Contentools) |
| Store and channels | `store` | `seller-portal/design-store-and-channels` | Partial |
| Content | `content` | `seller-portal/design-content-pages` | Replaced by Contentools managers |
| Customers, subscriptions | `customers`, `subs` | `seller-portal/design-customers-and-subscriptions` | Designed |
| Returns, reviews | `returns`, `reviews` | `seller-portal/design-returns-and-reviews` | Designed |
| Brand partnership | `partnership` | `seller-portal/design-brand-partnership` | Designed |
| Marketing, email | `marketing`, `email` | `seller-portal/design-marketing-and-email` | Designed |
| Bundles, import | `bundles`, `import` | `seller-portal/design-bundles-and-product-import` | Designed |
| Wholesale buying | `quick`, `cart` | `seller-portal/design-quick-order-and-cart` | Out of scope (owner 2026-10-12, Q-V01) |
| Orders, quotes, invoices | `orders`, `quotes`, `invoices` | `seller-portal/design-orders-quotes-invoices` | Out of scope (Q-V01) |
| Approvals, roles | `approvals`, `roles` | `seller-portal/design-approvals-and-roles` | Out of scope (Q-V01); roles are Admin and Buyer |
| Price lists, saved lists | `pricing`, `lists` | `seller-portal/design-price-lists-and-saved-lists` | Out of scope (Q-V01) |
| Company, account | `company`, `account` | `seller-portal/design-company-and-account` | Designed |
| Earnings | `earnings` | none | Dropped (decision 3) |

## 8. Open questions

A. Where is the store logo and favicon file stored (store data plus an asset host)?
B. Plate and VIN decoding provider and country coverage.
C. Price model: embedded or standalone prices for reseller channel prices (affects price facets).
D. Does Malva review reseller themes and pages the way it reviews tailored product text?
E. Assumed: one store per reseller (as in the `b2b2c-starter` reference), branches as channels or inventory locations within it. Confirm.
F. Which Malva-side (Supplier) screens are in scope for this phase?
G. The earnings answer was read as "no commission, margin only". Confirm.
H. (Resolved) No tenant or domain registry; the store key in the URL path is the tenant, domains are managed by hand by an admin.
I. Portal proxy hardening: confirm the Contentools managers accept a placeholder `jwtToken` while the proxy attaches the real JWT server-side. If not, fall back to the skill's design (JWT passed to the browser) plus the store-key rewrite.
J. SDK majors: stay on `platform-sdk` ^8 and `ts-client` ^4 (skill pins) while npm latest is 9.7.0 and 5.1.1. Upgrade later?
K. Locales are decided: `de-DE` and `en-US` only. Open: `en-US` means USD and US by the skill's flat `COUNTRY_CONFIG`; confirm USD prices, US tax and shipping exist, or configure `en-US` as English text with EUR and DE. App directory names `storefront/` and `portal/` (the reference starter uses `customer/` and `dealer/`; the skill uses `site/`).

Answered by the owner on 2026-10-12: C (all prices are standalone, Q-003), D (no review gate, Q-004), E (one store per reseller, branches are channels with inventory and prices, Q-005), F (no Malva-side screens, Q-006), K (USD and US for `en-US`, EUR and DE for `de-DE`, Q-010). Others keep their defaults; see `plans/QUESTIONS.md`.

## 9. Risks

- Fit data quality drives returns; fit claims need one source and a clear error path.
- (Withdrawn 2026-10-12: MAP and territory rules do not exist, decision 10 is void.) Server-side role, store-scope and order, return and review integrity checks stay mandatory (workstream X).
- Theme freedom against legibility: there is no contrast checking by decision, so a reseller can pick hard-to-read colours.
- Prototype data (parts, prices, names, "Hartmann") are placeholders and must not leak into seed or copy.
