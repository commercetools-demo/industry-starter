# Workstream V: gaps and things that may bite others

- All pages sit under the locale layout that reads the session, so they are dynamic, not SSG. They do not call commercetools, but a commerce outage can still affect the shared shell (H). A truly static marketing layout needs a split layout.
- Withdrawn articles return HTTP 200 (not 410); they are `noindex` and exempt from the sitemap.
- Content changes need a rebuild/redeploy (files in the repo); the "editor publishes without deployment" scenario is only covered as "page reads the current file".
- Policy "opened from checkout" is proven for the link (new tab); the checkout page itself must use `PolicyLink`.
- `SITE_URL` unset gives localhost canonicals.
- Policy version dates compare as ISO strings and use the server's UTC date for "in force".
- `test/import-graph.ts` follows static imports only, resolving `@/` and relative paths.
- `next.config.ts` and `.env.example` (shared) were touched additively.
