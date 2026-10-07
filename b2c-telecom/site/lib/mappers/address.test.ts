import { mapAddresses, toCtAddress } from './address';
import type { AddressInput } from '@/lib/types';

describe('mapAddresses', () => {
  it('maps purposes and defaults from the id lists and drops empty optional fields', () => {
    const list = mapAddresses({
      addresses: [
        { id: 'a1', key: 'k1', firstName: 'Ada', lastName: 'L', streetName: '1 Main St', additionalStreetInfo: 'Apt 2', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', phone: '' },
        { id: 'a2', firstName: 'Bo', lastName: 'K', streetName: 'Hauptstr. 1', city: 'Berlin', postalCode: '10115', country: 'DE' },
      ],
      shippingAddressIds: ['a1'],
      billingAddressIds: ['a1', 'a2'],
      defaultShippingAddressId: 'a1',
      defaultBillingAddressId: 'a2',
    });
    expect(list[0]).toEqual({
      id: 'a1', key: 'k1', firstName: 'Ada', lastName: 'L', streetName: '1 Main St', additionalStreetInfo: 'Apt 2', city: 'New York', state: 'NY', postalCode: '10001', country: 'US',
      isService: true, isBilling: true, isDefaultService: true, isDefaultBilling: false,
    });
    expect(list[1]).toMatchObject({ id: 'a2', country: 'DE', isService: false, isBilling: true, isDefaultBilling: true });
    expect(list[1]).not.toHaveProperty('state');
    expect(list[1]).not.toHaveProperty('phone');
  });
  it('treats a customer without id lists as having no purposes', () => {
    const list = mapAddresses({ addresses: [{ id: 'a1', firstName: 'A', lastName: 'B', streetName: 's', city: 'c', postalCode: '10001', country: 'US' }] });
    expect(list[0]).toMatchObject({ isService: false, isBilling: false, isDefaultService: false });
  });
});

describe('toCtAddress', () => {
  const input: AddressInput = { firstName: ' Ada ', lastName: 'L', streetName: '1 Main St', additionalStreetInfo: ' ', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', phone: '', isService: true, isBilling: false };
  it('trims, sets the key and leaves empty optional values undefined', () => {
    expect(toCtAddress(input, 'addr-1')).toMatchObject({ key: 'addr-1', firstName: 'Ada', state: 'NY', additionalStreetInfo: undefined, phone: undefined });
  });
  it('drops the state of a German address', () => {
    expect(toCtAddress({ ...input, country: 'DE', state: 'BE' }, 'k').state).toBeUndefined();
  });
});
