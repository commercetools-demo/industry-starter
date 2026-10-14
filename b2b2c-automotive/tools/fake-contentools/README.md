<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# fake-contentools

A small, dependency-free fake of the Contentools HTTP API (the multitenant Puck CMS service). The storefront (workstream H, K), the portal (U, X) and the Chrome checks run against it when no commercetools project or Contentools deployment is available. It makes **no commercetools calls** and needs no credentials.

Behaviour was written from the real service source (read only, `<contentools-repo>/service/src`): `routes/configuration.route.ts`, `puck-page.route.ts`, `puck-content.route.ts`, `file.route.ts`, `controllers/*`, `middleware/{jwt,project-key,project,error}.middleware.ts`, `app.ts`. The contract tests in `test/` name the real behaviour each case mirrors.

## Start

```
cd b2b2c-automotive/tools/fake-contentools
npm install
npm run start          # fake service on http://127.0.0.1:4010
npm run start:4011     # second instance on http://127.0.0.1:4011 (portal tests use this one, plan U-04)
npm run start:stub     # record-only stub on 4010: answers 200 {} to everything and logs (plan X-06)
npm test               # 100+ contract tests (vitest, real sockets on free ports)
npm run check          # tsc + tests
npm run fixture        # regenerate fixtures/contentools.json from seed/src/data/content.ts
```

Environment variables (all optional):

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT`, `HOST` | `4010`, `127.0.0.1` | Listen address. |
| `FAIL_MODE` | `none` | Start in a failure mode (below). `FAIL_DELAY_MS` (5000) and `FAIL_STATUS` (500) tune it. |
| `JWT_MODE` | `jwt` | `jwt`: writes need `Authorization: Bearer <three-part JWT with a sub claim>`; the signature is not verified; an `exp` in the past, a foreign `iss` or `aud` is rejected. `lenient`: any non-empty bearer token. |
| `PROJECT_KEYS` | `*` (any) | Comma list of registered project keys; others get 403. `INACTIVE_PROJECT_KEYS` marks keys inactive (403). |
| `STUB_MODE` | off | `1`: skip routing and auth, answer `200 {"ok":true,"stub":true}` to every non-admin request, still log. |
| `PUBLIC_BASE_URL` | `http://localhost:<port>` | Origin used in upload URLs. |
| `FIXTURE` | `fixtures/contentools.json` | Alternative seed fixture. |

The fixture is loaded into memory at start; nothing is persisted. `POST /__admin/reset` reloads it.

## Routes (all under `/service`, like the real app)

Reads need the `x-project-key` header (400 `x-project-key header is required`, 403 for an unregistered or inactive project). Writes need `Authorization: Bearer <jwt>` (401 `Authorization header missing` and the other real messages) and do not need `x-project-key`.

| Method and path | Auth | Answer |
| --- | --- | --- |
| `GET /:bu/configuration/theme` | project key | `200` the theme object; **falls back to the `default` namespace**; `200 null` when no default exists either |
| `POST /:bu/configuration/theme` body `{ value }` | JWT | `201` value. Upsert: a second POST is `201` again, never 409 |
| `PUT /:bu/configuration/theme` body `{ value }` | JWT | `200` value (also creates) |
| `DELETE /:bu/configuration/theme` | JWT | `204`; a missing theme gives `500` (real quirk, see deviations) |
| same four for `header`, `facet`, `footer`, `site-metadata`, `category-listing`, `translations`, `b2b-account-menu-links` | | same behaviour, same `default` fallback |
| `GET /:bu/configuration`, `GET /:bu/configurations` | project key | all slices, missing ones `null` |
| `GET /:bu/puck-pages`, `GET /:bu/puck-pages/:key` | project key | list or one page with `states` |
| `POST /:bu/puck-pages` body `{ value: { name, slug, puckData?, meta? } }` | JWT | `201` custom object, key `puck-page-<uuid>`, draft state and version created |
| `PUT /:bu/puck-pages/:key`, `DELETE /:bu/puck-pages/:key` | JWT | `200` / `204` |
| `GET /:bu/published/puck-pages/:key` | project key | published value or `404 Published puck page not found` |
| `POST /:bu/published/puck-pages/query` body `{ query: 'slug = "/home"' }` | project key | the **published page value** (`name`, `slug`, `puckData`, `meta`, ...) or 404; `400 query is required in request body` |
| `GET /:bu/preview/puck-pages/:key`, `POST /:bu/preview/puck-pages/query` | project key | draft, else published |
| `GET /:bu/puck-pages/:key/states`, `GET .../versions` | project key | state and version objects (max 5 versions) |
| `PUT /:bu/puck-pages/:key/states/published[?clearDraft=true]`, `DELETE .../states/draft` | JWT | publish, revert draft |
| every `puck-pages` route again as `puck-contents` (value `{ name, contentType, data? }`, list filter `?contentType=`) | | same behaviour |
| `POST /:bu/upload-file` multipart `file` (+ `title`, `description`) | JWT | `200 { url }`; no file: `400 { error: 'No file uploaded' }` |
| `GET /:bu/media-library?extensions=&page=&limit=` | project key | `{ files, pagination }` |
| `GET /health`, `POST /refresh-jwt` | project key / JWT | health body, a fresh unsigned token |
| `GET /__files/<project>/<bu>/<name>` (not under `/service`) | none | the uploaded bytes (stands in for the object-store URL) |

Errors have the real shape `{ "message": "..." }` (plus `errors` when present). Unknown paths are `404 { "message": "Path not found." }`. Anything that is not a `CustomError` in the real service (malformed JSON, JSON body over 100 kB, multer errors) is `500 { "message": "Internal server error" }`. No stack, no header, no token is ever echoed.

## Seed data (`fixtures/contentools.json`)

Built by `npm run fixture` (`scripts/export-theme-fixture.ts`) from `seed/src/data/content.ts`; `test/fixture.test.ts` fails when the committed file drifts.

| Namespace / store | Theme (`{ns}-theme`) | Pages and content |
| --- | --- | --- |
| `default` | exactly the seed `defaultTheme` (Garage Maroon `#821810`) | none (pages have no fallback) |
| `mau-reseller-north` | navy `#1d3b78`, amber accent, radius `lg`, Archivo headings, `md` card shadow | published `/home` (AutomotiveHero, CategoryTiles, PromoBanner, PopularProducts, BrandStrip), draft-only `/about` (published query gives 404), published content `announcement` |
| `mau-reseller-south` | green `#1f6f43`, blue accent, radius `sm`, Inter, outline buttons, no card shadow | published `/home` (AutomotiveHero without finder, VehicleFinder, CategoryTiles, PopularProducts) |
| any other key, for example `qa-unknown` | falls back to `default` | `404` |

The home slug is `/home` (workstream H constant `HOME_SLUG`); a query `slug = "home"` finds nothing (see Q-J4-01 in `plans/notes/questions-ABCGH.md`).

## Test features (not in the real service)

All under `/__admin/*` (never logged, never affected by failure modes):

- `GET /__admin/requests` returns the request log as a JSON array (alias `GET /__log`; `DELETE` clears it). Each entry: `id`, `at`, `method`, `url`, `path`, **all received headers (lower-case; the log is for tests, never run it anywhere shared)**, parsed `body` (multipart: metadata only), `status` (`null` when the connection was dropped) and `handledBy` (`route`, `override`, `stub`, `fail:<mode>`). Filters: `?method=PUT&path=configuration&pathPrefix=/service/x&since=<id>`. Use it to assert the proxy rewrote the store key in the path and sent no `cookie` and no `authorization` on reads.
- `POST /__admin/fail` body `{ "mode", "delayMs"?, "status"?, "times"? }`, `GET` shows, `DELETE` resets. Modes:
  - `500` every request answers 500 (`status` can make it 502 and so on)
  - `slow` every request is delayed by `delayMs`, then answered normally
  - `drop` the socket is destroyed (network error)
  - `theme-down` only `GET .../configuration/theme` answers 503, everything else works
  - `theme-500`, `theme-slow`, `theme-drop` the same three for the theme read only
  - `times: n` limits the number of affected requests, then the service recovers
- `POST /__admin/overrides` body `{ method?, pathPrefix?, pathRegex?, status, headers?, body?, echoRequestHeaders?, times? }` scripts one response, for example a `302` with a `Location` (X D12) or a `500` whose body echoes the received headers (X D13). `GET` lists, `DELETE` clears.
- `POST /__admin/reset` reloads the fixture and clears log, uploads, overrides and the failure mode back to the start value. `GET /__admin/state` lists custom object keys per container. `GET /__admin/health` is a liveness probe.

## How the apps use it

### Storefront (workstream H, K)

```
CONTENTOOLS_ORIGIN=http://localhost:4010
CTP_PROJECT_KEY=spec-test-b2b2c-automotive      # any value works while PROJECT_KEYS is unset
```

- Theme read (H-07): `GET {origin}/service/{storeKey}/configuration/theme`, header `x-project-key`, no token. `mau-reseller-north` and `mau-reseller-south` return different themes; `qa-anything` falls back to `default`. Publish the QA themes of H-10 with `PUT`/`POST` and a JWT, or simply `curl -X PUT` (any three-part token with a `sub`), or use the fixture stores.
- Published page (H-02, K): `POST {origin}/service/{storeKey}/published/puck-pages/query` with `{ "query": "slug = \"/home\"" }`. North and south return a document, any other store returns 404 and the default home layout.
- Proxy tests (H-09): point the proxy at the fake and read `GET /__admin/requests` to assert `x-project-key` was injected and `cookie`, `authorization` and the spoofed `x-store-key` never arrived.
- Failure scenarios (Y, H section 6 steps 9 and 10): `curl -X POST localhost:4010/__admin/fail -d '{"mode":"theme-down"}' -H 'content-type: application/json'` makes the theme endpoint 503 (the storefront must fall back to the last good theme, then the built-in default); `{"mode":"slow","delayMs":4000}` exercises the 2 second timeout; `{"mode":"500"}` and `{"mode":"drop"}` cover server error and network error. `DELETE /__admin/fail` restores.

### Portal (workstream U, X)

```
CONTENTOOLS_ORIGIN=http://localhost:4011        # U: fake service, JWT mode "jwt" accepts the X-12 canary
CONTENTOOLS_ORIGIN=http://localhost:4010        # X: npm run start:stub (record-only), same /__log endpoint
```

- U-04 asks for GET/PUT theme, a pages list and an upload returning `{ url }`: all exist, with the real status codes (POST and PUT are both an upsert, never 409; `upload-file` answers `{ url }`). `GET /service/{bu}/puck-pages` is the pages list. Uploaded files are served from `/__files/...` so logo previews render.
- Writes require a header `Authorization: Bearer <jwt>`; the portal's server-side JWT resolution can hand over any JWT-shaped token (the X-12 canary `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9.CANARY-SIGNATURE-...` is accepted in `jwt` mode). Check the log afterwards: reads must carry no `authorization`, writes must carry the server token only, nothing may carry the browser `cookie`.
- X attack matrix: use `start:stub` for rows that only need recording (D01 to D11); use the normal fake plus `POST /__admin/overrides` for D12 (redirect) and D13 (upstream echoes the received `Authorization`). `GET /__log` and `DELETE /__log` match the wording of X-06.
- Store-key rewrite proof (D02): `GET /__admin/requests?pathPrefix=/service/<S>` must contain the request, and `?path=<B>` must be empty.

## Deviations from the real service (deliberate)

1. **No signature check.** The JWT secret is not known; in `jwt` mode the claims are checked (`sub`, `exp`, `iss`, `aud`), the signature is not. `lenient` mode accepts any string.
2. **One data set, not one per commercetools project.** The real service stores data in the project that belongs to the JWT (`sub`) or the `x-project-key`. The fake shares one store across all project keys (it only validates registration with `PROJECT_KEYS`).
3. **Predicate language.** Queries support `field = "text"` and `!=` clauses joined by `AND` (all the shell of the storefront and portal need). `OR`, `in`, nested `field(...)` and numbers answer a commercetools-style `400 Failed to get custom objects: Malformed parameter: where` where the real service would run them. The real service pastes the query unescaped into the commercetools predicate (an injection risk noted for workstream X); the fake rejects instead of reproducing that.
4. **Datasource resolution is not done.** The real service resolves `{ type, skus }` props of Puck blocks into `resolvedData` with commercetools product calls; the fake returns the props unchanged. `puck-templates`, `content-items`, legacy `pages`, `datasource`, `products`, `proxy-script`, `authenticate-project`, `compile-upload` and `content-types` are not implemented and answer `404 Path not found.`.
5. **Uploads** go to memory and are served from `/__files/...` of the fake instead of an S3, GCS or Cloudinary URL; no size or type limit (like the real route, which relies on the caller).
6. **CORS** reflects `http(s)://localhost` and `127.0.0.1` origins only; it does not reproduce the real allow-list or its `Not allowed by CORS` 500.
7. **Faithful quirks kept on purpose** so tests do not pass here and fail live: POST and PUT are upserts (no 409); `DELETE` of a missing object is 500, not 404; a failed body parse is 500, not 400; `GET /puck-pages/:key` ignores the business unit of the object; updates merge every field of the posted value.
