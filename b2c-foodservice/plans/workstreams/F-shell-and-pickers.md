<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream F: Shell and global pickers

## 1. Header

| Field | Value |
| --- | --- |
| ID | F |
| Name | Shell and global pickers: promise bar, header, mega menu, mobile nav, footer, toast, collection-store picker, locale chooser, channels and availability API |
| Depends on | B (seeded channels, shipping, tax, categories), D (client, session, mappers, cache keys, errors), E (tokens, atoms, icons, catalogues) |
| Wave | 3 (alone) |
| Specs implemented (primary first) | `design-storefront-shell` (primary), `design-store-picker-and-locale` (primary), `switching-region-or-language` (generated template, applies), `fulfilment-and-availability-model` (extended: requirements "Stores are supply channels", "Availability per store", "Shipping by market" threshold read only) |
| Also relied on | `bootstrap-and-structure`, `server-architecture-and-data-flow`, `design-tokens-and-components` |
| Generated templates that apply | `switching-region-or-language` |
| Owner prerequisites | OA-x1 (the commercetools API client with the scopes set in workstream A; live runs only; same as OA-01, the lead maps it), SO-x1 (footer link targets and tagline). No blocker: everything builds against the in-memory fake and the unit tests. |
| Skills to load first | `commercetools-storefront` (`b2c/navigation.md`, `b2c/optional/bopis.md`, `core/data-loading.md`, `core/add-country.md`), `commercetools-platform`, `commercetools-commerce-patterns` (shipping predicates, price selection inputs) |
| App and paths | everything lives in `storefront/` (run commands from there) |

## 2. Goal and scope

**Goal.** Every page gets one shell: a promise bar, a sticky header with the collection-store pill, locale pill, search, account and cart, a mega menu, a mobile slide-in menu, a footer and a toast. Two global choices work on every page: which store the shopper collects from (persisted in the session as `collectionStoreKey`) and which market (country, currency, locale) applies, switched in one step. All six stores are in New York City (D-035), so collection is a US-market feature: in the Canada market (delivery only) the store pill, the store picker, the footer collection links and the promise-bar collection clause are all hidden. The API behind the store choice (`/api/channels`, `/api/availability`) is built here so G, H and I only consume it.

**In scope**
- `app/[locale]/layout.tsx` composition: `Header` (server) with client islands, `Footer`, providers (`StoreProvider`, `ToastProvider`, `ShellUiProvider`).
- Promise bar with figures read from data (threshold from shipping rate `freeAbove`, collection minutes from the store channel, return days from config).
- Mega menu (config driven, 4 category menus plus the brew-method strip), mobile navigation.
- Store picker modal (search, distance sort, availability line when opened from a product) and the `/api/channels`, `/api/availability`, `PUT /api/session/store` handlers.
- Locale chooser drawer and `PUT /api/session/market` (country, currency and locale change together; cart handling stub described in 3.9).
- Newsletter form in the footer with inline validation and the toast (the handler is a validated no-op, see Q-F-07).
- Header account control (guest icon, signed-in initials avatar and dropdown) reading `/api/auth/me`; header cart badge reading a count endpoint.
- `useToast`, `useCollectionStore`, `useAvailability` hooks.

**Explicitly out of scope** (do not build; other workstreams own them)
- Product Search, listing, cards (G); PDP fulfilment block (H); cart drawer contents and cart page (I). F only opens the drawer through `useShellUi().openCart()` which I implements; until I lands the cart button navigates to `/cart` (route owned by I; a link to a missing page is acceptable until then and is recorded in the browser recipe).
- Sign in, registration, sign out logic (J); the account dropdown only reads `/api/auth/me` and links to `/account` and calls `/api/auth/logout` which J implements. F builds the dropdown against the contract and tests it with a mocked fetch.
- Search suggestions and the search results page (G). The header search icon opens a pill input that submits to `/search?q=` (G renders it).
- Real newsletter storage, real geocoding, delivery estimates per address.
- Content pages behind footer links (P). Footer links point to routes P builds; unbuilt ones go to `/` with a TODO row in `plans/IDEAS.md` (no dead `#` links).

## 3. Design

### 3.1 Files

| Path | Kind | Purpose |
| --- | --- | --- |
| `app/[locale]/layout.tsx` | server | Fetch `getCategoryTree(locale)`, session, promise figures once with `Promise.all`; render `PromiseBar`, `Header`, children, `Footer`; wrap providers |
| `components/layout/PromiseBar.tsx` | server | Slim ink bar |
| `components/layout/Header.tsx` | server | 72px sticky header, passes tree to client islands |
| `components/layout/HeaderActions.tsx` | client | Store pill, locale pill, search, account, cart |
| `components/layout/StorePill.tsx` | client | "Collect at {store}" / "Choose a store" |
| `components/layout/LocalePill.tsx` | client | Globe, `US (USD) \| EN` |
| `components/layout/SearchToggle.tsx` | client | Icon button that reveals a pill input; submit navigates to `/search?q=` |
| `components/layout/AccountMenu.tsx` | client | Guest icon link or avatar plus dropdown |
| `components/layout/CartButton.tsx` | client | Bag icon plus mono badge from `useCartCount()` |
| `components/layout/MegaMenu.tsx`, `PrimaryNav.tsx` | client | Hover panel |
| `components/layout/MobileNav.tsx` | client | Full-screen slide-in |
| `components/layout/Footer.tsx`, `NewsletterForm.tsx` | server, client | Ink footer |
| `context/toast.tsx` (E's `ToastProvider`, `useToast`) | client | F only mounts the provider in the layout and calls `useToast()`; E builds it (E overlap note) |
| `components/store/StorePicker.tsx`, `StoreRow.tsx`, `StoreSearch.tsx` | client | Modal |
| `components/locale/LocaleChooser.tsx` | client | Right drawer |
| `context/store-context.tsx` | client | Chosen store, picker open state and `context` (header or product) |
| `context/shell-ui-context.tsx` | client | `openCart`, `closeCart`, `mobileNavOpen`, `localeOpen` flags (I mounts the drawer) |
| `hooks/useChannels.ts`, `hooks/useCollectionStore.ts`, `hooks/useAvailability.ts`, `hooks/useCartCount.ts`, `hooks/useMarket.ts` | client | SWR hooks |
| `lib/ct/channels.ts` | server-only | `getStoreChannels()`, `getChannelByKey()` |
| `lib/ct/inventory.ts` | server-only | `getStoreAvailability(sku, storeChannels)`, `getAvailabilityForSkus` |
| `lib/ct/shipping.ts` | server-only | `getMarketShipping(country, currency)`, `getFreeShippingThreshold()` |
| `lib/ct/market.ts` | server-only | `validateMarket(locale)` (project countries, currencies, languages) |
| `lib/mappers/channel.ts`, `lib/mappers/shipping.ts` | pure | CT to app types |
| `lib/availability.ts` | pure | `availabilityState(qty, lowThreshold)` and label keys |
| `lib/geo.ts` | pure | `haversineKm`, `formatDistance(km, locale)` |
| `lib/hours.ts` | pure | `todayHours(store, now, timeZone)` |
| `lib/nav/mega-config.ts` | pure | Menu structure (3.5) |
| `lib/nav/listing-href.ts` | pure | `buildListingHref(categorySlug, params)` using the `f_<name>` convention that G parses |
| `lib/shop-config.ts` | pure | `RETURN_DAYS`, `LOW_STOCK_THRESHOLD`, `NEARBY_RADIUS_KM`, `COLLECTION_MINUTES_FALLBACK` (every figure with a comment naming its question id) |
| `app/api/channels/route.ts` | handler | GET stores |
| `app/api/availability/route.ts` | handler | GET per-store stock for a sku |
| `app/api/session/store/route.ts` | handler | PUT chosen store |
| `app/api/session/market/route.ts` | handler | PUT market switch |
| `app/api/cart/count/route.ts` | handler | GET `{ count }` (only reads; I replaces the hook source, G and I extend `lib/ct/cart.ts`) |
| `app/api/newsletter/route.ts` | handler | POST validated no-op |

Handlers `PUT /api/session/store`, `PUT /api/session/market`, `GET /api/cart/count` and `POST /api/newsletter` are not in the Route Handler table of `server-architecture-and-data-flow`; they are the smallest way to satisfy the specs and are flagged for the lead (Q-F-09).

### 3.2 Types (`lib/types.ts`, F adds)

```ts
export type Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
export interface OpeningHours { [d in Weekday]: { open: string; close: string } | null } // 'HH:mm', null = closed
export interface Store {
  id: string; key: string;                 // channel id and key (mcf-store-nyc-soho)
  name: string;                            // getLocalizedString(channel.name, locale)
  addressLine: string; city: string; postalCode: string; country: string; // from channel.address and custom fields
  phone?: string; hours: OpeningHours; timeZone: string; // timeZone from COUNTRY_CONFIG[country] unless the channel has one (Q-F-10)
  collectionMinutes: number;               // custom field collectionMinutes
  geo?: { lat: number; lng: number };      // channel.geoLocation.coordinates is [lng, lat]
}
export type AvailabilityState = 'in' | 'low' | 'out';
export interface StoreAvailability { storeKey: string; state: AvailabilityState; quantity: number }
export interface PromiseFigures { freeShippingThreshold: Money | null; collectionMinutes: number | null; returnDays: number }
export interface MarketOption { country: string; currency: string; locale: string; label: string; languages: { locale: string; label: string }[]; region: 'North America' }
```

### 3.3 commercetools calls (exact)

All with the `apiRoot` singleton from `lib/ct/client.ts`; never `fetch`. Load `[SKILL: commercetools-storefront]` (bopis) and `[SKILL: commercetools-platform]` first.

1. **Stores.** `apiRoot.channels().get({ queryArgs: { where: 'roles contains any ("InventorySupply")', limit: 500 } }).execute()` ([Channels](https://docs.commercetools.com/api/projects/channels)). Then keep only keys starting with `mcf-store-` in code (the `where` stays role-only so the predicate is the one the skill documents). Map: `name` localized, `address` (`streetName`, `streetNumber`, `city`, `postalCode`, `country`, `phone`), `geoLocation.coordinates` is `[longitude, latitude]`, `custom.fields.hours` (text holding JSON by weekday, parse defensively with a zod schema, invalid hours become all-closed and a server log line with the channel key), `custom.fields.collectionMinutes` (number, default `COLLECTION_MINUTES_FALLBACK`). Channel type is `mcf-store` (SEED-PLAN section 4); `addressLine` is a custom field per the seed, prefer it over `streetName`. Cached with `unstable_cache(fn, ['channels'], { revalidate: 300, tags: [KEY_CHANNELS] })` (public, stable, allowed by the spec).
2. **Availability for one SKU.** `apiRoot.inventory().get({ queryArgs: { where: 'sku="<sku>"', limit: 100 } }).execute()` ([Inventory](https://docs.commercetools.com/api/projects/inventory)). Each result has `supplyChannel?: { id }` and `availableQuantity`. Map store by channel id: entry present with `availableQuantity > 0` is `in` (or `low` when `<= LOW_STOCK_THRESHOLD`), else `out`. The entry without `supplyChannel` is the online warehouse (shipping). Return `{ ship: AvailabilityState, stores: StoreAvailability[] }`. The SKU is validated `^[A-Za-z0-9._-]{1,64}$` before it is put in the predicate (injection guard). This read is **not cached on the server** (spec: availability tied to a session is never cached; it is also the strongly consistent source the docs recommend for a binding check, unlike `variant.availability`, which is eventually consistent and used only for card display in G).
3. **Free-shipping threshold and methods.** `apiRoot.shippingMethods().matchingLocation().get({ queryArgs: { country, currency } }).execute()` ([Shipping methods](https://docs.commercetools.com/api/projects/shippingMethods)). For the method with key `mcf-ship-standard`: find `zoneRates[].shippingRates[]` where `isMatching !== false`, read `freeAbove` (Money). If absent, `freeShippingThreshold` is `null` and the bar drops the clause (it never invents a number). `mcf-collect` gives the collection rate (0). Cached 60 s per `country|currency` with tag `shipping-methods`.
4. **Project market validity.** `apiRoot.get().execute()` returns `countries`, `currencies`, `languages`; `getValidCountryConfig()` (the skill's `unstable_cache` pattern, 300 s) keeps only `COUNTRY_CONFIG` entries that the project supports. The locale chooser lists exactly these (spec: "only the offered locales").
5. Nothing else. No Product Search in F.

### 3.4 Route handler contracts

All return JSON; errors `{ "error": { "code", "message" } }` (D). Session via `getSession()`; writes via `setSessionCookie`.

| Handler | Request | Response | Notes |
| --- | --- | --- | --- |
| `GET /api/channels?country=US` | optional `country` (2 letters, uppercase, must be in `COUNTRY_CONFIG`; default session country) | `200 { stores: Store[], selectedKey: string \| null }` | Sorted by city name; distance is computed in the client (3.7). Only `InventorySupply` channels (scenario "Store list"). All six stores are in New York City and belong to the US market (D-035); for `CA` the handler returns `200 { stores: [], selectedKey: null }` and the Canada market never shows a store picker. `selectedKey` is `session.collectionStoreKey` only when that store is in the market, else null |
| `GET /api/availability?sku=<sku>` | `sku` required | `200 { sku, ship: 'in'\|'low'\|'out', stores: StoreAvailability[] }`; `400 invalid_sku`; `404` never (unknown sku returns all `out`) | `Cache-Control: no-store` |
| `PUT /api/session/store` | `{ storeKey: string \| null }` | `200 { storeKey }`; `400 unknown_store` when the key is not an `InventorySupply` store of the session country; `null` clears | Writes `collectionStoreKey` into the session; no cart write (collect lines keep their own store until I's "Change store" action) |
| `PUT /api/session/market` | `{ country: 'CA' }` (language alone is not accepted here, see Q-F-02) | `200 { country, currency, locale, cartCarriedOver: false, droppedLines: [] }`; `400 unsupported_market` | Sets `country`, `currency`, `locale` together from `COUNTRY_CONFIG`; sets `cartId` to undefined (spec: no mixed currency); clears `collectionStoreKey` when the store is not in the new country. The client then calls `router.replace(pathname, { locale })` and `router.refresh()`. I extends this handler with carry-over (task I-12); F's response already carries the two fields so the client does not change |
| `GET /api/cart/count` | none | `200 { count: number }` (sum of `totalLineItemQuantity`); `{ count: 0 }` without a cart or when the cart is not `Active` (and clears `cartId` from the session, per the skill) | Reads `apiRoot.carts().withId({ ID }).get()` once |
| `POST /api/newsletter` | `{ email }` | `202 { ok: true }`; `422 invalid_email` | zod email, max 254 chars; no storage, no logging of the address; rate limit by IP is out of scope (Q-F-07) |

### 3.5 Header, promise bar, mega menu

**Promise bar** (`PromiseBar`, server). Ink background, 12.5px text, centered; content `shell.promise` with ICU placeholders `{threshold}`, `{minutes}`, `{days}`: "Free shipping over {threshold} · Free café collection, ready in {minutes} · {days}-day returns". `threshold` formatted with `formatMoney(centAmount, currency, locale)` from `getFreeShippingThreshold`; `minutes` is the chosen store's `collectionMinutes`, else the minimum over the market's stores, else the clause is hidden; `days` from `RETURN_DAYS`. Hide a clause rather than show a placeholder (scenario "Threshold changes": nothing is hard-coded, the figure is read per render; cart and PDP read the same function). The bar is a single `<p>` with `role="note"`.

**Header** (`Header`, server) 72px, `position: sticky; top: 0; z-index` from a token, background `canvas` at 86% with `backdrop-filter: blur(12px)`, 1px `--line` bottom border. Order: menu toggle (hidden at 821px and up), wordmark "Malva Coffee" (Archivo 800, 0.16em tracking, a locale `Link` to `/`), `PrimaryNav` (hidden under 820px), `HeaderActions` right aligned with 6px gaps. Layout inside `wrap` (max 1320px, 32px padding, 20px under 820px).

**PrimaryNav** items from `MEGA_CONFIG` order: Nespresso-compatible pods, Coffee, Machines, Accessories, Gifts (labels from `shell.nav.*`; the brand name is not used as a product brand, D-005, so the English label is "Pods" with the sub-line "compatible with Nespresso Original and Vertuo" shown in the mega menu feature column; Q-F-08). Each link: category `Link` to `/category/<slug>`, underline that grows from 0 to 100% width on hover/focus (200ms), `--accent` colour and `aria-current="page"` when the pathname starts with that category path. Gifts has no mega panel (plain link).

**HeaderActions** (client), right to left of nav: `StorePill` (pill, 1px `--line-2`, pin icon in `--accent`, text "Collect at {store name}" truncated at 230px; text hidden under 820px leaving the icon; `aria-label` from `shell.storePill.aria`; when no store: "Choose a store"); `LocalePill` (globe icon plus `{country code} ({currency}) | {language code}`; text hidden under 820px, padding 8px); search icon button; `AccountMenu`; `CartButton`.

**AccountMenu.** `useAccount()` (J provides the real hook; F ships `hooks/useAccount.ts` reading `GET /api/auth/me` returning `{ customer: { firstName, lastName, email } | null }`, `revalidateOnFocus: false`, returns `null` on non-ok). Guest: icon `Link` to `/account/sign-in` (J's route) with `aria-label` "Sign in". Signed in: avatar button with initials (`firstName[0] + lastName[0]` uppercased), a chevron, `aria-haspopup="menu"` and `aria-expanded`; dropdown has name, email, "Dashboard" (`/account`), "Sign out" (`POST /api/auth/logout` then `mutate(KEY_ACCOUNT, null)` and `router.refresh()`). Closes on outside click, Escape and route change. The email is rendered as text, truncated with `title`.

**CartButton.** Icon button, `aria-label` "Cart" plus count ("Cart, {count} items"), badge `position:absolute; top:4px; right:4px; min-width:16px; height:16px` accent background, Roboto Mono 10px 700, **hidden at count 0** (scenario "Cart count": 3 units across 2 lines shows 3, units not lines). `useCartCount()` is `useSWR(KEY_CART_COUNT, fetch('/api/cart/count'))` with `revalidateOnFocus: true`. I replaces its source with `useCart()` but keeps the export. Click calls `useShellUi().openCart()`; I mounts the drawer. Until then the fallback is `router.push('/cart')`.

**Mega menu** (`MegaMenu`, client; data from `MEGA_CONFIG`, tree from the server prop). Behaviour:
- Opens on `mouseenter` of a primary link (and on `focus`/`ArrowDown` for keyboard); a `closeTimer` of **130 ms** starts on `mouseleave` of either the link or the panel and is cleared by `mouseenter` of either (scenarios "Pointer leaves"). Closes on Escape, outside `pointerdown`, route change. Only one panel open. Disabled under 820px (`display: none`).
- Panel is full width under the header (`position: absolute; left: 0; right: 0; top: 100%`), canvas background, hairline border, 200ms fade+10px translate (disabled under reduced motion), `aria-hidden` when closed, links not focusable when closed (`inert`).
- Layout: 4-column grid `1.05fr 1.55fr 0.85fr 1.05fr`, 36px gap, 40px top padding: (1) feature links (Archivo 600, 16px): "New in", "Bestsellers", "Sets"; (2) heading "Shop {category}" (11px uppercase 0.16em) then a two-column link list; (3) "More from Malva" list; (4) promo tile: image 16:10, 16px radius, headline, one line, CTA "Shop {category} →" underlined. At 1080px and down the promo column is hidden and the grid is `1fr 1.4fr 0.9fr`. Under the grid, a canvas-2 strip: label "Brew methods" and links espresso, filter, French press, moka, cold brew, plus "Shop all {category}".
- Promo image: the category's first image from the category tree (clean URL, through the listing transform in `lib/ct/image-config.ts`); when absent a `canvas-2` block with the category name (no stock image is invented).

**`MEGA_CONFIG`** (`lib/nav/mega-config.ts`), one entry per menu. An entry is `{ labelKey, categoryKey?, params? }`; `categoryKey` is the category **key** from SEED-PLAN section 7 (`mcf-cat-*`), resolved to a slug by walking the tree (never hard-code slugs). Facet params use the shared URL convention: `f_<facet>=a,b`, plus `f_collection`, with the facet names fixed in G-01: `system`, `intensity`, `roast`, `brew`, `origin`, `decaf`, `organic`, `fairtrade`, `colour`, `collection`, `price`, `rating`. Entries (all label keys under `shell.mega.<menu>.*` in the two catalogues):

| Menu | Feature links | Shop list (two columns) | More from Malva | Promo |
| --- | --- | --- | --- | --- |
| Pods (`mcf-cat-pods`) | New in `f_collection=new`; Bestsellers `bestseller`; Sets (`mcf-cat-gifts`) | Original (`mcf-cat-pods-original`), Vertuo (`-vertuo`), Intensity (`f_intensity=8,9,10,11,12,13`), Limited editions (`f_collection=limited-edition`), Decaf (`f_decaf=true`) | Coffee, Machines, Accessories, Gifts | `mcf-cat-pods` |
| Coffee (`mcf-cat-coffee`) | New in, Bestsellers, Sets | Beans (`-beans`), Ground (`-ground`), Single origin (`-single-origin`), Blends (`-blends`), Subscriptions (`f_collection=subscribable`) | Pods, Machines, Accessories, Gifts | `mcf-cat-coffee` |
| Machines (`mcf-cat-machines`) | New in, Bestsellers, Sets | Nespresso-compatible (`-capsule`), Bean-to-cup (`-bean-to-cup`), Espresso (`-espresso`), Filter (`-filter`), Grinders (`-grinders`) | Pods, Coffee, Accessories, Gifts | `mcf-cat-machines` |
| Accessories (`mcf-cat-accessories`) | New in, Bestsellers, Sets | Cups and mugs (`-cups-mugs`), Milk frothers (`-frothers`), Descaling and care (`-care`), Storage (`-storage`) | Pods, Coffee, Machines, Gifts | `mcf-cat-accessories` |

The brew strip links go to `mcf-cat-coffee` with `f_brew=<key>`; brew keys are the seed enum keys (`espresso`, `filter`, `french-press`, `moka`, `cold-brew`). `buildListingHref(categorySlug, params)` builds `/category/<slug>?f_roast=dark` (the locale prefix comes from the `Link`). **Link target scenario:** a click navigates (the `Link`) and closes the menu in the same handler. A category key missing from the tree renders no link and logs a server warning (dev) instead of a dead link.

**MobileNav.** Under 820px the menu toggle opens a fixed full-screen panel sliding from the left (320ms, translateX), `role="dialog"` `aria-modal="true"` `aria-label` "Menu", focus moved to the close button, focus trapped, Escape and scrim close, body scroll locked. Content: wordmark and close button, then links in Archivo 24px (600) separated by hairlines: the five primary links, then "Choose a store" and "Country and language" as secondary rows (they replace the hidden pills), then "My account". Tapping any link closes the panel and navigates (scenario "Navigating from the panel"); the sub-categories show as an inline accordion under each primary link (one open at a time) because the hover panel does not exist on touch.

### 3.6 Footer, newsletter, toast

**Footer** (server). Ink background; top grid `1.4fr repeat(4, 1fr)`, 40px gap, 64px top padding: brand column (wordmark, tagline `shell.footer.tagline`, `NewsletterForm`), four link columns (Shop, Collect, Help, Company; link lists in `lib/nav/footer-config.ts` as `{ labelKey, href }`; unbuilt targets fall back to `/`). Grid becomes 3 columns at 1080px, 2 at 820px. Bottom row: copyright "© {year} Malva Coffee" (year from `new Date()` on the server) and Privacy, Terms, Accessibility (targets built by P). Link colours use tokens (`--ink-on-dark` style tokens added by E, never hex).

**NewsletterForm** (client). Pill input (label `shell.newsletter.label`, visually hidden, plus placeholder), "Join" accent button. Submit: trim, validate with the same zod email schema as the server; invalid: inline error text under the field with `role="alert"` and `aria-invalid="true"`, no request; valid: `POST /api/newsletter`, on 202 `toast.show(t('shell.newsletter.success'))` and the field clears; network or 5xx: inline error "Something went wrong, try again" (never silent). The button is disabled while pending.

**Toast.** E's `ToastProvider` (F mounts it and adds the tests below if E's do not cover them) holds `{ text, nonce, visible }`; `useToast().show(text)` sets text and restarts a single timer of **2200 ms** (clearTimeout before setTimeout; scenario "Repeated action": text updates and the timer restarts). Render: bottom-centre pill, ink background, teal check icon, `role="status"` `aria-live="polite"`, never takes focus, `pointer-events: none`, fades in 200ms; reduced motion: no translate. One toast element only.

### 3.7 Store picker (`StorePicker`)

**Opening.** `useCollectionStore()` returns `{ store, stores, isLoading, select(key), open(context?), close }`. `open({ sku })` (from a product page or card) or `open()` (header, cart "Change store"). The provider keeps `{ open, sku?: string }`. Modal atom from E: centred, 560px, 24px radius, scrim 42%, `role="dialog"` `aria-modal` `aria-labelledby` the title "Choose your store", focus to the search field on open, trapped focus, Escape/scrim/close button close and return focus to the opener.

**Body.** Intro line `store.picker.intro` ("Set your pickup location to see real-time availability across the site."), then `StoreSearch`, then the list. Each `StoreRow` is a `label` wrapping a real `input type="radio"` named `store` (visually the 20px ring with 10px accent dot when selected; `sel` border accent plus inset shadow) with: name (Archivo 600 15px), address line "{addressLine}, {city} · {distance}", "Open today {open}–{close}" (or "Closed today") from `todayHours(store, now, store.timeZone)`, and when `sku` is set an availability line: coloured dot plus text "In stock for this item" (teal), "Low stock for this item" (amber token), "Unavailable for this item" (stone). The row stays selectable when unavailable (the shopper may still want the store; H handles the consequence). **Opened from the header:** no availability line (scenario "Opened from the header"), no request to `/api/availability` is made. **Opened from a product:** one `useAvailability(sku)` call renders lines for all rows (scenario "Opened from a product"); while loading each row shows a 12px-high skeleton line.

**Select.** `select(key)` calls `PUT /api/session/store`, then `mutate(KEY_SELECTED_STORE)`, closes the modal, and toasts "Collecting from {store}" (`store.picker.selected`). Optimistic: the pill updates at once, rolls back with an inline error row if the PUT fails. Persistence: the session cookie lasts 30 days; on a later visit `GET /api/channels` returns `selectedKey` and the radio is preselected (scenario "Persistence"); the header pill reads the same. Guests and signed-in shoppers behave identically. Cleared when the market changes to a country without that store.

**Search and distance (functional, spec requires it).** `StoreSearch` is an `input type="search"` with a search icon and an adjacent "Use my location" button (`navigator.geolocation.getCurrentPosition`, requested only on click; permission denied shows "Location is off, search by town or postcode"). Rules, all client side over the already-loaded `stores` (no geocoder, Q-F-01 default):
1. Origin = geolocation if granted; else the first store whose `postalCode` starts with the typed text (case-insensitive, spaces removed) or whose `city` or `name` contains the typed text (case-insensitive, accent-insensitive via `normalize('NFD')`); else none.
2. With an origin, rows sort by `haversineKm` ascending and show "0.6 mi" (`Intl.NumberFormat` with unit style; all stores are in New York City, so miles only); the first row gets the "Nearest" tag.
3. Without an origin rows sort by city then name and show no distance (never a fake one).
4. A query that matches no store and no origin, or where the nearest store is farther than `NEARBY_RADIUS_KM` (default 80), shows the empty state (scenario "No match"): `store.picker.noMatch` ("No stores near {query}.") and a button "Ship to me instead" that closes the modal and, when the picker was opened from a product, sets a `preferShip` flag in `StoreContext` (H reads it to preselect Ship; default false). It never clears the chosen store.
5. Typing debounces 150ms, `aria-live="polite"` region announces "{n} stores".

### 3.8 Locale chooser (`LocaleChooser`)

Right drawer (E's Drawer atom but width `min(620px, 100vw)` on `--surface`), opened by `LocalePill`, `role="dialog"`, close button top right (`aria-label` "Close"), focus trapped. Content top to bottom:
1. Current country and currency heading "{Country} ({CCY})" with a globe icon; sentence `locale.billing` ("Your current selected location is {country} and your order will be billed in {currency}.").
2. **Language select** (native `select`, 16px, 1px `--line-2`, 10px radius, chevron overlay). Options come from `MarketOption.languages` for the current country. With the two markets as defined (D-030: US en-US, Canada en-CA English only, no French) each country has exactly one language, so the select shows one option and is `disabled` with a hint `locale.languageHint` ("More languages are coming"). The component and `COUNTRY_CONFIG` shape support several languages per country so adding one later is a data change (scenario "Adding a market" of bootstrap). See Q-F-02.
3. Heading "Choose your location" and a single region `North America` listing United States and Canada (the accordion component supports several regions, one open at a time, but only one region is configured), header buttons with plus/minus icon, `aria-expanded`, region names from catalogues. Country rows: name left, currency code right with a check on the current one (`aria-current="true"`), two columns at 821px and up, one column under 820px.
4. Only markets returned by `getValidCountryConfig()` appear (scenario "Only the offered locales"); the six VELA regions are not carried over.

**Switch flow** (`useMarket().switchCountry(country)`): `PUT /api/session/market { country }`; on 200 `router.replace(pathname + search, { locale: newLocale })` from `@/i18n/routing`, then `router.refresh()`; the drawer closes; prices re-render because every catalogue page reads currency from the session and the cache key includes the market (scenario "Country change"); the pill text updates. If the client has items in the bag (`useCartCount() > 0`) a confirm dialog first states `locale.cartNotice` ("Your bag is priced in {oldCurrency}. Items will be moved to {newCurrency} where they are available; others will be listed.") with Continue and Cancel; Cancel changes nothing. In F the bag is **reset** (`cartCarriedOver: false`) and the dialog text uses the variant `locale.cartResetNotice` ("Your bag will be emptied because it is priced in {oldCurrency}") until I-12 lands and flips the policy with a feature constant `CART_CARRY_OVER_ENABLED` in `lib/shop-config.ts` (default false in F, true in I). This satisfies "currency mismatch is resolved explicitly rather than leaving a cart that cannot be checked out" in both phases.

**Language-only change** (when a country has several languages): `router.replace(pathname, { locale })` plus `PUT /api/session/market` with the same country; the cart is untouched because currency is unchanged (the handler keeps `cartId` when `currency` is unchanged: compare to the session before writing).

### 3.9 Region switch policy (template `switching-region-or-language`)

| Scenario | F behaviour | Completed by |
| --- | --- | --- |
| Region switched before a cart exists | session country, currency and locale change together; route locale changes; catalogue (G) reads session | F |
| Region switched with a cart | dialog, then cart reset (cart currency is immutable, so a new cart is needed); policy flag `CART_CARRY_OVER_ENABLED` | I-12 (carry over, default decided in Q-F-03) |
| Product not sellable in the new region | response `droppedLines: []` is in the contract; the dialog and notice component `components/cart/DroppedLinesNotice.tsx` is built in I | I-12 |

### 3.10 Session, cache keys, i18n

**Session fields written/read by F:** `country`, `currency`, `locale` (market), `collectionStoreKey`, `cartId` (reset), never `customer*` (read only via `/api/auth/me`). Writes always replace the whole cookie via `createSessionToken` with the merged object (a field never disappears by accident; test `market switch keeps customer fields`).

**Cache keys** (`lib/cache-keys.ts`): `KEY_CHANNELS = 'channels'`, `keyChannel(id)`, `KEY_SELECTED_STORE = 'selected-store'`, `keyAvailability(sku, country, storeKey)` (D's signature, used as is), `KEY_CART_COUNT = 'cart-count'`, `KEY_ACCOUNT` (exists from D), `KEY_MARKET = 'market'`. Server tags: `channels`, `shipping-methods`, `project-config`. SWR keys that scope per market include the country: `[KEY_CHANNELS, country]`.

**i18n keys** (identical in `messages/en-US.json` and `en-CA.json`; English text shown; en-CA differs only where noted, for example Canadian spelling and the absence of any collection text):
`shell.promise` (above), `shell.nav.pods|coffee|machines|accessories|gifts`, `shell.menu.open|close`, `shell.search.label|placeholder|submit|open`, `shell.account.signIn|menu|dashboard|signOut`, `shell.cart.aria` ("Cart, {count, plural, one {# item} other {# items}}"), `shell.storePill.collectAt` ("Collect at {store}"), `shell.storePill.choose` ("Choose a store"), `shell.storePill.aria`, `shell.localePill.aria`, `shell.mega.<menu>.feature.*`, `shell.mega.<menu>.shop`, `shell.mega.<menu>.more`, `shell.mega.<menu>.promo.title|line|cta`, `shell.mega.brewLabel`, `shell.mega.shopAll`, `shell.footer.tagline`, `shell.footer.col.shop|collect|help|company` and link labels, `shell.footer.copyright`, `shell.footer.privacy|terms|accessibility`, `shell.newsletter.label|placeholder|join|invalid|error|success`, `shell.toast.dismissAria` (none; toast has no button), `store.picker.title|intro|searchLabel|searchPlaceholder|useLocation|locationOff|nearest|openToday|closedToday|distanceKm|distanceMi|availability.in|low|out|loading|noMatch|shipInstead|selected|error|count`, `locale.title|billing|language|languageHint|chooseLocation|region.northAmerica|country.US|CA|cartNotice|cartResetNotice|continue|cancel|close`. A unit test `messages parity` (from E) must pass with the new keys.

**Loading, empty, error states.**
- Header and footer never block on client data: the server layout renders them; client islands show skeletons only inside the store picker and availability lines.
- Channels fail (`upstream_unavailable`): pill shows "Choose a store" and the picker shows `store.picker.error` with a Retry button (re-fetch). The shell never throws.
- Cart count fails: badge hidden, no error shown.
- Category tree empty/failed: nav renders the five static labels as links to `/` (never an empty bar) and a server log line.
- Locale validation fails (project call): fall back to the full `COUNTRY_CONFIG` and log.

**Responsive (tokens spec breakpoints).** 1080px: footer 3 cols, mega promo hidden. 900px: nothing in F changes except the locale drawer stays right. 820px: mobile nav replaces primary nav, mega disabled, pills text hidden, 20px padding, footer 2 cols. 700px and 520px: wordmark shrinks (21px at 520). At 375px the bar wraps to two lines max (`text-wrap: balance`), header actions fit without horizontal scroll (verify `scrollWidth <= innerWidth`).

**Accessibility.** Skip link "Skip to content" as first focusable element targeting `main` (added in the layout); every icon button has `aria-label`; decorative icons `aria-hidden`; visible focus ring from the token on every control; dialogs trap and restore focus; mega menu keyboard operable (Enter/Space/ArrowDown on a link opens, Escape closes and returns focus); toast is polite live region; avatar menu `role="menu"` with arrow keys; contrast AA verified with the token pairs (promo bar text on ink, footer links on ink).

## 4. Tasks

Common rules: server-only modules start with `import 'server-only'`; components never import `lib/ct`; locale links only from `@/i18n/routing`; tokens only; no `any`; every string in the two catalogues. Each task ends with `cd storefront && npm run check`.

- [x] **F-01 Shop config, types, geo and hours helpers.** Files: `lib/shop-config.ts`, `lib/geo.ts`, `lib/hours.ts`, `lib/availability.ts`, `lib/types.ts` additions, `lib/cache-keys.ts` additions. Implement `haversineKm(a, b)`, `formatDistance(km, locale)` (miles for both locales), `todayHours(store, now, timeZone)` using `Intl.DateTimeFormat` with the store time zone, `availabilityState(qty, threshold)`. Tests `lib/geo.test.ts`: `haversine Manhattan to Brooklyn is about 8 km`, `distance is formatted in miles for en-US and en-CA`; `lib/hours.test.ts`: `open today shows hours`, `closed Sunday shows closed`, `uses the store time zone`; `lib/availability.test.ts`: `zero is out`, `at threshold is low`, `above threshold is in`.
- [x] **F-02 Channels and mapper.** `lib/ct/channels.ts`, `lib/mappers/channel.ts`, `app/api/channels/route.ts`, `hooks/useChannels.ts`. [SKILL: commercetools-storefront] [SKILL: commercetools-platform]. Calls per 3.3 item 1. Tests: `Store list shows only InventorySupply channels` (mock returns a channel without the role and one without the `mcf-store-` key, asserts both absent), `maps geoLocation coordinates as lng lat`, `invalid hours JSON becomes closed and is logged`, `GET /api/channels filters by session country`, `selectedKey dropped when store is in another country`, `channel list is cached with tag channels`.
- [ ] **F-03 Inventory and availability endpoint.** `lib/ct/inventory.ts`, `app/api/availability/route.ts`, `hooks/useAvailability.ts`. [SKILL: commercetools-storefront]. Tests: `Collect at an empty store is shown unavailable and ship still available` (entry for store missing or 0, online entry 40), `low stock threshold`, `invalid sku rejected before the predicate`, `response is no-store`, `unknown sku returns all out`.
- [ ] **F-04 Shipping and promise figures.** `lib/ct/shipping.ts`, `lib/mappers/shipping.ts`, `getPromiseFigures()` in `lib/ct/promise.ts`. [SKILL: commercetools-commerce-patterns]. Tests `Threshold changes` (mock rate `freeAbove` 75 USD then 80 USD, asserts the figure changes with no code change and cart/PDP use the same function), `no freeAbove hides the clause`, `threshold read per market` (US 75 USD, CA 99 CAD), `Canada promise bar has no collection clause`, `collection minutes from the chosen store else minimum else hidden`.
- [ ] **F-05 Session store and market handlers.** `app/api/session/store/route.ts`, `app/api/session/market/route.ts`, `lib/ct/market.ts` (`getValidCountryConfig`), `hooks/useMarket.ts`, `hooks/useCollectionStore.ts`. [SKILL: commercetools-storefront]. Tests: `store choice persists in the session`, `unknown store key is rejected`, `Market change sets country currency and locale together and resets cartId` (spec scenario of server-architecture), `market switch keeps customer fields`, `store is cleared when the market changes to Canada`, `Canada market returns no stores`, `language alone keeps cart when currency is unchanged`, `unsupported market 400`, `tampered cookie is an empty session`.
- [ ] **F-06 Layout, promise bar, providers, toast.** `app/[locale]/layout.tsx`, `PromiseBar`, mount of E's `ToastProvider`, `context/*`, skip link. Tests `PromiseBar.test.tsx`: `renders threshold minutes and days`, `hides a clause when the figure is missing`; `ToastProvider.test.tsx`: `Repeated action updates text and restarts the timer` (fake timers: show at 0, show at 1500, hidden at 3700 not 2200), `toast never takes focus`, `fades after 2.2 seconds`.
- [ ] **F-07 Header and primary nav** (the store pill renders nothing when the market has no stores, test `Store pill is hidden in the Canada market`). `Header`, `HeaderActions`, `PrimaryNav`, `StorePill`, `LocalePill`, `SearchToggle`, `CartButton`, `AccountMenu`, `hooks/useCartCount.ts`, `hooks/useAccount.ts`, `app/api/cart/count/route.ts`. [SKILL: commercetools-storefront]. Tests `Header.test.tsx`: `Cart count shows 3 for 3 units across 2 lines`, `badge hidden at 0`, `Signed in shows initials avatar and dropdown with name email dashboard sign out`, `guest sees the plain icon leading to sign in`, `store pill reads Collect at store`, `store pill reads Choose a store without a store`, `active link has aria-current`, `no axe violations`; `cart-count.test.ts`: `returns 0 and clears a non-active cart`, `sums quantities`.
- [ ] **F-08 Mega menu and mobile nav.** `MegaMenu`, `lib/nav/mega-config.ts`, `lib/nav/listing-href.ts`, `MobileNav`. Tests `MegaMenu.test.tsx` (fake timers): `Pointer leaves closes after 130 ms`, `re-entering within 130 ms keeps it open`, `Escape closes`, `Link target opens listing with category and facet and closes the menu`, `missing category renders no link`, `panels are inert when closed`; `listing-href.test.ts`: `builds f_ params and comma lists`, `uses the category slug resolved from the key`; `MobileNav.test.tsx`: `Navigating from the panel closes it and changes the page`, `traps focus`, `accordion opens one at a time`.
- [ ] **F-09 Footer and newsletter.** `Footer`, `NewsletterForm`, `lib/nav/footer-config.ts`, `app/api/newsletter/route.ts`. Tests `NewsletterForm.test.tsx`: `Newsletter valid address shows a confirmation toast`, `invalid address shows an inline error and sends nothing`, `server failure shows an error not silence`; route test `422 invalid_email`, `202 and the address is not logged`; `Footer.test.tsx`: `renders four columns and bottom links`, `copyright year`.
- [ ] **F-10 Store picker.** `StorePicker`, `StoreRow`, `StoreSearch`, store context. [SKILL: commercetools-storefront]. Tests `StorePicker.test.tsx`: `Opened from a product shows an availability line per row`, `Opened from the header shows address and hours only and makes no availability call`, `Persistence preselects the stored store`, `Selecting a row persists and closes`, `Store search by postcode sorts by distance`, `No match offers shipping instead`, `without origin no distance is shown`, `geolocation denied shows the hint`, `radio rows are keyboard operable`, `no axe violations`.
- [ ] **F-11 Locale chooser.** `LocaleChooser`, region accordion. Tests `LocaleChooser.test.tsx`: `Only the offered locales are listed`, `Country change calls the market endpoint then replaces the locale and refreshes`, `one region open at a time`, `current country has a check`, `language select is limited to the country's languages`, `cart notice appears when the bag is not empty and Cancel changes nothing`; money format test `Pod sleeve price shows two decimals` (6.95 en-US `$6.95`, en-CA `$6.95` with the CAD code shown where the currency is not obvious, never 7) in `lib/utils.test.ts` if D has not already (`formatMoney` is D's; add the case only if missing).
- [ ] **F-12 Messages and gates.** Complete the two catalogues for every key in 3.10, run the parity test, run `npm run check` and `npm run build`; confirm the layout routes build as dynamic (they read the session).

## 5. Scenarios checklist

Primary spec `design-storefront-shell`:
- [ ] Threshold changes: `F-04` `Threshold changes`, `PromiseBar.test.tsx`
- [ ] Cart count: `Header.test.tsx` `Cart count shows 3 for 3 units across 2 lines`
- [ ] Signed in: `Header.test.tsx` `Signed in shows initials avatar...`, guest case
- [ ] Store drives availability: `StorePicker.test.tsx` `Selecting a row persists and closes` plus G-/H- tests (`useCollectionStore` consumed); F-level: `store choice persists in the session`
- [ ] Pointer leaves: `MegaMenu.test.tsx` `Pointer leaves closes after 130 ms` and `re-entering within 130 ms keeps it open`
- [ ] Link target: `MegaMenu.test.tsx` `Link target opens listing...`
- [ ] Navigating from the panel: `MobileNav.test.tsx`
- [ ] Newsletter: `NewsletterForm.test.tsx` (valid, invalid)
- [ ] Repeated action: `ToastProvider.test.tsx`

Primary spec `design-store-picker-and-locale`:
- [ ] Opened from a product: `StorePicker.test.tsx`
- [ ] Opened from the header: `StorePicker.test.tsx`
- [ ] Persistence: `StorePicker.test.tsx` and `store choice persists in the session`
- [ ] No match: `StorePicker.test.tsx` `No match offers shipping instead`
- [ ] Country change: `LocaleChooser.test.tsx`
- [ ] Only the offered locales: `LocaleChooser.test.tsx`
- [ ] Pod sleeve price: `lib/utils.test.ts` `Pod sleeve price shows two decimals`

Spec `fulfilment-and-availability-model` (F part):
- [ ] Store list: `channels.test.ts` `Store list shows only InventorySupply channels`
- [ ] Collect at an empty store: `inventory.test.ts` (F-03); the PDP side is H
- [ ] Threshold per market: `F-04` `threshold read per market` (the cart page side is I)

Template `switching-region-or-language`:
- [ ] Region switched before a cart exists: `Market change sets country currency and locale together...` and `LocaleChooser` flow
- [ ] Region switched with a cart: `LocaleChooser` `cart notice...`, `session cartId reset`; carry over in I-12
- [ ] Product not sellable in the new region: contract field `droppedLines` tested in I-12; F test `response carries cartCarriedOver and droppedLines`

## 6. Browser recipe (Chrome DevTools MCP; base `http://localhost:3000`; evidence in `plans/evidence/F/`)

Start `npm run dev` with the seeded project (`.env.local`). Viewports 375x812 and 1440x900. After every step `list_console_messages` shows no errors and `list_network_requests` shows no failed request and no request to a commercetools host.
1. Open `/en-US` at 1440. `take_snapshot`: promise bar text shows the US threshold (75 per SEED-PLAN, read from the data, compare with MCP in section 7), a collection minutes figure and the return days; header has wordmark, five links, store pill "Choose a store", locale pill "US (USD) | EN", search, account icon, cart. Screenshot `F-01-shell-1440.png`.
2. Hover "Pods": panel opens; move the pointer down into it: stays open; leave: closes after about 130 ms (assert with `evaluate_script` polling `aria-hidden`). Click "Vertuo": URL `/en-US/category/<slug>` and the panel closes. Screenshots `F-02-mega-1440.png`. Repeat hover for Coffee and click a brew-method link: URL has `f_brew=espresso`.
3. Click the store pill: modal opens, the six NYC stores are listed (includes NYC SoHo and Brooklyn), no availability lines. Type "Brook": list narrows, distance absent unless location is granted (do not grant; record). Select Brooklyn: modal closes, pill reads "Collect at ...Brooklyn", toast "Collecting from..." disappears after about 2.2 s. Reload: pill still Brooklyn (cookie). Screenshot `F-03-store-picker-1440.png`.
4. Open a product page (G/H may not exist yet): instead call the picker with a sku through the dev harness page `app/[locale]/dev/store-picker/page.tsx` (created in F-10, **dev only**, excluded from build by `process.env.NODE_ENV` check and removed in Q): opened with `sku=<a seeded sku>` shows an availability line per store matching the MCP inventory read.
5. Click the locale pill: drawer opens right; the North America region lists United States and Canada; choose Canada: URL becomes `/en-CA/...`, pill reads "CA (CAD) | EN", prices show CAD, the promise bar reads free shipping over 99 CAD with no collection clause, the store pill is hidden and the footer "Collect" column is hidden; the store pill is cleared (Brooklyn was chosen). Screenshot `F-04-locale-1440.png`. Switch back to the US.
6. Footer: enter `not-an-email` and Join: inline error and no request; enter `qa@example.com`: toast shows and the field clears. Screenshot `F-05-footer-1440.png`.
7. Resize to 375: menu toggle visible, primary nav hidden, pills show icons only, wordmark smaller; open the menu: full-screen panel, links 24px, accordion opens one sub-list; tap a link: panel closes and the page changes. Open the store picker and locale drawer at 375: both fit the viewport with no horizontal scroll. Screenshots `F-06-mobile-375.png`, `F-07-mobile-nav-375.png`, `F-08-picker-375.png`.
8. Keyboard: Tab from the top reaches skip link, wordmark, links, pills, icons in order with a visible focus ring; ArrowDown on "Pods" opens the panel, Escape closes and keeps focus on the link.
9. `/api/channels` response is JSON with 2 stores for the US session and contains no secret; `/api/cart/count` returns `{count:0}` for a fresh session; `/api/availability?sku=<sku>` returns stores and `Cache-Control: no-store`.
10. Locale switch with a bag (after G adds items; if G is not done, add via `curl -X POST /api/cart/lines` once G exists; otherwise record "not exercised, covered by unit test and re-run in I-12").

## 7. Self-verification with data

Use the commercetools MCP when connected, else `cd seed && npm run verify` or a read-only script. Record trimmed results (keys and ids only) in `plans/evidence/F/data-checks.md`.
- Channels: six `InventorySupply` channels `mcf-store-*` exist; `/api/channels` for US returns all six NYC keys and for CA returns an empty list.
- Channel fields: each has `hours`, `collectionMinutes`, `address` and `geoLocation`; any missing field is a seed defect to report to B/C (add a row to `plans/notes/seed-requests.md`, do not edit seed).
- Shipping: for US/USD and CA/CAD `shippingMethods().matchingLocation` returns `mcf-ship-standard` (standard carrier only, D-034) with `freeAbove` equal to 75 and 99 (SEED-PLAN section 3); the promise bar equals each.
- Inventory: pick one SKU with zero stock at one store and stock elsewhere (SEED-PLAN section 8: two products out of stock at one store); `/api/availability` shows `out` for that store, `in` or `low` for others, and the online entry decides `delivery`.
- Project config: `countries`, `currencies`, `languages` contain US, CA, USD, CAD, en-US, en-CA (and nothing else); the chooser lists exactly two countries.
- Session: with DevTools, the cookie is HttpOnly and decodes (jose payload) to contain `collectionStoreKey`, `country`, `currency`, `locale` and no token or secret.

## 8. Manual testing and owner items

Rows (also in `plans/notes/todo-F.md`; the lead consolidates into `plans/TODO-MANUAL-TESTING.md`):

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x1 | Owner | Before the live browser recipe of F (everything else builds with the fake) | 1. Confirm `storefront/.env.local` holds the Frontend API client (names in `.env.example`). 2. Confirm its scopes include viewing channels, inventory, shipping methods and the project (see `lib/scopes.ts`). | `/api/health` is ok and `/api/channels` returns stores | TODO |
| SO-x1 | Owner | Before release; F ships with the default copy | 1. Open `messages/en-US.json` keys under `shell`, `store`, `locale`. 2. Mark corrections in the file or the review comment. 3. Approve footer column link lists and the tagline. | Copy reads naturally; link lists approved | TODO |
| M-F-01 | Owner | After F is Ready for review | 1. On a real phone open `/en-US` and `/en-CA`. 2. Open the menu, the store picker (allow location when asked), the locale drawer. 3. Compare with screenshots `design/export/.../screenshots/mega-open.png` and `01-locale-open.png`. | Visual fidelity judged acceptable; distances plausible after allowing location | TODO |
| M-F-02 | Owner | After F | 1. On a real phone deny location in the picker. 2. Search a town. | Hint shown, list still usable | TODO |

## 9. Questions

Mirrored in `plans/notes/questions-F.md` (`Q-F-<n> | question | default | blocks? | Open`).

1. **Q-F-01** How should "search by postcode or town and sort by distance" work without a geocoder? Default: client-side match against the six stores plus opt-in browser geolocation; no external service.
2. **Q-F-02** Each market has one language (D-030), but the spec's language select "limited to that country's languages" and "language alone keeps the country" implies more than one. Default: select present but disabled with one option; component supports several.
3. **Q-F-03** Region switch with a populated bag (template open question): carry over lines that have a price, or start empty? Default: carry over where a price exists, list the others (built in I-12); F ships reset plus explicit dialog first.
4. **Q-F-04** Where do the promise-bar return days (VELA says 90) come from, and what is the value? Default: `RETURN_DAYS = 30` in `lib/shop-config.ts`, flagged for owner (no commercetools field exists for it).
5. **Q-F-05** Low-stock threshold value for "Low stock at {store}". Default: 5 units or fewer, one constant `LOW_STOCK_THRESHOLD`.
6. **Q-F-06** Is the collection-minutes figure per store (channel field) or global? Default: per store, the bar shows the chosen store's figure, else the minimum across the market, else hides the clause.
7. **Q-F-07** Newsletter: where do addresses go? Default: validated no-op returning 202 (no storage, no confirmation email, D-032), real provider is future work; the form text says "Thanks, you're on the list" only because the owner approves it (SO-x1); no personal data is logged.
8. **Q-F-08** Primary nav label for pods without using the Nespresso brand as a product brand (D-005). Default: "Pods" with the sub-line "Compatible with Nespresso Original and Vertuo" in the mega menu; the spec text "Nespresso pods" is not used literally.
9. **Q-F-09** The Route Handler table lacks `PUT /api/session/store`, `PUT /api/session/market`, `GET /api/cart/count`, `POST /api/newsletter`. Default: build them as named; lead to add to the spec table.
10. **Q-F-10** Time zone per store for "Open today". Default: derived from the store's country (`COUNTRY_CONFIG[country].timeZone`: America/New_York; the six stores are all in New York City and Canada has no stores); a channel custom field is future work.
11. **Q-F-11** Mega menu promo tile content (headline, line, image). Default: category image and the catalogue strings; marketing copy to be signed off (SO-x1).
12. **Q-F-12** Should the cart button open the drawer on every page or navigate on small screens? Default: open the drawer everywhere (spec "cart drawer"); the cart page is reached from "View bag".

## 10. Definition of done

- F-01 to F-12 ticked, each with a passing `npm run check`; `npm run build` passes.
- Every scenario in section 5 has a named passing test or recorded evidence.
- Browser recipe walked at 375 and 1440 with evidence in `plans/evidence/F/` (screenshots named above, `data-checks.md`, a `README.md` saying what each proves); console clean, network clean.
- Handlers `GET /api/channels`, `GET /api/availability`, `PUT /api/session/store`, `PUT /api/session/market`, `GET /api/cart/count` and hooks `useCollectionStore`, `useAvailability`, `useCartCount`, `useToast`, `useShellUi` exported with a header comment describing their contract for G, H and I.
- No raw hex values, no bare `next/link`, no `@commercetools/*` import outside `lib/ct` and `lib/mappers`.
- OA-x1, SO-x1, M-F-01, M-F-02 are in `plans/notes/todo-F.md`; questions Q-F-01 to Q-F-12 in `plans/notes/questions-F.md`.
- The dev harness page for the store picker is marked dev only and listed in `plans/IDEAS.md` for removal in Q.
- `STATUS.md` set to `Ready for review`.
