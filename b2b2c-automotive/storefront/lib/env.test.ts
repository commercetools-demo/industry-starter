// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret, validateEnv } from './env';

const good = (): Record<string, string> => ({
  CTP_PROJECT_KEY: 'proj',
  CTP_AUTH_URL: 'https://auth.example.test',
  CTP_API_URL: 'https://api.example.test',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'secret',
  CTP_SCOPES: 'view_stores  view_categories\nmanage_customers',
  SESSION_SECRET: 'y'.repeat(40),
  CONTENTOOLS_ORIGIN: 'https://contentools.example.test/',
});

afterEach(() => vi.unstubAllEnvs());

describe('Environment and least privilege: validateEnv', () => {
  it('Valid environment is parsed', () => {
    const env = validateEnv(good());
    expect(env.frontend.projectKey).toBe('proj');
    expect(env.contentoolsOrigin).toBe('https://contentools.example.test');
  });

  it.each(Object.keys(good()))('Missing %s names the variable', (name) => {
    const env: Record<string, string | undefined> = good();
    delete env[name];
    expect(() => validateEnv(env)).toThrow(`Missing environment variable ${name}`);
    env[name] = '   ';
    expect(() => validateEnv(env)).toThrow(`Missing environment variable ${name}`);
  });

  it('Weak secret', () => {
    expect(() => validateEnv({ ...good(), SESSION_SECRET: 'a'.repeat(31) })).toThrow('SESSION_SECRET must be at least 32 characters');
  });

  it.each(['CTP_AUTH_URL', 'CTP_API_URL', 'CONTENTOOLS_ORIGIN'])('Invalid URL names the variable %s', (name) => {
    expect(() => validateEnv({ ...good(), [name]: 'not a url' })).toThrow(new RegExp(`${name}.*URL`));
  });

  it('Error messages never contain the value', () => {
    for (const broken of [{ CTP_API_URL: 'nope' }, { SESSION_SECRET: 'short' }, { CTP_PROJECT_KEY: '' }]) {
      let message = '';
      try {
        validateEnv({ ...good(), CTP_CLIENT_SECRET: 'topsecretvalue', ...broken });
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).not.toBe('');
      expect(message).not.toContain('topsecretvalue');
      expect(message).not.toContain('nope');
      expect(message).not.toContain('short');
    }
  });

  it('Scopes are split on whitespace', () => {
    expect(validateEnv(good()).frontend.scopes).toEqual(['view_stores', 'view_categories', 'manage_customers']);
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
