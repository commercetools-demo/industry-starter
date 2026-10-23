# N-00 paths and preconditions (storefront/ relative)

| Thing | Real path / name |
| --- | --- |
| H Subscribe block | `components/pdp/SubscribeBlock.tsx` (state `components/pdp/pdp-state.tsx`, `usePdp`) |
| `formatInterval` | `lib/product/interval.ts` (`formatInterval(schedule, t)` with `pdp` translator); cart/order hook `useIntervalLabel` in `components/cart/use-cart-ui.ts` |
| `useRecurrencePolicies` | `hooks/useRecurrencePolicies.ts`, route `app/api/recurrence-policies/route.ts`, mapper `lib/mappers/recurrence-policy.ts` |
| `RecurrencePolicyView` | `lib/types.ts` (schedule unit `Weeks`/`Months`/`Days`; the plan's `kind` field is not used) |
| `buildAddLineAction` | `lib/ct/cart.ts` (subscribe: `recurrenceInfo` Fixed; no supplyChannel) |
| I subscribe group | `components/cart/GroupHeading.tsx` (kind `subscribe`), rows in `components/cart/CartLineRow.tsx` |
| K guards / hooks | `lib/checkout/guards.ts` (`EXTRA_BLOCKERS`), `lib/checkout/post-order.ts` (`postOrderHooks`), `lib/checkout/finalize.ts` |
| K identity step | `components/checkout/CheckoutPage.tsx` |
| K `OrderSubscriptionCard` | `components/order/OrderSubscriptionCard.tsx` (`OrderView.subscriptions`) |
| L stub page / layout | `app/[locale]/account/(shell)/subscriptions/page.tsx`, `(shell)/layout.tsx`; message key `account.subscriptions.stub` |
| D cache key | `lib/cache-keys.ts`: `keyRecurringOrders(customerId)` (in `USER_SCOPED_KEYS`), `KEY_RECURRENCE_POLICIES` |
| Toast | `context/toast.tsx` (`useToast().show`) |
| Atoms | `components/ui/Modal`, `Button`, `ButtonLink`, `Card`, `Badge` |
| Account SWR helper | `hooks/useAccountSwr.ts` (401 sends to sign-in) |

Preconditions: K and L are `Ready for review` (not yet `Done`); develop is the base. OA-02 is not done and there is no live project:
live parts of N-02 to N-07 are blocked on OA-02 and are built against documentation and the mock server.
