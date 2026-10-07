# Site architecture contract (`site/`)

Single source for **where things live and who owns them**, so parallel workstreams agree on file names and exports. A workstream may add files inside its own areas freely; it may only **append** to a file owned by another workstream (and says so in its Design). Names below are binding; signatures are defined in the owning workstream file.

## Stack (D-002)
Next.js 16 App Router, React 19, TypeScript strict, next-intl 4 (`localePrefix: 'always'`, locales `en-US`, `de-DE`), Tailwind v4 (`@theme` in `app/globals.css`, no config file), `@commercetools/platform-sdk` ^8 + `@commercetools/ts-client` ^4 (server only), `@commercetools/checkout-browser-sdk`, `swr`, `jose`, `server-only`, Vitest + Testing Library + jsdom, `tsx` for scripts, npm. Env vars are server-only (no `NEXT_PUBLIC_` secrets): `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`, `CTP_CHECKOUT_APP_KEY`, `SESSION_SECRET` (≥ 32 chars), optional `DEMO_SHOW_RESET_LINK`, `SERVICEABILITY_STUB`, seed-only `CTP_SEED_CLIENT_ID/SECRET/SCOPES` in `.env.seed`.

## Routes (all under `app/[locale]/`; `locale ∈ en-US | de-DE`)
| Route | Owner | Notes |
| --- | --- | --- |
| `/` | O | Home |
| `/shop/[slug]` | N | Category listing = only catalog surface (D-052); `?offer=<key>` anchors an offer card; filters in query string; `/shop/add-ons` is the add-ons listing |
| `/search` | P | Search results |
| `/bundle` | M | My bundle (cart) |
| `/bundle/checkout` | U | Pre-checkout steps + hosted payment |
| `/order-confirmation/[orderNumber]` | U | |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | R | |
| `/account` (dashboard), `/account/orders`, `/account/orders/[orderNumber]`, `/account/addresses`, `/account/payment-methods`, `/account/lists`, `/account/lists/[id]` | S (dashboard, orders), T (addresses, payment methods, lists) | |
| `/support`, `/about`, `/faq`, `/blog`, `/blog/[slug]`, `/legal/[policy]` | W | |
| `not-found`, `error`, `global-error`, `forbidden`/`unauthorized` pages | I | |
| `/api/locale` | D | POST; sets market cookie, revalidates cart |
| `/api/cart`, `/api/cart/line-items`, `/api/cart/line-items/[lineId]`, `/api/cart/address`, `/api/cart/discount-code` | M | Always returns the full mapped `Cart` |
| `/api/offers/compatibility` | J | POST `{cartId?, offerKey}` → verdict + reasons |
| `/api/serviceability` | K | GET `?postalCode=` |
| `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password` | R (session core by E) | |
| `/api/search` | P | |
| `/api/checkout/session` | U | Creates the hosted Checkout session |
| `/api/orders/[orderNumber]/cancel`, `/api/orders/[orderNumber]/return` | V | |
| `/api/account/*` (addresses, payment-methods, lists) | T | |
| `/api/health` | E | development only (absent in production builds) |

## Library modules
| Path | Owner | Contents |
| --- | --- | --- |
| `lib/types.ts` | H (creates), others append in marked sections | App-level domain types only. **Components import types from here, never from the SDK** |
| `lib/ct/client.ts`, `lib/ct/session.ts`, `lib/ct/env.ts` | E | SDK client builders (`server-only`), session cookie (`jose`), env validation |
| `lib/ct/catalog.ts`, `lib/ct/search.ts`, `lib/ct/categories.ts` | H | Offer/category/search reads |
| `lib/ct/cart.ts`, `lib/ct/availability.ts` | M | Cart reads/writes with version-conflict retry |
| `lib/ct/recurring.ts` | L | Recurrence policy lookup, recurring cart helpers, recurring-order reads |
| `lib/ct/customer.ts`, `lib/ct/orders.ts` | R (customer), S (orders) | |
| `lib/ct/checkout.ts` | U | Checkout session creation |
| `lib/mappers/*.ts` | H (catalog), M (cart), S (order), R (customer) | SDK → `lib/types.ts` |
| `lib/offers/` | J (compat, addons, equipment), K (exclusivity, eligibility, serviceability, holdings) | **Pure TypeScript, no I/O**; shared by server and client |
| `lib/pricing/` | L (`priceMode.ts`, `schedule.ts`, `introPeriod.ts`), M (`label.ts` label builder) | |
| `lib/devices/` | Q | acquisition modes, financing decision interface + stub |
| `lib/config/*.ts` | owner of the feature | feature constants (never magic numbers inline) |
| `i18n/routing.ts`, `i18n/request.ts`, `messages/en-US.json`, `messages/de-DE.json` | D (creates), all append | |
| `content/**` | W | markdown/JSON for static pages (policy versions with effective dates) |
| `components/ui/*` | I | design-system primitives (Button, Pill, Chip, Card, Field, QuantityStepper, Toast, Breadcrumb…) |
| `components/layout/*` | I | `SiteHeader`, `NavPill`, `BundlePill`, `SiteFooter`, `MobileDrawer`, `LocaleSwitcher` |
| `components/offers/*` | N | `OfferCard`, `OfferGrid`, `FilterChips`, `AddonPicker`, `EquipmentPicker`, `TermSelector` |
| `components/bundle/*` | M | bundle lines, order summary, `PriceSchedule` |
| `components/label/BroadbandLabel.tsx` | M | exempt from token lint |
| `components/account/*`, `components/checkout/*`, `components/content/*` | S/T, U, W | |
| `hooks/*`, `context/*` | owner of the feature (`useCart` M, `useSession` E, `ToastProvider` I) | |
| `app/globals.css` | C | tokens (`:root` + `@theme`), extensions block |
| `scripts/seed/` | F (framework `lib.ts`, `seed.ts`, `verify.ts`, `cleanup-furniture.ts`, `project-settings.ts`), G (`data/**`, `update-images.ts`), X (`release.ts`) | `npm run seed`, `seed:verify`, `seed:images`, `seed:cleanup` |
| `scripts/check-*.mjs` | A (lockfile), B (boundaries), C (tokens), E (secrets/bundle) | wired into `npm run verify` |
| `test/utils.tsx`, `vitest.config.ts`, `vitest.setup.ts` | A (stub), D (intl), I (toast) extend | |

## commercetools resource keys (all `malva-`)
Product types: `malva-internet-plan`, `malva-phone-plan`, `malva-addon`, `malva-equipment`, `malva-device`, `malva-offer`. Categories: `malva-cat-cable-internet`, `-home-wireless`, `-phone-plans`, `-add-ons` (+ `-streaming`, `-equipment`, `-protection`), `-devices`. Offer keys: `malva-offer-<product-key-without-malva-prefix>`. SKU `MLV-<family>-<tier>-<term>`. Recurrence policy `malva-monthly`. Customer groups `consumer`, `small-business`, `employee`, `existing-customer`. Custom types: `malva-line-item` (parentLineItemId, acquisitionMode, acquisitionTermMonths, offerKey), `malva-order` (serviceStartDate, priceSchedule, labelSnapshot, cancellation, returnRequest), `malva-cart` (postalCode, serviceable flags), `malva-customer`. Exact definitions are owned by G (types) and used by M/L/Q/S/V.

## Cross-cutting rules
- All commercetools money is `centAmount` + `currencyCode`; format with `formatMoney(locale)` (H).
- Cart totals are always the server's; never client arithmetic (M).
- Anything cached has a TTL named in `lib/config/cache.ts` (H); session-specific data is never cached.
- Customer-scoped data (D-070, no `/me` endpoints): every helper in `lib/ct/cart.ts`, `orders.ts`, `customer.ts`, shopping lists and payment methods takes the session and filters by `customerId`/`anonymousId`; ids from the client (cart, order, list, address, payment method) are never trusted without an ownership check, and each such helper has a test that another customer's resource is refused (not-found, never forbidden, to avoid leaking existence).
- Errors cross the API boundary as `{ error: { code, message } }` with stable codes (E defines `ApiError`).

## Shared names added by workstream planning (binding)
| Path / name | Owner | Notes |
| --- | --- | --- |
| `lib/utils.ts` (`cn`, small helpers) | D (creates); H appends `formatMoney`, `getLocalizedString` | |
| `lib/format.ts`, `lib/nav.ts`, `lib/catalog/listing.ts`, `lib/ct/timeout.ts`, `lib/auth/guards.ts` | H / I | listing filters in memory over cached offers; `sanitizeNext` from I |
| `lib/market/{server,switch,cartSeam}.ts`, `hooks/useSwitchMarket` | D | `cartSeam.ts` no-op bodies are replaced by M; a cart whose currency/country differs from `getMarket()` counts as no cart; cookie `malva-market` |
| `lib/ct/env-core.ts`, `lib/ct/http.ts`, `lib/ct/identity.ts`, `lib/api-error.ts`, `lib/session-types.ts`, `lib/fetcher.ts`, `lib/cache-keys.ts` (`KEY_SESSION`; M appends `KEY_CART`), `lib/rate-limit.ts`, `lib/config/rateLimits.ts`, `app/fonts.ts`, `GET /api/auth/session`, `hooks/useSession` | E | stateless JWT cookie holds references only, no customer token |
| `lib/config/cache.ts` | H | category tree and catalog 60 s, serviceability 300 s, read timeout 8000 ms |
| `lib/content/*`, `lib/config/site.ts`, `lib/config/contact.ts`, `PolicyLink`, `SITE_URL` env | W | |
| `lib/cart/guard.ts` | M | calls J (`checkCompatibility`, `requiredEquipment`) and K (`checkExclusivity`, `checkEligibility`) |
| `lib/config/pricing.ts` | L | intro/phased demo data |
| `scripts/spike/recurring-checkout.ts` | L | Gate 2 |
| `scripts/seed/payment-methods.ts`, `scripts/probe/payment-method-default.ts` | T | |
| `scripts/seed/release.ts` (+ `scripts/seed/release/*`) | X | no approver files (D-069) |
| `scripts/seed/create-qa-order.ts` | S | |
| `/api/dev/catalog`, `/api/auth/session`, `/api/serviceability` (GET+POST), `/api/checkout/{details,delivery,review,complete}`, `/order-confirmation/return`, `/api/orders/[orderNumber]/reorder`, `/api/cart/devices*`, `/api/devices/financing/decision` | H, E, K, U, S, Q | dev-only routes use `route.dev.ts` / `page.dev.tsx` enabled by conditional `pageExtensions` (A) |
| Custom types `malva-list-line`, `malva-payment-method` | T | |
| Cookies `malva-market`, `malva-postal-code` | D, K | |
