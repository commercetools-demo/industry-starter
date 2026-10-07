import { pollUntil } from './pollUntil';

describe('pollUntil', () => {
  it('resolves on the 3rd attempt and sleeps only between attempts', async () => {
    const check = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(pollUntil(check, { intervalMs: 30000, attempts: 40, sleep })).resolves.toBe(3);
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(30000);
  });

  it('never sleeps after success', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    await pollUntil(async () => true, { intervalMs: 10, attempts: 5, sleep });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rejects after the attempt limit without a trailing sleep', async () => {
    const check = vi.fn().mockResolvedValue(false);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(pollUntil(check, { intervalMs: 10, attempts: 3, sleep })).rejects.toThrow('Not ready after 3 attempts');
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('a throwing check counts as a failed attempt', async () => {
    const check = vi.fn().mockRejectedValueOnce(new Error('index not ready')).mockResolvedValueOnce(true);
    await expect(pollUntil(check, { intervalMs: 1, attempts: 3, sleep: async () => undefined })).resolves.toBe(2);
  });
});
