<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: page builder integration (draft for `plans/TODO-MANUAL-TESTING.md`)

Credentials are the owner's: nothing below puts a secret in the repository, a commit or a chat.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-PB-a | Owner | Before the first catalog push | Check that the page-builder service lists in `PB_RENDER_ORIGINS` the production origin, the preview origin and `http://localhost:3000`, and in `PB_EDITOR_ORIGINS` the Merchant Center origin; that the Merchant Center app's frame sources list the same storefront origins; redeploy whichever is missing. | All origins listed in both places | TODO |
| OA-PB-b | Owner | Before the first catalog push | Put `PB_SERVICE_URL` (with `/service`), `PB_RENDER_KEY` and `PB_ORIGIN` into the Netlify environment, and `PB_ADMIN_SECRET` into the CI secret store only. | Values present; none in the repository or in the client bundle (`npm run verify:build`) | TODO |
| OA-PB-c | Owner | Before previewing drafts | Create the gate-free preview deployment of this site (second Netlify site or context) with `PB_ALLOW_MC_FRAMING=true`, `PB_MC_ORIGIN` set to the Merchant Center origin, and the same `PB_*` values; send the URL (Q-PB-2). | Preview URL opens without the gate; production still sends `frame-ancestors 'none'` | TODO |
| OA-PB-d | Owner | Before authoring pages | In the page editor's preview settings set the route templates to `/`, `/category/{slug}`, `/p/{slug}/{sku}` and `/{slug}` (no `{locale}`), the draft token equal to the service's preview token, and a sample product (Q-PB-5). | Home, category, product and content paths map to the right page types | TODO |
| M-PB-01 | Owner or Claude with credentials | After OA-PB-a and OA-PB-b | From the storefront's host: service `/status` is 200; a render call on the empty project answers 404 `page_not_found`; a wrong key answers 401; an origin that is not listed answers 403; note the latency of the call. | All four as stated | TODO |
| M-PB-02 | Owner | Before the first catalog push | Review what `npm run catalog:push` will write (the catalog file, only component types that have a component) and the target project; then run `catalog:push` and `catalog:publish` from CI or a trusted shell. | Palette in Merchant Center lists the components, data sources and sections | TODO |
| M-PB-03 | Owner | After M-PB-02 | Author and publish a home page, a category fallback page, a content page and the global product template; preview each with the draft token; check that a wrong token shows the published page. | Each page type renders from published content in both markets | TODO |
| M-PB-04 | Owner or Claude with credentials | Before release | Stop the service: pages show the native or degraded page, never "not found". Open a path with no page: real not-found. Point `PB_SERVICE_URL` at a wrong path: a logged error, not a silent not-found. Measure p95 render latency on a production-type deployment (a sandbox deployment cold-starts in about 15 s and is not representative). | Behaviour as stated; p95 within the 2000 ms budget | TODO |
