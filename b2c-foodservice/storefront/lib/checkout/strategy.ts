import type { MixedStrategy } from '@/lib/types';

/**
 * How a bag with more than one fulfilment group is paid (spike K-01, D-033: a mixed bag must always be payable).
 *
 * PROVISIONAL: the documentation says the complete hosted Checkout cannot take `shippingMode: Multiple` ("Use Payment Only
 * mode. This is because the Complete Checkout mode handles shipping configuration internally"), so the default is
 * `complete-per-group`. Change this one constant when a live Checkout Application exists and probes S13 to S15 have run
 * (plans/PROJECT-FINDINGS.md, F-K-01). `buildFulfilmentActions` (the `Multiple` path) is ready for `complete-multiple`.
 */
export const MIXED_STRATEGY: MixedStrategy = 'complete-per-group';
