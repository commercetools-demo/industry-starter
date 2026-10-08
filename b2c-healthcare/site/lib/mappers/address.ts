import type { Address as CtAddress, Customer } from '@commercetools/platform-sdk';
import type { Address, AddressInput } from '@/lib/types';

/** commercetools address to the app `Address`; `defaultId` is the customer's `defaultShippingAddressId`. */
export function toAddress(address: CtAddress, defaultId: string | undefined): Address {
  const id = address.id ?? '';
  return {
    id,
    firstName: address.firstName ?? '',
    lastName: address.lastName ?? '',
    street: address.streetName ?? '',
    street2: address.additionalStreetInfo ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zip: address.postalCode ?? '',
    phone: address.phone ?? address.mobile ?? '',
    country: 'US',
    isDefault: id !== '' && id === defaultId,
  };
}

/** All saved addresses of a customer, default first, otherwise in saved order. */
export function toAddressList(customer: Pick<Customer, 'addresses' | 'defaultShippingAddressId'>): Address[] {
  const list = customer.addresses.map((a) => toAddress(a, customer.defaultShippingAddressId)).filter((a) => a.id !== '');
  return [...list.filter((a) => a.isDefault), ...list.filter((a) => !a.isDefault)];
}

/** App input to a commercetools address draft (country is fixed). */
export function toCtAddress(input: AddressInput, key?: string) {
  return {
    ...(key ? { key } : {}),
    firstName: input.firstName,
    lastName: input.lastName,
    streetName: input.street,
    additionalStreetInfo: input.street2 || undefined,
    city: input.city,
    state: input.state,
    postalCode: input.zip,
    phone: input.phone,
    country: 'US',
  };
}
