// @vitest-environment node
const build = vi.fn(() => ({ fake: 'client' }));
const builderInstances: unknown[] = [];

vi.mock('@commercetools/ts-client', () => ({
  ClientBuilder: class {
    constructor() {
      builderInstances.push(this);
    }
    withProjectKey() { return this; }
    withClientCredentialsFlow() { return this; }
    withHttpMiddleware() { return this; }
    build = build;
  },
}));
vi.mock('@commercetools/platform-sdk', () => ({
  createApiBuilderFromCtpClient: () => ({ withProjectKey: () => ({ root: true }) }),
}));

const env = {
  CTP_PROJECT_KEY: 'p', CTP_AUTH_URL: 'https://auth', CTP_API_URL: 'https://api', CTP_CLIENT_ID: 'c',
  CTP_CLIENT_SECRET: 's', CTP_SCOPES: 'a:p b:p', CTP_CHECKOUT_APP_KEY: 'k', SESSION_SECRET: 'x'.repeat(32),
};

describe('getApiRoot', () => {
  it('returns the same root and builds the client once', async () => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const { getApiRoot } = await import('./client');
    expect(getApiRoot()).toBe(getApiRoot());
    expect(builderInstances).toHaveLength(1);
    expect(build).toHaveBeenCalledTimes(1);
  });
});
