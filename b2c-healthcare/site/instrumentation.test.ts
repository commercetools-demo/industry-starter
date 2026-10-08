import { afterEach, describe, expect, it, vi } from 'vitest';
import { register } from './instrumentation';

describe('storefront-bff-and-session: Single server-side commercetools client', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('Missing configuration: server start fails naming the variable', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('CTP_PROJECT_KEY', '');
    await expect(register()).rejects.toThrow('CTP_PROJECT_KEY');
  });

  it('Missing configuration: does nothing in the test environment', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    await expect(register()).resolves.toBeUndefined();
  });
});
