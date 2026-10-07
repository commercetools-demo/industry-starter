# Decision log

Every answer from the product owner (Behnam) that changes implementation. Binding for every workstream.
Junior devs: if a task conflicts with this file, stop and ask (`QUESTIONS.md`); do not guess.
"Default" rows were chosen by the planner where a spec asked a question the owner did not answer; the owner may overrule any of them.

## D-001 … Platform
| ID | Decision | Date |
| --- | --- | --- |
| D-001 | commercetools project **`spec-test-b2c-telecom`**, region `us-central1.gcp` (auth `https://auth.us-central1.gcp.commercetools.com`, API `https://api.us-central1.gcp.commercetools.com`). Project already enables countries GB, DE, US; currencies EUR, GBP, USD; languages en-GB, de-DE, en-US; `carts.countryTaxRateFallbackEnabled = true` (verified 2026-10-07) | 2026-10-07 |
| D-002 | Hosting **Netlify**, package manager **npm**, Node 22, Next.js 16 (App Router), next-intl 4, Tailwind v4 via `@theme`, Vitest. App lives in `site/` | 2026-10-07 |
| D-003 | Tests: **Vitest unit tests written by developers** (every `#### Scenario` has a test) **plus Chrome-driven verification run by the planner/orchestrator (Claude)** against the running app and the live seeded project, logged in `VERIFICATION-LOG.md`. Developers do **not** do manual testing. `TODO-MANUAL-TESTING.md` lists only what Claude cannot do (Merchant Center/Adyen/Netlify account actions, subjective visual sign-off). No Playwright/e2e suite, no CI for now | 2026-10-07 |
| D-004 | Markets: **en-US / USD / country US** and **de-DE / EUR / country DE**. en-GB / GBP are not used (left enabled in the project). Locale prefix always present (`/en-US/...`, `/de-DE/...`). German strings are a faithful translation; flag machine-translated keys in `IDEAS.md` | 2026-10-07 |
| D-005 | Scope: **all 51 OpenSpec capabilities are planned**, with these explicit exceptions: `agent-redemption-quota` is **deferred** (no agent mode, D-022); `account-registration-request` is **not built** (documented only, D-031); `payment-methods` is **list-only with seeded records** (D-032); net-terms/credit-line/B2B-only scenarios in any spec (cost centers, approvals, associates, quick order, per-company entitlement) are **out of scope** for this B2C store and are listed per workstream as "Excluded" | 2026-10-07 |

## D-010 … Commerce model
| ID | Decision | Date |
| --- | --- | --- |
| D-010 | Catalog types (see `telecom-catalog-model`): `malva-internet-plan`, `malva-phone-plan`, `malva-addon`, `malva-equipment`, `malva-device` and the sellable wrapper `malva-offer`. **The offer is what the storefront lists, prices and puts in the bundle.** Plan/add-on/equipment/device products are descriptive (specs, speeds, compatibility facts) and are referenced from offers by key; they are not categorised and not shown in listings | 2026-10-07 |
| D-011 | **Price lives on the offer's variants** (owner decision). One embedded price per variant per currency/country; the listing card price = the offer's **master variant** (owner decision), and the master variant is the term the design shows (cable 24-month, wireless 12-month, phone month-to-month). `attributes.contract-term` is a variant attribute | 2026-10-07 |
| D-012 | **Recurring prices everywhere** (owner decision): every monthly line carries `recurrenceInfo` (a `monthly` Recurrence Policy, key `malva-monthly`) and the offer variants carry a price tied to that policy (plus a one-time price for non-recurring lines such as equipment purchase and activation fees). The cart/checkout are recurring-aware. See D-013 and the spike in workstream L | 2026-10-07 |
| D-013 | Price selection mode: **Fixed for committed terms (12/24 months), Dynamic for month-to-month**. Stepped (phased/intro) prices are stored explicitly per order in a schedule record (Custom Field on the order) because neither mode models steps (`term-phased-price-schedule`) | 2026-10-07 |
| D-014 | Phone plans are sold **per line**: one offer, cart quantity 1–5 = number of lines. "Second line $10 off" and "bundle with cable $5 off" are cart discounts | 2026-10-07 |
| D-015 | Handsets **are in scope**: product type `malva-device` (variants = color × memory) wrapped by offers; acquisition mode **outright / installments (12, 24, 36 months) / lease** is **one product + one SKU, mode and term as Line Item Custom Fields**, with a Recurrence Policy on financed and leased lines (`device-acquisition-mode`). A deterministic **stub credit decision** (interface + fake) approves/declines by cart total and a customer flag | 2026-10-07 |
| D-016 | **Offer layer is required** (owner decision): `malva-offer` carries audience, channels, start time, included offers, conflicts, compatible add-ons/equipment (exceptions), existing-customer flag | 2026-10-07 |
| D-017 | Cable speed chips are bands on downstream speed: "Up to 500 Mbps" = `<= 500` (Cable 100, Cable 500); "1 Gbps" = `> 500` (Cable Gig). Phone: Unlimited = `data-gb = -1`; Data-capped otherwise. Wireless: 5G / LTE = `network-generation` 5g / 4g | 2026-10-07 |
| D-018 | Seed plan/add-on names and prices follow the design prototype (`design/DESIGN.md`, "Prototype data" and `seed-catalog-data`) | 2026-10-07 |
| D-019 | Inventory: services have **no InventoryEntry**; physical equipment and handsets do. Cart/order `InventoryMode` stays `None` unless workstream G's finding says otherwise (recorded in `PROJECT-FINDINGS.md`) | default |

## D-020 … Rules and eligibility
| ID | Decision | Date |
| --- | --- | --- |
| D-020 | **Serviceability** (does cable/wireless reach this address) is answered by a **built-in deterministic stub** behind an interface (seeded ZIP table; cached 5 min). Customer type comes from the Customer Group / session | 2026-10-07 |
| D-021 | **What the customer already holds** = the signed-in customer's commercetools **orders and recurring orders** (non-cancelled orders with a service line). Anonymous visitors hold nothing | 2026-10-07 |
| D-022 | **No agent mode in v1.** `agent-redemption-quota` is deferred (spec stays); every compatibility/conflict/eligibility failure is **absolute** for buyers (no override) | 2026-10-07 |
| D-023 | Introductory (free/reduced) period starts **at the order date** (owner decision). Cancellation window (D-040) is until the stored **service-start date** (order date + install lead time: cable 5 days, others 0), stored in an order Custom Field. Both are independent: an intro period running from the order date does not extend the cancellation window | 2026-10-07 |
| D-024 | Compatibility/conflicts are evaluated server-side in the BFF (no commercetools API Extension in v1); the rules module is pure TypeScript shared by server and client (`lib/offers/`) | default |
| D-025 | Required equipment: **defaulted** to the cheapest compatible equipment (buyer may change); auto-added with the plan; buyer sees it as a separate line | default |
| D-026 | Cart-line parent link: every add-on/equipment line carries Custom Field `parentLineItemId`; removing the plan removes its dependents after confirmation | default |
| D-027 | Discount-activating prompt pairings are curated in seed data (`offer.attributes` + cart discounts), re-priced on every cart read (never cached); prompts only suggest **adding** a line, never changing one | default |

## D-030 … Accounts, content, email
| ID | Decision | Date |
| --- | --- | --- |
| D-030 | Auth: **commercetools-owned passwords, global (not store-scoped) Customers**; signed JWT session cookie (`jose`), anonymous carts merge at sign-in | default |
| D-031 | **No email at all.** New registrations are **auto-verified** (server creates the email token and confirms it immediately). `email-verification` is reduced to that behaviour. `account-registration-request` is not built | 2026-10-07 |
| D-032 | `payment-methods`: **list-only with seeded records** (no tokenisation): account page lists, sets default and removes seeded Payment Method records. Net terms / credit line: excluded | 2026-10-07 |
| D-033 | Password reset: **demo-mode link on screen**. Requesting a reset creates the commercetools reset token (60-min TTL, single-use, `invalidateOlderTokens = true`); with `DEMO_SHOW_RESET_LINK=true` the confirmation page shows the link under a "demo mode: email delivery disabled" banner; with the flag off it shows only the generic "if the account exists…" message | 2026-10-07 |
| D-034 | Content (about, FAQ, blog, policies, support) = **static pages from versioned files under `site/content/`**, policy versions kept with effective dates. **Contact is a `mailto:` link** (no form, no storage). The `contact-us` scenarios about a confirmed submission are therefore replaced by mailto scenarios (workstream W amends the spec) | 2026-10-07 |
| D-035 | Guest checkout allowed (anonymous cart; sign-in merges it). Saved lists need sign-in | default |

## D-040 … Checkout and post-purchase
| ID | Decision | Date |
| --- | --- | --- |
| D-040 | Post-purchase v1: **cancel an order before its service-start date** (order state transition + cancellation reason recorded) and **device return request within 30 days** (creates a return record on the order; processing out of scope). Early-termination fee shown from the label formula. No plan changes | 2026-10-07 |
| D-041 | Checkout: commercetools **Checkout (hosted, Complete flow)** + **Adyen** (test mode) connector (owner decision). **Requires** Recurring Orders support and Stored Payment Methods enabled on the connector, and `recurringPaymentConfiguration` (paymentStrategy `Checkout`) on the cart ([docs](https://docs.commercetools.com/checkout/recurring-orders-in-checkout)). Workstream L's **spike** proves this before U builds; OA-05 (owner) must finish first | 2026-10-07 |
| D-042 | Total change after authorization (spec question): **re-authorize** via a new checkout session; the original authorization is cancelled by the connector | default |
| D-043 | Delivery: shipping methods seeded per `seed-shipping-and-market-settings` (zero-cost physical and digital methods); digital-only bundles skip shipping; no pickup in v1 | default |
| D-044 | Tax: a single placeholder tax category per country with 0% (`countryTaxRateFallbackEnabled` stays true); real telecom tax treatment out of scope | default |

## D-050 … Design, shell, seeding, delivery
| ID | Decision | Date |
| --- | --- | --- |
| D-050 | UI term is **"My bundle"** everywhere; route `/[locale]/bundle` (the Cart concept in code stays `cart`; routes: `/bundle`, `/bundle/checkout`) | 2026-10-07 |
| D-051 | "Support" navigates to `/[locale]/support` (FAQ + contact mailto). Mobile (<768 px): header collapses to a slide-in drawer designed from the tokens | 2026-10-07 |
| D-052 | Category listing route `/[locale]/shop/[slug]` (keep the `shop/` prefix). There is no product detail page: `product-detail-page` is superseded by `plp-led-catalog-navigation` (and `discovery-and-browse`/`search-results-page` detail links) | default |
| D-053 | Design tokens are carried verbatim from `design/source/_ds/tokens.css`; extension block for the error color (`--color-danger: #a1262b`) and off-scale values (see `design/DESIGN.md`). Broadband Facts label is the only component exempt from the token lint | default |
| D-054 | **Seeding**: seeder only creates/updates keys it owns (`malva-*`); allow-list = project key `spec-test-b2c-telecom` only; a one-time **destructive cleanup** script removes the furniture sample data (3 product types, products, categories, sample inventory) and is run only after `OA-03`. Demo reset also clears carts/orders/customers created with the demo marker | 2026-10-07 |
| D-055 | **Seeded imagery**: same method as `b2c-grocery/site/scripts/seed/update-images.ts` (public pexels.com search endpoint, no API key, URLs saved to a committed `data/product-images.json` lock file, hotlinked with photographer credit shown in the footer). Fallback: token-coloured SVG placeholders when the lock has no entry. **Accepted risk:** the endpoint is undocumented and may change or be restricted | 2026-10-07 |
| D-056 | **Search**: Product Search API with indexing activated by the seeder (`changeProductSearchIndexingEnabled`, `mode: ProductsSearch`; Product Projection Search is unavailable for projects created after 2026-08-31). Index updates take minutes; a product-type change triggers a full reindex (~15 min): the seeder waits and reports | 2026-10-07 |
| D-057 | Coordinated offer release (`coordinated-offer-release`): implemented as **release manifests applied atomically by the seeding framework** (all-or-nothing batch with validation, scheduled start/end via `startTime` on offers); rollback = apply the previous manifest. No approval UI | default |
| D-058 | Store and Customer Groups: no Stores; Customer Groups `consumer`, `small-business`, `employee`, `existing-customer` | default |
| D-059 | Out of scope everywhere: CI, e2e tests, real email, real contact delivery, chat widget, real serviceability/credit/billing/provisioning systems, B2B features | 2026-10-07 |

## D-060 … Defaults added during workstream planning (2026-10-07; owner may overrule, see QUESTIONS.md)
| ID | Decision | Date |
| --- | --- | --- |
| D-060 | Device financing uses extra recurrence policies `malva-device-installment-12`, `-24`, `-36` and `malva-device-lease-24` (all monthly interval) because price selection works per policy; the term is also stored in `acquisitionTermMonths` (workstreams G, Q) | default |
| D-061 | Hosted Checkout runs in **Payment Only** mode (our own steps own contact, address and delivery); `CHECKOUT_FLOW` stays configurable. **Confirmed by the owner** 2026-10-07. This refines D-041; OA-05 must create a Payment Only application | 2026-10-07 |
| D-062 | Orders are cancellable online only strictly before their service-start date, so phone-only and wireless orders (lead time 0) cannot be cancelled online; the order page says so and offers the return path for devices. **Confirmed by the owner** 2026-10-07 | 2026-10-07 |
| D-063 | Minimum order value $30 / €28 (configurable, 0 disables); "Check out" is shown to every visitor, anonymous visitors are offered sign-in or guest checkout (D-035). **Confirmed by the owner** 2026-10-07 | 2026-10-07 |
| D-064 | Header search is a magnifier link behind `HEADER_SEARCH_ENABLED = true`; listings get a sort select (both undrawn; see D-068) | default |
| D-065 | Intro and phased price demo amounts live in `lib/config/pricing.ts`; billing owns charging after the first order, commerce stores the schedule only (workstream L) | default |
| D-066 | Seed images may include URLs the public Pexels search returns from other hosts (e.g. `media.istockphoto.com`). **Owner: check this during seeding** — Claude inspects the returned hosts and licence/credit info during the G image run and records the outcome in `PROJECT-FINDINGS.md`; no owner test | 2026-10-07 |
| D-067 | Content contact address is the placeholder `support@malva.example` until replaced (SO-09) | default |

## D-068 … Owner answers on undrawn UI and releases (2026-10-07)
| ID | Decision | Date |
| --- | --- | --- |
| D-068 | **Undrawn UI is at the juniors' discretion.** Where the prototype draws nothing (mobile drawer, pickers and their incompatible/unavailable states, device card, price schedule, checkout steps, account pages, cancel/return, sort, search, discount-code field, prompt card, blocked-add notice, delivery-address card, language switcher placement), developers design it themselves from the tokens and `components/ui`, following the specs' behaviour. Sign-offs SO-01 to SO-07 are **waived as gates**; Claude takes screenshots in the Chrome checks and the owner may comment afterwards. SO-08 (legal wording) and SO-09 (about-page claims, copy) remain | 2026-10-07 |
| D-069 | **No release approval step.** `coordinated-offer-release` (workstream X) keeps validate, preview, all-or-nothing apply, scheduling, history and rollback, but has **no approver list, no second-person approval and no operator identity gate** (`RELEASERS.json`, approval files and `MALVA_OPERATOR_EMAIL` are removed). Scenarios that require separation of authoring and releasing are excluded with this decision | 2026-10-07 |

| D-070 | **No `/me` endpoints** (owner decision 2026-10-07). Customer data is read and written server-side with the storefront client-credentials client and **always filtered by the session's `customerId`** (or `anonymousId` for guests). Consequence: every customer-scoped helper in `lib/ct/*` takes the session, builds its `where`/path from it, and has a unit test proving another customer's id is never returned; route handlers never accept a customer id, cart id or order id from the client without re-checking ownership against the session | 2026-10-07 |

## Superseded or implied changes
- D-003 means the `storefront-project-bootstrap` "CI" language becomes a local `npm run verify`.
- D-005, D-022, D-031, D-032, D-034, D-040 narrow specs; each affected spec gets a `## Plan notes` section written by workstream Z (task Z-01) listing the narrowing.
