# T — Saved lists

**Specs:** `grocery-storefront-features` → `saved-lists-design` (all); `cart-design` (Saved items); existing behavior `saved-lists`
**Depends on:** K, L, O · **Unblocks:** — · **Decisions:** D-040 · **Sign-off:** SO-08
**Skill refs:** `commercetools-storefront` `core/shopping-lists.md`, `b2c/wishlists.md`

## Goal
Signed-in customers save products with the heart and see them on the "Put aside" page; anonymous visitors are sent to sign-in and the save completes after they return.

## Design
- `lib/ct/shopping-lists.ts` (`server-only`): `getOrCreateWishlist(customerId)` (key `wishlist-<customerId>`, name localized "Saved", customer reference), `addProduct(listId, version, productId)` (line item by `productId`; skip when already present), `removeProduct(listId, version, lineItemId)`, `getSavedProducts(customerId, ctx)` (list → `getProductsByIds` from G) — uses the **customer-scoped** list, never `shoppingLists()` project-wide queries without the key.
- Routes (401 anonymous; `privateJson()`): `GET /api/account/wishlist` → `{ productIds: string[] }`, `POST /api/account/wishlist` `{ productId }`, `DELETE /api/account/wishlist/[productId]`, and `GET /api/account/wishlist/products` → `{ products: Product[] }` (via `getSavedProducts`, for the saved page; hook `useSavedProducts`).
- Real `hooks/useSaved.ts` (replaces K's stub; **same interface**): `useSaved(): { isSaved(productId): boolean; toggle(productId): Promise<void> }` over `KEY_WISHLIST`; when anonymous, `toggle` sets `sessionStorage['pendingSave']=<productId>` and navigates to `/account/sign-in?redirect=<current path>&save=<productId>` (path validated by `safeRedirectPath`, query `save` preserved inside `redirect`).
- `components/product/PendingSaveRunner.tsx` **(client)** mounted in the locale layout: only if the URL has `?save=<productId>` **and** `sessionStorage['pendingSave']` equals it **and** the user is signed in → add once, then clear both (prevents saves triggered by a crafted link).
- Heart state is **client-resolved** (never in cached markup); the tile renders unpressed on the server.
- Page `/account/saved` (`(protected)`): kicker "N pieces saved", H1 "Put aside", 4-column grid of `Card`s (image 270, name, brand, price, primary "Add to bag", ghost "Remove"), empty state with browse button. "Add to bag": product has one variant → add default variant; multiple variants → link to the PDP; out-of-stock → disabled "Out of stock".

## Tasks
- [x] T-01 Write `lib/ct/shopping-lists.ts` + tests (key format; created once; add skips duplicates; remove by line item id).
- [x] T-02 Write the wishlist routes + tests (401 anonymous; add/remove update list; returns ids).
- [x] T-03 Replace `hooks/useSaved.ts` with the real implementation + tests: signed-in toggle adds/removes with optimistic cache update and rollback on error; anonymous toggle navigates with `redirect` and `save`.
- [x] T-04 Write `PendingSaveRunner` + tests (adds once; strips `save`; does nothing when anonymous).
- [x] T-05 Write the saved page + tests (count label, empty state, add-to-bag rules incl. out-of-stock disabled and multi-variant link).
- [x] T-06 Messages (both locales); report manual tests M-T-1…M-T-3 and sign-off SO-08.

## Unit tests (scenario → test)
| Scenario | Test |
| --- | --- |
| Anonymous heart click | T-03, T-04 |
| Toggle | T-03 |
| Empty list / Move to bag / Out of stock saved item | T-05 |
| Cached page (heart state per session) | T-03 (state from SWR, not props) |

## Manual tests to report
- M-T-1: Signed out, click a heart: sign-in page; after signing in you land back and the heart is filled.
- M-T-2: `/en-US/account/saved` lists the item; remove it: empty state.
- M-T-3: Merchant Center → Shopping lists: `wishlist-<customerId>` exists with one line.
- M-T-4: Signed in, open `/en-US/shop?save=<any product id>` typed by hand (no heart click first): nothing is saved, the `save` parameter disappears from the URL.

## Definition of done
Heart works for both session states; saved page complete; `verify` passes; SO-08 requested.

## Implementation notes (deviations, recorded by the developer)
- **`lib/ct/shopping-lists.ts` signatures differ slightly from the plan:** `addProduct(list, productId)` and `removeProduct(list, productId)` take the loaded `ShoppingList` (not `listId, version`), because "skip when already present" and "remove by line item id" need the line items; `removeProduct` takes the product id and removes every line of that product. Added `getWishlist` (null when missing, a read never creates the list), `saveProduct` / `unsaveProduct` (get-or-create, then one retry on a 409 version conflict), `getSavedProductIds` (newest first) and `productIdsOf`. Live check (throwaway customer, since deleted): create-once with key `wishlist-<customerId>`, name `{en-US: Saved, de-DE: Gemerkt}` and the customer reference works; two simultaneous first saves both succeed (409 retry); an unknown product id is HTTP 400 (mapped to `INVALID_PRODUCT`); lines have no `variantId` when added by `productId` only. Deleting a customer does not delete its shopping list (orphan lists remain; see IDEAS).
- **`privateJson` did not exist yet** (R-03 owns it): T added `lib/api/private-json.ts` with the exact planned signature (`privateJson(body, init?)`, `Cache-Control: private, no-store`). When R merges there will be an add/add conflict on this file; keep either copy (identical behavior). Also `lib/api/wishlist-api.ts` (`customerIdOf`, 401/500 helpers). Every wishlist route checks `session.customerId` and answers 401 with the private header.
- Routes answer `{ productIds }` after POST and DELETE (so the client cache takes the server list); POST/DELETE are idempotent. `GET /api/account/wishlist/products?locale=` prices for the URL locale via `marketFor` (D-012), falling back to the session market.
- **`useSaved`** keeps the interface `{ isSaved, toggle }`. It only fetches (`KEY_WISHLIST`) when `useAccount` says the shopper is signed in, so anonymous visitors cause no 401 requests. Added exports in `hooks/useSaved.ts`: `useSavedIds()`, `useWishlistMutations()` (`save`, `unsave`, optimistic with rollback), `PENDING_SAVE_KEY`, `SAVE_PARAM`. `toggle` never throws: a failure only rolls the heart back (no toast, see IDEAS); a 401 from the server (session ended) clears the account cache and behaves like a visitor.
- The anonymous redirect is `/account/sign-in?redirect=<encoded /<locale>/<path>?...&save=<id>>&save=<id>`, so the original page URL already carries `save` when sign-in returns the shopper.
- `PendingSaveRunner` uses `useSearchParams` (inside `<Suspense fallback={null}>` in the locale layout, after the footer). It saves only when `save` matches `sessionStorage.pendingSave` and the user is signed in; for a non-matching (crafted) link it just removes `save` and leaves any real pending entry alone; for a matching one it saves once (a failure is not retried), clears the entry and strips `save` with `router.replace`.
- Saved page: client island `components/account/SavedView.tsx` + `SavedCard.tsx`, `hooks/useSavedProducts.ts` (key `keyWishlistProducts(locale)` = `wishlist:products:<locale>`). Products are fetched once; the grid is filtered by the saved ids in the SWR cache, so Remove (optimistic) and hearts toggled elsewhere show at once. `useAuthMutations().logout` now also clears every `wishlist:*` key (one added line in `hooks/useAccount.ts`, test extended). Grid is 1 / 2 / 4 columns (mobile / tablet / desktop). "Add to bag" rules: no variant in stock -> disabled "Out of stock"; one variant -> `addItemWithToast(sku, 1)`; several variants -> link to the PDP. Kicker is hidden when empty.
- Messages: `account.saved.*` in both locales (German uses informal "du" like the cart; machine translated, see IDEAS). `components/product/AddToBag.test.tsx` and `RelatedAndReviews.test.tsx` now mock `@/hooks/useSaved` like the K tests (the real hook needs the router).
- Not done (not in the task list): the PDP and the header do not link to the saved page (nav key `nav.saved` exists but no header link was part of T), see IDEAS.

