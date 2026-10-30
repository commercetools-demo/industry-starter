<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Page builder integration

Authors compose and publish the home page, category listing pages, product pages and content pages in Merchant Center. The storefront draws them with its own components. Change: `openspec/changes/integrate-page-builder`.

## How it fits

```
Shopper --> storefront route --+--> page builder service  (layout: which components, order, settings)
                               |
                               +--> native loaders          (data: listing, product)  [category, product]
```

- The service (one per commercetools project) returns a render tree. The storefront has no commercetools client, resolver or cache for page content.
- Home and content pages take their data from the render tree (product lists, category lists). The category listing and product pages take their data from the storefront's own loaders (`loadListing`, `loadProductPage`), so filters, ranges, availability, swatches, subscriptions and weight pricing behave exactly as on the native pages. The service only decides placement and settings there.
- `components/page-builder/PageBuilderRoute.tsx` is the one place a route asks for a page; `renderPage.ts` turns the answer into `page`, `none` or `failed`.

## Decisions

| Topic | Decision |
|---|---|
| Path sent | The URL without its locale segment: `/`, `/category/<slug>`, `/p/<slug>/<sku>`, `/<slug>` |
| Market | `locale`, `currency`, `country` of the URL locale (`COUNTRY_CONFIG`). No `store`: "store" here is a pickup location, not a commercetools store |
| Query string | Forwarded untouched (it carries the editor's preview flags). Public listing URLs (`f_<facet>`, `sort`, `page`, `avail`) are unchanged |
| No page | Home, category and product fall back to the native page. Content paths give the real not-found |
| Failure | Same native fallbacks; content paths give the degraded page (`ErrorPage`, server error). The shim logs the reason. Never a "not found" for a page that may exist |
| Timeout | 2000 ms (`PB_TIMEOUT_MS`) |
| Unknown component type | Skipped and logged once; shoppers never see the shim's "Unknown block type" box |
| Rich text | `richtext` fields are sanitised HTML (shim allowlist). Everything else is plain text. Q-PB-1 |
| Links and images | Authored links must be an internal path, https, http or mailto; images must be https. Anything else renders nothing |
| Route templates | Set in the editor's preview settings **without** `{locale}`: `/`, `/category/{slug}`, `/p/{slug}/{sku}`, `/{slug}`. The service's defaults do not match this site |

## Components (`page-builder.catalog.json`)

- **Configurable** (the author edits fields): hero, banner, rich text, image, call to action, category tiles, editorial strip, subscribe strip, product strip, related products, and the category **product grid** (tiles per row, price, swatches).
- **Placeable** (no fields; the author only places or omits them): on category pages, result header, breadcrumbs, filters, sort, active filters, pagination; on product pages, breadcrumbs, gallery, name and price, key facts, options, delivery/collection/subscription, add to bag, reassurance row, details, rating summary, reviews.
- One `h1` per page: the hero headline, the category result header or the product name. Authors should place only one of them.
- Reserved first path segments (`lib/page-builder/reserved.ts`): `about account cart category checkout contact dev faq journal p policies search shop`. An authored page cannot appear there. A test keeps the list equal to the native routes.

## Origins and environments

| Environment | Origin | Notes |
|---|---|---|
| Production | `https://omni-industry-starter.netlify.app` | Gated; `frame-ancestors 'none'` |
| Preview | to be created (OA-PB-c, Q-PB-2) | `PB_ALLOW_MC_FRAMING=true`, `PB_MC_ORIGIN`; no gate |
| Local | `http://localhost:3000` | |
| Merchant Center | `https://food-service.mc-preview.us-central1.gcp.commercetools.com` | The only origin allowed to frame the preview |

Every storefront origin must be in the service's `PB_RENDER_ORIGINS` and in the Merchant Center app's frame sources; the Merchant Center origin in `PB_EDITOR_ORIGINS`. A new origin means redeploying the Merchant Center app.

## Secrets and rotation

| Secret | Held by | Rotation |
|---|---|---|
| `PB_RENDER_KEY` | Service and every storefront environment (Netlify) | Change the service and all storefront environments together, then redeploy the storefront |
| `PB_PREVIEW_TOKEN` | Service, and the editor's preview settings | Change both together; the storefront never holds it |
| `PB_ADMIN_SECRET` | The service and the CI secret store only | Change both; the storefront never holds it |

`npm run verify:build` fails if any of the three appears in the client bundle.

## Catalog pipeline

Order: **deploy the storefront, then push, then publish.** Validate on change requests (writes nothing).

```
npm run catalog:validate   # PB_SERVICE_URL, PB_ADMIN_SECRET
npm run catalog:push       # writes a draft into the commercetools project; sends only types that have a component
npm run catalog:publish    # go live
```

This repository is the only pusher of the catalog for its project. `push` and `publish` write into the customer's project and need the owner's explicit yes (M-PB-02). Automating the order is open (Q-PB-3).

## Upgrades

The wire version is negotiated (`X-PB-Wire-Version: 1`). Upgrade the service first, then the storefront's `@commercetools-labs/page-builder`. An old storefront against a newer service gets a 426, shows the native or degraded page and logs "upgrade the shim".

## Ownership

| What | Owner |
|---|---|
| Catalog file and components | This repository's developers |
| Page content, publishing | Authors in Merchant Center |
| Secrets, deploys, Merchant Center registration | The project owner |

## Verification status

Code is covered by unit tests (routes, outcomes, components, headers, catalog). Live checks are listed as OA-PB-a to d and M-PB-01 to 04 in `TODO-MANUAL-TESTING.md`; results are recorded here when done.

| Check | Result |
|---|---|
| Baseline against the deployed service | pending (M-PB-01) |
| Every page type, both markets, desktop and small screen | pending (M-PB-03) |
| Draft preview, wrong token, edit mode | pending (OA-PB-c, M-PB-03) |
| Service stopped, no page, wrong URL | pending (M-PB-04) |
| p95 render latency on a production-type deployment | pending (M-PB-04) |
