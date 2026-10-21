<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# L-00 paths and names (branch `ws/l-account`, from `develop`)

Paths are relative to `storefront/`. K (checkout, orders module) is NOT on `develop`; it is built in parallel.

| Needed | Real name | Note |
| --- | --- | --- |
| K `OrderView`, `lib/ct/orders.ts`, `lib/mappers/order.ts`, `app/api/orders/[id]/route.ts`, `OrderStatusTrack`, `useOrderStatus`, `seed:order` | **not on develop** | L builds its own files (`lib/ct/account-orders.ts`, `lib/mappers/account-order.ts`, `components/account/orders/OrderStatusTracker.tsx`, `app/api/orders/route.ts`, `app/api/orders/number/[orderNumber]/route.ts`, `seed/src/order-ship.ts`) so nothing collides. Follow-up in `plans/notes/questions-L.md` (Q-L-16) |
| J `requireCustomerPage(currentPath)` | `lib/auth/require-customer.ts` | also `requireCustomerApi` (= D `requireCustomer`) |
| J `domainError(code, status, extra)` | `lib/api-domain.ts` | closed `DomainErrorCode`; L appends codes |
| J `useAccount()` | `hooks/useAccount.ts` | `customer` undefined / null / `AppCustomer` |
| J `useAuthActions()` | `hooks/useAuthActions.ts` | `signOut()` evicts `USER_SCOPED_KEYS` |
| J `validatePassword`, rate limiter | `lib/auth/password-policy.ts`, `lib/rate-limit.ts` (`rateLimit`, `hashKey`), `clientIp` in `lib/auth/login-flow.ts` | |
| J `AppAddress`, `AppCustomer`, `toAppAddress`, `toAppCustomer` | `lib/types.ts`, `lib/mappers/customer.ts` | |
| G `addLine(session, market, input)`, `getCartForSession`, `createCart` | `lib/ct/cart.ts` | `AddLineInput` has all three fulfilments (H) |
| G `useSavedItems`, `ProductCard`, `ProductGrid`, `SaveButton` | `hooks/useSavedItems.ts`, `components/product/ProductCard.tsx`, `components/listing/ProductGrid.tsx`, `components/product/SaveButton.tsx` | |
| G `getListingProjections(ids, ctx)` | `lib/ct/products.ts` | cards with the shopper's price |
| F store picker | `useCollectionStore()` in `hooks/useCollectionStore.ts` (`store`, `open()`, `select`) | there is no `useStorePicker` |
| F promise figures | `getPromiseFigures(market, storeKey)` in `lib/ct/promise.ts` | |
| F inventory | `lib/ct/inventory.ts` (`getInventoryDetail`, `getStoreStock`, `SKU_PATTERN`) | |
| F channels | `lib/ct/channels.ts` (`getStoresForCountry`, `getChannelByKey`) | |
| E atoms | `components/ui/{Modal,Chip,Button,ButtonLink,Card,Field,Icon}.tsx`; toast `context/toast.tsx` | |
| I cart | `lib/ct/cart.ts` (`getCartView`, ...), `GET /api/cart`, `useCart`, `useCartMutations`, `/[locale]/cart` | I is merged |
| M reviews tab | `app/[locale]/account/(shell)/reviews/page.tsx` (kept), `components/reviews/MyReviews.tsx` | L adds `(shell)/layout.tsx` |
| Shared | `lib/cache-keys.ts` (`USER_SCOPED_KEYS` already lists `payment-methods`), `lib/nav/footer-config.ts` `BUILT_ROUTES`, `lib/shop-config.ts` (L appends `RETURN_WINDOW_DAYS`) | |
