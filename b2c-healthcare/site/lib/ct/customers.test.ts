// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { wrapped } = vi.hoisted(() => ({ wrapped: [] as unknown[] }));
vi.mock('react', () => ({
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
    wrapped.push(fn);
    const memo = new Map<string, R>();
    return (...args: A): R => {
      const k = JSON.stringify(args);
      if (!memo.has(k)) memo.set(k, fn(...args));
      return memo.get(k) as R;
    };
  },
}));
const execute = vi.fn();
const withId = vi.fn(() => ({ get: () => ({ execute }) }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { customers: () => ({ withId }) } }));

import { getCustomerById, getCustomerByIdCached } from './customers';

describe('storefront-data-loading: User object source', () => {
  beforeEach(() => {
    execute.mockReset();
    withId.mockClear();
  });

  it('display name comes from one getCustomerById per request', async () => {
    execute.mockResolvedValue({ body: { id: 'c1', firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' } });
    const [a, b] = [await getCustomerByIdCached('c1'), await getCustomerByIdCached('c1')];
    expect(a).toEqual({ id: 'c1', firstName: 'Sam', lastName: 'Rivera' });
    expect(b).toBe(a);
    expect(withId).toHaveBeenCalledTimes(1);
    expect(wrapped).toContain(getCustomerById);
  });

  it('a deleted customer is null', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    expect(await getCustomerById('gone')).toBeNull();
  });
});
