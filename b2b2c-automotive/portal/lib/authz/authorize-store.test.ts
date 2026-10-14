import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/types';

const getAssociateRoles = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles }));

import { authorizeStore } from './authorize-store';
import { requireOwnership } from './ownership';

const session: Session = { customerId: 'c1', businessUnitKey: 'bu-a', storeKey: 'store-a' };
const roles = (r: ('admin' | 'buyer')[]) => getAssociateRoles.mockResolvedValue({ roleKeys: [], roles: r, ctPermissions: [] });

beforeEach(() => {
  getAssociateRoles.mockReset();
});

describe('authorizeStore', () => {
  it('rejects a store of another reseller before any commercetools call', async () => {
    await expect(authorizeStore(session, 'store-b', 'price.edit')).rejects.toMatchObject({ status: 403 });
    expect(getAssociateRoles).not.toHaveBeenCalled();
  });

  it('rejects a session without a business unit before any commercetools call', async () => {
    await expect(authorizeStore({ customerId: 'c1' }, 'store-a', 'price.edit')).rejects.toMatchObject({ status: 403 });
    expect(getAssociateRoles).not.toHaveBeenCalled();
  });

  it('rejects when role cannot perform the action', async () => {
    roles(['buyer']);
    await expect(authorizeStore(session, 'store-a', 'price.edit')).rejects.toMatchObject({ status: 403 });
  });

  it('accepts own store for an allowed role', async () => {
    roles(['admin']);
    await expect(authorizeStore(session, 'store-a', 'price.edit')).resolves.toBeUndefined();
    roles(['buyer']);
    await expect(authorizeStore(session, 'store-a', 'catalog.view')).resolves.toBeUndefined();
  });

  it('ownership: a foreign business unit or store is not found', async () => {
    await expect(requireOwnership(session, { businessUnitKey: 'bu-b' })).rejects.toMatchObject({ status: 404 });
    await expect(requireOwnership(session, { storeKey: 'store-b' })).rejects.toMatchObject({ status: 404 });
    await expect(requireOwnership(session, { businessUnitKey: 'bu-a', storeKey: 'store-a' })).resolves.toBeUndefined();
  });
});
