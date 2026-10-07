// @vitest-environment node
import { register } from './instrumentation';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stub(nodeEnv: string, runtime: string) {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.stubEnv('NEXT_RUNTIME', runtime);
  vi.stubEnv('CTP_PROJECT_KEY', 'spec-test-b2c-telecom');
  vi.stubEnv('CTP_AUTH_URL', 'https://auth.example');
  vi.stubEnv('CTP_API_URL', 'https://api.example');
  vi.stubEnv('CTP_CLIENT_ID', 'id');
  vi.stubEnv('CTP_CLIENT_SECRET', 'topsecretvalue1234567890');
  vi.stubEnv('CTP_SCOPES', '');
  vi.stubEnv('SESSION_SECRET', 'a'.repeat(32));
}

describe('register', () => {
  it('Required environment variable missing: register() stops a production start naming the variable', () => {
    stub('production', 'nodejs');
    expect(() => register()).toThrow('Missing environment variable: CTP_SCOPES');
    try {
      register();
    } catch (error) {
      expect((error as Error).message).not.toContain('topsecret');
    }
  });

  it('is silent in development, test and the edge runtime', () => {
    stub('development', 'nodejs');
    expect(() => register()).not.toThrow();
    stub('test', 'nodejs');
    expect(() => register()).not.toThrow();
    stub('production', 'edge');
    expect(() => register()).not.toThrow();
  });

  it('passes in production when everything is set', () => {
    stub('production', 'nodejs');
    vi.stubEnv('CTP_SCOPES', 'view_products:spec-test-b2c-telecom');
    expect(() => register()).not.toThrow();
  });
});
