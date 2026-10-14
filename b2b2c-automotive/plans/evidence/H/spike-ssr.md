<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# H-08 SSR spike: does the Puck renderer render on the server?

**Outcome: yes. SSR works; the client-only fallback (Q-H02) is not needed.** Scenario `Published page is in the initial HTML` is satisfied, not waived.

What was run (storefront, Next 16.4.0 Turbopack, `@commercetools-demo/puck-renderer` 0.8.3, `puck-api` 0.8.1):

1. `components/contentools/ContentoolsPage.ssr.test.tsx`: `renderToString` of `ContentoolsPage` with a one-block `TextBlock` page contains the block text; hostile rich text (`<script>`, `onerror`) is stripped in the server render.
2. `next build` with a temporary page (`/en-US/spike-ssr`, deleted afterwards) rendering `ContentoolsPage`: no warnings about untraceable modules or `jsdom`; `next start -p 3012` then `curl` showed `class="puck-page"` and the block text in the initial HTML (2 occurrences: rendered HTML and the RSC payload). The `window.__pwned` string appeared once, inside the RSC payload string only (props as data), not as a `<script>` element in the markup.
3. The build here is a local `next start`; the Netlify bundler concern (jsdom tracing through `isomorphic-dompurify`) is NOT proven by this. Live check M-H-2 (Netlify preview build) is listed in `plans/TODO-MANUAL-TESTING.md`. If it fails, switch `ContentoolsPage` to `dynamic(() => import('./PuckRenderClient'), { ssr: false })` as the reference starter does; the fetch of the page JSON stays on the server either way.

Not covered: the fake fixture pages use blocks (`AutomotiveHero`, `CategoryTiles`, ...) that are not in `defaultRenderConfig`; workstream K adds them to `components/contentools/render-config.ts`.
