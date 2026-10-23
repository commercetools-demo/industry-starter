// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getEnv = vi.fn();
vi.mock('@/lib/env', () => ({ getEnv: () => getEnv() }));

import { register } from './instrumentation';

class FakeEnvError extends Error {}

beforeEach(() => {
  getEnv.mockReset();
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Start-up check', () => {
  it('a valid environment starts the server without a message', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await register();
    expect(exit).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('an invalid environment in production names the variable, prints no stack and exits with 1 (the server does not stay up answering 500)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getEnv.mockImplementation(() => {
      throw new FakeEnvError('SESSION_SECRET must be at least 32 characters');
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await register();
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toBe('SESSION_SECRET must be at least 32 characters');
  });

  it('an invalid environment in development is thrown, so the overlay shows it and a fixed .env.local is picked up without a restart', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    getEnv.mockImplementation(() => {
      throw new FakeEnvError('CTP_PROJECT_KEY is required');
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await expect(register()).rejects.toThrow('CTP_PROJECT_KEY is required');
    expect(exit).not.toHaveBeenCalled();
  });

  it('the edge runtime does nothing', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    getEnv.mockImplementation(() => {
      throw new FakeEnvError('never read');
    });
    await expect(register()).resolves.toBeUndefined();
  });
});
