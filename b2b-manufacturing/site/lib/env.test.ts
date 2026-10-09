import { describe, expect, it } from 'vitest';
import { hasProvisioningEnv, validateEnv, validateProvisioningEnv } from './env';

const good = { CTP_PROJECT_KEY: 'p', CTP_AUTH_URL: 'https://auth', CTP_API_URL: 'https://api', CTP_CLIENT_ID: 'id', CTP_CLIENT_SECRET: 's', CTP_SCOPES: 'view_products:p', CTP_DEFAULT_STORE_KEY: 'mpw-web' };
const prov = { CTP_PROJECT_KEY: 'p', CTP_AUTH_URL: 'https://auth', CTP_API_URL: 'https://api', CTP_PROV_CLIENT_ID: 'id', CTP_PROV_CLIENT_SECRET: 's', CTP_PROV_SCOPES: 'manage_business_units:p' };

describe('malva-bff-and-session › Missing configuration', () => {
  it('returns the typed config', () => {
    expect(validateEnv(good)).toEqual({ projectKey: 'p', authUrl: 'https://auth', apiUrl: 'https://api', clientId: 'id', clientSecret: 's', scopes: 'view_products:p', defaultStoreKey: 'mpw-web' });
  });
  for (const name of Object.keys(good)) {
    it(`names ${name} when it is missing or blank`, () => {
      expect(() => validateEnv({ ...good, [name]: undefined })).toThrow(new RegExp(`Missing environment variable ${name}\\b`));
      expect(() => validateEnv({ ...good, [name]: '  ' })).toThrow(name);
    });
  }
  for (const name of ['CTP_PROV_CLIENT_ID', 'CTP_PROV_CLIENT_SECRET', 'CTP_PROV_SCOPES']) {
    it(`names ${name} for the provisioning client`, () => {
      expect(validateProvisioningEnv(prov).scopes).toBe('manage_business_units:p');
      expect(() => validateProvisioningEnv({ ...prov, [name]: '' })).toThrow(name);
    });
  }
  it('detects whether the provisioning client is configured', () => {
    expect(hasProvisioningEnv(prov)).toBe(true);
    expect(hasProvisioningEnv({ ...prov, CTP_PROV_CLIENT_SECRET: undefined })).toBe(false);
  });
});
