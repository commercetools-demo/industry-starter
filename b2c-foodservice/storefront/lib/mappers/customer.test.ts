import type { Customer } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { toAppCustomer, toAuthCart } from '@/lib/mappers/customer';

const customer = {
  id: 'c1', email: 'a@example.com', firstName: 'A', lastName: 'B',
  defaultShippingAddressId: 'a2', defaultBillingAddressId: 'a1',
  addresses: [
    { id: 'a1', country: 'US', streetName: 'Example Street', streetNumber: '100', city: 'New York', additionalAddressInfo: 'Home' },
    { id: 'a2', country: 'US', streetName: 'Sample Avenue', city: 'Austin', phone: '555' },
  ],
} as unknown as Customer;

describe('customer mapper', () => {
  it('toAppCustomer marks the default shipping address', () => {
    const app = toAppCustomer(customer);
    expect(app.defaultShippingAddressId).toBe('a2');
    expect(app.addresses.map((a) => [a.id, a.isDefaultShipping, a.isDefaultBilling])).toEqual([
      ['a1', false, true], ['a2', true, false],
    ]);
    expect(app.addresses[0]).toMatchObject({ label: 'Home', streetName: '100 Example Street' });
    expect(app.addresses[1].phone).toBe('555');
  });

  it('toAuthCart counts lines and units', () => {
    const cart = { id: 'k', lineItems: [{ quantity: 2 }, { quantity: 1 }] } as never;
    expect(toAuthCart(cart)).toEqual({ id: 'k', lineCount: 2, quantity: 3 });
  });
});
