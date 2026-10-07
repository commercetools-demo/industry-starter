import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCall = vi.fn();
const getExecute = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({ customers: () => ({ withId: (id: unknown) => ({ get: () => (getCall(id), { execute: getExecute }) }) }) }),
}));

import { getCustomer } from './customer';

beforeEach(() => {
  vi.clearAllMocks();
  getExecute.mockReset();
});

describe('getCustomer', () => {
  it('returns the customer', async () => {
    getExecute.mockResolvedValue({ body: { id: 'c1', email: 'a@example.com' } });
    expect((await getCustomer('c1'))?.email).toBe('a@example.com');
    expect(getCall).toHaveBeenCalledWith({ ID: 'c1' });
  });

  it('404 is null; other errors propagate', async () => {
    getExecute.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(await getCustomer('gone')).toBeNull();
    getExecute.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    await expect(getCustomer('x')).rejects.toThrow('boom');
  });
});
