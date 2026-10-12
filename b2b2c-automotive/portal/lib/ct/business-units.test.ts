// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import type { BusinessUnit } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ query: vi.fn(), store: vi.fn() }));

vi.mock('@/lib/ct/client', () => ({
  apiRoot: { businessUnits: () => ({ get: (args: unknown) => ({ execute: () => sdk.query(args) }) }) },
}));
vi.mock('@/lib/ct/stores', () => ({ getStoreChannelData: (key: string) => sdk.store(key) }));

const unit = (over: Record<string, unknown>): BusinessUnit =>
  ({
    key: 'mau-bu-north',
    name: 'Küstenwerk Autoteile',
    unitType: 'Division',
    status: 'Active',
    storeMode: 'Explicit',
    stores: [{ typeId: 'store', key: 'mau-store-north' }],
    parentUnit: { typeId: 'business-unit', key: 'mau-bu-malva-dach' },
    associates: [{ customer: { typeId: 'customer', id: 'c1' }, associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: 'mau-role-admin' }, inheritance: 'Disabled' }] }],
    ...over,
  }) as unknown as BusinessUnit;

const storeData = (key: string) => ({ storeKey: key, distributionChannelId: `d-${key}`, supplyChannelId: `s-${key}`, productSelectionId: `p-${key}` });

beforeEach(() => {
  sdk.query.mockReset();
  sdk.store.mockReset();
  sdk.store.mockImplementation(async (key: string) => storeData(key));
});

describe('Associate business units', () => {
  it('Lists the units of the customer with roles and stores', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({})] } });
    const { listAssociateUnits } = await import('./business-units');
    expect(await listAssociateUnits('c1')).toEqual([
      { key: 'mau-bu-north', name: 'Küstenwerk Autoteile', unitType: 'Division', status: 'Active', parentKey: 'mau-bu-malva-dach', storeMode: 'Explicit', storeKeys: ['mau-store-north'], roleKeys: ['mau-role-admin'] },
    ]);
    expect(sdk.query).toHaveBeenCalledWith({ queryArgs: { where: 'associates(customer(id="c1"))', sort: 'key asc', limit: 100 } });
  });

  it('FromParent units use the inherited stores', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({ storeMode: 'FromParent', stores: undefined, inheritedStores: [{ typeId: 'store', key: 'mau-store-parent' }] })] } });
    const { listAssociateUnits } = await import('./business-units');
    const [u] = await listAssociateUnits('c1');
    expect(u.storeMode).toBe('FromParent');
    expect(u.storeKeys).toEqual(['mau-store-parent']);
  });

  it('A customer id with a quote never reaches the predicate', async () => {
    const { listAssociateUnits } = await import('./business-units');
    await expect(listAssociateUnits('c1") or key="x')).rejects.toThrow('Invalid customer id');
    expect(sdk.query).not.toHaveBeenCalled();
  });

  it('Resolves the five session fields in one value', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({})] } });
    const { resolveBusinessContext } = await import('./business-units');
    expect(await resolveBusinessContext({ customerId: 'c1', businessUnitKey: 'mau-bu-north', accountGroupIds: ['g1'] })).toEqual({
      ...storeData('mau-store-north'),
      businessUnitKey: 'mau-bu-north',
      accountGroupIds: ['g1'],
    });
  });

  it('A requested store must belong to the unit', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({ stores: [{ typeId: 'store', key: 's-a' }, { typeId: 'store', key: 's-b' }] })] } });
    const { resolveBusinessContext } = await import('./business-units');
    expect((await resolveBusinessContext({ customerId: 'c1', businessUnitKey: 'mau-bu-north', storeKey: 's-b', accountGroupIds: [] })).storeKey).toBe('s-b');
    expect((await resolveBusinessContext({ customerId: 'c1', businessUnitKey: 'mau-bu-north', storeKey: 'someone-elses', accountGroupIds: [] })).storeKey).toBe('s-a');
  });

  it('A unit the customer does not belong to is refused', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({})] } });
    const { resolveBusinessContext } = await import('./business-units');
    await expect(resolveBusinessContext({ customerId: 'c1', businessUnitKey: 'mau-bu-south', accountGroupIds: [] })).rejects.toThrow('Unit not available');
    expect(sdk.store).not.toHaveBeenCalled();
  });

  it('An inactive unit is refused', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({ status: 'Inactive' })] } });
    const { resolveBusinessContext } = await import('./business-units');
    await expect(resolveBusinessContext({ customerId: 'c1', businessUnitKey: 'mau-bu-north', accountGroupIds: [] })).rejects.toThrow('Unit not available');
  });
});

describe('Sign-in context', () => {
  it('Chooses the first active unit with a store', async () => {
    sdk.query.mockResolvedValue({
      body: { results: [unit({ key: 'a-no-store', stores: [] }), unit({ key: 'b-inactive', status: 'Inactive' }), unit({ key: 'c-ok' }), unit({ key: 'd-ok' })] },
    });
    const { resolveSignInContext } = await import('./business-units');
    const outcome = await resolveSignInContext({ customerId: 'c1', accountGroupIds: [] });
    expect(outcome).toMatchObject({ kind: 'ready', unit: { key: 'c-ok' }, context: { businessUnitKey: 'c-ok' } });
  });

  it('Prefers the last used unit when it qualifies', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({ key: 'c-ok' }), unit({ key: 'd-ok' }), unit({ key: 'e-inactive', status: 'Inactive' })] } });
    const { resolveSignInContext } = await import('./business-units');
    expect(await resolveSignInContext({ customerId: 'c1', accountGroupIds: [], lastUnitKey: 'd-ok' })).toMatchObject({ unit: { key: 'd-ok' } });
    expect(await resolveSignInContext({ customerId: 'c1', accountGroupIds: [], lastUnitKey: 'e-inactive' })).toMatchObject({ unit: { key: 'c-ok' } });
    expect(await resolveSignInContext({ customerId: 'c1', accountGroupIds: [], lastUnitKey: 'unknown' })).toMatchObject({ unit: { key: 'c-ok' } });
  });

  it('All units inactive gives a pending outcome without a context', async () => {
    sdk.query.mockResolvedValue({ body: { results: [unit({ status: 'Inactive', stores: [] })] } });
    const { resolveSignInContext } = await import('./business-units');
    expect(await resolveSignInContext({ customerId: 'c1', accountGroupIds: [] })).toEqual({ kind: 'pending' });
    expect(sdk.store).not.toHaveBeenCalled();
  });

  it('No unit, or only active units without a store, gives none', async () => {
    const { resolveSignInContext } = await import('./business-units');
    sdk.query.mockResolvedValue({ body: { results: [] } });
    expect(await resolveSignInContext({ customerId: 'c1', accountGroupIds: [] })).toEqual({ kind: 'none' });
    sdk.query.mockResolvedValue({ body: { results: [unit({ stores: [] })] } });
    expect(await resolveSignInContext({ customerId: 'c1', accountGroupIds: [] })).toEqual({ kind: 'none' });
  });
});
