<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Contentools proxy allow-list (workstream X-07)

Source of the data: `portal/lib/contentools/allowlist.ts` (written by U, hardened by X) and `storefront/lib/contentools/proxy-policy.ts`. Compared on 2026-10-12 with the CMS service routes (read only): `/Users/behnam/code/cms/service/src/routes/{configuration,puck-page,puck-content,puck-template,file,product}.route.ts`.

## Portal proxy (`/api/contentools/service/...`, session and Admin role required)

`:store` is the only variable segment that carries a store; it must equal the session store (strict mode, 403 `PROXY_STORE_MISMATCH` otherwise). `:key` is a page, content item or template key (`[A-Za-z0-9._~-]+`).

| Pattern after `service/` | Proxy allows | CMS truth | Server-held JWT attached |
| --- | --- | --- | --- |
| `:store/configuration/theme` | GET POST PUT DELETE | same four | on POST PUT DELETE |
| `:store/puck-pages`, `:store/puck-contents` | GET POST PUT DELETE | GET, POST | on writes |
| `:store/puck-pages/:key` (and `puck-contents`) | GET POST PUT DELETE | GET, PUT, DELETE | on writes |
| `.../:key/states`, `.../states/published`, `.../states/draft`, `.../versions` | GET POST PUT DELETE | GET states and versions, PUT published, DELETE draft | on writes |
| `:store/published/puck-pages/:key`, `:store/preview/puck-pages/:key` (and `puck-contents`) | GET POST | GET | no (project key only) |
| `:store/published/puck-pages/query`, `:store/preview/puck-pages/query` (and `puck-contents`) | GET POST | POST | no: a read-only query POST needs the project key, not the JWT |
| `:store/puck-templates`, `:store/puck-templates/:key` | GET POST PUT DELETE | GET, POST, DELETE | on writes |
| `:store/upload-file` | POST, multipart only | POST multipart | yes; the file is forwarded as is (no portal-side type check), request at most 5 MB plus envelope |
| `:store/media-library` | GET | GET | no |
| `products/search` (no store segment) | GET POST | GET `/products/search` | no (read query) |

Finding: the allow-list is a superset of the CMS in the method column (it allows POST, PUT and DELETE on several paths where the CMS has only some of them). The extra combinations are answered 404 by the CMS itself and need the same Admin session, strict store check and JWT-on-write rules, so this is accepted (recorded as Q-X07 with the default "keep"; tightening each pattern to the exact CMS method list is a one-line-per-row change in `allowlist.ts`).

Everything else is 404 without an upstream call: `health`, `refresh-jwt`, `authenticate-project`, `proxy-script`, `compile-upload`, `datasource`, `content-types`, the legacy `pages`, `page-*`, `content-item*`, `product` (other than search) routes, the other `configuration/<slice>` keys (`header`, `footer`, `facet`, `site-metadata`, `category-listing`, `translations`, `b2b-account-menu-links`) and the configuration lists. Path hygiene (`lib/contentools/proxy-policy.ts`): any `%`, `\`, `..`, control character or empty or `.` segment is 400 `INVALID_PATH`; case differences, trailing dots and slashes do not match the allow-list (404).

Proof: `route.test.ts` (portal proxy route handler).

## Storefront proxy (`/api/contentools/service/...`, public reads)

| Method | Pattern after `service/` | Notes |
| --- | --- | --- |
| GET | `<store>/configuration/theme`, `<store>/published/{puck-pages,puck-contents}/<key>`, `datasource`, `datasource/<key>`, `products/search` | read only, no JWT exists in the storefront |
| POST | `<store>/published/{puck-pages,puck-contents}/query` | the only POST, body at most 16 KB |

Every other method (POST, PUT, PATCH, DELETE, HEAD, OPTIONS) on every other route is 404 with no upstream request. Request headers are an allow-list (`accept`, `accept-language`, `content-type`, `if-none-match`) plus the proxy's own `x-project-key`; the answer drops `set-cookie`, `location`, `www-authenticate` and hop headers; an upstream 3xx or 5xx is `502 { error: { code: 'UPSTREAM_ERROR' } }`. The store segment is any valid store key because published pages and themes are public content of public stores; see Q-X06 for the decision not to bind it to the session. Proof: `route.test.ts`.
