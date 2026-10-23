import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { updateWithRetry } from '@/lib/ct/retry';

function fakeStore() {
  const store = { version: 1, data: 0 };
  return {
    store,
    read: vi.fn(async () => ({ version: store.version, data: store.data })),
    write: vi.fn(async (current: { version: number; data: number }) => {
      if (current.version !== store.version) throw Object.assign(new Error('conflict'), { statusCode: 409 });
      store.version += 1;
      store.data += 1;
      return store.data;
    }),
  };
}

describe('updateWithRetry', () => {
  it('Success on the first try reads once', async () => {
    const f = fakeStore();
    await updateWithRetry(f.read, f.write);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.write).toHaveBeenCalledTimes(1);
  });

  it('Double click: a stale version is re-read and applied once, not twice', async () => {
    const f = fakeStore();
    let first = true;
    const read = vi.fn(async () => {
      const snap = await f.read();
      if (first) {
        first = false;
        f.store.version += 1; // another request wins between our read and our write
      }
      return snap;
    });
    await updateWithRetry(read, f.write);
    expect(read).toHaveBeenCalledTimes(2);
    expect(f.store.data).toBe(1);
  });

  it('A second 409 surfaces as conflict', async () => {
    const write = vi.fn(async () => {
      throw { statusCode: 409 };
    });
    const read = vi.fn(async () => ({ version: 1 }));
    const err = await updateWithRetry(read, write).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'conflict', status: 409 });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('A non-409 error is rethrown unchanged and not retried', async () => {
    const boom = new Error('boom');
    const write = vi.fn(async () => {
      throw boom;
    });
    await expect(updateWithRetry(async () => ({ version: 1 }), write)).rejects.toBe(boom);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
