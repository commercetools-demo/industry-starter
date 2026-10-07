import 'server-only';
import type { BaseAddress, Customer as CtCustomer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { mapAddresses } from '../mappers/address';
import type { Address, SavedAddress } from '../types';
import { getApiRoot } from './client';

/** The customer does not exist (deleted after the session was issued). */
export class AddressCustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Customer ${customerId} not found`);
    this.name = 'AddressCustomerNotFoundError';
  }
}

/** The address id is not on this customer's address book (never reveals another customer's addresses). */
export class AddressNotFoundError extends Error {
  constructor(addressId: string) {
    super(`Address ${addressId} not found`);
    this.name = 'AddressNotFoundError';
  }
}

const statusOf = (e: unknown): number | undefined => {
  if (typeof e !== 'object' || e === null) return undefined;
  const { statusCode, code } = e as { statusCode?: unknown; code?: unknown };
  return typeof statusCode === 'number' ? statusCode : typeof code === 'number' ? code : undefined;
};

async function readCustomer(customerId: string): Promise<CtCustomer> {
  try {
    return (await getApiRoot().customers().withId({ ID: customerId }).get().execute()).body;
  } catch (e) {
    if (statusOf(e) === 404) throw new AddressCustomerNotFoundError(customerId);
    throw e;
  }
}

async function update(customer: CtCustomer, actions: CustomerUpdateAction[]): Promise<CtCustomer> {
  try {
    return (await getApiRoot().customers().withId({ ID: customer.id }).post({ body: { version: customer.version, actions } }).execute()).body;
  } catch (e) {
    if (statusOf(e) === 404) throw new AddressCustomerNotFoundError(customer.id);
    throw e;
  }
}

/** Reads the customer fresh and runs `fn`; one retry with a fresh read on a version conflict (409), a second 409 propagates. */
async function withCustomerRetry(customerId: string, fn: (customer: CtCustomer) => Promise<CtCustomer>): Promise<SavedAddress[]> {
  for (let attempt = 0; ; attempt++) {
    const customer = await readCustomer(customerId);
    try {
      return mapAddresses(await fn(customer));
    } catch (e) {
      if (statusOf(e) !== 409 || attempt >= 1) throw e;
    }
  }
}

const requireAddress = (customer: CtCustomer, addressId: string): void => {
  if (!customer.addresses.some((a) => a.id === addressId)) throw new AddressNotFoundError(addressId);
};

const toBaseAddress = (a: Address): BaseAddress => ({
  country: a.country,
  ...(a.firstName ? { firstName: a.firstName } : {}),
  ...(a.lastName ? { lastName: a.lastName } : {}),
  ...(a.streetName ? { streetName: a.streetName } : {}),
  ...(a.additionalStreetInfo ? { additionalStreetInfo: a.additionalStreetInfo } : {}),
  ...(a.postalCode ? { postalCode: a.postalCode } : {}),
  ...(a.city ? { city: a.city } : {}),
  ...(a.phone ? { phone: a.phone } : {}),
});

/** The customer's address book (mapped, default flags set). */
export async function getAddresses(customerId: string): Promise<SavedAddress[]> {
  return mapAddresses(await readCustomer(customerId));
}

/** Adds an address; the first one also becomes the default shipping address (referenced by its key, the id is not known before the call). */
export function addAddress(customerId: string, address: Address): Promise<SavedAddress[]> {
  return withCustomerRetry(customerId, (customer) => {
    const key = `address-${crypto.randomUUID()}`;
    const actions: CustomerUpdateAction[] = [{ action: 'addAddress', address: { ...toBaseAddress(address), key } }];
    if (customer.addresses.length === 0) actions.push({ action: 'setDefaultShippingAddress', addressKey: key });
    return update(customer, actions);
  });
}

/** Replaces the fields of one address (its default flags are untouched). */
export function changeAddress(customerId: string, addressId: string, address: Address): Promise<SavedAddress[]> {
  return withCustomerRetry(customerId, (customer) => {
    requireAddress(customer, addressId);
    return update(customer, [{ action: 'changeAddress', addressId, address: toBaseAddress(address) }]);
  });
}

/** Removes an address. commercetools clears a default shipping/billing id that pointed at it (checked live, see PROJECT-FINDINGS). */
export function removeAddress(customerId: string, addressId: string): Promise<SavedAddress[]> {
  return withCustomerRetry(customerId, (customer) => {
    requireAddress(customer, addressId);
    return update(customer, [{ action: 'removeAddress', addressId }]);
  });
}

/** Makes the address the default shipping and billing address. */
export function makeDefault(customerId: string, addressId: string): Promise<SavedAddress[]> {
  return withCustomerRetry(customerId, (customer) => {
    requireAddress(customer, addressId);
    return update(customer, [
      { action: 'setDefaultShippingAddress', addressId },
      { action: 'setDefaultBillingAddress', addressId },
    ]);
  });
}
