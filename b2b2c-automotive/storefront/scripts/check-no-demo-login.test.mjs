// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkNoDemoLogin } from './check-no-demo-login.mjs';
import { tmpApp } from './test-utils.mjs';

describe('Gates and tests: no demo login in production', () => {
  it('fails in production with the flag', () => {
    for (const env of [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'production' }, { CONTEXT: 'production' }, { RELEASE: '1' }]) {
      const problems = checkNoDemoLogin(tmpApp({}), { DEMO_LOGIN_ENABLED: 'true', ...env });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('DEMO_LOGIN_ENABLED');
    }
  });
  it('passes without the flag, also in production', () => {
    expect(checkNoDemoLogin(tmpApp({}), { NODE_ENV: 'production' })).toEqual([]);
    expect(checkNoDemoLogin(tmpApp({}), { DEMO_LOGIN_ENABLED: 'false', NODE_ENV: 'production' })).toEqual([]);
  });
  it('passes with the flag outside production', () => {
    expect(checkNoDemoLogin(tmpApp({}), { DEMO_LOGIN_ENABLED: 'true', NODE_ENV: 'development' })).toEqual([]);
    expect(checkNoDemoLogin(tmpApp({}), { DEMO_LOGIN_ENABLED: 'true', VERCEL_ENV: 'preview' })).toEqual([]);
  });
  it('fails when the demo password or its name is in the client bundle', () => {
    const env = { DEMO_LOGIN_PASSWORD: 'hunter2-hunter2' };
    expect(checkNoDemoLogin(tmpApp({ '.next/static/chunks/app.js': 'var p="hunter2-hunter2";' }), env)).toEqual(['chunks/app.js contains the demo password']);
    expect(checkNoDemoLogin(tmpApp({ '.next/static/chunks/app.js': 'process.env.DEMO_LOGIN_PASSWORD' }), {})).toEqual(['chunks/app.js contains "DEMO_LOGIN_PASSWORD"']);
  });
  it('passes with a clean bundle and without a build', () => {
    expect(checkNoDemoLogin(tmpApp({ '.next/static/chunks/app.js': 'nothing here' }), { DEMO_LOGIN_PASSWORD: 'hunter2-hunter2' })).toEqual([]);
    expect(checkNoDemoLogin(tmpApp({}), { DEMO_LOGIN_PASSWORD: 'hunter2-hunter2' })).toEqual([]);
  });
});
