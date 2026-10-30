<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: page builder integration (draft for `plans/QUESTIONS.md`)

| ID | Question | Default being built | Blocks | Status |
| --- | --- | --- | --- | --- |
| Q-PB-1 | Authors write rich text (hero headline and text, rich text block, editorial text) as HTML. The content rule here is "no raw HTML". May author HTML be shown if it passes the page builder shim's sanitiser (allowlist; script, event handlers and `javascript:` URLs removed)? | Yes, for `richtext` fields only, through the shim's sanitising text component. Plain `text` fields are React text. A test proves script, handlers and `javascript:` are removed. | No (switch the three fields to `text` in the catalog to forbid it) | Open |
| Q-PB-2 | What is the URL of the gate-free preview deployment? It must be in the service's `PB_RENDER_ORIGINS` and in the Merchant Center app's frame sources, which needs a redeploy of the MC app. | Preview is built as an environment switch (`PB_ALLOW_MC_FRAMING`, `PB_MC_ORIGIN`); no URL is assumed. | Previewing drafts in Merchant Center | Open |
| Q-PB-3 | How should "deploy the storefront, then push the catalog, then publish" be automated? Netlify deploys from git and this repository has no CI workflow. | `npm run catalog:validate`, `catalog:push` and `catalog:publish` exist and a push holds back component types without a component; no workflow is written (it would live in the shared repository root). | Automated catalog updates | Open |
| Q-PB-4 | Product tiles in authored home and strip components are plain links with image, name and price, without quick add or availability, because the service's product card does not say whether a product needs a grind or colour choice or its store availability. Acceptable? | Yes. The authored listing grid uses the native product card with all of that, from the native listing data. | No | Open |
| Q-PB-5 | The service matches the editor's route templates against the path as the storefront sends it (no locale segment). The editor's defaults contain `{locale}` and a different product path. | The storefront sends `/`, `/category/<slug>`, `/p/<slug>/<sku>`, `/<slug>`; the templates in the editor's preview settings must be set to match (OA-PB-d). | Authored pages not found | Open |
