import type { CheckoutState } from '@/lib/types';
import { firstIncompleteStep, resolveStep, stepsFor } from './steps';

const state = (patch: Partial<CheckoutState> = {}): CheckoutState =>
  ({ cart: {} as never, signedIn: false, email: null, phone: null, serviceAddress: null, billingAddress: null, needsDelivery: true, delivery: null, shipping: null, tax: null, needsCustomer: false, ...patch });

const address = { firstName: 'A', lastName: 'L', streetName: '1 Main St', city: 'NY', postalCode: '10001', country: 'US' as const };

describe('checkout steps', () => {
  it('digital-only skips delivery', () => {
    expect(stepsFor(state({ needsDelivery: false }))).toEqual(['contact', 'address', 'review', 'payment']);
    expect(stepsFor(state())).toEqual(['contact', 'address', 'delivery', 'review', 'payment']);
  });
  it('first incomplete step follows the cart data', () => {
    expect(firstIncompleteStep(state())).toBe('contact');
    expect(firstIncompleteStep(state({ email: 'a@b.co' }))).toBe('address');
    expect(firstIncompleteStep(state({ email: 'a@b.co', serviceAddress: address }))).toBe('delivery');
    expect(firstIncompleteStep(state({ email: 'a@b.co', serviceAddress: address, delivery: { id: 'd', name: 'S', price: { centAmount: 0, currencyCode: 'USD' } } }))).toBe('review');
    expect(firstIncompleteStep(state({ email: 'a@b.co', serviceAddress: address, needsDelivery: false }))).toBe('review');
  });
  it('a later step redirects to the first incomplete one; payment lands on review; unknown is contact', () => {
    expect(resolveStep('review', state())).toBe('contact');
    expect(resolveStep(undefined, state())).toBe('contact');
    expect(resolveStep('bogus', state({ email: 'a@b.co' }))).toBe('contact');
    expect(resolveStep('contact', state({ email: 'a@b.co' }))).toBe('contact');
    expect(resolveStep('payment', state({ email: 'a@b.co', serviceAddress: address, needsDelivery: false }))).toBe('review');
    expect(resolveStep('delivery', state({ email: 'a@b.co', serviceAddress: address, needsDelivery: false }))).toBe('review');
  });
});
