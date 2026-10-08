import type { BundleIssue, Cart, CheckoutState } from '@/lib/types';
import { checkReadiness, compareTotal, splitIssues } from './guards';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const address = { firstName: 'A', lastName: 'L', streetName: '1 Main St', city: 'NY', postalCode: '10001', country: 'US' as const };
const cart = (kinds: string[]) => ({ lines: kinds.map((kind) => ({ kind })), summary: { total: usd(5000) } }) as unknown as Cart;
const ready = (patch: Partial<CheckoutState> = {}) => ({ cart: cart(['plan']), email: 'a@b.co', serviceAddress: address, delivery: null, ...patch });
const issue = (code: string): BundleIssue => ({ code, severity: 'blocking', lineId: 'l', offerKey: 'k', resolution: 'remove', reasons: [{ code, messageKey: 'm', params: {}, offerKeys: ['k'] }] });

describe('checkout guards', () => {
  it('readiness codes come in the order contact, address, delivery', () => {
    expect(checkReadiness(ready({ email: null, serviceAddress: null }))).toBe('NO_CONTACT');
    expect(checkReadiness(ready({ serviceAddress: null }))).toBe('NO_ADDRESS');
    expect(checkReadiness(ready({ cart: cart(['plan', 'equipment']) }))).toBe('NO_DELIVERY');
    expect(checkReadiness(ready({ cart: cart(['plan', 'equipment']), delivery: { id: 'd', name: 'S', price: usd(0) } }))).toBeNull();
    expect(checkReadiness(ready())).toBeNull();
  });
  it('splits location issues from the rest', () => {
    const split = splitIssues([issue('NOT_SERVICEABLE'), issue('NOT_ELIGIBLE_AUDIENCE')]);
    expect(split.notServiceable.map((i) => i.code)).toEqual(['NOT_SERVICEABLE']);
    expect(split.eligibility.map((i) => i.code)).toEqual(['NOT_ELIGIBLE_AUDIENCE']);
  });
  it('compares the total with what the buyer saw', () => {
    expect(compareTotal(cart([]), 5000)).toEqual({ ok: true });
    expect(compareTotal(cart([]), 4000)).toEqual({ ok: false, total: usd(5000) });
  });
});
