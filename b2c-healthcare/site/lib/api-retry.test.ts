// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { withCartRetry } from './api-retry';

describe('storefront-data-loading: Concurrent cart update', () => {
  it('409 then success: the function (which refetches) runs twice and the result is returned', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ statusCode: 409 }).mockResolvedValueOnce('ok');
    await expect(withCartRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries once only: a second 409 is propagated', async () => {
    const fn = vi.fn().mockRejectedValue({ statusCode: 409 });
    await expect(withCartRetry(fn)).rejects.toMatchObject({ statusCode: 409 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('other errors are not retried', async () => {
    const fn = vi.fn().mockRejectedValue({ statusCode: 400 });
    await expect(withCartRetry(fn)).rejects.toMatchObject({ statusCode: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('success needs no retry; plain Error and status field are handled', async () => {
    const ok = vi.fn().mockResolvedValue(1);
    await expect(withCartRetry(ok)).resolves.toBe(1);
    expect(ok).toHaveBeenCalledTimes(1);
    const boom = vi.fn().mockRejectedValue(new Error('x'));
    await expect(withCartRetry(boom)).rejects.toThrow('x');
    expect(boom).toHaveBeenCalledTimes(1);
    const viaStatus = vi.fn().mockRejectedValueOnce({ status: 409 }).mockResolvedValueOnce(2);
    await expect(withCartRetry(viaStatus)).resolves.toBe(2);
  });
});
