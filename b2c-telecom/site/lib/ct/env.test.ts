// @vitest-environment node
import {
  flag,
  getCheckoutAppKey,
  getRegion,
  maybeValidateAtBuild,
  shouldValidateAtBuild,
  validateEnv,
  type EnvSource,
} from './env';

const VALID: EnvSource = {
  CTP_PROJECT_KEY: 'spec-test-b2c-telecom',
  CTP_AUTH_URL: 'https://auth.us-central1.gcp.commercetools.com',
  CTP_API_URL: 'https://api.us-central1.gcp.commercetools.com',
  CTP_CLIENT_ID: 'client-id-value',
  CTP_CLIENT_SECRET: 'topsecretvalue1234567890',
  CTP_SCOPES: 'view_products:spec-test-b2c-telecom',
  SESSION_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('Required environment variable missing: names the variable and prints no value of a present one', () => {
    const source: EnvSource = { ...VALID };
    delete source.CTP_SCOPES;
    let message = '';
    try {
      validateEnv(source);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe('Missing environment variable: CTP_SCOPES');
    expect(message).not.toContain('topsecret');
  });

  it('reports the first missing variable in the documented order', () => {
    expect(() => validateEnv({ ...VALID, CTP_CLIENT_ID: '', CTP_PROJECT_KEY: undefined })).toThrow(
      'Missing environment variable: CTP_PROJECT_KEY',
    );
    expect(() => validateEnv({ ...VALID, CTP_CLIENT_ID: '' })).toThrow('Missing environment variable: CTP_CLIENT_ID');
  });

  it('Session secret too weak: 31 characters is refused', () => {
    expect(() => validateEnv({ ...VALID, SESSION_SECRET: 'a'.repeat(31) })).toThrow('SESSION_SECRET must be at least 32 characters');
    expect(validateEnv({ ...VALID, SESSION_SECRET: 'a'.repeat(32) }).SESSION_SECRET).toHaveLength(32);
  });

  it('refuses a public prefix on secret-like names and names only the variable', () => {
    let message = '';
    try {
      validateEnv({ ...VALID, NEXT_PUBLIC_CTP_CLIENT_SECRET: 'leakedvalue' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe('Secret-like variable must not carry the public prefix: NEXT_PUBLIC_CTP_CLIENT_SECRET');
    expect(message).not.toContain('leakedvalue');
    expect(() => validateEnv({ ...VALID, NEXT_PUBLIC_SITE_URL: 'https://x.example' })).not.toThrow();
  });

  it('returns only typed fields and treats the checkout key as optional unless required', () => {
    const env = validateEnv({ ...VALID, OTHER: 'x' });
    expect(Object.keys(env).sort()).toEqual(Object.keys(VALID).sort());
    expect(() => validateEnv(VALID, { requireCheckout: true })).toThrow('Missing environment variable: CTP_CHECKOUT_APP_KEY');
    expect(validateEnv({ ...VALID, CTP_CHECKOUT_APP_KEY: 'k' }, { requireCheckout: true }).CTP_CHECKOUT_APP_KEY).toBe('k');
  });
});

describe('helpers', () => {
  it('getCheckoutAppKey throws by name when unset', () => {
    expect(() => getCheckoutAppKey({})).toThrow('Missing environment variable: CTP_CHECKOUT_APP_KEY');
    expect(getCheckoutAppKey({ CTP_CHECKOUT_APP_KEY: 'abc' })).toBe('abc');
  });

  it('getRegion extracts the region', () => {
    expect(getRegion('https://api.us-central1.gcp.commercetools.com')).toBe('us-central1.gcp');
    expect(getRegion('https://api.europe-west1.gcp.commercetools.com')).toBe('europe-west1.gcp');
  });

  it('flag reads true and 1', () => {
    expect(flag({ A: 'true' }, 'A')).toBe(true);
    expect(flag({ A: '1' }, 'A')).toBe(true);
    expect(flag({ A: 'false' }, 'A', true)).toBe(false);
    expect(flag({}, 'A')).toBe(false);
    expect(flag({}, 'A', true)).toBe(true);
  });

  it('shouldValidateAtBuild is true only on Netlify; maybeValidateAtBuild throws there', () => {
    expect(shouldValidateAtBuild({ NETLIFY: 'true' })).toBe(true);
    expect(shouldValidateAtBuild({})).toBe(false);
    expect(() => maybeValidateAtBuild({ NETLIFY: 'true' })).toThrow('Missing environment variable: CTP_PROJECT_KEY');
    expect(() => maybeValidateAtBuild({})).not.toThrow();
  });
});
