// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CUSTOMER_GROUPS_TTL } from '@/lib/config/cache';

const execute = vi.fn();
const get = vi.fn<(args: unknown) => { execute: typeof execute }>(() => ({ execute }));
const unstableCache = vi.fn<(fn: () => Promise<unknown>, keys: string[], options: object) => () => Promise<unknown>>((fn) => fn);
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: object) => unstableCache(fn, keys, options) }));
vi.mock('./client', () => ({ getApiRoot: () => ({ customerGroups: () => ({ get }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

import { getCustomerGroupKeys } from './customer-groups';

describe('getCustomerGroupKeys', () => {
  it('maps group ids to keys (groups without a key are skipped) through unstable_cache with CUSTOMER_GROUPS_TTL', async () => {
    execute.mockResolvedValue({ body: { results: [{ id: 'g1', key: 'employee' }, { id: 'g2', key: 'existing-customer' }, { id: 'g3' }] } });
    expect(await getCustomerGroupKeys()).toEqual({ g1: 'employee', g2: 'existing-customer' });
    expect(get).toHaveBeenCalledWith({ queryArgs: { limit: 100 } });
    expect(unstableCache.mock.calls[0][2]).toMatchObject({ revalidate: CUSTOMER_GROUPS_TTL });
  });

  it('does not import the session module (cached functions are shared between buyers)', () => {
    const source = readFileSync(path.join(__dirname, 'customer-groups.ts'), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*session['"]/);
  });
});
