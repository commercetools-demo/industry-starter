import type { Customer } from '@commercetools/platform-sdk';
import { mapCustomer } from './customer';

const ct = (patch: Partial<Customer> = {}): Customer =>
  ({
    id: 'c-1',
    version: 3,
    email: 'jane@example.com',
    firstName: ' Jane ',
    lastName: 'Doe',
    customerNumber: 'MV-12345-5',
    password: 'hash-must-not-leak',
    isEmailVerified: true,
    createdAt: '2026-10-07T10:00:00.000Z',
    lastModifiedAt: '2026-10-07T10:00:00.000Z',
    addresses: [],
    authenticationMode: 'Password',
    stores: [],
    ...patch,
  }) as Customer;

describe('mapCustomer', () => {
  it('maps the browser-safe fields and trims names', () => {
    expect(mapCustomer(ct())).toEqual({
      id: 'c-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      customerNumber: 'MV-12345-5',
      isEmailVerified: true,
      createdAt: '2026-10-07T10:00:00.000Z',
    });
  });

  it('never leaks the password hash and tolerates missing names and number', () => {
    const mapped = mapCustomer(ct({ firstName: undefined, lastName: undefined, customerNumber: undefined }));
    expect(JSON.stringify(mapped)).not.toContain('hash');
    expect(mapped).toMatchObject({ firstName: '', lastName: '' });
    expect('customerNumber' in mapped).toBe(false);
  });
});
