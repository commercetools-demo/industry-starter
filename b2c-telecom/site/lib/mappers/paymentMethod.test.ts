import type { PaymentMethod } from '@commercetools/platform-sdk';
import { mapPaymentMethod } from './paymentMethod';

const pm = (over: Record<string, unknown> = {}): PaymentMethod =>
  ({
    id: 'pm-1',
    version: 2,
    default: true,
    paymentMethodStatus: 'Active',
    method: 'card',
    paymentInterface: 'malva-demo',
    interfaceAccount: 'acct-secret-1',
    token: { value: 'tok_demo_visa_4242' },
    name: { 'en-US': 'Visa ending 4242', 'de-DE': 'Visa endet auf 4242' },
    custom: { type: { typeId: 'type', id: 't' }, fields: { brand: 'visa', last4: '4242', expMonth: 3, expYear: 2030 } },
    ...over,
  }) as unknown as PaymentMethod;

describe('mapPaymentMethod', () => {
  it('maps brand, last four digits, expiry as MM/YY and the default flag', () => {
    expect(mapPaymentMethod(pm(), 'en-US')).toEqual({ id: 'pm-1', brand: 'visa', last4: '4242', expiry: '03/30', label: 'Visa ending 4242', isDefault: true });
  });
  it('uses the localized name of the locale and falls back to en-US', () => {
    expect(mapPaymentMethod(pm(), 'de-DE').label).toBe('Visa endet auf 4242');
    expect(mapPaymentMethod(pm({ name: { 'en-US': 'Visa ending 4242' } }), 'de-DE').label).toBe('Visa ending 4242');
  });
  it('has an empty label and unknown brand for a record without display fields', () => {
    expect(mapPaymentMethod(pm({ name: undefined, custom: undefined, default: false }), 'en-US')).toEqual({ id: 'pm-1', brand: 'unknown', last4: null, expiry: null, label: '', isDefault: false });
  });
  it('accepts an enum value object for the brand and rejects a malformed last4', () => {
    const view = mapPaymentMethod(pm({ custom: { fields: { brand: { key: 'mastercard' }, last4: '12' } } }), 'en-US');
    expect(view.brand).toBe('mastercard');
    expect(view.last4).toBeNull();
  });
  it('never carries the token, the interface or the interface account', () => {
    const serialised = JSON.stringify(mapPaymentMethod(pm(), 'en-US'));
    expect(serialised).not.toContain('tok_demo');
    expect(serialised).not.toContain('malva-demo');
    expect(serialised).not.toContain('acct-secret');
    expect(serialised).not.toMatch(/token|paymentInterface|interfaceAccount/);
  });
});
