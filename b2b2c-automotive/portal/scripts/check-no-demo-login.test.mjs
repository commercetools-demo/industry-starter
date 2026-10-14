import { describe, expect, it } from 'vitest';
import { checkNoDemoLogin } from './check-no-demo-login.mjs';
import { tmp } from './test-utils.mjs';

describe('check-no-demo-login', () => {
  it('Production build: the flag on fails and names the setting', () => {
    expect(checkNoDemoLogin(tmp(), { NODE_ENV: 'production', DEMO_LOGIN_ENABLED: 'true' }).join('\n')).toMatch(/DEMO_LOGIN_ENABLED/);
    expect(checkNoDemoLogin(tmp(), { DEMO_LOGIN_ENABLED: 'true' }, { production: true })).toHaveLength(1);
  });

  it('a development environment with the flag on passes', () => {
    expect(checkNoDemoLogin(tmp(), { NODE_ENV: 'development', DEMO_LOGIN_ENABLED: 'true' })).toEqual([]);
  });

  it('a production build with the flag off passes', () => {
    expect(checkNoDemoLogin(tmp(), { NODE_ENV: 'production' })).toEqual([]);
  });

  it('the demo password in .next/static fails the check', () => {
    const root = tmp({ '.next/static/chunks/app.js': 'const x = "dummy-demo-password-1";' });
    expect(checkNoDemoLogin(root, { DEMO_LOGIN_PASSWORD: 'dummy-demo-password-1' }).join('\n')).toMatch(/contains the demo password/);
    expect(checkNoDemoLogin(tmp({ '.next/static/chunks/app.js': 'clean' }), { DEMO_LOGIN_PASSWORD: 'dummy-demo-password-1' })).toEqual([]);
  });
});
