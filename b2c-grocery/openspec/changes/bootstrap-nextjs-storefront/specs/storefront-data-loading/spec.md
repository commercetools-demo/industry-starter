## ADDED Requirements

### Requirement: Server-rendered catalog, client-fetched user state

Catalog and immutable data (category pages, product pages, search results) SHALL be loaded in async Server Components that call `lib/ct/*` directly. Mutable per-user data (cart, account, orders, addresses, wishlist) SHALL be loaded through client SWR hooks that call Route Handlers. Catalog data SHALL NOT be fetched through a client-facing endpoint for server-only pages.

#### Scenario: Category page
- **WHEN** a category page renders
- **THEN** its data is fetched on the server with no `/api` round trip

#### Scenario: Cart in the header
- **WHEN** the header needs the cart count
- **THEN** it reads the SWR cart state, not a server-rendered value in shared markup

### Requirement: Parallel independent fetches

Independent fetches in one server render SHALL run with `Promise.all`; sequential `await` of independent calls SHALL NOT be used.

#### Scenario: Page with category and tree
- **WHEN** a category page needs the category and the category tree
- **THEN** both requests start concurrently

### Requirement: Type boundary via mappers

SDK responses SHALL be mapped in `lib/mappers/` to app types in `lib/types.ts` before leaving `lib/ct/`. Components SHALL receive only mapped types. Money SHALL be formatted with `formatMoney(centAmount, currencyCode, locale)` and localized strings read with `getLocalizedString(obj, locale)`; hard-coded locale keys and `centAmount / 100` arithmetic SHALL NOT be used.

#### Scenario: Price display
- **WHEN** a price of 48000 cents in EUR renders for `de-DE`
- **THEN** it is produced by `formatMoney` and shown with the locale's currency format

### Requirement: Server-side caching of stable data only

`unstable_cache` SHALL be used only for stable public data with a TTL: project locale validation 300s and category tree 60s. Product prices, carts, account data and anything reading the session SHALL NOT be cached in it.

#### Scenario: Cached function reads session
- **WHEN** a function wrapped in `unstable_cache` calls `getSession()`
- **THEN** review rejects it because the cache is shared across users

### Requirement: Client state hooks and keys

SWR keys SHALL live in `lib/cache-keys.ts` (`KEY_CART`, `KEY_ACCOUNT`, `KEY_ORDERS`, `KEY_ADDRESSES`, `KEY_WISHLIST`, `keyOrder`). Read hooks SHALL return safe defaults, mutations SHALL throw on error and update the cache from the response body without refetching, and the cart hook SHALL revalidate on focus. Components SHALL NOT call `fetch('/api/...')` directly.

#### Scenario: Add to bag
- **WHEN** a mutation succeeds
- **THEN** the cart cache is updated from the response and no extra request is made

#### Scenario: Mutation fails
- **WHEN** the endpoint returns an error
- **THEN** the mutation throws and the UI shows the error without corrupting the cache

### Requirement: Hydration without spinner flash

The root layout SHALL seed SWR through `SWRConfig fallback` with the cart (when the session has a `cartId`) and the account summary built from session fields, without an extra commercetools call for the account.

#### Scenario: Returning customer
- **WHEN** a signed-in customer loads any page
- **THEN** the header shows their cart count and name on first paint

### Requirement: Cart concurrency and totals

Cart mutations SHALL be performed with the current cart version, SHALL retry once on a 409 version conflict after refetching, and SHALL return the server cart so displayed totals are server values. A cart that is no longer `Active` SHALL be cleared from the session.

#### Scenario: Version conflict
- **WHEN** two tabs change the cart and one receives 409
- **THEN** it refetches the cart, retries once, and shows the server totals

### Requirement: Order placement and confirmation

Checkout SHALL be the commercetools Complete Checkout (`checkoutFlow` from `@commercetools/checkout-browser-sdk`) hosted with Adyen in test mode, which creates the order; the app SHALL NOT create the order itself. After the SDK signals completion the app SHALL clear `cartId` from the session, invalidate `KEY_CART`, and redirect to a confirmation page that fetches the order on the server by id.

#### Scenario: Successful payment
- **WHEN** the SDK reports order completion
- **THEN** the session `cartId` is cleared and the confirmation page loads the order by id

### Requirement: Product search API

Product search and listing SHALL use the Product Search API (`apiRoot.products().search()`); the deprecated `productProjections().search()` SHALL NOT be used.

#### Scenario: Search call
- **WHEN** a listing query executes
- **THEN** it uses `products().search()`

### Requirement: Availability-aware cart mutations

Because carts use inventory mode None, add-to-bag and quantity changes SHALL read `ProductVariantAvailability` for the variant (server-side, uncached) and refuse a quantity above the available quantity with the maximum in the error.

#### Scenario: Over-ask
- **WHEN** a quantity above available stock is requested
- **THEN** the endpoint responds 409 with `{ error, available }` and the cart is unchanged
