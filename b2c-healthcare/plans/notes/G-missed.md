# Workstream G: gaps and things that may bite others

- Scenarios "Catalog page" and "Patient data in the first HTML" are marked N/A: they need real pages (H/J). The loaders and the session-scoped fallback are tested.
- The scans (`lib/ct/public-reads.test.ts` for `unstable_cache`, `lib/server-boundary.test.ts` for navigation-in-try and handlers in server pages) are regex based: they catch the common shapes, not every possible one.
- `generateStaticParams` or any page that reads the root layout now becomes dynamic (the layout reads the session cookie by design); static rendering of marketing pages is gone unless H splits the layout.
- `getValidCountryConfig` is not yet wired into `routing.locales`/`proxy.ts` (those stay the unfiltered `COUNTRY_CONFIG`, as C noted); only `POST /api/locale` uses it. With one region this is harmless; a multi-region launch must decide whether a missing project region should also 404 the URL.
- The search wrapper does not retry or cache; high-volume lists should consider short per-query caching only if no price/currency varies (it does), so none was added.
- `getShippingMethods` returns every active method regardless of zone/currency; the UI must filter by the visitor's currency.
- Project scope `view_project_settings` was not in D's scope list (D-question 2: "likely need" list). `getProjectSettings` calls `apiRoot.get()`, which needs it (or `manage_project`); the owner must confirm the API client has it, else `getValidCountryConfig` throws and `/api/locale` returns 500. Also `view_categories`, `view_shipping_methods` (public reads) and `view_products`/`view_published_products` are needed; check against `.env.example` scopes.
- `npm audit` findings remain untriaged (A).
