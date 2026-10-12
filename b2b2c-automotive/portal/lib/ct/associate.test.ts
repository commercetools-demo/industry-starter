// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ units: {} as Record<string, unknown>, roles: {} as Record<string, string[]>, unitGets: vi.fn(), roleGets: vi.fn(), chain: vi.fn() }));

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    businessUnits: () => ({
      withKey: ({ key }: { key: string }) => ({
        get: () => ({
          execute: async () => {
            sdk.unitGets(key);
            return { body: sdk.units[key] };
          },
        }),
      }),
    }),
    associateRoles: () => ({
      withKey: ({ key }: { key: string }) => ({
        get: () => ({
          execute: async () => {
            sdk.roleGets(key);
            return { body: { key, permissions: sdk.roles[key] } };
          },
        }),
      }),
    }),
    asAssociate: () => ({
      withAssociateIdValue: (a: unknown) => ({
        inBusinessUnitKeyWithBusinessUnitKeyValue: (b: unknown) => {
          sdk.chain(a, b);
          return { carts: () => 'carts-in-unit' };
        },
      }),
    }),
  },
}));

const assignment = (key: string, inheritance: 'Enabled' | 'Disabled' = 'Disabled') => ({ associateRole: { typeId: 'associate-role', key }, inheritance });
const unit = (key: string, assignments: ReturnType<typeof assignment>[], over: Record<string, unknown> = {}) => ({
  key,
  associateMode: 'Explicit',
  associates: [{ customer: { typeId: 'customer', id: 'c1' }, associateRoleAssignments: assignments }],
  ...over,
});

beforeEach(async () => {
  sdk.unitGets.mockReset();
  sdk.roleGets.mockReset();
  sdk.chain.mockReset();
  sdk.units = {};
  sdk.roles = { 'mau-role-admin': ['ViewMyOrders', 'UpdateAssociates'], 'mau-role-buyer': ['ViewMyOrders', 'ViewMyCarts'], 'inherited-role': ['AddChildUnits'] };
  (await import('./associate')).clearRoleCache();
});

describe('As-associate chain', () => {
  it('Builds the as-associate chain from the session', async () => {
    const { asAssociate } = await import('./associate');
    expect(asAssociate({ customerId: 'c1', businessUnitKey: 'mau-bu-north' })).toEqual({ carts: expect.any(Function) });
    expect(sdk.chain).toHaveBeenCalledWith({ associateId: 'c1' }, { businessUnitKey: 'mau-bu-north' });
  });
  it('Needs a customer and a business unit', async () => {
    const { asAssociate } = await import('./associate');
    expect(() => asAssociate({ customerId: 'c1' })).toThrow('asAssociate needs');
    expect(() => asAssociate({ businessUnitKey: 'bu' })).toThrow('asAssociate needs');
  });
});

describe('Permissions in two layers: associate roles', () => {
  it('Admin role gives admin and its permissions', async () => {
    sdk.units['mau-bu-north'] = unit('mau-bu-north', [assignment('mau-role-admin')]);
    const { getAssociateRoles } = await import('./associate');
    expect(await getAssociateRoles({ customerId: 'c1', businessUnitKey: 'mau-bu-north' })).toEqual({
      roleKeys: ['mau-role-admin'],
      roles: ['admin'],
      ctPermissions: ['UpdateAssociates', 'ViewMyOrders'],
    });
  });

  it('Buyer role gives buyer only', async () => {
    sdk.units['mau-bu-north'] = unit('mau-bu-north', [assignment('mau-role-buyer')]);
    const { getAssociateRoles } = await import('./associate');
    const result = await getAssociateRoles({ customerId: 'c1', businessUnitKey: 'mau-bu-north' });
    expect(result.roles).toEqual(['buyer']);
    expect(result.ctPermissions).toEqual(['ViewMyCarts', 'ViewMyOrders']);
  });

  it('Roles are inherited from a parent only with inheritance Enabled and associateMode ExplicitAndFromParent', async () => {
    sdk.units.child = unit('child', [], { associateMode: 'ExplicitAndFromParent', parentUnit: { key: 'parent' } });
    sdk.units.parent = unit('parent', [assignment('inherited-role', 'Enabled'), assignment('mau-role-admin', 'Disabled')]);
    const { roleKeysInUnit } = await import('./associate');
    expect(await roleKeysInUnit('c1', 'child')).toEqual(['inherited-role']);
    sdk.units.child = unit('child', [], { associateMode: 'Explicit', parentUnit: { key: 'parent' } });
    expect(await roleKeysInUnit('c1', 'child')).toEqual([]);
  });

  it('A customer who is not an associate has no roles', async () => {
    sdk.units['mau-bu-north'] = { key: 'mau-bu-north', associateMode: 'Explicit', associates: [{ customer: { id: 'someone-else' }, associateRoleAssignments: [assignment('mau-role-admin')] }] };
    const { getAssociateRoles } = await import('./associate');
    expect(await getAssociateRoles({ customerId: 'c1', businessUnitKey: 'mau-bu-north' })).toEqual({ roleKeys: [], roles: [], ctPermissions: [] });
  });

  it('No session unit means no roles and no calls', async () => {
    const { getAssociateRoles } = await import('./associate');
    expect(await getAssociateRoles({ customerId: 'c1' })).toEqual({ roleKeys: [], roles: [], ctPermissions: [] });
    expect(sdk.unitGets).not.toHaveBeenCalled();
  });

  it('Role definitions are cached', async () => {
    sdk.units['mau-bu-north'] = unit('mau-bu-north', [assignment('mau-role-admin')]);
    const { getAssociateRoles } = await import('./associate');
    await getAssociateRoles({ customerId: 'c1', businessUnitKey: 'mau-bu-north' });
    await getAssociateRoles({ customerId: 'c1', businessUnitKey: 'mau-bu-north' });
    expect(sdk.roleGets).toHaveBeenCalledTimes(1);
  });

  it('Ancestor walk is bounded', async () => {
    sdk.units.loop = unit('loop', [], { associateMode: 'ExplicitAndFromParent', parentUnit: { key: 'loop' } });
    const { roleKeysInUnit } = await import('./associate');
    await roleKeysInUnit('c1', 'loop');
    expect(sdk.unitGets.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
