import { PanelTimeoutError, PANEL_TIMEOUT_MS, withTimeout } from './with-timeout';

afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
  it('passes the value of a promise that settles in time', async () => {
    await expect(withTimeout(Promise.resolve(7))).resolves.toBe(7);
  });

  it('passes the rejection of a promise that fails in time', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });

  it('rejects with PanelTimeoutError after the panel timeout (4000 ms)', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => undefined));
    const assertion = expect(pending).rejects.toBeInstanceOf(PanelTimeoutError);
    await vi.advanceTimersByTimeAsync(PANEL_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(PANEL_TIMEOUT_MS).toBe(4000);
  });

  it('clears its timer when the promise settles', async () => {
    vi.useFakeTimers();
    await withTimeout(Promise.resolve(1));
    expect(vi.getTimerCount()).toBe(0);
  });
});
