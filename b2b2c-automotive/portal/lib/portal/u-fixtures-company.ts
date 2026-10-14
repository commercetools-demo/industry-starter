// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Development fixtures of workstream U for Company & team and Account settings behind PORTAL_DEV_FIXTURES=on, never in
// production. In-memory state for the fixture users of lib/portal/dev-fixtures.ts; neutral names, no personal data, no secret.
// The fixture password of an account is the synthetic value of the fixture sign-in, never a real one. State lives for the life of
// the dev server.
import 'server-only';
import { randomBytes } from 'node:crypto';
import { ApiError } from '@/lib/api';
import type { CompanySession } from '@/lib/ct/company';
import type { AccountAddressInput, AccountProfileInput, AddressInput, InviteInput, ProfileInput } from '@/lib/company/schemas';
import type { AccountAddress, AccountProfile, AccountUnitRow, AddressRow, AddressType, ProfileView, UserRow } from '@/lib/company/types';
import { FIXTURE_USERS, fixturePorts } from './dev-fixtures';
import { fixtureStoreSettings } from './u-fixtures';

interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  verified: boolean;
  addresses: (AccountAddress & { key: string })[];
}
interface State {
  customers: Map<string, Customer>;
  /** Associates per business ('north', 'south', ...). */
  users: Map<string, { customerId: string; roleKey: string; lastActive: string | null }[]>;
  addresses: Map<string, AddressRow[]>;
  profiles: Map<string, { name: string; contactEmail: string }>;
  invites: Map<string, string>;
  counter: number;
}

const fixturePassword = () => process.env.PORTAL_DEV_FIXTURE_PASSWORD ?? 'fixture-only-password';

function seed(): State {
  const customers = new Map<string, Customer>();
  const users = new Map<string, { customerId: string; roleKey: string; lastActive: string | null }[]>();
  for (const u of FIXTURE_USERS) {
    const [firstName, ...rest] = u.name.split(' ');
    customers.set(u.id, { firstName, lastName: rest.join(' '), email: u.email, password: fixturePassword(), verified: true, addresses: [] });
    if (u.pending || !u.role) continue;
    const list = users.get(u.business) ?? [];
    list.push({ customerId: u.id, roleKey: u.role === 'admin' ? 'mau-role-admin' : 'mau-role-buyer', lastActive: u.role === 'admin' ? '2026-10-11T09:30:00.000Z' : null });
    users.set(u.business, list);
  }
  const depot = (id: string, label: string, street: string, city: string, type: AddressType, isDefault: boolean): AddressRow => ({ id, label, streetName: street, postalCode: '20095', city, country: 'DE', type, isDefault });
  const addresses = new Map<string, AddressRow[]>([
    ['fx-bu-north', [depot('addr-1', 'Main workshop', 'Hafenallee 12', 'Hamburg', 'Delivery & billing', true), depot('addr-2', 'Accounts', 'Postfach 100', 'Hamburg', 'Billing', false)]],
    ['fx-bu-north-hh', [depot('addr-3', 'Hamburg depot', 'Hafenallee 12', 'Hamburg', 'Delivery', true)]],
    ['fx-bu-north-be', [depot('addr-4', 'Berlin depot', 'Werkstattstraße 8', 'Berlin', 'Delivery', true)]],
    ['fx-bu-south', [depot('addr-5', 'Munich workshop', 'Teilestraße 21', 'München', 'Delivery & billing', true)]],
  ]);
  const profiles = new Map([
    ['fx-bu-north', { name: 'Test Garage Nord', contactEmail: 'office.north@example.com' }],
    ['fx-bu-north-hh', { name: 'Test Garage Nord Hamburg', contactEmail: 'hamburg@example.com' }],
    ['fx-bu-north-be', { name: 'Test Garage Nord Berlin', contactEmail: 'berlin@example.com' }],
    ['fx-bu-south', { name: 'Test Garage Süd', contactEmail: 'office.south@example.com' }],
  ]);
  return { customers, users, addresses, profiles, invites: new Map(), counter: 10 };
}

const g = globalThis as unknown as { __malvaUCompanyFixtures?: State };
const state = (): State => (g.__malvaUCompanyFixtures ??= seed());
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const roleName = (key: string) => (key === 'mau-role-admin' ? 'Admin' : key === 'mau-role-buyer' ? 'Buyer' : key);
const businessOf = (customerId: string): string => FIXTURE_USERS.find((u) => u.id === customerId)?.business ?? 'invited';
const nextId = (prefix: string) => `${prefix}-${(state().counter += 1)}`;

const userRow = (customerId: string, roleKey: string, lastActive: string | null): UserRow => {
  const c = state().customers.get(customerId) as Customer;
  return { customerId, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, role: roleName(roleKey), roleKey, status: c.verified ? 'Active' : 'Invited', lastActive };
};

const unitAddresses = (unitKey: string): AddressRow[] => {
  const all = state().addresses;
  if (!all.has(unitKey)) all.set(unitKey, []);
  return all.get(unitKey) as AddressRow[];
};

export const fixtureCompany = {
  listUsers: async (session: CompanySession): Promise<UserRow[]> => {
    const list = state().users.get(businessOf(session.customerId)) ?? [];
    return list.map((u) => userRow(u.customerId, u.roleKey, u.lastActive)).sort((a, b) => a.name.localeCompare(b.name));
  },
  invite: async (session: CompanySession, input: InviteInput): Promise<{ token: string; user: UserRow }> => {
    const s = state();
    if ([...s.customers.values()].some((c) => c.email === input.email)) throw new ApiError(409, 'That email is already in use.', 'EMAIL_IN_USE');
    const customerId = nextId('fx-cust-invited');
    s.customers.set(customerId, { firstName: input.firstName, lastName: input.lastName, email: input.email, password: randomBytes(18).toString('base64url'), verified: false, addresses: [] });
    const business = businessOf(session.customerId);
    s.users.set(business, [...(s.users.get(business) ?? []), { customerId, roleKey: input.roleKey, lastActive: null }]);
    const token = randomBytes(24).toString('base64url');
    s.invites.set(token, customerId);
    return { token, user: userRow(customerId, input.roleKey, null) };
  },
  listAddresses: async (session: CompanySession): Promise<AddressRow[]> => clone(unitAddresses(session.businessUnitKey)),
  addAddress: async (session: CompanySession, input: AddressInput): Promise<AddressRow[]> => {
    const list = unitAddresses(session.businessUnitKey);
    const shipping = input.type !== 'Billing';
    const billing = input.type !== 'Delivery';
    if (input.makeDefault) for (const a of list) if ((shipping && a.type !== 'Billing') || (billing && a.type !== 'Delivery')) a.isDefault = false;
    list.push({ id: nextId('addr'), label: input.label, streetName: input.streetName, ...(input.streetNumber ? { streetNumber: input.streetNumber } : {}), postalCode: input.postalCode, city: input.city, country: input.country, type: input.type, isDefault: Boolean(input.makeDefault) });
    return clone(list);
  },
  setDefaultAddress: async (session: CompanySession, addressId: string): Promise<AddressRow[]> => {
    const list = unitAddresses(session.businessUnitKey);
    const target = list.find((a) => a.id === addressId);
    if (!target) throw new ApiError(404, 'Not found');
    for (const a of list) a.isDefault = a.id === addressId;
    return clone(list);
  },
  getProfile: async (session: CompanySession): Promise<ProfileView> => {
    const profile = state().profiles.get(session.businessUnitKey) ?? { name: session.businessUnitKey, contactEmail: '' };
    const store = session.storeKey ? await fixtureStoreSettings.get(session.storeKey).catch(() => null) : null;
    return { name: profile.name, contactEmail: profile.contactEmail, kind: 'reseller', storeKey: session.storeKey ?? '', storeName: store?.name['en-US'] ?? session.storeKey ?? '', region: store?.defaultCountry ?? 'DE', currency: store?.currency ?? 'EUR' };
  },
  updateProfile: async (session: CompanySession, input: ProfileInput): Promise<ProfileView> => {
    state().profiles.set(session.businessUnitKey, { name: input.name, contactEmail: input.contactEmail });
    return fixtureCompany.getProfile(session);
  },
};

const customerOf = (customerId: string): Customer => {
  const c = state().customers.get(customerId);
  if (!c) throw new ApiError(404, 'Not found');
  return c;
};
const accountAddresses = (c: Customer): AccountAddress[] => c.addresses.map(({ key: _key, ...a }) => (void _key, a));

export const fixtureAccount = {
  getProfile: async (customerId: string): Promise<AccountProfile> => {
    const c = customerOf(customerId);
    return { firstName: c.firstName, lastName: c.lastName, email: c.email };
  },
  updateProfile: async (customerId: string, input: AccountProfileInput): Promise<AccountProfile> => {
    const c = customerOf(customerId);
    if ([...state().customers.entries()].some(([id, other]) => id !== customerId && other.email === input.email)) throw new ApiError(409, 'That email is already in use.', 'EMAIL_IN_USE');
    Object.assign(c, { firstName: input.firstName, lastName: input.lastName, email: input.email });
    return { firstName: c.firstName, lastName: c.lastName, email: c.email };
  },
  changePassword: async (customerId: string, currentPassword: string, newPassword: string): Promise<void> => {
    const c = customerOf(customerId);
    if (currentPassword !== c.password) throw new ApiError(400, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    c.password = newPassword;
  },
  listAddresses: async (customerId: string): Promise<AccountAddress[]> => accountAddresses(customerOf(customerId)),
  addAddress: async (customerId: string, input: AccountAddressInput): Promise<AccountAddress[]> => {
    const c = customerOf(customerId);
    if (input.makeDefault || c.addresses.length === 0) for (const a of c.addresses) a.isDefault = false;
    c.addresses.push({ key: nextId('k'), id: nextId('paddr'), streetName: input.streetName, ...(input.streetNumber ? { streetNumber: input.streetNumber } : {}), postalCode: input.postalCode, city: input.city, country: input.country, isDefault: Boolean(input.makeDefault) || c.addresses.length === 0 });
    return accountAddresses(c);
  },
  removeAddress: async (customerId: string, addressId: string): Promise<AccountAddress[]> => {
    const c = customerOf(customerId);
    if (!c.addresses.some((a) => a.id === addressId)) throw new ApiError(404, 'Not found');
    c.addresses = c.addresses.filter((a) => a.id !== addressId);
    return accountAddresses(c);
  },
  setDefaultAddress: async (customerId: string, addressId: string): Promise<AccountAddress[]> => {
    const c = customerOf(customerId);
    if (!c.addresses.some((a) => a.id === addressId)) throw new ApiError(404, 'Not found');
    for (const a of c.addresses) a.isDefault = a.id === addressId;
    return accountAddresses(c);
  },
  listUnits: async (customerId: string): Promise<AccountUnitRow[]> => {
    const role = FIXTURE_USERS.find((u) => u.id === customerId)?.role;
    const units = await fixturePorts.listUnits({ customerId });
    return units.map((u) => ({ key: u.key, name: u.name, type: u.kind, roles: role ? [roleName(role === 'admin' ? 'mau-role-admin' : 'mau-role-buyer')] : [], storeName: u.stores.map((s) => s.name).join(', '), storeMode: u.stores[0]?.mode ?? 'Explicit' }));
  },
  /** An invitation token: sets the password and confirms the email. False for an unknown token (it is single use). */
  acceptInvite: async (token: string, password: string): Promise<boolean> => {
    const customerId = state().invites.get(token);
    if (!customerId) return false;
    const c = customerOf(customerId);
    c.password = password;
    c.verified = true;
    state().invites.delete(token);
    return true;
  },
};
