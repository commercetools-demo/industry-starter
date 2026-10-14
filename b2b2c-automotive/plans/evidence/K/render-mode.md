<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# K render mode (D10)

**Server rendered.** `ContentoolsPage` is a client component imported directly; Next renders it on the server. The page JSON is read on the server (`getPublishedPage`) and passed as props.

- `next build` (dummy env) is green, no jsdom tracing warnings. `components/contentools/ContentoolsPage.home.test.tsx` `the page is in the initial server HTML (render mode)`: `renderToString` contains "Shop all parts".
- `next dev`, `curl /en-US/mau-reseller-north` (published page): the HTML contains the hero H1 "Genuine parts from Küstenwerk Auto Parts, ready near you.", "Shop all parts" and "Shop by category".
- The Netlify bundler concern stays live check M-H-2 (see `plans/evidence/H/spike-ssr.md`). If it fails, switch `ContentoolsPage` to `next/dynamic` with `ssr: false`.
