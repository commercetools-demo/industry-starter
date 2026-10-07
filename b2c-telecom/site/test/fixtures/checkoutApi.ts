// A fake `CheckoutApi` (what `useCheckout` returns) for the step component tests: the state is given, every write is a spy.
import { vi } from 'vitest';
import type { CheckoutApi } from '@/components/checkout/types';
import { buildReview } from '@/lib/checkout/review';
import type { CheckoutAddress, CheckoutState } from '@/lib/types';
import { feeLine, makeCart, planLine, usd } from './cart';

export const ADDRESS: CheckoutAddress = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' };

export function makeState(patch: Partial<CheckoutState> = {}): CheckoutState {
  return {
    cart: makeCart({ lines: [planLine(), feeLine()] }),
    signedIn: false,
    email: null,
    phone: null,
    serviceAddress: null,
    billingAddress: null,
    needsDelivery: false,
    delivery: null,
    shipping: null,
    tax: null,
    needsCustomer: true,
    ...patch,
  };
}

export const readyState = (patch: Partial<CheckoutState> = {}): CheckoutState => makeState({ email: 'qa-u1@example.com', serviceAddress: ADDRESS, billingAddress: ADDRESS, signedIn: true, ...patch });

export function fakeCheckout(state: CheckoutState, overrides: Partial<CheckoutApi> = {}): CheckoutApi {
  return {
    state,
    review: buildReview(state, '2026-10-07'),
    saveDetails: vi.fn(async () => state),
    loadDelivery: vi.fn(async () => ({ options: [], needsDelivery: state.needsDelivery, state })),
    selectDelivery: vi.fn(async () => state),
    refresh: vi.fn(async () => state),
    startPayment: vi.fn(async () => ({ mode: 'demo' as const, orderNumber: 'MLV-AAAAAAAA' })),
    completeOrder: vi.fn(async () => 'MLV-AAAAAAAA'),
    demoPay: vi.fn(async () => 'MLV-AAAAAAAA'),
    ...overrides,
  };
}

export { feeLine, makeCart, planLine, usd };
