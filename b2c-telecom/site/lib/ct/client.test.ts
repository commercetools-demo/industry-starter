// @vitest-environment node
const calls = vi.hoisted(() => ({
  builds: 0,
  flow: undefined as unknown,
  http: undefined as unknown,
  projectKey: undefined as unknown,
}));

vi.mock('@commercetools/ts-client', () => {
  class ClientBuilder {
    withProjectKey(key: string) {
      calls.projectKey = key;
      return this;
    }
    withClientCredentialsFlow(options: unknown) {
      calls.flow = options;
      return this;
    }
    withHttpMiddleware(options: unknown) {
      calls.http = options;
      return this;
    }
    build() {
      calls.builds += 1;
      return { marker: 'client' };
    }
  }
  return { ClientBuilder };
});

vi.mock('@commercetools/platform-sdk', () => ({
  createApiBuilderFromCtpClient: vi.fn(() => ({
    withProjectKey: vi.fn(({ projectKey }: { projectKey: string }) => ({ root: true, projectKey })),
  })),
}));

const ENV = {
  CTP_PROJECT_KEY: 'spec-test-b2c-telecom',
  CTP_AUTH_URL: 'https://auth.example',
  CTP_API_URL: 'https://api.example',
  CTP_CLIENT_ID: 'the-id',
  CTP_CLIENT_SECRET: 'the-secret-value',
  CTP_SCOPES: 'view_products:p manage_orders:p  view_types:p',
  SESSION_SECRET: 'a'.repeat(32),
};

beforeEach(() => {
  vi.resetModules();
  calls.builds = 0;
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getApiRoot', () => {
  it('builds nothing at import time', async () => {
    await import('./client');
    expect(calls.builds).toBe(0);
  });

  it('returns the same object and builds the client once', async () => {
    const { getApiRoot } = await import('./client');
    const first = getApiRoot();
    const second = getApiRoot();
    expect(second).toBe(first);
    expect(calls.builds).toBe(1);
    expect(calls.projectKey).toBe('spec-test-b2c-telecom');
    expect(calls.http).toEqual({ host: 'https://api.example' });
  });

  it('splits the scopes on spaces', async () => {
    const { getApiRoot } = await import('./client');
    getApiRoot();
    expect(calls.flow).toEqual({
      host: 'https://auth.example',
      projectKey: 'spec-test-b2c-telecom',
      credentials: { clientId: 'the-id', clientSecret: 'the-secret-value' },
      scopes: ['view_products:p', 'manage_orders:p', 'view_types:p'],
    });
  });

  it('throws the named error when the environment is incomplete', async () => {
    vi.stubEnv('CTP_CLIENT_SECRET', '');
    const { getApiRoot } = await import('./client');
    expect(() => getApiRoot()).toThrow('Missing environment variable: CTP_CLIENT_SECRET');
  });

  it('exposes project key and urls', async () => {
    const { getProjectKey, getApiUrl, getAuthUrl } = await import('./client');
    expect(getProjectKey()).toBe('spec-test-b2c-telecom');
    expect(getApiUrl()).toBe('https://api.example');
    expect(getAuthUrl()).toBe('https://auth.example');
  });
});
