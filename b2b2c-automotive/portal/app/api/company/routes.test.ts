// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Role matrix of the Company & team endpoints (workstream U-09): every role reads, only an Admin writes; the unit always comes
// from the session. commercetools modules are mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionFor } from '@/lib/authz/test-helpers';
import type { LogicalRole, Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

let session: Session = sessionFor('adminA');
let roles: LogicalRole[] = ['admin'];
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session, devFixturesEnabled: () => false }));
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles: async () => ({ roleKeys: [], roles, ctPermissions: [] }) }));

const user = { customerId: 'c-new', name: 'Quinn Tester', email: 'qa-u-1@example.com', role: 'Buyer', roleKey: 'mau-role-buyer', status: 'Invited', lastActive: null };
const calls = { listUsers: vi.fn(async (_s: unknown) => [user]), inviteUser: vi.fn(async (_s: unknown, _i: unknown) => ({ token: 'one-time-token', user })), addAddress: vi.fn(async (_s: unknown, _i: unknown) => []), setDefaultAddress: vi.fn(async (_s: unknown, _id: string) => []), updateProfile: vi.fn(async (_s: unknown, _i: unknown) => ({})), getProfile: vi.fn(async (_s: unknown) => ({})), listAddresses: vi.fn(async (_s: unknown) => []) };
vi.mock('@/lib/ct/company', async () => {
  const actual = await vi.importActual<typeof import('@/lib/company/schemas')>('@/lib/company/schemas');
  return {
    listUsers: (s: unknown) => calls.listUsers(s),
    inviteUser: (s: unknown, i: unknown) => calls.inviteUser(s, i),
    toInviteResult: (token: string, u: unknown, locale: string) => ({ invitePath: `/${locale}/accept-invite/${token}`, user: u }),
    addAddress: (s: unknown, i: unknown) => calls.addAddress(s, i),
    setDefaultAddress: (s: unknown, id: string) => calls.setDefaultAddress(s, id),
    updateProfile: (s: unknown, i: unknown) => calls.updateProfile(s, i),
    getProfile: (s: unknown) => calls.getProfile(s),
    listAddresses: (s: unknown) => calls.listAddresses(s),
    listRoles: () => actual.INVITABLE_ROLE_KEYS.map((key) => ({ key, name: key === 'mau-role-admin' ? 'Admin' : 'Buyer' })),
  };
});

import * as addressesRoute from './addresses/route';
import * as defaultRoute from './addresses/default/route';
import * as profileRoute from './profile/route';
import * as rolesRoute from './roles/route';
import * as inviteRoute from './users/invite/route';
import * as usersRoute from './users/route';

const asBuyer = () => {
  session = sessionFor('buyerA');
  roles = ['buyer'];
};
const invite = (extra: Record<string, unknown> = {}) => makeRequest('/api/company/users/invite', { method: 'POST', json: { email: 'qa-u-1@example.com', firstName: 'Quinn', lastName: 'Tester', roleKey: 'mau-role-buyer', ...extra } });

beforeEach(() => {
  session = sessionFor('adminA');
  roles = ['admin'];
  for (const fn of Object.values(calls)) fn.mockClear();
});

describe('reads', () => {
  it('Admin and Buyer both read users, addresses, profile and roles', async () => {
    for (const who of ['admin', 'buyer'] as const) {
      if (who === 'buyer') asBuyer();
      expect((await usersRoute.GET(makeRequest('/api/company/users'))).status).toBe(200);
      expect((await addressesRoute.GET(makeRequest('/api/company/addresses'))).status).toBe(200);
      expect((await profileRoute.GET(makeRequest('/api/company/profile'))).status).toBe(200);
      expect((await rolesRoute.GET(makeRequest('/api/company/roles'))).status).toBe(200);
    }
  });
  it('roles are exactly Admin and Buyer', async () => {
    const body = (await (await rolesRoute.GET(makeRequest('/api/company/roles'))).json()) as { roles: { key: string }[] };
    expect(body.roles.map((r) => r.key)).toEqual(['mau-role-admin', 'mau-role-buyer']);
  });
  it('no session is 401 and nothing is called', async () => {
    session = {};
    expect((await usersRoute.GET(makeRequest('/api/company/users'))).status).toBe(401);
    expect(calls.listUsers).not.toHaveBeenCalled();
  });
});

describe('writes', () => {
  it('Admin invites: 201 with the one-time path, the session unit is passed, nothing from the body names a unit', async () => {
    const res = await inviteRoute.POST(invite());
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ invitePath: '/de-DE/accept-invite/one-time-token', user });
    expect(calls.inviteUser).toHaveBeenCalledWith(expect.objectContaining({ businessUnitKey: 'bu-a', customerId: 'cust-admin-a' }), { email: 'qa-u-1@example.com', firstName: 'Quinn', lastName: 'Tester', roleKey: 'mau-role-buyer' });
  });

  it('Buyer: invite, add address, default and profile edit are 403 (evaluate_script POST returns 403) and nothing is called', async () => {
    asBuyer();
    expect((await inviteRoute.POST(invite())).status).toBe(403);
    expect((await addressesRoute.POST(makeRequest('/api/company/addresses', { method: 'POST', json: { label: 'x', streetName: 'Street', postalCode: '1234', city: 'City', country: 'DE', type: 'Delivery' } }))).status).toBe(403);
    expect((await defaultRoute.POST(makeRequest('/api/company/addresses/default', { method: 'POST', json: { addressId: 'a1' } }))).status).toBe(403);
    expect((await profileRoute.PUT(makeRequest('/api/company/profile', { method: 'PUT', json: { name: 'New Name', contactEmail: 'a@example.com' } }))).status).toBe(403);
    for (const fn of [calls.inviteUser, calls.addAddress, calls.setDefaultAddress, calls.updateProfile]) expect(fn).not.toHaveBeenCalled();
  });

  it('a role other than Admin or Buyer (the sample approver role) is 400 before anything is created', async () => {
    for (const roleKey of ['approver', 'mau-role-approver', '']) expect((await inviteRoute.POST(invite({ roleKey }))).status).toBe(400);
    expect(calls.inviteUser).not.toHaveBeenCalled();
  });

  it('the invite body is strict: no customer id, business unit or extra field', async () => {
    expect((await inviteRoute.POST(invite({ businessUnitKey: 'bu-b' }))).status).toBe(400);
    expect((await inviteRoute.POST(invite({ customerId: 'x' }))).status).toBe(400);
    expect((await inviteRoute.POST(invite({ email: 'not-an-email' }))).status).toBe(400);
  });

  it('address and profile input is validated', async () => {
    expect((await addressesRoute.POST(makeRequest('/api/company/addresses', { method: 'POST', json: { label: '', streetName: 'Street', postalCode: '1234', city: 'City', country: 'DE', type: 'Delivery' } }))).status).toBe(400);
    expect((await addressesRoute.POST(makeRequest('/api/company/addresses', { method: 'POST', json: { label: 'x', streetName: 'Street', postalCode: '1234', city: 'City', country: 'DE', type: 'Pickup' } }))).status).toBe(400);
    expect((await profileRoute.PUT(makeRequest('/api/company/profile', { method: 'PUT', json: { name: 'N', contactEmail: 'a@example.com' } }))).status).toBe(400);
    expect((await profileRoute.PUT(makeRequest('/api/company/profile', { method: 'PUT', json: { name: 'New Name', contactEmail: 'a@example.com', currency: 'USD' } }))).status).toBe(400);
  });

  it('Admin edits the profile and sets the default address', async () => {
    expect((await profileRoute.PUT(makeRequest('/api/company/profile', { method: 'PUT', json: { name: 'New Name', contactEmail: 'A@Example.com' } }))).status).toBe(200);
    expect(calls.updateProfile).toHaveBeenCalledWith(expect.anything(), { name: 'New Name', contactEmail: 'a@example.com' });
    expect((await defaultRoute.POST(makeRequest('/api/company/addresses/default', { method: 'POST', json: { addressId: 'a1' } }))).status).toBe(200);
    expect(calls.setDefaultAddress).toHaveBeenCalledWith(expect.anything(), 'a1');
  });
});
