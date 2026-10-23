<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Decisions

Owner decisions and verified platform facts. Change one only when the owner says so; record the change here with a date. Questions that are still open are in `QUESTIONS.md`, each with the default being built.

| ID | Decision | Source |
| --- | --- | --- |
| D-001 | **Online channel only.** The website covers online shopping (delivery or collection in store). In-store selling is a separate system and is not built. | Owner 2026-10-19 |
| D-002 | Brand is **Malva Coffee**. | Owner 2026-10-19 |
| D-003 | **Keep VELA's palette and tokens** (commercetools navy, violet, teal on warm canvas). Token values may change later; names do not. | Owner 2026-10-19 |
| D-004 | Markets: **US, Germany, UK**. Locales `en-US` (USD), `de-DE` (EUR), `en-GB` (GBP). Languages English and German. | Owner 2026-10-19 |
| D-005 | Capsules are **Nespresso-compatible**, not Nespresso-brand. Copy says "compatible with Nespresso Original/Vertuo machines" and never uses the brand as a product brand or logo. | Owner 2026-10-19 |
| D-006 | Stack: Next.js latest stable (`16.x`, never 15.x), React 19, Tailwind v4, `next-intl` v4, SWR, `jose`, TypeScript strict, Vitest. `@commercetools/platform-sdk` ^8 and `ts-client` ^4 (the skill's gates; latest are 9.x and 5.x, revisit only on request). Node 22. | Skill, npm 2026-10-19 |
| D-007 | The app is scaffolded with `/commercetools:nextjs-setup-project` in `storefront/`, guided by the `commercetools-storefront` skill and its Next.js adapter. | Owner 2026-10-19 |
| D-008 | **Product Search indexing and `changeCountryTaxRateFallbackEnabled` are enabled in the project configuration** by `seed/` (`npm run seed:settings`). | Owner 2026-10-19 |
| D-009 | Everything the seed creates has the key prefix **`mcf-`**. Nothing without it is ours. | Plan |
| D-010 | **Image URLs are stored clean** (no query, no fragment). The images come from a search endpoint the owner provides later (`IMAGE_SOURCE_URL`, a template `https://my-app-domain.com/search/{query}.json?query={query}`, one GET per tag search), answering in the shape of `sample-data/image.json`; `sample-data/image.json` itself is truncated and not valid JSON, so the script is tested with a complete fixture. | Owner 2026-10-19 |
| D-011 | **Reviews and ratings use the commercetools Reviews API** and the product's `reviewRatingStatistics`, and are seeded. See `openspec/specs/reviews-and-ratings`. | Owner 2026-10-19 |
| D-012 | Questions go to `plans/QUESTIONS.md` with the default taken; nobody waits for an answer. | Owner 2026-10-19 |
| D-013 | **The team verifies its own work**, driving the running app with the Chrome DevTools MCP and reading project data with the commercetools MCP or the seed `verify` script. The owner is asked only for things that cannot be automated. | Owner 2026-10-19 |
| D-014 | Anything only the owner can do or test goes to `plans/TODO-MANUAL-TESTING.md`. Junior developers must add a row, never leave it in a message. | Owner 2026-10-19 |
| D-015 | B2B (business units, quotes, approvals, purchase lists) is out of scope; B2C only. | design.md D5 |
| D-016 | Payment is the hosted commercetools Checkout (payment-only mode). No custom card form. | design.md D6 |
| D-017 | Prices are **embedded prices** on variants (the skill's `recurrencePrices[]` is embedded), one per country and currency; DE and GB prices are tax-inclusive, US prices tax-exclusive. | Plan |
| D-018 | Platform tax mode with tax categories; country-level fallback rates cover US addresses without a state rate. | Plan |
| D-019 | Seeded sample-data cleanup is manifest-based: inventory the project, review the manifest, delete only what the manifest lists. No wildcard deletes. | Plan |
| D-020 | The Merchant Center sample data in the project may be removed (owner: "all is removable"), but only through D-019. | Owner 2026-10-19 |
| D-021 | One bag may hold collect, ship and subscribe lines; commercetools multiple shipping is the target, with a documented fallback if the hosted Checkout cannot take it (workstream K spike). | Plan |
| D-022 | Existing behavioural templates in `openspec/specs/` that were generated for grocery and do not fit (delivery slots, substitutions, weight pricing, account approval) are marked not applicable in `SPEC-COVERAGE.md`, not deleted. The templates are lock-tracked; do not edit them. | Plan |
| D-023 | Product Search API (`products().search()`), never `productProjections().search()`. | Skill |
| D-024 | The cart core (create cart, add a ship line, read cart, count) is built in G because quick add needs it; H adds collect and subscribe branches, I completes the cart. `CART_SHIPPING_MODE` stays `Single`; K clones into a `Multiple` cart at checkout when the bag has two fulfilment groups (shipping mode is immutable after cart creation). | Workstream plans F to K |
| D-025 | Contrast: `--ink-3` darkens to `#6E6B67`, and `--teal-text` and `--danger-text` tokens are added for text so WCAG AA holds; token names are unchanged and the owner confirms visually (M-E-02). | Workstream E |
| D-026 | Recurring orders: spike N-02 decides whether the platform creates them from an order with recurring lines (documented behaviour) or the app does; the skill's draft shape is not the documented `RecurringOrderDraft`. | Workstream N |
| D-027 | Review creation uses a second isolated server-only client (scope `manage_products`); nothing else imports it. | Workstreams D, M |
| D-028 | `proxy.ts` belongs to A (it is written by the scaffold command; its locale handling is fixed there). Toast component and provider belong to E, mounting to F. | Workstreams A, E, F |
| D-029 | Free-shipping thresholds are read from the zone rate's `freeAbove`, not hard-coded. Category images are category `assets`. | Workstreams B, F, I |
| D-030 | Markets are **US and Canada only** (owner, 2026-10-21): `en-US` (US, USD) and `en-CA` (CA, CAD, English). Germany and the UK are dropped from specs, locales, seed, plans and copy. French for Canada is not built. | Owner Q-013 |
| D-031 | Project is `spec-test-b2c-food`; credentials come from `.env` files the owner provides. | Owner Q-001 |
| D-032 | **No email provider.** New registrations are verified automatically (customer is created and used at once). **No password reset**: `password-reset` and `email-verification` are not applicable (SPEC-COVERAGE). No UI promises email. | Owner Q-002 |
| D-033 | Mixed bags are in scope: one cart may hold collect, ship and subscribe lines, and the cart shows each line clearly inside its fulfilment cluster. Spike K-01 still decides the mechanism and fallback, but "no mixed bags" is not an option. | Owner Q-003 |
| D-034 | Standard carrier delivery only. | Owner Q-004 |
| D-035 | Six stores, all in New York City (invented NYC addresses and geo locations). Collection is therefore a US-market feature; the Canada market is delivery only and hides the collect option and store picker. | Owner Q-007 |
| D-036 | Tax defaults accepted for US (0% food, 8% standard, NY 8.875%). Canada: food 0% (zero-rated), standard 5% GST, no provincial tax (HST/PST not modelled, noted for an accountant). Project config enables Product Search indexing and `changeCountryTaxRateFallbackEnabled`. | Owner Q-010 |
| D-037 | **No review moderation**: reviews are published on creation and included in statistics at once. No pending state; the moderation requirement is removed. | Owner Q-011 |
| D-038 | Hosting is **Netlify** (`/commercetools:nextjs-deploy-netlify`). | Owner Q-015 |
| D-039 | Payment uses the **complete commercetools Checkout (full hosted checkout flow) connected to Stripe**, superseding D-016 (payment-only). Workstream K re-plans around what the hosted flow owns (address, shipping, payment) and spike K-01 covers multiple shipping inside it. | Owner Q-016 |
| D-040 | The sign-in page has a **demo sign-in dropdown below the sign-in box** listing the seeded customers (name, market). Choosing one signs in through the same server login path. Emails and the demo password never reach the browser; the server holds the list and `DEMO_LOGIN_PASSWORD` (= the seed `SEED_DEMO_PASSWORD`). Controlled by `DEMO_LOGIN_ENABLED` (default true for this demo project); the release checklist asks the owner to confirm it before any public launch. | Owner, 2026-10-21 |
