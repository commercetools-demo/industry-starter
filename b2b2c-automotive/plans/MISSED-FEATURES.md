<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Missed, deferred and partial features

Juniors append a row whenever something in a spec could not be built, was built partly, or was deferred. Nothing here is silent: the lead reviews this file before every release gate (workstream Z).

| Workstream | Spec / requirement | What is missing | Why | Needs (owner, live project, design, API fact) | Status |
| --- | --- | --- | --- | --- | --- |
| T | `design-price-overrides-and-margin` / Margin feedback | Margin chip and below-cost warning | The seed has no cost price | Owner decision on a cost source | open |
| W | `design-marketing` / co-op campaign cards, e-mail templates | The seed does not write demo `malva-coop-campaigns` or `malva-email-templates` objects | Value shapes and default template texts live in the portal (`ensure-w.mjs`, W-01, W-04); a second writer in the seed would drift (Q-S20) | None; `portal/scripts/ensure-w.mjs` keeps creating them with `"demo": true` | decided, no seed change |
| E, F | `design-product-listing-page` / Most popular, Top rated | Reviews carry no custom type, state or store (stateless plain reviews) | Workstream V creates `malva-review` and the review states; the seed must not depend on them | V to decide whether to migrate the seeded reviews (M-E-02 checks they count in the statistics) | open |
| F, T | `design-discounts-and-priority` / store scope of product discounts | The reseller product discounts are limited by a channel clause (retail channel only); a branch's own price and the Malva base price are not discounted by them. Product discounts have no `stores` field | commercetools model | Owner/T decision whether branch channels should be added to the clause (Q-S19) | open |
| H, U, X | `tools/fake-contentools` / datasource resolution and other services | The fake does not resolve `{ type, skus }` datasource props into `resolvedData`, and does not implement `puck-templates`, legacy `content-items` and `pages`, `datasource`, `products`, `proxy-script`, `authenticate-project`, `compile-upload` (all answer `404 Path not found.`). It also checks JWT claims but not the signature, and keeps one data set for all project keys | Not needed by the storefront or portal tests as planned; real behaviour is covered only by the live checks that need OA-02 | Add the routes if a block (K) or a portal manager (U) starts to depend on them; `proxy-script` only to prove X's allow-list blocks it | open |
| A, B | `consumer-storefront/bootstrap-and-structure` / Scaffold, Styling | `app/icon.svg` is a placeholder favicon (a maroon square); the real logo and favicon come from store settings later (Q-U01). `app/api/*`, `lib/session*.ts`, `lib/env.ts`, Contentools modules and the root layout `SWRConfig`/theme `<style>` are not created (G, H) | Out of A, B, C scope | None | open |
| C | `consumer-storefront/bootstrap-and-structure` / Locale routing | The not-found page link home goes to `/`, which is `/<locale>` and again not found (no store segment, no dealer locator) | Plan text for C-05 | Store picker (I) decides the target | open |
