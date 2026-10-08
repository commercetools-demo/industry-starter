import type { useCheckout } from '@/hooks/useCheckout';

/** What the wizard hands to every step: the checkout state and its writes. Steps never call `fetch` themselves. */
export type CheckoutApi = ReturnType<typeof useCheckout>;
