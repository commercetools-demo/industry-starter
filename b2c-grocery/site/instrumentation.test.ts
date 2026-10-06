// @vitest-environment node
import { register } from './instrumentation';

describe('register', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in production when a variable is missing', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CTP_PROJECT_KEY', '');
    await expect(register()).rejects.toThrow(/Missing environment variable/);
  });

  it('is silent in development and test', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CTP_PROJECT_KEY', '');
    await expect(register()).resolves.toBeUndefined();
  });
});
