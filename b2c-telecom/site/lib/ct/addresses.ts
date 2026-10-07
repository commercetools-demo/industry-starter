import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api-error';
import { ADDRESS_BOOK_LIMIT } from '@/lib/config/addresses';
import { mapAddresses, toCtAddress } from '@/lib/mappers/address';
import type { AddressInput, SavedAddress } from '@/lib/types';
import { getApiRoot } from './client';
import { getCustomerById } from './customer';
import { withTimeout } from './timeout';

// The signed-in customer's address book (D-070: no /me endpoints). Every function takes the customer id from the SESSION, reads the
// customer fresh (never cached), and answers with the whole mapped list. An address id that is not in THIS customer's book is rejected
// before commercetools is called.

export class AddressNotFoundError extends Error {
  constructor() {
    super('Address not found');
    this.name = 'AddressNotFoundError';
  }
}

export class AddressLimitError extends Error {
  constructor() {
    super(`An address book holds at most ${ADDRESS_BOOK_LIMIT} addresses`);
    this.name = 'AddressLimitError';
  }
}

export type DefaultKind = 'service' | 'billing';
export interface MakeDefault {
  service: boolean;
  billing: boolean;
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : undefined;

async function readCustomer(customerId: string): Promise<Customer> {
  const customer = await getCustomerById(customerId);
  if (!customer) throw new ApiError('NOT_FOUND', 'Customer not found');
  return customer;
}

/**
 * Reads the customer, builds the actions from that fresh state and posts them with the customer's version. A version conflict (409,
 * two quick clicks) re-reads and rebuilds once. `plan` may throw a typed error: then nothing is sent.
 */
async function write(customerId: string, plan: (customer: Customer) => CustomerUpdateAction[]): Promise<SavedAddress[]> {
  for (let attempt = 0; ; attempt += 1) {
    const customer = await readCustomer(customerId);
    const actions = plan(customer);
    if (actions.length === 0) return mapAddresses(customer);
    try {
      const { body } = await withTimeout(getApiRoot().customers().withId({ ID: customerId }).post({ body: { version: customer.version, actions } }).execute(), 'addresses.write');
      return mapAddresses(body);
    } catch (error) {
      if (statusOf(error) !== 409 || attempt >= 1) throw error;
    }
  }
}

function addressOf(customer: Customer, addressId: string): NonNullable<Customer['addresses'][number]> {
  const found = customer.addresses.find((address) => address.id === addressId);
  if (!found) throw new AddressNotFoundError();
  return found;
}

export async function getAddresses(customerId: string): Promise<SavedAddress[]> {
  return mapAddresses(await readCustomer(customerId));
}

const newKey = (): string => `addr-${randomUUID()}`;

/**
 * Adds an address in ONE update: the address, the purposes it serves and the defaults. The first address for a purpose becomes that
 * purpose's default. Fresh `key` so the later actions can point at the address that does not have an id yet.
 */
export async function addAddress(customerId: string, input: AddressInput, makeDefault: MakeDefault, keyFactory: () => string = newKey): Promise<SavedAddress[]> {
  return write(customerId, (customer) => {
    if (customer.addresses.length >= ADDRESS_BOOK_LIMIT) throw new AddressLimitError();
    const key = keyFactory();
    const actions: CustomerUpdateAction[] = [{ action: 'addAddress', address: toCtAddress(input, key) }];
    if (input.isService) actions.push({ action: 'addShippingAddressId', addressKey: key });
    if (input.isBilling) actions.push({ action: 'addBillingAddressId', addressKey: key });
    if (input.isService && (makeDefault.service || !customer.defaultShippingAddressId)) actions.push({ action: 'setDefaultShippingAddress', addressKey: key });
    if (input.isBilling && (makeDefault.billing || !customer.defaultBillingAddressId)) actions.push({ action: 'setDefaultBillingAddress', addressKey: key });
    return actions;
  });
}

/** Replaces the address and changes only the purposes that changed. The default pointers are untouched (`changeAddress` keeps them). */
export async function changeAddress(customerId: string, addressId: string, input: AddressInput): Promise<SavedAddress[]> {
  return write(customerId, (customer) => {
    const current = addressOf(customer, addressId);
    const actions: CustomerUpdateAction[] = [{ action: 'changeAddress', addressId, address: toCtAddress(input, current.key ?? newKey()) }];
    const wasService = (customer.shippingAddressIds ?? []).includes(addressId);
    const wasBilling = (customer.billingAddressIds ?? []).includes(addressId);
    if (input.isService && !wasService) actions.push({ action: 'addShippingAddressId', addressId });
    if (!input.isService && wasService) actions.push({ action: 'removeShippingAddressId', addressId });
    if (input.isBilling && !wasBilling) actions.push({ action: 'addBillingAddressId', addressId });
    if (!input.isBilling && wasBilling) actions.push({ action: 'removeBillingAddressId', addressId });
    return actions;
  });
}

/**
 * Removes an address. commercetools clears the default pointers that referenced it; NO other address is promoted (the next order asks
 * for an address). Only `removeAddress` is sent.
 */
export async function removeAddress(customerId: string, addressId: string): Promise<SavedAddress[]> {
  return write(customerId, (customer) => {
    addressOf(customer, addressId);
    return [{ action: 'removeAddress', addressId }];
  });
}

/** Makes the address the default service or billing address; the purpose is added first when the address does not have it yet. */
export async function setDefault(customerId: string, addressId: string, kind: DefaultKind): Promise<SavedAddress[]> {
  return write(customerId, (customer) => {
    addressOf(customer, addressId);
    if (kind === 'service') {
      const has = (customer.shippingAddressIds ?? []).includes(addressId);
      return [...(has ? [] : [{ action: 'addShippingAddressId' as const, addressId }]), { action: 'setDefaultShippingAddress', addressId }];
    }
    const has = (customer.billingAddressIds ?? []).includes(addressId);
    return [...(has ? [] : [{ action: 'addBillingAddressId' as const, addressId }]), { action: 'setDefaultBillingAddress', addressId }];
  });
}
