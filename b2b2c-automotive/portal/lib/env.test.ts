// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret, validateEnv, validatePortalEnv } from './env';

const good = (): Record<string, string> => ({
  CTP_PROJECT_KEY: 'proj',
  CTP_AUTH_URL: 'https://auth.example.test',
  CTP_API_URL: 'https://api.example.test',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'secret',
  CTP_SCOPES: 'view_stores  view_categories\nmanage_customers',
  CTP_ADMIN_CLIENT_ID: 'admin-id',
  CTP_ADMIN_CLIENT_SECRET: 'admin-secret',
  CTP_ADMIN_SCOPES: 'manage_key_value_documents',
  CTP_PROVISION_CLIENT_ID: 'prov-id',
  CTP_PROVISION_CLIENT_SECRET: 'prov-secret',
  CTP_PROVISION_SCOPES: 'manage_business_units',
  SESSION_SECRET: 'y'.repeat(40),
  CONTENTOOLS_ORIGIN: 'https://contentools.example.test/',
});
const shared = Object.keys(good()).filter((k) => !k.startsWith('CTP_PROVISION_'));

afterEach(() => vi.unstubAllEnvs());

describe('Environment and least privilege: validateEnv', () => {
  it('Valid environment is parsed', () => {
    const env = validateEnv(good());
    expect(env.frontend.projectKey).toBe('proj');
    expect(env.contentoolsOrigin).toBe('https://contentools.example.test');
  });

  it.each(shared)('Missing %s names the variable', (name) => {
    const env: Record<string, string | undefined> = good();
    delete env[name];
    expect(() => validatePortalEnv(env)).toThrow(`Missing environment variable ${name}`);
    env[name] = '   ';
    expect(() => validatePortalEnv(env)).toThrow(`Missing environment variable ${name}`);
  });

  it('Weak secret', () => {
    expect(() => validateEnv({ ...good(), SESSION_SECRET: 'a'.repeat(31) })).toThrow('SESSION_SECRET must be at least 32 characters');
  });

  it.each(['CTP_AUTH_URL', 'CTP_API_URL', 'CONTENTOOLS_ORIGIN'])('Invalid URL names the variable %s', (name) => {
    expect(() => validatePortalEnv({ ...good(), [name]: 'not a url' })).toThrow(new RegExp(`${name}.*URL`));
  });

  it('Error messages never contain the value', () => {
    for (const broken of [{ CTP_API_URL: 'nope' }, { SESSION_SECRET: 'short' }, { CTP_PROJECT_KEY: '' }]) {
      let message = '';
      try {
        validatePortalEnv({ ...good(), CTP_CLIENT_SECRET: 'topsecretvalue', CTP_ADMIN_CLIENT_SECRET: 'topadminvalue', ...broken });
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).not.toBe('');
      for (const value of ['topsecretvalue', 'topadminvalue', 'nope', 'short']) expect(message).not.toContain(value);
    }
  });

  it('Scopes are split on whitespace', () => {
    expect(validateEnv(good()).frontend.scopes).toEqual(['view_stores', 'view_categories', 'manage_customers']);
  });

  it('Scopes that are only whitespace count as missing', () => {
    expect(() => validateEnv({ ...good(), CTP_SCOPES: ' \n ' })).toThrow('Missing environment variable CTP_SCOPES');
  });
});

describe('Environment and least privilege: validatePortalEnv', () => {
  it('Three credential sets are kept apart', () => {
    const env = validatePortalEnv(good());
    expect(env.frontend.clientId).toBe('id');
    expect(env.admin).toMatchObject({ clientId: 'admin-id', scopes: ['manage_key_value_documents'], projectKey: 'proj' });
    expect(env.provisioning).toMatchObject({ clientId: 'prov-id', scopes: ['manage_business_units'] });
  });

  it('Provisioning is optional outside production', () => {
    const env: Record<string, string | undefined> = { ...good(), NODE_ENV: 'development' };
    for (const k of Object.keys(env).filter((x) => x.startsWith('CTP_PROVISION_'))) delete env[k];
    expect(validatePortalEnv(env).provisioning).toBeNull();
  });

  it('Provisioning is required in production', () => {
    const env: Record<string, string | undefined> = { ...good(), NODE_ENV: 'production' };
    for (const k of Object.keys(env).filter((x) => x.startsWith('CTP_PROVISION_'))) delete env[k];
    expect(() => validatePortalEnv(env)).toThrow('Missing environment variable CTP_PROVISION_CLIENT_ID');
  });

  it('A set provisioning client id makes the rest required', () => {
    const env: Record<string, string | undefined> = { ...good(), NODE_ENV: 'development' };
    delete env.CTP_PROVISION_CLIENT_SECRET;
    expect(() => validatePortalEnv(env)).toThrow('Missing environment variable CTP_PROVISION_CLIENT_SECRET');
  });
});

describe('Stateless session: getSessionSecret', () => {
  it('Returns the encoded secret', () => {
    vi.stubEnv('SESSION_SECRET', 'z'.repeat(32));
    expect(getSessionSecret()).toEqual(new TextEncoder().encode('z'.repeat(32)));
  });
  it('No fallback key', () => {
    vi.stubEnv('SESSION_SECRET', '');
    expect(() => getSessionSecret()).toThrow('SESSION_SECRET');
  });
  it('Weak secret', () => {
    vi.stubEnv('SESSION_SECRET', 'q'.repeat(10));
    expect(() => getSessionSecret()).toThrow('at least 32');
  });
});
