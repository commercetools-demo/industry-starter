## Why

Malva's home, listing and product pages are composed in code (`content/home.ts`, `ListingPage`, the PDP components), so every layout or copy change needs a developer and a deploy. The page builder (service and Merchant Center editor, already deployed for this commercetools project) lets business users compose and publish those pages, while the storefront keeps drawing them with its own components.

## What Changes

- Add the `@commercetools-labs/page-builder` shim (npm) to the storefront and mount it in one place: a single renderer used by the home route, the `[...rest]` catch-all, the category listing route and the product route.
- Define a catalog (components, data sources, sections, theme) owned by this storefront, with two kinds of component:
  - **configurable**: author edits fields and data bindings (banner, product tiles with items per row, price on tile and variant swatches);
  - **placeable**: the system slices of a page (facets, sort, pagination, result header, breadcrumbs, price, gallery and so on). The author only places or omits them; they render what the page already renders.
- Home, category listing (PLP), product detail (PDP) and content pages become page-builder driven. The existing native implementations stay as the fallback when the service fails, and as the slice implementations.
- Distinguish "no page" (real not-found, or native fallback during migration) from "failure" (degraded page, logged).
- Add a gate-free, framable preview deployment. Production keeps `frame-ancestors 'none'` and the demo gate.
- Add a CI pipeline for the catalog: validate on change requests, then deploy, push and publish.
- Keep `store` out of the render call: "store" in this app is a pickup location, not a commercetools store.
- **Not** in scope: cart, checkout, account, search results, and `/shop`. They stay native.

Survey of existing commercetools usage: the storefront already reads products, categories and availability itself through its own server-side API client (`lib/ct`, `lib/listing`, `lib/product`, `lib/availability.ts`). The page builder service has its own API client and the storefront gets no new credentials. The storefront does not call the service's commercetools reads, only its render API.

## Capabilities

### New Capabilities
- `page-builder-platform-contract`: renderer mount, request context (path, locale, currency, country), outcome classification, timeout, configuration.
- `page-builder-home`: the home page as a page-builder page, with its configurable components.
- `page-builder-plp`: category listing with configurable components and placeable slices.
- `page-builder-pdp`: product detail with placeable slices and configurable content blocks.
- `page-builder-content-pages`: free-form pages rendered by the catch-all route.
- `page-builder-preview`: gate-free framable preview deployment, draft token handling, origin allowlists.
- `page-builder-catalog-pipeline`: catalog validate, push and publish in CI, in the required order.

### Modified Capabilities
<!-- None. The existing home-landing-page, product-listing-page and product-detail-page specs keep describing the native behaviour, which remains as the fallback and as the slice implementations. -->

## Impact

- Code: `app/[locale]/page.tsx`, `app/[locale]/[...rest]/page.tsx`, the category listing and product routes, a new component map and catalog file, `lib/security-headers.ts` (conditional framing), the gate (preview bypass), `package.json`, `.env.example`, `netlify.toml` and CI.
- Services: the deployed page-builder service (`PB_RENDER_ORIGINS` must list the production and preview origins) and the Merchant Center app (frame sources must list the same). A new origin means a redeploy of the MC app.
- Origins: production `https://omni-industry-starter.netlify.app`; preview is a separate gate-free deployment (URL to be provided); local development `http://localhost:3000`; Merchant Center `https://food-service.mc-preview.us-central1.gcp.commercetools.com`.
- Secrets: render key, preview token and admin secret go in the Netlify and CI secret stores. They never enter the repository or chat.
- Writes to the customer project: the catalog push and author publishing write custom objects. Each needs explicit confirmation before it runs.
