import 'server-only';
import type { Address, Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { afterDeleteDefault, DEFAULT_ADDRESS_AFTER_DELETE } from '@/lib/account/address-policy';
import { apiRoot } from '@/lib/ct/client';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { toAppCustomer } from '@/lib/mappers/customer';
import type { AddressInput, AppAddress } from '@/lib/types';

const readCustomer = async (id: string): Promise<Customer> => (await apiRoot.customers().withId({ ID: id }).get().execute()).body;

/** The version-safe write every address change uses: read, build the actions from what was read, post, one retry on a 409. */
async function update(
  customerId: string,
  build: (customer: Customer) => CustomerUpdateAction[],
): Promise<{ customer: Customer }> {
  return updateWithRetry(
    () => readCustomer(customerId),
    async (current) => {
      const actions = build(current);
      const { body } = await apiRoot.customers().withId({ ID: customerId }).post({ body: { version: current.version, actions } }).execute();
      return { customer: body };
    },
  );
}

/** Our address shape to a commercetools address. The nickname lives in `additionalAddressInfo` (Q-L-03). */
export function toCtAddress(input: AddressInput, key?: string): Address {
  return {
    ...(key ? { key } : {}),
    country: input.country,
    firstName: input.firstName,
    lastName: input.lastName,
    streetName: input.streetName,
    ...(input.additionalStreetInfo ? { additionalStreetInfo: input.additionalStreetInfo } : {}),
    city: input.city,
    postalCode: input.postalCode,
    ...(input.state ? { state: input.state } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.label ? { additionalAddressInfo: input.label } : {}),
  };
}

export const listAddresses = async (customerId: string): Promise<AppAddress[]> => toAppCustomer(await readCustomer(customerId)).addresses;

const owned = (customer: Customer, addressId: string): Address => {
  const a = customer.addresses.find((x) => x.id === addressId);
  if (!a) throw new AppError('not_found', 404); // unknown and another customer's are indistinguishable
  return a;
};

/**
 * Add: ONE update with the address, both id lists (an address absent from `shippingAddressIds` is not a legal delivery
 * target) and, for the default, both default pointers (by key). The first address becomes the default by itself.
 */
export async function addAddress(customerId: string, input: AddressInput, makeDefault: boolean): Promise<AppAddress[]> {
  const key = `addr-${crypto.randomUUID().slice(0, 12)}`;
  const { customer } = await update(customerId, (c) => {
    const asDefault = makeDefault || !c.defaultShippingAddressId;
    return [
      { action: 'addAddress', address: toCtAddress(input, key) },
      { action: 'addShippingAddressId', addressKey: key },
      { action: 'addBillingAddressId', addressKey: key },
      ...(asDefault
        ? ([{ action: 'setDefaultShippingAddress', addressKey: key }, { action: 'setDefaultBillingAddress', addressKey: key }] as CustomerUpdateAction[])
        : []),
    ];
  });
  return toAppCustomer(customer).addresses;
}

export async function changeAddress(
  customerId: string,
  addressId: string,
  input: AddressInput,
  makeDefault: boolean,
): Promise<AppAddress[]> {
  const { customer } = await update(customerId, (c) => {
    const existing = owned(c, addressId);
    return [
      { action: 'changeAddress', addressId, address: toCtAddress(input, existing.key) },
      ...(makeDefault
        ? ([{ action: 'setDefaultShippingAddress', addressId }, { action: 'setDefaultBillingAddress', addressId }] as CustomerUpdateAction[])
        : []),
    ];
  });
  return toAppCustomer(customer).addresses;
}

/**
 * Remove. When the removed address was a default, the policy decides (Q-L-02): `promote` appends the new default to the SAME
 * update and reports `promotedId`; `none` leaves no default. Deleting the last address leaves none and is not an error.
 */
export async function removeAddress(
  customerId: string,
  addressId: string,
  policy: 'promote' | 'none' = DEFAULT_ADDRESS_AFTER_DELETE,
): Promise<{ addresses: AppAddress[]; promotedId: string | null }> {
  let promotedId: string | null = null;
  const { customer } = await update(customerId, (c) => {
    owned(c, addressId);
    const next = afterDeleteDefault(c.addresses as { id: string }[], addressId, policy);
    const actions: CustomerUpdateAction[] = [{ action: 'removeAddress', addressId }];
    promotedId = null;
    if (next && c.defaultShippingAddressId === addressId) {
      actions.push({ action: 'setDefaultShippingAddress', addressId: next });
      promotedId = next;
    }
    if (next && c.defaultBillingAddressId === addressId) actions.push({ action: 'setDefaultBillingAddress', addressId: next });
    return actions;
  });
  return { addresses: toAppCustomer(customer).addresses, promotedId };
}

/** Which address is the default shipping address after a change (the select on Profile uses it). */
export async function setDefaultShipping(customerId: string, addressId: string): Promise<Customer> {
  return (
    await update(customerId, (c) => {
      owned(c, addressId);
      return [{ action: 'setDefaultShippingAddress', addressId }];
    })
  ).customer;
}
