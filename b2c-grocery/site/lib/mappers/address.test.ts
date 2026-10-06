import { describe, expect, it } from 'vitest';
import { mapAddresses } from './address';

const a = (id: string, extra: object = {}) => ({ id, firstName: 'Ada', lastName: 'L', streetName: `${id} St`, postalCode: '94105', city: 'SF', country: 'US', ...extra });

describe('mapAddresses', () => {
  it('Default marked: flags follow the customer default ids', () => {
    const list = mapAddresses({ addresses: [a('a1'), a('a2', { key: 'home' })], defaultShippingAddressId: 'a2', defaultBillingAddressId: 'a1' });
    expect(list.map((x) => [x.id, x.isDefaultShipping, x.isDefaultBilling])).toEqual([
      ['a1', false, true],
      ['a2', true, false],
    ]);
    expect(list[1]).toMatchObject({ key: 'home', streetName: 'a2 St', country: 'US' });
    expect(list[0]).not.toHaveProperty('key');
  });

  it('no defaults (deleted default): no address is marked', () => {
    const list = mapAddresses({ addresses: [a('a1')] });
    expect(list[0]).toMatchObject({ isDefaultShipping: false, isDefaultBilling: false });
  });

  it('skips addresses without an id; empty book is an empty list', () => {
    expect(mapAddresses({ addresses: [{ country: 'US' }] })).toEqual([]);
    expect(mapAddresses({ addresses: [] })).toEqual([]);
  });
});
