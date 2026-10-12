// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Company & team (workstream U-09): users and invitations, addresses and the profile of the signed-in business unit. Everything
// goes through the as-associate business unit chain with the FRONTEND client, so commercetools enforces membership and the
// associate's permissions; this module never imports the admin client (a test scans for it). No email is ever sent (Q-P01):
// an invitation returns a one-time password-token the Admin hands over on screen.
import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Address, BusinessUnit, BusinessUnitUpdateAction, Customer } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { apiRoot } from '@/lib/ct/client';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { fixtureCompany } from '@/lib/portal/u-fixtures-company';
import { ADDRESS_TYPES, INVITABLE_ROLE_KEYS, type AddressInput, type InviteInput, type ProfileInput } from '@/lib/company/schemas';
import type { AddressRow, AddressType, InviteResult, ProfileView, RoleOption, UserRow } from '@/lib/company/types';
import { ROLE } from '@/lib/roles';
import type { Session } from '@/lib/types';
import { isConflict, retryOnConflict, statusOf } from './seller/versioned';

export type CompanySession = Session & { customerId: string; businessUnitKey: string };

export const INVITE_TTL_MINUTES = 4320;
const ROLE_NAMES: Record<string, string> = { [ROLE.admin]: 'Admin', [ROLE.buyer]: 'Buyer' };

export const roleName = (key: string): string => ROLE_NAMES[key] ?? key;

/** The two roles offered when inviting (Admin and Buyer only; the project's sample roles stay out). */
export function listRoles(): RoleOption[] {
  return INVITABLE_ROLE_KEYS.map((key) => ({ key, name: roleName(key) }));
}

const unitRequest = (session: CompanySession) =>
  apiRoot.asAssociate().withAssociateIdValue({ associateId: session.customerId }).businessUnits().withKey({ key: session.businessUnitKey });

async function readUnit(session: CompanySession): Promise<BusinessUnit> {
  try {
    return (await unitRequest(session).get().execute()).body;
  } catch (error) {
    if (statusOf(error) === 404 || statusOf(error) === 403) throw new ApiError(404, 'Not found');
    throw error;
  }
}

async function updateUnit(session: CompanySession, build: (unit: BusinessUnit) => BusinessUnitUpdateAction[]): Promise<BusinessUnit> {
  try {
    return await retryOnConflict(async () => {
      const unit = await readUnit(session);
      return (await unitRequest(session).post({ body: { version: unit.version, actions: build(unit) } }).execute()).body;
    });
  } catch (error) {
    if (statusOf(error) === 403) throw new ApiError(403, 'Forbidden');
    if (isConflict(error)) throw new ApiError(409, 'Conflict, please retry');
    throw error;
  }
}

// ---- users ----

const nameOf = (c: Pick<Customer, 'firstName' | 'lastName' | 'email'>) => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;

export function mapUser(unit: Pick<BusinessUnit, 'associates'>, customer: Customer): UserRow {
  const associate = unit.associates.find((a) => a.customer.id === customer.id);
  const roleKey = associate?.associateRoleAssignments[0]?.associateRole.key ?? '';
  const lastActive = (customer.custom?.fields as Record<string, unknown> | undefined)?.lastActiveAt;
  return {
    customerId: customer.id,
    name: nameOf(customer),
    email: customer.email,
    role: roleName(roleKey),
    roleKey,
    status: customer.isEmailVerified === false ? 'Invited' : 'Active',
    lastActive: typeof lastActive === 'string' && lastActive !== '' ? lastActive : null,
  };
}

export async function listUsers(session: CompanySession): Promise<UserRow[]> {
  if (devFixturesEnabled()) return fixtureCompany.listUsers(session);
  const unit = await readUnit(session);
  const ids = [...new Set(unit.associates.map((a) => a.customer.id))];
  if (ids.length === 0) return [];
  const { body } = await apiRoot.customers().get({ queryArgs: { where: 'id in :ids', 'var.ids': ids, limit: 100 } }).execute();
  return body.results.map((c) => mapUser(unit, c)).sort((a, b) => a.name.localeCompare(b.name));
}

const randomPassword = (): string => randomBytes(18).toString('base64url');

/**
 * Invites a user: creates the customer (`isEmailVerified: false`, random password nobody knows), adds the associate with the chosen
 * role, and creates a password token. Returns the token ONCE for the Admin to hand over; it is never stored or logged. When the
 * associate step fails the just-created customer is deleted again (compensation).
 */
export async function inviteUser(session: CompanySession, input: InviteInput): Promise<{ token: string; user: UserRow }> {
  if (!(INVITABLE_ROLE_KEYS as readonly string[]).includes(input.roleKey)) throw new ApiError(400, 'Choose Admin or Buyer');
  if (devFixturesEnabled()) return fixtureCompany.invite(session, input);
  let customer: Customer;
  try {
    customer = (await apiRoot.customers().post({ body: { email: input.email, firstName: input.firstName, lastName: input.lastName, password: randomPassword(), isEmailVerified: false } }).execute()).body.customer;
  } catch (error) {
    const codes = ((error as { body?: { errors?: { code?: string }[] } }).body?.errors ?? []).map((e) => e.code);
    if (statusOf(error) === 400 && codes.includes('DuplicateField')) throw new ApiError(409, 'That email is already in use.', 'EMAIL_IN_USE');
    throw error;
  }
  let unit: BusinessUnit;
  try {
    unit = await updateUnit(session, () => [
      {
        action: 'addAssociate',
        associate: { customer: { typeId: 'customer', id: customer.id }, associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: input.roleKey }, inheritance: 'Disabled' }] },
      },
    ]);
  } catch (error) {
    try {
      await apiRoot.customers().withId({ ID: customer.id }).delete({ queryArgs: { version: customer.version } }).execute();
    } catch {
      // the customer stays unusable (random password, not an associate); a retry reports the email as in use
    }
    throw error;
  }
  const token = (await apiRoot.customers().passwordToken().post({ body: { email: input.email, ttlMinutes: INVITE_TTL_MINUTES } }).execute()).body.value;
  return { token, user: mapUser(unit, customer) };
}

export function toInviteResult(token: string, user: UserRow, locale: string): InviteResult {
  return { invitePath: `/${locale}/accept-invite/${token}`, user };
}

// ---- addresses ----

function typeOf(unit: Pick<BusinessUnit, 'shippingAddressIds' | 'billingAddressIds'>, id: string): AddressType {
  const shipping = (unit.shippingAddressIds ?? []).includes(id);
  const billing = (unit.billingAddressIds ?? []).includes(id);
  if (shipping && billing) return 'Delivery & billing';
  if (billing) return 'Billing';
  return 'Delivery';
}

export function mapAddresses(unit: BusinessUnit): AddressRow[] {
  return unit.addresses
    .filter((a): a is Address & { id: string } => typeof a.id === 'string')
    .map((a) => ({
      id: a.id,
      label: a.additionalAddressInfo ?? '',
      streetName: a.streetName ?? '',
      ...(a.streetNumber ? { streetNumber: a.streetNumber } : {}),
      postalCode: a.postalCode ?? '',
      city: a.city ?? '',
      country: a.country,
      type: typeOf(unit, a.id),
      isDefault: a.id === unit.defaultShippingAddressId || a.id === unit.defaultBillingAddressId,
    }));
}

export async function listAddresses(session: CompanySession): Promise<AddressRow[]> {
  if (devFixturesEnabled()) return fixtureCompany.listAddresses(session);
  return mapAddresses(await readUnit(session));
}

/** Add-address actions in ONE update: the address gets a key so the list and default actions can refer to it. */
export function buildAddAddressActions(input: AddressInput, key: string): BusinessUnitUpdateAction[] {
  const shipping = input.type !== 'Billing';
  const billing = input.type !== 'Delivery';
  return [
    { action: 'addAddress', address: { key, country: input.country, streetName: input.streetName, ...(input.streetNumber ? { streetNumber: input.streetNumber } : {}), postalCode: input.postalCode, city: input.city, additionalAddressInfo: input.label } },
    ...(shipping ? [{ action: 'addShippingAddressId' as const, addressKey: key }] : []),
    ...(billing ? [{ action: 'addBillingAddressId' as const, addressKey: key }] : []),
    ...(input.makeDefault && shipping ? [{ action: 'setDefaultShippingAddress' as const, addressKey: key }] : []),
    ...(input.makeDefault && billing ? [{ action: 'setDefaultBillingAddress' as const, addressKey: key }] : []),
  ];
}

export async function addAddress(session: CompanySession, input: AddressInput): Promise<AddressRow[]> {
  if (!(ADDRESS_TYPES as readonly string[]).includes(input.type)) throw new ApiError(400, 'Invalid address type');
  if (devFixturesEnabled()) return fixtureCompany.addAddress(session, input);
  const unit = await updateUnit(session, () => buildAddAddressActions(input, `addr-${randomUUID()}`));
  return mapAddresses(unit);
}

/** Making an address the default sets the default delivery and/or billing address, whichever lists it is in. */
export async function setDefaultAddress(session: CompanySession, addressId: string): Promise<AddressRow[]> {
  if (devFixturesEnabled()) return fixtureCompany.setDefaultAddress(session, addressId);
  const unit = await updateUnit(session, (current) => {
    if (!current.addresses.some((a) => a.id === addressId)) throw new ApiError(404, 'Not found');
    const actions: BusinessUnitUpdateAction[] = [];
    if ((current.shippingAddressIds ?? []).includes(addressId)) actions.push({ action: 'setDefaultShippingAddress', addressId });
    if ((current.billingAddressIds ?? []).includes(addressId)) actions.push({ action: 'setDefaultBillingAddress', addressId });
    if (actions.length === 0) actions.push({ action: 'setDefaultShippingAddress', addressId });
    return actions;
  });
  return mapAddresses(unit);
}

// ---- profile ----

export async function getProfile(session: CompanySession): Promise<ProfileView> {
  if (devFixturesEnabled()) return fixtureCompany.getProfile(session);
  const unit = await readUnit(session);
  const storeKey = session.storeKey ?? '';
  const store = storeKey ? (await apiRoot.stores().withKey({ key: storeKey }).get().execute()).body : undefined;
  const storeFields = (store?.custom?.fields ?? {}) as Record<string, unknown>;
  const unitFields = (unit.custom?.fields ?? {}) as Record<string, unknown>;
  return {
    name: unit.name,
    contactEmail: unit.contactEmail ?? '',
    kind: typeof unitFields.kind === 'string' ? unitFields.kind : '',
    storeKey,
    storeName: store ? (store.name?.['en-US'] ?? Object.values(store.name ?? {})[0] ?? storeKey) : '',
    region: typeof storeFields.defaultCountry === 'string' ? storeFields.defaultCountry : '',
    currency: typeof storeFields.currency === 'string' ? storeFields.currency : '',
  };
}

/** Changes the display name and the contact email only (decision 20); the store, region and currency are "Managed by Malva". */
export async function updateProfile(session: CompanySession, input: ProfileInput): Promise<ProfileView> {
  if (devFixturesEnabled()) return fixtureCompany.updateProfile(session, input);
  await updateUnit(session, () => [
    { action: 'changeName', name: input.name },
    { action: 'setContactEmail', contactEmail: input.contactEmail },
  ]);
  return getProfile(session);
}
