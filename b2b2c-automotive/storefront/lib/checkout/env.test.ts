// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkoutDevHosts, checkoutEnv, checkoutEnvSafe } from './env';

describe('checkoutDevHosts', () => {
  const both = { CHECKOUT_DEV_SESSIONS_URL: 'http://localhost:4051/session/', CHECKOUT_DEV_APP_URL: 'http://localhost:4051/app' };
  it('needs both urls', () => {
    expect(checkoutDevHosts({ NODE_ENV: 'development', ...both })).toEqual({ sessionsUrl: 'http://localhost:4051/session', appUrl: 'http://localhost:4051/app' });
    expect(checkoutDevHosts({ NODE_ENV: 'development', CHECKOUT_DEV_APP_URL: both.CHECKOUT_DEV_APP_URL })).toBeNull();
    expect(checkoutDevHosts({ NODE_ENV: 'development' })).toBeNull();
  });
  it('is never honoured in production', () => {
    expect(checkoutDevHosts({ NODE_ENV: 'production', ...both })).toBeNull();
  });
  it('only http and https urls count', () => {
    expect(checkoutDevHosts({ NODE_ENV: 'development', CHECKOUT_DEV_SESSIONS_URL: 'javascript:alert(1)', CHECKOUT_DEV_APP_URL: 'http://localhost:1' })).toBeNull();
  });
});

describe('checkoutEnv', () => {
  it('app key required in production', () => {
    expect(() => checkoutEnv({ NODE_ENV: 'production' })).toThrow(/CTP_CHECKOUT_APP_KEY/);
    expect(checkoutEnv({ NODE_ENV: 'production', CTP_CHECKOUT_APP_KEY: 'malva-automotive-checkout' }).applicationKey).toBe('malva-automotive-checkout');
  });
  it('app key optional in development', () => {
    expect(checkoutEnv({ NODE_ENV: 'development' })).toEqual({ applicationKey: undefined, devComplete: false });
    expect(checkoutEnv({ NODE_ENV: 'development', CTP_CHECKOUT_APP_KEY: '' }).applicationKey).toBeUndefined();
  });
  it('app key with a bad format is refused without echoing it', () => {
    expect(() => checkoutEnv({ NODE_ENV: 'development', CTP_CHECKOUT_APP_KEY: 'bad key!' })).toThrow('CTP_CHECKOUT_APP_KEY has an invalid format');
  });
  it('dev complete refused in production', () => {
    expect(() => checkoutEnv({ NODE_ENV: 'production', CTP_CHECKOUT_APP_KEY: 'app', CHECKOUT_DEV_COMPLETE: 'true' })).toThrow(/CHECKOUT_DEV_COMPLETE/);
    expect(checkoutEnv({ NODE_ENV: 'development', CHECKOUT_DEV_COMPLETE: 'true' }).devComplete).toBe(true);
    expect(checkoutEnv({ NODE_ENV: 'development' }).devComplete).toBe(false);
  });
  it('safe variant never throws and never enables the helper', () => {
    expect(checkoutEnvSafe({ NODE_ENV: 'production', CHECKOUT_DEV_COMPLETE: 'true' })).toEqual({ applicationKey: undefined, devComplete: false });
  });
});
