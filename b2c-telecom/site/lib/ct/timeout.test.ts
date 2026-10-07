import { UpstreamTimeoutError, withTimeout } from './timeout';

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves with the value when the promise settles before the limit', async () => {
    const result = withTimeout(new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 100)), 'test', 500);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('ok');
  });

  it('rejects with UpstreamTimeoutError at exactly ms', async () => {
    const result = withTimeout(new Promise<string>(() => undefined), 'catalog.offers', 500);
    const assertion = expect(result).rejects.toMatchObject({ label: 'catalog.offers', ms: 500, message: 'Upstream timeout: catalog.offers after 500 ms' });
    await vi.advanceTimersByTimeAsync(499);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    await expect(result).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it('clears its timer on success and on failure', async () => {
    await withTimeout(Promise.resolve(1), 'a', 500);
    expect(vi.getTimerCount()).toBe(0);
    await expect(withTimeout(Promise.reject(new Error('boom')), 'b', 500)).rejects.toThrow('boom');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses CT_READ_TIMEOUT_MS by default', async () => {
    const result = withTimeout(new Promise<string>(() => undefined), 'x');
    const assertion = expect(result).rejects.toMatchObject({ ms: 8000 });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
  });
});
