// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Obj = Record<string, unknown>;
let unit: Obj;
let customers: Obj[];
const unitPosts: { version: number; actions: Obj[] }[] = [];
const customerPosts: Obj[] = [];
const customerDeletes: Obj[] = [];
const tokenPosts: Obj[] = [];
let associateError: unknown;
let duplicateEmail = false;

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    asAssociate: () => ({
      withAssociateIdValue: () => ({
        businessUnits: () => ({
          withKey: () => ({
            get: () => ({ execute: async () => ({ body: structuredClone(unit) }) }),
            post: ({ body }: { body: { version: number; actions: Obj[] } }) => ({
              execute: async () => {
                unitPosts.push(body);
                if (associateError) throw associateError;
                return { body: { ...structuredClone(unit), version: (unit.version as number) + 1 } };
              },
            }),
          }),
        }),
      }),
    }),
    customers: () => ({
      get: () => ({ execute: async () => ({ body: { results: customers } }) }),
      post: ({ body }: { body: Obj }) => ({
        execute: async () => {
          customerPosts.push(body);
          if (duplicateEmail) throw { statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } };
          return { body: { customer: { id: 'cust-new', version: 1, email: body.email, firstName: body.firstName, lastName: body.lastName, isEmailVerified: false } } };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({ delete: () => ({ execute: async () => void customerDeletes.push({ ID }) }) }),
      passwordToken: () => ({ post: ({ body }: { body: Obj }) => ({ execute: async () => (tokenPosts.push(body), { body: { value: 'one-time-token' } }) }) }),
    }),
    stores: () => ({ withKey: () => ({ get: () => ({ execute: async () => ({ body: { name: { 'de-DE': 'Küstenwerk', 'en-US': 'Coast Works' }, custom: { fields: { defaultCountry: 'DE', currency: 'EUR' } } } }) }) }) }),
  },
}));

import { addAddress, buildAddAddressActions, getProfile, inviteUser, listAddresses, listRoles, listUsers, mapAddresses, setDefaultAddress, toInviteResult, updateProfile, type CompanySession } from './company';

const session: CompanySession = { customerId: 'cust-admin', businessUnitKey: 'bu-a', storeKey: 'store-a' };
const role = (key: string) => [{ associateRole: { typeId: 'associate-role', key }, inheritance: 'Disabled' }];

beforeEach(() => {
  unit = {
    key: 'bu-a',
    version: 5,
    name: 'Test Garage',
    contactEmail: 'office@example.com',
    custom: { fields: { kind: 'reseller' } },
    associates: [
      { customer: { id: 'cust-admin' }, associateRoleAssignments: role('mau-role-admin') },
      { customer: { id: 'cust-buyer' }, associateRoleAssignments: role('mau-role-buyer') },
    ],
    addresses: [
      { id: 'a1', streetName: 'Hafenallee', streetNumber: '12', postalCode: '21079', city: 'Hamburg', country: 'DE', additionalAddressInfo: 'Main workshop' },
      { id: 'a2', streetName: 'Postfach', postalCode: '21079', city: 'Hamburg', country: 'DE', additionalAddressInfo: 'Accounts' },
      { id: 'a3', streetName: 'Depot', postalCode: '10115', city: 'Berlin', country: 'DE', additionalAddressInfo: 'Depot' },
    ],
    shippingAddressIds: ['a1', 'a3'],
    billingAddressIds: ['a1', 'a2'],
    defaultShippingAddressId: 'a1',
    defaultBillingAddressId: 'a1',
  };
  customers = [
    { id: 'cust-admin', firstName: 'Alex', lastName: 'Admin', email: 'alex@example.com', isEmailVerified: true, custom: { fields: { lastActiveAt: '2026-10-11T09:30:00.000Z' } } },
    { id: 'cust-buyer', firstName: 'Bea', lastName: 'Buyer', email: 'bea@example.com', isEmailVerified: false },
  ];
  unitPosts.length = 0;
  customerPosts.length = 0;
  customerDeletes.length = 0;
  tokenPosts.length = 0;
  associateError = undefined;
  duplicateEmail = false;
});

const INVITE = { email: 'qa-u-1@example.com', firstName: 'Quinn', lastName: 'Tester', roleKey: 'mau-role-buyer' as const };

describe('users', () => {
  it('Invited when isEmailVerified false, lastActive dash (null) when the field is absent', async () => {
    const users = await listUsers(session);
    expect(users.find((u) => u.customerId === 'cust-buyer')).toMatchObject({ status: 'Invited', lastActive: null, role: 'Buyer', roleKey: 'mau-role-buyer' });
    expect(users.find((u) => u.customerId === 'cust-admin')).toMatchObject({ status: 'Active', lastActive: '2026-10-11T09:30:00.000Z', role: 'Admin', name: 'Alex Admin' });
  });
  it('roles offered are exactly Admin and Buyer', () => {
    expect(listRoles()).toEqual([{ key: 'mau-role-admin', name: 'Admin' }, { key: 'mau-role-buyer', name: 'Buyer' }]);
  });
});

describe('invite', () => {
  it('customer created, associate added, link returned once and nothing sent or stored', async () => {
    const { token, user } = await inviteUser(session, INVITE);
    expect(token).toBe('one-time-token');
    expect(customerPosts[0]).toMatchObject({ email: 'qa-u-1@example.com', firstName: 'Quinn', lastName: 'Tester', isEmailVerified: false });
    expect(String(customerPosts[0].password).length).toBeGreaterThanOrEqual(24);
    expect(unitPosts[0].actions).toEqual([{ action: 'addAssociate', associate: { customer: { typeId: 'customer', id: 'cust-new' }, associateRoleAssignments: role('mau-role-buyer') } }]);
    expect(tokenPosts[0]).toEqual({ email: 'qa-u-1@example.com', ttlMinutes: 4320 });
    expect(user).toMatchObject({ status: 'Invited', email: 'qa-u-1@example.com' });
    expect(toInviteResult(token, user, 'de-DE').invitePath).toBe('/de-DE/accept-invite/one-time-token');
    // no mail: nothing in the module talks to a mailer
    const source = readFileSync(new URL('./company.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/nodemailer|sendgrid|mailgun|\bses\b|sendMail|console\./i);
  });

  it('associate failure deletes the just-created customer', async () => {
    associateError = { statusCode: 500 };
    await expect(inviteUser(session, INVITE)).rejects.toBeDefined();
    expect(customerDeletes).toEqual([{ ID: 'cust-new' }]);
    expect(tokenPosts).toHaveLength(0);
  });

  it('a role other than mau-role-admin or mau-role-buyer is refused (the sample approver role too), nothing is created', async () => {
    for (const roleKey of ['approver', 'mau-role-approver', 'mau-role-malva']) {
      await expect(inviteUser(session, { ...INVITE, roleKey: roleKey as never })).rejects.toMatchObject({ status: 400 });
    }
    expect(customerPosts).toHaveLength(0);
  });

  it('a duplicate email is a 409 EMAIL_IN_USE and no associate is added', async () => {
    duplicateEmail = true;
    await expect(inviteUser(session, INVITE)).rejects.toMatchObject({ status: 409, code: 'EMAIL_IN_USE' });
    expect(unitPosts).toHaveLength(0);
  });

  it('Admin role can be invited', async () => {
    await inviteUser(session, { ...INVITE, roleKey: 'mau-role-admin' });
    expect((unitPosts[0].actions[0] as { associate: { associateRoleAssignments: unknown } }).associate.associateRoleAssignments).toEqual(role('mau-role-admin'));
  });
});

describe('addresses', () => {
  it('type labels: Delivery, Delivery & billing, Billing; default marker', async () => {
    const rows = await listAddresses(session);
    expect(rows.map((r) => [r.id, r.type, r.isDefault, r.label])).toEqual([
      ['a1', 'Delivery & billing', true, 'Main workshop'],
      ['a2', 'Billing', false, 'Accounts'],
      ['a3', 'Delivery', false, 'Depot'],
    ]);
    expect(mapAddresses(unit as never)).toHaveLength(3);
  });

  it('default sets both default fields when delivery and billing', async () => {
    await setDefaultAddress(session, 'a1');
    expect(unitPosts[0].actions).toEqual([{ action: 'setDefaultShippingAddress', addressId: 'a1' }, { action: 'setDefaultBillingAddress', addressId: 'a1' }]);
  });

  it('a delivery-only address sets only the shipping default, a billing-only address only the billing default', async () => {
    await setDefaultAddress(session, 'a3');
    expect(unitPosts[0].actions).toEqual([{ action: 'setDefaultShippingAddress', addressId: 'a3' }]);
    await setDefaultAddress(session, 'a2');
    expect(unitPosts[1].actions).toEqual([{ action: 'setDefaultBillingAddress', addressId: 'a2' }]);
  });

  it('an address that is not in the unit is a 404 and nothing is written', async () => {
    await expect(setDefaultAddress(session, 'foreign')).rejects.toMatchObject({ status: 404 });
    expect(unitPosts).toHaveLength(0);
  });

  it('add: label in additionalAddressInfo, one update with the list and default actions by key', async () => {
    await addAddress(session, { label: 'Test Depot', streetName: 'Depotweg', postalCode: '20095', city: 'Hamburg', country: 'DE', type: 'Delivery & billing', makeDefault: true });
    const actions = unitPosts[0].actions;
    expect(actions.map((a) => a.action)).toEqual(['addAddress', 'addShippingAddressId', 'addBillingAddressId', 'setDefaultShippingAddress', 'setDefaultBillingAddress']);
    expect((actions[0] as { address: Obj }).address).toMatchObject({ additionalAddressInfo: 'Test Depot', country: 'DE' });
    const key = (actions[0] as { address: { key: string } }).address.key;
    expect(actions.slice(1).every((a) => (a as { addressKey: string }).addressKey === key)).toBe(true);
  });

  it('Billing only is not a shipping address and Delivery only is not a billing address', () => {
    const base = { label: 'L', streetName: 'Street', postalCode: '1234', city: 'City', country: 'DE', makeDefault: false };
    expect(buildAddAddressActions({ ...base, type: 'Billing' }, 'k').map((a) => a.action)).toEqual(['addAddress', 'addBillingAddressId']);
    expect(buildAddAddressActions({ ...base, type: 'Delivery' }, 'k').map((a) => a.action)).toEqual(['addAddress', 'addShippingAddressId']);
  });
});

describe('profile', () => {
  it('reads the unit and the store, nothing about tax id, account number, credit limit or terms', async () => {
    const profile = await getProfile(session);
    expect(profile).toEqual({ name: 'Test Garage', contactEmail: 'office@example.com', kind: 'reseller', storeKey: 'store-a', storeName: 'Coast Works', region: 'DE', currency: 'EUR' });
    expect(Object.keys(profile).join(' ')).not.toMatch(/tax|account|credit|terms/i);
  });
  it('edits only the name and the contact email', async () => {
    await updateProfile(session, { name: 'New Name GmbH', contactEmail: 'new@example.com' });
    expect(unitPosts[0].actions).toEqual([{ action: 'changeName', name: 'New Name GmbH' }, { action: 'setContactEmail', contactEmail: 'new@example.com' }]);
  });
});

describe('boundary', () => {
  it('company chain never imports admin client', () => {
    for (const file of ['./company.ts', './account.ts']) expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/admin-client|adminRoot/);
  });
});
