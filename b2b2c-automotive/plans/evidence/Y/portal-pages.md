<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Portal page inventory (task Y-00, portal half)

Dev fixture mode (`PORTAL_DEV_FIXTURES=on`, never production). Sign-in for the browser runs: `POST /api/auth/login` from the sign-in page with the fixture users of `lib/portal/dev-fixtures.ts` (`adminA` = admin.a@example.com, `buyerA` = buyer.a@example.com; the fixture password is the synthetic one in that file). Every row was run in `de-DE` and `en-US`, light and dark, as `adminA` and `buyerA` (a role without access shows the `Forbidden` view, which is part of the check).

| Route | Page | State put in | Persona |
| --- | --- | --- | --- |
| `/sign-in`, `/register`, `/reset`, `/reset/[token]`, `/accept-invite/[token]`, `/pending-approval` | Auth card pages | default, error and success messages by the form tests | anonymous |
| `/` | Dashboard | fixture KPIs, widgets, heads-up banner | adminA, buyerA |
| `/catalog`, `/catalog/prices`, `/catalog/product-info`, `/catalog/product-discounts`, `/catalog/cart-discounts`, `/catalog/priority`, `/catalog/discounts/[kind]/[id]` | Catalog and pricing tabs (tailoring and image alt text in `product-info`) | fixture assortment | adminA, buyerA |
| `/bundles`, `/import` | Bundles, product import (three tabs) | fixture products | adminA (buyerA: Forbidden) |
| `/store/settings`, `/store/channels`, `/store/share`, `/store/theme[/...]` | Store and channels (branch list and editor with the Leaflet map and the address fields) | fixture store | adminA, buyerA |
| `/content/pages`, `/content/blocks` | Contentools Pages and Content blocks (third-party editors, surrounding chrome only) | Contentools not connected | adminA |
| `/marketing`, `/email`, `/partnership` | Marketing, e-mail (stores content, never sends), brand partnership | fixture campaigns and templates | adminA |
| `/customers`, `/customers/[id]` | Customers and detail | six fixture customers per store | adminA |
| `/subscriptions`, `/returns`, `/reviews` | Subscriptions, returns (record dialog, refund dialog), reviews | fixture records | adminA (returns and reviews also buyerA read-only) |
| `/company/users`, `/company/addresses`, `/company/profile`, `/account/general`, `/account/security`, `/account/addresses`, `/account/business-units` | Company and team, account settings | fixture user | adminA, buyerA |
| overlays | Command palette (Ctrl+K), notification panel, Copilot panel, business unit switcher, account menu, customer-session banner, mobile drawer under 700 px | opened by the component tests (`Shell.a11y.test.tsx`) and by the keyboard walks | adminA |
| `not-found`, `error`, `forbidden` | Error pages | unknown route; buyerA on an Admin route | both |

Viewports for the responsive runs: 320 (reflow), 375, 768, 1024, 1440.
