// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSession } from '../session-core';

const units = vi.fn();
const store = vi.fn();
vi.mock('./client', () => ({ apiRoot: { businessUnits: () => ({ get: () => ({ execute: () => units() }) }) } }));
vi.mock('./stores', () => ({ getStoreChannelData: (k: string) => store(k), getDefaultStore: () => store('mpw-web') }));
const { getBusinessUnitsForAssociate, selectBusinessUnit, signInSessionPatch } = await import('./business-units');

const unit = (key: string, storeKey?: string) => ({ key, name: key, unitType: 'Company', status: 'Active', stores: storeKey ? [{ typeId: 'store', key: storeKey }] : [] });
const customer = { id: 'c1', email: 'a@b.co', firstName: 'A', lastName: 'B' };
beforeEach(() => { units.mockReset(); store.mockReset(); store.mockImplementation(async (k: string) => ({ storeKey: k, storeId: `id-${k}`, productSelectionId: 'ps' })); });

describe('malva-business-unit-context › Business Unit discovery at sign-in', () => {
  it('Customer with no Business Unit', async () => {
    units.mockResolvedValue({ body: { results: [] } });
    const s = await signInSessionPatch(defaultSession(), customer);
    expect(s).toMatchObject({ customerId: 'c1', customerEmail: 'a@b.co' });
    expect(s.businessUnitKey).toBeUndefined();
  });
  it('one unit: customer, unit and its store in one update', async () => {
    units.mockResolvedValue({ body: { results: [unit('co', 'mpw-web')] } });
    expect(await signInSessionPatch(defaultSession(), customer)).toMatchObject({ businessUnitKey: 'co', storeKey: 'mpw-web', storeId: 'id-mpw-web' });
  });
  it('unit without a store falls back to the default store', async () => {
    units.mockResolvedValue({ body: { results: [unit('co')] } });
    expect((await signInSessionPatch(defaultSession(), customer)).storeKey).toBe('mpw-web');
  });
  it('Several Business Units: first selected, list available, selecting rewrites atomically', async () => {
    units.mockResolvedValue({ body: { results: [unit('a', 'mpw-web'), unit('b', 'other')] } });
    const s = await signInSessionPatch(defaultSession(), customer);
    expect(s.businessUnitKey).toBe('a');
    expect((await getBusinessUnitsForAssociate('c1')).map((u) => u.key)).toEqual(['a', 'b']);
    expect(await selectBusinessUnit({ ...s, customerId: 'c1' }, 'b')).toMatchObject({ businessUnitKey: 'b', storeKey: 'other', storeId: 'id-other' });
    expect(await selectBusinessUnit({ ...s, customerId: 'c1' }, 'zzz')).toBeNull();
  });
  it('No partial state: a failing store lookup throws and leaves the input session untouched', async () => {
    units.mockResolvedValue({ body: { results: [unit('co', 'mpw-web')] } });
    store.mockRejectedValue(new Error('down'));
    const before = defaultSession();
    await expect(signInSessionPatch(before, customer)).rejects.toThrow('down');
    expect(before).toEqual(defaultSession());
  });
});
