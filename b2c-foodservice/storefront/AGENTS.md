<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Malva Coffee rules

Online-only coffee store for the US (`en-US`, USD) and Canada (`en-CA`, CAD). Stack: Next.js 16, React 19, Tailwind v4, next-intl 4, commercetools SDK 8 and ts-client 4.

## Commands

- `npm run dev` starts the app on port 3000.
- `npm run check` runs lint, typecheck and tests (including the version gate and the secret checks). It must pass before every commit.
- `npm run build` must pass before the last task of a workstream. `npm run verify:build` also scans the client bundle for secret values.
- `npm run predeploy` fails while `app/api/health/route.ts` exists.

## Architecture (the BFF chain)

Component, then SWR hook (`hooks/`), then Route Handler (`app/api/...`), then `lib/ct/<namespace>.ts`, then commercetools. A browser never talks to commercetools.

A new commercetools resource adds exactly six files and changes nothing else in the tree:

1. `lib/ct/<namespace>.ts` (server-only calls)
2. `lib/mappers/<namespace>.ts` (SDK type to app type)
3. a type in `lib/types.ts`
4. a Route Handler in `app/api/<namespace>/route.ts`
5. a SWR hook in `hooks/`
6. a cache key in `lib/cache-keys.ts`

## Lint rules that enforce this

- No `lib/ct/*`, `lib/session` or `@commercetools/*` import from a `'use client'` file (the BFF boundary).
- No `@commercetools/*` import outside `lib/ct` and `lib/mappers`; `new ClientBuilder()` only in `lib/ct/client.ts`.
- Locale-aware navigation comes from `@/i18n/routing` (`Link`, `redirect`, `useRouter`, `usePathname`). Never import `next/link`, or `redirect`, `useRouter`, `usePathname` from `next/navigation`, in locale UI (`notFound` is allowed).
- No `any`. No raw hex colours or Tailwind arbitrary hex values in components; use design tokens, no raw fonts.

## Rules

- Version gates: next 16.x (never 15), next-intl 4, platform-sdk 8, ts-client 4, Node 22.
- Use Product Search only (`products().search()`), never `productProjections().search()`.
- Server modules start with `import 'server-only'`.
- Secrets live only in git-ignored `storefront/.env.local`. `.env.example` has names only. Never read credentials from the home directory, never use `NEXT_PUBLIC_` for a secret.
- Strings come from `messages/<locale>.json` through `useTranslations`; both catalogues have identical keys. Markets come from `COUNTRY_CONFIG` in `lib/utils.ts`; the market cookie is `malva-locale`.
- Money is integer minor units, formatted with `formatMoney`.
- Anything only the owner can do or test goes into `plans/TODO-MANUAL-TESTING.md`. Questions go into `plans/QUESTIONS.md` with the default you built to.
- Load the matching `commercetools-*` skill before any commercetools task; do not guess endpoints or update actions.

## Server core API (workstream D)

Import these; do not rewrite them.

- `lib/types.ts`: `Money`, `Price`, `ImageRef`, `AttributeValue`, `Variant`, `RatingStats`, `Product`, `Category`, `LocaleKey`, `ApiErrorBody`. Append, never rename.
- `lib/utils.ts`: `formatMoney(centAmount, currency, locale)`, `roundRating`, `getLocalizedString` (server side only, never in components), `isLocaleKey`, `marketForLocale`, `marketForCountry`, `COUNTRY_CONFIG` (each market has `collection`: true for US, false for Canada).
- `lib/errors.ts`: `AppError`, `ErrorCode`, `SAFE_MESSAGES`, `toAppError`, `errorResponse`. The body is always `{error:{code,message}}`; the UI maps `code` to `errors.<code>`.
- `lib/api.ts`: `handle(route, fn)` wraps every Route Handler; `requireCustomer()` throws 401; `jsonError(code, status)`.
- `lib/session.ts` (server-only): `getSession`, `getMarket`, `createSessionToken`, `verifySessionToken`, `setSessionCookie`, `clearSessionCookie`, `setMarketCookie`, `changeMarket` (resets `cartId`), `ensureAnonymousId`, `sanitizeSession`. Cookie `malva-session`, HS256, 30 days.
- `lib/cache-keys.ts`: `KEY_CART`, `KEY_CART_COUNT`, `KEY_ACCOUNT`, scoped `keyOrders(customerId)` and friends, `TAG`, `TTL`.
- `lib/ct/public-cache.ts`: `cachedPublic(kind, keyParts, fn)`, the only `unstable_cache` call; public data only. `lib/ct/project.ts`: `getMarkets`.
- `lib/ct/retry.ts`: `updateWithRetry(read, write)`, one re-read on a 409, then `conflict`. Use it for every versioned update.
- `lib/ct/image-config.ts`: `cleanImageUrl`, `transformListingImageUrl`, `transformDetailImageUrl`, `transformThumbnailImageUrl`. Also callable from client components. Stored URLs stay clean.
- `lib/mappers/*`: `mapProduct`, `mapVariant`, `mapPrice`, `pickPrice`, `mapAttributes`, `mapRatingStats`, `mapImages`, `mapCategory`, `buildCategoryTree`, `mapMoney`.
- `hooks/fetcher.ts`: `fetchJson`, `jsonFetcher`, `ApiError`. No `fetch('/api/...')` in components.

Route Handler shape:

```ts
export const GET = handle('/api/orders', async () => {
  const session = await requireCustomer();
  const orders = await getCustomerOrders(session.customerId); // one lib/ct call
  return Response.json({ orders });
});
```

To change the session: `setSessionCookie(NextResponse.json(body), await createSessionToken({ ...session, cartId }))`.

New resource checklist (six files): `lib/ct/<namespace>.ts` (starts with `import 'server-only'`), `lib/mappers/<namespace>.ts`, a type in `lib/types.ts`, `app/api/<namespace>/route.ts` using `handle`, an SWR hook in `hooks/`, and a key in `lib/cache-keys.ts`.

`app/api/dev` and `app/api/health` are throwaway routes; `npm run predeploy` fails while they exist.

## Design system

- Tokens live only in `app/tokens.css`: `--ink`, `--ink-2`, `--ink-3`, `--canvas`, `--canvas-2`, `--surface`, `--line`, `--line-2`, `--accent`, `--accent-press`, `--teal`, `--teal-text`, `--danger-text`, `--ct-amber-500`, `--ct-danger`, `--stone`, `--maxw`, plus `--radius-*`, `--dur-*`, `--swatch-*`. Use the Tailwind names (`bg-canvas text-ink border-line rounded-card font-display`). Rule: no hex, no raw font, no inline radius; a re-skin changes values in `app/tokens.css` only.
- Responsive: mobile first; `mobile:` is min-width 820px, `max-mobile:` is below it. Layout utilities: `wrap`, `grid-products`, `fade-up`; type utilities: `eyebrow`, `page-title`, `hero-title`, `section-title`, `wordmark`.
- Atoms are in `components/ui/`: `Button` (`variant` ink|accent|ghost, `size` md|lg, `block`, `loading`), `ButtonLink`, `IconButton` (`label`, `icon`, `badgeCount`), `Chip` (`active`), `Field` with `Input`, `Select`, `Textarea` (`invalid`), `OptionButton` (`selected`; `disabled` needs `disabledReason`), `ColorSwatch` (`colour`, `label`, `size`, `selected`, `onSelect`), `Stepper`, `Card`, `Badge`, `AvailabilityDot`, `Rating`, `Drawer`, `Modal`, `Steps`, `Icon`. Toast: mount `ToastProvider` from `context/toast.tsx` once, then call `useToast().show(message)`.
- A link that looks like a button: use `ButtonLink`, or `buttonClasses({ variant, size, block })` on any element.
- Add an icon: append an array of path strings to `components/ui/icons.ts` (24px viewBox, 1.75 stroke, round caps, no emoji).
- Add a message key to both `messages/en-US.json` and `messages/en-CA.json` in the same commit; en-CA spells colour and favourite the Canadian way.
- Check changes by eye on `/en-US/dev/design` (dev only; removed before deploy).

## Shell and pickers (workstream F)

- Layout: `app/[locale]/layout.tsx` renders skip link, promise bar, header, `<main id="main-content">`, footer, store picker and locale chooser. **Pages must not render their own `<main>`** (use `div` or `section`). Page layers must stay below `z-60` (the header); dialogs use `z-80` and up.
- Shell data is read once per request by `lib/shell-data.ts` (never throws; each part degrades alone). The URL locale drives the shell; the session supplies the chosen store.
- Hooks for G, H and I: `useCollectionStore()` (`store`, `stores`, `select`, `open({ sku })`, `preferShip`), `useAvailability(sku, country)`, `useCartCount()`, `useMarket()` (`switchCountry`, `switchLanguage`), `useShellUi()` (`openCart`, `registerCartDrawer`), `useToast()`. Routes: `GET /api/channels`, `GET /api/availability`, `PUT /api/session/store`, `PUT /api/session/market`, `GET /api/cart/count`, `POST /api/newsletter`.
- Single source for the free-shipping figure: `getFreeShippingThreshold(country, currency)` in `lib/ct/shipping.ts` (cart and PDP call it too). Listing links: `buildListingHref(slug, { facet: value })` in `lib/nav/listing-href.ts` (`f_<facet>` params).
- Tests for shell components: `test/shell.tsx` (`renderShell`, `stubFetch`, `routingMock`) and `test/axe.ts`. Local browser checks without credentials: `node scripts/mock-ct-server.mjs` (see its header).

## Auth and session (workstream J)

- Pages `/[locale]/account/sign-in` and `/register` (not guarded). Routes: `/api/auth/login|register|logout|me|demo-login|demo-customers`. Error envelope with extras (`retryAfterSeconds`, `failed`): `domainError` in `lib/api-domain.ts`.
- Guards: `requireCustomerPage(currentPath)` (`lib/auth/require-customer.ts`, redirects to sign-in with `?redirect=`), `requireCustomerApi()` (= D's `requireCustomer`). Redirect targets always go through `safeRedirect` / `destinationFrom` (`lib/auth/redirect.ts`).
- Client: `useAccount()` (`customer` undefined while loading, null for a guest), `useAuthActions()` (`signIn`, `register`, `demoSignIn`, `signOut`; failures throw `AuthApiError` with `code` and `extra`). `USER_SCOPED_KEYS` in `lib/cache-keys.ts`: sign-out evicts them; a new user-scoped SWR key must start with one of those names.
- Demo sign-in (D-040): server list in `lib/auth/demo-customers.ts` (must equal `seed/src/data/customers.ts`, a test checks), env `DEMO_LOGIN_ENABLED=true` and `DEMO_LOGIN_PASSWORD`. Emails and the password never reach the browser.
- Login and register responses carry `{ customer: AppCustomer, cart: AuthCart | null }`; the session is rewritten with a fresh cookie by `signedInResponse`.
## Content and error pages (workstream P)

- Content is typed data in `content/*.ts` behind `lib/content/` (`resolveLocalized`, `Block`, `renderTokens`). Pages use `ContentPage` and `Blocks`; no raw HTML (the one `dangerouslySetInnerHTML` is `components/content/JsonLd.tsx`). Token figures come from `getPageFigures(locale)`, which never throws (800 ms race).
- Content hrefs: `lib/routes.ts` (`aboutHref`, `policyHref`, `journalHref`, `signInHref`, `searchHref`). Add a built route to `BUILT_ROUTES` in `lib/nav/footer-config.ts`.
- Error pages: one `components/error/ErrorPage.tsx` (static, no session or commerce). Policy links in checkout use `components/content/PolicyLink.tsx` (new tab).
- `POST /api/contact` needs `CONTACT_WEBHOOK_URL`; local stand-in `node scripts/dev/mock-contact-receiver.mjs`. Unknown `/api/*` answers JSON 404.

## Browse and cart core (workstream G)

- Listing URL contract: `lib/search/params.ts` (`parseListingParams`, `serializeListingParams`, `toggleFacetValue`, `removeFilter`, `listingHref`); facet definitions in `lib/search/facet-config.ts`. Path chooses scope (`/category/<slug>`, `/shop`, `/search?q=`), `f_<facet>=a,b`, `sort`, `page`, `avail=1`. Never build these URLs by hand; F's `buildListingHref` writes the same format.
- Search: `lib/search/build.ts` (pure `buildSearchRequest`), `lib/ct/search.ts` (`searchProducts`, ids only), `lib/ct/products.ts` (`getListingProjections(ids, ctx)` maps to `ProductSummary` in search order with the shopper's price). Page assembly: `lib/listing/load.ts` (`loadListing`, `loadCount`). `GET /api/search` is for the filter sheet count and widgets.
- Cards: `components/product/ProductCard.tsx` takes a `ProductSummary` (`lib/mappers/product-summary.ts`); grids use `components/listing/ProductGrid.tsx`. `data-price` on the card is minor units. Heart: `useSavedItems` (sessionStorage until L).
- Cart core: `lib/ct/cart.ts` (`getCartForSession`, `createCart`, `addLine`), `POST /api/cart/lines` (all three fulfilments since H), `GET /api/cart`, hooks `useCart`, `useAddToCart` (writes `KEY_CART` and `KEY_CART_COUNT`). `CART_SHIPPING_MODE` is in `lib/shop-config.ts`. Route error codes use the closed `ErrorCode` set (Q-G-14).
- Browser checks without credentials: `node scripts/mock-ct-server.mjs` now serves the seed catalogue (41 products, prices, stock, ratings) and a Product Search engine; regenerate `scripts/mock-fixtures/seed-fixtures.json` with `npx vitest run --config scripts/mock-fixtures/vitest.gen.config.mts`. Use `NODE_EXTRA_CA_CERTS` with the printed certificate path (not `NODE_TLS_REJECT_UNAUTHORIZED=0`, which broke next/font in dev).
- URL market wins (FIX-2, resolves Q-F-15 and Q-G-15): `proxy.ts` calls `reconcileMarket` (`lib/session-reconcile.ts`, no `server-only`, same token format as `lib/session.ts`) for every page request with a locale prefix. A session or `malva-locale` cookie in another market is rewritten to the URL locale on the request (so the page renders in it) and on the response; the cart id and collection store are dropped (a cart is bound to its currency), customer fields stay, a missing or invalid session is never created. `PUT /api/session/market` stays the only way a shopper changes market (it then navigates to the new locale, which agrees). Pages and routes may therefore treat the session market as equal to the URL locale on page requests; `/api/*` calls use the session market, which now follows the last page the browser loaded.


## Product detail (workstream H)

- Route `/[locale]/p/[slug]/[sku]`: the SKU identifies the product and is the landing variant; a wrong slug is a permanent redirect keeping the query. Selection lives in the query (`?capsulesPerPack=50&grind=filter`, `?choose=<attr>`): `lib/product/selection.ts`. Config per shape (selectors, info attributes) is `lib/product/variant-config.ts`; edit it, never the components.
- Data: `loadProductPage(sku, locale)` (`lib/pdp/load.ts`, React `cache()`, returns `ProductPageData` or null) = `getProductBySku` (Product Search exact `variants.sku`, then the projection with `productType` expanded) + `getInventoryDetail` (stock is read from inventory, never `variant.availability`) + policies + free-shipping figure. Mapper `mapProductDetail`. Test data: `test/pdp.tsx` (`podPage`, `coffeePage`, `machinePage`, `renderPdp`).
- Pure helpers: `effectiveUnitPrice`/`lineTotal` (`lib/product/price.ts`, tiers, discount wins), `resolveVariant`/`optionStates`, `podsFitMachine`/`bundleOffered`, `deliveryEstimate`, `collectionReadiness`, `addButtonState`, `formatInterval`.
- Cart: `POST /api/cart/lines` now takes all three fulfilments. `buildAddLineAction` (`lib/ct/cart.ts`) is the one place that builds `addLineItem` (collect: `supplyChannel`; subscribe: `recurrenceInfo` Fixed). Refusals are `LineRejected` answered with domain codes (`not_available_for_collection` 409 with `available`, `collect_not_available_in_market`, `unknown_store`, `unknown_policy`, `price_unavailable`) from `lib/api-domain.ts`. `GET /api/recurrence-policies?locale=` is public and cached; hook `useRecurrencePolicies`.
- Related: `getRelatedProducts`, `getCompatibleCapsules` in `lib/related.ts`; `components/pdp/RelatedStrip.tsx` is a streamed server component. M mounts reviews in `components/pdp/ReviewsSlot.tsx` and flips `REVIEWS_ENABLED`.
- The mock server now also serves one projection by id, recurrence policies and recurring prices, placeholder images and `GET /__mock/carts`.

## Reviews and ratings (workstream M)

- No moderation (D-037): a review has no state and counts at once. One review per customer and product (`uniquenessValue` `<customerId>:<productId>` plus a pre-check). Routes: `GET/POST /api/reviews`, `PATCH/DELETE /api/reviews/[id]`; rules and pure validation in `lib/reviews/validate.ts`.
- Reads use the main client (`lib/ct/reviews.ts`); writes use the isolated second client `lib/ct/review-client.ts` (D-027, env names `CTP_REVIEWS_CLIENT_ID`, `CTP_REVIEWS_CLIENT_SECRET`, optional `CTP_REVIEWS_SCOPES`). Nothing else imports it.
- UI: `components/reviews/ReviewsSection` (mounted by `components/pdp/ReviewsSlot`; `REVIEWS_ENABLED` is true) and the account tab `app/[locale]/account/(shell)/reviews` with `MyReviews`. Hooks: `useReviews` (SWR infinite; call `revalidateReviewLists(productId)` after a write, because SWR's global `mutate(filter)` skips infinite keys), `useMyReviews`, `useReviewActions`.
- Review text is rendered as plain React text only; never `dangerouslySetInnerHTML`. Responses never carry an email or customer id (a test checks the key list).
- Mock server: `scripts/mock-fixtures/mock-reviews.mjs` (reviews from the fixtures, create, update, delete, statistics kept in step; customer `cust-1` has an order with the first product).

## Cart (workstream I)

- `GET /api/cart` returns the full `Cart` view (`lib/types.ts`; every field of the old `CartSummary` stays). Writes: `PATCH /api/cart` (`applyDiscountCode`, `removeDiscountCode`, `changeCollectionStore`), `PATCH|DELETE /api/cart/lines/[lineId]`. Every response is `{ cart }` with the engine's totals; a refused code is `422 code_not_applied { details: { reason, cart } }`. Domain codes `line_not_found`, `quantity_exceeds_stock`, `store_required`, `subscribe_line_not_switchable`, `code_not_applied` are in `lib/api-domain.ts`.
- Server: `lib/ct/cart.ts` (`getCartView`, `changeQuantity`, `removeLine`, `switchFulfilment`, `changeCollectionStore`, `applyDiscountCode`, `removeDiscountCode`, `syncShippingMethod`, `refreshPrices`, `rebuildCart`), `lib/ct/cart-enrich.ts` (one projection read, one inventory read), pure `lib/mappers/cart.ts` (`mapCart`), `lib/cart/plan.ts` (`groupKeyOf`, `groupLines`, switch and store plans, the mixed-bag contract for K in its header), `lib/cart/summary.ts`. Totals are read, never computed; only subtotal and discount are display sums.
- Client: `useCart({ initialCart, enabled })`, `useCartMutations()` (sets `KEY_CART` and the badge from each response), `CartDrawer` (mounted in the locale layout, reads the cart only when opened), `/[locale]/cart` (`components/cart/CartPage.tsx`). Each line sits in its fulfilment cluster and has a fulfilment badge (D-033); Canada renders no Collect UI.
- Region switch: `PUT /api/session/market` carries the bag over with `rebuildCart` (`CART_CARRY_OVER_ENABLED` is true); unmovable lines come back as `droppedLines` and are shown by `DroppedLinesNotice` (sessionStorage `mcf-dropped-lines`). `getCartView` also rebuilds a cart whose shipping mode differs from `CART_SHIPPING_MODE`. After sign-in `useAuthActions` refreshes `KEY_CART`.
- Tests: `test/cart.ts` (commercetools-shaped and view-shaped carts), `test/fake-carts.ts` (in-memory cart engine for route tests). The mock server has a cart engine (codes WELCOME10, COFFEE15, FREESHIP, EXPIRED10) and `POST /__mock/price|stock`.
