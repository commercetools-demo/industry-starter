import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CT_ENV_VARS } from '@/lib/env';
import { DevEnvErrorPage, missingEnvInDev } from './env-guard';

const full: Record<string, string> = {
  ...Object.fromEntries(CT_ENV_VARS.map((name) => [name, 'v'])),
  SESSION_SECRET: 'x'.repeat(40),
};

describe('error-pages › Environment guard (development only)', () => {
  it('development: names the first missing variable', () => {
    expect(missingEnvInDev(full, 'development')).toBeNull();
    expect(missingEnvInDev({ ...full, CTP_CLIENT_ID: '' }, 'development')).toBe('CTP_CLIENT_ID');
    expect(missingEnvInDev({ ...full, SESSION_SECRET: undefined }, 'development')).toBe('SESSION_SECRET');
  });

  it('production and test: never answers, so no response can name a variable', () => {
    expect(missingEnvInDev({}, 'production')).toBeNull();
    expect(missingEnvInDev({}, 'test')).toBeNull();
    vi.stubEnv('NODE_ENV', 'production');
    expect(missingEnvInDev({})).toBeNull();
    vi.unstubAllEnvs();
  });

  it('the dev page names the variable, never a value', () => {
    const html = renderToStaticMarkup(<DevEnvErrorPage name="CTP_CLIENT_ID" />);
    expect(html).toContain('CTP_CLIENT_ID');
    expect(html).toContain('development');
  });
});
