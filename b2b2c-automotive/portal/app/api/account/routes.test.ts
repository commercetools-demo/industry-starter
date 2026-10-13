// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Account settings endpoints (workstream U-10): self service only. The customer is always the session's, whatever the body says.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { sessionFor } from '@/lib/authz/test-helpers';
import type { LogicalRole, Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

let session: Session = sessionFor('buyerA');
let roles: LogicalRole[] = ['buyer'];
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session, devFixturesEnabled: () => false }));
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles: async () => ({ roleKeys: [], roles, ctPermissions: [] }) }));

const account = {
  updateAccountProfile: vi.fn(async (_id: string, _i: unknown) => ({ firstName: 'A', lastName: 'B', email: 'a@example.com' })),
  getAccountProfile: vi.fn(async (_id: string) => ({ firstName: 'A', lastName: 'B', email: 'a@example.com' })),
  changePassword: vi.fn(async (_id: string, _c: string, _n: string) => undefined),
  addAccountAddress: vi.fn(async (_id: string, _i: unknown) => []),
  listAccountAddresses: vi.fn(async (_id: string) => []),
  removeAccountAddress: vi.fn(async (_id: string, _a: string) => []),
  setDefaultAccountAddress: vi.fn(async (_id: string, _a: string) => []),
  listAccountUnits: vi.fn(async (_id: string) => []),
  acceptInvite: vi.fn(async (_t: string, _p: string) => undefined),
};
vi.mock('@/lib/ct/account', () => ({
  updateAccountProfile: (...a: [string, unknown]) => account.updateAccountProfile(...a),
  getAccountProfile: (id: string) => account.getAccountProfile(id),
  changePassword: (...a: [string, string, string]) => account.changePassword(...a),
  addAccountAddress: (...a: [string, unknown]) => account.addAccountAddress(...a),
  listAccountAddresses: (id: string) => account.listAccountAddresses(id),
  removeAccountAddress: (...a: [string, string]) => account.removeAccountAddress(...a),
  setDefaultAccountAddress: (...a: [string, string]) => account.setDefaultAccountAddress(...a),
  listAccountUnits: (id: string) => account.listAccountUnits(id),
  acceptInvite: (...a: [string, string]) => account.acceptInvite(...a),
}));

import * as acceptRoute from '../auth/accept-invite/route';
import * as addressesRoute from './addresses/route';
import * as addressRoute from './addresses/[id]/route';
import * as defaultRoute from './addresses/[id]/default/route';
import * as unitsRoute from './business-units/route';
import * as passwordRoute from './password/route';
import * as profileRoute from './profile/route';

beforeEach(() => {
  session = sessionFor('buyerA');
  roles = ['buyer'];
  for (const fn of Object.values(account)) fn.mockClear();
});

describe('self service for every role', () => {
  it('a Buyer edits their own profile; a customer id in the body is refused and never used', async () => {
    const res = await profileRoute.PUT(makeRequest('/api/account/profile', { method: 'PUT', json: { firstName: 'A', lastName: 'B', email: 'A@Example.com' } }));
    expect(res.status).toBe(200);
    expect(account.updateAccountProfile).toHaveBeenCalledWith('cust-buyer-a', { firstName: 'A', lastName: 'B', email: 'a@example.com' });
    const spoof = await profileRoute.PUT(makeRequest('/api/account/profile', { method: 'PUT', json: { customerId: 'cust-admin-b', firstName: 'A', lastName: 'B', email: 'a@example.com' } }));
    expect(spoof.status).toBe(400);
    expect(account.updateAccountProfile).toHaveBeenCalledTimes(1);
  });

  it('a duplicate email is a 409 with the message', async () => {
    account.updateAccountProfile.mockRejectedValueOnce(new ApiError(409, 'That email is already in use.', 'EMAIL_IN_USE'));
    const res = await profileRoute.PUT(makeRequest('/api/account/profile', { method: 'PUT', json: { firstName: 'A', lastName: 'B', email: 'taken@example.com' } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'That email is already in use.', code: 'EMAIL_IN_USE' });
  });

  it('password: under 12 characters is 400 on the server too; a wrong current password has its message', async () => {
    expect((await passwordRoute.PUT(makeRequest('/api/account/password', { method: 'PUT', json: { currentPassword: 'old', newPassword: 'short' } }))).status).toBe(400);
    expect(account.changePassword).not.toHaveBeenCalled();
    account.changePassword.mockRejectedValueOnce(new ApiError(400, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD'));
    const res = await passwordRoute.PUT(makeRequest('/api/account/password', { method: 'PUT', json: { currentPassword: 'wrong', newPassword: 'dummy-long-enough-password' } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Current password is incorrect.', code: 'INVALID_CURRENT_PASSWORD' });
    expect((await passwordRoute.PUT(makeRequest('/api/account/password', { method: 'PUT', json: { currentPassword: 'old', newPassword: 'dummy-long-enough-password' } }))).status).toBe(200);
    expect(account.changePassword).toHaveBeenLastCalledWith('cust-buyer-a', 'old', 'dummy-long-enough-password');
  });

  it('addresses and business units use the session customer', async () => {
    await addressesRoute.GET(makeRequest('/api/account/addresses'));
    await addressesRoute.POST(makeRequest('/api/account/addresses', { method: 'POST', json: { streetName: 'Street', postalCode: '1234', city: 'City', country: 'DE', makeDefault: true } }));
    await addressRoute.DELETE(makeRequest('/api/account/addresses/p1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'p1' }) });
    await defaultRoute.POST(makeRequest('/api/account/addresses/p1/default', { method: 'POST' }), { params: Promise.resolve({ id: 'p1' }) });
    await unitsRoute.GET(makeRequest('/api/account/business-units'));
    for (const fn of [account.listAccountAddresses, account.addAccountAddress, account.removeAccountAddress, account.setDefaultAccountAddress, account.listAccountUnits]) expect(fn.mock.calls[0][0]).toBe('cust-buyer-a');
  });

  it('no session is 401', async () => {
    session = {};
    expect((await profileRoute.GET(makeRequest('/api/account/profile'))).status).toBe(401);
    expect((await passwordRoute.PUT(makeRequest('/api/account/password', { method: 'PUT', json: { currentPassword: 'a', newPassword: 'dummy-long-enough-password' } }))).status).toBe(401);
  });
});

describe('POST /api/auth/accept-invite', () => {
  it('a valid token sets the password; the response carries nothing', async () => {
    const res = await acceptRoute.POST(makeRequest('/api/auth/accept-invite', { method: 'POST', json: { token: 'the-token', password: 'dummy-long-enough-password' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'accepted' });
    expect(account.acceptInvite).toHaveBeenCalledWith('the-token', 'dummy-long-enough-password');
  });

  it('invalid and expired tokens answer the same error; a short password is refused before the token is touched', async () => {
    account.acceptInvite.mockRejectedValue(new ApiError(400, 'This invitation link is invalid or has expired.', 'INVALID_TOKEN'));
    const a = await acceptRoute.POST(makeRequest('/api/auth/accept-invite', { method: 'POST', json: { token: 'unknown', password: 'dummy-long-enough-password' } }));
    const b = await acceptRoute.POST(makeRequest('/api/auth/accept-invite', { method: 'POST', json: { token: 'expired', password: 'dummy-long-enough-password' } }));
    expect(a.status).toBe(400);
    expect(await a.json()).toEqual(await b.json());
    account.acceptInvite.mockClear();
    expect((await acceptRoute.POST(makeRequest('/api/auth/accept-invite', { method: 'POST', json: { token: 't', password: 'short' } }))).status).toBe(400);
    expect(account.acceptInvite).not.toHaveBeenCalled();
  });
});
