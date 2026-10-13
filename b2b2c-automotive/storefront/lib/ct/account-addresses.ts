// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The shopper's address book (workstream Q-09, spec "Default address"). In-store customer endpoint; `customerId` from the session; an address id
// that is not one of the customer's own is a 404. The default is `defaultShippingAddressId`, which hosted Checkout and the checkout route read.
import 'server-only';
import type { Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { AccountError, statusOf } from '@/lib/account/errors';
import { isCountryAllowed, isValidPostalCode, MAX_ADDRESSES } from '@/lib/account/address-validation';
import { inStore } from '@/lib/ct/in-store';
import { mapAddresses } from '@/lib/mappers/account';
import type { AccountAddress, AddressInput } from '@/lib/types';

const customers = (storeKey: string) => inStore(storeKey).customers();

async function read(storeKey: string, customerId: string): Promise<Customer> {
  try {
    return (await customers(storeKey).withId({ ID: customerId }).get().execute()).body;
  } catch (error) {
    if (statusOf(error) === 404) throw new AccountError('not-found', 404);
    throw error;
  }
}

async function write(storeKey: string, customer: Customer, actions: CustomerUpdateAction[]): Promise<Customer> {
  try {
    return (await customers(storeKey).withId({ ID: customer.id }).post({ body: { version: customer.version, actions } }).execute()).body;
  } catch (error) {
    if (statusOf(error) === 409) throw new AccountError('busy', 409);
    throw error;
  }
}

export interface AddressBook {
  addresses: AccountAddress[];
  defaultShippingAddressId: string | null;
}
const book = (customer: Customer): AddressBook => ({ addresses: mapAddresses(customer), defaultShippingAddressId: customer.defaultShippingAddressId ?? null });

export async function listAddresses(storeKey: string, customerId: string): Promise<AddressBook> {
  return book(await read(storeKey, customerId));
}

/**
 * The default shipping address as a commercetools address draft, or `null`. Contract for the checkout (workstream O): `setShippingAddress`
 * with this draft prefills what the hosted Checkout reads from the cart. Best effort: a failed read is `null`.
 */
export async function getDefaultShippingAddressDraft(storeKey: string, customerId: string) {
  try {
    const customer = await read(storeKey, customerId);
    const found = (customer.addresses ?? []).find((a) => a.id && a.id === customer.defaultShippingAddressId);
    if (!found) return null;
    const { id: _id, key: _key, ...rest } = found;
    void _id;
    void _key;
    return rest;
  } catch {
    return null;
  }
}

function draft(input: AddressInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    streetName: input.streetName,
    ...(input.streetNumber ? { streetNumber: input.streetNumber } : {}),
    postalCode: input.postalCode.trim(),
    city: input.city,
    country: input.country,
    ...(input.phone ? { phone: input.phone } : {}),
  };
}

function validate(input: AddressInput, countries: readonly string[]): void {
  if (!isCountryAllowed(input.country, countries)) throw new AccountError('country-not-served');
  if (!isValidPostalCode(input.country, input.postalCode)) throw new AccountError('postal-invalid');
}

/** Adds the address as a shipping address (the first one becomes the default; so does one added with `makeDefault`). Up to 20. */
export async function addAddress(storeKey: string, customerId: string, input: AddressInput, countries: readonly string[]): Promise<AddressBook> {
  validate(input, countries);
  const before = await read(storeKey, customerId);
  if ((before.addresses ?? []).length >= MAX_ADDRESSES) throw new AccountError('address-limit');
  const added = await write(storeKey, before, [{ action: 'addAddress', address: draft(input) }]);
  const known = new Set((before.addresses ?? []).map((a) => a.id));
  const created = (added.addresses ?? []).find((a) => a.id && !known.has(a.id));
  if (!created?.id) return book(added);
  const actions: CustomerUpdateAction[] = [{ action: 'addShippingAddressId', addressId: created.id }];
  if (input.makeDefault || (before.addresses ?? []).length === 0) actions.push({ action: 'setDefaultShippingAddress', addressId: created.id });
  return book(await write(storeKey, added, actions));
}

function own(customer: Customer, addressId: string): void {
  if (!(customer.addresses ?? []).some((a) => a.id === addressId)) throw new AccountError('not-found', 404);
}

export async function changeAddress(storeKey: string, customerId: string, addressId: string, input: AddressInput, countries: readonly string[]): Promise<AddressBook> {
  validate(input, countries);
  const customer = await read(storeKey, customerId);
  own(customer, addressId);
  const actions: CustomerUpdateAction[] = [{ action: 'changeAddress', addressId, address: draft(input) }];
  if (input.makeDefault) actions.push({ action: 'setDefaultShippingAddress', addressId });
  return book(await write(storeKey, customer, actions));
}

export async function setDefaultAddress(storeKey: string, customerId: string, addressId: string): Promise<AddressBook> {
  const customer = await read(storeKey, customerId);
  own(customer, addressId);
  return book(await write(storeKey, customer, [{ action: 'setDefaultShippingAddress', addressId }]));
}

/** Removing the default leaves the customer without one (commercetools clears the pointer). */
export async function removeAddress(storeKey: string, customerId: string, addressId: string): Promise<AddressBook> {
  const customer = await read(storeKey, customerId);
  own(customer, addressId);
  return book(await write(storeKey, customer, [{ action: 'removeAddress', addressId }]));
}
