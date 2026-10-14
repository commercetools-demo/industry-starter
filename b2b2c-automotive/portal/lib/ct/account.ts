// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Account settings and invitation acceptance (workstream U-10, U-09). Every self-service function takes the customer id from the
// SESSION (the route passes `session.customerId`; no body or query can name another customer). Frontend client only.
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Address, Customer, CustomerUpdateAction } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { listAssociateUnits } from '@/lib/ct/business-units';
import { apiRoot } from '@/lib/ct/client';
import { getStoreContext } from '@/lib/ct/stores';
import { roleName } from '@/lib/ct/company';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { fixtureAccount } from '@/lib/portal/u-fixtures-company';
import type { AccountAddressInput, AccountProfileInput } from '@/lib/company/schemas';
import type { AccountAddress, AccountProfile, AccountUnitRow } from '@/lib/company/types';
import { isConflict, retryOnConflict, statusOf } from './seller/versioned';

const errorCodes = (error: unknown): string[] => ((error as { body?: { errors?: { code?: string }[] } }).body?.errors ?? []).map((e) => e.code ?? '');
const EMAIL_IN_USE = () => new ApiError(409, 'That email is already in use.', 'EMAIL_IN_USE');

async function readCustomer(customerId: string): Promise<Customer> {
  try {
    return (await apiRoot.customers().withId({ ID: customerId }).get().execute()).body;
  } catch (error) {
    if (statusOf(error) === 404) throw new ApiError(404, 'Not found');
    throw error;
  }
}

async function updateCustomer(customerId: string, build: (customer: Customer) => CustomerUpdateAction[]): Promise<Customer> {
  try {
    return await retryOnConflict(async () => {
      const customer = await readCustomer(customerId);
      const actions = build(customer);
      if (actions.length === 0) return customer;
      return (await apiRoot.customers().withId({ ID: customerId }).post({ body: { version: customer.version, actions } }).execute()).body;
    });
  } catch (error) {
    if (statusOf(error) === 400 && errorCodes(error).includes('DuplicateField')) throw EMAIL_IN_USE();
    if (isConflict(error)) throw new ApiError(409, 'Conflict, please retry');
    throw error;
  }
}

// ---- general ----

export async function getAccountProfile(customerId: string): Promise<AccountProfile> {
  if (devFixturesEnabled()) return fixtureAccount.getProfile(customerId);
  const c = await readCustomer(customerId);
  return { firstName: c.firstName ?? '', lastName: c.lastName ?? '', email: c.email };
}

export async function updateAccountProfile(customerId: string, input: AccountProfileInput): Promise<AccountProfile> {
  if (devFixturesEnabled()) return fixtureAccount.updateProfile(customerId, input);
  const c = await updateCustomer(customerId, (current) => [
    ...(current.firstName !== input.firstName ? [{ action: 'setFirstName' as const, firstName: input.firstName }] : []),
    ...(current.lastName !== input.lastName ? [{ action: 'setLastName' as const, lastName: input.lastName }] : []),
    ...(current.email !== input.email ? [{ action: 'changeEmail' as const, email: input.email }] : []),
  ]);
  return { firstName: c.firstName ?? '', lastName: c.lastName ?? '', email: c.email };
}

// ---- security ----

/** Changes the password through the password endpoint; a wrong current password is a 400 with its own message. */
export async function changePassword(customerId: string, currentPassword: string, newPassword: string): Promise<void> {
  if (devFixturesEnabled()) return fixtureAccount.changePassword(customerId, currentPassword, newPassword);
  try {
    await retryOnConflict(async () => {
      const customer = await readCustomer(customerId);
      await apiRoot.customers().password().post({ body: { id: customerId, version: customer.version, currentPassword, newPassword } }).execute();
    });
  } catch (error) {
    if (statusOf(error) === 400 && errorCodes(error).includes('InvalidCurrentPassword')) throw new ApiError(400, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    throw error;
  }
}

// ---- personal addresses ----

export function mapAccountAddresses(customer: Pick<Customer, 'addresses' | 'defaultShippingAddressId'>): AccountAddress[] {
  return customer.addresses
    .filter((a): a is Address & { id: string } => typeof a.id === 'string')
    .map((a) => ({
      id: a.id,
      streetName: a.streetName ?? '',
      ...(a.streetNumber ? { streetNumber: a.streetNumber } : {}),
      postalCode: a.postalCode ?? '',
      city: a.city ?? '',
      country: a.country,
      isDefault: a.id === customer.defaultShippingAddressId,
    }));
}

export async function listAccountAddresses(customerId: string): Promise<AccountAddress[]> {
  if (devFixturesEnabled()) return fixtureAccount.listAddresses(customerId);
  return mapAccountAddresses(await readCustomer(customerId));
}

export async function addAccountAddress(customerId: string, input: AccountAddressInput): Promise<AccountAddress[]> {
  if (devFixturesEnabled()) return fixtureAccount.addAddress(customerId, input);
  const key = `addr-${randomUUID()}`;
  const c = await updateCustomer(customerId, () => [
    { action: 'addAddress', address: { key, country: input.country, streetName: input.streetName, ...(input.streetNumber ? { streetNumber: input.streetNumber } : {}), postalCode: input.postalCode, city: input.city } },
    { action: 'addShippingAddressId', addressKey: key },
    ...(input.makeDefault ? [{ action: 'setDefaultShippingAddress' as const, addressKey: key }] : []),
  ]);
  return mapAccountAddresses(c);
}

export async function removeAccountAddress(customerId: string, addressId: string): Promise<AccountAddress[]> {
  if (devFixturesEnabled()) return fixtureAccount.removeAddress(customerId, addressId);
  const c = await updateCustomer(customerId, (current) => {
    if (!current.addresses.some((a) => a.id === addressId)) throw new ApiError(404, 'Not found');
    return [{ action: 'removeAddress', addressId }];
  });
  return mapAccountAddresses(c);
}

export async function setDefaultAccountAddress(customerId: string, addressId: string): Promise<AccountAddress[]> {
  if (devFixturesEnabled()) return fixtureAccount.setDefaultAddress(customerId, addressId);
  const c = await updateCustomer(customerId, (current) => {
    if (!current.addresses.some((a) => a.id === addressId)) throw new ApiError(404, 'Not found');
    return [{ action: 'setDefaultShippingAddress', addressId }];
  });
  return mapAccountAddresses(c);
}

// ---- business units ----

/** Every unit the signed-in associate belongs to: name, type, role(s) in that unit, and the store with how it is set. */
export async function listAccountUnits(customerId: string): Promise<AccountUnitRow[]> {
  if (devFixturesEnabled()) return fixtureAccount.listUnits(customerId);
  const units = await listAssociateUnits(customerId);
  const names = new Map(await Promise.all([...new Set(units.flatMap((u) => u.storeKeys))].map(async (key) => [key, (await getStoreContext(key))?.name ?? key] as const)));
  return units.map((u) => ({
    key: u.key,
    name: u.name,
    type: u.unitType,
    roles: u.roleKeys.map(roleName),
    storeName: u.storeKeys.map((k) => names.get(k) ?? k).join(', '),
    storeMode: u.storeMode,
  }));
}

// ---- accepting an invitation ----

export const INVALID_INVITE = (): ApiError => new ApiError(400, 'This invitation link is invalid or has expired.', 'INVALID_TOKEN');

/**
 * Accepts an invitation: finds the customer by the password token, sets the password, confirms the email (so the Users table reads
 * Active). Invalid and expired tokens give the same error. The token and the password are never logged.
 */
export async function acceptInvite(token: string, password: string): Promise<void> {
  if (devFixturesEnabled()) {
    if (!(await fixtureAccount.acceptInvite(token, password))) throw INVALID_INVITE();
    return;
  }
  let customer: Customer;
  try {
    customer = (await apiRoot.customers().withPasswordToken({ passwordToken: token }).get().execute()).body;
  } catch (error) {
    if (statusOf(error) === 404 || statusOf(error) === 400) throw INVALID_INVITE();
    throw error;
  }
  try {
    await apiRoot.customers().passwordReset().post({ body: { tokenValue: token, newPassword: password } }).execute();
  } catch (error) {
    if (statusOf(error) === 400 || statusOf(error) === 404) throw INVALID_INVITE();
    throw error;
  }
  if (customer.isEmailVerified) return;
  const fresh = await readCustomer(customer.id);
  const emailToken = (await apiRoot.customers().emailToken().post({ body: { id: fresh.id, version: fresh.version, ttlMinutes: 10 } }).execute()).body.value;
  await apiRoot.customers().emailConfirm().post({ body: { tokenValue: emailToken } }).execute();
}
