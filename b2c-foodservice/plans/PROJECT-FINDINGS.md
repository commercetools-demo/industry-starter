<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Project findings

Verified platform and environment facts. Add a dated row whenever a commercetools response or tool differs from a plan.

| Date | Finding | Source | Effect |
| --- | --- | --- | --- |
| 2026-10-19 | The Claude Design MCP (`DesignSync`) returns HTTP 403 for this organization (zero data retention policy). The design came from an exported handoff zip. | Tool response | Design is read from `design/export/`; do not re-read the Claude Design project |
| 2026-10-19 | The commercetools commerce MCP did not connect (`CONNECTION_CLOSED`) | Session start | Superseded 2026-10-21: the `food-service` MCP server is connected |
| 2026-10-21 | The `food-service` commerce MCP can read the project `spec-test-b2c-food`; `changeCountryTaxRateFallbackEnabled` is already true. Writes through `mcp__food-service__update_project` were blocked by the permission classifier | Session 2026-10-21 | Product Search indexing and CA / CAD / en-CA still need a permission rule or the `seed:settings` run (OA-08) |
| 2026-10-21 | Owner decisions D-030 to D-039: US and Canada only, six NYC stores, no email or password reset, no review moderation, Netlify, full hosted Checkout with Stripe | Owner answers to Q-001 to Q-024 | All plans updated; D-016 is superseded by D-039 |
| 2026-10-19 | `sample-data/image.json` is truncated (cut inside an object) and is not valid JSON | Parse error at line 223 | Seed image code is tested against a complete fixture of the same shape |
| 2026-10-19 | Latest npm: next 16.4.2, next-intl 4.14.9, tailwindcss 4.3.3, `@commercetools/platform-sdk` 9.7.0, `ts-client` 5.1.1. The skill's gates are SDK ^8 and ts-client ^4 | `npm view` | D-006 keeps ^8 and ^4 |
| 2026-10-19 | Product reviews: `reviewRatingStatistics` (`averageRating`, `count`, `ratingsDistribution`) on the product; query reviews with `where=target(typeId="product" and id="...") and includedInStatistics=true` | docs.commercetools.com/guides/review-ratings | `reviews-and-ratings` |
| 2026-10-19 | Skill rule: Product Search API only; `recurrencePrices[]` is an embedded variant field; recurring order state value is `canceled` (one l) | Skill references | D-017, D-023 |
| 2026-10-21 | Next 16.4.2: `forbidden()`, `unauthorized()` and `forbidden.tsx` need `experimental.authInterrupts: true`. `not-found` and `forbidden` give a real 404 or 403 only before streaming starts; after that the status stays 200 with `noindex` | `node_modules/next/dist/docs` forbidden.md, not-found.md, authInterrupts.md | P sets the flag in `next.config.ts`; site origin env is `NEXT_PUBLIC_SITE_URL` (not secret) |
| 2026-10-21 | Horizontal overflow on every page at 1080 and 900 px (scrollWidth 1132) and at 375 px (467), identical on About, so it comes from the shell (header or footer grid), not from P pages | Chrome DevTools, iframe widths | F to check; P pages add none |
| 2026-10-21 | Next 16.4 error boundaries receive `retry` (refetch) as well as `reset`; the content routes are dynamic because the locale layout reads the session | Next docs, `next build` output | P calls `retry` when present (Q-P-19, Q-P-20) |
| 2026-10-21 | M-03, installed SDK 8 `ReviewDraft`: `key`, `uniquenessValue` (unique among Reviews), `locale`, `authorName`, `title`, `text`, `target` (product or channel), `state`, `rating`, `customer`, `custom`. A review created without `state` has no state gate, so it counts in `reviewRatingStatistics` at once (D-037). Update actions used: `setRating`, `setTitle`, `setText` only. A duplicate `uniquenessValue` is a 400 with error code `DuplicateField` (mapped to `already_reviewed`, live confirmation is owner row M-M-03). Reads need `view_products`, create/update/delete need `manage_products`; per D-027 writes use a second server-only client (`lib/ct/review-client.ts`, env names `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, optional `CTP_REVIEWS_SCOPES`) | SDK `review.d.ts`, docs.commercetools.com/api/projects/reviews | M-03, OA-M-a |

## F-K-01 Mixed bags and the hosted Checkout (2026-10-21)

**Status: documentation only. No live Checkout Application or Stripe connector exists (OA-04, OA-K-a), so every probe that needs one is `blocked: OA-K-a`. `storefront/scripts/spike-k.mts` is written and typechecked but has not been run (it needs live credentials).**

Documentation checked (checkout skill docs search): https://docs.commercetools.com/checkout/browser-sdk (checkoutFlow, paymentFlow, the `checkout_completed` Message with `payload.order.id`), https://docs.commercetools.com/learning-implement-checkout/implement-commercetools-checkout/extend-checkout-functionality (multiple shipping methods, skip default pages, custom order number), https://docs.commercetools.com/learning-implement-checkout/implement-commercetools-checkout/intro-to-commercetools-checkout (Checkout does not create carts).

| # | Probe | Result | Facts |
| --- | --- | --- | --- |
| S1 | Multiple cart, collect group address and method | UNKNOWN (script ready, not run) | Documented actions `addItemShippingAddress`, `addShippingMethod`, `setLineItemShippingDetails`; field names to confirm against SDK 8 types |
| S2 | Tax per market | UNKNOWN | Documented: with `Multiple`, `taxedPrice` is calculated only when every quantity is allocated |
| S3 | `matchingCart` per market | UNKNOWN | Script ready |
| S4 | Free-above on Multiple | UNKNOWN | Not documented whether the threshold compares the cart or the group |
| S5 | Discount codes on Multiple | UNKNOWN | Script ready |
| S6 | Sessions API for ship-only, collect-only, Multiple carts | blocked: OA-K-a | |
| S7, S8 | Hosted flow ship-only, created Order | blocked: OA-K-a | |
| S9 | `transitionState` from no state | UNKNOWN | Verify live that the seeded `mcf-order-ordered` state accepts a first transition (it should be the initial state) |
| S10 | Clone path / merge | UNKNOWN | Documented: `shippingMode` is immutable after creation |
| S11 | New session pays the new total | blocked: OA-K-a | |
| S12 | Hosted controls | PARTIAL from docs | `onInfo` code `checkout_completed` with `payload.order.id`; `skipPaymentSuccessPage` and `skipPaymentErrorPage` are `checkoutFlow` options; `<div data-ctc />` is the documented mount point (full page without it). UNKNOWN: `onError` codes, pay-button text, `en-CA` locale, country limit |
| S13 | Mixed bag in the complete hosted flow | **Predicted FAIL (documentation)** | "Use Payment Only mode. This is because the Complete Checkout mode handles shipping configuration internally." Not proved live |
| S14 | Collect-only cart in the complete flow | UNKNOWN | No page says whether the hosted flow keeps a pre-set store address and `mcf-collect`; it asks for shipping and billing address itself |
| S15 | Payment Only with a Multiple cart | Predicted PASS (documentation) | The documented supported path; not proved live |

**Decision (provisional, by the rule table): `MIXED_STRATEGY = 'complete-per-group'`.** S13 is predicted FAIL and S14 is UNKNOWN, so the collect group is treated as one more group paid in the complete flow (its store address and `mcf-collect` are written on its own Single cart before the session). The bag stays one bag in the UI; at pay time it is cloned into one Single cart per payment group (each collect store, then delivery plus subscription), the bag itself is untouched, and each clone is paid in sequence with `futureOrderNumber` `<base>-A`, `-B`. If S14 FAILs live, switch to `payment-only-for-collect` (K-14c, needs OA-K-e); if S13 unexpectedly PASSes, `complete-multiple`. `lib/checkout/strategy.ts` is the single switch and `buildFulfilmentActions` (the `Multiple` path) is already implemented and tested. See Q-K-02 and the todo rows OA-K-a and OA-K-e.

Deviation from the workstream: the spike script builds its own client instead of importing `lib/ct/client` (that module imports `server-only` and `@/lib/env`, which plain node cannot resolve).

Addendum F-K-01 (2026-10-21, installed `@commercetools/checkout-browser-sdk` 1.7.5 types): `checkoutFlow` takes `skipPaymentSuccessPage`, `skipPaymentErrorPage`, `forms` (address form configuration), `tax`, and `shipping: { getShippingMethods, onShippingMethodSelected }` (external shipping methods); the `checkout_completed` Message carries `payload.order.id`; style variables are `--font-family`, `--button`, `--button-outline`, `--button-hover`, `--button-text`, `--button-disabled`, `--button-disabled-text`, `--input-field-focus`, `--checkbox`, `--radio`, `--spinner`. None of this is a multiple-shipping API, so the S13 prediction stands until a live run.

K deviation (2026-10-21, D-039): the prototype's three steps (Details, Fulfilment, Payment) are replaced by Review (ours) then the hosted Checkout. Review also asks the pickup name; the shopper never sees our address or card forms. Judged in SO-K-b.

| 2026-10-21 | L-10: `apiRoot.paymentMethods()` exists in `@commercetools/platform-sdk` 8.27. `PaymentMethod` has `name` (localized), `method`, `paymentInterface`, `interfaceAccount`, `token.value`, `default`, `paymentMethodStatus` and `custom`, with no card brand or last four. A default method cannot be set `Inactive` (documented): Remove sends `setDefault false` then `setPaymentMethodStatus Inactive` in one update and promotes nothing. The PSP token is not revoked by Inactive. Which field the Stripe connector fills (`name` or `custom`) is unverified until a saved-card checkout exists (OA-K-a, OA-L-b, M-L-03) | Installed SDK declarations, docs payment-methods | The view shows `name` or "Card" and a Default tag; the token never leaves the server |
| 2026-10-21 | L: `Order.shipping[*].shippingInfo.deliveries` (Multiple mode) and `Order.shippingInfo.deliveries` (Single mode) both carry deliveries; the mapper reads both and de-duplicates by id. A delivery has no tracking URL: `trackingData` has `trackingId`, `carrier`, `provider` only, so the account builds a link for the known carriers (UPS, USPS, FedEx, Canada Post) and shows the number alone for others | Installed SDK declarations | `lib/account/tracking.ts` |
| 2026-10-21 | L-10: the scopes for stored payment methods are `view_payment_methods` and `manage_payment_methods`; the plan named `view_payments`/`manage_payments`, which cover Payment objects only | SDK and docs for PaymentMethod | `.env.example` and OA-L-a corrected |
