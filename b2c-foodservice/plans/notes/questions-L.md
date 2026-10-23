<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream L (account area)

Draft for the lead to consolidate into `plans/QUESTIONS.md`. Format: `Q-<L>-<n> | question | default | blocks? | status`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-L-01 | Which saved payment methods does the hosted Checkout and the chosen connector actually store, and which fields identify them? | Show what the connector writes (label, default flag); no add form; the rest is "not applicable" with an explanation (D-039). Finding from L-10. | No | Open |
| Q-L-02 | Deleting the default address: promote the next (design-account-area) or leave none (address-book template)? | Promote; one constant `DEFAULT_ADDRESS_AFTER_DELETE` switches it, both tested. | No | Open |
| Q-L-03 | Where is the address nickname (Home, Work) stored? | `additionalAddressInfo` of the address. | No | Open |
| Q-L-04 | Can customers change their email? | No; shown read-only with "contact us" (no email verification exists, D-032). | No | Open |
| Q-L-05 | Is there an address validation service? | No; format checks only; the `AddressVerifier` adapter and dialog exist and are tested with a fake. | No | Open |
| Q-L-06 | Loyalty points and member perks? | Not offered; text and tile omitted (`design.md` Q7). | No | Open |
| Q-L-07 | SMS alerts toggle? | Hidden; no SMS provider. | No | Open |
| Q-L-08 | Returns window and eligible items? | 30 days from the order's last modification, all lines eligible (`RETURN_WINDOW_DAYS`); `SO-L-b` decides. | No | Open |
| Q-L-09 | Buy again: new cart (order-history template) or add to the current bag (design)? | Add to the current bag (design); unavailable lines listed. | No | Open |
| Q-L-10 | Account deletion: erase personal data of orders too? | No: `dataErasure: false`; order records retained and the modal says so. | No | Open |
| Q-L-11 | Is the collection store saved per customer or per browser? | Per browser session cookie (30 days). A per-customer default would need a custom field. | No | Open |
| Q-L-12 | Where do notification preferences live? | Removed by D-032: no email, no preferences, no custom type. | No | Superseded (D-032) |
| Q-L-13 | Who owns the heart and saved-list server API: G and H built the heart on `sessionStorage`. | L implements `/api/shopping-lists` and swaps `useSavedItems` (as G's plan states). | No | Open |
| Q-L-14 | Payment method "Remove": delete or deactivate? | Deactivate (`Inactive`), keeps history; the PSP token is not revoked. | No | Open |
| Q-L-15 | Order-completed time for the returns window? | `order.lastModifiedAt` (approximation); a real delivered date needs the store tooling. | No | Open |
| Q-L-16 | K's `OrderView`, `lib/ct/orders.ts`, `lib/mappers/order.ts`, `/api/orders/[id]` and `seed:order` against L's own order code. | Done in `ws/kl-reconcile`: one order model. K's `OrderView` is canonical and carries what the account needs (`status`, `hasCollect`, `hasShip`, `collect[].lat/lng`, `deliveries`, `returns`, `canReturn`, `returnWindowEndsAt`, `returnable`, line `sku`, `storeName`, `unitCents`). L's `account-orders.ts`, `account-order.ts`, `/api/orders/number/[orderNumber]`, `OrderStatusTracker`, `useOrder` and `seed:order-ship` are deleted; the account list, detail, returns and reorder routes use `lib/ct/orders.ts` (`listOrders`, `countOrders`, `getCustomerOrderBy*`, `addReturn`), `mapOrder`, `OrderStatusTrack` and `useOrderStatus`; `seed:order` has the subcommands `state`, `ship`, `deliver`, `return`. The K-06 default-address preselect test no longer exists (the hosted Checkout owns the address step), so nothing to swap. | No | Answered |
| Q-L-17 | Which address validation rules? | Done in `ws/kl-reconcile`: `lib/account/address-validate.ts` keeps the US and CA postal, state and phone formats (K has none) and now takes the name rule (`NAME_PATTERN`) and the country list (`SHOP_COUNTRIES`) from K's `lib/checkout/validate.ts`. | No | Answered |
| Q-L-18 | Small defaults taken | Canada has no State field; the first address becomes default; reorder caps quantity to stock; a delivery stock entry that is absent means out of stock; saved list read as `?view=ids` for hearts; tracking links only for known carriers; Subscriptions tab is a stub page for N; collection hours shown as `07:00-18:00`; the Ready chip is hidden in Canada. | No | Open |
