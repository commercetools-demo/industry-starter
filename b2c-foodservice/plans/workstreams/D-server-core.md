<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream D: Server core (client hardening, session, utils, types, mappers, cache keys, image config, errors)

## 1. Header

| Field | Value |
| --- | --- |
| ID | D |
| Name | Server core: the BFF foundation every later workstream imports |
| Depends on | A (`Done`: layout, `lib/env.ts`, `lib/ct/client.ts`, `lib/utils.ts`, `i18n/*`, `proxy.ts`, ESLint rules, Vitest) |
| Wave | 2 (parallel with C and E) |
| Branch | `ws/d-server-core`; commit `ws-D: D-03 <summary>` |
| Primary spec | `openspec/specs/server-architecture-and-data-flow/spec.md` |
| Extended (not primary) | `bootstrap-and-structure` (image handling, `COUNTRY_CONFIG` helpers); `reviews-and-ratings` requirement "Ratings come from product statistics" (the mapper half; the card and filter are G and M) |
| Generated templates that apply | none (D is infrastructure; `authentication-and-identity` is J) |
| Owner prerequisites | **OA-01** for the live probe (D-10) and the dev session route read-back. Everything else is unit-tested offline. Draft new rows in `plans/notes/todo-D.md`: `OA-x` (decide the reviews write scope, Q-D-8), `M-D-01` |
| Skills to load first | `commercetools-storefront` (`references/core/data-loading.md`, `ct-client.md`, `add-api.md`, `image-config.md`, `stack/nextjs/data-loading.md`, `stack/nextjs/best-practices/error-handling.md`), `commercetools-platform` (`sdk-setup.md`) |

## 2. Goal and scope

**Goal.** After D, any later workstream can add a resource by writing one `lib/ct/<ns>.ts`, a mapper, a type, a Route Handler, an SWR hook and a cache key, and rely on: a signed session, safe JSON errors, correct money and localized-string formatting, the app types, the three image transforms, the public-data cache wrapper and the 409 retry helper. The BFF rules of the spec are enforced by tests.

**In scope**
- `lib/types.ts` (app types), `lib/utils.ts` extensions (`formatMoney`, `roundRating`, `getLocalizedString`, market helpers).
- `lib/errors.ts`, `lib/api.ts` (handler wrapper, `requireCustomer`).
- `lib/session.ts` (jose JWT, cookie helpers, market change rule).
- `lib/cache-keys.ts`, `lib/ct/public-cache.ts`, `lib/ct/project.ts`.
- `lib/ct/retry.ts` (409 retry once).
- `lib/ct/image-config.ts`, `lib/mappers/*` (money, price, image, attribute, variant, product, rating, category).
- `hooks/fetcher.ts` (client fetch helper and `ApiError`).
- Architecture guard tests (no raw fetch to commercetools, no `productProjections().search()`, `unstable_cache` only in one file, `server-only` in every `lib/ct` file).
- A dev-only route `app/api/dev/session` for self-verification (deleted in Q together with `app/api/health`).
- The live probe (`*.live.ts`, not part of `check`).

**Out of scope**
- Any real Route Handler of the table (`/api/cart`, `/api/auth/*`, ...) and any `lib/ct/<ns>` beyond `client`, `project`, `public-cache`, `retry`, `image-config`: their workstreams (F to N).
- The market-change Route Handler and the store picker: F (D supplies the pure `changeMarket` rule and cookie helper).
- `proxy.ts`: A owns it (see A section 3.7). D does not edit it.
- Product Search code: G. Category tree page and cached category fetch: F/G (D supplies `buildCategoryTree` and the cache wrapper).
- Cart, order, customer mappers: I, K, J, L.

## 3. Design

### 3.1 App types (`lib/types.ts`, the only types UI imports)

Replace the command's file. Add only what D's mappers produce; later workstreams extend (append, never rename).

```ts
export type LocaleKey = 'en-US' | 'en-CA';

export interface Money { centAmount: number; currencyCode: string }              // integer minor units
export interface Price { value: Money; discounted?: Money; discountName?: string }   // discounted = the price to pay when present; discountName only when the search call expanded 'masterVariant.price.discounted.discount' and 'variants[*].price.discounted.discount'
export interface ImageRef { url: string; width?: number; height?: number; alt?: string }   // url is the clean stored URL

export type AttributeValue =
  | string | number | boolean
  | { key: string; label: string }          // enum, lenum (label localized)
  | Array<string | number | boolean | { key: string; label: string }>;  // set of

export interface Variant {
  id: number; sku: string;
  images: ImageRef[];
  price?: Price;                             // the price for the session country and currency
  attributes: Record<string, AttributeValue>;
  availability?: { isOnStock: boolean; availableQuantity?: number };
}

export interface RatingStats {
  average: number;                           // raw, up to 5 decimals; never rounded here
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;   // missing ratings are 0
}

export interface Product {
  id: string; key?: string; slug: string; name: string; description?: string;
  productTypeKey?: string;
  categoryIds: string[];
  masterVariant: Variant; variants: Variant[];   // variants excludes the master
  attributes: Record<string, AttributeValue>;    // product-level attributes (badge, subscribable) merged with master variant values; product-level wins
  rating?: RatingStats;                          // undefined when count is 0 or statistics are absent
}

export interface Category { id: string; key?: string; name: string; slug: string; description?: string; imageUrl?: string; parentId?: string; orderHint?: string; children: Category[] }   // imageUrl = first asset source (the seed stores category images as assets)
export type ApiErrorBody = { error: { code: ErrorCode; message: string } };   // re-exported from lib/errors
```
Rule: components never import from `@commercetools/*`; `Product.rating` is the only place ratings are exposed.

### 3.2 Utilities (`lib/utils.ts`, extend A's file)

```ts
export function formatMoney(centAmount: number, currencyCode: string, locale?: string): string
// Intl.NumberFormat(locale, { style: 'currency', currency }) ; divisor = 10 ** resolvedOptions().maximumFractionDigits
// 1999, 'CAD', 'en-CA' => '$19.99'; 1999, 'USD', 'en-US' => '$19.99'; 495, 'USD' => '$4.95' (never '$5')
export function roundRating(average: number): number          // Math.round(average * 10) / 10 ; 4.58333 -> 4.6 ; display only
export function getLocalizedString(obj: Record<string, string> | undefined, locale: string): string
// order: exact key; same-language key (first key whose lower-cased prefix before '-' equals the locale's, so 'en-CA' falls back to 'en-US' when a value has no en-CA key); DEFAULT_LOCALE key; first value; ''
export function isLocaleKey(value: unknown): value is LocaleKey
export function marketForLocale(locale: string): CountryConfig           // falls back to DEFAULT_LOCALE
export function marketForCountry(country: string): CountryConfig | undefined
```
`getLocalizedString` is called only in `lib/ct` and `lib/mappers`, never in components (skill rule); a guard test enforces this.

### 3.3 Errors and the handler wrapper

`lib/errors.ts`
```ts
export type ErrorCode =
  | 'bad_request' | 'validation_failed' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'conflict' | 'rate_limited' | 'upstream_unavailable' | 'wrong_project' | 'internal_error';
export class AppError extends Error {
  constructor(readonly code: ErrorCode, readonly status: number, message?: string, readonly correlationId?: string);
}
export const SAFE_MESSAGES: Record<ErrorCode, string>;   // fixed English strings; the UI maps code to i18n key errors.<code>
export function toAppError(e: unknown): AppError;
export function errorResponse(e: unknown, route: string): Response;   // logs, then returns JSON
```
Mapping of a thrown value (SDK errors are `HttpErrorType`: `statusCode`, `message`, `code`, `headers?`, `originalRequest?`, `body?`/`error?`; verify the exact shape in D-10):

| Thrown | AppError | HTTP |
| --- | --- | --- |
| `AppError` | itself | its status |
| `statusCode` 400 | `validation_failed` | 400 |
| `statusCode` 404 | `not_found` | 404 |
| `statusCode` 409 | `conflict` | 409 |
| `statusCode` 429 | `rate_limited` | 429 |
| `statusCode` 401 or 403 from commercetools | `internal_error` (our client or scopes are wrong, not the shopper's fault); log at error level | 500 |
| `statusCode` >= 500, or no `statusCode` with message matching `/fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|network/i` | `upstream_unavailable` | 503 |
| anything else | `internal_error` | 500 |

Response body always exactly `{"error":{"code":"<code>","message":"<SAFE_MESSAGES[code]>"}}`. Never the commercetools message, body, stack or request. Server log (one line of JSON via `console.error`): `{"route":"/api/cart","code":"...","status":503,"correlationId":"...","upstreamStatus":503}`; correlation id read from `e.headers?.['x-correlation-id']` else `e.originalRequest?.headers?.['X-Correlation-ID']`, else generated; **no** request body, no email, no token.

`lib/api.ts`
```ts
export function jsonError(code: ErrorCode, status: number): Response;
export function handle(route: string, fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>):
  (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
// wraps fn in try/catch -> errorResponse(e, route). NEVER wrap redirect()/notFound() calls inside fn in try/catch themselves.
export async function requireCustomer(): Promise<Session & { customerId: string }>;   // throws AppError('unauthorized', 401)
```
Unauthenticated body is the same safe body (`code: unauthorized`, message "Sign in required"): no hint about why (no "cookie expired", no "invalid token").

Route Handler shape for every later workstream (pattern from the skill's `data-loading.md`, hardened):
```ts
export const GET = handle('/api/orders', async () => {
  const session = await requireCustomer();                 // validate session
  const orders = await getCustomerOrders(session.customerId);   // one lib/ct call
  return Response.json({ orders });                         // JSON
});
```

### 3.4 Session (`lib/session.ts`, `import 'server-only'`)

Cookie `malva-session`, JWT HS256 signed with `getEnv().SESSION_SECRET` (no dev fallback secret: the skill's `'dev-only-fallback-...'` must **not** be copied), `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 2592000` (30 days), `secure: process.env.NODE_ENV === 'production'`.

```ts
export interface Session {
  customerId?: string; customerEmail?: string; customerFirstName?: string; customerLastName?: string;
  cartId?: string; anonymousId?: string;
  country?: string; currency?: string; locale?: string;
  collectionStoreKey?: string;
}
export const SESSION_COOKIE = 'malva-session';
export function sanitizeSession(input: Record<string, unknown>): Session;      // keeps only the ten keys above, only string values; drops anything else (tokens, card data)
export async function createSessionToken(data: Session): Promise<string>;      // sanitize, then SignJWT({...}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('30d').sign(secret); throws if the token is longer than 3800 characters
export async function verifySessionToken(token: string | undefined): Promise<Session>;   // jwtVerify with algorithms ['HS256']; any failure => {}
export async function getSession(): Promise<Session>;                         // cookies() from next/headers (async in Next 16), verifySessionToken
export async function getMarket(): Promise<{ country: string; currency: string; locale: string }>;   // session triple, else LOCALE_COOKIE cookie -> COUNTRY_CONFIG, else DEFAULT_LOCALE. (Named getMarket, NOT getLocale, to avoid the next-intl getLocale.)
export function setSessionCookie(res: NextResponse, token: string): NextResponse;
export function clearSessionCookie(res: NextResponse): NextResponse;
export function setMarketCookie(res: NextResponse, locale: LocaleKey): NextResponse;   // LOCALE_COOKIE, httpOnly, sameSite lax, path /, maxAge 31536000
export function changeMarket(session: Session, locale: LocaleKey): Session;    // sets country, currency, locale together from COUNTRY_CONFIG AND deletes cartId; keeps customer fields, anonymousId, collectionStoreKey
export function ensureAnonymousId(session: Session): Session;                  // crypto.randomUUID() when absent
```
Table of when fields change (spec): `customerId` set at login/registration (J), cleared at logout; `cartId` set at first add to bag or login merge (I), cleared when the order is placed (K); `anonymousId` set with the first guest cart, cleared at login (J); `country/currency/locale` at market choice or first visit, never cleared; `collectionStoreKey` when a store is chosen, never cleared. D only supplies the helpers; each workstream applies its own rule.

Writing the session (every Route Handler that changes it): `const res = NextResponse.json(body); return setSessionCookie(res, await createSessionToken({ ...session, cartId }))`.

Docs: `jose` https://github.com/panva/jose (SignJWT, jwtVerify); Next cookies `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`.

### 3.5 Cache keys and public cache

`lib/cache-keys.ts` (replace the command's file; every key function takes the scope that makes the data per-person or per-market, never a cart id):
```ts
export const KEY_ACCOUNT = 'account';
export const KEY_CART = 'cart';                 // base key of the cart; workstreams F to K also read it as a plain string and call mutate(KEY_CART, ...)
export const KEY_CART_COUNT = 'cart-count';     // header badge (F)
export const keyCart = (customerId: string | null) => [KEY_CART, customerId ?? 'guest'] as const;   // scoped form: use it where the hook can know the customer id; J clears every user-scoped base key on sign-in and sign-out either way (J appends USER_SCOPED_KEYS)
export const keyOrders = (customerId: string) => ['orders', customerId] as const;
export const keyOrder = (customerId: string, orderId: string) => ['order', customerId, orderId] as const;
export const keyAddresses = (customerId: string) => ['addresses', customerId] as const;
export const keySavedItems = (customerId: string) => ['saved-items', customerId] as const;
export const keyMyReviews = (customerId: string) => ['my-reviews', customerId] as const;
export const keyReviews = (productId: string, sort: 'newest'|'highest'|'lowest', page: number) => ['reviews', productId, sort, page] as const;
export const keyRecurringOrders = (customerId: string) => ['recurring-orders', customerId] as const;
export const keyShippingMethods = (country: string, currency: string) => ['shipping-methods', country, currency] as const;
export const keyChannels = (country: string) => ['channels', country] as const;
export const keyAvailability = (sku: string, country: string, storeKey: string | null) => ['availability', sku, country, storeKey ?? 'online'] as const;
export const KEY_RECURRENCE_POLICIES = 'recurrence-policies';
export const TAG = { project: 'project', categories: 'categories', channels: 'channels', shippingMethods: 'shipping-methods', recurrencePolicies: 'recurrence-policies' } as const;
export const TTL = { project: 300, categories: 60, channels: 60, shippingMethods: 60, recurrencePolicies: 300 } as const;   // seconds
```
`lib/ct/public-cache.ts` (`import 'server-only'`):
```ts
export function cachedPublic<A extends readonly (string | number)[], R>(
  kind: keyof typeof TTL, keyParts: readonly string[], fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R>;
// = unstable_cache(fn, [...keyParts], { revalidate: TTL[kind], tags: [TAG[kind]] })
```
Arguments are restricted by type to strings and numbers so a session object cannot be passed by accident. `unstable_cache` (https://nextjs.org/docs/app/api-reference/functions/unstable_cache) is called **only** in this file (guard test). Never cache: cart, account, orders, availability tied to a session, prices.

`lib/ct/project.ts`: `export const getMarkets: () => Promise<CountryConfig[]>` = `cachedPublic('project', ['markets'], fetchMarkets)`; `fetchMarkets` calls `apiRoot.get().execute()` (GET project) and keeps the `COUNTRY_CONFIG` entries whose `country` is in `body.countries`, `currency` in `body.currencies` and locale (case-insensitive) in `body.languages` (pattern from the skill `data-loading.md`).

### 3.6 Concurrency helper (`lib/ct/retry.ts`)

```ts
export async function updateWithRetry<T extends { version: number }, R>(
  read: () => Promise<T>,
  write: (current: T) => Promise<R>,
): Promise<R>;
// 1) current = await read(); try write(current). 2) if it throws statusCode 409 (ConcurrentModification): current = await read(); try write(current) ONCE more. 3) a second 409 => throw new AppError('conflict', 409). Any other error is rethrown unchanged. No delay.
```
Used by every cart/shopping list/review update (`update actions` with `version: current.version`). Doc: https://docs.commercetools.com/api/general-concepts#optimistic-concurrency-control.

### 3.7 Images

`lib/ct/image-config.ts` (the three functions the skill and spec name; components call these and never build URLs):
```ts
export function cleanImageUrl(url: string): string;            // scheme+host+path only, no query, no fragment
export function transformListingImageUrl(url: string): string;    // 600 x 720 (5:6 card)
export function transformDetailImageUrl(url: string): string;     // 1200 x 1440
export function transformThumbnailImageUrl(url: string): string;  // 160 x 192
```
Default implementation (Q-D-6): `cleanImageUrl(url)` first, then append `?auto=compress&fit=crop&w=<w>&h=<h>`; a URL that is not parseable or not `https` is returned unchanged. Stored URLs are clean (seed rule), so sizing is added only here, at render time. `next.config.ts` keeps `images.unoptimized: true` (A). To change the CDN style later edit only this file.

### 3.8 Mappers (`lib/mappers/*`, may import `@commercetools/platform-sdk` types; call `getLocalizedString`)

| File | Export | Maps |
| --- | --- | --- |
| `money.ts` | `mapMoney(m: TypedMoney \| Money): Money` | `{ centAmount, currencyCode }` (ignore `fractionDigits`, `type`) |
| `price.ts` | `mapPrice(p: SDKPrice): Price` ; `pickPrice(variant, market: { country: string; currency: string }): Price \| undefined` | `p.discounted?.value` becomes `discounted` and an expanded `p.discounted.discount.obj.name` (localized) becomes `discountName`; `pickPrice` uses `variant.price` when present (set by `priceCurrency`/`priceCountry` query args), else the entry in `variant.prices` with equal `value.currencyCode` and (`country` equal or absent), else `undefined` |
| `image.ts` | `mapImages(images: SDKImage[] \| undefined, alt: string): ImageRef[]` | `url` via `cleanImageUrl`, `width`/`height` from `dimensions` |
| `attribute.ts` | `mapAttributes(attrs: SDKAttribute[] \| undefined, locale: string): Record<string, AttributeValue>` | text/number/boolean as is; `enum` `{key,label}`; `lenum` `{key, label: localized}`; `ltext` localized string; set of any of those becomes an array; any other type (reference, money, nested, time) is **dropped** and not invented |
| `rating.ts` | `mapRatingStats(s: ReviewRatingStatistics \| undefined): RatingStats \| undefined` | `averageRating`→`average`, `count`, `ratingsDistribution` keys `'1'..'5'` (missing = 0); `undefined` when `s` is absent or `count` is 0 |
| `variant.ts` | `mapVariant(v: ProductVariant, ctx: MapContext): Variant` | `sku`, images, `pickPrice`, attributes, `availability` from `v.availability?.isOnStock` and `availableQuantity` |
| `product.ts` | `mapProduct(p: ProductProjection, ctx: MapContext): Product` | `name` and `description` via `getLocalizedString`, `slug` localized, `categoryIds` from `categories[].id`, `attributes` = master variant attributes overlaid by `p.attributes` (product-level, when the projection has them), `rating` from `p.reviewRatingStatistics`, `productTypeKey` from `productType.obj?.key` when expanded |
| `category.ts` | `mapCategory(c: SDKCategory, locale: string): Category` ; `buildCategoryTree(flat: Category[]): Category[]` | `parentId` from `parent.id`; `imageUrl` from `assets[0].sources[0].uri` through `cleanImageUrl`; `description` localized; tree sorted by `orderHint` then name; orphans become roots |
`type MapContext = { locale: string; country: string; currency: string }`. The SDK types to import (`ProductProjection`, `ProductVariant`, `Price`, `Image`, `Attribute`, `Category`, `TypedMoney`, `ReviewRatingStatistics`) are all exported by `@commercetools/platform-sdk` ^8; confirm each import compiles instead of guessing (if a name differs, use the one the compiler suggests and note it in `PROJECT-FINDINGS.md`). Product reads should pass `priceCurrency`, `priceCountry` (and `localeProjection` where useful); Product Search results carry projections when `productProjectionParameters` is set (G).

Tests use JSON **fixtures** under `lib/mappers/__fixtures__/` shaped like real responses, never network.

### 3.9 Client fetch helper (`hooks/fetcher.ts`)

```ts
export class ApiError extends Error { constructor(readonly code: string, readonly status: number) }
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T>;
// credentials 'same-origin'; non-OK => parses {error:{code}} (falls back to 'internal_error'); network failure => ApiError('upstream_unavailable', 0)
export const jsonFetcher: <T>(url: string) => Promise<T>;    // for SWR
```
Read hooks (written later) return safe defaults and never throw; mutation helpers use `fetchJson` and throw `ApiError` (skill `add-api.md`). No `fetch('/api/...')` in components (A's convention; hooks only).

### 3.10 Dev-only session route (self-verification aid, removed in Q)

`app/api/dev/session/route.ts`, answers 404 when `process.env.NODE_ENV === 'production'`. `predeploy-check.mjs` (A) is extended to fail while `app/api/dev` exists.

| Request | Response |
| --- | --- |
| `GET /api/dev/session` | 200 `{"session":{...the ten fields that are set...},"market":{"country":"US","currency":"USD","locale":"en-US"}}` (never the token) |
| `GET /api/dev/session?simulate=503` | 503 `{"error":{"code":"upstream_unavailable","message":"..."}}` (throws `{statusCode:503}` through `handle`) |
| `GET /api/dev/session?simulate=409` or `=404` or `=429` | 409 `conflict` / 404 `not_found` / 429 `rate_limited` |
| `POST /api/dev/session` body `{"market":"en-CA"}` | 200 `{"ok":true}` + `Set-Cookie` session (market changed by `changeMarket`, `cartId` dropped) + market cookie |
| `POST /api/dev/session` body `{"cartId":"abc","customerId":"c1"}` | 200 `{"ok":true}` + session cookie with those fields (dev only) |
| any other body key | ignored |

### 3.11 Live probe (`*.live.ts`)

`vitest.live.config.mts` includes only `**/*.live.ts`, loads `.env.local` through `loadEnv` from `vite`, keeps the `server-only` alias. Script `npm run test:live`. Not in `check`; explicit exception to "no real API in unit tests" (Q-D-10). Read-only: it prints and writes to `plans/evidence/D/` **names and counts only** (no ids of customers, no secrets).

## 4. Tasks

Run `cd storefront && npm run check` before ticking.

- [x] **D-01 Types and utilities** `[SKILL: commercetools-storefront]`
  - Files: `lib/types.ts`, `lib/utils.ts`, `lib/utils.test.ts`.
  - Implement 3.1 and 3.2. Keep A's `COUNTRY_CONFIG` and `LOCALE_COOKIE` untouched.
  - Tests (spec: Price display): `Price display: 1999 CAD in en-CA renders $19.99`, `Price display: 1999 USD in en-US renders $19.99`, `Price display: 495 USD renders $4.95 and never $5`, `Rating rounds to one decimal for display only: 4.58333 gives 4.6`, `getLocalizedString exact match`, `getLocalizedString falls back to the same language`, `getLocalizedString falls back to the default locale then the first value`, `getLocalizedString of undefined is empty`, `marketForLocale falls back to en-US`.

- [x] **D-02 Errors and handler wrapper**
  - Files: `lib/errors.ts`, `lib/api.ts`, tests next to them.
  - Implement 3.3. `console.error` is mocked in tests (`vi.spyOn`).
  - Tests (spec: commercetools 5xx; Unauthenticated account call; Errors): `commercetools 5xx: a 503 becomes upstream_unavailable with status 503`, `A network failure becomes upstream_unavailable`, `Error body is exactly code and message with no stack and no commercetools text`, `Correlation id is logged and not returned`, `409 maps to conflict, 404 to not_found, 429 to rate_limited`, `commercetools 401 becomes internal_error 500`, `Unauthenticated account call: requireCustomer yields 401 with no data and no reason`, `handle returns 500 internal_error for an unknown throw`, `redirect inside a handler is not swallowed` (a function that throws an object with `digest: 'NEXT_REDIRECT'` is rethrown by `handle`, using `unstable_rethrow` from `next/navigation`; mock it).

- [x] **D-03 Session** `[SKILL: commercetools-storefront]`
  - Files: `lib/session.ts`, `lib/session.test.ts`.
  - Implement 3.4. Tests mock `next/headers` (`cookies` returns an object with `get`) and set `process.env.SESSION_SECRET` to 40 characters (also mock `@/lib/env`).
  - Tests (spec: Tampered cookie; Market change; Session): `Tampered cookie: an invalid signature gives an empty session and no error`, `Tampered cookie: a token signed with another secret gives an empty session`, `Tampered cookie: an expired token gives an empty session`, `Session never carries a token or card data: unknown keys are dropped by sanitizeSession`, `Market change: country, currency and locale change together and cartId is reset`, `Market change keeps the customer fields, anonymousId and collectionStoreKey`, `Session cookie is httpOnly, sameSite lax, 30 days`, `A token over 3800 characters is refused`, `Two shoppers: concurrent getSession calls each return their own cartId` (two mocked cookie stores resolved in `Promise.all`, no module-level state), `getMarket falls back to the market cookie then to en-US`, `ensureAnonymousId keeps an existing id`.

- [x] **D-04 Cache keys, public cache, project markets** `[SKILL: commercetools-storefront]`
  - Files: `lib/cache-keys.ts`, `lib/ct/public-cache.ts`, `lib/ct/project.ts`, tests.
  - Implement 3.5. In tests mock `next/cache` so `unstable_cache` returns `fn` and records `(keys, opts)`; mock `@/lib/ct/client` for the project read.
  - Tests (spec: Caching; Two shoppers): `Base keys KEY_CART, KEY_CART_COUNT and KEY_ACCOUNT are exported strings (other workstreams import them)`, `Keys of per-person data contain the customer id`, `Two customers never share a key`, `Market-scoped keys contain country and currency`, `cachedPublic sets the TTL and the tag of its kind`, `Only public kinds can be cached (kind is one of the five TTL keys)`, `getMarkets keeps only markets the project supports` (project with `countries ['US']` drops CA), `getMarkets matches languages case-insensitively`.

- [x] **D-05 409 retry** `[SKILL: commercetools-storefront]`
  - Files: `lib/ct/retry.ts`, `lib/ct/retry.test.ts`.
  - Implement 3.6. Fake store in the test: `{ version, data }`, `read` returns a copy, `write` throws `{statusCode:409}` when the passed version is stale and otherwise increments.
  - Tests (spec: Cart concurrency; Double click): `Double click: a stale version is re-read and applied once, not twice`, `A second 409 surfaces as conflict`, `A non-409 error is rethrown unchanged and not retried`, `Success on the first try reads once`.

- [x] **D-06 Image config and image mapper** `[SKILL: commercetools-storefront]`
  - Files: `lib/ct/image-config.ts`, `lib/mappers/image.ts`, tests.
  - Implement 3.7 and the image row of 3.8.
  - Tests (spec: Image handling via bootstrap): `cleanImageUrl removes query and fragment`, `Transforms add size parameters to a clean URL`, `Transforms never double a query that is already stripped`, `A non-https or invalid URL is returned unchanged`, `mapImages stores and returns the clean URL even if the source has a query`, `Components call the three transforms: listing, detail and thumbnail differ in size`.

- [x] **D-07 Mappers** `[SKILL: commercetools-storefront]`
  - Files: `lib/mappers/{money,price,attribute,rating,variant,product,category}.ts`, fixtures, tests.
  - Implement 3.8. Fixtures: one pod product (variants 10 and 50 capsules, enum, lenum, set of ltext, boolean), one product with no reviews, one product with a discounted price, one category list with a deep tree.
  - Tests (spec: Type boundary; reviews Card rating/No reviews at mapper level): `Card rating: 12 reviews averaging 4.58333 map to average 4.58333 and count 12 (display 4.6)`, `No reviews: count 0 or absent statistics map to undefined rating`, `Price is the session country and currency price`, `Discounted price is exposed as discounted`, `Price falls back to the prices array when no scoped price is present`, `Enum, lenum, ltext and set attributes map to AttributeValue`, `Unsupported attribute types are dropped`, `Product-level attributes override master variant attributes`, `Product name is localized with fallback`, `Category tree is built from a flat list and sorted by orderHint`, `Mapped output contains no SDK-only fields` (assert `Object.keys` whitelist).

- [x] **D-08 Client fetch helper**
  - Files: `hooks/fetcher.ts`, `hooks/fetcher.test.ts`.
  - Implement 3.9; mock `fetch` with `vi.stubGlobal`.
  - Tests (spec: Client component needs data, hook half): `fetchJson returns parsed JSON on 200`, `fetchJson throws ApiError with the server code on a JSON error body`, `fetchJson throws ApiError internal_error on a non-JSON error`, `fetchJson maps a network failure to upstream_unavailable`.

- [ ] **D-09 Architecture guard tests and the dev session route** `[SKILL: commercetools-storefront]`
  - Files: `lib/architecture.test.ts`, `app/api/dev/session/route.ts`, `app/api/dev/session/route.test.ts`, `scripts/predeploy-check.mjs` (extend), `scripts/predeploy-check.test.ts` (extend).
  - `architecture.test.ts` walks `app lib hooks components context` (skip tests and fixtures) and reads source text:
    - `Raw fetch to commercetools: no fetch call targets a commercetools host` (regex on `fetch(` lines containing `commercetools.com`, `CTP_API_URL` or `CTP_AUTH_URL`; allowed only in `scripts/`).
    - `Catalogue reads use Product Search: nothing calls productProjections().search()`.
    - `unstable_cache is called only in lib/ct/public-cache.ts`.
    - `Every lib/ct file starts with import 'server-only'`.
    - `Components do not import from lib/ct, lib/mappers or lib/session` (belt and braces next to the ESLint rule).
    - `getLocalizedString is not used in components`.
  - Dev route: section 3.10, using `handle`, `getSession`, `changeMarket`, `createSessionToken`, `setSessionCookie`, `setMarketCookie`.
  - Tests: `Dev route is 404 in production`, `Dev route simulate 503 returns the safe upstream_unavailable body`, `Dev route POST market sets both cookies and drops cartId`, `Dev route never returns the token`, `Deploy gate fails while app/api/dev exists`.

- [ ] **D-10 Live probe (needs OA-01)** `[SKILL: commercetools-platform]`
  - Files: `vitest.live.config.mts`, `lib/ct/probe.live.ts`, `package.json` (`test:live`), `plans/evidence/D/probe.json`, `plans/PROJECT-FINDINGS.md` (rows only if something differs).
  - The probe, read-only, using `apiRoot` from `lib/ct/client`: (1) `apiRoot.get().execute()` records `key`, `countries`, `currencies`, `languages`, `searchIndexing` status (names and values of those arrays; no ids). (2) `apiRoot.products().withId({ ID: 'does-not-exist' }).get().execute()` in `try/catch`: record `typeof e`, `Object.keys(e)`, `e.statusCode`, header **names** present, whether `x-correlation-id` is in `e.headers` or in `e.originalRequest.headers`. This settles where `toAppError` reads the correlation id; fix `toAppError` and its tests if the shape differs. (3) `apiRoot.productProjections().get({ queryArgs: { limit: 1, priceCurrency: 'USD', priceCountry: 'US', staged: false } }).execute()`: record the top-level key names of `results[0]` (does it have `reviewRatingStatistics`? `attributes`?), the variant key names, whether `masterVariant.price` is present (scoped price) and the `images[0]` key names. If there are no products yet (C not run live), record "no products" and re-run after C-12. (4) `apiRoot.reviews().get({ queryArgs: { limit: 1 } }).execute()`: status code only (proves read scope; a 403 means `view_products` is missing).
  - Tests: none (this is the live probe); evidence file and, if a response differs from section 3, a dated row in `PROJECT-FINDINGS.md` and a message to the lead before changing a type.

- [ ] **D-11 Hand-off docs**
  - Files: `storefront/AGENTS.md` (append a "Server core API" section: the exported names of section 3, the Route Handler shape, the "new resource" checklist of six files), `plans/evidence/D/README.md`.
  - Tests: `agent-rules.test.ts` (A) extended: `AGENTS.md lists handle, requireCustomer, changeMarket, cachedPublic, updateWithRetry`.

## 5. Scenarios checklist (`server-architecture-and-data-flow`)

- [ ] Client component needs data: `fetchJson ...` tests (D-08) plus the architecture test `Components do not import from lib/ct...` (D-09); `useCart()` itself is tested in I
- [ ] Raw fetch to commercetools: `Raw fetch to commercetools: no fetch call targets a commercetools host` (D-09)
- [ ] Price display: `Price display: 495 USD renders $4.95 and never $5` (D-01)
- [ ] Tampered cookie: `Tampered cookie: an invalid signature gives an empty session and no error` (D-03)
- [ ] Market change: `Market change: country, currency and locale change together and cartId is reset` (D-03)
- [ ] Unauthenticated account call: `Unauthenticated account call: requireCustomer yields 401 with no data and no reason` (D-02); the real `/api/orders` assertion is in L, same helper
- [ ] Facet counts: source half `Catalogue reads use Product Search: nothing calls productProjections().search()` (D-09); the "each group counted against all other active groups" behaviour is tested in G (`Facet counts`)
- [ ] Two shoppers: `Two shoppers: concurrent getSession calls each return their own cartId` (D-03) and `Two customers never share a key` (D-04)
- [ ] Double click: `Double click: a stale version is re-read and applied once, not twice` (D-05)
- [ ] commercetools 5xx: `commercetools 5xx: a 503 becomes upstream_unavailable with status 503` (D-02) and browser step 6; the page "retry state of the design" is exercised with the real `error.tsx` by F
- [ ] Requirement "Route Handler table": each handler documented in its workstream; D supplies the shape (`handle`, `requireCustomer`) and `agent-rules` test (D-11)
- [ ] Requirement "Caching": `cachedPublic sets the TTL and the tag of its kind`, `unstable_cache is called only in lib/ct/public-cache.ts` (D-04, D-09)
- [ ] Requirement "Type boundary": `Mapped output contains no SDK-only fields` (D-07)
- [ ] Requirement "Errors": `Error body is exactly code and message with no stack and no commercetools text` (D-02)

## 6. Browser recipe (Chrome DevTools MCP, you run it)

Load the tools with ToolSearch first. Evidence in `plans/evidence/D/`.

1. `cd storefront && npm run dev` (background). Resize to 1440x900.
2. `navigate_page` to `http://localhost:3000/api/dev/session`. Expect JSON with `session: {}` and `market` `en-US/USD/US`. Save `dev-session-initial.json`. `evaluate_script`: `document.cookie` must not contain `malva-session` (proves HttpOnly).
3. `evaluate_script`: `await fetch('/api/dev/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({cartId:'abc',customerId:'c1'})}).then(r=>r.json())` returns `{ok:true}`. Reload `/api/dev/session`: `session.cartId === 'abc'`. In `list_network_requests` open the POST (`get_network_request`) and confirm `Set-Cookie: malva-session=...; HttpOnly; SameSite=Lax; Max-Age=2592000; Path=/` (Secure is absent in dev). Save the header line with the cookie **value removed** as `set-cookie-flags.txt`.
4. POST `{"market":"en-CA"}`; GET again: `market` is `en-CA/CAD/CA`, `cartId` is gone, `customerId` is still `c1`. Screenshot of each JSON page at 1440 (`D-session-market-1440.png`); the pages are JSON so the 375 check is one screenshot `D-session-375.png`.
5. Tampered cookie (Bash, not the browser): `curl -s -H 'Cookie: malva-session=garbage' http://localhost:3000/api/dev/session` returns `session: {}` and HTTP 200. Save `tampered.txt`.
6. 5xx: `navigate_page` to `http://localhost:3000/api/dev/session?simulate=503`. Expect 503 and exactly `{"error":{"code":"upstream_unavailable","message":"..."}}`; the dev-server terminal shows one JSON log line with `correlationId` and **no** body or stack in the response. Repeat with `simulate=409`.
7. `list_console_messages`: no errors; `list_network_requests`: only the expected 503/409 are non-2xx.
8. With OA-01: run `npm run test:live` (D-10) and save its output summary. Without it: write `blocked: OA-01` in `plans/evidence/D/README.md`.
9. `README.md` in the evidence folder: one line per file.

## 7. Self-verification with data

- `npm run test:live` (read-only probe, D-10) is the data read-back for D. Compare against section 3: where the correlation id lives, whether `reviewRatingStatistics` and product-level `attributes` appear on a projection, whether a scoped `price` is present.
- With the commercetools MCP server `food-service` (OA-06, reads only): `get project` for countries/currencies/languages (must be US/CA, USD/CAD, en-US/en-CA after workstream B or owner action OA-A-b); `query products limit 1` after C. Without MCP: `cd ../seed && npm run verify`.
- Anything that differs from the plan: dated row in `plans/PROJECT-FINDINGS.md`, then tell the lead. Never change a type of section 3.1 silently; other workstreams import it.

## 8. Manual testing and owner items

| ID | Who | When needed | Steps (summary) | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-01 (existing) | Owner | D-10 and browser step 8 | Storefront API client in `storefront/.env.local` | `npm run test:live` connects | TODO |
| OA-x (D1) | Owner | Before workstream M (reviews write). Not before | Decide how customers' reviews are created (Q-D-8): the Create Review endpoint needs `manage_products`, a broad scope; default is a second server-only client used only by `lib/ct/reviews.ts` | Written decision; second client values in `storefront/.env.local` if chosen | TODO |
| M-D-01 | Owner | Optional | Confirm the CDN image size parameters (Q-D-6) by opening one product image URL with `?auto=compress&fit=crop&w=600&h=720` in a browser | The image resizes, no error | TODO |

Full rows in `plans/notes/todo-D.md`.

## 9. Questions (default is built)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-D-1 | Session cookie name. | `malva-session` | no |
| Q-D-2 | Session lifetime: sliding or fixed? | Fixed 30 days from the last write (re-signed on every write, not on reads) | no |
| Q-D-3 | Cookie size limit. | Refuse to sign a token over 3800 characters (browsers allow about 4096 bytes per cookie) | no |
| Q-D-4 | Anonymous id source. | `crypto.randomUUID()`, created with the first guest cart, cleared at login | no |
| Q-D-5 | App `Money` and `Price` shapes. | `Money {centAmount, currencyCode}`, `Price {value, discounted?}` (discounted is a Money, the price to pay) | no |
| Q-D-6 | Image sizing parameters at render time (the image host is the owner's endpoint, OA-03). | `?auto=compress&fit=crop&w=<w>&h=<h>` (CDN style), sizes 600x720, 1200x1440, 160x192, replaceable in `image-config.ts` | no |
| Q-D-7 | Error code set and HTTP mapping. | Section 3.3 table; commercetools 401/403 become `internal_error` 500 with an error log (it is our configuration) | no |
| Q-D-8 | Create Review needs scope `manage_products` (docs: "Create Review" requires it). Put it on the storefront client or isolate it? | Isolate: M adds a second server-only client for `lib/ct/reviews.ts` only; the main storefront client stays without it. Nothing built in D | M |
| Q-D-9 | Dev-only `app/api/dev/session` route for self-verification. | Yes, 404 in production, predeploy fails while it exists, deleted in Q | no |
| Q-D-10 | Live probe as a `*.live.ts` run outside `check` (an exception to "no real API in tests"). | Yes, read-only, evidence has names and counts only | no |
| Q-D-11 | Product-level attributes (`badge`, `subscribable`) on a projection. The seed (`seed/src/data/product-types.ts`) defines them as ordinary attributes with constraint `SameForAll`, so they come back on `masterVariant.attributes`. | Mapper reads master variant attributes and overlays `projection.attributes` if the API also returns product-level ones; D-10 verifies on the live project | no |
| Q-D-12 | Rating display rounding. | `Math.round(x * 10) / 10` (4.55 becomes 4.6) | no |
| Q-D-13 | `getLocalizedString` fallback order. | exact, same language, `en-US`, first value | no |
| Q-D-14 | Server cache TTLs. | project 300 s, categories 60, channels 60, shipping methods 60, recurrence policies 300 (skill table) | no |
| Q-D-15 | 409 retry policy. | One retry after re-reading, no delay; second 409 is `conflict` 409 | no |
| Q-D-16 | Currencies without two decimals. | `formatMoney` takes the digit count from `Intl` (only USD and CAD are used, both 2) | no |

Also in `plans/notes/questions-D.md`.

## 10. Definition of done

- D-01 to D-11 ticked, each with a passing `npm run check` commit.
- Every scenario in section 5 has the named test (or the named test in the other workstream is written down there).
- `npm run build` passes; `check-bundle-secrets` still clean.
- Evidence in `plans/evidence/D/`: `dev-session-initial.json`, `set-cookie-flags.txt`, `tampered.txt`, 375 and 1440 screenshots, `probe.json` (or `blocked: OA-01`), `README.md`.
- No `any`, no `@commercetools/*` import outside `lib/ct` and `lib/mappers`, `server-only` on every module of `lib/ct`, `lib/session.ts`, `lib/env.ts`.
- `app/api/dev` and `app/api/health` are the only throwaway routes and the predeploy check lists both.
- Rows added to `plans/TODO-MANUAL-TESTING.md`, questions to `plans/QUESTIONS.md` (lead merges the notes).
- `node plans/verify-plan.mjs` passes; `STATUS.md` row D is `Ready for review`.
