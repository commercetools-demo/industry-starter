import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from '@/lib/env';

const GOOD = {
  CTP_PROJECT_KEY: 'malva-test',
  EXPECTED_PROJECT_KEY: 'malva-test',
  CTP_AUTH_URL: 'https://auth.example.com/',
  CTP_API_URL: 'https://api.example.com',
  CTP_CLIENT_ID: 'client-id-placeholder',
  CTP_CLIENT_SECRET: 'client-secret-placeholder',
  CTP_SCOPES: 'view_products:malva-test manage_orders:malva-test',
  SESSION_SECRET: 'x'.repeat(40),
};

function failure(source: Record<string, string | undefined>): EnvError {
  try {
    parseEnv(source);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvError);
    return error as EnvError;
  }
  throw new Error('parseEnv did not throw');
}

describe('environment validation', () => {
  it('Missing secret: SESSION_SECRET shorter than 32 names the variable and not the value', () => {
    const error = failure({ ...GOOD, SESSION_SECRET: 'short' });
    expect(error.message).toBe('SESSION_SECRET must be at least 32 characters');
    expect(error.message).not.toContain('short');
    expect(error.variable).toBe('SESSION_SECRET');
  });

  it('Missing secret: a missing CTP variable is named', () => {
    const { CTP_CLIENT_SECRET: _omit, ...rest } = GOOD;
    void _omit;
    expect(failure(rest).message).toBe('Missing environment variable CTP_CLIENT_SECRET');
    expect(failure({ ...GOOD, CTP_SCOPES: '   ' }).message).toContain('CTP_SCOPES');
  });

  it('Wrong project names both keys', () => {
    const error = failure({ ...GOOD, EXPECTED_PROJECT_KEY: 'other-project' });
    expect(error.message).toBe(
      'Wrong commercetools project: CTP_PROJECT_KEY="malva-test" but EXPECTED_PROJECT_KEY="other-project"',
    );
  });

  it('Public prefix on a secret fails', () => {
    for (const name of ['NEXT_PUBLIC_CTP_CLIENT_SECRET', 'NEXT_PUBLIC_CTP_CLIENT_ID', 'NEXT_PUBLIC_CTP_SCOPES']) {
      expect(failure({ ...GOOD, [name]: 'v' }).message).toBe(`${name} must not be public`);
    }
  });

  it('Project guard passes when keys match', () => {
    const env = parseEnv(GOOD);
    expect(env.CTP_PROJECT_KEY).toBe('malva-test');
    expect(env.CTP_AUTH_URL).toBe('https://auth.example.com');
  });

  it('A non-https URL fails by name', () => {
    expect(failure({ ...GOOD, CTP_API_URL: 'http://api.example.com' }).variable).toBe('CTP_API_URL');
  });
});
