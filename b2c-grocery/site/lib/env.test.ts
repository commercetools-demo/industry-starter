// @vitest-environment node
import { getRegion, shouldValidateAtBuild, validateEnv } from './env-core';

const full = {
  CTP_PROJECT_KEY: 'p', CTP_AUTH_URL: 'a', CTP_API_URL: 'b', CTP_CLIENT_ID: 'c', CTP_CLIENT_SECRET: 's',
  CTP_SCOPES: 'x', CTP_CHECKOUT_APP_KEY: 'k', SESSION_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('returns the values when complete', () => {
    expect(validateEnv(full).CTP_PROJECT_KEY).toBe('p');
  });
  it('names the first missing variable', () => {
    expect(() => validateEnv({ ...full, CTP_CLIENT_ID: undefined, SESSION_SECRET: undefined })).toThrow('Missing environment variable: CTP_CLIENT_ID');
  });
  it('Short secret in production: SESSION_SECRET under 32 characters is rejected', () => {
    expect(() => validateEnv({ ...full, SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET must be at least 32 characters');
  });
  it('never includes values in the message', () => {
    expect(() => validateEnv({ ...full, CTP_CLIENT_SECRET: '' })).toThrow(/^((?!x{32}).)*$/);
  });
});

describe('getRegion', () => {
  it('derives the region from the API URL', () => {
    expect(getRegion('https://api.us-central1.gcp.commercetools.com')).toBe('us-central1.gcp');
    expect(getRegion('https://api.europe-west1.gcp.commercetools.com')).toBe('europe-west1.gcp');
  });
});

describe('shouldValidateAtBuild', () => {
  it('is true only on Netlify', () => {
    expect(shouldValidateAtBuild({ NETLIFY: 'true' })).toBe(true);
    expect(shouldValidateAtBuild({})).toBe(false);
  });
});
