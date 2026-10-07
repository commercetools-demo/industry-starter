import 'server-only';
import type { Address, Customer } from '@commercetools/platform-sdk';
import type { AddressInput, SavedAddress } from '@/lib/types';

/** The saved addresses of a customer. "Stored" and "default" are separate in commercetools: the id lists say which purposes an address may serve. */
export function mapAddresses(customer: Pick<Customer, 'addresses'> & Partial<Pick<Customer, 'shippingAddressIds' | 'billingAddressIds' | 'defaultShippingAddressId' | 'defaultBillingAddressId'>>): SavedAddress[] {
  const shipping = new Set(customer.shippingAddressIds ?? []);
  const billing = new Set(customer.billingAddressIds ?? []);
  return customer.addresses.flatMap((address) => {
    if (!address.id) return [];
    const country = address.country === 'DE' ? 'DE' : 'US';
    return [
      {
        id: address.id,
        ...(address.key ? { key: address.key } : {}),
        firstName: address.firstName ?? '',
        lastName: address.lastName ?? '',
        streetName: address.streetName ?? '',
        ...(address.additionalStreetInfo ? { additionalStreetInfo: address.additionalStreetInfo } : {}),
        city: address.city ?? '',
        ...(address.state ? { state: address.state } : {}),
        postalCode: address.postalCode ?? '',
        country,
        ...(address.phone ? { phone: address.phone } : {}),
        isService: shipping.has(address.id),
        isBilling: billing.has(address.id),
        isDefaultService: customer.defaultShippingAddressId === address.id,
        isDefaultBilling: customer.defaultBillingAddressId === address.id,
      } satisfies SavedAddress,
    ];
  });
}

/** The commercetools address of a buyer's input (empty optional values are left out, text is trimmed). `key` is always set. */
export function toCtAddress(input: AddressInput, key: string): Address {
  const trimmed = (value: string | undefined): string | undefined => {
    const text = value?.trim();
    return text ? text : undefined;
  };
  return {
    key,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    streetName: input.streetName.trim(),
    additionalStreetInfo: trimmed(input.additionalStreetInfo),
    city: input.city.trim(),
    state: input.country === 'US' ? trimmed(input.state) : undefined,
    postalCode: input.postalCode.trim(),
    country: input.country,
    phone: trimmed(input.phone),
  };
}
