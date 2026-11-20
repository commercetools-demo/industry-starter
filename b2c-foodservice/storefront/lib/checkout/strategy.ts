import type { MixedStrategy } from '@/lib/types';

/**
 * How a bag with more than one fulfilment group is paid (spike K-01, D-033: a mixed bag must always be payable).
 *
 * `complete-multiple` (D-062): every cart is born `shippingMode: Multiple` and allocated per fulfilment group
 * (`lib/cart/shipping-allocation.ts`), so the bag itself is paid in one hosted Checkout and becomes one order.
 *
 * PROVISIONAL until the owner has run it live: the documentation says the complete hosted Checkout cannot take `Multiple`
 * ("Use Payment Only mode. This is because the Complete Checkout mode handles shipping configuration internally"; probe S13
 * predicted a refusal, plans/PROJECT-FINDINGS.md F-K-01 and F-K-02). If it refuses, flip this one constant to
 * `complete-per-group`: `preparePayments` then clones the bag into one `Single` cart per group and nothing else changes.
 */
export const MIXED_STRATEGY: MixedStrategy = 'complete-multiple';
