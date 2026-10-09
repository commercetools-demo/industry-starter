# Workstream G: todos and live checks (no credentials existed)

## Live checks (browser recipe, need a seeded project and credentials)
- `curl -i -X POST localhost:3000/api/locale -H 'content-type: application/json' -d '{"currency":"EUR"}'` expects 400; with `{"locale":"en-US"}` expects 200 and a `Set-Cookie: malva_session` carrying locale, country and currency. Requires project settings to list US, USD and en/en-US.
- Confirm `getProjectSettings` really lists `countries`, `currencies`, `languages` for `spec-test-b2c-healthcare` (if `en-US` is not in `languages` and neither is `en`, `en-US` would be excluded and `/api/locale` would answer 400).
- Category tree and shipping methods: two requests within 60 s must produce one commercetools call (add a temporary counter in `fetchCategoryTree`; remove afterwards). Confirm categories exceed neither the 500 limit nor need `where` filtering.
- Request de-duplication: when the first product page (H) uses `getProductByKeyCached` in `generateMetadata` and the page, check one commercetools call per request in the dev log.
- Delete the cart in the MC, reload with the old `malva_session`: the page renders; the cookie keeps `cartId` until the cart endpoint exists (see G-questions 2), then it is cleared.
- Run a Product Search with `buildSearchRequest` against the seeded index: verify attribute field paths and `fieldType` values (`variants.attributes.specialty` enum, `modes` set of enum, `rxOnly` boolean), the price sort filter, and that `masterVariant.prices[*].channel` expands on search results (otherwise pass `channelKeysById` to the doctor mapper).

## Follow-ups for other workstreams
- H: cart endpoint should call `getActiveCartSafe` and clear `cartId` (Route Handler); the real `useCart`/`useAccount` fetchers use `API_CART`/`API_ACCOUNT` from `lib/api-paths.ts` (placeholders call nothing).
- H: pages that show the user's name call `getCustomerByIdCached(session.customerId)` once.
- Region switcher UI must call `POST /api/locale` then `mutate` the cart key; `switching-region-or-language` decides what happens to the cart (G only clears `cartId` on currency change).
- Route Handlers that mutate carts wrap the work in `withCartRetry`.
- `lib/mappers/index.test.ts` still lacks D-05's helper test for `getLocalizedString`/`formatMoney`; `catalog.test.ts` now exercises both.
