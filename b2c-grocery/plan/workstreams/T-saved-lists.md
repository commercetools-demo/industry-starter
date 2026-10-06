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
- [ ] T-05 Write the saved page + tests (count label, empty state, add-to-bag rules incl. out-of-stock disabled and multi-variant link).
- [ ] T-06 Messages (both locales); report manual tests M-T-1…M-T-3 and sign-off SO-08.

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

## Definition of done
Heart works for both session states; saved page complete; `verify` passes; SO-08 requested.
