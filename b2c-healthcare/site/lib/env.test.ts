import { describe, expect, it } from 'vitest';
import { CT_ENV_VARS, validateCtEnv } from './env';

const full = {
  CTP_PROJECT_KEY: 'proj',
  CTP_AUTH_URL: 'https://auth.example',
  CTP_API_URL: 'https://api.example',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'test-not-a-secret',
  CTP_SCOPES: 'view_products:proj manage_orders:proj',
};

describe('storefront-bff-and-session: Single server-side commercetools client', () => {
  it('Missing configuration: valid env yields a config with split scopes', () => {
    const config = validateCtEnv(full);
    expect(config.projectKey).toBe('proj');
    expect(config.scopes).toEqual(['view_products:proj', 'manage_orders:proj']);
  });

  it.each(CT_ENV_VARS)('Missing configuration: %s missing names the variable', (name) => {
    const env: Record<string, string | undefined> = { ...full, [name]: undefined };
    expect(() => validateCtEnv(env)).toThrow(name);
    expect(() => validateCtEnv({ ...full, [name]: '  ' })).toThrow(name);
  });

  it('Missing configuration: the error never contains other values', () => {
    expect(() => validateCtEnv({ ...full, CTP_SCOPES: '' })).toThrow(/CTP_SCOPES/);
    try {
      validateCtEnv({ ...full, CTP_SCOPES: '' });
    } catch (e) {
      expect(String(e)).not.toContain('test-not-a-secret');
    }
  });
});
