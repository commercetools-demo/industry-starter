import 'server-only';
import { randomUUID } from 'node:crypto';
import type { CustomerUpdateAction } from '@commercetools/platform-sdk';
import { readCustomer, updateCustomer } from '@/lib/ct/customer-update';
import { toAddressList, toCtAddress } from '@/lib/mappers/address';
import type { Address, AddressInput } from '@/lib/types';

// The patient's address book is the commercetools Customer's own address list, one source for the account page
// and checkout. The default is the customer's defaultShippingAddressId. The customer id always comes from the
// session, so an address id that is not on that customer is "not found" for everyone else's ids too.

/** The address id is not on this customer. */
export class AddressNotFoundError extends Error {
  constructor() {
    super('address not found');
    this.name = 'AddressNotFoundError';
  }
}

export async function listAddresses(customerId: string): Promise<Address[]> {
  return toAddressList(await readCustomer(customerId));
}

/**
 * Saves a new address. The first address of an empty book becomes the default; later ones only when `makeDefault`.
 * The address is added first and named default second, in one update, so no half-saved state is visible.
 */
export async function addAddress(customerId: string, input: AddressInput, makeDefault = false): Promise<Address[]> {
  const key = `addr-${randomUUID()}`;
  const customer = await updateCustomer(customerId, (current) => {
    const actions: CustomerUpdateAction[] = [
      { action: 'addAddress', address: toCtAddress(input, key) },
      { action: 'addShippingAddressId', addressKey: key },
    ];
    if (makeDefault || current.addresses.length === 0) actions.push({ action: 'setDefaultShippingAddress', addressKey: key });
    return actions;
  });
  return toAddressList(customer);
}

/** Changes one saved address (the key, if it has one, is kept). `makeDefault` also makes it the default. */
export async function updateAddress(customerId: string, addressId: string, input: AddressInput, makeDefault = false): Promise<Address[]> {
  const customer = await updateCustomer(customerId, (current) => {
    const existing = current.addresses.find((a) => a.id === addressId);
    if (!existing) throw new AddressNotFoundError();
    const actions: CustomerUpdateAction[] = [{ action: 'changeAddress', addressId, address: toCtAddress(input, existing.key) }];
    if (makeDefault) actions.push({ action: 'setDefaultShippingAddress', addressId });
    return actions;
  });
  return toAddressList(customer);
}

/**
 * Removes one address. When it was the default no other address is promoted: the book then has no default and the
 * next order asks the patient to choose (address-book: Default address removed).
 */
export async function removeAddress(customerId: string, addressId: string): Promise<Address[]> {
  const customer = await updateCustomer(customerId, (current) => {
    if (!current.addresses.some((a) => a.id === addressId)) throw new AddressNotFoundError();
    const actions: CustomerUpdateAction[] = [];
    // removeAddress also drops the id from the shipping/billing lists; clearing the pointer first keeps the
    // result the same whichever way the platform treats a default whose address disappears.
    if (current.defaultShippingAddressId === addressId) actions.push({ action: 'setDefaultShippingAddress', addressId: undefined });
    actions.push({ action: 'removeAddress', addressId });
    return actions;
  });
  return toAddressList(customer);
}

/** Makes one saved address the default shipping address. */
export async function setDefault(customerId: string, addressId: string): Promise<Address[]> {
  const customer = await updateCustomer(customerId, (current) => {
    if (!current.addresses.some((a) => a.id === addressId)) throw new AddressNotFoundError();
    return current.defaultShippingAddressId === addressId ? [] : [{ action: 'setDefaultShippingAddress', addressId }];
  });
  return toAddressList(customer);
}
