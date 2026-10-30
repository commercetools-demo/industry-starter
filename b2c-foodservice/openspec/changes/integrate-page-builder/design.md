## Context

The storefront (`storefront/`, Next.js 16 App Router, next-intl, locales `en-US` and `en-CA` always prefixed) builds every page in code. A page-builder service and Merchant Center editor are already deployed for the project (service reachable under `/service`, editor visible to authors). The shim `@commercetools-labs/page-builder` 1.0.0 is on npm. The client holds no commercetools credentials for page content and no resolvers; it draws a render tree the service returns.

Relevant facts about the storefront:
- Routes: `app/[locale]/page.tsx` (home, composed from `content/home.ts` and `loadHomePage`), `app/[locale]/[...rest]/page.tsx` (calls `notFound()`), `app/[locale]/(listing)/category/[slug]`, `(listing)/shop`, `(listing)/search`, `app/[locale]/p/[slug]`, plus about, contact, faq, policies, journal, account, cart, checkout.
- Markets come from `COUNTRY_CONFIG` in `lib/utils.ts`. "Store" in the UI is a pickup location, not a commercetools store.
- `lib/security-headers.ts` sends `frame-ancestors 'none'` and `X-Frame-Options: DENY`. `app/[locale]/layout.tsx` redirects to `/gate` unless a cookie is present.
- Architecture and lint rules (`lib/architecture.test.ts`, `eslint/`) restrict imports; links go through `@/i18n/routing`.
- Origins: production `https://omni-industry-starter.netlify.app`; Merchant Center `https://food-service.mc-preview.us-central1.gcp.commercetools.com`; preview deployment TBD.

Specs: see `specs/page-builder-*`.

## Goals / Non-Goals

**Goals:**
- Authors can compose and publish home, category listing, product and content pages in Merchant Center without a storefront deploy.
- The native pages remain a safe fallback and are reused as the implementation of the placeable slices.
- Separate "no page" from "failure"; a service outage never takes the site down.
- Production framing and the demo gate stay unchanged.

**Non-Goals:**
- Cart, checkout, account, `/shop` and `/search` do not become page-builder driven.
- No commercetools client, resolver or page cache is added to the storefront for page content.
- No change to the page-builder service or editor code.
- No visual redesign.

## Decisions

### D1. One renderer module, called by each route
`lib/page-builder/render.tsx` wraps `<PageBuilder>` and takes the route's path, the URL locale and `searchParams`. Each route passes its own `fallback` and `errorFallback`. Context is built by one function from `COUNTRY_CONFIG` (`locale`, `currency`, `country`, no `store`), so URLs, locale and call never disagree.
- Alternative: a single catch-all for everything. Rejected: the home, category and product routes already exist with their own metadata and params, and next-intl needs them to stay.

### D2. Native components are the fallback and the slices
- Home: `fallback` and `errorFallback` both render the native home. No page for `/` never produces a not-found.
- Category and product: `fallback` and `errorFallback` render the native route body. The placeable components (filters, sort, pagination, result header, breadcrumbs, gallery, price, ...) wrap the existing native components and render them with natively loaded data (D4).
- Content catch-all: `fallback` is `notFound()` (a real 404); `errorFallback` is a degraded page.
- Alternative: rebuild listing and product UI as new components. Rejected: duplicates behavior and risks regressions in availability, weight pricing and subscriptions.

### D3. Placeable versus configurable in the catalog
Configurable components (banner, hero, rich text, product tile grid, product strip, call to action) are ordinary catalog types with typed fields and data sources. Placeable components are the `category-listing` and `product-detail` system components' slices, declared with `fill: { kind, slice }` and no fields. Item count, price-on-tile and swatches live on the product tile grid as settings; the data comes from the route.

### D4. Placeable components use native data, not the service's slices
The native listing and product pages are much richer than what the service resolves: range facets (intensity, price, rating) and the virtual `collection` facet, `featured` and `rating` sorts, the `avail` filter, per-store availability, required-choice and swatch data on cards, subscription and weight pricing on the product page. So the service decides only *layout* (which components, in what order, with which settings) and the storefront supplies the *data* with its own loaders (`loadListing`, `loadProductPage`). The catalog's listing and product placeable components therefore carry no `fill`, which also means the service runs no product search for them.
- The route starts the native load in parallel with the render call and stores the promise in a request-scoped holder (React `cache`); each placeable component awaits it. The listing is loaded once per request and shared by every component placed.
- A component on a path that is not a category or product renders nothing.
- Alternative: use the service's slices (needs URL, sort and facet translation, loses range facets, availability and card data; rejected). Alternative: duplicate native logic in new components (rejected).

### D5. Preview is a separate deployment with an env-flagged header policy
A second Netlify site (same repo, preview context) sets `PB_ALLOW_MC_FRAMING=true` and has the gate disabled. `lib/security-headers.ts` replaces `frame-ancestors 'none'` and drops `X-Frame-Options` only when the flag is set, listing only the MC origin. Production never sets the flag.
- Alternatives: loosen production headers (rejected: widens attack surface for a demo with a gate), or pass the gate with a token (rejected: more code and cross-site cookie issues remain).

### D6. Delivery of the shim
Plain npm dependency, pinned. No tarball or file link now that the package is published.

### D7. Catalog lives in the storefront and is pushed from CI
`page-builder.catalog.json` is in `storefront/`. A dependency-free script (copied from the shim's example) runs validate, push and publish. A unit test compares catalog type keys to the component map. The push sends only the component types that have a component, so each rollout phase can publish what exists without the palette offering what the site cannot draw.
- Netlify builds cannot read CI-only secrets implicitly: the admin secret is stored in the CI secret store only, and the push runs after the Netlify deploy succeeds.

### D8. Rollout in phases
1. Platform contract and preview deployment with an empty catalog, proving the no-page path (every page still native).
2. Catalog with home and content components; publish home and one content page.
3. Listing slices after parity checks.
4. Product slices last.
Each phase is a separate PR and leaves the site fully native where nothing is published.

### D11. Listing URLs and query are not translated
Because listing data is native (D4), the public listing URLs (`f_<facet>`, `page`, `sort`, `avail`) are unchanged and no translation to the service's parameter names exists. The query string is still forwarded untouched to the service, because it carries the editor's preview flags; the service ignores listing parameters it does not use.

### D12. Authored home components are thin, not the native ones
`Hero`, `CollectionBanner` and `ProductSection` take pre-loaded data (figures, a store, a category tree), so they cannot be bound to authored settings. The authored components are new, small and built from the design atoms and tokens; `ProductCard`, `Swatches` and the listing components are reused where their props allow.

## Risks / Trade-offs

- [An authored page places listing or product components in an order or combination the native page never had (for example a grid with no filters, or filters with no grid)] → Each component renders independently from the shared native load; tests cover every component alone and in combination.
- [Two data paths per page (service layout, native data) double the calls] → They run in parallel; the native call is the one the native page already made.
- [Sandbox deployment cold start (~15 s) exceeds the 2 s budget, so shoppers see native fallback or degraded pages] → Treat latency results from the sandbox as non-representative; require a production-type deployment before relying on authored pages for shoppers; failure path is tested on purpose.
- [New origin forces a redeploy of the MC app] → Collect the preview URL before touching the MC app; verify all three origins in both allowlists in task 1.
- [Authored page shadows a native route] → Reserved-path list in authoring docs and a check in the content route.
- [Two catalog owners overwrite each other] → This repo is the only pusher; documented in the pipeline spec.
- [Preview flags leak to shoppers] → The storefront never builds them; a test asserts no link or header carries `pb_preview`.
- [Duplicate market logic] → One context builder, used by every route.
- [Adding the shim breaks lint or architecture rules] → Components follow the repo's link component and token rules; checks run in each phase.

## Migration Plan

1. Install the shim, add env vars (`.env.example`, Netlify), deploy with an empty catalog: all pages remain native.
2. Verify the service baseline from the storefront's server (no page answer, wrong key, wrong origin).
3. Push the catalog (after owner approval), author a test home in Merchant Center, preview, publish.
4. Enable listing, then product, each after its parity check.
Rollback: unpublish the page in Merchant Center (instant, no deploy), or unset `PB_SERVICE_URL` to force the failure path to native pages. Production headers and the gate are unchanged throughout.

### D9. Route templates are configured without `{locale}`
The service matches the path exactly as the client sends it, against templates stored by the editor in `settings.preview.routes`. The storefront sends the path without the locale segment, so the templates must be `home: /`, `category: /category/{slug}`, `pdp: /p/{slug}/{sku}`, `content: /{slug}`. The service defaults (`/{locale}`, `/{locale}/{slug}/p/{sku}`) do not match this storefront. The product route is `/p/[slug]/[sku]` and the service resolves the product by sku.

### D10. The product route checks the product exists before asking the service
For an unknown sku the service still renders the global product template with an empty product (it falls back to `pdp-cat-root` / `pdp`). The route therefore verifies the product natively first and calls `notFound()` before the render call. Categories need no such check: an unknown category slug yields `page_not_found`, and the native listing fallback produces the real not-found.

## Open Questions

Answered (task 1.4, from the service source):
- Unknown category slug gives `page_not_found`; unknown product is not detectable from the response (see D10).
- Route templates must be set in the editor preview settings as in D9.
- Variant data is in the canonical product shape (`variants[].attributes`); swatches use the native `Swatches` component.

Still open:
- Preview deployment URL (needs adding to the service render origins and the MC app frame sources).
- Which variant attribute name drives swatches in the seeded catalog, and whether it must be in `PB_FACET_ATTRIBUTES` for listing facets.
- Whether the demo-tracker script (`TrackerScripts`) needs a preview exemption.
