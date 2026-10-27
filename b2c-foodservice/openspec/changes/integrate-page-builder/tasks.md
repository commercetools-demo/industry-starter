## 1. Platform baseline and origins (owner actions; the agent prepares inputs and checks)

- [ ] 1.1 Record the three origins (production, preview, `http://localhost:3000`) and the MC origin; confirm they are in `PB_RENDER_ORIGINS`, `PB_EDITOR_ORIGINS` and the MC app frame sources, listing any redeploy needed [SKILL: commercetools-connect]
- [ ] 1.2 Owner stores `PB_RENDER_KEY`, `PB_PREVIEW_TOKEN` and `PB_ADMIN_SECRET` in the Netlify and CI secret stores (never in the repo or chat)
- [ ] 1.3 Verify the baseline from the storefront's server: status route 200, empty project gives 404 `page_not_found`, wrong key gives 401, unlisted origin gives 403, and record render latency [SKILL: commercetools-connect]
- [x] 1.4 Confirm the service route templates for category and product match `/category/{slug}` and `/p/{slug}/{sku}` (set without `{locale}`), and answer the open questions in design.md about unknown slugs and swatch attribute [SKILL: commercetools-storefront]

## 2. Shim and renderer

- [x] 2.1 Add `@commercetools-labs/page-builder` as a pinned dependency and the four `PB_*` variables to `.env.example`
- [x] 2.2 Implement the single context builder (path without locale, locale, currency, country, no `store`) with tests for `en-US`, `en-CA` and the home path
- [x] 2.3 Implement the shared renderer module with `fallback` and `errorFallback` per route, query string forwarded, and failure logging
- [x] 2.4 Add tests for outcome classification: `page_not_found`, other 404, 401, 403, 426, timeout, bad body
- [x] 2.5 Add a bundle-secret check for the render key, preview token and admin secret to the existing `check-bundle-secrets` script
- [x] 2.6 Soft-fail unknown component types (skip and log) and cover it with a test

## 3. Preview deployment

- [x] 3.1 Add `PB_ALLOW_MC_FRAMING` handling to `lib/security-headers.ts` (MC origin only, no `X-Frame-Options`), default off, with tests for both states
- [x] 3.2 Disable the demo gate on the preview deployment and cover the frame-without-cookie case
- [ ] 3.3 Create the preview Netlify site/context, set its env vars, and send the preview URL for the allowlists
- [x] 3.4 Add a test that no link, redirect or response header on shopper paths contains `pb_preview`

## 4. Catalog and component map

- [x] 4.1 Create `page-builder.catalog.json` with sections, theme tokens and data sources (product list, category list, related products)
- [x] 4.2 Define the configurable components: hero, banner, rich text, image, category tiles, collection banner, product strip, editorial strip, subscribe strip, call to action, product tile grid (items per row, price, swatches)
- [x] 4.3 Define the placeable slices for `category-listing` (facets, sort, pagination, result header, breadcrumbs) and `product-detail` (gallery, title, price, variant selector, add to bag, description, availability)
- [x] 4.4 Build the component map and a test that catalog type keys equal map keys
- [x] 4.5 Validate the catalog against the shipped schema and fix every reported violation

## 5. Home and content pages

- [x] 5.1 Implement thin authored home components from the design atoms (the native home pieces need pre-loaded data), reusing `ProductCard` where it fits and using the repo's link component, tokens and accessibility rules, with empty states for optional fields
- [x] 5.2 Mount the renderer in `app/[locale]/page.tsx`, with the native home as `fallback` and `errorFallback`, keeping metadata, alternates and JSON-LD
- [x] 5.3 Mount the renderer in `app/[locale]/[...rest]/page.tsx` with `notFound()` for no page and a degraded page for failure
- [x] 5.4 Add the reserved-path list and a test that native routes win over authored pages
- [x] 5.5 Implement the content components (rich text, image alt text, call to action) and test link locale handling

## 6. Catalog pipeline

- [x] 6.1 Add the catalog script (validate, push, publish) with the admin secret read from the environment
- [ ] 6.2 Wire validate on change requests and push then publish after a successful deploy, never before it
- [ ] 6.3 **Owner confirmation:** show the catalog and target project and get a yes before the first push [SKILL: commercetools-platform]
- [ ] 6.4 Push and publish the catalog, and confirm the palette appears in Merchant Center [SKILL: commercetools-platform]

## 7. Listing and release

- [x] 7.1 Build the request-scoped native listing holder (route starts `loadListing` in parallel with the render call; components await the shared promise) and test that it loads once per request [SKILL: commercetools-storefront]
- [x] 7.2 Implement the placeable listing components (filters, sort, pagination, result header, breadcrumbs, subcategories) over the native components with the shared native data; each renders nothing off a category page
- [x] 7.3 Implement the product grid over the native `ProductCard` with items per row, price and swatches settings
- [x] 7.4 Drop `fill` from the listing placeable entries in the catalog and update the catalog tests and descriptions
- [x] 7.5 Mount the renderer in the category route: specific page, then fallback page, then native listing; real not-found for an unknown category; `/shop` and `/search` stay native; forward the query string untouched
- [x] 7.6 Test every listing component alone and in combination (grid without filters, filters without grid), plus the URL scenarios (`f_`, `sort`, `page`, `avail`)
- [ ] 7.7 Author and publish a category fallback page with the owner, preview it, and verify facets, sort and paging through the URL

## 8. Product detail (later phase)

- [x] 8.1 Build the request-scoped native product holder (route starts `loadProductPage` in parallel; components await it) and test that it loads once per request [SKILL: commercetools-storefront]
- [x] 8.2 Implement the placeable product components (gallery, title, price, variant selector, add to bag, description, rating, availability) over the native PDP components with the shared native data; add to bag keeps the existing cart flow
- [x] 8.3 Drop `fill` from the product placeable entries in the catalog and update the catalog tests
- [x] 8.4 Implement the configurable product content blocks (banner, rich text, related products strip)
- [x] 8.5 Mount the renderer in the product route with the native PDP as fallback; the native loader decides not-found; keep metadata, redirects for a wrong slug and structured data
- [ ] 8.6 Author the global product template with the owner and release only after both markets pass

## 9. Verification and docs

- [ ] 9.1 Check every page type in both markets on desktop and small screen, draft preview, wrong token and edit mode in the preview deployment
- [ ] 9.2 Check failure behavior on purpose: service stopped gives a degraded or native page, a path with no page gives a real not-found, a wrong service URL gives a logged error
- [ ] 9.3 Measure p95 render latency against the 2000 ms budget on a production-type deployment, marking sandbox results as not representative
- [ ] 9.4 Check accessibility of authored output (headings, alt text)
- [x] 9.5 Document the contract decisions, origins, secret rotation, upgrade order, ownership and verification results in the repo docs
- [x] 9.6 Append what was learned to the integrate-page-builder skill's integration log
