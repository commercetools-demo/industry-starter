import type { Address, Cart, Customer } from '@commercetools/platform-sdk';
import type { AppAddress, AppCustomer, AuthCart } from '@/lib/types';

export function toAppAddress(
  address: Address,
  customer: Pick<Customer, 'defaultShippingAddressId' | 'defaultBillingAddressId'>,
): AppAddress {
  const id = address.id ?? '';
  const street = [address.streetNumber, address.streetName].filter(Boolean).join(' ');
  return {
    id,
    label: address.additionalAddressInfo ?? null,
    firstName: address.firstName ?? '',
    lastName: address.lastName ?? '',
    streetName: street,
    additionalStreetInfo: address.additionalStreetInfo ?? null,
    city: address.city ?? '',
    state: address.state ?? null,
    postalCode: address.postalCode ?? '',
    country: address.country,
    phone: address.phone ?? address.mobile ?? null,
    isDefaultShipping: id !== '' && id === customer.defaultShippingAddressId,
    isDefaultBilling: id !== '' && id === customer.defaultBillingAddressId,
  };
}

/** Every customer is verified (D-032), so there is no verification flag. */
export function toAppCustomer(customer: Customer): AppCustomer {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    defaultShippingAddressId: customer.defaultShippingAddressId ?? null,
    addresses: customer.addresses.map((a) => toAppAddress(a, customer)),
  };
}

/** The small cart facts the auth routes report; workstream I owns the full cart view. */
export function toAuthCart(cart: Cart): AuthCart {
  return {
    id: cart.id,
    lineCount: cart.lineItems.length,
    quantity: cart.totalLineItemQuantity ?? cart.lineItems.reduce((n, l) => n + l.quantity, 0),
  };
}
