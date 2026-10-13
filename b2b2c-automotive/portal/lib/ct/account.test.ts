// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Obj = Record<string, unknown>;
let customer: Obj;
const posts: Obj[] = [];
const passwordPosts: Obj[] = [];
const resetPosts: Obj[] = [];
const emailTokenPosts: Obj[] = [];
const confirmPosts: Obj[] = [];
let postError: unknown;
let passwordError: unknown;
let tokenLookupError: unknown;
let resetError: unknown;

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    customers: () => ({
      withId: () => ({
        get: () => ({ execute: async () => ({ body: structuredClone(customer) }) }),
        post: ({ body }: { body: Obj }) => ({
          execute: async () => {
            posts.push(body);
            if (postError) throw postError;
            return { body: { ...structuredClone(customer), version: (customer.version as number) + 1 } };
          },
        }),
      }),
      password: () => ({
        post: ({ body }: { body: Obj }) => ({
          execute: async () => {
            passwordPosts.push(body);
            if (passwordError) throw passwordError;
            return { body: {} };
          },
        }),
      }),
      withPasswordToken: () => ({ get: () => ({ execute: async () => (tokenLookupError ? Promise.reject(tokenLookupError) : { body: structuredClone(customer) }) }) }),
      passwordReset: () => ({ post: ({ body }: { body: Obj }) => ({ execute: async () => (resetPosts.push(body), resetError ? Promise.reject(resetError) : { body: {} }) }) }),
      emailToken: () => ({ post: ({ body }: { body: Obj }) => ({ execute: async () => (emailTokenPosts.push(body), { body: { value: 'email-token' } }) }) }),
      emailConfirm: () => ({ post: ({ body }: { body: Obj }) => ({ execute: async () => (confirmPosts.push(body), { body: {} }) }) }),
    }),
  },
}));
vi.mock('@/lib/ct/business-units', () => ({
  listAssociateUnits: async () => [
    { key: 'bu-hh', name: 'Hamburg', unitType: 'Division', status: 'Active', storeMode: 'FromParent', storeKeys: ['store-a'], roleKeys: ['mau-role-admin'] },
    { key: 'bu-be', name: 'Berlin', unitType: 'Division', status: 'Active', storeMode: 'Explicit', storeKeys: ['store-b'], roleKeys: ['mau-role-buyer', 'approver'] },
  ],
}));
vi.mock('@/lib/ct/stores', () => ({ getStoreContext: async (key: string) => ({ name: key === 'store-a' ? 'Coast Works' : 'Workshop Direct' }) }));

import { acceptInvite, addAccountAddress, changePassword, listAccountUnits, mapAccountAddresses, removeAccountAddress, setDefaultAccountAddress, updateAccountProfile } from './account';

beforeEach(() => {
  customer = {
    id: 'cust-1',
    version: 3,
    email: 'alex@example.com',
    firstName: 'Alex',
    lastName: 'Admin',
    isEmailVerified: false,
    addresses: [{ id: 'p1', streetName: 'Hafenallee', postalCode: '21079', city: 'Hamburg', country: 'DE' }],
    defaultShippingAddressId: 'p1',
  };
  for (const list of [posts, passwordPosts, resetPosts, emailTokenPosts, confirmPosts]) list.length = 0;
  postError = passwordError = tokenLookupError = resetError = undefined;
});

describe('general', () => {
  it('only changed fields are updated', async () => {
    await updateAccountProfile('cust-1', { firstName: 'Alex', lastName: 'Adminson', email: 'alex@example.com' });
    expect((posts[0] as { actions: Obj[] }).actions).toEqual([{ action: 'setLastName', lastName: 'Adminson' }]);
  });
  it('a changed email uses changeEmail; a duplicate email answers 409 "That email is already in use."', async () => {
    await updateAccountProfile('cust-1', { firstName: 'Alex', lastName: 'Admin', email: 'new@example.com' });
    expect((posts[0] as { actions: Obj[] }).actions).toEqual([{ action: 'changeEmail', email: 'new@example.com' }]);
    postError = { statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } };
    await expect(updateAccountProfile('cust-1', { firstName: 'Alex', lastName: 'Admin', email: 'taken@example.com' })).rejects.toMatchObject({ status: 409, message: 'That email is already in use.' });
  });
  it('nothing changed means no write', async () => {
    await updateAccountProfile('cust-1', { firstName: 'Alex', lastName: 'Admin', email: 'alex@example.com' });
    expect(posts).toHaveLength(0);
  });
});

describe('security', () => {
  it('uses the password endpoint with the current version', async () => {
    await changePassword('cust-1', 'old-password-1', 'brand-new-password');
    expect(passwordPosts[0]).toEqual({ id: 'cust-1', version: 3, currentPassword: 'old-password-1', newPassword: 'brand-new-password' });
  });
  it('wrong current password answers "Current password is incorrect."', async () => {
    passwordError = { statusCode: 400, body: { errors: [{ code: 'InvalidCurrentPassword' }] } };
    await expect(changePassword('cust-1', 'wrong', 'brand-new-password')).rejects.toMatchObject({ status: 400, message: 'Current password is incorrect.', code: 'INVALID_CURRENT_PASSWORD' });
  });
});

describe('personal addresses', () => {
  it('add with default, remove and default by id', async () => {
    await addAccountAddress('cust-1', { streetName: 'Depotweg', postalCode: '20095', city: 'Hamburg', country: 'DE', makeDefault: true });
    expect((posts[0] as { actions: Obj[] }).actions.map((a) => a.action)).toEqual(['addAddress', 'addShippingAddressId', 'setDefaultShippingAddress']);
    await removeAccountAddress('cust-1', 'p1');
    expect((posts[1] as { actions: Obj[] }).actions).toEqual([{ action: 'removeAddress', addressId: 'p1' }]);
    await setDefaultAccountAddress('cust-1', 'p1');
    expect((posts[2] as { actions: Obj[] }).actions).toEqual([{ action: 'setDefaultShippingAddress', addressId: 'p1' }]);
    await expect(removeAccountAddress('cust-1', 'foreign')).rejects.toMatchObject({ status: 404 });
    expect(mapAccountAddresses(customer as never)).toEqual([{ id: 'p1', streetName: 'Hafenallee', postalCode: '21079', city: 'Hamburg', country: 'DE', isDefault: true }]);
  });
});

describe('business units', () => {
  it('each row shows the role and the store for that unit with how the store is set', async () => {
    const rows = await listAccountUnits('cust-1');
    expect(rows).toEqual([
      { key: 'bu-hh', name: 'Hamburg', type: 'Division', roles: ['Admin'], storeName: 'Coast Works', storeMode: 'FromParent' },
      { key: 'bu-be', name: 'Berlin', type: 'Division', roles: ['Buyer', 'approver'], storeName: 'Workshop Direct', storeMode: 'Explicit' },
    ]);
  });
});

describe('accept invite', () => {
  it('valid token sets the password and confirms the email', async () => {
    await acceptInvite('the-token', 'dummy-long-enough-password');
    expect(resetPosts[0]).toEqual({ tokenValue: 'the-token', newPassword: 'dummy-long-enough-password' });
    expect(emailTokenPosts[0]).toEqual({ id: 'cust-1', version: 3, ttlMinutes: 10 });
    expect(confirmPosts[0]).toEqual({ tokenValue: 'email-token' });
  });
  it('an already verified customer needs no email step', async () => {
    customer.isEmailVerified = true;
    await acceptInvite('the-token', 'dummy-long-enough-password');
    expect(emailTokenPosts).toHaveLength(0);
  });
  it('invalid and expired tokens answer the same error', async () => {
    tokenLookupError = { statusCode: 404 };
    const unknown = await acceptInvite('bad', 'dummy-long-enough-password').catch((e: unknown) => e);
    tokenLookupError = undefined;
    resetError = { statusCode: 400 };
    const expired = await acceptInvite('old', 'dummy-long-enough-password').catch((e: unknown) => e);
    expect(unknown).toMatchObject({ status: 400, message: 'This invitation link is invalid or has expired.', code: 'INVALID_TOKEN' });
    expect(expired).toMatchObject({ status: 400, message: 'This invitation link is invalid or has expired.', code: 'INVALID_TOKEN' });
    expect(emailTokenPosts).toHaveLength(0);
  });
});
